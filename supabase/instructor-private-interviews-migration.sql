-- 기존 instructor-hiring-migration.sql 적용 후 운영 SQL Editor에서 실행하세요.
-- 기존 예약과 시간표는 최고관리자의 기본 예약 링크에 남습니다.
-- 기존 채용 건도 최고관리자의 기본 예약으로 유지합니다. 채용 처리자와 면접 담당자는 별개입니다.
begin;
create schema if not exists scheduler_private;
grant usage on schema scheduler_private to authenticated;

alter table scheduler.interviews
  add column if not exists owner_id uuid references auth.users(id) on delete set null;
create index if not exists interviews_owner_date_idx
  on scheduler.interviews (owner_id, interview_date, interview_time);
drop index if exists scheduler.interviews_confirmed_slot_key;
create unique index if not exists interviews_confirmed_owner_slot_key
  on scheduler.interviews (owner_id, interview_date, interview_time) nulls not distinct
  where status = 'confirmed';
grant insert (owner_id) on scheduler.interviews to anon, authenticated;

-- 0000...은 최고관리자의 기본 예약 링크를 나타냅니다.
alter table scheduler.interview_time_slots
  add column if not exists owner_id uuid not null default '00000000-0000-0000-0000-000000000000';
alter table scheduler.interview_time_slots drop constraint if exists interview_time_slots_pkey;
alter table scheduler.interview_time_slots
  add constraint interview_time_slots_pkey primary key (owner_id, interview_date, interview_time);

create or replace function scheduler_private.can_access_interview_owner(p_owner uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users u where u.id = (select auth.uid())
    and (u.raw_app_meta_data ->> 'role' in ('admin', 'super_admin')
      or (u.raw_app_meta_data ->> 'role' = 'instructor' and p_owner = u.id)));
$$;
revoke all on function scheduler_private.can_access_interview_owner(uuid) from public, anon;
grant execute on function scheduler_private.can_access_interview_owner(uuid) to authenticated;

create or replace function scheduler_private.is_active_interviewer(p_owner uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users u where u.id = p_owner
    and u.raw_app_meta_data ->> 'role' = 'instructor');
$$;
revoke all on function scheduler_private.is_active_interviewer(uuid) from public, anon, authenticated;

drop policy if exists "Auth admins can read interviews" on scheduler.interviews;
drop policy if exists "Only auth admins can read interviews" on scheduler.interviews;
drop policy if exists "Interview staff can read interviews" on scheduler.interviews;
drop policy if exists "Only interview staff can read interviews" on scheduler.interviews;
drop policy if exists "Interview owner can read interviews" on scheduler.interviews;
drop policy if exists "Only interview owner can read interviews" on scheduler.interviews;
create policy "Interview owner can read interviews" on scheduler.interviews
  for select to authenticated using (scheduler_private.can_access_interview_owner(owner_id));
create policy "Only interview owner can read interviews" on scheduler.interviews
  as restrictive for select to authenticated
  using (scheduler_private.can_access_interview_owner(owner_id));

drop policy if exists "Read time availability" on scheduler.interview_time_slots;
drop policy if exists "Admins manage time availability" on scheduler.interview_time_slots;
drop policy if exists "Interview staff manage time availability" on scheduler.interview_time_slots;
drop policy if exists "Interview owner manages time availability" on scheduler.interview_time_slots;
revoke select on scheduler.interview_time_slots from anon;
create policy "Interview owner manages time availability" on scheduler.interview_time_slots
  for all to authenticated
  using (scheduler_private.can_access_interview_owner(nullif(owner_id, '00000000-0000-0000-0000-000000000000')))
  with check (scheduler_private.can_access_interview_owner(nullif(owner_id, '00000000-0000-0000-0000-000000000000')));

-- 공개 예약 화면은 기본 링크 또는 현재 활성 중간관리자 링크의 시간만 조회합니다.
create or replace function scheduler.get_interview_dates()
returns table (interview_date text, enabled boolean)
language sql security definer set search_path = '' as $$
  select s.interview_date::text,
    bool_or(s.enabled and (s.interview_date + s.interview_time::time) > (now() at time zone 'Asia/Seoul'))
  from scheduler.interview_time_slots s
  where s.owner_id = '00000000-0000-0000-0000-000000000000'
  group by s.interview_date order by s.interview_date;
$$;
create or replace function scheduler.get_interview_dates_for_owner(p_owner uuid)
returns table (interview_date text, enabled boolean)
language sql security definer set search_path = '' as $$
  select s.interview_date::text,
    bool_or(s.enabled and (s.interview_date + s.interview_time::time) > (now() at time zone 'Asia/Seoul'))
  from scheduler.interview_time_slots s
  where s.owner_id = p_owner and scheduler_private.is_active_interviewer(p_owner)
  group by s.interview_date order by s.interview_date;
$$;
revoke all on function scheduler.get_interview_dates_for_owner(uuid) from public;
grant execute on function scheduler.get_interview_dates_for_owner(uuid) to anon, authenticated;

create or replace function scheduler.get_interview_time_slots(p_date date)
returns table (interview_time text, enabled boolean, booked boolean)
language sql security definer set search_path = '' as $$
  select s.interview_time,
    s.enabled and (s.interview_date + s.interview_time::time) > (now() at time zone 'Asia/Seoul'),
    exists (select 1 from scheduler.interviews i where i.owner_id is null
      and i.interview_date::text = s.interview_date::text
      and i.interview_time = s.interview_time and i.status = 'confirmed')
  from scheduler.interview_time_slots s
  where s.owner_id = '00000000-0000-0000-0000-000000000000' and s.interview_date = p_date
  order by s.interview_time;
$$;
create or replace function scheduler.get_interview_time_slots_for_owner(p_date date, p_owner uuid)
returns table (interview_time text, enabled boolean, booked boolean)
language sql security definer set search_path = '' as $$
  select s.interview_time,
    s.enabled and (s.interview_date + s.interview_time::time) > (now() at time zone 'Asia/Seoul'),
    exists (select 1 from scheduler.interviews i where i.owner_id = p_owner
      and i.interview_date::text = s.interview_date::text
      and i.interview_time = s.interview_time and i.status = 'confirmed')
  from scheduler.interview_time_slots s
  where s.owner_id = p_owner and s.interview_date = p_date
    and scheduler_private.is_active_interviewer(p_owner)
  order by s.interview_time;
$$;
revoke all on function scheduler.get_interview_time_slots_for_owner(date, uuid) from public;
grant execute on function scheduler.get_interview_time_slots_for_owner(date, uuid) to anon, authenticated;

create or replace function scheduler.validate_interview_time_slot()
returns trigger language plpgsql security definer set search_path = '' as $$
declare slot_open boolean;
begin
  if new.status <> 'confirmed' then return new; end if;
  if new.owner_id is not null and not scheduler_private.is_active_interviewer(new.owner_id) then
    raise exception 'Interviewer is unavailable' using errcode = 'P0001';
  end if;
  if TG_OP = 'UPDATE' and old.status = 'confirmed'
    and old.interview_date::text = new.interview_date::text
    and old.interview_time = new.interview_time and old.owner_id is not distinct from new.owner_id then
    return new;
  end if;
  if (new.interview_date::text::date + new.interview_time::time) <= (now() at time zone 'Asia/Seoul') then
    raise exception 'Interview time slot has passed' using errcode = 'P0001';
  end if;
  select s.enabled into slot_open from scheduler.interview_time_slots s
  where s.owner_id = coalesce(new.owner_id, '00000000-0000-0000-0000-000000000000')
    and s.interview_date::text = new.interview_date::text and s.interview_time = new.interview_time
  for update;
  if slot_open is distinct from true then
    raise exception 'Interview time slot is closed' using errcode = 'P0001';
  end if;
  if exists (select 1 from scheduler.interviews i where i.status = 'confirmed'
    and i.owner_id is not distinct from new.owner_id
    and i.interview_date::text = new.interview_date::text and i.interview_time = new.interview_time
    and i.id is distinct from new.id) then
    raise exception 'Interview time slot is already booked' using errcode = '23505';
  end if;
  return new;
end;
$$;

-- RPC는 SECURITY DEFINER이므로 RLS와 별도로 소유자를 다시 검사합니다.
create or replace function scheduler.hire_admin_reservation(p_id bigint)
returns boolean language plpgsql security definer set search_path = '' as $$
declare updated_count integer;
begin
  update scheduler.interviews i set hired_at = now(), hired_by = auth.uid()
  where i.id = p_id and i.status = 'confirmed' and i.hired_at is null
    and scheduler_private.can_access_interview_owner(i.owner_id);
  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;
create or replace function scheduler.unhire_admin_reservation(p_id bigint)
returns boolean language plpgsql security definer set search_path = '' as $$
declare updated_count integer;
begin
  update scheduler.interviews i set hired_at = null, hired_by = null
  where i.id = p_id and i.status = 'confirmed' and i.hired_at is not null
    and scheduler_private.can_access_interview_owner(i.owner_id);
  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;
create or replace function scheduler.cancel_admin_reservation(p_id bigint)
returns boolean language plpgsql security definer set search_path = '' as $$
declare updated_count integer;
begin
  update scheduler.interviews i set status = 'cancelled'
  where i.id = p_id and i.status = 'confirmed' and i.hired_at is null
    and scheduler_private.can_access_interview_owner(i.owner_id);
  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;

create or replace function scheduler.find_candidate_reservations_with_owner(p_name text, p_phone text)
returns table (id text, interview_date text, interview_time text, status text, owner_id text)
language sql security definer set search_path = '' as $$
  select i.id::text, i.interview_date::text, i.interview_time::text,
    case when i.hired_at is not null then 'hired' else i.status end,
    i.owner_id::text
  from scheduler.interviews i
  where i.name = trim(p_name)
    and regexp_replace(i.phone, '[^0-9+]', '', 'g') = regexp_replace(p_phone, '[^0-9+]', '', 'g')
    and char_length(trim(p_name)) between 1 and 60
    and p_phone ~ '^[0-9+() -]{8,20}$'
  order by i.interview_date, i.interview_time;
$$;
revoke all on function scheduler.find_candidate_reservations_with_owner(text, text) from public;
grant execute on function scheduler.find_candidate_reservations_with_owner(text, text) to anon, authenticated;

-- Google 연결은 현재 최고관리자 1명만 지원하므로 개인 면접 예약은 그 캘린더로 보내지 않습니다.
create or replace function scheduler.queue_google_calendar_reservation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_id is null then
    insert into scheduler.google_calendar_jobs (reservation_id) values (new.id)
    on conflict (reservation_id) do update set version = scheduler.google_calendar_jobs.version + 1,
      last_error = null, updated_at = now();
  else
    delete from scheduler.google_calendar_jobs where reservation_id = new.id;
  end if;
  return new;
end;
$$;

create or replace function scheduler.enqueue_existing_google_reservations()
returns void language sql security definer set search_path = '' as $$
  insert into scheduler.google_calendar_jobs (reservation_id)
    select id from scheduler.interviews where owner_id is null
  on conflict (reservation_id) do update set version = scheduler.google_calendar_jobs.version + 1,
    last_error = null, updated_at = now();
$$;
delete from scheduler.google_calendar_jobs j using scheduler.interviews i
where j.reservation_id = i.id and i.owner_id is not null;

commit;
