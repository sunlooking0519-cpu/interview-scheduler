"use server";

import { createClient } from "@supabase/supabase-js";

export async function registerInstructor(_previous: { error: string; success: boolean }, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!name || name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length < 8 || password.length > 128) {
    return { error: "이름·이메일·8자 이상의 비밀번호를 확인해 주세요.", success: false };
  }
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Auth configuration missing");
    // A separate client keeps any administrator session in this browser untouched.
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { requested_role: "instructor", full_name: name } } });
    if (error) return { error: "가입 요청을 처리하지 못했습니다. 이메일과 비밀번호를 확인해 주세요.", success: false };
    return { error: "", success: true };
  } catch {
    return { error: "가입 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.", success: false };
  }
}
