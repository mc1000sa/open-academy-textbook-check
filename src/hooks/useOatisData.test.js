import { describe, expect, it } from 'vitest';
import { mergeInspectionLists } from './useOatisData.js';

describe('useOatisData inspection helpers', () => {
  it('학생 포털 비교용 내 기록과 반 기록을 중복 없이 합친다', () => {
    const ownRows = [
      { id: 'mine-1', studentId: 's1', classId: 'c1', bookId: 'b1', completionRate: 80 },
      { id: 'mine-2', studentId: 's1', classId: 'c1', bookId: 'b2', completionRate: 90 }
    ];
    const classRows = [
      { id: 'mine-1', studentId: 's1', classId: 'c1', bookId: 'b1', completionRate: 80 },
      { id: 'peer-1', studentId: 's2', classId: 'c1', bookId: 'b1', completionRate: 60 }
    ];

    expect(mergeInspectionLists(ownRows, classRows)).toEqual([
      { id: 'mine-1', studentId: 's1', classId: 'c1', bookId: 'b1', completionRate: 80 },
      { id: 'mine-2', studentId: 's1', classId: 'c1', bookId: 'b2', completionRate: 90 },
      { id: 'peer-1', studentId: 's2', classId: 'c1', bookId: 'b1', completionRate: 60 }
    ]);
  });
});
