"use client";

import { useEffect, useState } from "react";
import { getBookingDates } from "@/app/(candidate)/booking/availability";
import { DateCalendar } from "@/features/booking/components/date-calendar";

export function BookingCalendar({ selected, disabled, onSelect }: { selected: string; disabled?: boolean; onSelect: (date: string) => void }) {
  const [dates, setDates] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    getBookingDates().then((result) => { if (active) { setDates(result.dates.filter((row) => row.enabled).map((row) => row.interview_date)); setError(result.error); } }).catch(() => { if (active) setError("예약 날짜를 불러오지 못했습니다."); });
    return () => { active = false; };
  }, []);
  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!dates) return <p role="status" className="text-sm text-slate-500">예약 날짜 확인 중...</p>;
  return <>{dates.length === 0 && <p className="mb-4 text-sm text-slate-500">현재 예약 가능한 날짜가 없습니다.</p>}<DateCalendar selected={selected} available={dates} disabled={disabled} onSelect={onSelect} /></>;
}
