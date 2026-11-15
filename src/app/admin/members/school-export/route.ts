import { requireAdmin } from "@/server/admin-auth";
import { createServiceClient } from "../../../../../lib/supabase/service";
import { schoolExportColumns, type SchoolExportActivity, type SchoolExportColumn, type SchoolExportRecord } from "@/features/admin/school-export";
import { createSchoolExportWorkbook } from "@/server/school-export-workbook";
import { koreaDateKey } from "@/features/admin/sales-follow-up";

export const runtime = "nodejs";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const allowedColumns = new Set<string>(schoolExportColumns.map(([key]) => key));

export async function POST(request: Request) {
  const { supabase } = await requireAdmin();
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "잘못된 요청입니다." }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return Response.json({ error: "요청 내용이 너무 큽니다." }, { status: 413 });
  let input: { managerId?: unknown; columns?: unknown; includeHistory?: unknown };
  try { input = await request.json(); }
  catch { return Response.json({ error: "요청 내용을 확인해 주세요." }, { status: 400 }); }
  if (!input || typeof input.managerId !== "string" || !uuid.test(input.managerId)
    || !Array.isArray(input.columns) || !input.columns.length || input.columns.length > allowedColumns.size
    || input.columns.some((column) => typeof column !== "string" || !allowedColumns.has(column))
    || new Set(input.columns).size !== input.columns.length || typeof input.includeHistory !== "boolean") {
    return Response.json({ error: "강사와 다운로드 컬럼을 확인해 주세요." }, { status: 400 });
  }
  const managerId = input.managerId;
  const columns = input.columns as SchoolExportColumn[];
  const account = await createServiceClient().auth.admin.getUserById(managerId);
  if (account.error || account.data.user?.app_metadata.role !== "instructor")
    return Response.json({ error: "승인된 중간관리자를 찾지 못했습니다." }, { status: 404 });

  const db = supabase.schema("scheduler");
  const schools: SchoolExportRecord[] = [];
  for (let offset = 0; offset < 10000; offset += 1000) {
    const { data, error } = await db.from("schools")
      .select("id,name,province,district,level,phone,contact_name,contact_phone,contact_email,contact_date,management_updated_on,contact_method,proposal_status,reaction,notes,source_loaded_on,assigned_at")
      .eq("assigned_to", managerId).order("id").range(offset, offset + 999);
    if (error) return Response.json({ error: "배정 학교를 불러오지 못했습니다." }, { status: 503 });
    schools.push(...(data ?? []) as SchoolExportRecord[]);
    if ((data ?? []).length < 1000) break;
  }
  if (!schools.length) return Response.json({ error: "이 강사에게 배정된 학교가 없습니다." }, { status: 404 });
  if (schools.length >= 10000) return Response.json({ error: "학교가 너무 많아 내보낼 수 없습니다." }, { status: 413 });

  const activities: SchoolExportActivity[] = [];
  if (input.includeHistory || columns.includes("activityCount")) {
    for (let index = 0; index < schools.length; index += 80) {
      const ids = schools.slice(index, index + 80).map((school) => school.id);
      for (let offset = 0; offset < 10000; offset += 1000) {
        const { data, error } = await db.from("school_contact_history")
          .select("id,school_id,contact_date,update_date,contact_name,contact_phone,contact_email,contact_method,proposal_status,reaction,new_note,created_at,edited_at")
          .in("school_id", ids).is("deleted_at", null)
          .order("created_at", { ascending: false }).order("id", { ascending: false })
          .range(offset, offset + 999);
        if (error) return Response.json({ error: "학교 활동 기록을 불러오지 못했습니다." }, { status: 503 });
        activities.push(...(data ?? []) as SchoolExportActivity[]);
        if ((data ?? []).length < 1000) break;
      }
    }
  }
  if (activities.length >= 10000) return Response.json({ error: "활동 기록이 너무 많아 내보낼 수 없습니다." }, { status: 413 });
  activities.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
  schools.sort((a, b) => a.province.localeCompare(b.province, "ko") || a.district.localeCompare(b.district, "ko")
    || a.level.localeCompare(b.level, "ko") || a.name.localeCompare(b.name, "ko"));
  const buffer = await createSchoolExportWorkbook(columns, schools, activities, input.includeHistory);
  const day = koreaDateKey(new Date()).replaceAll("-", "");
  return new Response(new Uint8Array(buffer), { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="schools-manager-${managerId.slice(0, 8)}-${day}.xlsx"`,
    "Cache-Control": "private, no-store",
  } });
}
