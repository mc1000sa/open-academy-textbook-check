import { describe, it, expect, vi } from 'vitest';
import { renderReportsView, reportForStudent, reportForClass } from './reportsView.js';

describe('ReportsView Components', () => {
  const mockState = {
    currentTeacher: { id: 't_kim', name: '김선생', role: 'teacher' },
    classes: [{ id: 'c1', name: '중3 A반', teacherId: 't_kim' }],
    students: [{ id: 's1', name: '김다인', classId: 'c1', school: '파주중', grade: '중3' }],
    books: [{ id: 'b1', title: '중3 수학' }],
    inspections: [
      {
        id: 'insp1',
        date: '2026-05-20',
        classId: 'c1',
        studentId: 's1',
        bookId: 'b1',
        rangeStart: 1,
        rangeEnd: 10,
        missedPages: [3, 5],
        completionRate: 80,
        units: ['1단원'],
        memo: '개념 이해 우수'
      }
    ],
    reportStudentId: 's1',
    reportClassId: 'c1',
    printHtml: ''
  };

  const mockDeps = {
    teacherClasses: vi.fn(() => mockState.classes),
    classById: vi.fn(() => mockState.classes[0]),
    studentById: vi.fn(() => mockState.students[0]),
    studentsForClass: vi.fn(() => mockState.students),
    inspectionsForStudent: vi.fn(() => mockState.inspections),
    groupInspectionsByBook: vi.fn(() => ({ b1: mockState.inspections })),
    bookById: vi.fn(() => mockState.books[0]),
    averageCompletionRate: vi.fn(() => 80),
    fmtDate: vi.fn((d) => d),
    teacherNameById: vi.fn(() => '김선생'),
    safe: vi.fn((val) => val),
    progressTone: vi.fn(() => ({ badge: 'text-emerald-400', bar: '#00d6cd' }))
  };

  it('should render main reports view correctly', () => {
    const html = renderReportsView(mockState, mockDeps);
    expect(html).toContain('학생별 보고서 출력');
    expect(html).toContain('반별 전체 진행표 출력');
    expect(html).toContain('김다인'); // 학생 목록 렌더 확인
    expect(html).toContain('중3 A반'); // 반 목록 렌더 확인
  });

  it('should generate reportForStudent correctly', () => {
    const html = reportForStudent('s1', mockState, mockDeps);
    expect(html).toContain('학생 교재 분석 보고서');
    expect(html).toContain('김다인');
    expect(html).toContain('중3 수학');
    expect(html).toContain('완료율 80%');
    expect(html).toContain('개념 이해 우수');
  });

  it('should generate reportForClass correctly', () => {
    const html = reportForClass('c1', mockState, mockDeps);
    expect(html).toContain('반별 교재 현황표');
    expect(html).toContain('중3 A반');
    expect(html).toContain('김선생');
    expect(html).toContain('김다인');
    expect(html).toContain('80%');
  });
});
