-- Supabase SQL Editor에서 실행합니다. 예약 테이블 직접 조회/수정 권한은 부여하지 않습니다.
begin;

create or replace function scheduler.find_candidate_reservations(p_name text, p_phone text)
returns table (id uuid, interview_date date, interview_time text, status text)
language sql security definer set search_path = '' as $$
  select i.id, i.interview_date, i.interview_time, i.status
  from scheduler.interviews i
  where i.name = trim(p_name)
    and regexp_replace(i.phone, '[^0-9+]', '', 'g') = regexp_replace(p_phone, '[^0-9+]', '', 'g')
    and char_length(trim(p_name)) between 1 and 60
    and p_phone ~ '^[0-9+() -]{8,20}$'
  order by i.interview_date, i.interview_time;
$$;

create or replace function scheduler.update_candidate_reservation(
  p_name text, p_phone text, p_id uuid, p_date date, p_time text
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare updated_count integer;
begin
  if char_length(trim(p_name)) not between 1 and 60
    or p_phone !~ '^[0-9+() -]{8,20}$'
    or p_date not in ('2026-10-12'::date, '2026-10-13'::date, '2026-10-14'::date, '2026-10-15'::date, '2026-10-16'::date)
    or p_time not in ('10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30')
    or p_name is null or p_phone is null or p_date is null or p_time is null then
    return false;
  end if;
  update scheduler.interviews i set interview_date = p_date, interview_time = p_time
  where i.id = p_id and i.status = 'confirmed' and i.name = trim(p_name)
    and regexp_replace(i.phone, '[^0-9+]', '', 'g') = regexp_replace(p_phone, '[^0-9+]', '', 'g');
  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;

revoke all on function scheduler.find_candidate_reservations(text, text) from public;
revoke all on function scheduler.update_candidate_reservation(text, text, uuid, date, text) from public;
grant usage on schema scheduler to anon, authenticated;
grant execute on function scheduler.find_candidate_reservations(text, text) to anon, authenticated;
grant execute on function scheduler.update_candidate_reservation(text, text, uuid, date, text) to anon, authenticated;
commit;
