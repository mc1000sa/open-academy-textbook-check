const ATTENDANCE_STATUSES = new Set(['결석', '지각']);

const normalizeReasonLabel = (label = '') => {
  const normalized = String(label).trim();
  const labelMap = {
    개인사정: '개인 사정',
    버스늦음: '버스 늦음'
  };
  return labelMap[normalized] || normalized;
};

const joinReasonDetails = (time, detail) => {
  return [time, detail].filter(Boolean).join(' + ');
};

const formatReason = (label, rawDetail = '') => {
  let detail = String(rawDetail).trim();
  let time = '';
  const lateTimeMatch = detail.match(/^\((\d+)\s*분\s*지각\)\s*(.*)$/);

  if (lateTimeMatch) {
    time = `${lateTimeMatch[1]}분`;
    detail = lateTimeMatch[2].trim();
  }

  const suffix = joinReasonDetails(time, detail);
  return `[사유 - ${normalizeReasonLabel(label)}]${suffix ? ` ${suffix}` : ''}`;
};

const inferAttendanceStatus = (item) => {
  if (ATTENDANCE_STATUSES.has(item.attendanceStatus)) return item.attendanceStatus;
  if (ATTENDANCE_STATUSES.has(item.category)) return item.category;

  const content = String(item.content || '');
  if (content.includes('지각')) return '지각';
  if (content.includes('결석')) return '결석';
  return null;
};

const formatConsultingContent = (item, attendanceStatus) => {
  const rawContent = String(item.content || '').trim();

  if (attendanceStatus) {
    const reasonMatch = rawContent.match(/^\[(?:결석|지각)\s*사유\s*-\s*([^\]]+)\]\s*(.*)$/);
    if (reasonMatch) return formatReason(reasonMatch[1], reasonMatch[2]);

    const currentMatch = rawContent.match(/^\[사유\s*-\s*([^\]]+)\]\s*(.*)$/);
    if (currentMatch) return formatReason(currentMatch[1], currentMatch[2]);
  }

  if (item.category === '퇴원상담' && /^\[퇴원 상담\s*-/.test(rawContent)) {
    return rawContent.replace(/^\[퇴원 상담\s*-/, '[진로 상담 -');
  }

  return rawContent;
};

const formatAttendanceNote = (status, note = '') => {
  const rawNote = String(note).trim();
  if (!rawNote) return '';

  if (status === '지각') {
    const lateMatch = rawNote.match(/^\[지각-([^\]]+)\]\s*(.*)$/);
    if (lateMatch) return formatReason(lateMatch[1], lateMatch[2]);
  }

  const absentMatch = rawNote.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (absentMatch) return formatReason(absentMatch[1], absentMatch[2]);

  return rawNote;
};

export const buildStudentHistoryItems = ({ studentId, attendanceData = {}, consultingList = [] }) => {
  const attendanceReasonKeys = new Set();
  const consultingItems = consultingList.map((item, index) => {
    const attendanceStatus = inferAttendanceStatus(item);
    const isLegacyCareerConsult = item.category === '퇴원상담'
      && /^\[퇴원 상담\s*-/.test(String(item.content || '').trim());
    if (attendanceStatus) {
      attendanceReasonKeys.add(`${item.date}_${attendanceStatus}`);
    }

    return {
      ...item,
      displayCategory: attendanceStatus || (isLegacyCareerConsult ? '진로상담' : item.category),
      displayContent: formatConsultingContent(item, attendanceStatus),
      source: 'consulting',
      canEdit: item.category !== '퇴원상담' || isLegacyCareerConsult,
      sortOrder: index
    };
  });

  const attendanceItems = Object.entries(attendanceData)
    .filter(([key, value]) => key.startsWith(`${studentId}_`) && ATTENDANCE_STATUSES.has(value?.status))
    .map(([key, value], index) => {
      const date = key.slice(`${studentId}_`.length);
      return {
        id: `attendance_${key}`,
        category: value.status,
        date,
        content: value.note || '',
        displayCategory: value.status,
        displayContent: formatAttendanceNote(value.status, value.note),
        source: 'attendance',
        sortOrder: consultingItems.length + index
      };
    })
    .filter(item => !attendanceReasonKeys.has(`${item.date}_${item.displayCategory}`));

  return [...consultingItems, ...attendanceItems].sort((a, b) => {
    const dateComparison = String(b.date || '').localeCompare(String(a.date || ''));
    return dateComparison || a.sortOrder - b.sortOrder;
  });
};
