import React, { useState, useMemo, useEffect } from 'react';
import {
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  writeBatch,
  COLLECTION_NAMES,
  getFirebaseService,
  serverTimestamp
} from '../services/firebaseService.js';
import {
  sortBookUnits,
  unitsForRange
} from '../lib/textbookProgress.js';

// Chip Select Button Component
function BtnSelect({ id, options, selectedValue, onChange, placeholder = '선택사항이 없습니다.' }) {
  if (!options || options.length === 0) {
    return <div className="text-xs text-slate-500 p-2 font-bold">{placeholder}</div>;
  }
  return (
    <div className="choice-grid" id={id}>
      {options.map(opt => {
        const active = String(opt.value) === String(selectedValue);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`choice-button btn-choice-teacher ${active ? 'selected' : ''}`}
            style={{ cursor: 'pointer' }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// Accordion Wrapper Component
function AccordionItem({ id, title, icon, colorClass, isOpen, onToggle, children }) {
  return (
    <div className={`rounded-[28px] border transition-all duration-300 ${isOpen ? 'border-violet-500/40 ring-4 ring-violet-500/20 bg-slate-900/40 shadow-xl' : 'border-slate-800 bg-slate-900/40 shadow-sm hover:border-slate-700'} mb-6`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-5 hover:bg-slate-900/50 transition-colors rounded-[28px] outline-none focus:outline-none"
        style={{ cursor: 'pointer' }}
      >
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center text-xs font-black shadow-sm ${colorClass}`}>
            <i className={`fas ${icon}`}></i>
          </div>
          <span className="font-black text-slate-100 text-[15px]">{title}</span>
        </div>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform duration-300 ${isOpen ? 'bg-violet-600 text-white rotate-180' : 'bg-slate-850 text-slate-500'}`}>
          <i className="fas fa-chevron-down text-[10px]"></i>
        </div>
      </button>
      {isOpen && (
        <div className="px-6 pb-6 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="h-px bg-slate-800/50 mb-5"></div>
          {children}
        </div>
      )}
    </div>
  );
}

export default function BookSetup({
  state,
  teachers,
  classes,
  students,
  books,
  classBooks,
  updateLegacyState,
  deps
}) {
  const {
    showModalAlert,
    showModalConfirm,
    notify
  } = deps;

  const COLORS = ['#FDE68A','#BFDBFE','#DDD6FE','#A7F3D0','#FBCFE8','#FECACA','#C7D2FE','#BBF7D0'];
  const GRADE_OPTIONS = ['고1', '고2', '고3'];
  const STANDARD_SUBJECT_OPTIONS = (state.standardUnitSubjects || []).map(subject => subject.label);
  const SUBJECT_OPTIONS = [...new Set(STANDARD_SUBJECT_OPTIONS)];
  const BOOK_TYPE_OPTIONS = [
    { value: 'standard', label: '일반 교재' },
    { value: 'exam_chapter', label: '시험대비 챕터 교재' }
  ];

  const isAdmin = state.currentTeacher?.role === 'admin';
  const btnClass = isAdmin ? 'btn-admin' : 'btn-teacher';

  // State
  const [bookSetupAccordion, setBookSetupAccordion] = useState({ manage: true, unit: false, assign: false });
  const [formBook, setFormBook] = useState({ id: '', title: '', subject: '', grade: '', publisher: '', active: true, bookType: 'standard', chapterCount: '10' });
  const [bulkUnitText, setBulkUnitText] = useState('');
  
  // Local temporary edits for book units to avoid layout flickering/focus loss on change
  const [localTempUnits, setLocalTempUnits] = useState({ bookId: '', bookType: '', rows: {} });

  // Resolve derived lists
  const availableClasses = useMemo(() => {
    return isAdmin ? classes : classes.filter(c => c.teacherId === state.currentTeacher.id);
  }, [classes, state.currentTeacher, isAdmin]);

  const activeBooks = useMemo(() => {
    return books.filter(b => !b.archived).sort((a, b) => String(a.title).localeCompare(String(b.title), 'ko'));
  }, [books]);

  const archivedBooks = useMemo(() => {
    return books.filter(b => b.archived).sort((a, b) => String(a.title).localeCompare(String(b.title), 'ko'));
  }, [books]);

  const selectedBookForUnits = useMemo(() => {
    return books.find(b => b.id === state.selectedBookManageId) || null;
  }, [books, state.selectedBookManageId]);

  const standardSubject = useMemo(() => {
    if (!selectedBookForUnits) return null;
    return state.standardUnitSubjects.find(s => s.label === selectedBookForUnits.subject) || state.standardUnitSubjects.find(s => s.code === selectedBookForUnits.subject) || null;
  }, [selectedBookForUnits, state.standardUnitSubjects]);

  const activeStandardUnits = useMemo(() => {
    return standardSubject?.units?.filter(unit => unit.active !== false) || [];
  }, [standardSubject]);

  // Helpers
  const uid = () => Math.random().toString(36).slice(2, 10);
  const pastel = (index) => COLORS[index % COLORS.length];

  const teacherNameById = (id) => {
    return teachers.find(t => t.id === id)?.name || '-';
  };

  const classById = (id) => {
    return classes.find(c => c.id === id) || null;
  };

  const bookById = (id) => {
    return books.find(b => b.id === id) || null;
  };

  const standardUnitNames = (ids = []) => {
    if (!state.standardUnitSubjects) return [];
    const mapping = {};
    state.standardUnitSubjects.forEach(subj => {
      subj.units.forEach(unit => {
        mapping[unit.id] = unit.label;
      });
    });
    return ids.map(id => mapping[id]).filter(Boolean);
  };

  const displayUnitName = (unit, book) => {
    if (book?.bookType === 'exam_chapter') return unit?.name || '';
    const linkedNames = standardUnitNames(unit?.standardUnitIds || []);
    return linkedNames.length ? linkedNames.join(', ') : (unit?.name || '');
  };

  const bookUnits = (book) => {
    return sortBookUnits(book).map(unit => ({
      ...unit,
      name: displayUnitName(unit, book)
    }));
  };

  const rawBookUnits = (book) => {
    return sortBookUnits(book);
  };

  const assignedBooksForClass = (classId) => {
    return classBooks
      .filter(x => x.classId === classId && x.active !== false && x.status === 'active')
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
      .map(x => ({ link: x, book: bookById(x.bookId) }))
      .filter(x => x.book && !x.book.archived);
  };

  const completedBooksForClass = (classId) => {
    return classBooks
      .filter(x => x.classId === classId && x.active !== false && x.status === 'completed')
      .sort((a, b) => {
        const timeA = a.completedAt?.toDate?.()?.getTime() || new Date(a.completedAt).getTime() || 0;
        const timeB = b.completedAt?.toDate?.()?.getTime() || new Date(b.completedAt).getTime() || 0;
        return timeB - timeA;
      })
      .map(x => ({ link: x, book: bookById(x.bookId) }))
      .filter(x => x.book);
  };

  const formatCompletedDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate?.() || new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  };

  const stripBookSubjectFromTitle = (subject, title) => {
    const cleanSubject = String(subject || '').trim();
    const cleanTitle = String(title || '').trim();
    if (!cleanSubject) return cleanTitle;
    if (cleanTitle === cleanSubject) return '';
    const prefixPattern = new RegExp(`^${cleanSubject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s_-]+`);
    return cleanTitle.replace(prefixPattern, '').trim();
  };

  const composeBookTitle = (subject, titleBase) => {
    const cleanSubject = String(subject || '').trim();
    const cleanBase = String(titleBase || '').trim();
    return [cleanSubject, cleanBase].filter(Boolean).join(' ');
  };

  // Sync title on subject changes
  const handleSubjectChange = (subjectVal) => {
    const base = stripBookSubjectFromTitle(formBook.subject, formBook.title);
    setFormBook(prev => ({
      ...prev,
      subject: subjectVal,
      title: composeBookTitle(subjectVal, base)
    }));
  };

  const handleTitleBaseChange = (baseVal) => {
    setFormBook(prev => ({
      ...prev,
      title: composeBookTitle(prev.subject, baseVal)
    }));
  };

  // 1. Book Asset CRUD
  const handleSaveBook = async () => {
    const { refs } = await getFirebaseService();
    const f = formBook;
    if (!f.subject) {
      showModalAlert('수학 교과목을 선택해주세요.');
      return;
    }
    const titleBase = stripBookSubjectFromTitle(f.subject, f.title);
    if (!titleBase) {
      showModalAlert('교재명을 입력해주세요.');
      return;
    }
    const payload = {
      title: composeBookTitle(f.subject, titleBase),
      subject: f.subject,
      grade: f.grade,
      publisher: '',
      active: f.active !== false,
      bookType: f.bookType || 'standard',
      chapterCount: f.bookType === 'exam_chapter'
        ? Math.max(1, Math.min(40, Number(f.chapterCount || 10) || 10))
        : ''
    };

    if (f.id) {
      await updateDoc(doc(refs.books, f.id), { ...payload, updatedAt: serverTimestamp() });
      notify('교재 수정 완료');
    } else {
      await addDoc(refs.books, { ...payload, units: [], archived: false, createdAt: serverTimestamp() });
      notify('교재 생성 완료');
    }

    setFormBook({ id: '', title: '', subject: '', grade: '', publisher: '', active: true, bookType: 'standard', chapterCount: '10' });
  };

  const handleEditBookClick = (b) => {
    setFormBook({
      id: b.id,
      title: b.title || '',
      subject: b.subject || '',
      grade: b.grade || '',
      publisher: b.publisher || '',
      active: b.active !== false,
      bookType: b.bookType || 'standard',
      chapterCount: b.chapterCount || '10'
    });
    updateLegacyState({ selectedBookManageId: b.id });
    setBookSetupAccordion(prev => ({ ...prev, manage: true }));
  };

  const handleCloneBook = async (bookId) => {
    const { refs } = await getFirebaseService();
    const source = bookById(bookId);
    if (!source) return;
    await addDoc(refs.books, {
      title: source.title + ' 복제본',
      subject: source.subject,
      grade: source.grade,
      publisher: '',
      active: true,
      archived: false,
      units: (source.units || []).map(u => ({ ...u, id: uid() })),
      createdAt: serverTimestamp()
    });
    notify('교재 복제 완료');
  };

  const handleToggleBookArchive = async (bookId, archived) => {
    const { db } = await getFirebaseService();
    await updateDoc(doc(db, COLLECTION_NAMES.books, bookId), { archived: !archived, updatedAt: serverTimestamp() });
    notify(archived ? '교재 복구 완료' : '교재 보관 완료');
  };

  const handleRemoveBook = async (bookId) => {
    const { db } = await getFirebaseService();
    const b = bookById(bookId);
    if (!b) return;
    const ok = await showModalConfirm(`교재 '${b.title}' 데이터를 영구 삭제하시겠습니까?\n이 자산은 완전히 제거됩니다.`);
    if (!ok) return;
    
    // Check if it is assigned to any class
    const inUse = classBooks.some(cb => cb.bookId === bookId && cb.active !== false);
    if (inUse) {
      showModalAlert('이 교재가 학급에 배정되어 사용 중입니다.\n반 배정 설정에서 먼저 해제한 후 삭제해주세요.');
      return;
    }

    await deleteDoc(doc(db, COLLECTION_NAMES.books, bookId));
    notify('교재 영구 삭제 완료');
  };

  // 2. Unit Mapping Management
  // Init/sync local edits whenever selected book changes
  useEffect(() => {
    if (!selectedBookForUnits) {
      setLocalTempUnits({ bookId: '', bookType: '', rows: {} });
      return;
    }

    const type = selectedBookForUnits.bookType || 'standard';
    const initialRows = {};

    if (type === 'exam_chapter') {
      const existingChapters = [...(selectedBookForUnits.units || [])].sort((a, b) => Number(a.start || 0) - Number(b.start || 0));
      const count = Math.max(1, Math.min(40, Number(selectedBookForUnits.chapterCount || existingChapters.length || 10) || 10));
      const rowsList = Array.from({ length: Math.max(count, existingChapters.length) }, (_, index) => {
        const unit = existingChapters[index] || {};
        return {
          chapterName: unit.name || `챕터 ${index + 1}`,
          start: unit.start || '',
          end: unit.end || '',
          standardUnitIds: unit.standardUnitIds || []
        };
      });
      setLocalTempUnits({
        bookId: selectedBookForUnits.id,
        bookType: 'exam_chapter',
        rows: rowsList // Array for chapter rows
      });
    } else {
      // standard unit map
      const rawUnits = [...(selectedBookForUnits.units || [])].sort((a, b) => Number(a.start || 0) - Number(b.start || 0));
      activeStandardUnits.forEach(unit => {
        const linkedUnit = rawUnits.find(bookUnit => (bookUnit.standardUnitIds || []).includes(unit.id));
        const linkedIds = linkedUnit?.standardUnitIds || [];
        const firstLinkedId = linkedIds[0];
        const lastLinkedId = linkedIds[linkedIds.length - 1];
        initialRows[unit.id] = {
          unitName: linkedUnit?.name || '',
          start: firstLinkedId === unit.id ? linkedUnit?.start || '' : '',
          end: lastLinkedId === unit.id ? linkedUnit?.end || '' : ''
        };
      });
      setLocalTempUnits({
        bookId: selectedBookForUnits.id,
        bookType: 'standard',
        rows: initialRows
      });
    }
  }, [state.selectedBookManageId, selectedBookForUnits, activeStandardUnits]);

  const handleLocalUnitRowChange = (unitId, field, value) => {
    setLocalTempUnits(prev => {
      if (prev.bookType === 'exam_chapter') return prev; // handled separately
      return {
        ...prev,
        rows: {
          ...prev.rows,
          [unitId]: {
            ...prev.rows[unitId],
            [field]: value
          }
        }
      };
    });
  };

  const handleLocalChapterRowChange = (index, field, value) => {
    setLocalTempUnits(prev => {
      if (prev.bookType !== 'exam_chapter' || !Array.isArray(prev.rows)) return prev;
      const nextRows = [...prev.rows];
      nextRows[index] = {
        ...nextRows[index],
        [field]: value
      };
      return { ...prev, rows: nextRows };
    });
  };

  const handleLocalChapterStandardUnitToggle = (index, standardId, checked) => {
    setLocalTempUnits(prev => {
      if (prev.bookType !== 'exam_chapter' || !Array.isArray(prev.rows)) return prev;
      const nextRows = [...prev.rows];
      const currentIds = new Set(nextRows[index].standardUnitIds || []);
      if (checked) currentIds.add(standardId);
      else currentIds.delete(standardId);
      nextRows[index] = {
        ...nextRows[index],
        standardUnitIds: [...currentIds]
      };
      return { ...prev, rows: nextRows };
    });
  };

  const handleAllChapterStandardUnitToggle = (standardId, checked) => {
    setLocalTempUnits(prev => {
      if (prev.bookType !== 'exam_chapter' || !Array.isArray(prev.rows)) return prev;
      const nextRows = prev.rows.map(row => {
        const currentIds = new Set(row.standardUnitIds || []);
        if (checked) currentIds.add(standardId);
        else currentIds.delete(standardId);
        return { ...row, standardUnitIds: [...currentIds] };
      });
      return { ...prev, rows: nextRows };
    });
  };

  const handleSaveUnitTable = async () => {
    const { db } = await getFirebaseService();
    if (!selectedBookForUnits) return;
    const currentUnits = rawBookUnits(selectedBookForUnits);

    if (selectedBookForUnits.bookType === 'exam_chapter') {
      const rows = localTempUnits.rows;
      if (!Array.isArray(rows) || rows.length === 0) return;
      const units = [];

      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        const defaultName = `챕터 ${index + 1}`;
        const hasInput = row.start || row.end || row.standardUnitIds?.length || (row.chapterName && row.chapterName.trim() !== defaultName);
        if (!hasInput) continue;
        const name = row.chapterName || defaultName;
        const start = Number(row.start);
        const end = Number(row.end);
        if (!row.start || !row.end || Number.isNaN(start) || Number.isNaN(end) || start < 1 || end < start) {
          showModalAlert(`"${name}"의 시작쪽과 끝쪽을 올바르게 입력해주세요.`);
          return;
        }
        if (!row.standardUnitIds?.length) {
          showModalAlert(`"${name}"에 연결할 시험범위 표준소단원을 하나 이상 선택해주세요.`);
          return;
        }
        const existing = currentUnits.find(unit => String(unit.name || '') === name);
        units.push({
          id: existing?.id || uid(),
          name,
          standardUnitIds: row.standardUnitIds,
          start,
          end,
          color: existing?.color || pastel(index),
          visibleToStudent: existing?.visibleToStudent !== false
        });
      }

      if (!units.length) {
        showModalAlert('저장할 챕터 정보를 입력해주세요.');
        return;
      }
      const sortedUnits = [...units].sort((a, b) => Number(a.start) - Number(b.start));
      for (let i = 1; i < sortedUnits.length; i++) {
        if (Number(sortedUnits[i - 1].end) >= Number(sortedUnits[i].start)) {
          showModalAlert(`"${sortedUnits[i - 1].name}" 챕터와 "${sortedUnits[i].name}" 챕터의 페이지가 겹칩니다.`);
          return;
        }
      }

      await updateDoc(doc(db, COLLECTION_NAMES.books, selectedBookForUnits.id), { units, updatedAt: serverTimestamp() });
      notify('시험대비 챕터표 저장 완료');
      return;
    }

    // standard table mapping
    const rows = activeStandardUnits.map(unit => {
      const tempRow = localTempUnits.rows[unit.id] || {};
      return {
        standardUnitId: unit.id,
        standardLabel: unit.label,
        unitName: (tempRow.unitName || '').trim(),
        startText: (tempRow.start || '').trim(),
        endText: (tempRow.end || '').trim()
      };
    });

    const groups = [];
    let currentGroup = null;

    const flushGroup = () => {
      if (!currentGroup) return;
      groups.push(currentGroup);
      currentGroup = null;
    };

    for (const row of rows) {
      const hasInput = row.unitName || row.startText || row.endText;
      if (!hasInput) {
        flushGroup();
        continue;
      }
      if (!row.unitName) {
        showModalAlert('입력한 행에는 소단원명을 모두 적어주세요.');
        return;
      }
      if (!currentGroup || currentGroup.name !== row.unitName) {
        flushGroup();
        currentGroup = { name: row.unitName, rows: [] };
      }
      currentGroup.rows.push(row);
    }
    flushGroup();

    if (!groups.length) {
      showModalAlert('저장할 단원 정보를 입력해주세요.');
      return;
    }

    const units = [];
    for (let index = 0; index < groups.length; index++) {
      const group = groups[index];
      const startText = group.rows.find(row => row.startText)?.startText || '';
      const endText = [...group.rows].reverse().find(row => row.endText)?.endText || '';
      const start = Number(startText);
      const end = Number(endText);
      if (!startText || !endText || Number.isNaN(start) || Number.isNaN(end)) {
        showModalAlert(`"${group.name}" 단원의 시작쪽과 끝쪽을 입력해주세요.`);
        return;
      }
      if (start < 1 || end < start) {
        showModalAlert(`"${group.name}" 단원의 페이지 범위를 확인해주세요.`);
        return;
      }
      const standardUnitIds = group.rows.map(row => row.standardUnitId).filter(Boolean);
      const existing = currentUnits.find(unit => {
        const prevIds = unit.standardUnitIds || [];
        return prevIds.length === standardUnitIds.length && prevIds.every((id, idx) => id === standardUnitIds[idx]);
      });
      units.push({
        id: existing?.id || uid(),
        name: group.name,
        standardUnitIds,
        start,
        end,
        color: existing?.color || pastel(index),
        visibleToStudent: existing?.visibleToStudent !== false
      });
    }

    const sortedUnits = [...units].sort((a, b) => Number(a.start) - Number(b.start));
    for (let i = 1; i < sortedUnits.length; i++) {
      if (Number(sortedUnits[i - 1].end) >= Number(sortedUnits[i].start)) {
        showModalAlert(`"${sortedUnits[i - 1].name}" 단원과 "${sortedUnits[i].name}" 단원의 페이지가 겹칩니다.`);
        return;
      }
    }

    await updateDoc(doc(db, COLLECTION_NAMES.books, selectedBookForUnits.id), { units, updatedAt: serverTimestamp() });
    notify('단원 표 저장 완료');
  };

  const handleToggleUnitStudentVisible = async (bookId, unitId) => {
    const { db } = await getFirebaseService();
    const book = bookById(bookId);
    if (!book) return;
    const units = rawBookUnits(book).map(unit => {
      if (unit.id !== unitId) return unit;
      return {
        ...unit,
        visibleToStudent: unit.visibleToStudent === false
      };
    });
    await updateDoc(doc(db, COLLECTION_NAMES.books, book.id), { units, updatedAt: serverTimestamp() });
    notify('공개 여부를 변경했습니다.');
  };

  const handleSaveUnitBulk = async () => {
    const { db } = await getFirebaseService();
    if (!selectedBookForUnits) return;
    const lines = String(bulkUnitText || '').split('\n').map(v => v.trim()).filter(Boolean);
    if (!lines.length) {
      showModalAlert('단원 범위 텍스트를 입력해주세요.');
      return;
    }
    const next = [...rawBookUnits(selectedBookForUnits)];
    for (const line of lines) {
      const [name, s, e] = line.split('/').map(v => v.trim());
      const start = Number(s), end = Number(e);
      if (!name || isNaN(start) || isNaN(end) || end < start) continue;
      const overlap = next.some(u => !(Number(u.end) < start || Number(u.start) > end));
      if (overlap) continue;
      next.push({ id: uid(), name, start, end, color: pastel(next.length), visibleToStudent: true });
    }
    await updateDoc(doc(db, COLLECTION_NAMES.books, selectedBookForUnits.id), { units: next, updatedAt: serverTimestamp() });
    setBulkUnitText('');
    notify('일괄 붙여넣기 단원 등록 완료');
  };

  // 3. Class Assignment CRUD
  const handleAssignBook = async () => {
    const { refs } = await getFirebaseService();
    const classId = state.assigningClassId;
    const bookId = state.selectedBookManageId;
    if (!classId || !bookId) {
      showModalAlert('반과 교재를 선택해주세요.');
      return;
    }
    const exists = classBooks.find(x => x.classId === classId && x.bookId === bookId && x.active !== false && x.status === 'active');
    if (exists) {
      showModalAlert('이미 진행 중인 교재입니다.');
      return;
    }
    const completed = classBooks.find(x => x.classId === classId && x.bookId === bookId && x.active !== false && x.status === 'completed');
    if (completed) {
      showModalAlert('이미 완료된 이력에 존재하는 교재입니다.\n아래 완료 이력 목록에서 [다시 진행] 버튼을 클릭해 주세요.');
      return;
    }
    const order = assignedBooksForClass(classId).length + 1;
    await addDoc(refs.classBooks, { classId, bookId, order, main: order === 1, active: true, status: 'active', createdAt: serverTimestamp() });
    notify('반별 교재 배정 완료');
  };

  const handleCompleteAssign = async (linkId) => {
    const { db } = await getFirebaseService();
    const ok = await showModalConfirm('이 반에서 해당 교재를 진행 종료할까요?\n학생 화면과 점검 목록에서는 제거되고, 완료 이력에 보존됩니다.', '교재 진행 종료');
    if (!ok) return;
    await updateDoc(doc(db, COLLECTION_NAMES.classBooks, linkId), { status: 'completed', completedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    notify('교재 완료 처리 완료');
  };

  const handleReactivateAssign = async (linkId) => {
    const { db } = await getFirebaseService();
    const link = classBooks.find(x => x.id === linkId);
    if (!link) return;
    const activeDuplicate = classBooks.find(x => x.id !== linkId && x.classId === link.classId && x.bookId === link.bookId && x.active !== false && x.status === 'active');
    if (activeDuplicate) {
      showModalAlert('이미 동일한 교재가 이 반에 배정되어 진행 중입니다.');
      return;
    }
    const order = assignedBooksForClass(link.classId).length + 1;
    await updateDoc(doc(db, COLLECTION_NAMES.classBooks, linkId), { status: 'active', order, main: order === 1, completedAt: null, updatedAt: serverTimestamp() });
    notify('교재 진행 재개 완료');
  };

  const handleRemoveAssign = async (linkId) => {
    const { db } = await getFirebaseService();
    const ok = await showModalConfirm('이 반과 교재의 연결 정보를 삭제하시겠습니까?\n이전 점검 기록 자체는 보존되지만, 완료 이력 목록에서도 사라집니다.', '배정 삭제');
    if (!ok) return;
    await updateDoc(doc(db, COLLECTION_NAMES.classBooks, linkId), { active: false, updatedAt: serverTimestamp() });
    notify('배정 삭제 완료');
  };

  const handleMoveAssign = async (linkId, dir) => {
    const { db } = await getFirebaseService();
    const link = classBooks.find(x => x.id === linkId);
    if (!link) return;
    const list = assignedBooksForClass(link.classId);
    const idx = list.findIndex(x => x.link.id === linkId);
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || targetIdx < 0 || targetIdx >= list.length) return;
    const currentOrder = list[idx].link.order;
    const targetOrder = list[targetIdx].link.order;
    
    const batch = writeBatch(db);
    batch.update(doc(db, COLLECTION_NAMES.classBooks, list[idx].link.id), { order: targetOrder, updatedAt: serverTimestamp() });
    batch.update(doc(db, COLLECTION_NAMES.classBooks, list[targetIdx].link.id), { order: currentOrder, updatedAt: serverTimestamp() });
    await batch.commit();
  };

  // Chapter common checked mapping helpers
  const examCommonStandardIds = useMemo(() => {
    if (!selectedBookForUnits || selectedBookForUnits.bookType !== 'exam_chapter' || !Array.isArray(localTempUnits.rows)) return new Set();
    const rows = localTempUnits.rows;
    return new Set(
      activeStandardUnits
        .filter(unit => rows.length && rows.every(row => (row.standardUnitIds || []).includes(unit.id)))
        .map(unit => unit.id)
    );
  }, [selectedBookForUnits, localTempUnits.rows, activeStandardUnits]);

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-20 pt-4">
      {/* Accordion 1: 교재 자산 관리 */}
      <AccordionItem
        id="manage"
        title="1. 교재 자산 관리"
        icon="fa-book-open"
        colorClass="bg-violet-500/10 text-violet-400 border border-violet-500/20"
        isOpen={bookSetupAccordion.manage}
        onToggle={() => setBookSetupAccordion(prev => ({ ...prev, manage: !prev.manage }))}
      >
        <div className="space-y-4 text-slate-200">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-slate-400">교재 유형</span>
            <BtnSelect
              id="bookType"
              options={BOOK_TYPE_OPTIONS}
              selectedValue={formBook.bookType}
              onChange={(val) => setFormBook(prev => ({ ...prev, bookType: val, chapterCount: val === 'exam_chapter' ? '10' : '' }))}
              placeholder="교재 유형 선택"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-slate-400">수학 교과목 선택</span>
              <BtnSelect
                id="bookSubject"
                options={SUBJECT_OPTIONS.map(s => ({ value: s, label: s }))}
                selectedValue={formBook.subject}
                onChange={handleSubjectChange}
                placeholder="수학 교과목 선택"
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-slate-400">대상 학년</span>
              <BtnSelect
                id="bookGrade"
                options={GRADE_OPTIONS.map(g => ({ value: g, label: g }))}
                selectedValue={formBook.grade}
                onChange={(val) => setFormBook(prev => ({ ...prev, grade: val }))}
                placeholder="학년 선택"
              />
            </div>
          </div>

          <div className="block text-xs font-bold text-slate-400">
            <span>교재 이름</span>
            <div className="mt-1.5 grid grid-cols-[minmax(120px,0.42fr)_1fr] gap-2">
              <input
                className="w-full border border-slate-800 rounded-xl p-3 bg-slate-955 text-xs text-cyan-250 font-black focus:outline-none select-none"
                value={formBook.subject || '교과목 먼저 선택'}
                readOnly
              />
              <input
                id="bookTitleBase"
                className="w-full border border-slate-800 rounded-xl p-3 bg-slate-900/40 text-xs text-slate-200 focus:outline-none focus:ring-2 ring-violet-500/20"
                placeholder="예: 블랙라벨, RPM, 쎈"
                value={stripBookSubjectFromTitle(formBook.subject, formBook.title)}
                onChange={(e) => handleTitleBaseChange(e.target.value)}
              />
            </div>
          </div>

          {formBook.bookType === 'exam_chapter' && (
            <label className="block text-xs font-bold text-slate-400">
              챕터 수
              <input
                id="bookChapterCount"
                type="number"
                min="1"
                max="40"
                className="mt-1.5 w-32 border border-slate-800 rounded-xl p-3 bg-slate-900/40 text-xs text-slate-200 focus:outline-none focus:ring-2 ring-violet-500/20"
                value={formBook.chapterCount}
                onChange={(e) => setFormBook(prev => ({ ...prev, chapterCount: e.target.value.replace(/\D/g, '').slice(0, 2) }))}
              />
              <span className="ml-2 text-[10px] font-medium text-slate-500">챕터별 난이도 상승형 시험대비 교재에 사용합니다.</span>
            </label>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSaveBook}
              className={`${btnClass} rounded-xl px-4 py-2.5 text-xs font-extrabold text-white hover:opacity-90`}
              style={{ cursor: 'pointer' }}
            >
              {formBook.id ? '교재 수정 반영' : '신규 교재 생성'}
            </button>
            <button
              type="button"
              onClick={() => setFormBook({ id: '', title: '', subject: '', grade: '', publisher: '', active: true, bookType: 'standard', chapterCount: '10' })}
              className="ghost-button border border-slate-800 text-slate-400 bg-slate-900/40 hover:bg-slate-900/20 rounded-xl px-4 py-2.5 text-xs"
              style={{ cursor: 'pointer' }}
            >
              초기화
            </button>
          </div>

          {/* Active books asset list */}
          <div className="border-t border-slate-800 pt-4 mt-2">
            <span className="text-xs font-bold text-slate-500 block mb-3">사용 중인 교재 자산 ({activeBooks.length}권):</span>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 max-h-[500px] overflow-y-auto mini-scroll pr-1 mb-4">
              {activeBooks.map(b => (
                <div key={b.id} className="rounded-xl border border-slate-800 bg-slate-900/40 px-3.5 py-3 shadow-sm hover:border-violet-500/40 transition-colors flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start gap-2 text-xs">
                      <div className="font-black text-slate-200 leading-snug break-all">{b.title}</div>
                      <span className="text-[9px] font-black text-emerald-400 bg-emerald-950/40 border border-emerald-900 px-1.5 py-0.5 rounded shrink-0">활성</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1.5 font-bold">{b.subject || '-'} &middot; {b.grade || '-'}</div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => handleEditBookClick(b)} className="rounded bg-slate-950 border border-slate-800 hover:bg-slate-800/50 text-slate-400 px-2 py-1.5 text-[10px] font-bold">수정</button>
                    <button type="button" onClick={() => handleCloneBook(b.id)} className="rounded bg-slate-950 border border-slate-800 hover:bg-slate-800/50 text-slate-400 px-2 py-1.5 text-[10px] font-bold">복제</button>
                    <button type="button" onClick={() => handleToggleBookArchive(b.id, !!b.archived)} className="rounded bg-rose-950/60 border border-rose-900 text-rose-400 hover:bg-rose-900 hover:text-white px-2 py-1.5 text-[10px] font-bold transition-colors">보관</button>
                    <button type="button" onClick={() => updateLegacyState({ selectedBookManageId: b.id })} className="rounded bg-cyan-950 border border-cyan-800 text-cyan-400 hover:bg-cyan-500 hover:text-white px-2 py-1.5 text-[10px] font-bold transition-colors">단원설정</button>
                  </div>
                </div>
              ))}
              {activeBooks.length === 0 && <div className="text-xs text-slate-400 py-6 text-center col-span-full">등록된 교재가 존재하지 않습니다.</div>}
            </div>

            {/* Archived Books collapsible details */}
            <details className="group border border-slate-800 rounded-xl bg-slate-900/20 p-3 transition-all duration-200">
              <summary className="flex items-center justify-between cursor-pointer font-bold text-slate-500 text-xs list-none select-none">
                <span>📦 보관함 교재 ({archivedBooks.length}권)</span>
                <span className="transition-transform duration-200 group-open:rotate-180 text-[10px] text-slate-400">▼</span>
              </summary>
              <div className="mt-3.5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 max-h-[350px] overflow-y-auto mini-scroll pr-1">
                {archivedBooks.map(b => (
                  <div key={b.id} className="rounded-xl border border-slate-800 bg-slate-900/40 px-3.5 py-3 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2 text-xs">
                        <div className="font-black text-slate-400 leading-snug break-all">{b.title}</div>
                        <span className="text-[9px] font-black text-rose-400 bg-rose-950/40 border border-rose-900 px-1.5 py-0.5 rounded shrink-0">보관</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1.5 font-bold">{b.subject || '-'} &middot; {b.grade || '-'}</div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => handleToggleBookArchive(b.id, !!b.archived)} className="rounded bg-emerald-950 border border-emerald-900 text-emerald-400 hover:bg-emerald-500 hover:text-white px-2 py-1.5 text-[10px] font-bold transition-all">부활 (복구)</button>
                      <button type="button" onClick={() => handleRemoveBook(b.id)} className="rounded bg-rose-950 border border-rose-900 text-rose-400 hover:bg-rose-900 hover:text-white px-2 py-1.5 text-[10px] font-bold transition-all">영구 삭제</button>
                    </div>
                  </div>
                ))}
                {archivedBooks.length === 0 && <div className="text-[10px] text-slate-450 py-3 text-center col-span-full">보관함이 비어 있습니다.</div>}
              </div>
            </details>
          </div>
        </div>
      </AccordionItem>

      {/* Accordion 2: 단원 입력 및 페이지 맵 */}
      <AccordionItem
        id="unit"
        title="2. 단원 입력 및 페이지 맵"
        icon="fa-map"
        colorClass="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
        isOpen={bookSetupAccordion.unit}
        onToggle={() => setBookSetupAccordion(prev => ({ ...prev, unit: !prev.unit }))}
      >
        <div className="space-y-4 text-slate-200">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-slate-400">단원 설정을 진행할 교재 선택</span>
            <BtnSelect
              id="selectedBookManageId"
              options={activeBooks.map(b => ({ value: b.id, label: b.title }))}
              selectedValue={state.selectedBookManageId}
              onChange={(val) => updateLegacyState({ selectedBookManageId: val })}
              placeholder="선택 가능한 활성 교재 자산이 없습니다."
            />
          </div>

          {selectedBookForUnits && standardSubject && selectedBookForUnits.bookType === 'exam_chapter' ? (
            /* 1. Exam preparation layout style mapping */
            <div className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-4">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <div className="text-xs font-extrabold text-amber-200">시험대비 챕터 기준 페이지 맵</div>
                  <div className="text-[10px] text-slate-500 mt-1">챕터별로 난이도가 올라가는 자체 제작 교재용입니다. 각 챕터에 시험범위 표준소단원을 여러 개 연결할 수 있습니다.</div>
                </div>
                <span className="shrink-0 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-black text-amber-200">{standardSubject.label}</span>
              </div>
              
              <div className="overflow-x-auto mini-scroll">
                <div className="min-w-[920px]">
                  
                  {/* Select All Chapters checkbox item bar */}
                  <div className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                    <div className="mb-2 text-[10px] font-black text-amber-200">전 챕터 표준소단원 선택</div>
                    <div className="flex flex-wrap gap-1.5">
                      {activeStandardUnits.map(unit => (
                        <label key={unit.id} className={`cursor-pointer rounded-full border px-2 py-1 text-[10px] font-bold transition-colors ${examCommonStandardIds.has(unit.id) ? 'border-amber-300 bg-amber-300/20 text-amber-100' : 'border-slate-700 bg-slate-950/60 text-slate-400 hover:border-amber-500/60 hover:text-amber-200'}`}>
                          <input
                            type="checkbox"
                            className="mr-1 align-middle accent-amber-400"
                            checked={examCommonStandardIds.has(unit.id)}
                            onChange={(e) => handleAllChapterStandardUnitToggle(unit.id, e.target.checked)}
                          />
                          {unit.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-[0.7fr_1.8fr_0.45fr_0.45fr] gap-2 px-2 pb-2 text-[10px] font-black text-slate-500">
                    <div>챕터명</div>
                    <div>시험범위 표준소단원</div>
                    <div>시작쪽</div>
                    <div>끝쪽</div>
                  </div>

                  <div className="space-y-2">
                    {Array.isArray(localTempUnits.rows) && localTempUnits.rows.map((row, index) => {
                      const selectedIds = new Set(row.standardUnitIds || []);
                      return (
                        <div key={index} className="grid grid-cols-[0.7fr_1.8fr_0.45fr_0.45fr] gap-2 rounded-xl border border-slate-800 bg-slate-950/30 p-2">
                          <input
                            className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 outline-none focus:border-amber-500 focus:bg-slate-900 transition-colors"
                            placeholder={`챕터 ${index + 1}`}
                            value={row.chapterName}
                            onChange={(e) => handleLocalChapterRowChange(index, 'chapterName', e.target.value)}
                          />
                          <div className="flex flex-wrap gap-1.5 rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-2">
                            {activeStandardUnits.map(unit => (
                              <label key={unit.id} className={`cursor-pointer rounded-full border px-2 py-1 text-[10px] font-bold transition-colors ${selectedIds.has(unit.id) ? 'border-amber-400 bg-amber-400/15 text-amber-200' : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:border-amber-500/60 hover:text-amber-200'}`}>
                                <input
                                  type="checkbox"
                                  className="mr-1 align-middle accent-amber-400"
                                  checked={selectedIds.has(unit.id)}
                                  onChange={(e) => handleLocalChapterStandardUnitToggle(index, unit.id, e.target.checked)}
                                />
                                {unit.label}
                              </label>
                            ))}
                          </div>
                          <input
                            type="number"
                            min="1"
                            className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 outline-none focus:border-amber-500 focus:bg-slate-900 transition-colors"
                            placeholder="시작"
                            value={row.start}
                            onChange={(e) => handleLocalChapterRowChange(index, 'start', e.target.value)}
                          />
                          <input
                            type="number"
                            min="1"
                            className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 outline-none focus:border-amber-500 focus:bg-slate-900 transition-colors"
                            placeholder="끝"
                            value={row.end}
                            onChange={(e) => handleLocalChapterRowChange(index, 'end', e.target.value)}
                          />
                        </div>
                      );
                    })}
                  </div>

                </div>
              </div>
              <button
                type="button"
                onClick={handleSaveUnitTable}
                className="mt-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-4 py-2.5 text-xs transition-colors shadow-sm"
                style={{ cursor: 'pointer' }}
              >
                챕터표 저장
              </button>
            </div>
          ) : selectedBookForUnits && standardSubject ? (
            /* 2. Standard textbook unit mapping style table */
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-950/10 p-4">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <div className="text-xs font-extrabold text-cyan-200">표준소단원 기준 단원표</div>
                  <div className="text-[10px] text-slate-500 mt-1">교재 소단원명이 여러 표준소단원에 걸치면 같은 소단원명을 이어서 입력하고, 첫 행에는 시작쪽, 마지막 행에는 끝쪽을 입력하세요.</div>
                </div>
                <span className="shrink-0 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-[10px] font-black text-cyan-200">{standardSubject.label}</span>
              </div>
              
              <div className="overflow-x-auto mini-scroll">
                <div className="min-w-[760px]">
                  <div className="grid grid-cols-[1.25fr_1.15fr_0.55fr_0.55fr] gap-2 px-2 pb-2 text-[10px] font-black text-slate-500">
                    <div>소단원명</div>
                    <div>표준소단원</div>
                    <div>시작쪽</div>
                    <div>끝쪽</div>
                  </div>
                  
                  <div className="space-y-2">
                    {activeStandardUnits.map(unit => {
                      const tempRow = localTempUnits.rows[unit.id] || {};
                      return (
                        <div key={unit.id} className="grid grid-cols-[1.25fr_1.15fr_0.55fr_0.55fr] gap-2 rounded-xl border border-slate-800 bg-slate-955 p-2">
                          <input
                            className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-500 focus:bg-slate-900 transition-colors"
                            placeholder="예: 03 순열과 조합"
                            value={tempRow.unitName || ''}
                            onChange={(e) => handleLocalUnitRowChange(unit.id, 'unitName', e.target.value)}
                          />
                          <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs font-bold text-cyan-200 select-none">
                            {unit.label}
                          </div>
                          <input
                            type="number"
                            min="1"
                            className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-500 focus:bg-slate-900 transition-colors"
                            placeholder="시작"
                            value={tempRow.start || ''}
                            onChange={(e) => handleLocalUnitRowChange(unit.id, 'start', e.target.value)}
                          />
                          <input
                            type="number"
                            min="1"
                            className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-500 focus:bg-slate-900 transition-colors"
                            placeholder="끝"
                            value={tempRow.end || ''}
                            onChange={(e) => handleLocalUnitRowChange(unit.id, 'end', e.target.value)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSaveUnitTable}
                className="mt-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-extrabold px-4 py-2.5 text-xs transition-colors shadow-sm"
                style={{ cursor: 'pointer' }}
              >
                단원표 저장
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-850 bg-slate-950/20 px-4 py-8 text-center text-xs text-slate-500">
              교재를 선택하면 해당 수학 교과목의 표준소단원 표가 표시됩니다.
            </div>
          )}

          {/* Quick paste text bulk utility */}
          {selectedBookForUnits && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-4 mt-2">
              <div className="text-xs font-extrabold text-slate-300 mb-2">단원 일괄 붙여넣기 (빠른 대시보드 등록)</div>
              <div className="text-[10px] text-slate-500 mb-3">포맷: <code>단원명 / 시작쪽 / 끝쪽</code> (한 줄에 하나씩 입력, 예: 다항식의 연산 / 1 / 25)</div>
              <textarea
                className="w-full min-h-[80px] border border-slate-700 rounded-xl p-3 bg-slate-900/50 text-xs text-white leading-relaxed focus:outline-none focus:border-cyan-500 shadow-inner"
                placeholder="다항식의 연산 / 1 / 25&#10;나머지정리 / 26 / 50"
                value={bulkUnitText}
                onChange={(e) => setBulkUnitText(e.target.value)}
              />
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={handleSaveUnitBulk} className="rounded-lg bg-emerald-500/80 hover:bg-emerald-500 text-white font-bold px-3 py-2 text-xs transition-colors shadow-sm">단원 반영</button>
                <button type="button" onClick={() => setBulkUnitText('')} className="rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 px-3 py-2 text-xs transition-colors">지우기</button>
              </div>
            </div>
          )}

          {/* Textbook Map display */}
          {selectedBookForUnits && (
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/20 p-4 shadow-inner">
              <div className="text-xs font-extrabold text-slate-300 mb-3">{selectedBookForUnits.title} 단원 맵</div>
              {bookUnits(selectedBookForUnits).length ? (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                  {bookUnits(selectedBookForUnits).map(u => {
                    const visibleToStudent = u.visibleToStudent !== false;
                    return (
                      <div key={u.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 shadow-sm flex flex-col justify-between">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold text-slate-200 truncate" title={u.name}>{u.name}</div>
                            <div className="text-[10px] text-slate-500 mt-1 font-bold">{u.start}~{u.end}쪽 ({Number(u.end) - Number(u.start) + 1}p)</div>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black ${visibleToStudent ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-350' : 'border-slate-700 bg-slate-900 text-slate-500'}`}>
                            {visibleToStudent ? '공개' : '숨김'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleUnitStudentVisible(selectedBookForUnits.id, u.id)}
                          className="mt-3 w-full rounded-lg border border-slate-800 bg-slate-950/40 px-2 py-1.5 text-[10px] font-bold text-slate-400 hover:border-cyan-500/50 hover:text-cyan-300 transition-colors"
                        >
                          학생 화면 {visibleToStudent ? '숨기기' : '공개하기'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-700 p-5 text-center text-xs text-slate-500 mt-4">
                  단원 정보가 등록되어 있지 않습니다.
                </div>
              )}
            </div>
          )}
        </div>
      </AccordionItem>

      {/* Accordion 3: 반별 교재 배정 */}
      <AccordionItem
        id="assign"
        title="3. 반별 교재 배정"
        icon="fa-link"
        colorClass="bg-amber-500/10 text-amber-400 border border-amber-500/20"
        isOpen={bookSetupAccordion.assign}
        onToggle={() => setBookSetupAccordion(prev => ({ ...prev, assign: !prev.assign }))}
      >
        <div className="space-y-4 text-slate-200">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-slate-400">배정 대상 반 선택</span>
            <BtnSelect
              id="assigningClassId"
              options={availableClasses.map(c => ({ value: c.id, label: c.name }))}
              selectedValue={state.assigningClassId}
              onChange={(val) => updateLegacyState({ assigningClassId: val })}
              placeholder="선택할 반이 없습니다."
            />
          </div>

          <span className="text-xs font-bold text-slate-400 block mt-2">사용 가능한 교재 목록 (클릭 시 배정):</span>
          <div className="grid md:grid-cols-2 gap-3 max-h-48 overflow-y-auto mini-scroll pr-1 border border-slate-800 p-2.5 rounded-xl bg-slate-900/20 shadow-inner">
            {activeBooks.map(b => (
              <button
                key={b.id}
                type="button"
                onClick={() => updateLegacyState({ selectedBookManageId: b.id }, () => handleAssignBook())}
                className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5 text-left hover:border-violet-300 hover:bg-violet-950/20 transition-colors shadow-sm outline-none"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="font-black text-slate-200">{b.title}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 font-bold">{b.subject || '-'} &middot; {b.grade || '-'}</div>
                  </div>
                  <span className="text-[10px] text-slate-500 font-black bg-slate-800/50 px-2 py-0.5 rounded shrink-0">{bookUnits(b).length}단원</span>
                </div>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 mt-2">
            <span className="text-xs font-bold text-slate-400 block">현재 진행 중 교재 (정렬 조정):</span>
            <span className="text-[10px] font-black text-cyan-300">{assignedBooksForClass(state.assigningClassId).length}권 진행 중</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto mini-scroll pr-1">
            {assignedBooksForClass(state.assigningClassId).length ? (
              assignedBooksForClass(state.assigningClassId).map((x, idx) => (
                <div key={x.link.id} className="rounded-xl border border-slate-800 bg-slate-900/40 px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs shadow-sm">
                  <div className="min-w-0">
                    <div className="font-black text-slate-200">{idx + 1}. {x.book?.title}</div>
                    <div className="text-[10px] text-slate-550 mt-0.5 font-bold">{idx === 0 ? '메인 교재' : '부교재'} &middot; {x.book?.subject || '-'}</div>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end items-center gap-1.5">
                    <button type="button" onClick={() => handleMoveAssign(x.link.id, 'up')} className="rounded bg-slate-800/50 hover:bg-slate-700 border border-slate-800 px-2 py-1 text-[10px] font-black text-slate-500">▲</button>
                    <button type="button" onClick={() => handleMoveAssign(x.link.id, 'down')} className="rounded bg-slate-800/50 hover:bg-slate-700 border border-slate-800 px-2 py-1 text-[10px] font-black text-slate-500">▼</button>
                    <button type="button" onClick={() => handleCompleteAssign(x.link.id)} className="rounded border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-555 hover:text-white px-2 py-1 text-[10px] font-black text-emerald-300 transition-colors">진행 종료</button>
                    <button type="button" onClick={() => handleRemoveAssign(x.link.id)} className="rounded border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500 hover:text-white px-2 py-1 text-[10px] font-black text-rose-300 transition-colors">연결 삭제</button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/20 px-4 py-8 text-center text-xs font-bold text-slate-400">
                현재 반에 배정된 교재가 없습니다.
              </div>
            )}
          </div>

          {/* Completed books assign details */}
          <details className="group rounded-xl border border-slate-800 bg-slate-900/20 p-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-black text-slate-350 select-none">
              <span>완료된 교재 이력 ({completedBooksForClass(state.assigningClassId).length}권)</span>
              <span className="text-[10px] text-slate-550 transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="mt-3 space-y-2 max-h-44 overflow-y-auto mini-scroll pr-1">
              {completedBooksForClass(state.assigningClassId).length ? (
                completedBooksForClass(state.assigningClassId).map(x => (
                  <div key={x.link.id} className="rounded-xl border border-slate-800 bg-slate-950/40 px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs shadow-sm">
                    <div className="min-w-0">
                      <div className="font-black text-slate-400">{x.book?.title}</div>
                      <div className="text-[10px] text-slate-550 mt-0.5 font-bold">{x.book?.subject || '-'} &middot; {formatCompletedDate(x.link.completedAt) || '완료 처리됨'}</div>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end items-center gap-1.5">
                      <button type="button" onClick={() => handleReactivateAssign(x.link.id)} className="rounded border border-cyan-500/20 bg-cyan-500/10 hover:bg-cyan-500 hover:text-white px-2 py-1 text-[10px] font-black text-cyan-300 transition-colors">다시 진행</button>
                      <button type="button" onClick={() => handleRemoveAssign(x.link.id)} className="rounded border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500 hover:text-white px-2 py-1 text-[10px] font-black text-rose-300 transition-colors">연결 삭제</button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-800 bg-slate-955 px-4 py-6 text-center text-xs font-bold text-slate-500">
                  아직 완료 처리된 교재가 없습니다.
                </div>
              )}
            </div>
          </details>
        </div>
      </AccordionItem>
    </div>
  );
}
