const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];

function normalizeDate(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
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

export function buildReportRounds({ inspections = [], classId = '', studentId = '', startDate = '' } = {}) {
  const normalizedStart = normalizeDate(startDate);
  if (!classId || !normalizedStart) return [];

  const dates = new Map();
  inspections.forEach(inspection => {
    if (inspection?.classId !== classId) return;
    if (studentId && inspection?.studentId !== studentId) return;
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
