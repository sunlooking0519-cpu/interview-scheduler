"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { findCandidateReservations, updateCandidateReservation, type CandidateIdentity, type CandidateReservation } from "@/app/(candidate)/application/actions";
import { DEMO_DATES, DEMO_TIMES } from "@/features/booking/demo-data";

export function ApplicationReview() {
  const router = useRouter();
  const [candidate, setCandidate] = useState<CandidateIdentity | null>(null);
  const [reservations, setReservations] = useState<CandidateReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      let saved: CandidateIdentity;
      try {
        saved = JSON.parse(sessionStorage.getItem("candidate") ?? "null");
        if (typeof saved?.name !== "string" || !saved.name.trim() || typeof saved.phone !== "string" || !saved.phone.trim()) throw new Error();
      } catch {
        router.replace("/login");
        return;
      }
      const result = await findCandidateReservations(saved);
      if (!active) return;
      setCandidate(saved);
      setReservations(result.data);
      setError(result.error);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [router]);

  async function save(row: CandidateReservation) {
    if (!candidate || busy.current) return;
    busy.current = true;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await updateCandidateReservation(candidate, row.id, row.interview_date, row.interview_time);
      if (result.error) { setError(result.error); return; }
      const refreshed = await findCandidateReservations(candidate);
      setReservations(refreshed.data);
      setError(refreshed.error);
      setMessage("면접 일정이 수정되었습니다.");
    } catch {
      setError("요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  function change(id: string, field: "interview_date" | "interview_time", value: string) {
    setReservations((rows) => rows.map((row) => row.id === id ? { ...row, [field]: value } : row));
    setMessage("");
  }

  return <div className="mt-6 space-y-5">
    {candidate && <p className="text-sm font-medium">{candidate.name} · {candidate.phone}</p>}
    {loading && <p role="status">예약 내역을 불러오는 중...</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">{message}</p>}
    {!loading && !error && reservations.length === 0 && <p className="text-slate-500">해당 이름과 전화번호로 등록된 예약이 없습니다. 입력 정보를 확인하거나 새 면접을 예약해 주세요.</p>}
    {reservations.map((row) => <form key={row.id} className="space-y-4 rounded-2xl border border-slate-200 p-5" onSubmit={(event) => { event.preventDefault(); void save(row); }}>
      <p className="font-semibold">면접 예약 · {row.status === "confirmed" ? "확정" : "취소"}</p>
      <fieldset disabled={saving || row.status !== "confirmed"} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">면접 날짜<select aria-label="면접 날짜" value={row.interview_date} onChange={(event) => change(row.id, "interview_date", event.target.value)} className="mt-2 block w-full rounded-lg border p-3">
          {!DEMO_DATES.includes(row.interview_date) && <option value={row.interview_date}>{row.interview_date}</option>}
          {DEMO_DATES.map((date) => <option key={date}>{date}</option>)}
        </select></label>
        <label className="text-sm">면접 시간<select aria-label="면접 시간" value={row.interview_time} onChange={(event) => change(row.id, "interview_time", event.target.value)} className="mt-2 block w-full rounded-lg border p-3">
          {!DEMO_TIMES.includes(row.interview_time) && <option value={row.interview_time}>{row.interview_time}</option>}
          {DEMO_TIMES.map((time) => <option key={time}>{time}</option>)}
        </select></label>
      </fieldset>
      {row.status === "confirmed" && <button disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white disabled:bg-slate-300">{saving ? "저장 중..." : "변경 저장"}</button>}
    </form>)}
    <Link href="/login" className="inline-block text-sm font-semibold text-indigo-600 hover:underline">지원하기로 돌아가기</Link>
  </div>;
}
