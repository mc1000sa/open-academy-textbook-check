---
name: feedback_deployment
description: "배포 방식 선호도 — 직접 배포 명령(firebase deploy) 선호, GitHub Actions 불필요"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 9eb8b9ea-7c0f-421c-b169-94c184519ec5
---

git 커밋/푸시는 코드 관리용으로 별도 진행하고, 배포는 `firebase deploy` 또는 `npm run deploy`로 직접 실행할 것.

**Why:** 사용자는 빠른 단독 배포를 선호. GitHub Actions는 대기 시간이 있고 결과를 따로 확인해야 함. 커밋을 이미 한 상태에서 Actions로 배포하는 건 중복 작업.

**How to apply:** 배포 요청 시 항상 `firebase deploy` 직접 실행. git push는 코드 관리 목적으로만 사용.
