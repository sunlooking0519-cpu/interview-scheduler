"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/admin-auth";
import { createServiceClient } from "../../../../lib/supabase/service";

export async function setInstructorAccess(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const action = String(formData.get("action") ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) || !["approve", "revoke"].includes(action)) redirect("/admin/members?result=invalid");
  let result = "error";
  try {
    const service = createServiceClient();
    const { data: { user }, error } = await service.auth.admin.getUserById(id);
    if (!error && user) {
      if (["admin", "super_admin"].includes(String(user.app_metadata.role ?? ""))) result = "protected";
      else if (user.user_metadata.requested_role !== "instructor" && user.app_metadata.role !== "instructor") result = "invalid";
      else if (action === "approve" && !user.email_confirmed_at) result = "unconfirmed";
      else {
        const { error: schemaError } = action === "approve"
          ? await service.schema("scheduler").from("interviews").select("hired_at").limit(1)
          : { error: null };
        if (schemaError) result = "setup";
        else {
          const { error: updateError } = await service.auth.admin.updateUserById(id, {
            app_metadata: { ...user.app_metadata, role: action === "approve" ? "instructor" : "pending" },
          });
          if (!updateError) result = action === "approve" ? "approved" : "revoked";
        }
      }
    }
  } catch { /* An unavailable Auth service is reported below. */ }
  if (["approved", "revoked"].includes(result)) revalidatePath("/admin/members");
  redirect(`/admin/members?result=${result}`);
}
