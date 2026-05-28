import { renderBtnSelect } from './layoutView.js';
import {
  averageRubricVector,
  rubricComparisonForStudentClass,
  rubricComparisonForStudentBook
} from '../../lib/reportMetrics.js';
import { buildCarryoverRows } from '../../lib/textbookProgress.js';

const RUBRIC_LABELS = {
  assignment: '과제 수행률',
  expression: '풀이 표현력',
  grading: '채점 성실도',
  attitude: '수업 태도',
  understanding: '개념 이해도',
  application: '응용 해결력'
};

const RUBRIC_KEYS = Object.keys(RUBRIC_LABELS);
const IMAGE_RUBRIC_LABELS = {
  assignment: '과제 수행률',
  expression: '풀이 표현력',
  grading: '채점 성실도',
  attitude: '수업 태도',
  understanding: '개념 이해도',
  application: '응용 해결력'
};

function rubricScore(vector, key) {
  const score = Number(vector?.[key]);
  if (Number.isNaN(score)) return 0;
  return Math.min(10, Math.max(0, score));
}

function defaultProgressTone() {
  return { bar: '#4169e1' };
}

function rubricPoints(vector, radius = 68, center = 100) {
  return RUBRIC_KEYS.map((key, index) => {
    const angle = (Math.PI * 2 * index) / RUBRIC_KEYS.length - Math.PI / 2;
    const scoreRadius = (rubricScore(vector, key) / 10) * radius;
    const x = center + Math.cos(angle) * scoreRadius;
    const y = center + Math.sin(angle) * scoreRadius;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function rubricGridPoints(scale, radius = 68, center = 100) {
  return RUBRIC_KEYS.map((_, index) => {
    const angle = (Math.PI * 2 * index) / RUBRIC_KEYS.length - Math.PI / 2;
    const gridRadius = radius * scale;
    const x = center + Math.cos(angle) * gridRadius;
    const y = center + Math.sin(angle) * gridRadius;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function rubricCircles(vector, color, radius = 68, center = 100, hollow = false) {
  return RUBRIC_KEYS.map((key, index) => {
    const angle = (Math.PI * 2 * index) / RUBRIC_KEYS.length - Math.PI / 2;
    const scoreRadius = (rubricScore(vector, key) / 10) * radius;
    const x = center + Math.cos(angle) * scoreRadius;
    const y = center + Math.sin(angle) * scoreRadius;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${hollow ? '2.7' : '2.9'}" fill="${hollow ? '#0f172a' : color}" stroke="${color}" stroke-width="${hollow ? '2' : '1'}"></circle>`;
  }).join('');
}

function rubricLabelPosition(index, radius = 93, center = 100) {
  const angle = (Math.PI * 2 * index) / RUBRIC_KEYS.length - Math.PI / 2;
  return {
    x: center + Math.cos(angle) * radius,
    y: center + Math.sin(angle) * radius
  };
}

export function renderRubricCompare(title, primary, secondary, secondaryLabel, safe) {
  const escape = typeof safe === 'function' ? safe : value => String(value ?? '');
  const grid = [0.25, 0.5, 0.75, 1].map(scale => `
    <polygon points="${rubricGridPoints(scale)}" fill="none" stroke="rgba(148,163,184,0.22)" stroke-width="1"></polygon>
  `).join('');
  const axes = RUBRIC_KEYS.map((_, index) => {
    const point = rubricGridPoints(1).split(' ')[index];
    return `<line x1="100" y1="100" x2="${point.split(',')[0]}" y2="${point.split(',')[1]}" stroke="rgba(148,163,184,0.18)" stroke-width="1"></line>`;
  }).join('');
  const labels = RUBRIC_KEYS.map((key, index) => {
    const pos = rubricLabelPosition(index);
    const anchor = pos.x < 86 ? 'end' : pos.x > 114 ? 'start' : 'middle';
    const dy = index === 0 ? -3 : index === 3 ? 5 : 0;
    return `<text x="${pos.x.toFixed(1)}" y="${(pos.y + dy).toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle" fill="#cbd5e1" font-size="7.2" font-weight="700">${escape(RUBRIC_LABELS[key])}</text>`;
  }).join('');
  const summary = RUBRIC_KEYS.map(key => `
    <div class="flex items-center justify-between gap-2">
      <span class="text-slate-400">${escape(RUBRIC_LABELS[key])}</span>
      <span class="font-black text-slate-100">${escape(rubricScore(primary, key).toFixed(1))}</span>
    </div>
  `).join('');

  return `
    <section class="rubric-report mt-4 p-4 rounded-xl bg-slate-950/40 border border-slate-800">
      <div class="flex flex-col md:flex-row md:items-start gap-4">
        <div class="flex-1 min-w-0">
          <h3 class="text-sm font-black text-white mb-2">${escape(title)}</h3>
          <div class="flex flex-wrap items-center gap-3 text-[11px] font-bold text-slate-300">
            <span class="inline-flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-blue-400"></span>학생</span>
            <span class="inline-flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-emerald-400"></span>${escape(secondaryLabel || '비교 평균')}</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 mt-3 text-[11px]">
            ${summary}
          </div>
        </div>
        <svg class="shrink-0 w-full max-w-[300px] mx-auto md:mx-0 overflow-visible" viewBox="-28 -24 256 248" role="img" aria-label="${escape(title)}">
          ${grid}
          ${axes}
          <polygon points="${rubricPoints(secondary)}" fill="rgba(52,211,153,0.08)" stroke="#34d399" stroke-width="3" stroke-dasharray="5 4" stroke-linejoin="round"></polygon>
          <polygon points="${rubricPoints(primary)}" fill="rgba(96,165,250,0.24)" stroke="#60a5fa" stroke-width="2.4" stroke-linejoin="round"></polygon>
          ${rubricCircles(secondary, '#34d399', 68, 100, true)}
          ${rubricCircles(primary, '#60a5fa')}
          ${labels}
        </svg>
      </div>
    </section>
  `;
}

function normalizeDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

function teacherTitleName(name) {
  const clean = String(name || '').trim();
  if (!clean) return '담당T';
  return /t$/i.test(clean) ? clean.replace(/t$/i, 'T') : `${clean}T`;
}

function scoreText(vector, key) {
  return rubricScore(vector, key).toFixed(1);
}

function renderImageRubricChart(vector, safe) {
  const escape = typeof safe === 'function' ? safe : value => String(value ?? '');
  const grid = [0.25, 0.5, 0.75, 1].map(scale => `
    <polygon points="${rubricGridPoints(scale)}" fill="none" stroke="#d7deea" stroke-width="1"></polygon>
  `).join('');
  const axes = RUBRIC_KEYS.map((_, index) => {
    const point = rubricGridPoints(1).split(' ')[index];
    return `<line x1="100" y1="100" x2="${point.split(',')[0]}" y2="${point.split(',')[1]}" stroke="#d7deea" stroke-width="1"></line>`;
  }).join('');
  const labels = RUBRIC_KEYS.map((key, index) => {
    const pos = rubricLabelPosition(index, 92);
    const anchor = pos.x < 86 ? 'end' : pos.x > 114 ? 'start' : 'middle';
    const dy = index === 0 ? -4 : index === 3 ? 5 : 0;
    return `<text x="${pos.x.toFixed(1)}" y="${(pos.y + dy).toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle" fill="#334155" font-size="7.5" font-weight="800">${escape(IMAGE_RUBRIC_LABELS[key])}</text>`;
  }).join('');

  return `
    <svg class="parent-report-radar" viewBox="-30 -24 260 248" role="img" aria-label="교재 6요소 육각형 차트">
      ${grid}
      ${axes}
      <polygon points="${rubricPoints(vector)}" fill="rgba(65,105,225,0.18)" stroke="#4169e1" stroke-width="3" stroke-linejoin="round"></polygon>
      ${rubricCircles(vector, '#4169e1')}
      ${labels}
    </svg>
  `;
}

function rangeUnitSummary(book, rows, unitsForRange) {
  const names = [];
  rows.forEach(row => {
    const units = typeof unitsForRange === 'function' ? unitsForRange(book, row.rangeStart, row.rangeEnd) : [];
    units.forEach(unit => {
      const name = String(unit?.name || '').trim();
      if (name && !names.includes(name)) names.push(name);
    });
  });
  if (names.length) return names.join(', ');
  return rows.map(row => `${row.rangeStart ?? '-'}~${row.rangeEnd ?? '-'}쪽`).join(', ');
}

function missedPagesSummary(rows) {
  const missed = [...new Set(rows.flatMap(row => Array.isArray(row.missedPages) ? row.missedPages : []))]
    .sort((a, b) => Number(a) - Number(b));
  return missed.length ? missed.map(page => `${page}쪽`).join(', ') : '없음';
}

export function reportForStudentImage(studentId, state, deps, options = {}) {
  const {
    studentById,
    classById,
    inspectionsForStudent,
    groupInspectionsByBook,
    bookById,
    averageCompletionRate,
    safe,
    teacherNameById,
    unitsForRange
  } = deps;
  const escape = typeof safe === 'function' ? safe : value => String(value ?? '');
  const student = studentById(studentId);
  if (!student) return '';
  const klass = classById(student.classId);
  const teacherName = teacherNameById?.(klass?.teacherId) || state.currentTeacher?.name || '담당';
  const round = options.round || null;
  const roundDate = normalizeDate(round?.date);
  const allRows = inspectionsForStudent(studentId);
  const rows = roundDate ? allRows.filter(row => normalizeDate(row.date) === roundDate) : allRows;
  const grouped = groupInspectionsByBook(rows);
  const vector = averageRubricVector(rows);
  const roundLabel = round?.round ? `${round.round}회차` : '선택 회차';

  const bookSections = Object.entries(grouped).map(([bookId, items]) => {
    const book = bookById(bookId);
    const avg = Math.round(averageCompletionRate(items));
    return `
      <section class="parent-report-book">
        <div class="parent-report-book-head">
          <h3><span class="parent-report-pipe">|</span>${escape(book?.title || '이름 없는 교재')}</h3>
          <strong aria-label="점검 완료율 ${escape(avg)}%"><span>점검 완료율</span><b>${escape(avg)}%</b></strong>
        </div>
        <p><b>완료한 단원 :</b> ${escape(rangeUnitSummary(book, items, unitsForRange))}</p>
        <p><b>보완 필요 쪽수 :</b> ${escape(missedPagesSummary(items))}</p>
      </section>
    `;
  }).join('');

  const rubricRows = RUBRIC_KEYS.map((key, index) => `
    <li><span>${index + 1}. ${escape(IMAGE_RUBRIC_LABELS[key])}</span><b>${escape(scoreText(vector, key))}</b></li>
  `).join('');
  const comments = rows
    .map(row => String(row.memo || '').trim())
    .filter(Boolean)
    .map(memo => `<p>${escape(memo)}</p>`)
    .join('');

  const selectedPeriod = state.selectedReportPeriod || '';
  const periodText = selectedPeriod ? `${escape(selectedPeriod)} | ` : '';

  return `
    <div class="parent-image-report" id="reportCaptureArea">
      <header class="parent-report-header">
        <div>
          <div class="parent-report-kicker" aria-label="OATIS | Open Academy Textbook Insight System">
            <strong>OATIS</strong>
            <span>|</span>
            <span><b>O</b>pen <b>A</b>cademy <b>T</b>extbook <b>I</b>nsight <b>S</b>ystem</span>
          </div>
          <h1 aria-label="${escape(student.name)} (${escape(klass?.name || '-')}) - ${escape(teacherTitleName(teacherName))}">
            <span class="parent-report-student-name">${escape(student.name)}</span>
            <span class="parent-report-meta">(${escape(klass?.name || '-')}) - </span>
            <span class="parent-report-teacher-name">${escape(teacherTitleName(teacherName))}</span>
          </h1>
          <p class="parent-report-subtitle">${periodText}<span class="parent-report-round-num">${escape(roundLabel)}</span> 교재 분석 보고서</p>
        </div>
        <div class="parent-report-brand">열린학원</div>
      </header>

      <div class="parent-report-divider"></div>

      <div class="parent-report-books">
        ${bookSections || '<div class="parent-report-empty">선택 회차의 교재 점검 기록이 없습니다.</div>'}
      </div>

      <div class="parent-report-divider"></div>

      <section class="parent-report-rubric">
        <div>
          <h2><span class="parent-report-pipe">|</span>교재 6요소</h2>
          <ol>${rubricRows}</ol>
        </div>
        ${renderImageRubricChart(vector, escape)}
      </section>

      <div class="parent-report-divider"></div>

      <section class="parent-report-comments">
        <h2><span class="parent-report-pipe">|</span>교재 점검 최근 코멘트</h2>
        ${comments || '<p>등록된 코멘트가 없습니다.</p>'}
      </section>

      <div class="parent-report-divider"></div>

      <footer>열린학원 OATIS 교재분석 리포트</footer>
    </div>
  `;
}

// 1. 학생/학부모 개별 교재점검 보고서 템플릿
export function reportForStudent(studentId, state, deps) {
  const {
    studentById,
    classById,
    inspectionsForStudent,
    groupInspectionsByBook,
    bookById,
    averageCompletionRate,
    fmtDate,
    safe,
    progressTone,
    classRubricAverage,
    studentRubricAverage,
    assignedBooksForClass,
    students,
    inspections
  } = deps;
  const student = studentById(studentId);
  if (!student) return '';
  const klass = classById(student.classId);
  const rows = inspectionsForStudent(studentId);
  const grouped = groupInspectionsByBook(rows);
  const allStudents = students || state.students || [];
  const allInspections = inspections || state.inspections || [];
  const studentOverallVector = typeof studentRubricAverage === 'function'
    ? studentRubricAverage(studentId, allInspections)
    : {};
  const classVector = typeof classRubricAverage === 'function'
    ? classRubricAverage(student.classId, allStudents, allInspections)
    : {};
  const visibleBookIds = typeof assignedBooksForClass === 'function'
    ? new Set(assignedBooksForClass(student.classId).map(item => item.book.id))
    : null;
  
  // 전체 평균 완료율
  const totalAvg = Math.round(averageCompletionRate(rows));

  const cards = Object.entries(grouped)
    .filter(([bookId]) => !visibleBookIds || visibleBookIds.has(bookId))
    .map(([bookId, items]) => {
    const book = bookById(bookId);
    const avg = Math.round(averageCompletionRate(items));
    const latest = items[0];
    const tone = (typeof progressTone === 'function' ? progressTone : defaultProgressTone)(avg);
    const comparison = rubricComparisonForStudentBook({
      studentId,
      bookId,
      students: allStudents,
      inspections: allInspections
    });
    const classComparison = rubricComparisonForStudentClass({
      studentId,
      classId: student.classId,
      students: allStudents,
      inspections: allInspections
    });
    const bookVector = comparison.bookAverageVector || {};
    const studentBookVector = comparison.studentVector || averageRubricVector(items) || studentOverallVector;

    // 미비 페이지 목록 취합
    const allMissed = new Set(buildCarryoverRows({
      inspections: items,
      studentId,
      bookId
    }).flatMap(row => row.missedPages));
    const missedSorted = Array.from(allMissed).sort((a, b) => a - b);

    return `
      <div class="report-book-card p-5 mb-5 rounded-2xl border border-slate-700/50 bg-slate-900/30">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div class="text-base font-extrabold text-white">${safe(book?.title || '알 수 없는 교재')}</div>
            <div class="text-xs text-slate-400 mt-1">
              최근 점검: ${safe(fmtDate(latest?.date))} &nbsp;|&nbsp; 담당교사: ${safe(latest?.teacherName || '강사')}T
            </div>
          </div>
          <div class="px-3.5 py-1.5 rounded-full text-xs font-black text-white text-center" style="background: ${tone.bar}; box-shadow: 0 0 10px ${tone.bar}44;">
            완료율 ${avg}%
          </div>
        </div>

        <!-- 교재별 미비 쪽수 정보 -->
        <div class="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 text-xs">
          <span class="font-bold text-slate-300 block mb-2">보완 필요 쪽수:</span>
          ${missedSorted.length === 0 ? `
            <span class="text-emerald-400 font-bold">★ 완료율 100%! 모든 보완 학습이 완료되었습니다. ★</span>
          ` : `
            <div class="flex flex-wrap gap-1.5">
              ${missedSorted.map(p => `
                <span class="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">${p}쪽</span>
              `).join('')}
            </div>
          `}
        </div>

        <!-- 최근 상세 히스토리 내역 -->
        <div class="mt-4 space-y-2">
          <span class="text-[11px] font-bold text-slate-400 block">최근 3회 교재 세부 점검내역:</span>
          ${items.slice(0, 3).map(r => `
            <div class="p-3 rounded-lg bg-slate-900/40 border border-slate-800/80 text-xs flex justify-between items-start gap-4">
              <div>
                <span class="font-bold text-slate-200">${safe(fmtDate(r.date))} &middot; ${safe(r.rangeStart)}~${safe(r.rangeEnd)}쪽</span>
                ${r.memo ? `<p class="text-slate-400 mt-1 italic">"${safe(r.memo)}"</p>` : ''}
              </div>
              <span class="font-extrabold text-slate-300">${safe(r.completionRate)}%</span>
            </div>
          `).join('')}
        </div>

        ${renderRubricCompare('해당 교재 평균 vs 학생 6요소', studentBookVector, bookVector, '해당 교재 평균', safe)}
        ${renderRubricCompare('반 평균 6요소 비교', classComparison.studentVector || studentOverallVector, classComparison.classAverageVector || classVector, '반 평균', safe)}
      </div>
    `;
  }).join('');

  return `
    <div class="print-report rounded-[28px] p-6 md:p-8 bg-slate-950 border border-slate-800 text-white" id="reportCaptureArea">
      <!-- 헤더 요약 영역 -->
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 mb-6 border-b border-slate-800">
        <div>
          <span class="px-2.5 py-0.5 rounded text-[10px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/20">REPORT</span>
          <h1 class="text-2xl font-black text-white mt-2">${safe(student.name)} 학생 교재 분석 보고서</h1>
          <p class="text-xs text-slate-400 mt-1.5">
            반: <span class="text-slate-200">${safe(klass?.name || '-')}</span> &nbsp;|&nbsp; 
            학교: <span class="text-slate-200">${safe(student.school || '-')}</span> &nbsp;|&nbsp; 
            학년: <span class="text-slate-200">${safe(student.grade || '-')}</span>
          </p>
        </div>
        
        <div class="flex items-center gap-3 bg-slate-900/80 px-4 py-3 rounded-2xl border border-slate-800">
          <div class="text-right">
            <span class="text-[10px] text-slate-400 font-bold block mb-0.5">통합 교재 완료율</span>
            <strong class="text-xl font-black text-blue-400">${totalAvg}%</strong>
          </div>
          <div class="w-10 h-10 rounded-full border-4 border-blue-500/20 flex items-center justify-center" style="border-top-color: #4169e1;">
            <span class="text-[9px] text-blue-400 font-bold">AVG</span>
          </div>
        </div>
      </div>

      <!-- 개별 교재 카드 렌더링 -->
      <div class="space-y-4">
        ${cards || '<div class="text-center py-10 text-slate-500 text-sm">기록된 점검 이력이 존재하지 않습니다.</div>'}
      </div>

      <div class="text-center mt-8 pt-4 border-t border-slate-900 text-[10px] text-slate-500">
        열린학원 OATIS 교재분석 리포트 &middot; 본 문서는 학생의 학업 성취 관리를 위해 자동으로 생성되었습니다.
      </div>
    </div>
  `;
}

// 2. 반별 전체 교재 진행표 템플릿
export function reportForClass(classId, state, deps) {
  const {
    classById,
    studentsForClass,
    inspectionsForStudent,
    averageCompletionRate,
    fmtDate,
    teacherNameById,
    safe,
    classRubricAverage,
    studentRubricAverage,
    students: allStudentsDep,
    inspections
  } = deps;
  const klass = classById(classId);
  if (!klass) return '';
  const students = studentsForClass(classId);
  const allStudents = allStudentsDep || state.students || [];
  const allInspections = inspections || state.inspections || [];
  const classVector = typeof classRubricAverage === 'function'
    ? classRubricAverage(classId, allStudents, allInspections)
    : {};
  const rubricHeader = RUBRIC_KEYS.map(key => `
    <th class="px-3 py-3 text-center whitespace-nowrap">${safe(RUBRIC_LABELS[key])}</th>
  `).join('');
  const classAverageCells = RUBRIC_KEYS.map(key => `
    <td class="px-3 py-3 text-center font-black text-emerald-300">${safe(rubricScore(classVector, key).toFixed(1))}</td>
  `).join('');

  const rows = students.map(s => {
    const logs = inspectionsForStudent(s.id);
    const avg = Math.round(averageCompletionRate(logs));
    const latest = logs[0]?.date || '';
    const vector = typeof studentRubricAverage === 'function'
      ? studentRubricAverage(s.id, allInspections)
      : {};
    const rubricCells = RUBRIC_KEYS.map(key => `
      <td class="px-3 py-3 text-center font-bold text-slate-200">${safe(rubricScore(vector, key).toFixed(1))}</td>
    `).join('');
    
    return `
      <tr class="border-b border-slate-800/80 hover:bg-slate-900/30 text-xs">
        <td class="px-4 py-3 text-slate-200 font-bold">${safe(s.name)}</td>
        <td class="px-4 py-3 text-slate-400">${safe(s.school || '-')}</td>
        <td class="px-4 py-3 text-right font-black text-blue-400">${avg}%</td>
        <td class="px-4 py-3 text-slate-400 text-center">${safe(fmtDate(latest)) || '-'}</td>
        ${rubricCells}
      </tr>
    `;
  }).join('');

  return `
    <div class="print-report rounded-[28px] p-6 md:p-8 bg-slate-950 border border-slate-800 text-white" id="reportCaptureArea">
      <div class="pb-6 mb-6 border-b border-slate-800">
        <span class="px-2.5 py-0.5 rounded text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">CLASS SUMMARY</span>
        <h1 class="text-2xl font-black text-white mt-2">${safe(klass.name)} 반별 교재 현황표</h1>
        <p class="text-xs text-slate-400 mt-1.5">담당 강사: <span class="text-slate-200">${safe(teacherNameById(klass.teacherId))} T</span></p>
      </div>

      <div class="class-rubric-table overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b border-slate-800 bg-slate-900/40 text-[11px] font-bold text-slate-400">
              <th class="px-4 py-3">학생 이름</th>
              <th class="px-4 py-3">학교</th>
              <th class="px-4 py-3 text-right">평균 완료율</th>
              <th class="px-4 py-3 text-center">최근 점검일</th>
              ${rubricHeader}
            </tr>
          </thead>
          <tbody>
            ${rows ? `
              <tr class="border-b border-emerald-500/20 bg-emerald-500/5 text-xs">
                <td class="px-4 py-3 text-emerald-200 font-black" colspan="4">반 평균</td>
                ${classAverageCells}
              </tr>
              ${rows}
            ` : '<tr><td colspan="10" class="px-4 py-10 text-center text-slate-500">등록된 학생이 존재하지 않습니다.</td></tr>'}
          </tbody>
        </table>
      </div>

      <div class="text-center mt-8 pt-4 border-t border-slate-900 text-[10px] text-slate-500">
        열린학원 OATIS 교재분석 리포트 &middot; 반별 관리용 리포트입니다.
      </div>
    </div>
  `;
}

// 3. 메인 보고서 뷰 렌더러
export function renderReportsView(state, deps) {
  const { teacherClasses, classById, safe } = deps;
  let teacherClassesList = state.currentTeacher.role === 'admin' ? state.classes : teacherClasses(state.currentTeacher.id);
  const classSort = state.classSortType || 'name';
  if (classSort === 'grade') {
    const GRADE_WEIGHTS = { '고1': 1, '고2': 2, '고3': 3 };
    teacherClassesList = [...teacherClassesList].sort((a, b) => {
      const wA = GRADE_WEIGHTS[a.grade] || 99;
      const wB = GRADE_WEIGHTS[b.grade] || 99;
      if (wA !== wB) return wA - wB;
      return String(a.name || '').localeCompare(String(b.name || ''), 'ko');
    });
  } else {
    teacherClassesList = [...teacherClassesList].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko'));
  }
  const studentsList = state.currentTeacher.role === 'admin' ? state.students : state.students.filter(s => teacherClassesList.some(c => c.id === s.classId));

  const btnClass = 'btn-teacher';
  const selectedStudent = studentsList.find(student => student.id === state.reportStudentId);
  const activeReportClassId = selectedStudent?.classId || state.reportClassId || '';
  const activeReportClass = classById(activeReportClassId);
  const reportStartDate = state.reportRoundStartDate || activeReportClass?.reportRoundStartDate || '';
  const reportRounds = state.reportStudentId ? (state.reportRounds || []) : [];
  const selectedReportRound = Number(state.selectedReportRound || 0);
  const classStudents = activeReportClassId
    ? studentsList
      .filter(student => student.classId === activeReportClassId)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko'))
    : [];
  const selectedRoundInfo = reportRounds.find(round => round.round === selectedReportRound);
  const roundButtons = reportRounds.length
    ? reportRounds.map(round => `
      <button type="button" data-action="select-report-round" data-round="${safe(round.round)}" class="report-round-button ${selectedReportRound === round.round ? 'active' : ''}">
        ${safe(round.round)}회차 (${safe(round.displayDate)})
      </button>
    `).join('')
    : `<div class="text-xs font-bold text-slate-500">${state.reportStudentId ? '기준일 이후 해당 학생 점검 기록이 아직 없습니다.' : '학생을 선택하면 생성 가능한 회차가 표시됩니다.'}</div>`;
  const previewPlaceholder = !reportStartDate
    ? '보고서 회차 기준일을 먼저 선택해주세요'
    : !activeReportClassId
      ? '보고서를 생성할 반을 선택해주세요'
      : !state.reportStudentId
        ? '학생을 선택하면 생성 가능한 회차가 나타납니다'
        : '보고서를 생성할 회차를 선택해주세요';
  const previewHelp = selectedRoundInfo
    ? `${safe(selectedRoundInfo.round)}회차 ${safe(selectedRoundInfo.displayDate)} 기록으로 아래에 보고서를 표시합니다.`
    : '기준일, 반, 학생, 회차를 순서대로 선택하면 기존 다크 테마 보고서가 표시됩니다.';

  const periodButtons = (state.reportPeriods || [])
    .map(p => {
      const isSelected = state.selectedReportPeriod === p;
      return `
        <div data-action="select-report-period" data-period="${safe(p)}" class="inline-flex items-center gap-1 bg-slate-900/40 border border-slate-800 rounded-xl px-2.5 py-1.5 transition-all hover:border-slate-700 cursor-pointer ${isSelected ? 'border-blue-500 bg-blue-950/20' : ''}">
          <span class="text-xs font-bold text-slate-300 ${isSelected ? 'text-blue-400 font-extrabold' : ''}">
            ${safe(p)}
          </span>
          <button type="button" data-action="delete-report-period" data-period="${safe(p)}" class="text-[10px] text-slate-500 hover:text-rose-400 font-bold ml-1 transition-colors" title="삭제">
            &times;
          </button>
        </div>
      `;
    })
    .join('');

  const periodSectionHtml = `
    <div class="report-period-picker-container border-b border-slate-800/85 pb-4 mb-4">
      <div class="text-xs font-black text-slate-300 mb-2">보고서 시기(기간) 선택</div>
      <div class="flex flex-wrap gap-2 items-center">
        ${periodButtons}
        <button type="button" data-action="add-report-period" class="px-2.5 py-1.5 rounded-xl border border-dashed border-slate-700 bg-slate-950/10 text-xs font-bold text-slate-400 hover:border-slate-500 hover:text-slate-200 transition-colors flex items-center gap-1">
          <span>+ 직접입력</span>
        </button>
      </div>
    </div>
  `;

  return `
    <div class="space-y-6">
      <section class="report-round-panel no-print" data-report-flow="student-image">
        <div class="flex flex-col xl:flex-row xl:items-start justify-between gap-5">
          <div class="min-w-0">
            <h3 class="report-section-title" title="| 학생별 보고서 생성 설정"><span>|</span> 학생별 보고서 생성 설정</h3>
            <p class="text-xs text-slate-500 mt-1">기준일, 반, 학생, 회차를 순서대로 선택하면 해당 회차 보고서가 실시간으로 표시됩니다.</p>
          </div>
          <label class="report-date-control" data-action="open-report-date-picker">
            <span>보고서 회차 기준일</span>
            <input type="date" id="reportRoundStartDate" value="${safe(reportStartDate)}" data-class-id="${safe(activeReportClassId)}" onclick="try { this.showPicker(); } catch (err) {}" />
          </label>
        </div>

        ${periodSectionHtml}

        <div class="report-flow-stack mt-5">
          <div>
            <div class="report-flow-label">반 선택</div>
            ${renderBtnSelect({
              id: 'reportClassId',
              options: teacherClassesList.map(c => ({ value: c.id, label: c.name })),
              selectedValue: activeReportClassId,
              placeholder: '개설된 반이 없습니다.'
            })}
          </div>
          <div>
            <div class="report-flow-label">학생 선택</div>
            ${activeReportClassId ? renderBtnSelect({
              id: 'reportStudentId',
              options: classStudents.map(student => ({ value: student.id, label: student.name })),
              selectedValue: state.reportStudentId,
              placeholder: '이 반에 배정된 학생이 없습니다.'
            }) : '<div class="report-empty-message">반을 먼저 선택하면 학생 버튼이 나타납니다.</div>'}
          </div>
        </div>

        <div class="mt-4">
          <div class="text-xs font-black text-slate-300 mb-2">현재 생성 가능 회차</div>
          <div class="report-round-buttons">
            ${roundButtons}
          </div>
        </div>
      </section>

      <div class="space-y-4">
        ${state.printHtml ? `
          <div class="flex justify-end gap-2.5 no-print bg-slate-900/50 p-3 rounded-2xl border border-slate-800 max-w-4xl mx-auto">
            <button type="button" data-action="export-image" class="btn-teacher px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5">
              <span>이미지 파일(PNG)로 저장</span>
            </button>
            <button type="button" data-action="print" class="ghost-button px-4 py-2 rounded-xl text-xs font-extrabold">
              인쇄 / PDF 저장
            </button>
          </div>
        ` : ''}

        <div id="printArea" class="max-w-4xl mx-auto">
          ${state.printHtml || `
            <div class="card-3d rounded-2xl p-10 text-center text-slate-500 text-xs">
              <div class="text-lg sm:text-xl font-black text-slate-300 mb-2">${previewPlaceholder}</div>
              <div>${previewHelp}</div>
            </div>
          `}
        </div>
      </div>

      <section class="report-round-panel no-print" data-report-section="class-summary">
        <div class="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 class="report-section-title" title="| 반전체 보고서"><span>|</span> 반전체 보고서</h3>
            <p class="text-xs text-slate-500 mt-1">반 전체 진행표가 필요할 때만 이 영역에서 생성합니다.</p>
          </div>
        </div>
        <div class="space-y-4">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="report-flow-label">반 선택</span>
              <div class="filter-switch">
                <span class="filter-switch-item ${(!state.classSortType || state.classSortType === 'name') ? 'active' : ''}" data-action="set-class-sort" data-sort="name">이름순</span>
                <span class="filter-switch-item ${state.classSortType === 'grade' ? 'active' : ''}" data-action="set-class-sort" data-sort="grade">학년별</span>
              </div>
            </div>
            ${renderBtnSelect({
              id: 'reportClassId',
              options: teacherClassesList.map(c => ({ value: c.id, label: c.name })),
              selectedValue: activeReportClassId,
              placeholder: '개설된 반이 없습니다.'
            })}
          </div>
          <div class="flex justify-end gap-2">
            <button type="button" data-action="build-class-report" class="${btnClass} px-4 py-2.5 rounded-xl text-xs font-extrabold">
              반 전체표 생성
            </button>
            <button type="button" data-action="print-class-report" class="ghost-button px-4 py-2.5 rounded-xl text-xs font-extrabold">
              인쇄 / PDF
            </button>
          </div>
          ${state.classReportHtml ? `
            <div id="classReportPreviewArea" class="max-w-4xl mx-auto pt-2">
              ${state.classReportHtml}
            </div>
          ` : ''}
        </div>
      </section>
      ${state.classReportHtml ? `
        <div id="classReportPrintArea" class="print-only">
          ${state.classReportHtml}
        </div>
      ` : ''}
    </div>
  `;
}
