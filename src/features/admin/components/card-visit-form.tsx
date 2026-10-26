"use client";

import { useActionState } from "react";
import { recordCardVisit } from "@/app/admin/sales/actions";

type Contact = { id: string; name: string; title: string | null; phone: string | null; mobile: string | null; email: string | null };

export function CardVisitForm({ cardId, contacts, defaultContactId, today }: {
  cardId: string;
  contacts: Contact[];
  defaultContactId: string;
  today: string;
}) {
  const [state, formAction, pending] = useActionState(recordCardVisit, { error: "" });
  const input = "mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm";
  return <form action={formAction} className="grid gap-4 sm:grid-cols-2">
    <input type="hidden" name="card_id" value={cardId} />
    <label className="block text-sm font-semibold text-slate-700">방문일
      <input type="date" name="visit_date" required max={today} defaultValue={today} className={input} />
    </label>
    <label className="block text-sm font-semibold text-slate-700">만난 담당자
      <select name="contact_id" defaultValue={defaultContactId} className={input}>
        <option value="">담당자 미지정</option>
        {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}{contact.title ? ` · ${contact.title}` : ""}</option>)}
      </select>
    </label>
    <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">상담 내용
      <textarea name="summary" required rows={7} maxLength={5000} placeholder="무슨 업무를 이야기했나요? 관심 프로그램, 교육 대상, 예산·운영 시기, 요청한 자료와 약속한 후속 조치를 적어 주세요." className={input} />
    </label>
    {state.error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 sm:col-span-2">{state.error}</p>}
    <div className="sm:col-span-2"><button type="submit" disabled={pending} className="rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white disabled:opacity-50">{pending ? "저장 중…" : "방문 기록 저장"}</button></div>
  </form>;
}
