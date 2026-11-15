import { methodLabels, proposalLabels, reactionLabels } from "./school-contact-labels";

export const schoolExportColumns = [
  ["name", "학교명"], ["province", "광역지역"], ["district", "지역"],
  ["level", "학교급"], ["phone", "학교 대표전화"],
  ["contactName", "학교 담당자"], ["contactPhone", "담당자 전화번호"],
  ["contactEmail", "담당자 이메일"], ["contactDate", "최근 접촉일"],
  ["updatedDate", "최근 업데이트"], ["contactMethod", "접촉 방식"],
  ["proposalStatus", "제안서 제출"], ["reaction", "반응"],
  ["notes", "특이사항 · 상담 내용"], ["activityCount", "활동 기록 수"],
  ["sourceLoadedOn", "학교 자료 기준일"], ["assignedAt", "배정일"],
] as const;
export type SchoolExportColumn = (typeof schoolExportColumns)[number][0];

export type SchoolExportRecord = {
  id: string; name: string; province: string; district: string; level: string;
  phone: string; contact_name: string | null; contact_phone: string | null;
  contact_email: string | null; contact_date: string | null;
  management_updated_on: string | null; contact_method: string | null;
  proposal_status: string | null; reaction: string | null; notes: string | null;
  source_loaded_on: string | null; assigned_at: string | null;
};
export type SchoolExportActivity = {
  id: string; school_id: string; contact_date: string; update_date: string;
  contact_name: string | null; contact_phone: string | null; contact_email: string | null;
  contact_method: string; proposal_status: string | null; reaction: string | null;
  new_note: string | null; created_at: string; edited_at: string | null;
};

const asDate = (value: string | null) => value ? new Date(`${value}T00:00:00Z`) : "";
const label = (value: string | null, labels: Record<string, string>) => value ? (labels[value] ?? value) : "미기록";

export function buildSchoolExportRows(schools: SchoolExportRecord[], activities: SchoolExportActivity[], columns: SchoolExportColumn[]) {
  const activityCount = new Map<string, number>();
  for (const activity of activities) activityCount.set(activity.school_id, (activityCount.get(activity.school_id) ?? 0) + 1);
  return schools.map((school) => {
    const values: Record<SchoolExportColumn, string | number | Date> = {
      name: school.name, province: school.province, district: school.district, level: school.level,
      phone: school.phone, contactName: school.contact_name ?? "", contactPhone: school.contact_phone ?? "",
      contactEmail: school.contact_email ?? "", contactDate: asDate(school.contact_date),
      updatedDate: asDate(school.management_updated_on),
      contactMethod: label(school.contact_method, methodLabels),
      proposalStatus: label(school.proposal_status, proposalLabels),
      reaction: label(school.reaction, reactionLabels), notes: school.notes ?? "",
      activityCount: activityCount.get(school.id) ?? 0,
      sourceLoadedOn: asDate(school.source_loaded_on),
      assignedAt: school.assigned_at ? new Date(school.assigned_at) : "",
    };
    return columns.map((column) => values[column]);
  });
}

export function buildSchoolActivityRows(schools: SchoolExportRecord[], activities: SchoolExportActivity[]) {
  const schoolById = new Map(schools.map((school) => [school.id, school]));
  return activities.map((activity) => {
    const school = schoolById.get(activity.school_id);
    return [
      school?.name ?? "", school?.province ?? "", school?.district ?? "", asDate(activity.contact_date),
      label(activity.contact_method, methodLabels), activity.contact_name ?? "", activity.contact_phone ?? "",
      activity.contact_email ?? "", label(activity.proposal_status, proposalLabels),
      label(activity.reaction, reactionLabels), activity.new_note ?? "", asDate(activity.update_date),
      new Date(activity.created_at), activity.edited_at ? new Date(activity.edited_at) : "",
    ];
  });
}
