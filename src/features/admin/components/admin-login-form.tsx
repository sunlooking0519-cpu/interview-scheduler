"use client";

import { useActionState } from "react";
import { loginAdmin, type AdminLoginState } from "@/app/admin/actions";

const initialState: AdminLoginState = { error: "" };

export function AdminLoginForm() {
  const [state, formAction, isPending] = useActionState(loginAdmin, initialState);

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <label htmlFor="admin-name" className="block text-sm font-medium">
        이름
        <input id="admin-name" name="name" type="text" autoComplete="username" required maxLength={60} placeholder="김경희" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" />
      </label>
      <label htmlFor="admin-password" className="block text-sm font-medium">
        비밀번호
        <input id="admin-password" name="password" type="password" autoComplete="current-password" required minLength={8} maxLength={128} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" />
      </label>
      {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      <button type="submit" disabled={isPending} className="w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300">
        {isPending ? "인증 중..." : "관리자 로그인"}
      </button>
    </form>
  );
}