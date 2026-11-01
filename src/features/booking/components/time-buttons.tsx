import { ALL_TIMES, displayTime } from "@/features/booking/time-slots";

type Props = { selected: string; available: string[]; disabled?: boolean; onSelect: (time: string) => void };

export function TimeButtons({ selected, available, disabled, onSelect }: Props) {
  const visibleTimes = ALL_TIMES.filter((time) => available.includes(time));
  return <div className="mt-4 space-y-6">
    {[{ label: "오전", times: visibleTimes.filter((time) => time < "12:00") }, { label: "오후", times: visibleTimes.filter((time) => time >= "12:00") }].filter(({ times }) => times.length > 0).map(({ label, times }) => <div key={label}>
      <p className="mb-3 text-sm text-slate-500">{label}</p>
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {times.map((time) => {
          return <button type="button" key={time} disabled={disabled} aria-label={`${label} ${displayTime(time)}`} aria-pressed={selected === time} onClick={() => onSelect(time)} className={`rounded-xl border px-2 py-3 text-sm transition focus-visible:outline-2 focus-visible:outline-indigo-600 ${selected === time ? "border-indigo-600 bg-indigo-600 font-bold text-white" : "border-slate-200 bg-white text-slate-700 hover:border-indigo-400"} disabled:cursor-not-allowed`}>{displayTime(time)}</button>;
        })}
      </div>
    </div>)}
  </div>;
}
