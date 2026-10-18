"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/server/admin-auth";
import { scheduleCalendarSync, syncCalendarQueue } from "@/server/calendar-sync";
import { getCalendarConnection } from "@/server/google-calendar";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const field = (data: FormData, key: string, max = 2000) => String(data.get(key) ?? "").trim().slice(0, max);
const validId = (id: string) => { if (!uuidPattern.test(id)) throw new Error("잘못된 주소입니다."); return id; };
const salesPath = (id: string) => `/admin/sales/${id}`;

export async function createOrganization(data: FormData) {
  const { user, supabase } = await requireAdmin();
  const name = field(data, "name", 200);
  const kind = field(data, "kind");
  if (!name || !["institution", "school", "other"].includes(kind)) throw new Error("기관명과 유형을 확인해 주세요.");
  const { data: row, error } = await supabase.schema("scheduler").from("sales_organizations")
    .insert({ name, kind, created_by: user.id }).select("id").single();
  if (error || !row) throw new Error("기관을 저장하지 못했습니다. 영업관리 SQL 마이그레이션을 확인해 주세요.");
  revalidatePath("/admin/sales");
  redirect(salesPath(row.id));
}

export async function updateOrganization(data: FormData) {
  const { supabase } = await requireAdmin();
  const id = validId(field(data, "id"));
  const name = field(data, "name", 200);
  const kind = field(data, "kind");
  const stage = field(data, "stage");
  if (!name || !["institution", "school", "other"].includes(kind) || !["lead", "contacted", "meeting", "proposal", "won", "lost"].includes(stage)) throw new Error("필수 항목을 확인해 주세요.");
  const { error } = await supabase.schema("scheduler").from("sales_organizations").update({ name, kind, stage, website: field(data, "website", 500), address: field(data, "address", 500), notes: field(data, "notes", 10000) }).eq("id", id);
  if (error) throw new Error("기관 정보를 저장하지 못했습니다.");
  revalidatePath(salesPath(id));
  revalidatePath("/admin/sales");
}

export async function createContact(data: FormData) {
  const { supabase } = await requireAdmin();
  const organization_id = validId(field(data, "organization_id"));
  const name = field(data, "name", 120);
  if (!name) throw new Error("담당자 이름을 입력해 주세요.");
  const { error } = await supabase.schema("scheduler").from("sales_contacts").insert({ organization_id, name, title: field(data, "title", 120), phone: field(data, "phone", 80), email: field(data, "email", 200), notes: field(data, "notes", 2000) });
  if (error) throw new Error("담당자를 저장하지 못했습니다.");
  revalidatePath(salesPath(organization_id));
}

export async function updateContact(data: FormData) {
  const { supabase } = await requireAdmin();
  const organization_id = validId(field(data, "organization_id"));
  const id = validId(field(data, "id"));
  const name = field(data, "name", 120);
  if (!name) throw new Error("담당자 이름을 입력해 주세요.");
  const { error } = await supabase.schema("scheduler").from("sales_contacts").update({ name, title: field(data, "title", 120), phone: field(data, "phone", 80), email: field(data, "email", 200), notes: field(data, "notes", 2000) }).eq("id", id).eq("organization_id", organization_id);
  if (error) throw new Error("담당자를 수정하지 못했습니다.");
  revalidatePath(salesPath(organization_id));
}

export async function saveMeeting(data: FormData) {
  const { supabase } = await requireAdmin();
  const organization_id = validId(field(data, "organization_id"));
  const id = field(data, "id");
  const title = field(data, "title", 200);
  const toKoreaDate = (value: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? new Date(`${value}:00+09:00`) : new Date(NaN);
  const start = toKoreaDate(field(data, "starts_at"));
  const end = toKoreaDate(field(data, "ends_at"));
  const status = field(data, "status") || "scheduled";
  const contact = field(data, "contact_id");
  if (!title || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || !["scheduled", "completed", "cancelled"].includes(status)) throw new Error("미팅 제목과 시간을 확인해 주세요.");
  if (contact && !uuidPattern.test(contact)) throw new Error("담당자를 확인해 주세요.");
  if (contact) {
    const { data: owner } = await supabase.schema("scheduler").from("sales_contacts").select("id").eq("id", contact).eq("organization_id", organization_id).maybeSingle();
    if (!owner) throw new Error("이 기관의 담당자를 선택해 주세요.");
  }
  const payload = { organization_id, contact_id: contact || null, title, starts_at: start.toISOString(), ends_at: end.toISOString(), location: field(data, "location", 500), notes: field(data, "notes", 5000), status };
  const query = supabase.schema("scheduler").from("sales_meetings");
  const { error } = id ? await query.update(payload).eq("id", validId(id)).eq("organization_id", organization_id) : await query.insert(payload);
  if (error) throw new Error("미팅을 저장하지 못했습니다.");
  revalidatePath(salesPath(organization_id));
  scheduleCalendarSync();
}

export async function createProposal(data: FormData) {
  const { supabase } = await requireAdmin();
  const organization_id = validId(field(data, "organization_id"));
  const title = field(data, "title", 200);
  if (!title) throw new Error("제안서 제목을 입력해 주세요.");
  const { error } = await supabase.schema("scheduler").from("sales_proposals").insert({ organization_id, title });
  if (error) throw new Error("제안서를 만들지 못했습니다.");
  revalidatePath(salesPath(organization_id));
}

export async function saveProposal(id: string, expectedRevision: number, title: string, body: string) {
  const { supabase } = await requireAdmin();
  validId(id);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1 || !title.trim() || title.length > 200 || body.length > 100000) return { error: "제안서 내용을 확인해 주세요.", revision: expectedRevision };
  const { data, error } = await supabase.schema("scheduler").from("sales_proposals")
    .update({ title: title.trim(), body, revision_number: expectedRevision + 1, updated_at: new Date().toISOString() })
    .eq("id", id).eq("revision_number", expectedRevision).select("revision_number,organization_id").maybeSingle();
  if (error) return { error: "제안서를 저장하지 못했습니다.", revision: expectedRevision };
  if (!data) return { error: "다른 곳에서 수정되었습니다. 새로고침 후 다시 편집해 주세요.", revision: expectedRevision };
  revalidatePath(salesPath(data.organization_id));
  return { error: "", revision: data.revision_number as number };
}

export async function restoreProposalVersion(proposalId: string, versionId: string, expectedRevision: number) {
  const { supabase } = await requireAdmin();
  validId(proposalId); validId(versionId);
  const { data, error } = await supabase.schema("scheduler").from("sales_proposal_versions").select("title,body").eq("id", versionId).eq("proposal_id", proposalId).single();
  if (error || !data) return { error: "복원할 버전을 찾지 못했습니다.", revision: expectedRevision };
  return saveProposal(proposalId, expectedRevision, data.title, data.body);
}

export async function saveBusinessCard(input: { organizationId: string; imagePath: string; ocrText: string; fields: Record<string, string> }) {
  const { supabase } = await requireAdmin();
  validId(input.organizationId);
  if (!/^([0-9a-f-]{36})\/([0-9a-f-]{36})\.(jpg|png|webp)$/i.test(input.imagePath) || !input.imagePath.startsWith(`${input.organizationId}/`) || input.ocrText.length > 20000) return { error: "명함 파일 경로 또는 OCR 내용을 확인해 주세요." };
  const fields = Object.fromEntries(["name", "organization", "title", "phone", "email"].map((key) => [key, String(input.fields[key] ?? "").trim().slice(0, 500)]));
  const { error } = await supabase.schema("scheduler").from("sales_business_cards").insert({ organization_id: input.organizationId, image_path: input.imagePath, ocr_text: input.ocrText, ocr_fields: fields });
  if (error) return { error: "명함 정보를 저장하지 못했습니다." };
  revalidatePath(salesPath(input.organizationId));
  return { error: "" };
}

export async function retrySalesCalendarSync() {
  await requireAdmin();
  let result: "done" | "retry" | "error" = "error";
  try {
    if (await getCalendarConnection()) {
      const sync = await syncCalendarQueue();
      result = sync.failed ? "retry" : "done";
    }
  } catch { /* Keep pending jobs for the next attempt. */ }
  redirect(`/admin/sales?sync=${result}`);
}
