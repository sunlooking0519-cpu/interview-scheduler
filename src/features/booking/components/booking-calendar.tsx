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
  return <div>
    <h2 className="mb-4 font-semibold">면접 날짜</h2>
    <DateCalendar selected={selected} available={error ? [] : dates ?? []} disabled={disabled} onSelect={onSelect} />
    {error ? <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>
      : !dates ? <p role="status" className="mt-4 text-sm text-slate-500">예약 날짜 확인 중...</p>
      : dates.length === 0 ? <p className="mt-4 text-sm text-slate-500">현재 예약 가능한 날짜가 없습니다.</p>
      : <p className="mt-4 text-sm text-slate-500">예약 가능한 날짜를 선택해 주세요.</p>}
  </div>;
}
