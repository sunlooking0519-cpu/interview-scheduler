import { AdminLoginForm } from "@/features/admin/components/admin-login-form";
import Link from "next/link";

export default function AdminLoginPage() {
  return (
    <section className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm md:p-10">
      <p className="text-sm font-semibold text-indigo-600">HR WORKSPACE</p>
      <h1 className="mt-3 text-2xl font-bold">관리자 로그인</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">승인된 관리자 또는 강사 계정으로 로그인하세요.</p>
      <AdminLoginForm />
      <p className="mt-5 text-center text-sm text-slate-600">강사 계정이 없나요? <Link href="/admin/signup" className="font-semibold text-indigo-700">강사 회원가입</Link></p>
    </section>
  );
}
