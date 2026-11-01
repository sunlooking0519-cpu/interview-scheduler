import { AdminLoginForm } from "@/features/admin/components/admin-login-form";
import Link from "next/link";

export default function AdminLoginPage() {
  return (
    <section className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm md:p-10">
      <p className="text-sm font-semibold text-indigo-600">HR WORKSPACE</p>
      <h1 className="mt-3 text-2xl font-bold">관리자 로그인</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">승인된 관리자 또는 강사 계정으로 로그인하세요.</p>
      <AdminLoginForm />
      <Link href="/admin/signup" className="mt-5 block rounded-xl border border-indigo-200 px-5 py-3 text-center text-sm font-semibold text-indigo-700 hover:bg-indigo-50">관리자 권한요청</Link>
    </section>
  );
}
