import { describe, it, expect, vi } from 'vitest';
import { renderReportsView, reportForStudent, reportForClass } from './reportsView.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

describe('reportsView', () => {
  const state = {
    students: [
      { id: 's1', name: '김다인', classId: 'c1', school: '열린중', grade: '중2' },
      { id: 's2', name: '박서준', classId: 'c1', school: '열린중', grade: '중2' }
    ],
    classes: [{ id: 'c1', name: '중2 A반', teacherId: 't1' }],
    books: [{ id: 'b1', title: '중등 수학' }],
    inspections: [
      {
        id: 'i1',
        date: '2026-05-20',
        classId: 'c1',
        studentId: 's1',
        bookId: 'b1',
        rangeStart: 1,
        rangeEnd: 10,
        missedPages: [3],
        completionRate: 90,
        rubricScores: {
          expression: 8,
          grading: 7,
          attitude: 9,
          understanding: 8,
          application: 6
        }
      }
    ]
  };

  const deps = {
    studentById: vi.fn(id => state.students.find(student => student.id === id)),
    classById: vi.fn(id => state.classes.find(klass => klass.id === id)),
    studentsForClass: vi.fn(classId => state.students.filter(student => student.classId === classId)),
    inspectionsForStudent: vi.fn(studentId => state.inspections.filter(row => row.studentId === studentId)),
    groupInspectionsByBook: vi.fn(rows => rows.reduce((grouped, row) => {
      grouped[row.bookId] = grouped[row.bookId] || [];
      grouped[row.bookId].push(row);
      return grouped;
    }, {})),
    bookById: vi.fn(id => state.books.find(book => book.id === id)),
    averageCompletionRate: vi.fn(() => 90),
    fmtDate: vi.fn(date => date || ''),
    teacherNameById: vi.fn(() => '김선생'),
    safe: vi.fn(value => String(value ?? '')),
    progressTone: vi.fn(() => ({ bar: '#4169e1' })),
    studentRubricAverage: vi.fn(() => ({
      assignment: 9,
      expression: 8,
      grading: 7,
      attitude: 9,
      understanding: 8,
      application: 6
    })),
    bookRubricAverage: vi.fn(() => ({
      assignment: 8,
      expression: 7,
      grading: 6,
      attitude: 8,
      understanding: 7,
      application: 5
    })),
    classRubricAverage: vi.fn(() => ({
      assignment: 7,
      expression: 6,
      grading: 6,
      attitude: 7,
      understanding: 6,
      application: 5
    })),
    students: state.students,
    inspections: state.inspections
  };

  it('학생 보고서에 교재별/반 평균 6요소 비교를 표시한다', () => {
    const html = reportForStudent('s1', state, deps);

    expect(html).toContain('교재별 6요소 비교');
    expect(html).toContain('반 평균 6요소 비교');
    expect(html).toContain('풀이 표현력');
  });

  it('학생 보고서는 progressTone 의존성이 없어도 기본 색상으로 렌더링한다', () => {
    const { progressTone, ...depsWithoutProgressTone } = deps;

    expect(() => reportForStudent('s1', state, depsWithoutProgressTone)).not.toThrow();
    expect(reportForStudent('s1', state, depsWithoutProgressTone)).toContain('완료율 90%');
  });

  it('보고서 선택 화면은 학생/반 선택 라벨과 값을 안전하게 이스케이프한다', () => {
    const maliciousStudent = '<img src=x onerror=alert(1)>';
    const maliciousClass = '<svg onload=alert(1)>';
    const maliciousStudentId = 's"><img src=x onerror=alert(1)>';
    const maliciousClassId = 'c"><svg onload=alert(1)>';
    const xssState = {
      currentTeacher: { id: 't1', role: 'teacher' },
      classes: [{ id: maliciousClassId, name: maliciousClass, teacherId: 't1' }],
      students: [{ id: maliciousStudentId, name: maliciousStudent, classId: maliciousClassId }],
      reportStudentId: maliciousStudentId,
      reportClassId: maliciousClassId,
      printHtml: ''
    };
    const xssDeps = {
      teacherClasses: vi.fn(() => xssState.classes),
      classById: vi.fn(() => xssState.classes[0]),
      safe: vi.fn(escapeHtml)
    };

    const html = renderReportsView(xssState, xssDeps);

    expect(html).toContain('학생별 보고서 출력');
    expect(html).toContain('반별 전체 진행표 출력');
    expect(html).not.toContain(maliciousStudent);
    expect(html).not.toContain(maliciousClass);
    expect(html).not.toContain(maliciousStudentId);
    expect(html).not.toContain(maliciousClassId);
    expect(html).toContain(escapeHtml(maliciousStudent));
    expect(html).toContain(escapeHtml(maliciousClass));
    expect(html).toContain(escapeHtml(maliciousStudentId));
    expect(html).toContain(escapeHtml(maliciousClassId));
    expect(html).toContain(`data-value="${escapeHtml(maliciousStudentId)}" class="choice-button btn-choice-teacher selected"`);
    expect(html).toContain(`data-value="${escapeHtml(maliciousClassId)}" class="choice-button btn-choice-teacher selected"`);
  });

  it('반 보고서에 학생별 6요소 표를 표시한다', () => {
    const html = reportForClass('c1', state, deps);

    expect(html).toContain('풀이 표현력');
    expect(html).toContain('응용 해결력');
    expect(html).toContain('김다인');
  });
});
