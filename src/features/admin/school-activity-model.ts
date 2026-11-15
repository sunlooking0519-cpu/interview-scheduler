import type { ManagerSchoolActivityRow } from "./components/manager-school-activity";

type School = { id: string; name: string; province: string; district: string };
type Activity = {
  id: string; school_id: string; recorded_by: string; contact_date: string; created_at: string;
  contact_method: string; proposal_status: string | null; reaction: string | null;
  new_note: string | null; change_summary: string;
};

export function groupSchoolActivitiesByRecorder(schools: School[], activities: Activity[]) {
  const schoolById = new Map(schools.map((school) => [school.id, school]));
  const byRecorder = new Map<string, ManagerSchoolActivityRow[]>();
  for (const activity of [...activities].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))) {
    const school = schoolById.get(activity.school_id);
    if (!school) continue;
    const row: ManagerSchoolActivityRow = {
      id: activity.id, schoolId: school.id, schoolName: school.name,
      province: school.province, district: school.district,
      recordedBy: activity.recorded_by, contactDate: activity.contact_date, createdAt: activity.created_at,
      contactMethod: activity.contact_method, proposalStatus: activity.proposal_status,
      reaction: activity.reaction, newNote: activity.new_note, changeSummary: activity.change_summary,
    };
    const records = byRecorder.get(activity.recorded_by) ?? [];
    records.push(row);
    byRecorder.set(activity.recorded_by, records);
  }
  return byRecorder;
}
