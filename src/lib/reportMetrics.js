import { RUBRIC_ITEMS, normalizeRubricScores } from './textbookProgress.js';

const RUBRIC_VECTOR_KEYS = RUBRIC_ITEMS.map(item => item.key);
const MANUAL_RUBRIC_KEYS = RUBRIC_ITEMS.filter(item => !item.automatic).map(item => item.key);

function toValidNumber(value) {
  if (value === null || value === undefined || value === '') return null;

  const number = Number(value);
  return Number.isNaN(number) ? null : number;
}

function roundToOneDecimal(value) {
  return Math.round(value * 10) / 10;
}

export function averageCompletionRate(inspections) {
  const rows = inspections || [];

  if (!rows.length) return 0;

  const total = rows.reduce((sum, inspection) => {
    return sum + Number(inspection.completionRate || 0);
  }, 0);

  return Math.round(total / rows.length);
}

export function averageRubricVector(inspections) {
  const rows = inspections || [];
  const totals = Object.fromEntries(RUBRIC_VECTOR_KEYS.map(key => [key, 0]));
  const counts = Object.fromEntries(RUBRIC_VECTOR_KEYS.map(key => [key, 0]));

  rows.forEach(inspection => {
    const completionRate = toValidNumber(inspection?.completionRate);
    if (completionRate !== null) {
      totals.assignment += completionRate / 10;
      counts.assignment += 1;
    }

    const rubricScores = normalizeRubricScores(inspection?.rubricScores || inspection || {});
    MANUAL_RUBRIC_KEYS.forEach(key => {
      const score = rubricScores[key];
      if (score === null) return;

      totals[key] += score;
      counts[key] += 1;
    });
  });

  return Object.fromEntries(
    RUBRIC_VECTOR_KEYS.map(key => [
      key,
      counts[key] ? roundToOneDecimal(totals[key] / counts[key]) : 0
    ])
  );
}

export function groupInspectionsByBook(inspections) {
  return (inspections || []).reduce((grouped, inspection) => {
    grouped[inspection.bookId] = grouped[inspection.bookId] || [];
    grouped[inspection.bookId].push(inspection);
    return grouped;
  }, {});
}

export function classProgressRate(classId, students, inspections) {
  const activeStudentIds = new Set(
    (students || [])
      .filter(student => student.classId === classId && student.active !== false)
      .map(student => student.id)
  );

  if (!activeStudentIds.size) return 0;

  const rows = (inspections || []).filter(inspection => activeStudentIds.has(inspection.studentId));

  return averageCompletionRate(rows);
}

export function studentRubricAverage(studentId, inspections) {
  return averageRubricVector((inspections || []).filter(inspection => inspection.studentId === studentId));
}

export function bookRubricAverage(bookId, inspections) {
  return averageRubricVector((inspections || []).filter(inspection => inspection.bookId === bookId));
}

export function classRubricAverage(classId, students, inspections) {
  const activeStudentIds = new Set(
    (students || [])
      .filter(student => student.classId === classId && student.active !== false)
      .map(student => student.id)
  );

  return averageRubricVector((inspections || []).filter(inspection => activeStudentIds.has(inspection.studentId)));
}
