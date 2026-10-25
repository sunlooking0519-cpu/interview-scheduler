import Link from "next/link";
import { requireAdmin } from "@/server/admin-auth";
import { retrySalesCalendarSync } from "./actions";
import { SalesLeadCreator } from "@/features/admin/components/sales-lead-creator";

export const dynamic = "force-dynamic";

const kinds: Record<string, string> = { institution: "기관", school: "학교", other: "기타" };
const stages: Record<string, string> = { lead: "신규", contacted: "접촉", meeting: "상담", proposal: "제안", won: "성사", lost: "종료" };
const stageOrder = ["lead", "contacted", "meeting", "proposal", "won", "lost"];
const priorityLabels: Record<string, string> = { high: "집중", normal: "일반", low: "낮음" };
const dateKey = (value: string | Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date(value));
const dateLabel = (value: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "short", day: "numeric", weekday: "short" }).format(new Date(value));

type Organization = {
  id: string;
  name: string;
  kind: string;
  stage: string;
  priority: string;
  region: string | null;
  next_action: string | null;
  next_action_at: string | null;
  last_contact_at: string | null;
  updated_at: string;
};

export default async function SalesPage({ searchParams }: {
  searchParams: Promise<{ q?: string; stage?: string; view?: string; sync?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const { q = "", stage = "", view = "all", sync = "" } = await searchParams;
  const { data, error } = await supabase.schema("scheduler").from("sales_organizations")
    .select("id,name,kind,stage,priority,region,next_action,next_action_at,last_contact_at,updated_at")
    .order("updated_at", { ascending: false }).limit(300);
  const organizations = (data ?? []) as Organization[];
  const ids = organizations.map((organization) => organization.id);
  const { data: contactRows } = ids.length
    ? await supabase.schema("scheduler").from("sales_contacts").select("organization_id").in("organization_id", ids).limit(3000)
    : { data: [] as { organization_id: string }[] };
  const contactCounts = new Map<string, number>();
  for (const contact of contactRows ?? []) contactCounts.set(contact.organization_id, (contactCounts.get(contact.organization_id) ?? 0) + 1);

  const today = dateKey(new Date());
  const isOpen = (organization: Organization) => !["won", "lost"].includes(organization.stage);
  const isOverdue = (organization: Organization) => Boolean(organization.next_action_at && dateKey(organization.next_action_at) < today && isOpen(organization));
  const isToday = (organization: Organization) => Boolean(organization.next_action_at && dateKey(organization.next_action_at) === today && isOpen(organization));
  const isUnplanned = (organization: Organization) => Boolean(!organization.next_action_at && isOpen(organization));
  const summary = {
    overdue: organizations.filter(isOverdue).length,
    today: organizations.filter(isToday).length,
    unplanned: organizations.filter(isUnplanned).length,
    active: organizations.filter(isOpen).length,
  };
  const normalizedQuery = q.trim().toLocaleLowerCase("ko-KR");
  const visibleOrganizations = organizations.filter((organization) => {
    if (normalizedQuery && ![organization.name, organization.region ?? "", organization.next_action ?? ""].some((value) => value.toLocaleLowerCase("ko-KR").includes(normalizedQuery))) return false;
    if (stage && organization.stage !== stage) return false;
    if (view === "overdue" && !isOverdue(organization)) return false;
    if (view === "today" && !isToday(organization)) return false;
    if (view === "unplanned" && !isUnplanned(organization)) return false;
    return true;
  }).sort((a, b) => {
    const rank = (item: Organization) => isOverdue(item) ? 0 : isToday(item) ? 1 : item.next_action_at ? 2 : 3;
    return rank(a) - rank(b) || (a.next_action_at ?? "9999").localeCompare(b.next_action_at ?? "9999");
  });

  const metricClass = "rounded-2xl border bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-sm";
  return <div className="space-y-6">
    <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-700 p-6 text-white shadow-lg sm:p-8">
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div><p className="text-xs font-bold tracking-[0.22em] text-indigo-200">SALES WORKSPACE</p><h1 className="mt-3 text-3xl font-bold sm:text-4xl">오늘 할 영업이 먼저 보이게</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-indigo-100 sm:text-base">명함을 등록한 뒤, 접촉 기록과 다음 행동을 끊김 없이 이어갑니다. 시트의 긴 메모는 활동 이력으로, ‘다시 연락’은 마감이 있는 할 일로 관리합니다.</p></div>
        <div className="grid shrink-0 grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:grid-cols-2">
          {["명함 등록", "활동 기록", "후속 일정", "성사·종료"].map((text, index) => <div key={text} className="rounded-xl bg-white/10 px-3 py-2 backdrop-blur"><span className="mr-2 text-indigo-200">{index + 1}</span>{text}</div>)}
        </div>
      </div>
    </header>

    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">영업 데이터를 불러오지 못했습니다. 새 워크플로우 마이그레이션과 scheduler API 노출을 확인해 주세요.</p>}
    <section aria-label="업무 요약" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Link href="/admin/sales?view=overdue" className={`${metricClass} ${view === "overdue" ? "border-rose-400 ring-2 ring-rose-100" : "border-slate-200"}`}><p className="text-sm font-semibold text-rose-700">기한 지남</p><p className="mt-2 text-3xl font-bold text-slate-950">{summary.overdue}</p><p className="mt-1 text-xs text-slate-500">가장 먼저 확인</p></Link>
      <Link href="/admin/sales?view=today" className={`${metricClass} ${view === "today" ? "border-amber-400 ring-2 ring-amber-100" : "border-slate-200"}`}><p className="text-sm font-semibold text-amber-700">오늘 후속</p><p className="mt-2 text-3xl font-bold text-slate-950">{summary.today}</p><p className="mt-1 text-xs text-slate-500">전화·메일·자료 발송</p></Link>
      <Link href="/admin/sales?view=unplanned" className={`${metricClass} ${view === "unplanned" ? "border-sky-400 ring-2 ring-sky-100" : "border-slate-200"}`}><p className="text-sm font-semibold text-sky-700">다음 행동 없음</p><p className="mt-2 text-3xl font-bold text-slate-950">{summary.unplanned}</p><p className="mt-1 text-xs text-slate-500">누락되기 쉬운 대상</p></Link>
      <Link href="/admin/sales?view=all" className={`${metricClass} ${view === "all" ? "border-indigo-400 ring-2 ring-indigo-100" : "border-slate-200"}`}><p className="text-sm font-semibold text-indigo-700">진행 중</p><p className="mt-2 text-3xl font-bold text-slate-950">{summary.active}</p><p className="mt-1 text-xs text-slate-500">전체 영업 파이프라인</p></Link>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">진행 단계</h2><p className="mt-1 text-sm text-slate-500">대상을 단계별로 옮기고, 각 접촉 뒤에는 다음 행동을 예약하세요.</p></div><form action={retrySalesCalendarSync}><button className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-indigo-400">캘린더 동기화 재시도</button></form></div>
      <div className="mt-4 grid grid-cols-3 gap-2 lg:grid-cols-6">{stageOrder.map((key) => <Link key={key} href={`/admin/sales?stage=${key}`} className={`rounded-xl border px-3 py-3 ${stage === key ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-slate-50"}`}><p className="text-xs text-slate-500">{stages[key]}</p><p className="mt-1 text-xl font-bold">{organizations.filter((item) => item.stage === key).length}</p></Link>)}</div>
      {sync === "done" && <p role="status" className="mt-3 text-sm text-emerald-700">대기 중인 일정의 동기화를 처리했습니다.</p>}{sync === "retry" && <p role="alert" className="mt-3 text-sm text-amber-700">일부 일정이 아직 대기 중입니다. 잠시 후 다시 시도해 주세요.</p>}{sync === "error" && <p role="alert" className="mt-3 text-sm text-red-700">Google 연결을 확인해 주세요.</p>}
    </section>

    <details className="group rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 sm:p-6">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><div><h2 className="font-bold text-indigo-950">새 영업 대상 · 명함 등록</h2><p className="mt-1 text-sm text-indigo-800">현장에서 돌아온 직후 사진 한 장으로 시작합니다.</p></div><span className="rounded-full bg-indigo-600 px-3 py-1 text-sm font-bold text-white group-open:hidden">열기 +</span><span className="hidden text-sm font-semibold text-indigo-700 group-open:inline">접기</span></summary>
      <div className="mt-5"><SalesLeadCreator /></div>
    </details>

    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><h2 className="text-lg font-bold">후속 조치 큐 <span className="text-indigo-600">{visibleOrganizations.length}</span></h2><p className="mt-1 text-sm text-slate-500">기한이 지난 일, 오늘 할 일, 예정된 일 순서입니다.</p></div><form className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_110px]"><input type="hidden" name="view" value={view}/><input name="q" defaultValue={q} placeholder="기관·지역·다음 행동 검색" aria-label="영업 대상 검색" className="min-w-0 rounded-xl border border-slate-300 px-3 py-2"/><select name="stage" defaultValue={stage} aria-label="진행 단계" className="rounded-xl border border-slate-300 px-3 py-2"><option value="">전체 단계</option>{Object.entries(stages).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white">조회</button></form></div>
      <div className="mt-5 space-y-3">{visibleOrganizations.map((organization) => {
        const overdue = isOverdue(organization); const dueToday = isToday(organization);
        return <Link key={organization.id} href={`/admin/sales/${organization.id}`} className="group grid gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-indigo-400 hover:shadow-sm md:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)_auto] md:items-center">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="break-words text-base text-slate-950">{organization.name}</strong>{organization.priority === "high" && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">집중</span>}<span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">{stages[organization.stage] ?? organization.stage}</span></div><p className="mt-1 text-sm text-slate-500">{[organization.region, kinds[organization.kind], `담당자 ${contactCounts.get(organization.id) ?? 0}명`, priorityLabels[organization.priority]].filter(Boolean).join(" · ")}</p></div>
          <div className={`rounded-xl px-3 py-2 ${overdue ? "bg-rose-50" : dueToday ? "bg-amber-50" : "bg-slate-50"}`}><p className={`text-xs font-bold ${overdue ? "text-rose-700" : dueToday ? "text-amber-700" : "text-slate-500"}`}>{overdue ? "기한 지남" : dueToday ? "오늘" : organization.next_action_at ? dateLabel(organization.next_action_at) : "다음 행동 미정"}</p><p className="mt-1 line-clamp-2 text-sm font-medium text-slate-800">{organization.next_action || "상세 화면에서 다음 행동을 정해 주세요."}</p></div>
          <span className="text-sm font-bold text-indigo-700 group-hover:translate-x-0.5">기록하기 →</span>
        </Link>;
      })}</div>
      {!error && !visibleOrganizations.length && <div className="mt-5 rounded-xl bg-slate-50 p-8 text-center"><p className="font-semibold text-slate-700">조건에 맞는 영업 대상이 없습니다.</p><p className="mt-1 text-sm text-slate-500">필터를 초기화하거나 새 명함을 등록해 주세요.</p></div>}
    </section>
  </div>;
}
