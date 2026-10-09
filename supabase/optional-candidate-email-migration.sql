-- 기존 이메일 데이터는 보존하고 새 예약에서는 이메일을 생략할 수 있게 합니다.
-- Supabase SQL Editor에서 배포 전에 실행하세요.
begin;
alter table scheduler.interviews alter column email drop not null;
-- 생략된 이메일이 NULL로 저장되도록 기존 기본값도 제거합니다.
alter table scheduler.interviews alter column email drop default;
commit;
