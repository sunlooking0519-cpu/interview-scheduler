import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server.js";

function load(path, imports) {
  const code = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports, FormData, console, process,
    require(name) {
      if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
      return imports[name];
    },
  });
  return exports;
}

const { isAdmin } = load("lib/supabase/admin-role.ts", {});
const timeSlots = load("src/features/booking/time-slots.ts", {});
const admin = { id: "admin-id", email: "admin@example.com", app_metadata: { role: "admin" } };
const redirect = (path) => { throw new Error(`REDIRECT:${path}`); };

test("fixed time grid spans 09:00 to 21:00 and displays AM/PM labels", () => {
  assert.equal(timeSlots.ALL_TIMES.length, 25);
  assert.equal(timeSlots.ALL_TIMES[0], "09:00");
  assert.equal(timeSlots.ALL_TIMES.at(-1), "21:00");
  assert.equal(timeSlots.displayTime("12:30"), "12:30");
  assert.equal(timeSlots.displayTime("18:30"), "6:30");
});

test("admin time controls authorize before saving and reject unsupported slots", async () => {
  let authorized = 0;
  const saved = [];
  const { setTimeSlot } = load("src/app/admin/time-actions.ts", {
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
    "@/features/booking/demo-data": { DEMO_DATES: ["2026-10-12"] },
    "@/features/booking/time-slots": timeSlots,
    "next/cache": { revalidatePath() {} },
  });
  assert.equal((await setTimeSlot("2026-10-12", "18:30", true)).error, "");
  assert.equal(saved[0].interview_time, "18:30");
  assert.equal(saved[0].enabled, true);
  assert.ok((await setTimeSlot("2026-10-12", "21:30", true)).error);
  assert.equal(authorized, 2);
  assert.equal(saved.length, 1);
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
    "@/features/booking/demo-data": { DEMO_DATES: ["2026-10-12"] },
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
    "@/features/booking/demo-data": { DEMO_DATES: ["2026-10-12"], DEMO_TIMES: ["10:00"] },
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
  assert.ok((await actions.updateCandidateReservation(candidate, id, "2026-10-13", "10:00")).error);
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
    "@/features/booking/demo-data": { DEMO_DATES: ["2026-10-12"], DEMO_TIMES: ["10:00"] },
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
