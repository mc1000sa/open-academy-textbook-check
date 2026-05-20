import { renderBtnSelect } from './layoutView.js';

function metricCard(label, value, colorStyle, detailKey) {
  return `
    <button type="button" data-action="setup-detail" data-detail="${detailKey}" class="card-3d rounded-2xl p-5 text-left w-full transition hover:-translate-y-0.5 hover:border-slate-700">
      <div class="flex items-start justify-between gap-3">
        <div>
          <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wide">${label}</span>
          <div class="mt-2 text-2xl font-black" style="color: ${colorStyle}; text-shadow: 0 0 10px ${colorStyle}22;">${value}</div>
        </div>
        <span class="mt-0.5 text-[9px] font-bold bg-slate-900/80 px-2 py-0.5 rounded text-slate-400 border border-slate-800">눌러서 보기</span>
      </div>
    </button>
  `;
}

function setupDetailSection(state, selectedClass, deps) {
  const { filterByKeyword, teacherNameById, safe, studentsForClass, classById, bookUnits, assignedBooksForClass } = deps;

  if (!state.setupDetailPanel) return '';

  if (state.setupDetailPanel === 'classes') {
    const rows = filterByKeyword(state.classes, state.setupSearchClass, c => `${c.name} ${c.grade} ${teacherNameById(c.teacherId)}`);
    return `
      <div class="card-3d rounded-2xl p-5 md:p-6 mb-6">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 class="text-sm font-extrabold text-white">등록된 반 목록</h3>
          <div class="flex items-center gap-2">
            <input id="setupSearchClass" class="border border-slate-800 rounded-xl px-3 py-1.5 bg-slate-900 text-xs text-white" placeholder="반 검색" value="${safe(state.setupSearchClass)}" />
            <button type="button" data-action="close-setup-detail" class="text-xs font-bold text-slate-400 hover:text-white transition-colors">닫기</button>
          </div>
        </div>
        
        <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          ${rows.length ? rows.map(c => `
            <button type="button" data-action="select-class-detail" data-id="${c.id}" class="text-left rounded-xl border border-slate-800 bg-slate-900/20 px-4 py-3.5 hover:border-blue-500/50 hover:bg-slate-900/30 transition-all">
              <div class="font-extrabold text-sm text-slate-200">${safe(c.name)}</div>
              <div class="text-[11px] text-slate-500 mt-1">${safe(c.grade || '-')} &middot; ${safe(teacherNameById(c.teacherId))}T</div>
            </button>
          `).join('') : '<div class="text-xs text-slate-500 py-4">등록된 반이 없습니다.</div>'}
        </div>
      </div>
    `;
  }

  if (state.setupDetailPanel === 'students') {
    const rows = filterByKeyword(selectedClass ? studentsForClass(selectedClass.id) : [], state.setupSearchStudent, s => `${s.name} ${s.school} ${s.grade} ${classById(s.classId)?.name || ''}`);
    return `
      <div class="card-3d rounded-2xl p-5 md:p-6 mb-6">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 class="text-sm font-extrabold text-white">${selectedClass ? safe(selectedClass.name) : ''} 학생 목록</h3>
          <div class="flex items-center gap-2">
            <input id="setupSearchStudent" class="border border-slate-800 rounded-xl px-3 py-1.5 bg-slate-900 text-xs text-white" placeholder="학생 검색" value="${safe(state.setupSearchStudent)}" />
            <button type="button" data-action="close-setup-detail" class="text-xs font-bold text-slate-400 hover:text-white transition-colors">닫기</button>
          </div>
        </div>
        
        <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          ${rows.length ? rows.map(s => `
            <div class="rounded-xl border border-slate-800 bg-slate-900/20 px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <div class="font-extrabold text-sm text-slate-200">${safe(s.name)}</div>
                <div class="text-[11px] text-slate-500 mt-1">${safe(s.school || '-')} &middot; ${safe(s.grade || '-')}</div>
              </div>
              <button type="button" data-action="remove-student" data-id="${s.id}" class="text-rose-400 text-xs font-bold hover:text-rose-300">삭제</button>
            </div>
          `).join('') : '<div class="text-xs text-slate-500 py-4">학생이 없습니다.</div>'}
        </div>
      </div>
    `;
  }

  if (state.setupDetailPanel === 'books') {
    const rows = filterByKeyword(state.books.filter(b => !b.archived), state.setupSearchBook, b => `${b.title} ${b.subject} ${b.grade} ${b.publisher}`);
    return `
      <div class="card-3d rounded-2xl p-5 md:p-6 mb-6">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 class="text-sm font-extrabold text-white">등록된 교재 목록</h3>
          <div class="flex items-center gap-2">
            <input id="setupSearchBook" class="border border-slate-800 rounded-xl px-3 py-1.5 bg-slate-900 text-xs text-white" placeholder="교재 검색" value="${safe(state.setupSearchBook)}" />
            <button type="button" data-action="close-setup-detail" class="text-xs font-bold text-slate-400 hover:text-white transition-colors">닫기</button>
          </div>
        </div>
        
        <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          ${rows.length ? rows.map(b => `
            <div class="rounded-xl border border-slate-800 bg-slate-900/20 px-4 py-3">
              <div class="font-extrabold text-sm text-slate-200">${safe(b.title)}</div>
              <div class="text-[11px] text-slate-500 mt-1">${safe(b.subject || '-')} &middot; ${safe(b.grade || '-')} &middot; ${safe(b.publisher || '-')}</div>
            </div>
          `).join('') : '<div class="text-xs text-slate-500 py-4">등록된 교재가 없습니다.</div>'}
        </div>
      </div>
    `;
  }

  if (state.setupDetailPanel === 'classBooks') {
    return `
      <div class="card-3d rounded-2xl p-5 md:p-6 mb-6">
        <div class="flex items-center justify-between gap-3 mb-4">
          <h3 class="text-sm font-extrabold text-white">${selectedClass ? safe(selectedClass.name) : ''} 배정 교재</h3>
          <button type="button" data-action="close-setup-detail" class="text-xs font-bold text-slate-400 hover:text-white transition-colors">닫기</button>
        </div>
        
        <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          ${assignedBooksForClass(selectedClass?.id).length ? assignedBooksForClass(selectedClass.id).map(x => `
            <div class="rounded-xl border border-slate-800 bg-slate-900/20 px-4 py-3">
              <div class="font-extrabold text-sm text-slate-200">${safe(x.book.title)}</div>
              <div class="text-[11px] text-slate-500 mt-1">${safe(x.book.subject || '-')} &middot; ${safe(x.book.grade || '-')} &middot; ${bookUnits(x.book).length}단원</div>
            </div>
          `).join('') : '<div class="text-xs text-slate-500 py-4">배정된 교재가 없습니다.</div>'}
        </div>
      </div>
    `;
  }

  return '';
}

function wizardStatus(state, deps) {
  const { teacherClasses } = deps;
  const classes = state.currentTeacher.role === 'admin' ? state.classes : teacherClasses(state.currentTeacher.id);
  const doneClass = classes.length > 0;
  const doneBook = state.classBooks.some(cb => cb.active !== false);
  const doneStudent = state.students.length > 0;

  return `
    <div class="flex flex-wrap gap-2.5">
      <div class="rounded-xl border px-3 py-1.5 text-xs font-black ${doneClass ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-400' : 'border-slate-800 bg-slate-950/40 text-slate-500'}">1. 반 생성 ${doneClass ? '✓' : ''}</div>
      <div class="rounded-xl border px-3 py-1.5 text-xs font-black ${doneBook ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-400' : 'border-slate-800 bg-slate-950/40 text-slate-500'}">2. 교재 배정 ${doneBook ? '✓' : ''}</div>
      <div class="rounded-xl border px-3 py-1.5 text-xs font-black ${doneStudent ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-400' : 'border-slate-800 bg-slate-950/40 text-slate-500'}">3. 학생 등록 ${doneStudent ? '✓' : ''}</div>
    </div>
  `;
}

export function bookMap(book, deps) {
  const { bookUnits, safe } = deps;
  const list = bookUnits(book);
  if (!list.length) return `<div class="rounded-xl border border-dashed border-slate-800 p-5 text-center text-xs text-slate-500 mt-4">단원 정보가 등록되어 있지 않습니다.</div>`;
  return `
    <div class="mt-4 rounded-xl border border-slate-800 bg-slate-950/30 p-4">
      <div class="text-xs font-extrabold text-slate-300 mb-3">${safe(book.title)} 단원 맵</div>
      <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
        ${list.map(u => `
          <div class="rounded-xl border border-slate-800/80 bg-slate-900/30 p-3">
            <div class="text-xs font-extrabold text-slate-200 truncate" title="${safe(u.name)}">${safe(u.name)}</div>
            <div class="text-[10px] text-slate-500 mt-1 font-bold">${u.start}~${u.end}쪽 (${Number(u.end) - Number(u.start) + 1}p)</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function setupWizardModal(state, availableClasses, selectedClass, selectedStudents, visibleBooks, deps) {
  const { assignedBooksForClass, bookUnits, existingStudentProfilesForClass, safe, classById } = deps;
  if (!state.wizardOpen) return '';

  const wizardAssigned = state.assigningClassId ? assignedBooksForClass(state.assigningClassId) : [];
  const GRADE_OPTIONS = ['중1', '중2', '중3', '고1', '고2', '고3'];

  // 포털 테마에 따른 지시색
  const accentColor = state.currentTeacher?.role === 'admin' ? '#8436ff' : '#4169e1';

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md no-print">
      <div class="glass border border-slate-800 w-full max-w-4xl shadow-2xl overflow-hidden rounded-[28px]">
        
        <div class="px-6 py-5 border-b border-slate-800 bg-slate-900/30">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-base font-extrabold text-white">반 세팅 마법사</h3>
              <div class="flex items-center gap-2 mt-2">
                <span class="w-2.5 h-2.5 rounded-full ${state.wizardStep >= 1 ? 'animate-pulse' : ''}" style="background: ${accentColor};"></span>
                <span class="w-8 h-[2px]" style="background: ${state.wizardStep >= 2 ? accentColor : '#1e293b'};"></span>
                <span class="w-2.5 h-2.5 rounded-full" style="background: ${state.wizardStep >= 2 ? accentColor : '#1e293b'};"></span>
                <span class="w-8 h-[2px]" style="background: ${state.wizardStep >= 3 ? accentColor : '#1e293b'};"></span>
                <span class="w-2.5 h-2.5 rounded-full" style="background: ${state.wizardStep >= 3 ? accentColor : '#1e293b'};"></span>
              </div>
            </div>
            <button type="button" data-action="close-setup-wizard" class="rounded-xl bg-slate-900 border border-slate-800 w-10 h-10 text-slate-400 text-lg font-bold hover:text-white transition-colors">×</button>
          </div>
        </div>

        <div class="p-6 max-h-[75vh] overflow-y-auto mini-scroll">
          ${state.wizardStep === 1 ? `
            <div class="space-y-4">
              <div>
                <div class="text-base font-extrabold text-white">1. 신규 반 만들기</div>
                <div class="text-xs text-slate-400 mt-1">반 이름, 학년, 담당 강사를 설정하고 저장하세요.</div>
              </div>
              
              <label class="block text-xs font-bold text-slate-400">반 이름
                <input id="wizardSetupClassName" class="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none focus:border-blue-500" placeholder="예: 중3 A반, 고1 특강반" value="${safe(state.setupFormClass.name)}" />
              </label>
              
              <div class="grid md:grid-cols-2 gap-4">
                <div class="flex flex-col gap-2">
                  <span class="text-xs font-bold text-slate-400">학년 선택</span>
                  ${renderBtnSelect({
                    id: 'wizardSetupClassGrade',
                    options: GRADE_OPTIONS.map(g => ({ value: g, label: g })),
                    selectedValue: state.setupFormClass.grade,
                    placeholder: '학년 선택'
                  })}
                </div>
                <div class="flex flex-col gap-2">
                  <span class="text-xs font-bold text-slate-400">담당 강사</span>
                  ${renderBtnSelect({
                    id: 'wizardSetupClassTeacherId',
                    options: state.teachers.map(t => ({ value: t.id, label: t.name })),
                    selectedValue: state.setupFormClass.teacherId,
                    placeholder: '담당 강사'
                  })}
                </div>
              </div>
              
              <label class="block text-xs font-bold text-slate-400">반 설명 (선택사항)
                <input id="wizardSetupClassNote" class="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none focus:border-blue-500" placeholder="예: 시험대비반, 내신집중반" value="${safe(state.setupFormClass.note)}" />
              </label>
              
              <div class="flex gap-2 pt-2">
                <button type="button" data-action="save-class" class="rounded-xl text-white font-extrabold px-4 py-2.5 text-xs" style="background: ${accentColor};">저장하고 다음 단계</button>
                <button type="button" data-action="reset-class-form" class="ghost-button rounded-xl px-4 py-2.5 text-xs">초기화</button>
              </div>
            </div>
          ` : state.wizardStep === 2 ? `
            <div class="space-y-4">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div class="text-base font-extrabold text-white">2. 교재 배정</div>
                  <div class="text-xs text-slate-400 mt-1">${safe(classById(state.assigningClassId)?.name || selectedClass?.name || '')}</div>
                </div>
                <button type="button" data-action="wizard-prev" class="ghost-button rounded-xl px-3 py-2 text-xs font-bold">이전</button>
              </div>
              
              <div class="flex flex-col gap-2">
                <span class="text-xs font-bold text-slate-400">배정 대상 반 선택</span>
                ${renderBtnSelect({
                  id: 'assigningClassId',
                  options: availableClasses.map(c => ({ value: c.id, label: c.name })),
                  selectedValue: state.assigningClassId,
                  placeholder: '반 선택'
                })}
              </div>

              <span class="text-xs font-bold text-slate-400 block mt-2">교재 클릭 시 자동 배정:</span>
              <div class="grid md:grid-cols-2 gap-3 max-h-48 overflow-y-auto mini-scroll pr-1 border border-slate-850 p-2.5 rounded-xl bg-slate-950/20">
                ${visibleBooks.map(b => `
                  <button type="button" data-action="assign-book" data-class="${state.assigningClassId}" data-book="${b.id}" class="rounded-xl border border-slate-800 bg-slate-900/30 px-3 py-2.5 text-left hover:border-slate-650 transition-colors">
                    <div class="flex items-center justify-between gap-2 text-xs">
                      <div>
                        <div class="font-extrabold text-slate-200">${safe(b.title)}</div>
                        <div class="text-[10px] text-slate-500 mt-0.5">${safe(b.subject || '-')} &middot; ${safe(b.grade || '-')}</div>
                      </div>
                      <span class="text-[10px] text-slate-400 font-bold bg-slate-950 px-2 py-0.5 rounded">${bookUnits(b).length}단원</span>
                    </div>
                  </button>
                `).join('')}
              </div>
              
              <div class="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <div class="text-xs font-extrabold text-slate-300 mb-3">현재 배정된 교재 목록</div>
                <div class="space-y-2">
                  ${wizardAssigned.length ? wizardAssigned.map((x, idx) => `
                    <div class="rounded-xl border border-slate-800 bg-slate-900/20 px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div class="font-bold text-slate-300">${idx + 1}. ${safe(x.book.title)}</div>
                        <div class="text-[10px] text-slate-500 mt-0.5">${idx === 0 ? '메인 교재' : '부교재'} &middot; ${safe(x.book.subject || '-')}</div>
                      </div>
                      <button type="button" data-action="remove-assign" data-id="${x.link.id}" class="rounded-lg bg-rose-500/10 border border-rose-500/20 px-2.5 py-1.5 text-[10px] font-bold text-rose-400 hover:bg-rose-500 hover:text-white transition-all">제거</button>
                    </div>
                  `).join('') : '<div class="text-xs text-slate-500 py-3 text-center">아직 배정된 교재가 없습니다.</div>'}
                </div>
              </div>
              
              <div class="flex justify-end pt-2">
                <button type="button" data-action="wizard-next" class="rounded-xl text-white font-extrabold px-5 py-2.5 text-xs" style="background: ${accentColor};">다음 단계로 이동</button>
              </div>
            </div>
          ` : `
            <div class="space-y-4">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div class="text-base font-extrabold text-white">3. 학생 등록</div>
                  <div class="text-xs text-slate-400 mt-1">${selectedClass ? safe(selectedClass.name) : '반을 먼저 생성해주세요.'}</div>
                </div>
                <button type="button" data-action="wizard-prev" class="ghost-button rounded-xl px-3 py-2 text-xs font-bold">이전</button>
              </div>

              <!-- 일괄등록 토글 -->
              <div class="flex flex-wrap gap-2">
                <button type="button" data-action="student-mode" data-mode="nameSchool" class="rounded-lg px-3 py-1.5 text-xs font-bold border ${state.studentBulkMode === 'nameSchool' ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-950 text-slate-500 border-slate-850'}">이름 / 학교</button>
                <button type="button" data-action="student-mode" data-mode="nameOnly" class="rounded-lg px-3 py-1.5 text-xs font-bold border ${state.studentBulkMode === 'nameOnly' ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-950 text-slate-500 border-slate-850'}">이름만</button>
              </div>

              <div class="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <div class="text-xs font-extrabold text-slate-300 mb-3">기존 학생 검색하여 현재 반에 추가</div>
                <div class="flex flex-col gap-3">
                  ${renderBtnSelect({
                    id: 'selectedExistingStudentId',
                    options: existingStudentProfilesForClass(state.selectedSetupClassId).map(s => ({ value: s.id, label: `${s.name} (${s.school || '-'} &middot; ${s.grade || '-'})` })),
                    selectedValue: state.selectedExistingStudentId,
                    placeholder: '기존 학생이 없습니다.'
                  })}
                  <button type="button" data-action="add-existing-student" class="rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-bold px-4 py-2.5 text-xs max-w-[200px] transition-colors">현재 반에 추가</button>
                </div>
              </div>

              <div class="grid xl:grid-cols-[1.1fr_0.9fr] gap-4">
                <div>
                  <textarea id="wizardStudentBulkText" class="w-full min-h-[220px] border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white leading-relaxed focus:outline-none" placeholder="${state.studentBulkMode === 'nameOnly' ? '김다인\n박서윤\n이하준' : '김다인 / 파주중\n박서윤 / 문산중\n이하준 / 파주중'}">${safe(state.studentBulkText)}</textarea>
                  <div class="mt-3 text-[10px] text-slate-500 leading-normal">한 줄에 한 명씩 입력하세요. 학년은 반 학년으로 자동 지정됩니다.</div>
                  <div class="mt-4 flex gap-2">
                    <button type="button" data-action="save-students-bulk" class="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-4 py-2.5 text-xs transition-colors">학생 등록 적용</button>
                    <button type="button" data-action="clear-student-bulk" class="ghost-button rounded-xl px-4 py-2.5 text-xs">입력 비우기</button>
                  </div>
                </div>
                
                <div>
                  <div class="text-xs font-extrabold text-slate-300 mb-3">등록 완료된 학생</div>
                  <div class="space-y-2 max-h-[300px] overflow-y-auto mini-scroll pr-1">
                    ${selectedStudents.length ? selectedStudents.map(s => `
                      <div class="rounded-xl border border-slate-800 bg-slate-900/20 px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <div class="font-bold text-slate-200">${safe(s.name)}</div>
                          <div class="text-[10px] text-slate-500 mt-0.5">${safe(s.school || '-')} &middot; ${safe(s.grade || '-')}</div>
                        </div>
                        <button type="button" data-action="remove-student" data-id="${s.id}" class="text-rose-400 text-[10px] font-bold hover:text-rose-300">삭제</button>
                      </div>
                    `).join('') : '<div class="rounded-xl border border-dashed border-slate-800 px-4 py-8 text-center text-xs text-slate-500">학생이 아직 없습니다.</div>'}
                  </div>
                </div>
              </div>
              
              <div class="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button type="button" data-action="close-setup-wizard" class="ghost-button rounded-xl px-4 py-2.5 text-xs">나중에 하기</button>
                <button type="button" data-action="wizard-finish" class="rounded-xl text-white font-extrabold px-5 py-2.5 text-xs" style="background: ${accentColor};">마법사 설정 완료</button>
              </div>
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

export function renderSetupView(state, deps) {
  const {
    teacherClasses,
    classById,
    studentsForClass,
    assignedBooksForClass,
    bookUnits,
    teacherNameById,
    safe,
    filterByKeyword,
    existingStudentProfilesForClass,
    bookById
  } = deps;

  const availableClasses = state.currentTeacher.role === 'admin' ? state.classes : teacherClasses(state.currentTeacher.id);
  const selectedClass = classById(state.selectedSetupClassId);
  const selectedStudents = selectedClass ? studentsForClass(selectedClass.id) : [];
  const selectedAssigned = selectedClass ? assignedBooksForClass(selectedClass.id) : [];
  
  const activeBooks = state.books.filter(b => !b.archived).sort((a, b) => String(a.title).localeCompare(String(b.title), 'ko'));
  const archivedBooks = state.books.filter(b => b.archived).sort((a, b) => String(a.title).localeCompare(String(b.title), 'ko'));

  const GRADE_OPTIONS = ['중1', '중2', '중3', '고1', '고2', '고3'];
  const SUBJECT_OPTIONS = ['수학', '영어', '국어', '과학'];

  // 포털 성격에 맞추어 버튼 컬러 통일 (Admin은 네온퍼플, Teacher는 로얄블루)
  const isAdmin = state.currentTeacher?.role === 'admin';
  const accentColor = isAdmin ? '#8436ff' : '#4169e1';
  const btnClass = isAdmin ? 'btn-admin' : 'btn-teacher';

  return `
    <div class="space-y-6">
      
      <!-- 상단 메트릭 카드 로우 -->
      <div class="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        ${metricCard('등록 반 수', state.classes.length, '#8436ff', 'classes')}
        ${metricCard('등록 학생 수', state.students.length, '#00d6cd', 'students')}
        ${metricCard('등록 교재 수', activeBooks.length, '#10b981', 'books')}
        ${metricCard('현재 반 교재 수', selectedAssigned.length, '#f43f5e', 'classBooks')}
      </div>
      
      <!-- 카드 팝업 디테일 영역 마운트 -->
      ${setupDetailSection(state, selectedClass, deps)}
      
      <!-- 반 세팅 마법사 진입 카드 -->
      <div class="card-3d rounded-2xl p-5 md:p-6">
        <div class="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 class="text-base font-extrabold text-white">반 세팅 마법사</h3>
            <p class="text-xs text-slate-500 mt-1">반 생성 &rarr; 교재 배정 &rarr; 학생 일괄 등록을 원스톱으로 진행합니다.</p>
          </div>
          <span class="text-[10px] text-slate-400 font-bold">초기 설정 도우미</span>
        </div>
        
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
          ${wizardStatus(state, deps)}
          <button type="button" data-action="open-setup-wizard" class="${btnClass} px-5 py-3 rounded-xl text-xs font-extrabold shadow-sm">
            반 세팅 마법사 시작
          </button>
        </div>
      </div>

      <!-- 1번 반 설정 & 2번 교재 배정 로우 -->
      <div class="grid xl:grid-cols-2 gap-6 items-start">
        
        <!-- 1. 신규 반 생성 -->
        <article class="card-3d rounded-2xl p-5 md:p-6">
          <div class="flex items-center justify-between gap-3 mb-4">
            <h3 class="text-base font-extrabold text-white">1. 신규 반 만들기</h3>
            <span class="text-[10px] text-slate-400 font-bold">학급 관리</span>
          </div>

          <div class="space-y-4">
            <label class="block text-xs font-bold text-slate-400">반 이름
              <input id="setupClassName" class="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none focus:border-blue-500" placeholder="예: 중3 A반, 고1 특강반" value="${safe(state.setupFormClass.name)}" />
            </label>
            
            <div class="grid md:grid-cols-2 gap-4">
              <div class="flex flex-col gap-2">
                <span class="text-xs font-bold text-slate-400">학년 선택</span>
                ${renderBtnSelect({
                  id: 'setupClassGrade',
                  options: GRADE_OPTIONS.map(g => ({ value: g, label: g })),
                  selectedValue: state.setupFormClass.grade,
                  placeholder: '학년 선택'
                })}
              </div>
              <div class="flex flex-col gap-2">
                <span class="text-xs font-bold text-slate-400">담당 강사</span>
                ${renderBtnSelect({
                  id: 'setupClassTeacherId',
                  options: state.teachers.map(t => ({ value: t.id, label: t.name })),
                  selectedValue: state.setupFormClass.teacherId,
                  placeholder: '담당 강사'
                })}
              </div>
            </div>

            <label class="block text-xs font-bold text-slate-400">반 설명 (선택사항)
              <input id="setupClassNote" class="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none focus:border-blue-500" placeholder="예: 내신집중반" value="${safe(state.setupFormClass.note)}" />
            </label>

            <div class="flex gap-2.5 pt-2">
              <button type="button" data-action="save-class" class="${btnClass} rounded-xl px-5 py-3 text-xs font-extrabold">반 생성/수정</button>
              <button type="button" data-action="reset-class-form" class="ghost-button rounded-xl px-5 py-3 text-xs font-extrabold">초기화</button>
            </div>

            <div class="border-t border-slate-800/80 pt-4 mt-2">
              <div class="text-xs font-bold text-slate-400 mb-2">현재 편집용 반 선택</div>
              ${renderBtnSelect({
                id: 'selectedSetupClassId',
                options: availableClasses.map(c => ({ value: c.id, label: `${c.name} (${teacherNameById(c.teacherId)})` })),
                selectedValue: state.selectedSetupClassId,
                placeholder: '선택 가능한 반이 존재하지 않습니다.'
              })}
            </div>
          </div>
        </article>

        <!-- 2. 교재 배정 -->
        <article class="card-3d rounded-2xl p-5 md:p-6">
          <div class="flex items-center justify-between gap-3 mb-4">
            <h3 class="text-base font-extrabold text-white">2. 반별 교재 배정</h3>
            <span class="text-[10px] text-slate-400 font-bold">${safe(classById(state.assigningClassId)?.name || '반 선택 필요')}</span>
          </div>

          <div class="space-y-4">
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
            <div class="grid md:grid-cols-2 gap-3 max-h-48 overflow-y-auto mini-scroll pr-1 border border-slate-850 p-2.5 rounded-xl bg-slate-950/20">
              ${activeBooks.map(b => `
                <button type="button" data-action="assign-book" data-class="${state.assigningClassId}" data-book="${b.id}" class="rounded-xl border border-slate-800 bg-slate-900/30 px-3 py-2.5 text-left hover:border-slate-600 transition-colors">
                  <div class="flex items-center justify-between gap-2 text-xs">
                    <div>
                      <div class="font-extrabold text-slate-200">${safe(b.title)}</div>
                      <div class="text-[10px] text-slate-500 mt-0.5">${safe(b.subject || '-')} &middot; ${safe(b.grade || '-')}</div>
                    </div>
                    <span class="text-[10px] text-slate-400 font-bold bg-slate-950 px-2 py-0.5 rounded">${bookUnits(b).length}단원</span>
                  </div>
                </button>
              `).join('')}
            </div>

            <span class="text-xs font-bold text-slate-400 block mt-2">현재 반 배정 교재 이력 (정렬 조정):</span>
            <div class="space-y-2 max-h-48 overflow-y-auto mini-scroll pr-1">
              ${assignedBooksForClass(state.assigningClassId).length ? assignedBooksForClass(state.assigningClassId).map((x, idx) => `
                <div class="rounded-xl border border-slate-800 bg-slate-900/20 px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div class="font-bold text-slate-200">${idx + 1}. ${safe(x.book.title)}</div>
                    <div class="text-[10px] text-slate-500 mt-0.5">${idx === 0 ? '메인 교재' : '부교재'} &middot; ${safe(x.book.subject || '-')}</div>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <button type="button" data-action="move-assign" data-id="${x.link.id}" data-dir="up" class="rounded bg-slate-800 hover:bg-slate-700 px-2 py-1 text-[10px] font-bold text-slate-300">▲</button>
                    <button type="button" data-action="move-assign" data-id="${x.link.id}" data-dir="down" class="rounded bg-slate-800 hover:bg-slate-700 px-2 py-1 text-[10px] font-bold text-slate-300">▼</button>
                    <button type="button" data-action="remove-assign" data-id="${x.link.id}" class="rounded bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500 px-2 py-1 text-[10px] font-bold text-rose-400 hover:text-white transition-colors">제거</button>
                  </div>
                </div>
              `).join('') : '<div class="rounded-xl border border-dashed border-slate-800 px-4 py-8 text-center text-xs text-slate-550">현재 반에 배정된 교재가 없습니다.</div>'}
            </div>
          </div>
        </article>
      </div>

      <!-- 3번 학생 일괄 등록 & 4번 교재 자산 관리 로우 -->
      <div class="grid xl:grid-cols-2 gap-6 items-start">
        
        <!-- 3. 학생 등록 -->
        <article class="card-3d rounded-2xl p-5 md:p-6">
          <div class="flex items-center justify-between gap-3 mb-4">
            <h3 class="text-base font-extrabold text-white">3. 학생 일괄 등록</h3>
            <span class="text-[10px] text-slate-400 font-bold">${selectedClass ? safe(selectedClass.name) : '반 선택 필요'}</span>
          </div>

          <div class="space-y-4">
            <div class="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div class="text-xs font-extrabold text-slate-300 mb-3">기존 학생 검색하여 현재 반에 빠른 복제 추가</div>
              <div class="space-y-3">
                <input id="existingStudentSearch" class="w-full border border-slate-800 rounded-xl p-2.5 bg-slate-900 text-xs text-white focus:outline-none" placeholder="기존 학생 이름/학교 검색" value="${safe(state.existingStudentSearch)}" />
                <div class="flex flex-col gap-2">
                  ${renderBtnSelect({
                    id: 'selectedExistingStudentId',
                    options: filterByKeyword(existingStudentProfilesForClass(state.selectedSetupClassId), state.existingStudentSearch, s => `${s.name} ${s.school} ${s.grade}`).map(s => ({ value: s.id, label: `${s.name} (${s.school || '-'} &middot; ${s.grade || '-'})` })),
                    selectedValue: state.selectedExistingStudentId,
                    placeholder: '검색 필터에 부합하는 학생이 없습니다.'
                  })}
                  <button type="button" data-action="add-existing-student" class="rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-bold px-4 py-2 text-xs max-w-[200px] transition-colors">현재 반에 등록</button>
                </div>
              </div>
            </div>

            <div class="grid xl:grid-cols-[1.1fr_0.9fr] gap-4 mt-2">
              <div>
                <div class="flex gap-2 mb-3">
                  <button type="button" data-action="student-mode" data-mode="nameSchool" class="rounded-lg px-2.5 py-1.5 text-[10px] font-bold border ${state.studentBulkMode === 'nameSchool' ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-950 text-slate-500 border-slate-850'}">이름 / 학교</button>
                  <button type="button" data-action="student-mode" data-mode="nameOnly" class="rounded-lg px-2.5 py-1.5 text-[10px] font-bold border ${state.studentBulkMode === 'nameOnly' ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-950 text-slate-500 border-slate-850'}">이름만</button>
                </div>
                <textarea id="wizardStudentBulkText" class="w-full min-h-[220px] border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white leading-relaxed focus:outline-none" placeholder="${state.studentBulkMode === 'nameOnly' ? '김다인\n박서윤' : '김다인 / 파주중\n박서윤 / 문산중'}">${safe(state.studentBulkText)}</textarea>
                <div class="mt-2.5 text-[10px] text-slate-500">한 줄에 한 명씩 줄바꿈하여 입력하세요.</div>
                <div class="mt-4 flex gap-2">
                  <button type="button" data-action="save-students-bulk" class="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-4 py-2.5 text-xs transition-colors">학생 일괄 저장</button>
                  <button type="button" data-action="clear-student-bulk" class="ghost-button rounded-xl px-4 py-2.5 text-xs">비우기</button>
                </div>
              </div>
              
              <div>
                <span class="text-xs font-bold text-slate-400 block mb-3">현재 반 소속 학생:</span>
                <div class="space-y-2 max-h-[340px] overflow-y-auto mini-scroll pr-1">
                  ${selectedStudents.length ? selectedStudents.map(s => `
                    <div class="rounded-xl border border-slate-800 bg-slate-900/20 px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div class="font-bold text-slate-200">${safe(s.name)}</div>
                        <div class="text-[10px] text-slate-500 mt-0.5">${safe(s.school || '-')} &middot; ${safe(s.grade || '-')}</div>
                      </div>
                      <button type="button" data-action="remove-student" data-id="${s.id}" class="text-rose-450 text-[10px] font-bold hover:text-rose-300">삭제</button>
                    </div>
                  `).join('') : '<div class="rounded-xl border border-dashed border-slate-800 px-4 py-10 text-center text-xs text-slate-500">학생이 존재하지 않습니다.</div>'}
                </div>
              </div>
            </div>
          </div>
        </article>

        <!-- 4. 교재 자산 관리 -->
        <article class="card-3d rounded-2xl p-5 md:p-6">
          <div class="flex items-center justify-between gap-3 mb-4">
            <h3 class="text-base font-extrabold text-white">4. 교재 자산 관리</h3>
            <span class="text-[10px] text-slate-400 font-bold">전체 교재 목록</span>
          </div>

          <div class="space-y-4">
            <label class="block text-xs font-bold text-slate-400">교재 이름
              <input id="bookTitle" class="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none" placeholder="교재명 입력" value="${safe(state.formBook.title)}" />
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
              <input id="bookPublisher" class="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none" placeholder="출판사명 입력" value="${safe(state.formBook.publisher)}" />
            </label>

            <div class="flex gap-2">
              <button type="button" data-action="save-book" class="${btnClass} rounded-xl px-4 py-2.5 text-xs font-extrabold">${state.editingBookId ? '교재 수정 반영' : '신규 교재 생성'}</button>
              <button type="button" data-action="reset-book-form" class="ghost-button rounded-xl px-4 py-2.5 text-xs">초기화</button>
            </div>

            <!-- 활성 교재 리스트 -->
            <div class="border-t border-slate-800/80 pt-4 mt-2">
              <span class="text-xs font-bold text-slate-400 block mb-3">사용 중인 교재 자산 (${activeBooks.length}권):</span>
              <div class="space-y-3.5 max-h-56 overflow-y-auto mini-scroll pr-1 mb-4">
                ${activeBooks.map(b => `
                  <div class="rounded-xl border border-slate-850 bg-slate-900/20 px-3.5 py-3">
                    <div class="flex justify-between items-start gap-2 text-xs">
                      <div>
                        <div class="font-bold text-slate-200">${safe(b.title)}</div>
                        <div class="text-[10px] text-slate-500 mt-1">${safe(b.subject || '-')} &middot; ${safe(b.grade || '-')} &middot; ${safe(b.publisher || '-')}</div>
                      </div>
                      <span class="text-[9px] font-black text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 px-1.5 py-0.5 rounded">활성</span>
                    </div>
                    <div class="mt-3.5 flex flex-wrap gap-1.5">
                      <button type="button" data-action="edit-book" data-id="${b.id}" class="rounded bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 text-[10px] font-bold">수정</button>
                      <button type="button" data-action="clone-book" data-id="${b.id}" class="rounded bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 text-[10px] font-bold">복제</button>
                      <button type="button" data-action="toggle-book-archive" data-id="${b.id}" class="rounded bg-rose-500/10 border border-rose-500/20 text-rose-450 hover:bg-rose-500 hover:text-white px-2 py-1 text-[10px] font-bold transition-colors">보관</button>
                      <button type="button" data-action="select-book-manage" data-id="${b.id}" class="rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white px-2 py-1 text-[10px] font-bold transition-colors">단원설정</button>
                    </div>
                  </div>
                `).join('')}
                ${activeBooks.length === 0 ? '<div class="text-xs text-slate-500 py-6 text-center">등록된 교재가 존재하지 않습니다.</div>' : ''}
              </div>

              <!-- 보관된 교재 아코디언 -->
              <details class="group border border-slate-800 rounded-xl bg-slate-950/20 p-3 transition-all duration-200">
                <summary class="flex items-center justify-between cursor-pointer font-bold text-slate-400 text-xs list-none select-none">
                  <span>📦 보관함 교재 (${archivedBooks.length}권)</span>
                  <span class="transition-transform duration-200 group-open:rotate-180 text-[10px] text-slate-500">▼</span>
                </summary>
                <div class="mt-3.5 space-y-3.5 max-h-48 overflow-y-auto mini-scroll pr-1">
                  ${archivedBooks.map(b => `
                    <div class="rounded-xl border border-slate-850 bg-slate-900/10 px-3 py-2.5">
                      <div class="flex justify-between items-start gap-2 text-xs">
                        <div>
                          <div class="font-bold text-slate-300">${safe(b.title)}</div>
                          <div class="text-[10px] text-slate-550 mt-1">${safe(b.subject || '-')} &middot; ${safe(b.grade || '-')}</div>
                        </div>
                        <span class="text-[9px] font-black text-rose-400 bg-rose-950/20 border border-rose-900/30 px-1.5 py-0.5 rounded">보관</span>
                      </div>
                      <div class="mt-2.5 flex flex-wrap gap-1.5">
                        <button type="button" data-action="toggle-book-archive" data-id="${b.id}" class="rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 hover:bg-emerald-500 hover:text-white px-2 py-1 text-[10px] font-bold transition-all">부활 (복구)</button>
                        <button type="button" data-action="delete-book" data-id="${b.id}" class="rounded bg-rose-500/10 border border-rose-500/20 text-rose-450 hover:bg-rose-500 hover:text-white px-2 py-1 text-[10px] font-bold transition-all">영구 삭제</button>
                      </div>
                    </div>
                  `).join('')}
                  ${archivedBooks.length === 0 ? '<div class="text-[10px] text-slate-600 py-3 text-center">보관함이 비어 있습니다.</div>' : ''}
                </div>
              </details>
            </div>
          </div>
        </article>
      </div>

      <!-- 단원 입력 / 페이지 맵 카드 -->
      <article class="card-3d rounded-2xl p-5 md:p-6">
        <div class="flex items-center justify-between gap-3 mb-4">
          <h3 class="text-base font-extrabold text-white">단원 입력 및 페이지 맵</h3>
          <span class="text-[10px] text-slate-400 font-bold">${safe(bookById(state.selectedBookManageId)?.title || '교재 선택 필요')}</span>
        </div>

        <div class="space-y-4">
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
              <input id="unitName" class="border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none" placeholder="예: 1. 다항식의 연산" value="${safe(state.formUnit.name)}" />
            </label>
            <label class="block text-xs font-bold text-slate-400">시작 페이지
              <input id="unitStart" type="number" class="border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none" placeholder="쪽 번호" value="${safe(state.formUnit.start)}" />
            </label>
            <label class="block text-xs font-bold text-slate-400">끝 페이지
              <input id="unitEnd" type="number" class="border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none" placeholder="쪽 번호" value="${safe(state.formUnit.end)}" />
            </label>
          </div>

          <button type="button" data-action="save-unit" class="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-4 py-2.5 text-xs transition-colors">단원 개별 추가</button>

          <!-- 대량 입력 구역 -->
          <label class="block text-xs font-bold text-slate-400 mt-2">엑셀/텍스트 일괄 붙여넣기 반영 <span class="text-[10px] text-slate-500 font-medium">(구분자: 슬래시 '/')</span>
            <textarea id="bulkUnitText" class="w-full min-h-[140px] border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white leading-relaxed focus:outline-none mt-1.5" placeholder="예: 단원명 / 시작쪽 / 끝쪽&#10;다항식의 덧셈 / 1 / 15&#10;나머지정리 / 16 / 32">${safe(state.bulkUnitText)}</textarea>
          </label>
          
          <div class="flex gap-2">
            <button type="button" data-action="save-unit-bulk" class="rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold px-4 py-2.5 text-xs transition-colors">일괄 등록 실행</button>
            <button type="button" data-action="clear-unit-bulk" class="ghost-button rounded-xl px-4 py-2.5 text-xs">지우기</button>
          </div>

          ${bookById(state.selectedBookManageId) ? bookMap(bookById(state.selectedBookManageId), deps) : '<div class="rounded-xl border border-dashed border-slate-800 px-4 py-10 text-center text-xs text-slate-500">교재를 위에서 클릭하여 선택하시면 등록 완료된 단원 페이지 맵이 여기에 나옵니다.</div>'}
        </div>
      </article>

      <!-- 모달 렌더링 -->
      ${setupWizardModal(state, availableClasses, selectedClass, selectedStudents, activeBooks, deps)}

    </div>
  `;
}
