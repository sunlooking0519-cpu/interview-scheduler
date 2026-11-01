-- Supabase SQL Editor에서 실행합니다. 기존 방문 기록은 유지됩니다.
begin;

alter table scheduler.sales_activities
  add column if not exists visit_region text,
  add column if not exists proposal_status text,
  add column if not exists contact_method text;

alter table scheduler.sales_activities
  drop constraint if exists sales_activities_proposal_status_check;
alter table scheduler.sales_activities
  add constraint sales_activities_proposal_status_check
  check (proposal_status is null or proposal_status in ('not_submitted', 'planned', 'submitted'));
alter table scheduler.sales_activities
  drop constraint if exists sales_activities_contact_method_check;
alter table scheduler.sales_activities
  add constraint sales_activities_contact_method_check
  check (contact_method is null or contact_method in ('visit', 'call', 'email', 'referral'));

create or replace function scheduler.record_card_visit_details(
  p_card_id uuid,
  p_contact_id uuid,
  p_visit_date date,
  p_visit_region text,
  p_proposal_status text,
  p_reaction text,
  p_contact_method text,
  p_summary text
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_organization_id uuid;
  v_activity_id uuid;
  v_occurred_at timestamptz;
begin
  if p_visit_date is null or p_visit_date > (now() at time zone 'Asia/Seoul')::date
    or p_visit_region is null or length(trim(p_visit_region)) not between 1 and 120
    or p_proposal_status not in ('not_submitted', 'planned', 'submitted')
    or p_reaction not in ('interested', 'reviewing', 'waiting', 'neutral', 'no_budget', 'not_interested', 'no_response')
    or p_contact_method not in ('visit', 'call', 'email', 'referral')
    or p_summary is null or length(trim(p_summary)) not between 1 and 5000 then
    raise exception 'Invalid visit details' using errcode = '22023';
  end if;
  select organization_id into v_organization_id
  from scheduler.sales_business_cards where id = p_card_id;
  if v_organization_id is null then
    raise exception 'Business card not found' using errcode = '22023';
  end if;
  if p_contact_id is not null and not exists (
    select 1 from scheduler.sales_contacts
    where id = p_contact_id and organization_id = v_organization_id
  ) then
    raise exception 'Contact does not belong to this organization' using errcode = '22023';
  end if;
  v_occurred_at := (p_visit_date::timestamp + interval '12 hours') at time zone 'Asia/Seoul';
  insert into scheduler.sales_activities (
    organization_id, contact_id, activity_type, reaction, summary, occurred_at,
    visit_region, proposal_status, contact_method, created_by
  ) values (
    v_organization_id, p_contact_id, 'visit', p_reaction, trim(p_summary), v_occurred_at,
    trim(p_visit_region), p_proposal_status, p_contact_method, (select auth.uid())
  ) returning id into v_activity_id;

  update scheduler.sales_organizations set
    region = trim(p_visit_region),
    stage = case
      when p_proposal_status = 'submitted' and stage in ('lead', 'contacted', 'meeting') then 'proposal'
      when stage in ('lead', 'contacted') then 'meeting'
      else stage end,
    last_contact_at = v_occurred_at
  where id = v_organization_id;
  return v_activity_id;
end;
$$;
revoke all on function scheduler.record_card_visit_details(uuid,uuid,date,text,text,text,text,text) from public, anon;
grant execute on function scheduler.record_card_visit_details(uuid,uuid,date,text,text,text,text,text) to authenticated;

commit;
