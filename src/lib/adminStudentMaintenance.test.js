import { describe, expect, it } from 'vitest';
import {
  applyNameReplacement,
  buildBulkStudentUpdatePayload,
  calculateStudentDeleteAfter,
  studentsDueForDeletion
} from './adminStudentMaintenance.js';

describe('adminStudentMaintenance', () => {
  it('calculates a delete-after date about three months after withdrawal', () => {
    const deleteAfter = calculateStudentDeleteAfter(new Date('2026-01-01T00:00:00.000Z'));

    expect(deleteAfter.toISOString()).toBe('2026-04-03T00:00:00.000Z');
  });

  it('finds withdrawn students whose delete-after date has passed', () => {
    const students = [
      { id: 's1', status: 'withdrawn', deleteAfter: new Date('2026-04-01T00:00:00.000Z') },
      { id: 's2', status: 'withdrawn', deleteAfter: new Date('2026-05-01T00:00:00.000Z') },
      { id: 's3', status: 'active', deleteAfter: new Date('2026-04-01T00:00:00.000Z') }
    ];

    expect(studentsDueForDeletion(students, new Date('2026-04-10T00:00:00.000Z')).map(s => s.id)).toEqual(['s1']);
  });

  it('builds bulk update payload only from filled fields', () => {
    expect(buildBulkStudentUpdatePayload({ grade: '고2', classId: '' })).toEqual({ grade: '고2' });
  });

  it('applies simple name replacement for bulk edits', () => {
    expect(applyNameReplacement('고1 김민수', '고1', '고2')).toBe('고2 김민수');
  });
});
