import React from 'react';
import { createRoot } from 'react-dom/client';
import InspectionsContainer from '../components/InspectionsContainer.jsx';
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
  writeBatch
} from '../services/firebaseService.js';
import {
  buildCarryoverResolutions,
  buildCarryoverRows,
  calculateCompletionRate,
  calculateCarryoverRecoveryRate,
  filterMissedPagesToRange,
  normalizeRubricScores,
  pageResolutionKey,
  pagesInRange,
  parseMissedPages,
  RUBRIC_ITEMS,
  sortBookUnits,
  unitsForRange
} from '../lib/textbookProgress.js';
import {
  averageCompletionRate,
  classProgressRate,
  classRubricAverage,
  groupInspectionsByBook,
  studentRubricAverage
} from '../lib/reportMetrics.js';
import {
  buildReportRounds,
  formatRoundFileName
} from '../lib/reportRounds.js';
import {
  calculateStudentDeleteAfter,
  studentsDueForDeletion
} from '../lib/adminStudentMaintenance.js';
import {
  DEFAULT_STANDARD_UNIT_SUBJECTS,
  normalizeStandardUnitSubjects,
  standardUnitLabelsForIds,
  standardUnitSubjectByLabel
} from '../lib/standardUnits.js';
import {
  DEFAULT_REMARK_TEMPLATES,
  normalizeRemarkTemplates
} from '../lib/remarkTemplates.js';
import { renderDashboardView } from './views/dashboardView.js';
import { renderCustomModalMarkup, renderLayoutView } from './views/layoutView.js';
import { renderLoginView } from './views/loginView.js';
import { renderSetupView } from './views/setupView.js';
import { renderBookSetupView } from './views/bookSetupView.js';
import { renderInspectionsView, unitChipTextColor } from './views/inspectionsView.js';
import { renderReportsView, reportForStudent, reportForClass, reportForStudentImage } from './views/reportsView.js';
import { renderTeachersAdminView } from './views/teachersAdminView.js';
import { renderStudentPortalView } from './views/studentPortalView.js'; // [NEW]

export async function mountLegacyApp(appRoot) {
  if (!appRoot) throw new Error('Legacy app root is required.');

  const { db, refs } = await getFirebaseService();
  let inspectionsReactRoot = null;
  let lastModalOpenState = false;

  const COLORS = ['#FDE68A','#BFDBFE','#DDD6FE','#A7F3D0','#FBCFE8','#FECACA','#C7D2FE','#BBF7D0'];
  const GRADE_OPTIONS = ['고1','고2','고3'];
  const STAFF_PIN_LENGTH = 6;
  const STUDENT_LOGIN_MEMORY_KEY = 'oatis.studentLoginForm.v1';
  const TEACHER_SESSION_KEY = 'oatis.teacherSession.v1';
  const ADMIN_SESSION_KEY = 'oatis.adminSession.v1';
  const LAST_TEACHER_ID_KEY = 'oatis.lastTeacherId.v1';

  function readRememberedTeacherSession() {
    try {
      const raw = window.localStorage?.getItem(TEACHER_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function readRememberedAdminSession() {
    try {
      const raw = window.localStorage?.getItem(ADMIN_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function readLastTeacherId() {
    return window.localStorage?.getItem(LAST_TEACHER_ID_KEY) || '';
  }

  const state = {
    loading: true,
    portal: 'gateway', // 'gateway' | 'student' | 'teacher' | 'admin'
    loginStep: 'login', // 'login' | 'register' | 'change-pin'
    currentTeacher: null,
    selectedTeacherName: '',
    pin: '',
    loginError: '',
    view: 'inspections', // inspections | reports | setup | teachersAdmin
    tempBookUnits: null,
    teachers: [],
    classes: [],
    students: [],
    allStudents: [],
    studentRequests: [],
    books: [],
    classBooks: [],
    inspections: [],
    selectedSetupClassId: '',
    setupFormClass: { name: '', grade: '', teacherId: '', note: '' },
    studentBulkText: '',
    studentBulkMode: 'nameSchool',
    selectedBookManageId: '',
    formBook: { title: '', subject: '', grade: '', publisher: '', active: true, bookType: 'standard', chapterCount: '10' },
    formUnit: { name: '', start: '', end: '', standardUnitIds: [] },
    bulkUnitText: '',
    standardUnitSubjects: normalizeStandardUnitSubjects(DEFAULT_STANDARD_UNIT_SUBJECTS),
    remarkTemplates: normalizeRemarkTemplates(DEFAULT_REMARK_TEMPLATES),
    selectedStandardSubjectCode: 'common_math_1',
    standardUnitNewName: '',
    standardUnitInsertOrder: '',
    editingBookId: '',
    assigningClassId: '',
    selectedInspectionClassId: '',
    selectedInspectionStudentId: '',
    selectedInspectionBookId: '',
    selectedDate: new Date().toISOString().slice(0, 10),
    selectedRangeStart: '',
    selectedRangeEnd: '',
    missedPages: '',
    memo: '',
    // 6요소 평가 점수 (0~10점, null = 미입력)
    rubricScores: { expression: null, grading: null, attitude: null, understanding: null, application: null },
    selectedCarryoverResolutionKeys: [],
    quickClassId: '',
    editingInspectionId: '',
    reportStudentId: '',
    reportClassId: '',
    reportRoundStartDate: '',
    selectedReportRound: '',
    reportRounds: [],
    dashboardTeacherFilter: 'all',
    dashboardMetricFocus: 'students',
    saveMsg: '',
    printHtml: '',
    classReportHtml: '',
    inspectionHistoryFilterStudent: '',
    inspectionHistoryFilterClass: '',
    adminTeacherForm: { id: '', name: '', pin: '', role: 'teacher' },
    adminTeacherEditId: '',
    selectedAdminStudentIds: [],
    adminPromotionGrade: '',
    adminPromotionClassId: '',
    wizardOpen: false,
    wizardStep: 1,
    setupDetailPanel: '',
    selectedExistingStudentId: '',
    setupSearchClass: '',
    setupSearchStudent: '',
    setupSearchBook: '',
    existingStudentSearch: '',
    
    // 아코디언 상태 관리
    setupAccordion: { class: false, bulk: false, edit: false },
    bookSetupAccordion: { manage: false, unit: false, assign: false },
    
    // 학생 PIN 관련 폼 상태
    studentLoginForm: { classId: '', grade: '', studentId: '', name: '', pin: '', school: '', schoolConfirmed: false, teacherId: '' },
    studentSession: null, // 학생 포털 로그인 성공 세션
    selectedStudentBookFilter: '',
    selectedStudentRubricBookId: '',
    
    // 커스텀 모달 제어 상태
    customModal: {
      open: false,
      type: 'alert', // 'alert' | 'confirm'
      title: '',
      message: '',
      confirmText: '확인',
      cancelText: '취소',
      resolve: null
    },

    // 정렬 제어 상태
    sortKey: '',
    sortOrder: 'asc',

    loginConfig: {
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
    },
    adminLoginConfigForm: {
      splashTitleLine1: '',
      splashTitleLine2: '',
      splashTitleSizeLine1: '',
      splashTitleSizeLine2: '',
      splashSubtitle: '',
      splashDescription: '',
      splashKicker: '',
      gatewayBadge: '',
      gatewayTitle: '',
      gatewayDescription: '',
      studentPortalTitle: '',
      studentPortalDescription: '',
      teacherPortalTitle: '',
      teacherPortalDescription: '',
      adminPortalTitle: '',
      adminPortalDescription: '',
      splashTitleColor: '',
      splashTextColor: '',
      splashMutedColor: '',
      auroraColor1: '',
      auroraColor2: '',
      auroraColor3: '',
      portalHoverGlowColor: '',
      loginTitle: '',
      loginDescription: '',
      loginInfoText: '',
      primaryColor: '',
      fontFamily: '',
      fontScale: ''
    },
    adminCardExpanded: {}
  };

  state.studentLoginForm = readRememberedStudentLoginForm();

  // 비동기 알림 모달 구현
  function showModalAlert(message, title = '알림') {
    return new Promise((resolve) => {
      state.customModal = {
        open: true,
        type: 'alert',
        title,
        message,
        confirmText: '확인',
        cancelText: '취소',
        resolve
      };
      render();
    });
  }

  // 비동기 컨펌 모달 구현
  function showModalConfirm(message, title = '확인') {
    return new Promise((resolve) => {
      state.customModal = {
        open: true,
        type: 'confirm',
        title,
        message,
        confirmText: '확인',
        cancelText: '취소',
        resolve
      };
      render();
    });
  }

  // 비동기 프롬프트 모달 구현
  function showModalPrompt(message, defaultVal = '', title = '입력') {
    return new Promise((resolve) => {
      state.customModal = {
        open: true,
        type: 'prompt',
        title,
        message,
        inputValue: defaultVal,
        confirmText: '확인',
        cancelText: '취소',
        resolve
      };
      render();
    });
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
  function hexToRgbParts(hex, fallback = '0, 214, 205') {
    const clean = String(hex || '').replace('#', '').trim();
    if (!/^[0-9a-fA-F]{6}$/.test(clean)) return fallback;
    const num = parseInt(clean, 16);
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
  }

  function applyThemeColor(color, fontFamily, fontScale) {
    const cfg = state.loginConfig || {};
    const primary = color || cfg.primaryColor || '#384bff';
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
    rootStyle.setProperty('--splash-title-color', cfg.splashTitleColor || '#ffffff');
    rootStyle.setProperty('--splash-text-color', cfg.splashTextColor || '#e5e7eb');
    rootStyle.setProperty('--splash-muted-color', cfg.splashMutedColor || '#94a3b8');
    rootStyle.setProperty('--portal-hover-glow-rgb', hexToRgbParts(cfg.portalHoverGlowColor || '#00d6cd'));
    rootStyle.setProperty('--aurora-cyan-rgb', hexToRgbParts(cfg.auroraColor1 || '#00d6cd'));
    rootStyle.setProperty('--aurora-blue-rgb', hexToRgbParts(cfg.auroraColor2 || '#4169e1'));
    rootStyle.setProperty('--aurora-violet-rgb', hexToRgbParts(cfg.auroraColor3 || '#8436ff'));

    const fontsImport = `
      @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css');
      @import url('https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Inter:wght@400;600;800&family=SUIT:wght@400;600;800&display=swap');
    `;
    
    let styleEl = document.getElementById('dynamic-theme');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'dynamic-theme';
      document.head.appendChild(styleEl);
    }
    
    styleEl.innerHTML = `
      ${fontsImport}
      body {
        font-family: var(--theme-font-family) !important;
      }
      html {
        font-size: calc(16px * var(--theme-font-scale, 1.0)) !important;
      }
    `;
  }

  function safe(v) {
    return String(v ?? '').replace(/[&<>\"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }
  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }
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
      ...overrides,
      pin: ''
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
  function rememberStudentLoginForm(student, form = state.studentLoginForm) {
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
  function fmtDate(v) {
    const d = new Date(v);
    if (isNaN(d)) return '-';
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  }
  function teacherNameById(id) {
    return state.teachers.find(t => t.id === id)?.name || '-';
  }
  function classById(id) {
    return state.classes.find(c => c.id === id) || null;
  }
  function studentById(id) {
    return state.students.find(s => s.id === id) || null;
  }
  function bookById(id) {
    return state.books.find(b => b.id === id) || null;
  }
  function standardUnitNames(ids = []) {
    return standardUnitLabelsForIds(state.standardUnitSubjects, ids);
  }
  function displayUnitName(unit, book = null) {
    if (book?.bookType === 'exam_chapter') return unit?.name || '';
    const linkedNames = standardUnitNames(unit?.standardUnitIds || []);
    return linkedNames.length ? linkedNames.join(', ') : (unit?.name || '');
  }
  function bookUnits(book) {
    return sortBookUnits(book).map(unit => ({
      ...unit,
      name: displayUnitName(unit, book)
    }));
  }
  function rawBookUnits(book) {
    return sortBookUnits(book);
  }
  function standardSubjectForBook(book) {
    return standardUnitSubjectByLabel(state.standardUnitSubjects, book?.subject || '');
  }
  function stripBookSubjectFromTitle(subject, title) {
    const cleanSubject = String(subject || '').trim();
    const cleanTitle = String(title || '').trim();
    if (!cleanSubject) return cleanTitle;
    if (cleanTitle === cleanSubject) return '';
    const prefixPattern = new RegExp(`^${cleanSubject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s_-]+`);
    return cleanTitle.replace(prefixPattern, '').trim();
  }
  function composeBookTitle(subject, titleBase) {
    const cleanSubject = String(subject || '').trim();
    const cleanBase = String(titleBase || '').trim();
    return [cleanSubject, cleanBase].filter(Boolean).join(' ');
  }
  function unitsForRangeWithStandardNames(book, start, end) {
    return unitsForRange(book, start, end).map(unit => ({
      ...unit,
      name: displayUnitName(unit, book)
    }));
  }
  function studentsForClass(classId) {
    return state.students.filter(s => s.classId === classId && s.active !== false).sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'));
  }
  function classBookStatus(link) {
    return link?.status || 'active';
  }
  function classBookCompletedTime(link) {
    const value = link?.completedAt || link?.updatedAt || link?.createdAt || '';
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value?.toDate === 'function') return value.toDate().getTime();
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  function assignedBooksForClass(classId) {
    return state.classBooks.filter(x => x.classId === classId && x.active !== false && classBookStatus(x) === 'active').sort((a, b) => Number(a.order || 0) - Number(b.order || 0)).map(x => ({ link: x, book: bookById(x.bookId) })).filter(x => x.book && !x.book.archived);
  }
  function completedBooksForClass(classId) {
    return state.classBooks.filter(x => x.classId === classId && x.active !== false && classBookStatus(x) === 'completed').sort((a, b) => classBookCompletedTime(b) - classBookCompletedTime(a)).map(x => ({ link: x, book: bookById(x.bookId) })).filter(x => x.book);
  }
  function inspectionsForStudent(studentId) {
    return state.inspections.filter(i => i.studentId === studentId).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }
  function loadScript(src) {
    if ([...document.scripts].some(script => script.src === src)) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`${src} 로드에 실패했습니다.`));
      document.head.appendChild(script);
    });
  }
  function activeReportClassId() {
    const selectedStudent = studentById(state.reportStudentId);
    return selectedStudent?.classId || state.reportClassId || '';
  }
  function currentReportRoundStartDate() {
    const klass = classById(activeReportClassId());
    return state.reportRoundStartDate || klass?.reportRoundStartDate || '';
  }
  function refreshReportRounds() {
    if (!state.reportStudentId) {
      state.reportRounds = [];
      state.selectedReportRound = '';
      state.printHtml = '';
      return;
    }
    state.reportRounds = buildReportRounds({
      inspections: state.inspections,
      classId: activeReportClassId(),
      studentId: state.reportStudentId,
      startDate: currentReportRoundStartDate()
    });
    if (state.selectedReportRound && !state.reportRounds.some(round => round.round === Number(state.selectedReportRound))) {
      state.selectedReportRound = '';
      state.printHtml = '';
    }
  }
  function selectedReportRoundInfo() {
    const roundNumber = Number(state.selectedReportRound);
    return state.reportRounds.find(round => round.round === roundNumber) || null;
  }
  function normalizeReportDate(value) {
    return String(value || '').trim().slice(0, 10);
  }
  function inspectionsForSelectedReportRound(studentId) {
    const round = selectedReportRoundInfo();
    const roundDate = normalizeReportDate(round?.date);
    return inspectionsForStudent(studentId).filter(inspection => {
      if (!roundDate) return true;
      return normalizeReportDate(inspection.date) === roundDate;
    });
  }
  function buildSelectedStudentWebReport() {
    const round = selectedReportRoundInfo();
    if (!state.reportStudentId || !round) {
      state.printHtml = '';
      return;
    }
    state.printHtml = reportForStudent(state.reportStudentId, state, {
      studentById,
      classById,
      inspectionsForStudent: inspectionsForSelectedReportRound,
      groupInspectionsByBook,
      bookById,
      averageCompletionRate,
      fmtDate,
      safe,
      progressTone,
      classRubricAverage,
      studentRubricAverage,
      students: state.students,
      inspections: state.inspections,
      assignedBooksForClass
    });
  }
  function selectedStudentImageReportHtml() {
    const round = selectedReportRoundInfo();
    if (!state.reportStudentId || !round) {
      return '';
    }
    return reportForStudentImage(state.reportStudentId, state, {
      studentById,
      classById,
      inspectionsForStudent,
      groupInspectionsByBook,
      bookById,
      averageCompletionRate,
      fmtDate,
      safe,
      teacherNameById,
      classRubricAverage,
      studentRubricAverage,
      students: state.students,
      inspections: state.inspections,
      assignedBooksForClass,
      unitsForRange: unitsForRangeWithStandardNames
    }, { round });
  }
  function inspectionsForStudentProfile(studentId) {
    const students = state.allStudents || state.students || [];
    const current = students.find(s => s.id === studentId) || (state.studentSession?.id === studentId ? state.studentSession : null);
    const profileId = current?.studentProfileId || current?.id || studentId;
    const linkedStudentIds = new Set(
      students
        .filter(s => (s.studentProfileId || s.id) === profileId)
        .map(s => s.id)
    );
    linkedStudentIds.add(studentId);
    return state.inspections
      .filter(i => linkedStudentIds.has(i.studentId))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }
  function teacherClasses(teacherId) {
    return state.classes.filter(c => c.teacherId === teacherId && c.active !== false);
  }
  function pastel(index) {
    return COLORS[index % COLORS.length];
  }
  function notify(msg) {
    state.saveMsg = msg;
    render();
    setTimeout(() => {
      state.saveMsg = '';
      render();
    }, 1800);
  }
  function setupProgress() {
    const klass = classById(state.selectedSetupClassId);
    const studentCount = klass ? studentsForClass(klass.id).length : 0;
    const books = klass ? assignedBooksForClass(klass.id).length : 0;
    return [
      { label: '반 생성', done: !!klass },
      { label: '교재 배정', done: books > 0 },
      { label: '학생 등록', done: studentCount > 0 },
      { label: '운영 시작', done: !!klass && studentCount > 0 && books > 0 }
    ];
  }
  function findDuplicateStudentName(classId, name, school = '') {
    return state.students.find(s => s.classId === classId && String(s.name || '').trim() === String(name || '').trim() && String(s.school || '').trim() === String(school || '').trim() && s.active !== false);
  }

  function findPendingStudentRequest(classId, name, school = '') {
    return (state.studentRequests || []).find(req =>
      (req.status || 'pending') === 'pending' &&
      String(req.classId || '') === String(classId || '') &&
      String(req.name || '').trim() === String(name || '').trim() &&
      String(req.school || '').trim() === String(school || '').trim()
    );
  }

  function existingStudentProfilesForClass(classId) {
    const seen = new Set();
    return state.students
      .filter(s => s.active !== false && s.classId !== classId)
      .filter(s => {
        const key = `${String(s.name || '').trim()}__${String(s.school || '').trim()}__${String(s.grade || '').trim()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'));
  }

  function filterByKeyword(rows, keyword, getter) {
    const q = String(keyword || '').trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(row => String(getter(row) || '').toLowerCase().includes(q));
  }
  function progressTone(rate) {
    const value = Number(rate || 0);
    if (value >= 85) return { badge: 'bg-emerald-50 border-emerald-200 text-emerald-700', bar: 'linear-gradient(90deg,#10b981,#00bfa5)' };
    if (value >= 60) return { badge: 'bg-amber-50 border-amber-200 text-amber-700', bar: 'linear-gradient(90deg,#fbbf24,#f59e0b)' };
    return { badge: 'bg-rose-50 border-rose-200 text-rose-700', bar: 'linear-gradient(90deg,#f43f5e,#fb7185)' };
  }

  async function addExistingStudentToClass(sourceStudentId, classId) {
    const klass = classById(classId);
    const source = studentById(sourceStudentId);
    if (!klass || !source) return showModalAlert('반과 학생을 먼저 선택해주세요.');
    if (findDuplicateStudentName(classId, source.name, source.school || '')) return showModalAlert('이미 이 반에 등록된 학생입니다.');
    await addDoc(refs.students, {
      name: source.name || '',
      school: source.school || '',
      grade: klass.grade || source.grade || '',
      classId,
      active: true,
      status: 'active',
      studentProfileId: source.studentProfileId || source.id,
      pin: source.pin || '1234',
      pinFailedCount: 0,
      pinLocked: false,
      createdAt: serverTimestamp()
    });
    state.selectedExistingStudentId = '';
    notify('기존 학생을 현재 반에 추가했습니다');
    render();
  }

  async function ensureSeedData() {
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
      { id: 'b1', title: '공통수학1 샘플 교재', subject: '공통수학1', grade: '고1', publisher: '열린학원', active: true, archived: false, units: [{ id: uid(), name: '다항식의 연산', start: 1, end: 20, color: pastel(0), standardUnitIds: ['common_math_1_polynomial_operations'] }, { id: uid(), name: '나머지정리', start: 21, end: 40, color: pastel(1), standardUnitIds: ['common_math_1_remainder_theorem'] }] }
    ].forEach(b => batch.set(doc(db, COLLECTION_NAMES.books, b.id), { ...b, createdAt: serverTimestamp() }));
    [
      { id: 'c1', name: '고1 샘플반', teacherId: 't_kim', grade: '고1', note: '수학 교재점검 샘플반', active: true }
    ].forEach(c => batch.set(doc(db, COLLECTION_NAMES.classes, c.id), { ...c, createdAt: serverTimestamp() }));
    [
      { id: 's1', name: '김다인', classId: 'c1', grade: '고1', school: '파주고', active: true, pin: '1234', pinFailedCount: 0, pinLocked: false },
      { id: 's2', name: '박서윤', classId: 'c1', grade: '고1', school: '문산고', active: true, pin: '1234', pinFailedCount: 0, pinLocked: false }
    ].forEach(s => batch.set(doc(db, COLLECTION_NAMES.students, s.id), { ...s, createdAt: serverTimestamp() }));
    [
      { id: 'cb1', classId: 'c1', bookId: 'b1', order: 1, main: true, active: true, status: 'active' }
    ].forEach(l => batch.set(doc(db, COLLECTION_NAMES.classBooks, l.id), { ...l, createdAt: serverTimestamp() }));

    await batch.commit();
  }

  async function migrateDefaultTeachers() {
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
      const needsUpdate = shouldUpdatePin || !data.name || !data.role || data.active === false;
      if (!needsUpdate) return;
      batch.update(doc(db, COLLECTION_NAMES.teachers, snap.id), { ...payload, updatedAt: serverTimestamp() });
      changed++;
    });
    if (changed) await batch.commit();
  }

  function resetAdminTeacherForm() {
    state.adminTeacherForm = { id: '', name: '', pin: '', role: 'teacher' };
    state.adminTeacherEditId = '';
  }
  function loadAdminTeacherToForm(teacherId) {
    const teacher = state.teachers.find(t => t.id === teacherId);
    if (!teacher) return;
    state.adminTeacherEditId = teacher.id;
    state.adminTeacherForm = { id: teacher.id, name: teacher.name || '', pin: String(teacher.pin || ''), role: teacher.role || 'teacher' };
    render();
  }
  async function saveAdminTeacher() {
    const form = state.adminTeacherForm;
    if (!form.name.trim()) return showModalAlert('강사 이름을 입력해주세요.');
    if (!new RegExp(`^\\d{${STAFF_PIN_LENGTH}}$`).test(String(form.pin || ''))) return showModalAlert(`강사/관리자 PIN은 ${STAFF_PIN_LENGTH}자리 숫자로 입력해주세요.`);
    if (!['admin', 'teacher'].includes(form.role)) return showModalAlert('권한을 선택해주세요.');
    const duplicate = state.teachers.find(t => t.id !== state.adminTeacherEditId && String(t.name || '').trim() === form.name.trim() && t.active !== false);
    if (duplicate) return showModalAlert('같은 이름의 강사가 이미 있습니다.');
    if (state.adminTeacherEditId) {
      await updateDoc(doc(db, COLLECTION_NAMES.teachers, state.adminTeacherEditId), {
        name: form.name.trim(),
        pin: String(form.pin),
        role: form.role,
        active: true,
        updatedAt: serverTimestamp()
      });
      notify('강사 정보 수정 완료');
    } else {
      await addDoc(refs.teachers, {
        name: form.name.trim(),
        pin: String(form.pin),
        role: form.role,
        active: true,
        createdAt: serverTimestamp()
      });
      notify('강사 추가 완료');
    }
    resetAdminTeacherForm();
    render();
  }
  async function removeAdminTeacher(teacherId) {
    const teacher = state.teachers.find(t => t.id === teacherId);
    if (!teacher) return;
    if (teacher.role === 'admin') return showModalAlert('관리자 계정은 삭제할 수 없습니다.');
    const hasClasses = state.classes.some(c => c.teacherId === teacherId && c.active !== false);
    let ok = false;
    if (hasClasses) {
      ok = await showModalConfirm('해당 강사가 담당하는 반이 존재합니다. 정말로 완전히 삭제하시겠습니까?\n(삭제 시 해당 반의 담당 강사는 공백으로 처리됩니다.)');
    } else {
      ok = await showModalConfirm(`'${teacher.name}' 강사를 완전히 삭제하시겠습니까?`);
    }
    if (!ok) return;
    
    const linkedClasses = state.classes.filter(c => c.teacherId === teacherId && c.active !== false);
    const batch = writeBatch(db);
    batch.delete(doc(db, COLLECTION_NAMES.teachers, teacherId));
    linkedClasses.forEach(klass => {
      batch.update(doc(db, COLLECTION_NAMES.classes, klass.id), { teacherId: '', updatedAt: serverTimestamp() });
    });
    await batch.commit();

    if (state.adminTeacherEditId === teacherId) resetAdminTeacherForm();
    notify('강사 완전 삭제 완료');
  }

  async function removeClass(classId) {
    const klass = classById(classId);
    if (!klass) return;
    const hasStudents = state.students.some(s => s.classId === classId && s.active !== false);
    if (hasStudents) return showModalAlert('학생이 남아 있는 반은 먼저 학생 정리 후 삭제해주세요.');
    const linkedBooks = state.classBooks.filter(cb => cb.classId === classId && cb.active !== false);
    const batch = writeBatch(db);
    batch.update(doc(db, COLLECTION_NAMES.classes, classId), { active: false, updatedAt: serverTimestamp() });
    linkedBooks.forEach(link => batch.update(doc(db, COLLECTION_NAMES.classBooks, link.id), { active: false, updatedAt: serverTimestamp() }));
    await batch.commit();
    if (state.selectedSetupClassId === classId) state.selectedSetupClassId = state.classes.find(c => c.id !== classId)?.id || '';
    notify('반 삭제 완료');
  }
  async function removeBook(bookId) {
    const book = bookById(bookId);
    if (!book) return;
    const linked = state.classBooks.some(cb => cb.bookId === bookId && cb.active !== false);
    if (linked) return showModalAlert('반에 배정된 교재는 먼저 배정을 해제한 뒤 삭제해주세요.');
    const ok = await showModalConfirm(`'${book.title}' 교재의 단원 정보와 함께 모든 데이터를 완전히 삭제하시겠습니까?`);
    if (!ok) return;
    await deleteDoc(doc(db, COLLECTION_NAMES.books, bookId));
    notify('교재 완전 삭제 완료');
  }

  // 학생 PIN 관리 함수
  async function resetStudentPin(studentId) {
    await updateDoc(doc(db, COLLECTION_NAMES.students, studentId), {
      pin: '1234',
      pinLocked: false,
      pinFailedCount: 0,
      updatedAt: serverTimestamp()
    });
    notify('학생 PIN번호가 1234로 초기화되었습니다.');
  }
  async function updateStudentPin(studentId, newPin) {
    if (!/^\d{4}$/.test(newPin)) return showModalAlert('PIN번호는 4자리 숫자로 입력해주세요.');
    await updateDoc(doc(db, COLLECTION_NAMES.students, studentId), {
      pin: newPin,
      pinLocked: false,
      pinFailedCount: 0,
      updatedAt: serverTimestamp()
    });
    notify('학생 PIN번호가 변경되었습니다.');
  }
  async function unlockStudentPin(studentId) {
    await updateDoc(doc(db, COLLECTION_NAMES.students, studentId), {
      pinLocked: false,
      pinFailedCount: 0,
      updatedAt: serverTimestamp()
    });
    notify('학생 PIN 잠금이 해제되었습니다.');
  }

  let sessionChecked = false;
  function subscribe() {
    onSnapshot(refs.teachers, snap => { state.teachers = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.active !== false); render(); });
    onSnapshot(refs.classes, snap => { state.classes = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.active !== false); if (!state.selectedSetupClassId && state.classes.length) state.selectedSetupClassId = state.classes[0].id; if (!state.assigningClassId && state.classes.length) state.assigningClassId = state.classes[0].id; render(); });
    onSnapshot(refs.students, snap => {
      state.allStudents = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.deleted !== true);
      state.students = state.allStudents.filter(x => x.active !== false && x.status !== 'withdrawn');
      render();
    });
    onSnapshot(refs.studentRequests, snap => {
      state.studentRequests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      render();
    });
    onSnapshot(refs.books, snap => { state.books = snap.docs.map(d => ({ id: d.id, ...d.data() })); render(); });
    onSnapshot(refs.classBooks, snap => { state.classBooks = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.active !== false); render(); });
    onSnapshot(refs.inspections, snap => { 
      state.inspections = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.deleted !== true); 
      state.loading = false; 
      if (!sessionChecked) {
        sessionChecked = true;
        restoreSessionOnLoad();
      }
      render(); 
    });
    onSnapshot(refs.configs, snap => {
      const docLoginSplash = snap.docs.find(d => d.id === 'login_splash');
      if (docLoginSplash) {
        state.loginConfig = { ...state.loginConfig, ...docLoginSplash.data() };
        state.adminLoginConfigForm = { ...state.adminLoginConfigForm, ...docLoginSplash.data() };
        applyThemeColor(state.loginConfig.primaryColor, state.loginConfig.fontFamily, state.loginConfig.fontScale);
      }
      const docStandardUnits = snap.docs.find(d => d.id === 'standard_units');
      state.standardUnitSubjects = normalizeStandardUnitSubjects(docStandardUnits?.data()?.subjects);
      if (!state.standardUnitSubjects.some(subject => subject.code === state.selectedStandardSubjectCode)) {
        state.selectedStandardSubjectCode = state.standardUnitSubjects[0]?.code || 'common_math_1';
      }
      const docRemarkTemplates = snap.docs.find(d => d.id === 'remark_templates');
      state.remarkTemplates = normalizeRemarkTemplates(docRemarkTemplates?.data()?.templates);
      render();
    });
  }

  async function saveStandardUnitSubjects(message = '표준단원 설정 저장 완료') {
    state.standardUnitSubjects = normalizeStandardUnitSubjects(state.standardUnitSubjects);
    await setDoc(doc(db, COLLECTION_NAMES.configs, 'standard_units'), {
      subjects: state.standardUnitSubjects,
      updatedAt: serverTimestamp()
    }, { merge: true });
    notify(message);
  }

  async function saveRemarkTemplates() {
    const templates = normalizeRemarkTemplates(state.remarkTemplates).map(row => ({
      ...row,
      positive: String(document.getElementById(`remarkTemplate-${row.key}-positive`)?.value || '').split('\n').map(v => v.trim()).filter(Boolean),
      neutral: String(document.getElementById(`remarkTemplate-${row.key}-neutral`)?.value || '').split('\n').map(v => v.trim()).filter(Boolean),
      negative: String(document.getElementById(`remarkTemplate-${row.key}-negative`)?.value || '').split('\n').map(v => v.trim()).filter(Boolean)
    }));
    state.remarkTemplates = normalizeRemarkTemplates(templates);
    await setDoc(doc(db, COLLECTION_NAMES.configs, 'remark_templates'), {
      templates: state.remarkTemplates,
      updatedAt: serverTimestamp()
    }, { merge: true });
    notify('대표 특이사항 문구 저장 완료');
  }

  async function saveStandardUnitName(unitId) {
    const input = document.getElementById(`standardUnitName-${unitId}`);
    const nextLabel = String(input?.value || '').trim();
    if (!nextLabel) return showModalAlert('표준단원명을 입력해주세요.');
    state.standardUnitSubjects = normalizeStandardUnitSubjects(state.standardUnitSubjects).map(subject => ({
      ...subject,
      units: subject.units.map(unit => unit.id === unitId ? { ...unit, label: nextLabel } : unit)
    }));
    await saveStandardUnitSubjects('표준단원명 수정 완료');
  }

  async function addStandardUnit() {
    const subjectCode = state.selectedStandardSubjectCode;
    const label = String(state.standardUnitNewName || '').trim();
    if (!subjectCode || !label) return showModalAlert('추가할 표준단원명을 입력해주세요.');
    const id = `${subjectCode}_custom_${uid()}`;
    state.standardUnitSubjects = normalizeStandardUnitSubjects(state.standardUnitSubjects).map(subject => {
      if (subject.code !== subjectCode) return subject;
      const units = subject.units.filter(unit => unit.active !== false);
      const maxOrder = units.length + 1;
      const requestedOrder = Number(state.standardUnitInsertOrder);
      const insertOrder = Number.isFinite(requestedOrder)
        ? Math.min(Math.max(1, Math.round(requestedOrder)), maxOrder)
        : maxOrder;
      const reorderedUnits = subject.units.map(unit => ({
        ...unit,
        order: Number(unit.order || 0) >= insertOrder ? Number(unit.order || 0) + 1 : Number(unit.order || 0)
      }));
      return {
        ...subject,
        units: [
          ...reorderedUnits,
          { id, label, order: insertOrder, active: true }
        ]
      };
    });
    state.standardUnitNewName = '';
    state.standardUnitInsertOrder = '';
    await saveStandardUnitSubjects('표준단원 추가 완료');
  }

  async function deleteStandardUnit(unitId) {
    const confirmed = await showModalConfirm('해당 표준단원을 삭제하시겠습니까?\n(이미 등록된 교재 단원에 영향이 갈 수 있으므로 화면에서만 비활성화됩니다.)');
    if (!confirmed) return;
    
    state.standardUnitSubjects = normalizeStandardUnitSubjects(state.standardUnitSubjects).map(subject => ({
      ...subject,
      units: subject.units.map(unit => unit.id === unitId ? { ...unit, active: false } : unit)
    }));
    await saveStandardUnitSubjects('표준단원 삭제 완료');
  }

  function restoreSessionOnLoad() {
    if (state.teachers.length === 0) return;
    
    const savedAdminSession = readRememberedAdminSession();
    if (savedAdminSession && state.teachers.some(t => t.id === savedAdminSession.id && t.pin === savedAdminSession.pin && t.role === 'admin' && t.active !== false)) {
      const matched = state.teachers.find(t => t.id === savedAdminSession.id);
      state.currentTeacher = matched;
      state.portal = 'admin';
      state.view = 'teachersAdmin';
      
      const firstClass = state.classes[0];
      state.selectedSetupClassId = firstClass?.id || '';
      state.assigningClassId = firstClass?.id || '';
      state.selectedInspectionClassId = firstClass?.id || '';
      state.quickClassId = firstClass?.id || '';
      state.reportClassId = '';
      return;
    }
    
    const savedTeacherSession = readRememberedTeacherSession();
    if (savedTeacherSession && state.teachers.some(t => t.id === savedTeacherSession.id && t.pin === savedTeacherSession.pin && t.role === 'teacher' && t.active !== false)) {
      const matched = state.teachers.find(t => t.id === savedTeacherSession.id);
      state.currentTeacher = matched;
      state.portal = 'teacher';
      state.view = 'inspections';
      
      const firstClass = teacherClasses(matched.id)[0];
      state.selectedSetupClassId = firstClass?.id || '';
      state.assigningClassId = firstClass?.id || '';
      state.selectedInspectionClassId = firstClass?.id || '';
      state.quickClassId = firstClass?.id || '';
      state.reportClassId = '';
      return;
    }
  }

  async function saveLoginConfig() {
    const form = state.adminLoginConfigForm;
    await setDoc(doc(db, COLLECTION_NAMES.configs, 'login_splash'), {
      splashTitleLine1: (form.splashTitleLine1 || '').trim(),
      splashTitleLine2: (form.splashTitleLine2 || '').trim(),
      splashTitleSizeLine1: (form.splashTitleSizeLine1 || '38px').trim(),
      splashTitleSizeLine2: (form.splashTitleSizeLine2 || '54px').trim(),
      splashSubtitle: (form.splashSubtitle || '').trim(),
      splashDescription: (form.splashDescription || '').trim(),
      splashKicker: (form.splashKicker || 'OPEN ACADEMY').trim(),
      gatewayBadge: (form.gatewayBadge || 'GATEWAY').trim(),
      gatewayTitle: (form.gatewayTitle || '').trim(),
      gatewayDescription: (form.gatewayDescription || '').trim(),
      studentPortalTitle: (form.studentPortalTitle || '').trim(),
      studentPortalDescription: (form.studentPortalDescription || '').trim(),
      teacherPortalTitle: (form.teacherPortalTitle || '').trim(),
      teacherPortalDescription: (form.teacherPortalDescription || '').trim(),
      adminPortalTitle: (form.adminPortalTitle || '').trim(),
      adminPortalDescription: (form.adminPortalDescription || '').trim(),
      splashTitleColor: (form.splashTitleColor || '#ffffff').trim(),
      splashTextColor: (form.splashTextColor || '#e5e7eb').trim(),
      splashMutedColor: (form.splashMutedColor || '#94a3b8').trim(),
      auroraColor1: (form.auroraColor1 || '#00d6cd').trim(),
      auroraColor2: (form.auroraColor2 || '#4169e1').trim(),
      auroraColor3: (form.auroraColor3 || '#8436ff').trim(),
      portalHoverGlowColor: (form.portalHoverGlowColor || '#00d6cd').trim(),
      loginTitle: (form.loginTitle || '').trim(),
      loginDescription: (form.loginDescription || '').trim(),
      loginInfoText: (form.loginInfoText || '').trim(),
      primaryColor: (form.primaryColor || '#384bff').trim(),
      fontFamily: (form.fontFamily || "'SUIT', sans-serif").trim(),
      fontScale: (form.fontScale || '1.0').trim(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    notify('로그인/스플래시 설정 저장 완료');
    await showModalAlert('로그인/스플래시 및 웹 테마 설정이 성공적으로 저장되었습니다!');
  }

  // 교사/관리자 로그인 처리
  async function handleLogin() {
    const normalizedPin = String(state.pin || '').replace(/\D/g, '').trim();
    const selectedTeacherId = String(state.selectedTeacherName || '').trim();
    if (!selectedTeacherId) {
      state.loginError = '선생님을 먼저 선택해주세요.';
      render();
      return;
    }
    const teacher = state.teachers.find(t => String(t.id || '').trim() === selectedTeacherId);
    if (!teacher) {
      state.loginError = '선생님 정보를 찾을 수 없습니다.';
      render();
      return;
    }
    if (!new RegExp(`^\\d{${STAFF_PIN_LENGTH}}$`).test(normalizedPin)) {
      state.pin = '';
      state.loginError = `PIN 번호는 ${STAFF_PIN_LENGTH}자리 숫자입니다.`;
      render();
      return;
    }
    if (String(teacher.pin || '').replace(/\D/g, '') !== normalizedPin) {
      state.pin = '';
      state.loginError = 'PIN 번호가 올바르지 않습니다.';
      render();
      return;
    }
    
    state.currentTeacher = teacher;
    state.loginError = '';
    state.customModal = { open: false, type: 'alert', title: '', message: '', resolve: null };
    state.view = 'inspections';
    const firstClass = teacher.role === 'admin' ? state.classes[0] : teacherClasses(teacher.id)[0];
    state.selectedSetupClassId = firstClass?.id || '';
    state.assigningClassId = firstClass?.id || '';
    state.selectedInspectionClassId = firstClass?.id || '';
    state.quickClassId = firstClass?.id || '';
    state.reportClassId = '';
    
    if (teacher.role === 'admin') {
      window.localStorage?.setItem(ADMIN_SESSION_KEY, JSON.stringify(teacher));
      state.portal = 'admin';
      state.view = 'teachersAdmin';
    } else {
      window.localStorage?.setItem(TEACHER_SESSION_KEY, JSON.stringify(teacher));
      window.localStorage?.setItem(LAST_TEACHER_ID_KEY, teacher.id);
      state.portal = 'teacher';
      state.view = 'inspections';
    }
    state.pin = '';
    render();
  }

  // 학생 포털 로그인 및 등록 처리
  async function handleStudentLogin() {
    const form = state.studentLoginForm;
    if (!form.studentId) return showModalAlert('학생을 선택해 주세요.');
    const student = studentById(form.studentId);
    if (!student) return showModalAlert('학생 정보를 찾을 수 없습니다.');

    if (student.pinLocked) {
      return showModalAlert('비밀번호 오류 횟수 초과로 계정이 잠겼습니다. 선생님께 문의하세요.');
    }

    const inputPin = String(form.pin || '').replace(/\D/g, '').trim();
    if (inputPin !== String(student.pin || '1234')) {
      const failedCount = (student.pinFailedCount || 0) + 1;
      const remains = 5 - failedCount;
      if (failedCount >= 5) {
        await updateDoc(doc(db, COLLECTION_NAMES.students, student.id), {
          pinFailedCount: failedCount,
          pinLocked: true,
          updatedAt: serverTimestamp()
        });
        return showModalAlert('비밀번호 5회 오류로 로그인 계정이 잠겼습니다. 담당 선생님께 해제를 요청해 주세요.');
      } else {
        await updateDoc(doc(db, COLLECTION_NAMES.students, student.id), {
          pinFailedCount: failedCount,
          updatedAt: serverTimestamp()
        });
        return showModalAlert(`PIN 번호가 올바르지 않습니다. (오류 횟수: ${failedCount}/5회, 남은 횟수: ${remains}회)`);
      }
    }

    // 로그인 성공 시
    await updateDoc(doc(db, COLLECTION_NAMES.students, student.id), {
      pinFailedCount: 0,
      pinLocked: false,
      updatedAt: serverTimestamp()
    });
    
    state.studentSession = student;
    state.portal = 'student';
    state.view = 'studentPortal';
    state.selectedStudentBookFilter = '';
    state.selectedStudentRubricBookId = '';
    state.studentLoginForm = rememberStudentLoginForm(student, form);
    notify('학생 대시보드 로그인 성공!');
    render();
  }

  // 학생 등록(신청) 처리
  async function handleStudentRegister() {
    const form = state.studentLoginForm;
    if (!form.classId || !form.name.trim()) {
      return showModalAlert('반 이름과 본인 이름을 입력해 주세요.');
    }
    const cleanName = form.name.trim();
    const cleanSchool = form.school.trim();
    const klass = classById(form.classId);
    if (!klass) return showModalAlert('유효한 반이 아닙니다.');

    if (findDuplicateStudentName(form.classId, cleanName, cleanSchool)) {
      return showModalAlert('이미 반에 등록된 동일한 이름과 학교의 학생이 있습니다.');
    }
    if (findPendingStudentRequest(form.classId, cleanName, cleanSchool)) {
      return showModalAlert('이미 관리자 승인 대기 중인 신규생 등록 요청이 있습니다.');
    }

    const regPin = String(form.pin || '').replace(/\D/g, '').trim();
    if (!/^\d{4}$/.test(regPin)) {
      return showModalAlert('초기 PIN은 4자리 숫자로 입력해야 합니다.');
    }

    await addDoc(refs.studentRequests, {
      name: cleanName,
      school: cleanSchool,
      grade: klass.grade,
      classId: form.classId,
      pin: regPin,
      status: 'pending',
      createdAt: serverTimestamp()
    });

    await showModalAlert('신규생 등록 요청이 접수되었습니다. 관리자 승인 후 설정한 4자리 PIN으로 로그인할 수 있습니다.');
    state.loginStep = 'login';
    state.studentLoginForm.pin = '';
    render();
  }

  function resetSetupForm() {
    state.setupFormClass = { name: '', grade: '', teacherId: '', note: '' };
  }
  async function saveClass() {
    const f = state.setupFormClass;
    if (!f.name || !f.teacherId || !f.grade) return showModalAlert('반 이름, 학년, 담당 강사를 입력해주세요.');
    
    if (f.id) {
      await updateDoc(doc(refs.classes, f.id), { name: f.name, teacherId: f.teacherId, grade: f.grade, note: '' });
      state.selectedSetupClassId = f.id;
      notify('반 수정 완료');
    } else {
      const ref = await addDoc(refs.classes, { name: f.name, teacherId: f.teacherId, grade: f.grade, note: '', active: true, createdAt: serverTimestamp() });
      state.selectedSetupClassId = ref.id;
      state.assigningClassId = ref.id;
      state.selectedInspectionClassId = ref.id;
      state.quickClassId = ref.id;
      state.reportClassId = ref.id;
      notify('반 생성 완료');
    }
    
    resetSetupForm();
    if (state.wizardOpen) state.wizardStep = 2;
    notify('반 생성 완료');
    render();
  }

  function parseStudentBulkText(text, mode) {
    return String(text || '').split('\n').map(line => line.trim()).filter(Boolean).map(line => {
      if (mode === 'nameOnly') return { name: line, school: '' };
      const parts = line.split('/').map(v => v.trim());
      return { name: parts[0] || '', school: parts[1] || '' };
    }).filter(item => item.name);
  }

  async function saveStudentsBulk() {
    const classId = state.selectedSetupClassId;
    const klass = classById(classId);
    if (!klass) return showModalAlert('먼저 반을 선택하거나 생성해주세요.');
    const liveBulkText = [...document.querySelectorAll('#wizardStudentBulkText')].map(el => el.value || '').find(v => String(v).trim()) || state.studentBulkText || '';
    const rawText = String(liveBulkText || '').trim();
    if (!rawText) return showModalAlert('학생 명단을 입력해주세요.');
    state.studentBulkText = rawText;
    const rows = parseStudentBulkText(rawText, state.studentBulkMode).filter(row => String(row.name || '').trim());
    if (!rows.length) return showModalAlert('입력 형식을 확인해주세요. (예: 홍길동 / 학교)');
    const batch = writeBatch(db);
    let addCount = 0;
    rows.forEach(row => {
      const cleanName = String(row.name || '').trim();
      const cleanSchool = String(row.school || '').trim();
      if (!cleanName) return;
      if (findDuplicateStudentName(classId, cleanName, cleanSchool)) return;
      const newRef = doc(refs.students);
      batch.set(newRef, { 
        name: cleanName, 
        school: cleanSchool, 
        grade: klass.grade, 
        classId, 
        active: true,
        status: 'active',
        studentProfileId: newRef.id,
        pin: '1234', 
        pinFailedCount: 0, 
        pinLocked: false, 
        createdAt: serverTimestamp() 
      });
      addCount++;
    });
    if (!addCount) return showModalAlert('추가할 학생이 없습니다.');
    await batch.commit();
    state.studentBulkText = '';
    if (state.wizardOpen) state.wizardStep = 3;
    notify(`학생 ${addCount}명 등록 완료`);
    render();
  }

  async function removeStudent(studentId) {
    const s = studentById(studentId);
    if (!s) return;
    const ok = await showModalConfirm(`정말로 '${s.name}' 학생을 삭제하시겠습니까?`);
    if (!ok) return;
    await updateDoc(doc(db, COLLECTION_NAMES.students, studentId), { active: false, updatedAt: serverTimestamp() });
    notify('학생 삭제 완료');
  }

  async function approveStudentRequest(requestId) {
    const req = state.studentRequests.find(item => item.id === requestId);
    if (!req) return showModalAlert('신규생 요청 정보를 찾을 수 없습니다.');
    if (!req.classId || !req.name) return showModalAlert('요청에 반 또는 이름 정보가 부족합니다.');
    const klass = classById(req.classId);
    if (!klass) return showModalAlert('요청한 반 정보를 찾을 수 없습니다.');

    const studentRef = doc(refs.students);
    await setDoc(studentRef, {
      name: String(req.name || '').trim(),
      school: String(req.school || '').trim(),
      grade: req.grade || klass.grade || '',
      classId: req.classId,
      active: true,
      status: 'active',
      studentProfileId: studentRef.id,
      pin: String(req.pin || '1234').replace(/\D/g, '').slice(0, 4) || '1234',
      pinFailedCount: 0,
      pinLocked: false,
      createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, COLLECTION_NAMES.studentRequests, requestId), {
      status: 'approved',
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    notify('신규생 등록 요청을 승인했습니다.');
  }

  async function rejectStudentRequest(requestId) {
    await updateDoc(doc(db, COLLECTION_NAMES.studentRequests, requestId), {
      status: 'rejected',
      updatedAt: serverTimestamp()
    });
    notify('신규생 등록 요청을 보류/거절 처리했습니다.');
  }

  async function updateAdminStudentClass(studentId) {
    const classId = document.getElementById(`adminStudentClass-${studentId}`)?.value || '';
    const klass = classById(classId);
    if (!klass) return showModalAlert('이동할 반을 선택해주세요.');
    await updateDoc(doc(db, COLLECTION_NAMES.students, studentId), {
      classId,
      grade: klass.grade || '',
      active: true,
      status: 'active',
      updatedAt: serverTimestamp()
    });
    notify('학생 소속 반을 수정했습니다.');
  }

  async function updateAdminStudentPin(studentId) {
    const input = document.getElementById(`adminStudentPin-${studentId}`);
    const nextPin = String(input?.value || '').replace(/\D/g, '').slice(0, 4);
    if (input) input.value = nextPin;
    await updateStudentPin(studentId, nextPin);
  }

  async function withdrawAdminStudent(studentId) {
    const student = (state.allStudents || state.students).find(s => s.id === studentId);
    if (!student) return showModalAlert('학생 정보를 찾을 수 없습니다.');
    const ok = await showModalConfirm(`${student.name} 학생을 퇴원 처리할까요?\n퇴원 처리된 학생은 3개월 후 삭제 예정 대상으로 표시됩니다.`);
    if (!ok) return;
    const withdrawnAt = new Date();
    await updateDoc(doc(db, COLLECTION_NAMES.students, studentId), {
      active: false,
      status: 'withdrawn',
      withdrawnAt,
      deleteAfter: calculateStudentDeleteAfter(withdrawnAt),
      updatedAt: serverTimestamp()
    });
    state.selectedAdminStudentIds = state.selectedAdminStudentIds.filter(id => id !== studentId);
    notify('학생을 퇴원 처리했습니다.');
  }

  async function deleteAdminStudent(studentId) {
    const student = (state.allStudents || state.students).find(s => s.id === studentId);
    if (!student) return showModalAlert('학생 정보를 찾을 수 없습니다.');
    const ok = await showModalConfirm(`${student.name} 학생 데이터를 삭제 표시할까요?\n점검 기록은 보존되며 학생 계정만 숨겨집니다.`);
    if (!ok) return;
    await updateDoc(doc(db, COLLECTION_NAMES.students, studentId), {
      active: false,
      deleted: true,
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    state.selectedAdminStudentIds = state.selectedAdminStudentIds.filter(id => id !== studentId);
    notify('학생 데이터를 삭제 표시했습니다.');
  }

  async function runPromotionClone() {
    const ids = state.selectedAdminStudentIds || [];
    if (!ids.length) return showModalAlert('승급 복제할 학생을 먼저 선택해주세요.');
    const grade = state.adminPromotionGrade || '';
    const classId = state.adminPromotionClassId || '';
    const klass = classById(classId);
    if (!grade) return showModalAlert('새 학년을 선택해주세요.');
    if (!klass) return showModalAlert('새 반을 선택해주세요.');
    const targetKeys = new Set();
    const duplicatedTargets = [];
    ids.forEach(studentId => {
      const student = (state.allStudents || state.students).find(s => s.id === studentId);
      if (!student) return;
      const key = `${classId}__${String(student.name || '').trim()}__${String(student.school || '').trim()}`;
      const existing = state.students.find(s =>
        s.id !== studentId &&
        s.classId === classId &&
        String(s.name || '').trim() === String(student.name || '').trim() &&
        String(s.school || '').trim() === String(student.school || '').trim() &&
        s.active !== false
      );
      if (targetKeys.has(key) || existing) duplicatedTargets.push(student.name || '이름 없음');
      targetKeys.add(key);
    });
    if (duplicatedTargets.length) {
      return showModalAlert(`새 반에 이미 같은 학생이 있거나 선택 목록 안에 중복이 있습니다.\n확인 필요: ${duplicatedTargets.join(', ')}`);
    }
    const ok = await showModalConfirm(`선택한 학생 ${ids.length}명을 ${grade} / ${klass.name} 학생으로 복제 생성할까요?\n기존 학생과 점검 기록은 보존됩니다.`);
    if (!ok) return;

    const batch = writeBatch(db);
    ids.forEach(studentId => {
      const student = (state.allStudents || state.students).find(s => s.id === studentId);
      if (!student) return;
      const profileId = student.studentProfileId || student.id;
      const newRef = doc(refs.students);
      batch.update(doc(db, COLLECTION_NAMES.students, studentId), {
        active: false,
        status: 'promoted',
        studentProfileId: profileId,
        promotedToStudentId: newRef.id,
        promotedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      batch.set(newRef, {
        name: student.name || '',
        school: student.school || '',
        grade,
        classId,
        active: true,
        status: 'active',
        studentProfileId: profileId,
        previousStudentId: student.id,
        pin: student.pin || '1234',
        pinFailedCount: 0,
        pinLocked: false,
        createdAt: serverTimestamp()
      });
    });
    await batch.commit();
    state.selectedAdminStudentIds = [];
    notify(`학생 ${ids.length}명을 승급 복제했습니다.`);
  }

  async function purgeDueWithdrawnStudents() {
    const dueStudents = studentsDueForDeletion(state.allStudents || []);
    if (!dueStudents.length) return showModalAlert('현재 삭제 예정일이 지난 퇴원 학생이 없습니다.');
    const ok = await showModalConfirm(`삭제 예정일이 지난 퇴원 학생 ${dueStudents.length}명을 삭제 표시할까요?`);
    if (!ok) return;
    const batch = writeBatch(db);
    dueStudents.forEach(student => {
      batch.update(doc(db, COLLECTION_NAMES.students, student.id), {
        active: false,
        deleted: true,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });
    await batch.commit();
    notify(`퇴원 학생 ${dueStudents.length}명을 삭제 표시했습니다.`);
  }

  async function saveBook() {
    const f = state.formBook;
    if (!f.subject) return showModalAlert('수학 교과목을 선택해주세요.');
    const titleBase = stripBookSubjectFromTitle(f.subject, f.title);
    if (!titleBase) return showModalAlert('교재명을 입력해주세요.');
    const payload = {
      ...f,
      title: composeBookTitle(f.subject, titleBase),
      publisher: '',
      bookType: f.bookType || 'standard',
      chapterCount: f.bookType === 'exam_chapter'
        ? Math.max(1, Math.min(40, Number(f.chapterCount || 10) || 10))
        : ''
    };
    if (state.editingBookId) {
      await updateDoc(doc(db, COLLECTION_NAMES.books, state.editingBookId), { ...payload, updatedAt: serverTimestamp() });
      state.editingBookId = '';
    } else {
      await addDoc(refs.books, { ...payload, units: [], archived: false, createdAt: serverTimestamp() });
    }
    state.formBook = { title: '', subject: '', grade: '', publisher: '', active: true, bookType: 'standard', chapterCount: '10' };
    notify('교재 저장 완료');
  }

  async function cloneBook(bookId) {
    const source = bookById(bookId);
    if (!source) return;
    await addDoc(refs.books, { title: source.title + ' 복제본', subject: source.subject, grade: source.grade, publisher: '', active: true, archived: false, units: (source.units || []).map(u => ({ ...u, id: uid() })), createdAt: serverTimestamp() });
    notify('교재 복제 완료');
  }

  async function saveUnit() {
    try {
      const book = bookById(state.selectedBookManageId);
      if (!book) return showModalAlert('교재를 먼저 선택해주세요.');
      const currentUnits = rawBookUnits(book);
      if (book.bookType === 'exam_chapter') {
        const rows = [...appRoot.querySelectorAll('[data-exam-chapter-row]')].map(row => ({
          chapterName: row.querySelector('[data-field="chapterName"]')?.value.trim() || '',
          startText: row.querySelector('[data-field="start"]')?.value.trim() || '',
          endText: row.querySelector('[data-field="end"]')?.value.trim() || '',
          standardUnitIds: [...row.querySelectorAll('[data-field="chapterStandardUnit"]:checked')].map(input => input.value).filter(Boolean)
        }));
        const units = [];

        for (let index = 0; index < rows.length; index++) {
          const row = rows[index];
          const defaultName = `챕터 ${index + 1}`;
          const hasInput = row.startText || row.endText || row.standardUnitIds.length || (row.chapterName && row.chapterName.trim() !== defaultName);
          if (!hasInput) continue;
          const name = row.chapterName || defaultName;
          const start = Number(row.startText);
          const end = Number(row.endText);
          if (!row.startText || !row.endText || Number.isNaN(start) || Number.isNaN(end) || start < 1 || end < start) {
            return showModalAlert(`"${name}"의 시작쪽과 끝쪽을 올바르게 입력해주세요.`);
          }
          if (!row.standardUnitIds.length) {
            return showModalAlert(`"${name}"에 연결할 시험범위 표준소단원을 하나 이상 선택해주세요.`);
          }
          const existing = currentUnits.find(unit => String(unit.name || '') === name);
          units.push({
            id: existing?.id || uid(),
            name,
            standardUnitIds: row.standardUnitIds,
            start,
            end,
            color: existing?.color || pastel(index),
            visibleToStudent: existing?.visibleToStudent !== false
          });
        }

        if (!units.length) return showModalAlert('저장할 챕터 정보를 입력해주세요.');
        const sortedUnits = [...units].sort((a, b) => Number(a.start) - Number(b.start));
        for (let i = 1; i < sortedUnits.length; i++) {
          if (Number(sortedUnits[i - 1].end) >= Number(sortedUnits[i].start)) {
            return showModalAlert(`"${sortedUnits[i - 1].name}" 챕터와 "${sortedUnits[i].name}" 챕터의 페이지가 겹칩니다.`);
          }
        }

        await updateDoc(doc(db, COLLECTION_NAMES.books, book.id), { units, updatedAt: serverTimestamp() });
        state.tempBookUnits = null;
        notify('시험대비 챕터표 저장 완료');
        return;
      }
      const rows = [...appRoot.querySelectorAll('[data-standard-unit-row]')].map(row => ({
        standardUnitId: row.dataset.standardUnitId,
        standardLabel: row.dataset.standardLabel || '',
        unitName: row.querySelector('[data-field="unitName"]')?.value.trim() || '',
        startText: row.querySelector('[data-field="start"]')?.value.trim() || '',
        endText: row.querySelector('[data-field="end"]')?.value.trim() || ''
      }));
      const groups = [];
      let currentGroup = null;

      const flushGroup = () => {
        if (!currentGroup) return;
        groups.push(currentGroup);
        currentGroup = null;
      };

      for (const row of rows) {
        const hasInput = row.unitName || row.startText || row.endText;
        if (!hasInput) {
          flushGroup();
          continue;
        }
        if (!row.unitName) return showModalAlert('입력한 행에는 소단원명을 모두 적어주세요.');
        if (!currentGroup || currentGroup.name !== row.unitName) {
          flushGroup();
          currentGroup = { name: row.unitName, rows: [] };
        }
        currentGroup.rows.push(row);
      }
      flushGroup();

      if (!groups.length) return showModalAlert('저장할 단원 정보를 입력해주세요.');

      const units = [];
      for (let index = 0; index < groups.length; index++) {
        const group = groups[index];
        const startText = group.rows.find(row => row.startText)?.startText || '';
        const endText = [...group.rows].reverse().find(row => row.endText)?.endText || '';
        const start = Number(startText);
        const end = Number(endText);
        if (!startText || !endText || Number.isNaN(start) || Number.isNaN(end)) {
          return showModalAlert(`"${group.name}" 단원의 시작쪽과 끝쪽을 입력해주세요.`);
        }
        if (start < 1 || end < start) {
          return showModalAlert(`"${group.name}" 단원의 페이지 범위를 확인해주세요.`);
        }
        const standardUnitIds = group.rows.map(row => row.standardUnitId).filter(Boolean);
        const existing = currentUnits.find(unit => {
          const prevIds = unit.standardUnitIds || [];
          return prevIds.length === standardUnitIds.length && prevIds.every((id, idx) => id === standardUnitIds[idx]);
        });
        units.push({
          id: existing?.id || uid(),
          name: group.name,
          standardUnitIds,
          start,
          end,
          color: existing?.color || pastel(index),
          visibleToStudent: existing?.visibleToStudent !== false
        });
      }

      const sortedUnits = [...units].sort((a, b) => Number(a.start) - Number(b.start));
      for (let i = 1; i < sortedUnits.length; i++) {
        if (Number(sortedUnits[i - 1].end) >= Number(sortedUnits[i].start)) {
          return showModalAlert(`"${sortedUnits[i - 1].name}" 단원과 "${sortedUnits[i].name}" 단원의 페이지가 겹칩니다.`);
        }
      }

      await updateDoc(doc(db, COLLECTION_NAMES.books, book.id), { units, updatedAt: serverTimestamp() });
      state.formUnit = { name: '', start: '', end: '', standardUnitIds: [] };
      state.tempBookUnits = null;
      notify('단원 표 저장 완료');
    } catch (error) {
      console.error(error);
      showModalAlert('저장 중 오류가 발생했습니다: ' + error.message);
    }
  }

  async function toggleUnitStudentVisible(bookId, unitId) {
    const book = bookById(bookId);
    if (!book) return showModalAlert('교재 정보를 찾을 수 없습니다.');
    const units = rawBookUnits(book).map(unit => {
      if (unit.id !== unitId) return unit;
      return {
        ...unit,
        visibleToStudent: unit.visibleToStudent === false
      };
    });
    await updateDoc(doc(db, COLLECTION_NAMES.books, book.id), { units, updatedAt: serverTimestamp() });
    notify('학생 화면 단원 공개 설정을 변경했습니다.');
  }

  async function saveUnitBulk() {
    try {
      const book = bookById(state.selectedBookManageId);
      if (!book) return showModalAlert('교재를 먼저 선택해주세요.');
      const lines = String(state.bulkUnitText || '').split('\n').map(v => v.trim()).filter(Boolean);
      if (!lines.length) return showModalAlert('붙여넣기 단원 텍스트를 입력해주세요.');
      const next = [...rawBookUnits(book)];
      for (const line of lines) {
        const [name, s, e] = line.split('/').map(v => v.trim());
        const start = Number(s), end = Number(e);
        if (!name || isNaN(start) || isNaN(end) || end < start) continue;
        const overlap = next.some(u => !(Number(u.end) < start || Number(u.start) > end));
        if (overlap) continue;
        next.push({ id: uid(), name, start, end, color: pastel(next.length), visibleToStudent: true });
      }
      await updateDoc(doc(db, COLLECTION_NAMES.books, book.id), { units: next, updatedAt: serverTimestamp() });
      state.bulkUnitText = '';
      notify('붙여넣기 단원 반영 완료');
    } catch (error) {
      console.error(error);
      showModalAlert('붙여넣기 저장 중 오류가 발생했습니다: ' + error.message);
    }
  }

  async function toggleArchiveBook(bookId, archived) {
    await updateDoc(doc(db, COLLECTION_NAMES.books, bookId), { archived: !archived, updatedAt: serverTimestamp() });
    notify(archived ? '교재 복구 완료' : '교재 보관 완료');
  }

  async function assignBook(classId, bookId) {
    if (!classId || !bookId) return showModalAlert('반과 교재를 선택해주세요.');
    const exists = state.classBooks.find(x => x.classId === classId && x.bookId === bookId && x.active !== false && classBookStatus(x) === 'active');
    if (exists) return showModalAlert('이미 진행 중인 교재입니다.');
    const completed = state.classBooks.find(x => x.classId === classId && x.bookId === bookId && x.active !== false && classBookStatus(x) === 'completed');
    if (completed) return showModalAlert('이미 완료 이력에 있는 교재입니다. 아래 완료된 교재 이력에서 다시 진행을 눌러주세요.');
    const order = assignedBooksForClass(classId).length + 1;
    await addDoc(refs.classBooks, { classId, bookId, order, main: order === 1, active: true, status: 'active', createdAt: serverTimestamp() });
    notify('반별 교재 배정 완료');
    render();
  }

  async function completeAssign(linkId) {
    const ok = await showModalConfirm('이 반에서 해당 교재를 진행 종료할까요?\n학생 화면과 점검 선택 목록에서는 숨겨지고, 기존 점검 기록은 유지됩니다.', '교재 진행 종료');
    if (!ok) return;
    await updateDoc(doc(db, COLLECTION_NAMES.classBooks, linkId), { status: 'completed', completedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    notify('교재 진행 종료 완료');
  }

  async function reactivateAssign(linkId) {
    const link = state.classBooks.find(x => x.id === linkId);
    if (!link) return;
    const activeDuplicate = state.classBooks.find(x => x.id !== linkId && x.classId === link.classId && x.bookId === link.bookId && x.active !== false && classBookStatus(x) === 'active');
    if (activeDuplicate) return showModalAlert('이미 같은 교재가 진행 중입니다.');
    const order = assignedBooksForClass(link.classId).length + 1;
    await updateDoc(doc(db, COLLECTION_NAMES.classBooks, linkId), { status: 'active', order, main: order === 1, completedAt: null, updatedAt: serverTimestamp() });
    notify('완료 교재를 다시 진행 중으로 전환했습니다.');
  }

  async function removeAssign(linkId) {
    const ok = await showModalConfirm('이 반과 교재의 연결을 삭제하시겠습니까?\n점검 기록은 삭제되지 않지만, 완료 이력 목록에서도 사라집니다.', '교재 연결 삭제');
    if (!ok) return;
    await updateDoc(doc(db, COLLECTION_NAMES.classBooks, linkId), { active: false, updatedAt: serverTimestamp() });
    notify('교재 연결 삭제 완료');
  }

  async function moveAssign(linkId, dir) {
    const link = state.classBooks.find(x => x.id === linkId);
    if (!link) return;
    const list = assignedBooksForClass(link.classId);
    const idx = list.findIndex(x => x.link.id === linkId);
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || targetIdx < 0 || targetIdx >= list.length) return;
    const currentOrder = list[idx].link.order;
    const targetOrder = list[targetIdx].link.order;
    const batch = writeBatch(db);
    batch.update(doc(db, COLLECTION_NAMES.classBooks, list[idx].link.id), { order: targetOrder, updatedAt: serverTimestamp() });
    batch.update(doc(db, COLLECTION_NAMES.classBooks, list[targetIdx].link.id), { order: currentOrder, updatedAt: serverTimestamp() });
    await batch.commit();
  }

  function normalizePagesText(pages) {
    return [...new Set(parseMissedPages(pages))].sort((a, b) => a - b).join(',');
  }
  function missedPagesArrayInCurrentRange() {
    return filterMissedPagesToRange(state.missedPages, state.selectedRangeStart, state.selectedRangeEnd);
  }
  function toggleMissedPage(page) {
    const set = new Set(parseMissedPages(state.missedPages));
    if (set.has(page)) set.delete(page); else set.add(page);
    state.missedPages = [...set].sort((a, b) => a - b).join(',');
    
    // 포커스를 보존하기 위해 전체 render() 대신 부분 미세 갱신을 실행한다.
    const missedPagesEl = document.getElementById('missedPages');
    if (missedPagesEl) {
      missedPagesEl.value = state.missedPages;
    }
    updateMissedPagesFromText();
  }
  function appendRemark(text) {
    const current = String(state.memo || '').trim();
    state.memo = current ? `${current}\n${text}` : text;
    render();
  }
  function currentCarryoverRows(excludeInspectionId = state.editingInspectionId) {
    return buildCarryoverRows({
      inspections: state.inspections,
      studentId: state.selectedInspectionStudentId,
      bookId: state.selectedInspectionBookId,
      editingInspectionId: excludeInspectionId,
      currentDate: state.selectedDate
    });
  }
  function selectedCarryoverKeysSet() {
    return new Set(state.selectedCarryoverResolutionKeys || []);
  }
  function resetRubricScores() {
    state.rubricScores = normalizeRubricScores({});
  }
  function updatePageChecksDOM() {
    const startVal = document.getElementById('selectedRangeStart')?.value || '';
    const endVal = document.getElementById('selectedRangeEnd')?.value || '';
    state.selectedRangeStart = startVal;
    state.selectedRangeEnd = endVal;

    const start = Number(startVal);
    const end = Number(endVal);

    const wrapper = document.getElementById('pageChecksWrapper');
    const unitsContainer = document.getElementById('analysisUnitsContainer');
    const completionContainer = document.getElementById('analysisCompletionContainer');

    const isValid = !isNaN(start) && !isNaN(end) && startVal.trim() !== '' && endVal.trim() !== '' && start <= end && (end - start + 1 <= 1000);

    if (!isValid) {
      if (wrapper) {
        wrapper.innerHTML = `
          <div class="mt-4 rounded-2xl border border-dashed border-slate-800 bg-slate-950/20 p-5 text-xs text-slate-500 text-center">
            시작 페이지와 끝 페이지를 입력하면 체크박스처럼 선택할 수 있습니다.
          </div>
        `;
      }
      if (unitsContainer) {
        unitsContainer.innerHTML = '<span class="text-xs text-slate-500">단원이 아직 표시되지 않았습니다.</span>';
      }
      if (completionContainer) {
        completionContainer.innerHTML = `
          <div class="flex items-center justify-between gap-3">
            <div class="text-xs font-bold text-slate-300">이번 회차 완료율</div>
            <div class="text-xs font-black text-blue-400">0%</div>
          </div>
          <div class="book-track mt-3 w-full h-2 rounded-full overflow-hidden">
            <div class="completed-seg h-full bg-blue-500" style="width:0%"></div>
          </div>
          <div class="book-track mt-2 w-full h-2 rounded-full overflow-hidden">
            <div class="incomplete-seg h-full bg-rose-500/30" style="width:100%"></div>
          </div>
          <div class="mt-3 text-[10px] text-slate-500 leading-normal">
            이번 범위 0쪽 중 미완료 0쪽 &middot; 나머지는 자동 완료 처리됩니다.
          </div>
        `;
      }
      return;
    }

    const total = pagesInRange(start, end);
    const missed = missedPagesArrayInCurrentRange();
    const missedSet = new Set(missed);
    const donePct = total.length ? Math.round(((total.length - missed.length) / total.length) * 100) : 0;

    if (wrapper) {
      wrapper.innerHTML = `
        <div class="mt-4 rounded-2xl border border-blue-500/20 bg-slate-900/40 p-4">
          <div class="flex items-center justify-between gap-3 mb-3">
            <div>
              <div class="text-xs font-extrabold text-slate-200">이번 회차 미완료 페이지 체크</div>
              <div class="text-[10px] text-slate-500 mt-0.5">이번 범위에서 아직 완료하지 못한 페이지만 선택합니다. 다시 누르면 해제됩니다.</div>
            </div>
            <button type="button" data-action="clear-missed-pages" class="ghost-button px-2.5 py-1.5 rounded-lg text-[10px] font-black">체크 초기화</button>
          </div>
          <div class="flex flex-wrap gap-1.5">
            ${total.map(p=>`<button type="button" data-action="toggle-missed-page" data-page="${p}" class="min-w-8 h-8 rounded-lg border text-xs font-black transition ${missedSet.has(p) ? 'bg-rose-500/80 border-rose-500 text-white shadow-sm' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-blue-500 hover:text-white'}">${p}</button>`).join('')}
          </div>
        </div>
      `;

      wrapper.querySelector('[data-action="clear-missed-pages"]')?.addEventListener('click', () => {
        state.missedPages = '';
        const missedPagesEl = document.getElementById('missedPages');
        if (missedPagesEl) {
          missedPagesEl.value = '';
        }
        updateMissedPagesFromText();
      });

      wrapper.querySelectorAll('[data-action="toggle-missed-page"]').forEach(el => {
        el.onclick = () => toggleMissedPage(Number(el.dataset.page));
      });
    }

    if (unitsContainer) {
      const selectedBook = bookById(state.selectedInspectionBookId);
      const units = selectedBook ? unitsForRange(selectedBook, start, end) : [];
      unitsContainer.innerHTML = units.length ? units.map((u)=>`<span class="unit-chip text-[10px] py-1 px-2.5 font-bold" style="background:${safe(u.color)}; color:${unitChipTextColor(u.color)}; border:1px solid rgba(255,255,255,0.18);">${safe(u.name)} (${u.start}~${u.end})</span>`).join('') : '<span class="text-xs text-slate-500">단원이 아직 표시되지 않았습니다.</span>';
    }

    if (completionContainer) {
      completionContainer.innerHTML = `
        <div class="flex items-center justify-between gap-3">
          <div class="text-xs font-bold text-slate-300">이번 회차 완료율</div>
          <div class="text-xs font-black text-blue-400">${donePct}%</div>
        </div>
        
        <div class="book-track mt-3 w-full h-2 rounded-full overflow-hidden">
          <div class="completed-seg h-full bg-blue-500" style="width:${donePct}%"></div>
        </div>
        
        <div class="book-track mt-2 w-full h-2 rounded-full overflow-hidden">
          <div class="incomplete-seg h-full bg-rose-500/30" style="width:${100-donePct}%"></div>
        </div>
        
        <div class="mt-3 text-[10px] text-slate-500 leading-normal">
          이번 범위 ${total.length}쪽 중 미완료 ${missed.length}쪽 &middot; 나머지는 자동 완료 처리됩니다.
        </div>
      `;
    }
  }
  function updateMissedPagesFromText() {
    const startVal = document.getElementById('selectedRangeStart')?.value || '';
    const endVal = document.getElementById('selectedRangeEnd')?.value || '';
    const start = Number(startVal);
    const end = Number(endVal);

    const isValid = !isNaN(start) && !isNaN(end) && startVal.trim() !== '' && endVal.trim() !== '' && start <= end && (end - start + 1 <= 1000);
    if (!isValid) return;

    const currentRangeMissed = filterMissedPagesToRange(state.missedPages, start, end);
    const currentRangeMissedSet = new Set(currentRangeMissed);

    const buttons = document.querySelectorAll('#pageChecksWrapper button[data-action="toggle-missed-page"]');
    buttons.forEach(btn => {
      const p = Number(btn.dataset.page);
      if (currentRangeMissedSet.has(p)) {
        btn.className = "min-w-8 h-8 rounded-lg border text-xs font-black transition bg-rose-500/80 border-rose-500 text-white shadow-sm";
      } else {
        btn.className = "min-w-8 h-8 rounded-lg border text-xs font-black transition bg-slate-950 border-slate-800 text-slate-400 hover:border-blue-500 hover:text-white";
      }
    });

    const total = pagesInRange(start, end);
    const donePct = total.length ? Math.round(((total.length - currentRangeMissed.length) / total.length) * 100) : 0;

    const completionContainer = document.getElementById('analysisCompletionContainer');
    if (completionContainer) {
      completionContainer.innerHTML = `
        <div class="flex items-center justify-between gap-3">
          <div class="text-xs font-bold text-slate-300">이번 회차 완료율</div>
          <div class="text-xs font-black text-blue-400">${donePct}%</div>
        </div>
        
        <div class="book-track mt-3 w-full h-2 rounded-full overflow-hidden">
          <div class="completed-seg h-full bg-blue-500" style="width:${donePct}%"></div>
        </div>
        
        <div class="book-track mt-2 w-full h-2 rounded-full overflow-hidden">
          <div class="incomplete-seg h-full bg-rose-500/30" style="width:${100-donePct}%"></div>
        </div>
        
        <div class="mt-3 text-[10px] text-slate-500 leading-normal">
          이번 범위 ${total.length}쪽 중 미완료 ${currentRangeMissed.length}쪽 &middot; 나머지는 자동 완료 처리됩니다.
        </div>
      `;
    }
  }
  function resetInspectionForm() {
    state.missedPages = '';
    state.memo = '';
    state.editingInspectionId = '';
    resetRubricScores();
    state.selectedCarryoverResolutionKeys = [];
  }

  async function saveInspection() {
    const student = studentById(state.selectedInspectionStudentId);
    const book = bookById(state.selectedInspectionBookId);
    if (!student || !book) return showModalAlert('학생과 교재를 선택해주세요.');
    const start = Number(state.selectedRangeStart), end = Number(state.selectedRangeEnd);
    if (isNaN(start) || isNaN(end) || end < start) return showModalAlert('검사 범위를 입력해주세요.');
    const total = pagesInRange(start, end);
    const missedPages = missedPagesArrayInCurrentRange();
    const completionRate = calculateCompletionRate(total, missedPages);
    const rangeUnits = unitsForRange(book, start, end);
    const units = rangeUnits.map(u => displayUnitName(u));
    const standardUnitIds = [...new Set(rangeUnits.flatMap(u => u.standardUnitIds || []))];
    const duplicate = state.inspections.find(r => r.id !== state.editingInspectionId && r.studentId === student.id && r.bookId === book.id && r.date === state.selectedDate && Number(r.rangeStart) === start && Number(r.rangeEnd) === end);
    if (duplicate) {
      const ok = await showModalConfirm('같은 학생/교재/날짜/범위의 점검 기록이 이미 있습니다. 기존 기록을 수정으로 덮어쓸까요?\n\n취소하면 저장하지 않습니다.');
      if (!ok) return;
    }

    const targetInspectionId = duplicate?.id || state.editingInspectionId;
    const carryoverRows = currentCarryoverRows(targetInspectionId);
    const selectedCarryoverKeys = [...selectedCarryoverKeysSet()];
    const carryoverResolutions = buildCarryoverResolutions(carryoverRows, selectedCarryoverKeys);
    const carryoverRecovery = calculateCarryoverRecoveryRate(carryoverRows, selectedCarryoverKeys);
    const payload = { 
      teacherId: state.currentTeacher.id, 
      teacherName: state.currentTeacher.name, 
      classId: student.classId, 
      studentId: student.id, 
      bookId: book.id, 
      date: state.selectedDate, 
      rangeStart: start, 
      rangeEnd: end, 
      missedPages,
      carryoverResolutions,
      carryoverRecovery,
      completionRate,
      units,
      standardUnitIds,
      memo: state.memo,
      rubricScores: normalizeRubricScores(state.rubricScores),
      updatedAt: serverTimestamp() 
    };
    
    if (duplicate) {
      await updateDoc(doc(db, COLLECTION_NAMES.inspections, duplicate.id), payload);
    } else if (state.editingInspectionId) {
      await updateDoc(doc(db, COLLECTION_NAMES.inspections, state.editingInspectionId), payload);
    } else {
      await addDoc(refs.inspections, { ...payload, createdAt: serverTimestamp() });
    }
    const carryoverSummary = carryoverRecovery.totalPages > 0
      ? `\n지난 미완료 재검 완료: ${carryoverRecovery.resolvedPages}/${carryoverRecovery.totalPages}쪽 (${carryoverRecovery.recoveryRate}%)`
      : '';
    const summary = `${student.name} 학생 점검이 안전하게 저장되었습니다.\n\n교재: ${book.title}\n범위: ${start}~${end}쪽\n미완료: ${missedPages.length ? missedPages.join(', ') : '없음'}${carryoverSummary}\n완료율: ${completionRate}%`;
    resetInspectionForm();
    await showModalAlert(summary, '점검 완료');
    notify('교재 점검 저장 완료');
  }

  function loadInspectionToForm(id) {
    const r = state.inspections.find(x => x.id === id);
    if (!r) return;
    state.editingInspectionId = r.id;
    state.selectedInspectionClassId = r.classId || '';
    state.selectedInspectionStudentId = r.studentId || '';
    state.selectedInspectionBookId = r.bookId || '';
    state.selectedDate = r.date || new Date().toISOString().slice(0, 10);
    state.selectedRangeStart = r.rangeStart ?? '';
    state.selectedRangeEnd = r.rangeEnd ?? '';
    state.missedPages = (r.missedPages || []).join(',');
    state.memo = r.memo || '';
    state.rubricScores = normalizeRubricScores(r.rubricScores || {});
    state.selectedCarryoverResolutionKeys = (r.carryoverResolutions || []).flatMap(resolution => {
      return (resolution.resolvedPages || []).map(page => pageResolutionKey(resolution.sourceInspectionId, page));
    });
    state.view = 'inspections';
    render();

    
    // 로드 후 부드럽게 입력 폼 위치로 스크롤
    setTimeout(() => {
      document.getElementById('inspectionFormArea')?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  }
  async function deleteInspection(id) {
    const r = state.inspections.find(x => x.id === id);
    if (!r) return;
    const ok = await showModalConfirm('이 점검 기록을 완전히 삭제할까요?');
    if (!ok) return;
    await updateDoc(doc(db, COLLECTION_NAMES.inspections, id), { deleted: true, updatedAt: serverTimestamp() });
    if (state.editingInspectionId === id) resetInspectionForm();
    notify('점검 기록 삭제 완료');
  }

  function classProgress(classId) {
    return classProgressRate(classId, state.students, state.inspections);
  }

  function dashboardView() {
    const teacherId = state.dashboardTeacherFilter === 'all' ? null : state.dashboardTeacherFilter;
    const classes = teacherId ? teacherClasses(teacherId) : state.classes;
    const classIds = new Set(classes.map(c => c.id));
    const students = state.students.filter(s => classIds.has(s.classId));
    const studentIds = new Set(students.map(s => s.id));
    const logs = state.inspections.filter(i => studentIds.has(i.studentId));
    const overall = averageCompletionRate(logs);
    const recent = [...logs].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 8);
    const focus = state.dashboardMetricFocus || 'students';

    return renderDashboardView({
      teacherFilter: state.dashboardTeacherFilter,
      teachers: state.teachers,
      classes,
      students,
      logs,
      overall,
      recent,
      focus,
      books: state.books,
      inspections: state.inspections
    }, {
      assignedBooksForClass,
      bookById,
      bookUnits,
      classById,
      classProgress,
      progressTone,
      safe,
      studentById,
      studentsForClass,
      teacherNameById
    });
  }

  function loginScreen() {
    return renderLoginView(state, safe);
  }

  function loginModalMarkup() {
    const accentColor = state.portal === 'admin'
      ? '#8436ff'
      : state.portal === 'student'
      ? '#00d6cd'
      : '#4169e1';
    return renderCustomModalMarkup(state.customModal, safe, accentColor);
  }

  function layout(content) {
    return renderLayoutView({
      content,
      currentView: state.view,
      currentTeacher: state.currentTeacher,
      studentSession: state.studentSession,
      portal: state.portal,
      saveMsg: state.saveMsg,
      customModal: state.customModal
    }, safe);
  }

  function render() {
    if (state.loading) {
      appRoot.innerHTML = `<div class="min-h-screen flex items-center justify-center text-cyan-500 font-bold text-xl">데이터 불러오는 중...</div>`;
      bind();
      return;
    }
    
    // 메인 관문 (gateway) 분기
    if (state.portal === 'gateway') {
      appRoot.innerHTML = loginModalMarkup() + loginScreen();
      bind();
      return;
    }

    // 학생 단독 대시보드 포털 렌더링
    if (state.portal === 'student') {
      if (!state.studentSession) {
        appRoot.innerHTML = loginModalMarkup() + loginScreen();
        bind();
        return;
      }
      const content = renderStudentPortalView(state, {
        inspectionsForStudent: inspectionsForStudentProfile,
        bookById,
        bookUnits,
        averageCompletionRate,
        groupInspectionsByBook,
        fmtDate,
        safe,
        progressTone,
        unitsForRange: unitsForRangeWithStandardNames,
        assignedBooksForClass
      });
      appRoot.innerHTML = layout(content);
      bind();
      return;
    }

    // 교사 및 관리자 포털 렌더링
    if (!state.currentTeacher) {
      appRoot.innerHTML = loginModalMarkup() + loginScreen();
      bind();
      return;
    }

    if (state.view === 'inspections') {
      let container = document.getElementById('react-inspections-root');
      const modalStateChanged = lastModalOpenState !== !!state.customModal?.open;
      lastModalOpenState = !!state.customModal?.open;

      if (!container || modalStateChanged) {
        if (inspectionsReactRoot) {
          try {
            inspectionsReactRoot.unmount();
          } catch (e) {}
          inspectionsReactRoot = null;
        }
        appRoot.innerHTML = layout('<div id="react-inspections-root"></div>');
        bind();
        container = document.getElementById('react-inspections-root');
      }
      
      if (container) {
        if (!inspectionsReactRoot) {
          inspectionsReactRoot = createRoot(container);
        }
        
        const props = {
          state,
          db,
          refs,
          teacherClasses,
          studentsForClass,
          assignedBooksForClass,
          bookById,
          unitsForRange: unitsForRangeWithStandardNames,
          pagesInRange,
          missedPagesArrayInCurrentRange,
          inspectionsForStudent,
          fmtDate,
          classById,
          studentById,
          safe,
          bookUnits,
          buildCarryoverRows,
          calculateCarryoverRecoveryRate,
          pageResolutionKey,
          RUBRIC_ITEMS,
          remarkTemplates: state.remarkTemplates,
          updateLegacyState: (updates) => {
            Object.assign(state, updates);
            render();
          },
          showModalAlert,
          showModalConfirm,
          showModalPrompt
        };
        
        inspectionsReactRoot.render(
          React.createElement(
            React.StrictMode,
            null,
            React.createElement(InspectionsContainer, props)
          )
        );
      }
      return;
    }

    if (inspectionsReactRoot) {
      try {
        inspectionsReactRoot.unmount();
      } catch (e) {
        // 이미 unmount 되었거나 마운트되지 않은 경우의 에러 방지
      }
      inspectionsReactRoot = null;
    }

    if (state.view === 'reports') refreshReportRounds();

    const content = state.view === 'reports'
      ? renderReportsView(state, { teacherClasses, classById, safe })
      : state.view === 'setup'
      ? renderSetupView(state, { 
          teacherClasses, classById, studentsForClass, assignedBooksForClass, 
          bookUnits, teacherNameById, safe, filterByKeyword, 
          existingStudentProfilesForClass, bookById, setupProgress, findDuplicateStudentName 
        })
      : state.view === 'bookSetup'
      ? renderBookSetupView(state, { 
          teacherClasses, classById, assignedBooksForClass, completedBooksForClass,
          bookUnits, safe, filterByKeyword, 
          bookById, standardSubjectForBook, standardUnitNames, fmtDate
        })
      : renderTeachersAdminView(state, { safe, teacherNameById });

    appRoot.innerHTML = layout(content);
    bind();
  }

  function syncStickyBarPosition() {
    const stickyBar = document.getElementById('inspectionStickyBar');
    if (!stickyBar) return;
    // main > header 나 sticky top-0 헤더의 실제 높이를 읽어 시작 페이지 입력 리스트 위에 배치
    const headerEl = appRoot.querySelector('main > header') || appRoot.querySelector('header');
    if (headerEl) {
      const h = headerEl.getBoundingClientRect().height;
      // 8px gap 효 업
      stickyBar.style.top = (h + 8) + 'px';
    }
    // 너비: 부모 콘테이너 너비 100% 확보
    stickyBar.style.width = '100%';
    stickyBar.style.boxSizing = 'border-box';
  }

  function bind() {
    // 공통 메뉴 및 뷰 전환 바인딩
    appRoot.querySelectorAll('[data-action="view"]').forEach(el => el.onclick = () => { 
      state.view = el.dataset.view; 
      render(); 
    });

    // 게이트웨이 전환 버튼 바인딩
    appRoot.querySelectorAll('[data-action="switch-portal"]').forEach(el => el.onclick = () => {
      const portal = el.dataset.portal;
      state.portal = portal;
      state.loginStep = 'login';
      state.pin = '';
      state.loginError = '';
      state.selectedTeacherName = '';
      state.studentLoginForm = readRememberedStudentLoginForm();
      
      if (portal === 'teacher') {
        state.selectedTeacherName = readLastTeacherId();
        
        const savedTeacherSession = readRememberedTeacherSession();
        if (savedTeacherSession && state.teachers.some(t => t.id === savedTeacherSession.id && t.pin === savedTeacherSession.pin && t.role === 'teacher' && t.active !== false)) {
          const matched = state.teachers.find(t => t.id === savedTeacherSession.id);
          state.currentTeacher = matched;
          state.view = 'inspections';
          
          const firstClass = teacherClasses(matched.id)[0];
          state.selectedSetupClassId = firstClass?.id || '';
          state.assigningClassId = firstClass?.id || '';
          state.selectedInspectionClassId = firstClass?.id || '';
          state.quickClassId = firstClass?.id || '';
          state.reportClassId = '';
        }
      } else if (portal === 'admin') {
        const adminTeacher = state.teachers.find(t => t.role === 'admin') || { id: 't_admin' };
        state.selectedTeacherName = adminTeacher.id;

        const savedAdminSession = readRememberedAdminSession();
        if (savedAdminSession && state.teachers.some(t => t.id === savedAdminSession.id && t.pin === savedAdminSession.pin && t.role === 'admin' && t.active !== false)) {
          const matched = state.teachers.find(t => t.id === savedAdminSession.id);
          state.currentTeacher = matched;
          state.view = 'teachersAdmin';
          
          const firstClass = state.classes[0];
          state.selectedSetupClassId = firstClass?.id || '';
          state.assigningClassId = firstClass?.id || '';
          state.selectedInspectionClassId = firstClass?.id || '';
          state.quickClassId = firstClass?.id || '';
          state.reportClassId = '';
        }
      }
      render();
    });

    // 관문으로 돌아가기 (로그아웃 포함)
    appRoot.querySelectorAll('[data-action="goto-gateway"]').forEach(el => el.onclick = () => {
      state.portal = 'gateway';
      state.currentTeacher = null;
      state.studentSession = null;
      state.pin = '';
      state.loginError = '';
      state.selectedTeacherName = '';
      state.studentLoginForm = readRememberedStudentLoginForm();
      render();
    });

    appRoot.querySelectorAll('[data-action="select-teacher"]').forEach(el => el.onclick = () => { 
      state.selectedTeacherName = el.dataset.id; 
      state.pin = '';
      state.loginError = '';
      render(); 
    });

    const loginPin = document.getElementById('loginPin');
    if (loginPin) {
      loginPin.value = state.pin || '';
      loginPin.oninput = (e) => {
        state.pin = e.target.value.replace(/\D/g, '').slice(0, STAFF_PIN_LENGTH);
        e.target.value = state.pin;
        if (state.loginError) {
          state.loginError = '';
          document.getElementById('loginErrorMessage')?.remove();
          loginPin.classList.remove(
            'border-rose-500',
            'bg-rose-950/30',
            'text-rose-100',
            'focus:border-rose-400',
            'shadow-[0_0_0_3px_rgba(244,63,94,0.18)]'
          );
          loginPin.classList.add(state.portal === 'admin' ? 'focus:border-[#8436ff]' : 'focus:border-[#4169e1]');
        }
      };
      loginPin.onkeydown = (e) => {
        if (state.customModal.open) {
          e.preventDefault();
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          handleLogin();
        }
      };
    }
    const autofocusEl = document.querySelector('[data-autofocus="true"]');
    if (autofocusEl) {
      window.requestAnimationFrame(() => {
        autofocusEl.focus();
      });
    }

    appRoot.querySelector('[data-action="login"]')?.addEventListener('click', handleLogin);
    appRoot.querySelectorAll('[data-action="logout"]').forEach(el => el.addEventListener('click', () => { 
      if (state.currentTeacher) {
        if (state.currentTeacher.role === 'admin') {
          window.localStorage?.removeItem(ADMIN_SESSION_KEY);
        } else {
          window.localStorage?.removeItem(TEACHER_SESSION_KEY);
        }
      }
      state.currentTeacher = null; 
      state.studentSession = null;
      state.portal = 'gateway';
      state.pin = ''; 
      state.loginError = '';
      state.selectedTeacherName = ''; 
      render(); 
    }));

    // 학생 로그인 및 가입 폼 관련 이벤트 바인딩
    const studentLoginClass = document.getElementById('studentLoginClass');
    if (studentLoginClass) {
      studentLoginClass.onchange = (e) => {
        state.studentLoginForm.classId = e.target.value;
        state.studentLoginForm.studentId = '';
        render();
      };
    }
    const studentLoginNameInput = document.getElementById('studentLoginNameInput');
    if (studentLoginNameInput) {
      studentLoginNameInput.oninput = (e) => {
        const val = e.target.value;
        state.studentLoginForm.name = val;
        
        const activeClassId = state.studentLoginForm.classId;
        const matched = state.students.find(s => 
          s.classId === activeClassId && 
          s.name.trim() === val.trim() && 
          s.active !== false
        );
        const nextStudentId = matched ? matched.id : '';
        state.studentLoginForm.studentId = nextStudentId;
        
        // 렌더링을 완전히 우회하고 DOM만 스마트하게 수동 패치 (IME 한글 조합 깨짐 완벽 방지)
        const feedbackEl = document.getElementById('studentLoginFeedback');
        const pinSection = document.getElementById('studentLoginPinSection');
        const pinInput = document.getElementById('studentLoginPin');
        const submitBtn = document.getElementById('studentLoginSubmitBtn');
        
        if (feedbackEl) {
          if (val && !nextStudentId) {
            feedbackEl.innerHTML = `<span class="text-rose-400">⚠️ 이 반에 소속된 해당 이름의 학생을 찾을 수 없습니다.</span>`;
          } else if (nextStudentId) {
            feedbackEl.innerHTML = `<span class="text-emerald-400">✨ 학생 확인 완료! 아래 5단계에서 PIN 번호를 입력해 주세요.</span>`;
          } else {
            feedbackEl.innerHTML = '';
          }
        }
        
        if (pinSection) {
          if (nextStudentId) {
            pinSection.classList.remove('opacity-40', 'pointer-events-none');
            pinSection.classList.add('opacity-100');
          } else {
            pinSection.classList.remove('opacity-100');
            pinSection.classList.add('opacity-40', 'pointer-events-none');
          }
        }
        
        if (pinInput) {
          if (nextStudentId) {
            pinInput.removeAttribute('disabled');
          } else {
            pinInput.setAttribute('disabled', 'true');
            pinInput.value = '';
            state.studentLoginForm.pin = '';
          }
        }
        
        if (submitBtn) {
          if (nextStudentId) {
            submitBtn.removeAttribute('disabled');
          } else {
            submitBtn.setAttribute('disabled', 'true');
          }
        }
      };
    }
    const studentLoginPin = document.getElementById('studentLoginPin');
    if (studentLoginPin) {
      studentLoginPin.oninput = (e) => state.studentLoginForm.pin = e.target.value.replace(/\D/g, '').slice(0, 4);
      studentLoginPin.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleStudentLogin();
        }
      };
    }
    appRoot.querySelector('[data-action="student-login-submit"]')?.addEventListener('click', handleStudentLogin);

    // 학생 회원가입 / 비밀번호 변경 단계 바인딩
    appRoot.querySelectorAll('[data-action="student-step"]').forEach(el => el.onclick = () => {
      state.loginStep = el.dataset.step;
      state.studentLoginForm = readRememberedStudentLoginForm();
      render();
    });

    const regName = document.getElementById('studentRegName');
    if (regName) regName.oninput = (e) => state.studentLoginForm.name = e.target.value;
    const regSchool = document.getElementById('studentRegSchool');
    if (regSchool) regSchool.oninput = (e) => state.studentLoginForm.school = e.target.value;
    const regPin = document.getElementById('studentRegPin');
    if (regPin) {
      regPin.value = state.studentLoginForm.pin || '';
      regPin.onfocus = () => {
        const pos = regPin.value.length;
        regPin.setSelectionRange(pos, pos);
      };
      regPin.oninput = (e) => {
        const nextPin = e.target.value.replace(/\D/g, '').slice(0, 4);
        state.studentLoginForm.pin = nextPin;
        e.target.value = nextPin;
      };
      regPin.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleStudentRegister();
        }
      };
    }
    appRoot.querySelector('[data-action="student-register-submit"]')?.addEventListener('click', handleStudentRegister);

    // 학생 포털 대시보드 내 비밀번호 변경 바인딩
    appRoot.querySelector('[data-action="open-student-pin-modal"]')?.addEventListener('click', () => {
      state.studentPinModalOpen = true;
      state.studentLoginForm.newPin = '';
      state.studentLoginForm.confirmNewPin = '';
      render();
    });
    
    appRoot.querySelectorAll('[data-action="close-student-pin-modal"]').forEach(el => {
      el.onclick = () => {
        state.studentPinModalOpen = false;
        render();
      };
    });

    const changeNewPin = document.getElementById('changeNewPin');
    if (changeNewPin) changeNewPin.oninput = (e) => state.studentLoginForm.newPin = e.target.value.replace(/\D/g, '').slice(0, 4);
    const changeConfirmPin = document.getElementById('changeConfirmPin');
    if (changeConfirmPin) changeConfirmPin.oninput = (e) => state.studentLoginForm.confirmNewPin = e.target.value.replace(/\D/g, '').slice(0, 4);

    // 학생 포털 대시보드 내 교재 필터 바인딩
    appRoot.querySelectorAll('[data-action="filter-student-book"]').forEach(el => {
      el.onclick = () => {
        state.selectedStudentBookFilter = el.dataset.id || '';
        render();
      };
    });
    appRoot.querySelectorAll('[data-action="select-student-rubric-book"]').forEach(el => {
      el.onclick = () => {
        state.selectedStudentRubricBookId = el.dataset.id || '';
        render();
      };
    });
    
    appRoot.querySelector('[data-action="student-pin-change-submit"]')?.addEventListener('click', async () => {
      const { newPin, confirmNewPin } = state.studentLoginForm;
      if (!/^\d{4}$/.test(newPin)) return showModalAlert('PIN번호는 4자리 숫자로 입력해야 합니다.');
      if (newPin !== confirmNewPin) return showModalAlert('변경할 PIN번호와 확인 번호가 일치하지 않습니다.');
      await updateStudentPin(state.studentSession.id, newPin);
      await showModalAlert('PIN 비밀번호가 정상적으로 변경되었습니다.');
      state.studentPinModalOpen = false;
      state.studentLoginForm.newPin = '';
      state.studentLoginForm.confirmNewPin = '';
      render();
    });

    function resolveCustomModal(resValue) {
      if (!state.customModal.open || !state.customModal.resolve) return;
      if (state.customModal.type === 'prompt') {
        const inputEl = document.getElementById('modalPromptInput');
        resValue = inputEl ? inputEl.value : '';
      }
      const res = state.customModal.resolve;
      state.customModal.open = false;
      state.customModal.resolve = null;
      render();
      res(resValue);
    }

    // 커스텀 모달 바인딩 (수락 / 취소)
    const modalConfirmButton = document.querySelector('[data-action="modal-confirm"]');
    modalConfirmButton?.addEventListener('click', () => {
      resolveCustomModal(true);
    });

    document.querySelector('[data-action="modal-cancel"]')?.addEventListener('click', () => {
      if (!state.customModal.open || !state.customModal.resolve) return;
      const res = state.customModal.resolve;
      state.customModal.open = false;
      state.customModal.resolve = null;
      render();
      res(state.customModal.type === 'prompt' ? null : false);
    });
    document.onkeydown = state.customModal.open ? (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        resolveCustomModal(true);
      }
    } : null;
    if (state.customModal.open && modalConfirmButton) {
      window.requestAnimationFrame(() => modalConfirmButton.focus());
    }

    // 테이블 헤더 정렬(th[data-sort]) 바인딩
    appRoot.querySelectorAll('th[data-sort]').forEach(el => {
      el.onclick = () => {
        const key = el.dataset.sort;
        if (state.sortKey === key) {
          state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortKey = key;
          state.sortOrder = 'asc';
        }
        render();
      };
    });

    // 기존 데이터 필터/모드 대시보드 바인딩
    appRoot.querySelectorAll('[data-action="dashboard-filter"]').forEach(el => el.onclick = () => { state.dashboardTeacherFilter = el.dataset.id; render(); });
    appRoot.querySelectorAll('[data-action="dashboard-metric"]').forEach(el => el.onclick = () => { state.dashboardMetricFocus = el.dataset.metric; render(); });
    appRoot.querySelectorAll('[data-action="print"]').forEach(el => el.onclick = () => window.print());
    appRoot.querySelectorAll('[data-action="print-class-report"]').forEach(el => el.onclick = () => {
      if (!state.classReportHtml) {
        showModalAlert('먼저 반 전체표를 생성해 주세요.');
        return;
      }
      const clearPrintMode = () => document.body.classList.remove('printing-class-report');
      document.body.classList.add('printing-class-report');
      window.addEventListener('afterprint', clearPrintMode, { once: true });
      window.print();
      window.setTimeout(clearPrintMode, 1000);
    });
    appRoot.querySelectorAll('[data-action="export-image"]').forEach(el => el.onclick = async () => {
      let targetArea = document.getElementById('reportCaptureArea');
      const round = selectedReportRoundInfo();
      let temporaryCaptureHost = null;
      if (!targetArea && !(state.reportStudentId && round)) {
        showModalAlert('캡처할 보고서 영역을 찾을 수 없습니다.');
        return;
      }
      state.saveMsg = '🖼️ 이미지 생성 중입니다. 잠시만 기다려 주세요...';
      render();
      try {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
        if (typeof window.html2canvas !== 'function') {
          throw new Error('html2canvas 라이브러리 로드에 실패했습니다.');
        }
        if (state.reportStudentId && round) {
          temporaryCaptureHost = document.createElement('div');
          temporaryCaptureHost.style.position = 'fixed';
          temporaryCaptureHost.style.left = '-10000px';
          temporaryCaptureHost.style.top = '0';
          temporaryCaptureHost.style.background = '#ffffff';
          temporaryCaptureHost.innerHTML = selectedStudentImageReportHtml();
          document.body.appendChild(temporaryCaptureHost);
          targetArea = temporaryCaptureHost.querySelector('#reportCaptureArea');
        } else {
          targetArea = document.getElementById('reportCaptureArea');
        }
        if (!targetArea) {
          throw new Error('캡처할 보고서 영역을 다시 찾을 수 없습니다.');
        }
        const canvas = await window.html2canvas(targetArea, {
          backgroundColor: targetArea.classList.contains('parent-image-report') ? '#ffffff' : '#050507',
          useCORS: true,
          scale: 2
        });
        const imageUri = canvas.toDataURL('image/png');
        let fileName = 'OATIS_보고서.png';
        if (state.reportStudentId && round) {
          const student = state.students.find(s => s.id === state.reportStudentId);
          const klass = classById(student?.classId);
          if (student && klass) {
            fileName = formatRoundFileName({
              teacherName: teacherNameById(klass.teacherId),
              className: klass.name,
              studentName: student.name,
              round
            });
          }
        } else if (state.reportStudentId) {
          const student = state.students.find(s => s.id === state.reportStudentId);
          if (student) fileName = `${student.name}_교재분석보고서.png`;
        } else if (state.reportClassId) {
          const klass = state.classes.find(c => c.id === state.reportClassId);
          if (klass) fileName = `${klass.name}_교재현황표.png`;
        }
        const link = document.createElement('a');
        link.href = imageUri;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        state.saveMsg = '🎉 이미지 다운로드가 완료되었습니다!';
      } catch (err) {
        console.error(err);
        state.saveMsg = '';
        showModalAlert(`이미지 내보내기 중 오류가 발생했습니다: ${err.message}`);
      } finally {
        if (temporaryCaptureHost) {
          document.body.removeChild(temporaryCaptureHost);
        }
      }
      render();
      setTimeout(() => {
        if (state.saveMsg && (state.saveMsg.includes('완료') || state.saveMsg.includes('생성'))) {
          state.saveMsg = '';
          render();
        }
      }, 3000);
    });
    document.getElementById('reportRoundStartDate')?.addEventListener('change', async (e) => {
      const value = e.target.value || '';
      const classId = e.target.dataset.classId || activeReportClassId();
      state.reportRoundStartDate = value;
      state.selectedReportRound = '';
      state.printHtml = '';
      refreshReportRounds();
      render();
      if (classId && value) {
        try {
          await updateDoc(doc(refs.classes, classId), {
            reportRoundStartDate: value,
            updatedAt: serverTimestamp()
          });
        } catch (err) {
          console.error(err);
          showModalAlert(`보고서 회차 기준일 저장 중 오류가 발생했습니다: ${err.message}`);
        }
      }
    });
    appRoot.querySelectorAll('[data-action="open-report-date-picker"]').forEach(el => {
      el.onclick = (event) => {
        const input = el.querySelector('#reportRoundStartDate');
        if (!input || event.target === input) return;
        input.focus();
        try {
          input.showPicker?.();
        } catch (err) {
          // Older browsers still focus the date input, which keeps the control usable.
        }
      };
    });
    appRoot.querySelectorAll('[data-action="select-report-round"]').forEach(el => {
      el.onclick = () => {
        const nextRound = Number(el.dataset.round);
        if (!nextRound) return;
        const willClear = Number(state.selectedReportRound) === nextRound;
        state.selectedReportRound = willClear ? '' : String(nextRound);
        if (willClear) {
          state.printHtml = '';
        } else {
          buildSelectedStudentWebReport();
        }
        render();
      };
    });
    appRoot.querySelector('[data-action="open-setup-wizard"]')?.addEventListener('click', () => { state.wizardOpen = true; state.wizardStep = 1; state.assigningClassId = state.selectedSetupClassId || state.assigningClassId || state.classes[0]?.id || ''; render(); });
    appRoot.querySelector('[data-action="close-setup-wizard"]')?.addEventListener('click', () => { state.wizardOpen = false; render(); });
    appRoot.querySelector('[data-action="wizard-prev"]')?.addEventListener('click', () => { state.wizardStep = Math.max(1, state.wizardStep - 1); render(); });
    appRoot.querySelector('[data-action="wizard-finish"]')?.addEventListener('click', () => { state.wizardOpen = false; state.wizardStep = 1; notify('반 세팅 마법사 완료'); render(); });
    appRoot.querySelector('[data-action="wizard-next"]')?.addEventListener('click', () => { state.wizardStep = 3; render(); });

    // 아코디언 제어 바인딩
    appRoot.querySelectorAll('[data-action="toggle-accordion"]').forEach(el => {
      el.onclick = () => {
        const group = el.dataset.group;
        const target = el.dataset.target;
        if (state[group]) {
          state[group][target] = !state[group][target];
          render();
        }
      };
    });

    // 칩 버튼 형태의 선택 기능 (data-action="select-option") 바인딩
    appRoot.querySelectorAll('[data-action="select-option"]').forEach(el => {
      el.onclick = () => {
        const target = el.dataset.target;
        const value = el.dataset.value;
        if (target === 'studentLoginForm') {
          try {
            state.studentLoginForm = JSON.parse(value);
          } catch (err) {
            state.studentLoginForm = value;
          }
        } else if (target === 'bookType') {
          state.formBook.bookType = value;
          if (value === 'exam_chapter' && !state.formBook.chapterCount) state.formBook.chapterCount = '10';
        } else if (target === 'bookSubject') {
          const titleBase = stripBookSubjectFromTitle(state.formBook.subject, state.formBook.title);
          state.formBook.subject = value;
          state.formBook.title = composeBookTitle(value, titleBase);
          state.formUnit.standardUnitIds = [];
          state.formUnit.name = '';
        } else if (target === 'bookGrade') {
          state.formBook.grade = value;
        } else if (target === 'setupClassGrade') {
          state.setupFormClass.grade = value;
        } else if (target === 'setupClassTeacherId') {
          state.setupFormClass.teacherId = value;
        } else if (target === 'reportStudentId') {
          state.reportStudentId = value;
          const selectedStudent = studentById(value);
          if (selectedStudent?.classId) state.reportClassId = selectedStudent.classId;
          state.selectedReportRound = '';
          state.printHtml = '';
          refreshReportRounds();
        } else if (target === 'reportClassId') {
          state.reportClassId = value;
          state.reportStudentId = '';
          state.selectedReportRound = '';
          state.printHtml = '';
          refreshReportRounds();
        } else {
          state[target] = value;
        }

        if (target === 'selectedInspectionClassId') {
          state.selectedInspectionStudentId = '';
          state.selectedInspectionBookId = '';
          state.selectedRangeStart = '';
          state.selectedRangeEnd = '';
          state.missedPages = '';
          state.memo = '';
          resetRubricScores();
          state.selectedCarryoverResolutionKeys = [];
        } else if (target === 'selectedInspectionStudentId') {
          state.selectedRangeStart = '';
          state.selectedRangeEnd = '';
          state.missedPages = '';
          state.memo = '';
          resetRubricScores();
          state.selectedCarryoverResolutionKeys = [];
        } else if (target === 'selectedInspectionBookId') {
          resetRubricScores();
          state.selectedCarryoverResolutionKeys = [];
        } else if (target === 'selectedSetupClassId') {
          state.assigningClassId = value;
        } else if (target === 'inspectionHistoryFilterClass') {
          state.inspectionHistoryFilterStudent = '';
        } else if (target === 'selectedBookManageId') {
          state.formUnit = { name: '', start: '', end: '', standardUnitIds: [] };
        }

        render();
      };
    });

    // 반 정렬 기준 스위치 바인딩
    appRoot.querySelectorAll('[data-action="set-class-sort"]').forEach(el => {
      el.onclick = () => {
        state.classSortType = el.dataset.sort;
        render();
      };
    });

    // 학생 정렬 기준 스위치 바인딩
    appRoot.querySelectorAll('[data-action="set-student-sort"]').forEach(el => {
      el.onclick = () => {
        state.studentSortType = el.dataset.sort;
        render();
      };
    });

    // 학생 관리 리스트 제어 바인딩 (setupView)
    appRoot.querySelectorAll('[data-action="student-reset-pin"]').forEach(el => {
      el.onclick = () => resetStudentPin(el.dataset.id);
    });
    appRoot.querySelectorAll('[data-action="student-unlock-pin"]').forEach(el => {
      el.onclick = () => unlockStudentPin(el.dataset.id);
    });
    appRoot.querySelectorAll('[data-action="student-update-pin"]').forEach(el => {
      el.onclick = async () => {
        const studentId = el.dataset.id;
        const currentPin = el.dataset.pin || '1234';
        const input = await showModalPrompt('새로운 학생용 4자리 PIN번호를 입력해주세요:', currentPin, 'PIN 변경');
        if (input !== null && input.trim() !== '') {
          await updateStudentPin(studentId, input.trim());
        }
      };
    });

    // 6요소 점수 버튼 바인딩
    appRoot.querySelectorAll('[data-action="set-rubric-score"]').forEach(el => {
      el.onclick = () => {
        const rawKey = el.dataset.key;
        const val = Number(el.dataset.val);
        const item = RUBRIC_ITEMS.find(rubricItem => {
          return rubricItem.key === rawKey || (rubricItem.legacyKeys || []).includes(rawKey);
        });
        const key = item?.key || rawKey;
        if (!key || Number.isNaN(val)) return;
        const currentScores = normalizeRubricScores(state.rubricScores || {});
        // 같은 점수 다시 누르면 취소
        currentScores[key] = currentScores[key] === val ? null : val;
        state.rubricScores = currentScores;
        render();
      };
    });

    appRoot.querySelector('[data-action="reset-rubric-scores"]')?.addEventListener('click', () => {
      resetRubricScores();
      render();
    });

    appRoot.querySelectorAll('[data-action="edit-class"]').forEach(el => {
      el.onclick = () => {
        const classId = el.dataset.id;
        const klass = classById(classId);
        if (klass) {
          state.setupFormClass = { id: klass.id, name: klass.name, grade: klass.grade, teacherId: klass.teacherId, note: klass.note || '' };
          state.selectedSetupClassId = classId;
          state.setupAccordion.class = true;
          render();
        }
      };
    });

    [
      'selectedSetupClassId', 'selectedBookManageId', 'assigningClassId', 'selectedInspectionClassId',
      'selectedInspectionStudentId', 'selectedInspectionBookId', 'selectedDate',
      'quickClassId', 'reportStudentId', 'reportClassId', 'inspectionHistoryFilterClass',
      'inspectionHistoryFilterStudent', 'selectedExistingStudentId', 'bookSubject', 'bookGrade'
    ].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.onchange = (e) => {
        state[id] = e.target.value;
        if (id === 'selectedSetupClassId') state.assigningClassId = e.target.value;
        if (id === 'selectedInspectionClassId') {
          state.selectedInspectionStudentId = '';
          state.selectedInspectionBookId = '';
          state.selectedRangeStart = '';
          state.selectedRangeEnd = '';
          state.missedPages = '';
          state.memo = '';
          resetRubricScores();
          state.selectedCarryoverResolutionKeys = [];
        } else if (id === 'selectedInspectionStudentId') {
          state.selectedRangeStart = '';
          state.selectedRangeEnd = '';
          state.missedPages = '';
          state.memo = '';
          resetRubricScores();
          state.selectedCarryoverResolutionKeys = [];
        } else if (id === 'selectedInspectionBookId') {
          resetRubricScores();
          state.selectedCarryoverResolutionKeys = [];
        } else if (id === 'selectedBookManageId') {
          state.tempBookUnits = null;
        }
        render();
      };
    });
    ['memo', 'bulkUnitText'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.oninput = (e) => { state[id] = e.target.value; };
    });

    const missedPagesEl = document.getElementById('missedPages');
    if (missedPagesEl) {
      missedPagesEl.oninput = (e) => {
        state.missedPages = e.target.value;
        updateMissedPagesFromText();
      };
    }

    ['selectedRangeStart', 'selectedRangeEnd'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.oninput = (e) => {
        state[id] = e.target.value;
        updatePageChecksDOM();
      };
    });
    document.getElementById('setupClassName')?.addEventListener('input', e => state.setupFormClass.name = e.target.value);
    document.getElementById('setupClassGrade')?.addEventListener('change', e => state.setupFormClass.grade = e.target.value);
    document.getElementById('wizardSetupClassName')?.addEventListener('input', e => state.setupFormClass.name = e.target.value);
    document.getElementById('wizardSetupClassGrade')?.addEventListener('change', e => state.setupFormClass.grade = e.target.value);
    document.getElementById('wizardSetupClassTeacherId')?.addEventListener('change', e => state.setupFormClass.teacherId = e.target.value);
    document.getElementById('wizardSetupClassNote')?.addEventListener('input', e => state.setupFormClass.note = e.target.value);
    appRoot.querySelectorAll('#wizardStudentBulkText').forEach(el => el.addEventListener('input', e => state.studentBulkText = e.target.value));
    document.getElementById('setupClassTeacherId')?.addEventListener('change', e => state.setupFormClass.teacherId = e.target.value);
    document.getElementById('setupClassNote')?.addEventListener('input', e => state.setupFormClass.note = e.target.value);
    document.getElementById('bookTitleBase')?.addEventListener('input', e => {
      state.formBook.title = composeBookTitle(state.formBook.subject, e.target.value);
    });
    document.getElementById('bookChapterCount')?.addEventListener('input', e => {
      state.formBook.chapterCount = e.target.value.replace(/\D/g, '').slice(0, 2);
      e.target.value = state.formBook.chapterCount;
    });
    appRoot.querySelectorAll('[data-field="allChapterStandardUnit"]').forEach(el => {
      el.addEventListener('change', e => {
        const unitId = e.target.value;
        appRoot.querySelectorAll(`[data-exam-chapter-row] [data-field="chapterStandardUnit"][value="${CSS.escape(unitId)}"]`).forEach(input => {
          input.checked = e.target.checked;
        });
      });
    });
    document.getElementById('bookSubject')?.addEventListener('change', e => state.formBook.subject = e.target.value);
    document.getElementById('bookGrade')?.addEventListener('change', e => state.formBook.grade = e.target.value);
    document.getElementById('unitName')?.addEventListener('input', e => state.formUnit.name = e.target.value);
    document.getElementById('unitStart')?.addEventListener('input', e => state.formUnit.start = e.target.value);
    document.getElementById('unitEnd')?.addEventListener('input', e => state.formUnit.end = e.target.value);
    document.getElementById('standardUnitNewName')?.addEventListener('input', e => state.standardUnitNewName = e.target.value);
    document.getElementById('standardUnitInsertOrder')?.addEventListener('input', e => state.standardUnitInsertOrder = e.target.value.replace(/\D/g, ''));
    document.getElementById('adminTeacherName')?.addEventListener('input', e => state.adminTeacherForm.name = e.target.value);
    document.getElementById('adminTeacherPin')?.addEventListener('input', e => {
      state.adminTeacherForm.pin = e.target.value.replace(/\D/g, '').slice(0, STAFF_PIN_LENGTH);
      e.target.value = state.adminTeacherForm.pin;
    });
    document.getElementById('adminTeacherRole')?.addEventListener('change', e => state.adminTeacherForm.role = e.target.value);
    document.getElementById('setupSearchClass')?.addEventListener('input', e => { state.setupSearchClass = e.target.value; render(); });
    document.getElementById('setupSearchStudent')?.addEventListener('input', e => { state.setupSearchStudent = e.target.value; render(); });
    document.getElementById('setupSearchBook')?.addEventListener('input', e => { state.setupSearchBook = e.target.value; render(); });
    document.getElementById('existingStudentSearch')?.addEventListener('input', e => { state.existingStudentSearch = e.target.value; render(); });
    appRoot.querySelectorAll('[data-action="setup-detail"]').forEach(el => el.onclick = () => { state.setupDetailPanel = state.setupDetailPanel === el.dataset.detail ? '' : el.dataset.detail; render(); });
    appRoot.querySelectorAll('[data-action="close-setup-detail"]').forEach(el => el.onclick = () => { state.setupDetailPanel = ''; render(); });
    appRoot.querySelectorAll('[data-action="select-class-detail"]').forEach(el => el.onclick = () => { state.selectedSetupClassId = el.dataset.id; state.assigningClassId = el.dataset.id; state.setupDetailPanel = 'students'; render(); });
    appRoot.querySelector('[data-action="add-existing-student"]')?.addEventListener('click', () => addExistingStudentToClass(state.selectedExistingStudentId, state.selectedSetupClassId));
    appRoot.querySelectorAll('[data-action="save-class"]').forEach(el => el.addEventListener('click', saveClass));
    appRoot.querySelectorAll('[data-action="reset-class-form"]').forEach(el => el.addEventListener('click', () => { resetSetupForm(); render(); }));
    appRoot.querySelectorAll('[data-action="student-mode"]').forEach(el => el.onclick = () => { state.studentBulkMode = el.dataset.mode; render(); });
    appRoot.querySelectorAll('[data-action="save-students-bulk"]').forEach(el => el.addEventListener('click', saveStudentsBulk));
    appRoot.querySelectorAll('[data-action="clear-student-bulk"]').forEach(el => el.addEventListener('click', () => { state.studentBulkText = ''; render(); }));
    appRoot.querySelectorAll('[data-action="remove-student"]').forEach(el => el.onclick = () => removeStudent(el.dataset.id));
    appRoot.querySelector('[data-action="save-book"]')?.addEventListener('click', saveBook);
    appRoot.querySelector('[data-action="reset-book-form"]')?.addEventListener('click', () => { state.formBook = { title: '', subject: '', grade: '', publisher: '', active: true, bookType: 'standard', chapterCount: '10' }; state.editingBookId = ''; render(); });
    appRoot.querySelector('[data-action="save-unit"]')?.addEventListener('click', saveUnit);
    appRoot.querySelector('[data-action="save-unit-bulk"]')?.addEventListener('click', saveUnitBulk);
    appRoot.querySelector('[data-action="clear-unit-bulk"]')?.addEventListener('click', () => { state.bulkUnitText = ''; render(); });
    appRoot.querySelectorAll('[data-action="toggle-unit-student-visible"]').forEach(el => {
      el.onclick = () => toggleUnitStudentVisible(el.dataset.book, el.dataset.unit);
    });
    appRoot.querySelectorAll('[data-action="toggle-unit-standard"]').forEach(el => {
      el.onclick = () => {
        const id = el.dataset.id;
        const selected = new Set(state.formUnit.standardUnitIds || []);
        if (selected.has(id)) selected.delete(id);
        else selected.add(id);
        state.formUnit.standardUnitIds = [...selected];
        const names = standardUnitNames(state.formUnit.standardUnitIds);
        state.formUnit.name = names.join(', ');
        render();
      };
    });
    appRoot.querySelectorAll('[data-action="edit-book"]').forEach(el => el.onclick = () => { const b = bookById(el.dataset.id); if (!b) return; state.formBook = { title: b.title || '', subject: b.subject || '', grade: b.grade || '', publisher: b.publisher || '', active: b.active !== false, bookType: b.bookType || 'standard', chapterCount: b.chapterCount || '10' }; state.editingBookId = b.id; state.selectedBookManageId = b.id; state.tempBookUnits = null; render(); });
    appRoot.querySelectorAll('[data-action="clone-book"]').forEach(el => el.onclick = () => cloneBook(el.dataset.id));
    appRoot.querySelectorAll('[data-action="toggle-book-archive"]').forEach(el => el.onclick = () => { const b = bookById(el.dataset.id); if (b) toggleArchiveBook(b.id, !!b.archived); });
    appRoot.querySelectorAll('[data-action="select-book-manage"]').forEach(el => el.onclick = () => { state.selectedBookManageId = el.dataset.id; state.tempBookUnits = null; render(); });
    appRoot.querySelectorAll('[data-action="assign-book"]').forEach(el => el.onclick = () => assignBook(el.dataset.class, el.dataset.book));
    appRoot.querySelectorAll('[data-action="complete-assign"]').forEach(el => el.onclick = () => completeAssign(el.dataset.id));
    appRoot.querySelectorAll('[data-action="reactivate-assign"]').forEach(el => el.onclick = () => reactivateAssign(el.dataset.id));
    appRoot.querySelectorAll('[data-action="remove-assign"]').forEach(el => el.onclick = () => removeAssign(el.dataset.id));
    appRoot.querySelectorAll('[data-action="move-assign"]').forEach(el => el.onclick = () => moveAssign(el.dataset.id, el.dataset.dir));
    appRoot.querySelector('[data-action="save-inspection"]')?.addEventListener('click', saveInspection);
    appRoot.querySelector('[data-action="reset-inspection-form"]')?.addEventListener('click', () => { resetInspectionForm(); render(); });
    appRoot.querySelector('[data-action="clear-missed-pages"]')?.addEventListener('click', () => {
      state.missedPages = '';
      const missedPagesEl = document.getElementById('missedPages');
      if (missedPagesEl) {
        missedPagesEl.value = '';
      }
      updateMissedPagesFromText();
    });
    appRoot.querySelectorAll('[data-action="toggle-missed-page"]').forEach(el => el.onclick = () => toggleMissedPage(Number(el.dataset.page)));
    appRoot.querySelectorAll('[data-action="toggle-carryover-resolution"]').forEach(el => {
      el.onclick = () => {
        const sourceInspectionId = el.dataset.sourceInspectionId;
        const page = Number(el.dataset.page);
        if (!sourceInspectionId || Number.isNaN(page)) return;
        const key = pageResolutionKey(sourceInspectionId, page);
        const selectedKeys = selectedCarryoverKeysSet();
        if (selectedKeys.has(key)) {
          selectedKeys.delete(key);
        } else {
          selectedKeys.add(key);
        }
        state.selectedCarryoverResolutionKeys = [...selectedKeys];
        render();
      };
    });
    appRoot.querySelectorAll('[data-action="adjust-rubric-score"]').forEach(el => {
      el.onclick = () => {
        const key = el.dataset.key;
        const delta = Number(el.dataset.delta);
        if (!key || Number.isNaN(delta)) return;
        const currentScores = normalizeRubricScores(state.rubricScores || {});
        const current = currentScores[key];
        if (current === null && delta < 0) return;
        const next = current === null ? delta : current + delta;
        currentScores[key] = Math.min(10, Math.max(0, Math.round(next * 2) / 2));
        state.rubricScores = currentScores;
        render();
      };
    });
    appRoot.querySelectorAll('[data-action="append-remark"]').forEach(el => el.onclick = () => appendRemark(el.dataset.text));
    appRoot.querySelectorAll('[data-action="edit-inspection"]').forEach(el => el.onclick = () => loadInspectionToForm(el.dataset.id));
    appRoot.querySelectorAll('[data-action="delete-inspection"]').forEach(el => el.onclick = () => deleteInspection(el.dataset.id));
    appRoot.querySelector('[data-action="open-quick-mode"]')?.addEventListener('click', () => { state.quickClassId = state.selectedInspectionClassId || state.quickClassId || ''; render(); });
    appRoot.querySelectorAll('[data-action="quick-fill"]').forEach(el => el.onclick = () => { state.selectedInspectionStudentId = el.dataset.id; state.selectedInspectionClassId = studentById(el.dataset.id)?.classId || ''; state.view = 'inspections'; render(); });
    
    // 보고서 생성 바인딩
    appRoot.querySelector('[data-action="build-student-report"]')?.addEventListener('click', () => {
      state.printHtml = reportForStudent(state.reportStudentId, state, {
        studentById, classById, inspectionsForStudent, groupInspectionsByBook,
        bookById, averageCompletionRate, fmtDate, safe, progressTone,
        classRubricAverage, studentRubricAverage, students: state.students,
        inspections: state.inspections, assignedBooksForClass
      });
      render(); 
      setTimeout(() => {
        document.getElementById('reportPreviewArea')?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    });
    
    appRoot.querySelector('[data-action="build-class-report"]')?.addEventListener('click', () => { 
      state.classReportHtml = reportForClass(state.reportClassId, state, {
        classById, studentsForClass, inspectionsForStudent, 
        averageCompletionRate, fmtDate, teacherNameById, safe,
        classRubricAverage, studentRubricAverage, students: state.students,
        inspections: state.inspections
      }); 
      render(); 
      setTimeout(() => {
        document.getElementById('reportPreviewArea')?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    });
    
    appRoot.querySelector('[data-action="admin-new-teacher"]')?.addEventListener('click', () => { resetAdminTeacherForm(); render(); });
    appRoot.querySelector('[data-action="admin-reset-teacher"]')?.addEventListener('click', () => { resetAdminTeacherForm(); render(); });
    appRoot.querySelector('[data-action="admin-save-teacher"]')?.addEventListener('click', saveAdminTeacher);
    appRoot.querySelector('[data-action="admin-delete-teacher"]')?.addEventListener('click', (e) => removeAdminTeacher(e.currentTarget.dataset.id));
    appRoot.querySelectorAll('[data-action="admin-edit-teacher"]').forEach(el => el.onclick = () => loadAdminTeacherToForm(el.dataset.id));
    appRoot.querySelectorAll('[data-action="delete-class"]').forEach(el => el.onclick = () => removeClass(el.dataset.id));
    appRoot.querySelectorAll('[data-action="delete-book"]').forEach(el => el.onclick = () => removeBook(el.dataset.id));
    appRoot.querySelectorAll('[data-action="approve-student-request"]').forEach(el => el.onclick = () => approveStudentRequest(el.dataset.id));
    appRoot.querySelectorAll('[data-action="reject-student-request"]').forEach(el => el.onclick = () => rejectStudentRequest(el.dataset.id));
    appRoot.querySelectorAll('[data-action="admin-update-student-class"]').forEach(el => el.onclick = () => updateAdminStudentClass(el.dataset.id));
    appRoot.querySelectorAll('[data-action="admin-update-student-pin"]').forEach(el => el.onclick = () => updateAdminStudentPin(el.dataset.id));
    appRoot.querySelectorAll('[id^="adminStudentPin-"]').forEach(el => {
      el.oninput = (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
      };
    });
    appRoot.querySelectorAll('[data-action="admin-withdraw-student"]').forEach(el => el.onclick = () => withdrawAdminStudent(el.dataset.id));
    appRoot.querySelectorAll('[data-action="admin-delete-student"]').forEach(el => el.onclick = () => deleteAdminStudent(el.dataset.id));
    appRoot.querySelectorAll('[data-action="toggle-admin-student-select"]').forEach(el => {
      el.onchange = () => {
        const ids = new Set(state.selectedAdminStudentIds || []);
        if (el.checked) ids.add(el.dataset.id);
        else ids.delete(el.dataset.id);
        state.selectedAdminStudentIds = [...ids];
        render();
      };
    });
    appRoot.querySelectorAll('[data-action="admin-set-promotion-grade"]').forEach(el => {
      el.onclick = () => {
        state.adminPromotionGrade = el.dataset.grade;
        render();
      };
    });
    appRoot.querySelectorAll('[data-action="admin-set-promotion-class"]').forEach(el => {
      el.onclick = () => {
        const klass = classById(el.dataset.id);
        state.adminPromotionClassId = el.dataset.id;
        if (klass?.grade) state.adminPromotionGrade = klass.grade;
        render();
      };
    });
    appRoot.querySelector('[data-action="admin-run-promotion-clone"]')?.addEventListener('click', runPromotionClone);
    appRoot.querySelector('[data-action="admin-purge-due-withdrawn-students"]')?.addEventListener('click', purgeDueWithdrawnStudents);
    appRoot.querySelectorAll('[data-action="admin-select-standard-subject"]').forEach(el => {
      el.onclick = () => {
        state.selectedStandardSubjectCode = el.dataset.code;
        state.standardUnitNewName = '';
        state.standardUnitInsertOrder = '';
        render();
      };
    });
    appRoot.querySelectorAll('[data-action="admin-save-standard-unit-name"]').forEach(el => {
      el.onclick = () => saveStandardUnitName(el.dataset.id);
    });
    appRoot.querySelectorAll('[data-action="admin-delete-standard-unit"]').forEach(el => {
      el.onclick = () => deleteStandardUnit(el.dataset.id);
    });
    appRoot.querySelector('[data-action="admin-add-standard-unit"]')?.addEventListener('click', addStandardUnit);
    appRoot.querySelector('[data-action="admin-save-remark-templates"]')?.addEventListener('click', saveRemarkTemplates);

    appRoot.querySelector('[data-action="save-login-config"]')?.addEventListener('click', saveLoginConfig);
    document.getElementById('configSplashTitleLine1')?.addEventListener('input', e => state.adminLoginConfigForm.splashTitleLine1 = e.target.value);
    document.getElementById('configSplashTitleLine2')?.addEventListener('input', e => state.adminLoginConfigForm.splashTitleLine2 = e.target.value);
    document.getElementById('configSplashTitleSizeLine1')?.addEventListener('change', e => { state.adminLoginConfigForm.splashTitleSizeLine1 = e.target.value; render(); });
    document.getElementById('configSplashTitleSizeLine2')?.addEventListener('change', e => { state.adminLoginConfigForm.splashTitleSizeLine2 = e.target.value; render(); });
    document.getElementById('configSplashSubtitle')?.addEventListener('input', e => state.adminLoginConfigForm.splashSubtitle = e.target.value);
    document.getElementById('configSplashDescription')?.addEventListener('input', e => state.adminLoginConfigForm.splashDescription = e.target.value);
    document.getElementById('configSplashKicker')?.addEventListener('input', e => state.adminLoginConfigForm.splashKicker = e.target.value);
    document.getElementById('configGatewayBadge')?.addEventListener('input', e => state.adminLoginConfigForm.gatewayBadge = e.target.value);
    document.getElementById('configGatewayTitle')?.addEventListener('input', e => state.adminLoginConfigForm.gatewayTitle = e.target.value);
    document.getElementById('configGatewayDescription')?.addEventListener('input', e => state.adminLoginConfigForm.gatewayDescription = e.target.value);
    document.getElementById('configStudentPortalTitle')?.addEventListener('input', e => state.adminLoginConfigForm.studentPortalTitle = e.target.value);
    document.getElementById('configStudentPortalDescription')?.addEventListener('input', e => state.adminLoginConfigForm.studentPortalDescription = e.target.value);
    document.getElementById('configTeacherPortalTitle')?.addEventListener('input', e => state.adminLoginConfigForm.teacherPortalTitle = e.target.value);
    document.getElementById('configTeacherPortalDescription')?.addEventListener('input', e => state.adminLoginConfigForm.teacherPortalDescription = e.target.value);
    document.getElementById('configAdminPortalTitle')?.addEventListener('input', e => state.adminLoginConfigForm.adminPortalTitle = e.target.value);
    document.getElementById('configAdminPortalDescription')?.addEventListener('input', e => state.adminLoginConfigForm.adminPortalDescription = e.target.value);
    document.getElementById('configLoginTitle')?.addEventListener('input', e => state.adminLoginConfigForm.loginTitle = e.target.value);
    document.getElementById('configLoginDescription')?.addEventListener('input', e => state.adminLoginConfigForm.loginDescription = e.target.value);
    document.getElementById('configLoginInfoText')?.addEventListener('input', e => state.adminLoginConfigForm.loginInfoText = e.target.value);
    document.getElementById('configPrimaryColor')?.addEventListener('input', e => state.adminLoginConfigForm.primaryColor = e.target.value);
    document.getElementById('configSplashTitleColor')?.addEventListener('input', e => state.adminLoginConfigForm.splashTitleColor = e.target.value);
    document.getElementById('configSplashTextColor')?.addEventListener('input', e => state.adminLoginConfigForm.splashTextColor = e.target.value);
    document.getElementById('configSplashMutedColor')?.addEventListener('input', e => state.adminLoginConfigForm.splashMutedColor = e.target.value);
    document.getElementById('configPortalHoverGlowColor')?.addEventListener('input', e => state.adminLoginConfigForm.portalHoverGlowColor = e.target.value);
    document.getElementById('configAuroraColor1')?.addEventListener('input', e => state.adminLoginConfigForm.auroraColor1 = e.target.value);
    document.getElementById('configAuroraColor2')?.addEventListener('input', e => state.adminLoginConfigForm.auroraColor2 = e.target.value);
    document.getElementById('configAuroraColor3')?.addEventListener('input', e => state.adminLoginConfigForm.auroraColor3 = e.target.value);

    document.getElementById('configFontFamily')?.addEventListener('change', e => { state.adminLoginConfigForm.fontFamily = e.target.value; render(); });
    document.getElementById('configFontScale')?.addEventListener('change', e => { state.adminLoginConfigForm.fontScale = e.target.value; render(); });

    appRoot.querySelectorAll('[data-action="set-color-preset"]').forEach(el => {
      el.onclick = () => {
        state.adminLoginConfigForm.primaryColor = el.dataset.color;
        render();
      };
    });

    appRoot.querySelectorAll('[data-action="toggle-admin-card"]').forEach(el => {
      el.onclick = () => {
        const cardId = el.dataset.cardId;
        const isExpanded = !state.adminCardExpanded[cardId];
        state.adminCardExpanded = {};
        state.adminCardExpanded[cardId] = isExpanded;
        render();
      };
    });

    // 일반 교재 단원 입력 동기화
    appRoot.querySelectorAll('[data-standard-unit-row]').forEach(row => {
      const standardUnitId = row.dataset.standardUnitId;
      const unitNameInput = row.querySelector('[data-field="unitName"]');
      const startInput = row.querySelector('[data-field="start"]');
      const endInput = row.querySelector('[data-field="end"]');

      const updateTemp = () => {
        if (!state.tempBookUnits || state.tempBookUnits.bookId !== state.selectedBookManageId) {
          state.tempBookUnits = {
            bookId: state.selectedBookManageId,
            bookType: 'standard',
            rows: {}
          };
        }
        state.tempBookUnits.rows[standardUnitId] = {
          unitName: unitNameInput?.value || '',
          start: startInput?.value || '',
          end: endInput?.value || ''
        };
      };

      if (unitNameInput) unitNameInput.oninput = updateTemp;
      if (startInput) startInput.oninput = updateTemp;
      if (endInput) endInput.oninput = updateTemp;
    });

    // 시험대비 교재 챕터 입력 동기화
    appRoot.querySelectorAll('[data-exam-chapter-row]').forEach((row, index) => {
      const chapterNameInput = row.querySelector('[data-field="chapterName"]');
      const startInput = row.querySelector('[data-field="start"]');
      const endInput = row.querySelector('[data-field="end"]');
      
      const updateTemp = () => {
        if (!state.tempBookUnits || state.tempBookUnits.bookId !== state.selectedBookManageId) {
          state.tempBookUnits = {
            bookId: state.selectedBookManageId,
            bookType: 'exam_chapter',
            rows: []
          };
        }
        while (state.tempBookUnits.rows.length <= index) {
          state.tempBookUnits.rows.push({ chapterName: '', start: '', end: '', standardUnitIds: [] });
        }
        state.tempBookUnits.rows[index] = {
          chapterName: chapterNameInput?.value || '',
          start: startInput?.value || '',
          end: endInput?.value || '',
          standardUnitIds: [...row.querySelectorAll('[data-field="chapterStandardUnit"]:checked')].map(input => input.value).filter(Boolean)
        };
      };

      if (chapterNameInput) chapterNameInput.oninput = updateTemp;
      if (startInput) startInput.oninput = updateTemp;
      if (endInput) endInput.oninput = updateTemp;
      
      row.querySelectorAll('[data-field="chapterStandardUnit"]').forEach(cb => {
        cb.onchange = updateTemp;
      });
    });

    // 전 챕터 표준소단원 일괄 선택 동기화
    appRoot.querySelectorAll('[data-field="allChapterStandardUnit"]').forEach(cb => {
      cb.onchange = () => {
        const checkedIds = [...appRoot.querySelectorAll('[data-field="allChapterStandardUnit"]:checked')].map(i => i.value);
        appRoot.querySelectorAll('[data-exam-chapter-row]').forEach(row => {
          row.querySelectorAll('[data-field="chapterStandardUnit"]').forEach(childCb => {
            childCb.checked = checkedIds.includes(childCb.value);
          });
        });
        
        if (!state.tempBookUnits || state.tempBookUnits.bookId !== state.selectedBookManageId) {
          state.tempBookUnits = {
            bookId: state.selectedBookManageId,
            bookType: 'exam_chapter',
            rows: []
          };
        }
        
        appRoot.querySelectorAll('[data-exam-chapter-row]').forEach((row, index) => {
          const chapterNameInput = row.querySelector('[data-field="chapterName"]');
          const startInput = row.querySelector('[data-field="start"]');
          const endInput = row.querySelector('[data-field="end"]');
          
          while (state.tempBookUnits.rows.length <= index) {
            state.tempBookUnits.rows.push({ chapterName: '', start: '', end: '', standardUnitIds: [] });
          }
          state.tempBookUnits.rows[index] = {
            chapterName: chapterNameInput?.value || '',
            start: startInput?.value || '',
            end: endInput?.value || '',
            standardUnitIds: [...row.querySelectorAll('[data-field="chapterStandardUnit"]:checked')].map(input => input.value).filter(Boolean)
          };
        });
        render();
      };
    });
  }

  await ensureSeedData();
  await migrateDefaultTeachers();
  subscribe();
  applyThemeColor(state.loginConfig.primaryColor, state.loginConfig.fontFamily, state.loginConfig.fontScale);
  render();

  // 화면 크기 변경 시 sticky 바 위치 재계산
  window.addEventListener('resize', () => syncStickyBarPosition());
}
