import React from 'react';

const VIEW_TITLES = {
  dashboard: '전체 대시보드',
  inspections: '학생별 교재점검',
  reports: '학생별 보고서 출력',
  setup: '반/학생 설정',
  bookSetup: '교재 관리',
  teachersAdmin: '관리자 설정',
  studentPortal: '학생 대시보드'
};

export default function Layout({
  children,
  currentView,
  setView,
  currentTeacher,
  studentSession,
  portal,
  saveMsg,
  handleLogout,
  onGoBack
}) {
  const currentTeacherName = currentTeacher?.name || '';

  // Badges for accounts
  let adminBadge = null;
  if (currentTeacher?.role === 'admin') {
    adminBadge = (
      <span className="inline-flex rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 px-3 py-0.5 text-[10px] font-black text-white ml-2">
        ADMIN
      </span>
    );
  } else if (currentTeacher) {
    adminBadge = (
      <span className="inline-flex rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-3 py-0.5 text-[10px] font-black text-white ml-2">
        TEACHER
      </span>
    );
  }

  // Accent styles depending on Portal Theme
  let accentColor = '#4169e1';
  let sideTitle = 'TEACHER MODE';
  if (portal === 'admin') {
    accentColor = '#8436ff';
    sideTitle = 'ADMIN MODE';
  } else if (portal === 'student') {
    accentColor = '#00d6cd';
    sideTitle = 'STUDENT MODE';
  }

  // Sidebar Menu list
  const renderMenuItems = () => {
    if (portal === 'student') return null;
    
    if (portal === 'admin') {
      return (
        <button
          type="button"
          onClick={() => setView('teachersAdmin')}
          className={`w-full flex items-center gap-3 px-4 py-3 font-bold text-sm rounded-xl transition-all duration-200 ${
            currentView === 'teachersAdmin' ? 'nav-pill-active text-white' : 'nav-pill text-slate-400'
          }`}
          style={currentView === 'teachersAdmin' ? {
            background: 'linear-gradient(135deg, #8436ff 0%, #632cd6 100%)',
            boxShadow: '0 8px 20px rgba(132, 54, 255, 0.3)'
          } : {}}
        >
          <i className="fas fa-user-gear w-5"></i>
          관리자 설정
        </button>
      );
    }

    // teacher portal
    const menuList = [
      { view: 'inspections', label: '학생별 교재점검', icon: 'fa-clipboard-check' },
      { view: 'reports', label: '학생별 보고서 출력', icon: 'fa-file-pdf' },
      { view: 'setup', label: '반/학생 설정', icon: 'fa-users' },
      { view: 'bookSetup', label: '교재 관리', icon: 'fa-book' },
      { view: 'dashboard', label: '전체 대시보드', icon: 'fa-chart-pie' }
    ];

    return menuList.map(item => {
      const active = currentView === item.view;
      return (
        <button
          key={item.view}
          type="button"
          onClick={() => setView(item.view)}
          className={`w-full flex items-center gap-3 px-4 py-3 font-bold text-sm rounded-xl transition-all duration-200 ${
            active ? 'nav-pill-active text-white' : 'nav-pill text-slate-400'
          }`}
          style={active ? {
            background: 'linear-gradient(135deg, #4169e1 0%, #2f46ff 100%)',
            boxShadow: '0 8px 20px rgba(65, 105, 225, 0.3)'
          } : {}}
        >
          <i className={`fas ${item.icon} w-5`}></i>
          {item.label}
        </button>
      );
    });
  };

  // Mobile Menu list
  const renderMobileMenuItems = () => {
    if (portal === 'student') return null;

    if (portal === 'admin') {
      const active = currentView === 'teachersAdmin';
      return (
        <button
          type="button"
          onClick={() => setView('teachersAdmin')}
          className={`rounded-full px-4 py-2 text-xs font-bold border whitespace-nowrap transition-all duration-200 ${
            active
              ? 'text-white border-transparent bg-gradient-to-r from-purple-600 to-indigo-600'
              : 'text-slate-300 border-slate-700 bg-slate-900/50'
          }`}
        >
          설정
        </button>
      );
    }

    const menuList = [
      { view: 'inspections', label: '점검' },
      { view: 'reports', label: '보고서' },
      { view: 'setup', label: '반/학생 설정' },
      { view: 'bookSetup', label: '교재 관리' },
      { view: 'dashboard', label: '대시보드' }
    ];

    return menuList.map(item => {
      const active = currentView === item.view;
      const activeClass = active
        ? 'text-white border-transparent bg-gradient-to-r from-blue-600 to-indigo-500'
        : 'text-slate-300 border-slate-700 bg-slate-900/50';
      return (
        <button
          key={item.view}
          type="button"
          onClick={() => setView(item.view)}
          className={`rounded-full px-4 py-2 text-xs font-bold border whitespace-nowrap transition-all duration-200 ${activeClass}`}
        >
          {item.label}
        </button>
      );
    });
  };

  // 1Column Layout for Students
  if (portal === 'student') {
    return (
      <div className="app-shell min-h-screen bg-transparent relative">
        <main className="w-full p-4 sm:p-6 space-y-6">
          {onGoBack && (
            <div className="no-print max-w-4xl mx-auto flex justify-between items-center bg-slate-955/40 p-4 rounded-2xl border border-white/5">
              <span className="text-xs font-bold text-slate-400">교재 점검 피드백</span>
              <button
                type="button"
                onClick={onGoBack}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#00d6cd]/10 hover:bg-[#00d6cd]/20 text-[#00d6cd] border border-[#00d6cd]/20 hover:border-[#00d6cd]/40 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <i className="fas fa-home"></i>
                포털 홈으로 이동
              </button>
            </div>
          )}
          {saveMsg && (
            <div className="no-print max-w-4xl mx-auto rounded-2xl border border-cyan-500/30 bg-cyan-950/20 px-4 py-3 text-sm font-black text-cyan-400">
              {saveMsg}
            </div>
          )}
          {children}
        </main>
      </div>
    );
  }

  // Teacher / Admin Layout
  return (
    <div className="app-shell min-h-screen bg-transparent">
      
      {/* Desktop sidebar */}
      <div className="hidden xl:flex fixed left-5 top-5 bottom-5 w-[268px] rounded-[32px] glass soft-border sidebar-shadow p-5 flex-col no-print">
        <div className="pb-6 border-b border-white/5">
          <div className="sidebar-logo-card px-5 py-5 text-white" style={{ borderTop: `3px solid ${accentColor}` }}>
            <div className="px-2 py-2 flex items-center justify-center min-h-[72px]">
              <img src="./logo.png" alt="열린학원 로고" className="max-h-12 w-auto object-contain" onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'block'; }} />
              <div className="text-2xl font-black text-white tracking-tight" style={{ display: 'none' }}>열린학원</div>
            </div>
            <div className="mt-4 text-center">
              <div className="text-2xl font-black text-[#f9f7ff]">OATIS</div>
              <div className="mt-2 text-[11px] leading-5 text-slate-400 font-extrabold tracking-wider">{sideTitle}</div>
            </div>
          </div>
        </div>
        
        {/* Sidebar Menu items */}
        <div className="mt-6 space-y-2 flex-1">
          {onGoBack && (
            <button
              type="button"
              onClick={onGoBack}
              className="w-full flex items-center gap-3 px-4 py-2.5 font-bold text-sm rounded-xl transition-all duration-205 text-cyan-400 hover:text-white bg-slate-900/40 hover:bg-slate-900 border border-white/5 hover:border-cyan-500/30 mb-4 cursor-pointer"
            >
              <i className="fas fa-home w-5"></i>
              포털 홈으로 이동
            </button>
          )}
          {renderMenuItems()}
        </div>
        
        {/* Account profile and Logout button */}
        <div className="mt-auto space-y-3">
          <div className="bg-slate-900/40 p-4 rounded-2xl border border-white/5">
            <div className="text-[10px] text-slate-500 font-bold mb-1 tracking-wider">LOGIN ACCOUNT</div>
            <div className="flex items-center justify-between gap-1.5">
              <div className="font-extrabold text-sm text-slate-200">{currentTeacherName} T</div>
              {adminBadge}
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-white font-bold py-3 shadow-sm border border-slate-700/50 transition-all duration-200"
            style={{ cursor: 'pointer' }}
          >
            로그아웃
          </button>
        </div>
      </div>

      {/* Main content area */}
      <main className="xl:pl-[298px] p-4 sm:p-6 space-y-6">
        
        {/* Main top header banner */}
        <header className="sticky top-0 z-30 rounded-[30px] p-5 sm:p-6 no-print text-white" style={{ background: 'rgba(11, 13, 25, 0.85)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.05)', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)' }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs sm:text-sm font-black tracking-[0.18em] text-[#00d6cd]">OPEN ACADEMY &middot; OATIS</div>
              <h2 className="mt-2 text-2xl sm:text-3xl font-black text-white">{VIEW_TITLES[currentView] || ''}</h2>
            </div>
            <div className="flex items-center gap-3 no-print">
              <div className="hidden sm:block text-[11px] font-black tracking-[0.08em] text-slate-400">Creative by mOOn_Math</div>
            </div>
          </div>
          
          {/* Mobile responsive navigation tabs */}
          <div className="xl:hidden mt-4 flex gap-2 overflow-x-auto pb-1 no-print animate-fadeIn">
            {onGoBack && (
              <button
                type="button"
                onClick={onGoBack}
                className="rounded-full px-4 py-2 text-xs font-bold border border-[#00d6cd]/30 bg-[#00d6cd]/10 text-[#00d6cd] whitespace-nowrap cursor-pointer"
              >
                포털 홈
              </button>
            )}
            {renderMobileMenuItems()}
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full px-4 py-2 text-xs font-bold border border-slate-700 bg-slate-900 text-rose-400 whitespace-nowrap"
            >
              로그아웃
            </button>
          </div>
        </header>

        {/* Notifications toast */}
        {saveMsg && (
          <div className="no-print rounded-2xl border border-cyan-500/30 bg-cyan-950/20 px-4 py-3 text-sm font-black text-cyan-400">
            {saveMsg}
          </div>
        )}

        {/* Content insertion */}
        {children}
      </main>

    </div>
  );
}
