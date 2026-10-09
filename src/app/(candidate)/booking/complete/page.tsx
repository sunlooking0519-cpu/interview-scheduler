import Link from "next/link";
import { isBookingDate } from "@/features/booking/dates";
import { ALL_TIMES } from "@/features/booking/time-slots";
import { formatInterviewDate } from "@/lib/date";

export default async function CompletePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const valid = typeof params.date === "string" && isBookingDate(params.date) && typeof params.time === "string" && ALL_TIMES.includes(params.time);
  return (
    <section className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white px-5 py-8 text-center shadow-sm sm:p-10">
      <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-indigo-50 text-3xl text-indigo-600" aria-hidden="true">{valid ? "✓" : "—"}</div>
      <p className="text-sm font-semibold text-indigo-600">STEP 03 / 03</p>
      <h1 className="mt-3 text-2xl font-bold">{valid ? "면접 예약이 완료되었습니다" : "선택한 일정이 없습니다"}</h1>
      <p className="mt-4 text-sm leading-7 text-slate-500">{valid ? "지원해 주셔서 감사합니다. 아래 일정으로 면접 예약이 저장되었습니다." : "일정 선택 화면에서 날짜와 시간을 선택해 주세요."}</p>
      {valid && <>
        <div className="my-7 rounded-xl bg-slate-50 p-5 text-sm leading-8">
          <p className="font-semibold">{formatInterviewDate(params.date as string)}</p>
          <p>{params.time} · 30분 · 한국 표준시</p>
          <p className="text-slate-500">온라인 면접</p>
        </div>
        <p className="mb-5 text-sm leading-6 text-slate-500">예약 절차가 모두 끝났습니다.<br />이 화면을 닫아도 예약은 유지됩니다.</p>
      </>}
      <Link href={valid ? "/" : "/booking"} className="mt-2 flex min-h-12 w-full items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">{valid ? "확인 완료" : "일정 선택하기"}</Link>
      {valid && <Link href="/login" className="mt-3 inline-flex min-h-11 items-center px-3 text-sm text-slate-500 underline underline-offset-4 hover:text-indigo-600">예약 확인·변경이 필요하신가요?</Link>}
    </section>
  );
}
