export function formatInterviewDate(date: string) {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "full", timeZone: "Asia/Seoul" }).format(new Date(`${date}T00:00:00+09:00`));
}
