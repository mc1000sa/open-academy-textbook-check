import { RUBRIC_ITEMS, normalizeRubricScores, pagesInRange, buildCarryoverRows } from './textbookProgress.js';

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
    const explicitAssignment = toValidNumber(inspection?.rubricScores?.assignment);
    const completionRate = toValidNumber(inspection?.completionRate);
    if (explicitAssignment !== null) {
      totals.assignment += explicitAssignment;
      counts.assignment += 1;
    } else if (completionRate !== null) {
      // 누적 완료율 계산 시도 (해당 시점까지의 점검 이력을 역추적)
      let computedAssignment = null;
      if (inspection.studentId && inspection.bookId) {
        const sameBookLogs = rows.filter(
          r => r.studentId === inspection.studentId && r.bookId === inspection.bookId
        );
        const getMillis = (item) => item?.date ? new Date(item.date).getTime() : 0;
        const targetTime = getMillis(inspection);

        const historyLogs = sameBookLogs.filter(log => {
          const logTime = getMillis(log);
          if (logTime < targetTime) return true;
          if (logTime > targetTime) return false;
          // 동일 날짜인 경우 고유 ID 비교로 선후관계 보장
          return (log.id || '') <= (inspection.id || '');
        });

        const totalPageSet = new Set();
        historyLogs.forEach(log => {
          pagesInRange(log.rangeStart, log.rangeEnd).forEach(p => totalPageSet.add(p));
        });

        const carryoverRows = buildCarryoverRows({
          inspections: sameBookLogs,
          studentId: inspection.studentId,
          bookId: inspection.bookId,
          currentInspectionDate: inspection.date,
          editingInspectionId: inspection.id
        });
        const unresolvedCarryoverPages = carryoverRows.flatMap(row => row.missedPages);
        const currentResolvedPages = new Set(
          (inspection.carryoverResolutions || [])
            .flatMap(res => (res.resolvedPages || []).map(Number))
        );
        const remainingCarryoverPages = unresolvedCarryoverPages.filter(p => !currentResolvedPages.has(p));
        const currentMissedPages = (inspection.missedPages || []).map(Number);
        const missedPageSet = new Set([...remainingCarryoverPages, ...currentMissedPages]);

        const totalPagesCount = totalPageSet.size;
        const missedPagesCount = missedPageSet.size;
        if (totalPagesCount > 0) {
          const cumulativeCompletionRate = Math.round(((totalPagesCount - missedPagesCount) / totalPagesCount) * 100);
          computedAssignment = cumulativeCompletionRate / 10;
        }
      }

      if (computedAssignment !== null) {
        totals.assignment += computedAssignment;
      } else {
        totals.assignment += completionRate / 10;
      }
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

export function studentBookRubricAverage(studentId, bookId, inspections) {
  return averageRubricVector((inspections || []).filter(inspection => {
    return inspection.studentId === studentId && inspection.bookId === bookId;
  }));
}

export function bookRubricAverageForActiveStudents(bookId, students, inspections) {
  const activeStudentIds = new Set(
    (students || [])
      .filter(student => {
        return student.active !== false &&
          student.deleted !== true &&
          student.status !== 'withdrawn' &&
          student.status !== 'promoted';
      })
      .map(student => student.id)
  );

  if (!activeStudentIds.size) return averageRubricVector([]);

  return averageRubricVector((inspections || []).filter(inspection => {
    return inspection.bookId === bookId && activeStudentIds.has(inspection.studentId);
  }));
}

export function rubricComparisonForStudentBook({ studentId, bookId, students, inspections }) {
  return {
    studentVector: studentBookRubricAverage(studentId, bookId, inspections),
    bookAverageVector: bookRubricAverageForActiveStudents(bookId, students, inspections)
  };
}

export function classRubricAverage(classId, students, inspections) {
  const activeStudentIds = new Set(
    (students || [])
      .filter(student => student.classId === classId && student.active !== false)
      .map(student => student.id)
  );

  return averageRubricVector((inspections || []).filter(inspection => activeStudentIds.has(inspection.studentId)));
}

export function rubricComparisonForStudentClass({ studentId, classId, students, inspections }) {
  return {
    studentVector: studentRubricAverage(studentId, inspections),
    classAverageVector: classRubricAverage(classId, students, inspections)
  };
}
