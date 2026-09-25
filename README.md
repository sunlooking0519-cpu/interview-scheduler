# Interview Scheduler

Next.js App Router, TypeScript, Tailwind CSS 기반 지원자 면접 자가 예약 앱의 초기 구조입니다.

## 실행

Node.js 22 이상과 pnpm을 준비한 뒤 실행합니다.

```sh
pnpm install
pnpm dev
```

브라우저에서 http://localhost:3000 을 엽니다.

```sh
pnpm lint
pnpm typecheck
pnpm build
```

## 화면

| 경로 | 역할 |
| --- | --- |
| /login | 지원자 로그인 입력 양식 |
| /booking | 예시 캘린더와 시간 선택 |
| /booking/complete | 선택 결과 표시 |
| /admin | 가상 데이터로 구성한 HR 대시보드 |

## 디렉토리 책임

- `src/app`: 라우팅, 페이지, 레이아웃, 향후 API
- `src/components`: 공통 UI와 레이아웃
- `src/features`: auth, booking, admin별 화면 및 기능
- `src/server`: 향후 인증, DB, 업무 로직
- `src/lib`: 공용 날짜 처리와 유틸리티
- `public/images`, `public/icons`: 정적 에셋
- `tests/e2e`: 전체 예약 흐름의 검증 영역

`(candidate)`는 URL에 포함되지 않는 지원자 라우트 그룹입니다. Tailwind CSS 4는 `globals.css`와 `postcss.config.mjs`에서 설정합니다.

## 현재 구현 범위

네 가지 기본 화면과 화면 이동이 구현되어 있습니다. 이름/전화번호/이메일은 저장하거나 인증에 사용하지 않으며, 예약 결과는 URL의 예시 날짜/시간으로만 표시합니다. 2026년 10월 12~16일 고정 일정은 UI 시연용입니다. HR 화면은 공개된 가상 데이터입니다.

실제 인증, 영구 저장, 면접관 가용 시간 계산, 중복 예약 방지, 이메일 발송 및 관리자 권한은 미구현입니다. 실제 사용자 정보를 연결하기 전에 서버 인증과 권한 검증을 구현해야 합니다.

## 다음 구현 순서

1. 지원자·면접관·시간 슬롯·예약 DB 모델 정의
2. 초대 링크 인증 및 HR 로그인/권한 구현
3. 가용 시간 API와 원자적 예약 처리 구현
4. 완료 알림과 관리자 예약 관리 기능 연결
5. 인증 및 동시 예약 E2E 검증
