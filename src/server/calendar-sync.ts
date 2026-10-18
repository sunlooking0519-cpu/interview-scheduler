import "server-only";
import { after } from "next/server";
import { createServiceClient } from "../../lib/supabase/service";
import { getCalendarConnection, calendarAccessToken, googleEventId, googleRequest, salesEventId } from "@/server/google-calendar";

export function scheduleCalendarSync() {
  if (!(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) || !process.env.GOOGLE_CLIENT_ID) return;
  try {
    after(async () => { try { await syncCalendarQueue(); } catch { console.error("Google Calendar sync deferred; pending reservations are retained"); } });
  } catch { console.error("Google Calendar sync deferred; pending reservations are retained"); }
}

export async function syncCalendarQueue() {
  const started = Date.now();
  const connection = await getCalendarConnection();
  if (!connection) return { processed: 0, failed: 0 };
  const token = await calendarAccessToken(connection);
  const service = createServiceClient();
  const db = service.schema("scheduler");
  let processed = 0;
  let failed = 0;
  for (let attempt = 0; attempt < 20; attempt++) {
    if (Date.now() - started > 30000) break;
    const { data: jobs, error } = await db.rpc("claim_google_calendar_jobs");
    if (error) throw new Error("Calendar queue unavailable");
    const job = (jobs ?? [])[0] as { reservation_id: string; version: number } | undefined;
    if (!job) break;
    try {
      const { data: row, error: readError } = await db.from("interviews").select("name,interview_date,interview_time,status").eq("id", job.reservation_id).maybeSingle();
      if (readError) throw new Error("Reservation unavailable");
      const id = googleEventId(job.reservation_id);
      let response: Response;
      if (!row || row.status === "cancelled") {
        response = await googleRequest(token, connection.calendar_id, `events/${id}`, { method: "DELETE" });
        if (!response.ok && ![404, 410].includes(response.status)) throw new Error("Google cancellation failed");
      } else {
        const start = new Date(`${row.interview_date}T${row.interview_time.slice(0, 5)}:00+09:00`);
        if (Number.isNaN(start.getTime())) throw new Error("Invalid reservation date");
        const event = {
          summary: `면접 · ${row.name}`, description: "Meetly 면접 예약 (30분). 일정 변경과 취소는 Meetly에서 진행해 주세요.",
          start: { dateTime: start.toISOString(), timeZone: "Asia/Seoul" },
          end: { dateTime: new Date(start.getTime() + 30 * 60 * 1000).toISOString(), timeZone: "Asia/Seoul" },
          extendedProperties: { private: { meetly: "true", reservationId: job.reservation_id } },
        };
        response = await googleRequest(token, connection.calendar_id, `events/${id}`, { method: "PUT", body: JSON.stringify(event) });
        if (response.status === 404) response = await googleRequest(token, connection.calendar_id, "events", { method: "POST", body: JSON.stringify({ id, ...event }) });
        if (response.status === 409) response = await googleRequest(token, connection.calendar_id, `events/${id}`, { method: "PUT", body: JSON.stringify(event) });
        if (!response.ok) throw new Error("Google event sync failed");
      }
      const { error: deleteError } = await db.from("google_calendar_jobs").delete().eq("reservation_id", job.reservation_id).eq("version", job.version);
      if (deleteError) throw new Error("Queue acknowledgement failed");
      processed++;
    } catch {
      failed++;
      await db.from("google_calendar_jobs").update({ last_error: "동기화 실패. Google 연결 상태를 확인하고 재시도해 주세요." }).eq("reservation_id", job.reservation_id).eq("version", job.version);
    }
  }
  const sales = await syncSalesCalendarJobs(token, connection.calendar_id, started);
  return { processed: processed + sales.processed, failed: failed + sales.failed };
}

async function syncSalesCalendarJobs(token: string, calendarId: string, started: number) {
  const db = createServiceClient().schema("scheduler");
  let processed = 0;
  let failed = 0;
  for (let attempt = 0; attempt < 15; attempt++) {
    if (Date.now() - started > 45000) break;
    const { data: jobs, error } = await db.rpc("claim_sales_calendar_jobs");
    // The older deployment can still sync interviews before the sales migration is applied.
    if (error) {
      if (error.code === "PGRST202" || error.code === "42883") break;
      throw new Error("Sales calendar queue unavailable");
    }
    const job = (jobs ?? [])[0] as { meeting_id: string; version: number } | undefined;
    if (!job) break;
    try {
      const { data: meeting, error: readError } = await db.from("sales_meetings").select("title,starts_at,ends_at,location,status,organization_id").eq("id", job.meeting_id).maybeSingle();
      if (readError) throw new Error("Meeting unavailable");
      const eventId = salesEventId(job.meeting_id);
      let response: Response;
      if (!meeting || meeting.status === "cancelled") {
        response = await googleRequest(token, calendarId, `events/${eventId}`, { method: "DELETE" });
        if (!response.ok && ![404, 410].includes(response.status)) throw new Error("Google meeting cancellation failed");
      } else {
        const { data: organization } = await db.from("sales_organizations").select("name").eq("id", meeting.organization_id).maybeSingle();
        const event = {
          summary: `영업 미팅 · ${organization?.name ?? meeting.title}`,
          description: `Meetly 영업 미팅: ${meeting.title}. 변경과 취소는 Meetly 영업 관리에서 진행해 주세요.`,
          location: meeting.location ?? "",
          start: { dateTime: meeting.starts_at, timeZone: "Asia/Seoul" },
          end: { dateTime: meeting.ends_at, timeZone: "Asia/Seoul" },
          extendedProperties: { private: { meetlySales: "true", salesMeetingId: job.meeting_id } },
        };
        response = await googleRequest(token, calendarId, `events/${eventId}`, { method: "PUT", body: JSON.stringify(event) });
        if (response.status === 404) response = await googleRequest(token, calendarId, "events", { method: "POST", body: JSON.stringify({ id: eventId, ...event }) });
        if (response.status === 409) response = await googleRequest(token, calendarId, `events/${eventId}`, { method: "PUT", body: JSON.stringify(event) });
        if (!response.ok) throw new Error("Google meeting sync failed");
      }
      const { error: deleteError } = await db.from("sales_calendar_jobs").delete().eq("meeting_id", job.meeting_id).eq("version", job.version);
      if (deleteError) throw new Error("Sales queue acknowledgement failed");
      processed++;
    } catch {
      failed++;
      await db.from("sales_calendar_jobs").update({ last_error: "Google 미팅 동기화 실패. 연결 상태를 확인하고 재시도해 주세요." }).eq("meeting_id", job.meeting_id).eq("version", job.version);
    }
  }
  return { processed, failed };
}
