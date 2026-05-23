import { describe, expect, it, vi } from 'vitest';
import { renderBookSetupView } from './bookSetupView.js';
import { DEFAULT_STANDARD_UNIT_SUBJECTS } from '../../lib/standardUnits.js';

describe('renderBookSetupView', () => {
  const baseState = {
    currentTeacher: { id: 'admin', role: 'admin' },
    classes: [{ id: 'class1', name: '고1 서울대2반', grade: '고1' }],
    books: [
      {
        id: 'book1',
        title: '공통수학1 RPM',
        subject: '공통수학1',
        grade: '고1',
        archived: false,
        units: []
      }
    ],
    formBook: { title: '', subject: '공통수학1', grade: '고1', publisher: '' },
    formUnit: { name: '', start: '', end: '', standardUnitIds: [] },
    selectedBookManageId: 'book1',
    bulkUnitText: '',
    bookSetupAccordion: { manage: true, unit: true, assign: true },
    assigningClassId: 'class1',
    standardUnitSubjects: DEFAULT_STANDARD_UNIT_SUBJECTS
  };

  const deps = {
    teacherClasses: vi.fn(() => []),
    classById: vi.fn(),
    assignedBooksForClass: vi.fn(() => []),
    completedBooksForClass: vi.fn(() => []),
    bookUnits: vi.fn(book => book.units || []),
    safe: vi.fn(value => String(value ?? '')),
    bookById: vi.fn(id => baseState.books.find(book => book.id === id)),
    standardSubjectForBook: vi.fn(() => DEFAULT_STANDARD_UNIT_SUBJECTS[0]),
    standardUnitNames: vi.fn(() => []),
    fmtDate: vi.fn(() => '2026.05.22')
  };

  it('renders the standard-unit table for the selected textbook subject', () => {
    const html = renderBookSetupView(baseState, deps);

    expect(html).toContain('표준소단원 기준 단원표');
    expect(html).toContain('다항식의 연산');
    expect(html).toContain('data-standard-unit-row');
    expect(html).toContain('data-field="unitName"');
  });

  it('renders class textbook progress controls separately from completed history', () => {
    const html = renderBookSetupView(baseState, {
      ...deps,
      assignedBooksForClass: vi.fn(() => [{ link: { id: 'link1' }, book: baseState.books[0] }]),
      completedBooksForClass: vi.fn(() => [{ link: { id: 'link2', completedAt: '2026-05-22' }, book: baseState.books[0] }])
    });

    expect(html).toContain('현재 진행 중 교재');
    expect(html).toContain('data-action="complete-assign"');
    expect(html).toContain('완료된 교재 이력');
    expect(html).toContain('data-action="reactivate-assign"');
  });
});
