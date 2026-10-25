# 영업관리 설정과 확인

1. Supabase SQL Editor에서 [`supabase/sales-management-migration.sql`](../supabase/sales-management-migration.sql)을 **한 번** 전체 실행합니다. 이어서 `supabase/migrations`의 `sales_workflow.sql` 마이그레이션을 실행해 후속 조치와 활동 이력 필드를 추가합니다. `scheduler` 스키마가 Supabase Data API의 Exposed schemas에 포함되어 있어야 합니다.
2. Storage에 비공개 `sales-cards` 버킷이 생성되었는지 확인합니다. SQL이 버킷과 관리자 전용 업로드·조회 정책을 만듭니다. 공개 버킷으로 바꾸지 마세요.
3. 기존 `app_metadata.role=admin` 계정으로 로그인한 뒤 `/admin/sales`에서 명함을 등록합니다. 기관 상세에서 첫 활동을 기록하고 다음 행동·기한을 지정한 뒤, 대시보드의 `오늘 후속` 또는 `기한 지남`에 반영되는지 확인합니다.
4. 명함 OCR은 관리자의 **브라우저에서** Tesseract.js로 처리합니다. 최초 인식 시 한국어/영어 언어 파일을 다운로드하므로 네트워크가 필요합니다. 인식 결과가 틀릴 수 있어 저장 전에 수정할 수 있습니다. 업로드된 원본 명함은 비공개 Storage에, 추출·수정한 텍스트는 `scheduler.sales_business_cards`에 저장됩니다.
5. 기존 Google 캘린더 연결을 유지하면 미팅 추가·시간 수정·취소가 기존 캘린더 동기화 큐를 통해 반영됩니다. 연결되지 않았다면 앱 DB에만 저장되며, 연결 후 `/admin/sales`의 **Google 미팅 동기화 재시도**를 사용하세요. Vercel Cron 또는 기존 동기화 API 설정은 [Google 캘린더 안내](google-calendar-setup.md)를 따릅니다.

검증용 SQL:

```sql
select id, name, kind, stage from scheduler.sales_organizations order by created_at desc limit 10;
select id, name, stage, next_action, next_action_at from scheduler.sales_organizations order by next_action_at nulls last limit 10;
select organization_id, activity_type, reaction, summary, occurred_at from scheduler.sales_activities order by occurred_at desc limit 10;
select id, organization_id, title, status, starts_at, ends_at from scheduler.sales_meetings order by created_at desc limit 10;
select proposal_id, revision_number, title from scheduler.sales_proposal_versions order by created_at desc limit 10;
select meeting_id, last_error from scheduler.sales_calendar_jobs order by updated_at desc limit 10;
```

관리자가 아닌 계정은 `/admin/sales`와 명함 파일에 접근할 수 없어야 합니다. Google 동기화가 일시적으로 실패하면 미팅은 DB에 남고 큐에서 재시도됩니다.
