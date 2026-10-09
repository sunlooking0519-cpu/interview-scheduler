-- 날짜 관리/예약 취소 배포 전에 Supabase SQL Editor에서 전체 실행하세요.
-- time-slots-migration.sql 실행 후 적용합니다. 기존 예약은 삭제하지 않습니다.
begin;

create or replace function scheduler.get_interview_dates()
returns table (interview_date text, enabled boolean)
language sql security definer set search_path = '' as $$
  select s.interview_date::text,
    bool_or(s.enabled and (s.interview_date + s.interview_time::time) > (now() at time zone 'Asia/Seoul'))
  from scheduler.interview_time_slots s group by s.interview_date order by s.interview_date;
$$;
revoke all on function scheduler.get_interview_dates() from public;
grant execute on function scheduler.get_interview_dates() to anon, authenticated;

create or replace function scheduler.get_interview_time_slots(p_date date)
returns table (interview_time text, enabled boolean, booked boolean)
language sql security definer set search_path = '' as $$
  select s.interview_time,
    s.enabled and (s.interview_date + s.interview_time::time) > (now() at time zone 'Asia/Seoul'),
    exists (select 1 from scheduler.interviews i where i.interview_date::text = s.interview_date::text
      and i.interview_time = s.interview_time and i.status = 'confirmed')
  from scheduler.interview_time_slots s where s.interview_date = p_date order by s.interview_time;
$$;
revoke all on function scheduler.get_interview_time_slots(date) from public;
grant execute on function scheduler.get_interview_time_slots(date) to anon, authenticated;

create or replace function scheduler.validate_interview_time_slot()
returns trigger language plpgsql security definer set search_path = '' as $$
declare slot_open boolean;
begin
  if new.status <> 'confirmed' then return new; end if;
  if TG_OP = 'UPDATE' then
    if old.status = 'confirmed' and old.interview_date::text = new.interview_date::text
      and old.interview_time = new.interview_time then return new; end if;
  end if;
  if (new.interview_date::text::date + new.interview_time::time) <= (now() at time zone 'Asia/Seoul') then
    raise exception 'Interview time slot has passed' using errcode = 'P0001';
  end if;
  select s.enabled into slot_open from scheduler.interview_time_slots s
  where s.interview_date::text = new.interview_date::text and s.interview_time = new.interview_time for update;
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

create or replace function scheduler.update_candidate_reservation(p_name text, p_phone text, p_id bigint, p_date date, p_time text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare updated_count integer;
begin
  if p_name is null or p_phone is null or p_date is null or p_time is null
    or char_length(trim(p_name)) not between 1 and 60 or p_phone !~ '^[0-9+() -]{8,20}$'
    or p_time !~ '^((09|1[0-9]|20):(00|30)|21:00)$' then return false; end if;
  update scheduler.interviews i set
    interview_date = (jsonb_populate_record(null::scheduler.interviews, jsonb_build_object('interview_date', p_date::text))).interview_date,
    interview_time = p_time
  where i.id = p_id and i.status = 'confirmed' and i.name = trim(p_name)
    and regexp_replace(i.phone, '[^0-9+]', '', 'g') = regexp_replace(p_phone, '[^0-9+]', '', 'g');
  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;
revoke all on function scheduler.update_candidate_reservation(text, text, bigint, date, text) from public;
grant execute on function scheduler.update_candidate_reservation(text, text, bigint, date, text) to anon, authenticated;

create or replace function scheduler.cancel_candidate_reservation(p_name text, p_phone text, p_id bigint)
returns boolean language plpgsql security definer set search_path = '' as $$
declare updated_count integer;
begin
  if p_name is null or p_phone is null or char_length(trim(p_name)) not between 1 and 60
    or p_phone !~ '^[0-9+() -]{8,20}$' then return false; end if;
  update scheduler.interviews i set status = 'cancelled'
  where i.id = p_id and i.status = 'confirmed' and i.name = trim(p_name)
    and regexp_replace(i.phone, '[^0-9+]', '', 'g') = regexp_replace(p_phone, '[^0-9+]', '', 'g');
  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;
revoke all on function scheduler.cancel_candidate_reservation(text, text, bigint) from public;
grant execute on function scheduler.cancel_candidate_reservation(text, text, bigint) to anon, authenticated;

create or replace function scheduler.cancel_admin_reservation(p_id bigint)
returns boolean language plpgsql security definer set search_path = '' as $$
declare updated_count integer;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') not in ('admin', 'super_admin') then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  update scheduler.interviews set status = 'cancelled' where id = p_id and status = 'confirmed';
  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;
revoke all on function scheduler.cancel_admin_reservation(bigint) from public;
grant execute on function scheduler.cancel_admin_reservation(bigint) to authenticated;
commit;
