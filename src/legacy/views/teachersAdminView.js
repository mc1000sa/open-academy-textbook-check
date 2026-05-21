export function renderTeachersAdminView(state, deps) {
  const { safe, teacherNameById } = deps;

  if (state.currentTeacher.role !== 'admin') {
    return `
      <div class="card-3d rounded-2xl p-8 text-center text-rose-400 border border-rose-500/20 bg-rose-950/10">
        관리자 권한 계정만 접근 가능한 영역입니다. 🔐
      </div>
    `;
  }

  const exp = state.adminCardExpanded || {};
  const purpleTheme = '#8436ff'; // 관리자 전용 네온 퍼플
  const btnClass = 'btn-admin';
  const allStudents = (state.allStudents || state.students || []).filter(s => s.deleted !== true);
  const managedStudents = allStudents.filter(s => s.status !== 'promoted');
  const withdrawnStudents = allStudents.filter(s => s.status === 'withdrawn');
  const pendingRequests = (state.studentRequests || []).filter(req => (req.status || 'pending') === 'pending');
  const selectedAdminStudentIds = new Set(state.selectedAdminStudentIds || []);
  const promotionGrades = Array.from(new Set([...state.classes.map(c => c.grade).filter(Boolean), '고1', '고2', '고3']));
  const selectedPromotionGrade = state.adminPromotionGrade || '';
  const selectedPromotionClassId = state.adminPromotionClassId || '';

  // 아코디언 카드 헬퍼 (React AccordionCard의 외양과 구조 완전 일치)
  function renderAdminAccordion({ id, title, subtitle, pipeColor = purpleTheme, open = false, childrenHtml, alert = false, badgeText = '' }) {
    return `
      <article id="card-${id}" class="admin-section-card card-3d rounded-2xl p-5 ${open ? 'open' : ''} ${alert ? 'admin-section-card-alert' : ''}">
        <button type="button" data-action="toggle-admin-card" data-card-id="${id}" class="admin-section-head w-full flex items-center justify-between text-left focus:outline-none">
          <div class="flex items-center">
            <div class="pipe-bar" style="width: 4.5px; height: 1.1rem; background: ${pipeColor}; margin-right: 0.75rem; border-radius: 2px; box-shadow: 0 0 10px ${pipeColor}44;"></div>
            <span class="text-sm font-extrabold text-white">${safe(title)}</span>
          </div>
          <div class="flex items-center gap-2">
            ${badgeText ? `<span class="rounded-full border border-rose-400/40 bg-rose-500/15 px-2 py-1 text-[10px] font-black text-rose-200">${safe(badgeText)}</span>` : ''}
            <span class="text-[10px] text-slate-500 font-bold">${safe(subtitle)}</span>
            <span class="text-slate-400 font-extrabold text-xs transition-transform duration-200 ${open ? 'rotate-180' : ''}">▼</span>
          </div>
        </button>
        ${open ? `
          <div class="mt-5 pt-5 border-t border-slate-800/80 space-y-5 animate-[fadeIn_0.2s_ease-out]">
            ${childrenHtml}
          </div>
        ` : ''}
      </article>
    `;
  }

  function classByName(classId) {
    return state.classes.find(c => String(c.id) === String(classId))?.name || '-';
  }

  function formatMaybeDate(value) {
    if (!value) return '-';
    const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  }

  // 각 카드 내부 HTML 정의
  const teachersHtml = `
    <div class="space-y-4">
      <div class="grid md:grid-cols-3 gap-3">
        <label class="block text-xs font-bold text-slate-400">강사 이름
          <input id="adminTeacherName" class="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none" placeholder="이름 입력" value="${safe(state.adminTeacherForm.name)}" />
        </label>
        <label class="block text-xs font-bold text-slate-400">PIN 4자리
          <input id="adminTeacherPin" maxlength="4" class="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none" placeholder="비밀번호(4자리)" value="${safe(state.adminTeacherForm.pin)}" />
        </label>
        <label class="block text-xs font-bold text-slate-400">권한 선택
          <select id="adminTeacherRole" class="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-slate-300 mt-1.5 focus:outline-none">
            <option value="teacher" ${state.adminTeacherForm.role === 'teacher' ? 'selected' : ''}>teacher (일반 강사)</option>
            <option value="admin" ${state.adminTeacherForm.role === 'admin' ? 'selected' : ''}>admin (최고 관리자)</option>
          </select>
        </label>
      </div>
      
      <div class="flex flex-wrap gap-2 pt-2">
        <button type="button" data-action="admin-new-teacher" class="ghost-button rounded-xl px-4 py-2.5 text-xs font-extrabold">신규 생성</button>
        <button type="button" data-action="admin-save-teacher" class="${btnClass} rounded-xl px-5 py-2.5 text-xs font-extrabold shadow-md">저장/수정</button>
        <button type="button" data-action="admin-reset-teacher" class="ghost-button rounded-xl px-4 py-2.5 text-xs font-extrabold">초기화</button>
        ${state.adminTeacherEditId ? `<button type="button" data-action="admin-delete-teacher" data-id="${state.adminTeacherEditId}" class="rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-2.5 text-xs font-extrabold hover:bg-rose-500 hover:text-white transition-all">삭제</button>` : ''}
      </div>
      
      <p class="text-[10px] text-slate-500">기본 admin 계정은 시스템 보호를 위해 삭제할 수 없으며, 강사의 경우 담당하고 있는 학급이 존재하면 삭제가 불가합니다.</p>
      
      <div class="border-t border-slate-850 pt-4 mt-2">
        <h4 class="text-xs font-extrabold text-slate-300 mb-3">현재 등록된 강사 목록 <span class="text-[10px] text-slate-500 font-normal">(수정하려면 강사를 클릭하세요)</span></h4>
        <div class="grid md:grid-cols-2 gap-3 max-h-56 overflow-y-auto mini-scroll pr-1">
          ${state.teachers.sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko')).map(t => `
            <div class="rounded-xl border border-slate-800 bg-slate-900/10 p-3.5 flex justify-between items-start gap-2">
              <div>
                <div class="font-extrabold text-xs text-slate-200">${safe(t.name)}</div>
                <div class="text-[10px] text-slate-550 mt-1">PIN: **** &middot; 권한: ${safe(t.role)}</div>
              </div>
              <button type="button" data-action="admin-edit-teacher" data-id="${t.id}" class="rounded bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 text-[10px] font-bold">수정</button>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  const classesHtml = `
    <div class="space-y-3">
      <div class="space-y-2 max-h-64 overflow-y-auto mini-scroll pr-1">
        ${state.classes.length ? state.classes.map(c => `
          <div class="rounded-xl border border-slate-800 bg-slate-900/10 px-4 py-3 flex items-center justify-between gap-3 text-xs">
            <div>
              <div class="font-extrabold text-slate-200">${safe(c.name)}</div>
              <div class="text-[10px] text-slate-500 mt-1">${safe(c.grade || '-')} &middot; 담당 강사: ${safe(teacherNameById(c.teacherId))}</div>
            </div>
            <button type="button" data-action="delete-class" data-id="${c.id}" class="rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 text-[11px] font-bold text-rose-400 hover:bg-rose-500 hover:text-white transition-all">반 삭제</button>
          </div>
        `).join('') : '<div class="text-xs text-slate-500 py-4 text-center">개설된 반이 없습니다.</div>'}
      </div>
      <p class="text-[10px] text-slate-500 mt-1">학급 내에 배정된 학생이 남아 있으면 해당 반은 삭제되지 않습니다. 학생 목록을 먼저 정리해주세요.</p>
    </div>
  `;

  const loginSplashHtml = `
    <div class="space-y-4">
      <div class="grid md:grid-cols-2 gap-4">
        <label class="block text-xs font-bold text-slate-400">스플래시 메인 대제목
          <input id="configSplashTitleLine1" class="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none" placeholder="예: 열린학원 교재점검" value="${safe(state.adminLoginConfigForm.splashTitleLine1 || state.loginConfig.splashTitleLine1)}" />
        </label>
        <label class="block text-xs font-bold text-slate-400">스플래시 강조 타이틀
          <input id="configSplashTitleLine2" class="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none" placeholder="예: OATIS" value="${safe(state.adminLoginConfigForm.splashTitleLine2 || state.loginConfig.splashTitleLine2)}" />
        </label>
      </div>
      
      <div class="grid md:grid-cols-2 gap-4">
        <label class="block text-xs font-bold text-slate-400">메인 대제목 글자 크기
          <select id="configSplashTitleSizeLine1" class="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-slate-300 mt-1.5 focus:outline-none">
            ${['24px', '28px', '32px', '38px', '44px', '50px'].map(sz => `
              <option value="${sz}" ${(state.adminLoginConfigForm.splashTitleSizeLine1 || state.loginConfig.splashTitleSizeLine1 || '38px') === sz ? 'selected' : ''}>${sz} ${sz === '38px' ? '(기본)' : ''}</option>
            `).join('')}
          </select>
        </label>
        <label class="block text-xs font-bold text-slate-400">강조 타이틀 글자 크기
          <select id="configSplashTitleSizeLine2" class="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-slate-300 mt-1.5 focus:outline-none">
            ${['32px', '40px', '48px', '54px', '60px', '70px'].map(sz => `
              <option value="${sz}" ${(state.adminLoginConfigForm.splashTitleSizeLine2 || state.loginConfig.splashTitleSizeLine2 || '54px') === sz ? 'selected' : ''}>${sz} ${sz === '54px' ? '(기본)' : ''}</option>
            `).join('')}
          </select>
        </label>
      </div>
      
      <label class="block text-xs font-bold text-slate-400">소제목 (영문 또는 요약 설명)
        <input id="configSplashSubtitle" class="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none" placeholder="Open Academy Textbook Insight System" value="${safe(state.adminLoginConfigForm.splashSubtitle || state.loginConfig.splashSubtitle)}" />
      </label>
      
      <label class="block text-xs font-bold text-slate-400">시스템 상세 소개글 <span class="text-[10px] text-slate-500 font-medium">(HTML 사용 가능)</span>
        <textarea id="configSplashDescription" class="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white h-20 mt-1.5 leading-relaxed focus:outline-none" placeholder="설명 문구">${safe(state.adminLoginConfigForm.splashDescription || state.loginConfig.splashDescription)}</textarea>
      </label>
      
      <div class="grid md:grid-cols-2 gap-4">
        <label class="block text-xs font-bold text-slate-400">로그인 카드 제목
          <input id="configLoginTitle" class="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none" placeholder="빠른 PIN 로그인" value="${safe(state.adminLoginConfigForm.loginTitle || state.loginConfig.loginTitle)}" />
        </label>
        <label class="block text-xs font-bold text-slate-400">로그인 카드 안내문구
          <input id="configLoginDescription" class="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none" placeholder="선생님을 선택하고 4자리 PIN을 입력하세요." value="${safe(state.adminLoginConfigForm.loginDescription || state.loginConfig.loginDescription)}" />
        </label>
      </div>
      
      <label class="block text-xs font-bold text-slate-400">포털 로그인 최하단 정보 텍스트
        <input id="configLoginInfoText" class="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-white mt-1.5 focus:outline-none" placeholder="초기 로그인 계정은 관리자 설정에서 관리됩니다." value="${safe(state.adminLoginConfigForm.loginInfoText || state.loginConfig.loginInfoText)}" />
      </label>
      
      <!-- 테마 칼라 설정 -->
      <div class="border-t border-slate-800/80 pt-4 mt-2">
        <span class="text-xs font-bold text-slate-400 block mb-2">중앙 브랜드 대표 색상</span>
        <div class="flex items-center gap-3 flex-wrap">
          <div class="flex items-center gap-2 border border-slate-800 rounded-xl p-2 bg-slate-900">
            <input type="color" id="configPrimaryColor" class="w-8 h-8 rounded-lg border-0 cursor-pointer bg-transparent" value="${state.adminLoginConfigForm.primaryColor || state.loginConfig.primaryColor || '#8436ff'}" />
            <span class="text-xs font-mono font-bold text-slate-300">${state.adminLoginConfigForm.primaryColor || state.loginConfig.primaryColor || '#8436ff'}</span>
          </div>
          
          <div class="flex flex-wrap gap-1.5">
            ${[
              { name: '네온 퍼플 (관리자)', color: '#8436ff' },
              { name: '로열 블루 (교사)', color: '#4169e1' },
              { name: '민트 그린 (학생)', color: '#00d6cd' },
              { name: '우주 바이올렛', color: '#6366f1' },
              { name: '블랙홀 스틸', color: '#334155' }
            ].map(p => `
              <button type="button" data-action="set-color-preset" data-color="${p.color}" class="px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                (state.adminLoginConfigForm.primaryColor || state.loginConfig.primaryColor || '#8436ff') === p.color
                ? 'bg-slate-800 border-slate-650 text-white'
                : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-white'
              }">${p.name}</button>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- 폰트 패밀리 및 폰트 크기 비율 -->
      <div class="border-t border-slate-800/80 pt-4 grid md:grid-cols-2 gap-4">
        <label class="block text-xs font-bold text-slate-400">기본 시스템 글꼴(Font Family)
          <select id="configFontFamily" class="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-slate-300 mt-1.5 focus:outline-none">
            <option value="'SUIT', sans-serif" ${(state.adminLoginConfigForm.fontFamily || state.loginConfig.fontFamily) === "'SUIT', sans-serif" ? 'selected' : ''}>SUIT (기본 고딕)</option>
            <option value="'Pretendard', sans-serif" ${(state.adminLoginConfigForm.fontFamily || state.loginConfig.fontFamily) === "'Pretendard', sans-serif" ? 'selected' : ''}>Pretendard (깔끔한 본문체)</option>
            <option value="'GmarketSansMedium', sans-serif" ${(state.adminLoginConfigForm.fontFamily || state.loginConfig.fontFamily) === "'GmarketSansMedium', sans-serif" ? 'selected' : ''}>지마켓 산스 (강조형 타이틀체)</option>
            <option value="'Gowun Batang', serif" ${(state.adminLoginConfigForm.fontFamily || state.loginConfig.fontFamily) === "'Gowun Batang', serif" ? 'selected' : ''}>고운 바탕 (클래식 바탕체)</option>
          </select>
        </label>
        <label class="block text-xs font-bold text-slate-400">전체 웹 글자 크기 비율
          <select id="configFontScale" class="w-full border border-slate-800 rounded-xl p-3 bg-slate-900 text-xs text-slate-300 mt-1.5 focus:outline-none">
            <option value="0.9" ${(state.adminLoginConfigForm.fontScale || state.loginConfig.fontScale) == '0.9' ? 'selected' : ''}>작게 (90%)</option>
            <option value="1.0" ${(state.adminLoginConfigForm.fontScale || state.loginConfig.fontScale) == '1.0' ? 'selected' : ''}>기본 크기 (100%)</option>
            <option value="1.1" ${(state.adminLoginConfigForm.fontScale || state.loginConfig.fontScale) == '1.1' ? 'selected' : ''}>조금 크게 (110%)</option>
            <option value="1.2" ${(state.adminLoginConfigForm.fontScale || state.loginConfig.fontScale) == '1.2' ? 'selected' : ''}>아주 크게 (120%)</option>
          </select>
        </label>
      </div>

      <div class="flex justify-end pt-2">
        <button type="button" data-action="save-login-config" class="${btnClass} rounded-xl px-5 py-3 text-xs font-extrabold shadow-md">설정 변경 저장</button>
      </div>
    </div>
  `;

  const booksHtml = `
    <div class="space-y-3">
      <div class="space-y-2 max-h-64 overflow-y-auto mini-scroll pr-1">
        ${state.books.filter(b => !b.archived).sort((a, b) => String(a.title).localeCompare(String(b.title), 'ko')).map(b => `
          <div class="rounded-xl border border-slate-800 bg-slate-900/10 px-4 py-3 flex items-center justify-between gap-3 text-xs">
            <div>
              <div class="font-extrabold text-slate-200">${safe(b.title)}</div>
              <div class="text-[10px] text-slate-500 mt-1">${safe(b.subject || '-')} &middot; ${safe(b.grade || '-')}</div>
            </div>
            <button type="button" data-action="delete-book" data-id="${b.id}" class="rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 text-[11px] font-bold text-rose-400 hover:bg-rose-500 hover:text-white transition-all">영구 삭제</button>
          </div>
        `).join('') || '<div class="text-xs text-slate-500 py-4 text-center">삭제 가능한 활성 교재가 없습니다.</div>'}
      </div>
      <p class="text-[10px] text-slate-500 mt-1">학원 자산으로서 영구 삭제를 실행합니다. 교재를 임시로 숨기고 보존하시려면 "반 세팅 &gt; 교재 관리"에서 <b>보관</b> 기능을 활용하세요.</p>
    </div>
  `;

  const requestApprovalHtml = `
    <div class="space-y-3">
      <div class="rounded-xl border border-violet-500/20 bg-violet-950/10 px-4 py-3">
        <div class="text-xs font-extrabold text-violet-200">신규생 등록 요청 대기 ${pendingRequests.length}건</div>
        <div class="text-[10px] text-slate-500 mt-1">학생/학부모 등록 요청을 확인한 뒤 기존 학생 데이터로 승인합니다.</div>
      </div>
      <div class="space-y-2 max-h-72 overflow-y-auto mini-scroll pr-1">
        ${pendingRequests.length ? pendingRequests.map(req => `
          <div class="rounded-xl border border-slate-800 bg-slate-900/20 px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div>
              <div class="font-extrabold text-slate-100">${safe(req.name || '이름 없음')}</div>
              <div class="text-[10px] text-slate-500 mt-1">${safe(req.school || '-')} &middot; ${safe(req.grade || classByName(req.classId) || '-')} &middot; 요청 반: ${safe(classByName(req.classId))}</div>
            </div>
            <div class="flex gap-1.5">
              <button type="button" data-action="approve-student-request" data-id="${req.id}" class="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500 hover:text-white transition-all">승인</button>
              <button type="button" data-action="reject-student-request" data-id="${req.id}" class="rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-slate-700 transition-all">보류</button>
            </div>
          </div>
        `).join('') : '<div class="rounded-xl border border-dashed border-slate-800 bg-slate-950/20 px-4 py-8 text-center text-xs text-slate-500">대기 중인 신규생 등록 요청이 없습니다.</div>'}
      </div>
    </div>
  `;

  const classOptionsHtml = (selectedClassId = '') => state.classes.map(c => `
    <option value="${safe(c.id)}" ${String(selectedClassId) === String(c.id) ? 'selected' : ''}>${safe(c.name)} (${safe(c.grade || '-')})</option>
  `).join('');

  const studentManagementHtml = `
    <div class="space-y-3">
      <div class="text-[10px] text-slate-500">학생별 소속 반 수정, 퇴원 처리, 삭제 표시를 진행합니다. 점검 기록은 별도 보존됩니다.</div>
      <div class="space-y-2 max-h-96 overflow-y-auto mini-scroll pr-1">
        ${managedStudents.length ? managedStudents.map(s => `
          <div class="rounded-xl border ${s.status === 'withdrawn' ? 'border-amber-500/30 bg-amber-950/10' : 'border-slate-800 bg-slate-900/20'} px-4 py-3 text-xs">
            <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              <label class="flex items-center gap-2">
                <input type="checkbox" data-action="toggle-admin-student-select" data-id="${s.id}" ${selectedAdminStudentIds.has(s.id) ? 'checked' : ''} />
                <span>
                  <span class="font-extrabold text-slate-100">${safe(s.name)}</span>
                  <span class="text-[10px] text-slate-500 ml-2">${safe(s.school || '-')} &middot; ${safe(s.grade || '-')} &middot; ${safe(classByName(s.classId))}</span>
                  ${s.status === 'withdrawn' ? '<span class="ml-2 text-[10px] text-amber-300 font-black">퇴원</span>' : ''}
                </span>
              </label>
              <div class="flex flex-wrap gap-1.5 items-center">
                <select id="adminStudentClass-${safe(s.id)}" class="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1.5 text-[10px] text-slate-200">
                  ${classOptionsHtml(s.classId)}
                </select>
                <button type="button" data-action="admin-update-student-class" data-id="${s.id}" class="rounded-lg bg-slate-800 px-2.5 py-1.5 text-[10px] font-bold text-slate-200 hover:bg-slate-700">반 수정</button>
                <button type="button" data-action="admin-withdraw-student" data-id="${s.id}" class="rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 text-[10px] font-bold text-amber-300 hover:bg-amber-500 hover:text-white">퇴원</button>
                <button type="button" data-action="admin-delete-student" data-id="${s.id}" class="rounded-lg bg-rose-500/10 border border-rose-500/20 px-2.5 py-1.5 text-[10px] font-bold text-rose-300 hover:bg-rose-500 hover:text-white">삭제</button>
              </div>
            </div>
          </div>
        `).join('') : '<div class="rounded-xl border border-dashed border-slate-800 bg-slate-950/20 px-4 py-8 text-center text-xs text-slate-500">관리할 학생 데이터가 없습니다.</div>'}
      </div>
    </div>
  `;

  const bulkStudentEditHtml = `
    <div class="space-y-4">
      <div class="rounded-xl border border-slate-800 bg-slate-950/30 px-4 py-3 text-xs text-slate-300">
        선택된 학생 <span class="font-black text-violet-300">${selectedAdminStudentIds.size}명</span>을 새 학년/새 반 학생으로 복제 생성합니다. 기존 학생과 기록은 그대로 보존됩니다.
      </div>
      <div class="space-y-4">
        <div>
          <div class="text-xs font-bold text-slate-400 mb-2">새 학년 선택</div>
          <div class="flex flex-wrap gap-1.5">
            ${promotionGrades.map(grade => `
              <button type="button" data-action="admin-set-promotion-grade" data-grade="${safe(grade)}" class="rounded-lg border px-3 py-2 text-xs font-black transition-all ${selectedPromotionGrade === grade ? 'border-violet-500 bg-violet-500 text-white' : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-violet-500/60 hover:text-white'}">${safe(grade)}</button>
            `).join('')}
          </div>
        </div>
        <div>
          <div class="text-xs font-bold text-slate-400 mb-2">새 반 선택</div>
          <div class="grid md:grid-cols-2 gap-2">
            ${state.classes.map(c => `
              <button type="button" data-action="admin-set-promotion-class" data-id="${safe(c.id)}" class="rounded-xl border px-3 py-3 text-left transition-all ${selectedPromotionClassId === c.id ? 'border-violet-500 bg-violet-500/20 text-white' : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-violet-500/60 hover:text-white'}">
                <span class="block text-xs font-black">${safe(c.name)}</span>
                <span class="block text-[10px] mt-1 text-slate-500">${safe(c.grade || '-')} · ${safe(teacherNameById(c.teacherId))}T</span>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
      <button type="button" data-action="admin-run-promotion-clone" class="${btnClass} rounded-xl px-5 py-2.5 text-xs font-extrabold shadow-md">선택 학생 승급 복제 실행</button>
    </div>
  `;

  const retentionHtml = `
    <div class="space-y-3">
      <div class="rounded-xl border border-amber-500/20 bg-amber-950/10 px-4 py-3">
        <div class="text-xs font-extrabold text-amber-200">퇴원 학생 ${withdrawnStudents.length}명</div>
        <div class="text-[10px] text-slate-500 mt-1">퇴원 처리된 학생은 삭제 예정일이 지나면 정리 대상이 됩니다. 현재는 관리자 버튼으로 실행하는 배치 구조입니다.</div>
      </div>
      <button type="button" data-action="admin-purge-due-withdrawn-students" class="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 text-xs font-extrabold text-rose-300 hover:bg-rose-500 hover:text-white transition-all">삭제 예정일 지난 퇴원 학생 정리</button>
      <div class="space-y-2 max-h-52 overflow-y-auto mini-scroll pr-1">
        ${withdrawnStudents.length ? withdrawnStudents.map(s => `
          <div class="rounded-xl border border-slate-800 bg-slate-900/20 px-4 py-3 text-xs">
            <div class="font-extrabold text-slate-100">${safe(s.name)}</div>
            <div class="text-[10px] text-slate-500 mt-1">삭제 예정일: ${safe(formatMaybeDate(s.deleteAfter))}</div>
          </div>
        `).join('') : '<div class="text-xs text-slate-500 py-4 text-center">퇴원 처리된 학생이 없습니다.</div>'}
      </div>
    </div>
  `;

  return `
    <div class="space-y-6">
      
      <!-- 안내 타이틀 배너 -->
      <div class="card-3d rounded-2xl p-5 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 class="text-lg font-black text-white">포털 종합 관리자 센터</h2>
          <p class="text-xs text-slate-500 mt-1">강사 계정, 개설 학급, 모바일 인트로 텍스트 설정 등을 변경합니다. 실시간으로 반영됩니다.</p>
        </div>
        <span class="text-[10px] px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-400 font-extrabold">MASTER ADMIN</span>
      </div>

      <div class="grid xl:grid-cols-2 gap-6 items-start">
        
        <!-- LEFT COLUMN -->
        <div class="space-y-6">
          ${renderAdminAccordion({
            id: 'teachers',
            title: '강사 계정 및 목록 관리',
            subtitle: '강사 계정 추가, 수정, 삭제 및 PIN 관리',
            open: !!exp.teachers,
            childrenHtml: teachersHtml
          })}
          
          ${renderAdminAccordion({
            id: 'classes',
            title: '반 삭제 관리',
            subtitle: '개설된 학급의 영구 삭제 통제',
            open: !!exp.classes,
            childrenHtml: classesHtml
          })}

          ${renderAdminAccordion({
            id: 'studentRequests',
            title: '신규생 등록 요청 확인 및 승인',
            subtitle: pendingRequests.length ? `${pendingRequests.length}건 신청 대기` : '대기 요청 없음',
            alert: pendingRequests.length > 0,
            badgeText: pendingRequests.length ? `${pendingRequests.length}건` : '',
            open: !!exp.studentRequests,
            childrenHtml: requestApprovalHtml
          })}

          ${renderAdminAccordion({
            id: 'studentManagement',
            title: '학생 관리',
            subtitle: '반 수정, 퇴원, 삭제',
            open: !!exp.studentManagement,
            childrenHtml: studentManagementHtml
          })}
        </div>

        <!-- RIGHT COLUMN -->
        <div class="space-y-6">
          ${renderAdminAccordion({
            id: 'bulkStudentEdit',
            title: '학생 일괄 승급 복제',
            subtitle: '기존 기록 보존 후 새 학생 생성',
            open: !!exp.bulkStudentEdit,
            childrenHtml: bulkStudentEditHtml
          })}

          ${renderAdminAccordion({
            id: 'studentRetention',
            title: '퇴원 학생 자동 삭제 준비',
            subtitle: '3개월 후 삭제 배치 구조',
            open: !!exp.studentRetention,
            childrenHtml: retentionHtml
          })}

          ${renderAdminAccordion({
            id: 'loginSplash',
            title: '로그인 & 스플래시 화면 설정',
            subtitle: '모바일 메인 인트로 및 테마 칼라/폰트 설정',
            open: !!exp.loginSplash,
            childrenHtml: loginSplashHtml
          })}
          
          ${renderAdminAccordion({
            id: 'books',
            title: '교재 영구 삭제 통제',
            subtitle: '배정이 안 된 교재 자산의 영구 삭제',
            open: !!exp.books,
            childrenHtml: booksHtml
          })}
        </div>

      </div>

    </div>
  `;
}
