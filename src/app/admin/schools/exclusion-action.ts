"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/admin-auth";
import { schoolPageSize, schoolUuid } from "@/features/admin/school-filters";

export async function setSchoolExclusion(ids: string[], excluded: boolean): Promise<{ changed: number; error: string }> {
  const failure = (error: string) => ({ changed: 0, error });
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > schoolPageSize
    || ids.some((id) => !schoolUuid.test(id)) || new Set(ids).size !== ids.length
    || typeof excluded !== "boolean") return failure("현재 페이지에서 학교를 다시 선택해 주세요.");
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.schema("scheduler").rpc("set_school_exclusion", {
    p_school_ids: ids, p_excluded: excluded,
  });
  if (error?.code === "40001") return failure("학교 목록이 변경됐습니다. 새로고침 후 다시 시도해 주세요.");
  if (error) return failure("학교 상태를 변경하지 못했습니다. 학교 제외 SQL 적용 여부를 확인해 주세요.");
  revalidatePath("/admin/schools");
  revalidatePath("/admin/members");
  return { changed: Number(data ?? 0), error: "" };
}
