"use client";

import { useActionState, useRef } from "react";
import { useRouter } from "next/navigation";
import { deleteEmptySalesOrganization } from "@/app/admin/sales/delete-organization";

export function DeleteSalesOrganizationDialog({ id, name, contactCount }: { id: string; name: string; contactCount: number }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [state, action, pending] = useActionState(deleteEmptySalesOrganization, { deleted: false, error: "" });

  return <>
    <button type="button" onClick={() => dialog.current?.showModal()}
      className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">기관 삭제</button>
    <dialog ref={dialog} className="m-auto w-[min(92vw,480px)] rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/60">
      {state.deleted ? <div className="p-5">
        <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">기관을 삭제했습니다.</p>
        <button type="button" onClick={() => { dialog.current?.close(); router.push("/admin/sales#organizations"); router.refresh(); }} className="mt-5 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white">내 기관 목록으로</button>
      </div> : <form action={action} className="p-5">
        <h2 className="text-xl font-bold text-slate-950">기관을 삭제할까요?</h2>
        <p className="mt-3 text-sm leading-6 text-slate-700">{name} 기관과 연결된 담당자 {contactCount}명을 삭제합니다. 명함, 활동, 미팅, 제안서 기록이 있으면 삭제할 수 없습니다.</p>
        <label className="mt-4 block text-sm font-semibold text-slate-700">확인을 위해 기관명 입력
          <input name="organization_name" required autoComplete="off" className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm" />
        </label>
        <input type="hidden" name="organization_id" value={id} />
        {state.error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{state.error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => dialog.current?.close()} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold">취소</button>
          <button type="submit" disabled={pending} className="rounded-xl bg-rose-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{pending ? "삭제 중…" : "기관 삭제"}</button>
        </div>
      </form>}
    </dialog>
  </>;
}
