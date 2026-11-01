import { Header } from "@/components/layout/header";
import { AdminNavigation } from "@/features/admin/components/admin-navigation";
import { createClient } from "../../../lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let role = "";
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    role = String(user?.app_metadata.role ?? "");
  } catch { /* Login and signup also render inside this layout. */ }
  return <><Header /><main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-12"><AdminNavigation role={role} />{children}</main></>;
}
