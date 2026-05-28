# 프로젝트 아키텍처

## 현재 구조

```text
open-academy-textbook-check/
├─ AGENTS.md
├─ RULES.md
├─ index.html
├─ package.json
├─ vite.config.js
├─ memory/
│  └─ lessons.md
├─ docs/
│  ├─ architecture.md
│  ├─ product-direction.md
│  └─ decisions/
│     └─ README.md
├─ public/
│  ├─ 404.html
│  ├─ logo.png
│  └─ logo2.png
├─ src/
│  ├─ App.jsx
│  ├─ main.jsx
│  ├─ components/
│  │  └─ LegacyAppHost.jsx
│  ├─ legacy/
│  │  ├─ legacyApp.js
│  │  └─ views/
│  │     ├─ loginView.js
│  │     └─ loginView.test.js
│  ├─ lib/
│  │  ├─ adminStudentMaintenance.js
│  │  ├─ adminStudentMaintenance.test.js
│  │  ├─ inspectionBatchSave.js
│  │  ├─ inspectionBatchSave.test.js
│  │  ├─ projectStructure.js
│  │  ├─ projectStructure.test.js
│  │  ├─ remarkTemplates.js
│  │  ├─ reportMetrics.js
│  │  ├─ reportMetrics.test.js
│  │  ├─ reportRounds.js
│  │  ├─ reportRounds.test.js
│  │  ├─ standardUnits.js
│  │  ├─ standardUnits.test.js
│  │  ├─ textbookProgress.js
│  │  └─ textbookProgress.test.js
│  ├─ services/
│  │  ├─ firebaseService.js
│  │  └─ firebaseService.test.js
│  └─ styles/
│     ├─ app.css
│     └─ legacy.css
├─ firebase.json
└─ logo.png
```

## 실행 구조

- Vite가 루트 `index.html`과 `src/main.jsx`를 빌드해 `dist`를 생성한다.
- Firebase Hosting은 `dist` 폴더를 배포한다.
- 현재 React 앱은 `src/components/LegacyAppHost.jsx`에서 기존 앱 모듈을 직접 마운트한다.
- 기존 앱 로직은 `src/legacy/legacyApp.js`로 분리되었다.
- 레거시 화면 문자열은 `src/legacy/views` 아래로 한 화면씩 분리한다. 현재 로그인 화면은 `loginView.js`로 분리되었다.
- 기존 앱 스타일은 `src/styles/legacy.css`로 분리되었다.
- 교재 범위, 미완료 페이지 파싱, 단원 매핑, 완료율 계산은 `src/lib/textbookProgress.js`에서 관리한다.
- 학생별/교재별/반별 평균 완료율 집계는 `src/lib/reportMetrics.js`에서 관리한다.
- 보고서 회차 생성 및 이력 처리는 `src/lib/reportRounds.js`에서 관리한다.
- 표준 소단원 명칭 매핑 및 ID 체계는 `src/lib/standardUnits.js`에서 관리한다.
- 대표 특이사항 코멘트 템플릿 관리는 `src/lib/remarkTemplates.js`에서 관리한다.
- 점검 기록 일괄 저장 및 자동 완성 타겟팅은 `src/lib/inspectionBatchSave.js`에서 관리한다.
- 관리자 학생 목록 수정 및 이력 데이터 초기화는 `src/lib/adminStudentMaintenance.js`에서 관리한다.
- Firebase 초기화, 인증, 컬렉션 이름, Firestore refs는 `src/services/firebaseService.js`에서 관리한다.
- Firebase SDK는 npm 패키지를 Vite가 번들링한다.
- 기존 앱은 Firestore 컬렉션을 실시간 구독하고, 상태 객체를 기준으로 화면 전체를 다시 렌더링한다.

## 주요 데이터 영역

현재 앱에서 확인된 주요 컬렉션은 다음과 같다.

- `openacademy_textbook_teachers`
- `openacademy_textbook_classes`
- `openacademy_textbook_students`
- `openacademy_textbook_books`
- `openacademy_textbook_class_books`
- `openacademy_textbook_inspections`

## 주요 화면

- 로그인: 강사 선택 및 PIN 로그인
- 전체 정보: 반별 진행 현황, 전체 완료율, 최근 점검 내역
- 반 세팅: 반, 학생, 교재, 단원 등록 및 연결
- 학생별 교재점검: 범위, 미완료 페이지, 완료율 저장
- 보고서 출력: 학생별 보고서, 반별 전체 진행표
- 관리자 설정: 강사와 권한 관리

## 현재 한계

- 기존 앱인 `src/legacy/legacyApp.js`에 UI 문자열, 상태, Firebase 접근, 보고서 계산 로직이 아직 모여 있다.
- React/Vite 실행 구조와 파일 분리는 준비되었지만, 실제 화면별 React 컴포넌트화는 아직 점진 전환 단계다.
- 정성 평가 5요소와 6각형 비교 시각화는 제품 방향에는 필요하지만 현재 구현은 부족하다.
- 일부 코드와 텍스트는 과거 인코딩 문제로 깨진 흔적이 있다.
- 신규 `src/lib`에는 Vitest 기반 테스트를 둘 수 있다.

## 권장 개선 순서

1. `src/legacy/legacyApp.js`에서 계산 로직을 `src/lib` 순수 함수로 먼저 이동한다.
2. 새 평가 필드를 기존 점검 기록에 하위 호환 방식으로 추가한다.
3. 학부모 보고서에 단원별 가로 막대그래프와 6요소 비교 차트를 추가한다.
4. 반별 보고서에 학생별 6요소 표와 요소별 평균을 추가한다.
5. 보고서 화면을 React 컴포넌트로 분리한다.
6. 점검 입력 화면, 대시보드, 관리자 화면 순서로 레거시 앱에서 React로 이관한다.

## 변경 시 주의점

- 기존 `completionRate`, `missedPages`, `rangeStart`, `rangeEnd` 필드는 보고서 계산에 이미 사용되므로 의미를 바꾸지 않는다.
- 새 점수 필드는 오래된 기록에서 값이 없을 수 있다. 평균 계산 시 누락값 처리 기준을 명확히 둔다.
- 보고서 HTML은 화면 표시뿐 아니라 `window.print()` 출력도 고려한다.
