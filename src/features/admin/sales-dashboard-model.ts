import { isOpenSalesOrganization, koreaDateKey } from "./sales-follow-up";

export type DashboardOrganization = {
  id: string; name: string; stage: string; priority: string; address: string | null;
  next_action: string | null; next_action_type: string | null; next_action_at: string | null;
  next_contact_id: string | null; last_follow_up_round: number; follow_up_status: string;
};
export type DashboardContact = {
  id: string; organization_id: string; name: string; title: string | null;
  phone: string | null; mobile: string | null; email: string | null;
};
export type DashboardCard = { id: string; organization_id: string; contact_id: string | null; created_at: string };
export type DashboardActivity = {
  id: string; organization_id: string; contact_id: string | null; activity_type: string;
  occurred_at: string; created_at: string; summary: string; follow_up_round: number | null;
};
export type DashboardMeeting = {
  id: string; organization_id: string; contact_id: string | null; title: string;
  starts_at: string; location: string | null; status: string;
};
export type DashboardTask = {
  id: string; organizationId: string; organizationName: string; title: string;
  dueAt: string | null; dueDate: string | null; kind: "scheduled" | "visit" | "unscheduled";
  rank: number; priority: string; contact: DashboardContact | null; href: string; progress: string;
};
export type DashboardCalendarEvent = {
  id: string; date: string; type: "completed" | "meeting" | "due";
  title: string; organizationId: string; organizationName: string; detail: string;
  time: string | null; location: string | null; href: string; progress: string;
};

const priorityRank: Record<string, number> = { high: 0, normal: 1, low: 2 };
const activityLabels: Record<string, string> = {
  visit: "방문", call: "전화", email: "메일", proposal: "제안서", meeting: "상담", note: "메모",
};

export function confirmedProgress(organization: DashboardOrganization, hasVisit: boolean) {
  if (organization.stage === "won") return "계약 확정";
  if (organization.stage === "lost") return "종료";
  if (organization.last_follow_up_round > 0) return `${organization.last_follow_up_round}차 후속 기록`;
  if (organization.stage === "proposal") return "제안 단계";
  if (hasVisit) return "방문 기록 완료";
  return "명함 등록";
}

export function buildSalesDashboard(input: {
  organizations: DashboardOrganization[];
  contacts: DashboardContact[];
  cards: DashboardCard[];
  visits: DashboardActivity[];
  monthActivities: DashboardActivity[];
  meetings: DashboardMeeting[];
  today: string;
  month: string;
}) {
  const { organizations, contacts, cards, visits, monthActivities, meetings, today, month } = input;
  const organizationById = new Map(organizations.map((organization) => [organization.id, organization]));
  const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
  const firstContactByOrganization = new Map<string, DashboardContact>();
  for (const contact of contacts) if (!firstContactByOrganization.has(contact.organization_id)) firstContactByOrganization.set(contact.organization_id, contact);
  const visitKey = (organizationId: string, contactId: string | null) => `${organizationId}:${contactId ?? ""}`;
  const visitByContact = new Set(visits.map((visit) => visitKey(visit.organization_id, visit.contact_id)));
  const visitByOrganization = new Set(visits.map((visit) => visit.organization_id));
  const tasks: DashboardTask[] = [];

  for (const organization of organizations) {
    if (!isOpenSalesOrganization(organization)) continue;
    const contact = (organization.next_contact_id && contactById.get(organization.next_contact_id))
      || firstContactByOrganization.get(organization.id) || null;
    const dueDate = organization.next_action_at ? koreaDateKey(organization.next_action_at) : null;
    const hasVisit = visitByOrganization.has(organization.id);
    if (organization.next_action) {
      tasks.push({
        id: `next:${organization.id}`, organizationId: organization.id, organizationName: organization.name,
        title: organization.next_action, dueAt: organization.next_action_at, dueDate,
        kind: dueDate ? "scheduled" : "unscheduled",
        rank: dueDate ? dueDate < today ? 0 : dueDate === today ? 1 : 2 : 4,
        priority: organization.priority, contact,
        href: `/admin/sales/${organization.id}#quick-log`, progress: confirmedProgress(organization, hasVisit),
      });
    } else if (hasVisit) {
      tasks.push({
        id: `plan:${organization.id}`, organizationId: organization.id, organizationName: organization.name,
        title: "다음 연락·제안 일정 정하기", dueAt: null, dueDate: null, kind: "unscheduled", rank: 4,
        priority: organization.priority, contact, href: `/admin/sales/${organization.id}`,
        progress: confirmedProgress(organization, true),
      });
    }
  }

  const seenCards = new Set<string>();
  for (const card of cards) {
    const organization = organizationById.get(card.organization_id);
    if (!organization || !isOpenSalesOrganization(organization)) continue;
    const key = visitKey(card.organization_id, card.contact_id);
    if (seenCards.has(key) || (card.contact_id ? visitByContact.has(key) : visitByOrganization.has(card.organization_id))) continue;
    seenCards.add(key);
    tasks.push({
      id: `visit:${card.id}`, organizationId: organization.id, organizationName: organization.name,
      title: "방문·상담 내용 기록", dueAt: null, dueDate: null, kind: "visit", rank: 3,
      priority: organization.priority, contact: card.contact_id ? contactById.get(card.contact_id) ?? null : null,
      href: `/admin/sales/cards/${card.id}/visit`, progress: confirmedProgress(organization, false),
    });
  }
  tasks.sort((a, b) => a.rank - b.rank
    || (a.dueAt ?? "").localeCompare(b.dueAt ?? "")
    || (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1)
    || a.organizationName.localeCompare(b.organizationName, "ko"));

  const events: DashboardCalendarEvent[] = [];
  for (const activity of monthActivities) {
    const organization = organizationById.get(activity.organization_id);
    if (!organization) continue;
    const date = koreaDateKey(activity.occurred_at);
    if (!date.startsWith(month)) continue;
    events.push({ id: `activity:${activity.id}`, date, type: "completed",
      title: `${activityLabels[activity.activity_type] ?? "활동"} 완료`, organizationId: organization.id,
      organizationName: organization.name, detail: activity.summary, time: null, location: organization.address,
      href: `/admin/sales/${organization.id}`, progress: confirmedProgress(organization, visitByOrganization.has(organization.id)),
    });
  }
  for (const meeting of meetings) {
    if (meeting.status === "cancelled") continue;
    const organization = organizationById.get(meeting.organization_id);
    if (!organization) continue;
    const date = koreaDateKey(meeting.starts_at);
    if (!date.startsWith(month)) continue;
    events.push({ id: `meeting:${meeting.id}`, date, type: "meeting", title: meeting.title,
      organizationId: organization.id, organizationName: organization.name,
      detail: meeting.location || organization.address || "장소 미입력", time: meeting.starts_at,
      location: meeting.location || organization.address,
      href: `/admin/sales/${organization.id}`, progress: confirmedProgress(organization, visitByOrganization.has(organization.id)),
    });
  }
  for (const task of tasks) {
    if (task.kind !== "scheduled" || !task.dueDate?.startsWith(month)) continue;
    events.push({ id: task.id, date: task.dueDate, type: "due", title: task.title,
      organizationId: task.organizationId, organizationName: task.organizationName,
      detail: task.contact?.name || "담당자 미지정", time: task.dueAt, location: null,
      href: task.href, progress: task.progress,
    });
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || ({ due: 0, meeting: 1, completed: 2 }[a.type] - { due: 0, meeting: 1, completed: 2 }[b.type]));
  return {
    tasks, events,
    counts: {
      overdue: tasks.filter((task) => task.rank === 0).length,
      today: tasks.filter((task) => task.rank === 1).length,
      upcoming: tasks.filter((task) => task.dueDate && task.dueDate > today && task.dueDate <= koreaDateKey(new Date(new Date(`${today}T12:00:00+09:00`).getTime() + 7 * 86_400_000))).length,
      missingVisit: tasks.filter((task) => task.kind === "visit").length,
    },
  };
}
