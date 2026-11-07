import { requireAdmin } from "@/server/admin-auth";
import { createServiceClient } from "../../../../../lib/supabase/service";
import { loadSalesOrganizationData } from "@/server/sales-organization-data";
import { createSalesExportWorkbook } from "@/server/sales-export-workbook";
import { buildSalesExportRows, salesExportColumns, scopeSalesExportToWorkspace, type SalesExportColumn } from "@/features/admin/sales-export";
import { koreaDateKey } from "@/features/admin/sales-follow-up";

export const runtime = "nodejs";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const allowedColumns = new Set<string>(salesExportColumns.map(([key]) => key));
const allOrganizations = { query: "", category: "", region: "", contact: "" };

export async function POST(request: Request) {
  const { supabase } = await requireAdmin();
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 403 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > 4096) {
    return Response.json({ error: "요청 내용이 너무 큽니다." }, { status: 413 });
  }
  let input: { managerId?: unknown; columns?: unknown };
  try { input = await request.json(); }
  catch { return Response.json({ error: "요청 내용을 확인해 주세요." }, { status: 400 }); }
  if (!input || typeof input.managerId !== "string" || !uuid.test(input.managerId)
    || !Array.isArray(input.columns) || !input.columns.length || input.columns.length > allowedColumns.size
    || input.columns.some((column) => typeof column !== "string" || !allowedColumns.has(column))
    || new Set(input.columns).size !== input.columns.length) {
    return Response.json({ error: "강사와 다운로드 컬럼을 확인해 주세요." }, { status: 400 });
  }

  const account = await createServiceClient().auth.admin.getUserById(input.managerId);
  if (account.error || account.data.user?.app_metadata.role !== "instructor") {
    return Response.json({ error: "승인된 중간관리자를 찾지 못했습니다." }, { status: 404 });
  }
  const workspace = await supabase.schema("scheduler").from("sales_workspaces")
    .select("id").eq("owner_user_id", input.managerId).maybeSingle();
  if (workspace.error) return Response.json({ error: "영업 작업 공간을 확인하지 못했습니다." }, { status: 503 });
  if (!workspace.data) return Response.json({ error: "내보낼 기관이 없습니다." }, { status: 404 });

  const data = await loadSalesOrganizationData(supabase);
  if (data.loadError) return Response.json({ error: "기관 데이터를 불러오지 못했습니다." }, { status: 503 });
  const scoped = scopeSalesExportToWorkspace(data.rows, data.contacts, workspace.data.id);
  const rows = buildSalesExportRows(scoped.rows, scoped.contacts, allOrganizations, input.columns as SalesExportColumn[]);
  if (!rows.length) return Response.json({ error: "내보낼 기관이 없습니다." }, { status: 404 });

  const buffer = await createSalesExportWorkbook(input.columns as SalesExportColumn[], rows);
  const day = koreaDateKey(new Date()).replaceAll("-", "");
  return new Response(new Uint8Array(buffer), { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="sales-manager-${input.managerId.slice(0, 8)}-${day}.xlsx"`,
    "Cache-Control": "private, no-store",
  } });
}
