export const RUBRIC_ITEMS = [
  { key: 'assignment', label: '과제 수행률', automatic: true, input: 'automatic' },
  { key: 'expression', label: '풀이 표현력', legacyKeys: ['writing'], input: 'manual' },
  { key: 'grading', label: '채점 성실도', legacyKeys: ['logic'], input: 'manual' },
  { key: 'attitude', label: '수업 태도', legacyKeys: ['checking', 'attitude'], input: 'manual' },
  { key: 'understanding', label: '개념 이해도', legacyKeys: ['retention'], input: 'manual' },
  { key: 'application', label: '응용 해결력', legacyKeys: ['application'], input: 'manual' }
];

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

export function pageResolutionKey(sourceInspectionId, page) {
  return `${sourceInspectionId}:${Number(page)}`;
}

function normalizePageList(pages) {
  const pageList = Array.isArray(pages) ? pages : parseMissedPages(pages);

  return [...new Set(pageList.map(Number).filter(page => !Number.isNaN(page)))].sort((a, b) => a - b);
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') {
    const millis = Number(value.toMillis());
    return Number.isNaN(millis) ? 0 : millis;
  }
  if (value instanceof Date) {
    const millis = value.getTime();
    return Number.isNaN(millis) ? 0 : millis;
  }
  if (typeof value === 'number') return Number.isNaN(value) ? 0 : value;
  if (typeof value === 'string') {
    const millis = new Date(value).getTime();
    return Number.isNaN(millis) ? 0 : millis;
  }

  return 0;
}

function inspectionOrder(inspection, fallbackIndex = 0) {
  const dateMillis = toMillis(inspection?.date);
  const timestampMillis = toMillis(inspection?.createdAt) || toMillis(inspection?.updatedAt);

  return {
    dateMillis: dateMillis || timestampMillis,
    timestampMillis,
    fallbackIndex
  };
}

function compareInspectionOrder(a, b) {
  if (a.dateMillis !== b.dateMillis) return a.dateMillis - b.dateMillis;
  if (a.timestampMillis !== b.timestampMillis) return a.timestampMillis - b.timestampMillis;
  return a.fallbackIndex - b.fallbackIndex;
}

function cutoffOrderForDate(value) {
  const dateMillis = toMillis(value);
  if (!dateMillis) return null;

  return {
    dateMillis,
    timestampMillis: Number.MAX_SAFE_INTEGER,
    fallbackIndex: Number.MAX_SAFE_INTEGER
  };
}

function isSameStudentBookInspection(inspection, studentId, bookId, editingInspectionId) {
  return (
    inspection?.id !== editingInspectionId &&
    inspection?.studentId === studentId &&
    inspection?.bookId === bookId
  );
}

export function buildCarryoverRows({
  inspections,
  studentId,
  bookId,
  editingInspectionId = '',
  currentDate = '',
  currentInspectionDate = ''
}) {
  const cutoffOrder = cutoffOrderForDate(currentInspectionDate || currentDate);
  const targets = (inspections || [])
    .map((inspection, index) => ({ inspection, order: inspectionOrder(inspection, index) }))
    .filter(({ inspection }) => {
      return isSameStudentBookInspection(inspection, studentId, bookId, editingInspectionId);
    })
    .filter(({ order }) => {
      return !cutoffOrder || compareInspectionOrder(order, cutoffOrder) < 0;
    });

  return targets
    .map(({ inspection: source, order: sourceOrder }) => {
      const sourcePages = normalizePageList(source.missedPages);
      const resolvedPages = targets
        .filter(candidate => compareInspectionOrder(candidate.order, sourceOrder) > 0)
        .flatMap(candidate => candidate.inspection.carryoverResolutions || [])
        .filter(resolution => resolution?.sourceInspectionId === source.id)
        .flatMap(resolution => normalizePageList(resolution.resolvedPages));
      const resolvedPageSet = new Set(resolvedPages);
      const remainingPages = sourcePages.filter(page => !resolvedPageSet.has(page));

      return {
        sourceInspectionId: source.id,
        sourceDate: source.date || '',
        missedPages: remainingPages,
        resolvedPages: sourcePages.filter(page => resolvedPageSet.has(page)),
        order: sourceOrder
      };
    })
    .filter(row => row.missedPages.length > 0)
    .sort((a, b) => compareInspectionOrder(b.order, a.order))
    .map(({ order, ...row }) => row);
}

export function calculateCarryoverRecoveryRate(carryoverRows, selectedKeys) {
  const selectedKeySet = new Set(selectedKeys || []);
  const totalPages = (carryoverRows || []).reduce((sum, row) => sum + normalizePageList(row.missedPages).length, 0);
  const resolvedPages = (carryoverRows || []).reduce((sum, row) => {
    const selectedPageCount = normalizePageList(row.missedPages).filter(page => {
      return selectedKeySet.has(pageResolutionKey(row.sourceInspectionId, page));
    }).length;

    return sum + selectedPageCount;
  }, 0);
  const remainingPages = totalPages - resolvedPages;
  const recoveryRate = totalPages ? Math.round((resolvedPages / totalPages) * 100) : 0;

  return { totalPages, resolvedPages, remainingPages, recoveryRate };
}

export function buildCarryoverResolutions(carryoverRows, selectedKeys) {
  const selectedKeySet = new Set(selectedKeys || []);

  return (carryoverRows || [])
    .map(row => {
      const resolvedPages = normalizePageList(row.missedPages).filter(page => {
        return selectedKeySet.has(pageResolutionKey(row.sourceInspectionId, page));
      });

      return {
        sourceInspectionId: row.sourceInspectionId,
        sourceDate: row.sourceDate || '',
        resolvedPages
      };
    })
    .filter(resolution => resolution.resolvedPages.length > 0);
}

export function normalizeRubricScores(scores = {}) {
  return RUBRIC_ITEMS.filter(item => !item.automatic).reduce((normalized, item) => {
    const candidateKeys = [item.key, ...(item.legacyKeys || []).filter(key => key !== item.key)];
    const scoreKey = candidateKeys.find(key => Object.hasOwn(scores, key));
    const value = scoreKey ? scores[scoreKey] : undefined;
    const score = value === null || value === undefined || value === '' ? Number.NaN : Number(value);

    normalized[item.key] = Number.isNaN(score)
      ? null
      : Math.min(10, Math.max(0, Math.round(score * 2) / 2));
    return normalized;
  }, {});
}
