import { requireAdmin } from "@/server/admin-auth";
import { loadSalesOrganizationData } from "@/server/sales-organization-data";
import { createSalesExportWorkbook } from "@/server/sales-export-workbook";
import {
  buildSalesExportRows, salesExportColumns, type SalesExportColumn, type SalesExportFilters,
} from "@/features/admin/sales-export";
import { organizationCategoryOptions, salesRegionOptions } from "@/features/admin/sales-organization-list";
import { koreaDateKey } from "@/features/admin/sales-follow-up";

export const runtime = "nodejs";

const allowedColumns = new Set<string>(salesExportColumns.map(([key]) => key));
const allowedCategories = new Set<string>(organizationCategoryOptions.map(([key]) => key));
const allowedRegions = new Set<string>(salesRegionOptions);

export async function POST(request: Request) {
  const { supabase } = await requireAdmin();
  let input: { columns?: unknown; filters?: unknown };
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "요청 내용을 확인해 주세요." }, { status: 400 });
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return Response.json({ error: "요청 내용을 확인해 주세요." }, { status: 400 });
  }
  const columns = input.columns;
  const filterInput = input.filters;
  if (!Array.isArray(columns) || !columns.length || columns.length > allowedColumns.size
    || columns.some((column) => typeof column !== "string" || !allowedColumns.has(column))
    || new Set(columns).size !== columns.length
    || !filterInput || typeof filterInput !== "object") {
    return Response.json({ error: "다운로드할 컬럼을 선택해 주세요." }, { status: 400 });
  }
  const raw = filterInput as Record<string, unknown>;
  if (["query", "category", "region", "contact"].some((key) => typeof raw[key] !== "string" || (raw[key] as string).length > 120)
    || (raw.category && !allowedCategories.has(raw.category as string))
    || (raw.region && !allowedRegions.has(raw.region as string))) {
    return Response.json({ error: "검색 조건을 확인해 주세요." }, { status: 400 });
  }
  const filters = raw as SalesExportFilters;
  const data = await loadSalesOrganizationData(supabase);
  if (data.loadError) return Response.json({ error: "기관 데이터를 불러오지 못했습니다." }, { status: 503 });
  const rows = buildSalesExportRows(data.rows, data.contacts, filters, columns as SalesExportColumn[]);
  if (!rows.length) return Response.json({ error: "다운로드할 기관이 없습니다." }, { status: 400 });

  const buffer = await createSalesExportWorkbook(columns as SalesExportColumn[], rows);
  const day = koreaDateKey(new Date()).replaceAll("-", "");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="sales-organizations-${day}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
