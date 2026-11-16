import { requireAdmin } from "@/server/admin-auth";
import { createServiceClient } from "../../../../../lib/supabase/service";
import { compareSchoolImport, importFingerprint, parseSchoolWorkbook, type ExistingSchool } from "@/server/school-import";

export const runtime = "nodejs";
const maxBytes = 5 * 1024 * 1024;

export async function POST(request: Request) {
  await requireAdmin();
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json({ error: "잘못된 요청입니다." }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes + 8192)
    return Response.json({ error: "파일 크기는 5MB 이하여야 합니다." }, { status: 413 });
  let form: FormData;
  try { form = await request.formData(); }
  catch { return Response.json({ error: "업로드 파일을 읽지 못했습니다." }, { status: 400 }); }
  const upload = form.get("file");
  const mode = String(form.get("mode") ?? "");
  if (!(upload instanceof File) || !["preview", "apply"].includes(mode)
    || !upload.name.toLowerCase().endsWith(".xlsx") || upload.size < 4 || upload.size > maxBytes)
    return Response.json({ error: "5MB 이하의 .xlsx 파일을 선택해 주세요." }, { status: 400 });
  const bytes = Buffer.from(await upload.arrayBuffer());
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b)
    return Response.json({ error: "올바른 엑셀 파일이 아닙니다." }, { status: 400 });
  let parsed: Awaited<ReturnType<typeof parseSchoolWorkbook>>;
  try { parsed = await parseSchoolWorkbook(bytes); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "학교목록을 읽지 못했습니다." }, { status: 400 }); }

  const service = createServiceClient();
  const existing: ExistingSchool[] = [];
  for (let offset = 0; offset < 10000; offset += 1000) {
    const { data, error } = await service.schema("scheduler").from("schools")
      .select("id,education_office_code,school_code,province,district,level,name,phone,source_loaded_on")
      .order("id").range(offset, offset + 999);
    if (error) return Response.json({ error: "기존 학교 데이터를 불러오지 못했습니다." }, { status: 503 });
    existing.push(...(data ?? []) as ExistingSchool[]);
    if ((data ?? []).length < 1000) break;
  }
  if (existing.length >= 10000) return Response.json({ error: "학교 목록이 너무 커서 비교할 수 없습니다." }, { status: 413 });
  const comparison = compareSchoolImport(parsed.rows, existing);
  const issues = [...parsed.issues, ...comparison.issues];
  const fingerprint = importFingerprint(parsed.digest, existing);
  const summary = { total: parsed.rows.length + parsed.issues.length, added: comparison.added.length,
    changed: comparison.changed.length, unchanged: comparison.unchanged,
    issues: issues.slice(0, 30), issueCount: issues.length, fingerprint };
  if (mode === "preview") return Response.json(summary, { headers: { "Cache-Control": "no-store" } });
  if (String(form.get("fingerprint") ?? "") !== fingerprint)
    return Response.json({ error: "파일 또는 학교 데이터가 변경됐습니다. 다시 미리보기를 확인해 주세요." }, { status: 409 });
  if (issues.length || !parsed.rows.length)
    return Response.json({ error: "검토가 필요한 행을 수정한 뒤 다시 업로드해 주세요.", ...summary }, { status: 400 });
  const updates = [...comparison.added, ...comparison.changed].map((row) => ({
    education_office_code: row.education_office_code, school_code: row.school_code,
    province: row.province, district: row.district, level: row.level,
    name: row.name, phone: row.phone, source_loaded_on: row.source_loaded_on,
    updated_at: new Date().toISOString(),
  }));
  if (updates.length) {
    // One PostgREST request is one database transaction; only public school columns are supplied.
    const { error } = await service.schema("scheduler").from("schools")
      .upsert(updates, { onConflict: "education_office_code,school_code,level" });
    if (error) return Response.json({ error: "학교 데이터를 반영하지 못했습니다. 기존 배정과 기록은 그대로 유지됩니다." }, { status: 503 });
  }
  return Response.json({ applied: true, added: comparison.added.length, changed: comparison.changed.length,
    unchanged: comparison.unchanged }, { headers: { "Cache-Control": "no-store" } });
}
