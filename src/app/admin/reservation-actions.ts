"use server";

import { requireAdmin } from "@/server/admin-auth";
import { revalidatePath } from "next/cache";

export async function cancelAdminReservation(id: string | number): Promise<{ error: string }> {
  const { supabase } = await requireAdmin();
  if (!/^[1-9][0-9]{0,18}$/.test(String(id))) return { error: "예약 정보를 확인해 주세요." };
  const { data, error } = await supabase.schema("scheduler").rpc("cancel_admin_reservation", { p_id: String(id) });
  if (error || data !== true) return { error: "예약을 취소하지 못했습니다. 이미 변경된 예약인지 확인해 주세요." };
  revalidatePath("/admin");
  return { error: "" };
}
