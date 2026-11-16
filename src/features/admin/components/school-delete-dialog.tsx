"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSelectedSchools, previewSchoolDeletion, type SchoolDeletionPreview } from "@/app/admin/schools/delete-actions";

const methodLabels: Record<string, string> = { visit: "방문", call: "전화", email: "이메일", referral: "지인 소개" };

export function SchoolDeleteDialog({ selectedIds, onDeleted }: {
  selectedIds: string[]; onDeleted: (count: number) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [preview, setPreview] = useState<SchoolDeletionPreview | null>(null);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, startTransition] = useTransition();
  const open = () => {
    if (!selectedIds.length) return;
    setPreview(null);
    setError("");
    setConfirmation("");
    const ids = [...selectedIds];
    dialog.current?.showModal();
    startTransition(async () => {
      const result = await previewSchoolDeletion(ids);
      setPreview(result.preview);
      setError(result.error);
    });
  };
  const confirm = () => {
    if (!preview || confirmation !== "삭제") return;
    setError("");
    startTransition(async () => {
      const result = await deleteSelectedSchools(preview.schools.map((school) => school.id), preview.fingerprint);
      if (result.error) { setError(result.error); return; }
      dialog.current?.close();
      onDeleted(result.deleted);
      router.refresh();
    });
  };
  const total = preview?.schools.reduce((acc, school) => ({
    assignments: acc.assignments + school.assignmentHistory,
    contacts: acc.contacts + school.contactHistory,
    revisions: acc.revisions + school.revisions,
  }), { assignments: 0, contacts: 0, revisions: 0 });

  return <>
    <button type="button" onClick={open} disabled={!selectedIds.length || pending}
      className="rounded-xl border border-rose-300 bg-white px-4 py-3 text-sm font-bold text-rose-700 disabled:opacity-50">선택 {selectedIds.length}개 삭제</button>
    <dialog ref={dialog} onCancel={(event) => { if (pending) event.preventDefault(); }}
      className="m-auto max-h-[90dvh] w-[min(94vw,680px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl backdrop:bg-slate-950/60">
      <h2 className="text-xl font-bold text-slate-950">선택한 학교 삭제 영향 확인</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">학교를 삭제하면 배정 내역, 접촉·영업 활동, 활동 수정·삭제 이력도 함께 영구 삭제됩니다.</p>
      {pending && !preview && <p role="status" className="mt-4 text-sm text-slate-600">연결된 기록을 확인하는 중…</p>}
      {preview && <>
        <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-800">
          학교 {preview.schools.length}곳 · 배정 이력 {total?.assignments ?? 0}건 · 접촉 기록 {total?.contacts ?? 0}건 · 활동 수정·삭제 이력 {total?.revisions ?? 0}건
        </p>
        <div className="mt-3 max-h-[45dvh] space-y-3 overflow-y-auto pr-1">
          {preview.schools.map((school) => <section key={school.id} className="rounded-xl border border-slate-200 p-3">
            <h3 className="font-bold text-slate-900">{school.name}</h3>
            <p className="mt-1 text-xs text-slate-600">{school.province} · {school.district} · {school.level} · 배정 담당자 {school.assignedTo || "미배정"}</p>
            <p className="mt-1 text-xs text-slate-600">학교 담당자 {school.contactName || "미기록"} · 접촉일 {school.contactDate || "미기록"} · 최근 업데이트 {school.managementUpdatedOn || "미기록"}</p>
            <p className="mt-2 text-sm text-slate-700">배정 이력 {school.assignmentHistory}건 · 접촉 기록 {school.contactHistory}건(활성 {school.activeActivities}건) · 수정·삭제 이력 {school.revisions}건</p>
            {school.notes && <p className="mt-2 break-words rounded-lg bg-amber-50 p-2 text-xs text-slate-700">누적 상담 내용: {school.notes}{school.notes.length === 500 ? "…" : ""}</p>}
            {school.recentActivities.length > 0 && <div className="mt-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
              <p className="font-semibold">최근 접촉 기록</p>
              <ul className="mt-1 space-y-1">{school.recentActivities.map((activity, index) => <li key={index} className="break-words">
                {activity.date} · {methodLabels[activity.method] ?? activity.method} · {activity.summary}{activity.note ? ` · ${activity.note}` : ""}
              </li>)}</ul>
              {school.activeActivities > school.recentActivities.length && <p className="mt-1 text-slate-500">최근 {school.recentActivities.length}건만 표시합니다.</p>}
            </div>}
          </section>)}
        </div>
        <label className="mt-4 block text-sm font-semibold text-slate-700">영구 삭제하려면 ‘삭제’를 입력하세요
          <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off"
            className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm" />
        </label>
      </>}
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" disabled={pending} onClick={() => dialog.current?.close()} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold disabled:opacity-50">취소</button>
        {preview && <button type="button" disabled={pending || confirmation !== "삭제"} onClick={confirm}
          className="rounded-xl bg-rose-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{pending ? "삭제 중…" : `${preview.schools.length}개 영구 삭제`}</button>}
      </div>
    </dialog>
  </>;
}
