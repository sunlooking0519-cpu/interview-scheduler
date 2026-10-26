"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/server/admin-auth";
import { scheduleCalendarSync, syncCalendarQueue } from "@/server/calendar-sync";
import { getCalendarConnection } from "@/server/google-calendar";
import type { SalesCardFields, SalesKind } from "@/features/admin/sales-card-ocr";
import { koreaDateKey } from "@/features/admin/sales-follow-up";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const field = (data: FormData, key: string, max = 2000) => String(data.get(key) ?? "").trim().slice(0, max);
const validId = (id: string) => { if (!uuidPattern.test(id)) throw new Error("잘못된 주소입니다."); return id; };
const salesPath = (id: string) => `/admin/sales/${id}`;
const toKoreaDate = (value: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? new Date(`${value}:00+09:00`) : new Date(NaN);

export async function createSalesLead(input: {
  organizationId: string;
  name: string;
  kind: SalesKind;
  contact: Omit<SalesCardFields, "organization"> & { role?: string };
  imagePath: string;
  ocrText: string;
}) {
  const { user, supabase } = await requireAdmin();
  const organizationId = input.organizationId;
  const name = input.name.trim().replace(/\s+/g, " ");
  const contactInput = input.contact ?? { name: "", title: "", role: "", phone: "", mobile: "", email: "" };
  const contact = Object.fromEntries(
    (["name", "title", "role", "phone", "mobile", "email"] as const).map((key) => [key, String(contactInput[key] ?? "").trim()]),
  ) as Omit<SalesCardFields, "organization"> & { role: string };
  const validPath = !input.imagePath || new RegExp(`^${organizationId}/[0-9a-f-]{36}\\.(jpg|png|webp)$`, "i").test(input.imagePath);
  if (!uuidPattern.test(organizationId) || !name || name.length > 200 || !["institution", "school", "other"].includes(input.kind)
    || contact.name.length > 120 || contact.title.length > 120 || contact.role.length > 200 || contact.phone.length > 80 || contact.mobile.length > 80 || contact.email.length > 200
    || ((contact.title || contact.role || contact.phone || contact.mobile || contact.email) && !contact.name) || !validPath || input.ocrText.length > 20000) {
    return { id: "", error: "기관명, 담당자 정보와 명함 파일을 확인해 주세요." };
  }
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
  if (input.imagePath) {
    const { error } = await db.from("sales_business_cards").insert({
      organization_id: savedOrganizationId, contact_id: contactId, image_path: input.imagePath,
      ocr_text: input.ocrText, ocr_fields: { ...contact, organization: name },
    });
    if (error) {
      if (createdOrganization) await db.from("sales_organizations").delete().eq("id", savedOrganizationId);
      else if (contactId) await db.from("sales_contacts").delete().eq("id", contactId).eq("organization_id", savedOrganizationId);
      return { id: "", error: "명함 저장에 실패했습니다. 다시 시도해 주세요." };
    }
  }
  revalidatePath("/admin/sales");
  revalidatePath(salesPath(savedOrganizationId));
  return { id: savedOrganizationId, error: "" };
}

export async function createOrganization(data: FormData) {
  const { user, supabase } = await requireAdmin();
  const name = field(data, "name", 200).replace(/\s+/g, " ");
  const kind = field(data, "kind");
  if (!name || !["institution", "school", "other"].includes(kind)) throw new Error("기관명과 유형을 확인해 주세요.");
  const db = supabase.schema("scheduler");
  const existing = await db.rpc("find_sales_organization", { p_name: name });
  if (existing.error) throw new Error("기관 중복 정리 SQL을 먼저 실행해 주세요.");
  if (existing.data) redirect(salesPath(existing.data as string));
  const { data: row, error } = await db.from("sales_organizations")
    .insert({ name, kind, created_by: user.id }).select("id").single();
  if (error?.code === "23505") {
    const retry = await db.rpc("find_sales_organization", { p_name: name });
    if (retry.data) redirect(salesPath(retry.data as string));
  }
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
  const priority = field(data, "priority") || "normal";
  const followUpStatus = field(data, "follow_up_status") || "pending";
  const nextActionType = field(data, "next_action_type");
  const nextContactId = field(data, "next_contact_id");
  const nextActionAtValue = field(data, "next_action_at");
  const nextActionAt = nextActionAtValue ? toKoreaDate(nextActionAtValue) : null;
  const interestTags = field(data, "interest_tags", 1000).split(",").map((item) => item.trim()).filter(Boolean).slice(0, 20);
  if (!name || !["institution", "school", "other"].includes(kind) || !["lead", "contacted", "meeting", "proposal", "won", "lost"].includes(stage)
    || !["high", "normal", "low"].includes(priority)
    || !["pending", "waiting_reply", "responded", "paused", "done"].includes(followUpStatus)
    || (nextActionType && !["call", "email", "visit", "proposal", "meeting"].includes(nextActionType))
    || (nextContactId && !uuidPattern.test(nextContactId))
    || (nextActionAt && !Number.isFinite(nextActionAt.getTime()))) throw new Error("필수 항목을 확인해 주세요.");
  const db = supabase.schema("scheduler");
  if (nextContactId) {
    const { data: owner } = await db.from("sales_contacts").select("id").eq("id", nextContactId).eq("organization_id", id).maybeSingle();
    if (!owner) throw new Error("이 기관의 담당자를 선택해 주세요.");
  }
  const { error } = await db.from("sales_organizations").update({
    name, kind, stage, priority, region: field(data, "region", 120), source: field(data, "source", 200),
    interest_tags: interestTags, next_action: field(data, "next_action", 500) || null,
    next_action_type: nextActionType || null, next_action_at: nextActionAt?.toISOString() ?? null,
    next_contact_id: nextContactId || null, follow_up_status: followUpStatus,
    lost_reason: field(data, "lost_reason", 1000) || null,
    website: field(data, "website", 500), address: field(data, "address", 500), notes: field(data, "notes", 10000),
  }).eq("id", id);
  if (error) throw new Error("기관 정보를 저장하지 못했습니다.");
  revalidatePath(salesPath(id));
  revalidatePath("/admin/sales");
}

export async function createSalesActivity(data: FormData) {
  const { supabase } = await requireAdmin();
  const organizationId = validId(field(data, "organization_id"));
  const contactId = field(data, "contact_id");
  const activityType = field(data, "activity_type");
  const reaction = field(data, "reaction") || "neutral";
  const summary = field(data, "summary", 5000);
  const occurredAt = toKoreaDate(field(data, "occurred_at"));
  const followUpRoundValue = field(data, "follow_up_round");
  const followUpRound = followUpRoundValue ? Number(followUpRoundValue) : null;
  const followUpStatus = followUpRound ? field(data, "follow_up_status") || "pending" : null;
  const nextAction = field(data, "next_action", 500);
  const nextActionType = field(data, "next_action_type");
  const nextContactId = field(data, "next_contact_id");
  const nextActionValue = field(data, "next_action_at");
  const nextActionAt = nextActionValue ? toKoreaDate(nextActionValue) : null;
  const stage = field(data, "stage");
  if (!summary || !Number.isFinite(occurredAt.getTime())
    || !["visit", "call", "email", "proposal", "meeting", "note"].includes(activityType)
    || !["interested", "reviewing", "waiting", "neutral", "no_budget", "not_interested", "no_response"].includes(reaction)
    || !["lead", "contacted", "meeting", "proposal", "won", "lost"].includes(stage)
    || (followUpRound !== null && (!Number.isInteger(followUpRound) || followUpRound < 1 || followUpRound > 10))
    || (followUpRound === 1 && activityType !== "email")
    || (followUpStatus !== null && !["pending", "waiting_reply", "responded", "paused", "done"].includes(followUpStatus))
    || (nextActionType && !["call", "email", "visit", "proposal", "meeting"].includes(nextActionType))
    || (nextActionAt && !Number.isFinite(nextActionAt.getTime()))
    || ((nextAction || nextActionAt || nextActionType || nextContactId) && (!nextAction || !nextActionAt || !nextActionType))
    || (["pending", "waiting_reply"].includes(followUpStatus ?? "") && (!nextAction || !nextActionAt || !nextActionType))) throw new Error("활동 내용과 다음 행동을 확인해 주세요.");
  const db = supabase.schema("scheduler");
  for (const id of [contactId, nextContactId].filter(Boolean)) if (!uuidPattern.test(id)) throw new Error("담당자를 다시 선택해 주세요.");
  const { error } = await db.rpc("record_sales_activity", {
    p_organization_id: organizationId,
    p_contact_id: contactId || null,
    p_activity_type: activityType,
    p_reaction: reaction,
    p_summary: summary,
    p_occurred_at: occurredAt.toISOString(),
    p_follow_up_round: followUpRound,
    p_follow_up_status: followUpStatus,
    p_next_action: nextAction || null,
    p_next_action_type: nextActionType || null,
    p_next_action_at: nextActionAt?.toISOString() ?? null,
    p_next_contact_id: nextContactId || null,
    p_stage: stage,
  });
  if (error) throw new Error("영업 활동을 저장하지 못했습니다. 후속관리 마이그레이션을 확인해 주세요.");
  revalidatePath(salesPath(organizationId));
  revalidatePath("/admin/sales");
}

export async function recordCardVisit(_previous: { error: string }, data: FormData): Promise<{ error: string }> {
  const { supabase } = await requireAdmin();
  const cardId = field(data, "card_id");
  const contactId = field(data, "contact_id");
  const visitDate = field(data, "visit_date");
  const summary = field(data, "summary", 5001);
  if (!uuidPattern.test(cardId) || (contactId && !uuidPattern.test(contactId))
    || !/^\d{4}-\d{2}-\d{2}$/.test(visitDate) || !summary || summary.length > 5000) {
    return { error: "방문일, 담당자와 상담 내용을 확인해 주세요." };
  }
  const occurredAt = new Date(`${visitDate}T12:00:00+09:00`);
  if (!Number.isFinite(occurredAt.getTime()) || koreaDateKey(occurredAt) !== visitDate
    || visitDate > koreaDateKey(new Date())) {
    return { error: "올바른 방문일을 입력해 주세요." };
  }
  const db = supabase.schema("scheduler");
  const { data: card, error: cardError } = await db.from("sales_business_cards")
    .select("organization_id").eq("id", cardId).maybeSingle();
  if (cardError || !card) return { error: "명함을 찾지 못했습니다. 목록에서 다시 선택해 주세요." };
  const { data: organization, error: organizationError } = await db.from("sales_organizations")
    .select("stage,next_action,next_action_type,next_action_at,next_contact_id").eq("id", card.organization_id).maybeSingle();
  if (organizationError || !organization) return { error: "기관 정보를 불러오지 못했습니다." };
  if (contactId) {
    const { data: contact, error: contactError } = await db.from("sales_contacts")
      .select("id").eq("id", contactId).eq("organization_id", card.organization_id).maybeSingle();
    if (contactError || !contact) return { error: "이 기관의 담당자를 선택해 주세요." };
  }
  const { error } = await db.rpc("record_sales_activity", {
    p_organization_id: card.organization_id,
    p_contact_id: contactId || null,
    p_activity_type: "visit",
    p_reaction: "neutral",
    p_summary: summary,
    p_occurred_at: occurredAt.toISOString(),
    p_follow_up_round: null,
    p_follow_up_status: null,
    p_next_action: organization.next_action,
    p_next_action_type: organization.next_action_type,
    p_next_action_at: organization.next_action_at,
    p_next_contact_id: organization.next_contact_id,
    p_stage: ["lead", "contacted"].includes(organization.stage) ? "meeting" : organization.stage,
  });
  if (error) return { error: "방문 기록을 저장하지 못했습니다. 다시 시도해 주세요." };
  revalidatePath("/admin/sales");
  revalidatePath(`/admin/sales/${card.organization_id}`);
  redirect("/admin/sales?view=visits&saved=visit");
}

export async function createContact(data: FormData) {
  const { supabase } = await requireAdmin();
  const organization_id = validId(field(data, "organization_id"));
  const name = field(data, "name", 120);
  if (!name) throw new Error("담당자 이름을 입력해 주세요.");
  const { error } = await supabase.schema("scheduler").from("sales_contacts").insert({ organization_id, name, title: field(data, "title", 120), role: field(data, "role", 200), phone: field(data, "phone", 80), mobile: field(data, "mobile", 80), email: field(data, "email", 200), notes: field(data, "notes", 2000) });
  if (error) throw new Error("담당자를 저장하지 못했습니다.");
  revalidatePath(salesPath(organization_id));
}

export async function updateContact(data: FormData) {
  const { supabase } = await requireAdmin();
  const organization_id = validId(field(data, "organization_id"));
  const id = validId(field(data, "id"));
  const name = field(data, "name", 120);
  if (!name) throw new Error("담당자 이름을 입력해 주세요.");
  const { error } = await supabase.schema("scheduler").from("sales_contacts").update({ name, title: field(data, "title", 120), role: field(data, "role", 200), phone: field(data, "phone", 80), mobile: field(data, "mobile", 80), email: field(data, "email", 200), notes: field(data, "notes", 2000) }).eq("id", id).eq("organization_id", organization_id);
  if (error) throw new Error("담당자를 수정하지 못했습니다.");
  revalidatePath(salesPath(organization_id));
}

export async function saveMeeting(data: FormData) {
  const { supabase } = await requireAdmin();
  const organization_id = validId(field(data, "organization_id"));
  const id = field(data, "id");
  const title = field(data, "title", 200);
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

export async function saveBusinessCard(input: { organizationId: string; contactId?: string; imagePath: string; ocrText: string; fields: Record<string, string> }) {
  const { supabase } = await requireAdmin();
  validId(input.organizationId);
  if (!/^([0-9a-f-]{36})\/([0-9a-f-]{36})\.(jpg|png|webp)$/i.test(input.imagePath) || !input.imagePath.startsWith(`${input.organizationId}/`) || input.ocrText.length > 20000) return { error: "명함 파일 경로 또는 OCR 내용을 확인해 주세요." };
  const fields = Object.fromEntries(["name", "organization", "title", "phone", "mobile", "email", "role"].map((key) => [key, String(input.fields[key] ?? "").trim().slice(0, key === "role" ? 200 : 500)]));
  if (!input.contactId && !fields.name) return { error: "새 담당자 이름을 입력해 주세요." };
  const db = supabase.schema("scheduler");
  let contactId: string | null = null;
  let createdContact = false;
  if (input.contactId) {
    if (!uuidPattern.test(input.contactId)) return { error: "담당자를 다시 선택해 주세요." };
    const { data, error } = await db.from("sales_contacts").select("id").eq("id", input.contactId).eq("organization_id", input.organizationId).maybeSingle();
    if (error || !data) return { error: "이 기관의 담당자를 다시 선택해 주세요." };
    contactId = data.id;
  } else if (fields.name) {
    if (fields.name.length > 120 || fields.title.length > 120 || fields.phone.length > 80 || fields.mobile.length > 80 || fields.email.length > 200) return { error: "담당자 정보를 확인해 주세요." };
    const { data, error } = await db.from("sales_contacts").insert({ organization_id: input.organizationId, name: fields.name, title: fields.title, role: fields.role, phone: fields.phone, mobile: fields.mobile, email: fields.email }).select("id").single();
    if (error || !data) return { error: "담당자를 저장하지 못했습니다." };
    contactId = data.id;
    createdContact = true;
  }
  const { error } = await db.from("sales_business_cards").insert({ organization_id: input.organizationId, contact_id: contactId, image_path: input.imagePath, ocr_text: input.ocrText, ocr_fields: fields });
  if (error) {
    if (createdContact && contactId) await db.from("sales_contacts").delete().eq("id", contactId).eq("organization_id", input.organizationId);
    return { error: "명함 정보를 저장하지 못했습니다." };
  }
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
