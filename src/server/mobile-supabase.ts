import "server-only";

import { createClient } from "@supabase/supabase-js";

export function mobileSupabase(token?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase 설정이 필요합니다.");
  return {
    url, key,
    client: createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
    }),
  };
}
