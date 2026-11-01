import Link from "next/link";
import { buildSalesDashboard, confirmedProgress, type DashboardActivity, type DashboardCard, type DashboardContact, type DashboardOrganization, type DashboardTask } from "../sales-dashboard-model";

const workflow = [
  ["기관 방문", "명함 등록 · 담당자와 상담 내용 기록"],
  ["제안서 메일", "상담에 맞춘 자료 발송"],
  ["메일 확인", "2일 이내 수신 여부 확인"],
  ["검토 결과", "5~7일 이내 관심·예산·시기 확인"],
  ["맞춤 제안", "추가 상담 · 견적 협의"],
  ["계약 확정", "교육 일정 · 계약 절차"],
  ["사후 관리", "보류 기관 재제안 시점 지정"],
] as const;
const activityLabels: Record<string, string> = { visit: "접촉", call: "전화", email: "메일", proposal: "제안서", meeting: "상담", note: "메모" };
const dateFormatter = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", weekday: "short" });
const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

function TaskCard({ task, today }: { task: DashboardTask; today: string }) {
  const phone = task.contact?.mobile || task.contact?.phone;
  const dueLabel = task.rank === 0 ? "기한 지남" : task.rank === 1 ? "오늘" : task.dueAt ? dateFormatter.format(new Date(task.dueAt)) : task.kind === "visit" ? "상담 기록 대기" : "날짜 미정";
  return <article className="rounded-xl border border-slate-200 p-4">
    <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${task.rank === 0 ? "bg-rose-50 text-rose-700" : task.rank === 1 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{dueLabel}</span><span className="text-xs text-slate-500">{task.progress}</span></div>
    <Link href={`/admin/sales/${task.organizationId}`} className="mt-2 block font-bold text-slate-950 hover:text-indigo-700">{task.organizationName}</Link>
    <p className="mt-1 text-sm text-slate-700">{task.title}</p><p className="mt-1 text-xs text-slate-500">{task.contact?.name ? `${task.contact.name}${task.contact.title ? ` · ${task.contact.title}` : ""}` : "담당자 미지정"}{task.dueDate && task.dueDate < today ? ` · ${dateFormatter.format(new Date(task.dueAt!))} 예정` : ""}</p>
    <div className="mt-3 flex flex-wrap gap-2">{phone && <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`} className="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-bold text-emerald-800">전화</a>}{task.contact?.email && <a href={`mailto:${task.contact.email}?subject=${encodeURIComponent(`[후속 연락] ${task.organizationName}`)}`} className="rounded-lg border border-sky-200 px-2.5 py-1.5 text-xs font-bold text-sky-800">이메일</a>}<Link href={task.kind === "visit" ? "/admin/sales/cards" : task.href} className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-bold text-white">{task.kind === "visit" ? "명함에서 기록" : "결과 기록"}</Link></div>
  </article>;
}

export function SalesDashboard({ organizations, contacts, cards, visits, recentActivities, today, loadError, saved }: {
  organizations: DashboardOrganization[]; contacts: DashboardContact[]; cards: DashboardCard[];
  visits: DashboardActivity[]; recentActivities: DashboardActivity[]; today: string;
  loadError: boolean; saved: string;
}) {
  const { tasks, counts } = buildSalesDashboard({ organizations, contacts, cards, visits, monthActivities: [], meetings: [], today, month: today.slice(0, 7) });
  const organizationById = new Map(organizations.map((organization) => [organization.id, organization]));
  const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
  const visitedOrganizations = new Set(visits.map((visit) => visit.organization_id));
  return <div className="space-y-6">
    <header className="rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-700 p-6 text-white sm:p-8"><p className="text-xs font-bold tracking-[0.2em] text-indigo-200">SALES WORKFLOW</p><h1 className="mt-3 text-3xl font-bold sm:text-4xl">영업 진행 현황</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-indigo-100">명함에서 상담 내용을 기록하고, 다음 연락과 제안 과정을 단계별로 확인하세요.</p><div className="mt-5 flex flex-wrap gap-2"><Link href="/admin/sales/cards" className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-indigo-800">명함에서 상담 기록</Link><Link href="/admin/sales?view=first-followup" className="rounded-lg border border-white/50 px-4 py-2 text-sm font-bold text-white">1차 메일 후속 관리</Link></div></header>
    {saved === "visit" && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">상담 기록을 저장했습니다. 최근 활동에서 확인할 수 있습니다.</p>}
    {loadError && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">일부 영업 데이터를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.</p>}
    <section aria-label="7단계 영업 과정" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"><h2 className="text-xl font-bold">영업 7단계</h2><p className="mt-1 text-sm text-slate-500">기관 방문부터 사후 관리까지 이어지는 업무 순서입니다.</p><ol className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{workflow.map(([title, detail], index) => <li key={title} className={`rounded-xl border p-4 ${index === 0 ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-slate-50"}`}><span className="text-xs font-bold text-indigo-700">{index + 1}단계</span><h3 className="mt-1 font-bold">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-600">{detail}</p>{index === 0 && <Link href="/admin/sales/cards" className="mt-3 inline-block text-xs font-bold text-indigo-700 underline">명함 목록 열기</Link>}</li>)}</ol></section>
    <section aria-label="오늘의 영업 업무 요약" className="grid grid-cols-2 gap-3 lg:grid-cols-4"><div className="rounded-2xl border border-rose-200 bg-rose-50 p-4"><p className="text-sm font-semibold text-rose-800">기한 지남</p><p className="mt-1 text-3xl font-bold">{counts.overdue}</p></div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-800">오늘 할 일</p><p className="mt-1 text-3xl font-bold">{counts.today}</p></div><div className="rounded-2xl border border-sky-200 bg-sky-50 p-4"><p className="text-sm font-semibold text-sky-800">7일 안에 예정</p><p className="mt-1 text-3xl font-bold">{counts.upcoming}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm font-semibold text-slate-600">상담 기록 대기</p><p className="mt-1 text-3xl font-bold">{counts.missingVisit}</p></div></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6" aria-label="우선 작업 큐"><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-xl font-bold">다음 할 일</h2><p className="mt-1 text-sm text-slate-500">기한순 · 상담 기록 대기 · 일정 미정</p></div><span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-bold text-indigo-700">{tasks.length}건</span></div><div className="mt-4 grid gap-3 lg:grid-cols-2">{tasks.map((task) => <TaskCard key={task.id} task={task} today={today}/>)}</div>{!tasks.length && <p className="mt-4 rounded-xl bg-slate-50 p-5 text-sm text-slate-600">현재 기록된 다음 할 일이 없습니다. 명함을 등록하거나 기관 상세에서 다음 행동을 지정해 주세요.</p>}</section>
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6" aria-label="최근 영업 활동"><h2 className="text-xl font-bold">최근 활동</h2><p className="mt-1 text-sm text-slate-500">최근 기록한 순서입니다. 실제 활동일도 함께 표시합니다.</p><div className="mt-4 divide-y divide-slate-100">{recentActivities.map((activity) => { const organization = organizationById.get(activity.organization_id); const contact = activity.contact_id ? contactById.get(activity.contact_id) : null; return <article key={activity.id} className="py-4 first:pt-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{activityLabels[activity.activity_type] ?? "활동"}</span><Link href={`/admin/sales/${activity.organization_id}`} className="font-bold text-indigo-700 hover:underline">{organization?.name ?? "기관"}</Link><span className="text-xs text-slate-500">현재: {organization ? confirmedProgress(organization, visitedOrganizations.has(organization.id)) : "확인 불가"}</span></div><p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-slate-700">{activity.summary}</p><p className="mt-1 text-xs text-slate-500">{contact?.name ? `${contact.name} · ` : ""}활동 {dateFormatter.format(new Date(activity.occurred_at))} · 기록 {dateTimeFormatter.format(new Date(activity.created_at))}</p></article>; })}</div>{!recentActivities.length && <p className="mt-4 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">아직 활동 기록이 없습니다.</p>}</section>
  </div>;
}
