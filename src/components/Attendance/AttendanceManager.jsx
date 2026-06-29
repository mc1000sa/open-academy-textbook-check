import React, { useState, useEffect, useMemo } from 'react';
import {
  getFirebaseService,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  onSnapshot,
  collection
} from '../../services/firebaseService.js';
import {
  buildWithdrawalLog,
  copyTextSafely,
  sortStudentsByPrintPin
} from '../../lib/attendancePrint.js';
import { getAttendancePresetRange } from '../../lib/attendanceDates.js';
import { buildStudentHistoryItems } from '../../lib/attendanceHistory.js';
import {
  DEFAULT_PARENT_CONSULT_TAG,
  PARENT_CONSULT_TAGS,
  normalizeParentConsultTag
} from '../../lib/attendanceConsultation.js';

// 날짜 범위 생성 유틸 (YYYY-MM-DD 형태의 배열 반환, 최대 31일 제한)
const getDateRange = (start, end) => {
  const dates = [];
  let curr = new Date(start);
  const last = new Date(end);
  let limit = 0;
  while (curr <= last && limit < 31) {
    dates.push(curr.toISOString().slice(0, 10));
    curr.setDate(curr.getDate() + 1);
    limit++;
  }
  return dates;
};

// 오늘이 속한 주의 일요일(시작) ~ 토요일(종료) 날짜 반환
const getThisWeekRange = () => {
  const today = new Date();
  const day = today.getDay(); // 0: 일, 1: 월, ...
  
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - day);
  
  const saturday = new Date(today);
  saturday.setDate(today.getDate() - day + 6);
  
  return {
    start: sunday.toISOString().slice(0, 10),
    end: saturday.toISOString().slice(0, 10)
  };
};

// 날짜 헤더 요일 기입 포맷터 (MM월 DD일 (요일))
const formatHeaderDate = (dateStr) => {
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const day = dayNames[d.getDay()];
  return `${mm}월 ${dd}일 (${day})`;
};

// YYYY-MM-DD (요일) 포맷터
const formatDateWithDay = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const day = dayNames[d.getDay()];
  return `${dateStr} (${day})`;
};

const DAY_LABELS = [
  { label: '일', value: 0 },
  { label: '월', value: 1 },
  { label: '화', value: 2 },
  { label: '수', value: 3 },
  { label: '목', value: 4 },
  { label: '금', value: 5 },
  { label: '토', value: 6 }
];

export default function AttendanceManager({ state, updateLegacyState, deps }) {
  const { showModalAlert, showModalConfirm, notify } = deps;
  const isAdmin = state.currentTeacher?.role === 'admin';

  // 1. 탭 및 DB 상태
  const [activeTab, setActiveTab] = useState('input'); // 'input' | 'output'
  const [db, setDb] = useState(null);
  
  // 2. 입력 화면용 상태
  const [selectedClassId, setSelectedClassId] = useState('');
  const [weekRange, setWeekRange] = useState(getThisWeekRange());
  const [startDate, setStartDate] = useState(weekRange.start);
  const [endDate, setEndDate] = useState(weekRange.end);
  
  const [attendanceData, setAttendanceData] = useState({});
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [consultingList, setConsultingList] = useState([]);
  
  // 반별 출석 요일 지정 (0: 일 ~ 6: 토)
  const [activeDays, setActiveDays] = useState([1, 2, 3, 4, 5]); // 기본값 월~금
  const [cellPadding, setCellPadding] = useState(2); // 출석부 표 높이 조절 패딩 (기본값 2px)
  
  // 교재배부 전체 아이콘용 맵 (key: studentId_date -> [content])
  const [classBookDistributions, setClassBookDistributions] = useState({});

  // 3. 신규 모달 통합 상태 (수정 모드 포함)
  const [activeModal, setActiveModal] = useState(null); 
  const [editingLogId, setEditingLogId] = useState(null); // 수정 중인 상담 기록 ID
  
  // 모달 입력 필드들
  const [modalTag, setModalTag] = useState('');
  const [modalContent, setModalContent] = useState('');
  const [modalExtraContent, setModalExtraContent] = useState('');
  const [modalDate, setModalDate] = useState(new Date().toISOString().slice(0, 10));
  const [targetClassId, setTargetClassId] = useState(''); // 전반 대상 반
  const [bookPrice, setBookPrice] = useState(''); // 교재 배부 단가
  const [selectedBookId, setSelectedBookId] = useState(''); // 배부 대상 교재
  const [applyToAll, setApplyToAll] = useState(false); // 전인원 동일 적용 토글
  const [dischargeDate, setDischargeDate] = useState(new Date().toISOString().slice(0, 10)); // 퇴원일
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10)); // 전반일
  const [dischargeStudent, setDischargeStudent] = useState(null); // 퇴원/전반 처리 대상 학생
  const [copiedText, setCopiedText] = useState('');

  // 4. 출력 화면용 상태
  const [outputClassId, setOutputClassId] = useState('');
  const [outputStudentId, setOutputStudentId] = useState('');
  const [outputStartDate, setOutputStartDate] = useState(getThisWeekRange().start);
  const [outputEndDate, setOutputEndDate] = useState(getThisWeekRange().end);
  const [outputMode, setOutputMode] = useState('class'); // 'class' | 'student' | 'consult'
  const [printScale, setPrintScale] = useState('100');
  const [outputClassSort, setOutputClassSort] = useState('name'); // 'name' | 'absent_desc' | 'late_desc'
  const [withdrawalReportMode, setWithdrawalReportMode] = useState('lastClass');
  // 기간별 상담일지 전용 상태
  const [consultPeriodData, setConsultPeriodData] = useState([]); // 기간 내 전체 상담 목록
  const [consultSortField, setConsultSortField] = useState('date'); // 정렬 기준 컬럼
  const [consultSortDir, setConsultSortDir] = useState('asc'); // 'asc' | 'desc'
  const [consultCopied, setConsultCopied] = useState(false); // 복사 완료 피드백
  const printScaleValue = Number(printScale) / 100;

  // Firebase DB 인스턴스 획득
  useEffect(() => {
    getFirebaseService().then(service => {
      setDb(service.db);
    });
  }, []);

  // 반(Class) 목록 필터링 및 학년 기준 정렬 (고1 -> 고2 -> 고3 순)
  const availableClasses = useMemo(() => {
    const raw = isAdmin ? (state.classes || []) : (state.classes || []).filter(c => c.teacherId === state.currentTeacher?.id);
    const gradeOrder = { '고1': 1, '고2': 2, '고3': 3 };
    return [...raw].sort((a, b) => {
      const orderA = gradeOrder[a.grade] || 99;
      const orderB = gradeOrder[b.grade] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return String(a.name).localeCompare(String(b.name), 'ko');
    });
  }, [state.classes, state.currentTeacher, isAdmin]);

  // 입력 반 자동 바인딩
  useEffect(() => {
    if (availableClasses.length > 0 && !selectedClassId) {
      const defaultId = state.selectedInspectionClassId || availableClasses[0].id;
      setSelectedClassId(defaultId);
    }
  }, [availableClasses, state.selectedInspectionClassId, selectedClassId]);

  // 출력 반 자동 바인딩 (selectedClassId와 항상 동기화)
  useEffect(() => {
    if (selectedClassId) {
      setOutputClassId(selectedClassId);
    } else if (availableClasses.length > 0) {
      setOutputClassId(availableClasses[0].id);
    }
  }, [selectedClassId, availableClasses]);

  // 반 공통 선택 핸들러 (교재점검·출석입력·출력 모두 동기화)
  const handleClassSelect = (classId) => {
    setSelectedClassId(classId);
    setOutputClassId(classId);
    updateLegacyState({ selectedInspectionClassId: classId });
  };

  // 현재 반 객체
  const selectedClass = useMemo(() => {
    return availableClasses.find(c => c.id === selectedClassId) || null;
  }, [availableClasses, selectedClassId]);

  const outputSelectedClass = useMemo(() => {
    return availableClasses.find(c => c.id === outputClassId) || null;
  }, [availableClasses, outputClassId]);

  // 반별 출석 요일 정보 실시간 동기화
  useEffect(() => {
    if (selectedClass) {
      setActiveDays(selectedClass.attendanceDays || [1, 2, 3, 4, 5]); // 설정값 없으면 월~금
    }
  }, [selectedClassId, selectedClass]);

  // 요일 토글 클릭 및 Firestore 연동
  const handleDayToggle = async (dayValue) => {
    if (!db || !selectedClassId) return;
    
    let nextDays = [...activeDays];
    if (nextDays.includes(dayValue)) {
      nextDays = nextDays.filter(d => d !== dayValue);
    } else {
      nextDays.push(dayValue);
    }
    nextDays.sort((a, b) => a - b);

    try {
      const classRef = doc(db, 'openacademy_textbook_classes', selectedClassId);
      await updateDoc(classRef, {
        attendanceDays: nextDays
      });
      setActiveDays(nextDays);
    } catch (err) {
      console.error("Failed to update attendanceDays:", err);
      showModalAlert("출석 요일 설정을 저장하는 중 오류가 발생했습니다.");
    }
  };

  const handlePresetRange = (preset) => {
    const range = getAttendancePresetRange(preset);
    setStartDate(range.start);
    setEndDate(range.end);
  };

  // 날짜 컬럼 생성 (체크된 요일에 해당하는 날짜만 필터링)
  const dateColumns = useMemo(() => {
    if (!startDate || !endDate) return [];
    const allDates = getDateRange(startDate, endDate);
    return allDates.filter(date => {
      const dayNum = new Date(date).getDay();
      return activeDays.includes(dayNum);
    });
  }, [startDate, endDate, activeDays]);

  // 학생별 날짜별 노출 조건 판정
  const isStudentVisibleOnDate = (student, classId, dateStr) => {
    if (student.classId === classId) {
      if (student.dischargeDate && dateStr > student.dischargeDate) {
        return false;
      }
      if (student.transferDate && student.previousClassId && dateStr <= student.transferDate) {
        return false;
      }
      return true;
    }
    if (student.previousClassId === classId) {
      if (student.transferDate && dateStr <= student.transferDate) {
        return true;
      }
    }
    return false;
  };

  // 반의 인원수 계산용 학생 목록 (현재 활성 학생 기준)
  const getActiveStudentCount = (classId) => {
    return (state.students || []).filter(s => s.classId === classId && s.active !== false && s.status !== 'withdrawn').length;
  };

  // 출석부 표시용 최종 학생 목록 필터링
  const classStudents = useMemo(() => {
    if (!selectedClassId) return [];
    return (state.allStudents || [])
      .filter(s => {
        if (s.deleted === true) return false;
        const belongs = s.classId === selectedClassId || s.previousClassId === selectedClassId;
        if (!belongs) return false;

        // 기간 내 하루라도 노출 조건이 참인 날짜가 있다면 출석부에 표시
        return dateColumns.some(date => isStudentVisibleOnDate(s, selectedClassId, date));
      })
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'));
  }, [state.allStudents, selectedClassId, dateColumns]);

  // 학생 선택 자동 동기화
  useEffect(() => {
    if (classStudents.length > 0) {
      setSelectedStudent(prev => {
        const stillExists = classStudents.find(s => s.id === prev?.id);
        return stillExists || classStudents[0];
      });
    } else {
      setSelectedStudent(null);
    }
  }, [classStudents]);

  // 출력 탭에서 해당 반의 학생 목록 (정렬 포함)
  const outputStudents = useMemo(() => {
    if (!outputClassId) return [];
    const base = (state.allStudents || [])
      .filter(s => s.deleted !== true && (s.classId === outputClassId || s.previousClassId === outputClassId));
    if (outputClassSort === 'absent_desc') {
      return [...base].sort((a, b) => {
        const countA = Object.entries(attendanceData).filter(([k, v]) => k.startsWith(a.id + '_') && v.status === '결석').length;
        const countB = Object.entries(attendanceData).filter(([k, v]) => k.startsWith(b.id + '_') && v.status === '결석').length;
        return countB - countA;
      });
    }
    if (outputClassSort === 'late_desc') {
      return [...base].sort((a, b) => {
        const countA = Object.entries(attendanceData).filter(([k, v]) => k.startsWith(a.id + '_') && v.status === '지각').length;
        const countB = Object.entries(attendanceData).filter(([k, v]) => k.startsWith(b.id + '_') && v.status === '지각').length;
        return countB - countA;
      });
    }
    return [...base].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko'));
  }, [state.allStudents, outputClassId, outputClassSort, attendanceData]);

  // 출력 탭 학생 자동 선택
  useEffect(() => {
    if (outputStudents.length > 0) {
      setOutputStudentId(prev => {
        const stillExists = outputStudents.find(s => s.id === prev);
        return stillExists ? prev : outputStudents[0].id;
      });
    } else {
      setOutputStudentId('');
    }
  }, [outputStudents]);

  // Firestore 출석 정보 실시간 구독
  useEffect(() => {
    if (!db || !selectedClassId) return;
    let active = true;

    const q = query(collection(db, 'attendance'), where('classId', '==', selectedClassId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!active) return;
      const data = {};
      snapshot.docs.forEach(docSnap => {
        const docData = docSnap.data();
        data[`${docData.studentId}_${docData.date}`] = {
          status: docData.status,
          note: docData.note || ''
        };
      });
      setAttendanceData(data);
    }, (err) => {
      console.error("Attendance sub error:", err);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [db, selectedClassId]);

  // 교재배부 상담기록 실시간 구독
  useEffect(() => {
    if (!db || !selectedClassId) return;
    let active = true;

    const q = query(collection(db, 'consulting'), where('category', '==', '교재배부'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!active) return;
      const distMap = {};
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        const key = `${data.studentId}_${data.date}`;
        if (!distMap[key]) distMap[key] = [];
        distMap[key].push(data.content);
      });
      setClassBookDistributions(distMap);
    }, (err) => {
      console.error("Book distribution sub error:", err);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [db, selectedClassId]);

  // 선택된 학생의 상담/히스토리 실시간 구독
  useEffect(() => {
    if (!db || !selectedStudent?.id) {
      setConsultingList([]);
      return;
    }
    let active = true;

    const q = query(collection(db, 'consulting'), where('studentId', '==', selectedStudent.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!active) return;
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      list.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
      setConsultingList(list);
    }, (err) => {
      console.error("Consulting sub error:", err);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [db, selectedStudent]);

  const historyItems = useMemo(() => {
    return buildStudentHistoryItems({
      studentId: selectedStudent?.id || '',
      attendanceData,
      consultingList
    });
  }, [selectedStudent?.id, attendanceData, consultingList]);

  // 출석 상태 클릭 저장
  const saveAttendanceStatus = async (student, date, statusValue) => {
    if (!db) return;
    const key = `${student.id}_${date}`;
    const current = attendanceData[key]?.status || '미체크';
    
    // 이미 지정된 걸 또 누르면 '미체크'로 취소
    const finalStatus = current === statusValue ? '미체크' : statusValue;

    const docId = `${student.id}_${date}`;
    const attendanceDocRef = doc(db, 'attendance', docId);

    // 1) 낙관적 UI 업데이트 (즉시 반영)
    const previousState = { ...attendanceData };
    setAttendanceData(prev => ({
      ...prev,
      [key]: {
        status: finalStatus,
        note: ''
      }
    }));

    try {
      await setDoc(attendanceDocRef, {
        studentId: student.id,
        studentName: student.name,
        date,
        classId: selectedClassId,
        className: selectedClass?.name || '',
        status: finalStatus,
        note: '',
        updatedAt: serverTimestamp(),
        updatedBy: state.currentTeacher?.name || '시스템'
      });
      // 화면 출렁임 방지 및 즉각적 반응을 위해 notify 알림은 생략합니다.
    } catch (err) {
      console.error("Failed to save attendance:", err);
      // 실패 시 롤백
      setAttendanceData(previousState);
      showModalAlert("출석 정보를 저장하는 도중 오류가 발생했습니다.");
    }
  };

  // 모두 출석 일괄 등록 (오늘 날짜 기준, 기록되지 않은 학생만 일괄 출석 처리)
  const handleAllAttendToday = async () => {
    if (!db || classStudents.length === 0) return;
    const todayStr = new Date().toISOString().slice(0, 10);

    let updatedCount = 0;
    try {
      for (const student of classStudents) {
        if (!isStudentVisibleOnDate(student, selectedClassId, todayStr)) continue;
        
        const key = `${student.id}_${todayStr}`;
        const current = attendanceData[key]?.status || '미체크';
        if (current === '미체크') {
          const attendanceDocRef = doc(db, 'attendance', key);
          await setDoc(attendanceDocRef, {
            studentId: student.id,
            studentName: student.name,
            date: todayStr,
            classId: selectedClassId,
            className: selectedClass?.name || '',
            status: '출석',
            note: '',
            updatedAt: serverTimestamp(),
            updatedBy: state.currentTeacher?.name || '시스템'
          });
          updatedCount++;
        }
      }
      notify(`총 ${updatedCount}명의 원생이 출석 처리되었습니다.`);
    } catch (err) {
      console.error("Failed all attend today:", err);
      showModalAlert("일괄 출석을 처리하는 중 오류가 발생했습니다.");
    }
  };

  // 출석 버튼을 누른 학생으로 우측 상세 패널을 전환하고 상태만 저장합니다.
  const handleAttendanceStatusClick = (student, date, status) => {
    setSelectedStudent(student);
    saveAttendanceStatus(student, date, status);
  };

  // 신규 모달 열기 헬퍼
  const openActionModal = (type) => {
    if (!selectedStudent) {
      showModalAlert("학생을 먼저 선택해 주세요.");
      return;
    }
    setActiveModal(type);
    setEditingLogId(null);
    setModalContent('');
    setModalExtraContent('');
    setModalDate(new Date().toISOString().slice(0, 10));
    setCopiedText('');
    setBookPrice('');
    setApplyToAll(false);

    if (type === 'parent_consult') {
      setModalTag(DEFAULT_PARENT_CONSULT_TAG);
    } else if (type === 'student_consult') {
      setModalTag('정기상담');
    } else if (type === 'discharge_consult') {
      setModalTag('학부모 상담');
    } else if (type === 'absent_reason') {
      setModalTag('병결');
    } else if (type === 'late_reason') {
      setModalTag('늦잠');
    } else if (type === 'book_dist') {
      const assignedBooks = state.classBooks.filter(cb => cb.classId === selectedClassId && cb.status === 'active');
      setSelectedBookId(assignedBooks[0]?.bookId || '');
    }
  };

  // 상담기록 수정 모달 열기 헬퍼
  const openEditConsultingModal = (item) => {
    setEditingLogId(item.id);
    setModalDate(item.date || new Date().toISOString().slice(0, 10));
    setCopiedText('');

    // 콘텐츠 정규 매칭 파싱
    const rawContent = item.content || '';
    const cleanContent = rawContent.replace(/^\[.*?\]\s*/, '');
    setModalContent(cleanContent);

    // 태그 파싱
    const tagMatch = rawContent.match(/^\[.*?\s*-\s*(.*?)\]/);
    const tag = tagMatch ? tagMatch[1] : '';

    if (item.category === '상담') {
      if (rawContent.includes('[학부모 상담')) {
        setActiveModal('parent_consult');
        setModalTag(normalizeParentConsultTag(tag));
      } else {
        setActiveModal('student_consult');
        setModalTag(tag || '정기상담');
      }
    } else if (
      item.category === '진로상담'
      || (item.category === '퇴원상담' && rawContent.startsWith('[퇴원 상담 -'))
    ) {
      setActiveModal('discharge_consult');
      setModalTag(tag || '학부모 상담');
    } else if (item.category === '출결') {
      const isLate = item.attendanceStatus === '지각' || rawContent.includes('지각');
      setActiveModal(isLate ? 'late_reason' : 'absent_reason');
      setModalTag(tag || (isLate ? '늦잠' : '병결'));

      if (isLate) {
        const timeMatch = rawContent.match(/\((\d+)분 지각\)/);
        const detail = cleanContent.replace(/^\(\d+분 지각\)\s*/, '');
        setModalContent(timeMatch?.[1] || '');
        setModalExtraContent(detail);
      }
    } else if (item.category === '교재배부') {
      setActiveModal('book_dist');
      // 교재명 파싱 (기존 포맷과 신규 포맷 모두 지원)
      let bookTitle = '';
      if (rawContent.includes('교재명:')) {
        const bookTitleMatch = rawContent.match(/교재명:\s*(.*?)(?:\s*\(|$)/);
        bookTitle = bookTitleMatch ? bookTitleMatch[1] : '';
      } else {
        bookTitle = rawContent.split(' (교재비:')[0].trim();
      }
      const matchedBook = state.books.find(b => b.title === bookTitle);
      setSelectedBookId(matchedBook ? matchedBook.id : '');

      // 금액 파싱
      const priceMatch = rawContent.match(/교재비:\s*([\d,]+)원/);
      const price = priceMatch ? priceMatch[1].replace(/,/g, '') : '';
      setBookPrice(price);
      setApplyToAll(false);
    }
  };

  // 상담기록 삭제 헬퍼
  const handleDeleteConsulting = async (itemId) => {
    if (!db) return;
    const confirmed = await showModalConfirm("해당 상담/특이사항 기록을 정말 삭제하시겠습니까?");
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, 'consulting', itemId));
      notify("기록이 성공적으로 삭제되었습니다.");
    } catch (err) {
      console.error("Failed to delete consulting:", err);
      showModalAlert("기록 삭제 도중 오류가 발생했습니다.");
    }
  };

  // 모달 데이터 제출 통합 로직 (등록 및 수정 동시 대응)
  const handleModalSubmit = async () => {
    if (!db || !selectedStudent) return;

    try {
      if (activeModal === 'parent_consult' || activeModal === 'student_consult') {
        if (!modalContent.trim()) return showModalAlert("상담 내용을 입력해주세요.");
        const prefix = activeModal === 'parent_consult' ? '학부모 상담' : '학생 상담';
        const formattedContent = `[${prefix} - ${modalTag}] ${modalContent.trim()}`;

        if (editingLogId) {
          // 수정 모드
          await updateDoc(doc(db, 'consulting', editingLogId), {
            date: modalDate,
            content: formattedContent,
            updatedAt: serverTimestamp(),
            updatedBy: state.currentTeacher?.name || '시스템'
          });
          notify("상담기록이 수정되었습니다.");
        } else {
          // 등록 모드
          await addDoc(collection(db, 'consulting'), {
            studentId: selectedStudent.id,
            studentName: selectedStudent.name,
            date: modalDate,
            category: '상담',
            content: formattedContent,
            updatedAt: serverTimestamp(),
            updatedBy: state.currentTeacher?.name || '시스템'
          });
          notify("상담기록이 저장되었습니다.");
        }
        setActiveModal(null);
      } 
      
      else if (activeModal === 'discharge_consult') {
        if (!modalContent.trim()) return showModalAlert("진로 상담 내용을 입력해주세요.");
        const formattedContent = `[진로 상담 - ${modalTag}] ${modalContent.trim()}`;

        if (editingLogId) {
          await updateDoc(doc(db, 'consulting', editingLogId), {
            date: modalDate,
            content: formattedContent,
            updatedAt: serverTimestamp(),
            updatedBy: state.currentTeacher?.name || '시스템'
          });
          notify("진로상담 기록이 수정되었습니다.");
        } else {
          await addDoc(collection(db, 'consulting'), {
            studentId: selectedStudent.id,
            studentName: selectedStudent.name,
            date: modalDate,
            category: '진로상담',
            content: formattedContent,
            updatedAt: serverTimestamp(),
            updatedBy: state.currentTeacher?.name || '시스템'
          });
          notify("진로상담 기록이 저장되었습니다.");
        }
        setActiveModal(null);
      } 
      
      else if (activeModal === 'absent_reason') {
        // 결석 사유 모달은 빈 내용 입력(태그만 선택)을 허용합니다.
        const suffix = modalContent.trim() ? ` ${modalContent.trim()}` : '';
        const formattedNote = `[${modalTag}]${suffix}`;
        const formattedContent = `[결석 사유 - ${modalTag}]${suffix}`;

        // 1) 출석부에 결석 및 note 업데이트
        const key = `${selectedStudent.id}_${modalDate}`;
        await setDoc(doc(db, 'attendance', key), {
          studentId: selectedStudent.id,
          studentName: selectedStudent.name,
          date: modalDate,
          classId: selectedClassId,
          className: selectedClass?.name || '',
          status: '결석',
          note: formattedNote,
          updatedAt: serverTimestamp(),
          updatedBy: state.currentTeacher?.name || '시스템'
        });

        // 2) 상담기록 수정 또는 등록
        if (editingLogId) {
          await updateDoc(doc(db, 'consulting', editingLogId), {
            date: modalDate,
            content: formattedContent,
            updatedAt: serverTimestamp(),
            updatedBy: state.currentTeacher?.name || '시스템'
          });
          notify("결석사유 및 출결 정보가 수정되었습니다.");
        } else {
          await addDoc(collection(db, 'consulting'), {
            studentId: selectedStudent.id,
            studentName: selectedStudent.name,
            date: modalDate,
            category: '출결',
            content: formattedContent,
            updatedAt: serverTimestamp(),
            updatedBy: state.currentTeacher?.name || '시스템'
          });
          notify(`${selectedStudent.name} 결석사유 저장 및 결석 처리가 완료되었습니다.`);
        }
        setActiveModal(null);
      }

      else if (activeModal === 'late_reason') {
        const lateMin = modalContent.trim();
        const timeText = lateMin ? ` (${lateMin}분 지각)` : '';
        const suffix = modalExtraContent?.trim() ? ` ${modalExtraContent.trim()}` : '';
        const formattedNote = `[지각-${modalTag}]${timeText}${suffix}`;
        const formattedContent = `[지각 사유 - ${modalTag}]${timeText}${suffix}`;

        const key = `${selectedStudent.id}_${modalDate}`;
        await setDoc(doc(db, 'attendance', key), {
          studentId: selectedStudent.id,
          studentName: selectedStudent.name,
          date: modalDate,
          classId: selectedClassId,
          className: selectedClass?.name || '',
          status: '지각',
          note: formattedNote,
          updatedAt: serverTimestamp(),
          updatedBy: state.currentTeacher?.name || '시스템'
        });

        if (editingLogId) {
          await updateDoc(doc(db, 'consulting', editingLogId), {
            date: modalDate,
            content: formattedContent,
            updatedAt: serverTimestamp(),
            updatedBy: state.currentTeacher?.name || '시스템'
          });
          notify("지각사유 및 출결 정보가 수정되었습니다.");
        } else {
          await addDoc(collection(db, 'consulting'), {
            studentId: selectedStudent.id,
            studentName: selectedStudent.name,
            date: modalDate,
            category: '출결',
            content: formattedContent,
            updatedAt: serverTimestamp(),
            updatedBy: state.currentTeacher?.name || '시스템'
          });
          notify(`${selectedStudent.name} 지각사유 저장 및 지각 처리가 완료되었습니다.`);
        }
        setActiveModal(null);
      }

      else if (activeModal === 'book_dist') {
        if (!selectedBookId) return showModalAlert("교재를 선택해주세요.");
        const bookObj = state.books.find(b => b.id === selectedBookId);
        const bookTitle = bookObj?.title || '알 수 없는 교재';
        const priceText = bookPrice ? ` (교재비: ${Number(bookPrice).toLocaleString()}원)` : '';
        const distContent = `${bookTitle}${priceText}`;

        if (editingLogId) {
          // 수정 모드 (단일 학생 수정만 대응)
          await updateDoc(doc(db, 'consulting', editingLogId), {
            date: modalDate,
            content: distContent,
            updatedAt: serverTimestamp(),
            updatedBy: state.currentTeacher?.name || '시스템'
          });
          notify("교재 배부 기록이 수정되었습니다.");
        } else {
          // 등록 모드
          if (applyToAll) {
            const confirmed = await showModalConfirm(`현재 반의 모든 활성 학생(${classStudents.length}명)에게 교재를 일괄 배부하시겠습니까?`);
            if (!confirmed) return;

            for (const student of classStudents) {
              await addDoc(collection(db, 'consulting'), {
                studentId: student.id,
                studentName: student.name,
                date: modalDate,
                category: '교재배부',
                content: distContent,
                updatedAt: serverTimestamp(),
                updatedBy: state.currentTeacher?.name || '시스템'
              });
            }
            notify(`반 인원 ${classStudents.length}명 모두에게 교재 배부가 적용되었습니다.`);
          } else {
            await addDoc(collection(db, 'consulting'), {
              studentId: selectedStudent.id,
              studentName: selectedStudent.name,
              date: modalDate,
              category: '교재배부',
              content: distContent,
              updatedAt: serverTimestamp(),
              updatedBy: state.currentTeacher?.name || '시스템'
            });
            notify(`${selectedStudent.name} 학생에게 교재가 배부되었습니다.`);
          }
        }
        setActiveModal(null);
      }
    } catch (err) {
      console.error("Error submitting modal data:", err);
      showModalAlert("정보를 저장하는 중 오류가 발생했습니다.");
    }
  };

  // 전반 처리 완료 제출
  const handleTransferSubmit = async () => {
    if (!db || !dischargeStudent) return;
    if (!targetClassId) return showModalAlert("이동할 반을 선택해주세요.");

    // 다른 선생님 반으로 이동: DB 변경 없이 기록만 남김
    if (targetClassId === '__other_teacher__') {
      if (!modalContent.trim()) return showModalAlert("이동할 반 이름을 입력해주세요.");
      try {
        await addDoc(collection(db, 'consulting'), {
          studentId: dischargeStudent.id,
          studentName: dischargeStudent.name,
          date: transferDate,
          category: '상담',
          content: `[타 선생님반 이관 처리] ${selectedClass?.name || '기존반'} ➔ ${modalContent.trim()} (일자: ${transferDate})`,
          updatedAt: serverTimestamp(),
          updatedBy: state.currentTeacher?.name || '시스템'
        });
        notify(`${selectedStudent.name} 학생의 타 선생님반 이관 기록이 저장되었습니다. 담당 선생님께 직접 학생 데이터 이관을 요청해 주세요.`);
        setActiveModal(null);
      } catch (err) {
        showModalAlert("기록 저장 중 오류가 발생했습니다.");
      }
      return;
    }

    if (!modalContent.trim()) return showModalAlert("전반 사유를 상세히 작성해 주세요.");

    const destClass = state.classes.find(c => c.id === targetClassId);
    const destClassName = destClass?.name || '알 수 없는 반';

    try {
      const studentRef = doc(db, 'openacademy_textbook_students', dischargeStudent.id);

      await updateDoc(studentRef, {
        classId: targetClassId,
        previousClassId: selectedClassId,
        transferDate: transferDate,
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, 'consulting'), {
        studentId: dischargeStudent.id,
        studentName: dischargeStudent.name,
        date: transferDate,
        category: '상담',
        content: `[전반 처리] ${selectedClass?.name || '기존반'} ➔ ${destClassName} (일자: ${transferDate})\n사유: ${modalContent.trim()}`,
        updatedAt: serverTimestamp(),
        updatedBy: state.currentTeacher?.name || '시스템'
      });

      notify(`${dischargeStudent.name} 학생의 ${destClassName} 전반 처리가 완료되었습니다.`);
      setActiveModal(null);
    } catch (err) {
      console.error("Failed transfer student:", err);
      showModalAlert("전반 처리를 진행하는 중 오류가 발생했습니다.");
    }
  };

  // 퇴원 처리 완료 제출
  const handleDischargeSubmit = async () => {
    if (!db || !dischargeStudent) return;
    if (!modalContent.trim()) {
      showModalAlert("퇴원 사유 및 상담 상세기록을 입력해 주세요.");
      return;
    }

    try {
      const studentRef = doc(db, 'openacademy_textbook_students', dischargeStudent.id);
      
      await updateDoc(studentRef, {
        status: 'withdrawn',
        active: false,
        dischargeDate: dischargeDate,
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, 'consulting'), {
        studentId: dischargeStudent.id,
        studentName: dischargeStudent.name,
        date: dischargeDate,
        category: '퇴원상담',
        content: `[퇴원 처리] 사유: ${modalContent.trim()}`,
        dischargeDate,
        updatedAt: serverTimestamp(),
        updatedBy: state.currentTeacher?.name || '시스템'
      });

      const formattedLog = buildWithdrawalLog({
        teacherName: state.currentTeacher?.name || '해당강사',
        student: dischargeStudent,
        className: selectedClass?.name || '미지정',
        dischargeDate,
        reason: modalContent,
        mode: withdrawalReportMode
      });
      setCopiedText(formattedLog);

      notify(`${dischargeStudent.name} 학생의 퇴원 처리가 반영되고 서식이 생성되었습니다.`);
    } catch (err) {
      console.error("Failed to discharge student:", err);
      showModalAlert("퇴원 처리를 진행하는 중 오류가 발생했습니다.");
    }
  };

  // 오늘 날짜 기준 전체 출석 상태 일괄 해제
  const handleAllResetToday = async () => {
    if (!db || classStudents.length === 0) return;
    const todayStr = new Date().toISOString().slice(0, 10);

    let resetCount = 0;
    try {
      for (const student of classStudents) {
        if (!isStudentVisibleOnDate(student, selectedClassId, todayStr)) continue;
        const key = `${student.id}_${todayStr}`;
        const current = attendanceData[key]?.status || '미체크';
        if (current !== '미체크') {
          await setDoc(doc(db, 'attendance', key), {
            studentId: student.id,
            studentName: student.name,
            date: todayStr,
            classId: selectedClassId,
            className: selectedClass?.name || '',
            status: '미체크',
            note: '',
            updatedAt: serverTimestamp(),
            updatedBy: state.currentTeacher?.name || '시스템'
          });
          resetCount++;
        }
      }
      notify(`총 ${resetCount}명의 출결 기록이 초기화되었습니다.`);
    } catch (err) {
      console.error("Failed to reset attendance:", err);
      showModalAlert("출결 초기화 중 오류가 발생했습니다.");
    }
  };

  // 🖨️ 인쇄 실행
  const handlePrint = () => {
    window.setTimeout(() => window.print(), 80);
  };

  const handleToggleAttendancePrintPin = async (student) => {
    if (!db || !student?.id) return;
    const nextPinned = !student.attendancePrintPinned;
    try {
      const studentRef = doc(db, 'openacademy_textbook_students', student.id);
      await updateDoc(studentRef, {
        attendancePrintPinned: nextPinned,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Failed to update attendance print pin:', err);
      showModalAlert('출석부 출력 고정 상태를 저장하는 중 오류가 발생했습니다.');
    }
  };

  const handleCopyWithdrawalLog = async () => {
    if (!withdrawalPreview) return;
    const copied = await copyTextSafely(withdrawalPreview);
    if (copied) {
      notify('✅ 퇴원일지 서식이 클립보드에 복사되었습니다.');
    } else {
      showModalAlert('클립보드 복사 권한이 없어 자동 복사에 실패했습니다. 표시된 서식을 직접 선택해 복사해 주세요.');
    }
  };

  // 출력 탭 실시간 상담 데이터 연동
  const [outputConsultings, setOutputConsultings] = useState([]);
  const [outputAttendanceData, setOutputAttendanceData] = useState({});

  useEffect(() => {
    if (!db || activeTab !== 'output' || !outputClassId) return;

    const qAttend = query(collection(db, 'attendance'), where('classId', '==', outputClassId));
    const unsubAttend = onSnapshot(qAttend, (snapshot) => {
      const data = {};
      snapshot.docs.forEach(docSnap => {
        const docData = docSnap.data();
        data[`${docData.studentId}_${docData.date}`] = {
          status: docData.status,
          note: docData.note || ''
        };
      });
      setOutputAttendanceData(data);
    });

    return () => unsubAttend();
  }, [db, activeTab, outputClassId]);

  useEffect(() => {
    if (!db || activeTab !== 'output' || !outputStudentId) {
      setOutputConsultings([]);
      return;
    }
    
    const qConsult = query(collection(db, 'consulting'), where('studentId', '==', outputStudentId));
    const unsubConsult = onSnapshot(qConsult, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
      setOutputConsultings(list);
    });

    return () => unsubConsult();
  }, [db, activeTab, outputStudentId]);

  // 기간별 상담일지: 강사 담당 반 전체의 상담 기록 구독
  useEffect(() => {
    if (!db || activeTab !== 'output' || outputMode !== 'consult') {
      setConsultPeriodData([]);
      return;
    }
    // 강사 담당 반 학생 ID 목록 추출
    const myStudentIds = (state.allStudents || [])
      .filter(s => s.deleted !== true && availableClasses.some(c => c.id === s.classId || c.id === s.previousClassId))
      .map(s => s.id);

    if (myStudentIds.length === 0) {
      setConsultPeriodData([]);
      return;
    }

    // Firestore in 쿼리는 최대 30개 제한이므로 배치 처리
    const BATCH = 30;
    const batches = [];
    for (let i = 0; i < myStudentIds.length; i += BATCH) {
      batches.push(myStudentIds.slice(i, i + BATCH));
    }

    let allDocs = [];
    const unsubs = [];
    let active = true;

    const merge = (batchDocs) => {
      // batchDocs를 전역 목록에 추가 후 갱신
      allDocs = allDocs.filter(d => !batchDocs.some(bd => bd.id === d.id));
      allDocs = [...allDocs, ...batchDocs];
      if (active) setConsultPeriodData([...allDocs]);
    };

    batches.forEach(batch => {
      const q = query(
        collection(db, 'consulting'),
        where('studentId', 'in', batch),
        where('category', '==', '상담')
      );
      const unsub = onSnapshot(q, (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        merge(docs);
      }, (err) => console.error('consultPeriod sub error:', err));
      unsubs.push(unsub);
    });

    return () => {
      active = false;
      unsubs.forEach(u => u());
    };
  }, [db, activeTab, outputMode, state.allStudents, availableClasses]);

  // 출력 화면용 날짜 컬럼 생성 (기록된 날짜만)
  const outputClassRecordedDates = useMemo(() => {
    if (!outputClassId || !outputStartDate || !outputEndDate) return [];
    
    const rangeDates = getDateRange(outputStartDate, outputEndDate);
    const recordedSet = new Set();

    Object.keys(outputAttendanceData).forEach(key => {
      const parts = key.split('_');
      if (parts.length >= 2) {
        const datePart = parts[1];
        if (rangeDates.includes(datePart)) {
          const status = outputAttendanceData[key]?.status;
          if (status && status !== '미체크') {
            recordedSet.add(datePart);
          }
        }
      }
    });

    return Array.from(recordedSet).sort();
  }, [outputClassId, outputStartDate, outputEndDate, outputAttendanceData]);

  // 개인별 출결 요약 통계 계산
  const outputStudentStats = useMemo(() => {
    if (!outputStudentId || !outputStartDate || !outputEndDate) return { total: 0, attend: 0, absent: 0, late: 0, rate: 0 };
    
    const rangeDates = getDateRange(outputStartDate, outputEndDate);
    const targetStudent = state.allStudents.find(s => s.id === outputStudentId);

    let total = 0;
    let attend = 0;
    let absent = 0;
    let late = 0;

    rangeDates.forEach(date => {
      const isVisible = targetStudent && isStudentVisibleOnDate(targetStudent, outputClassId, date);
      if (isVisible) {
        const key = `${outputStudentId}_${date}`;
        const status = outputAttendanceData[key]?.status || '미체크';
        if (status !== '미체크') {
          total++;
          if (status === '출석') attend++;
          else if (status === '결석') absent++;
          else if (status === '지각') late++;
        }
      }
    });

    const rate = total > 0 ? Math.round((attend / total) * 100) : 0;
    return { total, attend, absent, late, rate };
  }, [outputStudentId, outputStartDate, outputEndDate, outputAttendanceData, outputClassId, state.allStudents]);

  // 오늘 날짜 문자열
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayFormatted = useMemo(() => {
    const d = new Date();
    const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${mm}월 ${dd}일 (${dayNames[d.getDay()]})`;
  }, []);

  // 퇴원일지 실시간 미리보기
  const withdrawalPreview = useMemo(() => {
    if (!dischargeStudent) return '';

    // 교재 배부 기록
    const bookConsultings = consultingList.filter(c => c.category === '교재배부');
    const bookLines = bookConsultings.map(c => c.content);

    // 출결 통계 계산 (현재 조회 기간 기준)
    const attendRecords = consultingList
      .filter(c => c.category !== '교재배부')
      .map(() => null); // placeholder

    // attendanceData에서 해당 학생 출결 집계
    let total = 0, attend = 0, absent = 0, late = 0;
    let lastClassDate = '';
    Object.entries(attendanceData).forEach(([key, val]) => {
      if (!key.startsWith(dischargeStudent.id + '_')) return;
      const dateStr = key.replace(dischargeStudent.id + '_', '');
      if (val.status && val.status !== '미체크') {
        total++;
        if (val.status === '출석') { attend++; if (dateStr > lastClassDate) lastClassDate = dateStr; }
        else if (val.status === '결석') absent++;
        else if (val.status === '지각') { late++; if (dateStr > lastClassDate) lastClassDate = dateStr; }
      }
    });

    // 조회 기간 계산
    const start = startDate;
    const end = endDate;
    const totalDays = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;

    return buildWithdrawalLog({
      teacherName: state.currentTeacher?.name || '해당강사',
      student: dischargeStudent,
      className: selectedClass?.name || '미지정',
      dischargeDate,
      reason: modalContent || '',
      bookLines,
      mode: withdrawalReportMode,
      attendanceStats: { total, attend, absent, late },
      dateRange: { start, end, totalDays },
      lastClassDate
    });
  }, [dischargeStudent, consultingList, attendanceData, dischargeDate, modalContent, withdrawalReportMode, selectedClass, state.currentTeacher, startDate, endDate]);

  return (
    <div
      className={`space-y-6 w-full px-4 pb-20 pt-4 print-full-width ${activeTab === 'output' ? 'attendance-print-root' : ''}`}
      style={{ '--attendance-print-scale': printScaleValue }}
    >
      
      {/* 상단 통합 탭 네비게이션 */}
      <div className="flex justify-between items-center bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800/80 no-print tab-btn-row">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('input')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
              activeTab === 'input' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <i className="fas fa-edit mr-1.5"></i>
            출석 및 상담 입력
          </button>
          <button
            onClick={() => setActiveTab('output')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
              activeTab === 'output' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <i className="fas fa-print mr-1.5"></i>
            출석부 출력 시스템
          </button>
        </div>
        <div className="text-[11px] font-black text-cyan-400/80 px-4">
          OATIS ATTENDANCE & CONSULTING
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 탭 1: 출석 및 상담 입력 화면 */}
      {/* ========================================================================= */}
      {activeTab === 'input' && (
        <div className="flex flex-col xl:flex-row gap-6 items-stretch print-full-width w-full">
          {/* 가로축 기간별 출석 그리드 영역 */}
          <div className="flex-1 p-6 bg-slate-900/40 border border-slate-800 rounded-3xl flex flex-col print-full-width">
            
            {/* 조회반 버튼식 노출 (학년별 고1->고2->고3 정렬 및 인원수 노출) */}
            <div className="mb-6 no-print">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-400 tracking-wider">조회 반 선택</span>
                  {selectedClassId && (
                    <span className="text-[10px] font-extrabold text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded-md border border-cyan-900/30">
                      현재 반 실 인원: {getActiveStudentCount(selectedClassId)}명
                    </span>
                  )}
                </div>
                {/* 오늘 날짜 표시 */}
                <div className="text-right">
                  <div className="text-[11px] font-black text-slate-500 tracking-wider">TODAY</div>
                  <div className="text-[18px] font-black text-cyan-300 leading-tight">{todayFormatted}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {availableClasses.map(c => {
                  const active = c.id === selectedClassId;
                  const count = getActiveStudentCount(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleClassSelect(c.id)}
                      className={`px-3 py-2 rounded-xl text-[10px] font-black transition-all border ${
                        active
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent shadow-lg shadow-blue-500/25 scale-[1.02]'
                          : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      {c.name} <span className="text-[9px] font-semibold text-slate-500 ml-1">({count}명)</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 상단 날짜 및 요일 체크박스 지정 도구 */}
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 flex flex-wrap gap-4 items-center justify-between mb-6 no-print">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-black text-slate-400 tracking-wider">조회 기간:</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      onClick={e => { try { e.target.showPicker(); } catch (err) {} }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    />
                    <button className="border border-slate-800 bg-slate-900 rounded-xl px-3 py-1.5 text-xs text-slate-300 font-mono text-center justify-center flex items-center min-w-[160px]">
                      {formatDateWithDay(startDate)}
                    </button>
                  </div>
                  <span className="text-slate-650 font-black">~</span>
                  <div className="relative">
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      onClick={e => { try { e.target.showPicker(); } catch (err) {} }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    />
                    <button className="border border-slate-800 bg-slate-900 rounded-xl px-3 py-1.5 text-xs text-slate-300 font-mono text-center justify-center flex items-center min-w-[160px]">
                      {formatDateWithDay(endDate)}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 border-l border-slate-800 pl-4">
                  {[
                    { key: '2weeks', label: '2주 조회' },
                    { key: '3weeks', label: '3주 조회' },
                    { key: 'month', label: '한달 조회' }
                  ].map(option => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => handlePresetRange(option.key)}
                      className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1.5 text-[9px] font-black text-cyan-300 transition-colors hover:bg-cyan-500/20"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {/* 반별 출석 요일 지정 체크박스 */}
                <div className="flex items-center gap-2 border-l border-slate-800 pl-4">
                  <span className="text-[10px] font-black text-slate-400 tracking-wider">출석부 요일 지정:</span>
                  <div className="flex gap-1">
                    {DAY_LABELS.map(d => {
                      const checked = activeDays.includes(d.value);
                      return (
                        <button
                          key={d.value}
                          type="button"
                          onClick={() => handleDayToggle(d.value)}
                          className={`w-6 h-6 rounded-md text-[10px] font-black border transition-all ${
                            checked 
                              ? 'bg-emerald-600 text-white border-transparent shadow-sm shadow-emerald-500/15' 
                              : 'bg-slate-950/40 text-slate-600 border-slate-850 hover:text-slate-400 hover:bg-slate-900'
                          }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 no-print">
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {/* 표 높이 조절기 */}
                  <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800/80 px-3 py-1.5 rounded-xl">
                    <span className="text-[10px] font-black text-slate-400">표 높이</span>
                    <input
                      type="range"
                      min="1"
                      max="18"
                      value={cellPadding}
                      onChange={(e) => setCellPadding(Number(e.target.value))}
                      className="w-24 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                    <span className="text-[9px] font-mono font-bold text-slate-300 w-6 text-right">{cellPadding}px</span>
                  </div>
                  <button
                    onClick={handleAllAttendToday}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-[6px] font-extrabold px-3 py-1.5 rounded-xl shadow-md shadow-emerald-500/15 transition-all flex items-center gap-1"
                  >
                    <i className="fas fa-check-double"></i>
                    모두 출석
                  </button>
                  <button
                    onClick={handleAllResetToday}
                    className="bg-slate-700 hover:bg-slate-600 text-white text-[6px] font-extrabold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1"
                  >
                    <i className="fas fa-times"></i>
                    일괄 해제
                  </button>
                </div>
              </div>
            </div>

            {/* 출석 테이블 영역 (여백 없이 꽉 찬 너비) */}
            <div 
              className="rounded-2xl border border-slate-850 overflow-hidden bg-slate-950/40 print-full-width"
              style={{ '--cell-padding-y': `${cellPadding}px` }}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900/80 text-slate-400 font-black border-b border-slate-800" style={{ fontSize: '15.6px' }}>
                      <th className="px-1.5 w-12 text-center border-r border-slate-800" style={{ paddingTop: `${cellPadding}px`, paddingBottom: `${cellPadding}px` }}>No.</th>
                      <th className="px-2 w-36 sticky left-0 bg-slate-900 z-10 border-r border-slate-800 text-center" style={{ paddingTop: `${cellPadding}px`, paddingBottom: `${cellPadding}px` }}>학생명 (학교)</th>
                      {dateColumns.map(date => {
                        const isToday = date === todayStr;
                        return (
                          <th key={date} className={`px-1.5 text-center min-w-[150px] border-r border-slate-855 ${isToday ? 'bg-cyan-500/10' : ''}`} style={{ paddingTop: `${cellPadding}px`, paddingBottom: `${cellPadding}px` }}>
                            <div className={`font-black text-[17px] ${isToday ? 'text-cyan-300' : 'text-slate-100'}`}>{formatHeaderDate(date)}</div>
                          </th>
                        );
                      })}
                      <th className="px-2 text-center w-32 no-print" style={{ paddingTop: `${cellPadding}px`, paddingBottom: `${cellPadding}px` }}>원생관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classStudents.length > 0 ? (
                      classStudents.map((student, index) => (
                        <tr 
                          key={student.id} 
                          className={`border-b border-slate-850/60 hover:bg-slate-800/20 cursor-pointer transition-colors ${selectedStudent?.id === student.id ? 'bg-slate-800/40' : ''}`}
                          onClick={() => setSelectedStudent(student)}
                        >
                          {/* 연번 셀 */}
                          <td className="px-2 text-center text-xs font-bold text-slate-500 border-r border-slate-850/40" style={{ paddingTop: `${cellPadding}px`, paddingBottom: `${cellPadding}px` }}>
                            {index + 1}
                          </td>

                          {/* 학생 이름 셀 */}
                          <td className="px-1.5 font-bold sticky left-0 bg-slate-950/90 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)] border-r border-slate-800 z-10 text-center" style={{ paddingTop: `${cellPadding}px`, paddingBottom: `${cellPadding}px` }}>
                            <div className="text-slate-100 font-black text-[15.5px] text-center">{student.name}</div>
                            <div className="text-[9px] text-slate-500 mt-0.5 truncate max-w-[120px] mx-auto text-center">{student.school || '학교 미지정'}</div>
                          </td>
                          
                          {/* 날짜별 출석 단어 토글 그룹 */}
                          {dateColumns.map(date => {
                            const isVisible = isStudentVisibleOnDate(student, selectedClassId, date);
                            const isToday = date === todayStr;
                            const todayGlow = isToday ? 'bg-cyan-500/5 shadow-[inset_0_0_8px_rgba(6,182,212,0.08)]' : '';

                            if (!isVisible) {
                              let reasonText = '-';
                              if (student.dischargeDate && date > student.dischargeDate) reasonText = '퇴원';
                              else if (student.transferDate && student.previousClassId && date <= student.transferDate) reasonText = '전반전';
                              else if (student.transferDate && student.previousClassId === selectedClassId && date > student.transferDate) reasonText = '전반완료';

                              return (
                                <td key={date} className={`px-1 text-center border-r border-slate-850/40 text-[10px] font-bold text-slate-600 bg-slate-950/20 ${todayGlow}`} style={{ paddingTop: `${cellPadding}px`, paddingBottom: `${cellPadding}px` }}>
                                  {reasonText}
                                </td>
                              );
                            }

                            const key = `${student.id}_${date}`;
                            const cellData = attendanceData[key];
                            const status = cellData?.status || '미체크';
                            const note = cellData?.note || '';
                            const booksDist = classBookDistributions[key] || [];

                            return (
                              <td key={date} className={`px-1 text-center border-r border-slate-855/40 relative group/cell ${todayGlow}`} style={{ paddingTop: `${cellPadding}px`, paddingBottom: `${cellPadding}px` }}>
                                <div className="flex flex-col items-center gap-0.5 no-print">
                                  {/* 가독성 높은 3단 출석/결석/지각 텍스트 버튼 */}
                                  <div className="flex gap-0.5 bg-slate-900 p-[1px] rounded-lg border border-slate-850 w-full justify-center max-w-[130px] mx-auto">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleAttendanceStatusClick(student, date, '출석'); }}
                                      className={`px-1 py-0.5 rounded-md text-[8.5px] font-black transition-all ${
                                        status === '출석' 
                                          ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/20' 
                                          : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                                      }`}
                                    >
                                      출석
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAttendanceStatusClick(student, date, '결석');
                                      }}
                                      className={`px-1 py-0.5 rounded-md text-[8.5px] font-black transition-all ${
                                        status === '결석'
                                          ? 'bg-rose-600 text-white shadow-sm shadow-rose-500/20'
                                          : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                                      }`}
                                    >
                                      결석
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAttendanceStatusClick(student, date, '지각');
                                      }}
                                      className={`px-1 py-0.5 rounded-md text-[8.5px] font-black transition-all ${
                                        status === '지각'
                                          ? 'bg-amber-600 text-white shadow-sm shadow-amber-500/20'
                                          : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                                      }`}
                                    >
                                      지각
                                    </button>
                                  </div>

                                </div>

                                {/* 인쇄 모드 시 텍스트만 노출 */}
                                <div className="hidden print:block text-center text-[10px] font-black">
                                  <div>{status === '미체크' ? '-' : status}</div>
                                  {status === '결석' && note && <div className="text-[8px] text-slate-500 mt-0.5">{note}</div>}
                                  {booksDist.length > 0 && <div className="text-[8px] text-blue-500 mt-0.5">교재배부</div>}
                                </div>
                              </td>
                            );
                          })}

                          {/* 원생관리 전반 / 퇴원 버튼 그룹 */}
                          <td className="px-1.5 text-center no-print" style={{ paddingTop: `${cellPadding}px`, paddingBottom: `${cellPadding}px` }}>
                            <div className="flex gap-1 justify-center">
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  setDischargeStudent(student); 
                                  setModalContent('');
                                  setCopiedText('');
                                  setActiveModal('transfer');
                                }}
                                className="text-[8.5px] font-black text-cyan-400 hover:text-white hover:bg-cyan-600/80 border border-cyan-500/25 px-1.5 py-0.5 rounded-lg transition-all"
                              >
                                전반
                              </button>
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  setDischargeStudent(student);
                                  setSelectedStudent(student);
                                  setModalContent('');
                                  setCopiedText('');
                                  setActiveModal('discharge');
                                }}
                                className="text-[8.5px] font-black text-rose-400 hover:text-white hover:bg-rose-600/80 border border-rose-500/25 px-1.5 py-0.5 rounded-lg transition-all"
                              >
                                퇴원
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={dateColumns.length + 3} className="p-12 text-center text-slate-500 text-xs font-bold border-b border-slate-800">
                          선택한 요일 범위 내에 표시될 학생이 없습니다. 출석 요일 지정 체크나 학생 목록을 다시 확인해 주세요.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 우측 사이드바: 종합 히스토리 타임라인 및 즉시 기록 */}
          <div className="w-full xl:w-[350px] bg-slate-900/30 border border-slate-800 p-6 rounded-3xl flex flex-col shadow-2xl z-10 no-print">
            {selectedStudent ? (
              <div className="flex flex-col h-full">
                <div className="border-b border-slate-800 pb-4 mb-4">
                  <span className="text-[10px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-lg">
                    학생 상세 히스토리
                  </span>
                  <div className="mt-2.5 relative">
                    <select
                      value={selectedStudent.id}
                      onChange={(e) => {
                        const student = classStudents.find(s => s.id === e.target.value);
                        if (student) setSelectedStudent(student);
                      }}
                      className="text-base font-black text-slate-100 bg-slate-950/80 border border-slate-800 px-3 py-2 rounded-xl outline-none focus:border-cyan-400 cursor-pointer w-full appearance-none pr-8"
                    >
                      {classStudents.map(s => (
                        <option key={s.id} value={s.id} className="bg-slate-900 text-slate-200">
                          {s.name} ({s.school || '학교 미지정'})
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-500">
                      <i className="fas fa-chevron-down text-xs"></i>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2.5">소속: {selectedClass?.name || '소속 반 없음'}</p>
                </div>

                {/* 학생별 즉시 기록 버튼 세분화 (2행) */}
                <div className="mb-6 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                  <h3 className="text-xs font-black text-slate-300 mb-3.5 flex items-center gap-1.5">
                    <i className="fas fa-edit text-yellow-400"></i>
                    학생별 기록 및 상담
                  </h3>
                  
                  <div className="space-y-2">
                    {/* 1행 버튼 */}
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        onClick={() => openActionModal('parent_consult')}
                        className="py-1.5 rounded-xl text-[9px] font-extrabold bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/25 transition-all text-center whitespace-nowrap"
                      >
                        학부모 상담
                      </button>
                      <button
                        onClick={() => openActionModal('student_consult')}
                        className="py-1.5 rounded-xl text-[9px] font-extrabold bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/25 transition-all text-center whitespace-nowrap"
                      >
                        학생 상담
                      </button>
                      <button
                        onClick={() => openActionModal('discharge_consult')}
                        className="py-1.5 rounded-xl text-[9px] font-extrabold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/25 transition-all text-center whitespace-nowrap"
                      >
                        진로 상담
                      </button>
                    </div>
                    {/* 2행 버튼 */}
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        onClick={() => openActionModal('absent_reason')}
                        className="py-1.5 rounded-xl text-[9px] font-extrabold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/25 transition-all text-center whitespace-nowrap"
                      >
                        결석 사유
                      </button>
                      <button
                        onClick={() => openActionModal('late_reason')}
                        className="py-1.5 rounded-xl text-[9px] font-extrabold bg-orange-500/10 hover:bg-orange-500/20 text-orange-300 border border-orange-500/25 transition-all text-center whitespace-nowrap"
                      >
                        지각 사유
                      </button>
                      <button
                        onClick={() => openActionModal('book_dist')}
                        className="py-1.5 rounded-xl text-[9px] font-extrabold bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/25 transition-all text-center whitespace-nowrap"
                      >
                        교재 배부
                      </button>
                    </div>
                  </div>
                </div>

                {/* 타임라인 */}
                <h3 className="text-xs font-black text-slate-400 mb-3 flex items-center gap-1.5">
                  <i className="fas fa-list-ul"></i>
                  📋 종합 히스토리 타임라인
                </h3>
                
                <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 max-h-[360px] xl:max-h-none mini-scroll">
                  {historyItems.length > 0 ? (
                    historyItems.map(item => {
                      let catBadgeColor = 'bg-teal-500/10 text-teal-400 border border-teal-500/20';
                      if (item.displayCategory === '상담') catBadgeColor = 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
                      else if (item.displayCategory === '결석') catBadgeColor = 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
                      else if (item.displayCategory === '지각') catBadgeColor = 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
                      else if (item.displayCategory === '진로상담') catBadgeColor = 'bg-sky-500/10 text-sky-400 border border-sky-500/20';

                      return (
                        <div key={item.id} className="flex gap-3 items-start border-l-2 border-slate-800 pl-4 py-1.5 relative group/item">
                          <span className="absolute -left-[5px] top-2.5 w-2 h-2 rounded-full bg-slate-800"></span>
                          <div className="flex-1">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${catBadgeColor}`}>
                                  {item.displayCategory}
                                </span>
                                <span className="text-[10px] text-slate-550 font-mono">{item.date}</span>
                              </div>
                              
                              {/* 수정 / 삭제 상시 제어 버튼 그룹 */}
                              {item.source === 'consulting' && (
                                <div className="flex gap-1.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                  {item.canEdit !== false && (
                                    <button
                                      onClick={() => openEditConsultingModal(item)}
                                      className="text-[9px] text-slate-400 hover:text-cyan-400 transition-colors"
                                    >
                                      수정
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteConsulting(item.id)}
                                    className="text-[9px] text-slate-400 hover:text-rose-400 transition-colors"
                                  >
                                    삭제
                                  </button>
                                </div>
                              )}
                            </div>
                            {item.displayContent && (
                              <p className="text-xs text-slate-300 mt-2.5 leading-relaxed whitespace-pre-wrap">{item.displayContent}</p>
                            )}

                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="h-40 flex items-center justify-center text-slate-650 text-xs font-bold border border-dashed border-slate-800 rounded-2xl">
                      등록된 히스토리가 없습니다.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-650 text-xs font-bold text-center border border-dashed border-slate-800 rounded-3xl p-6">
                출석부에서 학생을 선택하면 상세 기록 타임라인이 표출됩니다.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 탭 2: 출력 시스템 전용 뷰 */}
      {/* ========================================================================= */}
      {activeTab === 'output' && (
        <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl flex flex-col print-full-width w-full">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6 no-print">
            <div className="flex gap-2 flex-wrap">
              <button 
                onClick={() => setOutputMode('class')}
                className={`px-4 py-2.5 rounded-xl text-xs font-black border transition-all ${
                  outputMode === 'class' 
                    ? 'bg-blue-600 text-white border-transparent' 
                    : 'bg-slate-950/60 text-slate-400 border-slate-850 hover:text-slate-200'
                }`}
              >
                반별 출석부 출력
              </button>
              <button 
                onClick={() => setOutputMode('student')}
                className={`px-4 py-2.5 rounded-xl text-xs font-black border transition-all ${
                  outputMode === 'student' 
                    ? 'bg-blue-600 text-white border-transparent' 
                    : 'bg-slate-950/60 text-slate-400 border-slate-850 hover:text-slate-200'
                }`}
              >
                개인별 출결 현황 출력
              </button>
              <button 
                onClick={() => setOutputMode('consult')}
                className={`px-4 py-2.5 rounded-xl text-xs font-black border transition-all ${
                  outputMode === 'consult' 
                    ? 'bg-purple-600 text-white border-transparent' 
                    : 'bg-slate-950/60 text-slate-400 border-slate-850 hover:text-slate-200'
                }`}
              >
                📋 기간별 상담내역 출력
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 bg-slate-950/60 border border-slate-800 px-3 py-2 rounded-xl">
                <span className="text-[10px] font-black text-slate-400">인쇄 크기</span>
                <input
                  type="range"
                  min="60"
                  max="120"
                  step="5"
                  value={printScale}
                  onChange={e => setPrintScale(e.target.value)}
                  className="w-24 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <span className="text-[9px] font-mono font-bold text-slate-300 w-8 text-right">{printScale}%</span>
              </div>
              <button 
                onClick={handlePrint}
                className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-xs font-extrabold px-5 py-2.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                🖨️ 인쇄하기
              </button>
            </div>
          </div>

          {/* 출력 설정 도구들 (no-print) */}
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 grid md:grid-cols-2 gap-4 mb-6 no-print">
            <div className="space-y-2">
              <span className="block text-[10px] font-black text-slate-400 tracking-wider">반 선택</span>
              <div className="flex flex-wrap gap-1.5">
                {availableClasses.map(c => (
                  <button
                    key={c.id}
                    onClick={() => handleClassSelect(c.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-extrabold transition-all border ${
                      c.id === outputClassId 
                        ? 'bg-indigo-600 text-white border-transparent' 
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-black text-slate-400 tracking-wider">시작 날짜</span>
                  <div className="relative">
                    <input
                      type="date"
                      value={outputStartDate}
                      onChange={e => setOutputStartDate(e.target.value)}
                      onClick={e => { try { e.target.showPicker(); } catch (err) {} }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    />
                    <button className="border border-slate-800 bg-slate-900 rounded-xl px-3 py-1.5 text-xs text-slate-300 font-mono text-center justify-center flex items-center min-w-[160px]">
                      {formatDateWithDay(outputStartDate)}
                    </button>
                  </div>
                </div>
                <span className="text-slate-650 font-bold self-end mb-2">~</span>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-black text-slate-400 tracking-wider">종료 날짜</span>
                  <div className="relative">
                    <input
                      type="date"
                      value={outputEndDate}
                      onChange={e => setOutputEndDate(e.target.value)}
                      onClick={e => { try { e.target.showPicker(); } catch (err) {} }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    />
                    <button className="border border-slate-800 bg-slate-900 rounded-xl px-3 py-1.5 text-xs text-slate-300 font-mono text-center justify-center flex items-center min-w-[160px]">
                      {formatDateWithDay(outputEndDate)}
                    </button>
                  </div>
                </div>
              </div>

              {outputMode === 'student' && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-black text-slate-400 tracking-wider">원생 선택</span>
                  <div className="flex flex-wrap gap-1.5">
                    {outputStudents.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setOutputStudentId(s.id)}
                        className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black transition-all border ${
                          s.id === outputStudentId
                            ? 'bg-indigo-600 text-white border-transparent shadow-md'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-600 hover:text-white'
                        }`}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ----------------------------------------------------------------- */}
          {/* 출력 뷰 A: 반별 기록된 날짜 출석부 표 */}
          {/* ----------------------------------------------------------------- */}
          {outputMode === 'class' && (
            <div className="attendance-print-sheet bg-slate-950/40 rounded-2xl border border-slate-850 p-6 print-full-width" style={{ zoom: printScaleValue }}>
              <div className="text-center mb-4">
                <h2 className="text-xl font-black text-slate-100">{outputSelectedClass?.name || '선택반'} 출석부</h2>
                <p className="text-xs text-slate-500 mt-1 font-mono">{outputStartDate} ~ {outputEndDate} (기록된 날짜만 출력됨)</p>
              </div>
              <div className="flex justify-end mb-3 no-print">
                <select
                  value={outputClassSort}
                  onChange={e => setOutputClassSort(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-300 text-xs font-bold rounded-xl px-3 py-1.5 cursor-pointer"
                >
                  <option value="name">이름순</option>
                  <option value="absent_desc">결석 많은 순</option>
                  <option value="late_desc">지각 많은 순</option>
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 font-black border-b border-slate-800">
                      <th className="p-3 w-12 border border-slate-800 text-center whitespace-nowrap">No.</th>
                      <th className="p-3 w-36 border border-slate-800 text-center whitespace-nowrap">학생명</th>
                      {outputClassRecordedDates.length > 0 ? (
                        outputClassRecordedDates.map(date => (
                          <th key={date} className="p-3 text-center border border-slate-800 font-black whitespace-nowrap">{formatHeaderDate(date)}</th>
                        ))
                      ) : (
                        <th className="p-3 text-center border border-slate-800 font-black">기록된 출결 날짜 없음</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {outputStudents.length > 0 ? (
                      outputStudents.map((student, idx) => (
                        <tr key={student.id} className="border-b border-slate-800">
                          <td className="p-3 text-center font-bold text-slate-500 border border-slate-800">
                            {idx + 1}
                          </td>
                          <td className="p-3 font-bold border border-slate-800 text-center">
                            <div className="text-center">{student.name}</div>
                            <div className="text-[10px] text-slate-500 font-normal text-center">{student.school || '-'}</div>
                          </td>
                          {outputClassRecordedDates.length > 0 ? (
                            outputClassRecordedDates.map(date => {
                              const key = `${student.id}_${date}`;
                              const cell = outputAttendanceData[key];
                              const status = cell?.status || '미체크';
                              const note = cell?.note || '';
                              
                              let style = "text-slate-500";
                              if (status === '출석') style = "text-emerald-400 font-extrabold";
                              else if (status === '결석') style = "text-rose-400 font-extrabold";
                              else if (status === '지각') style = "text-amber-400 font-extrabold";

                              return (
                                <td key={date} className="p-3 text-center border border-slate-800">
                                  <span className={style}>{status}</span>
                                  {status === '결석' && note && (
                                    <div className="text-[9px] text-rose-500 mt-1 font-semibold text-center">{note}</div>
                                  )}
                                </td>
                              );
                            })
                          ) : (
                            <td className="p-3 text-center text-slate-650 border border-slate-800">-</td>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={outputClassRecordedDates.length + 2} className="p-8 text-center text-slate-500 text-xs">원생이 없습니다.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* 출력 뷰 B: 학생 개인별 상세 출결 및 히스토리 리포트 */}
          {/* ----------------------------------------------------------------- */}
          {outputMode === 'student' && outputStudentId && (
            <div className="attendance-print-sheet bg-slate-950/40 rounded-2xl border border-slate-850 p-8 print-full-width portrait-print-page max-w-3xl mx-auto" style={{ zoom: printScaleValue }}>
              <div className="text-center border-b border-slate-800 pb-5 mb-6">
                <h2 className="text-2xl font-black text-slate-100">학생 개인 출석 및 상담 보고서</h2>
                <div className="text-xs text-slate-500 mt-2 font-mono">조회 기간: {outputStartDate} ~ {outputEndDate}</div>
              </div>

              {/* 기본 신상 카드 */}
              <div className="grid grid-cols-2 gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-850 mb-6">
                <div>
                  <div className="text-[10px] text-slate-500 font-black uppercase">원생명</div>
                  <div className="text-sm font-black text-slate-200 mt-1">
                    {state.allStudents.find(s => s.id === outputStudentId)?.name || ''}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 font-black uppercase">소속 반 / 학교</div>
                  <div className="text-sm font-black text-slate-200 mt-1">
                    {outputSelectedClass?.name || ''} ({state.allStudents.find(s => s.id === outputStudentId)?.school || '학교미지정'})
                  </div>
                </div>
              </div>

              {/* 출결 요약 통계 */}
              <div className="grid grid-cols-4 gap-3 mb-6">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 text-center">
                  <div className="text-[9px] text-slate-500 font-bold">수업일수</div>
                  <div className="text-lg font-black text-slate-200 mt-1">{outputStudentStats.total}일</div>
                </div>
                <div className="bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/15 text-center">
                  <div className="text-[9px] text-emerald-400 font-bold">출석일수</div>
                  <div className="text-lg font-black text-emerald-400 mt-1">{outputStudentStats.attend}일</div>
                </div>
                <div className="bg-rose-500/5 p-3 rounded-xl border border-rose-500/15 text-center">
                  <div className="text-[9px] text-rose-400 font-bold">결석일수</div>
                  <div className="text-lg font-black text-rose-400 mt-1">{outputStudentStats.absent}일</div>
                </div>
                <div className="bg-amber-500/5 p-3 rounded-xl border border-amber-500/15 text-center">
                  <div className="text-[9px] text-amber-400 font-bold">지각일수</div>
                  <div className="text-lg font-black text-amber-400 mt-1">{outputStudentStats.late}일</div>
                </div>
              </div>

              {/* 상세 출결 현황 표 */}
              <h3 className="text-xs font-black text-slate-400 mb-3 flex items-center gap-1.5 border-l-2 border-cyan-500 pl-2">
                출결 상세 이력
              </h3>
              <table className="w-full text-left border-collapse mb-8">
                <thead>
                  <tr className="bg-slate-900 text-slate-400 text-xs font-bold border-b border-slate-800">
                    <th className="p-3 border border-slate-800 text-center min-w-[8rem]">일자</th>
                    <th className="p-3 text-center border border-slate-800 min-w-[4rem]">상태</th>
                    <th className="p-3 border border-slate-800 text-center">사유 / 비고</th>
                  </tr>
                </thead>
                <tbody>
                  {getDateRange(outputStartDate, outputEndDate).map(date => {
                    const targetStudent = state.allStudents.find(s => s.id === outputStudentId);
                    const isVisible = targetStudent && isStudentVisibleOnDate(targetStudent, outputClassId, date);
                    
                    if (!isVisible) return null;

                    const key = `${outputStudentId}_${date}`;
                    const cell = outputAttendanceData[key];
                    const status = cell?.status || '미체크';
                    const note = cell?.note || '';

                    if (status === '미체크') return null;

                    let badgeColor = "text-slate-500";
                    if (status === '출석') badgeColor = "text-emerald-400 font-extrabold";
                    else if (status === '결석') badgeColor = "text-rose-400 font-extrabold";
                    else if (status === '지각') badgeColor = "text-amber-400 font-extrabold";

                    return (
                      <tr key={date} className="border-b border-slate-850/60 text-xs">
                        <td className="p-3 border border-slate-800 font-mono text-center">{formatHeaderDate(date)}</td>
                        <td className={`p-3 text-center border border-slate-800 ${badgeColor}`}>{status}</td>
                        <td className="p-3 border border-slate-800 text-slate-300 text-center">{note || '-'}</td>
                      </tr>
                    );
                  }).filter(Boolean)}
                </tbody>
              </table>

              {/* 기간 내 상담 히스토리 */}
              <h3 className="text-xs font-black text-slate-400 mb-3 flex items-center gap-1.5 border-l-2 border-purple-500 pl-2">
                상담 및 특이사항 기록
              </h3>
              <div className="space-y-3">
                {outputConsultings.length > 0 ? (
                  outputConsultings
                    .filter(c => c.date >= outputStartDate && c.date <= outputEndDate)
                    .map(item => (
                      <div key={item.id} className="bg-slate-900/40 p-4 rounded-xl border border-slate-850/80 text-xs flex justify-between items-start gap-4">
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            {item.category}
                          </span>
                          <p className="text-slate-200 mt-1 font-semibold leading-relaxed whitespace-pre-wrap">{item.content}</p>
                        </div>
                        <span className="text-[10px] text-slate-550 font-mono flex-shrink-0">{item.date}</span>
                      </div>
                    ))
                ) : (
                  <div className="p-8 text-center text-slate-650 text-xs border border-dashed border-slate-800 rounded-xl">
                    선택 기간 내 상담 이력이 없습니다.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* 출력 뷰 C: 기간별 상담일지 (표 + 텍스트 복붙) */}
          {/* ----------------------------------------------------------------- */}
          {outputMode === 'consult' && (() => {
            // 기간 필터링
            const filteredConsults = consultPeriodData.filter(c =>
              c.date >= outputStartDate && c.date <= outputEndDate
            );

            // 학생 정보 룩업
            const getStudent = (sid) => (state.allStudents || []).find(s => s.id === sid);
            const getClass = (sid) => {
              const s = getStudent(sid);
              if (!s) return null;
              return availableClasses.find(c => c.id === s.classId) || null;
            };

            // 학교 학년 중복 제거 포맷터 (파주고 + 고1 => 파주고1)
            const formatSchoolGrade = (school, grade) => {
              const s = school || '';
              const g = grade || '';
              if (s.endsWith('고') && g.startsWith('고')) {
                return s + g.slice(1);
              }
              return s + g;
            };

            // 상담대상 추출 (content 파싱)
            const getTarget = (content) => {
              if (!content) return '-';
              if (content.includes('학부모 상담')) return '학부모';
              if (content.includes('학생 상담')) return '학생';
              return '-';
            };

            // content에서 태그 제거한 실제 내용 추출
            const getCleanContent = (content) => {
              if (!content) return '-';
              return content.replace(/^\[.*?\]\s*/, '').trim() || content;
            };

            // 날짜 포맷: M월 D일 (요일)
            const formatConsultDate = (dateStr) => {
              if (!dateStr) return '-';
              const d = new Date(dateStr);
              if (isNaN(d)) return dateStr;
              const m = d.getMonth() + 1;
              const day = d.getDate();
              const days = ['일', '월', '화', '수', '목', '금', '토'];
              return `${m}월 ${day}일 (${days[d.getDay()]})`;
            };

            // 기간 표시: M/D(요일)~M/D(요일)
            const formatPeriodLabel = (s, e) => {
              const fmt = (str) => {
                const d = new Date(str);
                if (isNaN(d)) return str;
                const days = ['일', '월', '화', '수', '목', '금', '토'];
                return `${d.getMonth()+1}/${d.getDate()}(${days[d.getDay()]})`;
              };
              return `${fmt(s)}~${fmt(e)}`;
            };

            // 행 데이터 생성
            const rows = filteredConsults.map((c, idx) => {
              const student = getStudent(c.studentId);
              const cls = getClass(c.studentId);
              return {
                _id: c.id,
                no: idx + 1,
                studentName: student?.name || c.studentName || '-',
                schoolGrade: formatSchoolGrade(student?.school, student?.grade || cls?.grade),
                className: cls?.name || '-',
                target: getTarget(c.content),
                date: c.date || '',
                dateLabel: formatConsultDate(c.date),
                content: getCleanContent(c.content),
                studentId: c.studentId,
              };
            });

            // 정렬
            const sortedRows = [...rows].sort((a, b) => {
              let av = a[consultSortField] || '';
              let bv = b[consultSortField] || '';
              if (consultSortField === 'no') { av = a.no; bv = b.no; }
              const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv), 'ko');
              return consultSortDir === 'asc' ? cmp : -cmp;
            });

            const handleConsultSort = (field) => {
              if (consultSortField === field) {
                setConsultSortDir(d => d === 'asc' ? 'desc' : 'asc');
              } else {
                setConsultSortField(field);
                setConsultSortDir('asc');
              }
            };

            const sortIcon = (field) => {
              if (consultSortField !== field) return <span className="text-slate-600 ml-1">⇅</span>;
              return <span className="text-cyan-400 ml-1">{consultSortDir === 'asc' ? '↑' : '↓'}</span>;
            };

            const getCleanTeacherName = (name) => {
              if (!name) return '강사';
              const clean = name.replace(/\s*[Tt]\s*$/, '').trim();
              return `${clean}t`;
            };

            const teacherName = getCleanTeacherName(state.currentTeacher?.name);
            const periodLabel = formatPeriodLabel(outputStartDate, outputEndDate);
            const title = `| ${teacherName} 상담일지`;
            const subtitle = `(상담기간 : ${periodLabel})`;

            // 텍스트 복붙용 내용 생성
            const generateTextReport = () => {
              let text = `${title}\n${subtitle}\n`;
              // 학생별 그룹핑 (날짜순 정렬 기준)
              const byStudent = {};
              sortedRows.forEach(row => {
                if (!byStudent[row.studentId]) byStudent[row.studentId] = [];
                byStudent[row.studentId].push(row);
              });

              // 날짜 순으로 첫 등장 순서로 학생 순서 결정
              const studentOrder = [];
              sortedRows.forEach(row => {
                if (!studentOrder.includes(row.studentId)) studentOrder.push(row.studentId);
              });

              studentOrder.forEach(sid => {
                const entries = byStudent[sid];
                const first = entries[0];
                text += `\n▶ ${first.studentName} (${first.schoolGrade}) \n`;
                text += `- ${first.className}\n`;
                entries.forEach((e, idx) => {
                  if (idx > 0) {
                    text += `\n`; // 여러 개 상담일 때 한 줄 띄어서 구분
                  }
                  text += `- 상담대상 : ${e.target}\n`;
                  text += `- 상담일시 : ${e.dateLabel}\n`;
                  text += `- 상담내용 : ${e.content}\n`;
                });
              });
              return text;
            };

            const handleCopyText = () => {
              const text = generateTextReport();
              copyTextSafely(text);
              setConsultCopied(true);
              setTimeout(() => setConsultCopied(false), 2000);
            };

            return (
              <div className="space-y-6">
                {/* 기간 선택 컨트롤 */}
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 flex flex-wrap gap-4 items-center no-print">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400 tracking-wider">상담 기간:</span>
                    <div className="relative">
                      <input type="date" value={outputStartDate} onChange={e => setOutputStartDate(e.target.value)}
                        onClick={e => { try { e.target.showPicker(); } catch(err) {} }}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10" />
                      <button className="border border-slate-800 bg-slate-900 rounded-xl px-3 py-1.5 text-xs text-slate-300 font-mono min-w-[150px] flex items-center justify-center">
                        {formatDateWithDay(outputStartDate)}
                      </button>
                    </div>
                    <span className="text-slate-650 font-black">~</span>
                    <div className="relative">
                      <input type="date" value={outputEndDate} onChange={e => setOutputEndDate(e.target.value)}
                        onClick={e => { try { e.target.showPicker(); } catch(err) {} }}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10" />
                      <button className="border border-slate-800 bg-slate-900 rounded-xl px-3 py-1.5 text-xs text-slate-300 font-mono min-w-[150px] flex items-center justify-center">
                        {formatDateWithDay(outputEndDate)}
                      </button>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 font-bold">
                    총 <span className="text-purple-400 font-black">{filteredConsults.length}</span>건 상담 내역
                  </div>
                </div>

                {filteredConsults.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
                    선택 기간 내 상담 내역이 없습니다.
                  </div>
                ) : (
                  <div className="grid lg:grid-cols-2 gap-6">

                    {/* 좌측: 인쇄용 표 */}
                    <div className="attendance-print-sheet bg-slate-950/40 rounded-2xl border border-slate-850 p-5" style={{ zoom: printScaleValue }}>
                      <div className="mb-4">
                        <h2 className="text-base font-black text-slate-100 text-center">{title}</h2>
                        <p className="text-xs text-slate-400 text-center mt-1">{subtitle}</p>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-[11px]">
                          <thead>
                            <tr className="bg-slate-900 text-slate-400 border-b border-slate-800">
                              {[
                                { field: 'no', label: 'No', widthClass: 'w-[5%]' },
                                { field: 'studentName', label: '학생명', widthClass: 'w-[10%]' },
                                { field: 'schoolGrade', label: '학교학년', widthClass: 'w-[12%]' },
                                { field: 'className', label: '학원반', widthClass: 'w-[13%]' },
                                { field: 'target', label: '상담대상', widthClass: 'w-[10%]' },
                                { field: 'date', label: '상담일시', widthClass: 'w-[15%]' },
                                { field: 'content', label: '상담내용', widthClass: 'w-[35%]' },
                              ].map(col => (
                                <th
                                  key={col.field}
                                  onClick={() => handleConsultSort(col.field)}
                                  className={`p-2.5 border border-slate-800 font-black cursor-pointer whitespace-nowrap select-none hover:bg-slate-800/60 transition-colors ${col.widthClass}`}
                                >
                                  {col.label}{sortIcon(col.field)}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sortedRows.map((row, idx) => (
                              <tr key={row._id} className={`border-b border-slate-850/60 ${idx % 2 === 0 ? '' : 'bg-slate-900/20'}`}>
                                <td className="p-2.5 text-center border border-slate-800 text-slate-500 font-bold w-[5%]">{idx + 1}</td>
                                <td className="p-2.5 border border-slate-800 font-bold text-slate-200 whitespace-nowrap text-center w-[10%]">{row.studentName}</td>
                                <td className="p-2.5 border border-slate-800 text-slate-400 whitespace-nowrap text-center w-[12%]">{row.schoolGrade}</td>
                                <td className="p-2.5 border border-slate-800 text-slate-400 whitespace-nowrap text-center w-[13%]">{row.className}</td>
                                <td className="p-2.5 border border-slate-800 text-center whitespace-nowrap w-[10%]">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    row.target === '학부모' ? 'bg-purple-500/15 text-purple-300' : 'bg-cyan-500/15 text-cyan-300'
                                  }`}>{row.target}</span>
                                </td>
                                <td className="p-2.5 border border-slate-800 text-slate-400 whitespace-nowrap font-mono text-center w-[15%]">{row.dateLabel}</td>
                                <td className="p-2.5 border border-slate-800 text-slate-300 leading-relaxed text-left break-all whitespace-pre-wrap w-[35%] consult-content-cell">{row.content}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* 우측: 텍스트 복붙용 */}
                    <div className="bg-slate-950/40 rounded-2xl border border-slate-850 p-5 flex flex-col gap-3 no-print">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-black text-slate-200">📤 텍스트 복붙용</h3>
                          <p className="text-[10px] text-slate-500 mt-0.5">밴드·채팅 직접 보고용</p>
                        </div>
                        <button
                          onClick={handleCopyText}
                          className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                            consultCopied
                              ? 'bg-emerald-600/80 text-white'
                              : 'bg-purple-600/80 hover:bg-purple-600 text-white'
                          }`}
                        >
                          {consultCopied ? '✅ 복사됨!' : '📋 전체 복사'}
                        </button>
                      </div>

                      <div className="flex-1 bg-slate-900/60 border border-slate-800 rounded-xl p-4 overflow-y-auto font-mono text-xs leading-relaxed text-slate-300 whitespace-pre-wrap select-all" style={{ minHeight: '300px', maxHeight: '600px' }}>
                        {generateTextReport()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2행 즉시 기록용 세분화 모달창들 (등록 및 상시 수정 공용) */}
      {/* ========================================================================= */}
      {activeModal && activeModal !== 'discharge' && activeModal !== 'transfer' && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-sm no-print">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-black text-slate-200 flex items-center gap-1.5">
                <i className="fas fa-edit text-blue-500"></i>
                {editingLogId ? '✏️ 기록 수정하기' : '✨ 신규 기록 등록'}
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-500 hover:text-slate-350 text-xl font-bold cursor-pointer">✕</button>
            </div>

            <div className="space-y-4">
              {/* 1) 원생 정보 */}
              <div>
                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">대상 학생</span>
                <div className="relative">
                  <select
                    value={selectedStudent?.id}
                    onChange={(e) => {
                      const student = classStudents.find(s => s.id === e.target.value);
                      if (student) setSelectedStudent(student);
                    }}
                    className="w-full border border-slate-800 bg-slate-950 p-3 rounded-xl text-sm font-extrabold text-slate-200 outline-none focus:border-cyan-400 cursor-pointer appearance-none pr-8"
                  >
                    {classStudents.map(s => (
                      <option key={s.id} value={s.id} className="bg-slate-900 text-slate-200">
                        {s.name} ({s.school || '학교 미지정'})
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-500">
                    <i className="fas fa-chevron-down text-xs"></i>
                  </div>
                </div>
              </div>

              {/* 2) 일자 선택 */}
              <div>
                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">적용 일자</span>
                <div className="relative">
                  <input
                    type="date"
                    value={modalDate}
                    onChange={e => setModalDate(e.target.value)}
                    onClick={e => { try { e.target.showPicker(); } catch (err) {} }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                  />
                  <button className="w-full border border-slate-800 bg-slate-955 p-3 rounded-xl text-xs text-slate-300 font-mono text-center justify-center flex items-center">
                    {formatDateWithDay(modalDate)}
                  </button>
                </div>
              </div>

              {/* 3) 모달 유형별 태그 선택 또는 교재 리스트 */}
              {activeModal === 'parent_consult' && (
                <div>
                  <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">상담 태그</span>
                  <div className="grid grid-cols-4 gap-1">
                    {PARENT_CONSULT_TAGS.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setModalTag(tag)}
                        className={`min-w-0 whitespace-nowrap py-2 px-1 rounded-xl text-[10px] font-extrabold border transition-all ${
                          modalTag === tag ? 'bg-purple-600 text-white border-transparent' : 'bg-slate-950 text-slate-550 border-slate-850'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeModal === 'student_consult' && (
                <div>
                  <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">상담 태그</span>
                  <div className="flex gap-1.5">
                    {['정기상담', '성적상담', '학습상담'].map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setModalTag(tag)}
                        className={`flex-1 py-2 rounded-xl text-xs font-extrabold border transition-all ${
                          modalTag === tag ? 'bg-blue-600 text-white border-transparent' : 'bg-slate-950 text-slate-550 border-slate-850'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeModal === 'discharge_consult' && (
                <div>
                  <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">진로 상담 대상</span>
                  <div className="flex gap-1.5">
                    {['학부모 상담', '학생 상담', '모두 상담'].map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setModalTag(tag)}
                        className={`flex-1 py-2 rounded-xl text-xs font-extrabold border transition-all ${
                          modalTag === tag ? 'bg-rose-600 text-white border-transparent' : 'bg-slate-950 text-slate-550 border-slate-850'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeModal === 'absent_reason' && (
                <div>
                  <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">결석 태그</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {['병결', '수행평가', '학교활동', '여행', '외식', '개인사정'].map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setModalTag(tag)}
                        className={`py-2 rounded-xl text-[11px] font-extrabold border transition-all ${
                          modalTag === tag ? 'bg-amber-600 text-white border-transparent shadow-md' : 'bg-slate-950 text-slate-550 border-slate-850'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeModal === 'late_reason' && (
                <div className="space-y-3">
                  <div>
                    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">지각 태그</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {['늦잠', '버스늦음', '개인사정'].map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setModalTag(tag)}
                          className={`py-2 rounded-xl text-[11px] font-extrabold border transition-all ${
                            modalTag === tag ? 'bg-orange-500 text-white border-transparent shadow-md' : 'bg-slate-950 text-slate-550 border-slate-850'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">지각 시간 (분)</span>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      placeholder="예: 15"
                      value={modalContent}
                      onChange={e => setModalContent(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 font-bold focus:outline-none focus:border-orange-500/50"
                    />
                  </div>
                </div>
              )}

              {activeModal === 'book_dist' && (
                <>
                  <div>
                    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">배정된 교재 목록</span>
                    <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto mini-scroll">
                      {state.classBooks
                        .filter(cb => cb.classId === selectedClassId && cb.status === 'active')
                        .map(cb => {
                          const book = state.books.find(b => b.id === cb.bookId);
                          if (!book) return null;
                          const active = cb.bookId === selectedBookId;
                          return (
                            <button
                              key={cb.id}
                              type="button"
                              onClick={() => setSelectedBookId(cb.bookId)}
                              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-black border transition-all truncate ${
                                active ? 'bg-teal-600 text-white border-transparent shadow-md' : 'bg-slate-950 text-slate-400 border-slate-850'
                              }`}
                            >
                              📚 {book.title}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                  <div>
                    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">교재비 입력 (원)</span>
                    <input
                      type="number"
                      placeholder="금액을 입력하세요 (생략 가능)"
                      value={bookPrice}
                      onChange={e => setBookPrice(e.target.value)}
                      className="w-full border border-slate-800 bg-slate-950 p-2.5 rounded-xl text-xs text-slate-300 font-mono outline-none focus:border-cyan-400"
                    />
                  </div>
                  {!editingLogId && (
                    <div className="flex items-center gap-2 pt-1.5">
                      <input
                        type="checkbox"
                        id="applyAll"
                        checked={applyToAll}
                        onChange={e => setApplyToAll(e.target.checked)}
                        className="w-4 h-4 border border-slate-850 bg-slate-950 rounded cursor-pointer"
                      />
                      <label htmlFor="applyAll" className="text-xs font-bold text-slate-300 cursor-pointer">
                        반 인원 전체에게 동일 배부 적용하기
                      </label>
                    </div>
                  )}
                </>
              )}

              {/* 4) 상세 입력 텍스트 */}
              {activeModal !== 'book_dist' && activeModal !== 'late_reason' && (
                <div>
                  <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">내용 기록</span>
                  <textarea
                    placeholder="구체적인 내용을 입력하세요..."
                    value={modalContent}
                    onChange={e => setModalContent(e.target.value)}
                    className="w-full border border-slate-800 p-3 rounded-xl text-xs h-28 bg-slate-950 focus:border-cyan-400 outline-none text-slate-300 leading-relaxed resize-none"
                  ></textarea>
                </div>
              )}

              {activeModal === 'late_reason' && (
                <div>
                  <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">내용 기록 (선택)</span>
                  <textarea
                    placeholder="추가 메모..."
                    value={modalExtraContent}
                    onChange={e => setModalExtraContent(e.target.value)}
                    className="w-full border border-slate-800 p-3 rounded-xl text-xs h-20 bg-slate-950 focus:border-orange-400 outline-none text-slate-300 leading-relaxed resize-none"
                  ></textarea>
                </div>
              )}

              {/* 저장 버튼 */}
              <button
                onClick={handleModalSubmit}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold py-3 rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <i className="fas fa-save"></i>
                {editingLogId ? '기록 수정 완료' : '기록 등록 완료'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 퇴원 모달창 */}
      {activeModal === 'discharge' && dischargeStudent && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-sm no-print">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3.5 mb-4">
              <h3 className="text-base font-black text-rose-400 flex items-center gap-1.5">
                <i className="fas fa-user-slash text-rose-500"></i>
                🚨 원생 퇴원 처리 및 서식 생성
              </h3>
              <button onClick={() => { setActiveModal(null); setCopiedText(''); setModalContent(''); }} className="text-slate-500 hover:text-slate-350 text-xl font-bold cursor-pointer">✕</button>
            </div>
            
            <div className="grid md:grid-cols-2 gap-5 flex-1 overflow-y-auto pr-1">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-1.5">대상 원생</label>
                  <input type="text" readOnly value={`${dischargeStudent.name} (${selectedClass?.name || '반 미지정'})`} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs font-black text-slate-300" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-1.5">퇴원 예정일</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={dischargeDate}
                      onChange={e => setDischargeDate(e.target.value)}
                      onClick={e => { try { e.target.showPicker(); } catch (err) {} }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    />
                    <button className="w-full border border-slate-800 bg-slate-950 p-2.5 rounded-xl text-xs text-slate-300 font-mono text-center justify-center flex items-center">
                      {formatDateWithDay(dischargeDate)}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-1.5">퇴원 사유 및 상담 상세기록</label>
                  <textarea value={modalContent} onChange={e => setModalContent(e.target.value)} placeholder="구체적인 퇴원 사유를 입력하세요." className="w-full border border-slate-800 p-3 rounded-xl text-xs h-40 bg-slate-950 focus:border-rose-500 outline-none text-slate-300 leading-relaxed resize-none"></textarea>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-1.5">퇴원일지 모드</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setWithdrawalReportMode('lastClass')}
                      className={`rounded-xl border px-3 py-2 text-[11px] font-black transition-colors ${
                        withdrawalReportMode === 'lastClass'
                          ? 'bg-rose-600 text-white border-transparent'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      마지막 수업일 보고
                    </button>
                    <button
                      type="button"
                      onClick={() => setWithdrawalReportMode('detail')}
                      className={`rounded-xl border px-3 py-2 text-[11px] font-black transition-colors ${
                        withdrawalReportMode === 'detail'
                          ? 'bg-rose-600 text-white border-transparent'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      출결 상세 보고
                    </button>
                  </div>
                </div>
                <button onClick={handleDischargeSubmit} className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 rounded-xl text-xs shadow-sm transition">⚙️ 퇴원 처리 완료</button>
              </div>

              <div className="flex flex-col bg-slate-950/60 p-4 rounded-2xl border border-dashed border-slate-800">
                <label className="block text-xs font-bold text-blue-400 mb-2">📋 원내 전송용 퇴원일지 서식</label>
                <div className="flex-1 flex flex-col">
                  <pre className="bg-slate-900 p-3 rounded-xl text-xs font-mono text-slate-300 whitespace-pre-wrap flex-1 overflow-y-auto border border-slate-800 min-h-[180px]">{withdrawalPreview || '퇴원일지 미리보기...'}</pre>
                  <button
                    onClick={handleCopyWithdrawalLog}
                    className="mt-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 rounded-xl transition relative"
                  >
                    📋 텍스트 복사하기
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 전반 모달창 */}
      {activeModal === 'transfer' && dischargeStudent && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-sm no-print">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-black text-slate-200 flex items-center gap-1.5">
                <i className="fas fa-exchange-alt text-cyan-400"></i>
                원생 전반(반 이동) 처리
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-500 hover:text-slate-350 text-xl font-bold cursor-pointer">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">대상 원생</span>
                <div className="text-xs font-black text-slate-200 bg-slate-950 px-3 py-2.5 rounded-xl border border-slate-850">
                  {dischargeStudent.name} (현재: {selectedClass?.name})
                </div>
              </div>

              <div>
                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">이동할 새 반 선택</span>
                <select
                  value={targetClassId}
                  onChange={e => setTargetClassId(e.target.value)}
                  className="w-full border border-slate-800 bg-slate-950 p-2.5 rounded-xl text-xs outline-none focus:border-cyan-400"
                >
                  <option value="">새 반을 선택하세요</option>
                  {state.classes
                    .filter(c => c.id !== selectedClassId && c.active !== false)
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  <option value="__other_teacher__">━━ 다른 선생님반으로 이동 ━━</option>
                </select>
                {targetClassId === '__other_teacher__' && (
                  <div className="mt-2 space-y-2">
                    <p className="text-[9px] text-amber-400 font-bold">담당 선생님께 직접 학생 데이터를 이관해야 합니다. 아래에 이동할 반 정보를 입력하세요.</p>
                    <input
                      type="text"
                      placeholder="이동할 선생님 반 이름 (예: 고2 서울대반)"
                      className="w-full border border-amber-500/40 bg-slate-950 p-2.5 rounded-xl text-xs outline-none focus:border-amber-400 text-slate-300"
                      value={modalContent}
                      onChange={e => setModalContent(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div>
                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">전반 처리 적용일 (이 날짜 다음날부터 기존 반 안 나옴)</span>
                <div className="relative">
                  <input
                    type="date"
                    value={transferDate}
                    onChange={e => setTransferDate(e.target.value)}
                    onClick={e => { try { e.target.showPicker(); } catch (err) {} }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                  />
                  <button className="w-full border border-slate-800 bg-slate-950 p-2.5 rounded-xl text-xs text-slate-300 font-mono text-center justify-center flex items-center">
                    {formatDateWithDay(transferDate)}
                  </button>
                </div>
              </div>

              <div>
                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">전반(반 이동) 구체적 사유</span>
                <textarea
                  placeholder="예: 실력 향상으로 상위 학업반 레벨업 이동..."
                  value={modalContent}
                  onChange={e => setModalContent(e.target.value)}
                  className="w-full border border-slate-800 p-3 rounded-xl text-xs h-28 bg-slate-950 focus:border-cyan-400 outline-none text-slate-300 leading-relaxed resize-none"
                ></textarea>
              </div>

              <button
                onClick={handleTransferSubmit}
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold py-3 rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <i className="fas fa-exchange-alt"></i>
                전반 처리 완료 및 반 이동
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
