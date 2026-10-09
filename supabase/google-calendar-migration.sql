-- Supabase SQL Editor에서 실행합니다. 토큰/동기화 큐는 서버 전용입니다.
begin;
create table if not exists scheduler.google_calendar_connection (
  id boolean primary key default true check (id = true),
  owner_id uuid not null references auth.users(id),
  calendar_id text not null default 'primary',
  refresh_token text not null
);
create table if not exists scheduler.google_calendar_jobs (
  reservation_id bigint primary key,
  version bigint not null default 1,
  leased_until timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);
alter table scheduler.google_calendar_connection enable row level security;
alter table scheduler.google_calendar_jobs enable row level security;
revoke all on scheduler.google_calendar_connection, scheduler.google_calendar_jobs from anon, authenticated;
grant usage on schema scheduler to service_role;
grant all on scheduler.google_calendar_connection, scheduler.google_calendar_jobs to service_role;
grant select on scheduler.interviews to service_role;

create or replace function scheduler.queue_google_calendar_reservation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into scheduler.google_calendar_jobs (reservation_id) values (new.id)
  on conflict (reservation_id) do update set version = scheduler.google_calendar_jobs.version + 1,
    last_error = null, updated_at = now();
  return new;
end;
$$;
revoke all on function scheduler.queue_google_calendar_reservation() from public;
drop trigger if exists queue_google_calendar_reservation on scheduler.interviews;
create trigger queue_google_calendar_reservation after insert or update of name, interview_date, interview_time, status
on scheduler.interviews for each row execute function scheduler.queue_google_calendar_reservation();

create or replace function scheduler.claim_google_calendar_jobs()
returns table (reservation_id text, version bigint)
language sql security definer set search_path = '' as $$
  with pending as (
    select j.reservation_id from scheduler.google_calendar_jobs j
    where j.leased_until is null or j.leased_until < now()
    order by j.updated_at limit 1 for update skip locked
  )
  update scheduler.google_calendar_jobs j set leased_until = now() + interval '2 minutes'
  from pending p where j.reservation_id = p.reservation_id
  returning j.reservation_id::text, j.version;
$$;
revoke all on function scheduler.claim_google_calendar_jobs() from public;
grant execute on function scheduler.claim_google_calendar_jobs() to service_role;

create or replace function scheduler.enqueue_existing_google_reservations()
returns void language sql security definer set search_path = '' as $$
  insert into scheduler.google_calendar_jobs (reservation_id) select id from scheduler.interviews
  on conflict (reservation_id) do update set version = scheduler.google_calendar_jobs.version + 1,
    last_error = null, updated_at = now();
$$;
revoke all on function scheduler.enqueue_existing_google_reservations() from public;
grant execute on function scheduler.enqueue_existing_google_reservations() to service_role;
commit;
