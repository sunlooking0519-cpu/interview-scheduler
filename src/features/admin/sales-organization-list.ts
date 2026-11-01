import { koreaDateKey } from "./sales-follow-up";

export type SalesOrganizationRow = { id: string; name: string; region: string | null; updated_at: string };
export type SalesStatusActivity = {
  organization_id: string;
  created_at: string;
  occurred_at?: string;
  activity_type?: string;
  summary?: string;
  reaction: string | null;
  proposal_status?: string | null;
  visit_region?: string | null;
  contact_method?: string | null;
};
export type SalesOrganizationListRow = SalesOrganizationRow & {
  lastUpdatedAt: string;
  visitDate: string | null;
  contactRegion: string;
  contactMethod: string;
  notes: string;
  proposalStatus: string | null;
  reaction: string | null;
};

export function buildSalesOrganizationList(
  organizations: SalesOrganizationRow[], activities: SalesStatusActivity[],
): SalesOrganizationListRow[] {
  const statuses = new Map<string, {
    lastActivityAt: string; visitDate: string | null; contactRegion: string | null;
    contactMethod: string | null; notes: string | null; proposalStatus: string | null; reaction: string | null;
  }>();
  for (const activity of activities) {
    const current = statuses.get(activity.organization_id) ?? {
      lastActivityAt: "", visitDate: null, contactRegion: null,
      contactMethod: null, notes: null, proposalStatus: null, reaction: null,
    };
    if (activity.created_at > current.lastActivityAt) {
      current.lastActivityAt = activity.created_at;
    }
    // The query is newest first. A later note without a proposal update keeps the previous status.
    if (current.proposalStatus === null && activity.proposal_status) current.proposalStatus = activity.proposal_status;
    if (current.reaction === null && activity.reaction) current.reaction = activity.reaction;
    if (activity.activity_type === "visit") {
      if (current.visitDate === null && activity.occurred_at) {
        current.visitDate = koreaDateKey(activity.occurred_at);
      }
      if (current.contactRegion === null && activity.visit_region) current.contactRegion = activity.visit_region;
      if (current.contactMethod === null && activity.contact_method) current.contactMethod = activity.contact_method;
      if (current.notes === null && activity.summary) current.notes = activity.summary;
    }
    statuses.set(activity.organization_id, current);
  }
  return organizations.map((organization) => {
    const status = statuses.get(organization.id);
    return {
      ...organization,
      lastUpdatedAt: status?.lastActivityAt && status.lastActivityAt > organization.updated_at ? status.lastActivityAt : organization.updated_at,
      visitDate: status?.visitDate ?? null,
      contactRegion: status?.contactRegion ?? organization.region ?? "",
      contactMethod: status?.contactMethod ?? "visit",
      notes: status?.notes ?? "",
      proposalStatus: status?.proposalStatus ?? null,
      reaction: status?.reaction ?? null,
    };
  }).sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt) || a.name.localeCompare(b.name, "ko"));
}
