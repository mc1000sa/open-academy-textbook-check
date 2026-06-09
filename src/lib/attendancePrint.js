export function sortStudentsByPrintPin(students = []) {
  return [...students].sort((a, b) => {
    const pinDiff = Number(Boolean(b.attendancePrintPinned)) - Number(Boolean(a.attendancePrintPinned));
    if (pinDiff !== 0) return pinDiff;
    return String(a.name || '').localeCompare(String(b.name || ''), 'ko');
  });
}

function formatStudentLabel(student = {}) {
  const name = student.name || '학생 미선택';
  const school = String(student.school || '').trim();
  const grade = String(student.grade || '').trim();

  let combined = '';
  if (school && grade) {
    // 학교 끝글자(고/중/초)와 학년 시작글자가 같으면 붙여서 표현 (수억고 + 고1 → 수억고1)
    const schoolType = school.slice(-1);
    if (grade.startsWith(schoolType)) {
      combined = school + grade.slice(1);
    } else {
      combined = school + ' ' + grade;
    }
  } else {
    combined = school || grade;
  }

  return combined ? `${name} (${combined})` : name;
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
  mode = 'lastClass',
  attendanceStats = null,
  dateRange = null,
  lastClassDate = ''
} = {}) {
  const trimmedReason = String(reason || '').trim();
  const studentLabel = formatStudentLabel(student);

  // 출결 통계 라인
  const buildAttendanceLine = () => {
    if (!attendanceStats) return '- 기간 내 출결 기록 없음';
    const { total, attend, absent, late } = attendanceStats;
    return `- 기간 내 출결 통계: 총 수업 ${total}회 중 출석 ${attend}회, 결석 ${absent}회, 지각 ${late}회`;
  };

  // 마지막 수업일 포맷
  const buildLastClassLine = () => {
    if (!lastClassDate) return '- 마지막 수업일 : 기록 없음';
    const d = new Date(lastClassDate);
    if (isNaN(d)) return `- 마지막 수업일 : ${lastClassDate}`;
    const mm = d.getMonth() + 1;
    const dd = d.getDate();
    const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    return `- 마지막 수업일 : ${mm}월 ${dd}일 ${dayNames[d.getDay()]}`;
  };

  // 조회 기간 라인
  const buildDateRangeLine = () => {
    if (!dateRange) return '';
    const { start, end, totalDays } = dateRange;
    return `- 조회 기간: ${start} ~ ${end} (총 ${totalDays}일간)`;
  };

  if (mode === 'detail') {
    return [
      `#퇴원일지_${teacherName}`,
      `■ ${studentLabel} : ${className}`,
      '■ 퇴원과목 : 수학',
      '■ 최근 수업 현황',
      buildDateRangeLine(),
      buildAttendanceLine(),
      buildLastClassLine(),
      '',
      '■ 기간내 교재 배부',
      buildBookBlock(bookLines),
      '',
      `■ 퇴원 사유 : ${trimmedReason || '상담 기록내용'}`,
      '',
      '#아카반영 해주세요.'
    ].join('\n');
  } else {
    return [
      `#퇴원일지_${teacherName}`,
      `■ ${studentLabel} : ${className}`,
      '■ 퇴원과목 : 수학',
      buildLastClassLine(),
      '',
      '■ 기간내 교재 배부',
      buildBookBlock(bookLines),
      '',
      `■ 퇴원 사유 : ${trimmedReason || '상담 기록내용'}`,
      '',
      '#아카반영 해주세요.'
    ].join('\n');
  }
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
