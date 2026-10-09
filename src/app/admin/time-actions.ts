"use server";

import { requireAdmin } from "@/server/admin-auth";
import { isBookingDate, koreaToday } from "@/features/booking/dates";
import { ALL_TIMES } from "@/features/booking/time-slots";
import { revalidatePath } from "next/cache";

export async function closeAllTimeSlots(date: string): Promise<{ error: string }> {
  const { supabase } = await requireAdmin();
  if (!isBookingDate(date)) return { error: "날짜를 확인해 주세요." };
  const rows = ALL_TIMES.map((time) => ({ interview_date: date, interview_time: time, enabled: false }));
  const { error } = await supabase.schema("scheduler").from("interview_time_slots").upsert(rows, { onConflict: "interview_date,interview_time" });
  if (error) return { error: "전체 시간 닫기에 실패했습니다. 잠시 후 다시 시도해 주세요." };
  revalidatePath("/admin");
  return { error: "" };
}

export async function setTimeSlot(date: string, time: string, enabled: boolean): Promise<{ error: string }> {
  const { supabase } = await requireAdmin();
  if (!isBookingDate(date) || !ALL_TIMES.includes(time) || typeof enabled !== "boolean") return { error: "날짜와 시간을 확인해 주세요." };
  const { error } = await supabase.schema("scheduler").from("interview_time_slots").upsert({ interview_date: date, interview_time: time, enabled }, { onConflict: "interview_date,interview_time" });
  if (error) return { error: "시간 설정을 저장하지 못했습니다. DB 마이그레이션 및 관리자 권한을 확인해 주세요." };
  revalidatePath("/admin");
  return { error: "" };
}

export async function addBookingDate(date: string): Promise<{ error: string }> {
  const { supabase } = await requireAdmin();
  if (!isBookingDate(date) || date < koreaToday()) return { error: "오늘 이후의 날짜를 선택해 주세요." };
  const rows = ALL_TIMES.map((time) => ({ interview_date: date, interview_time: time, enabled: false }));
  const { error } = await supabase.schema("scheduler").from("interview_time_slots").upsert(rows, { onConflict: "interview_date,interview_time", ignoreDuplicates: true });
  if (error) return { error: "예약 날짜를 추가하지 못했습니다." };
  revalidatePath("/admin");
  return { error: "" };
}
