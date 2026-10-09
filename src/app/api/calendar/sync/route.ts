import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { syncCalendarQueue } from "@/server/calendar-sync";

export const maxDuration = 60;
async function run(request: NextRequest, secret: string | undefined) {
  const provided = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || secret.length < 32 || Buffer.byteLength(provided) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) return new NextResponse("Unauthorized", { status: 401 });
  try { return NextResponse.json(await syncCalendarQueue()); }
  catch { return NextResponse.json({ error: "Calendar synchronization unavailable" }, { status: 503 }); }
}
export async function POST(request: NextRequest) { return run(request, process.env.CALENDAR_SYNC_SECRET); }
export async function GET(request: NextRequest) { return run(request, process.env.CRON_SECRET); }
