"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSchoolActivity, editSchoolActivity, type SchoolActivityCorrection } from "@/app/admin/schools/activity-actions";
import type { SchoolHistory } from "./school-follow-up-dialog";
import { methodLabels, proposalLabels, reactionLabels } from "../school-contact-labels";

const fieldClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const text = (value: string | null, labels?: Record<string, string>) => value ? (labels?.[value] ?? value) : "미기록";

export function SchoolActivityEntry({ item, schoolId, today, latest }: { item: SchoolHistory; schoolId: string; today: string; latest: boolean }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const correction = { schoolId, activityId: item.id, expectedVersion: item.edit_version };
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) ?? "");
    const input: SchoolActivityCorrection = {
      ...correction, contactDate: value("contact_date"), updateDate: value("update_date"),
      contactName: value("contact_name"), contactEmail: value("contact_email"), contactPhone: value("contact_phone"),
      contactMethod: value("contact_method"), proposalStatus: value("proposal_status"),
      reaction: value("reaction"), newNote: value("new_note"),
    };
    startTransition(async () => {
      const result = await editSchoolActivity(input);
      if (result.error) setError(result.error);
      else { setEditing(false); router.refresh(); }
    });
  };
  const remove = () => {
    setError("");
    startTransition(async () => {
      const result = await deleteSchoolActivity(correction);
      if (result.error) setError(result.error);
      else { dialog.current?.close(); router.refresh(); }
    });
  };
  return <li className="border-l-2 border-indigo-300 pl-4 text-sm">
    <p className="font-bold text-slate-900">{item.contact_date} · {text(item.contact_method, methodLabels)}</p>
    <p className="mt-1 text-xs text-slate-500">업데이트 {item.update_date} · 기록 {new Date(item.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}{item.edited_at ? " · 수정됨" : ""}</p>
    <p className="mt-2 text-slate-700">{item.change_summary}</p>
    <p className="mt-1 text-slate-600">제안서 {text(item.proposal_status, proposalLabels)} · 반응 {text(item.reaction, reactionLabels)}</p>
    {(item.contact_name || item.contact_email || item.contact_phone) && <p className="mt-1 break-all text-slate-600">{[item.contact_name, item.contact_phone, item.contact_email].filter(Boolean).join(" · ")}</p>}
    {item.new_note && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-slate-800">{item.new_note}</p>}
    <div className="mt-3 flex gap-3"><button type="button" onClick={() => { setEditing(!editing); setError(""); }} className="font-semibold text-indigo-700 underline">{editing ? "수정 닫기" : "수정"}</button><button type="button" onClick={() => { setError(""); dialog.current?.showModal(); }} className="font-semibold text-rose-700 underline">삭제</button></div>
    {editing && <form onSubmit={submit} className="mt-3 grid gap-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 sm:grid-cols-2">
      <p className="font-bold text-slate-900 sm:col-span-2">이 활동 기록 수정</p>
      <label>접촉일<input name="contact_date" type="date" required max={today} defaultValue={item.contact_date} className={fieldClass} /></label>
      <label>업데이트 날짜<input name="update_date" type="date" required max={today} defaultValue={item.update_date} className={fieldClass} /></label>
      <label>학교 담당자<input name="contact_name" maxLength={120} defaultValue={item.contact_name ?? ""} className={fieldClass} /></label>
      <label>담당자 전화번호<input name="contact_phone" type="tel" maxLength={80} defaultValue={item.contact_phone ?? ""} className={fieldClass} /></label>
      <label className="sm:col-span-2">담당자 이메일<input name="contact_email" type="email" maxLength={200} defaultValue={item.contact_email ?? ""} className={fieldClass} /></label>
      <label>접촉 방식<select name="contact_method" required defaultValue={item.contact_method} className={fieldClass}>{Object.entries(methodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>제안서 제출<select name="proposal_status" defaultValue={item.proposal_status ?? ""} className={fieldClass}><option value="">미기록</option>{Object.entries(proposalLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>반응<select name="reaction" defaultValue={item.reaction ?? ""} className={fieldClass}><option value="">미기록</option>{Object.entries(reactionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="sm:col-span-2">특이사항 · 상담 내용<textarea name="new_note" rows={4} maxLength={5000} defaultValue={item.new_note ?? ""} className={fieldClass} /></label>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-700 sm:col-span-2">{error}</p>}
      <div className="flex gap-2 sm:col-span-2"><button type="button" onClick={() => setEditing(false)} disabled={pending} className="rounded-lg border px-4 py-2 font-semibold">취소</button><button type="submit" disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-2 font-bold text-white disabled:opacity-50">{pending ? "저장 중…" : "수정 저장"}</button></div>
    </form>}
    <dialog ref={dialog} onCancel={(event) => { if (pending) event.preventDefault(); }} className="m-auto w-[min(92vw,480px)] rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl backdrop:bg-slate-950/60">
      <h3 className="text-lg font-bold text-slate-950">이 활동을 삭제할까요?</h3>
      <p className="mt-3 text-sm text-slate-700">{item.contact_date} · {text(item.contact_method, methodLabels)} 기록을 타임라인에서 제거합니다.</p>
      {item.new_note && <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">상담 내용: {item.new_note}</p>}
      <p className="mt-3 text-sm text-amber-800">{latest ? "가장 최근 활동이므로 학교의 현재 담당자·제안서·반응 상태가 이전 기록으로 돌아갑니다. " : "과거 활동의 상담 내용이 누적 메모에서 제거됩니다. "}기록은 감사용으로 보관되며 일반 목록에는 표시되지 않습니다.</p>
      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => dialog.current?.close()} disabled={pending} className="rounded-lg border px-4 py-2 font-semibold">취소</button><button type="button" onClick={remove} disabled={pending} className="rounded-lg bg-rose-600 px-4 py-2 font-bold text-white disabled:opacity-50">{pending ? "삭제 중…" : "활동 삭제"}</button></div>
    </dialog>
  </li>;
}
