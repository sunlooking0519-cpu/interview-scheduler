import { Header } from "@/components/layout/header";

export default function CandidateLayout({ children }: { children: React.ReactNode }) {
  return <><Header /><main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-16">{children}</main><footer className="px-4 pb-8 text-center text-xs text-slate-500">Meetly · 더 좋은 만남의 시작</footer></>;
}
