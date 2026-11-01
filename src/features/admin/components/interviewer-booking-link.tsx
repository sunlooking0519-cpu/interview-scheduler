"use client";

import { useState } from "react";

export function InterviewerBookingLink({ managerId }: { managerId: string }) {
  const [message, setMessage] = useState("");
  const path = `/login?manager=${encodeURIComponent(managerId)}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).href);
      setMessage("전용 예약 링크를 복사했습니다.");
    } catch { setMessage("링크를 복사하지 못했습니다. 아래 주소를 직접 복사해 주세요."); }
  }
  return <section className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 sm:p-5">
    <h2 className="font-bold text-indigo-900">내 면접 예약 링크</h2>
    <p className="mt-1 text-sm text-indigo-800">이 링크로 들어온 지원자만 내 면접관리 화면에 표시됩니다.</p>
    <div className="mt-3 flex flex-wrap items-center gap-2"><a href={path} className="min-w-0 break-all text-sm text-indigo-700 underline">내 전용 예약 페이지 열기</a><button type="button" onClick={() => void copy()} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">링크 복사</button></div>
    {message && <p role="status" className="mt-2 text-sm text-indigo-800">{message}</p>}
  </section>;
}
