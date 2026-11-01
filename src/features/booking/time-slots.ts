export const ALL_TIMES = Array.from({ length: 25 }, (_, index) => {
  const minutes = 9 * 60 + index * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

export type TimeSlot = { interview_time: string; enabled: boolean; booked: boolean };

export function setSlotEnabled(slots: TimeSlot[], time: string, enabled: boolean): TimeSlot[] {
  if (slots.some((slot) => slot.interview_time === time)) {
    return slots.map((slot) => slot.interview_time === time ? { ...slot, enabled } : slot);
  }
  return [...slots, { interview_time: time, enabled, booked: false }]
    .sort((a, b) => a.interview_time.localeCompare(b.interview_time));
}

export function openTimes(slots: TimeSlot[]): string[] {
  return slots.filter((slot) => slot.enabled === true && slot.booked === false).map((slot) => slot.interview_time);
}

export function displayTime(time: string) {
  const [hour, minute] = time.split(":");
  return `${Number(hour) % 12 || 12}:${minute}`;
}
