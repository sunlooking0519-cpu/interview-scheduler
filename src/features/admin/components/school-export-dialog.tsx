"use client";

import { useId, useRef, useState } from "react";
import { schoolExportColumns, type SchoolExportColumn } from "../school-export";

const defaultColumns: SchoolExportColumn[] = [
  "name", "province", "district", "level", "phone", "contactName", "contactPhone",
  "contactEmail", "contactDate", "updatedDate", "contactMethod", "proposalStatus", "reaction", "notes",
];

export function SchoolExportDialog({ manager, count, disabled }: {
  manager: { id: string; name: string }; count: number; disabled: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [selected, setSelected] = useState<SchoolExportColumn[]>(defaultColumns);
  const [includeHistory, setIncludeHistory] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const toggle = (column: SchoolExportColumn) => setSelected((current) => current.includes(column)
    ? current.filter((item) => item !== column)
    : schoolExportColumns.map(([key]) => key).filter((key) => current.includes(key) || key === column));
  const download = async () => {
    if (!selected.length || pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/admin/members/school-export", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managerId: manager.id, columns: selected, includeHistory }),
      });
      const type = response.headers.get("Content-Type") ?? "";
      if (!response.ok || !type.includes("spreadsheetml.sheet")) {
        const detail = type.includes("application/json") ? await response.json() as { error?: string } : null;
        throw new Error(detail?.error ?? "학교 엑셀 파일을 만들지 못했습니다. 다시 시도해 주세요.");
      }
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "schools.xlsx";
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 1000);
      dialog.current?.close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "학교 엑셀 파일을 만들지 못했습니다.");
    } finally {
      setPending(false);
    }
  };
  return <>
    <button type="button" disabled={disabled} onClick={() => { setError(""); dialog.current?.showModal(); }} className="rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-800 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50">엑셀 다운로드</button>
    <dialog ref={dialog} aria-labelledby={titleId} className="m-auto max-h-[min(90dvh,750px)] w-[min(92vw,620px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/60">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5 sm:p-6">
        <div><h3 id={titleId} className="text-xl font-bold text-slate-950">{manager.name} 학교 관리 엑셀 다운로드</h3><p className="mt-1 text-sm text-slate-600">현재 배정된 학교 {count}곳을 내보냅니다. 필요한 컬럼을 선택하세요.</p></div>
        <button type="button" disabled={pending} onClick={() => dialog.current?.close()} aria-label="닫기" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 disabled:opacity-50">닫기</button>
      </div>
      <div className="p-5 sm:p-6">
        <div className="flex justify-end gap-3 text-sm"><button type="button" onClick={() => setSelected(schoolExportColumns.map(([key]) => key))} className="font-semibold text-indigo-700">전체 선택</button><button type="button" onClick={() => setSelected([])} className="font-semibold text-slate-600">전체 해제</button></div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">{schoolExportColumns.map(([key, label]) => <label key={key} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-800 hover:border-indigo-300"><input type="checkbox" checked={selected.includes(key)} onChange={() => toggle(key)} className="h-4 w-4 accent-indigo-600" />{label}</label>)}</div>
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl bg-indigo-50 p-4 text-sm text-indigo-950"><input type="checkbox" checked={includeHistory} onChange={(event) => setIncludeHistory(event.target.checked)} className="mt-0.5 h-4 w-4 accent-indigo-600" /><span><strong>활동 기록 시트 포함</strong><span className="mt-1 block text-xs text-indigo-700">배정 학교의 접촉일·접촉 방식·반응·상담 내용을 기록별로 보여줍니다. 삭제된 기록은 제외합니다.</span></span></label>
        {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={pending} onClick={() => dialog.current?.close()} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">취소</button><button type="button" onClick={download} disabled={pending || selected.length === 0} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{pending ? "파일 만드는 중…" : `${selected.length}개 컬럼 다운로드`}</button></div>
      </div>
    </dialog>
  </>;
}
