import { describe, expect, it } from 'vitest';
import {
  calculateCompletionRate,
  filterMissedPagesToRange,
  pagesInRange,
  parseMissedPages,
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
});
