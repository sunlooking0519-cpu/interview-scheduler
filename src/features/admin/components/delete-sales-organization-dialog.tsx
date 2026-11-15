"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSalesOrganization, getSalesOrganizationDeletionPreview, type OrganizationDeletionPreview } from "@/app/admin/sales/delete-organization";

const sections = [
  ["contacts", "담당자"], ["cards", "명함 및 사진"], ["activities", "활동 기록"],
  ["meetings", "미팅 일정"], ["proposals", "제안서"],
] as const;

export function DeleteSalesOrganizationDialog({ id, name }: { id: string; name: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [preview, setPreview] = useState<OrganizationDeletionPreview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [loading, startTransition] = useTransition();
  const [state, action, pending] = useActionState(deleteSalesOrganization, { deleted: false, error: "", photoWarning: "" });

  const open = () => {
    setPreview(null);
    setPreviewError("");
    dialog.current?.showModal();
    startTransition(async () => {
      const result = await getSalesOrganizationDeletionPreview(id);
      setPreview(result.preview);
      setPreviewError(result.error);
    });
  };
  const finish = () => {
    dialog.current?.close();
    router.push("/admin/sales#organizations");
    router.refresh();
  };

  return <>
    <button type="button" onClick={open} className="rounded-xl border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">삭제</button>
    <dialog ref={dialog} className="m-auto max-h-[90dvh] w-[min(94vw,560px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/60">
      {state.deleted ? <div className="p-5">
        <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{name} 기관과 연결 기록을 삭제했습니다.</p>
        {state.photoWarning && <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{state.photoWarning}</p>}
        <button type="button" onClick={finish} className="mt-5 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white">내 기관 목록으로</button>
      </div> : <div className="p-5">
        <h2 className="text-xl font-bold text-slate-950">기관 삭제 영향 확인</h2>
        <p className="mt-2 text-sm text-slate-600">{name} 기관을 삭제하면 아래 연결 기록도 함께 삭제됩니다.</p>
        {loading && <p role="status" className="mt-4 text-sm text-slate-600">연결 기록 확인 중…</p>}
        {previewError && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{previewError}</p>}
        {preview && <>
          <div className="mt-4 space-y-3">
            {sections.map(([key, label]) => <section key={key} className="rounded-xl border border-slate-200 p-3">
              <h3 className="text-sm font-bold text-slate-900">{label} {preview.counts[key]}건</h3>
              {preview[key].length > 0 && <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-sm text-slate-600">{preview[key].map((item, index) => <li key={`${key}-${index}`} className="break-words">• {item}</li>)}</ul>}
              {preview.counts[key] > preview[key].length && <p className="mt-1 text-xs text-slate-500">처음 {preview[key].length}건만 표시합니다.</p>}
            </section>)}
            <p className="text-xs text-slate-600">활동 수정 이력 {preview.counts.revisions}건 · 제안서 이전 버전 {preview.counts.proposal_versions}건도 함께 삭제됩니다.</p>
          </div>
          {preview.counts.meetings > 0 && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">연결된 미팅 {preview.counts.meetings}건의 Google 캘린더 일정도 삭제 대기열에 들어갑니다. 동기화 실패 시 관리자에서 재시도해 주세요.</p>}
          <form action={action} className="mt-5">
              <input type="hidden" name="organization_id" value={id} />
              <input type="hidden" name="expected_counts" value={JSON.stringify(preview.counts)} />
              <label className="block text-sm font-semibold text-slate-700">삭제하려면 기관명 ‘{preview.name}’을 입력하세요
                <input name="organization_name" required autoComplete="off" className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm" />
              </label>
              {state.error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{state.error}</p>}
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => dialog.current?.close()} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold">취소</button>
                <button type="submit" disabled={pending} className="rounded-xl bg-rose-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{pending ? "삭제 중…" : "확인 후 영구 삭제"}</button>
              </div>
          </form>
        </>}
        {!preview && <button type="button" onClick={() => dialog.current?.close()} className="mt-5 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold">닫기</button>}
      </div>}
    </dialog>
  </>;
}
