"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSchoolAdditionalProposal } from "@/app/admin/schools/additional-proposal-action";

export function SchoolAdditionalProposalDialog({ schools, enabled, onComplete }: {
  schools: { id: string; name: string; additional: boolean; excluded: boolean }[];
  enabled: boolean;
  onComplete: (changed: number) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const label = enabled ? "추가제안" : "추가제안 해제";
  const confirm = () => {
    setError("");
    startTransition(async () => {
      const result = await setSchoolAdditionalProposal(schools.map((school) => school.id), enabled);
      if (result.error) { setError(result.error); return; }
      dialog.current?.close();
      onComplete(result.changed);
      router.refresh();
    });
  };
  return <>
    <button type="button" disabled={!schools.length || pending} onClick={() => { setError(""); dialog.current?.showModal(); }}
      className="rounded-xl border border-sky-300 bg-white px-4 py-3 text-sm font-bold text-sky-800 disabled:opacity-50">
      선택 {schools.length}개 {label}
    </button>
    <dialog ref={dialog} onCancel={(event) => { if (pending) event.preventDefault(); }}
      className="m-auto max-h-[90dvh] w-[min(92vw,520px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl backdrop:bg-slate-950/60">
      <h2 className="text-xl font-bold text-slate-950">학교 {label} 확인</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        {enabled ? "수업을 마친 뒤 새로운 수업을 제안할 학교로 분류합니다. 배정과 기존 활동 기록은 유지됩니다. 제외학교를 선택했다면 제외 상태는 해제됩니다." : "추가제안 목록에서만 내립니다. 학교와 활동 기록은 그대로 유지됩니다."}
      </p>
      <ul className="mt-4 max-h-48 space-y-1 overflow-y-auto rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
        {schools.map((school) => <li key={school.id} className="break-words">• {school.name}{enabled && school.additional ? " (이미 추가제안)" : ""}{enabled && school.excluded ? " (제외 해제 예정)" : ""}</li>)}
      </ul>
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" disabled={pending} onClick={() => dialog.current?.close()} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold disabled:opacity-50">취소</button>
        <button type="button" disabled={pending} onClick={confirm} className="rounded-xl bg-sky-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
          {pending ? "처리 중…" : `${schools.length}개 ${label}`}
        </button>
      </div>
    </dialog>
  </>;
}
