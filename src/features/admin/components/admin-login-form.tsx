"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { loginAdmin, type AdminLoginState } from "@/app/admin/actions";

const initialState: AdminLoginState = { error: "" };

export function AdminLoginForm() {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [isPending, setIsPending] = useState(false);
  const submitting = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const formData = new FormData(event.currentTarget);
    submitting.current = true;
    setIsPending(true);
    setState(initialState);

    try {
      const result = await loginAdmin(initialState, formData);
      if (result.success) {
        // The Server Action has written the session cookies before navigation.
        router.push("/admin");
        router.refresh();
        return;
      }
      setState(result);
    } catch {
      setState({ error: "인증 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요." });
    }
    submitting.current = false;
    setIsPending(false);
  }

  return (
    <form onSubmit={handleSubmit} aria-busy={isPending} className="mt-8 space-y-5 [&_input]:text-base">
      <label htmlFor="admin-email" className="block text-sm font-medium">
        이메일(E-mail)
        <input id="admin-email" name="email" type="email" autoComplete="username" required maxLength={254} placeholder="admin@example.com" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" />
      </label>
      <label htmlFor="admin-password" className="block text-sm font-medium">
        비밀번호
        <input id="admin-password" name="password" type="password" autoComplete="current-password" required maxLength={128} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" />
      </label>
      {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      <button type="submit" disabled={isPending} className="w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300">
        {isPending ? "로그인 중..." : "관리자 로그인"}
      </button>
    </form>
  );
}
