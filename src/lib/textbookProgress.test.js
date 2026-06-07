import { describe, expect, it } from 'vitest';
import {
  buildCarryoverResolutions,
  buildResolvedCarryoverRows,
  buildSpecialAttendanceInspectionFields,
  buildCarryoverRows,
  calculateCompletionRate,
  calculateCarryoverRecoveryRate,
  filterMissedPagesToRange,
  normalizeRubricScores,
  pagesInRange,
  pageResolutionKey,
  parseMissedPages,
  RUBRIC_ITEMS,
  sortBookUnits,
  unitsForRange
} from './textbookProgress.js';

describe('textbookProgress', () => {
  it('parses single pages, ranges, duplicates, and invalid chunks', () => {
    expect(parseMissedPages('12, 13, 16-18, x, 18, 20-19')).toEqual([12, 13, 16, 17, 18]);
  });

  it('returns every page inside a valid range', () => {
    expect(pagesInRange(3, 6)).toEqual([3, 4, 5, 6]);
    expect(pagesInRange(6, 3)).toEqual([]);
    expect(pagesInRange('a', 3)).toEqual([]);
  });

  it('returns no pages when the range input is empty', () => {
    expect(pagesInRange('', '')).toEqual([]);
    expect(pagesInRange('', 10)).toEqual([]);
    expect(pagesInRange(1, '')).toEqual([]);
  });

  it('sorts book units by start page without mutating the book', () => {
    const book = {
      units: [
        { name: 'B', start: 20, end: 30 },
        { name: 'A', start: 1, end: 10 }
      ]
    };

    expect(sortBookUnits(book).map(unit => unit.name)).toEqual(['A', 'B']);
    expect(book.units.map(unit => unit.name)).toEqual(['B', 'A']);
  });

  it('finds units that overlap a page range', () => {
    const book = {
      units: [
        { name: 'A', start: 1, end: 10 },
        { name: 'B', start: 11, end: 20 },
        { name: 'C', start: 21, end: 30 }
      ]
    };

    expect(unitsForRange(book, 8, 22).map(unit => unit.name)).toEqual(['A', 'B', 'C']);
    expect(unitsForRange(book, 31, 40)).toEqual([]);
  });

  it('filters missed pages to the selected range', () => {
    expect(filterMissedPagesToRange('1, 3-5, 9', 3, 6)).toEqual([3, 4, 5]);
  });

  it('calculates completion rate from total pages and missed pages', () => {
    expect(calculateCompletionRate([1, 2, 3, 4], [2])).toBe(75);
    expect(calculateCompletionRate([], [2])).toBe(0);
  });

  it('defines the six rubric items with assignment as an automatic item', () => {
    expect(RUBRIC_ITEMS).toHaveLength(6);
    expect(RUBRIC_ITEMS[0]).toEqual(expect.objectContaining({
      key: 'assignment',
      label: '과제 수행률',
      automatic: true
    }));
    expect(RUBRIC_ITEMS.map(item => item.label)).toEqual([
      '과제 수행률',
      '풀이 표현력',
      '채점 성실도',
      '수업 태도',
      '개념 이해도',
      '응용 해결력'
    ]);
    expect(RUBRIC_ITEMS.filter(item => !item.automatic).map(({ key, legacyKeys }) => ({ key, legacyKeys }))).toEqual([
      { key: 'expression', legacyKeys: ['writing'] },
      { key: 'grading', legacyKeys: ['logic'] },
      { key: 'attitude', legacyKeys: ['checking', 'attitude'] },
      { key: 'understanding', legacyKeys: ['retention'] },
      { key: 'application', legacyKeys: ['application'] }
    ]);
  });

  it('builds carryover rows for the same student and book while preserving prior records', () => {
    const inspections = [
      {
        id: 'old-a',
        studentId: 'student-1',
        bookId: 'book-1',
        date: '2026-05-01',
        missedPages: [10, 11]
      },
      {
        id: 'other-student',
        studentId: 'student-2',
        bookId: 'book-1',
        date: '2026-05-02',
        missedPages: [12]
      },
      {
        id: 'other-book',
        studentId: 'student-1',
        bookId: 'book-2',
        date: '2026-05-03',
        missedPages: [13]
      },
      {
        id: 'newer',
        studentId: 'student-1',
        bookId: 'book-1',
        date: '2026-05-10',
        missedPages: [20],
        carryoverResolutions: [
          { sourceInspectionId: 'old-a', sourceDate: '2026-05-01', resolvedPages: [10] }
        ]
      },
      {
        id: 'editing',
        studentId: 'student-1',
        bookId: 'book-1',
        date: '2026-05-20',
        missedPages: [99],
        carryoverResolutions: [
          { sourceInspectionId: 'old-a', sourceDate: '2026-05-01', resolvedPages: [11] }
        ]
      }
    ];
    const snapshot = structuredClone(inspections);

    expect(
      buildCarryoverRows({
        inspections,
        studentId: 'student-1',
        bookId: 'book-1',
        editingInspectionId: 'editing'
      })
    ).toEqual([
      {
        sourceInspectionId: 'newer',
        sourceDate: '2026-05-10',
        sourceStatus: 'normal',
        rangeStart: '',
        rangeEnd: '',
        completionRate: 0,
        missedPages: [20],
        resolvedPages: []
      },
      {
        sourceInspectionId: 'old-a',
        sourceDate: '2026-05-01',
        sourceStatus: 'normal',
        rangeStart: '',
        rangeEnd: '',
        completionRate: 0,
        missedPages: [11],
        resolvedPages: [10]
      }
    ]);
    expect(inspections).toEqual(snapshot);
  });

  it('uses timestamp tie-breakers for same-day carryover resolution and newest-first sorting', () => {
    const inspections = [
      {
        id: 'early',
        studentId: 'student-1',
        bookId: 'book-1',
        date: '2026-05-01',
        createdAt: { toMillis: () => 1000 },
        missedPages: [1, 2]
      },
      {
        id: 'middle',
        studentId: 'student-1',
        bookId: 'book-1',
        date: '2026-05-01',
        updatedAt: new Date(2000),
        missedPages: [3],
        carryoverResolutions: [
          { sourceInspectionId: 'early', sourceDate: '2026-05-01', resolvedPages: [1] }
        ]
      },
      {
        id: 'late',
        studentId: 'student-1',
        bookId: 'book-1',
        date: '2026-05-01',
        createdAt: 3000,
        missedPages: [4]
      }
    ];

    expect(
      buildCarryoverRows({
        inspections,
        studentId: 'student-1',
        bookId: 'book-1'
      })
    ).toEqual([
      {
        sourceInspectionId: 'late',
        sourceDate: '2026-05-01',
        sourceStatus: 'normal',
        rangeStart: '',
        rangeEnd: '',
        completionRate: 0,
        missedPages: [4],
        resolvedPages: []
      },
      {
        sourceInspectionId: 'middle',
        sourceDate: '2026-05-01',
        sourceStatus: 'normal',
        rangeStart: '',
        rangeEnd: '',
        completionRate: 0,
        missedPages: [3],
        resolvedPages: []
      },
      {
        sourceInspectionId: 'early',
        sourceDate: '2026-05-01',
        sourceStatus: 'normal',
        rangeStart: '',
        rangeEnd: '',
        completionRate: 0,
        missedPages: [2],
        resolvedPages: [1]
      }
    ]);
  });

  it('orders same-day inspections by createdAt before updatedAt when resolving carryover pages', () => {
    const inspections = [
      {
        id: 'early',
        studentId: 'student-1',
        bookId: 'book-1',
        date: '2026-05-01',
        createdAt: 1000,
        updatedAt: 5000,
        missedPages: [7]
      },
      {
        id: 'later',
        studentId: 'student-1',
        bookId: 'book-1',
        date: '2026-05-01',
        createdAt: 2000,
        missedPages: [8],
        carryoverResolutions: [
          { sourceInspectionId: 'early', sourceDate: '2026-05-01', resolvedPages: [7] }
        ]
      }
    ];

    expect(
      buildCarryoverRows({
        inspections,
        studentId: 'student-1',
        bookId: 'book-1'
      })
    ).toEqual([
      {
        sourceInspectionId: 'later',
        sourceDate: '2026-05-01',
        sourceStatus: 'normal',
        rangeStart: '',
        rangeEnd: '',
        completionRate: 0,
        missedPages: [8],
        resolvedPages: []
      }
    ]);
  });

  it('선택한 점검일 이후 기록은 이전 미완료 후보에서 제외한다', () => {
    const inspections = [
      {
        id: 'past',
        studentId: 'student-1',
        bookId: 'book-1',
        date: '2026-05-10',
        missedPages: [3]
      },
      {
        id: 'future',
        studentId: 'student-1',
        bookId: 'book-1',
        date: '2026-05-30',
        missedPages: [7]
      }
    ];

    expect(
      buildCarryoverRows({
        inspections,
        studentId: 'student-1',
        bookId: 'book-1',
        currentDate: '2026-05-20'
      })
    ).toEqual([
      {
        sourceInspectionId: 'past',
        sourceDate: '2026-05-10',
        sourceStatus: 'normal',
        rangeStart: '',
        rangeEnd: '',
        completionRate: 0,
        missedPages: [3],
        resolvedPages: []
      }
    ]);
  });

  it('calculates recovery rate and resolution payloads from selected carryover page keys', () => {
    const carryoverRows = [
      {
        sourceInspectionId: 'old-a',
        sourceDate: '2026-05-01',
        missedPages: [10, 11],
        resolvedPages: []
      },
      {
        sourceInspectionId: 'old-b',
        sourceDate: '2026-05-03',
        missedPages: [20],
        resolvedPages: [19]
      }
    ];
    const selectedKeys = new Set([
      pageResolutionKey('old-a', 10),
      pageResolutionKey('old-b', 20),
      'unknown:999'
    ]);

    expect(calculateCarryoverRecoveryRate(carryoverRows, selectedKeys)).toEqual({
      totalPages: 3,
      resolvedPages: 2,
      remainingPages: 1,
      recoveryRate: 67
    });
    expect(buildCarryoverResolutions(carryoverRows, selectedKeys)).toEqual([
      {
        sourceInspectionId: 'old-a',
        sourceDate: '2026-05-01',
        resolvedPages: [10]
      },
      {
        sourceInspectionId: 'old-b',
        sourceDate: '2026-05-03',
        resolvedPages: [20]
      }
    ]);
  });

  it('builds a stable carryover page resolution key', () => {
    expect(pageResolutionKey('old-1', 12)).toBe('old-1:12');
    expect(pageResolutionKey('old-1', '012')).toBe('old-1:12');
  });

  it('builds resolved carryover rows for report display', () => {
    const inspections = [
      {
        id: 'old-absent',
        studentId: 'student-1',
        bookId: 'book-1',
        date: '2026-05-01',
        attendanceStatus: 'absent',
        missedPages: [10, 11]
      },
      {
        id: 'current',
        studentId: 'student-1',
        bookId: 'book-1',
        date: '2026-05-08',
        carryoverResolutions: [
          { sourceInspectionId: 'old-absent', resolvedPages: [10] }
        ]
      }
    ];

    expect(buildResolvedCarryoverRows(inspections)).toEqual([
      {
        inspectionId: 'current',
        date: '2026-05-08',
        bookId: 'book-1',
        sourceInspectionId: 'old-absent',
        sourceDate: '2026-05-01',
        sourceStatus: 'absent',
        resolvedPages: [10]
      }
    ]);
  });

  it('builds absent and no-book fields that carry the whole range forward', () => {
    expect(buildSpecialAttendanceInspectionFields({
      attendanceStatus: 'no_book',
      rangeStart: 3,
      rangeEnd: 5
    })).toEqual({
      rangeStart: 3,
      rangeEnd: 5,
      missedPages: [3, 4, 5],
      completionRate: 0,
      memo: '교재 미지참으로 검사 못함.',
      rubricScores: {
        assignment: 1,
        expression: 1,
        grading: 1,
        attitude: 1,
        understanding: 1,
        application: 1
      }
    });

    expect(buildSpecialAttendanceInspectionFields({
      attendanceStatus: 'absent',
      rangeStart: 8,
      rangeEnd: 9,
      memo: '독감'
    }).memo).toBe('결석 - 독감');
  });

  it('normalizes legacy rubric score keys and clamps values to half-point steps', () => {
    expect(
      normalizeRubricScores({
        writing: 8.24,
        logic: 8.26,
        checking: -1,
        attitude: 10.3,
        retention: '6.75',
        application: 11,
        unknown: 7
      })
    ).toEqual({
      expression: 8,
      grading: 8.5,
      attitude: 10,
      understanding: 7,
      application: 10
    });
  });

  it('returns null for missing or invalid manual rubric scores', () => {
    expect(
      normalizeRubricScores({
        writing: '',
        logic: 'not-a-score',
        retention: null
      })
    ).toEqual({
      expression: null,
      grading: null,
      attitude: null,
      understanding: null,
      application: null
    });
  });
});
