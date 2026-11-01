-- preview-interviews-before-2026-10-31.sql 결과를 확인한 뒤 운영 SQL Editor에서 실행하세요.
-- 생성일이 2026-10-31 00:00 KST보다 빠른 지원자 예약만 삭제합니다.
-- Google 캘린더에 이미 생성된 면접 이벤트와 Storage 이력서 파일은 이 SQL로
-- 삭제되지 않습니다. 미리보기 결과의 이력서 URL을 보관해 별도로 정리하세요.
begin;

create temporary table old_interview_ids on commit drop as
select id from scheduler.interviews
where created_at < timestamptz '2026-10-31 00:00:00+09';

-- Google 동기화 대기열이 설치된 환경이라면, 삭제된 예약의 대기 작업도 정리합니다.
do $$
begin
  if to_regclass('scheduler.google_calendar_jobs') is not null then
    execute 'delete from scheduler.google_calendar_jobs where reservation_id in (select id from pg_temp.old_interview_ids)';
  end if;
end;
$$;

with deleted as (
  delete from scheduler.interviews
  where id in (select id from old_interview_ids)
  returning id
)
select count(*) as deleted_interview_count from deleted;

select count(*) as remaining_before_cutoff
from scheduler.interviews
where created_at < timestamptz '2026-10-31 00:00:00+09';

commit;
