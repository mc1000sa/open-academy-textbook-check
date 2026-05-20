import { describe, expect, it } from 'vitest';
import { renderDashboardDetailPanel, renderDashboardView, renderMetricCard } from './dashboardView.js';

const escapeHtml = value =>
  String(value ?? '').replace(/[&<>"']/g, match => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[match]);

const deps = {
  assignedBooksForClass: () => [{ id: 'b1' }],
  bookById: id => ({ id, title: '개념원리' }),
  bookUnits: () => [{ name: '1단원' }],
  classById: id => ({ id, name: '중1A' }),
  classProgress: () => 82,
  progressTone: () => ({ badge: 'text-emerald-700', bar: '#10b981' }),
  safe: escapeHtml,
  studentById: id => ({ id, name: '김학생' }),
  studentsForClass: () => [{ id: 's1' }],
  teacherNameById: () => '문쌤'
};

describe('renderMetricCard', () => {
  it('renders a selectable metric card', () => {
    const html = renderMetricCard({
      label: '전체 완료율',
      value: '90%',
      colorClass: 'text-emerald-700',
      metricKey: 'progress',
      active: true
    }, escapeHtml);

    expect(html).toContain('data-action="dashboard-metric"');
    expect(html).toContain('data-metric="progress"');
    expect(html).toContain('전체 완료율');
    expect(html).toContain('90%');
    expect(html).toContain('선택됨');
    expect(html).toContain('ring-1 ring-blue-500/30');
  });

  it('escapes label and value', () => {
    const html = renderMetricCard({
      label: '<완료>',
      value: '"90%"',
      colorClass: 'text-emerald-700',
      metricKey: 'progress',
      active: false
    }, escapeHtml);

    expect(html).toContain('&lt;완료&gt;');
    expect(html).toContain('&quot;90%&quot;');
    expect(html).toContain('눌러서 보기');
  });
});

describe('renderDashboardDetailPanel', () => {
  it('renders class details with derived counts', () => {
    const html = renderDashboardDetailPanel({
      metricKey: 'classes',
      classes: [{ id: 'c1', name: '중1A', grade: '중1', teacherId: 't1' }],
      students: [],
      books: [],
      inspections: []
    }, deps);

    expect(html).toContain('담당 반 목록');
    expect(html).toContain('중1A');
    expect(html).toContain('문쌤');
  });
});

describe('renderDashboardView', () => {
  it('renders dashboard filters, metrics, class progress, and recent logs', () => {
    const html = renderDashboardView({
      teacherFilter: 'all',
      teachers: [{ id: 't1', name: '문쌤' }],
      classes: [{ id: 'c1', name: '중1A', teacherId: 't1' }],
      students: [{ id: 's1', name: '김학생', classId: 'c1' }],
      logs: [{ id: 'i1' }],
      overall: 76,
      recent: [{ studentId: 's1', bookId: 'b1', rangeStart: 1, rangeEnd: 10, completionRate: 90 }],
      focus: 'students',
      books: [{ id: 'b1', title: '개념원리', archived: false }],
      inspections: []
    }, deps);

    expect(html).toContain('전체 현황');
    expect(html).toContain('담당 학생 수');
    expect(html).toContain('76%');
    expect(html).toContain('반별 진행 현황');
    expect(html).toContain('최근 점검 내역');
    expect(html).toContain('김학생');
  });
});
