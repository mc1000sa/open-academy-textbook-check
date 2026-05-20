import { bookMap } from './setupView.js';
import { renderBtnSelect } from './layoutView.js';

export const REMARK_GROUPS = [
  { group:'식 관련', items:['글씨를 매우 잘 쓰는 학생입니다.','풀이 과정을 꼼꼼하게 정리하는 편입니다.','수학적 체계가 전혀 안 잡혀 있습니다.','식을 세우는 과정에서 중간 단계가 자주 생략됩니다.','계산 과정은 맞지만 정리 습관이 더 필요합니다.'] },
  { group:'채점 관련', items:['채점 약속을 잘 지켜서 매우 깔끔하게 했습니다.','오답 표시가 부족해 다시 확인이 필요합니다.','틀린 문제를 다시 고치는 습관이 필요합니다.','채점은 되어 있으나 오답 정리가 부족합니다.'] },
  { group:'과제 관련', items:['과제를 성실하게 완성해 왔습니다.','미완료 페이지가 있어 다음 시간에 재점검이 필요합니다.','정해진 범위보다 더 많이 진행했습니다.','과제 수행 속도가 조금 느린 편입니다.'] },
  { group:'이해도 관련', items:['기본 개념 이해는 안정적인 편입니다.','유형이 바뀌면 적용을 어려워합니다.','반복 연습 후 정확도가 올라가는 편입니다.','개념 설명을 다시 듣고 나면 문제 해결이 가능합니다.'] }
];

export function renderInspectionsView(state, deps) {
  const {
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
    bookUnits
  } = deps;

  const classes = state.currentTeacher.role==='admin' ? state.classes : teacherClasses(state.currentTeacher.id);
  const students = studentsForClass(state.selectedInspectionClassId);
  const assigned = assignedBooksForClass(state.selectedInspectionClassId);
  const selectedBook = bookById(state.selectedInspectionBookId);
  const units = selectedBook && state.selectedRangeStart && state.selectedRangeEnd ? unitsForRange(selectedBook, state.selectedRangeStart, state.selectedRangeEnd) : [];
  const total = pagesInRange(state.selectedRangeStart, state.selectedRangeEnd);
  const missed = missedPagesArrayInCurrentRange();
  const missedSet = new Set(missed);
  const donePct = total.length ? Math.round(((total.length-missed.length)/total.length)*100) : 0;

  // 1. 테이블 동적 정렬 로직 보완
  const sortKey = state.sortKey || 'date';
  const sortOrder = state.sortOrder || 'desc';

  const historyRows = state.inspections
    .filter(r => (!state.inspectionHistoryFilterClass || r.classId === state.inspectionHistoryFilterClass) && (!state.inspectionHistoryFilterStudent || r.studentId === state.inspectionHistoryFilterStudent))
    .sort((a, b) => {
      let valA = a[sortKey];
      let valB = b[sortKey];

      // 이름, 교재명 등 결합 컬럼 정렬 변환
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
        // 숫자 혹은 날짜 정렬
        const timeA = new Date(valA).getTime() || Number(valA || 0);
        const timeB = new Date(valB).getTime() || Number(valB || 0);
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }
    })
    .slice(0, 20);

  // 정렬 헤더 유틸리티
  const sortIndicator = (key) => {
    if (sortKey === key) {
      return sortOrder === 'asc' ? ' <span class="text-blue-400">▲</span>' : ' <span class="text-blue-400">▼</span>';
    }
    return ' <span class="text-slate-600">↕</span>';
  };
  
  const pageButtons = total.length ? `
    <div class="mt-4 rounded-2xl border border-blue-500/20 bg-slate-900/40 p-4">
      <div class="flex items-center justify-between gap-3 mb-3">
        <div>
          <div class="text-xs font-extrabold text-slate-200">미완료 페이지 체크하기</div>
          <div class="text-[10px] text-slate-500 mt-0.5">완료하지 못한 페이지만 눌러주세요. 다시 누르면 해제됩니다.</div>
        </div>
        <button type="button" data-action="clear-missed-pages" class="ghost-button px-2.5 py-1.5 rounded-lg text-[10px] font-black">체크 초기화</button>
      </div>
      <div class="flex flex-wrap gap-1.5">
        ${total.map(p=>`<button type="button" data-action="toggle-missed-page" data-page="${p}" class="min-w-8 h-8 rounded-lg border text-xs font-black transition ${missedSet.has(p) ? 'bg-rose-500/80 border-rose-500 text-white shadow-sm' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-blue-500 hover:text-white'}">${p}</button>`).join('')}
      </div>
    </div>
  ` : `
    <div class="mt-4 rounded-2xl border border-dashed border-slate-800 bg-slate-950/20 p-5 text-xs text-slate-500 text-center">
      시작 페이지와 끝 페이지 입력 후 <b>페이지 체크 만들기</b>를 누르면 체크박스처럼 선택할 수 있습니다.
    </div>
  `;

  const remarkButtons = `
    <div class="mt-4 rounded-2xl border border-slate-800 bg-slate-950/20 p-4">
      <div class="text-xs font-extrabold text-slate-300 mb-3">대표 특이사항 선택</div>
      <div class="space-y-4">
        ${REMARK_GROUPS.map(group=>`
          <div>
            <div class="text-[10px] font-extrabold text-blue-400 mb-2">${safe(group.group)}</div>
            <div class="flex flex-wrap gap-1.5">
              ${group.items.map(item=>`
                <button type="button" data-action="append-remark" data-text="${safe(item)}" class="rounded-full border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-[10px] font-bold text-slate-400 hover:border-blue-500 hover:bg-blue-950/20 hover:text-white transition-all">
                  ${safe(item)}
                </button>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
      <div class="mt-3 text-[10px] text-slate-500">버튼을 누르면 괄호 제목 없이 문장만 특이사항에 추가됩니다.</div>
    </div>
  `;

  // 강사 포털의 고유 컬러(Royal Blue) 톤 버튼 스타일 적용
  const btnClass = 'btn-teacher';

  return `
    <div class="space-y-6">
      <div class="grid xl:grid-cols-[1.1fr_0.9fr] gap-6">
        
        <!-- 좌측 입력 카드 (부드러운 스크롤을 위한 ID 부여) -->
        <article class="card-3d rounded-2xl p-5 md:p-6" id="inspectionFormArea">
          <div class="flex items-center justify-between gap-3 mb-4">
            <h3 class="text-base font-extrabold text-white">학생별 교재점검</h3>
            <span class="text-[10px] text-slate-400 font-bold">${state.editingInspectionId ? '기존 기록 수정 중' : '강사용 입력 화면'}</span>
          </div>

          <div class="grid md:grid-cols-2 gap-4">
            <div class="text-xs font-bold text-slate-400">반 선택
              ${renderBtnSelect({
                id: 'selectedInspectionClassId',
                options: classes.map(c=>({ value: c.id, label: c.name })),
                selectedValue: state.selectedInspectionClassId,
                placeholder: '점검할 반을 선택하세요.'
              })}
            </div>
            
            <div class="text-xs font-bold text-slate-400">학생 선택
              ${renderBtnSelect({
                id: 'selectedInspectionStudentId',
                options: students.map(s=>({ value: s.id, label: s.name })),
                selectedValue: state.selectedInspectionStudentId,
                placeholder: '반을 선택하면 학생 목록이 나옵니다.'
              })}
            </div>
            
            <div class="text-xs font-bold text-slate-400">교재 선택
              ${renderBtnSelect({
                id: 'selectedInspectionBookId',
                options: assigned.map(x=>({ value: x.book.id, label: x.book.title })),
                selectedValue: state.selectedInspectionBookId,
                placeholder: '반을 선택하면 교재 목록이 나옵니다.'
              })}
            </div>
            
            <label class="text-xs font-bold text-slate-400 block">점검일
              <input id="selectedDate" type="date" class="mt-2 w-full border border-slate-800 rounded-xl px-4 py-2.5 bg-slate-900 text-xs text-white focus:outline-none focus:border-blue-500 transition-all" value="${safe(state.selectedDate)}" />
            </label>
          </div>

          <div class="mt-4 grid md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <label class="text-xs font-bold text-slate-400 block w-full">시작 페이지
              <input id="selectedRangeStart" type="number" class="mt-2 w-full border border-slate-800 rounded-xl px-4 py-2.5 bg-slate-900 text-xs text-white focus:outline-none focus:border-blue-500 transition-all" value="${safe(state.selectedRangeStart)}" />
            </label>
            <label class="text-xs font-bold text-slate-400 block w-full">끝 페이지
              <input id="selectedRangeEnd" type="number" class="mt-2 w-full border border-slate-800 rounded-xl px-4 py-2.5 bg-slate-900 text-xs text-white focus:outline-none focus:border-blue-500 transition-all" value="${safe(state.selectedRangeEnd)}" />
            </label>
            <button type="button" data-action="build-page-checks" class="h-[38px] rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/50 text-white font-extrabold px-4 text-xs transition-all shadow-sm">페이지 체크 만들기</button>
          </div>

          ${pageButtons}

          <label class="block mt-4 text-xs font-bold text-slate-400">미완료 페이지 구간 입력 <span class="text-[10px] text-slate-500 font-medium">(체크 시 자동 완성)</span>
            <input id="missedPages" type="text" class="mt-2 w-full border border-slate-800 rounded-xl px-4 py-2.5 bg-slate-900 text-xs text-white focus:outline-none focus:border-blue-500 transition-all" placeholder="예: 12,13,16-18" value="${safe(state.missedPages)}" />
          </label>
          
          <label class="block mt-4 text-xs font-bold text-slate-400">특이사항
            <textarea id="memo" class="mt-2 w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white focus:outline-none focus:border-blue-500 transition-all min-h-[110px]" placeholder="특이사항 입력 또는 대표 멘트 선택">${safe(state.memo)}</textarea>
          </label>

          ${remarkButtons}

          <div class="mt-6 flex flex-wrap gap-2.5">
            <button type="button" data-action="save-inspection" class="${btnClass} rounded-xl px-5 py-3 text-xs font-extrabold shadow-md">${state.editingInspectionId ? '수정 저장 완료' : '점검 내역 저장'}</button>
            <button type="button" data-action="reset-inspection-form" class="ghost-button rounded-xl px-5 py-3 text-xs font-extrabold">입력 초기화</button>
            <button type="button" data-action="open-quick-mode" class="ghost-button rounded-xl px-5 py-3 text-xs font-extrabold">반 순회 점검 모드</button>
          </div>
        </article>

        <!-- 우측 자동분석 카드 -->
        <article class="card-3d rounded-2xl p-5 md:p-6">
          <div class="flex items-center justify-between gap-3 mb-4">
            <h3 class="text-base font-extrabold text-white">자동 분석</h3>
            <span class="text-[10px] text-slate-400 font-bold">선택 범위 기준</span>
          </div>

          <div class="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <div class="text-xs font-bold text-slate-300">해당 대단원</div>
            <div class="mt-3 flex flex-wrap gap-1.5">
              ${units.length ? units.map((u)=>`<span class="unit-chip text-[10px] py-1 px-2.5 font-bold" style="background:${u.color};">${safe(u.name)} (${u.start}~${u.end})</span>`).join('') : '<span class="text-xs text-slate-500">단원이 아직 표시되지 않았습니다.</span>'}
            </div>
          </div>

          <div class="rounded-xl border border-slate-800 bg-slate-950/40 p-4 mt-4">
            <div class="flex items-center justify-between gap-3">
              <div class="text-xs font-bold text-slate-300">완료 / 미완료 진행률</div>
              <div class="text-xs font-black text-blue-400">${donePct}%</div>
            </div>
            
            <div class="book-track mt-3 w-full h-2 rounded-full overflow-hidden">
              <div class="completed-seg h-full bg-blue-500" style="width:${donePct}%"></div>
            </div>
            
            <div class="book-track mt-2 w-full h-2 rounded-full overflow-hidden">
              <div class="incomplete-seg h-full bg-rose-500/30" style="width:${100-donePct}%"></div>
            </div>
            
            <div class="mt-3 text-[10px] text-slate-500 leading-normal">
              전체 ${total.length}쪽 중 미완료 ${missed.length}쪽 &middot; 나머지는 자동 완료 처리됩니다.
            </div>
          </div>

          ${selectedBook ? bookMap(selectedBook, { bookUnits, safe }) : ''}
        </article>
      </div>

      <!-- 반 순회 점검 모드 카드 -->
      <article id="quickMode" class="card-3d rounded-2xl p-5 md:p-6 ${state.quickClassId ? '' : 'hidden'}">
        <div class="flex items-center justify-between gap-3 mb-4">
          <h3 class="text-base font-extrabold text-white">반 순회 점검 모드</h3>
          <span class="text-[10px] text-slate-400 font-bold">수업 직후 빠른 입력</span>
        </div>
        
        <div class="mb-4 no-print flex flex-col gap-2">
          <span class="text-xs font-bold text-slate-400">순회할 반 선택</span>
          ${renderBtnSelect({
            id: 'quickClassId',
            options: classes.map(c=>({ value: c.id, label: c.name })),
            selectedValue: state.quickClassId,
            placeholder: '반을 먼저 선택하세요.'
          })}
        </div>

        <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          ${studentsForClass(state.quickClassId).map(s=>{ 
            const latest = inspectionsForStudent(s.id)[0]; 
            return `
              <div class="rounded-xl border border-slate-800 bg-slate-900/20 p-4 flex flex-col justify-between">
                <div>
                  <div class="font-extrabold text-sm text-slate-200">${safe(s.name)}</div>
                  <div class="text-[11px] text-slate-500 mt-1">최근: ${latest ? fmtDate(latest.date) + ' &middot; ' + latest.completionRate + '%' : '점검 기록 없음'}</div>
                </div>
                <button type="button" class="mt-4 w-full rounded-xl bg-slate-850 hover:bg-blue-950/20 hover:text-blue-400 px-3 py-2 text-xs font-extrabold transition-all border border-slate-800 text-slate-400" data-action="quick-fill" data-id="${s.id}">
                  이 학생으로 불러오기
                </button>
              </div>
            `; 
          }).join('') || '<div class="text-slate-500 text-xs text-center py-6 col-span-full">순회할 반을 선택하시면 반 소속 학생 카드가 나타납니다.</div>'}
        </div>
      </article>

      <!-- 하단 최근 점검 기록 테이블 카드 -->
      <article class="card-3d rounded-2xl p-5 md:p-6">
        <div class="flex items-center justify-between gap-3 mb-4">
          <h3 class="text-base font-extrabold text-white">최근 점검 기록</h3>
          <span class="text-[10px] text-slate-400 font-bold">기존 기록 수정/삭제 가능</span>
        </div>

        <div class="grid md:grid-cols-2 gap-4 mb-5">
          <div class="flex flex-col gap-2">
            <span class="text-xs font-bold text-slate-400">반 필터</span>
            ${renderBtnSelect({
              id: 'inspectionHistoryFilterClass',
              options: [{ value: '', label: '전체 반' }, ...classes.map(c=>({ value: c.id, label: c.name }))],
              selectedValue: state.inspectionHistoryFilterClass || '',
              placeholder: '선택할 반이 없습니다.'
            })}
          </div>
          
          <div class="flex flex-col gap-2">
            <span class="text-xs font-bold text-slate-400">학생 필터</span>
            ${renderBtnSelect({
              id: 'inspectionHistoryFilterStudent',
              options: [{ value: '', label: '전체 학생' }, ...state.students.filter(s=>!state.inspectionHistoryFilterClass || s.classId===state.inspectionHistoryFilterClass).sort((a,b)=>String(a.name).localeCompare(String(b.name),'ko')).map(s=>({ value: s.id, label: `${s.name} (${classById(s.classId)?.name || '-'})` }))],
              selectedValue: state.inspectionHistoryFilterStudent || '',
              placeholder: '학생이 없습니다.'
            })}
          </div>
        </div>

        <div class="overflow-x-auto mini-scroll">
          <table class="w-full text-sm text-center border-collapse">
            <thead>
              <tr class="border-b border-slate-800 bg-slate-900/40 text-slate-400 text-xs font-bold uppercase">
                <!-- clickable-text 클래스를 주어 입체적인 호버 효과 제공 -->
                <th class="py-3 cursor-pointer clickable-text" data-sort="date">날짜 ${sortIndicator('date')}</th>
                <th class="cursor-pointer clickable-text" data-sort="classId">반 ${sortIndicator('classId')}</th>
                <th class="cursor-pointer clickable-text" data-sort="studentId">학생 ${sortIndicator('studentId')}</th>
                <th class="cursor-pointer clickable-text" data-sort="bookId">교재 ${sortIndicator('bookId')}</th>
                <th class="py-3">범위</th>
                <th class="py-3">미완료</th>
                <th class="cursor-pointer clickable-text" data-sort="completionRate">완료율 ${sortIndicator('completionRate')}</th>
                <th class="py-3">관리</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/80">
              ${historyRows.length ? historyRows.map(r=>`
                <tr class="hover:bg-slate-900/20 transition-all text-xs">
                  <td class="py-3 text-slate-300 font-bold">${safe(fmtDate(r.date))}</td>
                  <td class="text-slate-400">${safe(classById(r.classId)?.name || '-')}</td>
                  <td class="text-slate-200 font-semibold">${safe(studentById(r.studentId)?.name || '-')}</td>
                  <td class="text-slate-300">${safe(bookById(r.bookId)?.title || '-')}</td>
                  <td class="text-slate-400">${safe(r.rangeStart)}~${safe(r.rangeEnd)}쪽</td>
                  <td class="text-rose-400 font-bold">${safe((r.missedPages || []).join(', ') || '없음')}</td>
                  <td class="font-extrabold text-blue-400">${safe(r.completionRate)}%</td>
                  <td>
                    <div class="flex justify-center gap-1.5">
                      <button type="button" data-action="edit-inspection" data-id="${r.id}" class="rounded-lg bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 text-[11px] font-bold text-blue-400 hover:bg-blue-500 hover:text-white transition-all">수정</button>
                      <button type="button" data-action="delete-inspection" data-id="${r.id}" class="rounded-lg bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 text-[11px] font-bold text-rose-400 hover:bg-rose-500 hover:text-white transition-all">삭제</button>
                    </div>
                  </td>
                </tr>
              `).join('') : '<tr><td colspan="8" class="py-8 text-slate-500 text-center">점검 기록이 존재하지 않습니다.</td></tr>'}
            </tbody>
          </table>
        </div>
      </article>
      
    </div>
  `;
}
