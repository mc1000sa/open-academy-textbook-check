import { renderBtnSelect } from './layoutView.js';

export function bookMap(book, deps) {
  const { bookUnits, safe } = deps;
  const list = bookUnits(book);
  if (!list.length) return `<div class="rounded-xl border border-dashed border-slate-700 p-5 text-center text-xs text-slate-500 mt-4">단원 정보가 등록되어 있지 않습니다.</div>`;
  return `
    <div class="mt-4 rounded-xl border border-slate-800 bg-slate-900/20 p-4 shadow-inner">
      <div class="text-xs font-extrabold text-slate-300 mb-3">${safe(book.title)} 단원 맵</div>
      <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
        ${list.map(u => {
          const visibleToStudent = u.visibleToStudent !== false;
          return `
          <div class="rounded-xl border border-slate-800 bg-slate-900/40 p-3 shadow-sm">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="text-xs font-extrabold text-slate-200 truncate" title="${safe(u.name)}">${safe(u.name)}</div>
                <div class="text-[10px] text-slate-500 mt-1 font-bold">${u.start}~${u.end}쪽 (${Number(u.end) - Number(u.start) + 1}p)</div>
              </div>
              <span class="shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black ${visibleToStudent ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-900 text-slate-500'}">
                ${visibleToStudent ? '공개' : '숨김'}
              </span>
            </div>
            <button type="button" data-action="toggle-unit-student-visible" data-book="${book.id}" data-unit="${u.id}" class="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/40 px-2 py-1.5 text-[10px] font-bold text-slate-400 hover:border-cyan-500/50 hover:text-cyan-300 transition-colors">
              학생 화면 ${visibleToStudent ? '숨기기' : '공개하기'}
            </button>
          </div>
        `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderAccordionItem(stateGroup, target, title, icon, colorClass, isOpen, children) {
  return `
    <div class="rounded-[28px] border transition-all duration-300 ${isOpen ? 'border-violet-500/40 ring-4 ring-violet-500/20 bg-slate-900/40 shadow-xl' : 'border-slate-800 bg-slate-900/40 shadow-sm hover:border-slate-700'} mb-6">
      <button
        type="button"
        data-action="toggle-accordion"
        data-group="${stateGroup}"
        data-target="${target}"
        class="w-full flex items-center justify-between px-6 py-5 hover:bg-slate-900/20/50 transition-colors rounded-[28px]"
      >
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-2xl ${colorClass} flex items-center justify-center text-sm shadow-sm">
            <i class="fas ${icon}"></i>
          </div>
          <span class="font-black text-slate-200 text-[15px]">${title}</span>
        </div>
        <div class="w-6 h-6 rounded-full flex items-center justify-center transition-transform duration-300 ${isOpen ? 'bg-violet-600 text-white rotate-180' : 'bg-slate-800/50 text-slate-400'}">
          <i class="fas fa-chevron-down text-[10px]"></i>
        </div>
      </button>
      ${isOpen ? `
        <div class="px-6 pb-6 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <div class="h-px bg-slate-800/50 mb-5"></div>
          ${children}
        </div>
      ` : ''}
    </div>
  `;
}

export function renderBookSetupView(state, deps) {
  const {
    teacherClasses,
    classById,
    assignedBooksForClass,
    completedBooksForClass,
    bookUnits,
    safe,
    bookById,
    standardSubjectForBook,
    standardUnitNames,
    fmtDate
  } = deps;

  const availableClasses = state.currentTeacher.role === 'admin' ? state.classes : teacherClasses(state.currentTeacher.id);
  const activeBooks = state.books.filter(b => !b.archived).sort((a, b) => String(a.title).localeCompare(String(b.title), 'ko'));
  const archivedBooks = state.books.filter(b => b.archived).sort((a, b) => String(a.title).localeCompare(String(b.title), 'ko'));

  const GRADE_OPTIONS = ['고1', '고2', '고3'];
  const STANDARD_SUBJECT_OPTIONS = (state.standardUnitSubjects || []).map(subject => subject.label);
  const SUBJECT_OPTIONS = [...new Set(STANDARD_SUBJECT_OPTIONS)];
  const BOOK_TYPE_OPTIONS = [
    { value: 'standard', label: '일반 교재' },
    { value: 'exam_chapter', label: '시험대비 챕터 교재' }
  ];

  const isAdmin = state.currentTeacher?.role === 'admin';
  const btnClass = isAdmin ? 'btn-admin' : 'btn-teacher';
  
  const acc = state.bookSetupAccordion || { manage: true, unit: false, assign: false };
  const selectedBookForUnits = bookById(state.selectedBookManageId);
  const standardSubject = selectedBookForUnits && typeof standardSubjectForBook === 'function'
    ? standardSubjectForBook(selectedBookForUnits)
    : null;
  const selectedStandardUnitIds = new Set(state.formUnit.standardUnitIds || []);
  const selectedStandardNames = typeof standardUnitNames === 'function'
    ? standardUnitNames([...selectedStandardUnitIds])
    : [];
  const activeAssignedBooks = state.assigningClassId && typeof assignedBooksForClass === 'function'
    ? assignedBooksForClass(state.assigningClassId)
    : [];
  const completedAssignedBooks = state.assigningClassId && typeof completedBooksForClass === 'function'
    ? completedBooksForClass(state.assigningClassId)
    : [];
  const formatCompletedDate = (value) => {
    const raw = value?.toDate?.() || value;
    const formatted = typeof fmtDate === 'function' ? fmtDate(raw) : '';
    return formatted === '-' ? '' : formatted;
  };
  const stripBookSubjectFromTitle = (subject, title) => {
    const cleanSubject = String(subject || '').trim();
    const cleanTitle = String(title || '').trim();
    if (!cleanSubject) return cleanTitle;
    if (cleanTitle === cleanSubject) return '';
    const prefixPattern = new RegExp(`^${cleanSubject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s_-]+`);
    return cleanTitle.replace(prefixPattern, '').trim();
  };
  const bookTitleBase = stripBookSubjectFromTitle(state.formBook.subject, state.formBook.title);
  const formBookType = state.formBook.bookType || 'standard';
  const selectedBookIsExamChapter = selectedBookForUnits?.bookType === 'exam_chapter';
  const standardUnitTableRows = (() => {
    if (!selectedBookForUnits || !standardSubject) return [];
    const rawUnits = [...(selectedBookForUnits.units || [])].sort((a, b) => Number(a.start || 0) - Number(b.start || 0));
    return standardSubject.units.filter(unit => unit.active !== false).map(unit => {
      const linkedUnit = rawUnits.find(bookUnit => (bookUnit.standardUnitIds || []).includes(unit.id));
      const linkedIds = linkedUnit?.standardUnitIds || [];
      const firstLinkedId = linkedIds[0];
      const lastLinkedId = linkedIds[linkedIds.length - 1];
      return {
        ...unit,
        unitName: linkedUnit?.name || '',
        start: firstLinkedId === unit.id ? linkedUnit?.start || '' : '',
        end: lastLinkedId === unit.id ? linkedUnit?.end || '' : ''
      };
    });
  })();
  const activeStandardUnits = standardSubject?.units?.filter(unit => unit.active !== false) || [];
  const examChapterRows = (() => {
    if (!selectedBookForUnits) return [];
    const existingUnits = [...(selectedBookForUnits.units || [])].sort((a, b) => Number(a.start || 0) - Number(b.start || 0));
    const chapterCount = Math.max(1, Math.min(40, Number(selectedBookForUnits.chapterCount || existingUnits.length || 10) || 10));
    return Array.from({ length: Math.max(chapterCount, existingUnits.length) }, (_, index) => {
      const unit = existingUnits[index] || {};
      return {
        chapterName: unit.name || `챕터 ${index + 1}`,
        start: unit.start || '',
        end: unit.end || '',
        standardUnitIds: unit.standardUnitIds || []
      };
    });
  })();
  const examCommonStandardIds = new Set(
    activeStandardUnits
      .filter(unit => examChapterRows.length && examChapterRows.every(row => (row.standardUnitIds || []).includes(unit.id)))
      .map(unit => unit.id)
  );

  // 1. 교재 자산 관리 콘텐츠
  const manageContent = `
    <div class="space-y-4 text-slate-200">
      <div class="flex flex-col gap-2">
        <span class="text-xs font-bold text-slate-400">교재 유형</span>
        ${renderBtnSelect({
          id: 'bookType',
          options: BOOK_TYPE_OPTIONS,
          selectedValue: formBookType,
          placeholder: '교재 유형 선택'
        })}
      </div>

      <div class="grid md:grid-cols-2 gap-4">
        <div class="flex flex-col gap-2">
          <span class="text-xs font-bold text-slate-400">수학 교과목 선택</span>
          ${renderBtnSelect({
            id: 'bookSubject',
            options: SUBJECT_OPTIONS.map(s => ({ value: s, label: s })),
            selectedValue: state.formBook.subject,
            placeholder: '수학 교과목 선택'
          })}
        </div>
        <div class="flex flex-col gap-2">
          <span class="text-xs font-bold text-slate-400">대상 학년</span>
          ${renderBtnSelect({
            id: 'bookGrade',
            options: GRADE_OPTIONS.map(g => ({ value: g, label: g })),
            selectedValue: state.formBook.grade,
            placeholder: '학년 선택'
          })}
        </div>
      </div>

      <div class="block text-xs font-bold text-slate-400">
        <span>교재 이름</span>
        <div class="mt-1.5 grid grid-cols-[minmax(120px,0.42fr)_1fr] gap-2">
          <input class="w-full border border-slate-800 rounded-xl p-3 bg-slate-950/60 text-xs text-cyan-200 font-black focus:outline-none" value="${safe(state.formBook.subject || '교과목 먼저 선택')}" readonly />
          <input id="bookTitleBase" class="w-full border border-slate-800 rounded-xl p-3 bg-slate-900/40 text-xs text-slate-200 focus:outline-none focus:ring-2 ring-violet-500/200/20" placeholder="예: 블랙라벨, RPM, 쎈" value="${safe(bookTitleBase)}" />
        </div>
      </div>

      ${formBookType === 'exam_chapter' ? `
        <label class="block text-xs font-bold text-slate-400">
          챕터 수
          <input id="bookChapterCount" type="number" min="1" max="40" class="mt-1.5 w-32 border border-slate-800 rounded-xl p-3 bg-slate-900/40 text-xs text-slate-200 focus:outline-none focus:ring-2 ring-violet-500/20" value="${safe(state.formBook.chapterCount || 10)}" />
          <span class="ml-2 text-[10px] font-medium text-slate-500">챕터별 난이도 상승형 시험대비 교재에 사용합니다.</span>
        </label>
      ` : ''}

      <div class="flex gap-2">
        <button type="button" data-action="save-book" class="${btnClass} rounded-xl px-4 py-2.5 text-xs font-extrabold text-white">${state.editingBookId ? '교재 수정 반영' : '신규 교재 생성'}</button>
        <button type="button" data-action="reset-book-form" class="ghost-button border border-slate-800 text-slate-400 bg-slate-900/40 hover:bg-slate-900/20 rounded-xl px-4 py-2.5 text-xs">초기화</button>
      </div>

      <div class="border-t border-slate-800 pt-4 mt-2">
        <span class="text-xs font-bold text-slate-500 block mb-3">사용 중인 교재 자산 (${activeBooks.length}권):</span>
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 max-h-[500px] overflow-y-auto mini-scroll pr-1 mb-4">
          ${activeBooks.map(b => `
            <div class="rounded-xl border border-slate-800 bg-slate-900/40 px-3.5 py-3 shadow-sm hover:border-violet-500/40 transition-colors flex flex-col justify-between">
              <div>
                <div class="flex justify-between items-start gap-2 text-xs">
                  <div class="font-black text-slate-200 leading-snug break-all">${safe(b.title)}</div>
                  <span class="text-[9px] font-black text-emerald-400 bg-emerald-950/40 border border-emerald-900 px-1.5 py-0.5 rounded shrink-0">활성</span>
                </div>
                <div class="text-[10px] text-slate-500 mt-1.5 font-bold">${safe(b.subject || '-')} &middot; ${safe(b.grade || '-')}</div>
              </div>
              <div class="mt-4 flex flex-wrap gap-1.5">
                <button type="button" data-action="edit-book" data-id="${b.id}" class="rounded bg-slate-950 border border-slate-800 hover:bg-slate-800/50 text-slate-400 px-2 py-1.5 text-[10px] font-bold">수정</button>
                <button type="button" data-action="clone-book" data-id="${b.id}" class="rounded bg-slate-950 border border-slate-800 hover:bg-slate-800/50 text-slate-400 px-2 py-1.5 text-[10px] font-bold">복제</button>
                <button type="button" data-action="toggle-book-archive" data-id="${b.id}" class="rounded bg-rose-950/60 border border-rose-900 text-rose-400 hover:bg-rose-900 hover:text-white px-2 py-1.5 text-[10px] font-bold transition-colors">보관</button>
                <button type="button" data-action="select-book-manage" data-id="${b.id}" class="rounded bg-cyan-950 border border-cyan-800 text-cyan-400 hover:bg-cyan-500 hover:text-white px-2 py-1.5 text-[10px] font-bold transition-colors">단원설정</button>
              </div>
            </div>
          `).join('')}
          ${activeBooks.length === 0 ? '<div class="text-xs text-slate-400 py-6 text-center col-span-full">등록된 교재가 존재하지 않습니다.</div>' : ''}
        </div>

        <details class="group border border-slate-800 rounded-xl bg-slate-900/20 p-3 transition-all duration-200">
          <summary class="flex items-center justify-between cursor-pointer font-bold text-slate-500 text-xs list-none select-none">
            <span>📦 보관함 교재 (${archivedBooks.length}권)</span>
            <span class="transition-transform duration-200 group-open:rotate-180 text-[10px] text-slate-400">▼</span>
          </summary>
          <div class="mt-3.5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 max-h-[350px] overflow-y-auto mini-scroll pr-1">
            ${archivedBooks.map(b => `
              <div class="rounded-xl border border-slate-800 bg-slate-900/40 px-3.5 py-3 shadow-sm flex flex-col justify-between">
                <div>
                  <div class="flex justify-between items-start gap-2 text-xs">
                    <div class="font-black text-slate-400 leading-snug break-all">${safe(b.title)}</div>
                    <span class="text-[9px] font-black text-rose-400 bg-rose-950/40 border border-rose-900 px-1.5 py-0.5 rounded shrink-0">보관</span>
                  </div>
                  <div class="text-[10px] text-slate-500 mt-1.5 font-bold">${safe(b.subject || '-')} &middot; ${safe(b.grade || '-')}</div>
                </div>
                <div class="mt-4 flex flex-wrap gap-1.5">
                  <button type="button" data-action="toggle-book-archive" data-id="${b.id}" class="rounded bg-emerald-950 border border-emerald-900 text-emerald-400 hover:bg-emerald-500 hover:text-white px-2 py-1.5 text-[10px] font-bold transition-all">부활 (복구)</button>
                  <button type="button" data-action="delete-book" data-id="${b.id}" class="rounded bg-rose-950 border border-rose-900 text-rose-400 hover:bg-rose-900 hover:text-white px-2 py-1.5 text-[10px] font-bold transition-all">영구 삭제</button>
                </div>
              </div>
            `).join('')}
            ${archivedBooks.length === 0 ? '<div class="text-[10px] text-slate-400 py-3 text-center col-span-full">보관함이 비어 있습니다.</div>' : ''}
          </div>
        </details>
      </div>
    </div>
  `;

  // 2. 단원 입력 및 페이지 맵 콘텐츠
  const unitContent = `
    <div class="space-y-4 text-slate-200">
      <div class="flex flex-col gap-2">
        <span class="text-xs font-bold text-slate-400">단원 설정을 진행할 교재 선택</span>
        ${renderBtnSelect({
          id: 'selectedBookManageId',
          options: activeBooks.map(b => ({ value: b.id, label: b.title })),
          selectedValue: state.selectedBookManageId,
          placeholder: '선택 가능한 활성 교재 자산이 없습니다.'
        })}
      </div>

      ${selectedBookForUnits && standardSubject && selectedBookIsExamChapter ? `
        <div class="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-4">
          <div class="flex items-start justify-between gap-3 mb-4">
            <div>
              <div class="text-xs font-extrabold text-amber-200">시험대비 챕터 기준 페이지 맵</div>
              <div class="text-[10px] text-slate-500 mt-1">챕터별로 난이도가 올라가는 자체 제작 교재용입니다. 각 챕터에 시험범위 표준소단원을 여러 개 연결할 수 있습니다.</div>
            </div>
            <span class="shrink-0 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-black text-amber-200">${safe(standardSubject.label)}</span>
          </div>
          <div class="overflow-x-auto mini-scroll">
            <div class="min-w-[920px]">
              <div class="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                <div class="mb-2 text-[10px] font-black text-amber-200">전 챕터 표준소단원 선택</div>
                <div class="flex flex-wrap gap-1.5">
                  ${activeStandardUnits.map(unit => `
                    <label class="cursor-pointer rounded-full border px-2 py-1 text-[10px] font-bold transition-colors ${examCommonStandardIds.has(unit.id) ? 'border-amber-300 bg-amber-300/20 text-amber-100' : 'border-slate-700 bg-slate-950/60 text-slate-400 hover:border-amber-500/60 hover:text-amber-200'}">
                      <input type="checkbox" data-field="allChapterStandardUnit" value="${safe(unit.id)}" class="mr-1 align-middle accent-amber-400" ${examCommonStandardIds.has(unit.id) ? 'checked' : ''} />
                      ${safe(unit.label)}
                    </label>
                  `).join('')}
                </div>
                <div class="mt-2 text-[10px] font-medium text-slate-500">여기서 선택하면 모든 챕터에 반영됩니다. 각 챕터 안에서 필요한 항목만 다시 체크/해제할 수 있습니다.</div>
              </div>
              <div class="grid grid-cols-[0.75fr_1.8fr_0.45fr_0.45fr] gap-2 px-2 pb-2 text-[10px] font-black text-slate-500">
                <div>챕터명</div>
                <div>시험범위 표준소단원</div>
                <div>시작쪽</div>
                <div>끝쪽</div>
              </div>
              <div class="space-y-2">
                ${examChapterRows.map((row, index) => {
                  const selectedIds = new Set(row.standardUnitIds || []);
                  return `
                    <div data-exam-chapter-row class="grid grid-cols-[0.75fr_1.8fr_0.45fr_0.45fr] gap-2 rounded-xl border border-slate-800 bg-slate-950/30 p-2">
                      <input data-field="chapterName" class="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 outline-none focus:border-amber-500" placeholder="챕터 ${index + 1}" value="${safe(row.chapterName)}" />
                      <div class="flex flex-wrap gap-1.5 rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-2">
                        ${activeStandardUnits.map(unit => `
                          <label class="cursor-pointer rounded-full border px-2 py-1 text-[10px] font-bold transition-colors ${selectedIds.has(unit.id) ? 'border-amber-400 bg-amber-400/15 text-amber-200' : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:border-amber-500/60 hover:text-amber-200'}">
                            <input type="checkbox" data-field="chapterStandardUnit" value="${safe(unit.id)}" class="mr-1 align-middle accent-amber-400" ${selectedIds.has(unit.id) ? 'checked' : ''} />
                            ${safe(unit.label)}
                          </label>
                        `).join('')}
                      </div>
                      <input data-field="start" type="number" min="1" class="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 outline-none focus:border-amber-500" placeholder="시작" value="${safe(row.start)}" />
                      <input data-field="end" type="number" min="1" class="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 outline-none focus:border-amber-500" placeholder="끝" value="${safe(row.end)}" />
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
          <button type="button" data-action="save-unit" class="mt-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-4 py-2.5 text-xs transition-colors shadow-sm">챕터표 저장</button>
        </div>
      ` : selectedBookForUnits && standardSubject ? `
        <div class="rounded-2xl border border-cyan-500/20 bg-cyan-950/10 p-4">
          <div class="flex items-start justify-between gap-3 mb-4">
            <div>
              <div class="text-xs font-extrabold text-cyan-200">표준소단원 기준 단원표</div>
              <div class="text-[10px] text-slate-500 mt-1">교재 소단원명이 여러 표준소단원에 걸치면 같은 소단원명을 이어서 입력하고, 첫 행에는 시작쪽, 마지막 행에는 끝쪽을 입력하세요.</div>
            </div>
            <span class="shrink-0 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-[10px] font-black text-cyan-200">${safe(standardSubject.label)}</span>
          </div>
          <div class="overflow-x-auto mini-scroll">
            <div class="min-w-[760px]">
              <div class="grid grid-cols-[1.25fr_1.15fr_0.55fr_0.55fr] gap-2 px-2 pb-2 text-[10px] font-black text-slate-500">
                <div>소단원명</div>
                <div>표준소단원</div>
                <div>시작쪽</div>
                <div>끝쪽</div>
              </div>
              <div class="space-y-2">
                ${standardUnitTableRows.map(row => `
                  <div data-standard-unit-row data-standard-unit-id="${safe(row.id)}" data-standard-label="${safe(row.label)}" class="grid grid-cols-[1.25fr_1.15fr_0.55fr_0.55fr] gap-2 rounded-xl border border-slate-800 bg-slate-950/30 p-2">
                    <input data-field="unitName" class="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-500" placeholder="예: 03 순열과 조합" value="${safe(row.unitName)}" />
                    <div class="flex items-center rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs font-bold text-cyan-200">
                      ${safe(row.label)}
                    </div>
                    <input data-field="start" type="number" min="1" class="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-500" placeholder="시작" value="${safe(row.start)}" />
                    <input data-field="end" type="number" min="1" class="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-500" placeholder="끝" value="${safe(row.end)}" />
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
          <button type="button" data-action="save-unit" class="mt-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-extrabold px-4 py-2.5 text-xs transition-colors shadow-sm">단원표 저장</button>
        </div>
      ` : `
        <div class="rounded-xl border border-dashed border-slate-800 bg-slate-950/30 px-4 py-8 text-center text-xs text-slate-500">
          교재를 선택하면 해당 수학 교과목의 표준소단원 표가 표시됩니다.
        </div>
      `}

      ${bookById(state.selectedBookManageId) ? bookMap(bookById(state.selectedBookManageId), deps) : '<div class="rounded-xl border border-dashed border-slate-700 bg-slate-900/20 px-4 py-10 text-center text-xs font-bold text-slate-400 mt-4">교재를 위에서 클릭하여 선택하시면 등록 완료된 단원 페이지 맵이 여기에 나옵니다.</div>'}
    </div>
  `;

  // 3. 반별 교재 배정 콘텐츠
  const assignContent = `
    <div class="space-y-4 text-slate-200">
      <div class="flex flex-col gap-2">
        <span class="text-xs font-bold text-slate-400">배정 대상 반 선택</span>
        ${renderBtnSelect({
          id: 'assigningClassId',
          options: availableClasses.map(c => ({ value: c.id, label: c.name })),
          selectedValue: state.assigningClassId,
          placeholder: '선택할 반이 없습니다.'
        })}
      </div>

      <span class="text-xs font-bold text-slate-400 block mt-2">사용 가능한 교재 목록 (클릭 시 배정):</span>
      <div class="grid md:grid-cols-2 gap-3 max-h-48 overflow-y-auto mini-scroll pr-1 border border-slate-800 p-2.5 rounded-xl bg-slate-900/20 shadow-inner">
        ${activeBooks.map(b => `
          <button type="button" data-action="assign-book" data-class="${state.assigningClassId}" data-book="${b.id}" class="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5 text-left hover:border-violet-300 hover:bg-violet-50 transition-colors shadow-sm">
            <div class="flex items-center justify-between gap-2 text-xs">
              <div>
                <div class="font-black text-slate-200">${safe(b.title)}</div>
                <div class="text-[10px] text-slate-500 mt-0.5 font-bold">${safe(b.subject || '-')} &middot; ${safe(b.grade || '-')}</div>
              </div>
              <span class="text-[10px] text-slate-500 font-black bg-slate-800/50 px-2 py-0.5 rounded">${bookUnits(b).length}단원</span>
            </div>
          </button>
        `).join('')}
      </div>

      <div class="flex items-center justify-between gap-3 mt-2">
        <span class="text-xs font-bold text-slate-400 block">현재 진행 중 교재 (정렬 조정):</span>
        <span class="text-[10px] font-black text-cyan-300">${activeAssignedBooks.length}권 진행 중</span>
      </div>
      <div class="space-y-2 max-h-48 overflow-y-auto mini-scroll pr-1">
        ${activeAssignedBooks.length ? activeAssignedBooks.map((x, idx) => `
          <div class="rounded-xl border border-slate-800 bg-slate-900/40 px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs shadow-sm">
            <div class="min-w-0">
              <div class="font-black text-slate-200">${idx + 1}. ${safe(x.book.title)}</div>
              <div class="text-[10px] text-slate-500 mt-0.5 font-bold">${idx === 0 ? '메인 교재' : '부교재'} &middot; ${safe(x.book.subject || '-')}</div>
            </div>
            <div class="flex shrink-0 flex-wrap justify-end items-center gap-1.5">
              <button type="button" data-action="move-assign" data-id="${x.link.id}" data-dir="up" class="rounded bg-slate-800/50 hover:bg-slate-200 border border-slate-800 px-2 py-1 text-[10px] font-black text-slate-500">▲</button>
              <button type="button" data-action="move-assign" data-id="${x.link.id}" data-dir="down" class="rounded bg-slate-800/50 hover:bg-slate-200 border border-slate-800 px-2 py-1 text-[10px] font-black text-slate-500">▼</button>
              <button type="button" data-action="complete-assign" data-id="${x.link.id}" class="rounded border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white px-2 py-1 text-[10px] font-black text-emerald-300 transition-colors">진행 종료</button>
              <button type="button" data-action="remove-assign" data-id="${x.link.id}" class="rounded border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500 hover:text-white px-2 py-1 text-[10px] font-black text-rose-300 transition-colors">연결 삭제</button>
            </div>
          </div>
        `).join('') : '<div class="rounded-xl border border-dashed border-slate-700 bg-slate-900/20 px-4 py-8 text-center text-xs font-bold text-slate-400">현재 반에 배정된 교재가 없습니다.</div>'}
      </div>

      <details class="group rounded-xl border border-slate-800 bg-slate-900/20 p-3">
        <summary class="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-black text-slate-300">
          <span>완료된 교재 이력 (${completedAssignedBooks.length}권)</span>
          <span class="text-[10px] text-slate-500 transition-transform group-open:rotate-180">▼</span>
        </summary>
        <div class="mt-3 space-y-2 max-h-44 overflow-y-auto mini-scroll pr-1">
          ${completedAssignedBooks.length ? completedAssignedBooks.map(x => `
            <div class="rounded-xl border border-slate-800 bg-slate-950/40 px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs shadow-sm">
              <div class="min-w-0">
                <div class="font-black text-slate-300">${safe(x.book.title)}</div>
                <div class="text-[10px] text-slate-500 mt-0.5 font-bold">${safe(x.book.subject || '-')} &middot; ${formatCompletedDate(x.link.completedAt) || '완료 처리됨'}</div>
              </div>
              <div class="flex shrink-0 flex-wrap justify-end items-center gap-1.5">
                <button type="button" data-action="reactivate-assign" data-id="${x.link.id}" class="rounded border border-cyan-500/20 bg-cyan-500/10 hover:bg-cyan-500 hover:text-white px-2 py-1 text-[10px] font-black text-cyan-300 transition-colors">다시 진행</button>
                <button type="button" data-action="remove-assign" data-id="${x.link.id}" class="rounded border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500 hover:text-white px-2 py-1 text-[10px] font-black text-rose-300 transition-colors">연결 삭제</button>
              </div>
            </div>
          `).join('') : '<div class="rounded-xl border border-dashed border-slate-800 bg-slate-950/30 px-4 py-6 text-center text-xs font-bold text-slate-500">아직 완료 처리된 교재가 없습니다.</div>'}
        </div>
      </details>
    </div>
  `;

  return `
    <div class="space-y-4 max-w-5xl mx-auto pb-20">
      <div class="text-center mb-8">
        <div class="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Textbook Management</div>
        <div class="text-2xl font-black text-white">교재 관리</div>
      </div>

      ${renderAccordionItem('bookSetupAccordion', 'manage', '1. 교재 자산 관리', 'fa-book-open', 'bg-violet-100 text-violet-600', acc.manage, manageContent)}
      ${renderAccordionItem('bookSetupAccordion', 'unit', '2. 단원 입력 및 페이지 맵', 'fa-map', 'bg-emerald-100 text-emerald-600', acc.unit, unitContent)}
      ${renderAccordionItem('bookSetupAccordion', 'assign', '3. 반별 교재 배정', 'fa-link', 'bg-amber-100 text-amber-600', acc.assign, assignContent)}
    </div>
  `;
}
