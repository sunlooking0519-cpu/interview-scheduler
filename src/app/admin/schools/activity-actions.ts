"use server";

import { revalidatePath } from "next/cache";
import { requireSalesStaff } from "@/server/admin-auth";
import { schoolUuid } from "@/features/admin/school-filters";

export type SchoolActivityCorrection = {
  schoolId: string; activityId: string; expectedVersion: number;
  contactDate: string; updateDate: string; contactName: string;
  contactEmail: string; contactPhone: string; contactMethod: string;
  proposalStatus: string; reaction: string; newNote: string;
};
type ActivityResult = { saved: boolean; error: string };
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const methods = new Set(["visit", "call", "email", "referral"]);
const proposals = new Set(["not_submitted", "planned", "submitted"]);
const reactions = new Set(["interested", "reviewing", "waiting", "neutral", "no_budget", "not_interested", "no_response"]);
const validIdentity = (input: { schoolId: string; activityId: string; expectedVersion: number }) =>
  schoolUuid.test(input.schoolId) && schoolUuid.test(input.activityId)
  && Number.isSafeInteger(input.expectedVersion) && input.expectedVersion >= 0;
const refresh = (id: string) => {
  revalidatePath(`/admin/schools/${id}`);
  revalidatePath("/admin/schools");
  revalidatePath("/admin/members");
};
const rpcError = (code?: string) => {
  if (code === "40001") return "다른 수정이 먼저 반영됐습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.";
  if (code === "42501") return "이 학교의 활동을 수정할 권한이 없습니다. 배정 상태를 확인해 주세요.";
  if (code === "P0002") return "활동을 찾지 못했습니다. 화면을 새로고침해 주세요.";
  if (code === "22023") return "활동 날짜와 입력값을 확인해 주세요.";
  return "활동을 저장하지 못했습니다. DB 변경 SQL 적용 여부를 확인해 주세요.";
};

export async function editSchoolActivity(input: SchoolActivityCorrection): Promise<ActivityResult> {
  if (!input || !validIdentity(input) || !isoDate.test(input.contactDate) || !isoDate.test(input.updateDate)
    || !methods.has(input.contactMethod) || (input.proposalStatus && !proposals.has(input.proposalStatus))
    || (input.reaction && !reactions.has(input.reaction)) || input.contactName.trim().length > 120
    || input.contactEmail.trim().length > 200 || input.contactPhone.trim().length > 80
    || input.newNote.trim().length > 5000) return { saved: false, error: "활동 날짜와 입력값을 확인해 주세요." };
  const { supabase } = await requireSalesStaff();
  const { data, error } = await supabase.schema("scheduler").rpc("edit_school_contact_activity", {
    p_activity_id: input.activityId, p_school_id: input.schoolId, p_expected_version: input.expectedVersion,
    p_contact_date: input.contactDate, p_update_date: input.updateDate,
    p_contact_name: input.contactName.trim(), p_contact_email: input.contactEmail.trim(),
    p_contact_phone: input.contactPhone.trim(), p_contact_method: input.contactMethod,
    p_proposal_status: input.proposalStatus || null, p_reaction: input.reaction || null,
    p_new_note: input.newNote.trim(),
  });
  if (error) return { saved: false, error: rpcError(error.code) };
  if (!data) return { saved: false, error: "변경된 내용이 없습니다." };
  refresh(input.schoolId);
  return { saved: true, error: "" };
}

export async function deleteSchoolActivity(input: Pick<SchoolActivityCorrection, "schoolId" | "activityId" | "expectedVersion">): Promise<ActivityResult> {
  if (!input || !validIdentity(input)) return { saved: false, error: "삭제할 활동을 다시 확인해 주세요." };
  const { supabase } = await requireSalesStaff();
  const { error } = await supabase.schema("scheduler").rpc("delete_school_contact_activity", {
    p_activity_id: input.activityId, p_school_id: input.schoolId, p_expected_version: input.expectedVersion,
  });
  if (error) return { saved: false, error: rpcError(error.code) };
  refresh(input.schoolId);
  return { saved: true, error: "" };
}
