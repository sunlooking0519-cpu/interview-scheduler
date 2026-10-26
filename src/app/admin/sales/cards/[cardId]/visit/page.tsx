import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CardVisitForm } from "@/features/admin/components/card-visit-form";
import { koreaDateKey } from "@/features/admin/sales-follow-up";
import { requireAdmin } from "@/server/admin-auth";

export const dynamic = "force-dynamic";

export default async function CardVisitPage({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cardId)) notFound();
  const { supabase } = await requireAdmin();
  const db = supabase.schema("scheduler");
  const { data: card, error } = await db.from("sales_business_cards")
    .select("id,organization_id,contact_id,image_path").eq("id", cardId).maybeSingle();
  if (error || !card) notFound();
  const [organizationResult, contactsResult, imageResult] = await Promise.all([
    db.from("sales_organizations").select("id,name").eq("id", card.organization_id).maybeSingle(),
    db.from("sales_contacts").select("id,name,title,phone,mobile,email").eq("organization_id", card.organization_id).order("created_at", { ascending: true }),
    supabase.storage.from("sales-cards").createSignedUrl(card.image_path, 60 * 10),
  ]);
  if (organizationResult.error || !organizationResult.data) notFound();
  const organization = organizationResult.data;
  const contacts = contactsResult.data ?? [];
  const selectedContact = contacts.find((contact) => contact.id === card.contact_id);
  const imageUrl = imageResult.data?.signedUrl;

  return <div className="space-y-6">
    <header className="rounded-3xl bg-slate-950 p-6 text-white sm:p-8">
      <Link href="/admin/sales" className="text-sm font-semibold text-indigo-300">← 영업 대시보드</Link>
      <h1 className="mt-4 text-3xl font-bold">기관 방문 기록</h1>
      <p className="mt-2 text-sm text-slate-300">{organization.name} · 명함에서 담당자를 확인하고 상담 내용을 남겨 주세요.</p>
    </header>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold">명함과 연락처</h2>
        {imageUrl ? <a href={imageUrl} target="_blank" rel="noopener noreferrer"><Image src={imageUrl} alt={`${organization.name} 명함`} width={720} height={450} unoptimized className="mt-4 max-h-80 w-full rounded-xl bg-slate-100 object-contain" /></a>
          : <p className="mt-4 rounded-xl bg-slate-100 p-6 text-sm text-slate-500">명함 이미지를 불러오지 못했습니다.</p>}
        <dl className="mt-4 grid grid-cols-[80px_minmax(0,1fr)] gap-2 text-sm">
          <dt className="text-slate-500">담당자</dt><dd className="font-semibold">{selectedContact?.name ?? "미지정"}</dd>
          <dt className="text-slate-500">전화</dt><dd>{selectedContact?.phone || "-"}</dd>
          <dt className="text-slate-500">휴대폰</dt><dd>{selectedContact?.mobile || "-"}</dd>
          <dt className="text-slate-500">이메일</dt><dd className="break-all">{selectedContact?.email || "-"}</dd>
        </dl>
        <Link href={`/admin/sales/${organization.id}`} className="mt-4 inline-flex text-sm font-semibold text-indigo-700">담당자 정보 확인·수정 →</Link>
      </section>
      <section className="rounded-2xl border border-indigo-200 bg-white p-5 sm:p-6">
        <p className="text-xs font-bold tracking-[0.16em] text-indigo-600">1단계 · 방문 완료</p>
        <h2 className="mt-2 text-xl font-bold">담당자와 나눈 업무 내용</h2>
        <p className="mt-1 mb-5 text-sm text-slate-500">저장한 내용은 영업 관리 대시보드와 기관 활동 타임라인에 표시됩니다.</p>
        <CardVisitForm cardId={card.id} contacts={contacts} defaultContactId={card.contact_id ?? ""} today={koreaDateKey(new Date())} />
      </section>
    </div>
  </div>;
}
