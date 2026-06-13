import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PARENT_CONSULT_TAG,
  PARENT_CONSULT_TAGS,
  normalizeParentConsultTag
} from './attendanceConsultation.js';

describe('학부모 상담 태그 설정', () => {
  it('요청한 네 개 태그를 지정된 순서로 제공한다', () => {
    expect(PARENT_CONSULT_TAGS).toEqual([
      '성적상담',
      '신입상담',
      '학습상담',
      '대면상담'
    ]);
  });

  it('학부모 상담을 열면 첫 번째 태그인 성적상담을 기본 선택한다', () => {
    expect(DEFAULT_PARENT_CONSULT_TAG).toBe('성적상담');
  });

  it('기존 정기상담 기록을 수정할 때 대면상담으로 연결한다', () => {
    expect(normalizeParentConsultTag('정기상담')).toBe('대면상담');
  });
});
