-- Supabase Dashboard > SQL Editor에서 실행하세요.
create extension if not exists pgcrypto;

create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  email text not null check (
    char_length(email) <= 254
    and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  phone text not null check (
    char_length(phone) between 8 and 20
    and phone ~ '^[0-9+() -]+$'
  ),
  interview_date date not null,
  interview_time text not null check (
    interview_time ~ '^([01][0-9]|2[0-3]):(00|30)$'
  ),
  status text not null default 'confirmed' check (
    status in ('confirmed', 'cancelled')
  ),
  role text not null default 'candidate' check (
    role in ('candidate', 'super_admin')
  ),
  created_at timestamptz not null default now()
);

-- 이미 테이블을 만든 프로젝트에도 관리자 역할 컬럼을 추가합니다.
alter table public.interviews
  add column if not exists role text not null default 'candidate';

alter table public.interviews
  drop constraint if exists interviews_role_check;
alter table public.interviews
  add constraint interviews_role_check
  check (role in ('candidate', 'super_admin'));

-- 확정된 동일 날짜/시간에는 한 건만 예약할 수 있습니다.
create unique index if not exists interviews_confirmed_slot_key
  on public.interviews (interview_date, interview_time)
  where status = 'confirmed';

alter table public.interviews enable row level security;

-- 공개 예약 폼은 INSERT만 허용합니다. role은 INSERT 권한에서 제외됩니다.
revoke all on table public.interviews from anon, authenticated;
grant insert (name, email, phone, interview_date, interview_time, status)
  on table public.interviews to anon, authenticated;

-- 로그인한 사용자는 자신의 이메일과 연결된 최고 관리자 행만 조회할 수 있습니다.
grant select (id, name, email, role)
  on table public.interviews to authenticated;

drop policy if exists "Public can create confirmed interviews"
  on public.interviews;
create policy "Public can create confirmed interviews"
  on public.interviews
  for insert
  to anon, authenticated
  with check (status = 'confirmed' and role = 'candidate');

drop policy if exists "Super admins can verify their own role"
  on public.interviews;
create policy "Super admins can verify their own role"
  on public.interviews
  for select
  to authenticated
  using (
    role = 'super_admin'
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );