import { logoutAdmin } from "@/app/admin/actions";
import { BookingTable } from "@/features/admin/components/booking-table";
import { requireSuperAdmin } from "@/server/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await requireSuperAdmin();

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-sm font-semibold text-indigo-600">HR WORKSPACE</p>
          <h1 className="mt-3 text-3xl font-bold">면접 관리 대시보드</h1>
          <p className="mt-3 text-slate-500">{admin.name} 최고 관리자님, 지원자의 일정 선택 현황을 확인하세요.</p>
        </div>
        <form action={logoutAdmin}>
          <button type="submit" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">로그아웃</button>
        </form>
      </div>
      <div className="my-8 grid gap-4 sm:grid-cols-3">
        {[["전체 지원자", "3"], ["예약 확정", "2"], ["예약 대기", "1"]].map(([label, count]) => <section key={label} className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-sm text-slate-500">{label}</h2><p className="mt-3 text-3xl font-bold">{count}<span className="ml-2 text-sm font-normal text-slate-400">명</span></p></section>)}
      </div>
      <BookingTable />
    </>
  );
}