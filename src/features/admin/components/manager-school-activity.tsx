"use client";

import { useMemo, useState } from "react";
import { methodLabels, proposalLabels, reactionLabels } from "../school-contact-labels";

export type ManagerSchoolActivityRow = {
  id: string; schoolId: string; schoolName: string; province: string; district: string;
  recordedBy: string; contactDate: string; createdAt: string; contactMethod: string;
  proposalStatus: string | null; reaction: string | null; newNote: string | null; changeSummary: string;
};

const recordedLabel = (value: string) => new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit",
}).format(new Date(value));

function ActivityItem({ activity, compact = false }: { activity: ManagerSchoolActivityRow; compact?: boolean }) {
  return <li className="border-l-2 border-indigo-300 py-2 pl-3 text-sm first:pt-0">
    <p className="font-bold text-slate-900">{activity.schoolName} <span className="font-normal text-slate-500">· {methodLabels[activity.contactMethod] ?? activity.contactMethod}</span></p>
    <p className="mt-1 text-xs text-slate-600">접촉 {activity.contactDate} · 기록 {recordedLabel(activity.createdAt)} · {activity.province} {activity.district}</p>
    <p className="mt-1 text-xs text-slate-600">{proposalLabels[activity.proposalStatus ?? ""] ?? "제안서 미기록"} · {reactionLabels[activity.reaction ?? ""] ?? "반응 미기록"}</p>
    {activity.newNote ? <p className={`mt-2 whitespace-pre-wrap break-words text-slate-800 ${compact ? "line-clamp-2" : ""}`}>{activity.newNote}</p> : <p className="mt-1 text-xs text-slate-500">{activity.changeSummary}</p>}
  </li>;
}

export function ManagerSchoolActivity({ activities }: { activities: ManagerSchoolActivityRow[] }) {
  const [schoolId, setSchoolId] = useState("");
  const [method, setMethod] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const schools = useMemo(() => [...new Map(activities.map((item) => [item.schoolId, { id: item.schoolId, name: item.schoolName, region: `${item.province} ${item.district}` }])).values()]
    .sort((a, b) => a.name.localeCompare(b.name, "ko")), [activities]);
  const filtered = activities.filter((item) => (!schoolId || item.schoolId === schoolId)
    && (!method || item.contactMethod === method) && (!from || item.contactDate >= from) && (!to || item.contactDate <= to));
  return <>
    <div className="mt-3"><p className="mb-2 text-xs font-bold text-slate-600">최근 활동</p>
      {activities.length ? <ol className="space-y-2">{activities.slice(0, 3).map((item) => <ActivityItem key={item.id} activity={item} compact />)}</ol>
        : <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">이 관리자가 기록한 학교 활동이 없습니다.</p>}
    </div>
    {activities.length > 0 && <details className="mt-4 border-t border-indigo-100 pt-3"><summary className="cursor-pointer text-sm font-semibold text-indigo-700">활동 전체 보기 · {activities.length}건</summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-700">학교<select value={schoolId} onChange={(event) => setSchoolId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm"><option value="">모든 학교</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name} · {school.region}</option>)}</select></label>
        <label className="text-xs font-semibold text-slate-700">접촉 방식<select value={method} onChange={(event) => setMethod(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm"><option value="">전체</option>{Object.entries(methodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-xs font-semibold text-slate-700">접촉일 시작<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm" /></label>
        <label className="text-xs font-semibold text-slate-700">접촉일 종료<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm" /></label>
      </div>
      <p className="mt-3 text-xs text-slate-500">검색 결과 {filtered.length}건 · 저장 시각 최신순</p>
      <ol className="mt-2 max-h-80 space-y-2 overflow-y-auto">{filtered.map((item) => <ActivityItem key={item.id} activity={item} />)}</ol>
      {!filtered.length && <p className="mt-2 text-sm text-slate-500">조건에 맞는 활동이 없습니다.</p>}
    </details>}
  </>;
}
