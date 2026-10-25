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
    exports, FormData, console, process, Buffer, URL, URLSearchParams, AbortSignal,
    createImageBitmap: imports.__createImageBitmap,
    require(name) {
      if (name === "@/server/calendar-sync" && !(name in imports)) return { scheduleCalendarSync() {} };
      if (name === "@/server/resumes" && !(name in imports)) return {};
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

test("dashboard counts only reservations whose interview time has not passed in Korea", () => {
  const { getUpcomingReservationStats } = load("src/features/admin/reservation-stats.ts", {});
  const now = new Date("2026-10-18T10:00:00+09:00");
  const rows = [
    { interview_date: "2026-10-17", interview_time: "16:00", status: "cancelled" },
    { interview_date: "2026-10-18", interview_time: "09:30", status: "confirmed" },
    { interview_date: "2026-10-18", interview_time: "10:00", status: "confirmed" },
    { interview_date: "2026-10-19", interview_time: "11:00", status: "cancelled" },
  ];
  assert.deepEqual({ ...getUpcomingReservationStats(rows, now) }, { total: 2, confirmed: 1, cancelled: 1 });
});

test("business card OCR suggests an organization type and extracts contact details", () => {
  const card = load("src/features/admin/sales-card-ocr.ts", {});
  const fields = card.guessSalesCardFields("한빛대학교\n김민수\n입학처 팀장\n010-1234-5678\nminsu@example.com");
  assert.equal(fields.organization, "한빛대학교");
  assert.equal(fields.name, "김민수");
  assert.equal(fields.phone, "");
  assert.equal(fields.mobile, "010-1234-5678");
  assert.equal(fields.email, "minsu@example.com");
  assert.equal(card.classifySalesCard(fields.organization), "school");
  assert.equal(card.classifySalesCard("미래연구소"), "institution");
  assert.equal(card.classifySalesCard("가나다상사"), "other");
});

test("business card fields ignore slogans, prefer mobile numbers, and keep uncertain names empty", () => {
  const card = load("src/features/admin/sales-card-ocr.ts", {});
  const fields = card.guessSalesCardFields("63) 소통·연결·창조의 새 강진.\n강진군 4차산업혁명활용추진단\nT. 061 430 5941\nM. 010 2948 7147\nE-mail: poorun@korea.kr", "정 은 지 | 디지털혁신팀장");
  assert.equal(fields.organization, "강진군 4차산업혁명활용추진단");
  assert.equal(fields.name, "정은지");
  assert.equal(fields.phone, "061 430 5941");
  assert.equal(fields.mobile, "010 2948 7147");
  assert.equal(fields.title, "팀장");
  assert.equal(card.classifySalesCard(fields.organization), "institution");

  const noisy = card.guessSalesCardFields("> TAE JIN croup\nCRIA ERS RAE HAs aor\n010.6690.0998\nktylove0998@hanmail.net");
  assert.equal(noisy.organization, "");
  assert.equal(noisy.name, "");
  assert.equal(noisy.mobile, "010.6690.0998");
  assert.equal(noisy.email, "ktylove0998@hanmail.net");

  const council = card.guessSalesCardFields("69) 전남광주통합특별시의회 4 TH\n미래산업위원회 위원장 이 귀 순\n010-4484-5255");
  assert.equal(council.organization, "전남광주통합특별시의회");
  assert.equal(council.name, "이귀순");
  assert.equal(council.title, "위원장");
  assert.equal(card.classifySalesCard(council.organization), "institution");
});

test("business card OCR separates Tel and Mobile and never assigns Fax", () => {
  const card = load("src/features/admin/sales-card-ocr.ts", {});
  const fields = card.guessSalesCardFields("TAEJIN GROUP\nT. 062 531 6212 F. 062 955 1657 M. 010 6690 0998\nE-mail: contact@example.com");
  assert.equal(fields.phone, "062 531 6212");
  assert.equal(fields.mobile, "010 6690 0998");
  const mobileOnly = card.guessSalesCardFields("H.P 010-4484-5255\nFax 061-430-5949");
  assert.equal(mobileOnly.phone, "");
  assert.equal(mobileOnly.mobile, "010-4484-5255");
  const phoneOnly = card.guessSalesCardFields("Tel: 070-7123-9057\nF. 062-955-1657");
  assert.equal(phoneOnly.phone, "070-7123-9057");
  assert.equal(phoneOnly.mobile, "");
});

test("business card OCR does not mistake organizations, departments or slogans for names", () => {
  const card = load("src/features/admin/sales-card-ocr.ts", {});
  for (const falseName of ["사업혁명", "위원회", "공식인증", "바밋배반"]) {
    assert.equal(card.guessSalesCardFields(`전남광주통합특별시의회\n${falseName}\n010-4484-5255`).name, "");
  }
  assert.equal(card.guessSalesCardFields("(주)와이즈교육\n김경희 | 국장").organization, "(주)와이즈교육");
  assert.equal(card.guessSalesCardFields("(주)와이즈교육\n김경희 | 국장").name, "김경희");
});

test("selected business card areas override conservative full-card guesses", () => {
  const card = load("src/features/admin/sales-card-ocr.ts", {});
  assert.equal(card.extractSelectedCardField("기관명: 문화정보도서관", "organization"), "문화정보도서관");
  assert.equal(card.extractSelectedCardField("문화정보도서관   이 윤 영", "name"), "이윤영");
  assert.equal(card.extractSelectedCardField("담당자: 라온", "name"), "라온");
});

test("business card recognition uses only the browser OCR worker", async () => {
  let recognized = 0;
  let terminated = 0;
  const { recognizeBusinessCard } = load("src/features/admin/recognize-business-card.ts", {
    "@/features/admin/sales-card-ocr": { guessSalesCardFields: () => ({ name: "김민수", organization: "한빛대학교" }) },
    "tesseract.js": {
      PSM: { SPARSE_TEXT: "11", SINGLE_BLOCK: "6" },
      async createWorker(language) {
        assert.equal(language, "kor+eng");
        return {
          async setParameters(params) { assert.equal(params.tessedit_pageseg_mode, "11"); },
          async recognize() { recognized += 1; return { data: { text: " 한빛대학교 " } }; },
          async terminate() { terminated += 1; },
        };
      },
    },
  });
  const result = await recognizeBusinessCard({ type: "image/jpeg", size: 1024 });
  assert.equal(result.text, "한빛대학교");
  assert.equal(result.source, "local");
  assert.equal(recognized, 1);
  assert.equal(terminated, 1);
});

test("business card recognition retries the identity area when the first pass misses it", async () => {
  const modes = [];
  let closed = 0;
  let terminated = 0;
  const { recognizeBusinessCard } = load("src/features/admin/recognize-business-card.ts", {
    __createImageBitmap: async () => ({ width: 1200, height: 800, close() { closed += 1; } }),
    "@/features/admin/sales-card-ocr": { guessSalesCardFields: () => ({ name: "", organization: "" }) },
    "tesseract.js": {
      PSM: { SPARSE_TEXT: "11", SINGLE_BLOCK: "6" },
      async createWorker() {
        return {
          async setParameters(params) { modes.push(params.tessedit_pageseg_mode); },
          async recognize(_file, options) {
            if (options) {
              assert.equal(options.rectangle.width, 1200);
              assert.equal(options.rectangle.height, 600);
              return { data: { text: "김태영\nTAEJIN GROUP" } };
            }
            return { data: { text: "010-1234-5678" } };
          },
          async terminate() { terminated += 1; },
        };
      },
    },
  });
  const result = await recognizeBusinessCard({ type: "image/jpeg", size: 1024 });
  assert.deepEqual(modes, ["11", "6"]);
  assert.equal(result.identityText, "김태영\nTAEJIN GROUP");
  assert.equal(closed, 1);
  assert.equal(terminated, 1);
});

test("selected name area uses Korean-only single-line OCR", async () => {
  let terminated = 0;
  const { recognizeBusinessCardField } = load("src/features/admin/recognize-business-card.ts", {
    "@/features/admin/sales-card-ocr": { guessSalesCardFields: () => ({}) },
    "tesseract.js": {
      PSM: { SINGLE_LINE: "7" },
      async createWorker(language) {
        assert.equal(language, "kor");
        return {
          async setParameters(params) { assert.equal(params.tessedit_pageseg_mode, "7"); },
          async recognize() { return { data: { text: " 정 은 지 " } }; },
          async terminate() { terminated += 1; },
        };
      },
    },
  });
  assert.equal(await recognizeBusinessCardField({ type: "image/jpeg", size: 1024 }, "name"), "정 은 지");
  assert.equal(terminated, 1);
});

test("Google Vision OCR sends a Korean document request with a server-only key", async () => {
  const previous = process.env.GOOGLE_VISION_API_KEY;
  process.env.GOOGLE_VISION_API_KEY = "test-vision-key";
  try {
    const vision = load("src/server/business-card-vision.ts", { "server-only": {} });
    const image = Buffer.from("ffd8ff1234", "hex");
    assert.equal(vision.isSupportedCardImage(image), true);
    assert.equal(vision.isSupportedCardImage(Buffer.from("not an image")), false);
    const text = await vision.recognizeBusinessCardWithVision(image, async (url, init) => {
      assert.equal(url, "https://vision.googleapis.com/v1/images:annotate");
      assert.equal(init.headers["x-goog-api-key"], "test-vision-key");
      const body = JSON.parse(init.body);
      assert.equal(body.requests[0].features[0].type, "DOCUMENT_TEXT_DETECTION");
      assert.equal(body.requests[0].image.content, image.toString("base64"));
      return { ok: true, json: async () => ({ responses: [{ fullTextAnnotation: { text: "한빛대학교\n김민수" } }] }) };
    });
    assert.equal(text, "한빛대학교\n김민수");
  } finally { if (previous === undefined) delete process.env.GOOGLE_VISION_API_KEY; else process.env.GOOGLE_VISION_API_KEY = previous; }
});

test("business card OCR endpoint requires an admin and removes its temporary image", async () => {
  const previous = process.env.GOOGLE_VISION_API_KEY;
  process.env.GOOGLE_VISION_API_KEY = "test-vision-key";
  const path = "ocr-temp/11111111-1111-1111-1111-111111111111.jpg";
  const removed = [];
  let currentUser = null;
  const supabase = {
    auth: { getUser: async () => ({ data: { user: currentUser }, error: null }) },
    storage: { from(bucket) {
      assert.equal(bucket, "sales-cards");
      return {
        download: async (requested) => { assert.equal(requested, path); return { data: new Blob([Buffer.from("ffd8ff1234", "hex")]), error: null }; },
        remove: async (paths) => { removed.push(...paths); return { error: null }; },
      };
    } },
  };
  try {
    const route = load("src/app/api/admin/sales/ocr/route.ts", {
      "next/server": { NextResponse },
      "../../../../../../lib/supabase/server": { createClient: async () => supabase },
      "../../../../../../lib/supabase/admin-role": { isAdmin: (user) => user.app_metadata?.role === "admin" },
      "@/server/business-card-vision": {
        CARD_MAX_BYTES: 10 * 1024 * 1024,
        isSupportedCardImage: () => true,
        recognizeBusinessCardWithVision: async () => "한빛대학교",
      },
    });
    const call = () => route.POST(new NextRequest("https://example.com/api/admin/sales/ocr", { method: "POST", body: JSON.stringify({ path }), headers: { "content-type": "application/json" } }));
    assert.equal((await call()).status, 401);
    currentUser = admin;
    const response = await call();
    assert.equal(response.status, 200);
    assert.equal((await response.json()).text, "한빛대학교");
    assert.deepEqual(removed, [path]);
  } finally { if (previous === undefined) delete process.env.GOOGLE_VISION_API_KEY; else process.env.GOOGLE_VISION_API_KEY = previous; }
});

test("new sales lead links the organization, contact and private business card", async () => {
  const organizationId = "12345678-1234-1234-1234-123456789abc";
  const writes = [];
  const supabase = { schema(schema) {
    assert.equal(schema, "scheduler");
    return { rpc: async (name) => { assert.equal(name, "find_sales_organization"); return { data: null, error: null }; }, from(table) { return { insert(row) {
      writes.push({ table, row });
      if (table === "sales_contacts") return { select() { return { async single() { return { data: { id: "contact-id" }, error: null }; } }; } };
      return Promise.resolve({ error: null });
    } }; } };
  } };
  const actions = load("src/app/admin/sales/actions.ts", {
    "next/cache": { revalidatePath() {} }, "next/navigation": { redirect },
    "@/server/calendar-sync": { scheduleCalendarSync() {} },
    "@/server/google-calendar": { getCalendarConnection: async () => null },
    "@/server/admin-auth": { requireAdmin: async () => ({ user: admin, supabase }) },
  });
  const input = {
    organizationId, name: "한빛대학교", kind: "school",
    contact: { name: "김민수", title: "팀장", phone: "02-123-4567", mobile: "010-1234-5678", email: "minsu@example.com" },
    imagePath: `${organizationId}/11111111-1111-1111-1111-111111111111.jpg`, ocrText: "한빛대학교 김민수",
  };
  assert.equal((await actions.createSalesLead(input)).id, organizationId);
  assert.deepEqual(writes.map(({ table }) => table), ["sales_organizations", "sales_contacts", "sales_business_cards"]);
  assert.equal(writes[1].row.phone, "02-123-4567");
  assert.equal(writes[1].row.mobile, "010-1234-5678");
  assert.equal(writes[2].row.ocr_fields.mobile, "010-1234-5678");
  assert.equal(writes[2].row.contact_id, "contact-id");
  assert.equal(writes[2].row.image_path, input.imagePath);
});

test("another business card at the same organization adds a contact without another organization card", async () => {
  const proposedId = "12345678-1234-1234-1234-123456789abc";
  const existingId = "22222222-2222-2222-2222-222222222222";
  const writes = [];
  const supabase = { schema() { return {
    rpc: async (name, args) => {
      assert.equal(name, "find_sales_organization");
      assert.equal(args.p_name, "한빛대학교");
      return { data: existingId, error: null };
    },
    from(table) { return { insert(row) {
      writes.push({ table, row });
      if (table === "sales_contacts") return { select() { return { async single() { return { data: { id: "new-contact" }, error: null }; } }; } };
      return Promise.resolve({ error: null });
    } }; },
  }; } };
  const actions = load("src/app/admin/sales/actions.ts", {
    "next/cache": { revalidatePath() {} }, "next/navigation": { redirect },
    "@/server/calendar-sync": { scheduleCalendarSync() {} },
    "@/server/google-calendar": { getCalendarConnection: async () => null },
    "@/server/admin-auth": { requireAdmin: async () => ({ user: admin, supabase }) },
  });
  const result = await actions.createSalesLead({
    organizationId: proposedId, name: " 한빛대학교 ", kind: "school",
    contact: { name: "이영희", title: "교사", role: "실무 운영", phone: "", mobile: "010-1111-2222", email: "" },
    imagePath: `${proposedId}/11111111-1111-1111-1111-111111111111.jpg`, ocrText: "한빛대학교 이영희",
  });
  assert.equal(result.id, existingId);
  assert.deepEqual(writes.map(({ table }) => table), ["sales_contacts", "sales_business_cards"]);
  assert.equal(writes[0].row.organization_id, existingId);
  assert.equal(writes[0].row.role, "실무 운영");
  assert.equal(writes[1].row.organization_id, existingId);
  assert.equal(writes[1].row.contact_id, "new-contact");
});

test("a card uploaded from an organization page links to its selected contact", async () => {
  const organizationId = "12345678-1234-1234-1234-123456789abc";
  const contactId = "22222222-2222-2222-2222-222222222222";
  let savedCard;
  const supabase = { schema() { return { from(table) {
    if (table === "sales_contacts") return { select() { return { eq() { return { eq() { return { maybeSingle: async () => ({ data: { id: contactId }, error: null }) }; } }; } }; } };
    if (table === "sales_business_cards") return { insert(row) { savedCard = row; return Promise.resolve({ error: null }); } };
    throw new Error(`Unexpected table: ${table}`);
  } }; } };
  const actions = load("src/app/admin/sales/actions.ts", {
    "next/cache": { revalidatePath() {} }, "next/navigation": { redirect },
    "@/server/calendar-sync": { scheduleCalendarSync() {} },
    "@/server/google-calendar": { getCalendarConnection: async () => null },
    "@/server/admin-auth": { requireAdmin: async () => ({ user: admin, supabase }) },
  });
  const result = await actions.saveBusinessCard({ organizationId, contactId,
    imagePath: `${organizationId}/11111111-1111-1111-1111-111111111111.jpg`, ocrText: "담당자 명함",
    fields: { name: "이영희", organization: "한빛대학교", title: "팀장", phone: "", mobile: "", email: "" },
  });
  assert.equal(result.error, "");
  assert.equal(savedCard.organization_id, organizationId);
  assert.equal(savedCard.contact_id, contactId);
});

test("sales activity records the result and schedules the next action", async () => {
  const organizationId = "12345678-1234-1234-1234-123456789abc";
  const contactId = "22222222-2222-2222-2222-222222222222";
  let rpcArgs;
  const supabase = { schema() { return { rpc: async (name, args) => {
    assert.equal(name, "record_sales_activity");
    rpcArgs = args;
    return { data: "activity-id", error: null };
  } }; } };
  const actions = load("src/app/admin/sales/actions.ts", {
    "next/cache": { revalidatePath() {} }, "next/navigation": { redirect },
    "@/server/calendar-sync": { scheduleCalendarSync() {} },
    "@/server/google-calendar": { getCalendarConnection: async () => null },
    "@/server/admin-auth": { requireAdmin: async () => ({ user: admin, supabase }) },
  });
  const form = new FormData();
  for (const [key, value] of Object.entries({ organization_id: organizationId, contact_id: contactId, activity_type: "email", reaction: "reviewing", summary: "1차 후속 메일 발송", occurred_at: "2026-10-25T14:00", follow_up_round: "1", follow_up_status: "pending", next_action: "2차 후속 전화", next_action_type: "call", next_action_at: "2026-10-30T10:00", next_contact_id: contactId, stage: "contacted" })) form.set(key, value);
  await actions.createSalesActivity(form);
  assert.equal(rpcArgs.p_organization_id, organizationId);
  assert.equal(rpcArgs.p_contact_id, contactId);
  assert.equal(rpcArgs.p_activity_type, "email");
  assert.equal(rpcArgs.p_follow_up_round, 1);
  assert.equal(rpcArgs.p_follow_up_status, "pending");
  assert.equal(rpcArgs.p_occurred_at, "2026-10-25T05:00:00.000Z");
  assert.equal(rpcArgs.p_next_action, "2차 후속 전화");
  assert.equal(rpcArgs.p_next_action_type, "call");
  assert.equal(rpcArgs.p_next_action_at, "2026-10-30T01:00:00.000Z");
  assert.equal(rpcArgs.p_next_contact_id, contactId);
  assert.equal(rpcArgs.p_stage, "contacted");
  form.set("activity_type", "call");
  await assert.rejects(() => actions.createSalesActivity(form), /활동 내용과 다음 행동/);
});

test("first follow-up queue contains only open organizations waiting for second contact", () => {
  const followUp = load("src/features/admin/sales-follow-up.ts", {});
  const base = { stage: "contacted", last_follow_up_round: 1, follow_up_status: "pending", next_action_at: "2026-10-25T10:00:00.000Z" };
  assert.equal(followUp.isFirstFollowUpQueue(base), true);
  assert.equal(followUp.isFirstFollowUpQueue({ ...base, follow_up_status: "waiting_reply" }), true);
  assert.equal(followUp.isFirstFollowUpQueue({ ...base, last_follow_up_round: 2 }), false);
  assert.equal(followUp.isFirstFollowUpQueue({ ...base, follow_up_status: "responded" }), false);
  assert.equal(followUp.isFirstFollowUpQueue({ ...base, stage: "won" }), false);
  assert.equal(followUp.isDueOn(base, "2026-10-25"), true);
  assert.equal(followUp.isDueBefore({ ...base, next_action_at: "2026-10-24T10:00:00.000Z" }, "2026-10-25"), true);
});

test("resume validation enforces allowed extensions and the 5MB boundary", () => {
  const resume = load("src/features/booking/resume.ts", {});
  assert.equal(resume.resumeError("resume.PDF", 5 * 1024 * 1024), "");
  assert.equal(resume.resumeError("resume.doc", 100), "");
  assert.equal(resume.resumeError("resume.docx", 100), "");
  assert.ok(resume.resumeError("resume.pdf", 5 * 1024 * 1024 + 1));
  assert.ok(resume.resumeError("resume.pdf", 0));
  assert.ok(resume.resumeError("resume.pdf.exe", 100));
});

test("resume tickets bind files to the candidate and reject tampering", () => {
  const previous = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_SECRET_KEY = "test-resume-secret";
  try {
    const resume = load("src/server/resumes.ts", { "server-only": {}, "node:crypto": crypto, "../../lib/supabase/service": {}, "@/features/booking/resume": load("src/features/booking/resume.ts", {}) });
    const path = resume.newResumePath("pdf");
    const ticket = resume.resumeTicket(path, " 지원자 ", "01012345678");
    assert.equal(resume.readResumeTicket(ticket, "지원자", "01012345678"), path);
    assert.throws(() => resume.readResumeTicket(ticket, "다른사람", "01012345678"));
    assert.throws(() => resume.readResumeTicket(ticket, "지원자", "01000000000"));
    assert.throws(() => resume.readResumeTicket(`x${ticket}`, "지원자", "01012345678"));
  } finally { if (previous === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = previous; }
});

test("uploaded resumes require document signatures before a public URL is returned", async () => {
  let file = new Blob(["%PDF-1.7\nresume"]);
  const resume = load("src/server/resumes.ts", {
    "server-only": {}, "node:crypto": crypto, "@/features/booking/resume": load("src/features/booking/resume.ts", {}),
    "../../lib/supabase/service": { createServiceClient: () => ({ storage: { from(bucket) { assert.equal(bucket, "resumes"); return { download: async () => ({ data: file }), getPublicUrl: (path) => ({ data: { publicUrl: `https://storage.example/${path}` } }) }; } } }) },
  });
  assert.equal(await resume.verifyUploadedResume("uploads/test.pdf"), "https://storage.example/uploads/test.pdf");
  file = new Blob(["arbitrary content"]);
  await assert.rejects(() => resume.verifyUploadedResume("uploads/test.pdf"));
  file = new Blob([Buffer.from("d0cf11e0a1b11ae1", "hex")]);
  assert.ok(await resume.verifyUploadedResume("uploads/test.doc"));
  file = new Blob([Buffer.from([0x50, 0x4b, 3, 4]), "word/document.xml"]);
  assert.ok(await resume.verifyUploadedResume("uploads/test.docx"));
});

test("booking persists verified resume URLs and cleans files on a slot conflict", async () => {
  for (const conflict of [false, true]) {
    let saved, cleaned = false;
    const action = load("src/app/(candidate)/booking/actions.ts", {
      "@/features/booking/dates": bookingDates, "@/features/booking/time-slots": timeSlots,
      "@/server/resumes": { readResumeTicket: () => "uploads/file.pdf", verifyUploadedResume: async () => "https://storage.example/resume.pdf", removeUploadedResume: async () => { cleaned = true; } },
      "../../../../lib/supabase/server": { createClient: async () => ({ schema: () => ({ from: () => ({ insert: async (row) => { saved = row; return { error: conflict ? { code: "23505" } : null }; } }) }) }) },
    });
    const result = await action.createInterview({ name: "지원자", phone: "01012345678", interviewDate: "2027-01-15", interviewTime: "10:00", resumeTicket: "signed-ticket" });
    assert.equal(saved.resume_url, "https://storage.example/resume.pdf");
    assert.equal(result.success, !conflict);
    assert.equal(cleaned, conflict);
  }
});

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
    assert.match(calendar.salesEventId("12345678-1234-1234-1234-123456789abc"), /^[0-9a-v]{5,1024}$/);
    assert.notEqual(calendar.salesEventId("12345678-1234-1234-1234-123456789abc"), calendar.googleEventId("2"));
  } finally {
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

test("sales meeting sync creates a Google event and removes it after cancellation", async () => {
  for (const status of ["scheduled", "cancelled"]) {
    const requests = [], deleted = [];
    let claimed = false;
    const db = {
      rpc: async (name) => name === "claim_google_calendar_jobs" ? { data: [] } : { data: claimed ? [] : [{ meeting_id: "meeting-id", version: 3 }] },
      from(table) {
        if (table === "sales_meetings") return { select() { return { eq() { return { maybeSingle: async () => ({ data: { title: "상담", starts_at: "2026-10-26T01:00:00Z", ends_at: "2026-10-26T02:00:00Z", location: "서울", status, organization_id: "org-id" } }) }; } }; } };
        if (table === "sales_organizations") return { select() { return { eq() { return { maybeSingle: async () => ({ data: { name: "학교" } }) }; } }; } };
        return { delete() { return { eq(key, value) { deleted.push([key, value]); return { eq: async (otherKey, otherValue) => { deleted.push([otherKey, otherValue]); return {}; } }; } }; } };
      },
    };
    const sync = load("src/server/calendar-sync.ts", {
      "server-only": {}, "next/server": {}, "../../lib/supabase/service": { createServiceClient: () => ({ schema: () => db }) },
      "@/server/google-calendar": {
        getCalendarConnection: async () => ({ calendar_id: "primary" }), calendarAccessToken: async () => "token", salesEventId: () => "sales-event-id",
        googleRequest: async (_token, _calendar, path, init) => { requests.push({ path, ...init }); return { ok: init.method !== "PUT", status: init.method === "PUT" ? 404 : 200 }; },
      },
    });
    const originalRpc = db.rpc;
    db.rpc = async (name) => { if (name === "claim_sales_calendar_jobs") { const result = await originalRpc(name); claimed = true; return result; } return originalRpc(name); };
    const result = await sync.syncCalendarQueue();
    assert.equal(result.processed, 1);
    assert.deepEqual(deleted, [["meeting_id", "meeting-id"], ["version", 3]]);
    assert.deepEqual(requests.map((request) => request.method), status === "cancelled" ? ["DELETE"] : ["PUT", "POST"]);
    if (status === "scheduled") assert.equal(JSON.parse(requests.at(-1).body).summary, "영업 미팅 · 학교");
  }
});

test("proposal save uses the expected revision and reports concurrent edits", async () => {
  const compared = [];
  let conflict = false;
  const query = {
    eq(key, value) { compared.push([key, value]); return this; },
    select() { return this; },
    async maybeSingle() { return { data: conflict ? null : { revision_number: 4, organization_id: "org-id" } }; },
  };
  const supabase = { schema(name) {
    assert.equal(name, "scheduler");
    return { from(table) {
      assert.equal(table, "sales_proposals");
      return { update(row) { assert.equal(row.revision_number, 4); return query; } };
    } };
  } };
  const actions = load("src/app/admin/sales/actions.ts", {
    "next/cache": { revalidatePath() {} }, "next/navigation": { redirect },
    "@/server/calendar-sync": { scheduleCalendarSync() {} },
    "@/server/google-calendar": { getCalendarConnection: async () => null },
    "@/server/admin-auth": { requireAdmin: async () => ({ supabase }) },
  });
  const proposalId = "12345678-1234-1234-1234-123456789abc";
  const saved = await actions.saveProposal(proposalId, 3, "제안", "내용");
  assert.equal(saved.error, "");
  assert.equal(saved.revision, 4);
  assert.deepEqual(compared, [["id", proposalId], ["revision_number", 3]]);
  conflict = true;
  assert.match((await actions.saveProposal(proposalId, 3, "제안", "수정")).error, /다른 곳에서 수정/);
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

test("admin November calendar reads events from primary and another Google calendar", async () => {
  const queried = [];
  const actions = load("src/app/admin/calendar-actions.ts", {
    "@/server/admin-auth": { requireAdmin: async () => ({ user: admin }) },
    "@/server/google-calendar": {
      calendarConfig() {}, getCalendarConnection: async () => ({ owner_id: admin.id, calendar_id: "primary" }),
      calendarAccessToken: async () => "token", googleCalendarListRequest: async () => ({ ok: true, status: 200, json: async () => ({ items: [{ id: "primary@example.com", summary: "기본", primary: true }, { id: "samsung@example.com", summary: "삼성 일정" }] }) }),
      googleRequest: async (_token, calendarId) => { queried.push(calendarId); return { ok: true, json: async () => ({ items: calendarId === "samsung@example.com" ? [{ id: "shared-id", summary: "11월 미팅", start: { dateTime: "2026-11-04T10:00:00+09:00" }, end: { dateTime: "2026-11-04T11:00:00+09:00" } }] : [] }) }; },
    },
    "../../../lib/supabase/service": { createServiceClient: () => ({ schema: () => ({ from: () => ({ select: async () => ({ count: 0 }) }) }) }) },
    "@/server/calendar-sync": { syncCalendarQueue() {} }, "next/cache": { revalidatePath() {} },
  });
  const result = await actions.getGoogleCalendarMonth("2026-11");
  assert.equal(result.account, "primary@example.com");
  assert.equal(result.calendars.length, 2);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].start, "2026-11-04T10:00");
  assert.equal(result.events[0].calendar, "삼성 일정");
  assert.deepEqual(queried.sort(), ["primary@example.com", "samsung@example.com"].sort());
});

test("old Google authorization keeps primary events and requests reconnection", async () => {
  const actions = load("src/app/admin/calendar-actions.ts", {
    "@/server/admin-auth": { requireAdmin: async () => ({ user: admin }) },
    "@/server/google-calendar": {
      calendarConfig() {}, getCalendarConnection: async () => ({ owner_id: admin.id, calendar_id: "primary" }),
      calendarAccessToken: async () => "token", googleCalendarListRequest: async () => ({ ok: false, status: 403 }),
      googleRequest: async () => ({ ok: true, json: async () => ({ items: [{ id: "old", summary: "기존 일정", start: { date: "2026-11-05" }, end: { date: "2026-11-06" } }] }) }),
    },
    "../../../lib/supabase/service": { createServiceClient: () => ({ schema: () => ({ from: () => ({ select: async () => ({ count: 0 }) }) }) }) },
    "@/server/calendar-sync": { syncCalendarQueue() {} }, "next/cache": { revalidatePath() {} },
  });
  const result = await actions.getGoogleCalendarMonth("2026-11");
  assert.equal(result.events.length, 1);
  assert.match(result.error, /Google 다시 연결/);
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
