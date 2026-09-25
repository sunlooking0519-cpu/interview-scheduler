"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createInterview } from "@/app/(candidate)/booking/actions";
import { DEMO_DATES, DEMO_TIMES } from "@/features/booking/demo-data";
import { formatInterviewDate } from "@/lib/date";

type Candidate = { name: string; email: string; phone: string };

export function BookingPicker() {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();

  async function handleBooking() {
    setErrorMessage("");

    let candidate: Candidate | null = null;
    try {
      candidate = JSON.parse(sessionStorage.getItem("candidate") ?? "null") as Candidate | null;
    } catch {
      candidate = null;
    }

    if (!candidate?.name || !candidate.email || !candidate.phone) {
      setErrorMessage("지원자 정보가 없습니다. 로그인 화면에서 정보를 다시 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    const result = await createInterview({
      ...candidate,
      interviewDate: date,
      interviewTime: time,
    });
    setIsSubmitting(false);

    if (!result.success) {
      setErrorMessage(result.message);
      return;
    }

    sessionStorage.removeItem("candidate");
    router.push(`/booking/complete?${new URLSearchParams({ date, time })}`);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
        <h2 className="text-xl font-bold">2026년 10월 <span className="text-sm font-normal text-slate-400">예시</span></h2>
        <div className="mt-6 grid grid-cols-7 gap-2 text-center">
          {["일", "월", "화", "수", "목", "금", "토"].map(day => <span key={day} className="py-2 text-xs text-slate-500">{day}</span>)}
          {Array.from({ length: 4 }, (_, i) => <span key={`blank-${i}`} />)}
          {Array.from({ length: 31 }, (_, i) => {
            const value = `2026-10-${String(i + 1).padStart(2, "0")}`;
            const available = DEMO_DATES.includes(value);
            return <button key={value} disabled={!available || isSubmitting} aria-label={formatInterviewDate(value)} aria-pressed={date === value} onClick={() => { setDate(value); setTime(""); setErrorMessage(""); }} className={`rounded-xl py-3 text-sm ${date === value ? "bg-indigo-600 font-bold text-white" : available ? "bg-indigo-50 font-semibold text-indigo-700 hover:bg-indigo-100" : "text-slate-300"}`}>{i + 1}</button>;
          })}
        </div>
        <fieldset className="mt-8" disabled={!date || isSubmitting}>
          <legend className="font-semibold">면접 시간 <span className="text-xs font-normal text-slate-500">· 30분</span></legend>
          <p className="mt-2 text-sm text-slate-500">{date ? formatInterviewDate(date) : "먼저 예약 가능한 날짜를 선택해 주세요."}</p>
          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">{DEMO_TIMES.map(value => <button key={value} aria-pressed={time === value} onClick={() => { setTime(value); setErrorMessage(""); }} className={`rounded-xl border py-3 text-sm disabled:opacity-40 ${time === value ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200"}`}>{value}</button>)}</div>
        </fieldset>
      </section>
      <aside className="self-start rounded-2xl border border-slate-200 bg-white p-7">
        <p className="text-xs font-semibold tracking-widest text-indigo-600">INTERVIEW</p><h2 className="mt-3 text-xl font-bold">선택한 면접 일정</h2>
        <dl className="my-7 space-y-5 text-sm"><div><dt className="text-slate-500">진행 방식</dt><dd className="mt-1 font-medium">온라인 면접 · 30분</dd></div><div><dt className="text-slate-500">날짜</dt><dd className="mt-1 font-medium">{date ? formatInterviewDate(date) : "선택 전"}</dd></div><div><dt className="text-slate-500">시간</dt><dd className="mt-1 font-medium">{time ? `${time} (KST)` : "선택 전"}</dd></div></dl>
        <Button disabled={!date || !time || isSubmitting} className="w-full" onClick={handleBooking}>{isSubmitting ? "예약 저장 중..." : "예약 확정"}</Button>
        {errorMessage && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-700">{errorMessage}</p>}
      </aside>
    </div>
  );
}