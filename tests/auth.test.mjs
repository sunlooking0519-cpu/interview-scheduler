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
const admin = { id: "admin-id", email: "admin@example.com", app_metadata: { role: "admin" } };
const redirect = (path) => { throw new Error(`REDIRECT:${path}`); };

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
