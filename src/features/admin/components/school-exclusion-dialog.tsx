"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSchoolExclusion } from "@/app/admin/schools/exclusion-action";

export function SchoolExclusionDialog({ schools, excluded, onComplete }: {
  schools: { id: string; name: string; excluded: boolean }[];
  excluded: boolean;
  onComplete: (changed: number) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const label = excluded ? "제외" : "제외 해제";
  const open = () => {
    if (!schools.length) return;
    setError("");
    dialog.current?.showModal();
  };
  const confirm = () => {
    const ids = schools.map((school) => school.id);
    setError("");
    startTransition(async () => {
      const result = await setSchoolExclusion(ids, excluded);
      if (result.error) { setError(result.error); return; }
      dialog.current?.close();
      onComplete(result.changed);
      router.refresh();
    });
  };
  return <>
    <button type="button" onClick={open} disabled={!schools.length || pending}
      className="rounded-xl border border-amber-400 bg-white px-4 py-3 text-sm font-bold text-amber-900 disabled:opacity-50">
      선택 {schools.length}개 {label}
    </button>
    <dialog ref={dialog} onCancel={(event) => { if (pending) event.preventDefault(); }}
      className="m-auto max-h-[90dvh] w-[min(92vw,520px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl backdrop:bg-slate-950/60">
      <h2 className="text-xl font-bold text-slate-950">학교 {label} 확인</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        {excluded ? "선택한 학교를 제외학교로 구분합니다. 배정과 상담·활동 기록은 보존되며 나중에 제외를 해제할 수 있습니다." : "선택한 학교를 제외학교에서 되돌립니다. 기존 배정과 활동 기록이 다시 그대로 표시됩니다."}
      </p>
      <ul className="mt-4 max-h-48 space-y-1 overflow-y-auto rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
        {schools.map((school) => <li key={school.id} className="break-words">• {school.name}{excluded && school.excluded ? " (이미 제외됨)" : ""}</li>)}
      </ul>
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" disabled={pending} onClick={() => dialog.current?.close()} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold disabled:opacity-50">취소</button>
        <button type="button" disabled={pending} onClick={confirm} className="rounded-xl bg-amber-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
          {pending ? "처리 중…" : `${schools.length}개 ${label}`}
        </button>
      </div>
    </dialog>
  </>;
}
