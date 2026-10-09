"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createInterview } from "@/app/(candidate)/booking/actions";
import { BookingCalendar } from "@/features/booking/components/booking-calendar";
import { AvailableTimeButtons } from "@/features/booking/components/available-time-buttons";
import { formatInterviewDate } from "@/lib/date";
import { createClient } from "../../../../lib/supabase/client";
import { prepareResumeUpload } from "@/app/(candidate)/booking/resume-actions";
import { RESUME_TYPES, resumeError } from "@/features/booking/resume";

type Candidate = { name: string; phone: string };

export function BookingPicker() {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [resume, setResume] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();
  const busy = useRef(false);

  async function handleBooking() {
    if (busy.current) return;
    setErrorMessage("");

    let candidate: Candidate | null = null;
    try {
      candidate = JSON.parse(sessionStorage.getItem("candidate") ?? "null") as Candidate | null;
    } catch {
      candidate = null;
    }

    if (typeof candidate?.name !== "string" || !candidate.name.trim() || typeof candidate.phone !== "string" || !candidate.phone.trim()) {
      setErrorMessage("지원자 정보가 없습니다. 로그인 화면에서 정보를 다시 입력해 주세요.");
      return;
    }

    busy.current = true;
    setIsSubmitting(true);
    try {
    let ticket: string | undefined;
    if (resume) {
      const validation = resumeError(resume.name, resume.size);
      if (validation) { setErrorMessage(validation); return; }
      setUploading(true);
      const prepared = await prepareResumeUpload({ ...candidate, fileName: resume.name, size: resume.size });
      if (prepared.error || !prepared.path || !prepared.token || !prepared.ticket) { setErrorMessage(prepared.error || "업로드를 준비하지 못했습니다."); return; }
      const extension = resume.name.split(".").pop()!.toLowerCase();
      const { error } = await createClient().storage.from("resumes").uploadToSignedUrl(prepared.path, prepared.token, resume, { contentType: RESUME_TYPES[extension] });
      if (error) { setErrorMessage("이력서 업로드에 실패했습니다. 파일 형식과 용량을 확인하고 다시 시도해 주세요."); return; }
      ticket = prepared.ticket;
      setUploading(false);
    }
    const result = await createInterview({
      name: candidate.name,
      phone: candidate.phone,
      interviewDate: date,
      interviewTime: time,
      resumeTicket: ticket,
    });

    if (!result.success) {
      setErrorMessage(result.message);
      return;
    }

    sessionStorage.removeItem("candidate");
    router.push(`/booking/complete?${new URLSearchParams({ date, time })}`);
    } catch {
      setErrorMessage("예약을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      busy.current = false;
      setIsSubmitting(false);
      setUploading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-8">
        <BookingCalendar selected={date} disabled={isSubmitting} onSelect={(value) => { setDate(value); setTime(""); setErrorMessage(""); }} />
        <fieldset className="mt-8" disabled={!date || isSubmitting}>
          <legend className="font-semibold">면접 시간 <span className="text-xs font-normal text-slate-500">· 30분</span></legend>
          <p className="mt-2 text-sm text-slate-500">{date ? formatInterviewDate(date) : "먼저 예약 가능한 날짜를 선택해 주세요."}</p>
          <AvailableTimeButtons date={date} selected={time} disabled={isSubmitting} onSelect={(value) => { setTime(value); setErrorMessage(""); }} />
        </fieldset>
      </section>
      <aside className="self-start rounded-2xl border border-slate-200 bg-white p-5 md:p-7">
        <p className="text-xs font-semibold tracking-widest text-indigo-600">INTERVIEW</p><h2 className="mt-3 text-xl font-bold">선택한 면접 일정</h2>
        <dl className="my-7 space-y-5 text-sm"><div><dt className="text-slate-500">진행 방식</dt><dd className="mt-1 font-medium">온라인 면접 · 30분</dd></div><div><dt className="text-slate-500">날짜</dt><dd className="mt-1 font-medium">{date ? formatInterviewDate(date) : "선택 전"}</dd></div><div><dt className="text-slate-500">시간</dt><dd className="mt-1 font-medium">{time ? `${time} (KST)` : "선택 전"}</dd></div></dl>
        <div className="mb-5">
          <label htmlFor="resume" className="block text-sm font-semibold">이력서 첨부 <span className="font-normal text-slate-500">(선택)</span></label>
          <input id="resume" type="file" accept=".pdf,.doc,.docx" disabled={isSubmitting} aria-describedby="resume-help" className="mt-3 block w-full min-w-0 text-sm file:mr-2 file:min-h-11 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:text-indigo-700" onChange={(event) => { const file = event.target.files?.[0] ?? null; const error = file ? resumeError(file.name, file.size) : ""; setErrorMessage(error); setResume(error ? null : file); if (error) event.target.value = ""; }} />
          <p id="resume-help" className="mt-2 text-xs leading-5 text-slate-500">PDF, Word(.doc, .docx) · 최대 5MB. 첨부 파일은 다운로드 링크로 공유되며 링크를 아는 사람은 열 수 있습니다.</p>
          {resume && <button type="button" disabled={isSubmitting} className="mt-2 min-h-11 text-sm text-slate-500" onClick={() => { setResume(null); const input = document.getElementById("resume") as HTMLInputElement; input.value = ""; }}>첨부 제거</button>}
        </div>
        <Button disabled={!date || !time || isSubmitting} className="w-full" onClick={handleBooking}>{uploading ? "이력서 업로드 중..." : isSubmitting ? "예약 저장 중..." : "예약 확정하기"}</Button>
        {errorMessage && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-700">{errorMessage}</p>}
      </aside>
    </div>
  );
}
