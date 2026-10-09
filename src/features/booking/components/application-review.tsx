"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { findCandidateReservations, updateCandidateReservation, type CandidateIdentity, type CandidateReservation } from "@/app/(candidate)/application/actions";
import { DEMO_DATES, DEMO_TIMES } from "@/features/booking/demo-data";
import { formatInterviewDate } from "@/lib/date";

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

  function change(id: string | number, field: "interview_date" | "interview_time", value: string) {
    setReservations((rows) => rows.map((row) => row.id === id ? { ...row, [field]: value } : row));
    setMessage("");
  }

  return <div className="mt-6 space-y-5">
    {candidate && <p className="text-sm font-medium">{candidate.name} · {candidate.phone}</p>}
    {loading && <p role="status">예약 내역을 불러오는 중...</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">{message}</p>}
    {!loading && !error && reservations.length === 0 && <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
      <p>입력한 이름과 전화번호가 모두 일치하는 예약을 찾지 못했습니다.</p>
      <p>예약할 때 입력한 이름을 정확히 확인해 주세요. 전화번호가 같아도 이름이 다르면 조회되지 않습니다.</p>
      <Link href="/login" className="inline-block font-semibold text-indigo-600 hover:underline">이름·전화번호 다시 입력하기</Link>
    </div>}
    {reservations.map((row) => <form key={row.id} className="space-y-4 rounded-2xl border border-slate-200 p-5" onSubmit={(event) => { event.preventDefault(); void save(row); }}>
      <p className="font-semibold">면접 예약 · {row.status === "confirmed" ? "확정" : "취소"}</p>
      <fieldset disabled={saving || row.status !== "confirmed"} className="space-y-6">
        <legend className="mb-3 text-sm font-semibold">면접 날짜 · 2026년 10월</legend>
        <div className="grid grid-cols-7 gap-2 text-center">
          {["일", "월", "화", "수", "목", "금", "토"].map((day) => <span key={day} className="py-2 text-xs text-slate-500">{day}</span>)}
          {Array.from({ length: 4 }, (_, i) => <span key={`blank-${i}`} />)}
          {Array.from({ length: 31 }, (_, i) => {
            const date = `2026-10-${String(i + 1).padStart(2, "0")}`;
            const selected = row.interview_date === date;
            const available = DEMO_DATES.includes(date);
            return <button type="button" key={date} disabled={!available} aria-label={formatInterviewDate(date)} aria-pressed={selected} onClick={() => change(row.id, "interview_date", date)} className={`rounded-xl py-3 text-sm focus-visible:outline-2 focus-visible:outline-indigo-600 ${selected ? "bg-indigo-600 font-bold text-white" : available ? "bg-indigo-50 font-semibold text-indigo-700 hover:bg-indigo-100" : "text-slate-300"}`}>{i + 1}</button>;
          })}
        </div>
        <div>
          <h3 className="text-sm font-semibold">면접 시간 · 30분</h3>
          <p className="mt-2 text-sm text-slate-500">선택한 일정: {formatInterviewDate(row.interview_date)} · {row.interview_time} (KST)</p>
          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
            {DEMO_TIMES.map((time) => <button key={time} type="button" aria-label={`면접 시간 ${time}`} aria-pressed={row.interview_time === time} onClick={() => change(row.id, "interview_time", time)} className={`rounded-xl border py-3 text-sm focus-visible:outline-2 focus-visible:outline-indigo-600 ${row.interview_time === time ? "border-indigo-600 bg-indigo-50 font-semibold text-indigo-700" : "border-slate-200 hover:bg-slate-50"}`}>{time}</button>)}
          </div>
        </div>
      </fieldset>
      {row.status === "confirmed" && <button disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white disabled:bg-slate-300">{saving ? "저장 중..." : "변경 저장"}</button>}
    </form>)}
    <Link href="/login" className="inline-block text-sm font-semibold text-indigo-600 hover:underline">지원하기로 돌아가기</Link>
  </div>;
}
