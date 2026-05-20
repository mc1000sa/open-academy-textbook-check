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
  teachers: [
    { id: 't_kim', name: '수최', pin: '1234', role: 'teacher', active: true }
  ],
  selectedSetupClassId: 'c1',
  setupFormClass: { name: '새로운 반', grade: '중3', teacherId: 't_kim', note: '' },
  studentBulkMode: 'nameSchool',
  studentBulkText: '',
  existingStudentSearch: '',
  selectedExistingStudentId: '',
  setupAccordion: { class: true, bulk: true, edit: true }
};

const mockDeps = {
  teacherClasses: () => mockState.classes,
  classById: id => mockState.classes.find(c => c.id === id) || null,
  studentsForClass: () => mockState.students,
  teacherNameById: () => '수최',
  safe: escapeHtml,
  filterByKeyword: (rows) => rows,
  existingStudentProfilesForClass: () => []
};

describe('renderSetupView', () => {
  it('renders accordion structure for setup view', () => {
    const html = renderSetupView(mockState, mockDeps);

    expect(html).toContain('반 / 학생 설정');
    expect(html).toContain('1. 신규 반 만들기 및 관리');
    expect(html).toContain('2. 학생 일괄 등록 및 복제');
    expect(html).toContain('3. 기존 반/학생 수정 및 삭제');
  });

  it('renders student list in bulk content', () => {
    const html = renderSetupView(mockState, mockDeps);

    expect(html).toContain('김다인');
  });
});
