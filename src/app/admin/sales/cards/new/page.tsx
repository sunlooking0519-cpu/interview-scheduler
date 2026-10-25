import Link from "next/link";
import { SalesLeadCreator } from "@/features/admin/components/sales-lead-creator";
import { requireAdmin } from "@/server/admin-auth";

export const dynamic = "force-dynamic";

export default async function NewBusinessCardPage() {
  await requireAdmin();
  return <div className="space-y-6">
    <header className="rounded-3xl bg-slate-950 p-6 text-white sm:p-8">
      <Link href="/admin/sales/cards" className="text-sm font-semibold text-indigo-300">← 등록된 명함 목록</Link>
      <h1 className="mt-4 text-3xl font-bold">새 명함 등록</h1>
      <p className="mt-2 text-sm leading-6 text-slate-300">명함 사진을 읽은 뒤 기관과 담당자 정보를 확인해 등록합니다. 같은 기관명이 있으면 기존 기관에 담당자를 추가합니다.</p>
    </header>
    <SalesLeadCreator />
  </div>;
}
