import { describe, it, expect, vi } from 'vitest';
import { renderReportsView, reportForStudent, reportForClass, reportForStudentImage } from './reportsView.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

describe('reportsView', () => {
  const state = {
    students: [
      { id: 's1', name: '김다인', classId: 'c1', school: '열린중', grade: '중2' },
      { id: 's2', name: '박서준', classId: 'c1', school: '열린중', grade: '중2' }
    ],
    classes: [{ id: 'c1', name: '중2 A반', teacherId: 't1' }],
    books: [{ id: 'b1', title: '중등 수학' }],
    inspections: [
      {
        id: 'i1',
        date: '2026-05-20',
        classId: 'c1',
        studentId: 's1',
        bookId: 'b1',
        rangeStart: 1,
        rangeEnd: 10,
        missedPages: [3],
        completionRate: 90,
        rubricScores: {
          expression: 8,
          grading: 7,
          attitude: 9,
          understanding: 8,
          application: 6
        }
      }
    ]
  };

  const deps = {
    studentById: vi.fn(id => state.students.find(student => student.id === id)),
    classById: vi.fn(id => state.classes.find(klass => klass.id === id)),
    studentsForClass: vi.fn(classId => state.students.filter(student => student.classId === classId)),
    inspectionsForStudent: vi.fn(studentId => state.inspections.filter(row => row.studentId === studentId)),
    groupInspectionsByBook: vi.fn(rows => rows.reduce((grouped, row) => {
      grouped[row.bookId] = grouped[row.bookId] || [];
      grouped[row.bookId].push(row);
      return grouped;
    }, {})),
    bookById: vi.fn(id => state.books.find(book => book.id === id)),
    averageCompletionRate: vi.fn(() => 90),
    fmtDate: vi.fn(date => date || ''),
    teacherNameById: vi.fn(() => '김선생'),
    safe: vi.fn(value => String(value ?? '')),
    progressTone: vi.fn(() => ({ bar: '#4169e1' })),
    studentRubricAverage: vi.fn(() => ({
      assignment: 9,
      expression: 8,
      grading: 7,
      attitude: 9,
      understanding: 8,
      application: 6
    })),
    bookRubricAverage: vi.fn(() => ({
      assignment: 8,
      expression: 7,
      grading: 6,
      attitude: 8,
      understanding: 7,
      application: 5
    })),
    classRubricAverage: vi.fn(() => ({
      assignment: 7,
      expression: 6,
      grading: 6,
      attitude: 7,
      understanding: 6,
      application: 5
    })),
    students: state.students,
    inspections: state.inspections
  };

  it('학생 보고서에 교재 평균/반 평균 6요소 비교를 표시한다', () => {
    const html = reportForStudent('s1', state, deps);

    expect(html).toContain('해당 교재 평균 vs 학생 6요소');
    expect(html).toContain('반 평균 6요소 비교');
    expect(html).toContain('풀이 표현력');
  });

  it('학생 보고서는 progressTone 의존성이 없어도 기본 색상으로 렌더링한다', () => {
    const { progressTone, ...depsWithoutProgressTone } = deps;

    expect(() => reportForStudent('s1', state, depsWithoutProgressTone)).not.toThrow();
    expect(reportForStudent('s1', state, depsWithoutProgressTone)).toContain('완료율 90%');
  });

  it('교재 카드별 점검 기록으로 학생 6요소 벡터를 계산한다', () => {
    const twoBookState = {
      ...state,
      books: [
        { id: 'b1', title: 'Book Alpha' },
        { id: 'b2', title: 'Book Beta' }
      ],
      inspections: [
        {
          id: 'alpha-row',
          date: '2026-05-20',
          classId: 'c1',
          studentId: 's1',
          bookId: 'b1',
          rangeStart: 1,
          rangeEnd: 10,
          missedPages: [],
          completionRate: 100,
          rubricScores: { expression: 10, grading: 9, attitude: 8, understanding: 7, application: 5 }
        },
        {
          id: 'beta-row',
          date: '2026-05-21',
          classId: 'c1',
          studentId: 's1',
          bookId: 'b2',
          rangeStart: 11,
          rangeEnd: 20,
          missedPages: [12, 13],
          completionRate: 80,
          rubricScores: { expression: 2, grading: 3, attitude: 4, understanding: 5, application: 6 }
        }
      ]
    };
    const twoBookDeps = {
      ...deps,
      studentById: vi.fn(id => twoBookState.students.find(student => student.id === id)),
      classById: vi.fn(id => twoBookState.classes.find(klass => klass.id === id)),
      inspectionsForStudent: vi.fn(studentId => twoBookState.inspections.filter(row => row.studentId === studentId)),
      bookById: vi.fn(id => twoBookState.books.find(book => book.id === id)),
      averageCompletionRate: vi.fn(rows => rows.reduce((sum, row) => sum + row.completionRate, 0) / rows.length),
      studentRubricAverage: vi.fn(() => ({
        assignment: 9,
        expression: 6,
        grading: 6,
        attitude: 6,
        understanding: 6,
        application: 6
      })),
      bookRubricAverage: vi.fn(() => ({
        assignment: 0,
        expression: 0,
        grading: 0,
        attitude: 0,
        understanding: 0,
        application: 0
      })),
      classRubricAverage: vi.fn(() => ({
        assignment: 0,
        expression: 0,
        grading: 0,
        attitude: 0,
        understanding: 0,
        application: 0
      })),
      inspections: twoBookState.inspections
    };

    const html = reportForStudent('s1', twoBookState, twoBookDeps);
    const alphaCard = html.slice(html.indexOf('Book Alpha'), html.indexOf('Book Beta'));
    const betaCard = html.slice(html.indexOf('Book Beta'));
    const alphaBookChart = alphaCard.slice(
      alphaCard.indexOf('해당 교재 평균 vs 학생 6요소'),
      alphaCard.indexOf('반 평균 6요소 비교')
    );

    expect(alphaBookChart).toContain('<span class="font-black text-slate-100">10.0</span>');
    expect(alphaBookChart).not.toContain('<span class="font-black text-slate-100">6.0</span>');
    expect(betaCard).toContain('<span class="font-black text-slate-100">2.0</span>');
  });

  it('이후 회차에서 회수 처리된 쪽수는 보완 필요 쪽수 요약에서 제외한다', () => {
    const carryoverState = {
      ...state,
      books: [{ id: 'b1', title: 'Carryover Book' }],
      inspections: [
        {
          id: 'source-row',
          date: '2026-05-10',
          classId: 'c1',
          studentId: 's1',
          bookId: 'b1',
          rangeStart: 1,
          rangeEnd: 10,
          missedPages: [3, 4],
          completionRate: 80,
          rubricScores: {}
        },
        {
          id: 'later-row',
          date: '2026-05-20',
          classId: 'c1',
          studentId: 's1',
          bookId: 'b1',
          rangeStart: 11,
          rangeEnd: 20,
          missedPages: [],
          completionRate: 100,
          rubricScores: {},
          carryoverResolutions: [
            { sourceInspectionId: 'source-row', sourceDate: '2026-05-10', resolvedPages: [3] }
          ]
        }
      ]
    };
    const carryoverDeps = {
      ...deps,
      studentById: vi.fn(id => carryoverState.students.find(student => student.id === id)),
      classById: vi.fn(id => carryoverState.classes.find(klass => klass.id === id)),
      inspectionsForStudent: vi.fn(studentId => carryoverState.inspections.filter(row => row.studentId === studentId)),
      bookById: vi.fn(id => carryoverState.books.find(book => book.id === id)),
      averageCompletionRate: vi.fn(() => 90),
      inspections: carryoverState.inspections
    };

    const html = reportForStudent('s1', carryoverState, carryoverDeps);
    const card = html.slice(html.indexOf('Carryover Book'));

    expect(card).not.toContain('font-bold">3');
    expect(card).toContain('font-bold">4');
  });

  it('보고서 선택 화면은 학생/반 선택 라벨과 값을 안전하게 이스케이프한다', () => {
    const maliciousStudent = '<img src=x onerror=alert(1)>';
    const maliciousClass = '<svg onload=alert(1)>';
    const maliciousStudentId = 's"><img src=x onerror=alert(1)>';
    const maliciousClassId = 'c"><svg onload=alert(1)>';
    const xssState = {
      currentTeacher: { id: 't1', role: 'teacher' },
      classes: [{ id: maliciousClassId, name: maliciousClass, teacherId: 't1' }],
      students: [{ id: maliciousStudentId, name: maliciousStudent, classId: maliciousClassId }],
      reportStudentId: maliciousStudentId,
      reportClassId: maliciousClassId,
      printHtml: ''
    };
    const xssDeps = {
      teacherClasses: vi.fn(() => xssState.classes),
      classById: vi.fn(() => xssState.classes[0]),
      safe: vi.fn(escapeHtml)
    };

    const html = renderReportsView(xssState, xssDeps);

    expect(html).toContain('학생별 보고서 생성 설정');
    expect(html).toContain('반전체 보고서');
    expect(html).not.toContain(maliciousStudent);
    expect(html).not.toContain(maliciousClass);
    expect(html).not.toContain(maliciousStudentId);
    expect(html).not.toContain(maliciousClassId);
    expect(html).toContain(escapeHtml(maliciousStudent));
    expect(html).toContain(escapeHtml(maliciousClass));
    expect(html).toContain(escapeHtml(maliciousStudentId));
    expect(html).toContain(escapeHtml(maliciousClassId));
    expect(html).toContain(`data-value="${escapeHtml(maliciousStudentId)}" class="choice-button btn-choice-teacher selected"`);
    expect(html).toContain(`data-value="${escapeHtml(maliciousClassId)}" class="choice-button btn-choice-teacher selected"`);
  });

  it('반 보고서에 학생별 6요소 표를 표시한다', () => {
    const html = reportForClass('c1', state, deps);

    expect(html).toContain('풀이 표현력');
    expect(html).toContain('응용 해결력');
    expect(html).toContain('김다인');
  });
  it('renders report round settings and selectable round buttons', () => {
    const reportState = {
      ...state,
      currentTeacher: { id: 't1', role: 'teacher' },
      reportClassId: 'c1',
      reportStudentId: 's1',
      reportRoundStartDate: '2026-05-01',
      selectedReportRound: 1,
      reportRounds: [
        { round: 1, date: '2026-05-02', displayDate: '05.02.토', fileDate: '05.02.토', count: 2 },
        { round: 2, date: '2026-05-11', displayDate: '05.11.월', fileDate: '05.11.월', count: 1 }
      ],
      printHtml: ''
    };

    const html = renderReportsView(reportState, {
      teacherClasses: vi.fn(() => reportState.classes),
      classById: vi.fn(id => reportState.classes.find(klass => klass.id === id)),
      safe: vi.fn(escapeHtml)
    });

    expect(html).toContain('| 학생별 보고서 생성 설정');
    expect(html).toContain('보고서 회차 기준일');
    expect(html).toContain('1회차 (05.02.토)');
    expect(html).toContain('data-action="select-report-round" data-round="1"');
    expect(html).toContain('보고서를 생성할 회차를 선택해주세요');
    expect(html).not.toContain('parent-image-report');
  });

  it('uses a single setup card for date, class, student, and round selection', () => {
    const reportState = {
      ...state,
      currentTeacher: { id: 't1', role: 'teacher' },
      reportClassId: 'c1',
      reportStudentId: '',
      reportRoundStartDate: '2026-05-01',
      selectedReportRound: '',
      reportRounds: [],
      printHtml: ''
    };

    const html = renderReportsView(reportState, {
      teacherClasses: vi.fn(() => reportState.classes),
      classById: vi.fn(id => reportState.classes.find(klass => klass.id === id)),
      safe: vi.fn(escapeHtml)
    });

    expect(html).toContain('data-report-flow="student-image"');
    expect(html).toContain('data-action="open-report-date-picker"');
    expect(html).toContain('data-target="reportClassId"');
    expect(html).toContain('data-target="reportStudentId"');
    expect(html).not.toContain('data-action="build-student-report"');
    expect(html).toContain('data-report-section="class-summary"');
  });

  it('does not show selectable rounds before a student is selected', () => {
    const reportState = {
      ...state,
      currentTeacher: { id: 't1', role: 'teacher' },
      reportClassId: 'c1',
      reportStudentId: '',
      reportRoundStartDate: '2026-05-01',
      selectedReportRound: '',
      reportRounds: [
        { round: 1, date: '2026-05-02', displayDate: '05.02.토', fileDate: '05.02.토', count: 2 }
      ],
      printHtml: ''
    };

    const html = renderReportsView(reportState, {
      teacherClasses: vi.fn(() => reportState.classes),
      classById: vi.fn(id => reportState.classes.find(klass => klass.id === id)),
      safe: vi.fn(escapeHtml)
    });

    expect(html).toContain('학생을 선택하면 생성 가능한 회차가 표시됩니다.');
    expect(html).not.toContain('data-action="select-report-round"');
  });

  it('renders class report preview in the bottom class section without replacing student preview', () => {
    const reportState = {
      ...state,
      currentTeacher: { id: 't1', role: 'teacher' },
      reportClassId: 'c1',
      reportStudentId: 's1',
      reportRoundStartDate: '2026-05-01',
      selectedReportRound: '1',
      reportRounds: [{ round: 1, date: '2026-05-02', displayDate: '05.02.토', fileDate: '05.02.토', count: 1 }],
      printHtml: '<div id="student-preview">학생 개인 보고서</div>',
      classReportHtml: '<div id="class-preview">반 전체 보고서</div>'
    };

    const html = renderReportsView(reportState, {
      teacherClasses: vi.fn(() => reportState.classes),
      classById: vi.fn(id => reportState.classes.find(klass => klass.id === id)),
      safe: vi.fn(escapeHtml)
    });
    const classSection = html.slice(html.indexOf('data-report-section="class-summary"'));

    expect(html).toContain('id="student-preview"');
    expect(classSection).toContain('id="classReportPreviewArea"');
    expect(classSection).toContain('id="class-preview"');
    expect(classSection).toContain('data-action="print-class-report"');
    expect(html).toContain('id="classReportPrintArea"');
  });

  it('renders the bright parent image report title and selected round only', () => {
    const imageState = {
      ...state,
      students: [{ id: 's1', name: '고준화', classId: 'c1', school: '서울고', grade: '고1' }],
      classes: [{ id: 'c1', name: '고1 서울대2반', teacherId: 't1' }],
      teachers: [{ id: 't1', name: '수최' }],
      books: [
        { id: 'b1', title: '공통수학1' },
        { id: 'b2', title: '일품 수학' }
      ],
      inspections: [
        {
          id: 'r1',
          date: '2026-05-02',
          classId: 'c1',
          studentId: 's1',
          bookId: 'b1',
          rangeStart: 1,
          rangeEnd: 20,
          missedPages: [12, 13],
          completionRate: 41,
          memo: '개인 사정',
          rubricScores: { expression: 8, grading: 9, attitude: 9, understanding: 7, application: 8 }
        },
        {
          id: 'r2',
          date: '2026-05-11',
          classId: 'c1',
          studentId: 's1',
          bookId: 'b2',
          rangeStart: 21,
          rangeEnd: 40,
          missedPages: [],
          completionRate: 100,
          memo: '다음 회차',
          rubricScores: {}
        }
      ]
    };
    const imageDeps = {
      ...deps,
      studentById: vi.fn(id => imageState.students.find(student => student.id === id)),
      classById: vi.fn(id => imageState.classes.find(klass => klass.id === id)),
      inspectionsForStudent: vi.fn(studentId => imageState.inspections.filter(row => row.studentId === studentId)),
      groupInspectionsByBook: vi.fn(rows => rows.reduce((grouped, row) => {
        grouped[row.bookId] = grouped[row.bookId] || [];
        grouped[row.bookId].push(row);
        return grouped;
      }, {})),
      bookById: vi.fn(id => imageState.books.find(book => book.id === id)),
      teacherNameById: vi.fn(() => '수최'),
      averageCompletionRate: vi.fn(rows => rows.reduce((sum, row) => sum + row.completionRate, 0) / rows.length),
      safe: vi.fn(escapeHtml),
      unitsForRange: vi.fn(() => [{ name: '다항식의 연산' }]),
      inspections: imageState.inspections,
      students: imageState.students
    };

    const html = reportForStudentImage('s1', imageState, imageDeps, {
      round: { round: 1, date: '2026-05-02', displayDate: '05.02.토', fileDate: '05.02.토' }
    });

    expect(html).toContain('고준화 (고1 서울대2반) - 수최T');
    expect(html).toContain('OATIS');
    expect(html).toContain('Open Academy Textbook Insight System');
    expect(html).toContain('parent-report-student-name');
    expect(html).toContain('parent-report-teacher-name');
    expect(html).toContain('<span class="parent-report-round-num">1회차</span> 교재 분석 보고서');
    expect(html).toContain('열린학원');
    expect(html).toContain('공통수학1');
    expect(html).toContain('점검 완료율 41%');
    expect(html).toContain('완료한 단원');
    expect(html).toContain('보완 필요 쪽수');
    expect(html).toContain('교재 6요소');
    expect(html).toContain('교재 점검 최근 코멘트');
    expect(html).toContain('개인 사정');
    expect(html).not.toContain('다음 회차');
  });
});
