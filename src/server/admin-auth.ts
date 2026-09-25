import "server-only";

import { redirect } from "next/navigation";
import { getAdminSession } from "@/server/admin-session";

export async function requireSuperAdmin() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }
  return session;
}