import { useState, useEffect, useCallback, useRef } from 'react';
import {
  addDoc,
  COLLECTION_NAMES,
  doc,
  getDoc,
  getDocs,
  getFirebaseService,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where
} from '../services/firebaseService.js';
import {
  normalizeStandardUnitSubjects,
  DEFAULT_STANDARD_UNIT_SUBJECTS
} from '../lib/standardUnits.js';
import {
  normalizeRemarkTemplates,
  DEFAULT_REMARK_TEMPLATES
} from '../lib/remarkTemplates.js';

const STAFF_PIN_LENGTH = 6;
const TEACHER_SESSION_KEY = 'oatis.teacherSession.v1';
const ADMIN_SESSION_KEY = 'oatis.adminSession.v1';
const STUDENT_LOGIN_MEMORY_KEY = 'oatis.studentLoginForm.v1';
const LAST_TEACHER_ID_KEY = 'oatis.lastTeacherId.v1';

function blankStudentLoginForm(overrides = {}) {
  return {
    classId: '',
    grade: '',
    studentId: '',
    name: '',
    pin: '',
    school: '',
    schoolConfirmed: false,
    teacherId: '',
    ...overrides
  };
}

function readRememberedStudentLoginForm() {
  try {
    const raw = window.localStorage?.getItem(STUDENT_LOGIN_MEMORY_KEY);
    if (!raw) return blankStudentLoginForm();
    const saved = JSON.parse(raw);
    return blankStudentLoginForm({
      teacherId: String(saved.teacherId || ''),
      grade: String(saved.grade || ''),
      classId: String(saved.classId || ''),
      studentId: String(saved.studentId || ''),
      name: String(saved.name || ''),
      school: String(saved.school || ''),
      schoolConfirmed: !!saved.schoolConfirmed
    });
  } catch (err) {
    return blankStudentLoginForm();
  }
}

function rememberStudentLoginForm(student, form) {
  try {
    const payload = {
      teacherId: form.teacherId || student.teacherId || '',
      grade: student.grade || form.grade || '',
      classId: student.classId || form.classId || '',
      studentId: student.id || form.studentId || '',
      name: student.name || form.name || '',
      school: student.school || form.school || '',
      schoolConfirmed: !!(student.school || form.school || form.schoolConfirmed)
    };
    window.localStorage?.setItem(STUDENT_LOGIN_MEMORY_KEY, JSON.stringify(payload));
    return blankStudentLoginForm(payload);
  } catch (err) {
    return blankStudentLoginForm(form);
  }
}

export function mergeInspectionLists(...inspectionLists) {
  const combinedMap = new Map();
  inspectionLists.flat().forEach(item => {
    if (!item?.id) return;
    combinedMap.set(item.id, item);
  });
  return Array.from(combinedMap.values());
}

export function useOatisData() {
  const [loading, setLoading] = useState(true);
  const [portal, setPortal] = useState('gateway'); // 'gateway' | 'student' | 'teacher' | 'admin'
  const [loginStep, setLoginStep] = useState('login'); // 'login' | 'register'
  const [currentTeacher, setCurrentTeacher] = useState(null);
  const [selectedTeacherName, setSelectedTeacherName] = useState('');
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [view, setView] = useState('inspections'); // inspections, reports, setup, bookSetup, teachersAdmin, dashboard
  
  // DB Collections
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [studentRequests, setStudentRequests] = useState([]);
  const [books, setBooks] = useState([]);
  const [classBooks, setClassBooks] = useState([]);
  const [inspections, setInspections] = useState([]);

  // UI / Form State
  const [selectedSetupClassId, setSelectedSetupClassId] = useState('');
  const [setupFormClass, setSetupFormClass] = useState({ name: '', grade: '', teacherId: '', note: '' });
  const [studentBulkText, setStudentBulkText] = useState('');
  const [studentBulkMode, setStudentBulkMode] = useState('nameSchool');
  const [selectedBookManageId, setSelectedBookManageId] = useState('');
  const [formBook, setFormBook] = useState({ title: '', subject: '', grade: '', publisher: '', active: true, bookType: 'standard', chapterCount: '10' });
  const [formUnit, setFormUnit] = useState({ name: '', start: '', end: '', standardUnitIds: [] });
  const [bulkUnitText, setBulkUnitText] = useState('');
  const [tempBookUnits, setTempBookUnits] = useState(null);

  // Configs
  const [standardUnitSubjects, setStandardUnitSubjects] = useState(normalizeStandardUnitSubjects(DEFAULT_STANDARD_UNIT_SUBJECTS));
  const [remarkTemplates, setRemarkTemplates] = useState(normalizeRemarkTemplates(DEFAULT_REMARK_TEMPLATES));
  const [selectedStandardSubjectCode, setSelectedStandardSubjectCode] = useState('common_math_1');
  const [standardUnitNewName, setStandardUnitNewName] = useState('');
  const [standardUnitInsertOrder, setStandardUnitInsertOrder] = useState('');
  
  const [editingBookId, setEditingBookId] = useState('');
  const [assigningClassId, setAssigningClassId] = useState('');
  const [selectedInspectionClassId, setSelectedInspectionClassId] = useState('');
  const [selectedInspectionStudentId, setSelectedInspectionStudentId] = useState('');
  const [selectedInspectionBookId, setSelectedInspectionBookId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedRangeStart, setSelectedRangeStart] = useState('');
  const [selectedRangeEnd, setSelectedRangeEnd] = useState('');
  const [missedPages, setMissedPages] = useState('');
  const [memo, setMemo] = useState('');
  const [rubricScores, setRubricScores] = useState({ expression: null, grading: null, attitude: null, understanding: null, application: null });
  const [selectedCarryoverResolutionKeys, setSelectedCarryoverResolutionKeys] = useState([]);
  const [quickClassId, setQuickClassId] = useState('');
  const [editingInspectionId, setEditingInspectionId] = useState('');

  // Report & Period
  const [reportStudentId, setReportStudentId] = useState('');
  const [reportClassId, setReportClassId] = useState('');
  const [reportRoundStartDate, setReportRoundStartDate] = useState('');
  const [selectedReportRound, setSelectedReportRoundState] = useState('');
  const [reportRounds, setReportRounds] = useState([]);
  const [printHtml, setPrintHtml] = useState('');
  const [reportPeriods] = useState(() => {
    try {
      const stored = window.localStorage?.getItem('oatis.reportPeriods.v1');
      return stored ? JSON.parse(stored) : ["1학기 중간", "1학기 기말", "2학기 중간", "2학기 기말", "여름방학", "겨울방학"];
    } catch {
      return ["1학기 중간", "1학기 기말", "2학기 중간", "2학기 기말", "여름방학", "겨울방학"];
    }
  });
  const [selectedReportPeriod, setSelectedReportPeriodState] = useState(window.localStorage?.getItem('oatis.selectedReportPeriod.v1') || "1학기 기말");

  // Dashboard Filters
  const [dashboardTeacherFilter, setDashboardTeacherFilter] = useState('all');
  const [dashboardMetricFocus, setDashboardMetricFocus] = useState('students');

  // Notifications
  const [saveMsg, setSaveMsg] = useState('');

  // System/Admin Config Forms
  const [adminTeacherForm, setAdminTeacherForm] = useState({ id: '', name: '', pin: '', role: 'teacher' });
  const [adminTeacherEditId, setAdminTeacherEditId] = useState('');
  const [selectedAdminStudentIds, setSelectedAdminStudentIds] = useState([]);
  const [adminPromotionGrade, setAdminPromotionGrade] = useState('');
  const [adminPromotionClassId, setAdminPromotionClassId] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [setupDetailPanel, setSetupDetailPanel] = useState('');
  const [selectedExistingStudentId, setSelectedExistingStudentId] = useState('');
  const [setupSearchClass, setSetupSearchClass] = useState('');
  const [setupSearchStudent, setSetupSearchStudent] = useState('');
  const [setupSearchBook, setSetupSearchBook] = useState('');
  const [existingStudentSearch, setExistingStudentSearch] = useState('');

  // Accordions
  const [setupAccordion, setSetupAccordion] = useState({ class: false, bulk: false, edit: false });
  const [bookSetupAccordion, setBookSetupAccordion] = useState({ manage: false, unit: false, assign: false });
  const [adminCardExpanded, setAdminCardExpanded] = useState({});

  // Student portal Login
  const [studentLoginForm, setStudentLoginForm] = useState(readRememberedStudentLoginForm);
  const [studentSession, setStudentSession] = useState(null);
  const [studentPinModalOpen, setStudentPinModalOpen] = useState(false);

  // Custom Modal
  const [customModal, setCustomModal] = useState({
    open: false,
    type: 'alert', // 'alert' | 'confirm' | 'prompt'
    title: '',
    message: '',
    inputValue: '',
    confirmText: '확인',
    cancelText: '취소',
    resolve: null
  });

  // System Splash Config
  const [loginConfig, setLoginConfig] = useState({
    splashTitleLine1: '열린학원 교재분석',
    splashTitleLine2: 'OATIS',
    splashTitleSizeLine1: '38px',
    splashTitleSizeLine2: '54px',
    splashSubtitle: 'Open Academy Textbook Insight System',
    splashDescription: '교재 점검을 기록하는 수준을 넘어,<br/>진행 흐름과 운영 상태를 한눈에 보는 시스템입니다.',
    splashKicker: 'OPEN ACADEMY',
    gatewayBadge: 'GATEWAY',
    gatewayTitle: '열린학원 수학교재점검',
    gatewayDescription: '필요한 포털만 고르면 바로 시작합니다.',
    studentPortalTitle: '학생 / 학부모 포털',
    studentPortalDescription: '교재 점검 완료율 및 피드백을 확인합니다.',
    teacherPortalTitle: '담당 강사 포털',
    teacherPortalDescription: '학생들의 교재 검사를 기록하고 설정합니다.',
    adminPortalTitle: '원장 / 관리자 포털',
    adminPortalDescription: '전체 교재 목록 및 강사, 통합 설정을 관리합니다.',
    splashTitleColor: '#ffffff',
    splashTextColor: '#e5e7eb',
    splashMutedColor: '#94a3b8',
    auroraColor1: '#00d6cd',
    auroraColor2: '#4169e1',
    auroraColor3: '#8436ff',
    portalHoverGlowColor: '#00d6cd',
    loginTitle: '빠른 PIN 로그인',
    loginDescription: '선생님을 선택하고 6자리 PIN을 입력하세요.',
    loginInfoText: '초기 로그인 계정은 관리자 설정에서 관리됩니다.',
    primaryColor: '#384bff',
    fontFamily: "'SUIT', sans-serif",
    fontScale: '1.0'
  });

  const [adminLoginConfigForm, setAdminLoginConfigForm] = useState({ ...loginConfig });

  // Notifications helper
  const notify = useCallback((msg) => {
    setSaveMsg(msg);
    setTimeout(() => setSaveMsg(''), 1800);
  }, []);

  // Async Modal implementations using Promise
  const showModalAlert = useCallback((message, title = '알림') => {
    return new Promise((resolve) => {
      setCustomModal({
        open: true,
        type: 'alert',
        title,
        message,
        inputValue: '',
        confirmText: '확인',
        cancelText: '취소',
        resolve: (val) => {
          setCustomModal(prev => ({ ...prev, open: false }));
          resolve(val);
        }
      });
    });
  }, []);

  const showModalConfirm = useCallback((message, title = '확인') => {
    return new Promise((resolve) => {
      setCustomModal({
        open: true,
        type: 'confirm',
        title,
        message,
        inputValue: '',
        confirmText: '확인',
        cancelText: '취소',
        resolve: (val) => {
          setCustomModal(prev => ({ ...prev, open: false }));
          resolve(val);
        }
      });
    });
  }, []);

  const showModalPrompt = useCallback((message, defaultVal = '', title = '입력') => {
    return new Promise((resolve) => {
      setCustomModal({
        open: true,
        type: 'prompt',
        title,
        message,
        inputValue: defaultVal,
        confirmText: '확인',
        cancelText: '취소',
        resolve: (val) => {
          setCustomModal(prev => ({ ...prev, open: false }));
          resolve(val);
        }
      });
    });
  }, []);

  // Global Ref for dynamic standard unit config saving
  const standardUnitSubjectsRef = useRef(standardUnitSubjects);
  useEffect(() => {
    standardUnitSubjectsRef.current = standardUnitSubjects;
  }, [standardUnitSubjects]);

  const remarkTemplatesRef = useRef(remarkTemplates);
  useEffect(() => {
    remarkTemplatesRef.current = remarkTemplates;
  }, [remarkTemplates]);

  // Firebase dynamic initialization and subscriptions
  useEffect(() => {
    let active = true;
    let unsubscribes = [];

    async function initFirebaseAndSubscribe() {
      const { db, refs } = await getFirebaseService();
      if (!active) return;

      // Seed & Migrate Data
      await ensureSeedData(db, refs);
      await migrateDefaultTeachers(db, refs);

      // Subscription setup
      const unsubTeachers = onSnapshot(refs.teachers, snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.active !== false);
        setTeachers(list);
      });
      unsubscribes.push(unsubTeachers);

      const unsubClasses = onSnapshot(refs.classes, snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.active !== false);
        setClasses(list);
        if (list.length) {
          setSelectedSetupClassId(prev => prev || list[0].id);
          setAssigningClassId(prev => prev || list[0].id);
        }
      });
      unsubscribes.push(unsubClasses);

      const unsubStudents = onSnapshot(refs.students, snap => {
        const listAll = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.deleted !== true);
        setAllStudents(listAll);
        setStudents(listAll.filter(x => x.active !== false && x.status !== 'withdrawn'));
      });
      unsubscribes.push(unsubStudents);

      const unsubRequests = onSnapshot(refs.studentRequests, snap => {
        setStudentRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      unsubscribes.push(unsubRequests);

      const unsubBooks = onSnapshot(refs.books, snap => {
        setBooks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      unsubscribes.push(unsubBooks);

      const unsubClassBooks = onSnapshot(refs.classBooks, snap => {
        setClassBooks(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.active !== false));
      });
      unsubscribes.push(unsubClassBooks);

      const unsubConfigs = onSnapshot(refs.configs, snap => {
        const docLoginSplash = snap.docs.find(d => d.id === 'login_splash');
        if (docLoginSplash) {
          const data = docLoginSplash.data();
          setLoginConfig(prev => ({ ...prev, ...data }));
          setAdminLoginConfigForm(prev => ({ ...prev, ...data }));
          applyThemeColor(data.primaryColor, data.fontFamily, data.fontScale);
        }

        const docStandardUnits = snap.docs.find(d => d.id === 'standard_units');
        if (docStandardUnits) {
          const subjects = normalizeStandardUnitSubjects(docStandardUnits.data()?.subjects);
          setStandardUnitSubjects(subjects);
        }

        const docRemarkTemplates = snap.docs.find(d => d.id === 'remark_templates');
        if (docRemarkTemplates) {
          setRemarkTemplates(normalizeRemarkTemplates(docRemarkTemplates.data()?.templates));
        }
      });
      unsubscribes.push(unsubConfigs);

      setLoading(false);
    }

    initFirebaseAndSubscribe();

    return () => {
      active = false;
      unsubscribes.forEach(unsub => unsub());
    };
  }, []);

  // Inspection Subscription mapping depending on Portal/Account details
  useEffect(() => {
    let unsubs = [];
    let active = true;

    async function setupInspectionsSubscription() {
      const { db, refs } = await getFirebaseService();
      if (!active) return;

      if (portal === 'student' && studentSession) {
        const linkedStudentIds = [studentSession.id];
        const profileId = studentSession.studentProfileId || studentSession.id;
        const linked = allStudents.filter(s => (s.studentProfileId || s.id) === profileId).map(s => s.id);
        linked.forEach(id => {
          if (!linkedStudentIds.includes(id)) linkedStudentIds.push(id);
        });

        const qSelf = query(refs.inspections, where('studentId', 'in', linkedStudentIds));
        const qClass = studentSession.classId
          ? query(refs.inspections, where('classId', '==', studentSession.classId))
          : null;

        let listSelf = [];
        let listClass = [];
        const toRows = snap => snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.deleted !== true);
        const updateCombinedList = () => setInspections(mergeInspectionLists(listSelf, listClass));

        const unsubSelf = onSnapshot(qSelf, snap => {
          if (!active) return;
          listSelf = toRows(snap);
          updateCombinedList();
        });
        unsubs.push(unsubSelf);

        if (qClass) {
          const unsubClass = onSnapshot(qClass, snap => {
            if (!active) return;
            listClass = toRows(snap);
            updateCombinedList();
          });
          unsubs.push(unsubClass);
        }
      } else {
        const unsub = onSnapshot(refs.inspections, snap => {
          if (!active) return;
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.deleted !== true);
          setInspections(list);
        });
        unsubs.push(unsub);
      }
    }

    setupInspectionsSubscription();

    return () => {
      active = false;
      unsubs.forEach(unsub => unsub());
    };
  }, [portal, studentSession, allStudents]);

  // Session Restore on initial Load once teachers is ready
  useEffect(() => {
    if (teachers.length === 0) return;
    if (currentTeacher || studentSession) return;
    
    // 1. Admin session restoration
    const savedAdmin = window.localStorage?.getItem(ADMIN_SESSION_KEY);
    if (savedAdmin) {
      try {
        const parsed = JSON.parse(savedAdmin);
        const matched = teachers.find(t => t.id === parsed.id && t.pin === parsed.pin && t.role === 'admin' && t.active !== false);
        if (matched) {
          setCurrentTeacher(matched);
          setPortal('admin');
          setView('teachersAdmin');
          return;
        }
      } catch (e) {}
    }

    // 2. Teacher session restoration
    const savedTeacher = window.localStorage?.getItem(TEACHER_SESSION_KEY);
    if (savedTeacher) {
      try {
        const parsed = JSON.parse(savedTeacher);
        const matched = teachers.find(t => t.id === parsed.id && t.pin === parsed.pin && t.role === 'teacher' && t.active !== false);
        if (matched) {
          setCurrentTeacher(matched);
          setPortal('teacher');
          setView('inspections');
          
          const teacherClasses = classes.filter(c => c.teacherId === matched.id);
          const firstClass = teacherClasses[0];
          setSelectedSetupClassId(firstClass?.id || '');
          setAssigningClassId(firstClass?.id || '');
          setSelectedInspectionClassId(firstClass?.id || '');
          setQuickClassId(firstClass?.id || '');
          return;
        }
      } catch (e) {}
    }
  }, [teachers, classes]);

  // Helper for Theme style injection
  function applyThemeColor(color, fontFamily, fontScale) {
    const primary = color || '#384bff';
    const light = adjustColor(primary, 20);
    const dark = adjustColor(primary, -20);
    const soft = primary + '1A';
    const ff = fontFamily || "'SUIT', sans-serif";
    const fs = fontScale || '1.0';

    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--theme-primary', primary);
    rootStyle.setProperty('--theme-primary-light', light);
    rootStyle.setProperty('--theme-primary-dark', dark);
    rootStyle.setProperty('--theme-primary-soft', soft);
    rootStyle.setProperty('--theme-font-family', ff);
    rootStyle.setProperty('--theme-font-scale', fs);

    let styleEl = document.getElementById('dynamic-theme');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'dynamic-theme';
      document.head.appendChild(styleEl);
    }
    
    styleEl.innerHTML = `
      body {
        font-family: var(--theme-font-family) !important;
      }
      html {
        font-size: calc(16px * var(--theme-font-scale, 1.0)) !important;
      }
    `;
  }

  function adjustColor(hex, percent) {
    let num = parseInt(hex.replace("#",""), 16),
        amt = Math.round(2.55 * percent),
        R = (num >> 16) + amt,
        G = (num >> 8 & 0x00FF) + amt,
        B = (num & 0x0000FF) + amt;
    R = R < 0 ? 0 : R > 255 ? 255 : R;
    G = G < 0 ? 0 : G > 255 ? 255 : G;
    B = B < 0 ? 0 : B > 255 ? 255 : B;
    return "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  }

  // Seed Default Firebase Data
  async function ensureSeedData(db, refs) {
    const configDoc = await getDoc(doc(db, COLLECTION_NAMES.configs, 'login_splash'));
    if (!configDoc.exists()) {
      await setDoc(doc(db, COLLECTION_NAMES.configs, 'login_splash'), {
        splashTitleLine1: '열린학원 교재분석',
        splashTitleLine2: 'OATIS',
        splashTitleSizeLine1: '38px',
        splashTitleSizeLine2: '54px',
        splashSubtitle: 'Open Academy Textbook Insight System',
        splashDescription: '교재 점검을 기록하는 수준을 넘어,<br/>진행 흐름과 운영 상태를 한눈에 보는 시스템입니다.',
        splashKicker: 'OPEN ACADEMY',
        gatewayBadge: 'GATEWAY',
        gatewayTitle: '열린학원 수학교재점검',
        gatewayDescription: '필요한 포털만 고르면 바로 시작합니다.',
        studentPortalTitle: '학생 / 학부모 포털',
        studentPortalDescription: '교재 점검 완료율 및 피드백을 확인합니다.',
        teacherPortalTitle: '담당 강사 포털',
        teacherPortalDescription: '학생들의 교재 검사를 기록하고 설정합니다.',
        adminPortalTitle: '원장 / 관리자 포털',
        adminPortalDescription: '전체 교재 목록 및 강사, 통합 설정을 관리합니다.',
        splashTitleColor: '#ffffff',
        splashTextColor: '#e5e7eb',
        splashMutedColor: '#94a3b8',
        auroraColor1: '#00d6cd',
        auroraColor2: '#4169e1',
        auroraColor3: '#8436ff',
        portalHoverGlowColor: '#00d6cd',
        loginTitle: '빠른 PIN 로그인',
        loginDescription: '선생님을 선택하고 6자리 PIN을 입력하세요.',
        loginInfoText: '초기 로그인 계정은 관리자 설정에서 관리됩니다.',
        primaryColor: '#384bff',
        fontFamily: "'SUIT', sans-serif",
        fontScale: '1.0',
        createdAt: serverTimestamp()
      });
    }

    const teacherSnap = await getDocs(refs.teachers);
    if (!teacherSnap.empty) return;
    const batch = writeBatch(db);
    [
      { id: 't_admin', name: '관리자', pin: '999999', role: 'admin', active: true },
      { id: 't_kim', name: '수최', pin: '123456', role: 'teacher', active: true }
    ].forEach(t => batch.set(doc(db, COLLECTION_NAMES.teachers, t.id), { ...t, createdAt: serverTimestamp() }));
    [
      { id: 'c1', name: '고1 샘플반', teacherId: 't_kim', grade: '고1', note: '수학 교재점검 샘플반', active: true }
    ].forEach(c => batch.set(doc(db, COLLECTION_NAMES.classes, c.id), { ...c, createdAt: serverTimestamp() }));
    
    await batch.commit();
  }

  async function migrateDefaultTeachers(db, refs) {
    const teacherSnap = await getDocs(refs.teachers);
    if (teacherSnap.empty) return;
    const renameMap = {
      t_kim: { name: '수최', pin: '123456', role: 'teacher', active: true },
      t_admin: { name: '관리자', pin: '999999', role: 'admin', active: true }
    };
    const legacyPinMap = {
      t_kim: new Set(['', '1234']),
      t_admin: new Set(['', '9999'])
    };
    const batch = writeBatch(db);
    let changed = 0;
    teacherSnap.docs.forEach(snap => {
      const next = renameMap[snap.id];
      if (!next) return;
      const data = snap.data() || {};
      const currentPin = String(data.pin || '');
      const shouldUpdatePin = legacyPinMap[snap.id]?.has(currentPin);
      const payload = {
        name: data.name || next.name,
        role: data.role || next.role,
        active: data.active === false ? true : data.active !== undefined ? data.active : true
      };
      if (shouldUpdatePin) payload.pin = next.pin;
      batch.update(doc(db, COLLECTION_NAMES.teachers, snap.id), payload);
      changed++;
    });
    if (changed > 0) {
      await batch.commit();
    }
  }

  // Login functions implementation
  const handleLogin = useCallback(async (selectedTeacherId, inputPin) => {
    const { refs } = await getFirebaseService();
    const normalizedPin = String(inputPin || '').replace(/\D/g, '').trim();
    if (!selectedTeacherId) {
      setLoginError('선생님을 먼저 선택해주세요.');
      return false;
    }
    const teacher = teachers.find(t => t.id === selectedTeacherId);
    if (!teacher) {
      setLoginError('선생님 정보를 찾을 수 없습니다.');
      return false;
    }
    if (!new RegExp(`^\\d{${STAFF_PIN_LENGTH}}$`).test(normalizedPin)) {
      setLoginError(`PIN 번호는 ${STAFF_PIN_LENGTH}자리 숫자입니다.`);
      return false;
    }
    if (String(teacher.pin || '').replace(/\D/g, '') !== normalizedPin) {
      setLoginError('PIN 번호가 올바르지 않습니다.');
      return false;
    }

    setCurrentTeacher(teacher);
    setLoginError('');
    setPin('');

    const teacherClasses = classes.filter(c => c.teacherId === teacher.id);
    const firstClass = teacher.role === 'admin' ? classes[0] : teacherClasses[0];
    setSelectedSetupClassId(firstClass?.id || '');
    setAssigningClassId(firstClass?.id || '');
    setSelectedInspectionClassId(firstClass?.id || '');
    setQuickClassId(firstClass?.id || '');
    setReportClassId('');

    if (teacher.role === 'admin') {
      window.localStorage?.setItem(ADMIN_SESSION_KEY, JSON.stringify(teacher));
      setPortal('admin');
      setView('teachersAdmin');
    } else {
      window.localStorage?.setItem(TEACHER_SESSION_KEY, JSON.stringify(teacher));
      window.localStorage?.setItem(LAST_TEACHER_ID_KEY, teacher.id);
      setPortal('teacher');
      setView('inspections');
    }
    notify('로그인 성공!');
    return true;
  }, [teachers, classes, notify]);

  const handleStudentLogin = useCallback(async (studentId, inputPin) => {
    const { db } = await getFirebaseService();
    if (!studentId) {
      showModalAlert('학생을 선택해 주세요.');
      return false;
    }
    const student = students.find(s => s.id === studentId);
    if (!student) {
      showModalAlert('학생 정보를 찾을 수 없습니다.');
      return false;
    }

    if (student.pinLocked) {
      showModalAlert('비밀번호 오류 횟수 초과로 계정이 잠겼습니다. 선생님께 문의하세요.');
      return false;
    }

    const normalizedPin = String(inputPin || '').replace(/\D/g, '').trim();
    if (normalizedPin !== String(student.pin || '1234')) {
      const failedCount = (student.pinFailedCount || 0) + 1;
      const remains = 5 - failedCount;
      if (failedCount >= 5) {
        await updateDoc(doc(db, COLLECTION_NAMES.students, student.id), {
          pinFailedCount: failedCount,
          pinLocked: true,
          updatedAt: serverTimestamp()
        });
        showModalAlert('비밀번호 5회 오류로 로그인 계정이 잠겼습니다. 담당 선생님께 해제를 요청해 주세요.');
      } else {
        await updateDoc(doc(db, COLLECTION_NAMES.students, student.id), {
          pinFailedCount: failedCount,
          updatedAt: serverTimestamp()
        });
        showModalAlert(`PIN 번호가 올바르지 않습니다. (오류 횟수: ${failedCount}/5회, 남은 횟수: ${remains}회)`);
      }
      return false;
    }

    await updateDoc(doc(db, COLLECTION_NAMES.students, student.id), {
      pinFailedCount: 0,
      pinLocked: false,
      updatedAt: serverTimestamp()
    });

    setStudentSession(student);
    setPortal('student');
    setView('studentPortal');
    setStudentLoginForm(prev => rememberStudentLoginForm(student, prev));
    notify('학생 대시보드 로그인 성공!');
    return true;
  }, [students, showModalAlert, notify]);

  const handleStudentRegister = useCallback(async (classId, name, school, registerPin) => {
    const { refs } = await getFirebaseService();
    if (!classId || !name.trim()) {
      showModalAlert('반 이름과 본인 이름을 입력해 주세요.');
      return false;
    }
    const cleanName = name.trim();
    const cleanSchool = school.trim();
    const klass = classes.find(c => c.id === classId);
    if (!klass) {
      showModalAlert('유효한 반이 아닙니다.');
      return false;
    }

    const duplicate = students.find(s => s.classId === classId && String(s.name || '').trim() === cleanName && String(s.school || '').trim() === cleanSchool && s.active !== false);
    if (duplicate) {
      showModalAlert('이미 반에 등록된 동일한 이름과 학교의 학생이 있습니다.');
      return false;
    }

    const pending = studentRequests.find(req => (req.status || 'pending') === 'pending' && String(req.classId || '') === String(classId) && String(req.name || '').trim() === cleanName && String(req.school || '').trim() === cleanSchool);
    if (pending) {
      showModalAlert('이미 관리자 승인 대기 중인 신규생 등록 요청이 있습니다.');
      return false;
    }

    const regPin = String(registerPin || '').replace(/\D/g, '').trim();
    if (!/^\d{4}$/.test(regPin)) {
      showModalAlert('초기 PIN은 4자리 숫자로 입력해야 합니다.');
      return false;
    }

    await addDoc(refs.studentRequests, {
      name: cleanName,
      school: cleanSchool,
      grade: klass.grade,
      classId,
      pin: regPin,
      status: 'pending',
      createdAt: serverTimestamp()
    });

    await showModalAlert('신규생 등록 요청이 접수되었습니다. 관리자 승인 후 설정한 4자리 PIN으로 로그인할 수 있습니다.');
    setLoginStep('login');
    return true;
  }, [classes, students, studentRequests, showModalAlert]);

  const handleLogout = useCallback(() => {
    if (currentTeacher) {
      if (currentTeacher.role === 'admin') {
        window.localStorage?.removeItem(ADMIN_SESSION_KEY);
      } else {
        window.localStorage?.removeItem(TEACHER_SESSION_KEY);
      }
    }
    setCurrentTeacher(null);
    setStudentSession(null);
    setPortal('gateway');
    setPin('');
    setLoginError('');
    setSelectedTeacherName('');
    notify('로그아웃 되었습니다.');
  }, [currentTeacher, notify]);

  const updateSelectedReportRound = useCallback((round) => {
    setSelectedReportRoundState(round);
  }, []);

  const updateSelectedReportPeriod = useCallback((val) => {
    setSelectedReportPeriodState(val);
    window.localStorage?.setItem('oatis.selectedReportPeriod.v1', val);
  }, []);

  return {
    loading,
    portal,
    setPortal,
    loginStep,
    setLoginStep,
    currentTeacher,
    setCurrentTeacher,
    selectedTeacherName,
    setSelectedTeacherName,
    pin,
    setPin,
    loginError,
    setLoginError,
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

    selectedSetupClassId,
    setSelectedSetupClassId,
    setupFormClass,
    setSetupFormClass,
    studentBulkText,
    setStudentBulkText,
    studentBulkMode,
    setStudentBulkMode,
    selectedBookManageId,
    setSelectedBookManageId,
    formBook,
    setFormBook,
    formUnit,
    setFormUnit,
    bulkUnitText,
    setBulkUnitText,
    tempBookUnits,
    setTempBookUnits,

    standardUnitSubjects,
    setStandardUnitSubjects,
    remarkTemplates,
    setRemarkTemplates,
    selectedStandardSubjectCode,
    setSelectedStandardSubjectCode,
    standardUnitNewName,
    setStandardUnitNewName,
    standardUnitInsertOrder,
    setStandardUnitInsertOrder,

    editingBookId,
    setEditingBookId,
    assigningClassId,
    setAssigningClassId,
    selectedInspectionClassId,
    setSelectedInspectionClassId,
    selectedInspectionStudentId,
    setSelectedInspectionStudentId,
    selectedInspectionBookId,
    setSelectedInspectionBookId,
    selectedDate,
    setSelectedDate,
    selectedRangeStart,
    setSelectedRangeStart,
    selectedRangeEnd,
    setSelectedRangeEnd,
    missedPages,
    setMissedPages,
    memo,
    setMemo,
    rubricScores,
    setRubricScores,
    selectedCarryoverResolutionKeys,
    setSelectedCarryoverResolutionKeys,
    quickClassId,
    setQuickClassId,
    editingInspectionId,
    setEditingInspectionId,

    reportStudentId,
    setReportStudentId,
    reportClassId,
    setReportClassId,
    reportRoundStartDate,
    setReportRoundStartDate,
    selectedReportRound,
    setSelectedReportRound: updateSelectedReportRound,
    reportRounds,
    setReportRounds,
    printHtml,
    setPrintHtml,
    reportPeriods,
    selectedReportPeriod,
    updateSelectedReportPeriod,

    dashboardTeacherFilter,
    setDashboardTeacherFilter,
    dashboardMetricFocus,
    setDashboardMetricFocus,

    saveMsg,
    setSaveMsg,
    notify,

    adminTeacherForm,
    setAdminTeacherForm,
    adminTeacherEditId,
    setAdminTeacherEditId,
    selectedAdminStudentIds,
    setSelectedAdminStudentIds,
    adminPromotionGrade,
    setAdminPromotionGrade,
    adminPromotionClassId,
    setAdminPromotionClassId,
    wizardOpen,
    setWizardOpen,
    wizardStep,
    setWizardStep,
    setupDetailPanel,
    setSetupDetailPanel,
    selectedExistingStudentId,
    setSelectedExistingStudentId,
    setupSearchClass,
    setSetupSearchClass,
    setupSearchStudent,
    setSetupSearchStudent,
    setupSearchBook,
    setSetupSearchBook,
    existingStudentSearch,
    setExistingStudentSearch,

    setupAccordion,
    setSetupAccordion,
    bookSetupAccordion,
    setBookSetupAccordion,
    adminCardExpanded,
    setAdminCardExpanded,

    studentLoginForm,
    setStudentLoginForm,
    studentSession,
    setStudentSession,
    studentPinModalOpen,
    setStudentPinModalOpen,

    customModal,
    setCustomModal,
    showModalAlert,
    showModalConfirm,
    showModalPrompt,

    loginConfig,
    adminLoginConfigForm,
    setAdminLoginConfigForm,
    
    // Login handlers
    handleLogin,
    handleStudentLogin,
    handleStudentRegister,
    handleLogout
  };
}
