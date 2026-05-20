import { describe, expect, it } from 'vitest';
import { renderSetupView } from './setupView.js';

const escapeHtml = value =>
  String(value ?? '').replace(/[&<>"']/g, match => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[match]);

const mockState = {
  currentTeacher: { id: 't_kim', name: '수최', role: 'teacher' },
  classes: [
    { id: 'c1', name: '중3 A반', teacherId: 't_kim', grade: '중3', note: '시험대비반', active: true }
  ],
  students: [
    { id: 's1', name: '김다인', classId: 'c1', grade: '중3', school: '파주중', active: true }
  ],
  books: [
    { id: 'b1', title: '중3 영어 시험대비', subject: '영어', grade: '중3', publisher: '열린학원', active: true, archived: false, units: [] }
  ],
  classBooks: [
    { id: 'cb1', classId: 'c1', bookId: 'b1', order: 1, main: true, active: true }
  ],
  teachers: [
    { id: 't_kim', name: '수최', pin: '1234', role: 'teacher', active: true }
  ],
  selectedSetupClassId: 'c1',
  assigningClassId: 'c1',
  setupFormClass: { name: '새로운 반', grade: '중3', teacherId: 't_kim', note: '' },
  studentBulkMode: 'nameSchool',
  studentBulkText: '',
  existingStudentSearch: '',
  selectedExistingStudentId: '',
  formBook: { title: '새교재', subject: '수학', grade: '중3', publisher: '열린학원', active: true },
  editingBookId: '',
  selectedBookManageId: 'b1',
  formUnit: { name: '', start: '', end: '' },
  bulkUnitText: '',
  wizardOpen: false,
  wizardStep: 1,
  setupDetailPanel: ''
};

const mockDeps = {
  teacherClasses: () => mockState.classes,
  classById: id => mockState.classes.find(c => c.id === id) || null,
  studentsForClass: () => mockState.students,
  assignedBooksForClass: () => [{ link: mockState.classBooks[0], book: mockState.books[0] }],
  bookUnits: () => [],
  teacherNameById: () => '수최',
  safe: escapeHtml,
  filterByKeyword: (rows) => rows,
  existingStudentProfilesForClass: () => [],
  bookById: id => mockState.books.find(b => b.id === id) || null,
  setupProgress: () => [
    { label: '반 생성', done: true },
    { label: '교재 배정', done: true },
    { label: '학생 등록', done: true },
    { label: '운영 시작', done: true }
  ]
};

describe('renderSetupView', () => {
  it('renders default setup view with metrics and form panels', () => {
    const html = renderSetupView(mockState, mockDeps);

    expect(html).toContain('등록 반 수');
    expect(html).toContain('등록 학생 수');
    expect(html).toContain('현재 반 교재 수');
    expect(html).toContain('반 세팅 마법사');
    expect(html).toContain('1. 신규 반 만들기');
    expect(html).toContain('2. 반별 교재 배정');
    expect(html).toContain('3. 학생 일괄 등록');
    expect(html).toContain('4. 교재 자산 관리');
    expect(html).toContain('단원 입력 및 페이지 맵');
  });

  it('renders setup wizard modal when wizardOpen is true', () => {
    const openWizardState = { ...mockState, wizardOpen: true, wizardStep: 1 };
    const html = renderSetupView(openWizardState, mockDeps);

    expect(html).toContain('반 세팅 마법사');
    expect(html).toContain('반 세팅 마법사');
    expect(html).toContain('1. 신규 반 만들기');
  });

  it('renders detail section when setupDetailPanel has value', () => {
    const detailState = { ...mockState, setupDetailPanel: 'classes' };
    const html = renderSetupView(detailState, mockDeps);

    expect(html).toContain('등록된 반 목록');
  });
});
