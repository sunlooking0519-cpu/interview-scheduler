import { Header } from "@/components/layout/header";
import { AdminNavigation } from "@/features/admin/components/admin-navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <><Header /><main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-12"><AdminNavigation />{children}</main></>;
}
