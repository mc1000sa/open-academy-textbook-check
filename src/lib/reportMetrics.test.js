import { describe, expect, it } from 'vitest';
import { averageCompletionRate, classProgressRate, groupInspectionsByBook } from './reportMetrics.js';

describe('reportMetrics', () => {
  it('calculates a rounded average completion rate', () => {
    expect(averageCompletionRate([{ completionRate: 80 }, { completionRate: 91 }])).toBe(86);
    expect(averageCompletionRate([])).toBe(0);
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
  });
});
