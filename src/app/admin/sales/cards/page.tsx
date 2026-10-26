import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/server/admin-auth";
import { BusinessCardRegistrationLauncher } from "@/features/admin/components/business-card-registration-launcher";

export const dynamic = "force-dynamic";

type BusinessCard = {
  id: string;
  organization_id: string;
  contact_id: string | null;
  image_path: string;
  ocr_text: string;
  ocr_fields: Record<string, unknown> | null;
  created_at: string;
};

type Organization = { id: string; name: string };
type Contact = { id: string; name: string; title: string | null; email: string | null; phone: string | null; mobile: string | null };

const fieldLabels: Record<string, string> = {
  organization: "기관",
  name: "이름",
  title: "직책",
  phone: "전화",
  mobile: "휴대폰",
  email: "이메일",
};

const displayDate = (value: string) => new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(value));

function textField(fields: Record<string, unknown> | null, key: string) {
  const value = fields?.[key];
  return typeof value === "string" ? value.trim() : "";
}

export default async function BusinessCardsPage({ searchParams }: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const requestedQuery = (await searchParams).q;
  const q = (Array.isArray(requestedQuery) ? requestedQuery[0] : requestedQuery) ?? "";
  const { supabase } = await requireAdmin();
  const db = supabase.schema("scheduler");
  const cardsResult = await db.from("sales_business_cards")
    .select("id,organization_id,contact_id,image_path,ocr_text,ocr_fields,created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  const cards = (cardsResult.data ?? []) as BusinessCard[];
  const [organizationsResult, contactsResult, signedResult] = await Promise.all([
    db.from("sales_organizations").select("id,name").limit(1000),
    db.from("sales_contacts").select("id,name,title,email,phone,mobile").limit(3000),
    cards.length
      ? supabase.storage.from("sales-cards").createSignedUrls(cards.map((card) => card.image_path), 60 * 10)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const organizations = (organizationsResult.data ?? []) as Organization[];
  const contacts = (contactsResult.data ?? []) as Contact[];
  const organizationById = new Map(organizations.map((organization) => [organization.id, organization]));
  const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
  const signedUrlByPath = new Map((signedResult.data ?? []).flatMap((item) =>
    item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : []
  ));
  const normalizedQuery = q.trim().toLocaleLowerCase("ko-KR");
  const visibleCards = cards.filter((businessCard) => {
    if (!normalizedQuery) return true;
    const fields = businessCard.ocr_fields;
    const organization = organizationById.get(businessCard.organization_id);
    const contact = businessCard.contact_id ? contactById.get(businessCard.contact_id) : undefined;
    return [
      organization?.name ?? "",
      contact?.name ?? "",
      contact?.email ?? "",
      contact?.phone ?? "",
      contact?.mobile ?? "",
      businessCard.ocr_text,
      ...Object.values(fields ?? {}).filter((value): value is string => typeof value === "string"),
    ].some((value) => value.toLocaleLowerCase("ko-KR").includes(normalizedQuery));
  });
  const loadError = cardsResult.error || organizationsResult.error || contactsResult.error || signedResult.error;

  return <div className="space-y-6">
    <header className="rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-700 p-6 text-white shadow-lg sm:p-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div><p className="text-xs font-bold tracking-[0.22em] text-indigo-200">BUSINESS CARDS</p><h1 className="mt-3 text-3xl font-bold">명함 관리</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-indigo-100">등록된 명함을 먼저 확인하고 기관·담당자 정보로 검색할 수 있습니다.</p></div>
        <BusinessCardRegistrationLauncher />
      </div>
    </header>

    {loadError && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">일부 명함 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>}

    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div><h2 className="text-xl font-bold">등록된 명함 <span className="text-indigo-600">{cards.length}</span></h2><p className="mt-1 text-sm text-slate-500">{normalizedQuery ? `검색 결과 ${visibleCards.length}건 · ` : ""}최신 등록 순으로 최대 300장을 표시합니다.</p></div>
        <form className="flex min-w-0 gap-2"><input name="q" defaultValue={q} aria-label="명함 검색" placeholder="기관·이름·전화·이메일 검색" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 md:w-72"/><button className="shrink-0 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">검색</button>{normalizedQuery && <Link href="/admin/sales/cards" className="shrink-0 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">검색 초기화</Link>}</form>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visibleCards.map((businessCard) => {
        const organization = organizationById.get(businessCard.organization_id);
        const contact = businessCard.contact_id ? contactById.get(businessCard.contact_id) : undefined;
        const fields = businessCard.ocr_fields;
        const url = signedUrlByPath.get(businessCard.image_path) ?? "";
        return <article key={businessCard.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex aspect-[1.6/1] items-center justify-center bg-slate-100">
            {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="h-full w-full"><Image src={url} alt={`${organization?.name ?? "등록된"} 명함`} width={720} height={450} unoptimized className="h-full w-full object-contain"/></a> : <p className="text-sm text-slate-500">이미지를 불러오지 못했습니다.</p>}
          </div>
          <div className="p-4">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-bold text-slate-950">{organization?.name || textField(fields, "organization") || "기관명 미확인"}</h3><p className="mt-1 text-sm text-slate-600">{contact?.name || textField(fields, "name") || "담당자 미확인"}{(contact?.title || textField(fields, "title")) ? ` · ${contact?.title || textField(fields, "title")}` : ""}</p></div><span className="shrink-0 text-xs text-slate-400">{displayDate(businessCard.created_at)}</span></div>
            <dl className="mt-3 grid grid-cols-[62px_minmax(0,1fr)] gap-x-2 gap-y-1 text-sm">{Object.entries(fieldLabels).map(([key, label]) => {
              const value = textField(fields, key);
              return value ? <div key={key} className="col-span-2 grid grid-cols-subgrid"><dt className="text-slate-500">{label}</dt><dd className="break-all text-slate-800">{value}</dd></div> : null;
            })}</dl>
            {organization && <Link href={`/admin/sales/${organization.id}`} className="mt-4 inline-flex rounded-lg border border-indigo-200 px-3 py-2 text-sm font-bold text-indigo-700">기관 상세 보기</Link>}
            <Link href={`/admin/sales/cards/${businessCard.id}/visit`} className="mt-4 ml-2 inline-flex rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white">방문·상담 기록</Link>
          </div>
        </article>;
      })}</div>
      {!loadError && !visibleCards.length && <div className="mt-5 rounded-xl bg-slate-50 p-8 text-center"><p className="font-semibold text-slate-700">{normalizedQuery ? "검색 결과가 없습니다." : "아직 등록된 명함이 없습니다."}</p>{normalizedQuery ? <Link href="/admin/sales/cards" className="mt-3 inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white">전체 명함 보기</Link> : <BusinessCardRegistrationLauncher compact />}</div>}
    </section>
  </div>;
}
