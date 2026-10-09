"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "../../../../lib/supabase/server";
import { DEMO_DATES } from "@/features/booking/demo-data";
import { ALL_TIMES } from "@/features/booking/time-slots";

export type CandidateIdentity = { name: string; phone: string };
export type CandidateReservation = { id: string | number; interview_date: string; interview_time: string; status: "confirmed" | "cancelled" };

function identity(input: CandidateIdentity) {
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const phone = typeof input?.phone === "string" ? input.phone.trim() : "";
  return name && name.length <= 60 && /^[0-9+() -]{8,20}$/.test(phone) ? { name, phone } : null;
}

export async function findCandidateReservations(input: CandidateIdentity): Promise<{ data: CandidateReservation[]; error: string }> {
  const candidate = identity(input);
  if (!candidate) return { data: [], error: "이름과 전화번호를 다시 입력해 주세요." };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.schema("scheduler").rpc("find_candidate_reservations", { p_name: candidate.name, p_phone: candidate.phone });
    if (error) return { data: [], error: "예약 내역을 조회할 수 없습니다. 관리자에게 문의해 주세요." };
    return { data: (data ?? []) as CandidateReservation[], error: "" };
  } catch {
    return { data: [], error: "예약 조회 서비스에 연결할 수 없습니다." };
  }
}

export async function updateCandidateReservation(input: CandidateIdentity, id: string | number, date: string, time: string): Promise<{ error: string }> {
  const candidate = identity(input);
  const reservationId = typeof id === "number" && Number.isSafeInteger(id) ? String(id) : typeof id === "string" ? id : "";
  if (!/^[1-9][0-9]{0,18}$/.test(reservationId) || BigInt(reservationId) > BigInt("9223372036854775807")) {
    return { error: "예약 ID를 확인할 수 없습니다. 예약 내역을 다시 조회해 주세요." };
  }
  if (!candidate || !DEMO_DATES.includes(date) || !ALL_TIMES.includes(time)) {
    return { error: "입력한 정보와 면접 일정을 확인해 주세요." };
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.schema("scheduler").rpc("update_candidate_reservation", {
      p_name: candidate.name, p_phone: candidate.phone, p_id: reservationId, p_date: date, p_time: time,
    });
    if (error?.code === "23505") return { error: "이미 예약된 시간입니다. 다른 시간을 선택해 주세요." };
    if (error?.code === "P0001") return { error: "선택한 시간이 마감되었습니다. 다른 시간을 선택해 주세요." };
    if (error || data !== true) return { error: "수정할 예약을 찾을 수 없거나 수정할 수 없는 상태입니다." };
    revalidatePath("/admin");
    return { error: "" };
  } catch {
    return { error: "예약 변경 서비스에 연결할 수 없습니다." };
  }
}
