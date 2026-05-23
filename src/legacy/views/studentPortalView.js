import { averageRubricVector, bookRubricAverageForActiveStudents } from '../../lib/reportMetrics.js';
import { renderRubricCompare } from './reportsView.js';

function pagesInSimpleRange(start, end) {
  const first = Number(start);
  const last = Number(end);
  if (!Number.isFinite(first) || !Number.isFinite(last) || first < 1 || last < first) return [];
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

function unitCompletionRows(book, logs, bookUnits) {
  const units = (typeof bookUnits === 'function' ? bookUnits(book) : [...(book?.units || [])])
    .filter(unit => unit.visibleToStudent !== false);
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

export function renderStudentPortalView(state, utils) {
  const {
    inspectionsForStudent,
    bookById,
    bookUnits,
    averageCompletionRate,
    groupInspectionsByBook,
    fmtDate,
    safe,
    progressTone,
    unitsForRange,
    assignedBooksForClass
  } = utils;

  const student = state.studentSession;
  if (!student) return `<div class="p-8 text-center text-rose-500 font-bold">로그인 세션이 유효하지 않습니다.</div>`;

  const myInspections = inspectionsForStudent(student.id);
  const myClass = state.classes.find(c => c.id === student.classId);
  const teacherName = state.teachers.find(t => t.id === myClass?.teacherId)?.name || '담당 교사 없음';
  const visibleBookIds = (() => {
    if (typeof assignedBooksForClass !== 'function') return null;
    const profileId = student.studentProfileId || student.id;
    const relatedStudents = (state.allStudents || state.students || [])
      .filter(s => (s.studentProfileId || s.id) === profileId);
    if (!relatedStudents.some(s => s.id === student.id)) relatedStudents.push(student);
    return new Set(
      relatedStudents.flatMap(s => assignedBooksForClass(s.classId).map(item => item.book.id))
    );
  })();

  // 교재별로 점검 데이터 그룹화
  const grouped = groupInspectionsByBook(myInspections);
  const bookList = Object.keys(grouped).map(bookId => {
    const book = bookById(bookId);
    const bookLogs = grouped[bookId];
    
    // 이 책의 최종 완료율 산출 (최근 점검 기록 기준 혹은 평균)
    const latestLog = bookLogs[0]; // 날짜 역순이므로 0번째가 최신
    const completionRate = latestLog ? latestLog.completionRate : 0;
    
    // 미비 페이지 목록 취합
    const allMissed = new Set();
    bookLogs.forEach(log => {
      (log.missedPages || []).forEach(p => allMissed.add(p));
    });
    
    const missedSorted = Array.from(allMissed).sort((a, b) => a - b);

    // 학습 기간 계산 (최초 점검일 ~ 최근 점검일)
    const firstLog = bookLogs[bookLogs.length - 1];
    const dateRangeText = (firstLog && latestLog)
      ? `${fmtDate(firstLog.date)} ~ ${fmtDate(latestLog.date)}`
      : '';

    return {
      book,
      logs: bookLogs,
      latestLog,
      completionRate,
      missedPages: missedSorted,
      dateRangeText
    };
  }).filter(item => item.book && (!visibleBookIds || visibleBookIds.has(item.book.id)));

  // 사용한 교재순(최근 활성 순) 정렬
  bookList.sort((a, b) => {
    const aTime = a.latestLog ? new Date(a.latestLog.date).getTime() : 0;
    const bTime = b.latestLog ? new Date(b.latestLog.date).getTime() : 0;
    return bTime - aTime;
  });

  // 전체 교재의 평균 완료율
  const totalAvg = Math.round(averageCompletionRate(myInspections));
  const selectedRubricBookId = state.selectedStudentRubricBookId || '';
  const selectedRubricBookItem = selectedRubricBookId
    ? bookList.find(item => item.book.id === selectedRubricBookId)
    : null;
  const selectedRubricStudentVector = selectedRubricBookItem
    ? averageRubricVector(selectedRubricBookItem.logs)
    : {};
  const selectedRubricBookVector = selectedRubricBookItem
    ? bookRubricAverageForActiveStudents(selectedRubricBookItem.book.id, state.students, state.inspections)
    : {};
  const selectedHistoryBookId = state.selectedStudentBookFilter || '';
  const selectedHistoryBookItem = selectedHistoryBookId
    ? bookList.find(item => item.book.id === selectedHistoryBookId)
    : null;
  const selectedUnitRows = selectedHistoryBookItem
    ? unitCompletionRows(selectedHistoryBookItem.book, selectedHistoryBookItem.logs, bookUnits)
    : [];

  // 포털 테마: 청록색(Mint)
  const pipeColor = '#00d6cd';

  // HTML 조립
  return `
    <div class="max-w-4xl mx-auto px-4 py-8">
      
      <!-- 상단 히어로 영역 -->
      <header class="card-3d p-6 md:p-8 rounded-3xl mb-8 relative overflow-hidden" style="border-left: 5px solid ${pipeColor};">
        <div class="star-field"></div>
        
        <!-- 우측 상단 유틸리티 버튼 (배경형식) -->
        <div class="flex justify-end mb-4 relative z-20">
          <div class="flex items-center gap-3 text-[11px] bg-white/[0.04] px-3.5 py-1.5 rounded-full border border-white/[0.06] backdrop-blur-sm">
            <button type="button" data-action="open-student-pin-modal" class="transition-colors ${state.studentPinModalOpen ? 'text-[#00d6cd] font-black' : 'text-slate-400 hover:text-white'}">
              PIN 변경
            </button>
            <span class="text-white/10 text-[9px]">|</span>
            <button type="button" data-action="goto-gateway" class="text-slate-400 hover:text-rose-400 transition-colors">
              LogOut
            </button>
          </div>
        </div>

        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <span class="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide bg-[#00d6cd]/10 text-[#00d6cd] soft-border">
              STUDENT PORTAL
            </span>
            <h1 class="text-2xl md:text-3xl font-extrabold mt-3 tracking-tight text-white">
              안녕하세요, <span class="text-[#00d6cd]">${safe(student.name)}</span> 학생!
            </h1>
            <p class="text-sm text-slate-400 mt-2">
              소속: <span class="text-slate-200">${safe(myClass?.name || '미배정')}</span> (${safe(student.school || '학교 미입력')}) &nbsp;|&nbsp; 
              지도교사: <span class="text-slate-200">${safe(teacherName)}</span>
            </p>
          </div>
          
          <!-- 학업 스트레스 배제를 위한 등수 제거 및 대신 직관적인 총 완료율 게이지 표기 -->
          <div class="flex items-center gap-4 bg-slate-900/50 p-4 rounded-2xl soft-border">
            <div class="text-right">
              <span class="text-xs text-slate-400 font-bold block mb-1">전체 교재 완료율</span>
              <strong class="text-2xl md:text-3xl font-black text-[#00d6cd]">${totalAvg}%</strong>
            </div>
            <div class="w-12 h-12 rounded-full border-4 border-[#00d6cd]/20 flex items-center justify-center relative" style="border-top-color: ${pipeColor};">
              <span class="text-[10px] text-[#00d6cd] font-bold">ING</span>
            </div>
          </div>
        </div>
      </header>

      <!-- 교재별 현황 요약 카드 리스트 -->
      <section class="mb-8">
        <div class="flex items-center mb-6">
          <div style="width: 4px; height: 1.1rem; background: ${pipeColor}; margin-right: 0.6rem; border-radius: 2px; box-shadow: 0 0 8px ${pipeColor};"></div>
          <h2 class="text-lg font-bold text-slate-100">교재 학습 점검 현황</h2>
        </div>

        ${bookList.length === 0 ? `
          <div class="empty-state">배정되어 점검된 교재 기록이 아직 없습니다.</div>
        ` : `
          <div class="grid grid-cols-1 gap-6">
            ${bookList.map(item => {
              const tone = progressTone(item.completionRate);
              return `
                <article class="card-3d p-6 rounded-2xl relative overflow-hidden transition-all duration-300 hover:border-[#00d6cd]/30">
                  <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                    <div>
                      <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-300 soft-border mr-2">
                        ${safe(item.book.subject || '수학')}
                      </span>
                      <h3 class="text-lg font-extrabold text-white inline-block">${safe(item.book.title)}</h3>
                      <p class="text-xs text-slate-400 mt-1">
                        학년: ${safe(item.book.grade || '전체')}
                        ${item.dateRangeText ? ` | <span class="text-slate-400 font-medium">📅 학습 기간: ${item.dateRangeText}</span>` : ''}
                      </p>
                    </div>
                    
                    <div class="text-right">
                      <span class="text-xs text-slate-400 block mb-1">최근 점검 범위</span>
                      <span class="text-sm font-bold text-slate-200">
                        ${item.latestLog ? `${item.latestLog.rangeStart} ~ ${item.latestLog.rangeEnd}쪽` : '-'}
                      </span>
                    </div>
                  </div>

                  <!-- 완료율 게이지 바 -->
                  <div class="mb-4">
                    <div class="flex justify-between items-center text-xs font-bold text-slate-400 mb-1.5">
                      <span>학습 완료율</span>
                      <span class="text-white">${item.completionRate}%</span>
                    </div>
                    <div class="book-track w-full">
                      <div class="completed-seg h-full rounded-full" style="width: ${item.completionRate}%; background: ${tone.bar} !important;"></div>
                    </div>
                  </div>

                  <!-- 미비 쪽수 리스트 -->
                  <div class="bg-slate-900/40 p-4 rounded-xl soft-border">
                    <span class="text-xs font-bold text-slate-400 block mb-2">🚨 보완이 필요한 쪽수 (미완료)</span>
                    ${item.missedPages.length === 0 ? `
                      <span class="text-xs text-emerald-400 font-extrabold">모든 범위가 완벽하게 학습 완료되었습니다! 🎉</span>
                    ` : `
                      <div class="flex flex-wrap gap-1.5">
                        ${item.missedPages.map(page => `
                          <span class="px-2.5 py-1 rounded-lg text-xs font-black bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            ${page}쪽
                          </span>
                        `).join('')}
                      </div>
                    `}
                  </div>

                  <!-- 피드백 코멘트 제공 -->
                  ${item.latestLog && item.latestLog.memo ? `
                    <div class="mt-4 pt-3 border-t border-slate-800/80">
                      <span class="text-xs text-indigo-400 font-bold block mb-1">💬 선생님의 지도 코멘트</span>
                      <p class="text-xs text-slate-300 bg-indigo-950/20 p-3 rounded-lg soft-border italic leading-relaxed">
                        "${safe(item.latestLog.memo)}"
                      </p>
                    </div>
                  ` : ''}
                </article>
              `;
            }).join('')}
          </div>
        `}
      </section>

      <!-- 최근 점검 상세 이력 단일 영역 -->
      <section class="mb-8">
        <article class="card-3d p-6 rounded-2xl">
          <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5 pb-4 border-b border-slate-800/80">
            <div class="flex items-center">
              <div style="width: 4px; height: 1rem; background: ${pipeColor}; margin-right: 0.6rem; border-radius: 2px;"></div>
              <h3 class="text-sm font-bold text-slate-200">최근 점검 상세 이력</h3>
            </div>
            
            <!-- 다중 교재 선택을 위한 필터 칩 영역 (전체보기 및 초기화 기능 포함) -->
            ${bookList.length > 0 ? `
              <div class="flex flex-wrap gap-1.5 items-center">
                <span class="text-[11px] font-bold text-slate-500 mr-1 select-none">교재 필터:</span>
                <button type="button" data-action="filter-student-book" data-id="" class="px-2.5 py-1 rounded-full text-[10px] font-extrabold transition-all border ${!state.selectedStudentBookFilter ? 'bg-[#00d6cd] text-slate-950 border-[#00d6cd]' : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white'}">
                  전체보기
                </button>
                ${bookList.map(item => `
                  <button type="button" data-action="filter-student-book" data-id="${item.book.id}" class="px-2.5 py-1 rounded-full text-[10px] font-extrabold transition-all border ${state.selectedStudentBookFilter === item.book.id ? 'bg-[#00d6cd] text-slate-950 border-[#00d6cd]' : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white'}">
                    ${safe(item.book.title)}
                  </button>
                `).join('')}
              </div>
            ` : ''}
          </div>
          
          <div class="space-y-3 max-h-72 overflow-y-auto pr-2 pt-1 pb-1">
            ${(() => {
              // 선택된 교재 필터가 있으면 필터링
              const filteredInspections = state.selectedStudentBookFilter
                ? myInspections.filter(log => log.bookId === state.selectedStudentBookFilter)
                : myInspections;

              if (filteredInspections.length === 0) {
                return `<div class="text-xs text-slate-500 text-center py-8">해당하는 점검 기록이 존재하지 않습니다.</div>`;
              }

              return filteredInspections.slice(0, 5).map(log => {
                const book = bookById(log.bookId);
                
                // 회차(round)는 필터 여부와 상관없이 이 학생의 원래 전체 점검 배열(myInspections) 기준 순서 유지
                const originalIndex = myInspections.indexOf(log);
                const round = originalIndex !== -1 ? myInspections.length - originalIndex : 1;
                
                // 단원명(unitsForRange) 추출
                const units = (book && unitsForRange) ? unitsForRange(book, log.rangeStart, log.rangeEnd) : [];
                const unitNames = units.map(u => u.name).join(', ');
                const unitText = unitNames ? ` (${unitNames})` : '';

                return `
                  <div class="p-3 bg-slate-900/30 rounded-xl soft-border text-xs flex justify-between items-start gap-3">
                    <div class="min-w-0">
                      <span class="font-extrabold text-slate-200 block">${safe(book?.title || '알 수 없는 교재')}</span>
                      <span class="text-slate-400 mt-1 block leading-relaxed">범위: ${log.rangeStart}~${log.rangeEnd}쪽${safe(unitText)} (완료율 ${log.completionRate}%)</span>
                    </div>
                    <div class="text-right shrink-0 min-w-[72px] pt-0.5">
                      <span class="text-[#00d6cd] font-black block whitespace-nowrap leading-none" title="점검일: ${fmtDate(log.date)}">${round}회차 점검</span>
                      <span class="text-[10px] text-slate-500">${safe(log.teacherName)}T</span>
                    </div>
                  </div>
                `;
              }).join('');
            })()}
          </div>

          <div class="mt-5 pt-5 border-t border-slate-800/80">
            <div class="flex items-center justify-between gap-3 mb-3">
              <div>
                <h4 class="text-xs font-black text-slate-200">단원별 완료율</h4>
                <p class="text-[10px] text-slate-500 mt-1">교재 필터에서 선택한 교재 기준으로 표시됩니다.</p>
              </div>
              ${selectedHistoryBookItem ? `<span class="text-[10px] font-black text-[#00d6cd]">${safe(selectedHistoryBookItem.book.title)}</span>` : ''}
            </div>
            ${!selectedHistoryBookItem ? `
              <div class="rounded-xl border border-dashed border-slate-800 bg-slate-950/20 px-4 py-5 text-center text-xs text-slate-500">
                교재 필터에서 교재를 하나 선택하면 단원별 막대 그래프가 표시됩니다.
              </div>
            ` : selectedUnitRows.length ? `
              <div class="space-y-3">
                ${selectedUnitRows.map(unit => `
                  <div>
                    <div class="flex items-center justify-between gap-3 text-[11px] mb-1.5">
                      <span class="font-bold text-slate-300 truncate">${safe(unit.name)}</span>
                      <span class="font-black text-slate-100 shrink-0">${unit.completionRate}%</span>
                    </div>
                    <div class="h-2.5 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                      <div class="h-full rounded-full" style="width: ${unit.completionRate}%; background: linear-gradient(90deg,#00d6cd,#4169e1);"></div>
                    </div>
                    <div class="mt-1 text-[10px] text-slate-500">
                      ${safe(unit.start)}~${safe(unit.end)}쪽 · 점검 ${unit.checkedCount}쪽 · 미완료 ${unit.missedCount}쪽
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : `
              <div class="rounded-xl border border-dashed border-slate-800 bg-slate-950/20 px-4 py-5 text-center text-xs text-slate-500">
                이 교재에는 등록된 단원 정보가 없습니다.
              </div>
            `}
          </div>
        </article>
      </section>

      <!-- 교재별 6요소 비교 차트 -->
      <section class="mb-8">
        <article class="card-3d p-6 rounded-2xl">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-800/80">
            <div class="flex items-center">
              <div style="width: 4px; height: 1rem; background: ${pipeColor}; margin-right: 0.6rem; border-radius: 2px; box-shadow: 0 0 8px ${pipeColor};"></div>
              <h3 class="text-sm font-bold text-slate-200">교재별 6요소 비교</h3>
            </div>
            ${bookList.length > 0 ? `
              <div class="flex flex-wrap gap-1.5 items-center">
                <span class="text-[11px] font-bold text-slate-500 mr-1 select-none">교재 선택:</span>
                ${bookList.map(item => `
                  <button type="button" data-action="select-student-rubric-book" data-id="${item.book.id}" class="px-2.5 py-1 rounded-full text-[10px] font-extrabold transition-all border ${selectedRubricBookId === item.book.id ? 'bg-[#00d6cd] text-slate-950 border-[#00d6cd]' : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white'}">
                    ${safe(item.book.title)}
                  </button>
                `).join('')}
              </div>
            ` : ''}
          </div>

          ${bookList.length === 0 ? `
            <div class="text-xs text-slate-500 text-center py-8">비교할 교재 점검 기록이 아직 없습니다.</div>
          ` : selectedRubricBookItem ? `
            <div class="mb-3 text-xs text-slate-400">
              선택 교재: <span class="font-black text-slate-100">${safe(selectedRubricBookItem.book.title)}</span>
            </div>
            ${renderRubricCompare('해당 교재 평균 vs 나의 6요소', selectedRubricStudentVector, selectedRubricBookVector, '해당 교재 평균', safe)}
          ` : `
            <div class="rounded-2xl border border-dashed border-slate-800 bg-slate-950/20 px-4 py-8 text-center">
              <div class="text-sm font-black text-slate-300">교재를 하나 선택하면 6요소 비교가 표시됩니다.</div>
              <div class="text-xs text-slate-500 mt-2">전체 교재 평균이 아니라, 선택한 교재 기준으로만 비교합니다.</div>
            </div>
          `}
        </article>
      </section>

      <!-- 하단 정보/로그아웃 -->
      <footer class="text-center mt-12 pb-8">
        <button type="button" data-action="goto-gateway" class="ghost-button px-6 py-2.5 rounded-xl text-xs font-bold transition-all duration-200">
          안전하게 로그아웃 후 메인으로 이동
        </button>
        <p class="text-[11px] text-slate-600 mt-4">
          열린학원 OATIS 교재점검 시스템 &copy; Open Academy Textbook Insight System
        </p>
      </footer>

      <!-- 비밀번호(PIN) 변경 커스텀 모달 -->
      ${state.studentPinModalOpen ? `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn" data-action="close-student-pin-modal">
          <div class="w-full max-w-sm bg-[#11131e] rounded-3xl border border-white/[0.08] p-6 relative z-10 shadow-2xl" onclick="event.stopPropagation()">
            
            <!-- X 닫기 버튼 -->
            <button type="button" data-action="close-student-pin-modal" class="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <!-- 타이틀 -->
            <div class="flex items-center mb-6">
              <div style="width: 4px; height: 1.1rem; background: ${pipeColor}; margin-right: 0.6rem; border-radius: 2px; box-shadow: 0 0 8px ${pipeColor};"></div>
              <h3 class="text-base font-extrabold text-slate-100">비밀번호(PIN) 변경</h3>
            </div>

            <!-- 내용 입력 폼 -->
            <div class="space-y-4">
              <label class="field mb-0 block">
                <span class="text-xs text-slate-400 block mb-1.5 font-bold">새로운 4자리 PIN번호 입력</span>
                <input type="text" inputmode="numeric" autocomplete="one-time-code" style="-webkit-text-security: disc;" id="changeNewPin" placeholder="숫자 4자리" maxlength="4" class="w-full p-3 rounded-xl bg-black/40 border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#00d6cd] transition-all" value="${state.studentLoginForm.newPin || ''}" />
              </label>
              
              <label class="field mb-0 block">
                <span class="text-xs text-slate-400 block mb-1.5 font-bold">PIN번호 확인 입력</span>
                <input type="text" inputmode="numeric" autocomplete="one-time-code" style="-webkit-text-security: disc;" id="changeConfirmPin" placeholder="한번 더 입력" maxlength="4" class="w-full p-3 rounded-xl bg-black/40 border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#00d6cd] transition-all" value="${state.studentLoginForm.confirmNewPin || ''}" />
              </label>
              
              <button type="button" data-action="student-pin-change-submit" class="w-full py-3 rounded-xl text-sm font-black mt-4 bg-[#00d6cd] text-slate-950 hover:bg-[#00b5ad] active:scale-95 transition-all shadow-[0_0_15px_rgba(0,214,205,0.2)]">
                비밀번호 변경 적용
              </button>
            </div>

          </div>
        </div>
      ` : ''}

    </div>
  `;
}
