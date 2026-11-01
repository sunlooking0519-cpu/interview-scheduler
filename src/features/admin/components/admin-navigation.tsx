"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAdmin } from "@/app/admin/actions";

export function AdminNavigation({ role }: { role: string }) {
  const pathname = usePathname();
  if (pathname === "/admin/login" || pathname === "/admin/signup") return null;
  const links = [
    { href: "/admin", text: "면접 관리", active: pathname === "/admin" },
    ...(["admin", "super_admin"].includes(role) ? [
      { href: "/admin/sales", text: "영업 관리", active: pathname === "/admin/sales" || (pathname.startsWith("/admin/sales/") && !pathname.startsWith("/admin/sales/cards")) },
      { href: "/admin/sales/cards", text: "명함 관리", active: pathname.startsWith("/admin/sales/cards") },
      { href: "/admin/members", text: "강사 관리", active: pathname.startsWith("/admin/members") },
    ] : []),
  ];
  return <nav aria-label="관리자 메뉴" className="mb-6 flex flex-wrap items-center gap-2">{links.map((link) => <Link key={link.href} href={link.href} aria-current={link.active ? "page" : undefined} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold aria-[current=page]:border-indigo-500 aria-[current=page]:text-indigo-700">{link.text}</Link>)}<form action={logoutAdmin} className="ml-auto"><button type="submit" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">로그아웃</button></form></nav>;
}
