import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import StudentPortal from './StudentPortal.jsx';

const escapeHtml = value =>
  String(value ?? '').replace(/[&<>"']/g, match => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[match]);

const mockProps = {
  db: {},
  refs: {},
  inspectionsForStudent: (studentId) => [
    {
      id: 'i2',
      studentId: 's1',
      bookId: 'b1',
      rangeStart: null,
      rangeEnd: null,
      completionRate: null,
      attendanceStatus: 'absent',
      date: '2026-05-24',
      memo: '개인 사정',
      teacherName: '수치'
    },
    {
      id: 'i1',
      studentId: 's1',
      bookId: 'b1',
      rangeStart: 10,
      rangeEnd: 20,
      completionRate: 82,
      attendanceStatus: 'present',
      date: '2026-05-20',
      memo: '잘함',
      teacherName: '수치'
    }
  ],
  bookById: (id) => ({ id, title: '공통수학1 1학기 기말_시험대비교재', subject: '공통수학1', grade: '전체' }),
  bookUnits: () => [],
  averageCompletionRate: () => 82,
  groupInspectionsByBook: (inspections) => {
    return {
      'b1': inspections
    };
  },
  fmtDate: (dateStr) => {
    if (!dateStr) return '';
    return dateStr.replace(/-/g, '.');
  },
  safe: escapeHtml,
  progressTone: () => ({ badge: 'text-emerald-700', bar: '#10b981' }),
  unitsForRange: () => [],
  assignedBooksForClass: () => [{ book: { id: 'b1' } }],
  updateLegacyState: () => {},
  updateStudentPin: () => {},
  showModalAlert: () => {}
};

describe('StudentPortal Component (SSR String Check)', () => {
  it('renders student profile and dashboard summary', () => {
    const state = {
      studentSession: { id: 's1', name: '고준화', classId: 'c1', school: '수억고' },
      classes: [{ id: 'c1', name: '고1 서울대2반', teacherId: 't1' }],
      teachers: [{ id: 't1', name: '수치' }],
      students: [{ id: 's1', name: '고준화', classId: 'c1' }],
      inspections: [],
      selectedStudentBookFilter: '',
      selectedStudentRubricBookId: ''
    };

    const html = renderToString(
      React.createElement(StudentPortal, {
        ...mockProps,
        state
      })
    );

    expect(html).toContain('고준화');
    expect(html).toContain('고1 서울대2반');
    expect(html).toContain('수억고');
    expect(html).toContain('수치');
    expect(html).toContain('전체 교재 완료율');
  });

  it('handles absent status correctly and preserves the last active completion rate', () => {
    const state = {
      studentSession: { id: 's1', name: '고준화', classId: 'c1', school: '수억고' },
      classes: [{ id: 'c1', name: '고1 서울대2반', teacherId: 't1' }],
      teachers: [{ id: 't1', name: '수치' }],
      students: [{ id: 's1', name: '고준화', classId: 'c1' }],
      inspections: [],
      selectedStudentBookFilter: '',
      selectedStudentRubricBookId: ''
    };

    const html = renderToString(
      React.createElement(StudentPortal, {
        ...mockProps,
        state
      })
    );

    // 1. 최근 점검 범위에 '결석' 표시 여부
    expect(html).toContain('결석');
    expect(html).not.toContain('null ~ null쪽');

    // 2. 학습 완료율은 이전 정상 점검(82%)으로 표시
    expect(html).toContain('82%');
    expect(html).not.toContain('null%');

    // 3. 지도 코멘트에 결석일과 결석 상태 표시 확인
    expect(html).toContain('[2026.05.24 결석] 개인 사정');
  });

  it('renders "범위: 결석 (평가 제외)" in the detailed log history', () => {
    const state = {
      studentSession: { id: 's1', name: '고준화', classId: 'c1', school: '수억고' },
      classes: [{ id: 'c1', name: '고1 서울대2반', teacherId: 't1' }],
      teachers: [{ id: 't1', name: '수치' }],
      students: [{ id: 's1', name: '고준화', classId: 'c1' }],
      inspections: [],
      selectedStudentBookFilter: '',
      selectedStudentRubricBookId: ''
    };

    const html = renderToString(
      React.createElement(StudentPortal, {
        ...mockProps,
        state
      })
    );

    expect(html).toContain('범위: 결석 (평가 제외)');
    expect(html).toContain('범위: 10~20쪽');
  });
});
