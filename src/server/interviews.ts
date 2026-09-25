import "server-only";

import { createAdminClient } from "../../lib/supabase/admin";

export type InterviewReservation = {
  id: string;
  name: string;
  email: string;
  phone: string;
  interview_date: string;
  interview_time: string;
  status: "confirmed" | "cancelled";
  created_at: string;
};

export async function getInterviewReservations(): Promise<InterviewReservation[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("interviews")
    .select("id, name, email, phone, interview_date, interview_time, status, created_at")
    .eq("role", "candidate")
    .order("interview_date", { ascending: true })
    .order("interview_time", { ascending: true });

  if (error) {
    console.error("Admin interview query failed", {
      code: error.code,
      message: error.message,
      details: error.details,
    });
    throw new Error("면접 예약 데이터를 불러오지 못했습니다.");
  }

  return (data ?? []) as InterviewReservation[];
}