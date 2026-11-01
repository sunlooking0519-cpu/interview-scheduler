import Link from "next/link";
import { InstructorSignupForm } from "@/features/admin/components/instructor-signup-form";

export default function InstructorSignupPage() {
  return <section className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm md:p-10"><p className="text-sm font-semibold text-indigo-600">HR WORKSPACE</p><h1 className="mt-3 text-2xl font-bold">강사 회원가입</h1><p className="mt-2 text-sm leading-6 text-slate-600">가입 후 이메일을 확인하고 관리자의 승인을 받으면 면접관리 화면을 사용할 수 있습니다.</p><InstructorSignupForm/><Link href="/admin/login" className="mt-5 block text-center text-sm font-semibold text-indigo-700">로그인으로 돌아가기</Link></section>;
}
