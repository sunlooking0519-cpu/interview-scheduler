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

네 가지 기본 화면과 화면 이동이 구현되어 있습니다. 지원자는 사용자 이름과 전화번호만 입력합니다. 두 값은 sessionStorage를 통해 일정 선택 단계로 전달되고, 예약 확정 시 선택한 날짜/시간과 함께 서버에서 검증한 뒤 Supabase `scheduler.interviews`에 저장합니다. 이메일은 수집하지 않습니다. 2026년 10월 12~16일 일정은 현재 UI에 고정되어 있으며, 동일한 날짜와 시간의 확정 예약은 데이터베이스에서 거절합니다. HR 화면은 Supabase Auth 관리자 세션을 검증한 뒤 Supabase 예약 데이터를 조회합니다.

초대 인증, 면접관별 가용 시간 계산, 이메일 발송과 예약 상태 변경 기능은 후속 구현 항목입니다.

## 다음 구현 순서

1. Supabase SQL 실행과 Vercel 환경 변수 등록
2. 초대 링크 인증 및 HR 로그인/권한 구현
3. 면접관별 가용 시간 조회 구현
4. 완료 알림과 관리자 예약 관리 기능 연결
5. 인증 및 동시 예약 E2E 검증

## Supabase 설정

기본 닫힘 정책 적용에는 `supabase/default-closed-times-migration.sql`을 한 번 실행합니다. 현재 열린 설정도 모두 닫히므로 실행 후 관리자가 받을 시간을 직접 다시 여세요. 기존 확정 예약은 유지됩니다. 이후 새 날짜/시간은 자동으로 열리지 않으며 관리자가 `enabled=true`로 연 슬롯만 예약할 수 있습니다. 조회 실패/설정 누락은 예약 불가로 처리하고 DB 트리거에서도 열린 시간을 검증합니다.

날짜 관리·예약 취소 기능에는 `supabase/dates-and-cancellation-migration.sql` 전체를 추가 실행합니다. 관리자에서 날짜를 추가하면 모든 시간이 닫힌 상태로 생성됩니다. 원하는 시간을 열면 지원자 달력에 예약 가능한 날짜로 표시됩니다. 날짜 마감은 전체 시간을 닫으며 기존 예약은 유지합니다. 지원자와 관리자는 확인 단계를 거쳐 확정 예약을 취소할 수 있습니다. 취소 내역은 삭제하지 않고 `cancelled`로 보존하며, 열린 슬롯은 다시 예약할 수 있습니다. 지난 시간의 새 예약/변경은 한국 표준시 기준으로 DB에서 차단합니다. 모바일 관리자 목록은 카드, PC에서는 표로 표시합니다.

예약 시간 관리 배포 시 `supabase/time-slots-migration.sql` 전체를 실행하세요. 날짜별 예약 가능 시간 테이블, 관리자 RLS, 공개 가용 시간 조회 함수 및 예약 검증 트리거를 설정합니다. 기존 예약은 유지되며 모든 신규 시간은 기본적으로 닫힌 상태입니다. `/admin`의 시간 관리에서 날짜별로 버튼을 눌러 즉시 열고 닫습니다. 지원자 예약/수정 화면에는 오전 9시~오후 9시의 모든 30분 슬롯이 고정 표시되며 닫혔거나 예약된 슬롯은 비활성입니다. 기존 자신의 예약 시간은 유지할 수 있습니다. 변경된 가용 시간은 날짜 선택 또는 페이지 새로고침 시 조회하며 저장 시 DB에서 다시 검증합니다. 운영 날짜는 현재 2026년 10월 12~16일입니다.

`지원서 확인·수정`은 입력한 이름·전화번호를 sessionStorage에 보관한 뒤 `/application`으로 이동합니다. `supabase/candidate-reservations-migration.sql`을 실행하면 해당 두 값과 일치하는 예약의 일정·상태를 조회하고 확정 예약의 날짜·시간을 변경할 수 있습니다. 전화번호의 공백/하이픈은 조회 시 무시합니다. 별도 지원서 테이블이 없으므로 현재는 면접 예약 내역만 제공합니다. 이름·전화번호 대조는 휴대전화 소유 확인이 아니므로 두 값을 아는 사람도 조회·수정할 수 있습니다. 본인 인증이 필요한 운영에서는 SMS 인증 등을 추가해야 합니다.

기존 DB는 지원자 이메일 입력 제거 배포 전에 `supabase/optional-candidate-email-migration.sql`을 실행하세요. 이메일 컬럼의 NOT NULL 및 기본값을 제거하며 기존 이메일 데이터는 보존합니다. 새 예약은 이메일을 생략하고, HR 목록은 이메일 없이 전화번호만 있는 예약도 표시합니다. 관리자 Auth 이메일 로그인은 계속 사용합니다.

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
