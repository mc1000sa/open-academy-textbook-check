import React, { useMemo } from 'react';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import {
  averageRubricVector,
  rubricComparisonForStudentClass,
  rubricComparisonForStudentBook
} from '../lib/reportMetrics.js';
import { buildCarryoverRows } from '../lib/textbookProgress.js';
import { buildReportRounds, formatRoundFileName } from '../lib/reportRounds.js';

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
  assignment: '과제',
  expression: '풀이',
  grading: '채점',
  attitude: '태도',
  understanding: '개념',
  application: '응용'
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

function rubricLabelPosition(index, radius = 93, center = 100) {
  const angle = (Math.PI * 2 * index) / RUBRIC_KEYS.length - Math.PI / 2;
  return {
    x: center + Math.cos(angle) * radius,
    y: center + Math.sin(angle) * radius
  };
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

function rangeUnitSummary(book, rows, unitsForRange) {
  const results = [];
  rows.forEach(row => {
    const units = typeof unitsForRange === 'function' ? unitsForRange(book, row.rangeStart, row.rangeEnd) : [];
    if (units.length > 0) {
      units.forEach(unit => {
        const name = String(unit?.name || '').trim();
        if (!name) return;
        const start = unit.start != null ? unit.start : '';
        const end = unit.end != null ? unit.end : '';
        const pageRange = (start !== '' && end !== '') ? ` (${start}쪽~${end}쪽)` : '';
        const entry = `${name}${pageRange}`;
        if (!results.includes(entry)) results.push(entry);
      });
    } else {
      const entry = `${row.rangeStart ?? '-'}~${row.rangeEnd ?? '-'}쪽`;
      if (!results.includes(entry)) results.push(entry);
    }
  });
  return results.length ? results.join(', ') : '';
}

function formatPageRanges(pages) {
  if (!pages || pages.length === 0) return '없음';
  const ranges = [];
  let start = pages[0];
  let end = pages[0];

  for (let i = 1; i < pages.length; i++) {
    if (pages[i] === end + 1) {
      end = pages[i];
    } else {
      if (start === end) {
        ranges.push(`${start}쪽`);
      } else {
        ranges.push(`${start}쪽~${end}쪽`);
      }
      start = pages[i];
      end = pages[i];
    }
  }
  if (start === end) {
    ranges.push(`${start}쪽`);
  } else {
    ranges.push(`${start}쪽~${end}쪽`);
  }
  return ranges.join(', ');
}

function missedPagesSummary(rows) {
  const missed = [...new Set(rows.flatMap(row => Array.isArray(row.missedPages) ? row.missedPages : []))]
    .sort((a, b) => Number(a) - Number(b));
  return formatPageRanges(missed);
}

// Static HTML report generation helper (specifically for html2canvas capturing)
function getStudentImageReportHtml(studentId, state, deps, options = {}) {
  const {
    studentById,
    classById,
    inspectionsForStudent,
    groupInspectionsByBook,
    bookById,
    averageCompletionRate,
    teacherNameById,
    unitsForRange
  } = deps;
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

  const allStudents = state.students || [];
  const allInspections = state.inspections || [];
  const classComparison = rubricComparisonForStudentClass({
    studentId,
    classId: student.classId,
    students: allStudents,
    inspections: allInspections
  });
  const classVector = classComparison.classAverageVector || {};

  const bookSections = Object.entries(grouped).map(([bookId, items]) => {
    const book = bookById(bookId);
    const avg = Math.round(averageCompletionRate(items));

    const latestItem = items[0];
    const isAbsent = latestItem?.status === 'absent';
    const isNoBook = latestItem?.status === 'no_book';

    let rangeUnitHtml = '';
    let missedPagesHtml = '';

    if (isAbsent) {
      rangeUnitHtml = `<span style="color: #ef4444; font-weight: bold;">- 결석</span>`;
      missedPagesHtml = `<span style="color: #ef4444; font-weight: bold;">- 결석</span>`;
    } else if (isNoBook) {
      rangeUnitHtml = `<span style="color: #ef4444; font-weight: bold;">- 교재 미지참</span>`;
      missedPagesHtml = `<span style="color: #ef4444; font-weight: bold;">- 교재 미지참</span>`;
    } else {
      rangeUnitHtml = rangeUnitSummary(book, items, unitsForRange);
      missedPagesHtml = missedPagesSummary(items);
    }

    return `
      <section class="parent-report-book">
        <div class="parent-report-book-head">
          <h3><span class="parent-report-pipe">|</span>${book?.title || '이름 없는 교재'}</h3>
          <span class="parent-report-completion-text">이번 과제 완료율 : <span>${avg}%</span></span>
        </div>
        <p><b>점검 중인 단원 :</b> ${rangeUnitHtml}</p>
        <p><b>보완 필요 쪽수 :</b> ${missedPagesHtml}</p>
      </section>
    `;
  }).join('');

  const rubricRows = RUBRIC_KEYS.map((key, index) => `
    <li><span>${index + 1}. ${RUBRIC_LABELS[key]}</span><b>${scoreText(vector, key)}</b></li>
  `).join('');
  
  const comments = rows
    .map(row => String(row.memo || '').trim())
    .filter(Boolean)
    .map(memo => `<p>${memo}</p>`)
    .join('');

  const selectedPeriod = state.selectedReportPeriod || '';
  const periodText = selectedPeriod ? `${selectedPeriod} ` : '';

  // Return full layout compatible with parents print area
  const axes = RUBRIC_KEYS.map((_, index) => {
    const point = rubricGridPoints(1).split(' ')[index];
    return `<line x1="100" y1="100" x2="${point.split(',')[0]}" y2="${point.split(',')[1]}" stroke="#e2e8f0" stroke-width="0.8"></line>`;
  }).join('');

  const grid = [0.25, 0.5, 0.75, 1].map(scale => `
    <polygon points="${rubricGridPoints(scale)}" fill="none" stroke="#e2e8f0" stroke-width="0.8"></polygon>
  `).join('');

  const labels = RUBRIC_KEYS.map((key, index) => {
    const pos = rubricLabelPosition(index, 92);
    const anchor = pos.x < 86 ? 'end' : pos.x > 114 ? 'start' : 'middle';
    const dy = index === 0 ? -4 : index === 3 ? 5 : 0;
    return `<text x="${pos.x.toFixed(1)}" y="${(pos.y + dy).toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle" fill="#312e81" font-size="11" font-weight="800">${IMAGE_RUBRIC_LABELS[key]}</text>`;
  }).join('');

  const scorePoints = rubricPoints(vector);
  const classPoints = rubricPoints(classVector);

  const classCircles = RUBRIC_KEYS.map((key, index) => {
    const angle = (Math.PI * 2 * index) / RUBRIC_KEYS.length - Math.PI / 2;
    const scoreRadius = (rubricScore(classVector, key) / 10) * 68;
    const x = 100 + Math.cos(angle) * scoreRadius;
    const y = 100 + Math.sin(angle) * scoreRadius;
    return `
      <g>
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="#10b981" opacity="0.3"></circle>
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.2" fill="#ffffff"></circle>
      </g>
    `;
  }).join('');

  const circles = RUBRIC_KEYS.map((key, index) => {
    const angle = (Math.PI * 2 * index) / RUBRIC_KEYS.length - Math.PI / 2;
    const scoreRadius = (rubricScore(vector, key) / 10) * 68;
    const x = 100 + Math.cos(angle) * scoreRadius;
    const y = 100 + Math.sin(angle) * scoreRadius;
    return `
      <g>
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="#4f46e5" opacity="0.4"></circle>
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.0" fill="#ffffff"></circle>
      </g>
    `;
  }).join('');

  const radarChart = `
    <svg class="parent-report-radar" viewBox="-30 -24 260 248" role="img" aria-label="교재 6요소 육각형 차트">
      <defs>
        <linearGradient id="image-student-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#818cf8" stop-opacity="0.45"></stop>
          <stop offset="100%" stop-color="#4f46e5" stop-opacity="0.45"></stop>
        </linearGradient>
        <linearGradient id="image-class-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#34d399" stop-opacity="0.15"></stop>
          <stop offset="100%" stop-color="#10b981" stop-opacity="0.15"></stop>
        </linearGradient>
      </defs>
      ${grid}
      ${axes}
      <polygon points="${classPoints}" fill="url(#image-class-grad)" stroke="#10b981" stroke-width="1.8" stroke-dasharray="3 2" stroke-linejoin="round"></polygon>
      <polygon points="${scorePoints}" fill="url(#image-student-grad)" stroke="#4f46e5" stroke-width="2.5" stroke-linejoin="round"></polygon>
      ${classCircles}
      ${circles}
      ${labels}
    </svg>
  `;

  return `
    <div class="parent-image-report" id="reportCaptureArea">
      <header class="parent-report-header">
        <div>
          <div class="parent-report-kicker">
            <strong>OATIS</strong>
            <span>|</span>
            <span>Open Academy Textbook Insight System</span>
          </div>
          <div style="height: 2px; background: #3730a3; margin: 10px 0 16px 0;"></div>
          <h1>
            <span class="parent-report-student-name">${student.name}</span>
            <span class="parent-report-meta">(${klass?.name || '-'}) - </span>
            <span class="parent-report-teacher-name">${teacherTitleName(teacherName)}</span>
          </h1>
          <p class="parent-report-subtitle">${periodText}<span class="parent-report-round-num">${roundLabel}</span> 교재 분석 보고서</p>
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
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <h2><span class="parent-report-pipe">|</span>교재 6요소</h2>
            <div style="display: flex; gap: 10px; font-size: 11px; font-weight: bold;">
              <span style="display: flex; align-items: center; gap: 4px; color: #4f46e5;">
                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #4f46e5;"></span>학생 평균
              </span>
              <span style="display: flex; align-items: center; gap: 4px; color: #10b981;">
                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981;"></span>반 평균
              </span>
            </div>
          </div>
          <ol>${rubricRows}</ol>
        </div>
        ${radarChart}
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

// React Rubric Radar Chart Component
function RubricRadarCompare({ title, primary, secondary, secondaryLabel }) {
  const grid = [0.25, 0.5, 0.75, 1].map((scale, i) => (
    <polygon
      key={i}
      points={rubricGridPoints(scale)}
      fill="none"
      stroke="rgba(148,163,184,0.15)"
      strokeWidth="0.8"
    />
  ));

  const axes = RUBRIC_KEYS.map((_, index) => {
    const point = rubricGridPoints(1).split(' ')[index];
    const [x2, y2] = point.split(',');
    return (
      <line
        key={index}
        x1="100"
        y1="100"
        x2={x2}
        y2={y2}
        stroke="rgba(148,163,184,0.1)"
        strokeWidth="0.8"
      />
    );
  });

  const labels = RUBRIC_KEYS.map((key, index) => {
    const pos = rubricLabelPosition(index);
    const anchor = pos.x < 86 ? 'end' : pos.x > 114 ? 'start' : 'middle';
    const dy = index === 0 ? -3 : index === 3 ? 5 : 0;
    return (
      <text
        key={key}
        x={pos.x.toFixed(1)}
        y={(pos.y + dy).toFixed(1)}
        textAnchor={anchor}
        dominantBaseline="middle"
        fill="#94a3b8"
        fontSize="7.5"
        fontWeight="800"
      >
        {RUBRIC_LABELS[key]}
      </text>
    );
  });

  const primaryPoints = rubricPoints(primary);
  const secondaryPoints = rubricPoints(secondary);

  const primaryCircles = RUBRIC_KEYS.map(key => {
    const angle = (Math.PI * 2 * RUBRIC_KEYS.indexOf(key)) / RUBRIC_KEYS.length - Math.PI / 2;
    const scoreRadius = (rubricScore(primary, key) / 10) * 68;
    const cx = 100 + Math.cos(angle) * scoreRadius;
    const cy = 100 + Math.sin(angle) * scoreRadius;
    return (
      <g key={key}>
        <circle
          cx={cx.toFixed(1)}
          cy={cy.toFixed(1)}
          r="4"
          fill="#3b82f6"
          opacity="0.4"
        />
        <circle
          cx={cx.toFixed(1)}
          cy={cy.toFixed(1)}
          r="1.8"
          fill="#ffffff"
        />
      </g>
    );
  });

  const secondaryCircles = RUBRIC_KEYS.map(key => {
    const angle = (Math.PI * 2 * RUBRIC_KEYS.indexOf(key)) / RUBRIC_KEYS.length - Math.PI / 2;
    const scoreRadius = (rubricScore(secondary, key) / 10) * 68;
    const cx = 100 + Math.cos(angle) * scoreRadius;
    const cy = 100 + Math.sin(angle) * scoreRadius;
    return (
      <g key={key}>
        <circle
          cx={cx.toFixed(1)}
          cy={cy.toFixed(1)}
          r="3"
          fill="#10b981"
          opacity="0.3"
        />
        <circle
          cx={cx.toFixed(1)}
          cy={cy.toFixed(1)}
          r="1.2"
          fill="#ffffff"
        />
      </g>
    );
  });

  return (
    <section className="rubric-report mt-4 p-4 rounded-xl bg-slate-950/40 border border-slate-800">
      <div className="flex flex-col md:flex-row md:items-start gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-black text-white mb-2">{title}</h3>
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>학생
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>{secondaryLabel || '비교 평균'}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 mt-3 text-[11px]">
            {RUBRIC_KEYS.map(key => (
              <div key={key} className="flex items-center justify-between gap-2">
                <span className="text-slate-400">{RUBRIC_LABELS[key]}</span>
                <span className="font-black text-slate-100">{rubricScore(primary, key).toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
        <svg className="shrink-0 w-full max-w-[300px] mx-auto md:mx-0 overflow-visible" viewBox="-28 -24 256 248">
          <defs>
            <linearGradient id="student-radar-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.35" />
            </linearGradient>
            <linearGradient id="average-radar-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          {grid}
          {axes}
          <polygon points={secondaryPoints} fill="url(#average-radar-grad)" stroke="#10b981" strokeWidth="1.5" strokeDasharray="3 2" strokeLinejoin="round"></polygon>
          <polygon points={primaryPoints} fill="url(#student-radar-grad)" stroke="#3b82f6" strokeWidth="2.2" strokeLinejoin="round"></polygon>
          {secondaryCircles}
          {primaryCircles}
          {labels}
        </svg>
      </div>
    </section>
  );
}

// Student Detailed Report Component (JSX version of reportForStudent)
function StudentReportPreview({ studentId, state, deps }) {
  const {
    studentById,
    classById,
    inspectionsForStudent,
    groupInspectionsByBook,
    bookById,
    averageCompletionRate,
    fmtDate,
    classRubricAverage,
    studentRubricAverage,
    assignedBooksForClass,
  } = deps;

  const student = studentById(studentId);
  if (!student) return null;
  const klass = classById(student.classId);
  const rows = inspectionsForStudent(studentId);
  const grouped = groupInspectionsByBook(rows);
  const allStudents = deps.students || state.students || [];
  const allInspections = deps.inspections || state.inspections || [];

  const studentOverallVector = useMemo(() => (
    typeof studentRubricAverage === 'function' ? studentRubricAverage(studentId, allInspections) : {}
  ), [studentId, allInspections, studentRubricAverage]);

  const classVector = useMemo(() => (
    typeof classRubricAverage === 'function' ? classRubricAverage(student.classId, allStudents, allInspections) : {}
  ), [student.classId, allStudents, allInspections, classRubricAverage]);

  const visibleBookIds = useMemo(() => (
    typeof assignedBooksForClass === 'function' ? new Set(assignedBooksForClass(student.classId).map(item => item.book.id)) : null
  ), [student.classId, assignedBooksForClass]);

  const totalAvg = useMemo(() => Math.round(averageCompletionRate(rows)), [rows, averageCompletionRate]);

  const cards = useMemo(() => (
    Object.entries(grouped)
      .filter(([bookId]) => !visibleBookIds || visibleBookIds.has(bookId))
      .map(([bookId, items]) => {
        const book = bookById(bookId);
        const avg = Math.round(averageCompletionRate(items));
        const latest = items[0];
        const tone = defaultProgressTone();
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

        const allMissed = new Set(buildCarryoverRows({
          inspections: items,
          studentId,
          bookId
        }).flatMap(row => row.missedPages));
        const missedSorted = Array.from(allMissed).sort((a, b) => a - b);

        const pageRanges = [];
        if (missedSorted.length > 0) {
          let start = missedSorted[0];
          let end = missedSorted[0];
          for (let i = 1; i < missedSorted.length; i++) {
            if (missedSorted[i] === end + 1) {
              end = missedSorted[i];
            } else {
              pageRanges.push(start === end ? `${start}쪽` : `${start}쪽~${end}쪽`);
              start = missedSorted[i];
              end = missedSorted[i];
            }
          }
          pageRanges.push(start === end ? `${start}쪽` : `${start}쪽~${end}쪽`);
        }

        return (
          <div key={bookId} className="report-book-card p-5 mb-5 rounded-2xl border border-slate-700/50 bg-slate-900/30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <div className="text-base font-extrabold text-white">{book?.title || '알 수 없는 교재'}</div>
                <div className="text-xs text-slate-400 mt-1">
                  최근 점검: {fmtDate(latest?.date)} &nbsp;|&nbsp; 담당교사: {latest?.teacherName || '강사'}T
                </div>
              </div>
              <div className="px-3.5 py-1.5 rounded-full text-xs font-black text-white text-center" style={{ background: tone.bar, boxStyle: `0 0 10px ${tone.bar}44` }}>
                완료율 {avg}%
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 text-xs">
              <span className="font-bold text-slate-300 block mb-2">보완 필요 쪽수:</span>
              {pageRanges.length === 0 ? (
                <span className="text-emerald-400 font-bold">★ 완료율 100%! 모든 보완 학습이 완료되었습니다. ★</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {pageRanges.map(range => (
                    <span key={range} className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">{range}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 space-y-2">
              <span className="text-[11px] font-bold text-slate-400 block">최근 3회 교재 세부 점검내역:</span>
              {items.slice(0, 3).map((r, ri) => (
                <div key={ri} className="p-3 rounded-lg bg-slate-900/40 border border-slate-800/80 text-xs flex justify-between items-start gap-4">
                  <div>
                    <span className="font-bold text-slate-200">
                      {fmtDate(r.date)} &middot;{' '}
                      {r.status === 'absent' ? (
                        <span className="text-rose-400">결석</span>
                      ) : r.status === 'no_book' ? (
                        <span className="text-rose-400">교재 미지참</span>
                      ) : (
                        `${r.rangeStart}~${r.rangeEnd}쪽`
                      )}
                    </span>
                    {r.memo && <p className="text-slate-400 mt-1 italic">"{r.memo}"</p>}
                  </div>
                  <span className="font-extrabold text-slate-300">{r.completionRate}%</span>
                </div>
              ))}
            </div>

            <RubricRadarCompare
              title="해당 교재 평균 vs 학생 6요소"
              primary={studentBookVector}
              secondary={bookVector}
              secondaryLabel="해당 교재 평균"
            />
            <RubricRadarCompare
              title="반 평균 6요소 비교"
              primary={classComparison.studentVector || studentOverallVector}
              secondary={classComparison.classAverageVector || classVector}
              secondaryLabel="반 평균"
            />
          </div>
        );
      })
  ), [grouped, visibleBookIds, bookById, averageCompletionRate, fmtDate, studentId, allStudents, allInspections, studentOverallVector, classVector]);

  return (
    <div className="print-report rounded-[28px] p-6 md:p-8 bg-slate-950 border border-slate-800 text-white" id="reportCaptureArea">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 mb-6 border-b border-slate-800">
        <div>
          <span className="px-2.5 py-0.5 rounded text-[10px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/20">REPORT</span>
          <h1 className="text-2xl font-black text-white mt-2">{student.name} 학생 교재 분석 보고서</h1>
          <p className="text-xs text-slate-400 mt-1.5">
            반: <span className="text-slate-200">{klass?.name || '-'}</span> &nbsp;|&nbsp;
            학교: <span className="text-slate-200">{student.school || '-'}</span> &nbsp;|&nbsp;
            학년: <span className="text-slate-200">{student.grade || '-'}</span>
          </p>
        </div>

        <div className="flex items-center gap-3 bg-slate-900/80 px-4 py-3 rounded-2xl border border-slate-800">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 font-bold block mb-0.5">통합 교재 완료율</span>
            <strong className="text-xl font-black text-blue-400">{totalAvg}%</strong>
          </div>
          <div className="w-10 h-10 rounded-full border-4 border-blue-500/20 flex items-center justify-center" style={{ borderTopColor: '#4169e1' }}>
            <span className="text-[9px] text-blue-400 font-bold">AVG</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {cards.length ? cards : <div className="text-center py-10 text-slate-500 text-sm">기록된 점검 이력이 존재하지 않습니다.</div>}
      </div>

      <div className="text-center mt-8 pt-4 border-t border-slate-900 text-[10px] text-slate-500">
        열린학원 OATIS 교재분석 리포트 &middot; 본 문서는 학생의 학업 성취 관리를 위해 자동으로 생성되었습니다.
      </div>
    </div>
  );
}

// Class Summary Report Component (JSX version of reportForClass)
function ClassReportPreview({ classId, state, deps }) {
  const {
    classById,
    studentsForClass,
    inspectionsForStudent,
    averageCompletionRate,
    fmtDate,
    teacherNameById,
    classRubricAverage,
    studentRubricAverage,
  } = deps;

  const klass = classById(classId);
  if (!klass) return null;
  const students = studentsForClass(classId);
  const allStudents = deps.students || state.students || [];
  const allInspections = deps.inspections || state.inspections || [];

  const classVector = useMemo(() => (
    typeof classRubricAverage === 'function' ? classRubricAverage(classId, allStudents, allInspections) : {}
  ), [classId, allStudents, allInspections, classRubricAverage]);

  const rows = useMemo(() => (
    students.map(s => {
      const logs = inspectionsForStudent(s.id);
      const avg = Math.round(averageCompletionRate(logs));
      const latest = logs[0]?.date || '';
      const vector = typeof studentRubricAverage === 'function' ? studentRubricAverage(s.id, allInspections) : {};

      return (
        <tr key={s.id} className="border-b border-slate-800/80 hover:bg-slate-900/30 text-xs">
          <td className="px-4 py-3 text-slate-200 font-bold">{s.name}</td>
          <td className="px-4 py-3 text-slate-400">{s.school || '-'}</td>
          <td className="px-4 py-3 text-right font-black text-blue-400">{avg}%</td>
          <td className="px-4 py-3 text-slate-400 text-center">{fmtDate(latest) || '-'}</td>
          {RUBRIC_KEYS.map(key => (
            <td key={key} className="px-3 py-3 text-center font-bold text-slate-200">{rubricScore(vector, key).toFixed(1)}</td>
          ))}
        </tr>
      );
    })
  ), [students, inspectionsForStudent, averageCompletionRate, studentRubricAverage, allInspections, fmtDate]);

  return (
    <div className="print-report rounded-[28px] p-6 md:p-8 bg-slate-950 border border-slate-800 text-white" id="reportCaptureArea">
      <div className="pb-6 mb-6 border-b border-slate-800">
        <span className="px-2.5 py-0.5 rounded text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">CLASS SUMMARY</span>
        <h1 className="text-2xl font-black text-white mt-2">{klass.name} 반별 교재 현황표</h1>
        <p className="text-xs text-slate-400 mt-1.5">담당 강사: <span className="text-slate-200">{teacherNameById(klass.teacherId)} T</span></p>
      </div>

      <div className="class-rubric-table overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/40 text-[11px] font-bold text-slate-400">
              <th class="px-4 py-3">학생 이름</th>
              <th class="px-4 py-3">학교</th>
              <th class="px-4 py-3 text-right">평균 완료율</th>
              <th class="px-4 py-3 text-center">최근 점검일</th>
              {RUBRIC_KEYS.map(key => (
                <th key={key} className="px-3 py-3 text-center whitespace-nowrap">{RUBRIC_LABELS[key]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              <>
                <tr className="border-b border-emerald-500/20 bg-emerald-500/5 text-xs">
                  <td className="px-4 py-3 text-emerald-200 font-black" colSpan="4">반 평균</td>
                  {RUBRIC_KEYS.map(key => (
                    <td key={key} className="px-3 py-3 text-center font-black text-emerald-300">{rubricScore(classVector, key).toFixed(1)}</td>
                  ))}
                </tr>
                {rows}
              </>
            ) : (
              <tr><td colSpan="10" className="px-4 py-10 text-center text-slate-500">등록된 학생이 존재하지 않습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="text-center mt-8 pt-4 border-t border-slate-900 text-[10px] text-slate-500">
        열린학원 OATIS 교재분석 리포트 &middot; 반별 관리용 리포트입니다.
      </div>
    </div>
  );
}

// Main Reports Component
export default function Reports({
  state,
  deps,
  updateLegacyState,
  showModalAlert
}) {
  const {
    teacherClasses,
    classById,
    studentById,
    teacherNameById,
    inspectionsForStudent,
    groupInspectionsByBook,
    bookById,
    averageCompletionRate,
    fmtDate,
    classRubricAverage,
    studentRubricAverage,
    assignedBooksForClass,
    studentsForClass,
    unitsForRange,
    reportForClass
  } = deps;

  // Sorting and filtering classes
  let teacherClassesList = useMemo(() => {
    let list = state.currentTeacher.role === 'admin' ? state.classes : teacherClasses(state.currentTeacher.id);
    const classSort = state.classSortType || 'name';
    if (classSort === 'grade') {
      const GRADE_WEIGHTS = { '고1': 1, '고2': 2, '고3': 3 };
      return [...list].sort((a, b) => {
        const wA = GRADE_WEIGHTS[a.grade] || 99;
        const wB = GRADE_WEIGHTS[b.grade] || 99;
        if (wA !== wB) return wA - wB;
        return String(a.name || '').localeCompare(String(b.name || ''), 'ko');
      });
    }
    return [...list].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko'));
  }, [state.currentTeacher, state.classes, state.classSortType, teacherClasses]);

  const studentsList = useMemo(() => {
    return state.currentTeacher.role === 'admin'
      ? state.students
      : state.students.filter(s => teacherClassesList.some(c => c.id === s.classId));
  }, [state.currentTeacher, state.students, teacherClassesList]);

  const selectedStudent = useMemo(() => {
    return studentsList.find(s => s.id === state.reportStudentId);
  }, [studentsList, state.reportStudentId]);

  const activeReportClassId = selectedStudent?.classId || state.reportClassId || '';
  const activeReportClass = classById(activeReportClassId);
  const reportRoundStartDate = state.reportRoundStartDate || activeReportClass?.reportRoundStartDate || '';

  const classStudents = useMemo(() => {
    if (!activeReportClassId) return [];
    return studentsList
      .filter(s => s.classId === activeReportClassId)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko'));
  }, [studentsList, activeReportClassId]);

  const reportRounds = useMemo(() => {
    return state.reportStudentId ? (state.reportRounds || []) : [];
  }, [state.reportStudentId, state.reportRounds]);

  const selectedReportRound = Number(state.selectedReportRound || 0);
  const selectedRoundInfo = useMemo(() => {
    return reportRounds.find(round => round.round === selectedReportRound);
  }, [reportRounds, selectedReportRound]);

  // Action handlers
  const handleDateChange = (e) => {
    const val = e.target.value;
    updateLegacyState({ reportRoundStartDate: val });
    
    // Refresh rounds if active
    setTimeout(() => {
      if (typeof deps.refreshReportRounds === 'function') deps.refreshReportRounds();
    }, 100);
  };

  const handleClassSelect = (val) => {
    // Toggle class selection: Click again to cancel
    if (activeReportClassId === val) {
      updateLegacyState({
        reportClassId: '',
        reportStudentId: '',
        selectedReportRound: '',
        printHtml: ''
      });
    } else {
      updateLegacyState({
        reportClassId: val,
        reportStudentId: '',
        selectedReportRound: '',
        printHtml: ''
      });
    }
  };

  const handleStudentSelect = (studentId) => {
    updateLegacyState({
      reportStudentId: studentId,
      selectedReportRound: '',
      printHtml: ''
    });
  };

  const handleRoundSelect = (roundNum) => {
    // printHtml을 '__react_preview__'로 설정해 StudentReportPreview React 컴포넌트 표시 트리거
    // 실제 보고서 렌더링은 StudentReportPreview 컴포넌트가 담당
    updateLegacyState({ selectedReportRound: roundNum, printHtml: roundNum ? '__react_preview__' : '' });
  };

  const handlePeriodMove = (period, direction) => {
    if (typeof deps.moveReportPeriod === 'function') {
      deps.moveReportPeriod(period, direction);
    }
  };

  const handlePeriodSelect = (period) => {
    updateLegacyState({ selectedReportPeriod: period });
  };

  const handlePeriodDelete = (period) => {
    if (typeof deps.deleteReportPeriod === 'function') {
      deps.deleteReportPeriod(period);
    }
  };

  const handlePeriodAdd = () => {
    if (typeof deps.addReportPeriod === 'function') {
      deps.addReportPeriod();
    }
  };

  const handleSetClassSort = (sortType) => {
    updateLegacyState({ classSortType: sortType });
  };

  const handleBuildClassReport = () => {
    if (!activeReportClassId) {
      showModalAlert('반을 먼저 선택해 주세요.');
      return;
    }
    // deps.reportForClass 가 있으면 이를 사용하고, 없으면 ClassReportPreview React 컴포넌트만 표시
    if (typeof reportForClass === 'function') {
      const html = reportForClass(activeReportClassId);
      updateLegacyState({ classReportHtml: html });
    } else {
      // reportForClass 없어도 React ClassReportPreview 표시
      updateLegacyState({ classReportHtml: '__react_preview__' });
    }
    setTimeout(() => {
      document.getElementById('classReportPreviewArea')?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  };

  const handlePrint = () => {
    window.print();
  };

  const handlePrintClassReport = () => {
    if (!state.classReportHtml) {
      showModalAlert('먼저 반 전체표를 생성해 주세요.');
      return;
    }
    const clearPrintMode = () => document.body.classList.remove('printing-class-report');
    document.body.classList.add('printing-class-report');
    window.addEventListener('afterprint', clearPrintMode, { once: true });
    window.print();
    window.setTimeout(clearPrintMode, 1000);
  };

  // Export individual report as PNG
  const handleExportImage = async () => {
    let targetArea = document.getElementById('reportCaptureArea');
    if (!targetArea && !(state.reportStudentId && selectedRoundInfo)) {
      showModalAlert('캡처할 보고서 영역을 찾을 수 없습니다.');
      return;
    }
    updateLegacyState({ saveMsg: '🖼️ 이미지 생성 중입니다. 잠시만 기다려 주세요...' });

    let temporaryCaptureHost = null;
    try {
      if (state.reportStudentId && selectedRoundInfo) {
        temporaryCaptureHost = document.createElement('div');
        temporaryCaptureHost.style.position = 'fixed';
        temporaryCaptureHost.style.left = '-10000px';
        temporaryCaptureHost.style.top = '0';
        temporaryCaptureHost.style.width = '720px';
        temporaryCaptureHost.style.background = '#ffffff';
        temporaryCaptureHost.style.zIndex = '-1';
        temporaryCaptureHost.innerHTML = getStudentImageReportHtml(state.reportStudentId, state, {
          studentById,
          classById,
          inspectionsForStudent,
          groupInspectionsByBook,
          bookById,
          averageCompletionRate,
          fmtDate,
          teacherNameById,
          unitsForRange
        }, { round: selectedRoundInfo });
        document.body.appendChild(temporaryCaptureHost);
        targetArea = temporaryCaptureHost.querySelector('#reportCaptureArea');
      }

      if (!targetArea) {
        throw new Error('캡처 영역을 찾지 못했습니다.');
      }

      const canvas = await html2canvas(targetArea, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true
      });
      const imageUri = canvas.toDataURL('image/png');
      let fileName = 'OATIS_보고서.png';

      if (state.reportStudentId && selectedRoundInfo) {
        const student = state.students.find(s => s.id === state.reportStudentId);
        const klass = classById(student?.classId);
        if (student && klass) {
          fileName = formatRoundFileName({
            teacherName: teacherNameById(klass.teacherId),
            className: klass.name,
            studentName: student.name,
            round: selectedRoundInfo
          });
        }
      }

      const link = document.createElement('a');
      link.href = imageUri;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      updateLegacyState({ saveMsg: '🎉 이미지 파일이 성공적으로 저장되었습니다!' });
    } catch (err) {
      console.error(err);
      updateLegacyState({ saveMsg: '' });
      showModalAlert(`이미지 저장 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      if (temporaryCaptureHost) {
        document.body.removeChild(temporaryCaptureHost);
      }
    }

    setTimeout(() => {
      updateLegacyState({ saveMsg: '' });
    }, 4000);
  };

  // Export bulk reports for class as individual PNG images
  const handleExportClassImages = async () => {
    if (!activeReportClassId) {
      showModalAlert('반을 먼저 선택해 주세요.');
      return;
    }
    if (!selectedReportRound) {
      showModalAlert('다운로드할 보고서 회차를 먼저 선택해 주세요.');
      return;
    }

    const klass = classById(activeReportClassId);
    if (!klass) return;

    const activeStudents = state.students
      .filter(s => s.classId === activeReportClassId && s.active !== false)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko'));

    if (activeStudents.length === 0) {
      showModalAlert('이 반에 배정된 학생이 없습니다.');
      return;
    }

    updateLegacyState({ saveMsg: `🖼️ 반 일괄 이미지 다운로드를 시작합니다 (총 ${activeStudents.length}명)...` });

    try {
      let captureCount = 0;

      for (let i = 0; i < activeStudents.length; i++) {
        const student = activeStudents[i];
        updateLegacyState({ saveMsg: `🖼️ 이미지 저장 중... (${i + 1}/${activeStudents.length}) - ${student.name} 학생` });

        const startDate = reportRoundStartDate || klass.reportRoundStartDate || '';
        const studentRounds = buildReportRounds({
          inspections: state.inspections,
          classId: activeReportClassId,
          studentId: student.id,
          startDate
        });
        const round = studentRounds.find(r => r.round === selectedReportRound);
        if (!round) {
          console.log(`${student.name} student does not have inspection records for round ${selectedReportRound}, skipping.`);
          continue;
        }

        const studentHtml = getStudentImageReportHtml(student.id, state, {
          studentById,
          classById,
          inspectionsForStudent,
          groupInspectionsByBook,
          bookById,
          averageCompletionRate,
          fmtDate,
          teacherNameById,
          unitsForRange
        }, { round });

        const fileName = formatRoundFileName({
          teacherName: teacherNameById(klass.teacherId),
          className: klass.name,
          studentName: student.name,
          round
        });

        const captureHost = document.createElement('div');
        captureHost.style.position = 'fixed';
        captureHost.style.left = '-10000px';
        captureHost.style.top = '0';
        captureHost.style.width = '720px';
        captureHost.style.background = '#ffffff';
        captureHost.style.zIndex = '-1';
        captureHost.innerHTML = studentHtml;
        document.body.appendChild(captureHost);

        try {
          const targetElement = captureHost.querySelector('#reportCaptureArea') || captureHost.firstChild;
          if (targetElement) {
            const canvas = await html2canvas(targetElement, {
              backgroundColor: '#ffffff',
              scale: 2,
              useCORS: true,
              logging: false
            });

            const imageUri = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = imageUri;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            captureCount++;
          }
        } catch (err) {
          console.error(`${student.name} 학생 이미지 생성 실패:`, err);
        } finally {
          document.body.removeChild(captureHost);
        }

        await new Promise(resolve => setTimeout(resolve, 350));
      }

      if (captureCount > 0) {
        updateLegacyState({ saveMsg: `🎉 반 전체 이미지 일괄 다운로드가 완료되었습니다! (총 ${captureCount}명)` });
      } else {
        updateLegacyState({ saveMsg: '⚠️ 생성된 보고서가 없어 다운로드를 중단합니다.' });
      }
    } catch (err) {
      console.error(err);
      updateLegacyState({ saveMsg: '' });
      showModalAlert(`일괄 다운로드 중 오류가 발생했습니다: ${err.message}`);
    }

    setTimeout(() => {
      updateLegacyState({ saveMsg: '' });
    }, 4000);
  };

  const previewPlaceholder = !reportRoundStartDate
    ? '보고서 회차 기준일을 먼저 선택해주세요'
    : !activeReportClassId
      ? '보고서를 생성할 반을 선택해주세요'
      : !state.reportStudentId
        ? '학생을 선택하면 생성 가능한 회차가 나타납니다'
        : '보고서를 생성할 회차를 선택해주세요';

  const previewHelp = selectedRoundInfo
    ? `${selectedRoundInfo.round}회차 ${selectedRoundInfo.displayDate} 기록으로 아래에 보고서를 표시합니다.`
    : '기준일, 반, 학생, 회차를 순서대로 선택하면 기존 다크 테마 보고서가 표시됩니다.';

  const checkedStudentIds = useMemo(() => {
    if (!activeReportClassId || !reportRoundStartDate) return new Set();
    return new Set(
      (state.inspections || [])
        .filter(r => r.classId === activeReportClassId && r.date >= reportRoundStartDate)
        .map(r => r.studentId)
    );
  }, [state.inspections, activeReportClassId, reportRoundStartDate]);

  return (
    <div className="space-y-8">
      {/* Student Report Setup Section */}
      <section className="report-round-panel no-print" data-report-flow="student-image">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-5">
          <div className="min-w-0">
            <h3 className="report-section-title" title="| 학생별 보고서 생성 설정">
              <span>|</span> 학생별 보고서 생성 설정
            </h3>
            <p className="text-xs text-slate-500 mt-1">기준일, 반, 학생, 회차를 순서대로 선택하면 해당 회차 보고서가 실시간으로 표시됩니다.</p>
          </div>
          <label
            className="report-date-control"
            data-action="open-report-date-picker"
          >
            <span>보고서 회차 기준일</span>
            <input
              type="date"
              id="reportRoundStartDate"
              value={reportRoundStartDate}
              onChange={handleDateChange}
              onClick={(e) => {
                if (typeof e.currentTarget.showPicker === 'function') {
                  e.currentTarget.showPicker();
                }
              }}
            />
          </label>
        </div>

        {/* Report Period Picker */}
        <div className="report-period-picker-container border-b border-slate-800/85 pb-4 mb-4 mt-4">
          <div className="text-xs font-black text-slate-300 mb-2">보고서 시기(기간) 선택</div>
          <div className="flex flex-wrap gap-2 items-center">
            {(state.reportPeriods || []).map(p => {
              const isSelected = state.selectedReportPeriod === p;
              return (
                <div
                  key={p}
                  className={`inline-flex items-center gap-1 bg-slate-900/40 border border-slate-800 rounded-xl px-2 py-1.5 transition-all hover:border-slate-700 ${
                    isSelected ? 'selected-period' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handlePeriodMove(p, 'left')}
                    className="text-[9px] text-slate-600 hover:text-blue-400 font-bold px-0.5 transition-colors cursor-pointer bg-transparent border-none p-0 outline-none"
                    title="왼쪽으로 이동"
                  >
                    ◀
                  </button>
                  &nbsp;
                  <button
                    type="button"
                    onClick={() => handlePeriodSelect(p)}
                    className="text-xs font-bold text-slate-300 cursor-pointer bg-transparent border-none p-0 outline-none transition-colors"
                  >
                    {p}
                  </button>
                  &nbsp;
                  <button
                    type="button"
                    onClick={() => handlePeriodMove(p, 'right')}
                    className="text-[9px] text-slate-600 hover:text-blue-400 font-bold px-0.5 transition-colors cursor-pointer bg-transparent border-none p-0 outline-none"
                    title="오른쪽으로 이동"
                  >
                    ▶
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePeriodDelete(p)}
                    className="text-[10px] text-slate-500 hover:text-rose-400 font-bold ml-1 transition-colors cursor-pointer bg-transparent border-none p-0 outline-none"
                    title="삭제"
                  >
                    &times;
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={handlePeriodAdd}
              className="px-2.5 py-1.5 rounded-xl border border-dashed border-slate-700 bg-slate-950/10 text-xs font-bold text-slate-400 hover:border-slate-500 hover:text-slate-200 transition-colors flex items-center gap-1"
              style={{ cursor: 'pointer' }}
            >
              <span>+ 직접입력</span>
            </button>
          </div>
        </div>

        {/* Class Selection Flow */}
        <div className="report-flow-stack mt-5">
          <div>
            <div className="report-flow-label">반 선택</div>
            <div className="choice-grid" id="reportClassId">
              {teacherClassesList.length ? (
                teacherClassesList.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleClassSelect(c.id)}
                    className={`choice-button btn-choice-teacher ${activeReportClassId === c.id ? 'selected' : ''}`}
                    style={{ cursor: 'pointer' }}
                  >
                    {c.name}
                  </button>
                ))
              ) : (
                <div className="text-xs text-slate-500 p-2 font-bold">개설된 반이 없습니다.</div>
              )}
            </div>
          </div>

          {/* Student Selection Flow */}
          <div>
            <div className="report-flow-label">학생 선택</div>
            {activeReportClassId ? (
              classStudents.length === 0 ? (
                <div className="text-xs text-slate-500 p-2 font-bold">이 반에 배정된 학생이 없습니다.</div>
              ) : (
                <div className="choice-grid" id="reportStudentId">
                  {classStudents.map(student => {
                    const active = student.id === state.reportStudentId;
                    const isSaved = checkedStudentIds.has(student.id);
                    let btnClass = '';
                    if (active) btnClass = 'selected';
                    else if (isSaved) btnClass = 'inspected-saved';

                    return (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => handleStudentSelect(student.id)}
                        className={`choice-button btn-choice-teacher ${btnClass}`}
                        style={{ cursor: 'pointer' }}
                      >
                        {student.name}
                      </button>
                    );
                  })}
                </div>
              )
            ) : (
              <div className="report-empty-message">반을 먼저 선택하면 학생 버튼이 나타납니다.</div>
            )}
          </div>
        </div>

        {/* Current Available Rounds */}
        <div className="mt-4">
          <div className="text-xs font-black text-slate-300 mb-2">현재 생성 가능 회차</div>
          <div className="report-round-buttons">
            {reportRounds.length ? (
              reportRounds.map(round => (
                <button
                  key={round.round}
                  type="button"
                  onClick={() => handleRoundSelect(round.round)}
                  className={`report-round-button ${selectedReportRound === round.round ? 'active' : ''}`}
                  style={{ cursor: 'pointer' }}
                >
                  {round.round}회차 ({round.displayDate})
                </button>
              ))
            ) : (
              <div className="text-xs font-bold text-slate-500">
                {state.reportStudentId ? '기준일 이후 해당 학생 점검 기록이 아직 없습니다.' : '학생을 선택하면 생성 가능한 회차가 표시됩니다.'}
              </div>
            )}
          </div>
        </div>

        {/* Report Preview Control Area (Merged Inside the Setup Card) */}
        <div className="mt-6 border-t border-slate-800/80 pt-6">
          {state.printHtml && (
            <div className="flex justify-end gap-2.5 no-print bg-slate-900/50 p-3 rounded-2xl border border-slate-800 mb-4">
              <button
                type="button"
                onClick={handleExportImage}
                className="btn-teacher px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5"
                style={{ cursor: 'pointer' }}
              >
                <span>개인 이미지 저장</span>
              </button>
              <button
                type="button"
                onClick={handleExportClassImages}
                className="btn-teacher-green px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5"
                style={{ cursor: 'pointer' }}
              >
                <span>반 일괄 이미지 저장</span>
              </button>
            </div>
          )}

          <div id="printArea">
            {state.printHtml ? (
              <StudentReportPreview
                studentId={state.reportStudentId}
                state={state}
                deps={deps}
              />
            ) : (
              <div className="card-3d rounded-2xl p-10 text-center text-slate-500 text-xs">
                <div className="text-lg sm:text-xl font-black text-slate-300 mb-2">{previewPlaceholder}</div>
                <div>{previewHelp}</div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Class Summary Report Section */}
      <section className="report-round-panel no-print" data-report-section="class-summary">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="report-section-title" title="| 반전체 보고서">
              <span>|</span> 반전체 보고서
            </h3>
            <p className="text-xs text-slate-500 mt-1">반 전체 진행표가 필요할 때만 이 영역에서 생성합니다.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="report-flow-label">반 선택</span>
              <div className="filter-switch">
                <span
                  onClick={() => handleSetClassSort('name')}
                  className={`filter-switch-item ${(!state.classSortType || state.classSortType === 'name') ? 'active' : ''}`}
                >
                  이름순
                </span>
                <span
                  onClick={() => handleSetClassSort('grade')}
                  className={`filter-switch-item ${state.classSortType === 'grade' ? 'active' : ''}`}
                >
                  학년별
                </span>
              </div>
            </div>

            <div className="choice-grid" id="reportClassSortId">
              {teacherClassesList.length ? (
                teacherClassesList.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleClassSelect(c.id)}
                    className={`choice-button btn-choice-teacher ${activeReportClassId === c.id ? 'selected' : ''}`}
                    style={{ cursor: 'pointer' }}
                  >
                    {c.name}
                  </button>
                ))
              ) : (
                <div className="text-xs text-slate-500 p-2 font-bold">개설된 반이 없습니다.</div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleBuildClassReport}
              className="btn-teacher px-4 py-2.5 rounded-xl text-xs font-extrabold"
              style={{ cursor: 'pointer' }}
            >
              반 전체표 생성
            </button>
          </div>

          {state.classReportHtml && (
            <div id="classReportPreviewArea" className="pt-4">
              <ClassReportPreview
                classId={activeReportClassId}
                state={state}
                deps={deps}
              />
            </div>
          )}
        </div>
      </section>

      {/* Printing Mode Mirror Render Section (For PDF/Print Output) */}
      {state.classReportHtml && (
        <div id="classReportPrintArea" className="print-only">
          <ClassReportPreview
            classId={activeReportClassId}
            state={state}
            deps={deps}
          />
        </div>
      )}
    </div>
  );
}
