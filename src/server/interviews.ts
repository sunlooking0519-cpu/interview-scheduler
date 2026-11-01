import "server-only";

import { requireInterviewStaff } from "@/server/admin-auth";
import { isAdmin } from "../../lib/supabase/admin-role";

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
  owner_id?: string | null;
  hired_by?: string | null;
};

export async function getInterviewReservations(): Promise<InterviewReservation[]> {
  const { supabase, user } = await requireInterviewStaff();
  const admin = isAdmin(user);
  let query = supabase
    .schema("scheduler")
    .from("interviews")
    .select("id, name, email, phone, interview_date, interview_time, status, hired_at, hired_by, owner_id, created_at, resume_url");
  if (!admin) query = query.eq("owner_id", user.id);
  let { data, error } = await query
    .order("interview_date", { ascending: true })
    .order("interview_time", { ascending: true });

  // Existing administrators retain their dashboard while the owner migration is pending.
  // Instructors fail closed because the old table exposes every reservation.
  if (admin && error?.code === "42703" && error.message.includes("owner_id")) {
    const fallback = await supabase.schema("scheduler").from("interviews")
      .select("id, name, email, phone, interview_date, interview_time, status, hired_at, created_at, resume_url")
      .order("interview_date", { ascending: true }).order("interview_time", { ascending: true });
    data = (fallback.data ?? []).map((row) => ({ ...row, owner_id: null, hired_by: null }));
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
