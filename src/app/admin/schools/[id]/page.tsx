import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSalesStaff } from "@/server/admin-auth";
import { schoolUuid } from "@/features/admin/school-filters";
import { koreaDateKey } from "@/features/admin/sales-follow-up";
import { SchoolFollowUpEditor, type SchoolHistory } from "@/features/admin/components/school-follow-up-dialog";
import { SchoolActivityEntry } from "@/features/admin/components/school-activity-entry";
import type { SchoolRow } from "@/features/admin/components/school-table";
import { proposalLabels, reactionLabels } from "@/features/admin/school-contact-labels";

export const dynamic = "force-dynamic";

export default async function SchoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!schoolUuid.test(id)) notFound();
  const { supabase } = await requireSalesStaff();
  const db = supabase.schema("scheduler");
  const { data: school, error: schoolError } = await db.from("schools")
    .select("id,province,district,level,name,phone,source_loaded_on,assigned_to,assigned_at,contact_name,contact_email,contact_phone,contact_date,contact_method,proposal_status,reaction,notes,management_updated_on")
    .eq("id", id).maybeSingle();
  if (schoolError || !school) notFound();
  const { data: activity, error: historyError } = await db.from("school_contact_history")
    .select("id,school_id,contact_date,update_date,contact_name,contact_email,contact_phone,contact_method,proposal_status,reaction,new_note,change_summary,created_at,edit_version,edited_at")
    .eq("school_id", id).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(500);
  const row = school as SchoolRow;
  const history = (activity ?? []) as SchoolHistory[];
  const current = (value: string | null, labels?: Record<string, string>) => value ? (labels?.[value] ?? value) : "미기록";

  return <div className="space-y-6">
    <header className="rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-800 p-6 text-white shadow-lg sm:p-8">
      <Link href="/admin/schools#school-list" className="text-sm font-semibold text-indigo-200 hover:underline">← 학교 목록</Link>
      <h1 className="mt-4 text-3xl font-bold sm:text-4xl">{row.name}</h1>
      <p className="mt-2 text-sm text-indigo-100">{row.province} · {row.district} · {row.level}</p>
    </header>
    <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
      <p>학교 대표전화 <strong className="ml-2">{row.phone}</strong></p>
      <p>학교 담당자 <strong className="ml-2">{row.contact_name || "미기록"}</strong></p>
      <p>담당자 전화 <strong className="ml-2">{row.contact_phone || "미기록"}</strong></p>
      <p>담당자 이메일 <strong className="ml-2 break-all">{row.contact_email || "미기록"}</strong></p>
      <p>최근 접촉일 <strong className="ml-2">{row.contact_date || "미기록"}</strong></p>
      <p>제안서 <strong className="ml-2">{current(row.proposal_status, proposalLabels)}</strong></p>
      <p>반응 <strong className="ml-2">{current(row.reaction, reactionLabels)}</strong></p>
      <p>최근 업데이트 <strong className="ml-2">{row.management_updated_on || "미기록"}</strong></p>
    </section>
    {historyError && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">활동 이력을 불러오지 못했습니다.</p>}
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="self-start overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b px-5 py-5 sm:px-6"><p className="text-xs font-bold text-indigo-600">QUICK LOG</p><h2 className="mt-1 text-xl font-bold">새 학교 활동 기록</h2><p className="mt-1 text-sm text-slate-500">현재 상태를 확인하고 달라진 내용만 추가하세요.</p></div>
        <SchoolFollowUpEditor school={row} today={koreaDateKey(new Date())} />
      </section>
      <section className="self-start rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-bold">활동 타임라인 <span className="text-indigo-600">{history.length}</span></h2>
        {history.length ? <ol className="mt-5 space-y-5">{history.map((item, index) => <SchoolActivityEntry key={item.id} item={item} schoolId={id} today={koreaDateKey(new Date())} latest={index === 0} />)}</ol> : <p className="mt-4 text-sm text-slate-500">아직 활동 이력이 없습니다. 왼쪽에서 첫 접촉을 기록하세요.</p>}
      </section>
    </div>
  </div>;
}
