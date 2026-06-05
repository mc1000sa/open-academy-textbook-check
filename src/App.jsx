import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import AuroraBackground from './components/effects/AuroraBackground.jsx';
import { useOatisData } from './hooks/useOatisData.js';
import Login from './components/Login.jsx';
import Layout from './components/Layout.jsx';
import Dashboard from './components/Dashboard.jsx';
import InspectionsContainer from './components/InspectionsContainer.jsx';
import Reports from './components/Reports.jsx';
import ClassSetup from './components/ClassSetup.jsx';
import BookSetup from './components/BookSetup.jsx';
import AdminSetup from './components/AdminSetup.jsx';
import StudentPortal from './components/StudentPortal.jsx';

import { usePortalSession } from './portal/usePortalSession.js';
import PortalGateway from './portal/PortalGateway.jsx';
import PortalHome from './portal/PortalHome.jsx';

import {
  sortBookUnits,
  unitsForRange,
  pagesInRange,
  buildCarryoverRows,
  calculateCarryoverRecoveryRate,
  pageResolutionKey,
  RUBRIC_ITEMS,
  parseMissedPages,
  filterMissedPagesToRange
} from './lib/textbookProgress.js';

import {
  averageCompletionRate,
  classProgressRate,
  classRubricAverage,
  groupInspectionsByBook,
  studentRubricAverage
} from './lib/reportMetrics.js';

import {
  buildReportRounds
} from './lib/reportRounds.js';

import {
  getFirebaseService,
  doc,
  updateDoc,
  serverTimestamp
} from './services/firebaseService.js';

export default function App() {
  const oatisData = useOatisData();
  const {
    loading,
    portal,
    setPortal,
    loginStep,
    setLoginStep,
    currentTeacher,
    setCurrentTeacher,
    view,
    setView,
    teachers,
    classes,
    students,
    allStudents,
    studentRequests,
    books,
    classBooks,
    inspections,
    studentSession,
    setStudentSession,
    saveMsg,
    customModal,
    setCustomModal,
    loginConfig,
    handleLogin,
    handleStudentLogin,
    handleStudentRegister,
    handleLogout,
    notify,
    showModalAlert,
    showModalConfirm,
    showModalPrompt
  } = oatisData;

  const [promptVal, setPromptVal] = useState('');
  const modalInputRef = useRef(null);

  // Portal session management
  const portalSessionObj = usePortalSession();
  const { session: portalSession, login: loginPortal, logout: logoutPortal } = portalSessionObj;
  const [activeService, setActiveService] = useState(null);

  // 1. Sync OATIS login success to Portal Session
  useEffect(() => {
    if (!portalSession) {
      const savedCode = localStorage.getItem('eyap_saved_academy_code') || '111111';
      if (portal === 'student' && studentSession) {
        const studentClass = classes.find(c => c.id === studentSession.classId);
        loginPortal({
          academyCode: savedCode,
          role: 'student',
          teacherId: studentSession.teacherId || '',
          studentId: studentSession.id,
          name: studentSession.name,
          grade: studentSession.grade || '',
          className: studentClass?.name || '',
          school: studentSession.school || '',
          pin: studentSession.pin || ''
        });
        setActiveService(null);
      } else if ((portal === 'teacher' || portal === 'admin') && currentTeacher) {
        loginPortal({
          academyCode: savedCode,
          role: currentTeacher.role,
          teacherId: currentTeacher.id,
          name: currentTeacher.name,
          pin: currentTeacher.pin || ''
        });
        setActiveService(null);
      }
    }
  }, [portal, studentSession, currentTeacher, portalSession, classes, loginPortal]);

  // 2. Hydrate OATIS session from Portal Session on load
  useEffect(() => {
    if (portalSession && loading === false) {
      if (portalSession.role === 'student') {
        if (!studentSession && allStudents.length > 0) {
          const matched = allStudents.find(s => s.id === portalSession.studentId);
          if (matched) {
            setPortal('student');
            setStudentSession(matched);
          }
        }
      } else if (portalSession.role === 'teacher' || portalSession.role === 'admin') {
        if (!currentTeacher && teachers.length > 0) {
          const matched = teachers.find(t => t.id === portalSession.teacherId);
          if (matched) {
            setPortal(portalSession.role);
            setCurrentTeacher(matched);
            setView(portalSession.role === 'admin' ? 'teachersAdmin' : 'inspections');
          }
        }
      }
    }
  }, [portalSession, loading, allStudents, teachers, studentSession, currentTeacher, setPortal, setView, setCurrentTeacher, setStudentSession]);

  const handlePortalLogout = () => {
    logoutPortal();
    handleLogout();
    setActiveService(null);
  };

  // Sync prompt default value when modal opens
  useEffect(() => {
    if (customModal?.open && customModal.type === 'prompt') {
      setPromptVal(customModal.inputValue || '');
      setTimeout(() => {
        modalInputRef.current?.focus();
      }, 50);
    }
  }, [customModal]);

  // Handle global keydowns for custom modal
  useEffect(() => {
    if (!customModal?.open) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [customModal, promptVal]);

  const onConfirm = () => {
    if (!customModal?.open) return;
    if (customModal.resolve) {
      if (customModal.type === 'prompt') {
        customModal.resolve(promptVal);
      } else {
        customModal.resolve(true);
      }
    }
  };

  const onCancel = () => {
    if (!customModal?.open) return;
    if (customModal.resolve) {
      if (customModal.type === 'prompt') {
        customModal.resolve(null);
      } else {
        customModal.resolve(false);
      }
    }
  };

  // Helper methods to match props expectations of children
  const teacherClasses = useCallback((teacherId) => {
    if (!teacherId) return [];
    return classes.filter(c => c.teacherId === teacherId);
  }, [classes]);

  const teacherNameById = (id) => {
    return teachers.find(t => t.id === id)?.name || '-';
  };

  const classById = (id) => {
    return classes.find(c => c.id === id) || null;
  };

  const studentById = (id) => {
    return allStudents.find(s => s.id === id) || students.find(s => s.id === id) || null;
  };

  const bookById = (id) => {
    return books.find(b => b.id === id) || null;
  };

  const standardUnitNames = (ids = []) => {
    if (!oatisData.standardUnitSubjects) return [];
    const mapping = {};
    oatisData.standardUnitSubjects.forEach(subj => {
      subj.units.forEach(unit => {
        mapping[unit.id] = unit.label;
      });
    });
    return ids.map(id => mapping[id]).filter(Boolean);
  };

  const displayUnitName = (unit, book) => {
    if (book?.bookType === 'exam_chapter') return unit?.name || '';
    const linkedNames = standardUnitNames(unit?.standardUnitIds || []);
    return linkedNames.length ? linkedNames.join(', ') : (unit?.name || '');
  };

  const bookUnits = (book) => {
    return sortBookUnits(book).map(unit => ({
      ...unit,
      name: displayUnitName(unit, book)
    }));
  };

  const assignedBooksForClass = (classId) => {
    return classBooks
      .filter(x => x.classId === classId && x.active !== false && x.status === 'active')
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
      .map(x => ({ link: x, book: bookById(x.bookId) }))
      .filter(x => x.book && !x.book.archived);
  };

  const completedBooksForClass = (classId) => {
    return classBooks
      .filter(x => x.classId === classId && x.active !== false && x.status === 'completed')
      .sort((a, b) => {
        const timeA = a.completedAt?.toDate?.()?.getTime() || new Date(a.completedAt).getTime() || 0;
        const timeB = b.completedAt?.toDate?.()?.getTime() || new Date(b.completedAt).getTime() || 0;
        return timeB - timeA;
      })
      .map(x => ({ link: x, book: bookById(x.bookId) }))
      .filter(x => x.book);
  };

  const studentsForClass = (classId) => {
    return students.filter(s => s.classId === classId && s.active !== false).sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'));
  };

  const inspectionsForStudent = (studentId) => {
    return inspections.filter(i => i.studentId === studentId).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  };

  const inspectionsForStudentProfile = (studentId) => {
    const listAll = allStudents || [];
    const current = listAll.find(s => s.id === studentId) || (studentSession?.id === studentId ? studentSession : null);
    const profileId = current?.studentProfileId || current?.id || studentId;
    const linkedStudentIds = new Set(
      listAll
        .filter(s => (s.studentProfileId || s.id) === profileId)
        .map(s => s.id)
    );
    linkedStudentIds.add(studentId);
    return inspections
      .filter(i => linkedStudentIds.has(i.studentId))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  };

  const classProgress = (classId) => {
    return classProgressRate(classId, students, inspections);
  };

  const progressTone = (rate) => {
    const value = Number(rate || 0);
    if (value >= 85) return { badge: 'bg-emerald-50 border-emerald-200 text-emerald-700', bar: 'linear-gradient(90deg,#10b981,#00bfa5)' };
    if (value >= 60) return { badge: 'bg-amber-50 border-amber-200 text-amber-700', bar: 'linear-gradient(90deg,#fbbf24,#f59e0b)' };
    return { badge: 'bg-rose-50 border-rose-200 text-rose-700', bar: 'linear-gradient(90deg,#f43f5e,#fb7185)' };
  };

  const fmtDate = (v) => {
    const d = new Date(v);
    if (isNaN(d)) return '-';
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  const safe = (v) => {
    return String(v ?? '').replace(/[&<>\"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  };

  const inspectionsForSelectedReportRound = (studentId) => {
    const roundNumber = Number(oatisData.selectedReportRound);
    const round = oatisData.reportRounds.find(r => r.round === roundNumber);
    const roundDate = round?.date ? String(round.date).trim().slice(0, 10) : '';
    return inspectionsForStudent(studentId).filter(inspection => {
      if (!roundDate) return true;
      return String(inspection.date).trim().slice(0, 10) === roundDate;
    });
  };

  // 자동 보고서 회차(reportRounds) 계산 동기화 훅
  useEffect(() => {
    if (!oatisData.reportStudentId) {
      oatisData.setReportRounds([]);
      return;
    }
    const activeReportClassId = studentById(oatisData.reportStudentId)?.classId || oatisData.reportClassId || '';
    const klass = classById(activeReportClassId);
    const currentRoundStartDate = oatisData.reportRoundStartDate || klass?.reportRoundStartDate || '';
    const rounds = buildReportRounds({
      inspections,
      classId: activeReportClassId,
      studentId: oatisData.reportStudentId,
      startDate: currentRoundStartDate,
      allStudents
    });
    oatisData.setReportRounds(rounds);
  }, [oatisData.reportStudentId, oatisData.reportRoundStartDate, oatisData.reportClassId, inspections, classes, allStudents]);

  if (loading) {
    return (
      <>
        <AuroraBackground />
        <div className="min-h-screen flex items-center justify-center text-cyan-500 font-bold text-xl relative z-10">
          데이터 불러오는 중...
        </div>
      </>
    );
  }

  // Modals element helper
  const modalElement = customModal?.open ? renderModal() : null;

  // Render PortalGateway if not logged into portal and portal state is gateway
  if (!portalSession) {
    if (portal === 'gateway') {
      return (
        <>
          <AuroraBackground />
          <PortalGateway
            onSelectRole={(role) => setPortal(role)}
            loginConfig={loginConfig}
          />
          {modalElement}
        </>
      );
    }
    
    // Otherwise show OATIS login (PIN input)
    return (
      <>
        <AuroraBackground />
        <Login
          portal={portal}
          setPortal={setPortal}
          loginStep={loginStep}
          setLoginStep={setLoginStep}
          teachers={teachers}
          classes={classes}
          students={students}
          allStudents={allStudents}
          studentRequests={studentRequests}
          loginConfig={loginConfig}
          handleLogin={handleLogin}
          handleStudentLogin={handleStudentLogin}
          handleStudentRegister={handleStudentRegister}
        />
        {modalElement}
      </>
    );
  }

  // Logged in: check active service
  if (activeService === null) {
    return (
      <>
        <AuroraBackground />
        <PortalHome
          session={portalSession}
          onLogout={handlePortalLogout}
          onSelectService={(service) => {
            setActiveService(service);
            if (service === 'oatis') {
              if (portalSession.role === 'student') setView('studentPortal');
              else setView(portalSession.role === 'admin' ? 'teachersAdmin' : 'inspections');
            }
          }}
        />
        {modalElement}
      </>
    );
  }

  if (activeService === 'explorer') {
    // Phase 2 placeholder / component
    return (
      <>
        <AuroraBackground />
        <div className="min-h-screen flex flex-col justify-center items-center text-white relative z-10">
          <h2 className="text-2xl font-black text-cyan-400">수학자 탐험관</h2>
          <p className="text-slate-400 mt-2">수학자 탐험관 서비스 이식 준비 중입니다 (Phase 2).</p>
          <button
            onClick={() => setActiveService(null)}
            className="mt-6 px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm font-bold hover:bg-slate-800 cursor-pointer"
          >
            포털 홈으로 이동
          </button>
        </div>
        {modalElement}
      </>
    );
  }

  if (activeService === 'omr') {
    // Generate the OMR URL with auto-login query parameters depending on the session role
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const omrBaseUrl = isLocal ? 'http://127.0.0.1:5174/' : 'https://open-test-omr.web.app/';
    let omrUrl = omrBaseUrl;
    if (portalSession.role === 'student') {
      const schoolName = portalSession.school || studentSession?.school || '';
      omrUrl = `${omrBaseUrl}?mode=student&s_name=${encodeURIComponent(portalSession.name)}&s_school=${encodeURIComponent(schoolName)}&s_grade=${encodeURIComponent(portalSession.grade)}&s_class=${encodeURIComponent(portalSession.className)}&s_pin=${portalSession.pin}`;
    } else if (portalSession.role === 'teacher') {
      omrUrl = `${omrBaseUrl}?mode=teacher&t_code=${encodeURIComponent(portalSession.name)}&t_pin=${portalSession.pin}`;
    } else if (portalSession.role === 'admin') {
      omrUrl = `${omrBaseUrl}?mode=admin&token=oasis_master_2024_auth`;
    }

    return (
      <>
        <AuroraBackground />
        <div className="min-h-screen flex flex-col relative z-10 text-white pb-6">
          {/* Header */}
          <header className="h-16 border-b border-white/5 bg-[#050507]/60 backdrop-blur-md flex items-center justify-between px-6 md:px-12 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-sm font-black tracking-widest text-[#8436ff] bg-purple-950/30 px-2.5 py-1 rounded-lg border border-[#8436ff]/20">
                OMR
              </span>
              <div className="h-4 w-[1px] bg-white/10" />
              <h1 className="text-sm font-bold tracking-tight text-white/90 font-black">e-Yap OMR</h1>
            </div>
            
            <button
              onClick={() => setActiveService(null)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-white border border-white/5 hover:border-white/10 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <i className="fas fa-home"></i>
              포털 홈으로 이동
            </button>
          </header>

          {/* Iframe container */}
          <div className="flex-1 p-4 md:p-6 flex flex-col">
            <div className="flex-1 bg-slate-950/40 backdrop-blur-md border border-white/5 rounded-3xl overflow-hidden shadow-2xl relative h-[calc(100vh-7rem)] min-h-[620px]">
              <iframe 
                src={omrUrl} 
                className="w-full h-full border-0 bg-transparent"
                title="OMR System"
              />
            </div>
          </div>
        </div>
        {modalElement}
      </>
    );
  }

  // Default: activeService === 'oatis'
  if (portal === 'student' && studentSession) {
    const studentPortalDeps = {
      state: oatisData,
      db: null,
      refs: null,
      inspectionsForStudent: inspectionsForStudentProfile,
      bookById,
      bookUnits,
      averageCompletionRate,
      groupInspectionsByBook,
      fmtDate,
      safe,
      progressTone,
      unitsForRange: (book, start, end) => unitsForRange(book, start, end).map(unit => ({ ...unit, name: displayUnitName(unit, book) })),
      assignedBooksForClass,
      updateLegacyState: (updates) => {
        Object.keys(updates).forEach(key => {
          const setterName = 'set' + key.charAt(0).toUpperCase() + key.slice(1);
          if (oatisData[setterName]) oatisData[setterName](updates[key]);
        });
      },
      updateStudentPin: async (studentId, pinVal) => {
        const { db } = await getFirebaseService();
        const studentRef = doc(db, 'openacademy_textbook_students', studentId);
        await updateDoc(studentRef, { pin: pinVal, pinFailedCount: 0, pinLocked: false, updatedAt: serverTimestamp() });
        notify('학생 PIN 변경 완료');
      },
      showModalAlert
    };

    return (
      <>
        <AuroraBackground />
        <Layout
          currentView="studentPortal"
          setView={setView}
          currentTeacher={null}
          studentSession={studentSession}
          portal={portal}
          saveMsg={saveMsg}
          handleLogout={handlePortalLogout}
          onGoBack={() => setActiveService(null)}
        >
          <StudentPortal {...studentPortalDeps} />
        </Layout>
        {modalElement}
      </>
    );
  }

  return (
    <>
      <AuroraBackground />
      <Layout
        currentView={view}
        setView={setView}
        currentTeacher={currentTeacher}
        studentSession={studentSession}
        portal={portal}
        saveMsg={saveMsg}
        handleLogout={handlePortalLogout}
        onGoBack={() => setActiveService(null)}
      >
        {renderViewContent()}
      </Layout>
      {modalElement}
    </>
  );
}
