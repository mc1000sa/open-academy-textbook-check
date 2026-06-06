import { describe, expect, it } from 'vitest';
import {
  averageCompletionRate,
  averageRubricVector,
  bookRubricAverage,
  bookRubricAverageForActiveStudents,
  classProgressRate,
  classRubricAverage,
  groupInspectionsByBook,
  rubricComparisonForStudentClass,
  rubricComparisonForStudentBook,
  studentBookRubricAverage,
  studentRubricAverage
} from './reportMetrics.js';

describe('reportMetrics', () => {
  it('calculates a rounded average completion rate', () => {
    expect(averageCompletionRate([{ completionRate: 80 }, { completionRate: 91 }])).toBe(86);
    expect(averageCompletionRate([])).toBe(0);
    expect(averageCompletionRate()).toBe(0);
  });

  it('groups inspections by book id', () => {
    const grouped = groupInspectionsByBook([
      { bookId: 'b1', completionRate: 80 },
      { bookId: 'b2', completionRate: 70 },
      { bookId: 'b1', completionRate: 90 }
    ]);

    expect(Object.keys(grouped)).toEqual(['b1', 'b2']);
    expect(grouped.b1).toHaveLength(2);
    expect(grouped.b2).toHaveLength(1);
    expect(groupInspectionsByBook()).toEqual({});
  });

  it('calculates class progress from active class students and inspections', () => {
    const students = [
      { id: 's1', classId: 'c1', active: true },
      { id: 's2', classId: 'c1', active: false },
      { id: 's3', classId: 'c2', active: true }
    ];
    const inspections = [
      { studentId: 's1', completionRate: 100 },
      { studentId: 's1', completionRate: 80 },
      { studentId: 's2', completionRate: 0 },
      { studentId: 's3', completionRate: 50 }
    ];

    expect(classProgressRate('c1', students, inspections)).toBe(90);
    expect(classProgressRate('missing', students, inspections)).toBe(0);
    expect(classProgressRate('c1', null, null)).toBe(0);
  });

  it('calculates assignment and manual rubric averages while ignoring null values', () => {
    const inspections = [
      {
        completionRate: 83,
        rubricScores: {
          expression: 8,
          grading: null,
          attitude: 9,
          understanding: 7,
          application: 10
        }
      },
      {
        completionRate: 92,
        rubricScores: {
          writing: 9,
          logic: 8,
          checking: '',
          retention: 8,
          application: null
        }
      }
    ];

    expect(averageRubricVector(inspections)).toEqual({
      assignment: 8.8,
      expression: 8.5,
      grading: 8,
      attitude: 9,
      understanding: 7.5,
      application: 10
    });
  });

  it('uses an explicit assignment rubric score for special attendance records', () => {
    expect(averageRubricVector([
      {
        attendanceStatus: 'absent',
        completionRate: 0,
        rubricScores: {
          assignment: 1,
          expression: 1,
          grading: 1,
          attitude: 1,
          understanding: 1,
          application: 1
        }
      }
    ])).toEqual({
      assignment: 1,
      expression: 1,
      grading: 1,
      attitude: 1,
      understanding: 1,
      application: 1
    });
  });

  it('returns 0 for rubric factors that have no values', () => {
    const emptyVector = {
      assignment: 0,
      expression: 0,
      grading: 0,
      attitude: 0,
      understanding: 0,
      application: 0
    };

    expect(averageRubricVector()).toEqual(emptyVector);
    expect(averageRubricVector(null)).toEqual(emptyVector);
    expect(averageRubricVector([{ completionRate: null, rubricScores: {} }])).toEqual({
      assignment: 0,
      expression: 0,
      grading: 0,
      attitude: 0,
      understanding: 0,
      application: 0
    });
  });

  it('returns zero rubric vectors for missing helper inputs', () => {
    const emptyVector = {
      assignment: 0,
      expression: 0,
      grading: 0,
      attitude: 0,
      understanding: 0,
      application: 0
    };

    expect(studentRubricAverage('s1')).toEqual(emptyVector);
    expect(bookRubricAverage('b1', null)).toEqual(emptyVector);
    expect(classRubricAverage('c1', null, null)).toEqual(emptyVector);
  });

  it('filters student, book, and class rubric averages correctly', () => {
    const students = [
      { id: 's1', classId: 'c1', active: true },
      { id: 's2', classId: 'c1', active: false },
      { id: 's3', classId: 'c2', active: true }
    ];
    const inspections = [
      { studentId: 's1', bookId: 'b1', completionRate: 100, rubricScores: { expression: 10 } },
      { studentId: 's1', bookId: 'b2', completionRate: 60, rubricScores: { expression: 6 } },
      { studentId: 's2', bookId: 'b1', completionRate: 0, rubricScores: { expression: 0 } },
      { studentId: 's3', bookId: 'b1', completionRate: 80, rubricScores: { expression: 8 } }
    ];

    expect(studentRubricAverage('s1', inspections)).toMatchObject({
      assignment: 8,
      expression: 8
    });
    expect(bookRubricAverage('b1', inspections)).toMatchObject({
      assignment: 6,
      expression: 6
    });
    expect(classRubricAverage('c1', students, inspections)).toMatchObject({
      assignment: 8,
      expression: 8
    });
  });

  it('averages the same textbook across all classes and excludes inactive class students', () => {
    const students = [
      { id: 's1', classId: 'c1', active: true },
      { id: 's2', classId: 'c1', active: false },
      { id: 's3', classId: 'c2', active: true }
    ];
    const inspections = [
      { studentId: 's1', bookId: 'shared-book', completionRate: 90, rubricScores: { expression: 9 } },
      { studentId: 's2', bookId: 'shared-book', completionRate: 10, rubricScores: { expression: 1 } },
      { studentId: 's3', bookId: 'shared-book', completionRate: 70, rubricScores: { expression: 7 } }
    ];

    expect(bookRubricAverage('shared-book', inspections)).toMatchObject({
      assignment: 5.7,
      expression: 5.7
    });
    expect(classRubricAverage('c1', students, inspections)).toMatchObject({
      assignment: 9,
      expression: 9
    });
  });

  it('calculates student-book and active textbook average vectors for report radar comparison', () => {
    const students = [
      { id: 's1', active: true },
      { id: 's2', active: true },
      { id: 's3', active: false },
      { id: 's4', active: true, status: 'promoted' }
    ];
    const inspections = [
      { studentId: 's1', bookId: 'b1', completionRate: 100, rubricScores: { expression: 10 } },
      { studentId: 's1', bookId: 'b2', completionRate: 50, rubricScores: { expression: 5 } },
      { studentId: 's2', bookId: 'b1', completionRate: 80, rubricScores: { expression: 8 } },
      { studentId: 's3', bookId: 'b1', completionRate: 10, rubricScores: { expression: 1 } },
      { studentId: 's4', bookId: 'b1', completionRate: 20, rubricScores: { expression: 2 } }
    ];

    expect(studentBookRubricAverage('s1', 'b1', inspections)).toMatchObject({
      assignment: 10,
      expression: 10
    });
    expect(bookRubricAverageForActiveStudents('b1', students, inspections)).toMatchObject({
      assignment: 9,
      expression: 9
    });
    expect(rubricComparisonForStudentBook({
      studentId: 's1',
      bookId: 'b1',
      students,
      inspections
    })).toMatchObject({
      studentVector: { assignment: 10, expression: 10 },
      bookAverageVector: { assignment: 9, expression: 9 }
    });
  });

  it('calculates student and class average vectors for class radar comparison', () => {
    const students = [
      { id: 's1', classId: 'c1', active: true },
      { id: 's2', classId: 'c1', active: true },
      { id: 's3', classId: 'c2', active: true }
    ];
    const inspections = [
      { studentId: 's1', completionRate: 100, rubricScores: { expression: 10 } },
      { studentId: 's2', completionRate: 80, rubricScores: { expression: 8 } },
      { studentId: 's3', completionRate: 20, rubricScores: { expression: 2 } }
    ];

    expect(rubricComparisonForStudentClass({
      studentId: 's1',
      classId: 'c1',
      students,
      inspections
    })).toMatchObject({
      studentVector: { assignment: 10, expression: 10 },
      classAverageVector: { assignment: 9, expression: 9 }
    });
  });

  it('calculates cumulative completion rates as assignment scores over multiple rounds', () => {
    const inspections = [
      {
        id: 'i1',
        studentId: 's1',
        bookId: 'b1',
        date: '2026-05-20',
        rangeStart: 10,
        rangeEnd: 20,
        completionRate: 82, // 11쪽 중 2쪽 미완료 -> 9쪽 완료 (81.8%)
        missedPages: [10, 11],
        rubricScores: {}
      },
      {
        id: 'i2',
        studentId: 's1',
        bookId: 'b1',
        date: '2026-05-27',
        rangeStart: 21,
        rangeEnd: 30,
        completionRate: 90, // 10쪽 중 1쪽 미완료 -> 9쪽 완료 (90.0%)
        missedPages: [21],
        carryoverResolutions: [
          { sourceInspectionId: 'i1', sourceDate: '2026-05-20', resolvedPages: [10] }
        ],
        rubricScores: {}
      }
    ];

    // i1 시점(2026-05-20)의 누적 완료율:
    // 누적 점검: 10~20 (11쪽)
    // 최종 미완료: 10, 11 (2쪽)
    // 완료율: (11 - 2)/11 = 81.8% -> 8.2점
    const vec1 = averageRubricVector([inspections[0]]);
    expect(vec1.assignment).toBe(8.2);

    // i2 시점(2026-05-27)의 누적 완료율:
    // 누적 점검: 10~30 (21쪽)
    // 이월된 미완료 중 해결 안 된 것: 11 (1쪽)
    // 이번 미완료: 21 (1쪽)
    // 최종 미완료: 11, 21 (2쪽)
    // 완료율: (21 - 2)/21 = 90.5% -> 9.0점
    const vec2 = averageRubricVector(inspections);
    // 두 점검 기록의 평균 assignment를 계산하므로:
    // i1 시점의 assignment: 8.2
    // i2 시점의 assignment: 9.0 (누적 반영)
    // 평균 assignment = (8.2 + 9.0) / 2 = 8.6
    expect(vec2.assignment).toBe(8.6);
  });
});
