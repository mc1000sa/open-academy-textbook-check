import { renderBtnSelect } from './layoutView.js';

function renderAccordionItem(stateGroup, target, title, icon, colorClass, isOpen, children) {
  return `
    <div class="rounded-[28px] border transition-all duration-300 ${isOpen ? 'border-cyan-500/40 ring-1 ring-cyan-500/20 bg-slate-900/40 shadow-xl' : 'border-slate-800 bg-slate-900/20 shadow-sm hover:border-slate-700'} mb-6">
      <button
        type="button"
        data-action="toggle-accordion"
        data-group="${stateGroup}"
        data-target="${target}"
        class="w-full flex items-center justify-between px-6 py-5 hover:bg-slate-800/50 transition-colors rounded-[28px]"
      >
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-2xl ${colorClass} flex items-center justify-center text-sm shadow-sm">
            <i class="fas ${icon}"></i>
          </div>
          <span class="font-black text-slate-100 text-[15px]">${title}</span>
        </div>
        <div class="w-6 h-6 rounded-full flex items-center justify-center transition-transform duration-300 ${isOpen ? 'bg-cyan-600 text-white rotate-180' : 'bg-slate-800 text-slate-400'}">
          <i class="fas fa-chevron-down text-[10px]"></i>
        </div>
      </button>
      ${isOpen ? `
        <div class="px-6 pb-6 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <div class="h-px bg-slate-800 mb-5"></div>
          ${children}
        </div>
      ` : ''}
    </div>
  `;
}

export function renderSetupView(state, deps) {
  const {
    teacherClasses,
    classById,
    studentsForClass,
    teacherNameById,
    safe,
    filterByKeyword,
    existingStudentProfilesForClass
  } = deps;

  const GRADE_OPTIONS = ['고1', '고2', '고3'];
  const availableClasses = state.currentTeacher.role === 'admin' ? state.classes : teacherClasses(state.currentTeacher.id);
  const teacherOptions = state.teachers.filter(t => t.active !== false && t.role !== 'admin');
  const selectedClass = classById(state.selectedSetupClassId);
  const selectedStudents = selectedClass ? studentsForClass(selectedClass.id) : [];
  
  const isAdmin = state.currentTeacher?.role === 'admin';
  const btnClass = isAdmin ? 'btn-admin' : 'btn-teacher';
  
  const acc = state.setupAccordion || { class: true, bulk: false, edit: false };

  // 1. 신규 반 만들기 콘텐츠
  const classContent = `
    <div class="space-y-4 text-slate-200">
      <label class="block text-xs font-bold text-slate-400">반 이름
        <input id="setupClassName" class="w-full border border-slate-700 rounded-xl p-3 bg-slate-900/50 text-xs text-white mt-1.5 focus:outline-none focus:border-cyan-500" placeholder="예: 중3 A반, 고1 특강반" value="${safe(state.setupFormClass.name)}" />
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
            options: teacherOptions.map(t => ({ value: t.id, label: t.name })),
            selectedValue: state.setupFormClass.teacherId,
            placeholder: '담당 강사'
          })}
        </div>
      </div>

      <div class="flex gap-2.5 pt-2">
        <button type="button" data-action="save-class" class="${btnClass} rounded-xl px-5 py-2.5 text-xs font-extrabold text-white">반 생성/수정</button>
        <button type="button" data-action="reset-class-form" class="ghost-button border border-slate-700 text-slate-300 bg-slate-800/50 hover:bg-slate-700 rounded-xl px-5 py-2.5 text-xs font-extrabold transition-colors">초기화</button>
      </div>
    </div>
  `;

  // 2. 학생 일괄 등록 및 복제 콘텐츠
  const bulkContent = `
    <div class="space-y-4 text-slate-200">
      <div class="border-b border-slate-800 pb-4">
        <span class="text-xs font-bold text-slate-400 mb-2 block">학생 등록을 진행할 대상 반 선택</span>
        ${renderBtnSelect({
          id: 'selectedSetupClassId',
          options: availableClasses.map(c => ({ value: c.id, label: `${c.name} (${teacherNameById(c.teacherId)})` })),
          selectedValue: state.selectedSetupClassId,
          placeholder: '선택 가능한 반이 존재하지 않습니다.'
        })}
      </div>

      <div class="rounded-xl border border-slate-700 bg-slate-800/30 p-4">
        <div class="text-xs font-extrabold text-slate-300 mb-3">기존 학생 검색하여 현재 반에 빠른 복제 추가</div>
        <div class="space-y-3">
          <input id="existingStudentSearch" class="w-full border border-slate-700 rounded-xl p-2.5 bg-slate-900/50 text-xs text-white focus:outline-none focus:border-cyan-500" placeholder="기존 학생 이름/학교 검색" value="${safe(state.existingStudentSearch)}" />
          <div class="flex flex-col gap-2">
            ${renderBtnSelect({
              id: 'selectedExistingStudentId',
              options: filterByKeyword(existingStudentProfilesForClass(state.selectedSetupClassId), state.existingStudentSearch, s => `${s.name} ${s.school} ${s.grade}`).map(s => ({ value: s.id, label: `${s.name} (${s.school || '-'} &middot; ${s.grade || '-'}) ` })),
              selectedValue: state.selectedExistingStudentId,
              placeholder: '검색 필터에 부합하는 학생이 없습니다.'
            })}
            <button type="button" data-action="add-existing-student" class="rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold px-4 py-2.5 text-xs max-w-[200px] transition-colors shadow-sm">현재 반에 등록</button>
          </div>
        </div>
      </div>

      <div class="grid xl:grid-cols-[1.1fr_0.9fr] gap-4 mt-2">
        <div>
          <div class="flex gap-2 mb-3">
            <button type="button" data-action="student-mode" data-mode="nameSchool" class="rounded-lg px-2.5 py-1.5 text-[10px] font-bold border ${state.studentBulkMode === 'nameSchool' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}">이름 / 학교</button>
            <button type="button" data-action="student-mode" data-mode="nameOnly" class="rounded-lg px-2.5 py-1.5 text-[10px] font-bold border ${state.studentBulkMode === 'nameOnly' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}">이름만</button>
          </div>
          <textarea id="wizardStudentBulkText" class="w-full min-h-[220px] border border-slate-700 rounded-xl p-3 bg-slate-900/50 text-xs text-white leading-relaxed focus:outline-none focus:border-cyan-500 shadow-inner" placeholder="${state.studentBulkMode === 'nameOnly' ? '김다인\\n박서윤' : '김다인 / 파주중\\n박서윤 / 문산중'}">${safe(state.studentBulkText)}</textarea>
          <div class="mt-2.5 text-[10px] text-slate-500">한 줄에 한 명씩 줄바꿈하여 입력하세요.</div>
          <div class="mt-4 flex gap-2">
            <button type="button" data-action="save-students-bulk" class="rounded-xl bg-emerald-500/80 hover:bg-emerald-500 text-white font-extrabold px-4 py-2.5 text-xs transition-colors shadow-sm">학생 일괄 저장</button>
            <button type="button" data-action="clear-student-bulk" class="ghost-button border border-slate-700 text-slate-300 bg-slate-800/50 hover:bg-slate-700 rounded-xl px-4 py-2.5 text-xs transition-colors">비우기</button>
          </div>
        </div>
        
        <div>
          <span class="text-xs font-bold text-slate-500 block mb-3">현재 반 소속 학생 (${selectedStudents.length}명):</span>
          <div class="space-y-2 max-h-[340px] overflow-y-auto mini-scroll pr-1">
            ${selectedStudents.length ? selectedStudents.map(s => `
              <div class="rounded-xl border border-slate-800 bg-slate-900/40 px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs shadow-sm">
                <div>
                  <div class="font-bold text-slate-200">${safe(s.name)}</div>
                  <div class="text-[10px] text-slate-400 mt-0.5">${safe(s.school || '-')} &middot; ${safe(s.grade || '-')}</div>
                </div>
                <button type="button" data-action="remove-student" data-id="${s.id}" class="text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded text-[10px] font-bold hover:bg-rose-500 hover:text-white transition-colors">삭제</button>
              </div>
            `).join('') : '<div class="rounded-xl border border-dashed border-slate-700 bg-slate-800/20 px-4 py-10 text-center text-xs text-slate-500">학생이 존재하지 않습니다.</div>'}
          </div>
        </div>
      </div>
    </div>
  `;

  // 3. 기존 반/학생 수정 및 삭제
  const editContent = `
    <div class="space-y-6 text-slate-200">
      <div>
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-bold text-slate-400 block">등록된 전체 반 관리</span>
          <input id="setupSearchClass" class="border border-slate-700 rounded-xl px-3 py-1.5 bg-slate-900/50 text-xs text-white focus:outline-none focus:border-cyan-500" placeholder="반 이름 검색" value="${safe(state.setupSearchClass)}" />
        </div>
        <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          ${filterByKeyword(state.classes, state.setupSearchClass, c => `${c.name} ${c.grade} ${teacherNameById(c.teacherId)}`).length ? 
            filterByKeyword(state.classes, state.setupSearchClass, c => `${c.name} ${c.grade} ${teacherNameById(c.teacherId)}`).map(c => `
              <div class="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 shadow-sm flex items-center justify-between hover:border-slate-700 transition-colors">
                <div>
                  <div class="font-extrabold text-sm text-slate-100">${safe(c.name)}</div>
                  <div class="text-[11px] text-slate-500 mt-1">${safe(c.grade || '-')} &middot; ${safe(teacherNameById(c.teacherId))}T</div>
                </div>
                <div class="flex gap-1.5">
                  <button type="button" data-action="edit-class" data-id="${c.id}" class="text-[10px] font-bold bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 px-2.5 py-1.5 rounded hover:bg-cyan-500 hover:text-white transition-colors">수정</button>
                  <button type="button" data-action="remove-class" data-id="${c.id}" class="text-[10px] font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2.5 py-1.5 rounded hover:bg-rose-500 hover:text-white transition-colors">삭제</button>
                </div>
              </div>
          `).join('') : '<div class="text-xs text-slate-500 py-4 col-span-full border border-dashed border-slate-700 rounded-xl text-center">검색된 반이 없습니다.</div>'}
        </div>
      </div>

      <div class="border-t border-slate-800 pt-6">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-bold text-slate-400 block">전체 학생 계정 관리 (비밀번호 등)</span>
          <input id="setupSearchStudent" class="border border-slate-700 rounded-xl px-3 py-1.5 bg-slate-900/50 text-xs text-white focus:outline-none focus:border-cyan-500" placeholder="이름/학교 검색" value="${safe(state.setupSearchStudent)}" />
        </div>
        <div class="space-y-2 max-h-80 overflow-y-auto mini-scroll pr-1">
          ${filterByKeyword(state.students, state.setupSearchStudent, s => `${s.name} ${s.school} ${s.grade} ${classById(s.classId)?.name || ''}`).length ? 
            filterByKeyword(state.students, state.setupSearchStudent, s => `${s.name} ${s.school} ${s.grade} ${classById(s.classId)?.name || ''}`).map(s => `
              <div class="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-slate-700 transition-colors">
                <div>
                  <div class="font-extrabold text-sm text-slate-100">${safe(s.name)} ${s.pinLocked ? '<span class="text-[10px] bg-rose-500 text-white px-1.5 py-0.5 rounded ml-1">계정잠김</span>' : ''}</div>
                  <div class="text-[11px] text-slate-500 mt-1">${safe(s.school || '-')} &middot; ${safe(s.grade || '-')} &middot; ${safe(classById(s.classId)?.name || '-')}</div>
                </div>
                <div class="flex flex-wrap gap-1.5 items-center">
                  <div class="text-[10px] text-slate-500 mr-2 font-mono">PIN: ${s.pin || '1234'}</div>
                  ${s.pinLocked ? `
                    <button type="button" data-action="student-unlock-pin" data-id="${s.id}" class="text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1.5 rounded hover:bg-amber-500 hover:text-white transition-colors">잠금해제</button>
                  ` : ''}
                  <button type="button" data-action="student-update-pin" data-id="${s.id}" data-pin="${s.pin || '1234'}" class="text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1.5 rounded hover:bg-slate-700 hover:text-white transition-colors">PIN 변경</button>
                  <button type="button" data-action="student-reset-pin" data-id="${s.id}" class="text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1.5 rounded hover:bg-slate-700 hover:text-white transition-colors">초기화</button>
                  <button type="button" data-action="remove-student" data-id="${s.id}" class="text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-1.5 rounded hover:bg-rose-500 hover:text-white transition-colors">삭제</button>
                </div>
              </div>
          `).join('') : '<div class="text-xs text-slate-500 py-4 text-center border border-dashed border-slate-700 rounded-xl">학생이 없습니다.</div>'}
        </div>
      </div>
    </div>
  `;

  return `
    <div class="space-y-4 max-w-5xl mx-auto pb-20">
      <div class="text-center mb-8">
        <div class="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1">Class & Student Management</div>
        <div class="text-2xl font-black text-white drop-shadow-md">반 / 학생 설정</div>
      </div>

      ${renderAccordionItem('setupAccordion', 'class', '1. 신규 반 만들기 및 관리', 'fa-users', 'bg-blue-100 text-blue-600', acc.class, classContent)}
      ${renderAccordionItem('setupAccordion', 'bulk', '2. 학생 일괄 등록 및 복제', 'fa-user-plus', 'bg-emerald-100 text-emerald-600', acc.bulk, bulkContent)}
      ${renderAccordionItem('setupAccordion', 'edit', '3. 기존 반/학생 수정 및 삭제', 'fa-pen-to-square', 'bg-amber-100 text-amber-600', acc.edit, editContent)}
    </div>
  `;
}
