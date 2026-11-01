"use client";

import { useActionState } from "react";
import { registerInstructor } from "@/app/admin/signup/actions";

const initial = { error: "", success: false };

export function InstructorSignupForm() {
  const [state, action, pending] = useActionState(registerInstructor, initial);
  if (state.success) return <p role="status" className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">가입 요청을 접수했습니다. 이메일 확인을 마친 뒤 최고관리자의 승인을 기다려 주세요. 승인 후 면접관리와 채용 기능에 로그인할 수 있습니다.</p>;
  return <form action={action} className="mt-6 space-y-4">
    <label className="block text-sm font-medium">이름<input name="name" required maxLength={80} autoComplete="name" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"/></label>
    <label className="block text-sm font-medium">예약 시 입력한 휴대전화<input name="phone" type="tel" required maxLength={20} autoComplete="tel" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"/></label>
    <label className="block text-sm font-medium">이메일<input name="email" type="email" required maxLength={254} autoComplete="email" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"/></label>
    <label className="block text-sm font-medium">비밀번호<input name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"/></label>
    {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
    <button disabled={pending} className="w-full rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white disabled:bg-slate-300">{pending ? "요청 중..." : "관리자 권한요청"}</button>
  </form>;
}
