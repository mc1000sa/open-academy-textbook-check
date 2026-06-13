import { describe, expect, it } from 'vitest';
import { getAttendancePresetRange } from './attendanceDates.js';

describe('getAttendancePresetRange', () => {
  const referenceDate = new Date(2026, 5, 13, 12, 0, 0);

  it('오늘을 포함한 최근 2주 범위를 계산한다', () => {
    expect(getAttendancePresetRange('2weeks', referenceDate)).toEqual({
      start: '2026-05-31',
      end: '2026-06-13'
    });
  });

  it('오늘을 포함한 최근 3주 범위를 계산한다', () => {
    expect(getAttendancePresetRange('3weeks', referenceDate)).toEqual({
      start: '2026-05-24',
      end: '2026-06-13'
    });
  });

  it('한달 조회는 현재 달 1일부터 오늘까지 계산한다', () => {
    expect(getAttendancePresetRange('month', referenceDate)).toEqual({
      start: '2026-06-01',
      end: '2026-06-13'
    });
  });
});
