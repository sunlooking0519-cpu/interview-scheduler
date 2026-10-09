import Link from "next/link";
import { isBookingDate } from "@/features/booking/dates";
import { ALL_TIMES } from "@/features/booking/time-slots";
import { formatInterviewDate } from "@/lib/date";

export default async function CompletePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const valid = typeof params.date === "string" && isBookingDate(params.date) && typeof params.time === "string" && ALL_TIMES.includes(params.time);
  return <section className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm"><div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-indigo-50 text-3xl text-indigo-600" aria-hidden="true">{valid ? "✓" : "—"}</div><p className="text-sm font-semibold text-indigo-600">STEP 03 / 03</p><h1 className="mt-3 text-2xl font-bold">{valid ? "예약이 완료되었습니다" : "선택한 일정이 없습니다"}</h1><p className="mt-4 text-sm leading-7 text-slate-500">{valid ? "면접 예약 정보가 정상적으로 저장되었습니다." : "일정 선택 화면에서 날짜와 시간을 선택해 주세요."}</p>{valid && <div className="my-7 rounded-xl bg-slate-50 p-5 text-sm leading-8"><p className="font-semibold">{formatInterviewDate(params.date as string)}</p><p>{params.time} · 30분 · 한국 표준시</p><p className="text-slate-500">온라인 면접</p></div>}<Link href="/booking" className="mt-6 inline-block rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white">일정 다시 선택하기</Link></section>;
}
