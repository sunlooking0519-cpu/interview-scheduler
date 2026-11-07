"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { editSalesActivity } from "@/app/admin/sales/actions";
import { visibleSalesActivities } from "@/features/admin/sales-contact-state";

type Activity = {
  id: string; organization_id: string; activity_type: string; contact_id: string | null;
  occurred_at: string; created_at: string; reaction: string; summary: string; follow_up_round: number | null;
  visit_region?: string | null; proposal_status?: string | null; contact_method?: string | null;
  management_updated_on?: string | null; edit_version?: number; edited_at?: string | null;
};
type Contact = { id: string; name: string };
type Revision = {
  id: string; activity_id: string; version: number; changed_at: string; changed_by_email: string | null;
  before_data: Record<string, unknown>; after_data: Record<string, unknown>;
};

const activityLabels: Record<string, string> = { visit: "방문", call: "전화", email: "메일", proposal: "제안서", meeting: "상담", note: "메모" };
const reactionLabels: Record<string, string> = { interested: "관심 높음", reviewing: "검토 중", waiting: "시기 대기", neutral: "보통", no_budget: "예산 없음", not_interested: "관심 없음", no_response: "응답 없음" };
const proposalLabels: Record<string, string> = { not_submitted: "미제출", planned: "제출 예정", submitted: "제출 완료" };
const methodLabels: Record<string, string> = { visit: "방문", call: "전화", email: "이메일", referral: "지인 소개" };
const editableFields = [
  ["occurred_at", "활동 일시"], ["contact_id", "담당자"], ["contact_method", "접촉 방식"],
  ["reaction", "반응"], ["proposal_status", "제안서 제출"], ["visit_region", "방문지역"],
  ["management_updated_on", "업데이트 날짜"], ["summary", "상담 내용"],
] as const;
const input = "mt-1 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm";
const displayDate = (value: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const localDate = (value: string) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" }).format(new Date(value)).replace(" ", "T");

function EditDialog({ activity, contacts, onClose }: { activity: Activity; contacts: Contact[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(editSalesActivity, { error: "", saved: false });
  useEffect(() => { if (dialog.current && !dialog.current.open) dialog.current.showModal(); }, []);
  const openCorrection = () => {
    dialog.current?.close();
    const advanced = document.getElementById("advanced-activity-log");
    if (advanced instanceof HTMLDetailsElement) advanced.open = true;
    advanced?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return <dialog ref={dialog} onClose={onClose} className="m-auto max-h-[92dvh] w-[min(92vw,640px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/60">
    <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-white p-5 sm:p-6">
      <div><p className="text-xs font-bold text-indigo-600">활동 기록 수정</p><h3 className="mt-1 text-xl font-bold">{activityLabels[activity.activity_type] ?? activity.activity_type} · {displayDate(activity.occurred_at)}</h3></div>
      <button type="button" onClick={() => dialog.current?.close()} aria-label="수정 팝업 닫기" className="rounded-lg border px-3 py-2 text-sm">닫기</button>
    </div>
    {state.saved ? <div className="p-5 sm:p-6"><p role="status" className="rounded-xl bg-emerald-50 p-4 font-semibold text-emerald-800">활동 기록을 수정하고 변경 이력을 저장했습니다.</p><button type="button" onClick={() => dialog.current?.close()} className="mt-4 rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white">타임라인으로 돌아가기</button></div>
      : <form action={action} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        <input type="hidden" name="activity_id" value={activity.id} />
        <input type="hidden" name="organization_id" value={activity.organization_id} />
        <input type="hidden" name="edit_version" value={activity.edit_version ?? 0} />
        <label className="text-sm font-semibold text-slate-700">활동 일시<input type="datetime-local" name="occurred_at" required defaultValue={localDate(activity.occurred_at)} className={input} /></label>
        <label className="text-sm font-semibold text-slate-700">담당자<select name="contact_id" defaultValue={activity.contact_id ?? ""} className={input}><option value="">미지정</option>{contacts.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
        {activity.activity_type === "visit" ? <label className="text-sm font-semibold text-slate-700">접촉 방식<select name="contact_method" defaultValue={activity.contact_method ?? ""} className={input}><option value="">미기록</option>{Object.entries(methodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label> : <div className="text-sm font-semibold text-slate-700">활동 유형<p className={`${input} text-slate-600`}>{activityLabels[activity.activity_type] ?? activity.activity_type} · 변경 시 새 정정 활동을 기록해 주세요.</p><input type="hidden" name="contact_method" value={activity.contact_method ?? ""} /></div>}
        <label className="text-sm font-semibold text-slate-700">반응<select name="reaction" defaultValue={activity.reaction} className={input}>{Object.entries(reactionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">제안서 제출<select name="proposal_status" defaultValue={activity.proposal_status ?? ""} className={input}><option value="">미기록</option>{Object.entries(proposalLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">방문지역<input name="visit_region" maxLength={120} defaultValue={activity.visit_region ?? ""} className={input} /></label>
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">업데이트 날짜<input type="date" name="management_updated_on" defaultValue={activity.management_updated_on ?? ""} className={input} /><span className="mt-1 block text-xs font-normal text-slate-500">기존에 직접 지정한 날짜가 있을 때만 표시됩니다. 필요하면 수정할 수 있습니다.</span></label>
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">상담 내용<textarea name="summary" required rows={5} maxLength={5000} defaultValue={activity.summary} className={input} /></label>
        <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 sm:col-span-2"><p>후속 차수와 다음 행동 일정은 이 기록에서 바꾸지 않습니다. 변경이 필요하면 새 활동으로 정정해 주세요.</p><button type="button" onClick={openCorrection} className="mt-2 font-bold text-indigo-700 underline">새 정정 활동 기록하기</button></div>
        {state.error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 sm:col-span-2">{state.error}</p>}
        <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={() => dialog.current?.close()} className="rounded-xl border px-4 py-3 text-sm font-semibold">취소</button><button type="submit" disabled={pending} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{pending ? "저장 중…" : "수정 저장"}</button></div>
      </form>}
  </dialog>;
}

export function SalesActivityTimeline({ activities, contacts, revisions, editingEnabled }: {
  activities: Activity[]; contacts: Contact[]; revisions: Revision[]; editingEnabled: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Activity | null>(null);
  const visibleActivities = visibleSalesActivities(activities);
  const contactNames = new Map(contacts.map((person) => [person.id, person.name]));
  const previousVisitById = new Map<string, Activity>();
  let previousVisit: Activity | null = null;
  for (const visit of [...visibleActivities].filter((item) => item.activity_type === "visit").sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    if (previousVisit) previousVisitById.set(visit.id, previousVisit);
    previousVisit = visit;
  }
  const formatValue = (key: string, value: unknown) => {
    if (value === null || value === undefined || value === "") return "미기록";
    const text = String(value);
    if (key === "occurred_at") return displayDate(text);
    if (key === "contact_id") return contactNames.get(text) ?? text;
    if (key === "reaction") return reactionLabels[text] ?? text;
    if (key === "proposal_status") return proposalLabels[text] ?? text;
    if (key === "contact_method") return methodLabels[text] ?? text;
    return text;
  };
  return <>
    <div className="flex items-center justify-between"><div><p className="text-xs font-bold tracking-[0.16em] text-slate-500">HISTORY</p><h2 className="mt-2 text-xl font-bold">활동 타임라인</h2></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{visibleActivities.length}건</span></div>
    {!editingEnabled && <p role="status" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">활동 수정 기능을 준비하지 못했습니다. Supabase의 활동 수정 SQL 적용 여부와 연결 상태를 확인해 주세요.</p>}
    <ol className="mt-5 space-y-4">{visibleActivities.map((activity) => {
      const history = revisions.filter((revision) => revision.activity_id === activity.id);
      const previous = previousVisitById.get(activity.id);
      const changes: string[] = [];
      if (previous && activity.activity_type === "visit") {
        if (previous.proposal_status !== activity.proposal_status) changes.push(`제안서 ${proposalLabels[previous.proposal_status ?? ""] ?? "미기록"} → ${proposalLabels[activity.proposal_status ?? ""] ?? "미기록"}`);
        if (previous.reaction !== activity.reaction) changes.push(`반응 ${reactionLabels[previous.reaction] ?? previous.reaction} → ${reactionLabels[activity.reaction] ?? activity.reaction}`);
        if (previous.contact_method !== activity.contact_method) changes.push(`접촉 방식 ${methodLabels[previous.contact_method ?? ""] ?? "미기록"} → ${methodLabels[activity.contact_method ?? ""] ?? "미기록"}`);
      }
      return <li key={activity.id} className="relative border-l-2 border-indigo-100 pl-4"><span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-indigo-500"/>
        <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-indigo-700">{activityLabels[activity.activity_type] ?? activity.activity_type}</span>{activity.follow_up_round && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">{activity.follow_up_round}차 후속</span>}<span className="text-xs text-slate-400">활동 {displayDate(activity.occurred_at)} · 기록 {displayDate(activity.created_at)}</span>{activity.edited_at && <span className="text-xs text-amber-700">수정됨</span>}</div>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-800">{activity.summary}</p>
        {changes.length > 0 && <p className="mt-1 text-xs font-semibold text-indigo-700">{changes.join(" · ")}</p>}
        <p className="mt-1 text-xs text-slate-500">{reactionLabels[activity.reaction] ?? activity.reaction}{activity.contact_id && contactNames.get(activity.contact_id) ? ` · ${contactNames.get(activity.contact_id)}` : ""}{activity.contact_method ? ` · ${methodLabels[activity.contact_method] ?? activity.contact_method}` : ""}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">{editingEnabled && <button type="button" onClick={() => setSelected(activity)} className="text-xs font-bold text-indigo-700 underline">수정</button>}{history.length > 0 && <details className="text-xs text-slate-600"><summary className="cursor-pointer font-semibold">수정 이력 {history.length}건</summary><div className="mt-2 space-y-3">{history.map((revision) => {
          const changes = editableFields.filter(([key]) => revision.before_data[key] !== revision.after_data[key]);
          return <div key={revision.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="font-semibold">{displayDate(revision.changed_at)} · {revision.changed_by_email ?? "관리자"}</p>{changes.length ? <ul className="mt-2 space-y-1">{changes.map(([key, label]) => <li key={key}>{label}: {formatValue(key, revision.before_data[key])} → {formatValue(key, revision.after_data[key])}</li>)}</ul> : <p className="mt-2">값 변경 없음</p>}</div>;
        })}</div></details>}</div>
      </li>;
    })}</ol>
    {!visibleActivities.length && <div className="mt-5 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">첫 방문이나 전화 결과를 왼쪽에서 기록해 주세요.</div>}
    {selected && <EditDialog key={`${selected.id}-${selected.edit_version ?? 0}`} activity={selected} contacts={contacts} onClose={() => { setSelected(null); router.refresh(); }} />}
  </>;
}
