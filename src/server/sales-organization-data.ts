import "server-only";

import type { createClient } from "../../lib/supabase/server";
import type { DashboardActivity } from "@/features/admin/sales-dashboard-model";
import { buildSalesOrganizationList, type SalesOrganizationRow, type SalesStatusActivity } from "@/features/admin/sales-organization-list";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type SalesListContact = {
  id: string;
  organization_id: string;
  name: string;
  phone: string | null;
  mobile: string | null;
  email: string | null;
};

export async function loadSalesOrganizationData(supabase: Supabase) {
  const db = supabase.schema("scheduler");
  const organizations: SalesOrganizationRow[] = [];
  const activities: (DashboardActivity & SalesStatusActivity)[] = [];
  const contacts: SalesListContact[] = [];
  let loadError = false;

  for (let offset = 0; ; offset += 1000) {
    const result = await db.from("sales_organizations")
      .select("id,name,region,updated_at,next_contact_id")
      .order("updated_at", { ascending: false }).order("id").range(offset, offset + 999);
    if (result.error) { loadError = true; break; }
    const batch = (result.data ?? []) as SalesOrganizationRow[];
    organizations.push(...batch);
    if (batch.length < 1000) break;
  }

  let hasProposalStatus = true;
  let hasManagementDate = true;
  for (let offset = 0; ; offset += 1000) {
    const columns = `id,organization_id,contact_id,activity_type,occurred_at,created_at,summary,follow_up_round,reaction${hasProposalStatus ? ",proposal_status,visit_region,contact_method" : ""}${hasManagementDate ? ",management_updated_on" : ""}`;
    const result = await db.from("sales_activities").select(columns)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 999);
    if (result.error && hasManagementDate && ["42703", "PGRST204"].includes(result.error.code)) {
      hasManagementDate = false;
      offset = -1000;
      activities.length = 0;
      continue;
    }
    if (result.error && hasProposalStatus && ["42703", "PGRST204"].includes(result.error.code)) {
      hasProposalStatus = false;
      offset = -1000;
      activities.length = 0;
      continue;
    }
    if (result.error) { loadError = true; break; }
    const batch = (result.data ?? []) as unknown as (DashboardActivity & SalesStatusActivity)[];
    activities.push(...batch);
    if (batch.length < 1000) break;
  }

  for (let offset = 0; ; offset += 1000) {
    const result = await db.from("sales_contacts")
      .select("id,organization_id,name,phone,mobile,email")
      .order("created_at", { ascending: true }).order("id").range(offset, offset + 999);
    if (result.error) { loadError = true; break; }
    const batch = (result.data ?? []) as SalesListContact[];
    contacts.push(...batch);
    if (batch.length < 1000) break;
  }

  return { rows: buildSalesOrganizationList(organizations, activities), activities, contacts, loadError };
}
