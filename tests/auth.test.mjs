import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server.js";

function load(path, imports) {
  const code = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports, FormData, console, process, Buffer, URL, URLSearchParams,
    require(name) {
      if (name === "@/server/calendar-sync" && !(name in imports)) return { scheduleCalendarSync() {} };
      if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
      return imports[name];
    },
  });
  return exports;
}

const { isAdmin } = load("lib/supabase/admin-role.ts", {});
const timeSlots = load("src/features/booking/time-slots.ts", {});
const bookingDates = load("src/features/booking/dates.ts", {});
const admin = { id: "admin-id", email: "admin@example.com", app_metadata: { role: "admin" } };
const redirect = (path) => { throw new Error(`REDIRECT:${path}`); };

test("dynamic booking dates support future months and reject invalid dates", () => {
  assert.equal(bookingDates.isBookingDate("2027-01-15"), true);
  assert.equal(bookingDates.isBookingDate("2026-02-30"), false);
  assert.equal(bookingDates.isBookingDate("2026-13-01"), false);
});

test("Google tokens are authenticated ciphertext and event IDs are stable", () => {
  const values = { GOOGLE_CLIENT_ID: "test", GOOGLE_CLIENT_SECRET: "test", APP_URL: "https://example.com", CALENDAR_TOKEN_KEY: "ab".repeat(32) };
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  try {
    const calendar = load("src/server/google-calendar.ts", { "server-only": {}, "node:crypto": crypto, "../../lib/supabase/service": {} });
    const encrypted = calendar.encryptToken("private-refresh-token");
    assert.ok(!encrypted.includes("private-refresh-token"));
    assert.equal(calendar.decryptToken(encrypted), "private-refresh-token");
    const parts = encrypted.split(".");
    parts[1] = Buffer.alloc(16).toString("base64url");
    assert.throws(() => calendar.decryptToken(parts.join(".")));
    assert.match(calendar.googleEventId("9223372036854775807"), /^[0-9a-v]{5,1024}$/);
    assert.equal(calendar.googleEventId("2"), calendar.googleEventId("2"));
    assert.notEqual(calendar.googleEventId("2"), calendar.googleEventId("3"));
  } finally {
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

test("Google sync creates, updates, cancels and preserves failed or newer queue jobs", async () => {
  for (const status of ["confirmed", "existing", "cancelled", "failure"]) {
    const requests = [], acknowledgements = [], failures = [];
    const jobs = [{ reservation_id: "2", version: 7 }];
    let claimed = false;
    const db = { rpc: async () => { const data = claimed ? [] : jobs; claimed = true; return { data }; }, from(table) {
      if (table === "interviews") return { select() { return { eq() { return { maybeSingle: async () => ({ data: { name: "지원자", interview_date: "2026-10-16", interview_time: "11:00", status } }) }; } }; } };
      return { delete() { return { eq(key, value) { acknowledgements.push([key, value]); return { eq: async (key2, value2) => { acknowledgements.push([key2, value2]); return {}; } }; } }; }, update(value) { failures.push(value); return { eq() { return { eq: async () => ({}) }; } }; } };
    } };
    const sync = load("src/server/calendar-sync.ts", {
      "server-only": {}, "next/server": {}, "../../lib/supabase/service": { createServiceClient: () => ({ schema: () => db }) },
      "@/server/google-calendar": {
        getCalendarConnection: async () => ({ calendar_id: "primary" }), calendarAccessToken: async () => "token", googleEventId: () => "event-id",
        googleRequest: async (_token, _calendar, path, init) => {
          requests.push({ path, ...init });
          return { ok: status !== "failure" && (status === "existing" || init.method !== "PUT"), status: status === "failure" ? 503 : status !== "existing" && init.method === "PUT" ? 404 : 200 };
        },
      },
    });
    const result = await sync.syncCalendarQueue();
    if (status === "failure") { assert.equal(result.failed, 1); assert.equal(acknowledgements.length, 0); assert.equal(failures.length, 1); }
    else {
      assert.equal(result.processed, 1);
      assert.deepEqual(acknowledgements, [["reservation_id", "2"], ["version", 7]]);
      if (status === "cancelled") assert.equal(requests[0].method, "DELETE");
      else {
        assert.deepEqual(requests.map((r) => r.method), status === "existing" ? ["PUT"] : ["PUT", "POST"]);
        const event = JSON.parse(requests.at(-1).body);
        assert.equal(event.start.dateTime, "2026-10-16T02:00:00.000Z");
        assert.equal(event.end.dateTime, "2026-10-16T02:30:00.000Z");
        assert.equal(event.extendedProperties.private.reservationId, "2");
      }
    }
  }
});

test("calendar sync endpoint requires the correct server secret", async () => {
  const previous = process.env.CALENDAR_SYNC_SECRET;
  process.env.CALENDAR_SYNC_SECRET = "s".repeat(32);
  let calls = 0;
  try {
    const route = load("src/app/api/calendar/sync/route.ts", {
      "node:crypto": crypto, "next/server": { NextResponse },
      "@/server/calendar-sync": { syncCalendarQueue: async () => { calls++; return { processed: 1, failed: 0 }; } },
    });
    assert.equal((await route.POST(new NextRequest("https://example.com/api/calendar/sync"))).status, 401);
    assert.equal(calls, 0);
    assert.equal((await route.POST(new NextRequest("https://example.com/api/calendar/sync", { headers: { authorization: `Bearer ${process.env.CALENDAR_SYNC_SECRET}` } }))).status, 200);
    assert.equal(calls, 1);
  } finally { if (previous === undefined) delete process.env.CALENDAR_SYNC_SECRET; else process.env.CALENDAR_SYNC_SECRET = previous; }
});

test("Google calendar actions verify administrator access before private reads", async () => {
  const actions = load("src/app/admin/calendar-actions.ts", {
    "@/server/admin-auth": { requireAdmin: async () => { throw new Error("DENIED"); } },
    "@/server/google-calendar": {}, "@/server/calendar-sync": {}, "../../../lib/supabase/service": {}, "next/cache": {},
  });
  await assert.rejects(() => actions.getGoogleCalendarMonth("2026-10"), /DENIED/);
  await assert.rejects(() => actions.retryCalendarSync(), /DENIED/);
  await assert.rejects(() => actions.disconnectGoogleCalendar(), /DENIED/);
});

test("candidate cancellation scopes RPC to id, name and phone", async () => {
  const calls = [];
  const { cancelCandidateReservation } = load("src/app/(candidate)/application/actions.ts", {
    "next/cache": { revalidatePath() {} },
    "@/features/booking/dates": bookingDates,
    "@/features/booking/time-slots": timeSlots,
    "../../../../lib/supabase/server": { createClient: async () => ({ schema() { return { rpc: async (fn, args) => {
      calls.push({ fn, args }); return { data: true, error: null };
    } }; } }) },
  });
  assert.equal((await cancelCandidateReservation({ name: " 박민지 ", phone: "01012345678" }, 2)).error, "");
  assert.equal(calls[0].fn, "cancel_candidate_reservation");
  assert.equal(calls[0].args.p_name, "박민지");
  assert.equal(calls[0].args.p_id, "2");
  assert.ok((await cancelCandidateReservation({ name: "", phone: "" }, 2)).error);
  assert.equal(calls.length, 1);
});

test("admin cancellation requires authorization and rejects unchanged bookings", async () => {
  let authorized = false;
  const { cancelAdminReservation } = load("src/app/admin/reservation-actions.ts", {
    "next/cache": { revalidatePath() {} },
    "@/server/admin-auth": { requireAdmin: async () => {
      authorized = true;
      return { supabase: { schema() { return { rpc: async (fn, args) => {
        assert.equal(fn, "cancel_admin_reservation"); assert.equal(args.p_id, "2");
        return { data: false, error: null };
      } }; } } };
    } },
  });
  assert.ok((await cancelAdminReservation(2)).error);
  assert.equal(authorized, true);
});

test("fixed time grid spans 09:00 to 21:00 and displays AM/PM labels", () => {
  assert.equal(timeSlots.ALL_TIMES.length, 25);
  assert.equal(timeSlots.ALL_TIMES[0], "09:00");
  assert.equal(timeSlots.ALL_TIMES.at(-1), "21:00");
  assert.equal(timeSlots.displayTime("12:30"), "12:30");
  assert.equal(timeSlots.displayTime("18:30"), "6:30");
});

test("only explicitly opened, unbooked times can be selected", () => {
  const open = timeSlots.openTimes([
    { interview_time: "09:00", enabled: false, booked: false },
    { interview_time: "09:30", enabled: true, booked: false },
    { interview_time: "10:00", enabled: true, booked: true },
    { interview_time: "10:30", booked: false },
  ]);
  assert.equal(open.length, 1);
  assert.equal(open[0], "09:30");
  assert.equal(timeSlots.openTimes([]).length, 0);
});

test("admin time controls authorize before saving and reject unsupported slots", async () => {
  let authorized = 0;
  const saved = [];
  const { setTimeSlot, closeAllTimeSlots, addBookingDate } = load("src/app/admin/time-actions.ts", {
    "@/server/admin-auth": { requireAdmin: async () => {
      authorized++;
      return { supabase: { schema(name) {
        assert.equal(name, "scheduler");
        return { from(table) {
          assert.equal(table, "interview_time_slots");
          return { upsert: async (row) => { saved.push(row); return { error: null }; } };
        } };
      } } };
    } },
    "@/features/booking/dates": bookingDates,
    "@/features/booking/time-slots": timeSlots,
    "next/cache": { revalidatePath() {} },
  });
  assert.equal((await setTimeSlot("2026-10-12", "18:30", true)).error, "");
  assert.equal(saved[0].interview_time, "18:30");
  assert.equal(saved[0].enabled, true);
  assert.ok((await setTimeSlot("2026-10-12", "21:30", true)).error);
  assert.equal(authorized, 2);
  assert.equal(saved.length, 1);
  assert.equal((await closeAllTimeSlots("2026-10-12")).error, "");
  assert.equal(saved[1].length, 25);
  assert.equal(saved[1].every((row) => row.interview_date === "2026-10-12" && row.enabled === false), true);
  assert.ok((await closeAllTimeSlots("2026-02-30")).error);
  assert.equal(saved.length, 2);
  assert.equal((await addBookingDate("2099-01-15")).error, "");
  assert.equal(saved[2].length, 25);
  assert.equal(saved[2].every((row) => row.interview_date === "2099-01-15" && row.enabled === false), true);
});

test("availability requests use date-scoped RPC and fail closed", async () => {
  let queried = false;
  const { getTimeSlots } = load("src/app/(candidate)/booking/availability.ts", {
    "../../../../lib/supabase/server": { createClient: async () => ({ schema() {
      return { rpc: async (fn, args) => {
        assert.equal(fn, "get_interview_time_slots");
        assert.equal(args.p_date, "2026-10-12");
        queried = true;
        return { data: null, error: { code: "missing migration" } };
      } };
    } }) },
    "@/features/booking/dates": bookingDates,
  });
  const result = await getTimeSlots("2026-10-12");
  assert.equal(queried, true);
  assert.equal(result.slots.length, 0);
  assert.ok(result.error);
});

test("candidate review scopes RPC requests and rejects invalid updates", async () => {
  const calls = [];
  const actions = load("src/app/(candidate)/application/actions.ts", {
    "next/cache": { revalidatePath() {} },
    "../../../../lib/supabase/server": { createClient: async () => ({ schema(name) {
      assert.equal(name, "scheduler");
      return { rpc: async (fn, args) => {
        calls.push({ fn, args });
        return { data: fn === "find_candidate_reservations" ? [] : true, error: null };
      } };
    } }) },
    "@/features/booking/dates": bookingDates,
    "@/features/booking/time-slots": timeSlots,
  });
  const candidate = { name: " 홍길동 ", phone: "010-1234-5678" };
  assert.equal((await actions.findCandidateReservations(candidate)).error, "");
  assert.equal(calls[0].args.p_name, "홍길동");
  assert.equal(calls[0].args.p_phone, candidate.phone);
  const id = 2;
  assert.equal((await actions.updateCandidateReservation(candidate, id, "2026-10-12", "10:00")).error, "");
  assert.equal(calls[1].args.p_id, "2");
  assert.equal(calls[1].args.p_phone, candidate.phone);
  assert.ok((await actions.updateCandidateReservation(candidate, id, "2026-02-30", "10:00")).error);
  assert.ok((await actions.findCandidateReservations({ name: "", phone: "" })).error);
  assert.equal(calls.length, 2);
});

test("candidate booking accepts only name and phone and omits email in insert", async () => {
  let inserted;
  const { createInterview } = load("src/app/(candidate)/booking/actions.ts", {
    "../../../../lib/supabase/server": { createClient: async () => ({
      schema(name) {
        assert.equal(name, "scheduler");
        return { from(table) {
          assert.equal(table, "interviews");
          return { insert: async (row) => { inserted = row; return { error: null }; } };
        } };
      },
    }) },
    "@/features/booking/dates": bookingDates,
    "@/features/booking/time-slots": timeSlots,
  });
  const input = { name: " 홍길동 ", phone: " 010-1234-5678 ", interviewDate: "2026-10-12", interviewTime: "10:00" };
  assert.equal((await createInterview(input)).success, true);
  assert.equal(inserted.name, "홍길동");
  assert.equal(inserted.phone, "010-1234-5678");
  assert.equal(Object.hasOwn(inserted, "email"), false);
  inserted = undefined;
  assert.equal((await createInterview({ ...input, phone: "invalid" })).success, false);
  assert.equal(inserted, undefined);
});

test("only trusted app_metadata grants administrator access", () => {
  assert.equal(isAdmin(admin), true);
  assert.equal(isAdmin({ app_metadata: { role: "super_admin" } }), true);
  assert.equal(isAdmin({ app_metadata: {}, user_metadata: { role: "admin" } }), false);
  assert.equal(isAdmin({ app_metadata: { role: "candidate" } }), false);
});

test("server guard rejects missing, invalid and ordinary users", async () => {
  for (const result of [
    { data: { user: null }, error: null },
    { data: { user: admin }, error: new Error("invalid session") },
    { data: { user: { app_metadata: {} } }, error: null },
  ]) {
    const { requireAdmin } = load("src/server/admin-auth.ts", {
      "server-only": {}, "next/navigation": { redirect },
      "../../lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => result } }) },
      "../../lib/supabase/admin-role": { isAdmin },
    });
    await assert.rejects(requireAdmin(), /REDIRECT:\/admin\/login/);
  }
});

function actions(auth) {
  return load("src/app/admin/actions.ts", {
    "next/navigation": { redirect }, "next/cache": { revalidatePath() {} },
    "../../../lib/supabase/server": { createClient: async () => ({ auth }) },
    "../../../lib/supabase/admin-role": { isAdmin },
  });
}

function credentials() {
  const form = new FormData();
  form.set("email", " ADMIN@example.com ");
  form.set("password", "correct-password");
  return form;
}

test("valid administrator credentials return success for client navigation", async () => {
  const { loginAdmin } = actions({ signInWithPassword: async ({ email, password }) => {
    assert.equal(email, "admin@example.com");
    assert.equal(password, "correct-password");
    return { data: { user: admin, session: { access_token: "test-token" } }, error: null };
  } });
  const result = await loginAdmin({ error: "" }, credentials());
  assert.equal(result.success, true);
  assert.equal(result.error, "");
});

test("invalid credentials display an error without redirect", async () => {
  const { loginAdmin } = actions({ signInWithPassword: async () => ({ data: { user: null }, error: { message: "invalid" } }) });
  assert.equal((await loginAdmin({ error: "" }, credentials())).error, "이메일 또는 비밀번호가 올바르지 않습니다.");
});

test("ordinary account login is signed out and denied", async () => {
  let signedOut = false;
  const { loginAdmin } = actions({
    signInWithPassword: async () => ({ data: { user: { app_metadata: {} }, session: { access_token: "test-token" } }, error: null }),
    signOut: async () => { signedOut = true; return { error: null }; },
  });
  assert.ok((await loginAdmin({ error: "" }, credentials())).error);
  assert.equal(signedOut, true);
});

test("logout redirects only after successfully ending session", async () => {
  const { logoutAdmin } = actions({ signOut: async () => ({ error: null }) });
  await assert.rejects(logoutAdmin(), /REDIRECT:\/admin\/login/);
  const failed = actions({ signOut: async () => ({ error: new Error("network") }) });
  await assert.rejects(failed.logoutAdmin(), /로그아웃에 실패/);
});

test("reservation listing checks authorization and queries scheduler.interviews", async () => {
  const calls = [];
  const rows = [{ id: "booking-id" }];
  const query = {
    from(table) { calls.push(table); return this; },
    select() { return this; },
    order() { return this; },
    then(resolve) { resolve({ data: rows, error: null }); },
  };
  const { getInterviewReservations } = load("src/server/interviews.ts", {
    "server-only": {}, "@/server/admin-auth": { requireAdmin: async () => {
      calls.push("authorized");
      return { supabase: { schema(name) { calls.push(name); return query; } } };
    } },
  });
  assert.equal(await getInterviewReservations(), rows);
  assert.deepEqual(calls, ["authorized", "scheduler", "interviews"]);
});

test("proxy preserves refreshed cookies on allowed and denied requests without a login loop", async () => {
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";
  try {
    for (const [path, user, status] of [
      ["/admin", admin, 200], ["/admin", null, 307],
      ["/admin", { app_metadata: {} }, 307], ["/admin/login", null, 200],
    ]) {
      const { proxy } = load("src/proxy.ts", {
        "next/server": { NextRequest, NextResponse }, "../lib/supabase/admin-role": { isAdmin },
        "@supabase/ssr": { createServerClient: (_url, _key, { cookies }) => ({
          auth: { getUser: async () => {
            cookies.setAll([{ name: "sb-session", value: "refreshed", options: { path: "/", sameSite: "lax" } }]);
            return { data: { user }, error: null };
          } },
        }) },
      });
      const result = await proxy(new NextRequest(`https://scheduler.example${path}`));
      assert.equal(result.status, status);
      assert.equal(result.cookies.get("sb-session").value, "refreshed");
      assert.equal(result.headers.get("Cache-Control"), "private, no-store");
      if (status === 307) assert.equal(result.headers.get("location"), "https://scheduler.example/admin/login");
    }
  } finally {
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = oldKey;
  }
});
