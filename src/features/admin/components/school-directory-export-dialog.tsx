"use client";

import { useId, useRef, useState } from "react";
import { schoolDirectoryColumns, schoolDirectorySheets,
  type SchoolDirectoryColumn, type SchoolDirectorySheet } from "../school-directory-export";

const defaultColumns: SchoolDirectoryColumn[] = [
  "name", "province", "district", "level", "phone", "assignedManager",
  "contactName", "contactPhone", "contactEmail", "contactDate", "lastActivityAt",
  "proposalStatus", "reaction", "notes",
];

export function SchoolDirectoryExportDialog({ currentView, admin }: {
  currentView: SchoolDirectorySheet; admin: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [sheets, setSheets] = useState<SchoolDirectorySheet[]>([currentView]);
  const [columns, setColumns] = useState<SchoolDirectoryColumn[]>(defaultColumns);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const toggleSheet = (view: SchoolDirectorySheet) => setSheets((current) => current.includes(view)
    ? current.filter((item) => item !== view)
    : schoolDirectorySheets.map(([key]) => key).filter((key) => current.includes(key) || key === view));
  const toggleColumn = (column: SchoolDirectoryColumn) => setColumns((current) => current.includes(column)
    ? current.filter((item) => item !== column)
    : schoolDirectoryColumns.map(([key]) => key).filter((key) => current.includes(key) || key === column));

  const download = async () => {
    if (pending || !sheets.length || !columns.length) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/admin/schools/export", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheets, columns }),
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
      link.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "school-directory.xlsx";
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
    <button type="button" onClick={() => { setError(""); dialog.current?.showModal(); }}
      className="rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2.5 text-sm font-bold text-indigo-800 hover:bg-indigo-100">엑셀 다운로드</button>
    <dialog ref={dialog} aria-labelledby={titleId} onCancel={(event) => { if (pending) event.preventDefault(); }}
      className="m-auto max-h-[90dvh] w-[min(92vw,680px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/60">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5 sm:p-6">
        <div><h2 id={titleId} className="text-xl font-bold text-slate-950">학교 엑셀 다운로드</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{admin ? "선택한 탭의 전체 학교를 각각 별도 시트로 내보냅니다." : "내게 배정된 학교만 선택한 탭별 시트로 내보냅니다."} 현재 검색 조건과 페이지는 적용되지 않습니다.</p></div>
        <button type="button" disabled={pending} onClick={() => dialog.current?.close()} aria-label="닫기" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 disabled:opacity-50">닫기</button>
      </div>
      <div className="space-y-6 p-5 sm:p-6">
        <fieldset>
          <legend className="text-sm font-bold text-slate-900">시트 선택</legend>
          <p className="mt-1 text-xs text-slate-500">여러 탭을 선택하면 한 엑셀 파일에 시트가 나뉘어 저장됩니다.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">{schoolDirectorySheets.map(([view, label]) => <label key={view} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-800 hover:border-indigo-300">
            <input type="checkbox" checked={sheets.includes(view)} onChange={() => toggleSheet(view)} className="h-4 w-4 accent-indigo-600" />{label}
          </label>)}</div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-bold text-slate-900">다운로드 필드 선택</legend>
          <div className="mt-1 flex justify-end gap-3 text-sm"><button type="button" onClick={() => setColumns(schoolDirectoryColumns.map(([key]) => key))} className="font-semibold text-indigo-700">전체 선택</button><button type="button" onClick={() => setColumns([])} className="font-semibold text-slate-600">전체 해제</button></div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">{schoolDirectoryColumns.map(([key, label]) => <label key={key} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-800 hover:border-indigo-300">
            <input type="checkbox" checked={columns.includes(key)} onChange={() => toggleColumn(key)} className="h-4 w-4 accent-indigo-600" />{label}
          </label>)}</div>
        </fieldset>
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-sm text-slate-600">선택한 시트 {sheets.length}개 · 필드 {columns.length}개</p>
          <div className="flex gap-2"><button type="button" disabled={pending} onClick={() => dialog.current?.close()} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">취소</button>
            <button type="button" onClick={download} disabled={pending || !sheets.length || !columns.length} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{pending ? "파일 만드는 중…" : "엑셀 다운로드"}</button></div>
        </div>
      </div>
    </dialog>
  </>;
}
