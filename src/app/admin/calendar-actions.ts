"use server";

import { requireAdmin } from "@/server/admin-auth";
import { calendarConfig, getCalendarConnection, calendarAccessToken, googleRequest, googleCalendarListRequest, type GoogleEvent, type GoogleCalendarEntry, decryptToken } from "@/server/google-calendar";
import { syncCalendarQueue } from "@/server/calendar-sync";
import { createServiceClient } from "../../../lib/supabase/service";
import { revalidatePath } from "next/cache";

export type CalendarMonth = { connected: boolean; canConnect: boolean; canDisconnect: boolean; events: { id: string; title: string; start: string; end: string; allDay: boolean; calendar: string }[]; calendars: string[]; account: string; pending: number; error: string };

export async function getGoogleCalendarMonth(month: string): Promise<CalendarMonth> {
  const { user } = await requireAdmin();
  const empty: CalendarMonth = { connected: false, canConnect: false, canDisconnect: false, events: [], calendars: [], account: "", pending: 0, error: "" };
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) return { ...empty, error: "조회할 월을 확인해 주세요." };
  try {
    calendarConfig();
    const connection = await getCalendarConnection();
    if (!connection) return { ...empty, canConnect: true };
    if (connection.owner_id !== user.id) return { ...empty, connected: true, error: "다른 관리자의 Google 계정이 연결되어 있습니다. 개인 일정은 연결한 관리자에게만 표시됩니다." };
    const db = createServiceClient().schema("scheduler");
    const { count } = await db.from("google_calendar_jobs").select("reservation_id", { count: "exact", head: true });
    const token = await calendarAccessToken(connection);
    const [year, number] = month.split("-").map(Number);
    const endMonth = new Date(Date.UTC(year, number, 1)).toISOString().slice(0, 7);
    let calendars: GoogleCalendarEntry[] = [];
    let listToken = "";
    let listWarning = "";
    for (let page = 0; page < 3; page++) {
      const response = await googleCalendarListRequest(token, listToken);
      if (response.status === 403) {
        // Existing OAuth tokens only have calendar.events. Keep showing primary until reconnected.
        calendars = [{ id: connection.calendar_id, summary: "기본 캘린더", primary: true }];
        listWarning = "다른 캘린더를 읽으려면 ‘Google 다시 연결’을 눌러 추가 조회 권한을 허용해 주세요.";
        break;
      }
      if (!response.ok) throw new Error("Google calendar list failed");
      const payload = await response.json() as { items?: GoogleCalendarEntry[]; nextPageToken?: string };
      calendars.push(...(payload.items ?? []).filter((item) => !item.deleted && !!item.id));
      listToken = payload.nextPageToken ?? "";
      if (!listToken) break;
    }
    if (listToken) listWarning = "캘린더가 많아 일부만 확인했습니다.";
    if (!calendars.length) calendars = [{ id: connection.calendar_id, summary: "기본 캘린더", primary: true }];
    calendars.sort((a, b) => Number(!!b.primary) - Number(!!a.primary));
    if (calendars.length > 20) { calendars = calendars.slice(0, 20); listWarning = "캘린더가 많아 처음 20개만 확인했습니다."; }
    const account = calendars.find((item) => item.primary)?.id ?? "";
    const collected: { calendar: string; calendarId: string; event: GoogleEvent }[] = [];
    let failedCalendars = 0;
    let truncatedCalendars = 0;
    async function fetchCalendar(calendar: GoogleCalendarEntry) {
      let pageToken = "";
      const items: { calendar: string; calendarId: string; event: GoogleEvent }[] = [];
      for (let page = 0; page < 4; page++) {
        const query = new URLSearchParams({ timeMin: `${month}-01T00:00:00+09:00`, timeMax: `${endMonth}-01T00:00:00+09:00`, singleEvents: "true", orderBy: "startTime", maxResults: "250", timeZone: "Asia/Seoul" });
        if (pageToken) query.set("pageToken", pageToken);
        const response = await googleRequest(token, calendar.id, `events?${query}`);
        if (!response.ok) throw new Error("Google calendar events failed");
        const payload = await response.json() as { items?: GoogleEvent[]; nextPageToken?: string };
        items.push(...(payload.items ?? []).map((event) => ({ calendar: calendar.summary || calendar.id, calendarId: calendar.id, event })));
        pageToken = payload.nextPageToken ?? "";
        if (!pageToken) break;
      }
      return { items, truncated: !!pageToken };
    }
    for (let offset = 0; offset < calendars.length; offset += 5) {
      const results = await Promise.allSettled(calendars.slice(offset, offset + 5).map(fetchCalendar));
      for (const result of results) {
        if (result.status === "rejected") failedCalendars++;
        else { collected.push(...result.value.items); if (result.value.truncated) truncatedCalendars++; }
      }
    }
    const toKorea = (value: string) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" }).format(new Date(value)).replace(" ", "T");
    const warning = [listWarning, failedCalendars ? `${failedCalendars}개 캘린더의 일정 조회에 실패했습니다.` : "", truncatedCalendars ? `${truncatedCalendars}개 캘린더의 일정이 많아 일부만 표시됩니다.` : ""].filter(Boolean).join(" ");
    return { connected: true, canConnect: true, canDisconnect: true, account, calendars: calendars.map((item) => item.summary || item.id), pending: count ?? 0, error: warning,
      events: collected.filter(({ event }) => event.extendedProperties?.private?.meetly !== "true" && !!event.start && !!event.end).map(({ event, calendar, calendarId }) => ({
        id: `${calendarId}:${event.id}`, calendar, title: event.summary ?? "제목 없는 일정", allDay: !!event.start?.date,
        start: event.start?.date ?? (event.start?.dateTime ? toKorea(event.start.dateTime) : ""),
        end: event.end?.date ?? (event.end?.dateTime ? toKorea(event.end.dateTime) : ""),
      })) };
  } catch { return { ...empty, error: "Google 연결 설정이 필요하거나 연결이 만료되었습니다. 설정을 확인한 뒤 다시 연결해 주세요.", canConnect: !!process.env.GOOGLE_CLIENT_ID }; }
}

export async function retryCalendarSync(): Promise<{ error: string }> {
  await requireAdmin();
  try {
    const result = await syncCalendarQueue();
    return { error: result.failed ? "일부 예약의 동기화가 실패했습니다. 잠시 후 재시도해 주세요." : "" };
  } catch { return { error: "Google 연결 설정을 확인해 주세요." }; }
}

export async function disconnectGoogleCalendar(): Promise<{ error: string }> {
  const { user } = await requireAdmin();
  try {
    const connection = await getCalendarConnection();
    if (!connection || connection.owner_id !== user.id) return { error: "연결한 관리자만 해제할 수 있습니다." };
    try {
      await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", body: new URLSearchParams({ token: decryptToken(connection.refresh_token) }), signal: AbortSignal.timeout(8000) });
    } catch { /* Local disconnect must remain available during a Google outage. */ }
    const { error } = await createServiceClient().schema("scheduler").from("google_calendar_connection").delete().eq("owner_id", user.id);
    if (error) throw new Error();
    revalidatePath("/admin");
    return { error: "" };
  } catch { return { error: "Google 연결을 해제하지 못했습니다." }; }
}
