import React from 'react';

export default function PortalHome({ session, onLogout, onSelectService }) {
  const { role, name, grade, className, academyCode } = session || {};

  const getRoleLabel = () => {
    if (role === 'admin') return '원장/관리자';
    if (role === 'teacher') return '담당 강사';
    return `${grade || ''} 학생`;
  };

  const showExplorer = role === 'student';
  const showOMR = true; // Show OMR to everyone (opens in a new tab)
  const showOATIS = true; // Show textbook check to everyone
  const showAdminLink = role === 'admin';

  return (
    <div className="min-h-screen flex flex-col relative z-10 text-white select-none pb-12">
      {/* Header */}
      <header className="h-16 border-b border-white/5 bg-[#050507]/60 backdrop-blur-md flex items-center justify-between px-6 md:px-12">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black tracking-widest text-[#00d6cd] bg-cyan-950/30 px-2.5 py-1 rounded-lg border border-[#00d6cd]/20">
            {academyCode || 'OPEN_Aca'}
          </span>
          <div className="h-4 w-[1px] bg-white/10" />
          <h1 className="text-sm font-bold tracking-tight text-white/90">e-Yap Math Room</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <span className="text-xs text-slate-400 block">{getRoleLabel()}</span>
            <strong className="text-sm text-white font-extrabold">{name}님</strong>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="text-xs font-bold px-3 py-1.5 rounded-xl bg-white/5 hover:bg-rose-500/10 hover:text-rose-400 border border-white/5 hover:border-rose-500/20 transition-all duration-200 cursor-pointer"
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 md:px-12 flex flex-col justify-center py-8">
        
        {/* Welcome Section */}
        <div className="text-center mb-10 md:mb-14">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight leading-tight">
            반갑습니다, <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400">{name}</span>님!
          </h2>
          <p className="text-xs md:text-sm text-slate-400 mt-3 max-w-md mx-auto">
            {role === 'student' 
              ? `${className || '배정 학급'}에서 진행되는 학습 현황을 확인하세요.`
              : '교재 점검 및 분석 관리 시스템에 오신 것을 환영합니다.'}
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
          
          {/* Card 1: OATIS (Textbook Check) */}
          {showOATIS && (
            <button
              type="button"
              onClick={() => onSelectService('oatis')}
              className="portal-entry-card p-6 md:p-8 rounded-[24px] text-left bg-gradient-to-b from-white/[0.03] to-white/[0.01] border border-white/5 hover:bg-white/[0.08] hover:border-blue-500/30 group flex flex-col justify-between min-h-[200px] cursor-pointer shadow-xl transition-all duration-300 relative overflow-hidden"
            >
              {/* Decorative gradient overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 group-hover:bg-blue-500/20 transition-all duration-300 mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-book-open"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                </div>
                <h3 className="text-xl font-extrabold text-white mb-2">교재 점검 (OATIS)</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {role === 'student' 
                    ? '내 교재의 점검 완료율, 오답 피드백, 6요소 평가 결과를 확인합니다.'
                    : '학생들의 교재 검사를 기록하고 대시보드를 확인합니다.'}
                </p>
              </div>
              <div className="relative z-10 flex items-center gap-1.5 text-xs font-bold text-blue-400 mt-6 group-hover:translate-x-1.5 transition-transform">
                <span>포털 입장하기</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-right"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </div>
            </button>
          )}

          {/* Card 2: Math Explorer */}
          {showExplorer && (
            <button
              type="button"
              onClick={() => onSelectService('explorer')}
              className="portal-entry-card p-6 md:p-8 rounded-[24px] text-left bg-gradient-to-b from-white/[0.03] to-white/[0.01] border border-white/5 hover:bg-white/[0.08] hover:border-cyan-500/30 group flex flex-col justify-between min-h-[200px] cursor-pointer shadow-xl transition-all duration-300 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-110 group-hover:bg-cyan-500/20 transition-all duration-300 mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-compass"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
                </div>
                <h3 className="text-xl font-extrabold text-white mb-2">수학자 탐험관</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  수학자들의 발자취를 탐험하고, 매주 업데이트되는 퀴즈 관문을 통과하세요.
                </p>
              </div>
              <div className="relative z-10 flex items-center gap-1.5 text-xs font-bold text-cyan-400 mt-6 group-hover:translate-x-1.5 transition-transform">
                <span>퀴즈 풀고 입장</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-right"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </div>
            </button>
          )}

          {/* Card 3: OMR Answer Entry */}
          {showOMR && (
            <button
              type="button"
              onClick={() => onSelectService('omr')}
              className="portal-entry-card p-6 md:p-8 rounded-[24px] text-left bg-gradient-to-b from-white/[0.03] to-white/[0.01] border border-white/5 hover:bg-white/[0.08] hover:border-purple-500/30 group flex flex-col justify-between min-h-[200px] cursor-pointer shadow-xl transition-all duration-300 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 group-hover:bg-purple-500/20 transition-all duration-300 mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file-text"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
                </div>
                <h3 className="text-xl font-extrabold text-white mb-2">OMR 답안 입력</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  평가 시험지의 OMR 답안을 온라인으로 제출하고 성적표와 결과를 실시간으로 확인합니다.
                </p>
              </div>
              <div className="relative z-10 flex items-center gap-1.5 text-xs font-bold text-purple-400 mt-6 group-hover:translate-x-1.5 transition-transform">
                <span>포털 입장하기</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-right"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </div>
            </button>
          )}

        </div>

        {/* Admin Link at the bottom if applicable */}
        {showAdminLink && (
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => onSelectService('admin')}
              className="px-6 py-2.5 rounded-full text-xs font-bold bg-[#8436ff]/10 hover:bg-[#8436ff]/20 text-[#c4b5fd] border border-[#8436ff]/20 hover:border-[#8436ff]/40 transition-all cursor-pointer inline-flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shield-alert"><path d="M20 13c0 5-3.5 7.5-7.66 9.7a1 1 0 0 1-.68 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 .76-.97l8-2a1 1 0 0 1 .48 0l8 2A1 1 0 0 1 20 6z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
              <span>통합 관리자 대시보드 열기</span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
