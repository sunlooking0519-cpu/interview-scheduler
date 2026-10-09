"use server";

import { createClient } from "../../../../lib/supabase/server";
import { DEMO_DATES } from "@/features/booking/demo-data";
import type { TimeSlot } from "@/features/booking/time-slots";

export async function getTimeSlots(date: string): Promise<{ slots: TimeSlot[]; error: string }> {
  if (!DEMO_DATES.includes(date)) return { slots: [], error: "예약 가능한 날짜를 선택해 주세요." };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.schema("scheduler").rpc("get_interview_time_slots", { p_date: date });
    if (error) return { slots: [], error: "예약 가능 시간을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." };
    return { slots: data ?? [], error: "" };
  } catch {
    return { slots: [], error: "예약 시간 조회 서비스에 연결할 수 없습니다." };
  }
}
