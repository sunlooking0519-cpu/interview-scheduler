import {
  filterSalesOrganizationList, organizationCategoryOptions, salesOrganizationCategory,
  type SalesOrganizationListRow,
} from "./sales-organization-list";
import { koreaDateKey } from "./sales-follow-up";

export const salesExportColumns = [
  ["organization", "기관명"], ["category", "기관 유형"], ["region", "지역"],
  ["visitDate", "방문일"], ["updatedDate", "최근 업데이트"],
  ["proposalStatus", "제안서 제출"], ["reaction", "반응"],
  ["contactMethod", "접촉 방식"], ["contactNames", "담당자 이름"],
  ["phone", "일반전화"], ["mobile", "휴대전화"], ["email", "이메일"],
  ["notes", "특이사항 · 상담 내용"],
] as const;

export type SalesExportColumn = (typeof salesExportColumns)[number][0];
export type SalesExportContact = {
  organization_id: string;
  name: string;
  phone: string | null;
  mobile: string | null;
  email: string | null;
};
export type SalesExportFilters = { query: string; category: string; region: string; contact: string };

const proposalLabels: Record<string, string> = {
  not_submitted: "미제출", planned: "제출 예정", submitted: "제출 완료",
};
const reactionLabels: Record<string, string> = {
  interested: "관심 높음", reviewing: "검토 중", waiting: "시기 대기", neutral: "보통",
  no_budget: "예산 없음", not_interested: "관심 없음", no_response: "응답 없음",
};
const methodLabels: Record<string, string> = {
  visit: "방문", call: "전화", email: "이메일", referral: "지인 소개",
};
const categoryLabels = Object.fromEntries(organizationCategoryOptions);
const asExcelDate = (date: string) => new Date(`${date}T00:00:00Z`);

export function buildSalesExportRows(
  organizations: SalesOrganizationListRow[], contacts: SalesExportContact[],
  filters: SalesExportFilters, selectedColumns: SalesExportColumn[],
): (string | Date)[][] {
  const byOrganization = new Map<string, SalesExportContact[]>();
  const contactNames: Record<string, string[]> = {};
  for (const item of contacts) {
    const group = byOrganization.get(item.organization_id) ?? [];
    group.push(item);
    byOrganization.set(item.organization_id, group);
    (contactNames[item.organization_id] ??= []).push(item.name);
  }
  const visible = filterSalesOrganizationList(organizations, contactNames, filters);
  return visible.map((organization) => {
    const people = byOrganization.get(organization.id) ?? [];
    const joined = (key: "name" | "phone" | "mobile" | "email") =>
      people.map((person) => person[key] ?? "").join("\n");
    const values: Record<SalesExportColumn, string | Date> = {
      organization: organization.name,
      category: categoryLabels[salesOrganizationCategory(organization.name)] ?? "그외",
      region: organization.contactRegion,
      visitDate: organization.visitDate ? asExcelDate(organization.visitDate) : "",
      updatedDate: asExcelDate(koreaDateKey(organization.lastUpdatedAt)),
      proposalStatus: organization.proposalStatus ? proposalLabels[organization.proposalStatus] ?? organization.proposalStatus : "미기록",
      reaction: organization.reaction ? reactionLabels[organization.reaction] ?? organization.reaction : "미기록",
      contactMethod: organization.visitDate ? methodLabels[organization.contactMethod] ?? "" : "",
      contactNames: joined("name"),
      phone: joined("phone"),
      mobile: joined("mobile"),
      email: joined("email"),
      notes: organization.notes,
    };
    return selectedColumns.map((column) => values[column]);
  });
}
