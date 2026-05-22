export const DEFAULT_STANDARD_UNIT_SUBJECTS = Object.freeze([
  {
    code: 'common_math_1',
    label: '공통수학1',
    units: [
      { id: 'common_math_1_polynomial_operations', label: '다항식의 연산' },
      { id: 'common_math_1_identity', label: '항등식' },
      { id: 'common_math_1_remainder_theorem', label: '나머지정리' },
      { id: 'common_math_1_factorization', label: '인수분해' },
      { id: 'common_math_1_complex_numbers', label: '복소수의 뜻과 연산' },
      { id: 'common_math_1_quadratic_equation_roots', label: '이차방정식의 판별식과 근의 관계' },
      { id: 'common_math_1_quadratic_function', label: '이차함수' },
      { id: 'common_math_1_quadratic_equation_function_relation', label: '이차방정식과 이차함수의 관계' },
      { id: 'common_math_1_higher_degree_equation', label: '고차방정식' },
      { id: 'common_math_1_various_equations', label: '연립방정식과 여러 가지 방정식' },
      { id: 'common_math_1_linear_inequality', label: '일차부등식' },
      { id: 'common_math_1_quadratic_inequality', label: '이차부등식' },
      { id: 'common_math_1_various_inequalities', label: '여러 가지 부등식' },
      { id: 'common_math_1_counting', label: '경우의 수' },
      { id: 'common_math_1_permutation', label: '순열' },
      { id: 'common_math_1_combination', label: '조합' },
      { id: 'common_math_1_matrix_operations', label: '행렬의 뜻과 연산' },
      { id: 'common_math_1_matrix_multiplication', label: '행렬의 곱셈' }
    ]
  },
  {
    code: 'common_math_2',
    label: '공통수학2',
    units: [
      { id: 'common_math_2_plane_coordinates', label: '평면좌표' },
      { id: 'common_math_2_line_equation', label: '직선의 방정식' },
      { id: 'common_math_2_circle_equation', label: '원의 방정식' },
      { id: 'common_math_2_circle_line_relation', label: '원과 직선의 위치 관계' },
      { id: 'common_math_2_transformations', label: '도형의 이동' },
      { id: 'common_math_2_set_inclusion', label: '집합의 뜻과 포함 관계' },
      { id: 'common_math_2_set_operations', label: '집합의 연산' },
      { id: 'common_math_2_proposition_condition', label: '명제와 조건' },
      { id: 'common_math_2_proof', label: '명제의 증명' },
      { id: 'common_math_2_function_graph', label: '함수의 뜻과 그래프' },
      { id: 'common_math_2_various_functions', label: '여러 가지 함수' },
      { id: 'common_math_2_rational_function', label: '유리함수' },
      { id: 'common_math_2_irrational_function', label: '무리함수' }
    ]
  },
  {
    code: 'algebra',
    label: '대수',
    units: [
      { id: 'algebra_exponents_laws', label: '지수와 지수법칙' },
      { id: 'algebra_logarithms_properties', label: '로그와 로그의 성질' },
      { id: 'algebra_common_logarithm', label: '상용로그' },
      { id: 'algebra_exponential_function', label: '지수함수' },
      { id: 'algebra_logarithmic_function', label: '로그함수' },
      { id: 'algebra_exponential_equation_inequality', label: '지수방정식과 지수부등식' },
      { id: 'algebra_logarithmic_equation_inequality', label: '로그방정식과 로그부등식' },
      { id: 'algebra_trig_definition', label: '삼각함수의 정의' },
      { id: 'algebra_trig_graph', label: '삼각함수의 그래프' },
      { id: 'algebra_trig_application', label: '삼각함수의 활용' },
      { id: 'algebra_sequence_meaning_various', label: '수열의 뜻과 여러 가지 수열' },
      { id: 'algebra_arithmetic_sequence', label: '등차수열' },
      { id: 'algebra_geometric_sequence', label: '등비수열' },
      { id: 'algebra_sequence_sum', label: '수열의 합' },
      { id: 'algebra_mathematical_induction', label: '수학적 귀납법' }
    ]
  },
  {
    code: 'calculus_1',
    label: '미적분Ⅰ',
    units: [
      { id: 'calculus_1_sequence_limit', label: '수열의 극한' },
      { id: 'calculus_1_series', label: '급수' },
      { id: 'calculus_1_function_limit', label: '함수의 극한' },
      { id: 'calculus_1_function_continuity', label: '함수의 연속' },
      { id: 'calculus_1_derivative_coefficient_function', label: '미분계수와 도함수' },
      { id: 'calculus_1_tangent_line', label: '접선의 방정식' },
      { id: 'calculus_1_increase_decrease', label: '함수의 증가와 감소' },
      { id: 'calculus_1_extreme', label: '극대와 극소' },
      { id: 'calculus_1_max_min', label: '최대와 최소' },
      { id: 'calculus_1_equation_inequality_application', label: '방정식과 부등식에의 활용' },
      { id: 'calculus_1_velocity_acceleration', label: '속도와 가속도' },
      { id: 'calculus_1_indefinite_integral', label: '부정적분' },
      { id: 'calculus_1_definite_integral', label: '정적분' },
      { id: 'calculus_1_definite_integral_application', label: '정적분의 활용' }
    ]
  },
  {
    code: 'probability_statistics',
    label: '확률과 통계',
    units: [
      { id: 'prob_stats_repetition_permutation_combination', label: '중복순열과 중복조합' },
      { id: 'prob_stats_binomial_theorem', label: '이항정리' },
      { id: 'prob_stats_probability_meaning_properties', label: '확률의 뜻과 기본 성질' },
      { id: 'prob_stats_addition_multiplication_rule', label: '확률의 덧셈정리와 곱셈정리' },
      { id: 'prob_stats_conditional_probability', label: '조건부확률' },
      { id: 'prob_stats_independent_trial', label: '독립시행' },
      { id: 'prob_stats_discrete_random_variable_distribution', label: '이산확률변수와 확률분포' },
      { id: 'prob_stats_binomial_distribution', label: '이항분포' },
      { id: 'prob_stats_continuous_random_variable_density', label: '연속확률변수와 확률밀도함수' },
      { id: 'prob_stats_normal_distribution', label: '정규분포' },
      { id: 'prob_stats_sample_mean_distribution', label: '표본평균의 분포' },
      { id: 'prob_stats_population_mean_estimation', label: '모평균의 추정' }
    ]
  },
  {
    code: 'calculus_2',
    label: '미적분Ⅱ',
    units: [
      { id: 'calculus_2_exp_log_limit', label: '지수함수와 로그함수의 극한' },
      { id: 'calculus_2_exp_log_derivative', label: '지수함수와 로그함수의 미분' },
      { id: 'calculus_2_trig_properties_limit', label: '삼각함수의 성질과 극한' },
      { id: 'calculus_2_trig_derivative', label: '삼각함수의 미분' },
      { id: 'calculus_2_various_derivatives', label: '여러 가지 미분법' },
      { id: 'calculus_2_parametric_implicit_derivative', label: '매개변수와 음함수의 미분' },
      { id: 'calculus_2_derivative_application', label: '도함수의 활용' },
      { id: 'calculus_2_various_integrals', label: '여러 가지 적분법' },
      { id: 'calculus_2_substitution_partial_integral', label: '치환적분과 부분적분' },
      { id: 'calculus_2_definite_integral_application', label: '정적분의 활용' }
    ]
  },
  {
    code: 'geometry',
    label: '기하',
    units: [
      { id: 'geometry_conic_sections', label: '이차곡선' },
      { id: 'geometry_conic_line_relation', label: '이차곡선과 직선의 위치 관계' },
      { id: 'geometry_plane_vector_operations', label: '평면벡터의 뜻과 연산' },
      { id: 'geometry_plane_vector_component_inner_product', label: '평면벡터의 성분과 내적' },
      { id: 'geometry_vector_equation_line_circle', label: '직선과 원의 벡터방정식' },
      { id: 'geometry_spatial_figures', label: '공간도형' },
      { id: 'geometry_spatial_coordinates', label: '공간좌표' },
      { id: 'geometry_spatial_line_plane', label: '공간에서의 직선과 평면' }
    ]
  }
]);

function cloneSubjects(subjects) {
  return (subjects || []).map(subject => ({
    code: String(subject.code || '').trim(),
    label: String(subject.label || '').trim(),
    units: (subject.units || []).map((unit, index) => ({
      id: String(unit.id || '').trim(),
      label: String(unit.label || '').trim(),
      order: Number.isFinite(Number(unit.order)) ? Number(unit.order) : index + 1,
      active: unit.active !== false
    }))
  }));
}

export function normalizeStandardUnitSubjects(subjects) {
  const source = Array.isArray(subjects) && subjects.length
    ? subjects
    : DEFAULT_STANDARD_UNIT_SUBJECTS;

  return cloneSubjects(source)
    .filter(subject => subject.code && subject.label)
    .map(subject => ({
      ...subject,
      units: subject.units
        .filter(unit => unit.id && unit.label)
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    }));
}

export function standardUnitLabelMap(subjects) {
  return normalizeStandardUnitSubjects(subjects).reduce((map, subject) => {
    subject.units.forEach(unit => {
      map[unit.id] = unit.label;
    });
    return map;
  }, {});
}

export function standardUnitLabelsForIds(subjects, ids) {
  const labels = standardUnitLabelMap(subjects);
  return [...new Set(ids || [])]
    .map(id => labels[id])
    .filter(Boolean);
}

export function standardUnitSubjectByLabel(subjects, label) {
  const normalizedLabel = String(label || '').trim();
  return normalizeStandardUnitSubjects(subjects).find(subject => subject.label === normalizedLabel) || null;
}
