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

네 가지 기본 화면과 화면 이동이 구현되어 있습니다. 이름/전화번호/이메일과 선택한 날짜/시간은 서버에서 다시 검증한 뒤 Supabase `interviews` 테이블에 저장합니다. 2026년 10월 12~16일 일정은 현재 UI에 고정되어 있으며, 동일한 날짜와 시간의 확정 예약은 데이터베이스에서 거절합니다. HR 화면은 아직 가상 데이터입니다.

초대 인증, 면접관별 가용 시간 계산, 이메일 발송, 관리자 인증·실데이터 조회는 후속 구현 항목입니다.

## 다음 구현 순서

1. Supabase SQL 실행과 Vercel 환경 변수 등록
2. 초대 링크 인증 및 HR 로그인/권한 구현
3. 면접관별 가용 시간 조회 구현
4. 완료 알림과 관리자 예약 관리 기능 연결
5. 인증 및 동시 예약 E2E 검증

## Supabase 설정

1. Supabase Dashboard의 SQL Editor에서 `supabase/schema.sql`을 실행합니다.
2. `.env.example`을 참고해 프로젝트 루트에 `.env.local`을 만들고 실제 값을 입력합니다.

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

3. Vercel 프로젝트의 Settings > Environment Variables에도 같은 두 값을 추가한 뒤 다시 배포합니다.

공개 예약 폼은 RLS 정책에 따라 `interviews` 테이블에 확정 예약을 추가할 수만 있습니다. 조회·수정·삭제 권한은 열려 있지 않으며, 동일한 날짜와 시간의 확정 예약은 데이터베이스 고유 인덱스로 거절됩니다.