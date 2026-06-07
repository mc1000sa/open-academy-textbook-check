import React, { useState, useMemo } from 'react';
import { averageRubricVector, bookRubricAverageForActiveStudents } from '../lib/reportMetrics.js';
import { buildCarryoverRows, buildResolvedCarryoverRows } from '../lib/textbookProgress.js';
import { getInspectionRoundsMap } from '../lib/reportRounds.js';


// Rubric label config
const RUBRIC_LABELS = {
  assignment: '과제 수행률',
  expression: '풀이 표현력',
  grading: '채점 성실도',
  attitude: '수업 태도',
  understanding: '개념 이해도',
  application: '응용 해결력'
};

const RUBRIC_KEYS = Object.keys(RUBRIC_LABELS);

const IMAGE_RUBRIC_LABELS = {
  assignment: '과제',
  expression: '풀이',
  grading: '채점',
  attitude: '태도',
  understanding: '개념',
  application: '응용'
};

function rubricScore(vector, key) {
  const score = Number(vector?.[key]);
  if (Number.isNaN(score)) return 0;
  return Math.min(10, Math.max(0, score));
}

function rubricPoints(vector, radius = 68, center = 100) {
  return RUBRIC_KEYS.map((key, index) => {
    const angle = (Math.PI * 2 * index) / RUBRIC_KEYS.length - Math.PI / 2;
    const scoreRadius = (rubricScore(vector, key) / 10) * radius;
    const x = center + Math.cos(angle) * scoreRadius;
    const y = center + Math.sin(angle) * scoreRadius;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function rubricGridPoints(scale, radius = 68, center = 100) {
  return RUBRIC_KEYS.map((_, index) => {
    const angle = (Math.PI * 2 * index) / RUBRIC_KEYS.length - Math.PI / 2;
    const gridRadius = radius * scale;
    const x = center + Math.cos(angle) * gridRadius;
    const y = center + Math.sin(angle) * gridRadius;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function pagesInSimpleRange(start, end) {
  const first = Number(start);
  const last = Number(end);
  if (!Number.isFinite(first) || !Number.isFinite(last) || first < 1 || last < first) return [];
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

function unitCompletionRows(book, logs, bookUnits) {
  const units = (typeof bookUnits === 'function' ? bookUnits(book) : [...(book?.units || [])])
    .filter(unit => unit.visibleToStudent !== false);

  // 이 책의 모든 점검 로그에서 해결 완료된(Resolved) carryover 미완료 페이지 번호들을 수집
  const resolvedPages = new Set();
  (logs || []).forEach(log => {
    (log.carryoverResolutions || []).forEach(res => {
      (res.resolvedPages || []).map(Number).forEach(p => resolvedPages.add(p));
    });
  });

  return units.map(unit => {
    const unitPages = new Set(pagesInSimpleRange(unit.start, unit.end));
    const checkedPages = new Set();
    const missedPages = new Set();

    (logs || []).forEach(log => {
      pagesInSimpleRange(log.rangeStart, log.rangeEnd).forEach(page => {
        if (unitPages.has(page)) checkedPages.add(page);
      });
      (log.missedPages || []).map(Number).forEach(page => {
        if (unitPages.has(page)) missedPages.add(page);
      });
    });

    // 해결 완료된 페이지는 미완료 목록에서 제거
    resolvedPages.forEach(page => {
      if (unitPages.has(page)) {
        missedPages.delete(page);
      }
    });

    const checkedCount = checkedPages.size;
    const completedCount = Math.max(0, checkedCount - missedPages.size);
    const completionRate = checkedCount ? Math.round((completedCount / checkedCount) * 100) : 0;

    return {
      ...unit,
      checkedCount,
      missedCount: missedPages.size,
      completionRate
    };
  });
}

// React Radar Chart component
function StudentRubricRadarCompare({ primary, secondary, secondaryLabel }) {
  const gridPolygons = [0.25, 0.5, 0.75, 1].map((scale, i) => (
    <polygon
      key={i}
      points={rubricGridPoints(scale)}
      fill="none"
      stroke="rgba(148,163,184,0.22)"
      strokeWidth="1"
    />
  ));

  const gridAxes = RUBRIC_KEYS.map((_, index) => {
    const point = rubricGridPoints(1).split(' ')[index];
    const [x2, y2] = point.split(',');
    return (
      <line
        key={index}
        x1="100"
        y1="100"
        x2={x2}
        y2={y2}
        stroke="rgba(148,163,184,0.18)"
        strokeWidth="1"
      />
    );
  });

  const gridLabels = RUBRIC_KEYS.map((key, index) => {
    const angle = (Math.PI * 2 * index) / RUBRIC_KEYS.length - Math.PI / 2;
    const radius = 93;
    const posX = 100 + Math.cos(angle) * radius;
    const posY = 100 + Math.sin(angle) * radius;
    const anchor = posX < 86 ? 'end' : posX > 114 ? 'start' : 'middle';
    const dy = index === 0 ? -3 : index === 3 ? 5 : 0;

    return (
      <text
        key={key}
        x={posX.toFixed(1)}
        y={(posY + dy).toFixed(1)}
        textAnchor={anchor}
        dominantBaseline="middle"
        fill="#cbd5e1"
        fontSize="7.2"
        fontWeight="700"
      >
        {RUBRIC_LABELS[key]}
      </text>
    );
  });

  const primaryPoints = rubricPoints(primary);
  const secondaryPoints = rubricPoints(secondary);

  const primaryCircles = RUBRIC_KEYS.map((key, index) => {
    const angle = (Math.PI * 2 * index) / RUBRIC_KEYS.length - Math.PI / 2;
    const scoreRadius = (rubricScore(primary, key) / 10) * 68;
    const cx = 100 + Math.cos(angle) * scoreRadius;
    const cy = 100 + Math.sin(angle) * scoreRadius;
    return (
      <circle
        key={key}
        cx={cx.toFixed(1)}
        cy={cy.toFixed(1)}
        r="2.9"
        fill="#00d6cd"
        stroke="#00d6cd"
        strokeWidth="1"
      />
    );
  });

  const secondaryCircles = RUBRIC_KEYS.map((key, index) => {
    const angle = (Math.PI * 2 * index) / RUBRIC_KEYS.length - Math.PI / 2;
    const scoreRadius = (rubricScore(secondary, key) / 10) * 68;
    const cx = 100 + Math.cos(angle) * scoreRadius;
    const cy = 100 + Math.sin(angle) * scoreRadius;
    return (
      <circle
        key={key}
        cx={cx.toFixed(1)}
        cy={cy.toFixed(1)}
        r="2.7"
        fill="#0f172a"
        stroke="#10b981"
        strokeWidth="2"
      />
    );
  });

  return (
    <section className="rubric-report mt-4 p-4 rounded-xl bg-slate-950/40 border border-slate-800">
      <div className="flex flex-col md:flex-row md:items-start gap-4">
        <div className="flex-1 space-y-2 text-xs">
          <div className="font-black text-sm text-[#00d6cd] mb-3">6요소 점수 상세</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {RUBRIC_KEYS.map(key => (
              <div key={key} className="flex items-center justify-between gap-2">
                <span className="text-slate-400">{RUBRIC_LABELS[key]}</span>
                <span className="font-black text-slate-100">{rubricScore(primary, key).toFixed(1)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 font-bold">
            <span className="flex items-center gap-1.5"><b className="w-2.5 h-2.5 rounded-full bg-[#00d6cd]"></b>나의 6요소</span>
            <span className="flex items-center gap-1.5"><b className="w-2.5 h-2.5 rounded-full border border-[#10b981] bg-[#0f172a]"></b>{secondaryLabel}</span>
          </div>
        </div>
        <div className="w-full md:w-[200px] flex justify-center shrink-0">
          <svg viewBox="0 0 200 200" className="w-[180px] h-[180px] overflow-visible">
            {gridPolygons}
            {gridAxes}
            {gridLabels}
            <polygon points={secondaryPoints} fill="rgba(16, 185, 129, 0.06)" stroke="#10b981" strokeWidth="1.5" strokeDasharray="3,2"></polygon>
            <polygon points={primaryPoints} fill="rgba(0, 214, 205, 0.08)" stroke="#00d6cd" strokeWidth="2"></polygon>
            {secondaryCircles}
            {primaryCircles}
          </svg>
        </div>
      </div>
    </section>
  );
}

export default function StudentPortal({
  state,
  db,
  refs,
  inspectionsForStudent,
  bookById,
  bookUnits,
  averageCompletionRate,
  groupInspectionsByBook,
  fmtDate,
  safe,
  progressTone,
  unitsForRange,
  assignedBooksForClass,
  updateLegacyState,
  updateStudentPin,
  showModalAlert
}) {
  const student = state.studentSession;
  if (!student) {
    return <div className="p-8 text-center text-rose-500 font-bold">로그인 세션이 유효하지 않습니다.</div>;
  }

  // Local state management
  const [selectedBookFilter, setSelectedBookFilter] = useState('');
  const [selectedRubricBookId, setSelectedRubricBookId] = useState('');
  const [selectedRoundFilter, setSelectedRoundFilter] = useState('');
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');


  const myInspections = useMemo(() => inspectionsForStudent(student.id), [student.id, state.inspections]);
  const myClass = useMemo(() => state.classes.find(c => c.id === student.classId), [student.classId, state.classes]);

  const dateToRoundMap = useMemo(() => {
    return getInspectionRoundsMap(myInspections);
  }, [myInspections]);

  const roundsList = useMemo(() => {
    const uniqueDates = Array.from(new Set(
      myInspections.map(log => log.date).filter(Boolean)
    )).sort((a, b) => b.localeCompare(a));

    return uniqueDates.map(date => ({
      date,
      round: dateToRoundMap.get(date) || 1,
      displayDate: fmtDate(date)
    }));
  }, [myInspections, dateToRoundMap, fmtDate]);

  const teacherName = useMemo(() => {
    return state.teachers.find(t => t.id === myClass?.teacherId)?.name || '담당 교사 없음';
  }, [myClass, state.teachers]);

  const visibleBookIds = useMemo(() => {
    if (typeof assignedBooksForClass !== 'function') return null;
    const profileId = student.studentProfileId || student.id;
    const relatedStudents = (state.allStudents || state.students || [])
      .filter(s => (s.studentProfileId || s.id) === profileId);
    if (!relatedStudents.some(s => s.id === student.id)) relatedStudents.push(student);
    return new Set(
      relatedStudents.flatMap(s => assignedBooksForClass(s.classId).map(item => item.book.id))
    );
  }, [student, state.allStudents, state.students, assignedBooksForClass]);

  const bookList = useMemo(() => {
    const grouped = groupInspectionsByBook(myInspections);
    const list = Object.keys(grouped).map(bookId => {
      const book = bookById(bookId);
      let bookLogs = grouped[bookId];

      if (selectedRoundFilter) {
        bookLogs = bookLogs.filter(log => log.date === selectedRoundFilter);
      }

      if (bookLogs.length === 0) return null;

      const lastActiveLog = bookLogs.find(log => log.attendanceStatus !== 'absent' && log.attendanceStatus !== 'no_book');
      const completionRate = lastActiveLog ? (lastActiveLog.completionRate ?? 0) : 0;

      const missedSorted = selectedRoundFilter
        ? (bookLogs[0]?.missedPages || []).map(Number).sort((a, b) => a - b)
        : buildCarryoverRows({
            inspections: myInspections,
            studentId: student.id,
            bookId
          }).flatMap(row => row.missedPages).sort((a, b) => a - b);
      const resolvedCarryoverRows = buildResolvedCarryoverRows(bookLogs);

      const firstLog = bookLogs[bookLogs.length - 1];
      const latestLog = bookLogs[0];
      const dateRangeText = (firstLog && latestLog)
        ? `${fmtDate(firstLog.date)} ~ ${fmtDate(latestLog.date)}`
        : '';

      return {
        book,
        logs: bookLogs,
        latestLog,
        completionRate,
        missedPages: missedSorted,
        resolvedCarryoverRows,
        dateRangeText
      };
    }).filter(Boolean).filter(item => item.book && (!visibleBookIds || visibleBookIds.has(item.book.id)));

    // Sort by recent active use
    return list.sort((a, b) => {
      const aTime = a.latestLog ? new Date(a.latestLog.date).getTime() : 0;
      const bTime = b.latestLog ? new Date(b.latestLog.date).getTime() : 0;
      return bTime - aTime;
    });
  }, [myInspections, student.id, bookById, groupInspectionsByBook, visibleBookIds, fmtDate, selectedRoundFilter]);


  const totalAvg = useMemo(() => Math.round(averageCompletionRate(myInspections)), [myInspections, averageCompletionRate]);

  // Rubric details calculations
  const selectedRubricBookItem = useMemo(() => {
    const targetId = selectedRubricBookId || (bookList[0]?.book?.id || '');
    return bookList.find(item => item.book.id === targetId);
  }, [selectedRubricBookId, bookList]);

  const selectedRubricStudentVector = useMemo(() => {
    return selectedRubricBookItem ? averageRubricVector(selectedRubricBookItem.logs) : {};
  }, [selectedRubricBookItem]);

  const selectedRubricBookVector = useMemo(() => {
    return selectedRubricBookItem
      ? bookRubricAverageForActiveStudents(selectedRubricBookItem.book.id, state.students, state.inspections)
      : {};
  }, [selectedRubricBookItem, state.students, state.inspections]);

  // History details calculations
  const selectedHistoryBookItem = useMemo(() => {
    return selectedBookFilter ? bookList.find(item => item.book.id === selectedBookFilter) : null;
  }, [selectedBookFilter, bookList]);

  const selectedUnitRows = useMemo(() => {
    return selectedHistoryBookItem ? unitCompletionRows(selectedHistoryBookItem.book, selectedHistoryBookItem.logs, bookUnits) : [];
  }, [selectedHistoryBookItem, bookUnits]);

  // Handlers
  const handleLogout = () => {
    updateLegacyState({
      portal: 'gateway',
      studentSession: null,
      loginStep: 'login'
    });
  };

  const handleOpenPinModal = () => {
    setNewPin('');
    setConfirmNewPin('');
    setPinModalOpen(true);
  };

  const handleClosePinModal = () => {
    setPinModalOpen(false);
  };

  const handlePinSubmit = async () => {
    if (!/^\d{4}$/.test(newPin)) {
      showModalAlert('PIN번호는 4자리 숫자로 입력해야 합니다.');
      return;
    }
    if (newPin !== confirmNewPin) {
      showModalAlert('변경할 PIN번호와 확인 번호가 일치하지 않습니다.');
      return;
    }
    try {
      await updateStudentPin(student.id, newPin);
      showModalAlert('PIN 비밀번호가 정상적으로 변경되었습니다.');
      setPinModalOpen(false);
    } catch (err) {
      console.error(err);
      showModalAlert(`비밀번호 변경 중 오류가 발생했습니다: ${err.message}`);
    }
  };

  const pipeColor = '#00d6cd';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Top Header Section */}
      <header className="card-3d p-6 md:p-8 rounded-3xl mb-8 relative overflow-hidden" style={{ borderLeft: `5px solid ${pipeColor}` }}>
        <div className="star-field"></div>
        <div className="flex justify-end mb-4 relative z-20">
          <div className="flex items-center gap-3 text-[11px] bg-white/[0.04] px-3.5 py-1.5 rounded-full border border-white/[0.06] backdrop-blur-sm">
            <button
              type="button"
              onClick={handleOpenPinModal}
              className={`transition-colors ${pinModalOpen ? 'text-[#00d6cd] font-black' : 'text-slate-400 hover:text-white'}`}
            >
              PIN 변경
            </button>
            <span className="text-white/10 text-[9px]">|</span>
            <button
              type="button"
              onClick={handleLogout}
              className="text-slate-400 hover:text-rose-400 transition-colors"
            >
              LogOut
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide bg-[#00d6cd]/10 text-[#00d6cd] soft-border">
              STUDENT PORTAL
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold mt-3 tracking-tight text-white">
              안녕하세요, <span className="text-[#00d6cd]">{student.name}</span> 학생!
            </h1>
            <p className="text-sm text-slate-400 mt-2">
              소속: <span className="text-slate-200">{myClass?.name || '미배정'}</span> ({student.school || '학교 미입력'}) &nbsp;|&nbsp; 
              지도교사: <span className="text-slate-200">{teacherName}</span>
            </p>
          </div>

          <div className="flex items-center gap-4 bg-slate-900/50 p-4 rounded-2xl soft-border">
            <div className="text-right">
              <span className="text-xs text-slate-400 font-bold block mb-1">전체 교재 완료율</span>
              <strong className="text-2xl md:text-3xl font-black text-[#00d6cd]">{totalAvg}%</strong>
            </div>
            <div className="w-12 h-12 rounded-full border-4 border-[#00d6cd]/20 flex items-center justify-center relative animate-pulse" style={{ borderTopColor: pipeColor }}>
              <span className="text-[10px] text-[#00d6cd] font-bold">ING</span>
            </div>
          </div>
        </div>
      </header>

      {/* Book Status Overview List */}
      <section className="mb-8">
        <div className="flex items-center mb-6">
          <div style={{ width: '4px', height: '1.1rem', background: pipeColor, marginRight: '0.6rem', borderRadius: '2px', boxShadow: `0 0 8px ${pipeColor}` }}></div>
          <h2 className="text-lg font-bold text-slate-100">교재 학습 점검 현황</h2>
        </div>

        {roundsList.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center mb-6 bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800/80">
            <span className="text-xs font-bold text-slate-550 mr-2 select-none">회차 선택:</span>
            <button
              type="button"
              onClick={() => setSelectedRoundFilter('')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all border ${
                !selectedRoundFilter
                  ? 'bg-[#00d6cd] text-slate-950 border-[#00d6cd]'
                  : 'bg-slate-900 border-slate-850 text-slate-400 hover:text-white'
              }`}
            >
              전체(누적)
            </button>
            {roundsList.map(item => (
              <button
                key={item.date}
                type="button"
                onClick={() => setSelectedRoundFilter(item.date)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all border ${
                  selectedRoundFilter === item.date
                    ? 'bg-[#00d6cd] text-slate-950 border-[#00d6cd]'
                    : 'bg-slate-900 border-slate-850 text-slate-400 hover:text-white'
                }`}
              >
                {item.round}회차 ({item.displayDate})
              </button>
            ))}
          </div>
        )}


        {bookList.length === 0 ? (
          <div className="empty-state">배정되어 점검된 교재 기록이 아직 없습니다.</div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {bookList.map(item => {
              const tone = progressTone(item.completionRate);
              let rangeText = '-';
              if (item.latestLog) {
                if (item.latestLog.attendanceStatus === 'absent') rangeText = '결석';
                else if (item.latestLog.attendanceStatus === 'no_book') rangeText = '교재 미지참';
                else rangeText = `${item.latestLog.rangeStart} ~ ${item.latestLog.rangeEnd}쪽`;
              }

              // 지난과제 완료율 계산
              let totalPrevMissed = 0;
              let resolvedCount = 0;
              let recoveryRate = 0;
              if (item.latestLog) {
                const prevCarryoverRows = buildCarryoverRows({
                  inspections: myInspections,
                  studentId: student.id,
                  bookId: item.book.id,
                  currentInspectionDate: item.latestLog.date,
                  editingInspectionId: item.latestLog.id
                });
                totalPrevMissed = prevCarryoverRows.reduce((sum, r) => sum + r.missedPages.length, 0);
                resolvedCount = item.latestLog.carryoverResolutions
                  ? item.latestLog.carryoverResolutions.reduce((sum, res) => sum + (res.resolvedPages?.length || 0), 0)
                  : 0;
                recoveryRate = totalPrevMissed ? Math.round((resolvedCount / totalPrevMissed) * 105 / 1.05) : 0; // 복구율 계산 (백분율)
                recoveryRate = Math.min(100, Math.max(0, recoveryRate));
              }

              // 보완 필요 이번 과제 vs 아직 해결 안 된 지난 과제 분리 계산
              const latestMissedSet = new Set(
                item.latestLog && item.latestLog.attendanceStatus !== 'absent' && item.latestLog.attendanceStatus !== 'no_book'
                  ? (item.latestLog.missedPages || []).map(Number)
                  : []
              );
              const currentRoundMissed = item.missedPages.filter(page => latestMissedSet.has(page));
              const unresolvedPrevMissed = item.missedPages.filter(page => !latestMissedSet.has(page));

              // Build instruction comment string
              let memoContent = '';
              if (item.latestLog) {
                const statusText = item.latestLog.attendanceStatus === 'absent' ? '결석' : item.latestLog.attendanceStatus === 'no_book' ? '교재 미지참' : '';
                const dateText = item.latestLog.date ? fmtDate(item.latestLog.date) : '';
                memoContent = item.latestLog.memo || '';
                if (statusText) {
                  memoContent = `[${dateText} ${statusText}] ${memoContent}`.trim();
                }
              }

              return (
                <article key={item.book.id} className="card-3d p-6 rounded-2xl relative overflow-hidden transition-all duration-300 hover:border-[#00d6cd]/30">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                    <div>
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-300 soft-border mr-2">
                        {item.book.subject || '수학'}
                      </span>
                      <h3 className="text-lg font-extrabold text-white inline-block">{item.book.title}</h3>
                      <p className="text-xs text-slate-400 mt-1">
                        학년: {item.book.grade || '전체'}
                        {item.dateRangeText && ` | 📅 학습 기간: ${item.dateRangeText}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block mb-1">최근 점검 범위</span>
                      <span className="text-sm font-bold text-slate-200">{rangeText}</span>
                    </div>
                  </div>

                  {/* 지난과제 완료율 게이지 바 */}
                  {totalPrevMissed > 0 && (
                    <div className="mb-3">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-400 mb-1.5">
                        <span className="text-emerald-450 font-black flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />지난과제 완료율</span>
                        <span className="text-emerald-300 font-extrabold">{recoveryRate}% ({resolvedCount}/{totalPrevMissed}쪽 완료)</span>
                      </div>
                      <div className="book-track w-full bg-slate-900 border border-slate-850 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${recoveryRate}%` }}></div>
                      </div>
                    </div>
                  )}

                  <div className="mb-4">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-400 mb-1.5">
                      <span>학습 완료율</span>
                      <span className="text-white">{item.completionRate}%</span>
                    </div>
                    <div className="book-track w-full">
                      <div className="completed-seg h-full rounded-full animate-progress" style={{ width: `${item.completionRate}%`, backgroundColor: tone.bar }}></div>
                    </div>
                  </div>


                  <div className="bg-slate-900/40 p-4 rounded-xl soft-border space-y-3">
                    <div>
                      <span className="text-xs font-bold text-slate-400 block mb-2">🚨 보완이 필요한 이번 과제 (미완료)</span>
                      {currentRoundMissed.length === 0 ? (
                        <span className="text-xs text-emerald-400 font-extrabold">이번 과제는 완벽하게 완료되었습니다! 🎉</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {currentRoundMissed.map(page => (
                            <span key={page} className="px-2.5 py-1 rounded-lg text-xs font-black bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              {page}쪽
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {unresolvedPrevMissed.length > 0 && (
                      <div className="pt-2.5 border-t border-slate-850">
                        <span className="text-xs font-bold text-amber-400 block mb-2">⚠️ 아직 해결하지 못한 지난 미완료 (이월)</span>
                        <div className="flex flex-wrap gap-1.5">
                          {unresolvedPrevMissed.map(page => (
                            <span key={page} className="px-2.5 py-1 rounded-lg text-xs font-black bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              {page}쪽
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {item.resolvedCarryoverRows.length > 0 && (
                    <div className="mt-4 bg-emerald-950/20 p-4 rounded-xl border border-emerald-500/20">
                      <span className="text-xs font-bold text-emerald-300 block mb-2">이번 회차에 완료한 지난 미완료</span>
                      <div className="flex flex-wrap gap-1.5">
                        {item.resolvedCarryoverRows.flatMap(row => row.resolvedPages.map(page => (
                          <span key={`${row.sourceInspectionId}-${page}`} className="px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
                            {page}쪽 완료
                          </span>
                        )))}
                      </div>
                    </div>
                  )}

                  {memoContent && (
                    <div className="mt-4 pt-3 border-t border-slate-800/80">
                      <span className="text-xs text-indigo-400 font-bold block mb-1">💬 선생님의 지도 코멘트</span>
                      <p className="text-xs text-slate-300 bg-indigo-950/20 p-3 rounded-lg soft-border italic leading-relaxed">
                        "{memoContent}"
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* History Log Table Section */}
      <section className="mb-8">
        <article className="card-3d p-6 rounded-2xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5 pb-4 border-b border-slate-800/80">
            <div className="flex items-center">
              <div style={{ width: '4px', height: '1rem', background: pipeColor, marginRight: '0.6rem', borderRadius: '2px' }}></div>
              <h3 className="text-sm font-bold text-slate-200">최근 점검 상세 이력</h3>
            </div>
            {bookList.length > 0 && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[11px] font-bold text-slate-500 mr-1 select-none">교재 필터:</span>
                <button
                  type="button"
                  onClick={() => setSelectedBookFilter('')}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold transition-all border ${!selectedBookFilter ? 'bg-[#00d6cd] text-slate-950 border-[#00d6cd]' : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white'}`}
                >
                  전체보기
                </button>
                {bookList.map(item => (
                  <button
                    key={item.book.id}
                    type="button"
                    onClick={() => setSelectedBookFilter(item.book.id)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold transition-all border ${selectedBookFilter === item.book.id ? 'bg-[#00d6cd] text-slate-950 border-[#00d6cd]' : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white'}`}
                  >
                    {item.book.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-2 pt-1 pb-1">
            {(() => {
              const filteredInspections = selectedBookFilter
                ? myInspections.filter(log => log.bookId === selectedBookFilter)
                : myInspections;

              if (filteredInspections.length === 0) {
                return <div className="text-xs text-slate-500 text-center py-8">해당하는 점검 기록이 존재하지 않습니다.</div>;
              }

              return filteredInspections.slice(0, 5).map(log => {
                const book = bookById(log.bookId);
                const round = dateToRoundMap.get(log.date) || 1;

                const units = (book && unitsForRange) ? unitsForRange(book, log.rangeStart, log.rangeEnd) : [];
                const unitNames = units.map(u => u.name).join(', ');
                const unitText = unitNames ? ` (${unitNames})` : '';

                let specText = '';
                if (log.attendanceStatus === 'absent') {
                  specText = '범위: 결석 (평가 제외)';
                } else if (log.attendanceStatus === 'no_book') {
                  specText = '범위: 교재 미지참 (평가 제외)';
                } else {
                  const rangeStartVal = log.rangeStart !== null && log.rangeStart !== undefined ? log.rangeStart : '-';
                  const rangeEndVal = log.rangeEnd !== null && log.rangeEnd !== undefined ? log.rangeEnd : '-';
                  const completionRateVal = log.completionRate !== null && log.completionRate !== undefined ? `${log.completionRate}%` : '-';
                  specText = `범위: ${rangeStartVal}~${rangeEndVal}쪽${unitText} (완료율 ${completionRateVal})`;
                }

                return (
                  <div key={log.id} className="p-3 bg-slate-900/30 rounded-xl soft-border text-xs flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <span className="font-extrabold text-slate-200 block">{book?.title || '알 수 없는 교재'}</span>
                      <span className="text-slate-400 mt-1 block leading-relaxed">{specText}</span>
                    </div>
                    <div className="text-right shrink-0 min-w-[72px] pt-0.5">
                      <span className="text-[#00d6cd] font-black block whitespace-nowrap leading-none" title={`점검일: ${fmtDate(log.date)}`}>{round}회차 점검</span>
                      <span className="text-[10px] text-slate-500">{log.teacherName}T</span>
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          {/* Subunit bar charts */}
          <div className="mt-5 pt-5 border-t border-slate-800/80">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h4 className="text-xs font-black text-slate-200">단원별 완료율</h4>
                <p className="text-[10px] text-slate-500 mt-1">교재 필터에서 선택한 교재 기준으로 표시됩니다.</p>
              </div>
              {selectedHistoryBookItem && (
                <span className="text-[10px] font-black text-[#00d6cd]">{selectedHistoryBookItem.book.title}</span>
              )}
            </div>

            {!selectedHistoryBookItem ? (
              <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/20 px-4 py-5 text-center text-xs text-slate-500">
                교재 필터에서 교재를 하나 선택하면 단원별 막대 그래프가 표시됩니다.
              </div>
            ) : selectedUnitRows.length ? (
              <div className="space-y-3">
                {selectedUnitRows.map(unit => (
                  <div key={unit.id || unit.name}>
                    <div className="flex items-center justify-between gap-3 text-[11px] mb-1.5">
                      <span className="font-bold text-slate-300 truncate">{unit.name}</span>
                      <span className="font-black text-slate-100 shrink-0">{unit.completionRate}%</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${unit.completionRate}%`, background: 'linear-gradient(90deg,#00d6cd,#4169e1)' }}></div>
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500">
                      {unit.start}~{unit.end}쪽 · 점검 {unit.checkedCount}쪽 · 미완료 {unit.missedCount}쪽
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/20 px-4 py-5 text-center text-xs text-slate-500">
                이 교재에는 등록된 단원 정보가 없습니다.
              </div>
            )}
          </div>
        </article>
      </section>

      {/* Radar Chart Section */}
      <section className="mb-8">
        <article className="card-3d p-6 rounded-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-800/80">
            <div className="flex items-center">
              <div style={{ width: '4px', height: '1rem', background: pipeColor, marginRight: '0.6rem', borderRadius: '2px', boxShadow: `0 0 8px ${pipeColor}` }}></div>
              <h3 className="text-sm font-bold text-slate-200">교재별 6요소 비교</h3>
            </div>
            {bookList.length > 0 && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[11px] font-bold text-slate-500 mr-1 select-none">교재 선택:</span>
                {bookList.map(item => (
                  <button
                    key={item.book.id}
                    type="button"
                    onClick={() => setSelectedRubricBookId(item.book.id)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold transition-all border ${
                      (selectedRubricBookId || (bookList[0]?.book?.id || '')) === item.book.id
                        ? 'bg-[#00d6cd] text-slate-950 border-[#00d6cd]'
                        : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {item.book.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          {bookList.length === 0 ? (
            <div className="text-xs text-slate-500 text-center py-8">비교할 교재 점검 기록이 아직 없습니다.</div>
          ) : selectedRubricBookItem ? (
            <>
              <div className="mb-3 text-xs text-slate-400">
                선택 교재: <span className="font-black text-slate-100">{selectedRubricBookItem.book.title}</span>
              </div>
              <StudentRubricRadarCompare
                primary={selectedRubricStudentVector}
                secondary={selectedRubricBookVector}
                secondaryLabel="해당 교재 전체 평균"
              />
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/20 px-4 py-8 text-center">
              <div className="text-sm font-black text-slate-300">교재를 하나 선택하면 6요소 비교가 표시됩니다.</div>
              <div className="text-xs text-slate-500 mt-2">전체 교재 평균이 아니라, 선택한 교재 기준으로만 비교합니다.</div>
            </div>
          )}
        </article>
      </section>

      {/* Footer LogOut */}
      <footer className="text-center mt-12 pb-8">
        <button
          type="button"
          onClick={handleLogout}
          className="ghost-button px-6 py-2.5 rounded-xl text-xs font-bold transition-all duration-200"
        >
          안전하게 로그아웃 후 메인으로 이동
        </button>
        <p className="text-[11px] text-slate-600 mt-4">
          열린학원 OATIS 교재점검 시스템 &copy; Open Academy Textbook Insight System
        </p>
      </footer>

      {/* Change PIN Modal Form */}
      {pinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn" onClick={handleClosePinModal}>
          <div className="w-full max-w-sm bg-[#11131e] rounded-3xl border border-white/[0.08] p-6 relative z-10 shadow-2xl animate-scaleUp" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={handleClosePinModal}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex items-center mb-6">
              <div style={{ width: '4px', height: '1.1rem', background: pipeColor, marginRight: '0.6rem', borderRadius: '2px', boxShadow: `0 0 8px ${pipeColor}` }}></div>
              <h3 className="text-base font-extrabold text-slate-100">비밀번호(PIN) 변경</h3>
            </div>

            <div className="space-y-4">
              <label className="field mb-0 block">
                <span className="text-xs text-slate-400 block mb-1.5 font-bold">새로운 4자리 PIN번호 입력</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  style={{ WebkitTextSecurity: 'disc' }}
                  placeholder="숫자 4자리"
                  maxLength={4}
                  className="w-full p-3 rounded-xl bg-black/40 border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#00d6cd] transition-all"
                  value={newPin}
                  onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                />
              </label>

              <label className="field mb-0 block">
                <span className="text-xs text-slate-400 block mb-1.5 font-bold">PIN번호 확인 입력</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  style={{ WebkitTextSecurity: 'disc' }}
                  placeholder="한번 더 입력"
                  maxLength={4}
                  className="w-full p-3 rounded-xl bg-black/40 border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#00d6cd] transition-all"
                  value={confirmNewPin}
                  onChange={e => setConfirmNewPin(e.target.value.replace(/\D/g, ''))}
                />
              </label>

              <button
                type="button"
                onClick={handlePinSubmit}
                className="w-full py-3 rounded-xl text-sm font-black mt-4 bg-[#00d6cd] text-slate-950 hover:bg-[#00b5ad] active:scale-95 transition-all shadow-[0_0_15px_rgba(0,214,205,0.2)]"
              >
                비밀번호 변경 적용
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
