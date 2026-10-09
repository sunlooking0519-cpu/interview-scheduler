"use client";

import { useState } from "react";
import { koreaToday } from "@/features/booking/dates";
import { formatInterviewDate } from "@/lib/date";

type Props = { selected: string; available: string[]; disabled?: boolean; onSelect: (date: string) => void };

export function DateCalendar({ selected, available, disabled, onSelect }: Props) {
  const [month, setMonth] = useState((selected || koreaToday()).slice(0, 7));
  const [year, number] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, number - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  function move(offset: number) {
    const value = new Date(Date.UTC(year, number - 1 + offset, 1));
    setMonth(value.toISOString().slice(0, 7));
  }
  return <div>
    <div className="mb-4 flex items-center justify-between">
      <button type="button" disabled={disabled} aria-label="이전 달" onClick={() => move(-1)} className="flex size-11 items-center justify-center rounded-xl border">‹</button>
      <h3 className="font-bold">{year}년 {number}월</h3>
      <button type="button" disabled={disabled} aria-label="다음 달" onClick={() => move(1)} className="flex size-11 items-center justify-center rounded-xl border">›</button>
    </div>
    <div className="grid grid-cols-7 gap-1 text-center sm:gap-2">
      {["일", "월", "화", "수", "목", "금", "토"].map((day) => <span key={day} className="py-2 text-xs text-slate-500">{day}</span>)}
      {Array.from({ length: first }, (_, i) => <span key={`blank-${i}`} />)}
      {Array.from({ length: days }, (_, i) => {
        const value = `${month}-${String(i + 1).padStart(2, "0")}`;
        const open = available.includes(value) && value >= koreaToday();
        return <button key={value} type="button" disabled={disabled || !open} aria-label={formatInterviewDate(value)} aria-pressed={selected === value} onClick={() => onSelect(value)} className={`min-h-11 rounded-xl text-sm ${selected === value ? "bg-indigo-600 font-bold text-white" : open ? "bg-indigo-50 font-semibold text-indigo-700" : "text-slate-300"}`}>{i + 1}</button>;
      })}
    </div>
  </div>;
}
