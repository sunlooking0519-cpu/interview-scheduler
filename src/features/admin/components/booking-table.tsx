import type { InterviewReservation } from "@/server/interviews";
import { CancelReservationButton } from "@/features/booking/components/cancel-reservation-button";

const STATUS_LABELS: Record<InterviewReservation["status"], string> = {
  confirmed: "확정",
  cancelled: "취소",
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(new Date(`${date}T00:00:00+09:00`));
}

function formatCreatedAt(date: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(new Date(date));
}

export function BookingTable({ interviews }: { interviews: InterviewReservation[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="md:hidden">
        <h2 className="p-5 text-lg font-bold">지원자 예약 현황</h2>
        {interviews.length === 0 && <p className="p-5 text-sm text-slate-500">등록된 지원자 예약이 없습니다.</p>}
        {interviews.map((interview) => <article key={interview.id} className="space-y-3 border-t border-slate-100 p-5">
          <div className="flex items-center justify-between gap-3"><h3 className="font-bold">{interview.name}</h3><span className={`rounded-full px-3 py-1 text-xs ${interview.status === "confirmed" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{STATUS_LABELS[interview.status]}</span></div>
          <a href={`tel:${interview.phone}`} className="inline-flex min-h-11 items-center text-indigo-600">{interview.phone}</a>
          <p className="text-sm font-semibold">{formatDate(interview.interview_date)} · {interview.interview_time} (KST)</p>
          <p className="text-xs text-slate-500">등록: {formatCreatedAt(interview.created_at)}</p>
          {interview.status === "confirmed" && <CancelReservationButton id={interview.id} />}
        </article>)}
      </div>
      <div className="hidden overflow-x-auto md:block"><table className="w-full whitespace-nowrap text-left text-sm">
        <caption className="p-6 text-left text-lg font-bold">
          지원자 예약 현황 <span className="text-xs font-normal text-slate-500">· Supabase 실데이터</span>
        </caption>
        <thead className="border-y border-slate-100 bg-slate-50 text-slate-500">
          <tr>
            {["지원자", "연락처", "면접 일정 (KST)", "상태", "등록일"].map((label) => <th scope="col" key={label} className="px-6 py-4 font-medium">{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {interviews.length === 0 ? (
            <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">등록된 지원자 예약이 없습니다.</td></tr>
          ) : interviews.map((interview) => (
            <tr key={interview.id} className="border-b border-slate-100 last:border-0">
              <td className="px-6 py-5 font-medium text-slate-900">{interview.name}</td>
              <td className="px-6 py-5">{interview.email && <a href={`mailto:${interview.email}`} className="block text-indigo-600 hover:underline">{interview.email}</a>}<a href={`tel:${interview.phone}`} className="block text-slate-500 hover:text-slate-700">{interview.phone}</a></td>
              <td className="px-6 py-5">{formatDate(interview.interview_date)} · {interview.interview_time}</td>
              <td className="px-6 py-5"><span className={`rounded-full px-3 py-1 text-xs ${interview.status === "confirmed" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{STATUS_LABELS[interview.status]}</span></td>
              <td className="px-6 py-5 text-slate-500">{formatCreatedAt(interview.created_at)}{interview.status === "confirmed" && <CancelReservationButton id={interview.id} />}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}
