import React, { useState, useEffect, useRef } from 'react';
import { addDoc, updateDoc, doc, serverTimestamp, COLLECTION_NAMES } from '../services/firebaseService.js';
import {
  calculateCompletionRate,
  buildCarryoverResolutions,
  normalizeRubricScores,
  pageResolutionKey,
  pagesInRange,
  unitsForRange,
  parseMissedPages
} from '../lib/textbookProgress.js';
import { standardUnitLabelsForIds } from '../lib/standardUnits.js';
import { normalizeRemarkTemplates } from '../lib/remarkTemplates.js';

// 페이지 배열을 12,13,16-18 형태의 문자열로 변환하는 헬퍼 함수
function stringifyMissedPages(pages) {
  if (!pages || pages.length === 0) return '';
  const sorted = [...pages].sort((a, b) => a - b);
  const ranges = [];
  let start = sorted[0];
  let end = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      if (start === end) {
        ranges.push(`${start}`);
      } else {
        ranges.push(`${start}-${end}`);
      }
      start = sorted[i];
      end = sorted[i];
    }
  }

  if (start === end) {
    ranges.push(`${start}`);
  } else {
    ranges.push(`${start}-${end}`);
  }

  return ranges.join(',');
}

export default function InspectionWizardModal({
  isOpen,
  onClose,
  props,
  selectedClassId,
  selectedStudentId,
  selectedBookId,
  selectedDate: initialDate,
  students,
  selectedStudent: initialStudent,
  selectedBook: initialBook,
  selectedClass,
  carryoverRows: initialCarryoverRows,
  updateMainStates
}) {
  const {
    state,
    db,
    refs,
    fmtDate,
    studentById,
    bookById,
    buildCarryoverRows,
    calculateCarryoverRecoveryRate,
    RUBRIC_ITEMS,
    remarkTemplates,
    showModalAlert,
    showModalConfirm,
    updateLegacyState,
    assignedBooksForClass
  } = props;

  // 현재 모달 내 점검 대상 학생 & 교재 로컬 상태 (순회 모드 지원용)
  const [currentStudent, setCurrentStudent] = useState(initialStudent);
  const [currentBook, setCurrentBook] = useState(initialBook);
  const [selectedDate, setSelectedDate] = useState(initialDate);

  // 로컬 편집 ID 및 가장 최근 저장된 학생 ID, 그리고 출석 상태
  const [localEditingId, setLocalEditingId] = useState(state.editingInspectionId || '');
  const [lastSavedStudentId, setLastSavedStudentId] = useState(null);
  const [attendanceStatus, setAttendanceStatus] = useState('normal');
  const [isSaving, setIsSaving] = useState(false);

  // 단계 관리 상태
  // step 1: 지난 과제 재검 (🔴 완료 체크 - 초록색 테마)
  // step 2: 이번 과제 범위 (🟢 미완료 체크 - 빨간색 테마)
  // step 3: 특이사항 입력 (대표 칩)
  // step 4: 6요소 평가 및 저장
  const [step, setStep] = useState(1);

  // 1단계: 지난 과제 해결 상태
  const [selectedCarryoverKeys, setSelectedCarryoverKeys] = useState(
    new Set(state.selectedCarryoverResolutionKeys || [])
  );
  // 2단계: 범위 및 미완료 페이지 상태
  const [rangeStart, setRangeStart] = useState(state.selectedRangeStart || '');
  const [rangeEnd, setRangeEnd] = useState(state.selectedRangeEnd || '');
  const [missedPagesInput, setMissedPagesInput] = useState(state.missedPages || '');
  const [selectedMissedPages, setSelectedMissedPages] = useState(new Set());

  // 3단계: 특이사항 메모 상태
  const [memo, setMemo] = useState(state.memo || '');

  // 4단계: 6요소 점수 상태
  const [rubricScores, setRubricScores] = useState(
    state.rubricScores || { expression: null, grading: null, attitude: null, understanding: null, application: null }
  );

  // 학생별 캐리오버 행 데이터 캐싱
  const [carryoverRows, setCarryoverRows] = useState(initialCarryoverRows || []);

  // 학생의 기존 점검 데이터가 있을 경우 폼에 로드하는 헬퍼 함수
  const loadStudentInspectionData = (student, book) => {
    if (!student || !book) return;

    const existing = (state.inspections || []).find(r => 
      r.studentId === student.id && 
      r.bookId === book.id && 
      r.date === selectedDate
    );

    if (existing) {
      setLocalEditingId(existing.id);
      setAttendanceStatus(existing.attendanceStatus || 'normal');
      setRangeStart(existing.rangeStart || '');
      setRangeEnd(existing.rangeEnd || '');
      setMissedPagesInput((existing.missedPages || []).join(','));
      const parsed = parseMissedPages((existing.missedPages || []).join(','));
      setSelectedMissedPages(new Set(parsed));
      setMemo(existing.memo || '');
      setRubricScores(existing.rubricScores || { expression: null, grading: null, attitude: null, understanding: null, application: null });
      
      const carryoverKeys = new Set();
      if (existing.carryoverResolutions) {
        existing.carryoverResolutions.forEach(cr => {
          if (cr.resolvedPages) {
            cr.resolvedPages.forEach(p => {
              carryoverKeys.add(pageResolutionKey(cr.sourceInspectionId, p));
            });
          }
        });
      }
      setSelectedCarryoverKeys(carryoverKeys);

      updateMainStates({
        editingInspectionId: existing.id
      });
    } else {
      setLocalEditingId('');
      setAttendanceStatus('normal');
      setSelectedCarryoverKeys(new Set());
      setMissedPagesInput('');
      setSelectedMissedPages(new Set());
      setMemo('');
      setRubricScores({ expression: null, grading: null, attitude: null, understanding: null, application: null });

      updateMainStates({
        editingInspectionId: ''
      });
    }
  };

  // 1. 수정 모드인 경우 데이터 로드 처리 또는 해당 학생의 기존 기록이 있다면 로드
  useEffect(() => {
    if (state.editingInspectionId) {
      setStep(1); // 수정 시에는 점검일 단계를 생략하고 바로 1단계로 진입
      setLocalEditingId(state.editingInspectionId);
      const existing = (state.inspections || []).find(r => r.id === state.editingInspectionId);
      setAttendanceStatus(existing?.attendanceStatus || 'normal');
      setRangeStart(state.selectedRangeStart || '');
      setRangeEnd(state.selectedRangeEnd || '');
      setMissedPagesInput(state.missedPages || '');
      const parsed = parseMissedPages(state.missedPages || '');
      setSelectedMissedPages(new Set(parsed));
      setMemo(state.memo || '');
      setRubricScores(state.rubricScores || { expression: null, grading: null, attitude: null, understanding: null, application: null });
      setSelectedCarryoverKeys(new Set(state.selectedCarryoverResolutionKeys || []));
    } else {
      loadStudentInspectionData(initialStudent, initialBook);
    }
  }, []);

  // 2. 학생이 변경되었을 때 캐리오버 데이터 로드
  useEffect(() => {
    if (currentStudent && currentBook) {
      const rows = buildCarryoverRows({
        inspections: state.inspections,
        studentId: currentStudent.id,
        bookId: currentBook.id,
        editingInspectionId: state.editingInspectionId,
        currentDate: selectedDate
      });
      setCarryoverRows(rows);
    }
  }, [currentStudent, currentBook, selectedDate, state.inspections]);

  // 3. 이번 범위 페이지 목록 자동 계산
  const totalRangePages = pagesInRange(rangeStart, rangeEnd);

  // 4. 입력창 ➔ 체크 버튼 동기화 (2단계)
  useEffect(() => {
    const parsed = parseMissedPages(missedPagesInput);
    // 현재 범위 내에 있는 미완료 페이지만 필터링하여 체크박스 세트에 세팅
    const inRangeMissed = parsed.filter(p => p >= Number(rangeStart) && p <= Number(rangeEnd));
    setSelectedMissedPages(new Set(inRangeMissed));
  }, [missedPagesInput, rangeStart, rangeEnd]);

  // 5. 체크 버튼 ➔ 입력창 동기화 (2단계)
  const toggleMissedPage = (page) => {
    const next = new Set(selectedMissedPages);
    if (next.has(page)) {
      next.delete(page);
    } else {
      next.add(page);
    }
    setSelectedMissedPages(next);
    // 문자열로 압축하여 인풋 값 갱신
    const txt = stringifyMissedPages([...next]);
    setMissedPagesInput(txt);
    updateLegacyState({ missedPages: txt });
  };

  // 단원명 표시를 위한 헬퍼
  const displayUnitName = (unit, book = null) => {
    if (book?.bookType === 'exam_chapter') return unit?.name || '';
    const linkedNames = standardUnitLabelsForIds(state.standardUnitSubjects, unit?.standardUnitIds || []);
    return linkedNames.length ? linkedNames.join(', ') : (unit?.name || '');
  };

  // 지난 과제 해결 키 토글 (1단계)
  const toggleCarryoverKey = (key) => {
    const next = new Set(selectedCarryoverKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelectedCarryoverKeys(next);
  };

  // 특이사항 대표 문구 토글 (3단계)
  const toggleRemarkTemplate = (item) => {
    let nextMemo = memo;
    if (memo.includes(item)) {
      // 이미 포함되어 있는 경우 제거
      nextMemo = memo.replace(item, '');
      // 연속된 공백이나 문장 정리
      nextMemo = nextMemo.replace(/\s+/g, ' ').trim();
    } else {
      // 포함되지 않은 경우 추가
      nextMemo = memo ? memo.trim() + ' ' + item : item;
    }
    setMemo(nextMemo);
    updateLegacyState({ memo: nextMemo });
  };

  // 6요소 점수 설정 (4단계)
  const setRubricScore = (key, val) => {
    setRubricScores(prev => ({ ...prev, [key]: val }));
  };

  // 6요소 점수 미세조정 (4단계)
  const adjustRubricScore = (key, delta) => {
    const cur = rubricScores[key] === null ? 5 : rubricScores[key]; // 미입력 시 5점 기준
    const next = Math.min(10, Math.max(0, cur + delta));
    setRubricScores(prev => ({ ...prev, [key]: next }));
  };

  // 점검 저장 공통 로직
  const executeSave = async (showPrompt = true) => {
    if (isSaving) return false;
    if (!currentStudent || !currentBook) {
      showModalAlert('학생과 교재가 정확히 지정되지 않았습니다.');
      return false;
    }

    setIsSaving(true);

    let payload = {
      teacherId: state.currentTeacher.id,
      teacherName: state.currentTeacher.name,
      classId: selectedClassId,
      studentId: currentStudent.id,
      bookId: currentBook.id,
      date: selectedDate,
      attendanceStatus,
      updatedAt: serverTimestamp()
    };

    let start = null;
    let end = null;
    let missedPages = [];
    let completionRate = null;
    let carryoverResolutions = [];
    let carryoverRecovery = { totalPages: 0, resolvedPages: 0, remainingPages: 0, recoveryRate: 0 };
    let units = [];
    let standardUnitIds = [];
    let duplicate = null;

    if (attendanceStatus === 'absent') {
      // 결석일 때는 중복체크 기준을 날짜/학생/교재로만 검사
      duplicate = (state.inspections || []).find(r => 
        r.id !== (localEditingId || state.editingInspectionId) && 
        r.studentId === currentStudent.id && 
        r.bookId === currentBook.id && 
        r.date === selectedDate
      );
    } else if (attendanceStatus === 'no_book') {
      // 교재 미지참일 때도 날짜/학생/교재로 검사
      duplicate = (state.inspections || []).find(r => 
        r.id !== (localEditingId || state.editingInspectionId) && 
        r.studentId === currentStudent.id && 
        r.bookId === currentBook.id && 
        r.date === selectedDate
      );
    } else {
      const startText = String(rangeStart || '').trim();
      const endText = String(rangeEnd || '').trim();
      if (!startText || !endText) {
        showModalAlert('검사 범위를 입력해주세요.');
        setIsSaving(false);
        return false;
      }
      start = Number(startText);
      end = Number(endText);
      if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
        showModalAlert('검사 범위를 바르게 입력해주세요. (1 이상의 숫자, 끝 페이지 >= 시작 페이지)');
        setIsSaving(false);
        return false;
      }

      const total = pagesInRange(start, end);
      missedPages = [...selectedMissedPages].sort((a, b) => a - b);
      completionRate = calculateCompletionRate(total, missedPages);
      const rangeUnits = unitsForRange(currentBook, start, end);
      units = rangeUnits.map(u => displayUnitName(u, currentBook));
      standardUnitIds = [...new Set(rangeUnits.flatMap(u => u.standardUnitIds || []))];

      // 중복 체크
      duplicate = state.inspections.find(r => 
        r.id !== (localEditingId || state.editingInspectionId) && 
        r.studentId === currentStudent.id && 
        r.bookId === currentBook.id && 
        r.date === selectedDate && 
        Number(r.rangeStart) === start && 
        Number(r.rangeEnd) === end
      );
    }

    if (duplicate && showPrompt) {
      const ok = await showModalConfirm('같은 학생/교재/날짜의 점검 기록이 이미 있습니다. 기존 기록을 덮어쓸까요?');
      if (!ok) {
        setIsSaving(false);
        return false;
      }
    }

    const targetInspectionId = duplicate?.id || localEditingId || state.editingInspectionId;

    if (attendanceStatus === 'normal') {
      const currentCarryover = buildCarryoverRows({
        inspections: state.inspections,
        studentId: currentStudent.id,
        bookId: currentBook.id,
        editingInspectionId: targetInspectionId,
        currentDate: selectedDate
      });
      carryoverResolutions = buildCarryoverResolutions(currentCarryover, [...selectedCarryoverKeys]);
      carryoverRecovery = calculateCarryoverRecoveryRate(currentCarryover, [...selectedCarryoverKeys]);
    }

    payload = {
      ...payload,
      rangeStart: start,
      rangeEnd: end,
      missedPages,
      carryoverResolutions,
      carryoverRecovery,
      completionRate,
      units,
      standardUnitIds,
      memo,
      rubricScores: attendanceStatus === 'absent'
        ? { expression: null, grading: null, attitude: null, understanding: null, application: null }
        : normalizeRubricScores(rubricScores)
    };

    try {
      if (duplicate) {
        await updateDoc(doc(db, COLLECTION_NAMES.inspections, duplicate.id), payload);
      } else if (localEditingId) {
        await updateDoc(doc(db, COLLECTION_NAMES.inspections, localEditingId), payload);
      } else if (state.editingInspectionId) {
        await updateDoc(doc(db, COLLECTION_NAMES.inspections, state.editingInspectionId), payload);
      } else {
        await addDoc(refs.inspections, { ...payload, createdAt: serverTimestamp() });
      }

      setLastSavedStudentId(currentStudent.id);

      if (showPrompt) {
        let summary = "";
        if (attendanceStatus === 'absent') {
          summary = `${currentStudent.name} 학생이 결석으로 기록되었습니다.`;
        } else if (attendanceStatus === 'no_book') {
          summary = `${currentStudent.name} 학생이 교재 미지참으로 기록되었습니다. (정성 평가 점수 반영 완료)`;
        } else {
          const carryoverSummary = carryoverRecovery.totalPages > 0
            ? `\n지난 미완료 재검 완료: ${carryoverRecovery.resolvedPages}/${carryoverRecovery.totalPages}쪽 (${carryoverRecovery.recoveryRate}%)`
            : '';
          summary = `${currentStudent.name} 학생 점검이 저장되었습니다.\n\n범위: ${start}~${end}쪽\n미완료: ${missedPages.length ? missedPages.join(', ') : '없음'}${carryoverSummary}\n완료율: ${completionRate}%`;
        }
        await showModalAlert(summary, '점검 완료');
      }
      return true;
    } catch (err) {
      console.error(err);
      showModalAlert('저장하는 도중 오류가 발생했습니다: ' + err.message, '오류');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // [점검 완료 저장] 단독 저장 및 닫기
  const handleSaveAndClose = async () => {
    const success = await executeSave(true);
    if (success) {
      onClose();
    }
  };

  // [저장 후 다음 학생] 핸들러
  // 현재 학생 정보 저장 ➔ 시작/끝 범위는 유지 ➔ 다음 학생의 기존 점검 데이터가 있다면 로드
  const handleSaveAndNext = async () => {
    const savedStudentId = currentStudent.id;
    const success = await executeSave(false);
    if (!success) return;

    // 현재 반 학생들 목록 중 다음 학생을 찾습니다.
    const currentIndex = students.findIndex(s => s.id === currentStudent.id);
    const nextStudent = students[currentIndex + 1] || students[0]; // 다음 학생이 없으면 첫 학생으로 순환

    if (nextStudent) {
      const assignedBooks = assignedBooksForClass(selectedClassId);
      const hasCurrentBook = assignedBooks.some(b => b.book?.id === currentBook?.id);
      const nextBook = hasCurrentBook ? currentBook : (assignedBooks[0]?.book || currentBook);

      // 학생 및 교재 변경
      setCurrentStudent(nextStudent);
      setCurrentBook(nextBook);

      // 상위 컨테이너와도 싱크
      updateMainStates({
        selectedInspectionStudentId: nextStudent.id,
        selectedInspectionBookId: nextBook.id
      });

      // 다음 학생의 기존 점검 기록 로드 (없을 경우 범위는 복사 유지)
      const prevStart = rangeStart;
      const prevEnd = rangeEnd;

      const existing = (state.inspections || []).find(r => 
        r.studentId === nextStudent.id && 
        r.bookId === nextBook.id && 
        r.date === selectedDate
      );

      if (existing) {
        setLocalEditingId(existing.id);
        setAttendanceStatus(existing.attendanceStatus || 'normal');
        setRangeStart(existing.rangeStart || '');
        setRangeEnd(existing.rangeEnd || '');
        setMissedPagesInput((existing.missedPages || []).join(','));
        const parsed = parseMissedPages((existing.missedPages || []).join(','));
        setSelectedMissedPages(new Set(parsed));
        setMemo(existing.memo || '');
        setRubricScores(existing.rubricScores || { expression: null, grading: null, attitude: null, understanding: null, application: null });
        
        const carryoverKeys = new Set();
        if (existing.carryoverResolutions) {
          existing.carryoverResolutions.forEach(cr => {
            if (cr.resolvedPages) {
              cr.resolvedPages.forEach(p => {
                carryoverKeys.add(pageResolutionKey(cr.sourceInspectionId, p));
              });
            }
          });
        }
        setSelectedCarryoverKeys(carryoverKeys);

        updateMainStates({
          editingInspectionId: existing.id
        });
      } else {
        setLocalEditingId('');
        setAttendanceStatus('normal');
        setRangeStart(prevStart); // 범위 유지
        setRangeEnd(prevEnd);     // 범위 유지
        setSelectedCarryoverKeys(new Set());
        setMissedPagesInput('');
        setSelectedMissedPages(new Set());
        setMemo('');
        setRubricScores({ expression: null, grading: null, attitude: null, understanding: null, application: null });

        updateMainStates({
          editingInspectionId: ''
        });
      }

      // 스텝을 다시 1단계(지난과제 재검)로 리셋
      setStep(1);
    }
  };

  // 학생 칩을 직접 클릭하여 대상 전환 (반 순회 모드 전용)
  // 클릭된 친구가 이미 점검 저장되어 있으면 모달 창에 값을 즉시 채워 바로 수정하도록 함
  const handleStudentSelectInQuickMode = (stud) => {
    if (stud.id === currentStudent.id) return;

    const assignedBooks = assignedBooksForClass(selectedClassId);
    const hasCurrentBook = assignedBooks.some(b => b.book?.id === currentBook?.id);
    const matchedBook = hasCurrentBook ? currentBook : (assignedBooks[0]?.book || currentBook);

    setCurrentStudent(stud);
    setCurrentBook(matchedBook);

    updateMainStates({
      selectedInspectionStudentId: stud.id,
      selectedInspectionBookId: matchedBook.id
    });

    const prevStart = rangeStart;
    const prevEnd = rangeEnd;

    const existing = (state.inspections || []).find(r => 
      r.studentId === stud.id && 
      r.bookId === matchedBook.id && 
      r.date === selectedDate
    );

    if (existing) {
      setLocalEditingId(existing.id);
      setAttendanceStatus(existing.attendanceStatus || 'normal');
      setRangeStart(existing.rangeStart || '');
      setRangeEnd(existing.rangeEnd || '');
      setMissedPagesInput((existing.missedPages || []).join(','));
      const parsed = parseMissedPages((existing.missedPages || []).join(','));
      setSelectedMissedPages(new Set(parsed));
      setMemo(existing.memo || '');
      setRubricScores(existing.rubricScores || { expression: null, grading: null, attitude: null, understanding: null, application: null });
      
      const carryoverKeys = new Set();
      if (existing.carryoverResolutions) {
        existing.carryoverResolutions.forEach(cr => {
          if (cr.resolvedPages) {
            cr.resolvedPages.forEach(p => {
              carryoverKeys.add(pageResolutionKey(cr.sourceInspectionId, p));
            });
          }
        });
      }
      setSelectedCarryoverKeys(carryoverKeys);

      updateMainStates({
        editingInspectionId: existing.id
      });
    } else {
      setLocalEditingId('');
      setAttendanceStatus('normal');
      setRangeStart(prevStart); // 범위 유지
      setRangeEnd(prevEnd);     // 범위 유지
      setSelectedCarryoverKeys(new Set());
      setMissedPagesInput('');
      setSelectedMissedPages(new Set());
      setMemo('');
      setRubricScores({ expression: null, grading: null, attitude: null, understanding: null, application: null });

      updateMainStates({
        editingInspectionId: ''
      });
    }

    setStep(1); // 1단계로 리셋
  };

  // 6요소 점수 라벨 헬퍼
  const rubricColorByKey = {
    expression: 'bg-blue-500',
    grading: 'bg-indigo-500',
    attitude: 'bg-violet-500',
    understanding: 'bg-emerald-500',
    application: 'bg-amber-500'
  };

  // 직전 완료된 점검 기록 구하기 (현재 편집 중인 inspection 제외)
  const lastInspection = (state.inspections || [])
    .filter(r => 
      r.studentId === currentStudent?.id && 
      r.bookId === currentBook?.id &&
      r.id !== localEditingId &&
      r.attendanceStatus === 'normal' // 정상 점검 기록만 (점수가 있는 기록)
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

  const lastRubricScores = lastInspection?.rubricScores || {};

  const manualRubricItems = (RUBRIC_ITEMS || []).filter(item => !item.automatic);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      {/* 모달 박스 */}
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* 오로라 그라데이션 장식 선 */}
        <div className="h-[2px] w-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500"></div>

        {/* 헤더 */}
        <header className="p-5 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full inline-block mb-1">
              {state.editingInspectionId ? '점검 기록 수정 중' : '실시간 교재 검사'}
            </div>
            <h2 key={currentStudent?.id} className="text-sm font-black text-white flex items-center gap-2.5 animate-fade-in">
              <span>{selectedClass?.name}</span>
              <span className="text-slate-700">&middot;</span>
              <span className="text-blue-400 font-black">{currentStudent?.name} 학생</span>
              <span className="text-slate-700">&middot;</span>
              <span className="text-slate-400 font-medium text-xs">({currentBook?.title})</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            ✕
          </button>
        </header>

        {/* 바디 영역 (세로 flex로 구성하여 순회 칩 목록이 하단에 깔리도록 변경) */}
        <div className="flex-1 overflow-y-auto flex flex-col justify-between min-h-0 bg-slate-900">
          
          {/* 단계별 입력 패널 */}
          <main key={`${currentStudent?.id}-${step}`} className="p-6 flex-1 overflow-y-auto flex flex-col justify-between animate-fade-in">
            <div>
              {/* [출석 상태 선택 칩 영역] */}
              <div className="flex items-center gap-2 mb-6 p-3 bg-slate-950/40 border border-slate-850 rounded-2xl select-none">
                <span className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-wider">출석 현황</span>
                {[
                  { key: 'normal', label: '정상 출석', activeColor: 'bg-emerald-600 border-emerald-500 text-white', dotColor: 'bg-emerald-500' },
                  { key: 'no_book', label: '교재 미지참', activeColor: 'bg-amber-600 border-amber-500 text-white', dotColor: 'bg-amber-500' },
                  { key: 'absent', label: '결석', activeColor: 'bg-rose-600 border-rose-500 text-white', dotColor: 'bg-rose-500' }
                ].map(item => {
                  const active = attendanceStatus === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setAttendanceStatus(item.key);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black border transition-all cursor-pointer flex items-center gap-1.5 ${
                        active 
                          ? `${item.activeColor} shadow-md` 
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : item.dotColor}`} />
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {attendanceStatus === 'absent' ? (
                /* 결석 전용 화면 */
                <div className="space-y-5 py-2 animate-fade-in">
                  <div className="border border-rose-500/20 bg-rose-950/10 rounded-2xl p-4">
                    <h3 className="text-xs font-black text-rose-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                      결석 학생 처리
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                      결석 처리 시 오늘 날짜의 완료율과 6요소 정성 평가는 저장되지 않으며, 이전 회차의 미완료 과제들은 다음 정상 점검 회차로 자동 이월됩니다.
                    </p>
                  </div>
                  
                  <label className="block text-xs font-bold text-slate-400">결석 사유 및 메모
                    <textarea
                      value={memo}
                      onChange={(e) => {
                        setMemo(e.target.value);
                        updateLegacyState({ memo: e.target.value });
                      }}
                      className="mt-2 w-full border border-slate-855 rounded-xl p-3 bg-slate-950 text-xs text-white focus:outline-none focus:border-blue-500 transition-all min-h-[140px]"
                      placeholder="예: 독감으로 등원 불가, 개인 가족 행사 등 결석 사유를 메모해 주세요."
                    />
                  </label>
                </div>
              ) : (
                /* 기존 마법사 화면 (정상 출석 또는 교재 미지참) */
                <div>
                  {/* 단계 진행 안내 바 */}
                  <div className="flex items-center gap-1.5 mb-6 overflow-x-auto pb-2 select-none mini-scroll">
                    {[
                      { s: 1, l: '지난 미완료 재검' },
                      { s: 2, l: '이번 범위 & 미완료' },
                      { s: 3, l: '특이사항 메모' },
                      { s: 4, l: '6요소 평가 및 저장' }
                    ].map(item => {
                      const isDisabled = attendanceStatus === 'no_book' && item.s === 2;
                      return (
                        <button
                          key={item.s}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => !isDisabled && setStep(item.s)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all ${
                            isDisabled 
                              ? 'bg-slate-955 border-slate-900 text-slate-700 cursor-not-allowed'
                              : step === item.s 
                                ? 'bg-blue-600 border-blue-500 text-white shadow-sm cursor-pointer' 
                                : 'bg-slate-950 border-slate-850 text-slate-500 hover:text-slate-300 cursor-pointer'
                          }`}
                        >
                          {item.l}
                        </button>
                      );
                    })}
                  </div>

                  {/* [Step 1: 지난 과제 재검 - 초록색 테마] */}
                  {step === 1 && (
                    <div className="space-y-4 py-2">
                      <div className="border border-emerald-500/20 bg-emerald-950/10 rounded-2xl p-4">
                        <h3 className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          지난 과제 미완료 오답 재검
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                          과거 점검에서 미완료로 체크되었던 페이지들입니다. **이번에 해결(완료)해 온 페이지만 터치하여 선택**하세요. (초록색 = 완료 완료!)
                        </p>
                      </div>

                      {carryoverRows.length > 0 ? (
                        <div className="space-y-4 mt-4">
                          {carryoverRows.map((row, i) => (
                            <div key={i} className="border border-slate-850 bg-slate-950/20 rounded-xl p-3">
                              <div className="text-[10px] font-black text-slate-500 mb-2 flex items-center flex-wrap gap-1.5 border-b border-slate-800/60 pb-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500/80"></span>
                                <span>{fmtDate(row.sourceDate)} 점검</span>
                                <span className="text-slate-700">&middot;</span>
                                <span className="text-blue-400">범위: {row.rangeStart}~{row.rangeEnd}쪽</span>
                                <span className="text-slate-700">&middot;</span>
                                <span className="text-emerald-450">완료율: {row.completionRate}%</span>
                              </div>
                          <div className="flex flex-wrap gap-1.5">
                            {row.missedPages.map(page => {
                              const key = pageResolutionKey(row.sourceInspectionId, page);
                              const isResolved = selectedCarryoverKeys.has(key);
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => toggleCarryoverKey(key)}
                                  className={`min-w-[44px] h-9 rounded-lg border text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${isResolved ? 'bg-emerald-500/80 border-emerald-500 text-white shadow-sm font-black' : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-emerald-500/50 hover:bg-emerald-950/20 hover:text-emerald-300'}`}
                                >
                                  <span>{page}</span>
                                  {isResolved && (
                                    <svg className="w-3.5 h-3.5 text-white shrink-0" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="border border-dashed border-slate-800 bg-slate-950/10 p-8 text-center text-xs text-slate-500 rounded-xl">
                      이전 회차 미완료 오답 내역이 없습니다. (바로 다음 단계로 넘어가셔도 됩니다.)
                    </div>
                  )}
                </div>
              )}

              {/* [Step 2: 이번 과제 범위 및 미완료 체크 - 빨간색 테마] */}
              {step === 2 && (
                attendanceStatus === 'no_book' ? (
                  <div className="border border-dashed border-amber-500/20 bg-amber-950/5 p-8 text-center text-xs text-slate-400 rounded-xl my-4">
                    교재 미지참 상태로 설정되어 이번 범위 입력을 건너뜁니다.<br />
                    (완료율은 평가에서 제외되며, 이전 미완료 건들은 자동으로 다음 회차로 이월됩니다.)
                  </div>
                ) : (
                  <div className="space-y-4 py-2">
                    <div className="border border-rose-500/20 bg-rose-950/10 rounded-2xl p-4">
                      <h3 className="text-xs font-black text-rose-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                        이번 과제 범위 및 미완료(안 풀어옴) 체크
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                        이번에 숙제로 내준 페이지 범위를 정하고, 그 범위 중 **끝까지 완료하지 못한 미완료 페이지만 터치하여 체크**하세요. (빨간색 = 숙제 안 해옴!)
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <label className="text-xs font-bold text-slate-400 block">시작 페이지
                        <input
                          type="number"
                          value={rangeStart}
                          onChange={(e) => {
                            setRangeStart(e.target.value);
                            updateLegacyState({ selectedRangeStart: e.target.value });
                          }}
                          className="mt-2 w-full border border-slate-850 rounded-xl px-4 py-2.5 bg-slate-950 text-xs text-white focus:outline-none focus:border-blue-500 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </label>
                      <label className="text-xs font-bold text-slate-400 block">끝 페이지
                        <input
                          type="number"
                          value={rangeEnd}
                          onChange={(e) => {
                            setRangeEnd(e.target.value);
                            updateLegacyState({ selectedRangeEnd: e.target.value });
                          }}
                          className="mt-2 w-full border border-slate-850 rounded-xl px-4 py-2.5 bg-slate-950 text-xs text-white focus:outline-none focus:border-blue-500 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </label>
                    </div>

                    {totalRangePages.length > 0 ? (
                      <div className="mt-4 border border-slate-850 bg-slate-950/20 p-4 rounded-xl">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-black text-slate-400">범위 페이지 목록 ({totalRangePages.length}쪽)</span>
                          <button
                            type="button"
                            onClick={() => setMissedPagesInput('')}
                            className="ghost-button px-2.5 py-1.5 rounded-lg text-[10px] font-black border border-slate-805 text-slate-400 hover:text-white transition cursor-pointer"
                          >
                            체크 초기화
                          </button>
                        </div>
                      <div className="flex flex-wrap gap-1.5">
                        {totalRangePages.map(p => {
                          const isMissed = selectedMissedPages.has(p);
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => toggleMissedPage(p)}
                              className={`min-w-[40px] h-9 rounded-lg border text-xs font-black transition-all cursor-pointer ${isMissed ? 'bg-rose-500/80 border-rose-500 text-white shadow-sm font-black' : 'bg-slate-950/40 border-slate-800/80 text-slate-450 hover:border-rose-500/50 hover:bg-rose-950/10 hover:text-white'}`}
                            >
                              {p}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="border border-dashed border-slate-800 bg-slate-950/10 p-6 text-center text-xs text-slate-500 rounded-xl">
                      시작 페이지와 끝 페이지 범위를 바르게 지정하면 페이지 그리드가 노출됩니다.
                    </div>
                  )}

                  <label className="block mt-4 text-xs font-bold text-slate-400">미완료 페이지 구간 입력 (체크 시 자동 완성)
                    <input
                      type="text"
                      value={missedPagesInput}
                      onChange={(e) => {
                        setMissedPagesInput(e.target.value);
                        updateLegacyState({ missedPages: e.target.value });
                      }}
                      className="mt-2 w-full border border-slate-850 rounded-xl px-4 py-2.5 bg-slate-950 text-xs text-white focus:outline-none focus:border-blue-500 transition-all"
                      placeholder="예: 12,13,16-18"
                    />
                  </label>
                </div>
              ))}

              {/* [Step 3: 특이사항 입력] */}
              {step === 3 && (
                <div className="space-y-4 py-2">
                  <h3 className="text-xs font-black text-slate-300">특이사항 코멘트 입력</h3>
                  <textarea
                    value={memo}
                    onChange={(e) => {
                      setMemo(e.target.value);
                      updateLegacyState({ memo: e.target.value });
                    }}
                    className="w-full border border-slate-850 rounded-xl p-3 bg-slate-950 text-xs text-white focus:outline-none focus:border-blue-500 transition-all min-h-[120px]"
                    placeholder="직접 특이사항을 입력하거나 아래의 대표 문구 칩을 탭하여 추가하세요."
                  ></textarea>

                  <div className="mt-4 border border-slate-850 bg-slate-950/20 p-4 rounded-2xl">
                    <div className="text-xs font-extrabold text-slate-400 mb-3">6요소 대표 특이사항 문구 선택</div>
                    <div className="space-y-3.5 max-h-[400px] overflow-y-auto pr-1 mini-scroll">
                      {normalizeRemarkTemplates(remarkTemplates).map((row, i) => (
                        <div key={i} className="border border-slate-850 bg-slate-950/30 rounded-2xl p-3.5 space-y-3">
                          {/* 카드 상단: 6요소 이름 */}
                          <div className="text-[11px] font-black text-slate-300 flex items-center gap-1.5 border-b border-slate-850/60 pb-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                            {row.label}
                          </div>
                          
                          {/* 카드 하단: 3톤별 칩 그룹 */}
                          <div className="grid md:grid-cols-3 gap-3">
                            {/* Positive */}
                            <div className="space-y-1.5">
                              <div className="text-[9px] font-black text-emerald-500 uppercase tracking-wider pl-1">우수 (Positive)</div>
                              <div className="flex flex-wrap gap-1.5">
                                {(row.positive || []).map((item, idx) => {
                                  const isSelected = memo.includes(item);
                                  return (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => toggleRemarkTemplate(item)}
                                      className={`px-2.5 py-1.5 rounded-xl border text-[9px] font-black transition-all cursor-pointer flex items-center gap-1 ${
                                        isSelected 
                                          ? 'bg-emerald-500 border-emerald-400 text-white shadow-sm shadow-emerald-500/20' 
                                          : 'border-emerald-500/20 bg-emerald-950/10 text-emerald-450 hover:bg-emerald-950/30 hover:border-emerald-500/40 hover:text-emerald-300'
                                      }`}
                                    >
                                      {isSelected && <span className="text-[8px]">✓</span>}
                                      {item}
                                    </button>
                                  );
                                })}
                                {(!row.positive || row.positive.length === 0) && (
                                  <span className="text-[9px] text-slate-600 italic pl-1">없음</span>
                                )}
                              </div>
                            </div>

                            {/* Neutral */}
                            <div className="space-y-1.5">
                              <div className="text-[9px] font-black text-sky-500 uppercase tracking-wider pl-1">보통 (Neutral)</div>
                              <div className="flex flex-wrap gap-1.5">
                                {(row.neutral || []).map((item, idx) => {
                                  const isSelected = memo.includes(item);
                                  return (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => toggleRemarkTemplate(item)}
                                      className={`px-2.5 py-1.5 rounded-xl border text-[9px] font-black transition-all cursor-pointer flex items-center gap-1 ${
                                        isSelected 
                                          ? 'bg-sky-500 border-sky-400 text-white shadow-sm shadow-sky-500/20' 
                                          : 'border-sky-500/20 bg-sky-950/10 text-sky-450 hover:bg-sky-950/30 hover:border-sky-500/40 hover:text-sky-300'
                                      }`}
                                    >
                                      {isSelected && <span className="text-[8px]">✓</span>}
                                      {item}
                                    </button>
                                  );
                                })}
                                {(!row.neutral || row.neutral.length === 0) && (
                                  <span className="text-[9px] text-slate-600 italic pl-1">없음</span>
                                )}
                              </div>
                            </div>

                            {/* Negative */}
                            <div className="space-y-1.5">
                              <div className="text-[9px] font-black text-rose-500 uppercase tracking-wider pl-1">노력 (Negative)</div>
                              <div className="flex flex-wrap gap-1.5">
                                {(row.negative || []).map((item, idx) => {
                                  const isSelected = memo.includes(item);
                                  return (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => toggleRemarkTemplate(item)}
                                      className={`px-2.5 py-1.5 rounded-xl border text-[9px] font-black transition-all cursor-pointer flex items-center gap-1 ${
                                        isSelected 
                                          ? 'bg-rose-500 border-rose-400 text-white shadow-sm shadow-rose-500/20' 
                                          : 'border-rose-500/20 bg-rose-950/10 text-rose-450 hover:bg-rose-950/30 hover:border-rose-500/40 hover:text-rose-300'
                                      }`}
                                    >
                                      {isSelected && <span className="text-[8px]">✓</span>}
                                      {item}
                                    </button>
                                  );
                                })}
                                {(!row.negative || row.negative.length === 0) && (
                                  <span className="text-[9px] text-slate-600 italic pl-1">없음</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* [Step 4: 6요소 평가 및 저장] */}
              {step === 4 && (
                <div className="space-y-4 py-2">
                  <h3 className="text-xs font-black text-slate-300 mb-4">6요소 정성 평가 (0~10점)</h3>
                  
                  <div className="space-y-3.5">
                    {manualRubricItems.map(item => {
                      const curVal = rubricScores[item.key];
                      const filled = curVal !== null && curVal !== undefined;
                      const lastVal = lastRubricScores[item.key];
                      
                      return (
                        <div key={item.key} className="flex items-center justify-between gap-4 border border-slate-855 bg-slate-950/10 p-3 rounded-xl">
                          <div className="flex items-center gap-4">
                            <div className="w-[110px] shrink-0">
                              <div className="text-[10px] font-extrabold text-slate-400 leading-tight">{item.label}</div>
                              <div className={`text-[11px] font-black mt-0.5 ${filled ? 'text-blue-400' : 'text-slate-600'}`}>{filled ? curVal + '점' : '미입력'}</div>
                            </div>
                            
                            <div className="flex flex-wrap gap-1 items-center">
                              <button
                                type="button"
                                onClick={() => adjustRubricScore(item.key, -0.5)}
                                className="w-7 h-7 rounded-lg border border-slate-850 bg-slate-950 text-slate-400 text-xs font-black hover:border-blue-500 hover:text-white transition-all cursor-pointer"
                              >
                                -
                              </button>
                              
                              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                <button
                                  key={n}
                                  type="button"
                                  onClick={() => setRubricScore(item.key, n)}
                                  className={`w-7 h-7 rounded-lg border text-xs font-black transition-all cursor-pointer ${curVal === n ? 'bg-blue-600 border-blue-500 text-white font-extrabold shadow-sm' : 'bg-slate-950 border-slate-850 text-slate-500 hover:border-blue-500/50 hover:text-blue-300'}`}
                                >
                                  {n}
                                </button>
                              ))}
                              
                              <button
                                type="button"
                                onClick={() => adjustRubricScore(item.key, 0.5)}
                                className="w-7 h-7 rounded-lg border border-slate-850 bg-slate-950 text-slate-400 text-xs font-black hover:border-blue-500 hover:text-white transition-all cursor-pointer"
                              >
                                +
                              </button>

                              <button
                                type="button"
                                onClick={() => setRubricScore(item.key, null)}
                                className="px-2 py-1 text-[9px] font-bold text-slate-500 hover:text-rose-400 transition cursor-pointer"
                              >
                                초기화
                              </button>
                            </div>
                          </div>

                          {/* 우측 영역: 직전 6요소 점수 노출 (파란 체크가 가리키던 공간!) */}
                          <div className="shrink-0 pr-4 select-none">
                            {lastVal !== undefined && lastVal !== null ? (
                              <div className="flex flex-col items-end">
                                <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">직전 점수</span>
                                <span className="text-sm font-black text-blue-400 mt-0.5 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-lg">{lastVal}점</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-end">
                                <span className="text-[9px] font-extrabold text-slate-600 uppercase tracking-wider">직전 점수</span>
                                <span className="text-xs font-bold text-slate-650 mt-0.5">-</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>)}</div>

            {/* 하단 제어 버튼 영역 */}
            <footer className="mt-8 pt-4 border-t border-slate-850 flex items-center justify-between gap-3">
              {attendanceStatus === 'absent' ? (
                <div className="w-full flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-850 px-5 py-2.5 text-xs font-black text-slate-300 transition-all cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSaveAndClose}
                    className={`rounded-xl bg-rose-600 hover:bg-rose-500 px-5 py-3 text-xs font-black text-white shadow-lg transition-all active:scale-[0.98] cursor-pointer ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isSaving ? '저장 중...' : '결석 등록 완료'}
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    {step > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          // 교재 미지참일 때는 2단계를 건너뛰고 1단계로 가도록 예외 처리
                          if (attendanceStatus === 'no_book' && step === 3) {
                            setStep(1);
                          } else {
                            setStep(prev => prev - 1);
                          }
                        }}
                        className="rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-850 px-5 py-2.5 text-xs font-black text-slate-300 transition-all cursor-pointer"
                      >
                        ◀ 이전 단계
                      </button>
                    )}
                    {step > 0 && step < 4 && (
                      <button
                        type="button"
                        onClick={() => {
                          // 교재 미지참일 때는 2단계를 건너뛰고 3단계로 가도록 예외 처리
                          if (attendanceStatus === 'no_book' && step === 1) {
                            setStep(3);
                          } else {
                            setStep(prev => prev + 1);
                          }
                        }}
                        className="rounded-xl bg-slate-800 hover:bg-slate-750 px-5 py-2.5 text-xs font-black text-white transition-all cursor-pointer"
                      >
                        다음 단계 ▶
                      </button>
                    )}
                  </div>

                  {step === 4 && (
                    <div className="flex flex-wrap gap-2">
                      {/* [저장 후 다음 학생] 버튼 */}
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={handleSaveAndNext}
                        className={`rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-5 py-3 text-xs font-black text-white shadow-lg transition-all active:scale-[0.98] cursor-pointer ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {isSaving ? '저장 중...' : '저장 후 다음 학생 ➔'}
                      </button>

                      {/* [점검내역저장] 단독 저장 */}
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={handleSaveAndClose}
                        className={`rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-3 text-xs font-black text-white shadow-lg transition-all active:scale-[0.98] cursor-pointer ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {isSaving ? '저장 중...' : '점검내역 저장 완료'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </footer>
          </main>

          {/* 하단: 친구 칩 목록 상시 렌더링 */}
          {students && students.length > 0 && (
            <section className="p-5 border-t border-slate-800 bg-slate-950/60 no-print">
              <div className="flex items-center justify-between mb-3 pb-1.5 border-b border-slate-800/80">
                <span className="text-xs font-black text-slate-400">반 친구들 목록 (순회)</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 font-extrabold">터치식 즉시 전환</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const checkedStudentIds = new Set(
                    (state.inspections || [])
                      .filter(r => r.classId === selectedClassId && r.date === selectedDate)
                      .map(r => r.studentId)
                  );
                  return students.map(stud => {
                    const isCurrent = stud.id === currentStudent?.id;
                    const isSaved = checkedStudentIds.has(stud.id);

                    let btnClass = "";
                    if (isCurrent) {
                      btnClass = "bg-blue-600 border-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.6)] animate-[pulse_1.8s_infinite]";
                    } else if (isSaved) {
                      btnClass = "inspected-saved";
                    } else {
                      btnClass = "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white";
                    }

                    return (
                      <button
                        key={stud.id}
                        type="button"
                        onClick={() => handleStudentSelectInQuickMode(stud)}
                        className={`rounded-xl px-4 py-2.5 border text-xs font-black transition-all cursor-pointer ${btnClass}`}
                      >
                        {stud.name}
                      </button>
                    );
                  });
                })()}
              </div>
              <div className="mt-2 text-[9px] text-slate-600 leading-normal">
                * 이름을 터치하면 범위(시작/끝 페이지)는 유지된 채로 폼 양식은 리셋되며, 즉시 해당 학생의 첫 점검 단계로 넘어갑니다.
              </div>
            </section>
          )}

        </div>
      </div>
    </div>
  );
}
