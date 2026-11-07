export const automaticSalesSummaryPrefix = "상태 변경 · ";

type ContactState = {
  visitDate: string | null;
  contactRegion: string;
  proposalStatus: string | null;
  reaction: string | null;
  contactMethod: string;
  managementUpdatedOn: string | null;
  notes: string;
};

const proposalLabels: Record<string, string> = { not_submitted: "미제출", planned: "제출 예정", submitted: "제출 완료" };
const reactionLabels: Record<string, string> = { interested: "관심 높음", reviewing: "검토 중", waiting: "시기 대기", neutral: "보통", no_budget: "예산 없음", not_interested: "관심 없음", no_response: "응답 없음" };
const methodLabels: Record<string, string> = { visit: "방문", call: "전화", email: "이메일", referral: "지인 소개" };

export function planSalesContactState(previous: ContactState | null, next: {
  visitDate: string; contactRegion: string; proposalStatus: string; reaction: string;
  contactMethod: string; updateDate: string; note: string; extraChanges?: string[];
  updateDateChanged?: boolean;
}) {
  const changes = [...(next.extraChanges ?? [])];
  const describe = (label: string, before: string | null | undefined, after: string, labels?: Record<string, string>) => {
    if (before !== after) changes.push(`${label}: ${before ? labels?.[before] ?? before : "미기록"} → ${labels?.[after] ?? after}`);
  };
  describe("방문일", previous?.visitDate, next.visitDate);
  describe("방문지역", previous?.contactRegion, next.contactRegion);
  describe("제안서 제출", previous?.proposalStatus, next.proposalStatus, proposalLabels);
  describe("반응", previous?.reaction, next.reaction, reactionLabels);
  describe("접촉 방식", previous?.contactMethod, next.contactMethod, methodLabels);
  if (next.updateDateChanged) describe("업데이트 날짜", previous?.managementUpdatedOn, next.updateDate);
  const note = next.note.trim() === previous?.notes?.trim() ? "" : next.note.trim();
  const summary = note || (changes.length ? `${automaticSalesSummaryPrefix}${changes.join("; ")}` : "");
  return { changes, summary, hasNewNote: Boolean(note) };
}

export const isAutomaticSalesSummary = (value: string) => value.startsWith(automaticSalesSummaryPrefix);
