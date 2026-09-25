import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";

export async function requireSuperAdmin() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      redirect("/admin/login");
    }

    const { data: admin, error: adminError } = await supabase
      .from("interviews")
      .select("id, name, email, role")
      .ilike("email", user.email)
      .eq("role", "super_admin")
      .maybeSingle();

    if (adminError || !admin) {
      await supabase.auth.signOut();
      redirect("/admin/login");
    }

    return admin;
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) {
      throw error;
    }
    console.error("Admin authorization failed", error);
    redirect("/admin/login");
  }
}