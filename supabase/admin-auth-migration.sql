-- 기존 데이터/컬럼은 보존합니다. Supabase SQL Editor에서 실행하세요.
begin;

-- 폐기된 비밀번호 대조 RPC를 더 이상 호출할 수 없게 제거합니다.
drop function if exists public.verify_admin_credentials(text, text);
drop function if exists scheduler.verify_admin_credentials(text, text);

grant usage on schema scheduler to anon, authenticated;
grant usage on all sequences in schema scheduler to anon, authenticated;
alter table scheduler.interviews enable row level security;
revoke all on table scheduler.interviews from anon, authenticated;
grant insert (name, email, phone, interview_date, interview_time, status)
  on table scheduler.interviews to anon, authenticated;
grant select on table scheduler.interviews to authenticated;

drop policy if exists "Public can create confirmed interviews" on scheduler.interviews;
create policy "Public can create confirmed interviews" on scheduler.interviews
  for insert to anon, authenticated with check (status = 'confirmed');

drop policy if exists "Auth admins can read interviews" on scheduler.interviews;
create policy "Auth admins can read interviews" on scheduler.interviews
  for select to authenticated
  using ((select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'super_admin'));

-- 기존의 다른 SELECT/ALL 정책이 있어도 일반 계정의 조회를 차단합니다.
drop policy if exists "Only auth admins can read interviews" on scheduler.interviews;
create policy "Only auth admins can read interviews" on scheduler.interviews
  as restrictive for select to authenticated
  using ((select auth.jwt()) -> 'app_metadata' ->> 'role' in ('admin', 'super_admin'));

commit;
