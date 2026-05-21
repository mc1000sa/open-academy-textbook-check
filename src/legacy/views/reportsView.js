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
  
  // 전체 평균 완료율
  const totalAvg = Math.round(averageCompletionRate(rows));

  const cards = Object.entries(grouped).map(([bookId, items]) => {
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
  const { teacherClasses, classById } = deps;
  const teacherClassesList = state.currentTeacher.role === 'admin' ? state.classes : teacherClasses(state.currentTeacher.id);
  const studentsList = state.currentTeacher.role === 'admin' ? state.students : state.students.filter(s => teacherClassesList.some(c => c.id === s.classId));

  // 포털 테마에 따른 전용 버튼 스타일링: Royal Blue
  const btnClass = 'btn-teacher';

  return `
    <div class="space-y-6">
      <div class="grid xl:grid-cols-[1fr_1fr] gap-6 no-print">
        
        <!-- 학생별 보고서 생성 카드 -->
        <article class="card-3d rounded-2xl p-5 md:p-6">
          <div class="flex items-center justify-between gap-3 mb-4">
            <h3 class="text-base font-extrabold text-white">학생별 보고서 출력</h3>
            <span class="text-[10px] text-slate-400 font-medium">개인 맞춤 피드백</span>
          </div>
          
          <div class="space-y-4">
            <div class="flex flex-col gap-2">
              <span class="text-xs font-bold text-slate-400">대상 학생 선택</span>
              ${renderBtnSelect({
                id: 'reportStudentId',
                options: studentsList.sort((a,b)=>String(a.name).localeCompare(String(b.name),'ko')).map(s=>({
                  value: s.id,
                  label: `${s.name} (${classById(s.classId)?.name || '-'})`
                })),
                selectedValue: state.reportStudentId,
                placeholder: '배정된 학생이 없습니다.'
              })}
            </div>
            
            <p class="text-xs text-slate-500 leading-normal">
              학생 개인별 완료율 추이, 교재 미비 쪽수 리스트 및 최종 선생님 피드백이 담긴 리포트를 생성합니다.
            </p>
            
            <div class="flex gap-2">
              <button type="button" data-action="build-student-report" class="${btnClass} px-4 py-2.5 rounded-xl text-xs font-extrabold flex-1">
                학생 보고서 생성
              </button>
              <button type="button" data-action="print" class="ghost-button px-4 py-2.5 rounded-xl text-xs font-extrabold">
                인쇄 / PDF
              </button>
            </div>
          </div>
        </article>

        <!-- 반별 현황표 생성 카드 -->
        <article class="card-3d rounded-2xl p-5 md:p-6">
          <div class="flex items-center justify-between gap-3 mb-4">
            <h3 class="text-base font-extrabold text-white">반별 전체 진행표 출력</h3>
            <span class="text-[10px] text-slate-400 font-medium">학급 전체 현황</span>
          </div>
          
          <div class="space-y-4">
            <div class="flex flex-col gap-2">
              <span class="text-xs font-bold text-slate-400">대상 반 선택</span>
              ${renderBtnSelect({
                id: 'reportClassId',
                options: teacherClassesList.map(c=>({ value: c.id, label: c.name })),
                selectedValue: state.reportClassId,
                placeholder: '개설된 반이 없습니다.'
              })}
            </div>
            
            <p class="text-xs text-slate-500 leading-normal">
              반에 소속된 전체 학생의 평균 학습 진도 완료율 및 최근 점검 로그를 요약한 현황표를 만듭니다.
            </p>
            
            <div class="flex gap-2">
              <button type="button" data-action="build-class-report" class="${btnClass} px-4 py-2.5 rounded-xl text-xs font-extrabold flex-1">
                반 전체표 생성
              </button>
              <button type="button" data-action="print" class="ghost-button px-4 py-2.5 rounded-xl text-xs font-extrabold">
                인쇄 / PDF
              </button>
            </div>
          </div>
        </article>

      </div>

      <!-- 리포트 출력 및 제어부 -->
      <div class="space-y-4">
        ${state.printHtml ? `
          <div class="flex justify-end gap-2.5 no-print bg-slate-900/50 p-3 rounded-2xl border border-slate-800 max-w-4xl mx-auto">
            <button type="button" data-action="export-image" class="btn-teacher px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5">
              <span>🖼️ 이미지 파일(PNG)로 저장</span>
            </button>
            <button type="button" data-action="print" class="ghost-button px-4 py-2 rounded-xl text-xs font-extrabold">
              🖨️ 인쇄 / PDF 저장
            </button>
          </div>
        ` : ''}

        <div id="printArea" class="max-w-4xl mx-auto">
          ${state.printHtml || `
            <div class="card-3d rounded-2xl p-10 text-center text-slate-500 text-xs">
              위 선택 카드에서 보고서 또는 현황표를 생성해 주세요. 결과물이 여기에 미리보기로 표시됩니다.
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}
