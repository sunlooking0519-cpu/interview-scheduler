"use server";

import { revalidatePath } from "next/cache";
import { requireSalesStaff } from "@/server/admin-auth";

type DeleteOrganizationState = { deleted: boolean; error: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function deleteEmptySalesOrganization(
  _previous: DeleteOrganizationState,
  formData: FormData,
): Promise<DeleteOrganizationState> {
  const id = String(formData.get("organization_id") ?? "");
  const confirmedName = String(formData.get("organization_name") ?? "").trim();
  if (!uuid.test(id)) return { deleted: false, error: "삭제할 기관을 확인해 주세요." };

  const { user, supabase } = await requireSalesStaff();
  const db = supabase.schema("scheduler");
  const { data: organization, error: loadError } = await db.from("sales_organizations")
    .select("id,name,created_by").eq("id", id).maybeSingle();
  if (loadError || !organization) return { deleted: false, error: "기관을 찾지 못했습니다. 화면을 새로고침해 주세요." };
  if (organization.created_by !== user.id) return { deleted: false, error: "본인 소유 기관만 삭제할 수 있습니다." };
  if (confirmedName !== organization.name) return { deleted: false, error: "기관명을 정확히 입력해 주세요." };

  const relatedTables = ["sales_business_cards", "sales_activities", "sales_meetings", "sales_proposals"] as const;
  for (const table of relatedTables) {
    const { count, error } = await db.from(table).select("id", { count: "exact", head: true }).eq("organization_id", id);
    if (error) return { deleted: false, error: "연결된 기록을 확인하지 못했습니다. 다시 시도해 주세요." };
    if (count) return { deleted: false, error: "명함·활동·미팅·제안서 기록이 있는 기관은 삭제할 수 없습니다." };
  }

  const { data: deleted, error } = await db.from("sales_organizations")
    .delete().eq("id", id).eq("created_by", user.id).select("id").maybeSingle();
  if (error || !deleted) return { deleted: false, error: "기관 삭제에 실패했습니다. 다시 시도해 주세요." };

  revalidatePath("/admin/sales");
  return { deleted: true, error: "" };
}
