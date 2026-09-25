-- 현재 interviews 테이블에 관리자 인증 컬럼과 검증 함수를 추가하는 마이그레이션입니다.
-- 이 파일 전체를 Supabase SQL Editor에서 먼저 실행하세요.
create extension if not exists pgcrypto;

alter table public.interviews
  add column if not exists role text not null default 'candidate';
alter table public.interviews
  add column if not exists password_hash text;

alter table public.interviews
  drop constraint if exists interviews_role_check;
alter table public.interviews
  add constraint interviews_role_check
  check (role in ('candidate', 'super_admin'));

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

-- 위 구문 실행 후 아래 NEW_STRONG_PASSWORD를 실제 새 비밀번호로 바꾸어 별도로 실행하세요.
-- 대화나 Git에 공개한 적 없는 새 비밀번호를 사용하세요.
--
-- update public.interviews
-- set role = 'super_admin',
--     password_hash = extensions.crypt('NEW_STRONG_PASSWORD', extensions.gen_salt('bf', 12))
-- where name = '김경희';
--
-- 같은 이름의 행이 여러 개라면 반드시 AND email = '실제 이메일' 조건을 추가하세요.