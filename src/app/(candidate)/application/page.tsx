import { ApplicationReview } from "@/features/booking/components/application-review";

export default function ApplicationPage() {
  return <section className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8">
    <h1 className="text-2xl font-bold">지원서 확인·수정</h1>
    <p className="mt-2 text-sm text-slate-500">예약할 때 입력한 이름과 전화번호가 모두 일치하는 예약을 확인하고 면접 일정을 수정하세요.</p>
    <ApplicationReview />
  </section>;
}
