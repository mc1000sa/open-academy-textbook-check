import { describe, expect, it } from 'vitest';
import {
  buildWithdrawalLog,
  fallbackCopyText,
  sortStudentsByPrintPin
} from './attendancePrint.js';

describe('attendancePrint helpers', () => {
  it('출석부 출력 학생은 고정 학생을 먼저, 그다음 이름순으로 정렬한다', () => {
    const students = [
      { id: '2', name: '최민준' },
      { id: '1', name: '김서연', attendancePrintPinned: true },
      { id: '3', name: '박지호', attendancePrintPinned: true }
    ];

    expect(sortStudentsByPrintPin(students).map(student => student.id)).toEqual(['1', '3', '2']);
  });

  it('퇴원일지에는 담당 강사, 학생, 반, 날짜, 수학 과목, 고정 해시태그가 포함된다', () => {
    const text = buildWithdrawalLog({
      teacherName: '홍길동',
      student: { name: '김서연', school: '열린중', grade: '2학년' },
      className: '중2A',
      dischargeDate: '2026-06-08',
      reason: '상담 후 퇴원'
    });

    expect(text).toContain('#퇴원일지_홍길동');
    expect(text).toContain('■ 중2A : 김서연 (열린중 2학년)');
    expect(text).toContain('● 퇴원과목 : 수학');
    expect(text).toContain('#원카반영 해주세요.');
  });

  it('Clipboard API를 사용할 수 없으면 임시 textarea fallback으로 복사한다', () => {
    const appended = [];
    const removed = [];
    const fakeTextarea = {
      value: '',
      style: {},
      setAttribute: () => {},
      focus: () => {},
      select: () => {}
    };
    const fakeDocument = {
      body: {
        appendChild: node => appended.push(node),
        removeChild: node => removed.push(node)
      },
      createElement: tag => {
        expect(tag).toBe('textarea');
        return fakeTextarea;
      },
      execCommand: command => command === 'copy'
    };

    expect(fallbackCopyText('복사할 내용', fakeDocument)).toBe(true);
    expect(fakeTextarea.value).toBe('복사할 내용');
    expect(appended).toHaveLength(1);
    expect(removed).toHaveLength(1);
  });
});
