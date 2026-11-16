"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/admin-auth";
import { cleanSchoolFilters, schoolUuid, type SchoolFilters } from "@/features/admin/school-filters";

type AssignInput = {
  scope: "selected" | "filtered";
  ids: string[];
  assigneeId: string | null;
  filters: SchoolFilters;
  expectedCount: number;
};

export async function assignSchools(input: AssignInput): Promise<{ changed: number; error: string }> {
  const failure = (error: string) => ({ changed: 0, error });
  const { user, supabase } = await requireAdmin();
  const db = supabase.schema("scheduler");
  if (!input || !["selected", "filtered"].includes(input.scope)
    || (input.assigneeId !== null && !schoolUuid.test(input.assigneeId))
    || !Number.isSafeInteger(input.expectedCount) || input.expectedCount < 1 || input.expectedCount > 5000) {
    return failure("배정 대상과 담당자를 확인해 주세요.");
  }
  const filters = cleanSchoolFilters(input.filters ?? {});
  let schoolIds: string[] = [];
  if (input.scope === "selected") {
    if (!Array.isArray(input.ids) || input.ids.length !== input.expectedCount
      || input.ids.some((id) => !schoolUuid.test(id)) || new Set(input.ids).size !== input.ids.length) {
      return failure("선택한 학교를 다시 확인해 주세요.");
    }
    schoolIds = input.ids;
  } else {
    for (let offset = 0; offset < 5000; offset += 1000) {
      let query = db.from("schools").select("id").order("id").range(offset, offset + 999);
      if (filters.province) query = query.eq("province", filters.province);
      if (filters.district) query = query.eq("district", filters.district);
      if (filters.level) query = query.eq("level", filters.level);
      if (filters.q) query = query.ilike("name", `%${filters.q}%`);
      if (filters.assignment === "unassigned") query = query.is("assigned_to", null);
      else if (filters.assignment === "mine") query = query.eq("assigned_to", user.id);
      else if (schoolUuid.test(filters.assignment)) query = query.eq("assigned_to", filters.assignment);
      if (filters.view === "active") query = query.not("last_activity_at", "is", null);
      if (filters.view === "excluded") query = query.not("excluded_at", "is", null);
      if (filters.view === "additional") query = query.not("additional_proposal_at", "is", null);
      const { data, error } = await query;
      if (error) return failure("학교 목록을 다시 확인하지 못했습니다.");
      schoolIds.push(...(data ?? []).map((school) => school.id));
      if ((data ?? []).length < 1000) break;
    }
    if (schoolIds.length !== input.expectedCount) return failure("검색 결과가 변경됐습니다. 새로고침 후 다시 배정해 주세요.");
  }

  const { data, error } = await db.rpc("assign_schools", {
    p_school_ids: schoolIds,
    p_assignee_id: input.assigneeId,
  });
  if (error?.code === "40001") return failure("학교 목록이 변경됐습니다. 새로고침 후 다시 배정해 주세요.");
  if (error) return failure("배정하지 못했습니다. 학교관리 SQL 적용 여부와 담당자 권한을 확인해 주세요.");
  revalidatePath("/admin/schools");
  revalidatePath("/admin/members");
  return { changed: Number(data ?? 0), error: "" };
}
