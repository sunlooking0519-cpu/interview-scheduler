-- Supabase SQL Editor에서 전체 실행하세요. 기존 예약은 유지됩니다.
begin;
create table if not exists scheduler.interview_time_slots (
  interview_date date not null,
  interview_time text not null check (interview_time ~ '^((09|1[0-9]|20):(00|30)|21:00)$'),
  enabled boolean not null default false,
  primary key (interview_date, interview_time)
);

insert into scheduler.interview_time_slots (interview_date, interview_time, enabled)
select d::date, to_char(t, 'HH24:MI'),
  to_char(t, 'HH24:MI') in ('10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30')
from generate_series('2026-10-12'::timestamp, '2026-10-16'::timestamp, interval '1 day') d
cross join generate_series('2026-10-12 09:00'::timestamp, '2026-10-12 21:00'::timestamp, interval '30 minutes') t
on conflict do nothing;

alter table scheduler.interview_time_slots enable row level security;
revoke all on scheduler.interview_time_slots from anon, authenticated;
grant usage on schema scheduler to anon, authenticated;
grant select on scheduler.interview_time_slots to anon, authenticated;
grant insert, update on scheduler.interview_time_slots to authenticated;
drop policy if exists "Read time availability" on scheduler.interview_time_slots;
create policy "Read time availability" on scheduler.interview_time_slots for select to anon, authenticated using (true);
drop policy if exists "Admins manage time availability" on scheduler.interview_time_slots;
create policy "Admins manage time availability" on scheduler.interview_time_slots for all to authenticated
using ((select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'super_admin'))
with check ((select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'super_admin'));

create or replace function scheduler.get_interview_time_slots(p_date date)
returns table (interview_time text, enabled boolean, booked boolean)
language sql security definer set search_path = '' as $$
  select s.interview_time, s.enabled, exists (
    select 1 from scheduler.interviews i
    where i.interview_date::text = s.interview_date::text
      and i.interview_time = s.interview_time and i.status = 'confirmed'
  )
  from scheduler.interview_time_slots s where s.interview_date = p_date order by s.interview_time;
$$;
revoke all on function scheduler.get_interview_time_slots(date) from public;
grant execute on function scheduler.get_interview_time_slots(date) to anon, authenticated;

-- 동시 예약 요청을 직렬화하고 시간 설정 및 중복 예약을 DB에서 검증합니다.
create or replace function scheduler.validate_interview_time_slot()
returns trigger language plpgsql security definer set search_path = '' as $$
declare slot_open boolean;
begin
  if new.status <> 'confirmed' then return new; end if;
  if TG_OP = 'UPDATE' then
    if old.status = 'confirmed' and old.interview_date::text = new.interview_date::text
      and old.interview_time = new.interview_time then return new; end if;
  end if;
  select s.enabled into slot_open from scheduler.interview_time_slots s
  where s.interview_date::text = new.interview_date::text and s.interview_time = new.interview_time
  for update;
  if slot_open is distinct from true then raise exception 'Interview time slot is closed' using errcode = 'P0001'; end if;
  if exists (select 1 from scheduler.interviews i where i.status = 'confirmed'
    and i.interview_date::text = new.interview_date::text and i.interview_time = new.interview_time
    and i.id is distinct from new.id) then
    raise exception 'Interview time slot is already booked' using errcode = '23505';
  end if;
  return new;
end;
$$;
revoke all on function scheduler.validate_interview_time_slot() from public;
drop trigger if exists validate_interview_time_slot on scheduler.interviews;
create trigger validate_interview_time_slot before insert or update of interview_date, interview_time, status on scheduler.interviews
for each row execute function scheduler.validate_interview_time_slot();
create or replace function scheduler.update_candidate_reservation(
  p_name text, p_phone text, p_id bigint, p_date date, p_time text
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare updated_count integer;
begin
  if char_length(trim(p_name)) not between 1 and 60
    or p_phone !~ '^[0-9+() -]{8,20}$'
    or p_date not in ('2026-10-12'::date, '2026-10-13'::date, '2026-10-14'::date, '2026-10-15'::date, '2026-10-16'::date)
    or p_time !~ '^((09|1[0-9]|20):(00|30)|21:00)$'
    or p_name is null or p_phone is null or p_date is null or p_time is null then
    return false;
  end if;
  -- 실제 컬럼이 text 또는 date여도 컬럼 타입에 맞게 변환합니다.
  update scheduler.interviews i set
    interview_date = (jsonb_populate_record(null::scheduler.interviews,
      jsonb_build_object('interview_date', p_date::text))).interview_date,
    interview_time = p_time
  where i.id = p_id and i.status = 'confirmed' and i.name = trim(p_name)
    and regexp_replace(i.phone, '[^0-9+]', '', 'g') = regexp_replace(p_phone, '[^0-9+]', '', 'g');
  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;


revoke all on function scheduler.update_candidate_reservation(text, text, bigint, date, text) from public;
grant execute on function scheduler.update_candidate_reservation(text, text, bigint, date, text) to anon, authenticated;
commit;
