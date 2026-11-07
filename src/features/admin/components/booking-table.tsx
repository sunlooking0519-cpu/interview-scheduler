"use client";

import { useState } from "react";
import type { InterviewReservation } from "@/server/interviews";
import { CancelReservationButton } from "@/features/booking/components/cancel-reservation-button";
import { HiringButton } from "./hiring-button";

type ListStatus = InterviewReservation["status"] | "hired";
const STATUS_LABELS: Record<ListStatus, string> = {
  confirmed: "확정",
  cancelled: "취소",
  hired: "채용",
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

function ResumeLink({ url, compact = false }: { url?: string | null; compact?: boolean }) {
  if (!url) return <span className="text-xs text-slate-400">이력서 미첨부</span>;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || !url.startsWith(`${base.replace(/\/$/, "")}/storage/v1/object/public/resumes/uploads/`)) return <span className="text-xs text-red-600">파일 경로 확인 필요</span>;
  return <a href={url} target="_blank" rel="noopener noreferrer" aria-label="이력서 보기 / 다운로드" className={`inline-flex min-h-11 items-center justify-center rounded-lg border border-indigo-200 px-3 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 ${compact ? "w-full" : ""}`}>{compact ? "이력서 보기" : "이력서 보기 / 다운로드"}</a>;
}

export function BookingTable({ interviews, hiringEnabled = true, initialStatus = "confirmed" }: { interviews: InterviewReservation[]; hiringEnabled?: boolean; initialStatus?: ListStatus }) {
  const [status, setStatus] = useState<ListStatus>(initialStatus);
  const belongsTo = (row: InterviewReservation, value: ListStatus) => value === "hired" ? row.status === "confirmed" && !!row.hired_at : row.status === value && (value !== "confirmed" || !row.hired_at);
  const visible = interviews.filter((row) => belongsTo(row, status));
  const emptyMessage = status === "confirmed" ? "확정된 예약이 없습니다." : status === "hired" ? "채용된 지원자가 없습니다." : "취소된 예약이 없습니다.";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-3 sm:p-5">
        <h2 className="mb-3 text-lg font-bold">지원자 예약 현황</h2>
        <div role="group" aria-label="예약 상태별 목록" className={`grid gap-2 ${hiringEnabled ? "grid-cols-3" : "grid-cols-2"}`}>
          {(["confirmed", "cancelled", ...(hiringEnabled ? ["hired" as const] : [])] as const).map((value) => <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)} className={`flex min-h-12 items-center justify-center gap-1 rounded-xl border px-2 text-xs font-semibold transition sm:gap-2 sm:text-sm ${status === value ? value === "confirmed" ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-700 bg-slate-700 text-white" : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"}`}>
            {value === "hired" ? "채용" : `예약 ${STATUS_LABELS[value]}`}<span className={`rounded-full px-2 py-0.5 text-xs ${status === value ? "bg-white/20" : "bg-white text-slate-700"}`}>{interviews.filter((row) => belongsTo(row, value)).length}명</span>
          </button>)}
        </div>
        <p aria-live="polite" className="sr-only">예약 {STATUS_LABELS[status]} {visible.length}명</p>
      </div>
      <div className="xl:hidden">
        {visible.length === 0 && <p className="p-5 text-sm text-slate-500">{emptyMessage}</p>}
        <div className="grid grid-cols-2 gap-2 p-3">{visible.map((interview) => <article key={`${status}-${interview.id}`} className="min-w-0 rounded-xl border border-slate-200 p-3">
          <h3 className="break-words text-sm font-bold text-slate-900">{interview.name}</h3>
          <a href={`tel:${interview.phone}`} className="flex min-h-11 items-center break-all text-xs text-indigo-600">{interview.phone}</a>
          <p className="text-xs text-slate-500">{new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" }).format(new Date(`${interview.interview_date}T00:00:00+09:00`))}</p>
          <p className="mb-3 mt-1 text-lg font-bold">{interview.interview_time}<span className="ml-1 text-[10px] font-normal text-slate-500">KST</span></p>
          <div><ResumeLink url={interview.resume_url} compact /></div>
          {status === "confirmed" && <div className="mt-2 flex flex-wrap gap-2">{hiringEnabled && <HiringButton id={interview.id} hired={false}/>}<CancelReservationButton id={interview.id} /></div>}
          {status === "hired" && <HiringButton id={interview.id} hired/>}
        </article>)}</div>
      </div>
      <div className="hidden xl:block"><table className="w-full table-fixed text-left text-sm">
        <caption className="p-6 text-left text-lg font-bold">
          예약 {STATUS_LABELS[status]} 목록
        </caption>
        <thead className="border-y border-slate-100 bg-slate-50 text-slate-500">
          <tr>
            {["지원자", "연락처", "면접 일정 (KST)", "상태", "이력서", "등록일 · 관리"].map((label) => <th scope="col" key={label} className="break-words px-3 py-4 font-medium">{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 ? (
            <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">{emptyMessage}</td></tr>
          ) : visible.map((interview) => (
            <tr key={`${status}-${interview.id}`} className="border-b border-slate-100 last:border-0">
              <td className="break-words px-3 py-5 font-medium text-slate-900">{interview.name}</td>
              <td className="break-all px-3 py-5">{interview.email && <a href={`mailto:${interview.email}`} className="block text-indigo-600 hover:underline">{interview.email}</a>}<a href={`tel:${interview.phone}`} className="block text-slate-500 hover:text-slate-700">{interview.phone}</a></td>
              <td className="px-3 py-5">{formatDate(interview.interview_date)} · {interview.interview_time}</td>
              <td className="px-3 py-5"><span className={`rounded-full px-3 py-1 text-xs ${status === "confirmed" ? "bg-emerald-50 text-emerald-700" : status === "hired" ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600"}`}>{STATUS_LABELS[status]}</span></td>
              <td className="px-3 py-5"><ResumeLink url={interview.resume_url} /></td>
              <td className="px-3 py-5 text-slate-500">{formatCreatedAt(interview.created_at)}{status === "confirmed" && <div className="flex flex-wrap items-start gap-2">{hiringEnabled && <HiringButton id={interview.id} hired={false}/>}<CancelReservationButton id={interview.id}/></div>}{status === "hired" && <><p className="mt-1 text-xs">채용 {formatCreatedAt(interview.hired_at!)}</p><HiringButton id={interview.id} hired/></>}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}
