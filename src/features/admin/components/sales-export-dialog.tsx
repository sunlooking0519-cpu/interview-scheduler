"use client";

import { useId, useRef, useState } from "react";
import { salesExportColumns, type SalesExportColumn, type SalesExportFilters } from "../sales-export";

const defaultColumns: SalesExportColumn[] = [
  "organization", "category", "region", "visitDate", "updatedDate",
  "proposalStatus", "reaction", "contactNames", "phone", "mobile", "email",
];

export function SalesExportDialog({ filters, count, disabled, manager }: {
  filters?: SalesExportFilters; count: number; disabled: boolean;
  manager?: { id: string; name: string };
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [selected, setSelected] = useState<SalesExportColumn[]>(defaultColumns);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const toggle = (column: SalesExportColumn) => setSelected((current) => current.includes(column)
    ? current.filter((item) => item !== column)
    : salesExportColumns.map(([key]) => key).filter((key) => current.includes(key) || key === column));
  const download = async () => {
    if (!selected.length || pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(manager ? "/admin/members/sales-export" : "/admin/sales/export", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manager ? { columns: selected, managerId: manager.id } : { columns: selected, filters }),
      });
      const type = response.headers.get("Content-Type") ?? "";
      if (!response.ok || !type.includes("spreadsheetml.sheet")) {
        const detail = type.includes("application/json") ? await response.json() as { error?: string } : null;
        throw new Error(detail?.error ?? "엑셀 파일을 만들지 못했습니다. 다시 로그인한 뒤 시도해 주세요.");
      }
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "sales-organizations.xlsx";
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 1000);
      dialog.current?.close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "엑셀 파일을 만들지 못했습니다.");
    } finally {
      setPending(false);
    }
  };
  return <>
    <button type="button" disabled={disabled} onClick={() => { setError(""); dialog.current?.showModal(); }} className="rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-800 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50">엑셀 다운로드</button>
    <dialog ref={dialog} aria-labelledby={titleId} className="m-auto max-h-[min(90dvh,750px)] w-[min(92vw,620px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/60">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5 sm:p-6">
        <div><h3 id={titleId} className="text-xl font-bold text-slate-950">{manager ? `${manager.name} 영업 엑셀 다운로드` : "엑셀 다운로드"}</h3><p className="mt-1 text-sm text-slate-600">{manager ? `이 강사의 전체 기관 ${count}곳` : `현재 목록의 ${count}개 기관`}을 내보냅니다. 필요한 컬럼을 선택하세요.</p></div>
        <button type="button" onClick={() => dialog.current?.close()} aria-label="닫기" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600">닫기</button>
      </div>
      <div className="p-5 sm:p-6">
        <div className="flex justify-end gap-3 text-sm"><button type="button" onClick={() => setSelected(salesExportColumns.map(([key]) => key))} className="font-semibold text-indigo-700">전체 선택</button><button type="button" onClick={() => setSelected([])} className="font-semibold text-slate-600">전체 해제</button></div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">{salesExportColumns.map(([key, label]) => <label key={key} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-800 hover:border-indigo-300"><input type="checkbox" checked={selected.includes(key)} onChange={() => toggle(key)} className="h-4 w-4 accent-indigo-600"/>{label}</label>)}</div>
        {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => dialog.current?.close()} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold">취소</button><button type="button" onClick={download} disabled={pending || selected.length === 0} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{pending ? "파일 만드는 중…" : `${selected.length}개 컬럼 다운로드`}</button></div>
      </div>
    </dialog>
  </>;
}
