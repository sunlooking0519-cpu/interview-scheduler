import { LoginForm } from "@/features/auth/components/login-form";
import { validInterviewerId } from "@/features/booking/interview-owner";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ manager?: string }> }) {
  const { manager } = await searchParams;
  const invalidLink = manager !== undefined && !validInterviewerId(manager);
  return (
    <div className="mx-auto max-w-lg py-6 md:py-12">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-10">
        <h1 className="text-2xl font-bold">지원하기</h1>
        <p className="mt-2 text-sm text-slate-500">진행할 항목을 선택해주세요.</p>
        {invalidLink ? <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">면접 담당자 링크가 올바르지 않습니다.</p> : <LoginForm managerId={manager} />}
      </section>
    </div>
  );
}
