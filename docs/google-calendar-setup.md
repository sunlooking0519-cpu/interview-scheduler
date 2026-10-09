# Google 캘린더 설정

관리자의 기본 Google 캘린더(`primary`)를 연결합니다. 기존 Google 일정과 Supabase 예약을 관리자 월간 달력에서 함께 조회하고, 앱에서 예약을 생성·변경·취소하면 Google 면접 이벤트가 자동 갱신됩니다. Google에서 직접 바꾼 면접 이벤트를 Supabase로 가져오는 역방향 동기화는 지원하지 않습니다. 예약 관리와 취소는 앱에서 진행하세요. 다른 보조 캘린더는 현재 조회하지 않습니다.

## 1. Supabase SQL

SQL Editor에서 `supabase/google-calendar-migration.sql` 전체를 실행하세요. 연결 정보와 재시도 큐를 서버 전용 테이블에 저장하고, 예약 변경 시 큐를 기록합니다. 기존 예약은 Google 연결 시 큐에 추가됩니다.

관리자에 “예약 날짜를 불러오지 못했습니다”가 표시된다면 `supabase/dates-and-cancellation-migration.sql`도 적용했는지 확인하세요. 아래 진단 쿼리는 조회 함수 설치 여부를 확인합니다.

```sql
select to_regprocedure('scheduler.get_interview_dates()');
select * from scheduler.get_interview_dates();
```

첫 결과가 NULL이면 날짜 관리 마이그레이션 전체를 실행하세요. 함수가 있는데도 오류가 나면 Supabase Data API의 Exposed schemas에 `scheduler`가 있는지 확인하세요.

## 2. Google Cloud

1. Google Cloud 프로젝트에서 **Google Calendar API**를 활성화합니다.
2. Google Auth Platform에서 동의 화면을 설정하고, 테스트 상태라면 실제 연결할 Google 계정을 테스트 사용자로 추가합니다.
3. OAuth Client의 유형을 **Web application**으로 생성합니다.
4. Authorized redirect URIs에 아래 주소를 정확히 등록합니다.

   `https://interview-scheduler26.vercel.app/admin/google/callback`

   로컬 테스트에는 `http://localhost:3000/admin/google/callback`을 추가합니다.
5. 권한은 `https://www.googleapis.com/auth/calendar.events`를 사용합니다. 연결 화면에서 이벤트 조회·수정 권한에 동의해야 합니다.

Google OAuth의 외부 앱 Testing 상태에서는 이 권한의 refresh token이 7일 후 만료될 수 있습니다. 계속 운영할 때는 Google의 게시 상태/검증 요구사항을 확인하세요. 만료되면 관리자에서 “Google 다시 연결”을 누릅니다.

공식 안내: [OAuth 웹 서버](https://developers.google.com/identity/protocols/oauth2/web-server), [토큰 만료 조건](https://developers.google.com/identity/protocols/oauth2).

## 3. Vercel 환경 변수

`.env.example`의 서버 전용 값을 Vercel 프로젝트 Environment Variables에 추가합니다.

| 변수 | 설정 |
| --- | --- |
| APP_URL | `https://interview-scheduler26.vercel.app` |
| GOOGLE_CLIENT_ID | Google OAuth Client ID |
| GOOGLE_CLIENT_SECRET | Google OAuth Client Secret |
| SUPABASE_SECRET_KEY | Supabase 서버 secret key 또는 기존 service_role key |
| CALENDAR_TOKEN_KEY | 암호화용 무작위 64자리 hex |
| CALENDAR_SYNC_SECRET | POST 동기화 호출용 무작위 32자 이상 비밀값 |
| CRON_SECRET | Vercel Cron 호출용 무작위 32자 이상 비밀값 |

각 비밀값은 다음 명령으로 따로 생성합니다. `CALENDAR_TOKEN_KEY`는 저장된 토큰 복호화에 필요하므로 유지하세요. 변경하면 Google을 다시 연결해야 합니다.

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

이 변수들에는 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다. 환경 변수를 저장한 뒤 재배포합니다. 관리자 로그인 후 “Google 캘린더 연결”을 눌러 본인의 Google 계정으로 동의합니다. 한 사이트에서 한 관리자 계정의 캘린더를 연결합니다. 기존 Google 일정의 상세 내용은 연결한 관리자에게만 표시됩니다.

## 4. 동기화와 재시도

예약 성공 후 서버가 응답 이후 동기화를 실행합니다. Google 오류가 발생해도 예약은 유지되고 큐에 남습니다. 한 실행에서 최대 20건을 처리하며 처리 시간에 따라 남은 작업은 다음 실행으로 이어집니다. 실행 중인 작업은 2분간 임대하므로 실패 직후 재시도하면 잠시 기다려야 할 수 있습니다.

`vercel.json`은 하루 한 번 남은 큐를 재시도하는 Cron을 등록합니다. `CRON_SECRET` 설정이 필요합니다. Hobby는 하루 한 번 실행을 지원하므로, 더 빠른 장애 복구를 원하면 지원되는 요금제의 Cron 빈도를 조정하거나 외부 스케줄러에서 아래 요청을 몇 분마다 보내도록 설정하세요.

```http
POST https://interview-scheduler26.vercel.app/api/calendar/sync
Authorization: Bearer <CALENDAR_SYNC_SECRET>
```

DB 직접 변경도 큐에 기록되지만 앱의 즉시 실행 요청은 발생하지 않습니다. 이런 작업도 정기 재시도 또는 관리자 “동기화 재시도”로 반영합니다. [Vercel Cron 제한](https://vercel.com/docs/cron-jobs/usage-and-pricing).

Google 연결 해제 시 이미 만들어진 이벤트는 유지됩니다. Google 기존 일정은 참고로 표시되며 예약 시간을 자동으로 열거나 닫지 않습니다. 앱에서 직접 연 시간만 예약 가능합니다.

## 5. 실제 계정 검증

1. 연결 후 기존 Google 일정과 기존 지원자 예약이 관리자 달력에 표시되는지 확인합니다.
2. 열린 미래 시간에 테스트 예약을 만들고 Google에 30분짜리 면접 일정이 하나 생기는지 확인합니다.
3. 앱에서 예약 시간을 변경해 같은 Google 이벤트가 이동하는지 확인합니다.
4. 지원자 또는 관리자에서 취소해 Google 면접 이벤트가 삭제되고 앱에 취소 이력이 남는지 확인합니다.
5. Google 연결이 끊겼을 때 예약 저장은 유지되는지, 재연결 후 대기 큐가 처리되는지 확인합니다.

자동 테스트는 API 모의 응답과 암호화 검증을 수행합니다. 실제 OAuth/배포 검증에는 위 설정과 관리자 계정 동의가 필요합니다.
