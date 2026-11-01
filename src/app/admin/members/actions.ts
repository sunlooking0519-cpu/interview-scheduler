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
      else {
        const candidateId = String(user.app_metadata.promotion_candidate_id ?? "");
        const { data: candidate, error: schemaError } = action === "approve" && candidateId
          ? await service.schema("scheduler").from("interviews").select("id,name,email,hired_at").eq("id", candidateId).maybeSingle()
          : { data: null, error: null };
        if (action === "approve" && !candidateId) result = "unlinked";
        else if (schemaError) result = "setup";
        else if (action === "approve" && (!candidate?.hired_at || candidate.name.trim() !== String(user.user_metadata.full_name ?? "").trim() || (candidate.email && candidate.email.trim().toLowerCase() !== user.email?.toLowerCase()))) result = "unlinked";
        else {
          const { error: updateError } = await service.auth.admin.updateUserById(id, {
            ...(action === "approve" && !user.email_confirmed_at ? { email_confirm: true } : {}),
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
