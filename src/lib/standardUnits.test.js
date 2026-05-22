import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STANDARD_UNIT_SUBJECTS,
  normalizeStandardUnitSubjects,
  standardUnitLabelsForIds
} from './standardUnits.js';

describe('standardUnits', () => {
  it('defines unique standard unit ids across every subject', () => {
    const ids = DEFAULT_STANDARD_UNIT_SUBJECTS.flatMap(subject => subject.units.map(unit => unit.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps probability and statistics free of duplicate permutation/combination basics', () => {
    const probStats = DEFAULT_STANDARD_UNIT_SUBJECTS.find(subject => subject.code === 'probability_statistics');
    expect(probStats.units.map(unit => unit.label)).not.toContain('순열');
    expect(probStats.units.map(unit => unit.label)).not.toContain('조합');
  });

  it('resolves current labels from standard ids', () => {
    const subjects = normalizeStandardUnitSubjects([
      {
        code: 'sample',
        label: '샘플',
        units: [{ id: 'u1', label: '수정된 단원명' }]
      }
    ]);

    expect(standardUnitLabelsForIds(subjects, ['u1'])).toEqual(['수정된 단원명']);
  });

  it('sorts subjects by order values after inserted units shift existing orders', () => {
    const subjects = normalizeStandardUnitSubjects([
      {
        code: 'sample',
        label: '샘플',
        units: [
          { id: 'u1', label: '1번', order: 1 },
          { id: 'u3', label: '새 2번', order: 2 },
          { id: 'u2', label: '기존 2번', order: 3 }
        ]
      }
    ]);

    expect(subjects[0].units.map(unit => unit.label)).toEqual(['1번', '새 2번', '기존 2번']);
  });
});
