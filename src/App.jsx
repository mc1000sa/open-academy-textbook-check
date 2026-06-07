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
    return String(v ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
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

  // 1. Gateway & Login
  const showLogin =
    portal === 'gateway' ||
    (portal === 'student' && !studentSession) ||
    (portal === 'teacher' && !currentTeacher) ||
    (portal === 'admin' && !currentTeacher);

  if (showLogin) {
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
        {customModal?.open && renderModal()}
      </>
    );
  }

  // 2. Student Portal Dashboard
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
          handleLogout={handleLogout}
        >
          <StudentPortal {...studentPortalDeps} />
        </Layout>
        {customModal?.open && renderModal()}
      </>
    );
  }

  // 3. Teacher & Admin dashboard
  const renderViewContent = () => {
    switch (view) {
      case 'dashboard': {
        const teacherId = oatisData.dashboardTeacherFilter === 'all' ? null : oatisData.dashboardTeacherFilter;
        const dashClasses = teacherId ? classes.filter(c => c.teacherId === teacherId) : classes;
        const dashClassIds = new Set(dashClasses.map(c => c.id));
        const dashStudents = students.filter(s => dashClassIds.has(s.classId));
        const dashStudentIds = new Set(dashStudents.map(s => s.id));
        const dashLogs = inspections.filter(i => dashStudentIds.has(i.studentId));
        const dashOverall = averageCompletionRate(dashLogs);
        const dashRecent = [...dashLogs].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 8);

        return (
          <Dashboard
            state={oatisData}
            teachers={teachers}
            classes={dashClasses}
            students={dashStudents}
            logs={dashLogs}
            overall={dashOverall}
            recent={dashRecent}
            focus={oatisData.dashboardMetricFocus || 'students'}
            books={books}
            inspections={inspections}
            deps={{
              assignedBooksForClass,
              bookById,
              bookUnits,
              classById,
              classProgress,
              progressTone,
              studentById,
              studentsForClass,
              teacherNameById
            }}
            updateLegacyState={(updates) => {
              Object.keys(updates).forEach(key => {
                const setterName = 'set' + key.charAt(0).toUpperCase() + key.slice(1);
                if (oatisData[setterName]) oatisData[setterName](updates[key]);
              });
            }}
          />
        );
      }
      case 'inspections': {
        return (
          <InspectionsContainer
            state={oatisData}
            db={null}
            refs={null}
            teacherClasses={teacherClasses}
            studentsForClass={studentsForClass}
            assignedBooksForClass={assignedBooksForClass}
            bookById={bookById}
            unitsForRange={(book, start, end) => unitsForRange(book, start, end).map(unit => ({ ...unit, name: displayUnitName(unit, book) }))}
            pagesInRange={pagesInRange}
            missedPagesArrayInCurrentRange={() => filterMissedPagesToRange(oatisData.missedPages, oatisData.selectedRangeStart, oatisData.selectedRangeEnd)}
            inspectionsForStudent={inspectionsForStudent}
            fmtDate={fmtDate}
            classById={classById}
            studentById={studentById}
            safe={safe}
            bookUnits={bookUnits}
            buildCarryoverRows={buildCarryoverRows}
            calculateCarryoverRecoveryRate={calculateCarryoverRecoveryRate}
            pageResolutionKey={pageResolutionKey}
            RUBRIC_ITEMS={RUBRIC_ITEMS}
            remarkTemplates={oatisData.remarkTemplates}
            updateLegacyState={(updates) => {
              Object.keys(updates).forEach(key => {
                const setterName = 'set' + key.charAt(0).toUpperCase() + key.slice(1);
                if (oatisData[setterName]) oatisData[setterName](updates[key]);
              });
            }}
            showModalAlert={showModalAlert}
            showModalConfirm={showModalConfirm}
            showModalPrompt={showModalPrompt}
          />
        );
      }
      case 'reports': {
        const reportsDeps = {
          teacherClasses,
          classById,
          studentById,
          teacherNameById,
          inspectionsForStudent: inspectionsForSelectedReportRound,
          groupInspectionsByBook,
          bookById,
          averageCompletionRate,
          fmtDate,
          classRubricAverage,
          studentRubricAverage,
          assignedBooksForClass,
          studentsForClass,
          unitsForRange: (book, start, end) => unitsForRange(book, start, end).map(unit => ({ ...unit, name: displayUnitName(unit, book) })),
          refreshReportRounds: () => {
            if (!oatisData.reportStudentId) {
              oatisData.setReportRounds([]);
              oatisData.setSelectedReportRound('');
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
          }
        };

        return (
          <Reports
            state={oatisData}
            deps={reportsDeps}
            updateLegacyState={(updates) => {
              Object.keys(updates).forEach(key => {
                const setterName = 'set' + key.charAt(0).toUpperCase() + key.slice(1);
                if (oatisData[setterName]) oatisData[setterName](updates[key]);
              });
            }}
            showModalAlert={showModalAlert}
          />
        );
      }
      case 'setup': {
        return (
          <ClassSetup
            state={oatisData}
            teachers={teachers}
            classes={classes}
            students={students}
            allStudents={allStudents}
            studentRequests={studentRequests}
            updateLegacyState={(updates) => {
              Object.keys(updates).forEach(key => {
                const setterName = 'set' + key.charAt(0).toUpperCase() + key.slice(1);
                if (oatisData[setterName]) oatisData[setterName](updates[key]);
              });
            }}
            deps={{
              showModalAlert,
              showModalConfirm,
              showModalPrompt,
              notify
            }}
          />
        );
      }
      case 'bookSetup': {
        return (
          <BookSetup
            state={oatisData}
            teachers={teachers}
            classes={classes}
            students={students}
            books={books}
            classBooks={classBooks}
            updateLegacyState={(updates, callback) => {
              Object.keys(updates).forEach(key => {
                const setterName = 'set' + key.charAt(0).toUpperCase() + key.slice(1);
                if (oatisData[setterName]) oatisData[setterName](updates[key]);
              });
              if (callback) callback();
            }}
            deps={{
              showModalAlert,
              showModalConfirm,
              notify
            }}
          />
        );
      }
      case 'teachersAdmin': {
        return (
          <AdminSetup
            state={oatisData}
            teachers={teachers}
            classes={classes}
            students={students}
            allStudents={allStudents}
            studentRequests={studentRequests}
            books={books}
            classBooks={classBooks}
            updateLegacyState={(updates, callback) => {
              Object.keys(updates).forEach(key => {
                const setterName = 'set' + key.charAt(0).toUpperCase() + key.slice(1);
                if (oatisData[setterName]) oatisData[setterName](updates[key]);
              });
              if (callback) callback();
            }}
            deps={{
              showModalAlert,
              showModalConfirm,
              notify
            }}
          />
        );
      }
      default:
        return null;
    }
  };

  // Set accent color dynamically depending on view mode
  let accentColor = '#4169e1';
  if (portal === 'admin') accentColor = '#8436ff';
  else if (portal === 'student') accentColor = '#00d6cd';

  function renderModal() {
    return (
      <div className="modal-overlay" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, zIndex: 99999, display: 'grid', placeItems: 'center', padding: '1rem', background: 'rgba(5, 5, 7, 0.75)', backdropFilter: 'blur(10px)' }}>
        <div className="glass-card modal-content" style={{ maxWidth: '420px', width: '90%', textAlign: 'center', padding: '2.5rem 2rem', border: '1px solid rgba(255, 255, 255, 0.15)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)', margin: '0 auto' }}>
          {customModal.title && <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: accentColor, fontSize: '1.3rem', fontWeight: 800, letterSpacing: '-0.5px' }}>{customModal.title}</h3>}
          <p style={{ marginBottom: '1.5rem', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'keep-all', fontSize: '0.95rem', color: 'rgba(255, 255, 255, 0.85)' }}>{customModal.message}</p>
          {customModal.type === 'prompt' && (
            <input
              type="text"
              ref={modalInputRef}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-center text-white mb-6 font-mono text-lg outline-none focus:border-cyan-400"
              value={promptVal}
              onChange={(e) => setPromptVal(e.target.value)}
              autoComplete="off"
            />
          )}
          <div className="submit-row" style={{ gap: '0.75rem', display: 'flex', justifyContent: 'center' }}>
            {(customModal.type === 'confirm' || customModal.type === 'prompt') && (
              <button type="button" onClick={onCancel} className="ghost-button" style={{ flex: 1, padding: '0.85rem', fontSize: '0.9rem', borderRadius: '12px', cursor: 'pointer' }}>
                {customModal.cancelText || '취소'}
              </button>
            )}
            <button type="button" onClick={onConfirm} className="primary-button" style={{ flex: 1, padding: '0.85rem', fontSize: '0.9rem', borderRadius: '12px', background: `linear-gradient(135deg, ${accentColor} 0%, #2f46ff 100%)`, cursor: 'pointer' }}>
              {customModal.confirmText || '확인'}
            </button>
          </div>
        </div>
      </div>
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
        handleLogout={handleLogout}
      >
        {renderViewContent()}
      </Layout>
      {customModal?.open && renderModal()}
    </>
  );
}
