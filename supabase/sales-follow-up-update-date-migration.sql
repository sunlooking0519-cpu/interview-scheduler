-- Run in the Supabase SQL Editor after sales-organization-follow-up-migration.sql.
-- The chosen management date is separate from the actual creation timestamp.
begin;

alter table scheduler.sales_activities
  add column if not exists management_updated_on date;

create or replace function scheduler.record_organization_contact_state(
  p_organization_id uuid,
  p_visit_date date,
  p_visit_region text,
  p_proposal_status text,
  p_reaction text,
  p_contact_method text,
  p_summary text,
  p_update_date date
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_activity_id uuid;
  v_occurred_at timestamptz;
begin
  if p_visit_date is null or p_visit_date > (now() at time zone 'Asia/Seoul')::date
    or p_update_date is null
    or p_visit_region is null or length(trim(p_visit_region)) not between 1 and 120
    or p_proposal_status is null or p_proposal_status not in ('not_submitted', 'planned', 'submitted')
    or p_reaction is null or p_reaction not in ('interested', 'reviewing', 'waiting', 'neutral', 'no_budget', 'not_interested', 'no_response')
    or p_contact_method is null or p_contact_method not in ('visit', 'call', 'email', 'referral')
    or p_summary is null or length(trim(p_summary)) not between 1 and 5000 then
    raise exception 'Invalid contact state' using errcode = '22023';
  end if;
  if not exists (select 1 from scheduler.sales_organizations where id = p_organization_id) then
    raise exception 'Organization not found' using errcode = '22023';
  end if;
  v_occurred_at := (p_visit_date::timestamp + interval '12 hours') at time zone 'Asia/Seoul';
  insert into scheduler.sales_activities (
    organization_id, activity_type, reaction, summary, occurred_at,
    visit_region, proposal_status, contact_method, management_updated_on, created_by
  ) values (
    p_organization_id, 'visit', p_reaction, trim(p_summary), v_occurred_at,
    trim(p_visit_region), p_proposal_status, p_contact_method, p_update_date, (select auth.uid())
  ) returning id into v_activity_id;

  update scheduler.sales_organizations set
    region = trim(p_visit_region),
    stage = case
      when p_proposal_status = 'submitted' and stage in ('lead', 'contacted', 'meeting') then 'proposal'
      when stage in ('lead', 'contacted') then 'meeting'
      else stage end,
    last_contact_at = greatest(coalesce(last_contact_at, v_occurred_at), v_occurred_at)
  where id = p_organization_id;
  return v_activity_id;
end;
$$;
revoke all on function scheduler.record_organization_contact_state(uuid,date,text,text,text,text,text,date) from public, anon;
grant execute on function scheduler.record_organization_contact_state(uuid,date,text,text,text,text,text,date) to authenticated;

commit;
notify pgrst, 'reload schema';
