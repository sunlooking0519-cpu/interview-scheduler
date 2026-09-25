import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/login" className="text-2xl font-black tracking-tight text-indigo-600">meetly<span className="text-slate-300">.</span></Link>
        <nav aria-label="주 메뉴" className="flex items-center gap-5 text-sm">
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">데모</span>
          <Link href="/login" className="text-slate-600 hover:text-indigo-600">지원자</Link>
          <Link href="/admin" className="text-slate-600 hover:text-indigo-600">HR 대시보드</Link>
        </nav>
      </div>
    </header>
  );
}
