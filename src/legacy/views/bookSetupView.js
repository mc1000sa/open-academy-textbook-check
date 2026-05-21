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
    bookUnits,
    safe,
    bookById
  } = deps;

  const availableClasses = state.currentTeacher.role === 'admin' ? state.classes : teacherClasses(state.currentTeacher.id);
  const activeBooks = state.books.filter(b => !b.archived).sort((a, b) => String(a.title).localeCompare(String(b.title), 'ko'));
  const archivedBooks = state.books.filter(b => b.archived).sort((a, b) => String(a.title).localeCompare(String(b.title), 'ko'));

  const GRADE_OPTIONS = ['고1', '고2', '고3'];
  const SUBJECT_OPTIONS = ['수학', '영어', '국어', '과학'];

  const isAdmin = state.currentTeacher?.role === 'admin';
  const btnClass = isAdmin ? 'btn-admin' : 'btn-teacher';
  
  const acc = state.bookSetupAccordion || { manage: true, unit: false, assign: false };

  // 1. 교재 자산 관리 콘텐츠
  const manageContent = `
    <div class="space-y-4 text-slate-200">
      <label class="block text-xs font-bold text-slate-400">교재 이름
        <input id="bookTitle" class="w-full border border-slate-800 rounded-xl p-3 bg-slate-900/40 text-xs text-slate-200 mt-1.5 focus:outline-none focus:ring-2 ring-violet-500/200/20" placeholder="교재명 입력" value="${safe(state.formBook.title)}" />
      </label>

      <div class="grid md:grid-cols-2 gap-4">
        <div class="flex flex-col gap-2">
          <span class="text-xs font-bold text-slate-400">과목 선택</span>
          ${renderBtnSelect({
            id: 'bookSubject',
            options: SUBJECT_OPTIONS.map(s => ({ value: s, label: s })),
            selectedValue: state.formBook.subject,
            placeholder: '과목 선택'
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

      <label class="block text-xs font-bold text-slate-400">출판사
        <input id="bookPublisher" class="w-full border border-slate-800 rounded-xl p-3 bg-slate-900/40 text-xs text-slate-200 mt-1.5 focus:outline-none focus:ring-2 ring-violet-500/200/20" placeholder="출판사명 입력" value="${safe(state.formBook.publisher)}" />
      </label>

      <div class="flex gap-2">
        <button type="button" data-action="save-book" class="${btnClass} rounded-xl px-4 py-2.5 text-xs font-extrabold text-white">${state.editingBookId ? '교재 수정 반영' : '신규 교재 생성'}</button>
        <button type="button" data-action="reset-book-form" class="ghost-button border border-slate-800 text-slate-400 bg-slate-900/40 hover:bg-slate-900/20 rounded-xl px-4 py-2.5 text-xs">초기화</button>
      </div>

      <div class="border-t border-slate-800 pt-4 mt-2">
        <span class="text-xs font-bold text-slate-500 block mb-3">사용 중인 교재 자산 (${activeBooks.length}권):</span>
        <div class="space-y-3.5 max-h-56 overflow-y-auto mini-scroll pr-1 mb-4">
          ${activeBooks.map(b => `
            <div class="rounded-xl border border-slate-800 bg-slate-900/20/50 px-3.5 py-3 shadow-sm hover:border-violet-500/40 transition-colors">
              <div class="flex justify-between items-start gap-2 text-xs">
                <div>
                  <div class="font-black text-slate-200">${safe(b.title)}</div>
                  <div class="text-[10px] text-slate-500 mt-1 font-bold">${safe(b.subject || '-')} &middot; ${safe(b.grade || '-')} &middot; ${safe(b.publisher || '-')}</div>
                </div>
                <span class="text-[9px] font-black text-emerald-600 bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded">활성</span>
              </div>
              <div class="mt-3.5 flex flex-wrap gap-1.5">
                <button type="button" data-action="edit-book" data-id="${b.id}" class="rounded bg-slate-900/40 border border-slate-800 hover:bg-slate-800/50 text-slate-400 px-2 py-1 text-[10px] font-bold">수정</button>
                <button type="button" data-action="clone-book" data-id="${b.id}" class="rounded bg-slate-900/40 border border-slate-800 hover:bg-slate-800/50 text-slate-400 px-2 py-1 text-[10px] font-bold">복제</button>
                <button type="button" data-action="toggle-book-archive" data-id="${b.id}" class="rounded bg-rose-50 border border-rose-100 text-rose-500 hover:bg-rose-500 hover:text-white px-2 py-1 text-[10px] font-bold transition-colors">보관</button>
                <button type="button" data-action="select-book-manage" data-id="${b.id}" class="rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/100 hover:text-white px-2 py-1 text-[10px] font-bold transition-colors">단원설정</button>
              </div>
            </div>
          `).join('')}
          ${activeBooks.length === 0 ? '<div class="text-xs text-slate-400 py-6 text-center">등록된 교재가 존재하지 않습니다.</div>' : ''}
        </div>

        <details class="group border border-slate-800 rounded-xl bg-slate-900/20 p-3 transition-all duration-200">
          <summary class="flex items-center justify-between cursor-pointer font-bold text-slate-500 text-xs list-none select-none">
            <span>📦 보관함 교재 (${archivedBooks.length}권)</span>
            <span class="transition-transform duration-200 group-open:rotate-180 text-[10px] text-slate-400">▼</span>
          </summary>
          <div class="mt-3.5 space-y-3.5 max-h-48 overflow-y-auto mini-scroll pr-1">
            ${archivedBooks.map(b => `
              <div class="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5 shadow-sm">
                <div class="flex justify-between items-start gap-2 text-xs">
                  <div>
                    <div class="font-black text-slate-400">${safe(b.title)}</div>
                    <div class="text-[10px] text-slate-400 mt-1 font-bold">${safe(b.subject || '-')} &middot; ${safe(b.grade || '-')}</div>
                  </div>
                  <span class="text-[9px] font-black text-rose-500 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded">보관</span>
                </div>
                <div class="mt-2.5 flex flex-wrap gap-1.5">
                  <button type="button" data-action="toggle-book-archive" data-id="${b.id}" class="rounded bg-emerald-50 border border-emerald-100 text-emerald-600 hover:bg-emerald-500 hover:text-white px-2 py-1 text-[10px] font-bold transition-all">부활 (복구)</button>
                  <button type="button" data-action="delete-book" data-id="${b.id}" class="rounded bg-rose-50 border border-rose-100 text-rose-500 hover:bg-rose-500 hover:text-white px-2 py-1 text-[10px] font-bold transition-all">영구 삭제</button>
                </div>
              </div>
            `).join('')}
            ${archivedBooks.length === 0 ? '<div class="text-[10px] text-slate-400 py-3 text-center">보관함이 비어 있습니다.</div>' : ''}
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

      <div class="grid md:grid-cols-3 gap-3">
        <label class="block text-xs font-bold text-slate-400">단원명
          <input id="unitName" class="w-full border border-slate-800 rounded-xl p-3 bg-slate-900/40 text-xs text-slate-200 mt-1.5 focus:outline-none focus:ring-2 ring-violet-500/200/20" placeholder="예: 1. 다항식의 연산" value="${safe(state.formUnit.name)}" />
        </label>
        <label class="block text-xs font-bold text-slate-400">시작 페이지
          <input id="unitStart" type="number" class="w-full border border-slate-800 rounded-xl p-3 bg-slate-900/40 text-xs text-slate-200 mt-1.5 focus:outline-none focus:ring-2 ring-violet-500/200/20" placeholder="쪽 번호" value="${safe(state.formUnit.start)}" />
        </label>
        <label class="block text-xs font-bold text-slate-400">끝 페이지
          <input id="unitEnd" type="number" class="w-full border border-slate-800 rounded-xl p-3 bg-slate-900/40 text-xs text-slate-200 mt-1.5 focus:outline-none focus:ring-2 ring-violet-500/200/20" placeholder="쪽 번호" value="${safe(state.formUnit.end)}" />
        </label>
      </div>

      <button type="button" data-action="save-unit" class="rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-extrabold px-4 py-2.5 text-xs transition-colors shadow-sm">단원 개별 추가</button>

      <label class="block text-xs font-bold text-slate-400 mt-4">엑셀/텍스트 일괄 붙여넣기 반영 <span class="text-[10px] text-slate-400 font-medium">(구분자: 슬래시 '/')</span>
        <textarea id="bulkUnitText" class="w-full min-h-[140px] border border-slate-800 rounded-xl p-3 bg-slate-900/40 text-xs text-slate-200 leading-relaxed focus:outline-none mt-1.5 focus:ring-2 ring-violet-500/200/20" placeholder="예: 단원명 / 시작쪽 / 끝쪽&#10;다항식의 덧셈 / 1 / 15&#10;나머지정리 / 16 / 32">${safe(state.bulkUnitText)}</textarea>
      </label>
      
      <div class="flex gap-2">
        <button type="button" data-action="save-unit-bulk" class="rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-extrabold px-4 py-2.5 text-xs transition-colors shadow-sm">일괄 등록 실행</button>
        <button type="button" data-action="clear-unit-bulk" class="ghost-button border border-slate-800 text-slate-400 bg-slate-900/40 hover:bg-slate-900/20 rounded-xl px-4 py-2.5 text-xs">지우기</button>
      </div>

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

      <span class="text-xs font-bold text-slate-400 block mt-2">현재 반 배정 교재 이력 (정렬 조정):</span>
      <div class="space-y-2 max-h-48 overflow-y-auto mini-scroll pr-1">
        ${assignedBooksForClass(state.assigningClassId).length ? assignedBooksForClass(state.assigningClassId).map((x, idx) => `
          <div class="rounded-xl border border-slate-800 bg-slate-900/40 px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs shadow-sm">
            <div>
              <div class="font-black text-slate-200">${idx + 1}. ${safe(x.book.title)}</div>
              <div class="text-[10px] text-slate-500 mt-0.5 font-bold">${idx === 0 ? '메인 교재' : '부교재'} &middot; ${safe(x.book.subject || '-')}</div>
            </div>
            <div class="flex items-center gap-1.5">
              <button type="button" data-action="move-assign" data-id="${x.link.id}" data-dir="up" class="rounded bg-slate-800/50 hover:bg-slate-200 border border-slate-800 px-2 py-1 text-[10px] font-black text-slate-500">▲</button>
              <button type="button" data-action="move-assign" data-id="${x.link.id}" data-dir="down" class="rounded bg-slate-800/50 hover:bg-slate-200 border border-slate-800 px-2 py-1 text-[10px] font-black text-slate-500">▼</button>
              <button type="button" data-action="remove-assign" data-id="${x.link.id}" class="rounded bg-rose-50 border border-rose-100 hover:bg-rose-500 hover:text-white px-2 py-1 text-[10px] font-black text-rose-500 transition-colors">제거</button>
            </div>
          </div>
        `).join('') : '<div class="rounded-xl border border-dashed border-slate-700 bg-slate-900/20 px-4 py-8 text-center text-xs font-bold text-slate-400">현재 반에 배정된 교재가 없습니다.</div>'}
      </div>
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
