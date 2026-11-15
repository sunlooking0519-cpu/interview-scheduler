export default function AdminLoading() {
  return <div role="status" aria-live="polite" className="space-y-5">
    <span className="sr-only">관리자 화면을 불러오는 중입니다.</span>
    <div aria-hidden="true" className="h-32 animate-pulse rounded-3xl bg-slate-200 sm:h-40" />
    <div aria-hidden="true" className="grid gap-3 sm:grid-cols-3">
      <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
      <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
      <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
    </div>
    <div aria-hidden="true" className="h-64 animate-pulse rounded-2xl bg-slate-100" />
  </div>;
}
