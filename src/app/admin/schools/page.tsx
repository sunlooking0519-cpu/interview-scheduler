import Link from "next/link";
import { requireSalesStaff } from "@/server/admin-auth";
import { createServiceClient } from "../../../../lib/supabase/service";
import { isAdmin } from "../../../../lib/supabase/admin-role";
import { cleanSchoolFilters, schoolFiltersHref, schoolPageSize, schoolUuid } from "@/features/admin/school-filters";
import { SchoolTable, type SchoolRow, type SchoolAssignee } from "@/features/admin/components/school-table";
import { SchoolFilterForm } from "@/features/admin/components/school-filter-form";
import type { SchoolHistory } from "@/features/admin/components/school-follow-up-dialog";
import { koreaDateKey } from "@/features/admin/sales-follow-up";

export const dynamic = "force-dynamic";

export default async function SchoolsPage({ searchParams }: {
  searchParams: Promise<{ province?: string; district?: string; level?: string; assignment?: string; q?: string; page?: string }>;
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
    .select("id,province,district,level,name,phone,source_loaded_on,assigned_to,assigned_at,contact_name,contact_email,contact_date,contact_method,proposal_status,reaction,notes,management_updated_on", { count: "exact" });
  if (filters.province) query = query.eq("province", filters.province);
  if (filters.district) query = query.eq("district", filters.district);
  if (filters.level) query = query.eq("level", filters.level);
  if (filters.q) query = query.ilike("name", `%${filters.q}%`);
  if (admin && filters.assignment === "unassigned") query = query.is("assigned_to", null);
  else if (admin && schoolUuid.test(filters.assignment)) query = query.eq("assigned_to", filters.assignment);
  const requestedPage = Number(params.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const rowsTask = query.order("province").order("district").order("level").order("name")
    .range((page - 1) * schoolPageSize, page * schoolPageSize - 1);
  const [rowsResult, optionsResult, assigneeResult] = await Promise.all([rowsTask, optionsTask, assigneesTask]);
  const total = rowsResult.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / schoolPageSize));
  const assigneeById = new Map(assigneeResult.allAccounts.map((person) => [person.id, person]));
  if (!admin) assigneeById.set(user.id, { id: user.id, name: "내 담당", email: user.email ?? "" });
  const rows = (rowsResult.data ?? []) as SchoolRow[];
  const historyResult = rows.length ? await db.from("school_contact_history")
    .select("id,school_id,contact_date,update_date,contact_method,proposal_status,reaction,new_note,change_summary,created_at")
    .in("school_id", rows.map((row) => row.id)).order("created_at", { ascending: false }).limit(500)
    : { data: [] as SchoolHistory[], error: null };
  const historyBySchool: Record<string, SchoolHistory[]> = {};
  for (const item of (historyResult.data ?? []) as SchoolHistory[]) (historyBySchool[item.school_id] ??= []).push(item);

  return <div className="space-y-6">
    <header className="rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-800 p-6 text-white shadow-lg sm:p-8">
      <p className="text-xs font-bold tracking-[0.2em] text-indigo-200">SCHOOL DIRECTORY</p>
      <h1 className="mt-3 text-3xl font-bold sm:text-4xl">학교 관리</h1>
      <p className="mt-3 text-sm leading-6 text-indigo-100">{admin ? "학교를 지역·학교급으로 찾고 담당 관리자에게 배정하세요." : "내게 배정된 학교와 대표 연락처를 확인하세요."}</p>
    </header>
    {(rowsResult.error || optionsResult.error || historyResult.error) && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">학교 목록 또는 후속관리 기록을 불러오지 못했습니다. 학교 후속관리 SQL 적용 여부를 확인해 주세요.</p>}
    {assigneeResult.error && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{assigneeResult.error}</p>}
    <section id="school-list" className="scroll-mt-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-950">{admin ? "전체 학교" : "내 배정 학교"} <span className="text-indigo-600">{total.toLocaleString("ko-KR")}</span></h2><p className="mt-1 text-sm text-slate-500">학교명은 지역별로 중복될 수 있어 지역·학교급을 함께 표시합니다.</p></div>{Object.values(filters).some(Boolean) && <Link href="/admin/schools#school-list" className="text-sm font-semibold text-indigo-700 underline">필터 초기화</Link>}</div>
      <SchoolFilterForm filters={filters} locations={optionsResult.data ?? []} assignees={assigneeResult.assignees} admin={admin} />
      <SchoolTable key={JSON.stringify([filters, page])} rows={rows} total={total} page={page} pageCount={pageCount} filters={filters} admin={admin} assignees={assigneeResult.assignees} assigneeById={Object.fromEntries(assigneeById)} assignmentEnabled={!assigneeResult.error && !rowsResult.error} historyBySchool={historyBySchool} today={koreaDateKey(new Date())} />
      {pageCount > 1 && <nav aria-label="학교 목록 페이지" className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><p className="text-sm text-slate-500">{page} / {pageCount}페이지</p><div className="flex flex-wrap gap-2">{page > 1 && <Link href={`${schoolFiltersHref(filters, page - 1)}#school-list`} className="rounded-lg border px-3 py-2 text-sm">이전</Link>}{page < pageCount && <Link href={`${schoolFiltersHref(filters, page + 1)}#school-list`} className="rounded-lg border px-3 py-2 text-sm">다음</Link>}</div></nav>}
    </section>
  </div>;
}
