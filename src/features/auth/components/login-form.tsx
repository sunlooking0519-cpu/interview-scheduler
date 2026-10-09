"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { findCandidateReservations } from "@/app/(candidate)/application/actions";

export function LoginForm() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const formData = new FormData(event.currentTarget);
    const candidate = {
      name: String(formData.get("name") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
    };
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const isReview = submitter?.value === "review";
    submitting.current = true;
    setIsPending(true);
    setError("");
    try {
      if (isReview) {
        const result = await findCandidateReservations(candidate);
        if (result.error) { setError(result.error); return; }
        if (result.data.length === 0) {
          setError("면접예약 정보를 찾을 수 없습니다. 이름과 전화번호를 확인해주세요.");
          return;
        }
      }
      sessionStorage.setItem("candidate", JSON.stringify(candidate));
      router.push(isReview ? "/application" : "/booking");
    } catch {
      setError("요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      submitting.current = false;
      setIsPending(false);
    }
  }

  return (
    <form className="mt-8 space-y-5" aria-busy={isPending} onChange={() => setError("")} onSubmit={handleSubmit}>
      <label htmlFor="candidate-name" className="block text-sm font-medium">사용자 이름<input id="candidate-name" name="name" type="text" autoComplete="name" required maxLength={60} placeholder="사용자 이름을 입력해 주세요" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
      <label htmlFor="candidate-phone" className="block text-sm font-medium">전화번호<input id="candidate-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required minLength={8} maxLength={20} pattern="[0-9+() -]{8,20}" placeholder="010-1234-5678" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
      <Button type="submit" disabled={isPending} className="w-full">면접 예약하기</Button>
      <button type="submit" name="intent" value="review" disabled={isPending} className="w-full rounded-xl border border-indigo-200 bg-white px-5 py-3 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50">{isPending ? "확인 중..." : "지원서 확인·수정"}</button>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <p className="text-xs leading-6 text-slate-500">입력한 정보는 예약 확정 시 면접 일정과 함께 안전하게 저장됩니다.</p>
    </form>
  );
}
