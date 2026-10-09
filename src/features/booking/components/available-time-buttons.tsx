"use client";

import { useEffect, useState } from "react";
import { getTimeSlots } from "@/app/(candidate)/booking/availability";
import { TimeButtons } from "@/features/booking/components/time-buttons";
import { openTimes, type TimeSlot } from "@/features/booking/time-slots";

type Props = { date: string; selected: string; disabled?: boolean; onSelect: (time: string) => void; originalDate?: string; originalTime?: string };

export function AvailableTimeButtons({ date, selected, disabled, onSelect, originalDate, originalTime }: Props) {
  const [result, setResult] = useState<{ date: string; slots: TimeSlot[]; error: string } | null>(null);
  useEffect(() => {
    let active = true;
    if (date) getTimeSlots(date).then((value) => { if (active) setResult({ date, ...value }); }).catch(() => { if (active) setResult({ date, slots: [], error: "예약 시간을 불러오지 못했습니다." }); });
    return () => { active = false; };
  }, [date]);
  const loaded = !!date && result?.date === date;
  const available = loaded && !result.error ? openTimes(result.slots) : [];
  if (loaded && !result.error && date === originalDate && originalTime) available.push(originalTime);
  return <>
    {date && !loaded && <p role="status" className="mt-3 text-sm text-slate-500">예약 가능 시간 확인 중...</p>}
    {loaded && result.error && <p role="alert" className="mt-3 text-sm text-red-600">{result.error}</p>}
    <TimeButtons selected={selected} available={available} disabled={disabled || !loaded} onSelect={onSelect} />
  </>;
}
