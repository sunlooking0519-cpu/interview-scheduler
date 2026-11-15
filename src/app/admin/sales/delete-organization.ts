"use server";

import { revalidatePath } from "next/cache";
import { requireSalesStaff } from "@/server/admin-auth";
import { scheduleCalendarSync } from "@/server/calendar-sync";

export type OrganizationDeletionCounts = {
  contacts: number; cards: number; activities: number; meetings: number;
  proposals: number; revisions: number; proposal_versions: number;
};
export type OrganizationDeletionPreview = {
  id: string; name: string; counts: OrganizationDeletionCounts;
  contacts: string[]; cards: string[]; activities: string[]; meetings: string[]; proposals: string[];
  cardImages: { name: string; url: string }[];
};
type DeleteOrganizationState = { deleted: boolean; error: string; photoWarning: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const countKeys = ["contacts", "cards", "activities", "meetings", "proposals", "revisions", "proposal_versions"] as const;

export async function getSalesOrganizationDeletionPreview(id: string, name: string): Promise<{ preview: OrganizationDeletionPreview | null; error: string }> {
  const { user, supabase } = await requireSalesStaff();
  const db = supabase.schema("scheduler");
  let organizationId = id;
  if (!uuid.test(organizationId)) {
    console.warn("sales deletion preview received invalid organization id", { id, name });
    if (!name || name.length > 200) return { preview: null, error: "기관을 확인해 주세요." };
    const { data: matches, error: lookupError } = await db.from("sales_organizations")
      .select("id").eq("created_by", user.id).eq("name", name).limit(2);
    if (lookupError || matches?.length !== 1) return { preview: null, error: "기관을 하나로 특정하지 못했습니다. 기관 상세에서 다시 시도해 주세요." };
    organizationId = matches[0].id;
  }
  const { data: owner, error: ownerError } = await db.from("sales_organizations")
    .select("created_by").eq("id", organizationId).maybeSingle();
  if (ownerError || !owner) return { preview: null, error: "기관을 찾지 못했습니다." };
  if (owner.created_by !== user.id) return { preview: null, error: "본인 소유 기관만 삭제할 수 있습니다." };
  const { data, error } = await db.rpc("preview_sales_organization_deletion", { p_organization_id: organizationId });
  if (error || !data) return { preview: null, error: "삭제 영향을 불러오지 못했습니다. 삭제 SQL 적용 여부를 확인해 주세요." };
  const details = data as Omit<OrganizationDeletionPreview, "id" | "cardImages">;
  const { data: cards, error: cardsError } = await db.from("sales_business_cards")
    .select("image_path").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(20);
  if (cardsError) return { preview: null, error: "명함 사진을 확인하지 못했습니다. 다시 시도해 주세요." };
  const cardImages = await Promise.all((cards ?? []).map(async (card, index) => ({
    name: details.cards[index] ?? "명함",
    url: (await supabase.storage.from("sales-cards").createSignedUrl(card.image_path, 60 * 5)).data?.signedUrl ?? "",
  })));
  return { preview: { ...details, id: organizationId, cardImages }, error: "" };
}

export async function deleteSalesOrganization(
  _previous: DeleteOrganizationState,
  formData: FormData,
): Promise<DeleteOrganizationState> {
  const failure = (error: string): DeleteOrganizationState => ({ deleted: false, error, photoWarning: "" });
  const id = String(formData.get("organization_id") ?? "");
  const confirmedName = String(formData.get("organization_name") ?? "").trim();
  if (!uuid.test(id) || !confirmedName) return failure("기관명을 정확히 입력해 주세요.");
  let expectedCounts: OrganizationDeletionCounts;
  try {
    const parsed = JSON.parse(String(formData.get("expected_counts") ?? "")) as OrganizationDeletionCounts;
    if (countKeys.some((key) => !Number.isSafeInteger(parsed[key]) || parsed[key] < 0)) throw new Error("Invalid counts");
    expectedCounts = Object.fromEntries(countKeys.map((key) => [key, parsed[key]])) as OrganizationDeletionCounts;
  } catch { return failure("삭제 영향을 다시 확인해 주세요."); }

  const { user, supabase } = await requireSalesStaff();
  const db = supabase.schema("scheduler");
  const { data: organization, error: ownerError } = await db.from("sales_organizations")
    .select("name,created_by").eq("id", id).maybeSingle();
  if (ownerError || !organization) return failure("기관을 찾지 못했습니다. 목록을 새로고침해 주세요.");
  if (organization.created_by !== user.id) return failure("본인 소유 기관만 삭제할 수 있습니다.");
  if (organization.name !== confirmedName) return failure("기관명을 정확히 입력해 주세요.");

  const { data, error } = await db.rpc("delete_sales_organization", {
    p_organization_id: id, p_confirmed_name: confirmedName, p_expected_counts: expectedCounts,
  });
  if (error?.code === "40001") return failure("삭제 영향을 확인한 뒤 기록이 변경됐습니다. 창을 닫고 다시 확인해 주세요.");
  if (error) return failure("기관을 삭제하지 못했습니다. 삭제 SQL 적용 여부와 연결 상태를 확인해 주세요.");

  const imagePaths = Array.isArray(data) ? data.filter((path): path is string => typeof path === "string") : [];
  const failedPaths: string[] = [];
  for (let offset = 0; offset < imagePaths.length; offset += 100) {
    const paths = imagePaths.slice(offset, offset + 100);
    const removed = await supabase.storage.from("sales-cards").remove(paths);
    if (removed.error) failedPaths.push(...paths);
  }
  if (failedPaths.length) console.error("sales organization image cleanup failed", { organizationId: id, paths: failedPaths });
  revalidatePath("/admin/sales");
  revalidatePath("/admin/sales/cards");
  if (expectedCounts.meetings > 0) scheduleCalendarSync();
  return { deleted: true, error: "", photoWarning: failedPaths.length ? `기관 기록은 삭제됐지만 명함 사진 ${failedPaths.length}장의 Storage 정리에 실패했습니다. 관리자에게 확인을 요청해 주세요.` : "" };
}
