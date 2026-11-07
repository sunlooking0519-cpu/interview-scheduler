"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { recordOrganizationContactState } from "@/app/admin/sales/actions";
import type { SalesOrganizationListRow } from "@/features/admin/sales-organization-list";

const reactions = [
  ["neutral", "보통"], ["interested", "관심 높음"], ["reviewing", "검토 중"],
  ["waiting", "시기 대기"], ["no_budget", "예산 없음"],
  ["not_interested", "관심 없음"], ["no_response", "응답 없음"],
] as const;

type Contact = { id: string; name: string; email: string | null };

export function OrganizationFollowUpDialog({ organization, today, contacts }: { organization: SalesOrganizationListRow; today: string; contacts: Contact[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const initialContact = contacts.find((item) => item.id === organization.next_contact_id) ?? contacts[0];
  const [contactId, setContactId] = useState(initialContact?.id ?? "new");
  const [contactName, setContactName] = useState(initialContact?.name ?? "");
  const [contactEmail, setContactEmail] = useState(initialContact?.email ?? "");
  const [state, action, pending] = useActionState(recordOrganizationContactState, { error: "", saved: false });
  const input = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm";
  const close = () => dialog.current?.close();
  const chooseContact = (id: string) => {
    const selected = contacts.find((item) => item.id === id);
    setContactId(id);
    setContactName(selected?.name ?? "");
    setContactEmail(selected?.email ?? "");
  };
  return <>
    <button type="button" onClick={() => dialog.current?.showModal()} className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-700 md:w-auto">후속관리</button>
    <dialog ref={dialog} onClose={() => { if (state.saved) router.refresh(); }} className="m-auto max-h-[min(92dvh,850px)] w-[min(92vw,620px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/60">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-white p-5 sm:p-6">
        <div><p className="text-xs font-bold text-indigo-600">기관 접촉 · 후속관리</p><h2 className="mt-1 text-xl font-bold text-slate-950">{organization.name}</h2><p className="mt-1 text-sm text-slate-500">현재 기록을 확인하고 변경할 내용을 저장하세요.</p></div>
        <button type="button" onClick={close} aria-label="팝업 닫기" className="rounded-lg border px-3 py-2 text-sm text-slate-600">닫기</button>
      </div>
      {state.saved ? <div className="p-6"><p role="status" className="rounded-xl bg-emerald-50 p-4 font-semibold text-emerald-800">기관 정보와 후속관리 기록을 저장했습니다. 기관 목록에 반영됩니다.</p>{state.error && <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{state.error}</p>}<button type="button" onClick={close} className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white">목록으로 돌아가기</button></div>
        : <form action={action} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <input type="hidden" name="organization_id" value={organization.id} />
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">기관명<input name="organization_name" required maxLength={200} defaultValue={organization.name} className={input} /></label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">담당자 선택<select name="contact_id" value={contactId} onChange={(event) => chooseContact(event.target.value)} className={input}>{contacts.map((person) => <option key={person.id} value={person.id}>{person.name}{person.email ? ` · ${person.email}` : ""}</option>)}<option value="new">새 담당자 등록</option></select></label>
          <label className="text-sm font-semibold text-slate-700">담당자 이름<input name="contact_name" required maxLength={120} value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="담당자 이름" className={input} /></label>
          <label className="text-sm font-semibold text-slate-700">이메일<input name="contact_email" type="email" maxLength={200} value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder="담당자 이메일 (선택)" className={input} /></label>
          <p className="text-xs text-slate-500 sm:col-span-2">담당자가 교체됐다면 ‘새 담당자 등록’을 선택하세요. 기존 담당자의 명함과 활동 기록은 유지됩니다.</p>
          <label className="text-sm font-semibold text-slate-700">방문일<input type="date" name="visit_date" required max={today} defaultValue={organization.visitDate ?? ""} className={input} /></label>
          <label className="text-sm font-semibold text-slate-700">방문지역<input name="visit_region" required maxLength={120} defaultValue={organization.contactRegion} placeholder="예: 광주광역시 북구" className={input} /></label>
          <label className="text-sm font-semibold text-slate-700">제안서 제출<select name="proposal_status" required defaultValue={organization.proposalStatus ?? ""} className={input}><option value="" disabled>상태 선택</option><option value="not_submitted">미제출</option><option value="planned">제출 예정</option><option value="submitted">제출 완료</option></select></label>
          <label className="text-sm font-semibold text-slate-700">반응<select name="reaction" required defaultValue={organization.reaction ?? ""} className={input}><option value="" disabled>반응 선택</option>{reactions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-sm font-semibold text-slate-700">접촉 방식<select name="contact_method" required defaultValue={organization.visitDate ? organization.contactMethod : ""} className={input}><option value="" disabled>방식 선택</option><option value="visit">방문</option><option value="call">전화</option><option value="email">이메일</option><option value="referral">지인 소개</option></select></label>
          <label className="text-sm font-semibold text-slate-700">업데이트 날짜<input type="date" name="update_date" required defaultValue={today} className={input} /><span className="mt-1 block text-xs font-normal text-slate-500">목록의 최근 업데이트 날짜와 정렬에 반영됩니다.</span></label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">특이사항 · 상담 내용<textarea name="summary" required rows={4} maxLength={5000} defaultValue={organization.notes} placeholder="현재 상태와 다음에 확인할 내용을 적어 주세요." className={input} /></label>
          {state.error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 sm:col-span-2">{state.error}</p>}
          <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={close} className="rounded-xl border px-4 py-3 text-sm font-semibold">취소</button><button type="submit" disabled={pending} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{pending ? "저장 중…" : "현재 상태 저장"}</button></div>
        </form>}
    </dialog>
  </>;
}
