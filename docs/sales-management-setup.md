# 영업관리 설정과 확인

1. Supabase SQL Editor에서 [`supabase/sales-management-migration.sql`](../supabase/sales-management-migration.sql)을 **한 번** 전체 실행합니다. 이어서 `supabase/migrations`의 `sales_workflow.sql`과 `sales_follow_up_queue.sql` 마이그레이션을 시간순으로 실행해 활동 이력, 후속 차수와 2차 연락 작업 큐를 추가합니다. `scheduler` 스키마가 Supabase Data API의 Exposed schemas에 포함되어 있어야 합니다.
2. Storage에 비공개 `sales-cards` 버킷이 생성되었는지 확인합니다. SQL이 버킷과 관리자 전용 업로드·조회 정책을 만듭니다. 공개 버킷으로 바꾸지 마세요.
3. 기존 `app_metadata.role=admin` 계정으로 로그인한 뒤 `/admin/sales`에서 명함을 등록합니다. 기관 상세에서 활동 유형 `메일`, 후속 차수 `1차`를 선택하고 2차 연락 방식·담당자·기한을 저장합니다. 해당 기관이 기본 화면의 `1차 메일 완료 · 2차 필요` 목록에 나타나는지 확인합니다. 목록의 전화·이메일 링크로 연락한 뒤 `결과 기록`에서 `2차 후속`으로 저장하면 목록에서 빠져야 합니다.
4. 명함 OCR은 관리자의 **브라우저에서** Tesseract.js로 처리합니다. 최초 인식 시 한국어/영어 언어 파일을 다운로드하므로 네트워크가 필요합니다. 인식 결과가 틀릴 수 있어 저장 전에 수정할 수 있습니다. 업로드된 원본 명함은 비공개 Storage에, 추출·수정한 텍스트는 `scheduler.sales_business_cards`에 저장됩니다.
5. 기존 Google 캘린더 연결을 유지하면 미팅 추가·시간 수정·취소가 기존 캘린더 동기화 큐를 통해 반영됩니다. 연결되지 않았다면 앱 DB에만 저장되며, 연결 후 `/admin/sales`의 **Google 미팅 동기화 재시도**를 사용하세요. Vercel Cron 또는 기존 동기화 API 설정은 [Google 캘린더 안내](google-calendar-setup.md)를 따릅니다.

검증용 SQL:

```sql
select id, name, kind, stage from scheduler.sales_organizations order by created_at desc limit 10;
select id, name, stage, next_action, next_action_at from scheduler.sales_organizations order by next_action_at nulls last limit 10;
select organization_id, activity_type, reaction, summary, occurred_at from scheduler.sales_activities order by occurred_at desc limit 10;
select id, name, last_follow_up_round, follow_up_status, next_action_type, next_action_at from scheduler.sales_organizations where last_follow_up_round = 1 order by next_action_at nulls last;
select organization_id, activity_type, follow_up_round, reaction, occurred_at from scheduler.sales_activities where follow_up_round is not null order by occurred_at desc limit 20;
select id, organization_id, title, status, starts_at, ends_at from scheduler.sales_meetings order by created_at desc limit 10;
select proposal_id, revision_number, title from scheduler.sales_proposal_versions order by created_at desc limit 10;
select meeting_id, last_error from scheduler.sales_calendar_jobs order by updated_at desc limit 10;
```

관리자가 아닌 계정은 `/admin/sales`와 명함 파일에 접근할 수 없어야 합니다. Google 동기화가 일시적으로 실패하면 미팅은 DB에 남고 큐에서 재시도됩니다.
