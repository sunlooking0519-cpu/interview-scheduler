-- 1. Supabase Dashboard > Authentication > Users에서 관리자 사용자를 먼저 만드세요.
--    이메일은 interviews 행의 이메일과 같아야 하며 비밀번호는 Dashboard에서만 설정합니다.
-- 2. 아래 ADMIN_EMAIL을 김경희 지원자의 실제 이메일로 바꾼 뒤 SQL Editor에서 실행하세요.

update public.interviews
set role = 'super_admin'
where name = '김경희'
  and lower(email) = lower('ADMIN_EMAIL');

-- 정확히 한 행이 반환되는지 확인하세요.
select id, name, email, role
from public.interviews
where name = '김경희'
  and lower(email) = lower('ADMIN_EMAIL');