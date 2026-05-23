import { describe, expect, it } from 'vitest';
import { renderLoginView } from './loginView.js';

const escapeHtml = value =>
  String(value ?? '').replace(/[&<>"']/g, match => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[match]);

describe('renderLoginView', () => {
  it('renders teacher buttons and marks the selected teacher', () => {
    const html = renderLoginView({
      portal: 'teacher',
      teachers: [
        { id: 't1', name: '관리자', role: 'teacher' },
        { id: 't2', name: 'Joy', role: 'teacher' }
      ],
      selectedTeacherName: 't2',
      pin: ''
    }, escapeHtml);

    expect(html).toContain('담당 교사 빠른 로그인');
    expect(html).toContain('data-id="t1"');
    expect(html).toContain('data-id="t2"');
    expect(html).toContain('selected');
  });

  it('escapes teacher names and pin value', () => {
    const html = renderLoginView({
      portal: 'teacher',
      teachers: [{ id: 't1', name: '<script>', role: 'teacher' }],
      selectedTeacherName: '',
      pin: '"123'
    }, escapeHtml);

    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('value="&quot;123"');
  });

  it('marks the teacher PIN input for focus after a teacher is selected', () => {
    const html = renderLoginView({
      portal: 'teacher',
      teachers: [{ id: 't1', name: 'Joy', role: 'teacher' }],
      selectedTeacherName: 't1',
      pin: ''
    }, escapeHtml);

    expect(html).toContain('id="loginPin"');
    expect(html).toContain('data-autofocus="true"');
    expect(html).toContain('maxlength="6"');
  });

  it('marks the admin PIN input for focus immediately', () => {
    const html = renderLoginView({
      portal: 'admin',
      teachers: [{ id: 't_admin', name: 'Admin', role: 'admin' }],
      selectedTeacherName: 't_admin',
      pin: ''
    }, escapeHtml);

    expect(html).toContain('id="loginPin"');
    expect(html).toContain('data-autofocus="true"');
    expect(html).toContain('maxlength="6"');
  });

  it('keeps student PIN inputs at four digits', () => {
    const html = renderLoginView({
      portal: 'student',
      loginStep: 'login',
      teachers: [{ id: 't1', name: '김선생', role: 'teacher' }],
      classes: [{ id: 'c1', name: '고1 서울대반', grade: '고1', teacherId: 't1' }],
      students: [{ id: 's1', name: '홍길동', classId: 'c1', active: true }],
      allStudents: [{ id: 's1', name: '홍길동', classId: 'c1', active: true }],
      studentLoginForm: {
        teacherId: 't1',
        grade: '고1',
        classId: 'c1',
        studentId: 's1'
      }
    }, escapeHtml);

    expect(html).toContain('5단계: 4자리 PIN 비밀번호');
    expect(html).toContain('maxlength="4"');
  });

  it('renders student portal cascading steps and filters', () => {
    const state = {
      portal: 'student',
      loginStep: 'login',
      teachers: [
        { id: 't1', name: '김선생', role: 'teacher' },
        { id: 't2', name: '이선생', role: 'teacher' }
      ],
      classes: [
        { id: 'c1', name: '고1 서울대반', grade: '고등1학년', teacherId: 't1' },
        { id: 'c2', name: '중3 영재반', grade: '중등3학년', teacherId: 't2' }
      ],
      students: [
        { id: 's1', name: '홍길동', classId: 'c1', active: true },
        { id: 's2', name: '임꺽정', classId: 'c2', active: true }
      ],
      studentLoginForm: {
        teacherId: 't1',
        grade: '고등1학년',
        classId: 'c1',
        studentId: ''
      }
    };

    const html = renderLoginView(state, escapeHtml);

    // 1단계: 선생님 리스트 노출 확인
    expect(html).toContain('김선생 T');
    // 2단계: 학년 리스트 노출 확인
    expect(html).toContain('고등1학년');
    // 3단계: 반 리스트 노출 확인
    expect(html).toContain('고1 서울대반');
    // 아직 학생을 선택하지 않았으므로 5단계는 비활성화(disabled) 상태여야 함
    expect(html).toContain('disabled');
  });
});
