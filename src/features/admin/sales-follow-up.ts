export type FollowUpOrganization = {
  stage: string;
  last_follow_up_round: number;
  follow_up_status: string;
  next_action_at: string | null;
};

export const followUpStatusLabels: Record<string, string> = {
  pending: "후속 예정",
  waiting_reply: "회신 대기",
  responded: "회신 완료",
  paused: "보류",
  done: "완료",
};

export const nextActionTypeLabels: Record<string, string> = {
  call: "전화",
  email: "이메일",
  visit: "방문",
  proposal: "제안서",
  meeting: "미팅",
};

export const koreaDateKey = (value: string | Date) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date(value));

export const isOpenSalesOrganization = (organization: FollowUpOrganization) =>
  !["won", "lost"].includes(organization.stage);

export const isFirstFollowUpQueue = (organization: FollowUpOrganization) =>
  organization.last_follow_up_round === 1
  && ["pending", "waiting_reply"].includes(organization.follow_up_status)
  && isOpenSalesOrganization(organization);

export const isDueBefore = (organization: FollowUpOrganization, date: string) =>
  Boolean(organization.next_action_at
    && koreaDateKey(organization.next_action_at) < date
    && isOpenSalesOrganization(organization));

export const isDueOn = (organization: FollowUpOrganization, date: string) =>
  Boolean(organization.next_action_at
    && koreaDateKey(organization.next_action_at) === date
    && isOpenSalesOrganization(organization));

export const elapsedDays = (from: string, to: Date = new Date()) => {
  const fromDate = new Date(`${koreaDateKey(from)}T00:00:00+09:00`);
  const toDate = new Date(`${koreaDateKey(to)}T00:00:00+09:00`);
  return Math.max(0, Math.floor((toDate.getTime() - fromDate.getTime()) / 86_400_000));
};
