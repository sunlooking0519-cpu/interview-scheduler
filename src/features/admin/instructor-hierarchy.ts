export type StaffAccount = {
  id: string; email: string; name: string; role: string;
  requestedRole: string; createdAt: string;
  promotionCandidateId?: string;
};

export type HiredTeacher = {
  id: string | number; name: string; email: string | null; phone: string;
  interview_date: string; hired_at: string; hired_by: string | null;
};

export function buildInstructorHierarchy(accounts: StaffAccount[], teachers: HiredTeacher[]) {
  const topAdministrators = accounts.filter((account) => ["admin", "super_admin"].includes(account.role));
  const middleManagers = accounts.filter((account) => account.role === "instructor");
  const requests = accounts.filter((account) => account.requestedRole === "instructor" && account.role !== "instructor" && !["admin", "super_admin"].includes(account.role));
  const topIds = new Set(topAdministrators.map((account) => account.id));
  const teachersByRecruiter = new Map<string, HiredTeacher[]>();
  for (const teacher of teachers) {
    if (!teacher.hired_by) continue;
    teachersByRecruiter.set(teacher.hired_by, [...(teachersByRecruiter.get(teacher.hired_by) ?? []), teacher]);
  }
  const formerManagers = requests.filter((account) => teachersByRecruiter.has(account.id));
  const directHires = teachers.filter((teacher) => teacher.hired_by && topIds.has(teacher.hired_by));
  const shownRecruiterIds = new Set([...topAdministrators, ...middleManagers, ...formerManagers].map((account) => account.id));
  const unattributedHires = teachers.filter((teacher) => !teacher.hired_by || !shownRecruiterIds.has(teacher.hired_by));
  return { topAdministrators, middleManagers, formerManagers, requests, teachersByRecruiter, directHires, unattributedHires };
}
