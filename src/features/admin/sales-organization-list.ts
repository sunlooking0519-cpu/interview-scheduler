import { koreaDateKey } from "./sales-follow-up";
import { isAutomaticSalesSummary } from "./sales-contact-state";

export type SalesOrganizationRow = { id: string; name: string; region: string | null; created_at?: string; updated_at: string; next_contact_id?: string | null; workspace_id?: string; stage?: string };
export type SalesBusinessCardDate = { organization_id: string; created_at: string };
export type SalesStatusActivity = {
  organization_id: string;
  created_at: string;
  edited_at?: string | null;
  management_updated_on?: string | null;
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
  managementUpdatedOn: string | null;
  visitDate: string | null;
  contactRegion: string;
  contactMethod: string;
  notes: string;
  proposalStatus: string | null;
  reaction: string | null;
};

export const organizationCategoryOptions = [
  ["library", "도서관"], ["university", "대학교"], ["youth", "청소년센터"],
  ["municipal", "시군구청"], ["education", "교육기관"], ["other", "그외"],
] as const;
export const salesRegionOptions = ["전북", "광주", "서울", "대구", "부산", "대전", "경기"] as const;
export const salesOrganizationPageSize = 25;

export function paginateSalesOrganizations<T>(rows: T[], requestedPage: string | number) {
  const pageCount = Math.max(1, Math.ceil(rows.length / salesOrganizationPageSize));
  const parsed = Number(requestedPage);
  const page = Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, pageCount) : 1;
  return { page, pageCount, rows: rows.slice((page - 1) * salesOrganizationPageSize, page * salesOrganizationPageSize) };
}

export function salesOrganizationCategory(name: string): string {
  const compact = name.replace(/\s+/g, "");
  if (/도서관/.test(compact)) return "library";
  if (/대학교|대학|캠퍼스/.test(compact)) return "university";
  if (/청소년|유스센터|유스호스텔/.test(compact)) return "youth";
  if (/시청|군청|구청/.test(compact)) return "municipal";
  if (/학교|교육청|교육지원청|교육원|교육센터|평생학습|학습관|교육기관/.test(compact)) return "education";
  return "other";
}

export function salesRegionGroup(region: string, organizationName = ""): string | null {
  const value = (region || organizationName).replace(/\s+/g, "");
  if (/경기|경기도/.test(value)) return "경기";
  if (/전북|전라북도|전북특별자치도|전주|군산|익산|남원|정읍|김제|완주|순창|고창|부안|무주|진안|장수|임실/.test(value)) return "전북";
  if (/광주|광주광역시/.test(value)) return "광주";
  if (/서울|서울특별시/.test(value)) return "서울";
  if (/대구|대구광역시/.test(value)) return "대구";
  if (/부산|부산광역시/.test(value)) return "부산";
  if (/대전|대전광역시/.test(value)) return "대전";
  return null;
}

export function filterSalesOrganizationList(
  rows: SalesOrganizationListRow[],
  contactNames: Record<string, string[]>,
  filters: { query: string; category: string; region: string; contact: string },
): SalesOrganizationListRow[] {
  const query = filters.query.trim().toLocaleLowerCase("ko-KR");
  const contact = filters.contact.trim().toLocaleLowerCase("ko-KR");
  return rows.filter((row) =>
    (!query || row.name.toLocaleLowerCase("ko-KR").includes(query))
    && (!filters.category || salesOrganizationCategory(row.name) === filters.category)
    && (!filters.region || salesRegionGroup(row.contactRegion, row.name) === filters.region)
    && (!contact || (contactNames[row.id] ?? []).some((name) => name.toLocaleLowerCase("ko-KR").includes(contact)))
  );
}

export function buildSalesOrganizationList(
  organizations: SalesOrganizationRow[], activities: SalesStatusActivity[], cards: SalesBusinessCardDate[] = [],
): SalesOrganizationListRow[] {
  const statuses = new Map<string, {
    lastActivityAt: string; lastActivityUpdateAt: string; lastEditedAt: string; managementUpdatedOn: string | null; visitDate: string | null; contactRegion: string | null;
    contactMethod: string | null; notes: string | null; proposalStatus: string | null; reaction: string | null;
  }>();
  for (const activity of activities) {
    const current = statuses.get(activity.organization_id) ?? {
      lastActivityAt: "", lastActivityUpdateAt: "", lastEditedAt: "", managementUpdatedOn: null, visitDate: null, contactRegion: null,
      contactMethod: null, notes: null, proposalStatus: null, reaction: null,
    };
    if (activity.created_at > current.lastActivityAt) {
      current.lastActivityAt = activity.created_at;
      current.managementUpdatedOn = activity.management_updated_on ?? null;
      current.lastActivityUpdateAt = activity.management_updated_on
        ? new Date(`${activity.management_updated_on}T12:00:00+09:00`).toISOString()
        : activity.created_at;
    }
    if (activity.edited_at && activity.edited_at > current.lastEditedAt) current.lastEditedAt = activity.edited_at;
    // The query is newest first. A later note without a proposal update keeps the previous status.
    if (current.proposalStatus === null && activity.proposal_status) current.proposalStatus = activity.proposal_status;
    if (current.reaction === null && activity.reaction) current.reaction = activity.reaction;
    if (activity.activity_type === "visit") {
      if (current.visitDate === null && activity.occurred_at) {
        current.visitDate = koreaDateKey(activity.occurred_at);
      }
      if (current.contactRegion === null && activity.visit_region) current.contactRegion = activity.visit_region;
      if (current.contactMethod === null && activity.contact_method) current.contactMethod = activity.contact_method;
      if (current.notes === null && activity.summary && !isAutomaticSalesSummary(activity.summary)) current.notes = activity.summary;
    }
    statuses.set(activity.organization_id, current);
  }
  const latestCardAt = new Map<string, string>();
  for (const card of cards) {
    const previous = latestCardAt.get(card.organization_id);
    if (!previous || card.created_at > previous) latestCardAt.set(card.organization_id, card.created_at);
  }
  return organizations.map((organization) => {
    const status = statuses.get(organization.id);
    return {
      ...organization,
      // updated_at was also touched by workspace backfills and other administrative migrations.
      // Only user-facing records participate in the management order.
      lastUpdatedAt: [organization.created_at ?? organization.updated_at, status?.lastActivityUpdateAt, status?.lastEditedAt, latestCardAt.get(organization.id)]
        .filter((value): value is string => Boolean(value))
        .sort().at(-1)!,
      visitDate: status?.visitDate ?? null,
      managementUpdatedOn: status?.managementUpdatedOn ?? null,
      contactRegion: status?.contactRegion ?? organization.region ?? "",
      contactMethod: status?.contactMethod ?? "visit",
      notes: status?.notes ?? "",
      proposalStatus: status?.proposalStatus ?? null,
      reaction: status?.reaction ?? null,
    };
  }).sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt) || a.name.localeCompare(b.name, "ko"));
}
