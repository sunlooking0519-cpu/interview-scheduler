-- Apply before deploying the school contact phone UI. Existing records are preserved.
begin;

alter table scheduler.schools add column if not exists contact_phone text;
alter table scheduler.school_contact_history add column if not exists contact_phone text;

create or replace function scheduler.record_school_follow_up_with_phone(
  p_school_id uuid, p_contact_date date, p_update_date date,
  p_contact_name text, p_contact_email text, p_contact_phone text,
  p_contact_method text, p_proposal_status text, p_reaction text, p_new_note text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_school scheduler.schools%rowtype;
  v_role text := auth.jwt() -> 'app_metadata' ->> 'role';
  v_changes text[] := array[]::text[];
  v_name text := nullif(btrim(coalesce(p_contact_name, '')), '');
  v_email text := nullif(btrim(coalesce(p_contact_email, '')), '');
  v_phone text := nullif(btrim(coalesce(p_contact_phone, '')), '');
  v_note text := nullif(btrim(coalesce(p_new_note, '')), '');
begin
  if auth.uid() is null or coalesce(v_role, '') not in ('admin', 'super_admin', 'instructor') then
    raise exception 'School access required' using errcode = '42501';
  end if;
  if p_school_id is null or p_contact_date is null or p_update_date is null
     or p_contact_date > (now() at time zone 'Asia/Seoul')::date
     or p_update_date > (now() at time zone 'Asia/Seoul')::date
     or p_update_date < p_contact_date
     or length(coalesce(v_name, '')) > 120 or length(coalesce(v_email, '')) > 200
     or length(coalesce(v_phone, '')) > 80
     or (v_email is not null and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
     or p_contact_method is null or p_contact_method not in ('visit', 'call', 'email', 'referral')
     or (p_proposal_status is not null and p_proposal_status not in ('not_submitted', 'planned', 'submitted'))
     or (p_reaction is not null and p_reaction not in ('interested', 'reviewing', 'waiting', 'neutral', 'no_budget', 'not_interested', 'no_response'))
     or length(coalesce(v_note, '')) > 5000 then
    raise exception 'Invalid school follow-up' using errcode = '22023';
  end if;
  select * into v_school from scheduler.schools where id = p_school_id for update;
  if not found or (v_role = 'instructor' and v_school.assigned_to is distinct from auth.uid()) then
    raise exception 'School is not assigned to this manager' using errcode = '42501';
  end if;
  if v_school.contact_date is distinct from p_contact_date then v_changes := array_append(v_changes, '접촉일 변경'); end if;
  if v_school.contact_name is distinct from v_name then v_changes := array_append(v_changes, '학교 담당자 변경'); end if;
  if v_school.contact_email is distinct from v_email then v_changes := array_append(v_changes, '담당자 이메일 변경'); end if;
  if v_school.contact_phone is distinct from v_phone then v_changes := array_append(v_changes, '담당자 전화번호 변경'); end if;
  if v_school.contact_method is distinct from p_contact_method then v_changes := array_append(v_changes, '접촉 방식 변경'); end if;
  if v_school.proposal_status is distinct from p_proposal_status then v_changes := array_append(v_changes, '제안서 상태 변경'); end if;
  if v_school.reaction is distinct from p_reaction then v_changes := array_append(v_changes, '반응 변경'); end if;
  if v_note is not null then v_changes := array_append(v_changes, '특이사항 추가'); end if;
  if v_school.management_updated_on is distinct from p_update_date then v_changes := array_append(v_changes, '업데이트 날짜 변경'); end if;
  if cardinality(v_changes) = 0 then return false; end if;

  insert into scheduler.school_contact_history (
    school_id, recorded_by, contact_date, update_date, contact_name, contact_email, contact_phone,
    contact_method, proposal_status, reaction, new_note, change_summary
  ) values (
    p_school_id, auth.uid(), p_contact_date, p_update_date, v_name, v_email, v_phone,
    p_contact_method, p_proposal_status, p_reaction, v_note, array_to_string(v_changes, ' · ')
  );
  update scheduler.schools set
    contact_date = p_contact_date, contact_name = v_name, contact_email = v_email, contact_phone = v_phone,
    contact_method = p_contact_method, proposal_status = p_proposal_status,
    reaction = p_reaction,
    notes = case when v_note is null then notes else concat_ws(E'\n\n', nullif(notes, ''), v_note) end,
    management_updated_on = p_update_date, updated_at = now()
  where id = p_school_id;
  return true;
end;
$$;
revoke all on function scheduler.record_school_follow_up_with_phone(uuid,date,date,text,text,text,text,text,text,text) from public, anon;
grant execute on function scheduler.record_school_follow_up_with_phone(uuid,date,date,text,text,text,text,text,text,text) to authenticated;

commit;
notify pgrst, 'reload schema';
