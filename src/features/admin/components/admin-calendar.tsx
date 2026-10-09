"use client";

import { useEffect, useState } from "react";
import type { InterviewReservation } from "@/server/interviews";
import { koreaToday } from "@/features/booking/dates";
import { getGoogleCalendarMonth, retryCalendarSync, disconnectGoogleCalendar, type CalendarMonth } from "@/app/admin/calendar-actions";

type Props = { selected: string; disabled?: boolean; interviews: InterviewReservation[]; onSelect: (date: string) => void };

export function AdminCalendar({ selected, disabled, interviews, onSelect }: Props) {
  const [month, setMonth] = useState(koreaToday().slice(0, 7));
  const [data, setData] = useState<CalendarMonth | null>(null);
  const [loadedMonth, setLoadedMonth] = useState("");
  const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [year, number] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, number - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const loading = loadedMonth !== month;

  useEffect(() => {
    let active = true;
    getGoogleCalendarMonth(month).then((result) => { if (active) { setData(result); setLoadedMonth(month); } }).catch(() => {
      if (active) { setData({ connected: false, canConnect: false, canDisconnect: false, events: [], pending: 0, error: "Google 일정을 불러오지 못했습니다." }); setLoadedMonth(month); }
    });
    return () => { active = false; };
  }, [month, revision]);

  const events = loading ? [] : data?.events ?? [];
  function googleOn(date: string) {
    return events.filter((event) => {
      if (event.allDay) return event.start <= date && event.end > date;
      return event.start.slice(0, 10) <= date && event.end > `${date}T00:00`;
    });
  }
  const localOn = (date: string) => interviews.filter((row) => row.interview_date === date);
  function move(offset: number) { setMonth(new Date(Date.UTC(year, number - 1 + offset, 1)).toISOString().slice(0, 7)); }
  async function sync() {
    if (pending) return;
    setPending(true); setMessage("");
    try {
      const result = await retryCalendarSync();
      setMessage(result.error || "동기화를 요청했습니다. 남은 내역은 순차적으로 처리됩니다.");
      setRevision((value) => value + 1);
    } catch { setMessage("동기화를 처리하지 못했습니다."); }
    finally { setPending(false); }
  }
  async function disconnect() {
    if (!window.confirm("Google 연결을 해제할까요? 이미 생성된 Google 면접 일정은 유지됩니다.")) return;
    setPending(true);
    try {
      const result = await disconnectGoogleCalendar();
      setMessage(result.error || "Google 연결을 해제했습니다."); setRevision((value) => value + 1);
    } catch { setMessage("Google 연결을 해제하지 못했습니다."); }
    finally { setPending(false); }
  }

  return <div className="mt-5 rounded-2xl border border-slate-200 p-3 sm:p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-bold">내 일정과 면접 예약</h3>
      <div className="flex flex-wrap gap-2 text-xs">
        <button type="button" disabled={pending || loading} onClick={() => { setLoadedMonth(""); setRevision((value) => value + 1); }} className="min-h-11 rounded-lg border px-3">일정 새로고침</button>
        {data?.canConnect && <a href="/admin/google/connect" className="inline-flex min-h-11 items-center rounded-lg border px-3 text-indigo-600">{data.connected ? "Google 다시 연결" : "Google 캘린더 연결"}</a>}
        {data?.connected && <button type="button" disabled={pending} onClick={() => void sync()} className="min-h-11 rounded-lg border px-3">{pending ? "처리 중..." : "동기화 재시도"}</button>}
        {data?.canDisconnect && <button type="button" disabled={pending} onClick={() => void disconnect()} className="min-h-11 rounded-lg border px-3 text-slate-500">연결 해제</button>}
      </div>
    </div>
    {loading && <p role="status" className="mb-3 text-xs text-slate-500">Google 일정 확인 중...</p>}
    {!loading && data?.error && <p role="alert" className="mb-3 text-xs text-amber-700">{data.error}</p>}
    {message && <p role="status" className="mb-3 text-xs text-indigo-600">{message}</p>}
    {!!data?.pending && <p className="mb-3 text-xs text-slate-500">Google 동기화 대기 {data.pending}건</p>}
    <div className="mb-3 flex items-center justify-between"><button type="button" aria-label="이전 달" onClick={() => move(-1)} className="size-11 rounded-lg border">‹</button><p className="font-semibold">{year}년 {number}월</p><button type="button" aria-label="다음 달" onClick={() => move(1)} className="size-11 rounded-lg border">›</button></div>
    <div className="grid grid-cols-7 gap-1 text-center">
      {["일", "월", "화", "수", "목", "금", "토"].map((day) => <span key={day} className="py-2 text-xs text-slate-500">{day}</span>)}
      {Array.from({ length: first }, (_, i) => <span key={`blank-${i}`} />)}
      {Array.from({ length: days }, (_, i) => {
        const date = `${month}-${String(i + 1).padStart(2, "0")}`;
        const google = googleOn(date).length;
        const bookings = localOn(date);
        return <button key={date} type="button" disabled={disabled} aria-pressed={selected === date} aria-label={`${date}, Google 일정 ${google}건, 예약 ${bookings.length}건`} onClick={() => onSelect(date)} className={`min-h-14 rounded-xl border py-2 text-sm ${selected === date ? "border-indigo-600 bg-indigo-50 font-bold text-indigo-700" : "border-transparent hover:bg-slate-50"}`}>
          {i + 1}<span className="mt-1 flex min-h-2 justify-center gap-1">{!!google && <span className="size-1.5 rounded-full bg-blue-500" />}{bookings.some((row) => row.status === "confirmed") && <span className="size-1.5 rounded-full bg-emerald-500" />}{bookings.some((row) => row.status === "cancelled") && <span className="size-1.5 rounded-full bg-slate-400" />}</span>
        </button>;
      })}
    </div>
    <p className="mt-3 text-xs text-slate-500">🔵 Google 일정 · 🟢 예약 확정 · ⚪ 예약 취소</p>
    {selected && <div className="mt-4 space-y-2 border-t pt-4">
      <h4 className="text-sm font-bold">{selected} 일정</h4>
      {googleOn(selected).map((event) => <p key={event.id} className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{event.allDay ? "종일" : event.start.slice(11, 16)} · {event.title}</p>)}
      {localOn(selected).map((row) => <p key={row.id} className={`rounded-xl p-3 text-sm ${row.status === "confirmed" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>{row.interview_time} · {row.name} · {row.status === "confirmed" ? "면접 확정" : "취소"}</p>)}
      {googleOn(selected).length === 0 && localOn(selected).length === 0 && <p className="text-sm text-slate-500">표시할 일정이 없습니다.</p>}
    </div>}
    <p className="mt-4 text-xs leading-5 text-slate-500">Google 일정은 참고용입니다. 예약 시간은 자동으로 열리지 않으며, 아래에서 직접 연 시간만 지원자가 예약할 수 있습니다.</p>
  </div>;
}
