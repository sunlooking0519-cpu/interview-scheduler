"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setHiringDecision } from "@/app/admin/reservation-actions";

export function HiringButton({ id, hired }: { id: string | number; hired: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const router = useRouter();
  async function submit() {
    if (busy.current) return;
    busy.current = true; setPending(true); setError("");
    try {
      const result = await setHiringDecision(id, !hired);
      if (result.error) { setError(result.error); return; }
      setConfirming(false);
      router.refresh();
    } catch { setError("처리하지 못했습니다. 다시 시도해 주세요."); }
    finally { busy.current = false; setPending(false); }
  }
  return <div className="mt-2">{confirming ? <div className="rounded-lg bg-slate-50 p-2 text-sm"><p>{hired ? "채용 처리를 되돌릴까요?" : "이 지원자를 채용 처리할까요?"}</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" disabled={pending} onClick={() => void submit()} className="rounded-lg bg-indigo-600 px-3 py-2 font-semibold text-white disabled:opacity-50">{pending ? "처리 중..." : "확인"}</button><button type="button" disabled={pending} onClick={() => setConfirming(false)} className="rounded-lg border px-3 py-2">돌아가기</button></div></div> : <button type="button" onClick={() => setConfirming(true)} className={`min-h-11 rounded-lg px-3 text-sm font-semibold ${hired ? "border border-slate-300 text-slate-700" : "bg-indigo-600 text-white"}`}>{hired ? "채용 취소" : "채용"}</button>}{error && <p role="alert" className="mt-2 whitespace-normal text-xs text-rose-700">{error}</p>}</div>;
}
