import { describe, expect, it } from 'vitest';
import { buildStudentHistoryItems } from './attendanceHistory.js';

describe('buildStudentHistoryItems', () => {
  it('출석 데이터의 결석과 지각을 학생 히스토리 항목으로 만든다', () => {
    const items = buildStudentHistoryItems({
      studentId: 'student-1',
      attendanceData: {
        'student-1_2026-06-13': { status: '결석', note: '' },
        'student-1_2026-06-11': { status: '지각', note: '' },
        'student-2_2026-06-13': { status: '결석', note: '' }
      },
      consultingList: []
    });

    expect(items.map(item => ({ category: item.displayCategory, date: item.date, content: item.displayContent }))).toEqual([
      { category: '결석', date: '2026-06-13', content: '' },
      { category: '지각', date: '2026-06-11', content: '' }
    ]);
  });

  it('기존 출결 사유 기록은 상태별 칩과 새 문구 형식으로 변환한다', () => {
    const items = buildStudentHistoryItems({
      studentId: 'student-1',
      attendanceData: {},
      consultingList: [
        {
          id: 'late-log',
          category: '출결',
          date: '2026-06-13',
          content: '[지각 사유 - 개인사정] (10분 지각) 저녁 식사'
        },
        {
          id: 'absent-log',
          category: '출결',
          date: '2026-06-11',
          content: '[결석 사유 - 병결] 독감'
        }
      ]
    });

    expect(items[0].displayCategory).toBe('지각');
    expect(items[0].displayContent).toBe('[사유 - 개인 사정] 10분 + 저녁 식사');
    expect(items[1].displayCategory).toBe('결석');
    expect(items[1].displayContent).toBe('[사유 - 병결] 독감');
  });

  it('같은 날짜와 상태의 출석 데이터와 사유 기록은 중복 표시하지 않는다', () => {
    const items = buildStudentHistoryItems({
      studentId: 'student-1',
      attendanceData: {
        'student-1_2026-06-13': { status: '지각', note: '[지각-늦잠] (5분 지각)' }
      },
      consultingList: [
        {
          id: 'late-log',
          category: '출결',
          date: '2026-06-13',
          content: '[지각 사유 - 늦잠] (5분 지각)'
        }
      ]
    });

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('late-log');
  });

  it('기존 퇴원상담 기록은 진로상담 명칭으로 표시한다', () => {
    const [item] = buildStudentHistoryItems({
      studentId: 'student-1',
      attendanceData: {},
      consultingList: [
        {
          id: 'career-log',
          category: '퇴원상담',
          date: '2026-06-10',
          content: '[퇴원 상담 - 학생 상담] 진학 방향 논의'
        }
      ]
    });

    expect(item.displayCategory).toBe('진로상담');
    expect(item.displayContent).toBe('[진로 상담 - 학생 상담] 진학 방향 논의');
  });

  it('실제 원생 퇴원 처리 기록은 퇴원상담 명칭을 유지한다', () => {
    const [item] = buildStudentHistoryItems({
      studentId: 'student-1',
      attendanceData: {},
      consultingList: [
        {
          id: 'withdrawal-log',
          category: '퇴원상담',
          date: '2026-06-09',
          content: '[퇴원 처리] 사유: 타지역 이사'
        }
      ]
    });

    expect(item.displayCategory).toBe('퇴원상담');
    expect(item.displayContent).toBe('[퇴원 처리] 사유: 타지역 이사');
  });
});
