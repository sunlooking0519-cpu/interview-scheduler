import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import type { SalesCardFields, SalesKind } from "@/features/admin/sales-card-ocr";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type NewSalesCard = {
  organizationId: string;
  name: string;
  kind: SalesKind;
  contact: Omit<SalesCardFields, "organization"> & { role?: string };
  imagePath: string;
  ocrText: string;
};

export async function saveSalesCard(supabase: SupabaseClient, user: User, input: NewSalesCard) {
  const organizationId = input.organizationId;
  const name = input.name.trim().replace(/\s+/g, " ");
  const contactInput = input.contact ?? { name: "", title: "", role: "", phone: "", mobile: "", email: "" };
  const contact = Object.fromEntries(
    (["name", "title", "role", "phone", "mobile", "email"] as const).map((key) => [key, String(contactInput[key] ?? "").trim()]),
  ) as Omit<SalesCardFields, "organization"> & { role: string };
  const validPath = new RegExp(`^${organizationId}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.jpg$`, "i").test(input.imagePath);
  if (!uuid.test(organizationId) || !validPath) return { id: "", error: "명함 사진 경로를 확인해 주세요." };
  if (!name || name.length > 200 || !["institution", "school", "other"].includes(input.kind)) {
    return { id: "", error: "기관명과 유형을 확인해 주세요." };
  }
  if (contact.name.length > 120 || contact.title.length > 120 || contact.role.length > 200 || contact.phone.length > 80
    || contact.mobile.length > 80 || contact.email.length > 200 || ((contact.title || contact.role || contact.phone || contact.mobile || contact.email) && !contact.name)) {
    return { id: "", error: "담당자 정보를 확인해 주세요." };
  }
  if (input.ocrText.length > 20000) return { id: "", error: "인식한 글자가 너무 많습니다. 다시 스캔해 주세요." };

  const db = supabase.schema("scheduler");
  const findOrganization = () => db.rpc("find_sales_organization", { p_name: name });
  const lookup = await findOrganization();
  if (lookup.error) return { id: "", error: "기존 기관을 확인하지 못했습니다. 기관 중복 정리 SQL을 먼저 실행해 주세요." };
  let savedOrganizationId = lookup.data as string | null;
  let createdOrganization = false;
  if (!savedOrganizationId) {
    const { error } = await db.from("sales_organizations").insert({ id: organizationId, name, kind: input.kind, created_by: user.id });
    if (error?.code === "23505") {
      const retry = await findOrganization();
      if (retry.error || !retry.data) return { id: "", error: "기관 등록이 겹쳤습니다. 다시 시도해 주세요." };
      savedOrganizationId = retry.data as string;
    } else if (error) {
      return { id: "", error: "영업 대상을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." };
    } else {
      savedOrganizationId = organizationId;
      createdOrganization = true;
    }
  }

  let contactId: string | null = null;
  if (contact.name) {
    const { data, error } = await db.from("sales_contacts").insert({ organization_id: savedOrganizationId, ...contact }).select("id").single();
    if (error || !data) {
      if (createdOrganization) await db.from("sales_organizations").delete().eq("id", savedOrganizationId);
      return { id: "", error: "담당자 저장에 실패했습니다. 다시 시도해 주세요." };
    }
    contactId = data.id;
  }
  const { data: savedCard, error } = await db.from("sales_business_cards").insert({
    organization_id: savedOrganizationId, contact_id: contactId, image_path: input.imagePath,
    ocr_text: input.ocrText, ocr_fields: { ...contact, organization: name },
  }).select("id").single();
  if (error || !savedCard) {
    if (createdOrganization) await db.from("sales_organizations").delete().eq("id", savedOrganizationId);
    else if (contactId) await db.from("sales_contacts").delete().eq("id", contactId).eq("organization_id", savedOrganizationId);
    return { id: "", error: "명함 저장에 실패했습니다. 다시 시도해 주세요." };
  }
  revalidatePath("/admin/sales");
  revalidatePath("/admin/sales/cards");
  revalidatePath(`/admin/sales/${savedOrganizationId}`);
  return { id: savedOrganizationId, cardId: savedCard.id as string, error: "" };
}
