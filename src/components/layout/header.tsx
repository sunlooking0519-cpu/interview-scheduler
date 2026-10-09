"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function Header() {
  const router = useRouter();
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-end px-4 py-3 md:px-6 md:py-5">
        <nav aria-label="주 메뉴" className="flex items-center gap-5 text-sm">
          <Link href="/login" className="inline-flex min-h-11 items-center text-slate-600 hover:text-indigo-600">지원자</Link>
          <button type="button" title="더블클릭으로 관리자 페이지 열기" aria-label="관리자, 더블클릭으로 열기" onDoubleClick={() => router.push("/admin")} onClick={(event) => { if (event.detail === 0) router.push("/admin"); }} className="text-slate-600 hover:text-indigo-600">관리자</button>
        </nav>
      </div>
    </header>
  );
}
