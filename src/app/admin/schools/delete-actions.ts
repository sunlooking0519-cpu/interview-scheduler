"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/admin-auth";
import { schoolUuid } from "@/features/admin/school-filters";

export type SchoolDeletionActivity = {
  date: string; method: string; summary: string; note: string;
};
export type SchoolDeletionItem = {
  id: string; name: string; province: string; district: string; level: string;
  assignedTo: string | null; contactName: string | null; contactDate: string | null;
  managementUpdatedOn: string | null; notes: string; assignmentHistory: number;
  contactHistory: number; activeActivities: number; revisions: number;
  recentActivities: SchoolDeletionActivity[];
};
export type SchoolDeletionPreview = { schools: SchoolDeletionItem[]; fingerprint: string };

const validIds = (ids: string[]) => Array.isArray(ids) && ids.length > 0 && ids.length <= 25
  && ids.every((id) => schoolUuid.test(id)) && new Set(ids).size === ids.length;

export async function previewSchoolDeletion(ids: string[]): Promise<{ preview: SchoolDeletionPreview | null; error: string }> {
  if (!validIds(ids)) return { preview: null, error: "현재 페이지에서 삭제할 학교를 다시 선택해 주세요." };
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.schema("scheduler").rpc("preview_school_deletion", { p_school_ids: ids });
  if (error?.code === "40001") return { preview: null, error: "선택한 학교가 변경됐습니다. 목록을 새로고침해 주세요." };
  if (error || !data) return { preview: null, error: "삭제 영향을 확인하지 못했습니다. 학교 삭제 SQL 적용 여부를 확인해 주세요." };
  const preview = data as SchoolDeletionPreview;
  if (!Array.isArray(preview.schools) || preview.schools.length !== ids.length || !/^[0-9a-f]{32}$/.test(preview.fingerprint))
    return { preview: null, error: "삭제 영향 정보가 올바르지 않습니다. 다시 시도해 주세요." };
  return { preview, error: "" };
}

export async function deleteSelectedSchools(ids: string[], fingerprint: string): Promise<{ deleted: number; error: string }> {
  const failure = (error: string) => ({ deleted: 0, error });
  if (!validIds(ids) || !/^[0-9a-f]{32}$/.test(fingerprint)) return failure("삭제 영향을 다시 확인해 주세요.");
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.schema("scheduler").rpc("delete_selected_schools", {
    p_school_ids: ids, p_fingerprint: fingerprint,
  });
  if (error?.code === "40001") return failure("미리보기 후 학교 또는 연결 기록이 변경됐습니다. 창을 닫고 다시 확인해 주세요.");
  if (error) return failure("학교를 삭제하지 못했습니다. 연결 기록과 학교 삭제 SQL 적용 여부를 확인해 주세요.");
  revalidatePath("/admin/schools");
  revalidatePath("/admin/members");
  return { deleted: Number(data ?? 0), error: "" };
}
