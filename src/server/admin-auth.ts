import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { isAdmin, isInterviewStaff, isSalesStaff } from "../../lib/supabase/admin-role";

// React cache is scoped to a single server render, so the layout and page
// share one validated user lookup without carrying auth data across requests.
export const getAdminSession = cache(async () => {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error, supabase };
});

export async function requireAdmin() {
  const { user, error, supabase } = await getAdminSession();
  if (error || !user || !isAdmin(user)) {
    redirect("/admin/login");
  }
  return { user, supabase };
}

export async function requireInterviewStaff() {
  const { user, error, supabase } = await getAdminSession();
  if (error || !user || !isInterviewStaff(user)) redirect("/admin/login");
  return { user, supabase };
}

export async function requireSalesStaff() {
  const { user, error, supabase } = await getAdminSession();
  if (error || !user || !isSalesStaff(user)) redirect("/admin/login");
  return { user, supabase };
}
