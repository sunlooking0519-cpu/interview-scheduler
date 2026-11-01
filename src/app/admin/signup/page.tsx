import Link from "next/link";
import { InstructorSignupForm } from "@/features/admin/components/instructor-signup-form";

export default function InstructorSignupPage() {
  return <section className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm md:p-10"><p className="text-sm font-semibold text-indigo-600">HR WORKSPACE</p><h1 className="mt-3 text-2xl font-bold">관리자 권한요청</h1><p className="mt-2 text-sm leading-6 text-slate-600">채용된 강사는 예약할 때 사용한 이름과 휴대전화를 입력해 채용 기록을 연결하세요. 확인 메일 없이 신청되며, 최고관리자가 신청자를 확인한 뒤 승인하면 면접·채용 권한이 부여됩니다.</p><InstructorSignupForm/><Link href="/admin/login" className="mt-5 block text-center text-sm font-semibold text-indigo-700">로그인으로 돌아가기</Link></section>;
}
