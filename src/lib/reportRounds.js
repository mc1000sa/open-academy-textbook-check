const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];

function normalizeDate(value) {
  if (!value) return '';
  // 마침표(.)나 슬래시(/)를 대시(-)로 통일하고 공백 제거
  const text = String(value).trim().replace(/[\.\/]/g, '-');
  // YYYY-MM-DD 또는 YYYY-M-D 등 유연하게 매칭 (월, 일의 글자 수 1~2개 허용)
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    const y = match[1];
    const m = match[2].padStart(2, '0');
    const d = match[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return '';
}

function dateForLocalDay(dateText) {
  const normalized = normalizeDate(dateText);
  if (!normalized) return null;
  const [year, month, day] = normalized.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatRoundDate(dateText) {
  const date = dateForLocalDay(dateText);
  if (!date) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}.${day}.${WEEKDAYS_KO[date.getDay()]}`;
}

export function buildReportRounds({ inspections = [], classId = '', studentId = '', startDate = '', allStudents = [] } = {}) {
  const normalizedStart = normalizeDate(startDate);
  if (!classId || !normalizedStart) return [];

  // 학생별 classId 매핑 정보 캐시 구축
  const studentClassMap = new Map();
  allStudents.forEach(s => {
    if (s.id && s.classId) {
      studentClassMap.set(s.id, s.classId);
    }
  });

  const dates = new Map();
  inspections.forEach(inspection => {
    if (!inspection) return;
    
    // classId가 없는 과거 데이터인 경우, 학생 목록 매핑을 활용해 보완
    const inspClassId = inspection.classId || studentClassMap.get(inspection.studentId) || '';
    if (inspClassId !== classId) return;
    
    if (studentId && inspection.studentId !== studentId) return;
    
    const date = normalizeDate(inspection.date);
    if (!date || date < normalizedStart) return;
    dates.set(date, (dates.get(date) || 0) + 1);
  });

  return [...dates.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count], index) => {
      const displayDate = formatRoundDate(date);
      return {
        round: index + 1,
        date,
        displayDate,
        fileDate: displayDate,
        count
      };
    });
}

export function selectedRoundDate(rounds = [], selectedRound = null) {
  const roundNumber = Number(selectedRound);
  return rounds.find(round => round.round === roundNumber)?.date || '';
}

function teacherFileLabel(teacherName) {
  const clean = String(teacherName || '').trim().replace(/\s+/g, '');
  if (!clean) return '담당t';
  return /t$/i.test(clean) ? clean : `${clean}t`;
}

export function formatRoundFileName({ teacherName = '', className = '', studentName = '', round = null } = {}) {
  const roundLabel = round?.round ? `${round.round}회차` : '회차미선택';
  const fileDate = round?.fileDate ? `-${round.fileDate}` : '';
  return `[${teacherFileLabel(teacherName)}] ${className || '반명'} - ${studentName || '학생명'} (${roundLabel}${fileDate}).png`;
}

export function getInspectionRoundsMap(inspections = []) {
  const uniqueDates = Array.from(
    new Set(
      inspections
        .map(ins => normalizeDate(ins?.date))
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  const dateToRoundMap = new Map();
  uniqueDates.forEach((date, index) => {
    dateToRoundMap.set(date, index + 1);
  });
  return dateToRoundMap;
}

