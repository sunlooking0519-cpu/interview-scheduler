import { LoginForm } from "@/features/auth/components/login-form";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-lg py-6 md:py-12">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm md:p-10">
        <h1 className="text-2xl font-bold">지원자 로그인</h1>
        <p className="mt-2 text-sm text-slate-500">사용자 이름과 전화번호를 입력하고 면접 일정을 선택해 주세요.</p>
        <LoginForm />
      </section>
    </div>
  );
}
