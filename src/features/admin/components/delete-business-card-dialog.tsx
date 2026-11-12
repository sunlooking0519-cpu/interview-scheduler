"use client";

import { useActionState, useRef } from "react";
import { useRouter } from "next/navigation";
import { deleteBusinessCard } from "@/app/admin/sales/cards/actions";

export function DeleteBusinessCardDialog({ cardId, organization, contact }: {
  cardId: string; organization: string; contact: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [state, action, pending] = useActionState(deleteBusinessCard, { deleted: false, error: "", photoWarning: "" });

  return <>
    <button type="button" onClick={() => dialog.current?.showModal()}
      className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">
      명함 삭제
    </button>
    <dialog ref={dialog} onClose={() => { if (state.deleted) router.refresh(); }}
      className="m-auto w-[min(92vw,480px)] rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/60">
      <div className="border-b border-slate-200 p-5">
        <h2 className="text-xl font-bold text-slate-950">명함을 삭제할까요?</h2>
        <p className="mt-2 text-sm text-slate-600">{organization} · {contact}</p>
      </div>
      {state.deleted ? <div className="p-5">
        <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">명함 기록을 삭제했습니다.</p>
        {state.photoWarning && <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{state.photoWarning}</p>}
        <button type="button" onClick={() => dialog.current?.close()} className="mt-5 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white">목록으로 돌아가기</button>
      </div> : <form action={action} className="p-5">
        <input type="hidden" name="card_id" value={cardId} />
        <p className="text-sm leading-6 text-slate-700">이 명함 기록과 사진을 삭제합니다. 기관, 담당자와 상담 기록은 유지되므로 영업관리 목록의 기관은 계속 표시됩니다.</p>
        {state.error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{state.error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={() => dialog.current?.close()} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold">취소</button>
          <button type="submit" disabled={pending} className="rounded-xl bg-rose-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{pending ? "삭제 중…" : "명함 삭제"}</button>
        </div>
      </form>}
    </dialog>
  </>;
}
