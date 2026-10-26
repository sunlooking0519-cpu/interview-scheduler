import Link from "next/link";
import { requireAdmin } from "@/server/admin-auth";
import { retrySalesCalendarSync } from "./actions";
import { SalesDashboard } from "@/features/admin/components/sales-dashboard";
import type { DashboardActivity, DashboardCard, DashboardContact, DashboardMeeting, DashboardOrganization } from "@/features/admin/sales-dashboard-model";
import {
  elapsedDays,
  followUpStatusLabels,
  isDueBefore,
  isDueOn,
  isFirstFollowUpQueue,
  isOpenSalesOrganization,
  koreaDateKey,
  nextActionTypeLabels,
} from "@/features/admin/sales-follow-up";

export const dynamic = "force-dynamic";

const stages: Record<string, string> = { lead: "신규", contacted: "접촉", meeting: "상담", proposal: "제안", won: "성사", lost: "종료" };
const stageOrder = ["lead", "contacted", "meeting", "proposal", "won", "lost"];
const reactionLabels: Record<string, string> = { interested: "관심 높음", reviewing: "검토 중", waiting: "시기 대기", neutral: "보통", no_budget: "예산 없음", not_interested: "관심 없음", no_response: "응답 없음" };
const dateLabel = (value: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "short", day: "numeric", weekday: "short" }).format(new Date(value));

type Organization = {
  id: string;
  name: string;
  kind: string;
  stage: string;
  priority: string;
  region: string | null;
  address: string | null;
  next_action: string | null;
  next_action_type: string | null;
  next_action_at: string | null;
  next_contact_id: string | null;
  last_contact_at: string | null;
  last_follow_up_round: number;
  follow_up_status: string;
  updated_at: string;
};

type Contact = {
  id: string;
  organization_id: string;
  name: string;
  title: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
};

type FirstFollowUp = {
  organization_id: string;
  occurred_at: string;
  reaction: string;
};

export default async function SalesPage({ searchParams }: {
  searchParams: Promise<{ q?: string; stage?: string; view?: string; sync?: string; saved?: string; month?: string; day?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const { q = "", stage = "", view = "visits", sync = "", saved = "", month: requestedMonth, day: requestedDay } = await searchParams;
  const db = supabase.schema("scheduler");
  const { data, error } = await db.from("sales_organizations")
    .select("id,name,kind,stage,priority,region,address,next_action,next_action_type,next_action_at,next_contact_id,last_contact_at,last_follow_up_round,follow_up_status,updated_at")
    .order("updated_at", { ascending: false }).limit(300);
  const organizations = (data ?? []) as Organization[];
  const ids = organizations.map((organization) => organization.id);
  if (view === "visits") {
    const today = koreaDateKey(new Date());
    const month = requestedMonth && /^(20\d{2})-(0[1-9]|1[0-2])$/.test(requestedMonth) ? requestedMonth : today.slice(0, 7);
    const [year, monthNumber] = month.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const selectedDay = requestedDay && requestedDay.startsWith(`${month}-`) && /^\d{4}-\d{2}-\d{2}$/.test(requestedDay) && Number(requestedDay.slice(-2)) >= 1 && Number(requestedDay.slice(-2)) <= lastDay
      ? requestedDay : month === today.slice(0, 7) ? today : `${month}-01`;
    const nextMonth = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 7);
    const monthStart = new Date(`${month}-01T00:00:00+09:00`).toISOString();
    const monthEnd = new Date(`${nextMonth}-01T00:00:00+09:00`).toISOString();
    const empty = Promise.resolve({ data: [], error: null });
    const [cardsResult, contactsResult, visitsResult, activitiesResult, meetingsResult, recentResult] = await Promise.all([
      ids.length ? db.from("sales_business_cards").select("id,organization_id,contact_id,created_at").in("organization_id", ids).order("created_at", { ascending: false }).limit(3000) : empty,
      ids.length ? db.from("sales_contacts").select("id,organization_id,name,title,phone,mobile,email").in("organization_id", ids).order("created_at", { ascending: true }).limit(3000) : empty,
      ids.length ? db.from("sales_activities").select("id,organization_id,contact_id,activity_type,occurred_at,created_at,summary,follow_up_round").in("organization_id", ids).eq("activity_type", "visit").order("occurred_at", { ascending: false }).limit(3000) : empty,
      ids.length ? db.from("sales_activities").select("id,organization_id,contact_id,activity_type,occurred_at,created_at,summary,follow_up_round").in("organization_id", ids).gte("occurred_at", monthStart).lt("occurred_at", monthEnd).order("occurred_at", { ascending: true }).limit(3000) : empty,
      ids.length ? db.from("sales_meetings").select("id,organization_id,contact_id,title,starts_at,location,status").in("organization_id", ids).gte("starts_at", monthStart).lt("starts_at", monthEnd).order("starts_at", { ascending: true }).limit(3000) : empty,
      ids.length ? db.from("sales_activities").select("id,organization_id,contact_id,activity_type,occurred_at,created_at,summary,follow_up_round").in("organization_id", ids).order("created_at", { ascending: false }).limit(15) : empty,
    ]);
    return <SalesDashboard
      organizations={organizations as DashboardOrganization[]}
      contacts={(contactsResult.data ?? []) as DashboardContact[]}
      cards={(cardsResult.data ?? []) as DashboardCard[]}
      visits={(visitsResult.data ?? []) as DashboardActivity[]}
      monthActivities={(activitiesResult.data ?? []) as DashboardActivity[]}
      meetings={(meetingsResult.data ?? []) as DashboardMeeting[]}
      recentActivities={(recentResult.data ?? []) as DashboardActivity[]}
      month={month} selectedDay={selectedDay} today={today} saved={saved}
      loadError={Boolean(error || cardsResult.error || contactsResult.error || visitsResult.error || activitiesResult.error || meetingsResult.error || recentResult.error)}
    />;
  }
  const [contactsResult, firstFollowUpsResult] = ids.length ? await Promise.all([
    db.from("sales_contacts").select("id,organization_id,name,title,phone,mobile,email").in("organization_id", ids).order("created_at", { ascending: true }).limit(3000),
    db.from("sales_activities").select("organization_id,occurred_at,reaction").in("organization_id", ids).eq("follow_up_round", 1).eq("activity_type", "email").order("occurred_at", { ascending: false }).limit(3000),
  ]) : [{ data: [] }, { data: [] }];
  const contacts = (contactsResult.data ?? []) as Contact[];
  const firstFollowUps = (firstFollowUpsResult.data ?? []) as FirstFollowUp[];
  const loadError = error || contactsResult.error || firstFollowUpsResult.error;

  const contactsByOrganization = new Map<string, Contact[]>();
  for (const contact of contacts) contactsByOrganization.set(contact.organization_id, [...(contactsByOrganization.get(contact.organization_id) ?? []), contact]);
  const firstFollowUpByOrganization = new Map<string, FirstFollowUp>();
  for (const activity of firstFollowUps) if (!firstFollowUpByOrganization.has(activity.organization_id)) firstFollowUpByOrganization.set(activity.organization_id, activity);

  const today = koreaDateKey(new Date());
  const firstQueue = organizations.filter(isFirstFollowUpQueue);
  const isSecondOverdue = (organization: Organization) => isFirstFollowUpQueue(organization) && isDueBefore(organization, today);
  const isSecondToday = (organization: Organization) => isFirstFollowUpQueue(organization) && isDueOn(organization, today);
  const summary = {
    firstFollowUp: firstQueue.length,
    overdue: organizations.filter(isSecondOverdue).length,
    today: organizations.filter(isSecondToday).length,
    active: organizations.filter(isOpenSalesOrganization).length,
  };
  const normalizedQuery = q.trim().toLocaleLowerCase("ko-KR");
  const visibleOrganizations = organizations.filter((organization) => {
    const organizationContacts = contactsByOrganization.get(organization.id) ?? [];
    if (normalizedQuery && ![
      organization.name,
      organization.region ?? "",
      organization.next_action ?? "",
      ...organizationContacts.flatMap((contact) => [contact.name, contact.email ?? "", contact.mobile ?? "", contact.phone ?? ""]),
    ].some((value) => value.toLocaleLowerCase("ko-KR").includes(normalizedQuery))) return false;
    if (stage && organization.stage !== stage) return false;
    if (view === "first-followup" && !isFirstFollowUpQueue(organization)) return false;
    if (view === "overdue" && !isSecondOverdue(organization)) return false;
    if (view === "today" && !isSecondToday(organization)) return false;
    return true;
  }).sort((a, b) => {
    const rank = (item: Organization) => isSecondOverdue(item) ? 0 : isSecondToday(item) ? 1 : item.next_action_at ? 2 : 3;
    return rank(a) - rank(b) || (a.next_action_at ?? "9999").localeCompare(b.next_action_at ?? "9999");
  });

  const metricClass = "rounded-2xl border bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-sm";
  return <div className="space-y-6">
    <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-700 p-6 text-white shadow-lg sm:p-8">
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div><p className="text-xs font-bold tracking-[0.22em] text-indigo-200">SECOND FOLLOW-UP</p><h1 className="mt-3 text-3xl font-bold sm:text-4xl">1차 메일 이후, 다음 연락을 놓치지 않게</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-indigo-100 sm:text-base">첫 미팅 뒤 1차 후속 메일을 보낸 기관을 한곳에 모았습니다. 담당자에게 바로 전화하거나 메일을 열고, 결과를 기록하면 다음 단계로 이동합니다.</p><Link href="/admin/sales" className="mt-5 inline-flex rounded-lg border border-white/50 px-4 py-2 text-sm font-bold text-white">← 방문·상담 대시보드</Link></div>
        <div className="rounded-2xl bg-white/10 px-5 py-4 backdrop-blur"><p className="text-xs font-bold text-indigo-200">현재 우선 업무</p><p className="mt-1 text-2xl font-bold">2차 후속 {summary.firstFollowUp}건</p><p className="mt-1 text-xs text-indigo-100">기한 지남 {summary.overdue} · 오늘 {summary.today}</p></div>
      </div>
    </header>

    {loadError && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">영업 데이터를 불러오지 못했습니다. 후속관리 마이그레이션과 scheduler API 노출을 확인해 주세요.</p>}
    <section aria-label="업무 요약" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Link href="/admin/sales?view=first-followup" className={`${metricClass} ${view === "first-followup" ? "border-indigo-500 ring-2 ring-indigo-100" : "border-slate-200"}`}><p className="text-sm font-semibold text-indigo-700">1차 메일 완료 · 2차 필요</p><p className="mt-2 text-3xl font-bold text-slate-950">{summary.firstFollowUp}</p><p className="mt-1 text-xs text-slate-500">관리자의 기본 작업 큐</p></Link>
      <Link href="/admin/sales?view=overdue" className={`${metricClass} ${view === "overdue" ? "border-rose-400 ring-2 ring-rose-100" : "border-slate-200"}`}><p className="text-sm font-semibold text-rose-700">2차 후속 기한 지남</p><p className="mt-2 text-3xl font-bold text-slate-950">{summary.overdue}</p><p className="mt-1 text-xs text-slate-500">가장 먼저 연락</p></Link>
      <Link href="/admin/sales?view=today" className={`${metricClass} ${view === "today" ? "border-amber-400 ring-2 ring-amber-100" : "border-slate-200"}`}><p className="text-sm font-semibold text-amber-700">오늘 2차 후속</p><p className="mt-2 text-3xl font-bold text-slate-950">{summary.today}</p><p className="mt-1 text-xs text-slate-500">전화·이메일 실행</p></Link>
      <Link href="/admin/sales?view=all" className={`${metricClass} ${view === "all" ? "border-slate-500 ring-2 ring-slate-100" : "border-slate-200"}`}><p className="text-sm font-semibold text-slate-700">전체 진행 중</p><p className="mt-2 text-3xl font-bold text-slate-950">{summary.active}</p><p className="mt-1 text-xs text-slate-500">전체 영업 파이프라인</p></Link>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">진행 단계</h2><p className="mt-1 text-sm text-slate-500">1차 메일은 기관 상세에서 후속 차수 `1차`로 기록하면 이 작업 큐에 자동으로 들어옵니다.</p></div><form action={retrySalesCalendarSync}><button className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-indigo-400">캘린더 동기화 재시도</button></form></div>
      <div className="mt-4 grid grid-cols-3 gap-2 lg:grid-cols-6">{stageOrder.map((key) => <Link key={key} href={`/admin/sales?view=${view}&stage=${key}`} className={`rounded-xl border px-3 py-3 ${stage === key ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-slate-50"}`}><p className="text-xs text-slate-500">{stages[key]}</p><p className="mt-1 text-xl font-bold">{organizations.filter((item) => item.stage === key).length}</p></Link>)}</div>
      {sync === "done" && <p role="status" className="mt-3 text-sm text-emerald-700">대기 중인 일정의 동기화를 처리했습니다.</p>}{sync === "retry" && <p role="alert" className="mt-3 text-sm text-amber-700">일부 일정이 아직 대기 중입니다. 잠시 후 다시 시도해 주세요.</p>}{sync === "error" && <p role="alert" className="mt-3 text-sm text-red-700">Google 연결을 확인해 주세요.</p>}
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><h2 className="text-lg font-bold">{view === "all" ? "전체 영업 대상" : "2차 후속 작업 큐"} <span className="text-indigo-600">{visibleOrganizations.length}</span></h2><p className="mt-1 text-sm text-slate-500">{view === "all" ? "모든 진행 상태를 확인합니다." : "기한이 지난 일, 오늘 할 일, 예정된 일 순서입니다."}</p></div><form className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_110px]"><input type="hidden" name="view" value={view}/><input name="q" defaultValue={q} placeholder="기관·담당자·연락처 검색" aria-label="영업 대상 검색" className="min-w-0 rounded-xl border border-slate-300 px-3 py-2"/><select name="stage" defaultValue={stage} aria-label="진행 단계" className="rounded-xl border border-slate-300 px-3 py-2"><option value="">전체 단계</option>{Object.entries(stages).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select><button className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white">조회</button></form></div>
      <div className="mt-5 space-y-3">{visibleOrganizations.map((organization) => {
        const organizationContacts = contactsByOrganization.get(organization.id) ?? [];
        const contact = organizationContacts.find((item) => item.id === organization.next_contact_id) ?? organizationContacts[0];
        const phone = contact?.mobile || contact?.phone || "";
        const firstFollowUp = firstFollowUpByOrganization.get(organization.id);
        const overdue = isSecondOverdue(organization);
        const dueToday = isSecondToday(organization);
        const mailSubject = encodeURIComponent(`[후속 연락] ${organization.name}`);
        return <article key={organization.id} className="grid gap-4 rounded-2xl border border-slate-200 p-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)_auto] md:items-center">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Link href={`/admin/sales/${organization.id}`} className="break-words text-base font-bold text-slate-950 hover:text-indigo-700">{organization.name}</Link>{organization.priority === "high" && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">집중</span>}<span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">{stages[organization.stage] ?? organization.stage}</span></div><p className="mt-1 text-sm text-slate-600">{contact ? `${contact.name}${contact.title ? ` · ${contact.title}` : ""}` : "담당자 미지정"}</p><p className="mt-1 text-xs text-slate-500">{firstFollowUp ? `1차 메일 ${dateLabel(firstFollowUp.occurred_at)} · ${elapsedDays(firstFollowUp.occurred_at)}일 경과 · ${reactionLabels[firstFollowUp.reaction] ?? firstFollowUp.reaction}` : `후속 상태 ${followUpStatusLabels[organization.follow_up_status] ?? organization.follow_up_status}`}</p></div>
          <div className={`rounded-xl px-3 py-2 ${overdue ? "bg-rose-50" : dueToday ? "bg-amber-50" : "bg-slate-50"}`}><p className={`text-xs font-bold ${overdue ? "text-rose-700" : dueToday ? "text-amber-700" : "text-slate-500"}`}>{overdue ? "기한 지남" : dueToday ? "오늘" : organization.next_action_at ? dateLabel(organization.next_action_at) : "다음 행동 미정"}</p><p className="mt-1 line-clamp-2 text-sm font-medium text-slate-800">{organization.next_action_type ? `${nextActionTypeLabels[organization.next_action_type]} · ` : ""}{organization.next_action || "상세 화면에서 다음 행동을 정해 주세요."}</p></div>
          <div className="flex flex-wrap gap-2 md:max-w-[220px] md:justify-end">{phone && <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`} className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">전화</a>}{contact?.email && <a href={`mailto:${contact.email}?subject=${mailSubject}`} className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-800">이메일</a>}<Link href={`/admin/sales/${organization.id}#quick-log`} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white">결과 기록</Link></div>
        </article>;
      })}</div>
      {!loadError && !visibleOrganizations.length && <div className="mt-5 rounded-xl bg-slate-50 p-8 text-center"><p className="font-semibold text-slate-700">{view === "all" ? "현재 조건에 맞는 영업 대상이 없습니다." : "현재 조건에 맞는 2차 후속 대상이 없습니다."}</p><p className="mt-1 text-sm text-slate-500">{view === "all" ? "검색어와 진행 단계를 확인해 주세요." : "명함 등록만 완료한 기관은 1차 후속 메일을 기록하기 전까지 이 작업 큐에 표시되지 않습니다."}</p>{view !== "all" && <div className="mt-4 flex flex-wrap justify-center gap-2"><Link href="/admin/sales?view=all" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">전체 영업 대상 보기</Link><Link href="/admin/sales/cards" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">등록된 명함 보기</Link></div>}</div>}
    </section>
  </div>;
}
