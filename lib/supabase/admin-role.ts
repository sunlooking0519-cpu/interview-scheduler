import type { User } from "@supabase/supabase-js";

// user_metadata is editable by users and must never grant administrator access.
export function isAdmin(user: Pick<User, "app_metadata">): boolean {
  return user.app_metadata.role === "admin" || user.app_metadata.role === "super_admin";
}
