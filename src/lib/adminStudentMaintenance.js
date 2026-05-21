const THREE_MONTHS_IN_DAYS = 92;

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function calculateStudentDeleteAfter(withdrawnAt = new Date()) {
  const start = toDate(withdrawnAt) || new Date();
  return new Date(start.getTime() + THREE_MONTHS_IN_DAYS * 24 * 60 * 60 * 1000);
}

export function isStudentDeletionDue(student, now = new Date()) {
  if (!student || student.status !== 'withdrawn') return false;
  const deleteAfter = toDate(student.deleteAfter);
  if (!deleteAfter) return false;
  return deleteAfter.getTime() <= now.getTime();
}

export function studentsDueForDeletion(students, now = new Date()) {
  return (students || []).filter(student => isStudentDeletionDue(student, now));
}

export function buildBulkStudentUpdatePayload({ grade, classId }) {
  const payload = {};
  if (String(grade || '').trim()) payload.grade = String(grade).trim();
  if (String(classId || '').trim()) payload.classId = String(classId).trim();
  return payload;
}

export function applyNameReplacement(name, findText, replaceText) {
  const baseName = String(name || '');
  const find = String(findText || '');
  if (!find) return baseName;
  return baseName.split(find).join(String(replaceText || ''));
}
