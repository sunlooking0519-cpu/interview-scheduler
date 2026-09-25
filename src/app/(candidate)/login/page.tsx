import { LoginForm } from "@/features/auth/components/login-form";

export default function LoginPage() {
  return (
    <div className="grid items-center gap-12 py-6 md:grid-cols-2 md:py-12">
      <section>
        <p className="mb-5 text-sm font-semibold tracking-widest text-indigo-600">YOUR NEXT CHAPTER</p>
        <h1 className="text-4xl leading-tight font-bold tracking-tight md:text-5xl">새로운 시작,<br />당신의 시간에 맞춰.</h1>
        <p className="mt-6 max-w-md leading-8 text-slate-500">면접 초대를 받으셨나요?<br />가능한 날짜와 시간을 선택하고 면접을 준비해 보세요.</p>
        <ol className="mt-10 flex flex-wrap gap-5 text-sm text-slate-600"><li>01 · 지원자 확인</li><li>02 · 일정 선택</li><li>03 · 예약 완료</li></ol>
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm md:p-10">
        <h2 className="text-2xl font-bold">지원자 로그인</h2>
        <p className="mt-2 text-sm text-slate-500">입력 양식과 화면 이동을 체험해 보세요.</p>
        <LoginForm />
      </section>
    </div>
  );
}
