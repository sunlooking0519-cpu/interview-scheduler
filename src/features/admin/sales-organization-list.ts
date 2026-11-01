export type SalesOrganizationRow = { id: string; name: string; updated_at: string };
export type SalesStatusActivity = {
  organization_id: string;
  created_at: string;
  reaction: string | null;
  proposal_status?: string | null;
};
export type SalesOrganizationListRow = SalesOrganizationRow & {
  lastUpdatedAt: string;
  proposalStatus: string | null;
  reaction: string | null;
};

export function buildSalesOrganizationList(
  organizations: SalesOrganizationRow[], activities: SalesStatusActivity[],
): SalesOrganizationListRow[] {
  const statuses = new Map<string, { lastActivityAt: string; proposalStatus: string | null; reaction: string | null }>();
  for (const activity of activities) {
    const current = statuses.get(activity.organization_id) ?? { lastActivityAt: "", proposalStatus: null, reaction: null };
    if (activity.created_at > current.lastActivityAt) {
      current.lastActivityAt = activity.created_at;
    }
    // The query is newest first. A later note without a proposal update keeps the previous status.
    if (current.proposalStatus === null && activity.proposal_status) current.proposalStatus = activity.proposal_status;
    if (current.reaction === null && activity.reaction) current.reaction = activity.reaction;
    statuses.set(activity.organization_id, current);
  }
  return organizations.map((organization) => {
    const status = statuses.get(organization.id);
    return {
      ...organization,
      lastUpdatedAt: status?.lastActivityAt && status.lastActivityAt > organization.updated_at ? status.lastActivityAt : organization.updated_at,
      proposalStatus: status?.proposalStatus ?? null,
      reaction: status?.reaction ?? null,
    };
  }).sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt) || a.name.localeCompare(b.name, "ko"));
}
