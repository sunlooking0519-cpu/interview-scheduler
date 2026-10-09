"use client";

import { useEffect, useRef, useState } from "react";
import { DEMO_DATES } from "@/features/booking/demo-data";
import { ALL_TIMES, displayTime, type TimeSlot } from "@/features/booking/time-slots";
import { getTimeSlots } from "@/app/(candidate)/booking/availability";
import { setTimeSlot, closeAllTimeSlots } from "@/app/admin/time-actions";

export function TimeSlotManager() {
  const [date, setDate] = useState(DEMO_DATES[0]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    getTimeSlots(date).then((result) => {
      if (!active) return;
      setSlots(result.slots); setError(result.error); setLoading(false);
    }).catch(() => { if (active) { setError("시간 설정을 불러오지 못했습니다."); setLoading(false); } });
    return () => { active = false; };
  }, [date]);

  async function toggle(time: string) {
    if (busy.current || loading || error) return;
    busy.current = true; setSaving(true); setMessage("");
    try {
      const enabled = !slots.find((slot) => slot.interview_time === time)?.enabled;
      const result = await setTimeSlot(date, time, enabled);
      if (result.error) { setError(result.error); return; }
      setSlots((rows) => rows.map((slot) => slot.interview_time === time ? { ...slot, enabled } : slot));
      setMessage(`${time} 예약을 ${enabled ? "열었습니다" : "닫았습니다"}.`);
    } catch { setError("시간 설정을 저장하지 못했습니다."); }
    finally { busy.current = false; setSaving(false); }
  }

  async function closeAll() {
    if (busy.current || loading || error) return;
    busy.current = true; setSaving(true); setMessage("");
    try {
      const result = await closeAllTimeSlots(date);
      if (result.error) { setError(result.error); return; }
      setSlots((rows) => rows.map((slot) => ({ ...slot, enabled: false })));
      setMessage(`${date}의 모든 예약 시간을 닫았습니다. 기존 예약은 유지됩니다.`);
    } catch { setError("전체 시간 닫기에 실패했습니다."); }
    finally { busy.current = false; setSaving(false); }
  }

  return <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6">
    <h2 className="text-lg font-bold">예약 가능 시간 관리</h2>
    <p className="mt-2 text-sm text-slate-500">날짜를 선택하고 시간 버튼을 눌러 예약을 열거나 닫으세요. 즉시 저장되며 기존 예약은 유지됩니다.</p>
    <label className="mt-4 block text-sm font-medium">날짜<select value={date} disabled={saving} onChange={(event) => { setDate(event.target.value); setLoading(true); setError(""); setMessage(""); }} className="ml-3 rounded-lg border p-2">{DEMO_DATES.map((value) => <option key={value}>{value}</option>)}</select></label>
    <button type="button" disabled={loading || saving || !!error} onClick={() => void closeAll()} className="mt-4 rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">선택한 날짜 전체 닫기</button>
    {loading && <p role="status" className="mt-4">불러오는 중...</p>}
    {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
    {message && <p role="status" className="mt-4 text-sm text-emerald-700">{message}</p>}
    {[{ label: "오전", times: ALL_TIMES.filter((time) => time < "12:00") }, { label: "오후", times: ALL_TIMES.filter((time) => time >= "12:00") }].map(({ label, times }) => <div key={label} className="mt-5">
      <p className="mb-3 text-sm text-slate-500">{label}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">{times.map((time) => {
        const slot = slots.find((value) => value.interview_time === time);
        return <button type="button" key={time} disabled={loading || saving || !!error} aria-pressed={slot?.enabled ?? false} onClick={() => void toggle(time)} className={`rounded-xl border px-2 py-3 text-sm disabled:opacity-50 ${slot?.enabled ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-slate-100 text-slate-500"}`}>
          {displayTime(time)}<span className="mt-1 block text-xs">{slot?.enabled ? "열림" : "닫힘"}{slot?.booked ? " · 예약 있음" : ""}</span>
        </button>;
      })}</div>
    </div>)}
  </section>;
}
