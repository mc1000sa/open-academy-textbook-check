import React, { useState, useEffect } from 'react';
import { deleteDoc, doc, COLLECTION_NAMES } from '../services/firebaseService.js';
import InspectionWizardModal from './InspectionWizardModal.jsx';

export default function InspectionsContainer(props) {
  const {
    state,
    db,
    refs,
    teacherClasses,
    studentsForClass,
    assignedBooksForClass,
    bookById,
    unitsForRange,
    pagesInRange,
    missedPagesArrayInCurrentRange,
    inspectionsForStudent,
    fmtDate,
    classById,
    studentById,
    safe,
    bookUnits,
    buildCarryoverRows,
    calculateCarryoverRecoveryRate,
    pageResolutionKey,
    RUBRIC_ITEMS,
    remarkTemplates,
    updateLegacyState,
    showModalAlert,
    showModalConfirm,
    showModalPrompt
  } = props;

  // React 로컬 상태 관리 (드롭다운 바인딩)
  const [selectedClassId, setSelectedClassId] = useState(state.selectedInspectionClassId || '');
  const [selectedStudentId, setSelectedStudentId] = useState(state.selectedInspectionStudentId || '');
  const [selectedBookId, setSelectedBookId] = useState(state.selectedInspectionBookId || '');
  const [selectedDate, setSelectedDate] = useState(state.selectedDate || new Date().toISOString().slice(0, 10));

  // 모달 열림 여부
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Props 변경에 따른 로컬 상태 동기화 (외부 state가 변경되어 주입될 때)
  useEffect(() => {
    setSelectedClassId(state.selectedInspectionClassId || '');
  }, [state.selectedInspectionClassId]);

  useEffect(() => {
    setSelectedStudentId(state.selectedInspectionStudentId || '');
  }, [state.selectedInspectionStudentId]);

  useEffect(() => {
    setSelectedBookId(state.selectedInspectionBookId || '');
  }, [state.selectedInspectionBookId]);

  useEffect(() => {
    setSelectedDate(state.selectedDate || new Date().toISOString().slice(0, 10));
  }, [state.selectedDate]);

  // 반/학생/교재 필터 데이터 계산
  let classes = state.currentTeacher?.role === 'admin' ? state.classes : teacherClasses(state.currentTeacher?.id);
  const classSort = state.classSortType || 'name';
  if (classSort === 'grade') {
    const GRADE_WEIGHTS = { '고1': 1, '고2': 2, '고3': 3 };
    classes = [...classes].sort((a, b) => {
      const wA = GRADE_WEIGHTS[a.grade] || 99;
      const wB = GRADE_WEIGHTS[b.grade] || 99;
      if (wA !== wB) return wA - wB;
      return String(a.name || '').localeCompare(String(b.name || ''), 'ko');
    });
  } else {
    classes = [...classes].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko'));
  }

  const students = studentsForClass(selectedClassId);
  const assigned = assignedBooksForClass(selectedClassId);
  const selectedBook = bookById(selectedBookId);
  const selectedClass = classById(selectedClassId);
  const selectedStudent = studentById(selectedStudentId);

  const isBookSelected = selectedClassId && selectedStudentId && selectedBookId;

  // 우측 자동 분석 영역 계산 데이터
  const isEditing = !!(state.editingInspectionId || state.selectedRangeStart || state.selectedRangeEnd);

  const latestInspection = isBookSelected
    ? [...state.inspections]
        .filter(r => r.studentId === selectedStudentId && r.bookId === selectedBookId && (!r.attendanceStatus || r.attendanceStatus === 'normal'))
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0]
    : null;

  const selectedRangeStart = isEditing
    ? (state.selectedRangeStart || '')
    : (latestInspection ? latestInspection.rangeStart || '' : '');

  const selectedRangeEnd = isEditing
    ? (state.selectedRangeEnd || '')
    : (latestInspection ? latestInspection.rangeEnd || '' : '');

  const units = selectedBook && selectedRangeStart && selectedRangeEnd 
    ? unitsForRange(selectedBook, selectedRangeStart, selectedRangeEnd) 
    : [];

  const totalPages = pagesInRange(selectedRangeStart, selectedRangeEnd);

  const missedPages = isEditing
    ? missedPagesArrayInCurrentRange()
    : (latestInspection ? latestInspection.missedPages || [] : []);

  const donePct = totalPages.length 
    ? Math.round(((totalPages.length - missedPages.length) / totalPages.length) * 100) 
    : 0;

  const carryoverRows = selectedStudentId && selectedBookId
    ? buildCarryoverRows({
        inspections: state.inspections,
        studentId: selectedStudentId,
        bookId: selectedBookId,
        editingInspectionId: state.editingInspectionId,
        currentDate: selectedDate
      })
    : [];
  const selectedCarryoverKeys = new Set(state.selectedCarryoverResolutionKeys || []);
  const carryoverRecovery = calculateCarryoverRecoveryRate(carryoverRows, selectedCarryoverKeys);

  // 반 선택 변경 핸들러
  const handleClassClick = (cid) => {
    setSelectedClassId(cid);
    setSelectedStudentId('');
    setSelectedBookId('');
    updateLegacyState({
      selectedInspectionClassId: cid,
      selectedInspectionStudentId: '',
      selectedInspectionBookId: ''
    });
  };

  // 학생 선택 변경 핸들러
  const handleStudentClick = (sid) => {
    setSelectedStudentId(sid);
    updateLegacyState({
      selectedInspectionStudentId: sid
    });
  };

  // 교재 선택 변경 핸들러
  const handleBookClick = (bid) => {
    setSelectedBookId(bid);
    updateLegacyState({
      selectedInspectionBookId: bid
    });
  };

  // 점검 기록 삭제 핸들러
  const handleDeleteInspection = async (id) => {
    const confirmed = await showModalConfirm('이 점검 기록을 정말 삭제하시겠습니까?', '점검 삭제');
    if (!confirmed) return;
    try {
      await deleteDoc(doc(db, COLLECTION_NAMES.inspections, id));
      
      // 만약 삭제하려는 기록이 현재 편집/수정 중인 기록이라면 상태를 리셋하여 부활/꼬임 방지
      if (state.editingInspectionId === id) {
        updateLegacyState({
          editingInspectionId: '',
          selectedRangeStart: '',
          selectedRangeEnd: '',
          missedPages: '',
          memo: '',
          rubricScores: { expression: null, grading: null, attitude: null, understanding: null, application: null },
          selectedCarryoverResolutionKeys: []
        });
      }

      showModalAlert('성공적으로 삭제되었습니다.', '성공');
    } catch (err) {
      console.error(err);
      showModalAlert('삭제하는 도중 오류가 발생했습니다: ' + err.message, '오류');
    }
  };

  // 점검 기록 수정 핸들러
  const handleEditInspection = (insp) => {
    updateLegacyState({
      editingInspectionId: insp.id,
      selectedInspectionClassId: insp.classId,
      selectedInspectionStudentId: insp.studentId,
      selectedInspectionBookId: insp.bookId,
      selectedDate: insp.date,
      selectedRangeStart: insp.rangeStart,
      selectedRangeEnd: insp.rangeEnd,
      missedPages: (insp.missedPages || []).join(','),
      memo: insp.memo || '',
      rubricScores: insp.rubricScores || { expression: null, grading: null, attitude: null, understanding: null, application: null },
      selectedCarryoverResolutionKeys: insp.carryoverResolutions || []
    });
    // 모달을 바로 열어줍니다.
    setIsModalOpen(true);
  };

  // 정렬 및 최근 기록 가공
  const sortKey = state.sortKey || 'date';
  const sortOrder = state.sortOrder || 'desc';

  const handleSort = (key) => {
    const newOrder = sortKey === key && sortOrder === 'asc' ? 'desc' : 'asc';
    updateLegacyState({ sortKey: key, sortOrder: newOrder });
  };

  const sortIndicator = (key) => {
    if (sortKey === key) {
      return sortOrder === 'asc' ? ' ▲' : ' ▼';
    }
    return ' ↕';
  };

  const filteredHistoryRows = state.inspections
    .filter(r => selectedStudent ? r.studentId === selectedStudent.id : true)
    .sort((a, b) => {
      let valA = a[sortKey];
      let valB = b[sortKey];

      if (sortKey === 'studentId') {
        valA = studentById(a.studentId)?.name || '';
        valB = studentById(b.studentId)?.name || '';
      } else if (sortKey === 'classId') {
        valA = classById(a.classId)?.name || '';
        valB = classById(b.classId)?.name || '';
      } else if (sortKey === 'bookId') {
        valA = bookById(a.bookId)?.title || '';
        valB = bookById(b.bookId)?.title || '';
      } else if (sortKey === 'completionRate') {
        valA = Number(a.completionRate || 0);
        valB = Number(b.completionRate || 0);
      }

      if (typeof valA === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB, 'ko') : valB.localeCompare(valA, 'ko');
      } else {
        const timeA = new Date(valA).getTime() || Number(valA || 0);
        const timeB = new Date(valB).getTime() || Number(valB || 0);
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }
    })
    .slice(0, 20);

  const unitColorText = (hex) => {
    const clean = String(hex || '').replace('#', '').trim();
    if (!/^[0-9a-fA-F]{6}$/.test(clean)) return '#0f172a';
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 150 ? '#0f172a' : '#ffffff';
  };

  return (
    <div className="space-y-6 text-slate-200">
      {/* 1. 상단 고정 타이틀 바 */}
      {isBookSelected && (
        <div style={{ position: 'sticky', top: '0px', zIndex: 40 }} className="rounded-2xl border border-blue-500/30 bg-slate-950 p-3.5 shadow-2xl flex items-center justify-between">
          <div className="text-sm font-black text-white flex flex-wrap items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" style={{ animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }} />
            <span className="text-slate-300">{selectedClass?.name}</span>
            <span className="text-slate-600 font-bold">&middot;</span>
            <span className="text-blue-400 font-extrabold">{selectedStudent?.name} 학생</span>
            <span className="text-slate-600 font-bold">&middot;</span>
            <span className="text-slate-400 font-medium text-xs">{selectedBook?.title}</span>
          </div>
          <div className="text-[10px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full shrink-0">점검 대기 중</div>
        </div>
      )}

      {/* 2. 메인 점검 뷰 */}
      <div className="w-full">
        {/* 좌측 입력 설정 카드 */}
        <article className="card-3d rounded-2xl p-5 md:p-6 bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between gap-3 mb-5">
            <h3 className="text-base font-extrabold text-white">학생별 교재점검</h3>
            <span className="text-[10px] text-slate-400 font-bold">{state.editingInspectionId ? '기존 기록 수정 중' : '강사용 입력 화면'}</span>
          </div>

          <div className="grid md:grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
            {/* 반 선택 */}
            <div className="text-xs font-bold text-slate-400 flex flex-col justify-start">
              <div className="flex items-center justify-between mb-2 min-h-[26px]">
                <span>반 선택</span>
                <div className="filter-switch flex gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                  <span
                    className={`filter-switch-item text-[10px] px-2 py-1 rounded cursor-pointer transition ${(!state.classSortType || state.classSortType === 'name') ? 'active bg-blue-600 text-white font-extrabold' : 'text-slate-500'}`}
                    onClick={() => updateLegacyState({ classSortType: 'name' })}
                  >이름순</span>
                  <span
                    className={`filter-switch-item text-[10px] px-2 py-1 rounded cursor-pointer transition ${state.classSortType === 'grade' ? 'active bg-blue-600 text-white font-extrabold' : 'text-slate-500'}`}
                    onClick={() => updateLegacyState({ classSortType: 'grade' })}
                  >학년별</span>
                </div>
              </div>
              <div className="choice-grid mt-2" id="selectedInspectionClassId">
                {classes.map(c => {
                  const active = c.id === selectedClassId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleClassClick(c.id)}
                      className={`choice-button btn-choice-teacher ${active ? 'selected' : ''}`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
 
             {/* 구분선 */}
             <div className="hidden md:block relative w-[1px] self-stretch mx-2">
               <div className="absolute inset-0 bg-gradient-to-b from-blue-500/10 via-blue-500/40 to-blue-500/10"></div>
               <div className="absolute inset-0 bg-blue-500/30 blur-[6px] -translate-x-[2.5px] w-[6px] rounded-full"></div>
             </div>
 
             {/* 학생 선택 */}
             <div className="text-xs font-bold text-slate-400 flex flex-col justify-start">
               <div className="flex items-center justify-between mb-2 min-h-[26px]">
                 <span>학생 선택</span>
               </div>
               {selectedClassId ? (
                 <div className="choice-grid" id="selectedInspectionStudentId">
                   {(() => {
                     const checkedStudentIds = new Set(
                       (state.inspections || [])
                         .filter(r => r.classId === selectedClassId && r.date === selectedDate)
                         .map(r => r.studentId)
                     );
                     return students.map(s => {
                       const active = s.id === selectedStudentId;
                       const isSaved = checkedStudentIds.has(s.id);
                       let btnClass = "";
                       if (active) {
                         btnClass = "selected";
                       } else if (isSaved) {
                         btnClass = "inspected-saved";
                       } else {
                         btnClass = "btn-choice-teacher";
                       }
                       return (
                         <button
                           key={s.id}
                           type="button"
                           onClick={() => handleStudentClick(s.id)}
                           className={`choice-button ${btnClass}`}
                         >
                           {s.name}
                         </button>
                       );
                     });
                   })()}
                 </div>
               ) : (
                 <div className="text-xs text-slate-500 p-2 font-bold bg-slate-950/20 border border-dashed border-slate-850 rounded-xl">
                   반을 선택하면 학생 목록이 나타납니다.
                 </div>
               )}
             </div>
           </div>
 
           <div className="grid md:grid-cols-2 gap-4 mt-4">
             {/* 교재 선택 */}
             <div className="text-xs font-bold text-slate-400">
               <span className="block mb-2">교재 선택</span>
               {selectedClassId ? (
                 <div className="choice-grid" id="selectedInspectionBookId">
                   {assigned.map(x => {
                     const active = x.book.id === selectedBookId;
                     return (
                       <button
                         key={x.book.id}
                         type="button"
                         onClick={() => handleBookClick(x.book.id)}
                         className={`choice-button btn-choice-teacher ${active ? 'selected' : ''}`}
                       >
                         {x.book.title}
                       </button>
                     );
                   })}
                 </div>
               ) : (
                 <div className="text-xs text-slate-500 p-2 font-bold bg-slate-950/20 border border-dashed border-slate-850 rounded-xl">
                   반을 선택하면 교재 목록이 나타납니다.
                 </div>
               )}
             </div>

            {/* 점검일 */}
            <div className="text-xs font-bold text-slate-400 block">
              <span>점검일</span>
              <input
                type="date"
                value={selectedDate}
                onClick={(e) => { try { e.currentTarget.showPicker(); } catch (err) {} }}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  updateLegacyState({ selectedDate: e.target.value });
                }}
                className="mt-2 w-full border border-slate-800 rounded-xl px-4 py-2.5 bg-slate-900 text-xs text-white focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
              />
            </div>
          </div>

          {/* ★ 교재 점검 시작 버튼 */}
          <div className="mt-6">
            <button
              type="button"
              disabled={!isBookSelected}
              onClick={() => setIsModalOpen(true)}
              style={isBookSelected ? { animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' } : {}}
              className={`w-full rounded-xl py-3.5 text-xs font-black shadow-lg transition-all ${isBookSelected ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white cursor-pointer active:scale-[0.98]' : 'bg-slate-800 text-slate-500 border border-slate-800/80 cursor-not-allowed'}`}
            >
              {state.editingInspectionId ? '기존 점검 수정 계속하기 ➔' : '교재 점검 시작 ➔'}
            </button>
          </div>
        </article>
      </div>

      {/* 3. 하단 최근 점검 기록 테이블 */}
      {selectedStudent && (
        <article className="card-3d rounded-2xl p-5 md:p-6 bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-base font-extrabold text-white">
              <span className="text-blue-400 font-extrabold">{selectedStudent.name}</span> 학생 최근 점검 상세 기록 <span className="text-xs font-medium text-slate-500 ml-1.5">({selectedClass?.name || '최근 20개 내역'})</span>
            </h3>
            <span className="text-[10px] text-slate-400 font-bold">기존 기록 수정/삭제 가능</span>
          </div>

          <div className="overflow-x-auto mini-scroll">
            <table className="w-full text-sm text-center border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 text-xs font-bold uppercase">
                  <th className="py-3 cursor-pointer select-none hover:text-white" onClick={() => handleSort('date')}>날짜 {sortIndicator('date')}</th>
                  <th className="py-3 cursor-pointer select-none hover:text-white" onClick={() => handleSort('bookId')}>교재 {sortIndicator('bookId')}</th>
                  <th className="py-3 font-bold">단원명</th>
                  <th className="py-3 font-bold">범위</th>
                  <th className="py-3 font-bold">미완료</th>
                  <th className="py-3 cursor-pointer select-none hover:text-white" onClick={() => handleSort('completionRate')}>완료율 {sortIndicator('completionRate')}</th>
                  <th className="py-3 font-bold">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredHistoryRows.length ? filteredHistoryRows.map(r => {
                  const book = bookById(r.bookId);
                  const units = book && r.rangeStart && r.rangeEnd ? unitsForRange(book, Number(r.rangeStart), Number(r.rangeEnd)) : [];
                  const unitNames = units.map(u => u.name).join(', ');
                  
                  return (
                    <tr key={r.id} className="hover:bg-slate-950/20 transition-all text-xs">
                      <td className="py-3 text-slate-300 font-bold">{fmtDate(r.date)}</td>
                      <td className="text-slate-300 text-left pl-2">{bookById(r.bookId)?.title || '-'}</td>
                      <td className="text-slate-400 text-left pl-2">
                        {r.attendanceStatus === 'absent' || r.attendanceStatus === 'no_book' ? (
                          <span className="text-slate-650">-</span>
                        ) : (
                          unitNames || <span className="text-slate-655">-</span>
                        )}
                      </td>
                      <td className="text-slate-400">
                        {r.attendanceStatus === 'absent' ? (
                          <span className="text-rose-450 font-bold">결석</span>
                        ) : r.attendanceStatus === 'no_book' ? (
                          <span className="text-amber-400 font-bold">교재 미지참</span>
                        ) : (
                          <span className="font-bold text-slate-300">{r.rangeStart}~{r.rangeEnd}쪽</span>
                        )}
                      </td>
                      <td className="text-rose-455 font-bold">
                        {r.attendanceStatus === 'absent' || r.attendanceStatus === 'no_book' ? '-' : ((r.missedPages || []).join(', ') || '없음')}
                      </td>
                      <td className="font-extrabold text-blue-400">
                        {r.attendanceStatus === 'absent' || r.attendanceStatus === 'no_book' ? '-' : `${r.completionRate}%`}
                      </td>
                      <td>
                        <div className="flex justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleEditInspection(r)}
                            className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 text-[11px] font-bold text-blue-400 hover:bg-blue-500 hover:text-white transition-all cursor-pointer"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteInspection(r.id)}
                            className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 text-[11px] font-bold text-rose-400 hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan="7" className="py-8 text-slate-500 text-center">점검 기록이 존재하지 않습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      )}

      {/* 4. Wizard 모달 */}
      {isModalOpen && (
        <InspectionWizardModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            updateLegacyState({
              editingInspectionId: '',
              selectedRangeStart: '',
              selectedRangeEnd: '',
              missedPages: '',
              memo: '',
              rubricScores: { expression: null, grading: null, attitude: null, understanding: null, application: null }
            });
          }}
          props={props}
          selectedClassId={selectedClassId}
          selectedStudentId={selectedStudentId}
          selectedBookId={selectedBookId}
          selectedDate={selectedDate}
          students={students}
          selectedStudent={selectedStudent}
          selectedBook={selectedBook}
          selectedClass={selectedClass}
          carryoverRows={carryoverRows}
          updateMainStates={(updates) => {
            // 학생이 순회모드로 변경되었을 때 상위 상태를 동기화
            if (updates.selectedStudentId) {
              setSelectedStudentId(updates.selectedStudentId);
            }
            if (updates.selectedBookId) {
              setSelectedBookId(updates.selectedBookId);
            }
            updateLegacyState(updates);
          }}
        />
      )}
    </div>
  );
}
