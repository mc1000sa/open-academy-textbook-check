import { describe, expect, it } from 'vitest';
import {
  buildReportRounds,
  formatRoundFileName,
  selectedRoundDate,
  getInspectionRoundsMap

} from './reportRounds.js';

describe('reportRounds', () => {
  const inspections = [
    { id: 'old', classId: 'c1', studentId: 's1', bookId: 'b1', date: '2026-04-30' },
    { id: 'first-a', classId: 'c1', studentId: 's1', bookId: 'b1', date: '2026-05-02' },
    { id: 'first-b', classId: 'c1', studentId: 's1', bookId: 'b2', date: '2026-05-02' },
    { id: 'second', classId: 'c1', studentId: 's2', bookId: 'b1', date: '2026-05-11' },
    { id: 'other-class', classId: 'c2', studentId: 's3', bookId: 'b1', date: '2026-05-05' }
  ];

  it('groups class inspection dates after the start date into stable rounds', () => {
    const rounds = buildReportRounds({
      inspections,
      classId: 'c1',
      startDate: '2026-05-01'
    });

    expect(rounds).toEqual([
      { round: 1, date: '2026-05-02', displayDate: '05.02.토', fileDate: '05.02.토', count: 2 },
      { round: 2, date: '2026-05-11', displayDate: '05.11.월', fileDate: '05.11.월', count: 1 }
    ]);
  });

  it('resets rounds when the report start date changes', () => {
    const rounds = buildReportRounds({
      inspections,
      classId: 'c1',
      startDate: '2026-05-10'
    });

    expect(rounds.map(round => `${round.round}:${round.fileDate}`)).toEqual(['1:05.11.월']);
  });

  it('can limit available rounds to a selected student', () => {
    const rounds = buildReportRounds({
      inspections,
      classId: 'c1',
      studentId: 's1',
      startDate: '2026-05-01'
    });

    expect(rounds.map(round => `${round.round}:${round.fileDate}:${round.count}`)).toEqual(['1:05.02.토:2']);
  });

  it('returns the selected round date and filename using the round display date', () => {
    const rounds = buildReportRounds({
      inspections,
      classId: 'c1',
      startDate: '2026-05-01'
    });

    expect(selectedRoundDate(rounds, 2)).toBe('2026-05-11');
    expect(formatRoundFileName({
      teacherName: '수최',
      className: '고1 서울대2반',
      studentName: '고준화',
      round: rounds[0]
    })).toBe('[수최t] 고1 서울대2반 - 고준화 (1회차-05.02.토).png');
  });

  it('builds a date-to-round mapping Map from student inspections', () => {
    const studentInsps = [
      { date: '2026-05-02' },
      { date: '2026-05-11' },
      { date: '2026-05-02' }
    ];
    const map = getInspectionRoundsMap(studentInsps);
    expect(map.get('2026-05-02')).toBe(1);
    expect(map.get('2026-05-11')).toBe(2);
  });
});
