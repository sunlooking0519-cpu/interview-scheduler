import { Header } from "@/components/layout/header";

export default function CandidateLayout({ children }: { children: React.ReactNode }) {
  return <><Header /><main className="mx-auto max-w-6xl px-6 py-12 md:py-16">{children}</main><footer className="px-6 pb-8 text-center text-xs text-slate-500">Meetly · 더 좋은 만남의 시작</footer></>;
}
