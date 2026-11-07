import Link from "next/link";
import type { DashboardActivity } from "../sales-dashboard-model";
import { filterSalesOrganizationList, paginateSalesOrganizations, salesOrganizationPageSize, type SalesOrganizationListRow } from "../sales-organization-list";
import { OrganizationFollowUpDialog } from "./organization-follow-up-dialog";
import { SalesExportDialog } from "./sales-export-dialog";
import { SalesOrganizationFilters } from "./sales-organization-filters";

const proposalLabels: Record<string, string> = { not_submitted: "미제출", planned: "제출 예정", submitted: "제출 완료" };
const reactionLabels: Record<string, string> = { interested: "관심 높음", reviewing: "검토 중", waiting: "시기 대기", neutral: "보통", no_budget: "예산 없음", not_interested: "관심 없음", no_response: "응답 없음" };
const activityLabels: Record<string, string> = { visit: "접촉", call: "전화", email: "메일", proposal: "제안서", meeting: "상담", note: "메모" };
const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
const dateFormatter = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
type DisplayContact = { id: string; name: string; email: string | null; phone: string | null; mobile: string | null };

function RecentActivityItems({ activities, organizationById }: { activities: DashboardActivity[]; organizationById: Map<string, SalesOrganizationListRow> }) {
  return <div className="mt-4 divide-y divide-slate-100">{activities.map((activity) => <article key={activity.id} className="py-4 first:pt-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{activityLabels[activity.activity_type] ?? "활동"}</span><Link href={`/admin/sales/${activity.organization_id}`} className="font-bold text-indigo-700 hover:underline">{organizationById.get(activity.organization_id)?.name ?? "기관"}</Link></div><p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-slate-700">{activity.summary}</p><p className="mt-1 text-xs text-slate-500">기록 {dateTimeFormatter.format(new Date(activity.created_at))}</p></article>)}{!activities.length && <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">아직 활동 기록이 없습니다.</p>}</div>;
}

export function SalesDashboard({ organizations, recentActivities, contactsByOrganization, query, category, region, contact, requestedPage, saved, loadError, today }: {
  organizations: SalesOrganizationListRow[];
  recentActivities: DashboardActivity[];
  contactsByOrganization: Record<string, DisplayContact[]>;
  query: string; category: string; region: string; contact: string; requestedPage: string;
  saved: string; loadError: boolean; today: string;
}) {
  const contactNames = Object.fromEntries(Object.entries(contactsByOrganization).map(([id, entries]) => [id, entries.map((entry) => entry.name)]));
  const visible = filterSalesOrganizationList(organizations, contactNames, { query, category, region, contact });
  const { page, pageCount, rows: pageRows } = paginateSalesOrganizations(visible, requestedPage);
  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of [["q", query], ["category", category], ["region", region], ["contact", contact]]) if (value) params.set(key, value);
    if (target > 1) params.set("page", String(target));
    return `/admin/sales${params.size ? `?${params}` : ""}#organizations`;
  };
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
    <section id="organizations" className="scroll-mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-label="전체 기관 관리 목록">
      <div className="p-4 sm:p-6">
        <h2 className="text-xl font-bold">전체 기관 <span className="text-indigo-600">{visible.length}</span><span className="ml-2 text-sm font-normal text-slate-500">/ {organizations.length}개</span></h2>
        <p className="mt-1 text-sm text-slate-500">최근 관리 기록 순 · 기관 유형과 지역을 함께 선택해 볼 수 있습니다.</p>
        <div className="mt-4 hidden justify-end xl:flex"><SalesExportDialog filters={{ query, category, region, contact }} count={visible.length} disabled={loadError || visible.length === 0} /></div>
        <SalesOrganizationFilters key={JSON.stringify([query, category, region, contact])} query={query} category={category} region={region} contact={contact} mobileTools={<SalesExportDialog filters={{ query, category, region, contact }} count={visible.length} disabled={loadError || visible.length === 0} />} />
      </div>
      <div className="divide-y divide-slate-100 xl:hidden">{pageRows.map((item) => {
        const contacts = contactsByOrganization[item.id] ?? [];
        const preferred = contacts.find((person) => person.id === item.next_contact_id);
        const displayedContacts = preferred ? [preferred] : contacts;
        return <article key={item.id} className="min-w-0 px-4 py-4 sm:px-6">
          <details name="mobile-sales-organization" className="group">
            <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-start justify-between gap-3"><span className="min-w-0 break-words font-bold text-slate-950">{item.name}</span><time dateTime={item.lastUpdatedAt} className="shrink-0 pt-0.5 text-xs text-slate-500">{dateFormatter.format(new Date(item.lastUpdatedAt)).slice(2)}</time></span>
              <span className="mt-2 flex flex-wrap gap-1.5"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.proposalStatus === "submitted" ? "bg-emerald-50 text-emerald-700" : item.proposalStatus === "planned" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>제안서 {item.proposalStatus ? proposalLabels[item.proposalStatus] ?? item.proposalStatus : "미기록"}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">반응 {item.reaction ? reactionLabels[item.reaction] ?? item.reaction : "미기록"}</span></span>
              <span className="mt-2 inline-block text-xs font-semibold text-indigo-700 group-open:hidden">자세히 보기 ▾</span><span className="mt-2 hidden text-xs font-semibold text-indigo-700 group-open:inline-block">접기 ▴</span>
            </summary>
            <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 text-sm text-slate-700">
              <p><span className="text-slate-500">방문일 · </span>{item.visitDate ?? "미기록"}</p>
              {item.contactRegion && <p className="break-words"><span className="text-slate-500">방문지역 · </span>{item.contactRegion}</p>}
              <div><p className="text-slate-500">담당자</p>{displayedContacts.length ? displayedContacts.map((person) => {
                const phone = person.mobile || person.phone;
                return <div key={person.id} className="mt-1 break-words"><span className="font-medium">{person.name}</span>{phone && <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className="ml-2 text-indigo-700 underline">{phone}</a>}{person.email && <a href={`mailto:${person.email}`} className="mt-1 block break-all text-indigo-700 underline">{person.email}</a>}</div>;
              }) : <p className="mt-1 text-slate-400">미등록</p>}</div>
              {item.notes && <div><p className="text-slate-500">최근 특이사항</p><p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words">{item.notes}</p></div>}
              <Link href={`/admin/sales/${item.id}`} className="inline-flex min-h-11 items-center font-semibold text-indigo-700 underline">기관 상세 보기</Link>
            </div>
          </details>
          <div className="mt-3"><OrganizationFollowUpDialog organization={item} today={today} contacts={contacts} /></div>
        </article>;
      })}</div>
      <div className="hidden grid-cols-[minmax(0,1.7fr)_95px_105px_95px_85px_minmax(0,1fr)_minmax(0,1.5fr)_86px] gap-3 border-y bg-slate-50 px-6 py-3 text-xs font-bold text-slate-600 xl:grid"><span>기관명</span><span>방문일</span><span>최근 업데이트</span><span>제안서 제출</span><span>반응</span><span>담당자</span><span>이메일</span><span className="text-right">관리</span></div>
      <div className="hidden divide-y divide-slate-100 xl:block">{pageRows.map((item) => {
        const contacts = contactsByOrganization[item.id] ?? [];
        const preferred = contacts.find((person) => person.id === item.next_contact_id);
        const displayedContacts = preferred ? [preferred] : contacts;
        return <article key={item.id} className="grid min-w-0 gap-3 px-4 py-4 hover:bg-slate-50 sm:px-6 xl:grid-cols-[minmax(0,1.7fr)_95px_105px_95px_85px_minmax(0,1fr)_minmax(0,1.5fr)_86px] xl:items-center xl:gap-3">
        <Link href={`/admin/sales/${item.id}`} className="break-words font-bold text-slate-950 hover:text-indigo-700">{item.name}</Link>
        <div><span className="text-xs text-slate-500 xl:hidden">방문일 · </span>{item.visitDate ? <time dateTime={item.visitDate} className="text-sm text-slate-700">{item.visitDate}</time> : <span className="text-sm text-slate-400">미기록</span>}</div>
        <div><span className="text-xs text-slate-500 xl:hidden">최근 업데이트 · </span><time dateTime={item.lastUpdatedAt} className="text-sm text-slate-700">{dateFormatter.format(new Date(item.lastUpdatedAt))}</time></div>
        <div><span className="text-xs text-slate-500 xl:hidden">제안서 제출 · </span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.proposalStatus === "submitted" ? "bg-emerald-50 text-emerald-700" : item.proposalStatus === "planned" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{item.proposalStatus ? proposalLabels[item.proposalStatus] ?? item.proposalStatus : "미기록"}</span></div>
        <div><span className="text-xs text-slate-500 xl:hidden">반응 · </span><span className="text-sm text-slate-700">{item.reaction ? reactionLabels[item.reaction] ?? item.reaction : "미기록"}</span></div>
        <div className="min-w-0 break-words"><span className="text-xs text-slate-500 xl:hidden">담당자 · </span>{displayedContacts.length ? <span className="text-sm text-slate-700">{displayedContacts.map((person) => person.name).join(", ")}</span> : <span className="text-sm text-slate-400">미등록</span>}</div>
        <div className="min-w-0"><span className="text-xs text-slate-500 xl:hidden">이메일 · </span>{displayedContacts.some((person) => person.email) ? <div className="inline-flex min-w-0 flex-col gap-1 align-top">{displayedContacts.filter((person) => person.email).map((person, index) => <a key={`${person.email}-${index}`} href={`mailto:${person.email}`} className="break-all text-sm text-indigo-700 hover:underline">{person.email}</a>)}</div> : <span className="text-sm text-slate-400">미등록</span>}</div>
        <div className="xl:text-right"><OrganizationFollowUpDialog organization={item} today={today} contacts={contacts} /></div>
      </article>; })}</div>
      {!loadError && !visible.length && <p className="p-8 text-center text-sm text-slate-500">{hasFilters ? "조건에 맞는 기관이 없습니다. 필터를 바꿔보세요." : "등록된 기관이 없습니다. 명함을 등록하면 여기에 표시됩니다."}</p>}
      {visible.length > 0 && <nav aria-label="기관 목록 페이지" className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-4 sm:px-6">
        <p className="text-sm text-slate-500">{(page - 1) * salesOrganizationPageSize + 1}–{Math.min(page * salesOrganizationPageSize, visible.length)} / {visible.length}개</p>
        {pageCount > 1 && <div className="flex flex-wrap items-center gap-1">
          {page > 1 && <Link href={pageHref(page - 1)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">이전</Link>}
          {Array.from({ length: pageCount }, (_, index) => index + 1).filter((number) => number === 1 || number === pageCount || Math.abs(number - page) <= 2).map((number, index, pages) => <span key={number} className="inline-flex items-center gap-1">{index > 0 && number - pages[index - 1] > 1 && <span className="px-1 text-slate-400">…</span>}<Link href={pageHref(number)} aria-current={number === page ? "page" : undefined} className={`rounded-lg px-3 py-2 text-sm ${number === page ? "bg-indigo-600 font-bold text-white" : "border border-slate-200 text-slate-700 hover:bg-slate-50"}`}>{number}</Link></span>)}
          {page < pageCount && <Link href={pageHref(page + 1)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">다음</Link>}
        </div>}
      </nav>}
    </section>
    <details className="group rounded-2xl border border-slate-200 bg-white p-4 xl:hidden" aria-label="최근 영업 활동">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden"><span className="text-xl font-bold">최근 활동</span><span className="ml-2 text-sm font-normal text-slate-500">{recentActivities.length}건</span><span className="ml-2 text-xs font-semibold text-indigo-700 group-open:hidden">펼치기 ▾</span><span className="ml-2 hidden text-xs font-semibold text-indigo-700 group-open:inline">접기 ▴</span></summary>
      <RecentActivityItems activities={recentActivities} organizationById={organizationById} />
    </details>
    <section className="hidden rounded-2xl border border-slate-200 bg-white p-6 xl:block" aria-label="최근 영업 활동"><h2 className="text-xl font-bold">최근 활동</h2><p className="mt-1 text-sm text-slate-500">최근 기록한 순서입니다.</p><RecentActivityItems activities={recentActivities} organizationById={organizationById} /></section>
  </div>;
}
