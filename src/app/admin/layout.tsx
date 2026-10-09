import { Header } from "@/components/layout/header";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <><Header /><main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-12">{children}</main></>;
}
