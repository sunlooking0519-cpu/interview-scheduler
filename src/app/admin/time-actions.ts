"use server";

import { requireAdmin } from "@/server/admin-auth";
import { DEMO_DATES } from "@/features/booking/demo-data";
import { ALL_TIMES } from "@/features/booking/time-slots";
import { revalidatePath } from "next/cache";

export async function setTimeSlot(date: string, time: string, enabled: boolean): Promise<{ error: string }> {
  const { supabase } = await requireAdmin();
  if (!DEMO_DATES.includes(date) || !ALL_TIMES.includes(time) || typeof enabled !== "boolean") return { error: "날짜와 시간을 확인해 주세요." };
  const { error } = await supabase.schema("scheduler").from("interview_time_slots").upsert({ interview_date: date, interview_time: time, enabled }, { onConflict: "interview_date,interview_time" });
  if (error) return { error: "시간 설정을 저장하지 못했습니다. DB 마이그레이션 및 관리자 권한을 확인해 주세요." };
  revalidatePath("/admin");
  return { error: "" };
}
