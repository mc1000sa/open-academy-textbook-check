export function sortBookUnits(book) {
  return [...(book?.units || [])].sort((a, b) => Number(a.start) - Number(b.start));
}

export function parseMissedPages(text) {
  const pages = String(text || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
    .flatMap(chunk => {
      if (chunk.includes('-')) {
        const [start, end] = chunk.split('-').map(Number);
        if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
          return Array.from({ length: end - start + 1 }, (_, index) => start + index);
        }
      }

      const page = Number(chunk);
      return Number.isNaN(page) ? [] : [page];
    });

  return [...new Set(pages)].sort((a, b) => a - b);
}

export function pagesInRange(start, end) {
  const first = Number(start);
  const last = Number(end);

  if (Number.isNaN(first) || Number.isNaN(last) || last < first) return [];

  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

export function unitsForRange(book, start, end) {
  return sortBookUnits(book).filter(unit => {
    return !(Number(unit.end) < Number(start) || Number(unit.start) > Number(end));
  });
}

export function filterMissedPagesToRange(text, start, end) {
  const first = Number(start);
  const last = Number(end);

  return parseMissedPages(text).filter(page => {
    return !Number.isNaN(first) && !Number.isNaN(last) && page >= first && page <= last;
  });
}

export function calculateCompletionRate(totalPages, missedPages) {
  if (!totalPages.length) return 0;

  return Math.round(((totalPages.length - missedPages.length) / totalPages.length) * 100);
}
