"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();

  return (
    <form className="mt-8 space-y-5" onSubmit={(event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      sessionStorage.setItem("candidate", JSON.stringify({
        name: String(formData.get("name") ?? "").trim(),
        phone: String(formData.get("phone") ?? "").trim(),
      }));
      const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
      router.push(submitter?.value === "review" ? "/application" : "/booking");
    }}>
      <label htmlFor="candidate-name" className="block text-sm font-medium">사용자 이름<input id="candidate-name" name="name" type="text" autoComplete="name" required maxLength={60} placeholder="사용자 이름을 입력해 주세요" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
      <label htmlFor="candidate-phone" className="block text-sm font-medium">전화번호<input id="candidate-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required minLength={8} maxLength={20} pattern="[0-9+() -]{8,20}" placeholder="010-1234-5678" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
      <Button type="submit" className="w-full">면접 예약하기</Button>
      <button type="submit" name="intent" value="review" className="w-full rounded-xl border border-indigo-200 bg-white px-5 py-3 text-sm font-semibold text-indigo-600 hover:bg-indigo-50">지원서 확인·수정</button>
      <p className="text-xs leading-6 text-slate-500">입력한 정보는 예약 확정 시 면접 일정과 함께 안전하게 저장됩니다.</p>
    </form>
  );
}
