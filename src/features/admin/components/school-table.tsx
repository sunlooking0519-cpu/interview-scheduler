"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { assignSchools } from "@/app/admin/schools/actions";
import { schoolPageSize, type SchoolFilters } from "@/features/admin/school-filters";
import { SchoolFollowUpDialog } from "./school-follow-up-dialog";
import { SchoolDeleteDialog } from "./school-delete-dialog";
import { SchoolExclusionDialog } from "./school-exclusion-dialog";
import { SchoolAdditionalProposalDialog } from "./school-additional-proposal-dialog";

export type SchoolRow = {
  id: string; province: string; district: string; level: string; name: string;
  phone: string; source_loaded_on: string | null; assigned_to: string | null; assigned_at: string | null;
  contact_name: string | null; contact_email: string | null; contact_phone: string | null; contact_date: string | null;
  contact_method: string | null; proposal_status: string | null; reaction: string | null;
  notes: string | null; management_updated_on: string | null;
  excluded_at: string | null; last_activity_at: string | null; additional_proposal_at: string | null;
};
export type SchoolAssignee = { id: string; name: string; email: string };

export function SchoolTable({ rows, total, page, filters, admin, assignees, assigneeById, assignmentEnabled, today }: {
  rows: SchoolRow[]; total: number; page: number; pageCount: number; filters: SchoolFilters;
  admin: boolean; assignees: SchoolAssignee[]; assigneeById: Record<string, SchoolAssignee>; assignmentEnabled: boolean;
  today: string;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assigneeId, setAssigneeId] = useState("");
  const [scope, setScope] = useState<"selected" | "filtered">("selected");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const selectedCount = selected.size;
  const allPageSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));
  const count = scope === "filtered" ? total : selectedCount;
  const toggle = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const open = (nextScope: "selected" | "filtered") => {
    setError("");
    setMessage("");
    if (nextScope === "selected" && selectedCount === 0) return;
    if (nextScope === "filtered" && (total < 1 || total > 5000)) return;
    setScope(nextScope);
    dialog.current?.showModal();
  };
  const confirm = () => {
    setError("");
    if (!assigneeId) { setError("담당자를 선택해 주세요."); return; }
    startTransition(async () => {
      const result = await assignSchools({
        scope, ids: [...selected], assigneeId: assigneeId === "none" ? null : assigneeId,
        filters, expectedCount: count,
      });
      if (result.error) { setError(result.error); return; }
      dialog.current?.close();
      setSelected(new Set());
      setMessage(result.changed ? `${result.changed}개 학교의 담당자를 변경했습니다.` : "이미 같은 담당자로 배정돼 있어 변경된 학교가 없습니다.");
      router.refresh();
    });
  };
  const assignedName = (row: SchoolRow) => row.assigned_to ? (assigneeById[row.assigned_to]?.name ?? "담당 계정") : "미배정";
  const checkbox = (row: SchoolRow, suffix: string) => admin && <input id={`${suffix}-${row.id}`} type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} aria-label={`${row.name} 선택`} className="h-5 w-5 accent-indigo-600" />;

  return <>
    {admin && <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl bg-indigo-50 p-4">
      <button type="button" onClick={() => open("selected")} disabled={!assignmentEnabled || !selectedCount} className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">선택 {selectedCount}개 배정</button>
      <button type="button" onClick={() => open("filtered")} disabled={!assignmentEnabled || total < 1 || total > 5000} className="rounded-xl border border-indigo-300 bg-white px-4 py-3 text-sm font-bold text-indigo-700 disabled:opacity-50">검색 결과 {total}개 배정</button>
      <SchoolAdditionalProposalDialog schools={rows.filter((row) => selected.has(row.id)).map((row) => ({ id: row.id, name: row.name, additional: Boolean(row.additional_proposal_at), excluded: Boolean(row.excluded_at) }))}
        enabled={filters.view !== "additional"} onComplete={(changed) => { setSelected(new Set()); setMessage(changed ? `${changed}개 학교의 추가제안 상태를 변경했습니다.` : "이미 같은 추가제안 상태인 학교입니다."); }} />
      <SchoolExclusionDialog schools={rows.filter((row) => selected.has(row.id)).map((row) => ({ id: row.id, name: row.name, excluded: Boolean(row.excluded_at) }))}
        excluded={filters.view !== "excluded"} onComplete={(changed) => { setSelected(new Set()); setMessage(changed ? `${changed}개 학교의 제외 상태를 변경했습니다.` : "이미 같은 제외 상태인 학교입니다."); }} />
      <SchoolDeleteDialog selectedIds={[...selected]} onDeleted={(deleted) => { setSelected(new Set()); setMessage(`${deleted}개 학교와 연결 기록을 삭제했습니다.`); }} />
      <p className="w-full text-xs text-slate-600">배정·추가제안·제외·삭제는 현재 페이지의 체크박스로 학교를 선택합니다. 추가제안과 제외는 배정과 활동 기록을 보존하며 각 탭에서 해제할 수 있습니다.</p>
    </div>}
    {message && <p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p>}
    <div className="mt-5 space-y-3 lg:hidden">{rows.map((row) => <article key={row.id} className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-start gap-3">{checkbox(row, "mobile-school")}<div className="min-w-0 flex-1"><h3 className="break-words font-bold text-slate-950"><Link href={`/admin/schools/${row.id}`} className="hover:text-indigo-700 hover:underline">{row.name}</Link>{row.excluded_at && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">제외</span>}{row.additional_proposal_at && <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-900">추가제안</span>}</h3><p className="mt-1 text-xs text-slate-500">{row.province} · {row.district} · {row.level}</p></div></div>
      <div className="mt-3 space-y-1 text-sm">{admin ? <p>배정 담당자 <strong className="text-indigo-700">{assignedName(row)}</strong></p> : <><p>학교 담당자 <strong>{row.contact_name || "미기록"}</strong></p><p>이메일 {row.contact_email ? <a href={`mailto:${row.contact_email}`} className="break-all text-indigo-700 underline">{row.contact_email}</a> : <span className="text-slate-400">미기록</span>}</p><p>접촉일 {row.contact_date ?? "미기록"}</p></>}<p>대표전화 <a href={`tel:${row.phone.replace(/[^+\d]/g, "")}`} className="text-indigo-700 underline">{row.phone}</a></p>{!admin && <p>담당자 전화 {row.contact_phone ? <a href={`tel:${row.contact_phone.replace(/[^+\d]/g, "")}`} className="text-indigo-700 underline">{row.contact_phone}</a> : "미기록"}</p>}</div>
      <div className="mt-3 flex items-center justify-between gap-2"><span className="text-xs text-slate-500">{row.last_activity_at ? `최근 활동 ${new Date(row.last_activity_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}` : "활동 없음"}</span><SchoolFollowUpDialog school={row} today={today} /></div>
    </article>)}</div>
    <div className="mt-5 hidden overflow-hidden rounded-xl border border-slate-200 lg:block">
      <table className="w-full table-fixed text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr>
        {admin ? <><th className="w-12 px-3 py-3"><input type="checkbox" checked={allPageSelected} onChange={() => setSelected(allPageSelected ? new Set() : new Set(rows.map((row) => row.id)))} aria-label="현재 페이지 전체 선택" className="h-5 w-5 accent-indigo-600" /></th><th className="w-[23%] px-3 py-3">학교명</th><th className="w-[17%] px-3 py-3">광역지역·지역</th><th className="w-[11%] px-3 py-3">학교급</th><th className="w-[16%] px-3 py-3">대표전화</th><th className="px-3 py-3">배정 담당자</th></>
          : <><th className="w-[27%] px-3 py-3">학교명</th><th className="w-[15%] px-3 py-3">학교 담당자</th><th className="w-[22%] px-3 py-3">이메일</th><th className="w-[12%] px-3 py-3">접촉일</th><th className="px-3 py-3">대표전화</th></>}
        <th className="w-28 px-3 py-3">관리</th>
      </tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.id} className="hover:bg-slate-50">
        {admin && <td className="px-3 py-3">{checkbox(row, "desktop-school")}</td>}
        <td className="break-words px-3 py-3 font-semibold text-slate-950"><Link href={`/admin/schools/${row.id}`} className="hover:text-indigo-700 hover:underline">{row.name}</Link>{row.excluded_at && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">제외</span>}{row.additional_proposal_at && <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-900">추가제안</span>}<span className="mt-1 block text-xs font-normal text-slate-500">{row.province} {row.district} · {row.level}</span>{row.last_activity_at && <span className="mt-1 block text-xs font-normal text-slate-500">최근 활동 {new Date(row.last_activity_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</span>}</td>
        {admin ? <><td className="px-3 py-3 text-slate-600">{row.province} · {row.district}</td><td className="px-3 py-3 text-slate-600">{row.level}</td><td className="px-3 py-3"><a href={`tel:${row.phone.replace(/[^+\d]/g, "")}`} className="text-indigo-700 underline">{row.phone}</a></td><td className="break-words px-3 py-3">{assignedName(row)}</td></>
          : <><td className="break-words px-3 py-3">{row.contact_name || <span className="text-slate-400">미기록</span>}{row.contact_phone && <a href={`tel:${row.contact_phone.replace(/[^+\d]/g, "")}`} className="mt-1 block text-xs font-normal text-indigo-700 underline">{row.contact_phone}</a>}</td><td className="break-all px-3 py-3">{row.contact_email ? <a href={`mailto:${row.contact_email}`} className="text-indigo-700 underline">{row.contact_email}</a> : <span className="text-slate-400">미기록</span>}</td><td className="px-3 py-3">{row.contact_date ?? <span className="text-slate-400">미기록</span>}</td><td className="px-3 py-3"><a href={`tel:${row.phone.replace(/[^+\d]/g, "")}`} className="text-indigo-700 underline">{row.phone}</a></td></>}
        <td className="px-3 py-3"><SchoolFollowUpDialog school={row} today={today} /></td>
      </tr>)}</tbody></table>
    </div>
    {!rows.length && <p className="mt-5 rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">{total ? "이 페이지에 학교가 없습니다. 이전 페이지로 이동해 주세요." : "조건에 맞는 학교가 없습니다."}</p>}
    {rows.length > 0 && <p className="mt-3 text-right text-xs text-slate-500">{(page - 1) * schoolPageSize + 1}–{Math.min(page * schoolPageSize, total)} / {total.toLocaleString("ko-KR")}개</p>}
    <dialog ref={dialog} onCancel={(event) => { if (pending) event.preventDefault(); }} className="m-auto w-[min(92vw,500px)] rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl backdrop:bg-slate-950/60">
      <h2 className="text-xl font-bold text-slate-950">학교 담당자 배정 확인</h2>
      <p className="mt-3 text-sm leading-6 text-slate-700">{scope === "filtered" ? "현재 필터의 학교" : "선택한 학교"} <strong>{count}개</strong>의 담당자를 지정합니다.</p>
      {scope === "selected" && <p className="mt-2 text-xs text-slate-500">{rows.filter((row) => selected.has(row.id)).slice(0, 5).map((row) => row.name).join(", ")}{selectedCount > 5 ? ` 외 ${selectedCount - 5}개` : ""}</p>}
      {scope === "filtered" && <p className="mt-2 text-xs text-slate-500">현재 페이지 외의 검색 결과도 포함됩니다.</p>}
      <label htmlFor="school-assignee" className="mt-5 block text-sm font-semibold text-slate-700">배정할 담당자</label>
      <select id="school-assignee" value={assigneeId} onChange={(event) => { setAssigneeId(event.target.value); setError(""); }} className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm">
        <option value="">담당자 선택</option><option value="none">미배정으로 변경</option>
        {assignees.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.email}</option>)}
      </select>
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={pending} onClick={() => dialog.current?.close()} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold disabled:opacity-50">취소</button><button type="button" disabled={pending || !assigneeId} onClick={confirm} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{pending ? "처리 중…" : "배정 확정"}</button></div>
    </dialog>
  </>;
}
