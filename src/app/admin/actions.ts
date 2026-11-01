"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "../../../lib/supabase/server";
import { isInterviewStaff } from "../../../lib/supabase/admin-role";

export type AdminLoginState = { error: string; success?: boolean };

export async function loginAdmin(
  _previousState: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length > 128) {
    return { error: "이메일과 비밀번호를 확인해 주세요." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error?.code === "email_not_confirmed") {
      return { error: "계정의 이메일 확인 상태가 남아 있습니다. 관리자에게 계정 상태를 확인해 달라고 요청해 주세요." };
    }
    if (error?.code === "over_request_rate_limit") {
      return { error: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요." };
    }
    if (error?.code === "user_banned") {
      return { error: "이 계정은 현재 로그인이 제한되어 있습니다. 최고관리자에게 문의해 주세요. (user_banned)" };
    }
    if (error?.code && error.code !== "invalid_credentials") {
      const code = /^[a-z0-9_]{1,64}$/.test(error.code) ? error.code : "unknown";
      return { error: `인증 서비스가 로그인을 거절했습니다. 최고관리자에게 오류 코드를 알려주세요. (${code})` };
    }
    if (error || !data.user || !data.session) {
      return { error: "이메일 또는 비밀번호가 올바르지 않습니다. (invalid_credentials)" };
    }
    if (!isInterviewStaff(data.user)) {
      await supabase.auth.signOut({ scope: "local" });
      return { error: "승인된 관리자 또는 강사 계정이 아닙니다." };
    }
  } catch {
    return { error: "인증 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/admin", "layout");
  return { error: "", success: true };
}

export async function logoutAdmin() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw new Error("로그아웃에 실패했습니다. 잠시 후 다시 시도해 주세요.");
  revalidatePath("/admin", "layout");
  redirect("/admin/login");
}
