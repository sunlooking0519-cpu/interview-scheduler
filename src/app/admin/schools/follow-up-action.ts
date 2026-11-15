"use server";

import { revalidatePath } from "next/cache";
import { requireSalesStaff } from "@/server/admin-auth";
import { schoolUuid } from "@/features/admin/school-filters";

export type SchoolFollowUpInput = {
  schoolId: string;
  contactDate: string;
  updateDate: string;
  contactName: string;
  contactEmail: string;
  contactMethod: string;
  proposalStatus: string;
  reaction: string;
  newNote: string;
};

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const methods = new Set(["visit", "call", "email", "referral"]);
const proposals = new Set(["not_submitted", "planned", "submitted"]);
const reactions = new Set(["interested", "reviewing", "waiting", "neutral", "no_budget", "not_interested", "no_response"]);

export async function saveSchoolFollowUp(input: SchoolFollowUpInput): Promise<{ saved: boolean; error: string }> {
  const fail = (error: string) => ({ saved: false, error });
  const { supabase } = await requireSalesStaff();
  if (!input || !schoolUuid.test(input.schoolId) || !isoDate.test(input.contactDate) || !isoDate.test(input.updateDate)
    || !methods.has(input.contactMethod) || (input.proposalStatus && !proposals.has(input.proposalStatus))
    || (input.reaction && !reactions.has(input.reaction)) || input.contactName.trim().length > 120
    || input.contactEmail.trim().length > 200 || input.newNote.trim().length > 5000) {
    return fail("접촉일, 업데이트 날짜와 입력 내용을 확인해 주세요.");
  }
  const { data, error } = await supabase.schema("scheduler").rpc("record_school_follow_up", {
    p_school_id: input.schoolId,
    p_contact_date: input.contactDate,
    p_update_date: input.updateDate,
    p_contact_name: input.contactName.trim(),
    p_contact_email: input.contactEmail.trim(),
    p_contact_method: input.contactMethod,
    p_proposal_status: input.proposalStatus || null,
    p_reaction: input.reaction || null,
    p_new_note: input.newNote.trim(),
  });
  if (error?.code === "42501") return fail("이 학교의 후속관리 권한이 없습니다. 배정 상태를 확인해 주세요.");
  if (error?.code === "22023") return fail("접촉일, 업데이트 날짜와 입력 내용을 확인해 주세요.");
  if (error) return fail("학교 후속관리를 저장하지 못했습니다. DB 마이그레이션 적용 여부를 확인해 주세요.");
  if (!data) return fail("변경된 내용이 없습니다. 새 기록이나 변경할 상태를 입력해 주세요.");
  revalidatePath("/admin/schools");
  revalidatePath("/admin/members");
  return { saved: true, error: "" };
}
