export const VIEW_TITLES = {
  inspections: '학생별 교재점검',
  reports: '학생별 보고서 출력',
  setup: '반/학생 설정',
  bookSetup: '교재 관리',
  teachersAdmin: '관리자 설정',
  studentPortal: '학생 대시보드'
};

export function renderMenuButton({ currentView, view, label, icon, portalTheme }) {
  const activeClass = currentView === view ? 'nav-pill-active' : 'nav-pill';
  let activeStyle = '';
  
  if (currentView === view) {
    if (portalTheme === 'admin') {
      activeStyle = 'background: linear-gradient(135deg, #8436ff 0%, #632cd6 100%) !important; box-shadow: 0 8px 20px rgba(132, 54, 255, 0.3) !important;';
    } else {
      activeStyle = 'background: linear-gradient(135deg, #4169e1 0%, #2f46ff 100%) !important; box-shadow: 0 8px 20px rgba(65, 105, 225, 0.3) !important;';
    }
  }

  return `
    <button type="button" data-action="view" data-view="${view}" class="w-full flex items-center gap-3 px-4 py-3 font-bold text-sm rounded-xl transition-all duration-200 ${activeClass}" style="${activeStyle}">
      <i class="fas ${icon} w-5"></i>
      ${label}
    </button>
  `;
}

export function renderMobileMenuButton({ currentView, view, label, portalTheme }) {
  let activeClass = '';
  if (currentView === view) {
    if (portalTheme === 'admin') {
      activeClass = 'text-white border-transparent bg-gradient-to-r from-purple-600 to-indigo-600';
    } else {
      activeClass = 'text-white border-transparent bg-gradient-to-r from-blue-600 to-indigo-500';
    }
  } else {
    activeClass = 'text-slate-300 border-slate-700 bg-slate-900/50';
  }

  return `
    <button type="button" data-action="view" data-view="${view}" class="rounded-full px-4 py-2 text-xs font-bold border whitespace-nowrap transition-all duration-200 ${activeClass}">
      ${label}
    </button>
  `;
}

export function renderCustomModalMarkup(customModal, safe, accentColor = '#4169e1') {
  if (!customModal || !customModal.open) return '';

  const isConfirmOrPrompt = customModal.type === 'confirm' || customModal.type === 'prompt';
  return `
      <div class="modal-overlay" style="position: fixed !important; top: 0 !important; right: 0 !important; bottom: 0 !important; left: 0 !important; z-index: 99999 !important; display: grid !important; place-items: center !important; padding: 1rem !important; background: rgba(5, 5, 7, 0.75) !important; backdrop-filter: blur(10px);">
        <div class="glass-card modal-content" style="max-width: 420px; width: 90%; text-align: center; padding: 2.5rem 2rem; border: 1px solid rgba(255, 255, 255, 0.15); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7); margin: 0 auto;">
          ${customModal.title ? `<h3 style="margin-top: 0; margin-bottom: 1.5rem; color: ${accentColor}; font-size: 1.3rem; font-weight: 800; letter-spacing: -0.5px;">${safe(customModal.title)}</h3>` : ''}
          <p style="margin-bottom: 1.5rem; line-height: 1.7; white-space: pre-wrap; word-break: keep-all; font-size: 0.95rem; color: rgba(255, 255, 255, 0.85);">${safe(customModal.message)}</p>
          ${customModal.type === 'prompt' ? `
            <input type="text" id="modalPromptInput" class="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-center text-white mb-6 font-mono text-lg outline-none focus:border-[${accentColor}]" value="${safe(customModal.inputValue || '')}" autocomplete="off" autofocus />
          ` : ''}
          <div class="submit-row" style="gap: 0.75rem; display: flex; justify-content: center;">
            ${isConfirmOrPrompt ? `
              <button type="button" data-action="modal-cancel" class="ghost-button" style="flex: 1; padding: 0.85rem; font-size: 0.9rem; border-radius: 12px;">
                ${safe(customModal.cancelText || '취소')}
              </button>
            ` : ''}
            <button type="button" data-action="modal-confirm" class="primary-button" style="flex: 1; padding: 0.85rem; font-size: 0.9rem; border-radius: 12px; background: linear-gradient(135deg, ${accentColor} 0%, #2f46ff 100%);">
              ${safe(customModal.confirmText || '확인')}
            </button>
          </div>
        </div>
      </div>
    `;
}

export function renderLayoutView({ content, currentView, currentTeacher, studentSession, portal, saveMsg, customModal }, safe) {
  const currentTeacherName = currentTeacher?.name || '';
  
  // 포털 권한 배지
  let adminBadge = '';
  if (currentTeacher?.role === 'admin') {
    adminBadge = `<span class="inline-flex rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 px-3 py-0.5 text-[10px] font-black text-white ml-2">ADMIN</span>`;
  } else if (currentTeacher) {
    adminBadge = `<span class="inline-flex rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-3 py-0.5 text-[10px] font-black text-white ml-2">TEACHER</span>`;
  }

  // 포털별 렌더링할 네비게이션 메뉴 분기
  let menuHtml = '';
  let mobileMenuHtml = '';
  let logoutBtnHtml = `<button type="button" data-action="logout" class="w-full rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-white font-bold py-3 shadow-sm border border-slate-700/50 transition-all duration-200">로그아웃</button>`;
  
  if (portal === 'student') {
    // 학생 포털은 사이드바를 제거한 1컬럼 레이아웃으로 넓고 시원하게 렌더링 (사이드바 HTML 공백 처리)
    menuHtml = '';
  } else if (portal === 'admin') {
    menuHtml += renderMenuButton({ currentView, view: 'teachersAdmin', label: '관리자 설정', icon: 'fa-user-gear', portalTheme: 'admin' });
    
    mobileMenuHtml += renderMobileMenuButton({ currentView, view: 'teachersAdmin', label: '설정', portalTheme: 'admin' });
  } else {
    // teacher 포털
    menuHtml += renderMenuButton({ currentView, view: 'inspections', label: '학생별 교재점검', icon: 'fa-clipboard-check', portalTheme: 'teacher' });
    menuHtml += renderMenuButton({ currentView, view: 'reports', label: '학생별 보고서 출력', icon: 'fa-file-pdf', portalTheme: 'teacher' });
    menuHtml += renderMenuButton({ currentView, view: 'setup', label: '반/학생 설정', icon: 'fa-users', portalTheme: 'teacher' });
    menuHtml += renderMenuButton({ currentView, view: 'bookSetup', label: '교재 관리', icon: 'fa-book', portalTheme: 'teacher' });
    
    mobileMenuHtml += renderMobileMenuButton({ currentView, view: 'inspections', label: '점검', portalTheme: 'teacher' });
    mobileMenuHtml += renderMobileMenuButton({ currentView, view: 'reports', label: '보고서', portalTheme: 'teacher' });
    mobileMenuHtml += renderMobileMenuButton({ currentView, view: 'setup', label: '반/학생 설정', portalTheme: 'teacher' });
    mobileMenuHtml += renderMobileMenuButton({ currentView, view: 'bookSetup', label: '교재 관리', portalTheme: 'teacher' });
  }

  // 테마 고유 지시색 (Mint vs Blue vs Purple)
  let accentColor = '#4169e1';
  let sideTitle = 'TEACHER MODE';
  if (portal === 'admin') {
    accentColor = '#8436ff';
    sideTitle = 'ADMIN MODE';
  } else if (portal === 'student') {
    accentColor = '#00d6cd';
    sideTitle = 'STUDENT MODE';
  }

  // 커스텀 모달 컴포넌트 마크업
  let modalMarkup = '';
  if (customModal && customModal.open) {
    const isConfirmOrPrompt = customModal.type === 'confirm' || customModal.type === 'prompt';
    modalMarkup = `
      <div class="modal-overlay" style="z-index: 9999;">
        <div class="glass-card modal-content" style="max-width: 420px; width: 90%; text-align: center; padding: 2.5rem 2rem; border: 1px solid rgba(255, 255, 255, 0.15); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);">
          ${customModal.title ? `<h3 style="margin-top: 0; margin-bottom: 1.5rem; color: ${accentColor}; font-size: 1.3rem; font-weight: 800; letter-spacing: -0.5px;">${safe(customModal.title)}</h3>` : ''}
          <p style="margin-bottom: 1.5rem; line-height: 1.7; white-space: pre-wrap; word-break: keep-all; font-size: 0.95rem; color: rgba(255, 255, 255, 0.85);">${safe(customModal.message)}</p>
          ${customModal.type === 'prompt' ? `
            <input type="text" id="modalPromptInput" class="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-center text-white mb-6 font-mono text-lg outline-none focus:border-[${accentColor}]" value="${safe(customModal.inputValue || '')}" autocomplete="off" autofocus />
          ` : ''}
          <div class="submit-row" style="gap: 0.75rem; display: flex; justify-content: center;">
            ${isConfirmOrPrompt ? `
              <button type="button" data-action="modal-cancel" class="ghost-button" style="flex: 1; padding: 0.85rem; font-size: 0.9rem; border-radius: 12px;">
                ${safe(customModal.cancelText || '취소')}
              </button>
            ` : ''}
            <button type="button" data-action="modal-confirm" class="primary-button" style="flex: 1; padding: 0.85rem; font-size: 0.9rem; border-radius: 12px; background: linear-gradient(135deg, ${accentColor} 0%, #2f46ff 100%);">
              ${safe(customModal.confirmText || '확인')}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // 학생인 경우 좌측 사이드바가 아예 비노출되는 1컬럼 심플 레이아웃 템플릿
  if (portal === 'student') {
    return `
      <div class="app-shell min-h-screen bg-transparent relative">
        <main class="w-full p-4 sm:p-6 space-y-6">
          ${saveMsg ? `
            <div class="no-print max-w-4xl mx-auto rounded-2xl border border-cyan-500/30 bg-cyan-950/20 px-4 py-3 text-sm font-black text-cyan-400">
              ${safe(saveMsg)}
            </div>
          ` : ''}
          ${content}
        </main>
        ${modalMarkup}
      </div>
    `;
  }

  // 교사 및 관리자 레이아웃 (사이드바 존재)
  return `
    <div class="app-shell min-h-screen bg-transparent">
      
      <!-- 데스크톱 전용 좌측 사이드바 -->
      <div class="hidden xl:flex fixed left-5 top-5 bottom-5 w-[268px] rounded-[32px] glass soft-border sidebar-shadow p-5 flex-col no-print">
        <div class="pb-6 border-b border-white/5">
          <div class="sidebar-logo-card px-5 py-5 text-white" style="border-top: 3px solid ${accentColor};">
            <div class="px-2 py-2 flex items-center justify-center min-h-[72px]">
              <img src="./logo.png" alt="열린학원 로고" class="max-h-12 w-auto object-contain" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
              <div class="text-2xl font-black text-white tracking-tight hidden">열린학원</div>
            </div>
            <div class="mt-4 text-center">
              <div class="text-2xl font-black text-[#f9f7ff]">OATIS</div>
              <div class="mt-2 text-[11px] leading-5 text-slate-400 font-extrabold tracking-wider">${sideTitle}</div>
            </div>
          </div>
        </div>
        
        <!-- 사이드바 메뉴 -->
        <div class="mt-6 space-y-2 flex-1">
          ${menuHtml}
        </div>
        
        <!-- 강사 정보 및 로그아웃 단추 -->
        <div class="mt-auto space-y-3">
          <div class="bg-slate-900/40 p-4 rounded-2xl border border-white/5">
            <div class="text-[10px] text-slate-500 font-bold mb-1 tracking-wider">LOGIN ACCOUNT</div>
            <div class="flex items-center justify-between gap-1.5">
              <div class="font-extrabold text-sm text-slate-200">${safe(currentTeacherName)} T</div>
              ${adminBadge}
            </div>
          </div>
          ${logoutBtnHtml}
        </div>
      </div>

      <!-- 우측 메인 콘텐츠 컨테이너 -->
      <main class="xl:pl-[298px] p-4 sm:p-6 space-y-6">
        
        <!-- 메인 탑 히어로 배너 (모바일의 경우 네비게이션 바 포함 - 글래스 블러로 겹침 현상 해결) -->
        <header class="sticky top-0 z-30 rounded-[30px] p-5 sm:p-6 no-print text-white" style="background: rgba(11, 13, 25, 0.85) !important; backdrop-filter: blur(16px) !important; -webkit-backdrop-filter: blur(16px) !important; border: 1px solid rgba(255, 255, 255, 0.05); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-xs sm:text-sm font-black tracking-[0.18em] text-[#00d6cd]">OPEN ACADEMY &middot; OATIS</div>
              <h2 class="mt-2 text-2xl sm:text-3xl font-black text-white">${VIEW_TITLES[currentView] || ''}</h2>
            </div>
            <div class="flex items-center gap-3 no-print">
              <div class="hidden sm:block text-[11px] font-black tracking-[0.08em] text-slate-400">Creative by mOOn_Math</div>
              <button type="button" data-action="print" class="px-4 py-2 rounded-full font-extrabold text-xs text-slate-950 bg-white hover:bg-slate-100 transition-colors">
                인쇄 / PDF
              </button>
            </div>
          </div>
          
          <!-- 모바일 디바이스용 메뉴 탭 -->
          <div class="xl:hidden mt-4 flex gap-2 overflow-x-auto pb-1 no-print">
            ${mobileMenuHtml}
            <button type="button" data-action="logout" class="rounded-full px-4 py-2 text-xs font-bold border border-slate-700 bg-slate-900 text-rose-400 whitespace-nowrap">
              로그아웃
            </button>
          </div>
        </header>

        <!-- 저장/알림용 노티 배너 -->
        ${saveMsg ? `
          <div class="no-print rounded-2xl border border-cyan-500/30 bg-cyan-950/20 px-4 py-3 text-sm font-black text-cyan-400">
            ${safe(saveMsg)}
          </div>
        ` : ''}

        <!-- 메인 본문 콘텐츠 마운트 -->
        ${content}
      </main>

      <!-- 커스텀 모달 컨테이너 -->
      ${modalMarkup}

    </div>
  `;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// 칩 형태 버튼 선택기 렌더러 (타이트한 버튼 드롭다운 대체용)
export function renderBtnSelect({ id, options, selectedValue, placeholder = '선택사항이 없습니다.' }) {
  const safeId = escapeHtml(id);
  if (!options || options.length === 0) {
    return `<div class="text-xs text-slate-500 p-2 font-bold">${escapeHtml(placeholder)}</div>`;
  }
  return `
    <div class="choice-grid" id="${safeId}">
      ${options.map(opt => {
        const active = String(opt.value) === String(selectedValue);
        const btnClass = active ? 'selected' : '';
        return `
          <button type="button" data-action="select-option" data-target="${safeId}" data-value="${escapeHtml(opt.value)}" class="choice-button btn-choice-teacher ${btnClass}">
            ${escapeHtml(opt.label)}
          </button>
        `;
      }).join('')}
    </div>
  `;
}
