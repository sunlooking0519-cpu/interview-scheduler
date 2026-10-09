export const ALL_TIMES = Array.from({ length: 25 }, (_, index) => {
  const minutes = 9 * 60 + index * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

export type TimeSlot = { interview_time: string; enabled: boolean; booked: boolean };

export function displayTime(time: string) {
  const [hour, minute] = time.split(":");
  return `${Number(hour) % 12 || 12}:${minute}`;
}
