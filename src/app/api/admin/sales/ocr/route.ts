import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "../../../../../../lib/supabase/server";
import { isAdmin } from "../../../../../../lib/supabase/admin-role";
import { CARD_MAX_BYTES, isSupportedCardImage, recognizeBusinessCardWithVision } from "@/server/business-card-vision";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 403 });
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || !isAdmin(user)) return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  if (!process.env.GOOGLE_VISION_API_KEY) return NextResponse.json({ error: "Google Vision 설정이 필요합니다." }, { status: 503 });

  let path = "";
  try {
    const body = await request.json() as { path?: unknown };
    path = typeof body.path === "string" ? body.path : "";
  } catch { return NextResponse.json({ error: "명함 경로를 확인해 주세요." }, { status: 400 }); }
  if (!/^ocr-temp\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i.test(path)) {
    return NextResponse.json({ error: "명함 경로를 확인해 주세요." }, { status: 400 });
  }

  const storage = supabase.storage.from("sales-cards");
  try {
    const { data, error } = await storage.download(path);
    if (error || !data) return NextResponse.json({ error: "명함 사진을 읽지 못했습니다." }, { status: 404 });
    if (data.size === 0 || data.size > CARD_MAX_BYTES) return NextResponse.json({ error: "10MB 이하의 명함 사진을 선택해 주세요." }, { status: 413 });
    const bytes = Buffer.from(await data.arrayBuffer());
    if (!isSupportedCardImage(bytes)) return NextResponse.json({ error: "JPG, PNG, WebP 사진만 사용할 수 있습니다." }, { status: 415 });
    const text = await recognizeBusinessCardWithVision(bytes);
    return NextResponse.json({ text }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Google Vision 인식에 실패했습니다." }, { status: 502 });
  } finally {
    try { await storage.remove([path]); } catch { /* Client also removes temporary images. */ }
  }
}
