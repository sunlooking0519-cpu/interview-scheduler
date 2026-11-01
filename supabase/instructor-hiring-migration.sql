-- Supabase SQL Editor에서 실행하세요. 기존 예약과 관리자 계정은 유지합니다.
begin;

alter table scheduler.interviews
  add column if not exists hired_at timestamptz,
  add column if not exists hired_by uuid references auth.users(id) on delete set null;

create index if not exists interviews_hired_at_idx on scheduler.interviews (hired_at desc)
  where hired_at is not null;
create index if not exists interviews_hired_by_idx on scheduler.interviews (hired_by)
  where hired_by is not null;

-- 현재 Auth 사용자 역할을 조회하므로 권한 해제가 기존 JWT 만료를 기다리지 않습니다.
create or replace function scheduler.is_interview_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    where u.id = (select auth.uid())
      and u.raw_app_meta_data ->> 'role' in ('admin', 'super_admin', 'instructor')
  );
$$;
revoke all on function scheduler.is_interview_staff() from public, anon;
grant execute on function scheduler.is_interview_staff() to authenticated;

drop policy if exists "Auth admins can read interviews" on scheduler.interviews;
drop policy if exists "Only auth admins can read interviews" on scheduler.interviews;
drop policy if exists "Interview staff can read interviews" on scheduler.interviews;
drop policy if exists "Only interview staff can read interviews" on scheduler.interviews;
create policy "Interview staff can read interviews" on scheduler.interviews
  for select to authenticated using ((select scheduler.is_interview_staff()));
create policy "Only interview staff can read interviews" on scheduler.interviews
  as restrictive for select to authenticated using ((select scheduler.is_interview_staff()));

drop policy if exists "Admins manage time availability" on scheduler.interview_time_slots;
drop policy if exists "Interview staff manage time availability" on scheduler.interview_time_slots;
create policy "Interview staff manage time availability" on scheduler.interview_time_slots
  for all to authenticated
  using ((select scheduler.is_interview_staff()))
  with check ((select scheduler.is_interview_staff()));

create or replace function scheduler.hire_admin_reservation(p_id bigint)
returns boolean language plpgsql security definer set search_path = '' as $$
declare updated_count integer;
begin
  if not scheduler.is_interview_staff() then
    raise exception 'Interview staff access required' using errcode = '42501';
  end if;
  update scheduler.interviews
  set hired_at = now(), hired_by = auth.uid()
  where id = p_id and status = 'confirmed' and hired_at is null;
  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;

create or replace function scheduler.unhire_admin_reservation(p_id bigint)
returns boolean language plpgsql security definer set search_path = '' as $$
declare updated_count integer;
begin
  if not scheduler.is_interview_staff() then
    raise exception 'Interview staff access required' using errcode = '42501';
  end if;
  update scheduler.interviews
  set hired_at = null, hired_by = null
  where id = p_id and status = 'confirmed' and hired_at is not null;
  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;

create or replace function scheduler.cancel_admin_reservation(p_id bigint)
returns boolean language plpgsql security definer set search_path = '' as $$
declare updated_count integer;
begin
  if not scheduler.is_interview_staff() then
    raise exception 'Interview staff access required' using errcode = '42501';
  end if;
  update scheduler.interviews set status = 'cancelled'
  where id = p_id and status = 'confirmed' and hired_at is null;
  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;

-- 채용 확정된 예약은 지원자가 직접 일정 변경·취소할 수 없습니다.
create or replace function scheduler.find_candidate_reservations(p_name text, p_phone text)
returns table (id text, interview_date text, interview_time text, status text)
language sql security definer set search_path = '' as $$
  select i.id::text, i.interview_date::text, i.interview_time::text,
    case when i.hired_at is not null then 'hired' else i.status end
  from scheduler.interviews i
  where i.name = trim(p_name)
    and regexp_replace(i.phone, '[^0-9+]', '', 'g') = regexp_replace(p_phone, '[^0-9+]', '', 'g')
    and char_length(trim(p_name)) between 1 and 60
    and p_phone ~ '^[0-9+() -]{8,20}$'
  order by i.interview_date, i.interview_time;
$$;

create or replace function scheduler.update_candidate_reservation(
  p_name text, p_phone text, p_id bigint, p_date date, p_time text
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare updated_count integer;
begin
  if p_name is null or p_phone is null or p_date is null or p_time is null
    or char_length(trim(p_name)) not between 1 and 60 or p_phone !~ '^[0-9+() -]{8,20}$'
    or p_time !~ '^((09|1[0-9]|20):(00|30)|21:00)$' then return false; end if;
  update scheduler.interviews i set
    interview_date = (jsonb_populate_record(null::scheduler.interviews, jsonb_build_object('interview_date', p_date::text))).interview_date,
    interview_time = p_time
  where i.id = p_id and i.status = 'confirmed' and i.hired_at is null and i.name = trim(p_name)
    and regexp_replace(i.phone, '[^0-9+]', '', 'g') = regexp_replace(p_phone, '[^0-9+]', '', 'g');
  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;

create or replace function scheduler.cancel_candidate_reservation(p_name text, p_phone text, p_id bigint)
returns boolean language plpgsql security definer set search_path = '' as $$
declare updated_count integer;
begin
  if p_name is null or p_phone is null or char_length(trim(p_name)) not between 1 and 60
    or p_phone !~ '^[0-9+() -]{8,20}$' then return false; end if;
  update scheduler.interviews i set status = 'cancelled'
  where i.id = p_id and i.status = 'confirmed' and i.hired_at is null and i.name = trim(p_name)
    and regexp_replace(i.phone, '[^0-9+]', '', 'g') = regexp_replace(p_phone, '[^0-9+]', '', 'g');
  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;

revoke all on function scheduler.hire_admin_reservation(bigint) from public, anon;
revoke all on function scheduler.unhire_admin_reservation(bigint) from public, anon;
revoke all on function scheduler.cancel_admin_reservation(bigint) from public, anon;
grant execute on function scheduler.hire_admin_reservation(bigint) to authenticated;
grant execute on function scheduler.unhire_admin_reservation(bigint) to authenticated;
grant execute on function scheduler.cancel_admin_reservation(bigint) to authenticated;

commit;
