import { isAdmin } from "../../../../../lib/supabase/admin-role";
import { mobileSupabase } from "@/server/mobile-supabase";
import { saveSalesCard, type NewSalesCard } from "@/server/sales-card-create";

export const runtime = "nodejs";

const cardPath = new RegExp(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.jpg$`, "i");

export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  if (!/^Bearer [^ ]+$/i.test(auth)) return Response.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  const token = auth.slice(7);
  const { client } = mobileSupabase(token);
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user || !isAdmin(user)) return Response.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  const imagePath = new URL(request.url).searchParams.get("imagePath") ?? "";
  if (!cardPath.test(imagePath)) return Response.json({ error: "명함 경로를 확인해 주세요." }, { status: 400 });
  const found = await client.schema("scheduler").from("sales_business_cards")
    .select("id,organization_id").eq("image_path", imagePath).maybeSingle();
  if (found.error) return Response.json({ error: "DB 저장 결과를 확인하지 못했습니다." }, { status: 503 });
  return Response.json({ found: !!found.data, cardId: found.data?.id ?? "", organizationId: found.data?.organization_id ?? "" },
    { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  if (!/^Bearer [^ ]+$/i.test(auth)) return Response.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  const token = auth.slice(7);
  const { client } = mobileSupabase(token);
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user || !isAdmin(user)) return Response.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  let imagePath = "";
  try { imagePath = String((await request.json()).imagePath ?? ""); }
  catch { return Response.json({ error: "명함 경로를 확인해 주세요." }, { status: 400 }); }
  if (!cardPath.test(imagePath)) return Response.json({ error: "명함 경로를 확인해 주세요." }, { status: 400 });
  const linked = await client.schema("scheduler").from("sales_business_cards")
    .select("id").eq("image_path", imagePath).maybeSingle();
  if (linked.error) return Response.json({ error: "DB 연결을 확인하지 못했습니다." }, { status: 503 });
  if (linked.data) return Response.json({ error: "등록된 명함 사진은 삭제할 수 없습니다." }, { status: 409 });
  const removed = await client.storage.from("sales-cards").remove([imagePath]);
  if (removed.error) return Response.json({ error: "임시 사진 정리에 실패했습니다." }, { status: 503 });
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

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
  if (!cardPath.test(input.imagePath)
    || !input.imagePath.startsWith(`${input.organizationId}/`)) {
    return Response.json({ error: "명함 사진 경로를 확인해 주세요." }, { status: 400 });
  }
  // The image must already exist in the private bucket before writing its database row.
  const owner = await client.storage.from("sales-cards").info(input.imagePath);
  if (owner.error || !owner.data) return Response.json({ error: "명함 사진 업로드를 확인하지 못했습니다." }, { status: 400 });
  const result = await saveSalesCard(client, user, input);
  return Response.json(result, { status: result.error ? 400 : 201, headers: { "Cache-Control": "no-store" } });
}
