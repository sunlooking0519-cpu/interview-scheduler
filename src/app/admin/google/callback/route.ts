import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/server/admin-auth";
import { CALENDAR_SCOPE, calendarConfig, encryptToken, getCalendarConnection, googleToken } from "@/server/google-calendar";
import { createServiceClient } from "../../../../../lib/supabase/service";
import { scheduleCalendarSync } from "@/server/calendar-sync";

export async function GET(request: NextRequest) {
  const { user } = await requireAdmin();
  const store = await cookies();
  const saved = store.get("google_calendar_oauth")?.value;
  store.set("google_calendar_oauth", "", { path: "/admin/google", maxAge: 0 });
  const state = request.nextUrl.searchParams.get("state");
  const expected = `${user.id}.${state ?? ""}`;
  const valid = !!saved && !!state && Buffer.byteLength(saved) === Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(saved), Buffer.from(expected));
  try {
    const config = calendarConfig();
    const fail = () => NextResponse.redirect(`${config.origin}/admin?calendar=error`);
    const code = request.nextUrl.searchParams.get("code");
    if (!valid || !code || request.nextUrl.searchParams.has("error")) return fail();
    const connection = await getCalendarConnection();
    if (connection && connection.owner_id !== user.id) return fail();
    const tokens = await googleToken({ code, grant_type: "authorization_code", redirect_uri: config.redirectUri });
    if (!tokens.refresh_token || !tokens.scope?.split(" ").includes(CALENDAR_SCOPE)) return fail();
    const db = createServiceClient().schema("scheduler");
    const row = { id: true, owner_id: user.id, calendar_id: "primary", refresh_token: encryptToken(tokens.refresh_token) };
    const { error } = connection
      ? await db.from("google_calendar_connection").update(row).eq("owner_id", user.id)
      : await db.from("google_calendar_connection").insert(row);
    if (error) return fail();
    const { error: queueError } = await db.rpc("enqueue_existing_google_reservations");
    if (queueError) return fail();
    scheduleCalendarSync();
    return NextResponse.redirect(`${config.origin}/admin?calendar=connected`);
  } catch { return NextResponse.redirect(new URL("/admin?calendar=error", request.url)); }
}
