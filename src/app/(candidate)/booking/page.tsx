import { BookingPicker } from "@/features/booking/components/booking-picker";

export default function BookingPage() {
  return <><p className="text-sm font-semibold text-indigo-600">STEP 02 / 03</p><h1 className="mt-3 text-3xl font-bold">편한 면접 시간을 선택해 주세요</h1><p className="mt-3 mb-8 text-slate-500">아래는 예시 일정입니다. 모든 시간은 한국 표준시(KST) 기준입니다.</p><BookingPicker /></>;
}
