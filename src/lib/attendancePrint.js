export function sortStudentsByPrintPin(students = []) {
  return [...students].sort((a, b) => {
    const pinDiff = Number(Boolean(b.attendancePrintPinned)) - Number(Boolean(a.attendancePrintPinned));
    if (pinDiff !== 0) return pinDiff;
    return String(a.name || '').localeCompare(String(b.name || ''), 'ko');
  });
}

function formatStudentLabel(student = {}) {
  const name = student.name || '학생 미선택';
  const schoolGrade = [student.school, student.grade]
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .join(' ');
  return schoolGrade ? `${name} (${schoolGrade})` : name;
}

function buildBookBlock(lines = []) {
  const cleanLines = lines
    .map(line => String(line || '').trim())
    .filter(Boolean);
  return cleanLines.length ? cleanLines.map(line => `- ${line}`).join('\n') : '- 배부된 교재 없음';
}

export function buildWithdrawalLog({
  teacherName = '해당강사',
  student = {},
  className = '미지정',
  dischargeDate = '',
  reason = '',
  bookLines = [],
  mode = 'lastClass'
} = {}) {
  const title = mode === 'detail' ? '출결 상세 보고' : '마지막 수업일 보고';
  const trimmedReason = String(reason || '').trim();

  return [
    `#퇴원일지_${teacherName}`,
    '',
    `■ ${className} : ${formatStudentLabel(student)}`,
    `■ 보고모드 : ${title}`,
    `■ 퇴원일자 : ${dischargeDate || '-'}`,
    '',
    '● 퇴원과목 : 수학',
    '',
    '● 당월 교재 배부 내역',
    buildBookBlock(bookLines),
    '',
    '● 퇴원 사유 및 상담내용',
    trimmedReason || '- 상담 내용 미입력',
    '',
    '#원카반영 해주세요.'
  ].join('\n');
}

export function fallbackCopyText(text, doc = document) {
  const textarea = doc.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  doc.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  let ok = false;
  try {
    ok = doc.execCommand('copy');
  } finally {
    doc.body.removeChild(textarea);
  }
  return ok;
}

export async function copyTextSafely(text, navigatorRef = navigator, doc = document) {
  if (navigatorRef?.clipboard?.writeText) {
    try {
      await navigatorRef.clipboard.writeText(text);
      return true;
    } catch (err) {
      // 보안 정책으로 Clipboard API가 막히면 textarea fallback을 시도한다.
    }
  }
  return fallbackCopyText(text, doc);
}
