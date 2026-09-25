"use server";

import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";

export type AdminLoginState = { error: string };

export async function loginAdmin(
  _previousState: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name || !email || !password) {
    return { error: "이름, 이메일, 비밀번호를 모두 입력해 주세요." };
  }

  try {
    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      return { error: "등록되지 않은 관리자 정보입니다" };
    }

    const { data: admin, error: profileError } = await supabase
      .from("interviews")
      .select("id, name, email, role")
      .eq("name", name)
      .ilike("email", email)
      .eq("role", "super_admin")
      .maybeSingle();

    if (profileError || !admin) {
      await supabase.auth.signOut();
      return { error: "등록되지 않은 관리자 정보입니다" };
    }
  } catch (error) {
    console.error("Admin login failed", error);
    return { error: "관리자 인증 시스템을 확인할 수 없습니다." };
  }

  redirect("/admin");
}

export async function logoutAdmin() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}