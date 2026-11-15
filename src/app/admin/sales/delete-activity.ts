"use server";

import { revalidatePath } from "next/cache";
import { requireSalesStaff } from "@/server/admin-auth";

type DeleteActivityState = { deleted: boolean; error: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function deleteSalesActivity(_previous: DeleteActivityState, formData: FormData): Promise<DeleteActivityState> {
  const id = String(formData.get("activity_id") ?? "");
  const version = Number(formData.get("edit_version"));
  if (!uuid.test(id) || !Number.isSafeInteger(version) || version < 0)
    return { deleted: false, error: "삭제할 활동을 다시 확인해 주세요." };

  const { user, supabase } = await requireSalesStaff();
  const db = supabase.schema("scheduler");
  const { data: activity, error: activityError } = await db.from("sales_activities")
    .select("organization_id").eq("id", id).maybeSingle();
  if (activityError || !activity) return { deleted: false, error: "활동을 찾지 못했습니다. 화면을 새로고침해 주세요." };
  const { data: organization, error: ownerError } = await db.from("sales_organizations")
    .select("created_by").eq("id", activity.organization_id).maybeSingle();
  if (ownerError || !organization || organization.created_by !== user.id)
    return { deleted: false, error: "본인 기관의 활동만 삭제할 수 있습니다." };

  const { error } = await db.rpc("delete_sales_activity", { p_activity_id: id, p_expected_version: version });
  if (error?.code === "40001") return { deleted: false, error: "다른 수정이 반영됐습니다. 새로고침한 뒤 다시 확인해 주세요." };
  if (error) return { deleted: false, error: "활동을 삭제하지 못했습니다. 삭제 SQL 적용 여부를 확인해 주세요." };
  revalidatePath(`/admin/sales/${activity.organization_id}`);
  revalidatePath("/admin/sales");
  return { deleted: true, error: "" };
}
