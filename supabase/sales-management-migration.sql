-- Supabase SQL Editor에서 전체 실행한 뒤 scheduler 스키마가 API에 노출되어 있는지 확인하세요.
-- 명함 이미지는 비공개 sales-cards 버킷에 저장합니다.
begin;

create table if not exists scheduler.sales_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 200),
  kind text not null check (kind in ('institution', 'school', 'other')),
  stage text not null default 'lead' check (stage in ('lead', 'contacted', 'meeting', 'proposal', 'won', 'lost')),
  website text, address text, notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists scheduler.sales_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references scheduler.sales_organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  title text, phone text, email text, notes text,
  created_at timestamptz not null default now()
);
create table if not exists scheduler.sales_meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references scheduler.sales_organizations(id) on delete cascade,
  contact_id uuid references scheduler.sales_contacts(id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 200),
  starts_at timestamptz not null, ends_at timestamptz not null,
  location text, notes text,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  constraint sales_meeting_time check (ends_at > starts_at)
);
create table if not exists scheduler.sales_proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references scheduler.sales_organizations(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  body text not null default '',
  revision_number integer not null default 1 check (revision_number > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists scheduler.sales_proposal_versions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references scheduler.sales_proposals(id) on delete cascade,
  revision_number integer not null,
  title text not null, body text not null,
  created_at timestamptz not null default now(),
  unique (proposal_id, revision_number)
);
create table if not exists scheduler.sales_business_cards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references scheduler.sales_organizations(id) on delete cascade,
  contact_id uuid references scheduler.sales_contacts(id) on delete set null,
  image_path text not null unique,
  ocr_text text not null default '',
  ocr_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function scheduler.record_sales_proposal_version()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into scheduler.sales_proposal_versions (proposal_id, revision_number, title, body)
  values (new.id, new.revision_number, new.title, new.body);
  return new;
end;
$$;
revoke all on function scheduler.record_sales_proposal_version() from public;
drop trigger if exists sales_proposal_version on scheduler.sales_proposals;
create trigger sales_proposal_version after insert or update of title, body on scheduler.sales_proposals
for each row execute function scheduler.record_sales_proposal_version();

create or replace function scheduler.touch_sales_organization()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists touch_sales_organization on scheduler.sales_organizations;
create trigger touch_sales_organization before update on scheduler.sales_organizations
for each row execute function scheduler.touch_sales_organization();

-- Auth 사용자의 app_metadata.role만 관리자 판정에 사용합니다.
grant usage on schema scheduler to authenticated;
grant select, insert, update, delete on scheduler.sales_organizations,
  scheduler.sales_contacts, scheduler.sales_meetings, scheduler.sales_proposals,
  scheduler.sales_business_cards to authenticated;
grant select on scheduler.sales_proposal_versions to authenticated;
grant select, insert, update, delete on scheduler.sales_organizations,
  scheduler.sales_contacts, scheduler.sales_meetings, scheduler.sales_proposals,
  scheduler.sales_proposal_versions, scheduler.sales_business_cards to service_role;

do $$
declare table_name text;
begin
  foreach table_name in array array['sales_organizations','sales_contacts','sales_meetings','sales_proposals','sales_proposal_versions','sales_business_cards'] loop
    execute format('alter table scheduler.%I enable row level security', table_name);
    execute format('create policy admin_sales_all on scheduler.%I for all to authenticated using ((auth.jwt() -> ''app_metadata'' ->> ''role'') in (''admin'', ''super_admin'')) with check ((auth.jwt() -> ''app_metadata'' ->> ''role'') in (''admin'', ''super_admin''))', table_name);
  end loop;
end $$;
revoke insert, update, delete on scheduler.sales_proposal_versions from authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sales-cards', 'sales-cards', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
create policy sales_cards_admin_read on storage.objects for select to authenticated
using (bucket_id = 'sales-cards' and (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'super_admin'));
create policy sales_cards_admin_insert on storage.objects for insert to authenticated
with check (bucket_id = 'sales-cards' and (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'super_admin'));
create policy sales_cards_admin_delete on storage.objects for delete to authenticated
using (bucket_id = 'sales-cards' and (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'super_admin'));

-- Google 동기화 큐: 미팅 저장/취소가 성공하면 비동기로 Google에 반영합니다.
create table if not exists scheduler.sales_calendar_jobs (
  meeting_id uuid primary key,
  version bigint not null default 1,
  leased_until timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);
alter table scheduler.sales_calendar_jobs enable row level security;
revoke all on scheduler.sales_calendar_jobs from anon, authenticated;
grant all on scheduler.sales_calendar_jobs to service_role;

create or replace function scheduler.queue_sales_calendar_meeting()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into scheduler.sales_calendar_jobs (meeting_id) values (new.id)
  on conflict (meeting_id) do update set version = scheduler.sales_calendar_jobs.version + 1,
    leased_until = null, last_error = null, updated_at = now();
  return new;
end;
$$;
revoke all on function scheduler.queue_sales_calendar_meeting() from public;
drop trigger if exists queue_sales_calendar_meeting on scheduler.sales_meetings;
create trigger queue_sales_calendar_meeting after insert or update of title, starts_at, ends_at, location, status
on scheduler.sales_meetings for each row execute function scheduler.queue_sales_calendar_meeting();

create or replace function scheduler.claim_sales_calendar_jobs()
returns table (meeting_id uuid, version bigint)
language sql security definer set search_path = '' as $$
  with pending as (
    select j.meeting_id from scheduler.sales_calendar_jobs j
    where j.leased_until is null or j.leased_until < now()
    order by j.updated_at limit 1 for update skip locked
  )
  update scheduler.sales_calendar_jobs j set leased_until = now() + interval '2 minutes'
  from pending p where j.meeting_id = p.meeting_id
  returning j.meeting_id, j.version;
$$;
revoke all on function scheduler.claim_sales_calendar_jobs() from public;
grant execute on function scheduler.claim_sales_calendar_jobs() to service_role;

insert into scheduler.sales_calendar_jobs (meeting_id)
select id from scheduler.sales_meetings on conflict do nothing;
commit;
