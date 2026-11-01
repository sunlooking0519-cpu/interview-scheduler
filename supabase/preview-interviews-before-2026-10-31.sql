-- 운영 프로젝트의 Supabase SQL Editor에서 먼저 실행해 삭제 범위를 확인하세요.
-- 기준: 예약일이 아니라 지원자 기록 생성일. 2026-10-31 00:00 KST 이후는 보존합니다.
select
  count(*) as deletion_target_count,
  count(*) filter (where to_jsonb(i)->>'hired_at' is not null) as hired_target_count,
  count(*) filter (where nullif(to_jsonb(i)->>'resume_url', '') is not null) as resume_target_count
from scheduler.interviews i
where i.created_at < timestamptz '2026-10-31 00:00:00+09';

-- 첨부 이력서 URL도 기록해 두세요. DB 삭제 후에는 Storage API 또는 대시보드에서
-- resumes 버킷의 해당 파일을 별도로 삭제해야 합니다.
select
  i.id,
  i.name,
  i.created_at at time zone 'Asia/Seoul' as created_at_kst,
  i.interview_date,
  i.status,
  to_jsonb(i)->>'hired_at' as hired_at,
  to_jsonb(i)->>'resume_url' as resume_url
from scheduler.interviews i
where i.created_at < timestamptz '2026-10-31 00:00:00+09'
order by i.created_at, i.id;
