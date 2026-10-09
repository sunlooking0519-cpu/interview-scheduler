import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createServiceClient } from "../../lib/supabase/service";

export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
export type CalendarConnection = { owner_id: string; refresh_token: string; calendar_id: string };
export type GoogleEvent = { id: string; summary?: string; htmlLink?: string; start?: { date?: string; dateTime?: string }; end?: { date?: string; dateTime?: string }; extendedProperties?: { private?: Record<string, string> } };

export function calendarConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.APP_URL;
  const key = process.env.CALENDAR_TOKEN_KEY;
  if (!clientId || !clientSecret || !appUrl || !key || !/^[a-f0-9]{64}$/i.test(key)) throw new Error("Google Calendar configuration is incomplete");
  const origin = new URL(appUrl).origin;
  if (!origin.startsWith("https://") && !["http://localhost:3000", "http://127.0.0.1:3000"].includes(origin)) throw new Error("Invalid application URL");
  return { clientId, clientSecret, origin, redirectUri: `${origin}/admin/google/callback`, key: Buffer.from(key, "hex") };
}

export function encryptToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", calendarConfig().key, iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString("base64url")).join(".");
}

export function decryptToken(value: string) {
  const [iv, tag, data] = value.split(".").map((part) => Buffer.from(part, "base64url"));
  const cipher = createDecipheriv("aes-256-gcm", calendarConfig().key, iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString("utf8");
}

export async function getCalendarConnection() {
  const service = createServiceClient();
  const { data, error } = await service.schema("scheduler").from("google_calendar_connection").select("owner_id,refresh_token,calendar_id").eq("id", true).maybeSingle();
  if (error) throw new Error("Calendar connection storage unavailable");
  return data as CalendarConnection | null;
}

export async function googleToken(params: Record<string, string>) {
  const config = calendarConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...params }),
    cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Google authorization expired or unavailable");
  return await response.json() as { access_token: string; refresh_token?: string; scope?: string };
}

export async function calendarAccessToken(connection: CalendarConnection) {
  const tokens = await googleToken({ grant_type: "refresh_token", refresh_token: decryptToken(connection.refresh_token) });
  return tokens.access_token;
}

export async function googleRequest(token: string, calendarId: string, path: string, init: RequestInit = {}) {
  return fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/${path}`, {
    ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init.headers },
    cache: "no-store", signal: AbortSignal.timeout(10000),
  });
}

export function googleEventId(id: string) {
  const namespace = createHash("sha256").update(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").digest("hex").slice(0, 16);
  return `meet${namespace}${id}`;
}
