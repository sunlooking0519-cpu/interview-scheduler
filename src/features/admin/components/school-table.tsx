"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignSchools } from "@/app/admin/schools/actions";
import { schoolPageSize, type SchoolFilters } from "@/features/admin/school-filters";

export type SchoolRow = {
  id: string; province: string; district: string; level: string; name: string;
  phone: string; source_loaded_on: string | null; assigned_to: string | null; assigned_at: string | null;
};
export type SchoolAssignee = { id: string; name: string; email: string };

export function SchoolTable({ rows, total, page, filters, admin, assignees, assigneeById, assignmentEnabled }: {
  rows: SchoolRow[]; total: number; page: number; pageCount: number; filters: SchoolFilters;
  admin: boolean; assignees: SchoolAssignee[]; assigneeById: Record<string, SchoolAssignee>; assignmentEnabled: boolean;
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
  const assignee = assignees.find((person) => person.id === assigneeId);
  const assigneeLabel = assigneeId === "none" ? "미배정" : assignee?.name ?? "";
  const count = scope === "filtered" ? total : selectedCount;
  const toggle = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const open = (nextScope: "selected" | "filtered") => {
    setError("");
    setMessage("");
    if (!assigneeId) { setError("배정할 담당자를 선택해 주세요."); return; }
    if (nextScope === "selected" && selectedCount === 0) return;
    if (nextScope === "filtered" && (total < 1 || total > 5000)) return;
    setScope(nextScope);
    dialog.current?.showModal();
  };
  const confirm = () => {
    setError("");
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
    {admin && <div className="mt-5 flex flex-wrap items-end gap-3 rounded-xl bg-indigo-50 p-4">
      <label className="min-w-[220px] flex-1 text-sm font-semibold text-slate-700">배정할 담당자
        <select value={assigneeId} onChange={(event) => { setAssigneeId(event.target.value); setError(""); }} disabled={!assignmentEnabled} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3">
          <option value="">담당자 선택</option><option value="none">미배정으로 변경</option>
          {assignees.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.email}</option>)}
        </select>
      </label>
      <button type="button" onClick={() => open("selected")} disabled={!assignmentEnabled || !selectedCount} className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">선택 {selectedCount}개 배정</button>
      <button type="button" onClick={() => open("filtered")} disabled={!assignmentEnabled || total < 1 || total > 5000} className="rounded-xl border border-indigo-300 bg-white px-4 py-3 text-sm font-bold text-indigo-700 disabled:opacity-50">검색 결과 {total}개 배정</button>
      <p className="w-full text-xs text-slate-600">현재 페이지 선택 또는 필터에 맞는 모든 학교를 한 번에 배정할 수 있습니다. 이미 배정된 학교는 담당자가 변경됩니다.</p>
    </div>}
    {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {message && <p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p>}
    <div className="mt-5 space-y-3 lg:hidden">{rows.map((row) => <article key={row.id} className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-start gap-3">{checkbox(row, "mobile-school")}<div className="min-w-0 flex-1"><h3 className="break-words font-bold text-slate-950">{row.name}</h3><p className="mt-1 text-xs text-slate-500">{row.province} · {row.district} · {row.level}</p></div></div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm"><a href={`tel:${row.phone.replace(/[^+\d]/g, "")}`} className="text-indigo-700 underline">{row.phone}</a><span className={row.assigned_to ? "font-semibold text-indigo-700" : "text-slate-500"}>{assignedName(row)}</span></div>
    </article>)}</div>
    <div className="mt-5 hidden overflow-hidden rounded-xl border border-slate-200 lg:block">
      <table className="w-full table-fixed text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr>
        {admin && <th className="w-12 px-3 py-3"><input type="checkbox" checked={allPageSelected} onChange={() => setSelected(allPageSelected ? new Set() : new Set(rows.map((row) => row.id)))} aria-label="현재 페이지 전체 선택" className="h-5 w-5 accent-indigo-600" /></th>}
        <th className="w-[26%] px-3 py-3">학교명</th><th className="w-[19%] px-3 py-3">광역지역·지역</th><th className="w-[12%] px-3 py-3">학교급</th><th className="w-[18%] px-3 py-3">대표전화</th><th className="px-3 py-3">담당자</th>
      </tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.id} className="hover:bg-slate-50">
        {admin && <td className="px-3 py-3">{checkbox(row, "desktop-school")}</td>}
        <td className="break-words px-3 py-3 font-semibold text-slate-950">{row.name}</td><td className="px-3 py-3 text-slate-600">{row.province} · {row.district}</td><td className="px-3 py-3 text-slate-600">{row.level}</td><td className="px-3 py-3"><a href={`tel:${row.phone.replace(/[^+\d]/g, "")}`} className="text-indigo-700 underline">{row.phone}</a></td><td className="break-words px-3 py-3">{assignedName(row)}</td>
      </tr>)}</tbody></table>
    </div>
    {!rows.length && <p className="mt-5 rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">{total ? "이 페이지에 학교가 없습니다. 이전 페이지로 이동해 주세요." : "조건에 맞는 학교가 없습니다."}</p>}
    {rows.length > 0 && <p className="mt-3 text-right text-xs text-slate-500">{(page - 1) * schoolPageSize + 1}–{Math.min(page * schoolPageSize, total)} / {total.toLocaleString("ko-KR")}개</p>}
    <dialog ref={dialog} onCancel={(event) => { if (pending) event.preventDefault(); }} className="m-auto w-[min(92vw,500px)] rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl backdrop:bg-slate-950/60">
      <h2 className="text-xl font-bold text-slate-950">학교 담당자 배정 확인</h2>
      <p className="mt-3 text-sm leading-6 text-slate-700">{scope === "filtered" ? "현재 필터의 학교" : "선택한 학교"} <strong>{count}개</strong>를 <strong>{assigneeLabel}</strong>{assigneeId === "none" ? " 상태로 변경" : " 담당으로 배정"}합니다.</p>
      {scope === "selected" && <p className="mt-2 text-xs text-slate-500">{rows.filter((row) => selected.has(row.id)).slice(0, 5).map((row) => row.name).join(", ")}{selectedCount > 5 ? ` 외 ${selectedCount - 5}개` : ""}</p>}
      {scope === "filtered" && <p className="mt-2 text-xs text-slate-500">현재 페이지 외의 검색 결과도 포함됩니다.</p>}
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={pending} onClick={() => dialog.current?.close()} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold disabled:opacity-50">취소</button><button type="button" disabled={pending} onClick={confirm} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{pending ? "처리 중…" : "배정 확정"}</button></div>
    </dialog>
  </>;
}
