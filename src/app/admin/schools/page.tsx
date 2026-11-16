import Link from "next/link";
import { requireSalesStaff } from "@/server/admin-auth";
import { createServiceClient } from "../../../../lib/supabase/service";
import { isAdmin } from "../../../../lib/supabase/admin-role";
import { cleanSchoolFilters, schoolFiltersHref, schoolPageSize, schoolUuid } from "@/features/admin/school-filters";
import { SchoolTable, type SchoolRow, type SchoolAssignee } from "@/features/admin/components/school-table";
import { SchoolFilterForm } from "@/features/admin/components/school-filter-form";
import { SchoolImportDialog } from "@/features/admin/components/school-import-dialog";
import { koreaDateKey } from "@/features/admin/sales-follow-up";

export const dynamic = "force-dynamic";

export default async function SchoolsPage({ searchParams }: {
  searchParams: Promise<{ province?: string; district?: string; level?: string; assignment?: string; q?: string; view?: string; page?: string }>;
}) {
  const { user, supabase } = await requireSalesStaff();
  const params = await searchParams;
  const filters = cleanSchoolFilters(params);
  const admin = isAdmin(user);
  const db = supabase.schema("scheduler");
  const optionsTask = db.from("schools").select("province,district").order("province").order("district").limit(2000);
  const assigneesTask: Promise<{ assignees: SchoolAssignee[]; allAccounts: SchoolAssignee[]; error: string }> = admin ? (async () => {
    try {
      const service = createServiceClient();
      const assignees: SchoolAssignee[] = [];
      const allAccounts: SchoolAssignee[] = [];
      for (let page = 1; page <= 10; page++) {
        const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw error;
        for (const account of data.users) {
          const role = String(account.app_metadata.role ?? "");
          if (!["admin", "super_admin", "instructor"].includes(role)) continue;
          const person = { id: account.id, name: String(account.user_metadata.full_name ?? "") || account.email || "관리자", email: account.email ?? "" };
          allAccounts.push(person);
          if (role === "instructor") assignees.push(person);
        }
        if (data.users.length < 200) break;
      }
      return { assignees: assignees.sort((a, b) => a.name.localeCompare(b.name, "ko")), allAccounts, error: "" };
    } catch { return { assignees: [], allAccounts: [], error: "담당자 계정을 불러오지 못했습니다. 서버 키를 확인해 주세요." }; }
  })() : Promise.resolve({ assignees: [], allAccounts: [], error: "" });

  let query = db.from("schools")
    .select("id,province,district,level,name,phone,source_loaded_on,assigned_to,assigned_at,contact_name,contact_email,contact_phone,contact_date,contact_method,proposal_status,reaction,notes,management_updated_on,excluded_at,last_activity_at", { count: "exact" });
  if (filters.province) query = query.eq("province", filters.province);
  if (filters.district) query = query.eq("district", filters.district);
  if (filters.level) query = query.eq("level", filters.level);
  if (filters.q) query = query.ilike("name", `%${filters.q}%`);
  if (admin && filters.assignment === "unassigned") query = query.is("assigned_to", null);
  else if (admin && schoolUuid.test(filters.assignment)) query = query.eq("assigned_to", filters.assignment);
  if (filters.view === "active") query = query.not("last_activity_at", "is", null);
  if (filters.view === "excluded") query = query.not("excluded_at", "is", null);
  const requestedPage = Number(params.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const rowsTask = (filters.view === "active"
    ? query.order("last_activity_at", { ascending: false }).order("name")
    : query.order("province").order("district").order("level").order("name"))
    .range((page - 1) * schoolPageSize, page * schoolPageSize - 1);
  const [rowsResult, optionsResult, assigneeResult] = await Promise.all([rowsTask, optionsTask, assigneesTask]);
  const total = rowsResult.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / schoolPageSize));
  const assigneeById = new Map(assigneeResult.allAccounts.map((person) => [person.id, person]));
  const rows = (rowsResult.data ?? []) as SchoolRow[];

  return <div className="space-y-6">
    <header className="rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-800 p-6 text-white shadow-lg sm:p-8">
      <p className="text-xs font-bold tracking-[0.2em] text-indigo-200">SCHOOL DIRECTORY</p>
      <h1 className="mt-3 text-3xl font-bold sm:text-4xl">학교 관리</h1>
      <p className="mt-3 text-sm leading-6 text-indigo-100">{admin ? "학교를 지역·학교급으로 찾고 담당 관리자에게 배정하세요." : "내게 배정된 학교의 담당자와 접촉 기록을 확인하고 후속관리를 남기세요."}</p>
    </header>
    {admin && <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-slate-950">학교목록 업데이트</h2><p className="mt-1 text-sm text-slate-600">새 학교가 포함된 담당_학교목록.xlsx 형식의 파일을 업로드해 DB에 반영합니다.</p></div><SchoolImportDialog /></div></section>}
    {(rowsResult.error || optionsResult.error) && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">학교 목록을 불러오지 못했습니다. 학교 후속관리 SQL 적용 여부를 확인해 주세요.</p>}
    {assigneeResult.error && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{assigneeResult.error}</p>}
    <section id="school-list" className="scroll-mt-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-950">{filters.view === "active" ? "진행중 학교" : filters.view === "excluded" ? "제외 학교" : admin ? "전체 학교" : "내 배정 학교"} <span className="text-indigo-600">{total.toLocaleString("ko-KR")}</span></h2><p className="mt-1 text-sm text-slate-500">학교명은 지역별로 중복될 수 있어 지역·학교급을 함께 표시합니다.</p></div>{Object.entries(filters).some(([key, value]) => key !== "view" && Boolean(value)) && <Link href={`${schoolFiltersHref({ ...filters, province: "", district: "", level: "", assignment: "", q: "" })}#school-list`} className="text-sm font-semibold text-indigo-700 underline">필터 초기화</Link>}</div>
      <nav aria-label="학교 목록 구분" className="mt-5 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {(["all", "active", "excluded"] as const).map((view) => <Link key={view} href={`${schoolFiltersHref({ ...filters, view })}#school-list`}
          aria-current={filters.view === view ? "page" : undefined}
          className={`rounded-xl px-4 py-2 text-sm font-bold ${filters.view === view ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
          {view === "all" ? "전체학교" : view === "active" ? "진행중" : "제외학교"}
        </Link>)}
      </nav>
      <SchoolFilterForm filters={filters} locations={optionsResult.data ?? []} assignees={assigneeResult.assignees} admin={admin} />
      <SchoolTable key={JSON.stringify([filters, page])} rows={rows} total={total} page={page} pageCount={pageCount} filters={filters} admin={admin} assignees={assigneeResult.assignees} assigneeById={Object.fromEntries(assigneeById)} assignmentEnabled={!assigneeResult.error && !rowsResult.error} today={koreaDateKey(new Date())} />
      {pageCount > 1 && <nav aria-label="학교 목록 페이지" className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><p className="text-sm text-slate-500">{page} / {pageCount}페이지</p><div className="flex flex-wrap gap-2">{page > 1 && <Link href={`${schoolFiltersHref(filters, page - 1)}#school-list`} className="rounded-lg border px-3 py-2 text-sm">이전</Link>}{page < pageCount && <Link href={`${schoolFiltersHref(filters, page + 1)}#school-list`} className="rounded-lg border px-3 py-2 text-sm">다음</Link>}</div></nav>}
    </section>
  </div>;
}
