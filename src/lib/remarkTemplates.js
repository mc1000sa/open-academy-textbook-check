export const REMARK_TONES = [
  { key: 'positive', label: '긍정적 평가' },
  { key: 'neutral', label: '평이한 평가' },
  { key: 'negative', label: '부정적 평가' }
];

export const DEFAULT_REMARK_TEMPLATES = [
  {
    key: 'assignment',
    label: '과제 수행률',
    positive: ['과제를 성실하게 완성해 왔습니다.', '정해진 범위보다 더 많이 진행했습니다.'],
    neutral: ['과제 수행 속도가 조금 느린 편입니다.', '미완료 페이지가 있어 다음 시간에 재점검이 필요합니다.'],
    negative: ['정해진 범위 완성이 부족하여 가정에서 추가 확인이 필요합니다.']
  },
  {
    key: 'expression',
    label: '풀이 표현력',
    positive: ['글씨를 매우 잘 쓰는 학생입니다.', '풀이 과정을 꼼꼼하게 정리하는 편입니다.'],
    neutral: ['계산 과정은 맞지만 정리 습관이 더 필요합니다.'],
    negative: ['수학적 체계가 아직 안정적으로 잡히지 않았습니다.', '식을 세우는 과정에서 중간 단계가 자주 생략됩니다.']
  },
  {
    key: 'grading',
    label: '채점 성실도',
    positive: ['채점 약속을 잘 지켜서 매우 깔끔하게 했습니다.'],
    neutral: ['채점은 되어 있으나 오답 정리가 부족합니다.'],
    negative: ['오답 표시가 부족해 다시 확인이 필요합니다.', '틀린 문제를 다시 고치는 습관이 필요합니다.']
  },
  {
    key: 'attitude',
    label: '수업 태도',
    positive: ['수업 집중도가 좋고 설명을 잘 따라옵니다.'],
    neutral: ['수업 태도는 전반적으로 안정적인 편입니다.'],
    negative: ['수업 중 집중이 흐트러지는 시간이 있어 꾸준한 관리가 필요합니다.']
  },
  {
    key: 'understanding',
    label: '개념 이해도',
    positive: ['기본 개념 이해는 안정적인 편입니다.', '반복 연습 후 정확도가 올라가는 편입니다.'],
    neutral: ['개념 설명을 다시 듣고 나면 문제 해결이 가능합니다.'],
    negative: ['유형이 바뀌면 적용을 어려워합니다.']
  },
  {
    key: 'application',
    label: '응용 해결력',
    positive: ['심화 문제에서도 스스로 접근하려는 태도가 좋습니다.'],
    neutral: ['대표 유형은 해결 가능하나 변형 문제는 추가 연습이 필요합니다.'],
    negative: ['새로운 조건이 추가되면 풀이 전략을 잡는 데 어려움이 있습니다.']
  }
];

function normalizeItems(value) {
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
  return String(value || '').split('\n').map(item => item.trim()).filter(Boolean);
}

export function normalizeRemarkTemplates(templates) {
  const source = Array.isArray(templates) && templates.length ? templates : DEFAULT_REMARK_TEMPLATES;
  return DEFAULT_REMARK_TEMPLATES.map(defaultRow => {
    const row = source.find(item => item.key === defaultRow.key) || {};
    return {
      key: defaultRow.key,
      label: row.label || defaultRow.label,
      positive: normalizeItems(row.positive ?? defaultRow.positive),
      neutral: normalizeItems(row.neutral ?? defaultRow.neutral),
      negative: normalizeItems(row.negative ?? defaultRow.negative)
    };
  });
}
