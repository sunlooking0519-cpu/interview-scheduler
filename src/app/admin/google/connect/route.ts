import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/admin-auth";
import { CALENDAR_SCOPE, calendarConfig, getCalendarConnection } from "@/server/google-calendar";

export async function GET() {
  const { user } = await requireAdmin();
  try {
    const config = calendarConfig();
    const connection = await getCalendarConnection();
    if (connection && connection.owner_id !== user.id) return NextResponse.redirect(`${config.origin}/admin?calendar=owner`);
    const state = randomBytes(32).toString("base64url");
    const store = await cookies();
    store.set("google_calendar_oauth", `${user.id}.${state}`, { httpOnly: true, secure: config.origin.startsWith("https:"), sameSite: "lax", path: "/admin/google", maxAge: 600 });
    const target = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    target.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: "code", scope: CALENDAR_SCOPE, access_type: "offline", prompt: "consent", state }).toString();
    return NextResponse.redirect(target);
  } catch { return new NextResponse("Google 캘린더 환경 변수와 DB 설정을 먼저 완료해 주세요.", { status: 503 }); }
}
