"use client";

import { useEffect, useRef, useState } from "react";
import { koreaToday, type BookingDate } from "@/features/booking/dates";
import { ALL_TIMES, displayTime, type TimeSlot } from "@/features/booking/time-slots";
import { getTimeSlots, getBookingDates } from "@/app/(candidate)/booking/availability";
import { setTimeSlot, closeAllTimeSlots, addBookingDate } from "@/app/admin/time-actions";

export function TimeSlotManager() {
  const [date, setDate] = useState("");
  const [dates, setDates] = useState<BookingDate[]>([]);
  const [newDate, setNewDate] = useState("");
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    getBookingDates().then((result) => {
      if (!active) return;
      setDates(result.dates); setError(result.error);
      const first = result.dates.find((row) => row.interview_date >= koreaToday()) ?? result.dates[0];
      if (first) setDate(first.interview_date); else setLoading(false);
    }).catch(() => { if (active) { setError("예약 날짜를 불러오지 못했습니다."); setLoading(false); } });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!date) return;
    getTimeSlots(date).then((result) => {
      if (!active) return;
      setSlots(result.slots); setError(result.error); setLoading(false);
    }).catch(() => { if (active) { setError("시간 설정을 불러오지 못했습니다."); setLoading(false); } });
    return () => { active = false; };
  }, [date]);

  async function addDate() {
    if (busy.current || !newDate) return;
    busy.current = true; setSaving(true); setError(""); setMessage("");
    try {
      const result = await addBookingDate(newDate);
      if (result.error) { setError(result.error); return; }
      const refreshed = await getBookingDates();
      setDates(refreshed.dates);
      if (refreshed.error) { setError(refreshed.error); return; }
      if (date !== newDate) { setLoading(true); setDate(newDate); }
      setMessage("날짜를 추가했습니다. 예약을 받을 시간을 열어 주세요.");
      setNewDate("");
    } catch { setError("날짜를 추가하지 못했습니다."); }
    finally { busy.current = false; setSaving(false); }
  }

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

  return <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
    <h2 className="text-lg font-bold">예약 가능 시간 관리</h2>
    <p className="mt-2 text-sm text-slate-500">모든 시간은 기본적으로 닫혀 있습니다. 직접 연 시간만 지원자가 예약할 수 있습니다. 즉시 저장되며 기존 예약은 유지됩니다.</p>
    <form className="mt-5 flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); void addDate(); }}>
      <label className="min-w-0 flex-1 text-sm font-medium">날짜 추가<input type="date" value={newDate} min={koreaToday()} required disabled={saving} onChange={(event) => setNewDate(event.target.value)} className="mt-2 min-h-11 w-full min-w-0 rounded-xl border p-3 text-base" /></label>
      <button disabled={saving || !newDate} className="min-h-11 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white disabled:opacity-50">추가</button>
    </form>
    <label className="mt-5 block text-sm font-medium">관리할 날짜<select value={date} disabled={saving || dates.length === 0} onChange={(event) => { setDate(event.target.value); setLoading(true); setError(""); setMessage(""); }} className="mt-2 min-h-11 w-full rounded-xl border p-3 text-base">{dates.length === 0 && <option value="">등록된 날짜 없음</option>}{dates.map((row) => <option key={row.interview_date} value={row.interview_date}>{row.interview_date}</option>)}</select></label>
    <button type="button" disabled={!date || loading || saving || !!error} onClick={() => void closeAll()} className="mt-4 min-h-11 w-full rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">선택한 날짜 마감 · 전체 시간 닫기</button>
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
