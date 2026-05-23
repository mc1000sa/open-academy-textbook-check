export function renderLoginView(state, safe) {
  const config = state.loginConfig || {
    splashTitleLine1: "열린학원 교재분석",
    splashTitleLine2: "OATIS",
    splashSubtitle: "Open Academy Textbook Insight System",
    splashDescription: "교재 점검을 기록하는 수준을 넘어,<br/>진행 흐름과 운영 상태를 한눈에 보는 시스템입니다."
  };

  // 1. 관문 게이트웨이 화면
  if (state.portal === 'gateway') {
    return `
      <div class="oatis-splash-screen min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
        <div class="oatis-splash-grid w-full max-w-6xl grid lg:grid-cols-[1.05fr_0.95fr] gap-5 md:gap-8 relative z-10 items-stretch">
          
          <!-- 좌측 인트로 카드 -->
          <div class="hidden md:flex rounded-[34px] hero-panel splash-brand-panel p-8 lg:p-10 flex-col justify-between text-white min-h-[520px]">
            <div>
              <div class="splash-kicker">${safe(config.splashKicker || 'OPEN ACADEMY')}</div>
              <div class="mt-3 font-black tracking-tight" style="font-size: ${safe(config.splashTitleSizeLine1 || '38px')}; color: var(--splash-title-color);">${safe(config.splashTitleLine2)}</div>
              <div class="mt-2 text-sm font-semibold" style="color: var(--splash-muted-color);">${safe(config.splashSubtitle)}</div>
            </div>
            
            <div class="relative">
              <h1 class="font-black leading-[1.1]">
                <span class="block font-black" style="font-size: ${safe(config.splashTitleSizeLine1 || '38px')}; color: var(--splash-text-color);">${safe(config.splashTitleLine1)}</span>
                <span class="block mt-3 font-extrabold" style="font-size: ${safe(config.splashTitleSizeLine2 || '54px')}; color: var(--splash-title-color);">${safe(config.splashTitleLine2)}</span>
              </h1>
              <p class="mt-6 max-w-md text-sm leading-7" style="color: var(--splash-muted-color);">${config.splashDescription}</p>
            </div>

            <div class="flex items-center justify-between gap-4 pt-6 border-t border-white/10">
              <div class="text-[11px] font-bold text-sky-200">ver. OATIS-R2.0</div>
              <div class="text-[10px] text-slate-400 font-medium">Creative by mOOn_Math</div>
            </div>
          </div>

          <!-- 우측 포털 진입 관문 -->
          <div class="splash-portal-panel p-6 md:p-8 flex flex-col justify-center min-h-[520px]">
            <div class="text-center mb-8">
              <span class="splash-kicker-pill px-3 py-1 rounded-full text-[11px] font-black tracking-wider bg-purple-500/10 text-[#c4b5fd] border border-purple-500/20">
                ${safe(config.gatewayBadge || 'GATEWAY')}
              </span>
              <h2 class="text-2xl md:text-3xl font-black mt-4" style="color: var(--splash-title-color);">${safe(config.gatewayTitle || '열린학원 수학교재점검')}</h2>
              <p class="text-xs md:text-sm mt-2" style="color: var(--splash-muted-color);">${safe(config.gatewayDescription || '필요한 포털만 고르면 바로 시작합니다.')}</p>
            </div>

            <div class="flex flex-col gap-4">
              <!-- 학생 포털 -->
              <button type="button" data-action="switch-portal" data-portal="student" class="portal-entry-card w-full p-5 rounded-2xl text-left transition-all duration-300 bg-white/[0.02] border border-white/5 hover:bg-white/[0.08] hover:border-[#00d6cd]/30 group flex justify-between items-center">
                <div>
                  <span class="text-xs font-bold text-[#00d6cd] block mb-1">STUDENT PORTAL</span>
                  <strong class="text-lg font-extrabold text-white">${safe(config.studentPortalTitle || '학생 / 학부모 포털')}</strong>
                  <span class="text-xs text-slate-400 block mt-1">${safe(config.studentPortalDescription || '교재 점검 완료율 및 피드백을 확인합니다.')}</span>
                </div>
                <div class="w-10 h-10 rounded-xl bg-[#00d6cd]/5 border border-[#00d6cd]/20 flex items-center justify-center text-[#00d6cd] group-hover:scale-110 group-hover:bg-[#00d6cd]/10 transition-all duration-300">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-graduation-cap"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/></svg>
                </div>
              </button>

              <!-- 교사 포털 -->
              <button type="button" data-action="switch-portal" data-portal="teacher" class="portal-entry-card w-full p-5 rounded-2xl text-left transition-all duration-300 bg-white/[0.02] border border-white/5 hover:bg-white/[0.08] hover:border-[#4169e1]/30 group flex justify-between items-center">
                <div>
                  <span class="text-xs font-bold text-[#4169e1] block mb-1">TEACHER PORTAL</span>
                  <strong class="text-lg font-extrabold text-white">${safe(config.teacherPortalTitle || '담당 강사 포털')}</strong>
                  <span class="text-xs text-slate-400 block mt-1">${safe(config.teacherPortalDescription || '학생들의 교재 검사를 기록하고 설정합니다.')}</span>
                </div>
                <div class="w-10 h-10 rounded-xl bg-[#4169e1]/5 border border-[#4169e1]/20 flex items-center justify-center text-[#4169e1] group-hover:scale-110 group-hover:bg-[#4169e1]/10 transition-all duration-300">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-presentation"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M12 17v4"/><path d="M2 10h20"/></svg>
                </div>
              </button>

              <!-- 관리자 포털 -->
              <button type="button" data-action="switch-portal" data-portal="admin" class="portal-entry-card w-full p-5 rounded-2xl text-left transition-all duration-300 bg-white/[0.02] border border-white/5 hover:bg-white/[0.08] hover:border-[#8436ff]/30 group flex justify-between items-center">
                <div>
                  <span class="text-xs font-bold text-[#8436ff] block mb-1">ADMINISTRATOR</span>
                  <strong class="text-lg font-extrabold text-white">${safe(config.adminPortalTitle || '원장 / 관리자 포털')}</strong>
                  <span class="text-xs text-slate-400 block mt-1">${safe(config.adminPortalDescription || '전체 교재 목록 및 강사, 통합 설정을 관리합니다.')}</span>
                </div>
                <div class="w-10 h-10 rounded-xl bg-[#8436ff]/5 border border-[#8436ff]/20 flex items-center justify-center text-[#8436ff] group-hover:scale-110 group-hover:bg-[#8436ff]/10 transition-all duration-300">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                </div>
              </button>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  // 2. 학생 포털 로그인 및 등록 신청 폼
  if (state.portal === 'student') {
    const activeTeacherId = state.studentLoginForm.teacherId || '';
    const activeSchool = state.studentLoginForm.school || '';
    const schoolConfirmed = !!state.studentLoginForm.schoolConfirmed || !!activeSchool;
    const activeGrade = state.studentLoginForm.grade || '';
    const activeClassId = state.studentLoginForm.classId || '';
    const activeStudentId = state.studentLoginForm.studentId || '';

    // 선생님 목록 (관리자 제외, 순수 담당교사만)
    const activeTeachers = state.teachers.filter(t => t.role === 'teacher');

    // 선택된 선생님의 개설 반들에 존재하는 학년 목록 추출
    const teacherClasses = activeTeacherId ? state.classes.filter(c => c.teacherId === activeTeacherId) : [];
    const teacherClassIds = new Set(teacherClasses.map(c => c.id));
    const availableSchools = Array.from(new Set((state.allStudents || state.students || [])
      .filter(s => !activeTeacherId || teacherClassIds.has(s.classId))
      .map(s => String(s.school || '').trim())
      .filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'ko'));
    const availableGrades = Array.from(new Set(teacherClasses.map(c => c.grade))).sort();

    // 선택한 선생님 & 학년에 맞는 반 목록
    const filteredClasses = activeTeacherId && activeGrade ? state.classes.filter(c => c.teacherId === activeTeacherId && c.grade === activeGrade) : [];

    // 선택한 반에 속한 학생 목록
    const studentsInClass = activeClassId ? state.students.filter(s => s.classId === activeClassId && s.active !== false) : [];

    return `
      <div class="oatis-auth-screen min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <div class="w-full max-w-lg glass rounded-3xl soft-border p-6 md:p-8 relative z-10">
          <div class="flex justify-between items-center mb-6">
            <button type="button" data-action="goto-gateway" class="ghost-button px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5">
              <span>← Back</span>
            </button>
            <span class="px-3 py-1 rounded-full text-[10px] font-black bg-[#00d6cd]/10 text-[#00d6cd] soft-border">
              STUDENT LOGIN
            </span>
          </div>

          ${state.loginStep === 'login' ? `
            <!-- 학생 로그인 단계 (연쇄 필터링) -->
            <div class="text-center mb-6">
              <h2 class="text-xl font-extrabold text-white">학생 / 학부모 로그인</h2>
              <p class="text-xs text-slate-400 mt-1">본인의 담당선생님, 학년, 반을 선택하고 이름을 찾으세요.</p>
            </div>

            <div class="space-y-5">
              <!-- 1단계: 담당 선생님 선택 -->
              <div>
                <label class="block text-xs font-bold text-slate-400 mb-2">1단계: 담당 선생님</label>
                <div class="choice-grid">
                  ${activeTeachers.map(t => `
                    <button type="button" data-action="select-option" data-target="studentLoginForm" data-value='${JSON.stringify({ ...state.studentLoginForm, teacherId: t.id, grade: '', classId: '', name: '', studentId: '' })}' class="choice-button btn-choice-student ${activeTeacherId === t.id ? 'selected' : ''}">
                      ${safe(t.name)} T
                    </button>
                  `).join('')}
                </div>
                ${activeTeachers.length === 0 ? `<div class="text-xs text-slate-500 py-2">등록된 선생님이 없습니다.</div>` : ''}
              </div>

              <!-- 2단계: 학년 선택 -->
              ${activeTeacherId ? `
                <div class="transition-all duration-300">
                  <label class="block text-xs font-bold text-slate-400 mb-2">2단계: 학년 선택</label>
                  <div class="choice-grid">
                    ${availableGrades.map(g => `
                      <button type="button" data-action="select-option" data-target="studentLoginForm" data-value='${JSON.stringify({ ...state.studentLoginForm, grade: g, classId: '', name: '', studentId: '' })}' class="choice-button btn-choice-student ${activeGrade === g ? 'selected' : ''}">
                        ${safe(g)}
                      </button>
                    `).join('')}
                  </div>
                  ${availableGrades.length === 0 ? `<div class="text-xs text-slate-500 py-2">선생님에게 배정된 학급(학년)이 없습니다.</div>` : ''}
                </div>
              ` : `
                <div class="p-3.5 rounded-xl bg-slate-900/20 border border-dashed border-slate-800/60 text-center text-xs text-slate-500 select-none">
                  선생님을 선택하시면 학년 선택이 활성화됩니다.
                </div>
              `}

              <!-- 3단계: 반 선택 -->
              ${activeTeacherId && activeGrade ? `
                <div class="transition-all duration-300">
                  <label class="block text-xs font-bold text-slate-400 mb-2">3단계: 반 선택</label>
                  <div class="choice-grid">
                    ${filteredClasses.map(c => `
                      <button type="button" data-action="select-option" data-target="studentLoginForm" data-value='${JSON.stringify({ ...state.studentLoginForm, classId: c.id, name: '', studentId: '' })}' class="choice-button btn-choice-student ${activeClassId === c.id ? 'selected' : ''}">
                        ${safe(c.name)}
                      </button>
                    `).join('')}
                  </div>
                  ${filteredClasses.length === 0 ? `<div class="text-xs text-slate-500 py-2">개설된 반 정보가 없습니다.</div>` : ''}
                </div>
              ` : activeTeacherId ? `
                <div class="p-3.5 rounded-xl bg-slate-900/20 border border-dashed border-slate-800/60 text-center text-xs text-slate-500 select-none">
                  학년을 선택하시면 반 선택이 활성화됩니다.
                </div>
              ` : ''}

              <!-- 4단계: 학생명 입력 -->
              ${activeClassId ? `
                <div class="transition-all duration-300">
                  <label class="block text-xs font-bold text-slate-400 mb-2">4단계: 학생명 입력</label>
                  <input id="studentLoginNameInput" type="text" class="w-full h-12 border border-slate-800 rounded-xl px-4 text-sm bg-slate-900/30 focus:border-[#00d6cd] outline-none text-white transition-colors" placeholder="본인의 이름을 정확히 입력하세요" value="${safe(state.studentLoginForm.name || '')}" />
                  <div id="studentLoginFeedback" class="mt-2 text-[11px] font-semibold">
                    ${state.studentLoginForm.name && !activeStudentId ? `
                      <span class="text-rose-400">⚠️ 이 반에 소속된 해당 이름의 학생을 찾을 수 없습니다.</span>
                    ` : activeStudentId ? `
                      <span class="text-emerald-400">✨ 학생 확인 완료! 아래 5단계에서 PIN 번호를 입력해 주세요.</span>
                    ` : ''}
                  </div>
                </div>
              ` : activeGrade ? `
                <div class="p-3.5 rounded-xl bg-slate-900/20 border border-dashed border-slate-800/60 text-center text-xs text-slate-500 select-none">
                  반을 선택하시면 학생명 입력이 활성화됩니다.
                </div>
              ` : ''}

              <!-- 5단계: PIN 비밀번호 입력 -->
              <div id="studentLoginPinSection" class="${activeStudentId ? 'opacity-100' : 'opacity-40 pointer-events-none'} transition-opacity duration-300">
                <label class="block text-xs font-bold text-slate-400 mb-2">5단계: 4자리 PIN 비밀번호</label>
                <input id="studentLoginPin" type="password" maxlength="4" class="w-full h-14 border border-slate-800 rounded-2xl text-center text-2xl tracking-[1em] font-black bg-slate-900/30 focus:border-[#00d6cd] outline-none text-white" placeholder="••••" value="${safe(state.studentLoginForm.pin || '')}" ${!activeStudentId ? 'disabled' : ''} />
                <p class="text-[10px] text-slate-500 mt-1.5 text-center">초기 비밀번호는 <strong>1234</strong> 입니다.</p>
              </div>

              <button id="studentLoginSubmitBtn" type="button" data-action="student-login-submit" class="btn-student w-full h-12 rounded-xl text-sm font-extrabold mt-6" ${!activeStudentId ? 'disabled' : ''}>
                대시보드 로그인
              </button>

              <div class="text-center mt-4 pt-4 border-t border-slate-800/80">
                <span class="text-xs text-slate-400">학원에 처음 등록하셨나요?</span>
                <button type="button" data-action="student-step" data-step="register" class="text-xs text-[#00d6cd] font-bold ml-1.5 hover:underline">
                  신규 학생 등록신청 하기
                </button>
              </div>
            </div>
          ` : `
            <!-- 신규 학생 등록 신청 단계 -->
            <div class="text-center mb-6">
              <h2 class="text-xl font-extrabold text-white">신규 학생 등록 신청</h2>
              <p class="text-xs text-slate-400 mt-1">소속될 반을 차례대로 정하고 이름과 초기 PIN을 입력하세요.</p>
            </div>

            <div class="space-y-4">
              <!-- 1단계: 담당 선생님 선택 -->
              <div>
                <label class="block text-xs font-bold text-slate-400 mb-2">1단계: 담당 선생님</label>
                <div class="choice-grid">
                  ${activeTeachers.map(t => `
                    <button type="button" data-action="select-option" data-target="studentLoginForm" data-value='${JSON.stringify({ ...state.studentLoginForm, teacherId: t.id, school: '', schoolConfirmed: false, grade: '', classId: '', pin: '' })}' class="choice-button btn-choice-student ${activeTeacherId === t.id ? 'selected' : ''}">
                      ${safe(t.name)} T
                    </button>
                  `).join('')}
                </div>
              </div>

              <!-- 2단계: 학교 선택 -->
              ${activeTeacherId ? `
                <div class="transition-all duration-300">
                  <label class="block text-xs font-bold text-slate-400 mb-2">2단계: 학교 선택</label>
                  <div class="choice-grid">
                    <button type="button" data-action="select-option" data-target="studentLoginForm" data-value='${JSON.stringify({ ...state.studentLoginForm, school: '', schoolConfirmed: true, grade: '', classId: '', pin: '' })}' class="choice-button btn-choice-student ${schoolConfirmed && !activeSchool ? 'selected' : ''}">
                      학교 미선택
                    </button>
                    ${availableSchools.map(school => `
                      <button type="button" data-action="select-option" data-target="studentLoginForm" data-value='${JSON.stringify({ ...state.studentLoginForm, school, schoolConfirmed: true, grade: '', classId: '', pin: '' })}' class="choice-button btn-choice-student ${activeSchool === school ? 'selected' : ''}">
                        ${safe(school)}
                      </button>
                    `).join('')}
                  </div>
                  ${availableSchools.length === 0 ? `<div class="text-[10px] text-slate-500 mt-2">등록된 학교명이 아직 없으면 학교 미선택으로 신청하세요.</div>` : ''}
                </div>
              ` : `
                <div class="p-3.5 rounded-xl bg-slate-900/20 border border-dashed border-slate-800/60 text-center text-xs text-slate-500 select-none">
                  선생님을 선택하시면 학교 선택이 활성화됩니다.
                </div>
              `}

              <!-- 3단계: 학년 선택 -->
              ${activeTeacherId && schoolConfirmed ? `
                <div class="transition-all duration-300">
                  <label class="block text-xs font-bold text-slate-400 mb-2">3단계: 학년 선택</label>
                  <div class="choice-grid">
                    ${availableGrades.map(g => `
                      <button type="button" data-action="select-option" data-target="studentLoginForm" data-value='${JSON.stringify({ ...state.studentLoginForm, grade: g, classId: '', pin: '' })}' class="choice-button btn-choice-student ${activeGrade === g ? 'selected' : ''}">
                        ${safe(g)}
                      </button>
                    `).join('')}
                  </div>
                </div>
              ` : `
                <div class="p-3.5 rounded-xl bg-slate-900/20 border border-dashed border-slate-800/60 text-center text-xs text-slate-500 select-none">
                  학교를 선택하시면 학년 선택이 활성화됩니다.
                </div>
              `}

              <!-- 4단계: 소속 반 선택 -->
              ${activeTeacherId && activeGrade ? `
                <div class="transition-all duration-300">
                  <label class="block text-xs font-bold text-slate-400 mb-2">4단계: 소속 반 선택</label>
                  <div class="choice-grid">
                    ${filteredClasses.map(c => `
                      <button type="button" data-action="select-option" data-target="studentLoginForm" data-value='${JSON.stringify({ ...state.studentLoginForm, classId: c.id, pin: '' })}' class="choice-button btn-choice-student ${activeClassId === c.id ? 'selected' : ''}">
                        ${safe(c.name)}
                      </button>
                    `).join('')}
                  </div>
                </div>
              ` : activeTeacherId ? `
                <div class="p-3.5 rounded-xl bg-slate-900/20 border border-dashed border-slate-800/60 text-center text-xs text-slate-500 select-none">
                  학년을 선택하시면 반 선택이 활성화됩니다.
                </div>
              ` : ''}

              <!-- 인풋 영역 -->
              <div class="${activeClassId ? 'opacity-100' : 'opacity-40'} transition-opacity duration-300 space-y-4">
                <div>
                  <label class="block text-xs font-bold text-slate-400 mb-2">5단계: 이름 입력</label>
                  <input type="text" id="studentRegName" placeholder="실명을 입력해 주세요" class="w-full p-3 text-sm rounded-xl bg-slate-900/30 border border-slate-850 text-white focus:border-[#00d6cd] outline-none" value="${safe(state.studentLoginForm.name || '')}" ${!activeClassId ? 'disabled' : ''} />
                </div>

                <div>
                  <label class="block text-xs font-bold text-slate-400 mb-2">6단계: 사용할 4자리 PIN 비밀번호</label>
                  <input type="password" id="studentRegPin" maxlength="4" inputmode="numeric" autocomplete="new-password" placeholder="숫자 4자리 설정" class="w-full p-3 text-sm rounded-xl text-center text-lg font-bold bg-slate-900/30 border border-slate-850 text-white focus:border-[#00d6cd] outline-none" value="${safe(state.studentLoginForm.pin || '')}" ${!activeClassId ? 'disabled' : ''} />
                </div>
              </div>

              <button type="button" data-action="student-register-submit" class="btn-student w-full h-12 rounded-xl text-sm font-extrabold mt-6" ${!activeClassId ? 'disabled' : ''}>
                등록 신청 완료
              </button>

              <div class="text-center mt-4 pt-4 border-t border-slate-800/80">
                <span class="text-xs text-slate-400">이미 등록되어 있으신가요?</span>
                <button type="button" data-action="student-step" data-step="login" class="text-xs text-[#00d6cd] font-bold ml-1.5 hover:underline">
                  PIN 번호 로그인하기
                </button>
              </div>
            </div>
          `}
        </div>
      </div>
    `;
  }

  // 3. 교사 포털 로그인 폼
  if (state.portal === 'teacher') {
    const hasLoginError = !!state.loginError;
    return `
      <div class="oatis-auth-screen min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <div class="w-full max-w-lg glass rounded-3xl soft-border p-6 md:p-8 relative z-10">
          <div class="flex justify-between items-center mb-6">
            <button type="button" data-action="goto-gateway" class="ghost-button px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5">
              <span>← Back</span>
            </button>
            <span class="px-3 py-1 rounded-full text-[10px] font-black bg-[#4169e1]/10 text-[#4169e1] soft-border">
              TEACHER PORTAL
            </span>
          </div>

          <div class="text-center mb-6">
            <h2 class="text-xl font-extrabold text-white">담당 교사 빠른 로그인</h2>
              <p class="text-xs text-slate-400 mt-1">선생님 이름을 선택하고 6자리 PIN을 입력하세요.</p>
          </div>

          <div class="space-y-6">
            <!-- 선생님 선택 (칩 그리드) -->
            <div>
              <label class="block text-xs font-bold text-slate-400 mb-3">1단계: 선생님 선택</label>
              <div class="choice-grid">
                ${state.teachers.filter(t => t.role === 'teacher').map(t => `
                  <button type="button" data-action="select-teacher" data-id="${t.id}" class="choice-button btn-choice-teacher ${state.selectedTeacherName === t.id ? 'selected' : ''}">
                    ${safe(t.name)}
                  </button>
                `).join('')}
              </div>
              ${state.teachers.filter(t => t.role === 'teacher').length === 0 ? `<div class="text-xs text-slate-500 py-2">등록된 교사 계정이 없습니다. 원장(관리자) 메뉴에서 추가해 주세요.</div>` : ''}
            </div>

            <!-- PIN 번호 입력 -->
            <div>
              <label class="block text-xs font-bold text-slate-400 mb-2">2단계: 6자리 PIN 번호</label>
              <input id="loginPin" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" name="teacherPinEntry" data-lpignore="true" class="w-full h-14 border rounded-2xl text-center text-2xl tracking-[0.65em] font-black outline-none transition-all ${hasLoginError ? 'border-rose-500 bg-rose-950/30 text-rose-100 focus:border-rose-400 shadow-[0_0_0_3px_rgba(244,63,94,0.18)]' : 'focus:border-[#4169e1]'}" placeholder="••••••" value="${safe(state.pin)}" ${state.selectedTeacherName ? 'data-autofocus="true"' : ''} ${!state.selectedTeacherName ? 'disabled' : ''} />
              ${hasLoginError ? `<div id="loginErrorMessage" class="mt-2 rounded-xl border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-xs font-bold text-rose-300">${safe(state.loginError)}</div>` : ''}
            </div>

            <button type="button" data-action="login" class="btn-teacher w-full h-12 rounded-xl text-sm font-extrabold" ${!state.selectedTeacherName ? 'disabled' : ''}>
              강사 로그인
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // 4. 원장/관리자 로그인 폼
  if (state.portal === 'admin') {
    const hasLoginError = !!state.loginError;
    const adminAccount = state.teachers.find(t => t.role === 'admin') || { id: 't_admin', name: '관리자' };

    return `
      <div class="oatis-auth-screen min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <div class="w-full max-w-md glass rounded-3xl soft-border p-6 md:p-8 relative z-10">
          <div class="flex justify-between items-center mb-6">
            <button type="button" data-action="goto-gateway" class="ghost-button px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5">
              <span>← Back</span>
            </button>
            <span class="px-3 py-1 rounded-full text-[10px] font-black bg-[#8436ff]/10 text-[#8436ff] soft-border">
              ADMIN LOGIN
            </span>
          </div>

          <div class="text-center mb-6">
            <h2 class="text-xl font-extrabold text-white">관리자 시스템 로그인</h2>
            <p class="text-xs text-slate-400 mt-1">원장 전용 PIN 패스워드를 입력하세요.</p>
          </div>

          <!-- 원장님은 단일 계정이므로 강사 선택 과정을 생략하고 바로 PIN 입력 -->
          <div class="space-y-6">
            <input type="hidden" id="adminTeacherNameHidden" value="${adminAccount.id}" />
            
            <script>
              // 강사 폼의 전용 바인딩 트리거를 위해 state 속성에 강제 세팅
              window.setTimeout(() => {
                if (document.getElementById('adminTeacherNameHidden')) {
                  const val = document.getElementById('adminTeacherNameHidden').value;
                  // 직접 선택한 선생님 이름 강제 매핑
                  if (window.OATIS_STATE) {
                    window.OATIS_STATE.selectedTeacherName = val;
                  }
                }
              }, 100);
            </script>

            <div>
              <label class="block text-xs font-bold text-slate-400 mb-2">관리자 6자리 PIN 패스워드</label>
              <!-- input 활성화를 위해 selectedTeacherName 상태가 필요하여 강제 설정하게끔 처리 -->
              <input id="loginPin" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" name="adminPinEntry" data-lpignore="true" class="w-full h-14 border rounded-2xl text-center text-2xl tracking-[0.65em] font-black outline-none transition-all ${hasLoginError ? 'border-rose-500 bg-rose-950/30 text-rose-100 focus:border-rose-400 shadow-[0_0_0_3px_rgba(244,63,94,0.18)]' : 'focus:border-[#8436ff]'}" placeholder="••••••" value="${safe(state.pin)}" data-autofocus="true" />
              ${hasLoginError ? `<div id="loginErrorMessage" class="mt-2 rounded-xl border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-xs font-bold text-rose-300">${safe(state.loginError)}</div>` : ''}
            </div>

            <!-- 관리자 로그인 액션에 바인딩되도록 render()에서 강제 매핑해 주기 위함 -->
            <button type="button" data-action="login" class="btn-admin w-full h-12 rounded-xl text-sm font-extrabold">
              관리자 모드 시작
            </button>
            <p class="text-[10px] text-slate-500 mt-1.5 text-center">원장용 기본 PIN 번호는 <strong>999999</strong> 입니다.</p>
          </div>
        </div>
      </div>
    `;
  }

  return ``;
}
