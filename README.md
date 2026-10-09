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
| /admin | Supabase 예약 데이터를 조회하는 HR 대시보드 |

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

네 가지 기본 화면과 화면 이동이 구현되어 있습니다. 이름/전화번호/이메일과 선택한 날짜/시간은 서버에서 다시 검증한 뒤 Supabase `scheduler.interviews` 테이블에 저장합니다. 2026년 10월 12~16일 일정은 현재 UI에 고정되어 있으며, 동일한 날짜와 시간의 확정 예약은 데이터베이스에서 거절합니다. HR 화면은 Supabase Auth 관리자 세션을 검증한 뒤 Supabase 예약 데이터를 조회합니다.

초대 인증, 면접관별 가용 시간 계산, 이메일 발송과 예약 상태 변경 기능은 후속 구현 항목입니다.

## 다음 구현 순서

1. Supabase SQL 실행과 Vercel 환경 변수 등록
2. 초대 링크 인증 및 HR 로그인/권한 구현
3. 면접관별 가용 시간 조회 구현
4. 완료 알림과 관리자 예약 관리 기능 연결
5. 인증 및 동시 예약 E2E 검증

## Supabase 설정

예약은 `scheduler.interviews`에 저장되며 관리자는 Supabase Auth 이메일/비밀번호로 로그인합니다. `@supabase/ssr`의 쿠키 세션을 서버와 브라우저에서 공유하고 Next.js Proxy가 `/admin` 요청의 세션을 갱신합니다. 서버는 `auth.getUser()`로 유효한 사용자와 관리자 권한을 다시 검증합니다.

1. 신규 DB는 `supabase/schema.sql`, 이어서 `supabase/admin-auth-migration.sql`을 실행합니다. 이미 `scheduler.interviews`가 있으면 마이그레이션만 실행합니다. 실제 DB에 자동 실행되지 않습니다.
2. Supabase Data API 설정의 Exposed schemas에 `scheduler`를 추가합니다. 마이그레이션은 스키마 사용 권한, 예약 INSERT, 관리자 SELECT RLS 정책을 설정합니다. 기존 데이터는 삭제하지 않습니다.
3. Authentication > Users에서 관리자 이메일/비밀번호 계정을 생성하고 이메일 확인을 완료합니다. 관리자 외 회원가입이 필요하지 않으면 Authentication 설정에서 신규 회원가입을 끕니다.
4. 신뢰할 수 있는 SQL Editor에서 아래처럼 실제 관리자 이메일에 `app_metadata.role`을 지정합니다. 사용자가 수정할 수 있는 `user_metadata`는 권한 판단에 사용하지 않습니다.

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'your-admin@example.com';
```

`admin`과 `super_admin`을 지원합니다. 권한 변경 후 다시 로그인해 RLS에서 사용하는 JWT도 갱신합니다. 이전 `interviews` 행이나 비밀번호 해시는 관리자 계정으로 사용하지 않습니다. 마이그레이션은 기존 비밀번호 대조 RPC를 제거합니다.

5. `.env.example`을 참고해 `.env.local` 및 Vercel 환경 변수를 설정합니다.

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

`ADMIN_SESSION_SECRET`, `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`는 더 이상 사용하지 않습니다. 조회는 로그인한 관리자의 세션과 RLS로 수행합니다. 서비스 역할 키를 프런트엔드에 넣지 마세요.

6. `/admin/login`에서 이메일/비밀번호로 로그인합니다. 비로그인 및 일반 계정은 대시보드와 예약 조회에서 차단됩니다. 대시보드 상단 로그아웃은 현재 브라우저 세션을 종료하고 로그인 페이지로 이동합니다.

## 검증

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

실제 Supabase에서는 비로그인 접근, 일반 계정 접근, 관리자 로그인, 잘못된 비밀번호, 세션 갱신, 로그아웃 후 재접근, 예약 저장 및 관리자 목록 조회를 확인합니다.