import Link from "next/link";
import { requireAdmin } from "@/server/admin-auth";
import { createServiceClient } from "../../../../lib/supabase/service";
import { buildInstructorHierarchy, type HiredTeacher, type StaffAccount } from "@/features/admin/instructor-hierarchy";
import { loadSalesOrganizationData } from "@/server/sales-organization-data";
import { SalesExportDialog } from "@/features/admin/components/sales-export-dialog";
import { setInstructorAccess } from "./actions";

export const dynamic = "force-dynamic";

const dateLabel = (value: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
const proposalLabels: Record<string, string> = { not_submitted: "미제출", planned: "제출 예정", submitted: "제출 완료" };
const reactionLabels: Record<string, string> = { interested: "관심 높음", reviewing: "검토 중", waiting: "시기 대기", neutral: "보통", no_budget: "예산 없음", not_interested: "관심 없음", no_response: "응답 없음" };
const salesStages: Record<string, string> = { lead: "신규", contacted: "접촉", meeting: "상담", proposal: "제안", won: "성사", lost: "종료" };
const messages: Record<string, string> = {
  approved: "중간관리자 권한을 부여했습니다. 이제 면접과 채용을 처리할 수 있습니다.",
  revoked: "중간관리자 권한을 해제했습니다. 기존 채용 기록은 보존됩니다.",
  invalid: "가입 요청 정보를 확인해 주세요.", protected: "최고관리자 계정은 이 화면에서 변경할 수 없습니다.",
  unlinked: "채용 기록과 연결되지 않은 요청입니다. 이름·이메일·채용 상태를 확인해 주세요.",
  setup: "권한 승인 전에 Supabase에 instructor-hiring-migration.sql을 적용해 주세요.",
  error: "권한을 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.",
};

function TeacherList({ teachers }: { teachers: HiredTeacher[] }) {
  if (!teachers.length) return <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">아직 채용한 강사가 없습니다.</p>;
  return <ul className="divide-y divide-slate-100">{teachers.map((teacher) => <li key={teacher.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0"><div><p className="font-semibold text-slate-900">{teacher.name}</p><p className="text-xs text-slate-500">{teacher.phone}{teacher.email ? ` · ${teacher.email}` : ""}</p></div><span className="text-xs text-slate-500">채용 {dateLabel(teacher.hired_at)}</span></li>)}</ul>;
}

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const { supabase } = await requireAdmin();
  const { result = "" } = await searchParams;
  const accounts: StaffAccount[] = [];
  let accountError = "";
  let hiringError = "";
  let teachers: HiredTeacher[] = [];
  try {
    const service = createServiceClient();
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      for (const user of data.users) {
        const role = String(user.app_metadata.role ?? "");
        const requestedRole = String(user.user_metadata.requested_role ?? "");
        if (!["admin", "super_admin", "instructor"].includes(role) && requestedRole !== "instructor") continue;
        accounts.push({ id: user.id, email: user.email ?? "", name: String(user.user_metadata.full_name ?? ""), role, requestedRole, createdAt: user.created_at, promotionCandidateId: String(user.app_metadata.promotion_candidate_id ?? "") });
      }
      if (data.users.length < 200) break;
    }
  } catch { accountError = "계정 목록을 불러오지 못했습니다. Supabase 서버 키와 Auth 권한을 확인해 주세요."; }

  const { data: hires, error: hiresError } = await supabase.schema("scheduler").from("interviews")
    .select("id,name,email,phone,interview_date,hired_at,hired_by")
    .not("hired_at", "is", null).order("hired_at", { ascending: false }).limit(1000);
  if (hiresError) hiringError = "채용 기록을 불러오지 못했습니다. instructor-hiring-migration.sql 적용 여부를 확인해 주세요.";
  else teachers = (hires ?? []) as HiredTeacher[];

  const { topAdministrators, middleManagers, formerManagers, requests, teachersByRecruiter, directHires, unattributedHires } = buildInstructorHierarchy(accounts, teachers);
  middleManagers.sort((a, b) => (teachersByRecruiter.get(b.id)?.length ?? 0) - (teachersByRecruiter.get(a.id)?.length ?? 0) || a.name.localeCompare(b.name, "ko"));
  requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const hiresById = new Map(teachers.map((teacher) => [String(teacher.id), teacher]));
  const workspaces = await supabase.schema("scheduler").from("sales_workspaces").select("id,owner_user_id").limit(1000);
  const workspaceOwner = new Map((workspaces.data ?? []).map((item) => [item.id, item.owner_user_id]));
  const salesData = workspaces.error ? null : await loadSalesOrganizationData(supabase);
  const salesByManager = new Map<string, NonNullable<typeof salesData>["rows"]>();
  for (const organization of salesData?.rows ?? []) {
    const owner = workspaceOwner.get(organization.workspace_id ?? "");
    if (owner) salesByManager.set(owner, [...(salesByManager.get(owner) ?? []), organization]);
  }
  const salesError = workspaces.error || salesData?.loadError;
  return <div className="space-y-6">
    <header className="rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-800 p-6 text-white sm:p-8"><p className="text-xs font-bold tracking-[0.2em] text-indigo-200">INSTRUCTOR TEAM</p><h1 className="mt-3 text-3xl font-bold">강사 관리</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-indigo-100">최고관리자가 면접·채용 권한을 가진 중간관리자를 승인하고, 각 관리자가 채용한 강사를 확인합니다.</p></header>
    {result && messages[result] && <p role={["approved", "revoked"].includes(result) ? "status" : "alert"} className="rounded-xl bg-indigo-50 p-4 text-sm text-indigo-800">{messages[result]}</p>}
    {accountError && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{accountError}</p>}
    {hiringError && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{hiringError}</p>}
    {salesError && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">강사별 영업 현황을 불러오지 못했습니다. sales-manager-workspaces-migration.sql 적용 여부를 확인해 주세요.</p>}
    <section aria-label="강사 조직 요약" className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm font-semibold text-slate-600">최고관리자</p><p className="mt-2 text-3xl font-bold">{topAdministrators.length}</p></div><div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5"><p className="text-sm font-semibold text-indigo-700">중간관리자 · 면접·채용 권한</p><p className="mt-2 text-3xl font-bold">{middleManagers.length}</p></div><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-sm font-semibold text-emerald-700">채용강사</p><p className="mt-2 text-3xl font-bold">{teachers.length}</p></div></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"><h2 className="text-xl font-bold">강사 구조</h2><p className="mt-1 text-sm text-slate-500">채용자는 채용 버튼을 누른 계정의 기록입니다.</p><div className="mt-5 rounded-xl bg-slate-950 p-4 text-white"><p className="text-xs font-bold text-indigo-200">최고관리자</p><div className="mt-2 flex flex-wrap gap-2">{topAdministrators.map((account) => <span key={account.id} className="rounded-lg bg-white/10 px-3 py-2 text-sm">{account.name || account.email}</span>)}{!topAdministrators.length && <span className="text-sm text-slate-300">계정을 불러오지 못했습니다.</span>}</div></div><div className="mx-6 h-5 border-l-2 border-indigo-200"/><div className="grid gap-3 lg:grid-cols-2">{middleManagers.map((manager) => { const recruited = teachersByRecruiter.get(manager.id) ?? []; const sales = salesByManager.get(manager.id) ?? []; return <article key={manager.id} className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-bold text-indigo-700">중간관리자 · 면접·채용 가능</p><h3 className="mt-1 font-bold text-slate-950">{manager.name || manager.email}</h3><p className="text-xs text-slate-500">{manager.email}</p></div><span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-bold text-indigo-800">채용 {recruited.length}명</span></div><div className="mt-4 border-t border-indigo-100 pt-3"><p className="mb-2 text-xs font-bold text-slate-600">이 관리자가 채용한 강사</p><TeacherList teachers={recruited}/></div><div className="mt-4 border-t border-indigo-100 pt-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold text-slate-900">영업 현황 · 기관 {sales.length}곳</p><SalesExportDialog manager={{ id: manager.id, name: manager.name || manager.email }} count={sales.length} disabled={Boolean(salesError) || !sales.length} /></div><p className="mt-1 text-xs text-slate-600">제안서 제출 완료 {sales.filter((item) => item.proposalStatus === "submitted").length}곳 · 최근 업데이트 {sales[0] ? dateLabel(sales[0].lastUpdatedAt) : "없음"}</p><details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-indigo-700">기관별 상태 보기</summary><ul className="mt-2 max-h-72 divide-y divide-indigo-100 overflow-y-auto">{sales.map((item) => <li key={item.id} className="py-2 text-sm"><Link href={`/admin/sales/${item.id}`} className="font-semibold text-slate-900 underline">{item.name}</Link><p className="mt-1 text-xs text-slate-600">{salesStages[item.stage ?? ""] ?? "단계 미기록"} · {proposalLabels[item.proposalStatus ?? ""] ?? "제안서 미기록"} · {reactionLabels[item.reaction ?? ""] ?? "반응 미기록"} · {dateLabel(item.lastUpdatedAt)}</p></li>)}</ul>{!sales.length && <p className="mt-2 text-sm text-slate-500">등록된 기관이 없습니다.</p>}</details></div></article>; })}{!middleManagers.length && <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">승인된 중간관리자가 없습니다. 아래 가입 요청에서 승인해 주세요.</p>}</div></section>
    {(directHires.length > 0 || formerManagers.length > 0 || unattributedHires.length > 0) && <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"><h2 className="text-xl font-bold">다른 채용 기록</h2><div className="mt-4 space-y-4">{topAdministrators.filter((account) => teachersByRecruiter.has(account.id)).map((account) => <div key={account.id} className="rounded-xl border border-slate-200 p-4"><h3 className="mb-3 font-bold">최고관리자 직접 채용 · {account.name || account.email}</h3><TeacherList teachers={teachersByRecruiter.get(account.id) ?? []}/></div>)}{formerManagers.map((account) => <div key={account.id} className="rounded-xl border border-slate-200 p-4"><h3 className="mb-3 font-bold">권한 해제된 중간관리자 · {account.name || account.email}</h3><TeacherList teachers={teachersByRecruiter.get(account.id) ?? []}/></div>)}{unattributedHires.length > 0 && <div className="rounded-xl border border-amber-200 p-4"><h3 className="mb-3 font-bold">채용자 미확인</h3><TeacherList teachers={unattributedHires}/></div>}</div></section>}
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-xl font-bold">관리자 승격 요청</h2><p className="mt-1 text-sm text-slate-500">채용 기록의 휴대전화로 신청자를 확인한 뒤 승인하세요. 확인을 누르면 면접·채용 권한이 부여됩니다.</p></div><Link href="/admin?list=hired" className="text-sm font-bold text-indigo-700">채용 목록 보기 →</Link></div>
      <div className="mt-4 space-y-3">{requests.map((account) => {
        const hire = hiresById.get(account.promotionCandidateId ?? "");
        const eligible = !!hire?.hired_at && hire.name.trim() === account.name.trim() && (!hire.email || hire.email.trim().toLowerCase() === account.email.toLowerCase());
        return <article key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"><div><strong>{account.name || "이름 미입력"}</strong><p className="mt-1 text-sm text-slate-600">{account.email}</p><p className="mt-1 text-xs text-slate-500">{hire ? `채용 기록: ${hire.name} · ${hire.phone} · ${dateLabel(hire.hired_at)}` : "채용 기록 연결 필요"}</p></div><form action={setInstructorAccess}><input type="hidden" name="id" value={account.id}/><input type="hidden" name="action" value="approve"/><button disabled={!eligible} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">확인</button></form></article>;
      })}</div>
      {!accountError && requests.length === 0 && <p className="mt-4 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">대기 중인 요청이 없습니다.</p>}
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"><h2 className="text-xl font-bold">승인된 중간관리자</h2><div className="mt-4 space-y-3">{middleManagers.map((account) => <article key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"><div><strong>{account.name || "이름 미입력"}</strong><p className="mt-1 text-sm text-slate-600">{account.email}</p><p className="mt-1 text-xs text-slate-500">채용 {teachersByRecruiter.get(account.id)?.length ?? 0}명</p></div><form action={setInstructorAccess}><input type="hidden" name="id" value={account.id}/><input type="hidden" name="action" value="revoke"/><button className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700">권한 해제</button></form></article>)}</div>{!accountError && middleManagers.length === 0 && <p className="mt-4 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">승인된 중간관리자가 없습니다.</p>}</section>
    <p className="text-xs text-slate-500">채용강사는 채용 처리된 지원자 기록입니다. 채용만으로 관리자 로그인 계정이 생성되거나 면접관리 권한이 부여되지는 않습니다.</p>
  </div>;
}
