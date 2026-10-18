"use client";

import { useEffect, useRef, useState } from "react";
import { restoreProposalVersion, saveProposal } from "@/app/admin/sales/actions";

type Proposal = { id: string; title: string; body: string; revision: number };
type Version = { id: string; revision_number: number; title: string; created_at: string };

export function ProposalEditor({ proposal, versions }: { proposal: Proposal; versions: Version[] }) {
  const [title, setTitle] = useState(proposal.title);
  const [body, setBody] = useState(proposal.body);
  const [revision, setRevision] = useState(proposal.revision);
  const [status, setStatus] = useState("저장됨");
  const [history, setHistory] = useState(versions);
  const saved = useRef({ title: proposal.title, body: proposal.body });
  const busy = useRef(false);
  const revisionRef = useRef(proposal.revision);

  async function persist(nextTitle: string, nextBody: string) {
    if (busy.current || (saved.current.title === nextTitle && saved.current.body === nextBody)) return;
    busy.current = true;
    setStatus("저장 중…");
    try {
      const result = await saveProposal(proposal.id, revisionRef.current, nextTitle, nextBody);
      if (result.error) { setStatus(result.error); return; }
      revisionRef.current = result.revision;
      setRevision(result.revision);
      saved.current = { title: nextTitle, body: nextBody };
      setHistory((items) => [{ id: `new-${result.revision}`, revision_number: result.revision, title: nextTitle, created_at: new Date().toISOString() }, ...items].slice(0, 20));
      setStatus("저장됨");
    } catch { setStatus("저장 실패. 저장 버튼으로 다시 시도해 주세요."); }
    finally { busy.current = false; }
  }

  useEffect(() => {
    if (saved.current.title === title && saved.current.body === body) return;
    const timer = setTimeout(() => { void persist(title, body); }, 1500);
    return () => clearTimeout(timer);
  // The latest draft is intentionally saved after the editing pause.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body, revision]);

  async function restore(id: string) {
    if (busy.current || id.startsWith("new-")) { setStatus("새로고침 후 복원해 주세요."); return; }
    if (saved.current.title !== title || saved.current.body !== body) { setStatus("현재 내용을 먼저 저장해 주세요."); return; }
    busy.current = true;
    setStatus("복원 중…");
    try {
      const result = await restoreProposalVersion(proposal.id, id, revisionRef.current);
      if (result.error) { setStatus(result.error); return; }
      // Refresh to read the restored snapshot from the server.
      window.location.reload();
    } catch { setStatus("복원하지 못했습니다."); }
    finally { busy.current = false; }
  }

  return <article className="rounded-xl border border-slate-200 p-3 sm:p-4"><div className="flex items-center justify-between gap-2"><strong>제안서 편집</strong><span className="text-xs text-slate-500">버전 {revision}</span></div><label className="mt-3 block text-sm">제목<input value={title} onChange={(event) => { setTitle(event.target.value); setStatus("수정 중…"); }} maxLength={200} className="mt-1 w-full rounded-xl border border-slate-300 p-3"/></label><label className="mt-3 block text-sm">내용<textarea value={body} onChange={(event) => { setBody(event.target.value); setStatus("수정 중…"); }} rows={10} maxLength={100000} placeholder="제안 배경, 목표, 제공 내용, 일정, 금액, 후속 조치 등을 작성하세요." className="mt-1 w-full rounded-xl border border-slate-300 p-3"/></label><div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" onClick={() => void persist(title, body)} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">지금 저장</button><span role="status" className="text-sm text-slate-600">{status}</span></div><details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-indigo-700">이전 버전 보기</summary><div className="mt-2 space-y-2">{history.map((version) => <div key={version.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 p-2 text-sm"><span className="min-w-0 truncate">v{version.revision_number} · {version.title}</span><button type="button" onClick={() => void restore(version.id)} className="shrink-0 text-indigo-700 disabled:text-slate-400" disabled={version.revision_number === revision}>복원</button></div>)}</div></details></article>;
}
