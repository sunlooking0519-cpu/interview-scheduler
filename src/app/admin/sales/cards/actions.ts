"use server";

import { requireSalesStaff } from "@/server/admin-auth";

type DeleteCardState = { deleted: boolean; error: string; photoWarning: string };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function deleteBusinessCard(_previous: DeleteCardState, formData: FormData): Promise<DeleteCardState> {
  const id = String(formData.get("card_id") ?? "");
  if (!uuid.test(id)) return { deleted: false, error: "삭제할 명함을 확인해 주세요.", photoWarning: "" };

  const { user, supabase } = await requireSalesStaff();
  const db = supabase.schema("scheduler");
  const { data: card, error: cardError } = await db.from("sales_business_cards")
    .select("id,organization_id,image_path").eq("id", id).maybeSingle();
  if (cardError || !card) return { deleted: false, error: "명함을 찾지 못했습니다. 목록을 새로고침해 주세요.", photoWarning: "" };

  const { data: organization, error: organizationError } = await db.from("sales_organizations")
    .select("created_by").eq("id", card.organization_id).maybeSingle();
  if (organizationError || !organization) return { deleted: false, error: "명함의 기관 정보를 확인하지 못했습니다.", photoWarning: "" };
  if (organization.created_by !== user.id) {
    return { deleted: false, error: "본인 작업공간에 등록된 명함만 삭제할 수 있습니다.", photoWarning: "" };
  }

  const { data: deleted, error: deleteError } = await db.from("sales_business_cards")
    .delete().eq("id", card.id).eq("organization_id", card.organization_id).select("id").maybeSingle();
  if (deleteError || !deleted) return { deleted: false, error: "명함 삭제에 실패했습니다. 다시 시도해 주세요.", photoWarning: "" };

  const removed = await supabase.storage.from("sales-cards").remove([card.image_path]);
  if (removed.error) {
    console.error("sales-card image cleanup failed", { cardId: card.id, imagePath: card.image_path, error: removed.error });
  }
  return {
    deleted: true,
    error: "",
    photoWarning: removed.error ? `명함 기록은 삭제됐지만 사진 정리에 실패했습니다. Storage 경로: sales-cards/${card.image_path}` : "",
  };
}
