"use server";

import { requireInterviewStaff } from "@/server/admin-auth";
import { revalidatePath } from "next/cache";
import { scheduleCalendarSync } from "@/server/calendar-sync";

export async function cancelAdminReservation(id: string | number): Promise<{ error: string }> {
  const { supabase } = await requireInterviewStaff();
  if (!/^[1-9][0-9]{0,18}$/.test(String(id))) return { error: "예약 정보를 확인해 주세요." };
  const { data, error } = await supabase.schema("scheduler").rpc("cancel_admin_reservation", { p_id: String(id) });
  if (error || data !== true) return { error: "예약을 취소하지 못했습니다. 이미 변경된 예약인지 확인해 주세요." };
  revalidatePath("/admin");
  scheduleCalendarSync();
  return { error: "" };
}

export async function setHiringDecision(id: string | number, hired: boolean): Promise<{ error: string }> {
  const { supabase } = await requireInterviewStaff();
  if (!/^[1-9][0-9]{0,18}$/.test(String(id)) || typeof hired !== "boolean") return { error: "예약 정보를 확인해 주세요." };
  const procedure = hired ? "hire_admin_reservation" : "unhire_admin_reservation";
  const { data, error } = await supabase.schema("scheduler").rpc(procedure, { p_id: String(id) });
  if (error || data !== true) return { error: hired ? "채용 처리에 실패했습니다. 이미 변경된 예약인지 확인해 주세요." : "채용 처리를 되돌리지 못했습니다." };
  revalidatePath("/admin");
  return { error: "" };
}
