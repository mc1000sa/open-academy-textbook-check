const EMPTY_RUBRIC_SCORES = Object.freeze({
  expression: null,
  grading: null,
  attitude: null,
  understanding: null,
  application: null
});

function sameRange(leftStart, leftEnd, rightStart, rightEnd) {
  return Number(leftStart) === Number(rightStart) && Number(leftEnd) === Number(rightEnd);
}

export function hasSameNormalInspectionRange({
  inspections = [],
  studentId,
  bookId,
  date,
  rangeStart,
  rangeEnd
} = {}) {
  return (inspections || []).some(inspection => {
    return (
      inspection?.deleted !== true &&
      inspection?.studentId === studentId &&
      inspection?.bookId === bookId &&
      inspection?.date === date &&
      sameRange(inspection?.rangeStart, inspection?.rangeEnd, rangeStart, rangeEnd)
    );
  });
}

export function findClassAutoSaveTargets({
  students = [],
  currentStudentId,
  selectedClassId,
  currentBookId,
  selectedDate,
  rangeStart,
  rangeEnd,
  inspections = [],
  assignedBookIds = []
} = {}) {
  const assignedSet = new Set((assignedBookIds || []).filter(Boolean));
  if (!selectedClassId || !currentBookId || !assignedSet.has(currentBookId)) return [];

  return (students || []).filter(student => {
    return (
      student?.active !== false &&
      student?.classId === selectedClassId &&
      student?.id !== currentStudentId &&
      !hasSameNormalInspectionRange({
        inspections,
        studentId: student?.id,
        bookId: currentBookId,
        date: selectedDate,
        rangeStart,
        rangeEnd
      })
    );
  });
}

export function buildAutoSaveInspectionPayload({
  basePayload,
  student,
  timestamp
} = {}) {
  return {
    teacherId: basePayload.teacherId,
    teacherName: basePayload.teacherName,
    classId: basePayload.classId,
    studentId: student.id,
    bookId: basePayload.bookId,
    date: basePayload.date,
    attendanceStatus: 'normal',
    rangeStart: basePayload.rangeStart,
    rangeEnd: basePayload.rangeEnd,
    missedPages: [],
    carryoverResolutions: [],
    carryoverRecovery: { totalPages: 0, resolvedPages: 0, remainingPages: 0, recoveryRate: 0 },
    completionRate: 100,
    units: [...(basePayload.units || [])],
    standardUnitIds: [...(basePayload.standardUnitIds || [])],
    memo: '',
    rubricScores: { ...EMPTY_RUBRIC_SCORES },
    updatedAt: timestamp,
    createdAt: timestamp
  };
}
