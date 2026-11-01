import { BookingPicker } from "@/features/booking/components/booking-picker";
import { validInterviewerId } from "@/features/booking/interview-owner";

export default async function BookingPage({ searchParams }: { searchParams: Promise<{ manager?: string }> }) {
  const { manager } = await searchParams;
  if (manager !== undefined && !validInterviewerId(manager)) return <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">면접 담당자 링크가 올바르지 않습니다.</p>;
  return <><p className="text-sm font-semibold text-indigo-600">STEP 02 / 03</p><h1 className="mt-3 text-2xl font-bold md:text-3xl">편한 면접 시간을 선택해 주세요</h1><p className="mt-3 mb-6 text-sm text-slate-500 md:mb-8 md:text-base">예약 가능한 날짜와 시간을 선택하세요. 한국 표준시(KST) 기준입니다.</p><BookingPicker ownerId={manager} /></>;
}
