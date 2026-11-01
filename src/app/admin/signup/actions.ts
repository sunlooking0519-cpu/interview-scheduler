"use server";

import { createServiceClient } from "../../../../lib/supabase/service";
import { matchingHiredCandidate, type HiredCandidate } from "@/features/admin/promotion-request";

export async function registerInstructor(_previous: { error: string; success: boolean }, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!name || name.length > 80 || phone.length > 20 || !/^\d{9,11}$/.test(phone.replace(/\D/g, "")) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length < 8 || password.length > 128) {
    return { error: "이름·휴대전화·이메일·8자 이상의 비밀번호를 확인해 주세요.", success: false };
  }
  try {
    const service = createServiceClient();
    const { data: candidates, error: candidateError } = await service.schema("scheduler").from("interviews")
      .select("id,name,phone,email,hired_at").eq("name", name).not("hired_at", "is", null).limit(100);
    if (candidateError) return { error: "채용 기록을 확인하지 못했습니다. 관리자에게 문의해 주세요.", success: false };
    const candidate = matchingHiredCandidate((candidates ?? []) as HiredCandidate[], name, phone, email);
    if (!candidate) return { error: "일치하는 채용 기록이 없습니다. 예약할 때 사용한 이름과 휴대전화를 확인해 주세요.", success: false };
    // The account can sign in only after an administrator assigns a trusted app role.
    // Auto-confirming skips the mailbox step; the administrator verifies identity out of band.
    const { error } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { requested_role: "instructor", full_name: name },
      app_metadata: { promotion_candidate_id: String(candidate.id) },
    });
    if (error) return { error: "가입 요청을 처리하지 못했습니다. 이메일과 비밀번호를 확인해 주세요.", success: false };
    return { error: "", success: true };
  } catch {
    return { error: "가입 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.", success: false };
  }
}
