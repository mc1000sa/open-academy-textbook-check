const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getAttendancePresetRange = (preset, referenceDate = new Date()) => {
  const end = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  const start = new Date(end);

  if (preset === '2weeks') {
    start.setDate(start.getDate() - 13);
  } else if (preset === '3weeks') {
    start.setDate(start.getDate() - 20);
  } else if (preset === 'month') {
    start.setDate(1);
  } else {
    throw new Error(`지원하지 않는 출석부 조회 프리셋입니다: ${preset}`);
  }

  return {
    start: formatLocalDate(start),
    end: formatLocalDate(end)
  };
};
