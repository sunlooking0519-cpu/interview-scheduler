import Link from "next/link";
import type { DashboardCalendarEvent } from "../sales-dashboard-model";

const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];
const eventLabels = { completed: "완료", meeting: "미팅", due: "할 일" };
const eventColors = { completed: "bg-emerald-500", meeting: "bg-sky-500", due: "bg-amber-500" };
const dayFormatter = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "long" });
const timeFormatter = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false });

export function SalesDashboardCalendar({ month, selectedDay, today, events }: {
  month: string; selectedDay: string; today: string; events: DashboardCalendarEvent[];
}) {
  const [year, monthNumber] = month.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const previousMonth = new Date(Date.UTC(year, monthNumber - 2, 1)).toISOString().slice(0, 7);
  const nextMonth = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 7);
  const byDate = new Map<string, DashboardCalendarEvent[]>();
  for (const event of events) byDate.set(event.date, [...(byDate.get(event.date) ?? []), event]);
  const selectedEvents = byDate.get(selectedDay) ?? [];
  const cells = Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 }, (_, index) => index - firstWeekday + 1);

  return <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6" aria-label="영업 일정 달력">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-bold text-slate-950">영업 일정</h2><p className="mt-1 text-sm text-slate-500">방문·활동 완료일과 앞으로 할 일을 함께 봅니다.</p></div>
      <div className="flex items-center gap-2"><Link href={`/admin/sales?view=visits&month=${previousMonth}`} aria-label="이전 달" className="rounded-lg border border-slate-200 px-3 py-2 text-sm">←</Link><span className="min-w-28 text-center font-bold">{year}년 {monthNumber}월</span><Link href={`/admin/sales?view=visits&month=${nextMonth}`} aria-label="다음 달" className="rounded-lg border border-slate-200 px-3 py-2 text-sm">→</Link></div>
    </div>
    <div className="mt-5 grid grid-cols-7 text-center text-xs font-semibold text-slate-500">{weekdayLabels.map((label) => <span key={label} className="pb-2">{label}</span>)}</div>
    <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-slate-200 bg-slate-200 gap-px">{cells.map((day, index) => {
      if (day < 1 || day > daysInMonth) return <div key={`blank-${index}`} className="min-h-16 bg-slate-50 sm:min-h-20"/>;
      const date = `${month}-${String(day).padStart(2, "0")}`;
      const dayEvents = byDate.get(date) ?? [];
      return <Link key={date} href={`/admin/sales?view=visits&month=${month}&day=${date}`} aria-label={`${date}, 일정 ${dayEvents.length}건`} aria-current={date === selectedDay ? "date" : undefined} className={`min-h-16 p-1.5 text-left transition hover:bg-indigo-50 sm:min-h-20 sm:p-2 ${date === selectedDay ? "bg-indigo-50 ring-2 ring-inset ring-indigo-500" : "bg-white"}`}>
        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${date === today ? "bg-indigo-700 text-white" : "text-slate-700"}`}>{day}</span>
        <span className="mt-1 flex flex-wrap gap-1">{["due", "meeting", "completed"].map((type) => dayEvents.some((event) => event.type === type) && <span key={type} title={eventLabels[type as keyof typeof eventLabels]} className={`h-2 w-2 rounded-full ${eventColors[type as keyof typeof eventColors]}`}/>)}</span>
        {dayEvents.length > 0 && <span className="mt-1 block text-[10px] text-slate-600 sm:text-xs">{dayEvents.length}건</span>}
      </Link>;
    })}</div>
    <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">{Object.entries(eventLabels).map(([type, label]) => <span key={type} className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${eventColors[type as keyof typeof eventColors]}`}/>{label}</span>)}</div>
    <div className="mt-6 border-t border-slate-200 pt-5"><h3 className="font-bold">{dayFormatter.format(new Date(`${selectedDay}T12:00:00+09:00`))} <span className="text-indigo-700">{selectedEvents.length}건</span></h3>
      {selectedEvents.length ? <div className="mt-3 space-y-2">{selectedEvents.map((event) => <article key={event.id} className="rounded-xl border border-slate-200 p-3"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${event.type === "completed" ? "bg-emerald-50 text-emerald-700" : event.type === "meeting" ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-700"}`}>{eventLabels[event.type]}</span><Link href={event.href} className="font-semibold text-indigo-700 hover:underline">{event.organizationName}</Link><span className="text-xs text-slate-500">현재: {event.progress}</span></div><p className="mt-1 text-sm font-medium text-slate-900">{event.title}{event.time && event.type !== "completed" ? ` · ${timeFormatter.format(new Date(event.time))}` : ""}</p><p className="mt-1 line-clamp-2 text-xs text-slate-600">{event.location ? `${event.location} · ` : ""}{event.detail}</p></article>)}</div> : <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">이날 기록된 활동이나 예정된 일이 없습니다.</p>}
    </div>
  </section>;
}
