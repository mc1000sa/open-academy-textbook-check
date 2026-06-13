export const PARENT_CONSULT_TAGS = [
  '성적상담',
  '신입상담',
  '학습상담',
  '대면상담'
];

export const DEFAULT_PARENT_CONSULT_TAG = PARENT_CONSULT_TAGS[0];

export const normalizeParentConsultTag = (tag) => {
  if (tag === '정기상담') return '대면상담';
  return PARENT_CONSULT_TAGS.includes(tag) ? tag : DEFAULT_PARENT_CONSULT_TAG;
};
