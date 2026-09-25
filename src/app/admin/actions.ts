"use server";

import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { createAdminSession, deleteAdminSession } from "@/server/admin-session";

export type AdminLoginState = { error: string };

type VerifiedAdmin = {
  admin_id: string;
  admin_name: string;
  admin_role: "super_admin";
};

export async function loginAdmin(
  _previousState: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!name || !password) {
    return { error: "이름과 비밀번호를 모두 입력해 주세요." };
  }

  if (name.length > 60 || password.length > 128) {
    return { error: "등록되지 않은 관리자 정보입니다" };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .rpc("verify_admin_credentials", {
        p_name: name,
        p_password: password,
      })
      .maybeSingle<VerifiedAdmin>();

    if (error || !data || data.admin_role !== "super_admin") {
      return { error: "등록되지 않은 관리자 정보입니다" };
    }

    await createAdminSession(data.admin_id, data.admin_name);
  } catch (error) {
    console.error("Admin login failed", error);
    return { error: "관리자 인증 시스템을 확인할 수 없습니다." };
  }

  redirect("/admin");
}

export async function logoutAdmin() {
  await deleteAdminSession();
  redirect("/");
}