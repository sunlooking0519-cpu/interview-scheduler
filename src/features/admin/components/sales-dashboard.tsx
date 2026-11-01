import Link from "next/link";
import type { DashboardActivity } from "../sales-dashboard-model";
import { filterSalesOrganizationList, type SalesOrganizationListRow } from "../sales-organization-list";
import { OrganizationFollowUpDialog } from "./organization-follow-up-dialog";
import { SalesExportDialog } from "./sales-export-dialog";
import { SalesOrganizationFilters } from "./sales-organization-filters";

const workflow = [
  ["기관 방문", "명함 등록 · 상담 기록"], ["제안서 메일", "맞춤 자료 발송"],
  ["메일 확인", "2일 이내 수신 확인"], ["검토 결과", "5~7일 이내 반응 확인"],
  ["맞춤 제안", "추가 상담 · 견적"], ["계약 확정", "교육 일정 · 계약"],
  ["사후 관리", "보류 기관 재제안"],
] as const;
const proposalLabels: Record<string, string> = { not_submitted: "미제출", planned: "제출 예정", submitted: "제출 완료" };
const reactionLabels: Record<string, string> = { interested: "관심 높음", reviewing: "검토 중", waiting: "시기 대기", neutral: "보통", no_budget: "예산 없음", not_interested: "관심 없음", no_response: "응답 없음" };
const activityLabels: Record<string, string> = { visit: "접촉", call: "전화", email: "메일", proposal: "제안서", meeting: "상담", note: "메모" };
const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
const dateFormatter = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });

export function SalesDashboard({ organizations, recentActivities, contactNames, query, category, region, contact, saved, loadError, today }: {
  organizations: SalesOrganizationListRow[];
  recentActivities: DashboardActivity[];
  contactNames: Record<string, string[]>;
  query: string; category: string; region: string; contact: string;
  saved: string; loadError: boolean; today: string;
}) {
  const visible = filterSalesOrganizationList(organizations, contactNames, { query, category, region, contact });
  const hasFilters = Boolean(query.trim() || category || region || contact.trim());
  const organizationById = new Map(organizations.map((item) => [item.id, item]));
  return <div className="space-y-6">
    <header className="rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-700 p-6 text-white sm:p-8">
      <p className="text-xs font-bold tracking-[0.2em] text-indigo-200">SALES WORKFLOW</p>
      <h1 className="mt-3 text-3xl font-bold sm:text-4xl">영업 진행 현황</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-indigo-100">기관별 최근 기록과 제안서·반응 상태를 확인하세요. 가장 최근에 관리한 기관부터 표시합니다.</p>
      <div className="mt-5 flex flex-wrap gap-2"><Link href="/admin/sales/cards" className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-indigo-800">명함에서 상담 기록</Link><Link href="/admin/sales?view=first-followup" className="rounded-lg border border-white/50 px-4 py-2 text-sm font-bold text-white">1차 메일 후속 관리</Link></div>
    </header>
    {saved === "visit" && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">상담 기록을 저장했습니다. 기관 목록의 최근 업데이트를 확인해 주세요.</p>}
    {loadError && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">기관 또는 활동 기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>}
    <section aria-label="7단계 영업 과정" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <h2 className="text-xl font-bold">영업 7단계</h2><p className="mt-1 text-sm text-slate-500">기관 방문부터 사후 관리까지 이어지는 업무 순서입니다.</p>
      <ol className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{workflow.map(([title, detail], index) => <li key={title} className={`rounded-xl border p-4 ${index === 0 ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-slate-50"}`}><span className="text-xs font-bold text-indigo-700">{index + 1}단계</span><h3 className="mt-1 font-bold">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-600">{detail}</p>{index === 0 && <Link href="/admin/sales/cards" className="mt-3 inline-block text-xs font-bold text-indigo-700 underline">명함 목록 열기</Link>}</li>)}</ol>
    </section>
    <section id="organizations" className="scroll-mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-label="전체 기관 관리 목록">
      <div className="p-4 sm:p-6">
        <h2 className="text-xl font-bold">전체 기관 <span className="text-indigo-600">{visible.length}</span><span className="ml-2 text-sm font-normal text-slate-500">/ {organizations.length}개</span></h2>
        <p className="mt-1 text-sm text-slate-500">최근 관리 기록 순 · 기관 유형과 지역을 함께 선택해 볼 수 있습니다.</p>
        <div className="mt-4 flex justify-end"><SalesExportDialog filters={{ query, category, region, contact }} count={visible.length} disabled={loadError || visible.length === 0} /></div>
        <SalesOrganizationFilters key={JSON.stringify([query, category, region, contact])} query={query} category={category} region={region} contact={contact} />
      </div>
      <div className="hidden grid-cols-[minmax(150px,2fr)_110px_120px_110px_100px_90px] gap-3 border-y bg-slate-50 px-6 py-3 text-xs font-bold text-slate-600 lg:grid"><span>기관명</span><span>방문일</span><span>최근 업데이트</span><span>제안서 제출</span><span>반응</span><span className="text-right">관리</span></div>
      <div className="divide-y divide-slate-100">{visible.map((item) => <article key={item.id} className="grid gap-3 px-4 py-4 hover:bg-slate-50 sm:px-6 lg:grid-cols-[minmax(150px,2fr)_110px_120px_110px_100px_90px] lg:items-center lg:gap-3">
        <Link href={`/admin/sales/${item.id}`} className="break-words font-bold text-slate-950 hover:text-indigo-700">{item.name}</Link>
        <div><span className="text-xs text-slate-500 lg:hidden">방문일 · </span>{item.visitDate ? <time dateTime={item.visitDate} className="text-sm text-slate-700">{item.visitDate}</time> : <span className="text-sm text-slate-400">미기록</span>}</div>
        <div><span className="text-xs text-slate-500 lg:hidden">최근 업데이트 · </span><time dateTime={item.lastUpdatedAt} className="text-sm text-slate-700">{dateFormatter.format(new Date(item.lastUpdatedAt))}</time></div>
        <div><span className="text-xs text-slate-500 lg:hidden">제안서 제출 · </span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.proposalStatus === "submitted" ? "bg-emerald-50 text-emerald-700" : item.proposalStatus === "planned" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{item.proposalStatus ? proposalLabels[item.proposalStatus] ?? item.proposalStatus : "미기록"}</span></div>
        <div><span className="text-xs text-slate-500 lg:hidden">반응 · </span><span className="text-sm text-slate-700">{item.reaction ? reactionLabels[item.reaction] ?? item.reaction : "미기록"}</span></div>
        <div className="lg:text-right"><OrganizationFollowUpDialog organization={item} today={today} /></div>
      </article>)}</div>
      {!loadError && !visible.length && <p className="p-8 text-center text-sm text-slate-500">{hasFilters ? "조건에 맞는 기관이 없습니다. 필터를 바꿔보세요." : "등록된 기관이 없습니다. 명함을 등록하면 여기에 표시됩니다."}</p>}
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6" aria-label="최근 영업 활동"><h2 className="text-xl font-bold">최근 활동</h2><p className="mt-1 text-sm text-slate-500">최근 기록한 순서입니다.</p><div className="mt-4 divide-y divide-slate-100">{recentActivities.map((activity) => <article key={activity.id} className="py-4 first:pt-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{activityLabels[activity.activity_type] ?? "활동"}</span><Link href={`/admin/sales/${activity.organization_id}`} className="font-bold text-indigo-700 hover:underline">{organizationById.get(activity.organization_id)?.name ?? "기관"}</Link></div><p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-slate-700">{activity.summary}</p><p className="mt-1 text-xs text-slate-500">기록 {dateTimeFormatter.format(new Date(activity.created_at))}</p></article>)}</div>{!recentActivities.length && <p className="mt-4 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">아직 활동 기록이 없습니다.</p>}</section>
  </div>;
}
