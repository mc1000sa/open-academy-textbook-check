import { describe, it, expect, vi } from 'vitest';
import { renderInspectionsView, REMARK_GROUPS } from './inspectionsView.js';
import {
  buildCarryoverRows,
  calculateCarryoverRecoveryRate,
  pageResolutionKey,
  RUBRIC_ITEMS
} from '../../lib/textbookProgress.js';

describe('InspectionsView Component', () => {
  const mockState = {
    currentTeacher: { id: 't_kim', name: '김선생', role: 'teacher' },
    classes: [{ id: 'c1', name: '중3 A반' }],
    students: [{ id: 's1', name: '김다인', classId: 'c1' }],
    books: [{ id: 'b1', title: '중3 수학', archived: false, units: [] }],
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
        completionRate: 80
      }
    ],
    selectedInspectionClassId: 'c1',
    selectedInspectionStudentId: 's1',
    selectedInspectionBookId: 'b1',
    selectedRangeStart: '1',
    selectedRangeEnd: '10',
    selectedDate: '2026-05-20',
    missedPages: '3,5',
    memo: '열심히 함',
    editingInspectionId: '',
    quickClassId: 'c1',
    inspectionHistoryFilterClass: '',
    inspectionHistoryFilterStudent: '',
    selectedCarryoverResolutionKeys: []
  };

  const mockDeps = {
    teacherClasses: vi.fn(() => mockState.classes),
    studentsForClass: vi.fn(() => mockState.students),
    assignedBooksForClass: vi.fn(() => [{ book: mockState.books[0] }]),
    bookById: vi.fn(() => mockState.books[0]),
    unitsForRange: vi.fn(() => [{ name: '1단원', color: '#ff0000', start: 1, end: 10 }]),
    pagesInRange: vi.fn(() => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
    missedPagesArrayInCurrentRange: vi.fn(() => [3, 5]),
    inspectionsForStudent: vi.fn(() => mockState.inspections),
    fmtDate: vi.fn((d) => d),
    classById: vi.fn(() => mockState.classes[0]),
    studentById: vi.fn(() => mockState.students[0]),
    safe: vi.fn((val) => val),
    bookUnits: vi.fn(() => []),
    buildCarryoverRows,
    calculateCarryoverRecoveryRate,
    pageResolutionKey,
    RUBRIC_ITEMS
  };

  it('should render inspection view correctly with state data', () => {
    const html = renderInspectionsView(mockState, mockDeps);

    expect(html).toContain('학생별 교재점검');
    expect(html).toContain('중3 A반');
    expect(html).toContain('김다인');
    expect(html).toContain('중3 수학');
    expect(html).toContain('80%'); // 완료율
  });

  it('should define REMARK_GROUPS properly', () => {
    expect(REMARK_GROUPS.length).toBeGreaterThan(0);
    expect(REMARK_GROUPS[0].label).toBe('과제 수행률');
    expect(REMARK_GROUPS[0].positive.length).toBeGreaterThan(0);
  });

  it('should apply editing state description when editingInspectionId is present', () => {
    const editingState = {
      ...mockState,
      editingInspectionId: 'insp1'
    };
    const html = renderInspectionsView(editingState, mockDeps);
    expect(html).toContain('기존 기록 수정 중');
  });

  it('should render carryover resolution UI and canonical rubric scores input UI', () => {
    const html = renderInspectionsView(mockState, mockDeps);

    expect(html).toContain('data-action="toggle-carryover-resolution"');
    expect(html).toContain('data-source-inspection-id="insp1"');
    expect(html).toContain('data-action="reset-rubric-scores"');
    expect(html).toContain('data-key="expression"');
    expect(html).toContain('data-action="adjust-rubric-score"');
  });

  it('선택한 점검일보다 미래 기록은 이전 미완료 후보로 렌더링하지 않는다', () => {
    const datedState = {
      ...mockState,
      selectedDate: '2026-05-20',
      inspections: [
        {
          id: 'past-insp',
          date: '2026-05-10',
          classId: 'c1',
          studentId: 's1',
          bookId: 'b1',
          rangeStart: 1,
          rangeEnd: 10,
          missedPages: [3],
          completionRate: 90
        },
        {
          id: 'future-insp',
          date: '2026-05-30',
          classId: 'c1',
          studentId: 's1',
          bookId: 'b1',
          rangeStart: 11,
          rangeEnd: 20,
          missedPages: [7],
          completionRate: 90
        }
      ]
    };
    const datedDeps = {
      ...mockDeps,
      inspectionsForStudent: vi.fn(() => datedState.inspections)
    };

    const html = renderInspectionsView(datedState, datedDeps);

    expect(html).toContain('data-source-inspection-id="past-insp"');
    expect(html).not.toContain('data-source-inspection-id="future-insp"');
  });

  it('should render separate current completion and carryover recovery labels', () => {
    const html = renderInspectionsView(mockState, mockDeps);

    expect(html).toContain('이번 회차 완료율');
    expect(html).toContain('지난 미완료 재검 완료율');
    expect(html).not.toContain('통합 과제 수행률');
  });

  it('should display selected canonical rubric score value', () => {
    const scoredState = {
      ...mockState,
      rubricScores: {
        expression: 8,
        grading: null,
        attitude: null,
        understanding: null,
        application: null
      }
    };
    const html = renderInspectionsView(scoredState, mockDeps);

    expect(html).toContain('8점');
    expect(html).toContain('data-key="expression"');
  });
});
