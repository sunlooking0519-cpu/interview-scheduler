import { logoutAdmin } from "@/app/admin/actions";
import { BookingTable } from "@/features/admin/components/booking-table";
import { requireAdmin } from "@/server/admin-auth";
import { getInterviewReservations, type InterviewReservation } from "@/server/interviews";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { user } = await requireAdmin();
  let interviews: InterviewReservation[] = [];
  let loadError = "";

  try {
    interviews = await getInterviewReservations();
  } catch (error) {
    console.error("Admin dashboard load failed", error);
    loadError = "예약 데이터를 불러오지 못했습니다. scheduler 스키마의 API 노출 및 관리자 조회 권한을 확인해 주세요.";
  }

  const confirmedCount = interviews.filter(({ status }) => status === "confirmed").length;
  const cancelledCount = interviews.filter(({ status }) => status === "cancelled").length;
  const stats = [
    ["전체 예약", interviews.length],
    ["예약 확정", confirmedCount],
    ["예약 취소", cancelledCount],
  ] as const;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-sm font-semibold text-indigo-600">HR WORKSPACE</p>
          <h1 className="mt-3 text-3xl font-bold">면접 관리 대시보드</h1>
          <p className="mt-3 text-slate-500">{user.email} 관리자님, 지원자의 일정 선택 현황을 확인하세요.</p>
        </div>
        <form action={logoutAdmin}>
          <button type="submit" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">로그아웃</button>
        </form>
      </div>
      {loadError && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{loadError}</p>}
      <div className="my-8 grid gap-4 sm:grid-cols-3">
        {stats.map(([label, count]) => <section key={label} className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-sm text-slate-500">{label}</h2><p className="mt-3 text-3xl font-bold">{count}<span className="ml-2 text-sm font-normal text-slate-400">건</span></p></section>)}
      </div>
      <BookingTable interviews={interviews} />
    </>
  );
}
