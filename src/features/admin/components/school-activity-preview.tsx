"use client";

import type { SchoolHistory } from "./school-follow-up-dialog";
import { methodLabels, proposalLabels, reactionLabels } from "../school-contact-labels";

export function SchoolActivityPreview({ history }: { history: SchoolHistory[] }) {
  const latest = history[0];
  if (!latest) return <p className="mt-1 text-xs font-normal text-slate-400">활동 미기록</p>;
  return <details className="mt-1 text-xs font-normal text-slate-600">
    <summary className="cursor-pointer text-indigo-700">최근 활동 {latest.contact_date} · {methodLabels[latest.contact_method] ?? latest.contact_method}{latest.new_note ? ` · ${latest.new_note.replace(/\s+/g, " ").slice(0, 38)}` : ` · ${latest.change_summary}`}</summary>
    <ol className="mt-2 max-h-48 space-y-2 overflow-y-auto border-l-2 border-indigo-100 pl-3">
      {history.map((item) => <li key={item.id} className="border-b border-slate-100 pb-2 last:border-0">
        <p className="font-semibold text-slate-800">{item.contact_date} · {methodLabels[item.contact_method] ?? item.contact_method}</p>
        <p className="text-slate-500">{proposalLabels[item.proposal_status ?? ""] ?? "제안서 미기록"} · {reactionLabels[item.reaction ?? ""] ?? "반응 미기록"}</p>
        {item.new_note ? <p className="mt-1 whitespace-pre-wrap break-words text-slate-700">{item.new_note}</p> : <p className="mt-1 text-slate-500">{item.change_summary}</p>}
      </li>)}
    </ol>
  </details>;
}
