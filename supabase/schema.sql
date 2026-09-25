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
  password_hash text,
  created_at timestamptz not null default now()
);

-- 이미 생성된 interviews 테이블도 안전하게 업그레이드합니다.
alter table public.interviews
  add column if not exists role text not null default 'candidate';
alter table public.interviews
  add column if not exists password_hash text;

alter table public.interviews
  drop constraint if exists interviews_role_check;
alter table public.interviews
  add constraint interviews_role_check
  check (role in ('candidate', 'super_admin'));

create unique index if not exists interviews_confirmed_slot_key
  on public.interviews (interview_date, interview_time)
  where status = 'confirmed';

alter table public.interviews enable row level security;
revoke all on table public.interviews from anon, authenticated;
grant insert (name, email, phone, interview_date, interview_time, status)
  on table public.interviews to anon, authenticated;

drop policy if exists "Public can create confirmed interviews"
  on public.interviews;
create policy "Public can create confirmed interviews"
  on public.interviews
  for insert
  to anon, authenticated
  with check (status = 'confirmed' and role = 'candidate' and password_hash is null);

drop policy if exists "Super admins can verify their own role"
  on public.interviews;

-- 테이블을 공개하지 않고 이름과 bcrypt 비밀번호 해시만 서버에서 대조합니다.
create or replace function public.verify_admin_credentials(
  p_name text,
  p_password text
)
returns table (
  admin_id uuid,
  admin_name text,
  admin_role text
)
language sql
security definer
set search_path = ''
as $$
  select i.id, i.name, i.role
  from public.interviews as i
  where i.name = p_name
    and i.role = 'super_admin'
    and i.password_hash is not null
    and i.password_hash = extensions.crypt(p_password, i.password_hash)
    and char_length(p_name) between 1 and 60
    and char_length(p_password) between 8 and 128
  limit 1;
$$;

revoke all on function public.verify_admin_credentials(text, text) from public;
grant execute on function public.verify_admin_credentials(text, text)
  to anon, authenticated;