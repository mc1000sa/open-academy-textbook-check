import React, { useState, useEffect, useMemo } from 'react';

export default function Login({
  portal,
  setPortal,
  loginStep,
  setLoginStep,
  teachers,
  classes,
  students,
  allStudents,
  studentRequests,
  loginConfig,
  handleLogin,
  handleStudentLogin,
  handleStudentRegister
}) {
  const config = loginConfig || {
    splashTitleLine1: "열린학원 교재분석",
    splashTitleLine2: "OATIS",
    splashSubtitle: "Open Academy Textbook Insight System",
    splashDescription: "교재 점검을 기록하는 수준을 넘어,<br/>진행 흐름과 운영 상태를 한눈에 보는 시스템입니다."
  };

  // Local Form States
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('');
  const [schoolConfirmed, setSchoolConfirmed] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [studentPin, setStudentPin] = useState('');
  
  const [staffPin, setStaffPin] = useState('');
  const [localLoginError, setLocalLoginError] = useState('');

  // 1. Restore last selected teacher on gateway click / initial portal activation
  useEffect(() => {
    if (portal === 'teacher') {
      const lastId = window.localStorage?.getItem('oatis.lastTeacherId.v1') || '';
      if (lastId && teachers.some(t => t.id === lastId && t.role === 'teacher')) {
        setSelectedTeacherId(lastId);
      } else {
        const first = teachers.find(t => t.role === 'teacher');
        if (first) setSelectedTeacherId(first.id);
      }
      setStaffPin('');
      setLocalLoginError('');
    } else if (portal === 'admin') {
      const adminAcc = teachers.find(t => t.role === 'admin') || { id: 't_admin' };
      setSelectedTeacherId(adminAcc.id);
      setStaffPin('');
      setLocalLoginError('');
    } else if (portal === 'student') {
      // Restore student login form from localStorage if exists
      try {
        const raw = window.localStorage?.getItem('oatis.studentLoginForm.v1');
        if (raw) {
          const saved = JSON.parse(raw);
          setSelectedTeacherId(saved.teacherId || '');
          setSelectedGrade(saved.grade || '');
          setSelectedClassId(saved.classId || '');
          setStudentName(saved.name || '');
          setSelectedSchool(saved.school || '');
          setSchoolConfirmed(!!(saved.school || saved.schoolConfirmed));
        }
      } catch (e) {}
      setStudentPin('');
    }
  }, [portal, teachers]);

  // Derived selections
  const activeTeachers = useMemo(() => teachers.filter(t => t.role === 'teacher'), [teachers]);
  
  const teacherClasses = useMemo(() => {
    if (!selectedTeacherId) return [];
    return classes.filter(c => c.teacherId === selectedTeacherId);
  }, [classes, selectedTeacherId]);

  const teacherClassIds = useMemo(() => new Set(teacherClasses.map(c => c.id)), [teacherClasses]);

  const availableSchools = useMemo(() => {
    const list = (allStudents || students)
      .filter(s => !selectedTeacherId || teacherClassIds.has(s.classId))
      .map(s => String(s.school || '').trim())
      .filter(Boolean);
    return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [allStudents, students, selectedTeacherId, teacherClassIds]);

  const availableGrades = useMemo(() => {
    const grades = teacherClasses.map(c => c.grade).filter(Boolean);
    return Array.from(new Set(grades)).sort();
  }, [teacherClasses]);

  const filteredClasses = useMemo(() => {
    if (!selectedTeacherId || !selectedGrade) return [];
    return classes.filter(c => c.teacherId === selectedTeacherId && c.grade === selectedGrade);
  }, [classes, selectedTeacherId, selectedGrade]);

  const studentsInClass = useMemo(() => {
    if (!selectedClassId) return [];
    return students.filter(s => s.classId === selectedClassId && s.active !== false);
  }, [students, selectedClassId]);

  // Live match student id from selected class & typed name
  const matchedStudent = useMemo(() => {
    if (!selectedClassId || !studentName.trim()) return null;
    return studentsInClass.find(s => s.name.trim() === studentName.trim());
  }, [studentsInClass, studentName]);

  const handleStaffPinChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setStaffPin(val);
    setLocalLoginError('');
  };

  const onStaffLoginSubmit = async () => {
    if (!selectedTeacherId) {
      setLocalLoginError('선생님을 먼저 선택해주세요.');
      return;
    }
    const ok = await handleLogin(selectedTeacherId, staffPin);
    if (!ok) {
      setStaffPin('');
      setLocalLoginError('PIN 번호가 올바르지 않습니다.');
    }
  };

  const onStudentLoginSubmit = async () => {
    if (!matchedStudent) return;
    const ok = await handleStudentLogin(matchedStudent.id, studentPin);
    if (!ok) {
      setStudentPin('');
    }
  };

  const onStudentRegisterSubmit = async () => {
    if (!selectedClassId || !studentName.trim()) return;
    const ok = await handleStudentRegister(selectedClassId, studentName, selectedSchool, studentPin);
    if (ok) {
      setStudentPin('');
    }
  };

  // Header navigation
  const renderHeader = () => (
    <header className="fixed top-0 left-0 right-0 h-11 bg-[#050507]/60 backdrop-blur-md border-b border-white/5 z-50 flex items-center justify-between px-4 md:px-8 select-none">
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setPortal('gateway')}>
        <span className="text-xs font-black tracking-widest text-[#00d6cd] hover:opacity-80 transition-opacity">OPEN</span>
        <div className="nav-divider" />
        <span className="text-xs font-bold text-white tracking-tight">교재점검</span>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <button
          type="button"
          onClick={() => {
            setPortal('student');
            setLoginStep('login');
          }}
          className={`text-[11px] md:text-xs font-black transition-all hover:scale-105 duration-200 ${
            portal === 'student' ? 'text-[#00d6cd] drop-shadow-[0_0_8px_rgba(0,214,205,0.4)]' : 'text-[#00d6cd]/60 hover:text-[#00d6cd]'
          }`}
        >
          학생/학부모
        </button>
        <div className="nav-divider" />
        <button
          type="button"
          onClick={() => {
            setPortal('teacher');
            setLoginStep('login');
          }}
          className={`text-[11px] md:text-xs font-black transition-all hover:scale-105 duration-200 ${
            portal === 'teacher' ? 'text-[#4169e1] drop-shadow-[0_0_8px_rgba(65,105,225,0.4)]' : 'text-[#4169e1]/60 hover:text-[#4169e1]'
          }`}
        >
          담당 강사
        </button>
        <div className="nav-divider" />
        <button
          type="button"
          onClick={() => {
            setPortal('admin');
            setLoginStep('login');
          }}
          className={`text-[11px] md:text-xs font-black transition-all hover:scale-105 duration-200 ${
            portal === 'admin' ? 'text-[#8436ff] drop-shadow-[0_0_8px_rgba(132,54,255,0.4)]' : 'text-[#8436ff]/60 hover:text-[#8436ff]'
          }`}
        >
          Admin
        </button>
      </div>
    </header>
  );

  // Gateway View
  if (portal === 'gateway') {
    return (
      <>
        {renderHeader()}
        <div className="oatis-splash-screen min-h-screen flex items-center justify-center p-4 sm:p-6 pt-14 lg:pt-16 relative overflow-hidden">
          <div className="oatis-splash-grid w-full max-w-6xl grid lg:grid-cols-[1.05fr_0.95fr] gap-5 md:gap-8 relative z-10 items-stretch">
            
            {/* Left Brand Intro Card */}
            <div className="hidden md:flex rounded-[34px] hero-panel splash-brand-panel p-8 lg:p-10 flex-col justify-between text-white min-h-[520px]">
              <div>
                <div className="splash-kicker">{config.splashKicker || 'OPEN ACADEMY'}</div>
                <div className="mt-3 font-black tracking-tight" style={{ fontSize: config.splashTitleSizeLine1 || '38px', color: 'var(--splash-title-color)' }}>
                  {config.splashTitleLine2}
                </div>
                <div className="mt-2 text-sm font-semibold" style={{ color: 'var(--splash-muted-color)' }}>
                  {config.splashSubtitle}
                </div>
              </div>
              
              <div className="relative">
                <h1 className="font-black leading-[1.1]">
                  <span className="block font-black" style={{ fontSize: config.splashTitleSizeLine1 || '38px', color: 'var(--splash-text-color)' }}>
                    {config.splashTitleLine1}
                  </span>
                  <span className="block mt-3 font-extrabold" style={{ fontSize: config.splashTitleSizeLine2 || '54px', color: 'var(--splash-title-color)' }}>
                    {config.splashTitleLine2}
                  </span>
                </h1>
                <p className="mt-6 max-w-md text-sm leading-7" style={{ color: 'var(--splash-muted-color)' }} dangerouslySetInnerHTML={{ __html: config.splashDescription }} />
              </div>

              <div className="flex items-center justify-between gap-4 pt-6 border-t border-white/10">
                <div className="text-[11px] font-bold text-sky-200">ver. OATIS-R2.0</div>
                <div className="text-[10px] text-slate-400 font-medium">Creative by mOOn_Math</div>
              </div>
            </div>

            {/* Right Portals Entrance Gateway */}
            <div className="splash-portal-panel p-6 md:p-8 flex flex-col justify-center min-h-[520px]">
              <div className="text-center mb-8">
                <span className="splash-kicker-pill px-3 py-1 rounded-full text-[11px] font-black tracking-wider bg-purple-500/10 text-[#c4b5fd] border border-purple-500/20">
                  {config.gatewayBadge || 'GATEWAY'}
                </span>
                <h2 className="text-2xl md:text-3xl font-black mt-4" style={{ color: 'var(--splash-title-color)' }}>
                  {config.gatewayTitle || '열린학원 수학교재점검'}
                </h2>
                <p className="text-xs md:text-sm mt-2" style={{ color: 'var(--splash-muted-color)' }}>
                  {config.gatewayDescription || '필요한 포털만 고르면 바로 시작합니다.'}
                </p>
              </div>

              <div className="flex flex-col gap-4">
                {/* Student Portal */}
                <button
                  type="button"
                  onClick={() => setPortal('student')}
                  className="portal-entry-card w-full p-5 rounded-2xl text-left transition-all duration-300 bg-white/[0.02] border border-white/5 hover:bg-white/[0.08] hover:border-[#00d6cd]/30 group flex justify-between items-center"
                >
                  <div>
                    <span className="text-xs font-bold text-[#00d6cd] block mb-1">STUDENT PORTAL</span>
                    <strong className="text-lg font-extrabold text-white">{config.studentPortalTitle || '학생 / 학부모 포털'}</strong>
                    <span className="text-xs text-slate-400 block mt-1">{config.studentPortalDescription || '교재 점검 완료율 및 피드백을 확인합니다.'}</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#00d6cd]/5 border border-[#00d6cd]/20 flex items-center justify-center text-[#00d6cd] group-hover:scale-110 group-hover:bg-[#00d6cd]/10 transition-all duration-300">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-graduation-cap"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/></svg>
                  </div>
                </button>

                {/* Teacher Portal */}
                <button
                  type="button"
                  onClick={() => setPortal('teacher')}
                  className="portal-entry-card w-full p-5 rounded-2xl text-left transition-all duration-300 bg-white/[0.02] border border-white/5 hover:bg-white/[0.08] hover:border-[#4169e1]/30 group flex justify-between items-center"
                >
                  <div>
                    <span className="text-xs font-bold text-[#4169e1] block mb-1">TEACHER PORTAL</span>
                    <strong className="text-lg font-extrabold text-white">{config.teacherPortalTitle || '담당 강사 포털'}</strong>
                    <span className="text-xs text-slate-400 block mt-1">{config.teacherPortalDescription || '학생들의 교재 검사를 기록하고 설정합니다.'}</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#4169e1]/5 border border-[#4169e1]/20 flex items-center justify-center text-[#4169e1] group-hover:scale-110 group-hover:bg-[#4169e1]/10 transition-all duration-300">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-presentation"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M12 17v4"/><path d="M2 10h20"/></svg>
                  </div>
                </button>

                {/* Admin Portal */}
                <button
                  type="button"
                  onClick={() => setPortal('admin')}
                  className="portal-entry-card w-full p-5 rounded-2xl text-left transition-all duration-300 bg-white/[0.02] border border-white/5 hover:bg-white/[0.08] hover:border-[#8436ff]/30 group flex justify-between items-center"
                >
                  <div>
                    <span className="text-xs font-bold text-[#8436ff] block mb-1">ADMINISTRATOR</span>
                    <strong className="text-lg font-extrabold text-white">{config.adminPortalTitle || '원장 / 관리자 포털'}</strong>
                    <span className="text-xs text-slate-400 block mt-1">{config.adminPortalDescription || '전체 교재 목록 및 강사, 통합 설정을 관리합니다.'}</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#8436ff]/5 border border-[#8436ff]/20 flex items-center justify-center text-[#8436ff] group-hover:scale-110 group-hover:bg-[#8436ff]/10 transition-all duration-300">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-settings"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  </div>
                </button>
              </div>
            </div>

          </div>
        </div>
      </>
    );
  }

  // Student Portal
  if (portal === 'student') {
    return (
      <>
        {renderHeader()}
        <div className="oatis-auth-screen min-h-screen flex items-center justify-center p-4 pt-14 lg:pt-16 relative overflow-hidden">
          <div className="w-full max-w-lg glass rounded-3xl soft-border p-6 md:p-8 relative z-10">
            <div className="flex justify-between items-center mb-6">
              <button type="button" onClick={() => setPortal('gateway')} className="ghost-button px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5" style={{ cursor: 'pointer' }}>
                <span>← Back</span>
              </button>
              <span className="px-3 py-1 rounded-full text-[10px] font-black bg-[#00d6cd]/10 text-[#00d6cd] soft-border">
                STUDENT LOGIN
              </span>
            </div>

            {loginStep === 'login' ? (
              <div className="space-y-5">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-extrabold text-white">학생 / 학부모 로그인</h2>
                  <p className="text-xs text-slate-400 mt-1">본인의 담당선생님, 학년, 반을 선택하고 이름을 찾으세요.</p>
                </div>

                {/* 1단계: 담당 선생님 */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2">1단계: 담당 선생님</label>
                  <div className="choice-grid">
                    {activeTeachers.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setSelectedTeacherId(t.id);
                          setSelectedGrade('');
                          setSelectedClassId('');
                          setStudentName('');
                          setStudentPin('');
                        }}
                        className={`choice-button btn-choice-student ${selectedTeacherId === t.id ? 'selected' : ''}`}
                      >
                        {t.name} T
                      </button>
                    ))}
                  </div>
                  {activeTeachers.length === 0 && <div className="text-xs text-slate-500 py-2">등록된 선생님이 없습니다.</div>}
                </div>

                {/* 2단계: 학년 선택 */}
                {selectedTeacherId ? (
                  <div className="transition-all duration-300">
                    <label className="block text-xs font-bold text-slate-400 mb-2">2단계: 학년 선택</label>
                    <div className="choice-grid">
                      {availableGrades.map(g => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => {
                            setSelectedGrade(g);
                            setSelectedClassId('');
                            setStudentName('');
                            setStudentPin('');
                          }}
                          className={`choice-button btn-choice-student ${selectedGrade === g ? 'selected' : ''}`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                    {availableGrades.length === 0 && <div className="text-xs text-slate-500 py-2">선생님에게 배정된 학급(학년)이 없습니다.</div>}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-slate-900/20 border border-dashed border-slate-800/60 text-center text-xs text-slate-500 select-none">
                    선생님을 선택하시면 학년 선택이 활성화됩니다.
                  </div>
                )}

                {/* 3단계: 반 선택 */}
                {selectedTeacherId && selectedGrade ? (
                  <div className="transition-all duration-300">
                    <label className="block text-xs font-bold text-slate-400 mb-2">3단계: 반 선택</label>
                    <div className="choice-grid">
                      {filteredClasses.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedClassId(c.id);
                            setStudentName('');
                            setStudentPin('');
                          }}
                          className={`choice-button btn-choice-student ${selectedClassId === c.id ? 'selected' : ''}`}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                    {filteredClasses.length === 0 && <div className="text-xs text-slate-500 py-2">개설된 반 정보가 없습니다.</div>}
                  </div>
                ) : selectedTeacherId ? (
                  <div className="p-3.5 rounded-xl bg-slate-900/20 border border-dashed border-slate-800/60 text-center text-xs text-slate-500 select-none">
                    학년을 선택하시면 반 선택이 활성화됩니다.
                  </div>
                ) : null}

                {/* 4단계: 학생명 입력 */}
                {selectedClassId ? (
                  <div className="transition-all duration-300">
                    <label className="block text-xs font-bold text-slate-400 mb-2">4단계: 학생명 입력</label>
                    <input
                      type="text"
                      className="w-full h-12 border border-slate-800 rounded-xl px-4 text-sm bg-slate-900/30 focus:border-[#00d6cd] outline-none text-white transition-colors"
                      placeholder="본인의 이름을 정확히 입력하세요"
                      value={studentName}
                      onChange={(e) => {
                        setStudentName(e.target.value);
                      }}
                    />
                    <div className="mt-2 text-[11px] font-semibold">
                      {studentName && !matchedStudent ? (
                        <span className="text-rose-400">⚠️ 이 반에 소속된 해당 이름의 학생을 찾을 수 없습니다.</span>
                      ) : matchedStudent ? (
                        <span className="text-emerald-400">✨ 학생 확인 완료! 아래 5단계에서 PIN 번호를 입력해 주세요.</span>
                      ) : null}
                    </div>
                  </div>
                ) : selectedGrade ? (
                  <div className="p-3.5 rounded-xl bg-slate-900/20 border border-dashed border-slate-800/60 text-center text-xs text-slate-500 select-none">
                    반을 선택하시면 학생명 입력이 활성화됩니다.
                  </div>
                ) : null}

                {/* 5단계: PIN 비밀번호 입력 */}
                <div className={`${matchedStudent ? 'opacity-100' : 'opacity-40 pointer-events-none'} transition-opacity duration-300`}>
                  <label className="block text-xs font-bold text-slate-400 mb-2">5단계: 4자리 PIN 비밀번호</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    style={{ WebkitTextSecurity: 'disc' }}
                    className="w-full h-14 border border-slate-800 rounded-2xl text-center text-2xl tracking-[1em] font-black bg-slate-900/30 focus:border-[#00d6cd] outline-none text-white"
                    placeholder="••••"
                    value={studentPin}
                    onChange={(e) => setStudentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    disabled={!matchedStudent}
                  />
                  <p className="text-[10px] text-slate-500 mt-1.5 text-center">초기 비밀번호는 <strong>1234</strong> 입니다.</p>
                </div>

                <button
                  type="button"
                  onClick={onStudentLoginSubmit}
                  className="btn-student w-full h-12 rounded-xl text-sm font-extrabold mt-6"
                  disabled={!matchedStudent || studentPin.length < 4}
                >
                  대시보드 로그인
                </button>

                <div className="text-center mt-4 pt-4 border-t border-slate-800/80">
                  <span className="text-xs text-slate-400">학원에 처음 등록하셨나요?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginStep('register');
                      setStudentName('');
                      setStudentPin('');
                      setSelectedSchool('');
                      setSchoolConfirmed(false);
                    }}
                    className="text-xs text-[#00d6cd] font-bold ml-1.5 hover:underline"
                  >
                    신규 학생 등록신청 하기
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-extrabold text-white">신규 학생 등록 신청</h2>
                  <p className="text-xs text-slate-400 mt-1">소속될 반을 차례대로 정하고 이름과 초기 PIN을 입력하세요.</p>
                </div>

                {/* 1단계: 담당 선생님 */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2">1단계: 담당 선생님</label>
                  <div className="choice-grid">
                    {activeTeachers.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setSelectedTeacherId(t.id);
                          setSelectedSchool('');
                          setSchoolConfirmed(false);
                          setSelectedGrade('');
                          setSelectedClassId('');
                          setStudentName('');
                          setStudentPin('');
                        }}
                        className={`choice-button btn-choice-student ${selectedTeacherId === t.id ? 'selected' : ''}`}
                      >
                        {t.name} T
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2단계: 학교 선택 */}
                {selectedTeacherId ? (
                  <div className="transition-all duration-300">
                    <label className="block text-xs font-bold text-slate-400 mb-2">2단계: 학교 선택</label>
                    <div className="choice-grid">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSchool('');
                          setSchoolConfirmed(true);
                          setSelectedGrade('');
                          setSelectedClassId('');
                          setStudentName('');
                          setStudentPin('');
                        }}
                        className={`choice-button btn-choice-student ${schoolConfirmed && !selectedSchool ? 'selected' : ''}`}
                      >
                        학교 미선택
                      </button>
                      {availableSchools.map(school => (
                        <button
                          key={school}
                          type="button"
                          onClick={() => {
                            setSelectedSchool(school);
                            setSchoolConfirmed(true);
                            setSelectedGrade('');
                            setSelectedClassId('');
                            setStudentName('');
                            setStudentPin('');
                          }}
                          className={`choice-button btn-choice-student ${selectedSchool === school ? 'selected' : ''}`}
                        >
                          {school}
                        </button>
                      ))}
                    </div>
                    {availableSchools.length === 0 && <div className="text-[10px] text-slate-500 mt-2">등록된 학교명이 아직 없으면 학교 미선택으로 신청하세요.</div>}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-slate-900/20 border border-dashed border-slate-800/60 text-center text-xs text-slate-500 select-none">
                    선생님을 선택하시면 학교 선택이 활성화됩니다.
                  </div>
                )}

                {/* 3단계: 학년 선택 */}
                {selectedTeacherId && schoolConfirmed ? (
                  <div className="transition-all duration-300">
                    <label className="block text-xs font-bold text-slate-400 mb-2">3단계: 학년 선택</label>
                    <div className="choice-grid">
                      {availableGrades.map(g => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => {
                            setSelectedGrade(g);
                            setSelectedClassId('');
                            setStudentName('');
                            setStudentPin('');
                          }}
                          className={`choice-button btn-choice-student ${selectedGrade === g ? 'selected' : ''}`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-slate-900/20 border border-dashed border-slate-800/60 text-center text-xs text-slate-500 select-none">
                    학교를 선택하시면 학년 선택이 활성화됩니다.
                  </div>
                )}

                {/* 4단계: 소속 반 선택 */}
                {selectedTeacherId && selectedGrade ? (
                  <div className="transition-all duration-300">
                    <label className="block text-xs font-bold text-slate-400 mb-2">4단계: 소속 반 선택</label>
                    <div className="choice-grid">
                      {filteredClasses.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedClassId(c.id);
                            setStudentName('');
                            setStudentPin('');
                          }}
                          className={`choice-button btn-choice-student ${selectedClassId === c.id ? 'selected' : ''}`}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : selectedTeacherId ? (
                  <div className="p-3.5 rounded-xl bg-slate-900/20 border border-dashed border-slate-800/60 text-center text-xs text-slate-500 select-none">
                    학년을 선택하시면 반 선택이 활성화됩니다.
                  </div>
                ) : null}

                {/* 인풋 영역 */}
                <div className={`${selectedClassId ? 'opacity-100' : 'opacity-40 pointer-events-none'} transition-opacity duration-300 space-y-4`}>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">5단계: 이름 입력</label>
                    <input
                      type="text"
                      placeholder="실명을 입력해 주세요"
                      className="w-full p-3 text-sm rounded-xl bg-slate-900/30 border border-slate-850 text-white focus:border-[#00d6cd] outline-none"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      disabled={!selectedClassId}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">6단계: 사용할 4자리 PIN 비밀번호</label>
                    <input
                      type="text"
                      maxLength={4}
                      inputMode="numeric"
                      style={{ WebkitTextSecurity: 'disc' }}
                      placeholder="숫자 4자리 설정"
                      className="w-full p-3 text-sm rounded-xl text-center text-lg font-bold bg-slate-900/30 border border-slate-850 text-white focus:border-[#00d6cd] outline-none"
                      value={studentPin}
                      onChange={(e) => setStudentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      disabled={!selectedClassId}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onStudentRegisterSubmit}
                  className="btn-student w-full h-12 rounded-xl text-sm font-extrabold mt-6"
                  disabled={!selectedClassId || !studentName.trim() || studentPin.length < 4}
                >
                  등록 신청 완료
                </button>

                <div className="text-center mt-4 pt-4 border-t border-slate-800/80">
                  <span className="text-xs text-slate-400">이미 등록되어 있으신가요?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginStep('login');
                      setStudentName('');
                      setStudentPin('');
                    }}
                    className="text-xs text-[#00d6cd] font-bold ml-1.5 hover:underline"
                  >
                    PIN 번호 로그인하기
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // Teacher Portal
  if (portal === 'teacher') {
    return (
      <>
        {renderHeader()}
        <div className="oatis-auth-screen min-h-screen flex items-center justify-center p-4 pt-14 lg:pt-16 relative overflow-hidden">
          <div className="w-full max-w-lg glass rounded-3xl soft-border p-6 md:p-8 relative z-10">
            <div className="flex justify-between items-center mb-6">
              <button type="button" onClick={() => setPortal('gateway')} className="ghost-button px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5" style={{ cursor: 'pointer' }}>
                <span>← Back</span>
              </button>
              <span className="px-3 py-1 rounded-full text-[10px] font-black bg-[#4169e1]/10 text-[#4169e1] soft-border">
                TEACHER PORTAL
              </span>
            </div>

            <div className="text-center mb-6">
              <h2 className="text-xl font-extrabold text-white">담당 교사 빠른 로그인</h2>
              <p className="text-xs text-slate-400 mt-1">선생님 이름을 선택하고 6자리 PIN을 입력하세요.</p>
            </div>

            <div className="space-y-6">
              {/* 선생님 선택 */}
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-3">1단계: 선생님 선택</label>
                <div className="choice-grid">
                  {activeTeachers.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelectedTeacherId(t.id);
                        setStaffPin('');
                        setLocalLoginError('');
                      }}
                      className={`choice-button btn-choice-teacher ${selectedTeacherId === t.id ? 'selected' : ''}`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
                {activeTeachers.length === 0 && <div className="text-xs text-slate-500 py-2">등록된 교사 계정이 없습니다. 원장(관리자) 메뉴에서 추가해 주세요.</div>}
              </div>

              {/* PIN 입력 */}
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">2단계: 6자리 PIN 번호</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  style={{ WebkitTextSecurity: 'disc' }}
                  className={`w-full h-14 border rounded-2xl text-center text-2xl tracking-[0.65em] font-black outline-none transition-all ${
                    localLoginError ? 'border-rose-500 bg-rose-950/30 text-rose-100 focus:border-rose-400 shadow-[0_0_0_3px_rgba(244,63,94,0.18)]' : 'focus:border-[#4169e1]'
                  }`}
                  placeholder="••••••"
                  value={staffPin}
                  onChange={handleStaffPinChange}
                  onKeyDown={(e) => e.key === 'Enter' && staffPin.length === 6 && onStaffLoginSubmit()}
                  disabled={!selectedTeacherId}
                />
                {localLoginError && (
                  <div className="mt-2 rounded-xl border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-xs font-bold text-rose-300">
                    {localLoginError}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={onStaffLoginSubmit}
                className="btn-teacher w-full h-12 rounded-xl text-sm font-extrabold"
                disabled={!selectedTeacherId || staffPin.length < 6}
              >
                강사 로그인
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Admin Portal
  if (portal === 'admin') {
    return (
      <>
        {renderHeader()}
        <div className="oatis-auth-screen min-h-screen flex items-center justify-center p-4 pt-14 lg:pt-16 relative overflow-hidden">
          <div className="w-full max-w-md glass rounded-3xl soft-border p-6 md:p-8 relative z-10">
            <div className="flex justify-between items-center mb-6">
              <button type="button" onClick={() => setPortal('gateway')} className="ghost-button px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5" style={{ cursor: 'pointer' }}>
                <span>← Back</span>
              </button>
              <span className="px-3 py-1 rounded-full text-[10px] font-black bg-[#8436ff]/10 text-[#8436ff] soft-border">
                ADMIN LOGIN
              </span>
            </div>

            <div className="text-center mb-6">
              <h2 className="text-xl font-extrabold text-white">관리자 시스템 로그인</h2>
              <p className="text-xs text-slate-400 mt-1">원장 전용 PIN 패스워드를 입력하세요.</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">관리자 6자리 PIN 패스워드</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  style={{ WebkitTextSecurity: 'disc' }}
                  className={`w-full h-14 border rounded-2xl text-center text-2xl tracking-[0.65em] font-black outline-none transition-all ${
                    localLoginError ? 'border-rose-500 bg-rose-950/30 text-rose-100 focus:border-rose-400 shadow-[0_0_0_3px_rgba(244,63,94,0.18)]' : 'focus:border-[#8436ff]'
                  }`}
                  placeholder="••••••"
                  value={staffPin}
                  onChange={handleStaffPinChange}
                  onKeyDown={(e) => e.key === 'Enter' && staffPin.length === 6 && onStaffLoginSubmit()}
                />
                {localLoginError && (
                  <div className="mt-2 rounded-xl border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-xs font-bold text-rose-300">
                    {localLoginError}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={onStaffLoginSubmit}
                className="btn-admin w-full h-12 rounded-xl text-sm font-extrabold"
                disabled={staffPin.length < 6}
              >
                관리자 모드 시작
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return null;
}
