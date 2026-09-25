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
  created_at timestamptz not null default now()
);

-- 확정된 동일 날짜/시간에는 한 건만 예약할 수 있습니다.
create unique index if not exists interviews_confirmed_slot_key
  on public.interviews (interview_date, interview_time)
  where status = 'confirmed';

alter table public.interviews enable row level security;

-- 공개 폼은 INSERT만 허용하고 조회/수정/삭제 권한은 열지 않습니다.
revoke all on table public.interviews from anon, authenticated;
grant insert (name, email, phone, interview_date, interview_time, status)
  on table public.interviews to anon, authenticated;

drop policy if exists "Public can create confirmed interviews"
  on public.interviews;

create policy "Public can create confirmed interviews"
  on public.interviews
  for insert
  to anon, authenticated
  with check (status = 'confirmed');