"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createInterview } from "@/app/(candidate)/booking/actions";
import { BookingCalendar } from "@/features/booking/components/booking-calendar";
import { AvailableTimeButtons } from "@/features/booking/components/available-time-buttons";
import { formatInterviewDate } from "@/lib/date";

type Candidate = { name: string; phone: string };

export function BookingPicker() {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();
  const busy = useRef(false);

  async function handleBooking() {
    if (busy.current) return;
    setErrorMessage("");

    let candidate: Candidate | null = null;
    try {
      candidate = JSON.parse(sessionStorage.getItem("candidate") ?? "null") as Candidate | null;
    } catch {
      candidate = null;
    }

    if (typeof candidate?.name !== "string" || !candidate.name.trim() || typeof candidate.phone !== "string" || !candidate.phone.trim()) {
      setErrorMessage("지원자 정보가 없습니다. 로그인 화면에서 정보를 다시 입력해 주세요.");
      return;
    }

    busy.current = true;
    setIsSubmitting(true);
    try {
    const result = await createInterview({
      name: candidate.name,
      phone: candidate.phone,
      interviewDate: date,
      interviewTime: time,
    });

    if (!result.success) {
      setErrorMessage(result.message);
      return;
    }

    sessionStorage.removeItem("candidate");
    router.push(`/booking/complete?${new URLSearchParams({ date, time })}`);
    } catch {
      setErrorMessage("예약을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      busy.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-8">
        <BookingCalendar selected={date} disabled={isSubmitting} onSelect={(value) => { setDate(value); setTime(""); setErrorMessage(""); }} />
        <fieldset className="mt-8" disabled={!date || isSubmitting}>
          <legend className="font-semibold">면접 시간 <span className="text-xs font-normal text-slate-500">· 30분</span></legend>
          <p className="mt-2 text-sm text-slate-500">{date ? formatInterviewDate(date) : "먼저 예약 가능한 날짜를 선택해 주세요."}</p>
          <AvailableTimeButtons date={date} selected={time} disabled={isSubmitting} onSelect={(value) => { setTime(value); setErrorMessage(""); }} />
        </fieldset>
      </section>
      <aside className="self-start rounded-2xl border border-slate-200 bg-white p-5 md:p-7">
        <p className="text-xs font-semibold tracking-widest text-indigo-600">INTERVIEW</p><h2 className="mt-3 text-xl font-bold">선택한 면접 일정</h2>
        <dl className="my-7 space-y-5 text-sm"><div><dt className="text-slate-500">진행 방식</dt><dd className="mt-1 font-medium">온라인 면접 · 30분</dd></div><div><dt className="text-slate-500">날짜</dt><dd className="mt-1 font-medium">{date ? formatInterviewDate(date) : "선택 전"}</dd></div><div><dt className="text-slate-500">시간</dt><dd className="mt-1 font-medium">{time ? `${time} (KST)` : "선택 전"}</dd></div></dl>
        <Button disabled={!date || !time || isSubmitting} className="w-full" onClick={handleBooking}>{isSubmitting ? "예약 저장 중..." : "예약 확정"}</Button>
        {errorMessage && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-700">{errorMessage}</p>}
      </aside>
    </div>
  );
}
