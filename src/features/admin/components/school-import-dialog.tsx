"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Preview = {
  total: number; added: number; changed: number; unchanged: number;
  issueCount: number; issues: { row: number; message: string }[]; fingerprint: string;
};

export function SchoolImportDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const close = () => { if (!pending) dialog.current?.close(); };
  const submit = async (mode: "preview" | "apply") => {
    if (!file || pending) return;
    setPending(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("mode", mode);
      if (mode === "apply" && preview) form.set("fingerprint", preview.fingerprint);
      const response = await fetch("/admin/schools/import", { method: "POST", body: form, credentials: "same-origin" });
      const data = await response.json() as Preview & { error?: string; applied?: boolean };
      if (!response.ok) throw new Error(data.error ?? "엑셀 업로드를 처리하지 못했습니다.");
      if (mode === "preview") setPreview(data);
      else {
        setResult(`학교 ${data.added}곳 추가 · ${data.changed}곳 기본정보 변경 · ${data.unchanged}곳 변경 없음`);
        dialog.current?.close();
        setPreview(null);
        setFile(null);
        if (fileInput.current) fileInput.current.value = "";
        router.refresh();
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "엑셀 업로드를 처리하지 못했습니다."); }
    finally { setPending(false); }
  };
  return <>
    <button type="button" onClick={() => { setError(""); dialog.current?.showModal(); }} className="rounded-xl border border-indigo-300 bg-white px-4 py-2.5 text-sm font-bold text-indigo-700 hover:bg-indigo-50">학교 엑셀 업로드</button>
    {result && <p role="status" className="mt-2 text-sm font-semibold text-emerald-700">{result}</p>}
    <dialog ref={dialog} className="m-auto max-h-[90dvh] w-[min(92vw,640px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/60">
      <div className="flex items-start justify-between gap-3 border-b p-5 sm:p-6"><div><h2 className="text-xl font-bold text-slate-950">학교목록 엑셀 업로드</h2><p className="mt-1 text-sm text-slate-600">기존 파일의 ‘학교목록’과 ‘학교별 근거’ 시트가 필요합니다.</p></div><button type="button" onClick={close} disabled={pending} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">닫기</button></div>
      <div className="space-y-4 p-5 sm:p-6">
        <p className="rounded-xl bg-indigo-50 p-4 text-sm leading-6 text-indigo-950">학교코드로 기존 학교를 찾습니다. 새 학교는 추가하고, 이름·지역·대표전화·자료 기준일이 달라진 학교는 기본정보만 갱신합니다. 담당자 배정과 영업 활동 기록은 유지됩니다. 파일에 없는 학교도 삭제되지 않습니다.</p>
        <label className="block text-sm font-semibold text-slate-800">엑셀 파일 (.xlsx, 최대 5MB)<input ref={fileInput} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPreview(null); setError(""); }} className="mt-2 block w-full rounded-xl border p-3 text-sm" /></label>
        <button type="button" onClick={() => submit("preview")} disabled={!file || pending} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{pending ? "비교 중…" : "변경 내용 미리보기"}</button>
        {preview && <section className="rounded-xl border border-slate-200 p-4"><h3 className="font-bold text-slate-950">업로드 미리보기</h3><p className="mt-2 text-sm text-slate-700">파일 {preview.total}행 · <strong className="text-emerald-700">신규 {preview.added}</strong> · <strong className="text-indigo-700">기본정보 변경 {preview.changed}</strong> · 변경 없음 {preview.unchanged} · 검토 필요 {preview.issueCount}</p>
          {preview.issueCount > 0 && <div className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800"><p className="font-bold">검토 필요 행을 수정한 뒤 다시 업로드해 주세요.</p><ul className="mt-2 max-h-44 space-y-1 overflow-y-auto">{preview.issues.map((issue, index) => <li key={index}>{issue.row}행: {issue.message}</li>)}</ul>{preview.issueCount > preview.issues.length && <p className="mt-2">외 {preview.issueCount - preview.issues.length}건</p>}</div>}
          <button type="button" onClick={() => submit("apply")} disabled={pending || preview.issueCount > 0 || preview.total === 0} className="mt-4 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{pending ? "반영 중…" : `${preview.added + preview.changed}곳 DB 반영`}</button>
        </section>}
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      </div>
    </dialog>
  </>;
}
