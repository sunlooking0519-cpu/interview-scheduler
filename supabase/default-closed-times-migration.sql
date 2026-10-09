-- 한 번 실행하는 초기화입니다. 현재 열린 시간도 모두 닫습니다.
-- 이미 확정된 예약은 취소하거나 삭제하지 않습니다.
-- 이후 관리자가 명시적으로 연 시간만 신규 예약을 받을 수 있습니다.
begin;
alter table scheduler.interview_time_slots alter column enabled set default false;
update scheduler.interview_time_slots set enabled = false where enabled = true;
commit;
