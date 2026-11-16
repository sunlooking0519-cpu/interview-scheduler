import { schoolExportColumns, schoolExportValues, type SchoolExportColumn, type SchoolExportRecord } from "./school-export";
import { schoolViewConditions, type SchoolFilters } from "./school-filters";

export const schoolDirectorySheets = [
  ["all", "전체학교"], ["active", "진행중"],
  ["additional", "추가제안"], ["excluded", "제외학교"],
] as const satisfies readonly (readonly [SchoolFilters["view"], string])[];
export type SchoolDirectorySheet = (typeof schoolDirectorySheets)[number][0];

export const schoolDirectoryColumns = [
  ...schoolExportColumns,
  ["assignedManager", "배정 담당 강사"],
  ["lastActivityAt", "최근 활동 시각"],
] as const;
export type SchoolDirectoryColumn = (typeof schoolDirectoryColumns)[number][0];

export type SchoolDirectoryRecord = SchoolExportRecord & {
  assigned_to: string | null;
  last_activity_at: string | null;
  additional_proposal_at: string | null;
  excluded_at: string | null;
};

export function schoolsForDirectorySheet(schools: SchoolDirectoryRecord[], view: SchoolDirectorySheet) {
  const { empty, present } = schoolViewConditions(view);
  const filtered = schools.filter((school) => empty.every((column) => school[column as keyof SchoolDirectoryRecord] == null)
    && present.every((column) => school[column as keyof SchoolDirectoryRecord] != null));
  if (view === "active") return filtered.sort((a, b) => (b.last_activity_at ?? "").localeCompare(a.last_activity_at ?? "") || a.name.localeCompare(b.name, "ko"));
  if (view === "additional") return filtered.sort((a, b) => (b.additional_proposal_at ?? "").localeCompare(a.additional_proposal_at ?? "") || a.name.localeCompare(b.name, "ko"));
  return filtered.sort((a, b) => a.province.localeCompare(b.province, "ko") || a.district.localeCompare(b.district, "ko")
    || a.level.localeCompare(b.level, "ko") || a.name.localeCompare(b.name, "ko"));
}

export function buildSchoolDirectoryRows(
  schools: SchoolDirectoryRecord[], columns: SchoolDirectoryColumn[],
  activityCounts: Map<string, number>, assigneeNames: Map<string, string>,
) {
  return schools.map((school) => {
    const common = schoolExportValues(school, activityCounts.get(school.id) ?? 0);
    return columns.map((column) => {
      if (column === "assignedManager") return school.assigned_to ? (assigneeNames.get(school.assigned_to) ?? "담당 계정") : "미배정";
      if (column === "lastActivityAt") return school.last_activity_at ? new Date(school.last_activity_at) : "";
      return common[column as SchoolExportColumn];
    });
  });
}
