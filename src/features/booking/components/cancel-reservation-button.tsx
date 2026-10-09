"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cancelCandidateReservation, type CandidateIdentity } from "@/app/(candidate)/application/actions";
import { cancelAdminReservation } from "@/app/admin/reservation-actions";

export function CancelReservationButton({ id, candidate, onCancelled, disabled }: { id: string | number; candidate?: CandidateIdentity; onCancelled?: () => void; disabled?: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const router = useRouter();
  async function cancel() {
    if (busy.current) return;
    busy.current = true; setPending(true); setError("");
    try {
      const result = candidate ? await cancelCandidateReservation(candidate, id) : await cancelAdminReservation(id);
      if (result.error) { setError(result.error); return; }
      setConfirming(false); onCancelled?.(); router.refresh();
    } catch { setError("예약을 취소하지 못했습니다. 다시 시도해 주세요."); }
    finally { busy.current = false; setPending(false); }
  }
  return <div className="mt-3">
    {confirming ? <div className="rounded-xl bg-red-50 p-3">
      <p className="mb-3 text-sm text-red-700">이 예약을 취소하시겠습니까?</p>
      <div className="flex gap-2"><button type="button" disabled={pending || disabled} onClick={() => void cancel()} className="min-h-11 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white">{pending ? "취소 중..." : "예약 취소 확정"}</button><button type="button" disabled={pending} onClick={() => setConfirming(false)} className="min-h-11 rounded-lg border px-4 text-sm">돌아가기</button></div>
    </div> : <button type="button" disabled={disabled || pending} onClick={() => setConfirming(true)} className="min-h-11 rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-700">예약 취소</button>}
    {error && <p role="alert" className="mt-2 max-w-sm whitespace-normal text-sm text-red-600">{error}</p>}
  </div>;
}
