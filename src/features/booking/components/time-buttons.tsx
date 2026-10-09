import { ALL_TIMES, displayTime } from "@/features/booking/time-slots";

type Props = { selected: string; available: string[]; disabled?: boolean; onSelect: (time: string) => void };

export function TimeButtons({ selected, available, disabled, onSelect }: Props) {
  return <div className="mt-4 space-y-6">
    {[{ label: "오전", times: ALL_TIMES.filter((time) => time < "12:00") }, { label: "오후", times: ALL_TIMES.filter((time) => time >= "12:00") }].map(({ label, times }) => <div key={label}>
      <p className="mb-3 text-sm text-slate-500">{label}</p>
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {times.map((time) => {
          const open = available.includes(time);
          return <button type="button" key={time} disabled={disabled || !open} aria-label={`${label} ${displayTime(time)}${open ? "" : " 예약 불가"}`} aria-pressed={selected === time} onClick={() => onSelect(time)} className={`rounded-xl border px-2 py-3 text-sm transition focus-visible:outline-2 focus-visible:outline-indigo-600 ${!open ? "cursor-not-allowed border-transparent bg-slate-100 text-slate-400" : selected === time ? "border-indigo-600 bg-indigo-600 font-bold text-white" : "border-slate-200 bg-white text-slate-700 hover:border-indigo-400"} disabled:cursor-not-allowed`}>{displayTime(time)}</button>;
        })}
      </div>
    </div>)}
  </div>;
}
