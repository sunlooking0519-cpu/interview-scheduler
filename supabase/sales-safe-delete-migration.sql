-- Run in the production Supabase SQL Editor before using activity/organization deletion.
-- The functions enforce ownership, use one transaction per deletion, and reject stale previews.
begin;

create or replace function scheduler.delete_sales_activity(
  p_activity_id uuid,
  p_expected_version integer
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_activity scheduler.sales_activities%rowtype;
  v_owner uuid;
begin
  select * into v_activity from scheduler.sales_activities
  where id = p_activity_id for update;
  if not found then raise exception 'Activity not found' using errcode = 'P0002'; end if;
  select created_by into v_owner from scheduler.sales_organizations
  where id = v_activity.organization_id;
  if auth.uid() is null or v_owner <> auth.uid() then
    raise exception 'Only the owner may delete this activity' using errcode = '42501';
  end if;
  if p_expected_version is null or v_activity.edit_version <> p_expected_version then
    raise exception 'Activity changed since preview' using errcode = '40001';
  end if;

  delete from scheduler.sales_activity_revisions where activity_id = p_activity_id;
  delete from scheduler.sales_activities where id = p_activity_id;
  update scheduler.sales_organizations o set
    last_contact_at = (select max(a.occurred_at) from scheduler.sales_activities a where a.organization_id = o.id),
    last_follow_up_round = coalesce((select max(a.follow_up_round) from scheduler.sales_activities a where a.organization_id = o.id), 0)
  where o.id = v_activity.organization_id;
end;
$$;

create or replace function scheduler.delete_sales_organization(
  p_organization_id uuid,
  p_confirmed_name text,
  p_expected_counts jsonb
)
returns text[] language plpgsql security definer set search_path = '' as $$
declare
  v_organization scheduler.sales_organizations%rowtype;
  v_counts jsonb;
  v_images text[];
begin
  select * into v_organization from scheduler.sales_organizations
  where id = p_organization_id for update;
  if not found then raise exception 'Organization not found' using errcode = 'P0002'; end if;
  if auth.uid() is null or v_organization.created_by <> auth.uid() then
    raise exception 'Only the owner may delete this organization' using errcode = '42501';
  end if;
  if p_confirmed_name is distinct from v_organization.name then
    raise exception 'Organization name mismatch' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'contacts', (select count(*) from scheduler.sales_contacts where organization_id = p_organization_id),
    'cards', (select count(*) from scheduler.sales_business_cards where organization_id = p_organization_id),
    'activities', (select count(*) from scheduler.sales_activities where organization_id = p_organization_id),
    'meetings', (select count(*) from scheduler.sales_meetings where organization_id = p_organization_id),
    'proposals', (select count(*) from scheduler.sales_proposals where organization_id = p_organization_id),
    'revisions', (select count(*) from scheduler.sales_activity_revisions where organization_id = p_organization_id),
    'proposal_versions', (select count(*) from scheduler.sales_proposal_versions v join scheduler.sales_proposals p on p.id = v.proposal_id where p.organization_id = p_organization_id)
  ) into v_counts;
  if p_expected_counts is distinct from v_counts then
    raise exception 'Organization records changed since preview' using errcode = '40001';
  end if;

  select coalesce(array_agg(image_path), array[]::text[]) into v_images
  from scheduler.sales_business_cards where organization_id = p_organization_id;
  -- The queue worker deletes Google events when their meeting row no longer exists.
  insert into scheduler.sales_calendar_jobs (meeting_id)
  select id from scheduler.sales_meetings where organization_id = p_organization_id
  on conflict (meeting_id) do update set
    version = scheduler.sales_calendar_jobs.version + 1,
    leased_until = null, last_error = null, updated_at = now();
  delete from scheduler.sales_organizations where id = p_organization_id;
  return v_images;
end;
$$;

create or replace function scheduler.preview_sales_organization_deletion(p_organization_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
  v_owner uuid;
  v_counts jsonb;
begin
  select name, created_by into v_name, v_owner from scheduler.sales_organizations
  where id = p_organization_id;
  if not found then raise exception 'Organization not found' using errcode = 'P0002'; end if;
  if auth.uid() is null or v_owner <> auth.uid() then
    raise exception 'Only the owner may preview deletion' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'contacts', (select count(*) from scheduler.sales_contacts where organization_id = p_organization_id),
    'cards', (select count(*) from scheduler.sales_business_cards where organization_id = p_organization_id),
    'activities', (select count(*) from scheduler.sales_activities where organization_id = p_organization_id),
    'meetings', (select count(*) from scheduler.sales_meetings where organization_id = p_organization_id),
    'proposals', (select count(*) from scheduler.sales_proposals where organization_id = p_organization_id),
    'revisions', (select count(*) from scheduler.sales_activity_revisions where organization_id = p_organization_id),
    'proposal_versions', (select count(*) from scheduler.sales_proposal_versions v join scheduler.sales_proposals p on p.id = v.proposal_id where p.organization_id = p_organization_id)
  ) into v_counts;
  return jsonb_build_object(
    'name', v_name,
    'counts', v_counts,
    'contacts', (select coalesce(jsonb_agg(x.name), '[]'::jsonb) from
      (select name from scheduler.sales_contacts where organization_id = p_organization_id order by created_at desc limit 20) x),
    'cards', (select coalesce(jsonb_agg(x.name), '[]'::jsonb) from
      (select coalesce(c.name, '담당자 미지정') as name from scheduler.sales_business_cards b
       left join scheduler.sales_contacts c on c.id = b.contact_id
       where b.organization_id = p_organization_id order by b.created_at desc limit 20) x),
    'activities', (select coalesce(jsonb_agg(x.summary), '[]'::jsonb) from
      (select summary from scheduler.sales_activities where organization_id = p_organization_id order by created_at desc limit 20) x),
    'meetings', (select coalesce(jsonb_agg(x.title), '[]'::jsonb) from
      (select title from scheduler.sales_meetings where organization_id = p_organization_id order by starts_at desc limit 20) x),
    'proposals', (select coalesce(jsonb_agg(x.title), '[]'::jsonb) from
      (select title from scheduler.sales_proposals where organization_id = p_organization_id order by updated_at desc limit 20) x)
  );
end;
$$;

revoke all on function scheduler.delete_sales_activity(uuid, integer) from public, anon;
revoke all on function scheduler.delete_sales_organization(uuid, text, jsonb) from public, anon;
revoke all on function scheduler.preview_sales_organization_deletion(uuid) from public, anon;
grant execute on function scheduler.delete_sales_activity(uuid, integer) to authenticated;
grant execute on function scheduler.delete_sales_organization(uuid, text, jsonb) to authenticated;
grant execute on function scheduler.preview_sales_organization_deletion(uuid) to authenticated;

commit;
notify pgrst, 'reload schema';
