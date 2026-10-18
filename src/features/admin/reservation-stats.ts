import type { InterviewReservation } from "@/server/interviews";

export function getUpcomingReservationStats(
  interviews: Pick<InterviewReservation, "interview_date" | "interview_time" | "status">[],
  now = new Date(),
) {
  const upcoming = interviews.filter(({ interview_date, interview_time }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(interview_date) || !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(interview_time)) return false;
    const startsAt = new Date(`${interview_date}T${interview_time}+09:00`);
    return Number.isFinite(startsAt.getTime()) && startsAt >= now;
  });

  return {
    total: upcoming.length,
    confirmed: upcoming.filter(({ status }) => status === "confirmed").length,
    cancelled: upcoming.filter(({ status }) => status === "cancelled").length,
  };
}
