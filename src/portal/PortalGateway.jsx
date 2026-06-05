import React, { useState } from 'react';

export default function PortalGateway({ onSelectRole, loginConfig }) {
  const [academyCode, setAcademyCode] = useState(() => {
    return localStorage.getItem('eyap_saved_academy_code') || '';
  });
  const [error, setError] = useState('');

  const config = loginConfig || {
    splashTitleLine1: "열린학원 교재분석",
    splashTitleLine2: "OATIS",
    splashSubtitle: "Open Academy Textbook Insight System",
    splashDescription: "교재 점검을 기록하는 수준을 넘어,<br/>진행 흐름과 운영 상태를 한눈에 보는 시스템입니다."
  };

  const normalizedCode = academyCode.trim().toUpperCase();
  const isCodeValid = normalizedCode === '111111' || normalizedCode === 'OPEN_ACA';

  const handleCodeChange = (e) => {
    const rawVal = e.target.value;
    let cleanVal = rawVal;
    
    // If it looks like a number, restrict to digits and 6 chars
    if (/^\d*$/.test(rawVal.replace(/\s/g, ''))) {
      cleanVal = rawVal.replace(/\D/g, '').slice(0, 6);
    } else {
      cleanVal = rawVal.slice(0, 15);
    }
    
    setAcademyCode(cleanVal);
    
    const checkVal = cleanVal.trim().toUpperCase();
    if (checkVal === '111111' || checkVal === 'OPEN_ACA') {
      localStorage.setItem('eyap_saved_academy_code', checkVal === 'OPEN_ACA' ? 'OPEN_Aca' : '111111');
      setError('');
    } else if (checkVal.length === 6 && /^\d+$/.test(checkVal)) {
      setError('올바르지 않은 학원 코드입니다.');
    } else {
      setError('');
    }
  };

  return (
    <div className="oatis-splash-screen min-h-screen flex items-center justify-center p-4 sm:p-6 pt-14 lg:pt-16 relative overflow-hidden">
      <div className="oatis-splash-grid w-full max-w-6xl grid lg:grid-cols-[1.05fr_0.95fr] gap-5 md:gap-8 relative z-10 items-stretch">
        
        {/* Left Brand Intro Card */}
        <div className="hidden md:flex rounded-[34px] hero-panel splash-brand-panel p-8 lg:p-10 flex-col justify-between text-white min-h-[520px]">
          <div>
            <div className="splash-kicker">{config.splashKicker || 'OPEN ACADEMY'}</div>
            <div className="mt-3 font-black tracking-tight" style={{ fontSize: config.splashTitleSizeLine1 || '38px', color: 'var(--splash-title-color)' }}>
              e-Yap Math Room
            </div>
            <div className="mt-2 text-sm font-semibold text-cyan-400" style={{ color: 'var(--splash-muted-color)' }}>
              Elevate Your Academic Potential
            </div>
          </div>
          
          <div className="relative">
            <h1 className="font-black leading-[1.1]">
              <span className="block font-black" style={{ fontSize: config.splashTitleSizeLine1 || '38px', color: 'var(--splash-text-color)' }}>
                수최T 수학 교실
              </span>
              <span className="block mt-3 font-extrabold text-[#00d6cd]" style={{ fontSize: config.splashTitleSizeLine2 || '54px', color: 'var(--splash-title-color)' }}>
                Math Room
              </span>
            </h1>
            <p className="mt-6 max-w-md text-sm leading-7 text-slate-300" dangerouslySetInnerHTML={{ __html: config.splashDescription }} />
          </div>

          <div className="flex items-center justify-between gap-4 pt-6 border-t border-white/10">
            <div className="text-[11px] font-bold text-sky-200">ver. e-Yap Portal-v1.2</div>
            <div className="text-[10px] text-slate-400 font-medium">Creative by mOOn_Math</div>
          </div>
        </div>

        {/* Right Content Panel */}
        <div className="splash-portal-panel p-6 md:p-8 flex flex-col justify-center min-h-[520px] bg-slate-950/20 backdrop-blur-md border border-white/5 rounded-[34px] space-y-6">
          
          {/* Academy Code Authentication Box */}
          <div className="space-y-2 p-5 rounded-2xl bg-white/[0.02] border border-white/5">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                <i className={`fas ${isCodeValid ? 'fa-lock-open text-emerald-400' : 'fa-lock text-slate-500'}`}></i>
                학원 인증 코드 (6자리)
              </label>
              {isCodeValid && (
                <span className="text-[11px] font-extrabold text-emerald-400 bg-emerald-950/20 border border-emerald-500/20 px-2 py-0.5 rounded-lg flex items-center gap-1 animate-pulse">
                  <i className="fas fa-check"></i> 인증됨
                </span>
              )}
            </div>
            
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                className={`w-full h-11 border rounded-xl text-center text-sm font-bold tracking-widest outline-none transition-all bg-slate-900/30 text-white ${
                  isCodeValid 
                    ? 'border-emerald-500/40 focus:border-emerald-400 text-emerald-300' 
                    : error 
                      ? 'border-rose-500/80 focus:border-rose-450' 
                      : 'border-white/10 focus:border-cyan-400'
                }`}
                placeholder="코드 번호 6자리 입력"
                value={academyCode}
                onChange={handleCodeChange}
              />
            </div>
            
            {error && (
              <p className="text-[10px] font-bold text-rose-400 text-center animate-bounce mt-1">
                {error}
              </p>
            )}
          </div>

          {/* Role Selection (Locked until authenticated) */}
          <div className={`space-y-4 transition-all duration-300 ${isCodeValid ? 'opacity-100' : 'opacity-25 pointer-events-none'}`}>
            <div className="text-center mb-2">
              <span className="splash-kicker-pill px-3 py-1 rounded-full text-[10px] font-black tracking-wider bg-purple-500/10 text-[#c4b5fd] border border-purple-500/20">
                ROLE SELECTION
              </span>
              <h2 className="text-xl md:text-2xl font-black mt-3 text-white">
                포털 역할 선택
              </h2>
              <p className="text-xs mt-1 text-slate-400">
                인증이 완료되었습니다. 포털 역할을 선택하세요.
              </p>
            </div>

            <div className="flex flex-col gap-3.5">
              {/* Student Portal */}
              <button
                type="button"
                onClick={() => onSelectRole('student')}
                className="portal-entry-card w-full p-4.5 rounded-2xl text-left transition-all duration-300 bg-white/[0.01] border border-white/5 hover:bg-white/[0.06] hover:border-[#00d6cd]/30 group flex justify-between items-center cursor-pointer"
              >
                <div>
                  <span className="text-[10px] font-bold text-[#00d6cd] block mb-0.5">STUDENT PORTAL</span>
                  <strong className="text-base font-extrabold text-white">{config.studentPortalTitle || '학생 / 학부모 포털'}</strong>
                  <span className="text-[11px] text-slate-450 block mt-0.5">{config.studentPortalDescription || '교재 점검 완료율 및 피드백을 확인합니다.'}</span>
                </div>
                <div className="w-9 h-9 rounded-xl bg-[#00d6cd]/5 border border-[#00d6cd]/20 flex items-center justify-center text-[#00d6cd] group-hover:scale-110 group-hover:bg-[#00d6cd]/10 transition-all duration-300">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-graduation-cap"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/></svg>
                </div>
              </button>

              {/* Teacher Portal */}
              <button
                type="button"
                onClick={() => onSelectRole('teacher')}
                className="portal-entry-card w-full p-4.5 rounded-2xl text-left transition-all duration-300 bg-white/[0.01] border border-white/5 hover:bg-white/[0.06] hover:border-[#4169e1]/30 group flex justify-between items-center cursor-pointer"
              >
                <div>
                  <span className="text-[10px] font-bold text-[#4169e1] block mb-0.5">TEACHER PORTAL</span>
                  <strong className="text-base font-extrabold text-white">{config.teacherPortalTitle || '담당 강사 포털'}</strong>
                  <span className="text-[11px] text-slate-450 block mt-0.5">{config.teacherPortalDescription || '학생들의 교재 검사를 기록하고 설정합니다.'}</span>
                </div>
                <div className="w-9 h-9 rounded-xl bg-[#4169e1]/5 border border-[#4169e1]/20 flex items-center justify-center text-[#4169e1] group-hover:scale-110 group-hover:bg-[#4169e1]/10 transition-all duration-300">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-presentation"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M12 17v4"/><path d="M2 10h20"/></svg>
                </div>
              </button>

              {/* Admin Portal */}
              <button
                type="button"
                onClick={() => onSelectRole('admin')}
                className="portal-entry-card w-full p-4.5 rounded-2xl text-left transition-all duration-300 bg-white/[0.01] border border-white/5 hover:bg-white/[0.06] hover:border-[#8436ff]/30 group flex justify-between items-center cursor-pointer"
              >
                <div>
                  <span className="text-[10px] font-bold text-[#8436ff] block mb-0.5">ADMINISTRATOR</span>
                  <strong className="text-base font-extrabold text-white">{config.adminPortalTitle || '원장 / 관리자 포털'}</strong>
                  <span className="text-[11px] text-slate-450 block mt-0.5">{config.adminPortalDescription || '전체 교재 목록 및 강사, 통합 설정을 관리합니다.'}</span>
                </div>
                <div className="w-9 h-9 rounded-xl bg-[#8436ff]/5 border border-[#8436ff]/20 flex items-center justify-center text-[#8436ff] group-hover:scale-110 group-hover:bg-[#8436ff]/10 transition-all duration-300">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-settings"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                </div>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
