"use client";

import { useActionState, useRef } from "react";
import { useRouter } from "next/navigation";
import { recordCardVisitDetails } from "@/app/admin/sales/actions";

const reactions = [
  ["neutral", "보통"], ["interested", "관심 높음"], ["reviewing", "검토 중"],
  ["waiting", "시기 대기"], ["no_budget", "예산 없음"],
  ["not_interested", "관심 없음"], ["no_response", "응답 없음"],
] as const;

export function CardVisitDialog({ cardId, contactId, organization, contact, region, today, recorded }: {
  cardId: string; contactId: string | null; organization: string; contact: string;
  region: string; today: string; recorded: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [state, action, pending] = useActionState(recordCardVisitDetails, { error: "", saved: false });
  const input = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm";
  function close() { dialog.current?.close(); }

  return <>
    <button type="button" onClick={() => dialog.current?.showModal()} className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700">
      {recorded ? "상담 내용 추가" : "명함 선택 · 상담 기록"}
    </button>
    <dialog ref={dialog} onClose={() => { if (state.saved) router.refresh(); }} className="m-auto max-h-[min(92dvh,850px)] w-[min(92vw,620px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/60">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-white p-5 sm:p-6">
        <div><p className="text-xs font-bold text-indigo-600">1단계 · 기관 접촉 기록</p><h2 className="mt-1 text-xl font-bold text-slate-950">{organization}</h2><p className="mt-1 text-sm text-slate-500">{contact} 담당자와 나눈 내용</p></div>
        <button type="button" onClick={close} aria-label="팝업 닫기" className="rounded-lg border px-3 py-2 text-sm text-slate-600">닫기</button>
      </div>
      {state.saved ? <div className="p-6"><p role="status" className="rounded-xl bg-emerald-50 p-4 font-semibold text-emerald-800">상담 기록을 저장했습니다.</p><button type="button" onClick={close} className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white">목록으로 돌아가기</button></div>
        : <form action={action} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <input type="hidden" name="card_id" value={cardId} />
          <input type="hidden" name="contact_id" value={contactId ?? ""} />
          <label className="text-sm font-semibold text-slate-700">1. 방문일<input type="date" name="visit_date" required max={today} defaultValue={today} className={input} /></label>
          <label className="text-sm font-semibold text-slate-700">2. 방문지역<input name="visit_region" required maxLength={120} defaultValue={region} placeholder="예: 광주광역시 북구" className={input} /></label>
          <label className="text-sm font-semibold text-slate-700">3. 제안서 제출<select name="proposal_status" defaultValue="not_submitted" className={input}><option value="not_submitted">미제출</option><option value="planned">제출 예정</option><option value="submitted">제출 완료</option></select></label>
          <label className="text-sm font-semibold text-slate-700">4. 반응<select name="reaction" defaultValue="neutral" className={input}>{reactions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">5. 접촉 방식<select name="contact_method" defaultValue="visit" className={input}><option value="visit">방문</option><option value="call">전화</option><option value="email">이메일</option><option value="referral">지인 소개</option></select></label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">6. 특이사항 · 상담 내용<textarea name="summary" required rows={4} maxLength={5000} placeholder="관심 프로그램, 요청 자료, 예산, 다음에 확인할 내용을 간단히 적어 주세요." className={input} /></label>
          {state.error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 sm:col-span-2">{state.error}</p>}
          <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={close} className="rounded-xl border px-4 py-3 text-sm font-semibold">취소</button><button type="submit" disabled={pending} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{pending ? "저장 중…" : "상담 기록 저장"}</button></div>
        </form>}
    </dialog>
  </>;
}
