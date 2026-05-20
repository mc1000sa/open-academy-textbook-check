export function renderMetricCard({ label, value, colorClass, metricKey, active = false }, safe) {
  const stateLabel = active ? '선택됨' : '눌러서 보기';
  const activeStyle = active 
    ? 'border-slate-700 bg-slate-900/50 ring-1 ring-blue-500/30' 
    : 'hover:border-slate-800 hover:bg-slate-900/10';

  return `
    <button type="button" data-action="dashboard-metric" data-metric="${metricKey}" class="card-3d rounded-2xl p-5 text-left w-full transition hover:-translate-y-0.5 ${activeStyle}">
      <div class="flex items-start justify-between gap-3">
        <div>
          <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wide">${safe(label)}</span>
          <div class="mt-2 text-2xl font-black ${colorClass}" style="text-shadow: 0 0 8px currentColor; font-feature-settings: 'tnum';">${safe(value)}</div>
        </div>
        <span class="mt-0.5 text-[9px] font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-905 ${active ? 'text-blue-400 border-blue-500/20' : 'text-slate-500 border-slate-900'}">${stateLabel}</span>
      </div>
    </button>
  `;
}

export function renderDashboardDetailPanel({ metricKey, classes, students, books, inspections }, deps) {
  const {
    assignedBooksForClass,
    bookUnits,
    classById,
    classProgress,
    progressTone,
    safe,
    studentsForClass,
    teacherNameById
  } = deps;

  if (metricKey === 'classes') {
    return `
      <div class="card-3d rounded-2xl p-5 md:p-6 mb-6">
        <div class="flex items-center justify-between gap-3 mb-4">
          <h3 class="text-sm font-extrabold text-white">담당 반 목록</h3>
          <span class="text-xs text-blue-400 font-extrabold">${classes.length}개 반</span>
        </div>
        <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          ${classes.length ? classes.map(c => `
            <div class="rounded-xl border border-slate-800 bg-slate-900/10 px-4 py-3.5">
              <div class="font-extrabold text-sm text-slate-200">${safe(c.name)}</div>
              <div class="text-[11px] text-slate-500 mt-1">${safe(c.grade || '-')} &middot; 담당 ${safe(teacherNameById(c.teacherId))}T &middot; 학생 ${studentsForClass(c.id).length}명 &middot; 교재 ${assignedBooksForClass(c.id).length}권</div>
            </div>
          `).join('') : '<div class="text-xs text-slate-500 py-4">배정된 반이 존재하지 않습니다.</div>'}
        </div>
      </div>
    `;
  }

  if (metricKey === 'students') {
    const rows = [...students].sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'));
    return `
      <div class="card-3d rounded-2xl p-5 md:p-6 mb-6">
        <div class="flex items-center justify-between gap-3 mb-4">
          <h3 class="text-sm font-extrabold text-white">담당 학생 목록</h3>
          <span class="text-xs text-teal-400 font-extrabold">${rows.length}명</span>
        </div>
        <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          ${rows.length ? rows.map(s => `
            <div class="rounded-xl border border-slate-800 bg-slate-900/10 px-4 py-3">
              <div class="font-extrabold text-sm text-slate-200">${safe(s.name)}</div>
              <div class="text-[11px] text-slate-500 mt-1">${safe(s.school || '-')} &middot; ${safe(s.grade || '-')} &middot; ${safe(classById(s.classId)?.name || '-')}</div>
            </div>
          `).join('') : '<div class="text-xs text-slate-500 py-4">소속 학생이 없습니다.</div>'}
        </div>
      </div>
    `;
  }

  if (metricKey === 'progress') {
    return `
      <div class="card-3d rounded-2xl p-5 md:p-6 mb-6">
        <div class="flex items-center justify-between gap-3 mb-4">
          <h3 class="text-sm font-extrabold text-white">완료율 기준 반 순위</h3>
          <span class="text-xs text-emerald-400 font-extrabold">평균 완료율 순</span>
        </div>
        <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          ${classes.length ? [...classes].sort((a, b) => classProgress(b.id) - classProgress(a.id)).map(c => {
            const progress = classProgress(c.id);
            const tone = progressTone(progress);
            return `
              <div class="rounded-xl border border-slate-800 bg-slate-900/10 px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <div class="font-extrabold text-sm text-slate-200">${safe(c.name)}</div>
                  <div class="text-[11px] text-slate-550 mt-1">학생 ${studentsForClass(c.id).length}명 &middot; 점검 ${inspections.filter(i => i.classId === c.id).length}건</div>
                </div>
                <span class="rounded-full border text-[11px] font-black px-2.5 py-1 ${tone.badge}">${progress}%</span>
              </div>
            `;
          }).join('') : '<div class="text-xs text-slate-500 py-4">반 데이터가 존재하지 않습니다.</div>'}
        </div>
      </div>
    `;
  }

  const visibleBooks = books.filter(b => !b.archived);
  return `
    <div class="card-3d rounded-2xl p-5 md:p-6 mb-6">
      <div class="flex items-center justify-between gap-3 mb-4">
        <h3 class="text-sm font-extrabold text-white">사용 중인 교재 목록</h3>
        <span class="text-xs text-rose-400 font-extrabold">${visibleBooks.length}권</span>
      </div>
      <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        ${visibleBooks.length ? visibleBooks.map(b => `
          <div class="rounded-xl border border-slate-800 bg-slate-900/10 px-4 py-3">
            <div class="font-extrabold text-sm text-slate-200">${safe(b.title)}</div>
            <div class="text-[11px] text-slate-550 mt-1">${safe(b.subject || '-')} &middot; ${safe(b.grade || '-')} &middot; ${bookUnits(b).length}단원</div>
          </div>
        `).join('') : '<div class="text-xs text-slate-500 py-4">표시할 교재가 존재하지 않습니다.</div>'}
      </div>
    </div>
  `;
}

export function renderDashboardView({ teacherFilter, teachers, classes, students, logs, overall, recent, focus, books, inspections }, deps) {
  const {
    assignedBooksForClass,
    bookById,
    classProgress,
    progressTone,
    safe,
    studentById,
    studentsForClass,
    teacherNameById
  } = deps;

  return `
    <div class="space-y-6">
      
      <!-- 상단 강사 필터 칩 컨테이너 -->
      <div class="px-3 py-3 border border-slate-850 bg-slate-950/20 rounded-xl no-print flex flex-wrap gap-1.5 items-center">
        <button type="button" class="rounded-lg px-3 py-1.5 text-xs font-bold transition ${teacherFilter === 'all' ? 'bg-slate-800 text-white border border-slate-700' : 'bg-transparent text-slate-500 border border-transparent hover:text-slate-300'}" data-action="dashboard-filter" data-id="all">
          전체 현황
        </button>
        ${teachers.map((t, idx) => `
          <button type="button" class="rounded-lg px-3 py-1.5 text-xs font-bold transition ${teacherFilter === t.id ? 'bg-blue-600/80 border border-blue-500 text-white' : 'bg-transparent text-slate-500 border border-transparent hover:text-slate-300'}" data-action="dashboard-filter" data-id="${t.id}">
            ${safe(t.name)} 선생님
          </button>
        `).join('')}
      </div>

      <!-- 메트릭 카드 로우 -->
      <div class="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        ${renderMetricCard({ label: '담당 반 수', value: classes.length, colorClass: 'text-violet-400', metricKey: 'classes', active: focus === 'classes' }, safe)}
        ${renderMetricCard({ label: '담당 학생 수', value: students.length, colorClass: 'text-sky-400', metricKey: 'students', active: focus === 'students' }, safe)}
        ${renderMetricCard({ label: '전체 완료율', value: `${overall}%`, colorClass: 'text-emerald-400', metricKey: 'progress', active: focus === 'progress' }, safe)}
        ${renderMetricCard({ label: '전체 교재 수', value: books.filter(b => !b.archived).length, colorClass: 'text-rose-400', metricKey: 'books', active: focus === 'books' }, safe)}
      </div>

      <!-- 활성 메트릭 상세 패널 마운트 -->
      ${renderDashboardDetailPanel({ metricKey: focus, classes, students, books, inspections }, deps)}

      <!-- 하단 분석 및 최근 기록 로우 -->
      <div class="grid xl:grid-cols-[1.15fr_0.85fr] gap-6">
        
        <!-- 반별 진행 현황 -->
        <article class="card-3d rounded-2xl p-5 md:p-6">
          <div class="flex items-center justify-between gap-3 mb-4">
            <h3 class="text-sm font-extrabold text-white">반별 진행 현황</h3>
            <span class="text-[10px] text-slate-400 font-bold">평균 완료율 기준</span>
          </div>

          <div class="space-y-4">
            ${classes.length ? classes.map(c => {
              const progress = classProgress(c.id);
              const assigned = assignedBooksForClass(c.id).length;
              const count = studentsForClass(c.id).length;
              const tone = progressTone(progress);
              return `
                <div class="rounded-xl border border-slate-800 bg-slate-900/10 p-4">
                  <div class="flex items-center justify-between gap-3">
                    <div>
                      <div class="text-sm font-extrabold text-slate-200">${safe(c.name)}</div>
                      <div class="text-[10px] text-slate-500 mt-1">담당 ${safe(teacherNameById(c.teacherId))}T &middot; 학생 ${count}명 &middot; 교재 ${assigned}권</div>
                    </div>
                    <span class="rounded-full border text-[11px] font-black px-2.5 py-1 ${tone.badge}">${progress}%</span>
                  </div>
                  
                  <div class="book-track mt-3 w-full h-2 rounded-full overflow-hidden">
                    <div class="h-full bg-blue-500" style="width:${progress}%; background:${tone.bar}"></div>
                  </div>
                </div>
              `;
            }).join('') : '<div class="text-xs text-slate-500 py-6 text-center">개설된 반이 존재하지 않습니다.</div>'}
          </div>
        </article>

        <!-- 최근 점검 내역 -->
        <article class="card-3d rounded-2xl p-5 md:p-6">
          <div class="flex items-center justify-between gap-3 mb-4">
            <h3 class="text-sm font-extrabold text-white">최근 점검 내역</h3>
            <span class="text-[10px] text-slate-400 font-bold">최신 8건</span>
          </div>

          <div class="space-y-3">
            ${recent.length ? recent.map(r => `
              <div class="rounded-xl border border-slate-800 bg-slate-900/10 px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <div class="font-extrabold text-sm text-slate-200">${safe(studentById(r.studentId)?.name || '-')}</div>
                  <div class="text-[10px] text-slate-550 mt-1">${safe(bookById(r.bookId)?.title || '-')} &middot; ${safe(r.rangeStart)}~${safe(r.rangeEnd)}쪽</div>
                </div>
                <div class="text-base font-black text-violet-400" style="text-shadow: 0 0 6px rgba(132, 54, 255, 0.2);">${safe(r.completionRate)}%</div>
              </div>
            `).join('') : '<div class="text-xs text-slate-500 py-6 text-center">최근 작성된 교재점검 기록이 존재하지 않습니다.</div>'}
          </div>
        </article>

      </div>

    </div>
  `;
}
