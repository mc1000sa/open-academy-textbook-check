import { describe, it, expect, vi } from 'vitest';
import { renderTeachersAdminView } from './teachersAdminView.js';

describe('TeachersAdminView Component', () => {
  const mockState = {
    currentTeacher: { id: 't_kim', name: '김선생', role: 'admin' },
    teachers: [
      { id: 't_kim', name: '김선생', role: 'admin' },
      { id: 't_lee', name: '이선생', role: 'teacher' }
    ],
    classes: [{ id: 'c1', name: '중3 A반', grade: '중3', teacherId: 't_lee' }],
    books: [{ id: 'b1', title: '중3 수학', subject: '수학', grade: '중3', archived: false }],
    adminTeacherForm: { name: '박선생', pin: '111111', role: 'teacher' },
    adminTeacherEditId: '',
    adminCardExpanded: { teachers: true, classes: true, books: true, loginSplash: true },
    adminLoginConfigForm: {},
    loginConfig: {}
  };

  const mockDeps = {
    safe: vi.fn((val) => val),
    teacherNameById: vi.fn(() => '이선생')
  };

  it('should block access if the current teacher is not an admin', () => {
    const nonAdminState = {
      ...mockState,
      currentTeacher: { id: 't_lee', name: '이선생', role: 'teacher' }
    };
    const html = renderTeachersAdminView(nonAdminState, mockDeps);
    expect(html).toContain('관리자 권한 계정만 접근 가능한 영역입니다.');
  });

  it('should render admin tools correctly when the current teacher is an admin', () => {
    const html = renderTeachersAdminView(mockState, mockDeps);
    expect(html).toContain('강사 계정 및 목록 관리');
    expect(html).toContain('현재 등록된 강사 목록');
    expect(html).toContain('반 삭제 관리');
    expect(html).toContain('교재 영구 삭제 통제');
    expect(html).toContain('로그인 & 스플래시 화면 설정');
    expect(html).toContain('PIN 6자리');
    expect(html).toContain('maxlength="6"');
    expect(html).toContain('이선생'); // 강사 목록 렌더 확인
    expect(html).toContain('중3 A반'); // 반 삭제 목록 렌더 확인
    expect(html).toContain('중3 수학'); // 교재 삭제 목록 렌더 확인
  });
});
