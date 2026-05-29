import React, { useMemo } from 'react';

// Metric Card Component
function MetricCard({ label, value, colorClass, metricKey, active, onClick }) {
  const stateLabel = active ? '선택됨' : '눌러서 보기';
  const activeStyle = active
    ? 'border-slate-700 bg-slate-900/50 ring-1 ring-blue-500/30'
    : 'hover:border-slate-800 hover:bg-slate-900/10';

  return (
    <button
      type="button"
      onClick={() => onClick(metricKey)}
      className={`card-3d rounded-2xl p-5 text-left w-full transition hover:-translate-y-0.5 ${activeStyle}`}
      style={{ cursor: 'pointer' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{label}</span>
          <div
            className={`mt-2 text-2xl font-black ${colorClass}`}
            style={{ textShadow: '0 0 8px currentColor', fontFeatureSettings: "'tnum'" }}
          >
            {value}
          </div>
        </div>
        <span
          className={`mt-0.5 text-[9px] font-bold bg-slate-955 px-2 py-0.5 rounded border ${
            active ? 'text-blue-400 border-blue-500/20' : 'text-slate-500 border-slate-900'
          }`}
        >
          {stateLabel}
        </span>
      </div>
    </button>
  );
}

// Detail Panel Component
function DashboardDetailPanel({ metricKey, classes, students, books, inspections, deps }) {
  const {
    assignedBooksForClass,
    bookUnits,
    classById,
    classProgress,
    progressTone,
    studentsForClass,
    teacherNameById
  } = deps;

  if (metricKey === 'classes') {
    return (
      <div className="card-3d rounded-2xl p-5 md:p-6 mb-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-extrabold text-white">담당 반 목록</h3>
          <span className="text-xs text-blue-400 font-extrabold">{classes.length}개 반</span>
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {classes.length ? (
            classes.map(c => (
              <div key={c.id} className="rounded-xl border border-slate-800 bg-slate-900/10 px-4 py-3.5">
                <div className="font-extrabold text-sm text-slate-200">{c.name}</div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {c.grade || '-'} &middot; 담당 {teacherNameById(c.teacherId)}T &middot; 학생 {studentsForClass(c.id).length}명 &middot; 교재 {assignedBooksForClass(c.id).length}권
                </div>
              </div>
            ))
          ) : (
            <div className="text-xs text-slate-500 py-4">배정된 반이 존재하지 않습니다.</div>
          )}
        </div>
      </div>
    );
  }

  if (metricKey === 'students') {
    const rows = [...students].sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'));
    return (
      <div className="card-3d rounded-2xl p-5 md:p-6 mb-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-extrabold text-white">담당 학생 목록</h3>
          <span className="text-xs text-teal-400 font-extrabold">{rows.length}명</span>
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {rows.length ? (
            rows.map(s => (
              <div key={s.id} className="rounded-xl border border-slate-800 bg-slate-900/10 px-4 py-3">
                <div className="font-extrabold text-sm text-slate-200">{s.name}</div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {s.school || '-'} &middot; {s.grade || '-'} &middot; {classById(s.classId)?.name || '-'}
                </div>
              </div>
            ))
          ) : (
            <div className="text-xs text-slate-500 py-4">소속 학생이 없습니다.</div>
          )}
        </div>
      </div>
    );
  }

  if (metricKey === 'progress') {
    return (
      <div className="card-3d rounded-2xl p-5 md:p-6 mb-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-extrabold text-white">완료율 기준 반 순위</h3>
          <span className="text-xs text-emerald-400 font-extrabold">평균 완료율 순</span>
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {classes.length ? (
            [...classes]
              .sort((a, b) => classProgress(b.id) - classProgress(a.id))
              .map(c => {
                const progress = classProgress(c.id);
                const tone = progressTone(progress);
                return (
                  <div key={c.id} className="rounded-xl border border-slate-800 bg-slate-900/10 px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-extrabold text-sm text-slate-200">{c.name}</div>
                      <div className="text-[11px] text-slate-550 mt-1">
                        학생 {studentsForClass(c.id).length}명 &middot; 점검 {inspections.filter(i => i.classId === c.id).length}건
                      </div>
                    </div>
                    <span className={`rounded-full border text-[11px] font-black px-2.5 py-1 ${tone.badge}`}>{progress}%</span>
                  </div>
                );
              })
          ) : (
            <div className="text-xs text-slate-500 py-4">반 데이터가 존재하지 않습니다.</div>
          )}
        </div>
      </div>
    );
  }

  const visibleBooks = books.filter(b => !b.archived);
  return (
    <div className="card-3d rounded-2xl p-5 md:p-6 mb-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-extrabold text-white">사용 중인 교재 목록</h3>
        <span className="text-xs text-rose-400 font-extrabold">{visibleBooks.length}권</span>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {visibleBooks.length ? (
          visibleBooks.map(b => (
            <div key={b.id} className="rounded-xl border border-slate-800 bg-slate-900/10 px-4 py-3">
              <div className="font-extrabold text-sm text-slate-200">{b.title}</div>
              <div className="text-[11px] text-slate-550 mt-1">
                {b.subject || '-'} &middot; {b.grade || '-'} &middot; {bookUnits(b).length}단원
              </div>
            </div>
          ))
        ) : (
          <div className="text-xs text-slate-500 py-4">표시할 교재가 존재하지 않습니다.</div>
        )}
      </div>
    </div>
  );
}

// Main Dashboard Component
export default function Dashboard({
  state,
  teachers,
  classes,
  students,
  logs,
  overall,
  recent,
  focus,
  books,
  inspections,
  deps,
  updateLegacyState
}) {
  const {
    assignedBooksForClass,
    bookById,
    classProgress,
    progressTone,
    studentById,
    studentsForClass,
    teacherNameById
  } = deps;

  const handleFilterClick = (teacherId) => {
    updateLegacyState({ dashboardTeacherFilter: teacherId });
  };

  const handleMetricClick = (metricKey) => {
    updateLegacyState({ dashboardMetricFocus: metricKey });
  };

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="px-3 py-3 border border-slate-850 bg-slate-950/20 rounded-xl no-print flex flex-wrap gap-1.5 items-center">
        <button
          type="button"
          onClick={() => handleFilterClick('all')}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
            state.dashboardTeacherFilter === 'all'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'bg-transparent text-slate-500 border border-transparent hover:text-slate-300'
          }`}
          style={{ cursor: 'pointer' }}
        >
          전체 현황
        </button>
        {teachers.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => handleFilterClick(t.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              state.dashboardTeacherFilter === t.id
                ? 'bg-blue-600/80 border border-blue-500 text-white'
                : 'bg-transparent text-slate-500 border border-transparent hover:text-slate-300'
            }`}
            style={{ cursor: 'pointer' }}
          >
            {t.name} 선생님
          </button>
        ))}
      </div>

      {/* Metric Cards Row */}
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          label="담당 반 수"
          value={classes.length}
          colorClass="text-violet-400"
          metricKey="classes"
          active={focus === 'classes'}
          onClick={handleMetricClick}
        />
        <MetricCard
          label="담당 학생 수"
          value={students.length}
          colorClass="text-sky-400"
          metricKey="students"
          active={focus === 'students'}
          onClick={handleMetricClick}
        />
        <MetricCard
          label="전체 완료율"
          value={`${overall}%`}
          colorClass="text-emerald-400"
          metricKey="progress"
          active={focus === 'progress'}
          onClick={handleMetricClick}
        />
        <MetricCard
          label="전체 교재 수"
          value={books.filter(b => !b.archived).length}
          colorClass="text-rose-400"
          metricKey="books"
          active={focus === 'books'}
          onClick={handleMetricClick}
        />
      </div>

      {/* Active Metric Details Panel */}
      <DashboardDetailPanel
        metricKey={focus}
        classes={classes}
        students={students}
        books={books}
        inspections={inspections}
        deps={deps}
      />

      {/* Row: Class Progress & Recent Inspections */}
      <div className="grid xl:grid-cols-[1.15fr_0.85fr] gap-6">
        {/* Class Progress Status */}
        <article className="card-3d rounded-2xl p-5 md:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-sm font-extrabold text-white">반별 진행 현황</h3>
            <span className="text-[10px] text-slate-400 font-bold">평균 완료율 기준</span>
          </div>

          <div className="space-y-4">
            {classes.length ? (
              classes.map(c => {
                const progress = classProgress(c.id);
                const assigned = assignedBooksForClass(c.id).length;
                const count = studentsForClass(c.id).length;
                const tone = progressTone(progress);
                return (
                  <div key={c.id} className="rounded-xl border border-slate-800 bg-slate-900/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-extrabold text-slate-200">{c.name}</div>
                        <div className="text-[10px] text-slate-500 mt-1">
                          담당 {teacherNameById(c.teacherId)}T &middot; 학생 {count}명 &middot; 교재 {assigned}권
                        </div>
                      </div>
                      <span className={`rounded-full border text-[11px] font-black px-2.5 py-1 ${tone.badge}`}>{progress}%</span>
                    </div>

                    <div className="book-track mt-3 w-full h-2 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${progress}%`, background: tone.bar }}></div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-xs text-slate-500 py-6 text-center">개설된 반이 존재하지 않습니다.</div>
            )}
          </div>
        </article>

        {/* Recent Inspections */}
        <article className="card-3d rounded-2xl p-5 md:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-sm font-extrabold text-white">최근 점검 내역</h3>
            <span className="text-[10px] text-slate-400 font-bold">최신 8건</span>
          </div>

          <div className="space-y-3">
            {recent.length ? (
              recent.map(r => (
                <div key={r.id} className="rounded-xl border border-slate-800 bg-slate-900/10 px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-extrabold text-sm text-slate-200">{studentById(r.studentId)?.name || '-'}</div>
                    <div className="text-[10px] text-slate-550 mt-1">
                      {bookById(r.bookId)?.title || '-'} &middot; {r.rangeStart}~{r.rangeEnd}쪽
                    </div>
                  </div>
                  <div
                    className="text-base font-black text-violet-400"
                    style={{ textShadow: '0 0 6px rgba(132, 54, 255, 0.2)' }}
                  >
                    {r.completionRate}%
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-500 py-6 text-center">최근 작성된 교재점검 기록이 존재하지 않습니다.</div>
            )}
          </div>
        </article>
      </div>
    </div>
  );
}
