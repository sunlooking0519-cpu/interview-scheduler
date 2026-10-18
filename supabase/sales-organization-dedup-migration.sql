-- Supabase SQL Editor에서 전체 실행하세요. 같은 이름의 영업 대상을 한 기관으로 합칩니다.
-- 담당자, 명함, 미팅, 제안서는 대표 기관에 연결하고 기존 ID와 명함 파일은 유지합니다.
begin;

alter table scheduler.sales_contacts add column if not exists "role" text;
comment on column scheduler.sales_contacts."role" is 'This contact responsibility in the organization or sales process';

create temporary table sales_org_merge_map on commit drop as
select id as duplicate_id,
  first_value(id) over (
    partition by lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g'))
    order by created_at, id
  ) as canonical_id
from scheduler.sales_organizations;
delete from sales_org_merge_map where duplicate_id = canonical_id;

-- Preserve organization-level details from duplicate rows before removing them.
update scheduler.sales_organizations target
set notes = concat_ws(E'\n\n', nullif(target.notes, ''), source.merged_notes)
from (
  select map.canonical_id,
    string_agg(
      format('병합된 항목 (%s) · 유형: %s · 단계: %s · 웹사이트: %s · 주소: %s · 메모: %s',
        duplicate.name, duplicate.kind, duplicate.stage,
        coalesce(duplicate.website, ''), coalesce(duplicate.address, ''), coalesce(duplicate.notes, '')),
      E'\n' order by duplicate.created_at, duplicate.id
    ) as merged_notes
  from sales_org_merge_map map
  join scheduler.sales_organizations duplicate on duplicate.id = map.duplicate_id
  group by map.canonical_id
) source
where target.id = source.canonical_id;

update scheduler.sales_contacts child set organization_id = map.canonical_id
from sales_org_merge_map map where child.organization_id = map.duplicate_id;
update scheduler.sales_business_cards child set organization_id = map.canonical_id
from sales_org_merge_map map where child.organization_id = map.duplicate_id;
update scheduler.sales_meetings child set organization_id = map.canonical_id
from sales_org_merge_map map where child.organization_id = map.duplicate_id;
update scheduler.sales_proposals child set organization_id = map.canonical_id
from sales_org_merge_map map where child.organization_id = map.duplicate_id;
delete from scheduler.sales_organizations target using sales_org_merge_map map
where target.id = map.duplicate_id;

-- Enforce one institution per normalized name, including concurrent registrations.
create unique index if not exists sales_organizations_normalized_name_key
on scheduler.sales_organizations (lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')));

create or replace function scheduler.find_sales_organization(p_name text)
returns uuid language sql stable security invoker set search_path = '' as $$
  select id from scheduler.sales_organizations
  where lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')) =
    lower(regexp_replace(btrim(p_name), '[[:space:]]+', ' ', 'g'))
  order by created_at, id limit 1;
$$;
revoke all on function scheduler.find_sales_organization(text) from public;
grant execute on function scheduler.find_sales_organization(text) to authenticated, service_role;

commit;
notify pgrst, 'reload schema';
