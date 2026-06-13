import { describe, expect, it } from 'vitest';
import { getDefaultStaffView } from './staffNavigation.js';

describe('직원 로그인 기본 화면', () => {
  it('강사는 출석부로 진입한다', () => {
    expect(getDefaultStaffView('teacher')).toBe('attendance');
  });

  it('관리자는 기존 관리자 설정 화면으로 진입한다', () => {
    expect(getDefaultStaffView('admin')).toBe('teachersAdmin');
  });
});
