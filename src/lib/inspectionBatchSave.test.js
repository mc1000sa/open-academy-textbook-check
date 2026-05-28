import { describe, expect, it } from 'vitest';
import {
  buildAutoSaveInspectionPayload,
  findClassAutoSaveTargets,
  hasSameNormalInspectionRange
} from './inspectionBatchSave.js';

describe('inspectionBatchSave', () => {
  const students = [
    { id: 's1', name: '가나', classId: 'class-a', active: true },
    { id: 's2', name: '다라', classId: 'class-a', active: true },
    { id: 's3', name: '마바', classId: 'class-a', active: true },
    { id: 's4', name: '비활성', classId: 'class-a', active: false }
  ];

  it('개인 저장과 같은 날짜/교재/범위 기준으로만 자동저장 대상에서 제외한다', () => {
    const inspections = [
      {
        id: 'old-different-range',
        studentId: 's2',
        bookId: 'book-a',
        date: '2026-05-28',
        rangeStart: 1,
        rangeEnd: 5,
        deleted: false
      },
      {
        id: 'old-same-range',
        studentId: 's3',
        bookId: 'book-a',
        date: '2026-05-28',
        rangeStart: 10,
        rangeEnd: 20,
        deleted: false
      }
    ];

    const targets = findClassAutoSaveTargets({
      students,
      currentStudentId: 's1',
      selectedClassId: 'class-a',
      currentBookId: 'book-a',
      selectedDate: '2026-05-28',
      rangeStart: 10,
      rangeEnd: 20,
      inspections,
      assignedBookIds: ['book-a']
    });

    expect(targets.map(student => student.id)).toEqual(['s2']);
  });

  it('삭제된 같은 범위 기록은 자동저장을 막지 않는다', () => {
    expect(hasSameNormalInspectionRange({
      inspections: [
        {
          studentId: 's2',
          bookId: 'book-a',
          date: '2026-05-28',
          rangeStart: 10,
          rangeEnd: 20,
          deleted: true
        }
      ],
      studentId: 's2',
      bookId: 'book-a',
      date: '2026-05-28',
      rangeStart: 10,
      rangeEnd: 20
    })).toBe(false);
  });

  it('자동저장 payload는 개인 정상 저장 양식의 핵심 필드를 그대로 갖고 100% 완료로 저장한다', () => {
    const payload = buildAutoSaveInspectionPayload({
      basePayload: {
        teacherId: 'teacher-a',
        teacherName: '홍길동',
        classId: 'class-a',
        bookId: 'book-a',
        date: '2026-05-28',
        rangeStart: 10,
        rangeEnd: 20,
        units: ['일차함수'],
        standardUnitIds: ['unit-1'],
        updatedAt: 'SERVER_TIME'
      },
      student: { id: 's2' },
      timestamp: 'SERVER_TIME'
    });

    expect(payload).toMatchObject({
      teacherId: 'teacher-a',
      teacherName: '홍길동',
      classId: 'class-a',
      studentId: 's2',
      bookId: 'book-a',
      date: '2026-05-28',
      attendanceStatus: 'normal',
      rangeStart: 10,
      rangeEnd: 20,
      missedPages: [],
      carryoverResolutions: [],
      carryoverRecovery: { totalPages: 0, resolvedPages: 0, remainingPages: 0, recoveryRate: 0 },
      completionRate: 100,
      units: ['일차함수'],
      standardUnitIds: ['unit-1'],
      memo: '',
      rubricScores: {
        expression: null,
        grading: null,
        attitude: null,
        understanding: null,
        application: null
      },
      updatedAt: 'SERVER_TIME',
      createdAt: 'SERVER_TIME'
    });
  });
});
