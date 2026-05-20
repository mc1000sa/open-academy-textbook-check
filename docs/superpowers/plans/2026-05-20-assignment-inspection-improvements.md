# Assignment Inspection Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 선생님 점검 화면에 날짜별 지난 미완료 회수 기능과 5요소 점수 입력을 안정화하고, 보고서에 학생/교재/반 평균 6요소 비교를 추가한다.

**Architecture:** 기존 Firestore 점검 기록은 보존하고, 새 필드는 점검 문서에 하위 호환으로 추가한다. 순수 계산은 `src/lib`에 두고, 레거시 화면 파일은 현재 분리된 `src/legacy/views/*` 구조 안에서 좁게 수정한다.

**Tech Stack:** Vite, React 19, Firebase Firestore, Vitest, legacy string-rendered views.

---

## File Structure

- Modify: `src/lib/textbookProgress.js`
  - 지난 미완료 carryover 행 생성, 회수율 계산, 저장 payload 정규화를 담당한다.
- Modify: `src/lib/textbookProgress.test.js`
  - carryover 계산과 0.5점 점수 정규화 테스트를 추가한다.
- Modify: `src/lib/reportMetrics.js`
  - 6요소 평균 계산, 같은 교재 평균, 반 평균 계산을 담당한다.
- Modify: `src/lib/reportMetrics.test.js`
  - 새 평균 계산 함수 테스트를 추가한다.
- Modify: `src/legacy/legacyApp.js`
  - state 초기값, 저장 payload, 편집 복원, 이벤트 바인딩을 새 필드 기준으로 정리한다.
- Modify: `src/legacy/views/inspectionsView.js`
  - 날짜별 지난 미완료 표, 5요소 점수 UI, 별도 지표 표시를 렌더링한다.
- Modify: `src/legacy/views/inspectionsView.test.js`
  - 렌더링 문자열에 날짜별 표와 새 5요소 명칭이 포함되는지 확인한다.
- Modify: `src/legacy/views/reportsView.js`
  - 학생 보고서와 반 보고서에 6요소 비교 HTML/SVG를 추가한다.
- Create: `src/legacy/views/reportsView.test.js` if absent, otherwise modify it.
  - 보고서에 개인/교재 평균/반 평균 비교 섹션이 표시되는지 확인한다.
- Modify: `src/styles/legacy.css`
  - carryover 표, 점수 컨트롤, 육각형 비교의 화면/인쇄 스타일을 추가한다.
- Modify: `memory/lessons.md`
  - 구현 중 확정된 데이터 필드와 UI 판단을 짧게 기록한다.

## Data Shape

새 기록은 기존 필드와 함께 다음 필드를 저장한다. 오래된 기록에는 이 필드가 없을 수 있으므로 모든 계산 함수는 기본값을 사용한다.

```js
{
  carryoverResolutions: [
    {
      sourceInspectionId: 'inspection-1',
      sourceDate: '2026-05-10',
      resolvedPages: [12, 13]
    }
  ],
  rubricScores: {
    expression: 8.5,
    grading: 9,
    attitude: 8,
    understanding: 7.5,
    application: 8
  }
}
```

기존 초안 필드인 `resolvedPages`, `rubricScores.writing`, `rubricScores.logic`, `rubricScores.checking`, `rubricScores.retention`은 읽기 호환만 유지하고, 새 저장은 위 key를 사용한다.

---

### Task 1: Carryover Calculation Helpers

**Files:**
- Modify: `src/lib/textbookProgress.js`
- Modify: `src/lib/textbookProgress.test.js`

- [ ] **Step 1: Write failing tests for carryover rows**

Add these imports in `src/lib/textbookProgress.test.js`:

```js
import {
  buildCarryoverRows,
  calculateCarryoverRecoveryRate,
  normalizeRubricScores
} from './textbookProgress.js';
```

Add tests:

```js
it('builds dated carryover rows for the same student and book without mutating old inspections', () => {
  const rows = buildCarryoverRows({
    inspections: [
      { id: 'old-1', studentId: 's1', bookId: 'b1', date: '2026-05-10', missedPages: [12, 13] },
      { id: 'old-2', studentId: 's1', bookId: 'b1', date: '2026-05-13', missedPages: [22] },
      { id: 'other-student', studentId: 's2', bookId: 'b1', date: '2026-05-14', missedPages: [99] },
      { id: 'other-book', studentId: 's1', bookId: 'b2', date: '2026-05-14', missedPages: [88] },
      {
        id: 'resolver',
        studentId: 's1',
        bookId: 'b1',
        date: '2026-05-15',
        missedPages: [],
        carryoverResolutions: [{ sourceInspectionId: 'old-1', sourceDate: '2026-05-10', resolvedPages: [12] }]
      }
    ],
    studentId: 's1',
    bookId: 'b1',
    editingInspectionId: ''
  });

  expect(rows).toEqual([
    { sourceInspectionId: 'old-2', sourceDate: '2026-05-13', missedPages: [22], resolvedPages: [] },
    { sourceInspectionId: 'old-1', sourceDate: '2026-05-10', missedPages: [13], resolvedPages: [12] }
  ]);
});

it('calculates carryover recovery rate from selected page keys', () => {
  const rows = [
    { sourceInspectionId: 'old-1', missedPages: [12, 13] },
    { sourceInspectionId: 'old-2', missedPages: [22] }
  ];
  const selected = new Set(['old-1:12', 'old-2:22']);

  expect(calculateCarryoverRecoveryRate(rows, selected)).toEqual({
    totalPages: 3,
    resolvedPages: 2,
    remainingPages: 1,
    recoveryRate: 67
  });
});

it('normalizes rubric score keys and clamps half-point values', () => {
  expect(normalizeRubricScores({
    writing: 8,
    logic: 20,
    checking: 7.24,
    retention: 7.26,
    application: -1
  })).toEqual({
    expression: 8,
    grading: 10,
    attitude: 7,
    understanding: 7.5,
    application: 0
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm.cmd test -- src/lib/textbookProgress.test.js
```

Expected: FAIL because the three helper functions are not exported.

- [ ] **Step 3: Implement carryover helpers**

Add to `src/lib/textbookProgress.js`:

```js
export const RUBRIC_ITEMS = [
  { key: 'assignment', label: '과제 수행률', automatic: true },
  { key: 'expression', label: '풀이 표현력', legacyKeys: ['writing'] },
  { key: 'grading', label: '채점 성실도', legacyKeys: ['logic'] },
  { key: 'attitude', label: '수업 태도', legacyKeys: ['checking', 'attitude'] },
  { key: 'understanding', label: '개념 이해도', legacyKeys: ['retention'] },
  { key: 'application', label: '응용 해결력', legacyKeys: ['application'] }
];

export function pageResolutionKey(sourceInspectionId, page) {
  return `${sourceInspectionId}:${Number(page)}`;
}

function pagesResolvedByLaterInspections(inspections) {
  return inspections.reduce((resolved, inspection) => {
    (inspection.carryoverResolutions || []).forEach(resolution => {
      const sourceId = resolution.sourceInspectionId;
      if (!sourceId) return;
      resolved[sourceId] = resolved[sourceId] || new Set();
      (resolution.resolvedPages || []).forEach(page => resolved[sourceId].add(Number(page)));
    });

    return resolved;
  }, {});
}

export function buildCarryoverRows({ inspections, studentId, bookId, editingInspectionId = '' }) {
  const sameScope = [...(inspections || [])]
    .filter(inspection => {
      return inspection.studentId === studentId
        && inspection.bookId === bookId
        && inspection.id !== editingInspectionId;
    })
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  const resolvedBySource = pagesResolvedByLaterInspections(sameScope);

  return sameScope
    .map(inspection => {
      const originalMissed = [...new Set((inspection.missedPages || []).map(Number))]
        .filter(page => !Number.isNaN(page))
        .sort((a, b) => a - b);
      const resolvedSet = resolvedBySource[inspection.id] || new Set();
      const missedPages = originalMissed.filter(page => !resolvedSet.has(page));

      return {
        sourceInspectionId: inspection.id,
        sourceDate: inspection.date,
        missedPages,
        resolvedPages: originalMissed.filter(page => resolvedSet.has(page))
      };
    })
    .filter(row => row.missedPages.length);
}

export function calculateCarryoverRecoveryRate(carryoverRows, selectedKeys) {
  const totalPages = (carryoverRows || []).reduce((sum, row) => sum + row.missedPages.length, 0);
  const resolvedPages = (carryoverRows || []).reduce((sum, row) => {
    return sum + row.missedPages.filter(page => selectedKeys.has(pageResolutionKey(row.sourceInspectionId, page))).length;
  }, 0);

  return {
    totalPages,
    resolvedPages,
    remainingPages: Math.max(totalPages - resolvedPages, 0),
    recoveryRate: totalPages ? Math.round((resolvedPages / totalPages) * 100) : 0
  };
}

export function buildCarryoverResolutions(carryoverRows, selectedKeys) {
  return (carryoverRows || [])
    .map(row => ({
      sourceInspectionId: row.sourceInspectionId,
      sourceDate: row.sourceDate,
      resolvedPages: row.missedPages
        .filter(page => selectedKeys.has(pageResolutionKey(row.sourceInspectionId, page)))
        .sort((a, b) => a - b)
    }))
    .filter(row => row.resolvedPages.length);
}

export function normalizeRubricScores(scores = {}) {
  const normalized = {};

  RUBRIC_ITEMS.filter(item => !item.automatic).forEach(item => {
    const raw = [item.key, ...(item.legacyKeys || [])]
      .map(key => scores[key])
      .find(value => value !== null && value !== undefined && value !== '');
    const numeric = Number(raw);
    normalized[item.key] = Number.isNaN(numeric)
      ? null
      : Math.min(10, Math.max(0, Math.round(numeric * 2) / 2));
  });

  return normalized;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```powershell
npm.cmd test -- src/lib/textbookProgress.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/textbookProgress.js src/lib/textbookProgress.test.js
git commit -m "feat: 지난 미완료 회수 계산 추가"
```

---

### Task 2: Six-Factor Report Metrics

**Files:**
- Modify: `src/lib/reportMetrics.js`
- Modify: `src/lib/reportMetrics.test.js`

- [ ] **Step 1: Write failing tests for 6-factor averages**

Update imports in `src/lib/reportMetrics.test.js`:

```js
import {
  averageCompletionRate,
  averageRubricVector,
  bookRubricAverage,
  classRubricAverage,
  classProgressRate,
  groupInspectionsByBook,
  studentRubricAverage
} from './reportMetrics.js';
```

Add tests:

```js
it('calculates a 6-factor vector using completion rate as assignment score', () => {
  expect(averageRubricVector([
    { completionRate: 80, rubricScores: { expression: 8, grading: 9, attitude: 7, understanding: 8, application: 6 } },
    { completionRate: 100, rubricScores: { expression: 10, grading: null, attitude: 9, understanding: 8, application: 8 } }
  ])).toEqual({
    assignment: 9,
    expression: 9,
    grading: 9,
    attitude: 8,
    understanding: 8,
    application: 7
  });
});

it('calculates student, book, and class rubric averages', () => {
  const students = [
    { id: 's1', classId: 'c1', active: true },
    { id: 's2', classId: 'c1', active: true },
    { id: 's3', classId: 'c2', active: true }
  ];
  const inspections = [
    { studentId: 's1', classId: 'c1', bookId: 'b1', completionRate: 80, rubricScores: { expression: 8 } },
    { studentId: 's2', classId: 'c1', bookId: 'b1', completionRate: 100, rubricScores: { expression: 10 } },
    { studentId: 's3', classId: 'c2', bookId: 'b2', completionRate: 60, rubricScores: { expression: 6 } }
  ];

  expect(studentRubricAverage('s1', inspections).assignment).toBe(8);
  expect(bookRubricAverage('b1', inspections).expression).toBe(9);
  expect(classRubricAverage('c1', students, inspections).assignment).toBe(9);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm.cmd test -- src/lib/reportMetrics.test.js
```

Expected: FAIL because the new report metric functions are not exported.

- [ ] **Step 3: Implement report metric helpers**

Add to `src/lib/reportMetrics.js`:

```js
import { normalizeRubricScores, RUBRIC_ITEMS } from './textbookProgress.js';

export function averageRubricVector(inspections) {
  const buckets = RUBRIC_ITEMS.reduce((result, item) => {
    result[item.key] = [];
    return result;
  }, {});

  (inspections || []).forEach(inspection => {
    buckets.assignment.push(Number(inspection.completionRate || 0) / 10);
    const scores = normalizeRubricScores(inspection.rubricScores || {});

    RUBRIC_ITEMS.filter(item => !item.automatic).forEach(item => {
      const value = scores[item.key];
      if (value !== null && value !== undefined && !Number.isNaN(Number(value))) {
        buckets[item.key].push(Number(value));
      }
    });
  });

  return Object.fromEntries(
    Object.entries(buckets).map(([key, values]) => {
      if (!values.length) return [key, 0];
      const total = values.reduce((sum, value) => sum + value, 0);
      return [key, Math.round((total / values.length) * 10) / 10];
    })
  );
}

export function studentRubricAverage(studentId, inspections) {
  return averageRubricVector((inspections || []).filter(inspection => inspection.studentId === studentId));
}

export function bookRubricAverage(bookId, inspections) {
  return averageRubricVector((inspections || []).filter(inspection => inspection.bookId === bookId));
}

export function classRubricAverage(classId, students, inspections) {
  const activeStudentIds = new Set(
    (students || [])
      .filter(student => student.classId === classId && student.active !== false)
      .map(student => student.id)
  );

  return averageRubricVector((inspections || []).filter(inspection => activeStudentIds.has(inspection.studentId)));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```powershell
npm.cmd test -- src/lib/reportMetrics.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/reportMetrics.js src/lib/reportMetrics.test.js
git commit -m "feat: 6요소 평균 계산 추가"
```

---

### Task 3: Inspection State and Save Payload

**Files:**
- Modify: `src/legacy/legacyApp.js`

- [ ] **Step 1: Update imports**

Change the `textbookProgress.js` import in `src/legacy/legacyApp.js` so it includes the new helpers:

```js
import {
  buildCarryoverResolutions,
  buildCarryoverRows,
  calculateCarryoverRecoveryRate,
  calculateCompletionRate,
  filterMissedPagesToRange,
  normalizeRubricScores,
  pageResolutionKey,
  pagesInRange,
  parseMissedPages,
  sortBookUnits,
  unitsForRange
} from '../lib/textbookProgress.js';
```

- [ ] **Step 2: Replace initial score state**

Replace the existing `rubricScores` and `resolvedPages` initial state:

```js
rubricScores: { expression: null, grading: null, attitude: null, understanding: null, application: null },
selectedCarryoverResolutionKeys: [],
```

- [ ] **Step 3: Add local helper functions near inspection helpers**

Add:

```js
function currentCarryoverRows() {
  if (!state.selectedInspectionStudentId || !state.selectedInspectionBookId) return [];

  return buildCarryoverRows({
    inspections: state.inspections,
    studentId: state.selectedInspectionStudentId,
    bookId: state.selectedInspectionBookId,
    editingInspectionId: state.editingInspectionId
  });
}

function selectedCarryoverKeysSet() {
  return new Set(state.selectedCarryoverResolutionKeys || []);
}

function resetRubricScores() {
  state.rubricScores = { expression: null, grading: null, attitude: null, understanding: null, application: null };
}
```

- [ ] **Step 4: Update reset logic**

In `resetInspectionForm()`, replace score and carryover reset lines with:

```js
resetRubricScores();
state.selectedCarryoverResolutionKeys = [];
```

Also replace other `state.resolvedPages = []` resets after class/student/book changes with:

```js
state.selectedCarryoverResolutionKeys = [];
```

- [ ] **Step 5: Update save payload**

In `saveInspection()`, before `payload`, add:

```js
const carryoverRows = currentCarryoverRows();
const selectedCarryoverKeys = selectedCarryoverKeysSet();
const carryoverResolutions = buildCarryoverResolutions(carryoverRows, selectedCarryoverKeys);
const carryoverRecovery = calculateCarryoverRecoveryRate(carryoverRows, selectedCarryoverKeys);
```

In `payload`, replace old `resolvedPages` and old `rubricScores` assignments with:

```js
carryoverResolutions,
carryoverRecovery,
rubricScores: normalizeRubricScores(state.rubricScores),
```

Update the success summary:

```js
const carryoverStr = carryoverRecovery.totalPages
  ? `\n지난 미완료 회수: ${carryoverRecovery.resolvedPages}/${carryoverRecovery.totalPages}쪽 (${carryoverRecovery.recoveryRate}%)`
  : '';
const summary = `${student.name} 학생 점검이 안전하게 저장되었습니다.\n\n교재: ${book.title}\n범위: ${start}~${end}쪽\n미완료: ${missedPages.length ? missedPages.join(', ') : '없음'}${carryoverStr}\n완료율: ${completionRate}%`;
```

- [ ] **Step 6: Update edit restore**

In `editInspection(r)`, replace rubric restore with:

```js
state.rubricScores = normalizeRubricScores(r.rubricScores || {});
state.selectedCarryoverResolutionKeys = (r.carryoverResolutions || []).flatMap(resolution => {
  return (resolution.resolvedPages || []).map(page => pageResolutionKey(resolution.sourceInspectionId, page));
});
```

- [ ] **Step 7: Update event binding**

Replace reset scores handler body:

```js
resetRubricScores();
render();
```

Replace toggle carryover handler:

```js
appRoot.querySelectorAll('[data-action="toggle-carryover-resolution"]').forEach(el => {
  el.onclick = () => {
    const key = pageResolutionKey(el.dataset.sourceInspectionId, el.dataset.page);
    const selected = new Set(state.selectedCarryoverResolutionKeys || []);
    if (selected.has(key)) selected.delete(key); else selected.add(key);
    state.selectedCarryoverResolutionKeys = [...selected];
    render();
  };
});
```

- [ ] **Step 8: Run focused tests**

Run:

```powershell
npm.cmd test -- src/lib/textbookProgress.test.js src/lib/reportMetrics.test.js
```

Expected: PASS.

- [ ] **Step 9: Commit**

```powershell
git add src/legacy/legacyApp.js
git commit -m "feat: 점검 저장에 지난 미완료 회수 이력 추가"
```

---

### Task 4: Inspection Screen UI

**Files:**
- Modify: `src/legacy/views/inspectionsView.js`
- Modify: `src/legacy/views/inspectionsView.test.js`
- Modify: `src/styles/legacy.css`

- [ ] **Step 1: Update view dependencies**

In `renderInspectionsView`, receive these deps:

```js
buildCarryoverRows,
calculateCarryoverRecoveryRate,
pageResolutionKey,
RUBRIC_ITEMS
```

- [ ] **Step 2: Replace 직전 회차 carryover logic**

Replace the current `prevInspections`, `prevInspection`, `prevMissed`, `prevResolvedNow`, `prevStillMissed`, `combinedPct` block with:

```js
const carryoverRows = state.selectedInspectionStudentId && state.selectedInspectionBookId
  ? buildCarryoverRows({
      inspections: state.inspections,
      studentId: state.selectedInspectionStudentId,
      bookId: state.selectedInspectionBookId,
      editingInspectionId: state.editingInspectionId
    })
  : [];
const selectedCarryoverKeys = new Set(state.selectedCarryoverResolutionKeys || []);
const carryoverRecovery = calculateCarryoverRecoveryRate(carryoverRows, selectedCarryoverKeys);
```

- [ ] **Step 3: Render dated carryover table**

Replace `prevMissedSection` with:

```js
const carryoverSection = carryoverRows.length ? `
  <div class="mt-4 rounded-2xl border border-rose-500/20 bg-rose-950/20 p-4">
    <div class="flex items-center justify-between gap-3 mb-3">
      <div>
        <div class="text-xs font-extrabold text-rose-300">지난 회차 미완료 과제</div>
        <div class="text-[10px] text-slate-400 mt-0.5">날짜별 미완료 페이지입니다. 이번에 확인 완료한 페이지만 눌러주세요.</div>
      </div>
      <div class="text-[10px] font-black text-emerald-400">
        회수 ${carryoverRecovery.resolvedPages}/${carryoverRecovery.totalPages}쪽 · ${carryoverRecovery.recoveryRate}%
      </div>
    </div>
    <div class="overflow-x-auto mini-scroll">
      <table class="w-full text-xs border-collapse">
        <thead>
          <tr class="border-b border-rose-500/20 text-slate-400">
            <th class="py-2 text-left">지난 점검일</th>
            <th class="py-2 text-left">미완료 페이지</th>
            <th class="py-2 text-left">이번 회차 완료 선택</th>
          </tr>
        </thead>
        <tbody>
          ${carryoverRows.map(row => `
            <tr class="border-b border-slate-800/70">
              <td class="py-2 pr-3 font-bold text-slate-300 whitespace-nowrap">${safe(fmtDate(row.sourceDate))}</td>
              <td class="py-2 pr-3 text-rose-300 font-bold">${row.missedPages.map(page => `${page}쪽`).join(', ')}</td>
              <td class="py-2">
                <div class="flex flex-wrap gap-1.5">
                  ${row.missedPages.map(page => {
                    const key = pageResolutionKey(row.sourceInspectionId, page);
                    const selected = selectedCarryoverKeys.has(key);
                    return `
                      <button type="button"
                        data-action="toggle-carryover-resolution"
                        data-source-inspection-id="${safe(row.sourceInspectionId)}"
                        data-page="${page}"
                        class="min-w-10 h-8 rounded-lg border text-xs font-black transition-all ${selected ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-emerald-500 hover:text-emerald-300'}">
                        ${page}
                      </button>
                    `;
                  }).join('')}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
` : '';
```

Render `${carryoverSection}` where `${prevMissedSection}` was used.

- [ ] **Step 4: Replace 6요소 button UI with automatic assignment + 5 score rows**

Use `RUBRIC_ITEMS.filter(item => !item.automatic)` and render 정수 버튼 plus `-0.5`, `+0.5` buttons:

```js
const scoreItems = RUBRIC_ITEMS.filter(item => !item.automatic);
```

Inside each item row, buttons must use:

```html
data-action="set-rubric-score"
data-key="${item.key}"
data-val="${n}"
```

The half-point buttons must use:

```html
data-action="adjust-rubric-score"
data-key="${item.key}"
data-delta="0.5"
```

- [ ] **Step 5: Update analysis card**

Replace “통합 과제 수행률” wording with separate carryover wording:

```html
<div class="text-xs font-bold text-slate-300">지난 미완료 회수율</div>
<div class="text-xs font-black text-emerald-400">${carryoverRecovery.recoveryRate}%</div>
```

Use:

```html
지난 미완료 ${carryoverRecovery.totalPages}쪽 중 ${carryoverRecovery.resolvedPages}쪽 회수 · ${carryoverRecovery.remainingPages}쪽 유지
```

- [ ] **Step 6: Add tests**

In `src/legacy/views/inspectionsView.test.js`, add a render test that asserts these text fragments:

```js
expect(html).toContain('지난 회차 미완료 과제');
expect(html).toContain('지난 점검일');
expect(html).toContain('풀이 표현력');
expect(html).toContain('채점 성실도');
expect(html).toContain('개념 이해도');
expect(html).toContain('지난 미완료 회수율');
```

- [ ] **Step 7: Add CSS**

Append to `src/styles/legacy.css`:

```css
.rubric-score-control {
  display: grid;
  gap: 0.5rem;
}

.carryover-table button[aria-pressed="true"] {
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.25);
}

@media print {
  .carryover-table,
  .rubric-report {
    break-inside: avoid;
  }
}
```

- [ ] **Step 8: Run focused tests**

Run:

```powershell
npm.cmd test -- src/legacy/views/inspectionsView.test.js
```

Expected: PASS.

- [ ] **Step 9: Commit**

```powershell
git add src/legacy/views/inspectionsView.js src/legacy/views/inspectionsView.test.js src/styles/legacy.css
git commit -m "feat: 점검 화면에 지난 미완료 표 추가"
```

---

### Task 5: Reports with Hexagon Comparisons

**Files:**
- Modify: `src/legacy/legacyApp.js`
- Modify: `src/legacy/views/reportsView.js`
- Create or Modify: `src/legacy/views/reportsView.test.js`
- Modify: `src/styles/legacy.css`

- [ ] **Step 1: Update report imports in `legacyApp.js`**

Add report metric imports:

```js
import {
  averageCompletionRate,
  bookRubricAverage,
  classProgressRate,
  classRubricAverage,
  groupInspectionsByBook,
  studentRubricAverage
} from '../lib/reportMetrics.js';
```

When calling `reportForStudent`, pass:

```js
bookRubricAverage,
classRubricAverage,
studentRubricAverage,
students: state.students,
inspections: state.inspections
```

When calling `reportForClass`, pass:

```js
classRubricAverage,
studentRubricAverage,
students: state.students,
inspections: state.inspections
```

- [ ] **Step 2: Add hexagon SVG renderer**

In `src/legacy/views/reportsView.js`, add:

```js
const RUBRIC_LABELS = [
  ['assignment', '과제 수행률'],
  ['expression', '풀이 표현력'],
  ['grading', '채점 성실도'],
  ['attitude', '수업 태도'],
  ['understanding', '개념 이해도'],
  ['application', '응용 해결력']
];

function polygonPoints(values, radius = 78, center = 90) {
  return RUBRIC_LABELS.map(([key], index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / RUBRIC_LABELS.length;
    const score = Math.max(0, Math.min(10, Number(values?.[key] || 0)));
    const distance = (score / 10) * radius;
    return `${center + Math.cos(angle) * distance},${center + Math.sin(angle) * distance}`;
  }).join(' ');
}

function renderRubricCompare(title, primary, secondary, secondaryLabel, safe) {
  return `
    <div class="rubric-report rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
      <div class="flex items-center justify-between gap-3 mb-3">
        <div class="text-xs font-black text-white">${safe(title)}</div>
        <div class="text-[10px] text-slate-400">학생 vs ${safe(secondaryLabel)}</div>
      </div>
      <svg viewBox="0 0 180 180" class="w-full max-w-[260px] mx-auto" role="img" aria-label="${safe(title)}">
        <polygon points="90,12 157.5,51 157.5,129 90,168 22.5,129 22.5,51" fill="none" stroke="rgba(148,163,184,0.25)" />
        <polygon points="${polygonPoints(secondary)}" fill="rgba(59,130,246,0.18)" stroke="rgba(59,130,246,0.85)" stroke-width="2" />
        <polygon points="${polygonPoints(primary)}" fill="rgba(16,185,129,0.22)" stroke="rgba(16,185,129,0.95)" stroke-width="2" />
      </svg>
      <div class="mt-3 grid grid-cols-2 gap-1 text-[10px] text-slate-400">
        ${RUBRIC_LABELS.map(([key, label]) => `
          <div class="flex justify-between gap-2">
            <span>${safe(label)}</span>
            <span class="font-black text-slate-200">${Number(primary?.[key] || 0).toFixed(1)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
```

- [ ] **Step 3: Add student report comparisons**

In `reportForStudent`, get dependencies:

```js
bookRubricAverage,
classRubricAverage,
studentRubricAverage,
students,
inspections
```

Before cards:

```js
const studentVector = studentRubricAverage(studentId, inspections);
const classVector = classRubricAverage(student.classId, students, inspections);
```

Inside each book card:

```js
const bookVector = bookRubricAverage(bookId, inspections);
```

Render:

```js
${renderRubricCompare('교재별 6요소 비교', studentVector, bookVector, '같은 교재 평균', safe)}
${renderRubricCompare('반 평균 6요소 비교', studentVector, classVector, '반 평균', safe)}
```

- [ ] **Step 4: Add class report 6요소 table**

In `reportForClass`, render student rows with `studentRubricAverage(s.id, inspections)` and add columns for 6 factors:

```html
<th class="px-4 py-3 text-right">과제</th>
<th class="px-4 py-3 text-right">표현</th>
<th class="px-4 py-3 text-right">채점</th>
<th class="px-4 py-3 text-right">태도</th>
<th class="px-4 py-3 text-right">이해</th>
<th class="px-4 py-3 text-right">응용</th>
```

- [ ] **Step 5: Add report tests**

Create or update `src/legacy/views/reportsView.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { reportForStudent } from './reportsView.js';
import { averageCompletionRate, bookRubricAverage, classRubricAverage, groupInspectionsByBook, studentRubricAverage } from '../../lib/reportMetrics.js';

describe('reportsView', () => {
  it('renders student report hexagon comparison sections', () => {
    const state = {};
    const inspections = [
      { studentId: 's1', classId: 'c1', bookId: 'b1', date: '2026-05-10', completionRate: 80, rubricScores: { expression: 8 } }
    ];
    const html = reportForStudent('s1', state, {
      studentById: () => ({ id: 's1', classId: 'c1', name: '홍길동' }),
      classById: () => ({ id: 'c1', name: 'A반' }),
      inspectionsForStudent: () => inspections,
      groupInspectionsByBook,
      bookById: () => ({ id: 'b1', title: '쎈수학' }),
      averageCompletionRate,
      fmtDate: value => value,
      safe: value => String(value ?? ''),
      progressTone: () => ({ bar: '#4169e1' }),
      bookRubricAverage,
      classRubricAverage,
      studentRubricAverage,
      students: [{ id: 's1', classId: 'c1' }],
      inspections
    });

    expect(html).toContain('교재별 6요소 비교');
    expect(html).toContain('반 평균 6요소 비교');
    expect(html).toContain('풀이 표현력');
  });
});
```

- [ ] **Step 6: Run focused tests**

Run:

```powershell
npm.cmd test -- src/legacy/views/reportsView.test.js src/lib/reportMetrics.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/legacy/legacyApp.js src/legacy/views/reportsView.js src/legacy/views/reportsView.test.js src/styles/legacy.css
git commit -m "feat: 보고서 6요소 비교 추가"
```

---

### Task 6: Full Verification and Project Memory

**Files:**
- Modify: `memory/lessons.md`

- [ ] **Step 1: Run all tests**

Run:

```powershell
npm.cmd test
```

Expected: PASS.

- [ ] **Step 2: Run production build**

Run:

```powershell
npm.cmd run build
```

Expected: PASS and `dist` generated.

- [ ] **Step 3: Start local dev server**

Run:

```powershell
npm.cmd run dev -- --host 127.0.0.1
```

Expected: Vite dev server starts and prints a local URL.

- [ ] **Step 4: Browser smoke test**

Open the local URL with Browser and verify:

- 로그인 화면 renders.
- 교재점검 화면 opens.
- 반/학생/교재 선택 후 지난 미완료 표 area does not crash.
- 5요소 score controls render with the new names.
- 보고서 생성 화면 renders.
- 인쇄/PDF preview layout is not visibly broken.

- [ ] **Step 5: Update memory**

Append to `memory/lessons.md`:

```md
- 과제 점검 개선에서는 과거 점검 원본을 수정하지 않고, 새 점검 기록의 `carryoverResolutions`에 지난 미완료 회수 이력을 저장한다.
- 6요소 명칭은 `과제 수행률`, `풀이 표현력`, `채점 성실도`, `수업 태도`, `개념 이해도`, `응용 해결력`을 사용한다.
- 이번 회차 과제 수행률과 지난 미완료 회수율은 합산하지 않고 별도 지표로 표시한다.
```

- [ ] **Step 6: Commit**

```powershell
git add memory/lessons.md
git commit -m "docs: 과제 점검 개선 학습 기록 추가"
```

---

## Self-Review

- Spec coverage: 날짜별 지난 미완료 표는 Task 1, 3, 4에서 처리한다. 5요소 점수 입력은 Task 1, 3, 4에서 처리한다. 교재 평균/반 평균 육각형 비교는 Task 2, 5에서 처리한다. 검증과 memory 기록은 Task 6에서 처리한다.
- Placeholder scan: plan contains no `TBD`, `TODO`, or open-ended "handle later" instructions.
- Type consistency: 새 저장 필드는 `carryoverResolutions`, `carryoverRecovery`, `rubricScores.expression/grading/attitude/understanding/application`으로 통일한다. 기존 초안 `resolvedPages`는 새 저장에 사용하지 않는다.
