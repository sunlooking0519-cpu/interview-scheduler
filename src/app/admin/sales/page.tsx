import Link from "next/link";
import { requireAdmin } from "@/server/admin-auth";
import { createOrganization, retrySalesCalendarSync } from "./actions";

export const dynamic = "force-dynamic";
const kinds: Record<string, string> = { institution: "기관", school: "학교", other: "기타" };
const stages: Record<string, string> = { lead: "신규", contacted: "연락", meeting: "미팅", proposal: "제안", won: "성사", lost: "종료" };

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ q?: string; stage?: string; sync?: string }> }) {
  const { supabase } = await requireAdmin();
  const { q = "", stage = "", sync = "" } = await searchParams;
  let query = supabase.schema("scheduler").from("sales_organizations").select("id,name,kind,stage,updated_at").order("updated_at", { ascending: false }).limit(200);
  if (q.trim()) query = query.ilike("name", `%${q.trim().replace(/[%_]/g, "")}%`);
  if (Object.hasOwn(stages, stage)) query = query.eq("stage", stage);
  const { data: organizations, error } = await query;
  return <div className="space-y-6">
    <header><p className="text-sm font-semibold text-indigo-600">SALES WORKSPACE</p><h1 className="mt-2 text-3xl font-bold">영업 관리</h1><p className="mt-2 text-slate-600">기관과 담당자, 미팅, 제안서, 명함을 한곳에서 관리합니다.</p><form action={retrySalesCalendarSync} className="mt-4"><button className="rounded-xl border border-indigo-300 bg-white px-4 py-2 text-sm font-semibold text-indigo-700">Google 미팅 동기화 재시도</button></form>{sync === "done" && <p role="status" className="mt-2 text-sm text-emerald-700">대기 중인 일정의 동기화를 처리했습니다.</p>}{sync === "retry" && <p role="alert" className="mt-2 text-sm text-amber-700">일부 일정이 아직 대기 중입니다. 잠시 후 다시 시도해 주세요.</p>}{sync === "error" && <p role="alert" className="mt-2 text-sm text-red-700">Google 연결을 확인해 주세요.</p>}</header>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">영업 데이터를 불러오지 못했습니다. supabase/sales-management-migration.sql 실행과 scheduler API 노출을 확인해 주세요.</p>}
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"><h2 className="text-lg font-bold">영업 대상 추가</h2><form action={createOrganization} className="mt-4 grid gap-3 sm:grid-cols-[1fr_130px_auto]"><label className="sr-only" htmlFor="organization-name">기관명</label><input id="organization-name" name="name" required maxLength={200} placeholder="기관·학교·업체명" className="rounded-xl border border-slate-300 p-3"/><label className="sr-only" htmlFor="organization-kind">유형</label><select id="organization-kind" name="kind" className="rounded-xl border border-slate-300 p-3"><option value="institution">기관</option><option value="school">학교</option><option value="other">기타</option></select><button className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white">추가</button></form></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">영업 대상 {organizations?.length ?? 0}곳</h2><form className="flex gap-2"><input name="q" defaultValue={q} placeholder="이름 검색" aria-label="이름 검색" className="min-w-0 rounded-xl border border-slate-300 p-2"/><select name="stage" defaultValue={stage} aria-label="진행 단계" className="rounded-xl border border-slate-300 p-2"><option value="">전체 단계</option>{Object.entries(stages).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button className="rounded-xl border border-slate-300 px-3">조회</button></form></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{organizations?.map((org) => <Link key={org.id} href={`/admin/sales/${org.id}`} className="rounded-xl border border-slate-200 p-4 hover:border-indigo-400"><div className="flex items-start justify-between gap-3"><strong className="break-words">{org.name}</strong><span className="shrink-0 rounded-full bg-indigo-50 px-2 py-1 text-xs text-indigo-700">{stages[org.stage] ?? org.stage}</span></div><p className="mt-2 text-sm text-slate-500">{kinds[org.kind] ?? org.kind} · {new Date(org.updated_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}</p></Link>)}</div>{!error && !organizations?.length && <p className="mt-4 text-sm text-slate-500">등록된 대상이 없습니다.</p>}</section>
  </div>;
}
