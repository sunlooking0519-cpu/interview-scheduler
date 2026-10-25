import { isAdmin } from "../../../../../lib/supabase/admin-role";
import { mobileSupabase } from "@/server/mobile-supabase";
import { saveSalesCard, type NewSalesCard } from "@/server/sales-card-create";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  if (!/^Bearer [^ ]+$/i.test(auth)) return Response.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  const token = auth.slice(7);
  const { client } = mobileSupabase(token);
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user || !isAdmin(user)) return Response.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  if (Number(request.headers.get("content-length") ?? 0) > 30000) return Response.json({ error: "명함 정보가 너무 큽니다." }, { status: 413 });
  let input: NewSalesCard;
  try { input = await request.json(); } catch { return Response.json({ error: "명함 정보를 확인해 주세요." }, { status: 400 }); }
  if (!input || typeof input.organizationId !== "string" || typeof input.name !== "string" || typeof input.kind !== "string"
    || !input.contact || typeof input.contact !== "object" || typeof input.imagePath !== "string" || typeof input.ocrText !== "string") {
    return Response.json({ error: "명함 정보를 확인해 주세요." }, { status: 400 });
  }
  const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  if (!new RegExp(`^${uuid}/${uuid}\\.jpg$`, "i").test(input.imagePath)
    || !input.imagePath.startsWith(`${input.organizationId}/`)) {
    return Response.json({ error: "명함 사진 경로를 확인해 주세요." }, { status: 400 });
  }
  // The image must already exist in the private bucket before writing its database row.
  const owner = await client.storage.from("sales-cards").info(input.imagePath);
  if (owner.error || !owner.data) return Response.json({ error: "명함 사진 업로드를 확인하지 못했습니다." }, { status: 400 });
  const result = await saveSalesCard(client, user, input);
  return Response.json(result, { status: result.error ? 400 : 201, headers: { "Cache-Control": "no-store" } });
}
