"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();
  return (
    <form className="mt-8 space-y-5" onSubmit={(event) => { event.preventDefault(); router.push("/booking"); }}>
      <label htmlFor="candidate-name" className="block text-sm font-medium">사용자 이름<input id="candidate-name" name="name" type="text" autoComplete="name" required maxLength={60} placeholder="사용자 이름을 입력해 주세요" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
      <label htmlFor="candidate-phone" className="block text-sm font-medium">전화번호<input id="candidate-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required maxLength={20} placeholder="010-1234-5678" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
      <label className="block text-sm font-medium">이메일<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
      <Button type="submit" className="w-full">일정 선택</Button>
      <p className="text-xs leading-6 text-slate-500">데모에서는 본인 인증을 하지 않으며 입력 정보도 저장하지 않습니다. 실제 로그인은 추후 초대 링크 인증으로 연결할 예정입니다.</p>
    </form>
  );
}
