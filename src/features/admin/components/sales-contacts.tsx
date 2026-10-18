import Image from "next/image";
import { createContact, updateContact } from "@/app/admin/sales/actions";

type Contact = {
  id: string;
  name: string;
  title: string | null;
  role: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  notes: string | null;
};
type Card = { id: string; contact_id: string | null; url: string };

const input = "w-full min-w-0 rounded-xl border border-slate-300 bg-white p-3 text-sm";

export function SalesContacts({ organizationId, contacts, cards }: { organizationId: string; contacts: Contact[]; cards: Card[] }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
    <h2 className="text-lg font-bold">담당자 {contacts.length}명</h2>
    <p className="mt-1 text-sm text-slate-600">같은 기관의 담당자별 역할과 연락처, 명함을 관리합니다. 미팅에는 해당 담당자를 따로 지정할 수 있습니다.</p>
    <div className="mt-4 grid gap-3 lg:grid-cols-2">{contacts.map((contact) => {
      const linkedCards = cards.filter((businessCard) => businessCard.contact_id === contact.id);
      return <article key={contact.id} className="rounded-xl border border-slate-200 p-3 sm:p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-bold">{contact.name}</h3><span className="text-xs text-slate-500">명함 {linkedCards.length}장</span></div>
        {(contact.title || contact.role) && <p className="mt-1 text-sm text-slate-600">{[contact.title, contact.role].filter(Boolean).join(" · ")}</p>}
        {linkedCards.length > 0 && <div className="mt-3 flex gap-2 overflow-x-auto">{linkedCards.map((businessCard) => businessCard.url && <a key={businessCard.id} href={businessCard.url} target="_blank" rel="noopener noreferrer" aria-label={`${contact.name} 명함 보기`} className="shrink-0"><Image src={businessCard.url} alt={`${contact.name} 명함`} width={140} height={90} unoptimized className="h-20 w-32 rounded-lg border border-slate-200 object-contain" /></a>)}</div>}
        <form action={updateContact} className="mt-3 grid gap-2 sm:grid-cols-2">
          <input type="hidden" name="organization_id" value={organizationId}/><input type="hidden" name="id" value={contact.id}/>
          <label className="text-xs text-slate-600">이름<input name="name" required maxLength={120} defaultValue={contact.name} className={`${input} mt-1`}/></label>
          <label className="text-xs text-slate-600">직책<input name="title" maxLength={120} defaultValue={contact.title ?? ""} placeholder="직책" className={`${input} mt-1`}/></label>
          <label className="text-xs text-slate-600 sm:col-span-2">담당 역할<input name="role" maxLength={200} defaultValue={contact.role ?? ""} placeholder="예: 예산 결정, 실무 운영" className={`${input} mt-1`}/></label>
          <label className="text-xs text-slate-600">전화번호 (Tel)<input name="phone" type="tel" maxLength={80} defaultValue={contact.phone ?? ""} className={`${input} mt-1`}/></label>
          <label className="text-xs text-slate-600">휴대폰 (Mobile)<input name="mobile" type="tel" maxLength={80} defaultValue={contact.mobile ?? ""} className={`${input} mt-1`}/></label>
          <label className="text-xs text-slate-600 sm:col-span-2">이메일<input name="email" type="email" maxLength={200} defaultValue={contact.email ?? ""} className={`${input} mt-1`}/></label>
          <label className="text-xs text-slate-600 sm:col-span-2">담당자 메모<textarea name="notes" maxLength={2000} defaultValue={contact.notes ?? ""} className={`${input} mt-1`}/></label>
          <button className="rounded-xl border border-indigo-300 px-3 py-2 text-sm font-semibold text-indigo-700 sm:justify-self-start">담당자 저장</button>
        </form>
      </article>;
    })}</div>
    <form action={createContact} className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
      <input type="hidden" name="organization_id" value={organizationId}/>
      <input name="name" required maxLength={120} placeholder="새 담당자 이름" aria-label="새 담당자 이름" className={input}/>
      <input name="title" maxLength={120} placeholder="직책" aria-label="직책" className={input}/>
      <input name="role" maxLength={200} placeholder="담당 역할 (예: 예산 결정)" aria-label="담당 역할" className={`${input} sm:col-span-2`}/>
      <input name="phone" type="tel" maxLength={80} placeholder="전화번호 (Tel)" aria-label="전화번호 (Tel)" className={input}/>
      <input name="mobile" type="tel" maxLength={80} placeholder="휴대폰 (Mobile)" aria-label="휴대폰 (Mobile)" className={input}/>
      <input name="email" type="email" maxLength={200} placeholder="이메일" aria-label="이메일" className={input}/>
      <textarea name="notes" maxLength={2000} placeholder="담당자 메모" aria-label="담당자 메모" className={`${input} sm:col-span-2`}/>
      <button className="rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white sm:col-span-2 sm:justify-self-start">담당자 추가</button>
    </form>
  </section>;
}
