import { AdminLoginForm } from "@/features/admin/components/admin-login-form";

export default function AdminLoginPage() {
  return (
    <section className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm md:p-10">
      <p className="text-sm font-semibold text-indigo-600">HR WORKSPACE</p>
      <h1 className="mt-3 text-2xl font-bold">관리자 로그인</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">등록된 최고 관리자 이름과 비밀번호를 입력해 주세요.</p>
      <AdminLoginForm />
    </section>
  );
}