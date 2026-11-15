"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSchoolFollowUp, type SchoolFollowUpInput } from "@/app/admin/schools/follow-up-action";
import type { SchoolRow } from "./school-table";
import { methodLabels, proposalLabels, reactionLabels } from "../school-contact-labels";

export type SchoolHistory = {
  id: string; school_id: string; contact_date: string; update_date: string;
  contact_name: string | null; contact_email: string | null; contact_phone: string | null;
  contact_method: string; proposal_status: string | null; reaction: string | null;
  new_note: string | null; change_summary: string; created_at: string;
};

const inputClass = "mt-1 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm";

export function SchoolFollowUpEditor({ school, today, onClose }: { school: SchoolRow; today: string; onClose?: () => void }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) ?? "");
    const input: SchoolFollowUpInput = {
      schoolId: school.id, contactDate: value("contact_date"), updateDate: value("update_date"),
      contactName: value("contact_name"), contactEmail: value("contact_email"), contactPhone: value("contact_phone"),
      contactMethod: value("contact_method"), proposalStatus: value("proposal_status"),
      reaction: value("reaction"), newNote: value("new_note"),
    };
    startTransition(async () => {
      const result = await saveSchoolFollowUp(input);
      if (result.error) setError(result.error);
      else { setSaved(true); router.refresh(); }
    });
  };
  if (saved) return <div className="p-5 sm:p-6"><p role="status" className="rounded-xl bg-emerald-50 p-4 font-semibold text-emerald-800">학교 후속관리 기록을 저장했습니다. 활동 이력과 강사관리 현황에 반영됩니다.</p><button type="button" onClick={() => { if (onClose) onClose(); else setSaved(false); }} className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white">{onClose ? "닫기" : "다음 활동 기록"}</button></div>;
  return <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
    <label className="text-sm font-semibold text-slate-700">학교 담당자 이름<input name="contact_name" maxLength={120} defaultValue={school.contact_name ?? ""} placeholder="알고 있다면 입력" className={inputClass} /></label>
    <label className="text-sm font-semibold text-slate-700">담당자 이메일<input name="contact_email" type="email" maxLength={200} defaultValue={school.contact_email ?? ""} placeholder="알고 있다면 입력" className={inputClass} /></label>
    <label className="text-sm font-semibold text-slate-700">학교 담당자 전화번호<input name="contact_phone" type="tel" maxLength={80} defaultValue={school.contact_phone ?? ""} placeholder="대표전화와 다르면 입력" className={inputClass} /></label>
    <label className="text-sm font-semibold text-slate-700">학교 대표전화<input readOnly value={school.phone} className={`${inputClass} bg-slate-100 text-slate-600`} /></label>
    <label className="text-sm font-semibold text-slate-700">접촉일<input name="contact_date" type="date" required max={today} defaultValue={school.contact_date ?? today} className={inputClass} /></label>
    <label className="text-sm font-semibold text-slate-700">접촉 지역<input readOnly value={`${school.province} ${school.district}`} className={`${inputClass} bg-slate-100 text-slate-600`} /></label>
    <label className="text-sm font-semibold text-slate-700">제안서 제출<select name="proposal_status" defaultValue={school.proposal_status ?? ""} className={inputClass}><option value="">미기록</option>{Object.entries(proposalLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label className="text-sm font-semibold text-slate-700">반응<select name="reaction" defaultValue={school.reaction ?? ""} className={inputClass}><option value="">미기록</option>{Object.entries(reactionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label className="text-sm font-semibold text-slate-700">접촉 방식<select name="contact_method" required defaultValue={school.contact_method ?? ""} className={inputClass}><option value="" disabled>방식 선택</option>{Object.entries(methodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label className="text-sm font-semibold text-slate-700">업데이트 날짜<input name="update_date" type="date" required max={today} defaultValue={today} className={inputClass} /><span className="mt-1 block text-xs font-normal text-slate-500">관리 상태를 기록한 날짜입니다.</span></label>
    <label className="text-sm font-semibold text-slate-700 sm:col-span-2">기존 특이사항 · 상담 내용<textarea readOnly rows={4} value={school.notes ?? ""} placeholder="이전 내용이 없습니다." className={`${inputClass} bg-slate-100 text-slate-600`} /><span className="mt-1 block text-xs font-normal text-slate-500">이전에 추가한 상담 내용입니다. 상태 변경을 포함한 전체 이력은 학교 상세페이지에서 확인하세요.</span></label>
    <label className="text-sm font-semibold text-slate-700 sm:col-span-2">이번에 추가할 특이사항<textarea name="new_note" rows={3} maxLength={5000} placeholder="새로 확인한 내용만 입력하세요. 상태만 변경할 때는 비워 두세요." className={inputClass} /></label>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 sm:col-span-2">{error}</p>}
    <div className="flex justify-end gap-2 sm:col-span-2">{onClose && <button type="button" onClick={onClose} disabled={pending} className="rounded-xl border px-4 py-3 text-sm font-semibold">취소</button>}<button type="submit" disabled={pending} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{pending ? "저장 중…" : "현재 상태 저장"}</button></div>
  </form>;
}

export function SchoolFollowUpDialog({ school, today }: { school: SchoolRow; today: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [opened, setOpened] = useState(false);
  const close = () => { dialog.current?.close(); setOpened(false); };
  return <>
    <button type="button" onClick={() => { setOpened(true); dialog.current?.showModal(); }} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-700">후속관리</button>
    <dialog ref={dialog} onClose={() => setOpened(false)} className="m-auto max-h-[min(92dvh,850px)] w-[min(92vw,650px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/60">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-white p-5 sm:p-6">
        <div><p className="text-xs font-bold text-indigo-600">학교 접촉 · 후속관리</p><h2 className="mt-1 text-xl font-bold text-slate-950">{school.name}</h2><p className="mt-1 text-sm text-slate-500">{school.province} · {school.district} · {school.level}</p></div>
        <button type="button" onClick={close} aria-label="팝업 닫기" className="rounded-lg border px-3 py-2 text-sm text-slate-600">닫기</button>
      </div>
      {opened && <SchoolFollowUpEditor school={school} today={today} onClose={close} />}
    </dialog>
  </>;
}
