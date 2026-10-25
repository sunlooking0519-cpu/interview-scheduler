import { isAdmin } from "../../../../../lib/supabase/admin-role";
import { mobileSupabase } from "@/server/mobile-supabase";

export const runtime = "nodejs";

const headers = { "Cache-Control": "no-store" };
const failure = (message: string, status: number) => Response.json({ error: message }, { status, headers });

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 8192) return failure("요청이 너무 큽니다.", 413);
  let body: { email?: unknown; password?: unknown };
  try { body = await request.json(); } catch { return failure("로그인 정보를 확인해 주세요.", 400); }
  if (typeof body.email !== "string" || typeof body.password !== "string" || body.email.length > 320 || body.password.length > 1024) {
    return failure("로그인 정보를 확인해 주세요.", 400);
  }
  const { client, url, key } = mobileSupabase();
  const { data, error } = await client.auth.signInWithPassword({ email: body.email, password: body.password });
  if (error || !data.user || !data.session || !isAdmin(data.user)) return failure("관리자 계정을 확인해 주세요.", 401);
  return Response.json({ accessToken: data.session.access_token, refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at, storageUrl: `${url}/storage/v1/object/sales-cards`, anonKey: key }, { headers });
}

export async function PUT(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 8192) return failure("요청이 너무 큽니다.", 413);
  let body: { refreshToken?: unknown };
  try { body = await request.json(); } catch { return failure("로그인 정보를 확인해 주세요.", 400); }
  if (typeof body.refreshToken !== "string" || body.refreshToken.length > 4096) return failure("다시 로그인해 주세요.", 401);
  const { client, url, key } = mobileSupabase();
  const { data, error } = await client.auth.refreshSession({ refresh_token: body.refreshToken });
  if (error || !data.session) return failure("다시 로그인해 주세요.", 401);
  const verified = await client.auth.getUser(data.session.access_token);
  if (verified.error || !verified.data.user || !isAdmin(verified.data.user)) return failure("관리자 계정을 확인해 주세요.", 403);
  return Response.json({ accessToken: data.session.access_token, refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at, storageUrl: `${url}/storage/v1/object/sales-cards`, anonKey: key }, { headers });
}
