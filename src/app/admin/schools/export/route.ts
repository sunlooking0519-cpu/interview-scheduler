import { requireSalesStaff } from "@/server/admin-auth";
import { createServiceClient } from "../../../../../lib/supabase/service";
import { isAdmin } from "../../../../../lib/supabase/admin-role";
import { schoolDirectoryColumns, schoolDirectorySheets, schoolsForDirectorySheet,
  type SchoolDirectoryColumn, type SchoolDirectoryRecord, type SchoolDirectorySheet } from "@/features/admin/school-directory-export";
import { createSchoolDirectoryWorkbook } from "@/server/school-export-workbook";
import { koreaDateKey } from "@/features/admin/sales-follow-up";

export const runtime = "nodejs";

const allowedSheets = new Set<string>(schoolDirectorySheets.map(([key]) => key));
const allowedColumns = new Set<string>(schoolDirectoryColumns.map(([key]) => key));
const schoolFields = "id,name,province,district,level,phone,contact_name,contact_phone,contact_email,contact_date,management_updated_on,contact_method,proposal_status,reaction,notes,source_loaded_on,assigned_at,assigned_to,last_activity_at,additional_proposal_at,excluded_at";

export async function POST(request: Request) {
  const { user, supabase } = await requireSalesStaff();
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "잘못된 요청입니다." }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return Response.json({ error: "요청 내용이 너무 큽니다." }, { status: 413 });

  let input: { sheets?: unknown; columns?: unknown };
  try { input = await request.json(); }
  catch { return Response.json({ error: "요청 내용을 확인해 주세요." }, { status: 400 }); }
  if (!input || !Array.isArray(input.sheets) || input.sheets.length < 1 || input.sheets.length > allowedSheets.size
    || input.sheets.some((view) => typeof view !== "string" || !allowedSheets.has(view))
    || new Set(input.sheets).size !== input.sheets.length
    || !Array.isArray(input.columns) || input.columns.length < 1 || input.columns.length > allowedColumns.size
    || input.columns.some((column) => typeof column !== "string" || !allowedColumns.has(column))
    || new Set(input.columns).size !== input.columns.length) {
    return Response.json({ error: "시트와 다운로드 필드를 각각 하나 이상 선택해 주세요." }, { status: 400 });
  }
  const selectedSheets = input.sheets as SchoolDirectorySheet[];
  const columns = input.columns as SchoolDirectoryColumn[];
  const db = supabase.schema("scheduler");
  const schools: SchoolDirectoryRecord[] = [];
  for (let offset = 0; offset < 5000; offset += 1000) {
    let query = db.from("schools").select(schoolFields).order("id").range(offset, offset + 999);
    if (!isAdmin(user)) query = query.eq("assigned_to", user.id);
    const { data, error } = await query;
    if (error) return Response.json({ error: "학교 목록을 불러오지 못했습니다." }, { status: 503 });
    schools.push(...(data ?? []) as SchoolDirectoryRecord[]);
    if ((data ?? []).length < 1000) break;
  }
  if (schools.length >= 5000) return Response.json({ error: "학교가 너무 많아 내보낼 수 없습니다." }, { status: 413 });

  const names = new Map(schoolDirectorySheets);
  const sections = selectedSheets.map((view) => ({ view, name: names.get(view) ?? view,
    schools: schoolsForDirectorySheet(schools, view) }));
  const selectedIds = [...new Set(sections.flatMap((section) => section.schools.map((school) => school.id)))];
  const activityCounts = new Map<string, number>();
  if (columns.includes("activityCount")) {
    for (let index = 0; index < selectedIds.length; index += 80) {
      const ids = selectedIds.slice(index, index + 80);
      for (let offset = 0; offset < 10000; offset += 1000) {
        const { data, error } = await db.from("school_contact_history").select("id,school_id")
          .in("school_id", ids).is("deleted_at", null).order("id").range(offset, offset + 999);
        if (error) return Response.json({ error: "활동 기록 수를 확인하지 못했습니다." }, { status: 503 });
        for (const row of data ?? []) activityCounts.set(row.school_id, (activityCounts.get(row.school_id) ?? 0) + 1);
        if ((data ?? []).length < 1000) break;
        if (offset === 9000) return Response.json({ error: "활동 기록이 너무 많아 내보낼 수 없습니다." }, { status: 413 });
      }
    }
  }

  const assigneeNames = new Map<string, string>();
  if (columns.includes("assignedManager")) {
    if (isAdmin(user)) {
      try {
        const service = createServiceClient();
        for (let page = 1; page <= 10; page++) {
          const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
          if (error) throw error;
          for (const account of data.users) assigneeNames.set(account.id,
            String(account.user_metadata.full_name ?? "") || account.email || "담당 계정");
          if (data.users.length < 200) break;
        }
      } catch { return Response.json({ error: "배정 담당자 이름을 불러오지 못했습니다." }, { status: 503 }); }
    } else {
      assigneeNames.set(user.id, String(user.user_metadata.full_name ?? "") || user.email || "내 담당");
    }
  }

  const buffer = await createSchoolDirectoryWorkbook(columns, sections, activityCounts, assigneeNames);
  const day = koreaDateKey(new Date()).replaceAll("-", "");
  return new Response(new Uint8Array(buffer), { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="school-directory-${day}.xlsx"`,
    "Cache-Control": "private, no-store",
  } });
}
