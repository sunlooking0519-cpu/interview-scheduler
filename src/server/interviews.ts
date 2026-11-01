import "server-only";

import { requireInterviewStaff } from "@/server/admin-auth";

export type InterviewReservation = {
  id: string | number;
  name: string;
  email: string | null;
  phone: string;
  interview_date: string;
  interview_time: string;
  status: "confirmed" | "cancelled";
  hired_at: string | null;
  created_at: string;
  resume_url?: string | null;
};

export async function getInterviewReservations(): Promise<InterviewReservation[]> {
  const { supabase } = await requireInterviewStaff();
  let { data, error } = await supabase
    .schema("scheduler")
    .from("interviews")
    .select("id, name, email, phone, interview_date, interview_time, status, hired_at, created_at, resume_url")
    .order("interview_date", { ascending: true })
    .order("interview_time", { ascending: true });

  // Keep the existing interview dashboard available until the SQL migration is applied.
  if (error?.code === "42703" && error.message.includes("hired_at")) {
    const fallback = await supabase.schema("scheduler").from("interviews")
      .select("id, name, email, phone, interview_date, interview_time, status, created_at, resume_url")
      .order("interview_date", { ascending: true }).order("interview_time", { ascending: true });
    data = (fallback.data ?? []).map((row) => ({ ...row, hired_at: null }));
    error = fallback.error;
  }

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
