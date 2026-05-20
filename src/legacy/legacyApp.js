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
  bookRubricAverage,
  classProgressRate,
  classRubricAverage,
  groupInspectionsByBook,
  studentRubricAverage
} from '../lib/reportMetrics.js';
import { renderDashboardView } from './views/dashboardView.js';
import { renderLayoutView } from './views/layoutView.js';
import { renderLoginView } from './views/loginView.js';
import { renderSetupView } from './views/setupView.js';
import { renderBookSetupView } from './views/bookSetupView.js';
import { renderInspectionsView } from './views/inspectionsView.js';
import { renderReportsView, reportForStudent, reportForClass } from './views/reportsView.js';
import { renderTeachersAdminView } from './views/teachersAdminView.js';
import { renderStudentPortalView } from './views/studentPortalView.js'; // [NEW]

export async function mountLegacyApp(appRoot) {
  if (!appRoot) throw new Error('Legacy app root is required.');

  const { db, refs } = await getFirebaseService();

  const COLORS = ['#FDE68A','#BFDBFE','#DDD6FE','#A7F3D0','#FBCFE8','#FECACA','#C7D2FE','#BBF7D0'];
  const GRADE_OPTIONS = ['고1','고2','고3'];
  const SUBJECT_OPTIONS = ['수학','영어','국어','과학'];

  const state = {
    loading: true,
    portal: 'gateway', // 'gateway' | 'student' | 'teacher' | 'admin'
    loginStep: 'login', // 'login' | 'register' | 'change-pin'
    currentTeacher: null,
    selectedTeacherName: '',
    pin: '',
    view: 'inspections', // inspections | reports | setup | teachersAdmin
    teachers: [],
    classes: [],
    students: [],
    books: [],
    classBooks: [],
    inspections: [],
    selectedSetupClassId: '',
    setupFormClass: { name: '', grade: '', teacherId: '', note: '' },
    studentBulkText: '',
    studentBulkMode: 'nameSchool',
    selectedBookManageId: '',
    formBook: { title: '', subject: '수학', grade: '', publisher: '열린학원', active: true },
    formUnit: { name: '', start: '', end: '' },
    bulkUnitText: '',
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
    dashboardTeacherFilter: 'all',
    dashboardMetricFocus: 'students',
    saveMsg: '',
    printHtml: '',
    inspectionHistoryFilterStudent: '',
    inspectionHistoryFilterClass: '',
    adminTeacherForm: { id: '', name: '', pin: '', role: 'teacher' },
    adminTeacherEditId: '',
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
    studentLoginForm: { classId: '', grade: '', studentId: '', name: '', pin: '', school: '' },
    studentSession: null, // 학생 포털 로그인 성공 세션
    
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
      loginTitle: '빠른 PIN 로그인',
      loginDescription: '선생님을 선택하고 4자리 PIN을 입력하세요.',
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
      loginTitle: '',
      loginDescription: '',
      loginInfoText: '',
      primaryColor: '',
      fontFamily: '',
      fontScale: ''
    },
    adminCardExpanded: {}
  };

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
  function bookUnits(book) {
    return sortBookUnits(book);
  }
  function studentsForClass(classId) {
    return state.students.filter(s => s.classId === classId && s.active !== false).sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'));
  }
  function assignedBooksForClass(classId) {
    return state.classBooks.filter(x => x.classId === classId && x.active !== false).sort((a, b) => Number(a.order || 0) - Number(b.order || 0)).map(x => ({ link: x, book: bookById(x.bookId) })).filter(x => x.book && !x.book.archived);
  }
  function inspectionsForStudent(studentId) {
    return state.inspections.filter(i => i.studentId === studentId).sort((a, b) => String(b.date).localeCompare(String(a.date)));
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
        loginTitle: '빠른 PIN 로그인',
        loginDescription: '선생님을 선택하고 4자리 PIN을 입력하세요.',
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
      { id: 't_admin', name: '관리자', pin: '9999', role: 'admin', active: true },
      { id: 't_kim', name: '수최', pin: '1234', role: 'teacher', active: true },
      { id: 't_lee', name: 'Joy', pin: '2345', role: 'teacher', active: true }
    ].forEach(t => batch.set(doc(db, COLLECTION_NAMES.teachers, t.id), { ...t, createdAt: serverTimestamp() }));
    [
      { id: 'b1', title: '중3 영어 시험대비', subject: '영어', grade: '중3', publisher: '열린학원', active: true, archived: false, units: [{ id: uid(), name: '문법 1', start: 1, end: 20, color: pastel(0) }, { id: uid(), name: '문법 2', start: 21, end: 45, color: pastel(1) }, { id: uid(), name: '서술형', start: 46, end: 70, color: pastel(2) }] },
      { id: 'b2', title: '고1 독해 특강', subject: '영어', grade: '고1', publisher: '열린학원', active: true, archived: false, units: [{ id: uid(), name: 'Unit 1', start: 1, end: 25, color: pastel(3) }, { id: uid(), name: 'Unit 2', start: 26, end: 52, color: pastel(4) }, { id: uid(), name: 'Unit 3', start: 53, end: 88, color: pastel(5) }] }
    ].forEach(b => batch.set(doc(db, COLLECTION_NAMES.books, b.id), { ...b, createdAt: serverTimestamp() }));
    [
      { id: 'c1', name: '중3 A반', teacherId: 't_kim', grade: '중3', note: '시험대비반', active: true },
      { id: 'c2', name: '고1 독해반', teacherId: 't_lee', grade: '고1', note: '독해집중', active: true }
    ].forEach(c => batch.set(doc(db, COLLECTION_NAMES.classes, c.id), { ...c, createdAt: serverTimestamp() }));
    [
      { id: 's1', name: '김다인', classId: 'c1', grade: '중3', school: '파주중', active: true, pin: '1234', pinFailedCount: 0, pinLocked: false },
      { id: 's2', name: '박서윤', classId: 'c1', grade: '중3', school: '문산중', active: true, pin: '1234', pinFailedCount: 0, pinLocked: false },
      { id: 's3', name: '이하준', classId: 'c2', grade: '고1', school: '파주고', active: true, pin: '1234', pinFailedCount: 0, pinLocked: false }
    ].forEach(s => batch.set(doc(db, COLLECTION_NAMES.students, s.id), { ...s, createdAt: serverTimestamp() }));
    [
      { id: 'cb1', classId: 'c1', bookId: 'b1', order: 1, main: true, active: true },
      { id: 'cb2', classId: 'c2', bookId: 'b2', order: 1, main: true, active: true }
    ].forEach(l => batch.set(doc(db, COLLECTION_NAMES.classBooks, l.id), { ...l, createdAt: serverTimestamp() }));

    await batch.commit();
  }

  async function migrateDefaultTeachers() {
    const teacherSnap = await getDocs(refs.teachers);
    if (teacherSnap.empty) return;
    const renameMap = {
      t_kim: { name: '수최', pin: '1234', role: 'teacher', active: true },
      t_lee: { name: 'Joy', pin: '2345', role: 'teacher', active: true },
      t_admin: { name: '관리자', pin: '9999', role: 'admin', active: true }
    };
    const batch = writeBatch(db);
    let changed = 0;
    teacherSnap.docs.forEach(snap => {
      const next = renameMap[snap.id];
      if (!next) return;
      const data = snap.data() || {};
      const needsUpdate = data.name !== next.name || String(data.pin || '') !== String(next.pin) || data.role !== next.role || data.active === false;
      if (!needsUpdate) return;
      batch.update(doc(db, COLLECTION_NAMES.teachers, snap.id), { ...next, updatedAt: serverTimestamp() });
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
    if (!/^\d{4}$/.test(String(form.pin || ''))) return showModalAlert('PIN은 4자리 숫자로 입력해주세요.');
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

  function subscribe() {
    onSnapshot(refs.teachers, snap => { state.teachers = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.active !== false); render(); });
    onSnapshot(refs.classes, snap => { state.classes = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.active !== false); if (!state.selectedSetupClassId && state.classes.length) state.selectedSetupClassId = state.classes[0].id; if (!state.assigningClassId && state.classes.length) state.assigningClassId = state.classes[0].id; render(); });
    onSnapshot(refs.students, snap => { state.students = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.active !== false); render(); });
    onSnapshot(refs.books, snap => { state.books = snap.docs.map(d => ({ id: d.id, ...d.data() })); render(); });
    onSnapshot(refs.classBooks, snap => { state.classBooks = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.active !== false); render(); });
    onSnapshot(refs.inspections, snap => { state.inspections = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.deleted !== true); state.loading = false; render(); });
    onSnapshot(refs.configs, snap => {
      const docLoginSplash = snap.docs.find(d => d.id === 'login_splash');
      if (docLoginSplash) {
        state.loginConfig = { ...state.loginConfig, ...docLoginSplash.data() };
        state.adminLoginConfigForm = { ...state.adminLoginConfigForm, ...docLoginSplash.data() };
        applyThemeColor(state.loginConfig.primaryColor, state.loginConfig.fontFamily, state.loginConfig.fontScale);
      }
      render();
    });
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
    if (!selectedTeacherId) return showModalAlert('선생님을 먼저 선택해주세요.');
    const teacher = state.teachers.find(t => String(t.id || '').trim() === selectedTeacherId);
    if (!teacher) return showModalAlert('선생님 정보를 찾을 수 없습니다.');
    if (String(teacher.pin || '').replace(/\D/g, '') !== normalizedPin) return showModalAlert('PIN이 올바르지 않습니다.');
    
    state.currentTeacher = teacher;
    state.view = 'inspections';
    const firstClass = teacher.role === 'admin' ? state.classes[0] : teacherClasses(teacher.id)[0];
    state.selectedSetupClassId = firstClass?.id || '';
    state.assigningClassId = firstClass?.id || '';
    state.selectedInspectionClassId = firstClass?.id || '';
    state.quickClassId = firstClass?.id || '';
    state.reportClassId = firstClass?.id || '';
    
    if (teacher.role === 'admin') {
      state.portal = 'admin';
      state.view = 'setup';
    } else {
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
    state.studentLoginForm = { classId: '', grade: '', studentId: '', name: '', pin: '', school: '' };
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

    const regPin = String(form.pin || '').replace(/\D/g, '').trim();
    if (!/^\d{4}$/.test(regPin)) {
      return showModalAlert('초기 PIN은 4자리 숫자로 입력해야 합니다.');
    }

    await addDoc(refs.students, {
      name: cleanName,
      school: cleanSchool,
      grade: klass.grade,
      classId: form.classId,
      pin: regPin,
      pinFailedCount: 0,
      pinLocked: false,
      active: true,
      createdAt: serverTimestamp()
    });

    await showModalAlert('학생 등록이 완료되었습니다. 설정하신 4자리 PIN으로 로그인해 주세요.');
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
      await updateDoc(doc(refs.classes, f.id), { name: f.name, teacherId: f.teacherId, grade: f.grade, note: f.note });
      state.selectedSetupClassId = f.id;
      notify('반 수정 완료');
    } else {
      const ref = await addDoc(refs.classes, { name: f.name, teacherId: f.teacherId, grade: f.grade, note: f.note, active: true, createdAt: serverTimestamp() });
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

  async function saveBook() {
    const f = state.formBook;
    if (!f.title) return showModalAlert('교재명을 입력해주세요.');
    if (state.editingBookId) {
      await updateDoc(doc(db, COLLECTION_NAMES.books, state.editingBookId), { ...f, updatedAt: serverTimestamp() });
      state.editingBookId = '';
    } else {
      await addDoc(refs.books, { ...f, units: [], archived: false, createdAt: serverTimestamp() });
    }
    state.formBook = { title: '', subject: '수학', grade: '', publisher: '열린학원', active: true };
    notify('교재 저장 완료');
  }

  async function cloneBook(bookId) {
    const source = bookById(bookId);
    if (!source) return;
    await addDoc(refs.books, { title: source.title + ' 복제본', subject: source.subject, grade: source.grade, publisher: source.publisher, active: true, archived: false, units: (source.units || []).map(u => ({ ...u, id: uid() })), createdAt: serverTimestamp() });
    notify('교재 복제 완료');
  }

  async function saveUnit() {
    const book = bookById(state.selectedBookManageId);
    if (!book) return showModalAlert('교재를 먼저 선택해주세요.');
    const start = Number(state.formUnit.start), end = Number(state.formUnit.end);
    if (!state.formUnit.name || !start || !end) return showModalAlert('단원명과 페이지를 입력해주세요.');
    if (end < start) return showModalAlert('끝 페이지는 시작 페이지보다 크거나 같아야 합니다.');
    const overlap = bookUnits(book).some(u => !(Number(u.end) < start || Number(u.start) > end));
    if (overlap) return showModalAlert('기존 단원과 페이지가 겹칩니다.');
    const units = [...bookUnits(book), { id: uid(), name: state.formUnit.name, start, end, color: pastel(bookUnits(book).length) }];
    await updateDoc(doc(db, COLLECTION_NAMES.books, book.id), { units, updatedAt: serverTimestamp() });
    state.formUnit = { name: '', start: '', end: '' };
    notify('단원 추가 완료');
  }

  async function saveUnitBulk() {
    const book = bookById(state.selectedBookManageId);
    if (!book) return showModalAlert('교재를 먼저 선택해주세요.');
    const lines = String(state.bulkUnitText || '').split('\n').map(v => v.trim()).filter(Boolean);
    if (!lines.length) return showModalAlert('붙여넣기 단원 텍스트를 입력해주세요.');
    const next = [...bookUnits(book)];
    for (const line of lines) {
      const [name, s, e] = line.split('/').map(v => v.trim());
      const start = Number(s), end = Number(e);
      if (!name || isNaN(start) || isNaN(end) || end < start) continue;
      const overlap = next.some(u => !(Number(u.end) < start || Number(u.start) > end));
      if (overlap) continue;
      next.push({ id: uid(), name, start, end, color: pastel(next.length) });
    }
    await updateDoc(doc(db, COLLECTION_NAMES.books, book.id), { units: next, updatedAt: serverTimestamp() });
    state.bulkUnitText = '';
    notify('붙여넣기 단원 반영 완료');
  }

  async function toggleArchiveBook(bookId, archived) {
    await updateDoc(doc(db, COLLECTION_NAMES.books, bookId), { archived: !archived, updatedAt: serverTimestamp() });
    notify(archived ? '교재 복구 완료' : '교재 보관 완료');
  }

  async function assignBook(classId, bookId) {
    if (!classId || !bookId) return showModalAlert('반과 교재를 선택해주세요.');
    const exists = state.classBooks.find(x => x.classId === classId && x.bookId === bookId && x.active !== false);
    if (exists) return showModalAlert('이미 배정된 교재입니다.');
    const order = assignedBooksForClass(classId).length + 1;
    await addDoc(refs.classBooks, { classId, bookId, order, main: order === 1, active: true, createdAt: serverTimestamp() });
    notify('반별 교재 배정 완료');
    render();
  }

  async function removeAssign(linkId) {
    const ok = await showModalConfirm('이 반에서 해당 교재 배정을 해제하시겠습니까?');
    if (!ok) return;
    await updateDoc(doc(db, COLLECTION_NAMES.classBooks, linkId), { active: false, updatedAt: serverTimestamp() });
    notify('배정 해제 완료');
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
    render();
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
      editingInspectionId: excludeInspectionId
    });
  }
  function selectedCarryoverKeysSet() {
    return new Set(state.selectedCarryoverResolutionKeys || []);
  }
  function resetRubricScores() {
    state.rubricScores = normalizeRubricScores({});
  }
  function buildPageChecks() {
    const startEl = document.getElementById('selectedRangeStart');
    const endEl = document.getElementById('selectedRangeEnd');
    if (startEl) state.selectedRangeStart = startEl.value;
    if (endEl) state.selectedRangeEnd = endEl.value;
    const start = Number(state.selectedRangeStart), end = Number(state.selectedRangeEnd);
    if (isNaN(start) || isNaN(end) || end < start) return showModalAlert('시작 페이지와 끝 페이지를 먼저 올바르게 입력해주세요.');
    render();
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
    const units = unitsForRange(book, start, end).map(u => u.name);
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
      ? `\n지난 미완료 회수: ${carryoverRecovery.resolvedPages}/${carryoverRecovery.totalPages}쪽 (${carryoverRecovery.recoveryRate}%)`
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
      appRoot.innerHTML = loginScreen();
      bind();
      return;
    }

    // 학생 단독 대시보드 포털 렌더링
    if (state.portal === 'student') {
      if (!state.studentSession) {
        appRoot.innerHTML = loginScreen();
        bind();
        return;
      }
      const content = renderStudentPortalView(state, {
        inspectionsForStudent,
        bookById,
        bookUnits,
        averageCompletionRate,
        groupInspectionsByBook,
        fmtDate,
        safe,
        progressTone,
        unitsForRange
      });
      appRoot.innerHTML = layout(content);
      bind();
      return;
    }

    // 교사 및 관리자 포털 렌더링
    if (!state.currentTeacher) {
      appRoot.innerHTML = loginScreen();
      bind();
      return;
    }

    const content = state.view === 'inspections'
      ? renderInspectionsView(state, { 
          teacherClasses, studentsForClass, assignedBooksForClass, bookById, 
          unitsForRange, pagesInRange, missedPagesArrayInCurrentRange, 
          inspectionsForStudent, fmtDate, classById, studentById, safe, bookUnits,
          buildCarryoverRows, calculateCarryoverRecoveryRate, pageResolutionKey, RUBRIC_ITEMS
        })
      : state.view === 'reports'
      ? renderReportsView(state, { teacherClasses, classById, safe })
      : state.view === 'setup'
      ? renderSetupView(state, { 
          teacherClasses, classById, studentsForClass, assignedBooksForClass, 
          bookUnits, teacherNameById, safe, filterByKeyword, 
          existingStudentProfilesForClass, bookById, setupProgress, findDuplicateStudentName 
        })
      : state.view === 'bookSetup'
      ? renderBookSetupView(state, { 
          teacherClasses, classById, assignedBooksForClass, 
          bookUnits, safe, filterByKeyword, 
          bookById 
        })
      : renderTeachersAdminView(state, { safe, teacherNameById });

    appRoot.innerHTML = layout(content);
    bind();
  }

  function bind() {
    // 공통 메뉴 및 뷰 전환 바인딩
    appRoot.querySelectorAll('[data-action="view"]').forEach(el => el.onclick = () => { 
      state.view = el.dataset.view; 
      render(); 
    });

    // 게이트웨이 전환 버튼 바인딩
    appRoot.querySelectorAll('[data-action="switch-portal"]').forEach(el => el.onclick = () => {
      state.portal = el.dataset.portal;
      state.loginStep = 'login';
      state.pin = '';
      state.selectedTeacherName = '';
      state.studentLoginForm = { classId: '', grade: '', studentId: '', name: '', pin: '', school: '' };
      
      if (el.dataset.portal === 'admin') {
        const adminTeacher = state.teachers.find(t => t.role === 'admin') || { id: 't_admin' };
        state.selectedTeacherName = adminTeacher.id;
      }
      render();
    });

    // 관문으로 돌아가기 (로그아웃 포함)
    appRoot.querySelectorAll('[data-action="goto-gateway"]').forEach(el => el.onclick = () => {
      state.portal = 'gateway';
      state.currentTeacher = null;
      state.studentSession = null;
      state.pin = '';
      state.selectedTeacherName = '';
      state.studentLoginForm = { classId: '', grade: '', studentId: '', name: '', pin: '', school: '' };
      render();
    });

    appRoot.querySelectorAll('[data-action="select-teacher"]').forEach(el => el.onclick = () => { 
      state.selectedTeacherName = el.dataset.id; 
      render(); 
    });

    const loginPin = document.getElementById('loginPin');
    if (loginPin) {
      loginPin.oninput = (e) => state.pin = e.target.value.replace(/\D/g, '');
      loginPin.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleLogin();
        }
      };
    }

    appRoot.querySelector('[data-action="login"]')?.addEventListener('click', handleLogin);
    appRoot.querySelector('[data-action="logout"]')?.addEventListener('click', () => { 
      state.currentTeacher = null; 
      state.studentSession = null;
      state.portal = 'gateway';
      state.pin = ''; 
      state.selectedTeacherName = ''; 
      render(); 
    });

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
      state.studentLoginForm = { classId: '', grade: '', studentId: '', name: '', pin: '', school: '' };
      render();
    });

    const regName = document.getElementById('studentRegName');
    if (regName) regName.oninput = (e) => state.studentLoginForm.name = e.target.value;
    const regSchool = document.getElementById('studentRegSchool');
    if (regSchool) regSchool.oninput = (e) => state.studentLoginForm.school = e.target.value;
    const regPin = document.getElementById('studentRegPin');
    if (regPin) regPin.oninput = (e) => state.studentLoginForm.pin = e.target.value.replace(/\D/g, '').slice(0, 4);
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

    // 커스텀 모달 바인딩 (수락 / 취소)
    appRoot.querySelector('[data-action="modal-confirm"]')?.addEventListener('click', () => {
      if (!state.customModal.open || !state.customModal.resolve) return;
      let resValue = true;
      if (state.customModal.type === 'prompt') {
        const inputEl = document.getElementById('modalPromptInput');
        resValue = inputEl ? inputEl.value : '';
      }
      const res = state.customModal.resolve;
      state.customModal.open = false;
      state.customModal.resolve = null;
      render();
      res(resValue);
    });

    appRoot.querySelector('[data-action="modal-cancel"]')?.addEventListener('click', () => {
      if (!state.customModal.open || !state.customModal.resolve) return;
      const res = state.customModal.resolve;
      state.customModal.open = false;
      state.customModal.resolve = null;
      render();
      res(state.customModal.type === 'prompt' ? null : false);
    });

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
    appRoot.querySelectorAll('[data-action="export-image"]').forEach(el => el.onclick = async () => {
      const targetArea = document.getElementById('reportCaptureArea');
      if (!targetArea) {
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
        const canvas = await window.html2canvas(targetArea, {
          backgroundColor: '#050507',
          useCORS: true,
          scale: 2
        });
        const imageUri = canvas.toDataURL('image/png');
        let fileName = 'OATIS_보고서.png';
        if (state.reportStudentId) {
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
      }
      render();
      setTimeout(() => {
        if (state.saveMsg && (state.saveMsg.includes('완료') || state.saveMsg.includes('생성'))) {
          state.saveMsg = '';
          render();
        }
      }, 3000);
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
        }

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
      'selectedInspectionStudentId', 'selectedInspectionBookId', 'selectedDate', 'selectedRangeStart',
      'selectedRangeEnd', 'quickClassId', 'reportStudentId', 'reportClassId', 'inspectionHistoryFilterClass',
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
        }
        render();
      };
    });
    ['missedPages', 'memo', 'bulkUnitText'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.oninput = (e) => { state[id] = e.target.value; };
    });
    ['selectedRangeStart', 'selectedRangeEnd'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.oninput = (e) => { state[id] = e.target.value; };
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
    document.getElementById('bookTitle')?.addEventListener('input', e => state.formBook.title = e.target.value);
    document.getElementById('bookSubject')?.addEventListener('change', e => state.formBook.subject = e.target.value);
    document.getElementById('bookGrade')?.addEventListener('change', e => state.formBook.grade = e.target.value);
    document.getElementById('bookPublisher')?.addEventListener('input', e => state.formBook.publisher = e.target.value);
    document.getElementById('unitName')?.addEventListener('input', e => state.formUnit.name = e.target.value);
    document.getElementById('unitStart')?.addEventListener('input', e => state.formUnit.start = e.target.value);
    document.getElementById('unitEnd')?.addEventListener('input', e => state.formUnit.end = e.target.value);
    document.getElementById('adminTeacherName')?.addEventListener('input', e => state.adminTeacherForm.name = e.target.value);
    document.getElementById('adminTeacherPin')?.addEventListener('input', e => state.adminTeacherForm.pin = e.target.value.replace(/\D/g, '').slice(0, 4));
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
    appRoot.querySelector('[data-action="reset-book-form"]')?.addEventListener('click', () => { state.formBook = { title: '', subject: '수학', grade: '', publisher: '열린학원', active: true }; state.editingBookId = ''; render(); });
    appRoot.querySelector('[data-action="save-unit"]')?.addEventListener('click', saveUnit);
    appRoot.querySelector('[data-action="save-unit-bulk"]')?.addEventListener('click', saveUnitBulk);
    appRoot.querySelector('[data-action="clear-unit-bulk"]')?.addEventListener('click', () => { state.bulkUnitText = ''; render(); });
    appRoot.querySelectorAll('[data-action="edit-book"]').forEach(el => el.onclick = () => { const b = bookById(el.dataset.id); if (!b) return; state.formBook = { title: b.title || '', subject: b.subject || '', grade: b.grade || '', publisher: b.publisher || '', active: b.active !== false }; state.editingBookId = b.id; state.selectedBookManageId = b.id; render(); });
    appRoot.querySelectorAll('[data-action="clone-book"]').forEach(el => el.onclick = () => cloneBook(el.dataset.id));
    appRoot.querySelectorAll('[data-action="toggle-book-archive"]').forEach(el => el.onclick = () => { const b = bookById(el.dataset.id); if (b) toggleArchiveBook(b.id, !!b.archived); });
    appRoot.querySelectorAll('[data-action="select-book-manage"]').forEach(el => el.onclick = () => { state.selectedBookManageId = el.dataset.id; render(); });
    appRoot.querySelectorAll('[data-action="assign-book"]').forEach(el => el.onclick = () => assignBook(el.dataset.class, el.dataset.book));
    appRoot.querySelectorAll('[data-action="remove-assign"]').forEach(el => el.onclick = () => removeAssign(el.dataset.id));
    appRoot.querySelectorAll('[data-action="move-assign"]').forEach(el => el.onclick = () => moveAssign(el.dataset.id, el.dataset.dir));
    appRoot.querySelector('[data-action="save-inspection"]')?.addEventListener('click', saveInspection);
    appRoot.querySelector('[data-action="build-page-checks"]')?.addEventListener('click', buildPageChecks);
    appRoot.querySelector('[data-action="reset-inspection-form"]')?.addEventListener('click', () => { resetInspectionForm(); render(); });
    appRoot.querySelector('[data-action="clear-missed-pages"]')?.addEventListener('click', () => { state.missedPages = ''; render(); });
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
        bookById, averageCompletionRate, fmtDate, safe, progressTone, bookRubricAverage,
        classRubricAverage, studentRubricAverage, students: state.students,
        inspections: state.inspections
      }); 
      render(); 
      setTimeout(() => {
        document.getElementById('reportPreviewArea')?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    });
    
    appRoot.querySelector('[data-action="build-class-report"]')?.addEventListener('click', () => { 
      state.printHtml = reportForClass(state.reportClassId, state, { 
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

    appRoot.querySelector('[data-action="save-login-config"]')?.addEventListener('click', saveLoginConfig);
    document.getElementById('configSplashTitleLine1')?.addEventListener('input', e => state.adminLoginConfigForm.splashTitleLine1 = e.target.value);
    document.getElementById('configSplashTitleLine2')?.addEventListener('input', e => state.adminLoginConfigForm.splashTitleLine2 = e.target.value);
    document.getElementById('configSplashTitleSizeLine1')?.addEventListener('change', e => { state.adminLoginConfigForm.splashTitleSizeLine1 = e.target.value; render(); });
    document.getElementById('configSplashTitleSizeLine2')?.addEventListener('change', e => { state.adminLoginConfigForm.splashTitleSizeLine2 = e.target.value; render(); });
    document.getElementById('configSplashSubtitle')?.addEventListener('input', e => state.adminLoginConfigForm.splashSubtitle = e.target.value);
    document.getElementById('configSplashDescription')?.addEventListener('input', e => state.adminLoginConfigForm.splashDescription = e.target.value);
    document.getElementById('configLoginTitle')?.addEventListener('input', e => state.adminLoginConfigForm.loginTitle = e.target.value);
    document.getElementById('configLoginDescription')?.addEventListener('input', e => state.adminLoginConfigForm.loginDescription = e.target.value);
    document.getElementById('configLoginInfoText')?.addEventListener('input', e => state.adminLoginConfigForm.loginInfoText = e.target.value);
    document.getElementById('configPrimaryColor')?.addEventListener('input', e => state.adminLoginConfigForm.primaryColor = e.target.value);

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
  }

  await ensureSeedData();
  await migrateDefaultTeachers();
  subscribe();
  applyThemeColor(state.loginConfig.primaryColor, state.loginConfig.fontFamily, state.loginConfig.fontScale);
  render();
}
