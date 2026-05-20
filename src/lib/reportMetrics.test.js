import { describe, expect, it } from 'vitest';
import {
  averageCompletionRate,
  averageRubricVector,
  bookRubricAverage,
  classProgressRate,
  classRubricAverage,
  groupInspectionsByBook,
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
});
