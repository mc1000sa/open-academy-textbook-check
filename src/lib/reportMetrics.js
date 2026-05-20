export function averageCompletionRate(inspections) {
  if (!inspections.length) return 0;

  const total = inspections.reduce((sum, inspection) => {
    return sum + Number(inspection.completionRate || 0);
  }, 0);

  return Math.round(total / inspections.length);
}

export function groupInspectionsByBook(inspections) {
  return inspections.reduce((grouped, inspection) => {
    grouped[inspection.bookId] = grouped[inspection.bookId] || [];
    grouped[inspection.bookId].push(inspection);
    return grouped;
  }, {});
}

export function classProgressRate(classId, students, inspections) {
  const activeStudentIds = new Set(
    students
      .filter(student => student.classId === classId && student.active !== false)
      .map(student => student.id)
  );

  if (!activeStudentIds.size) return 0;

  const rows = inspections.filter(inspection => activeStudentIds.has(inspection.studentId));

  return averageCompletionRate(rows);
}
