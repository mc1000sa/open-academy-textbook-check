import { describe, expect, it } from 'vitest';
import { renderLayoutView, renderMenuButton, renderMobileMenuButton } from './layoutView.js';

const escapeHtml = value =>
  String(value ?? '').replace(/[&<>"']/g, match => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[match]);

describe('layoutView', () => {
  it('renders active desktop and mobile menu buttons', () => {
    expect(renderMenuButton({ currentView: 'inspections', view: 'inspections', label: '학생별 교재점검', icon: 'fa-clipboard-check' })).toContain('nav-pill-active');
    expect(renderMobileMenuButton({ currentView: 'reports', view: 'reports', label: '보고서' })).toContain('text-white border-transparent');
  });

  it('wraps content with teacher name, title, and save message', () => {
    const html = renderLayoutView({
      content: '<section>CONTENT</section>',
      currentView: 'inspections',
      currentTeacher: { name: '<관리자>', role: 'admin' },
      saveMsg: '저장 완료'
    }, escapeHtml);

    expect(html).toContain('CONTENT');
    expect(html).toContain('&lt;관리자&gt; T');
    expect(html).toContain('ADMIN');
    expect(html).toContain('학생별 교재점검');
    expect(html).toContain('저장 완료');
  });
});
