import Link from "next/link";
import { BusinessCardRegistrationLauncher } from "@/features/admin/components/business-card-registration-launcher";
import { requireAdmin } from "@/server/admin-auth";

export const dynamic = "force-dynamic";

export default async function NewBusinessCardPage() {
  await requireAdmin();
  return <div className="space-y-6">
    <header className="rounded-3xl bg-slate-950 p-6 text-white sm:p-8">
      <Link href="/admin/sales/cards" className="text-sm font-semibold text-indigo-300">← 등록된 명함 목록</Link>
      <h1 className="mt-4 text-3xl font-bold">새 명함 등록</h1>
      <p className="mt-2 text-sm leading-6 text-slate-300">안드로이드 앱에서 사진을 촬영하고 인식 결과를 확인해 등록합니다.</p>
    </header>
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <p className="mb-4 text-sm text-slate-600">휴대폰에서는 아래 버튼으로 앱을 여세요. PC에서는 앱을 설치한 안드로이드 휴대폰에서 등록해 주세요.</p>
      <BusinessCardRegistrationLauncher compact label="앱에서 새 명함 등록" />
    </section>
  </div>;
}
