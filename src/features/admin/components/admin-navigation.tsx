"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNavigation() {
  const pathname = usePathname();
  if (pathname === "/admin/login") return null;
  const links = [{ href: "/admin", text: "면접 관리" }, { href: "/admin/sales", text: "영업 관리" }];
  return <nav aria-label="관리자 메뉴" className="mb-6 flex gap-2">{links.map((link) => <Link key={link.href} href={link.href} aria-current={pathname === link.href || (link.href !== "/admin" && pathname.startsWith(`${link.href}/`)) ? "page" : undefined} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold aria-[current=page]:border-indigo-500 aria-[current=page]:text-indigo-700">{link.text}</Link>)}</nav>;
}
