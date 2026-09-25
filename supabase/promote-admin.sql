-- 먼저 admin-auth-migration.sql 전체를 실행하세요.
-- 아래 NEW_STRONG_PASSWORD를 실제 새 비밀번호로 바꾸어 실행합니다.
-- 같은 이름의 행이 여러 개라면 이메일 조건을 반드시 추가하세요.

update public.interviews
set role = 'super_admin',
    password_hash = extensions.crypt('NEW_STRONG_PASSWORD', extensions.gen_salt('bf', 12))
where name = '김경희';

select id, name, email, role, password_hash is not null as has_password
from public.interviews
where name = '김경희';