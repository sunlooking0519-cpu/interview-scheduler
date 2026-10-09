import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { isAdmin } from "../../lib/supabase/admin-role";

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || !isAdmin(user)) {
    redirect("/admin/login");
  }
  return { user, supabase };
}
