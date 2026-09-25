import { Header } from "@/components/layout/header";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <><Header /><main className="mx-auto max-w-6xl px-6 py-12">{children}</main></>;
}
