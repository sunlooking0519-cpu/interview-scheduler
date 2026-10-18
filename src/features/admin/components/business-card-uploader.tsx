"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../../lib/supabase/client";
import { saveBusinessCard } from "@/app/admin/sales/actions";
import { guessSalesCardFields, type SalesCardFields } from "@/features/admin/sales-card-ocr";
import { recognizeBusinessCard } from "@/features/admin/recognize-business-card";

const types: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const names: Record<string, string> = { name: "이름", organization: "기관·회사", title: "직책", phone: "전화", email: "이메일" };

export function BusinessCardUploader({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [fields, setFields] = useState<SalesCardFields>({ name: "", organization: "", title: "", phone: "", email: "" });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function recognize() {
    if (!file || busy) return;
    setBusy(true);
    setStatus("명함을 인식 중입니다. Google Vision에 연결합니다.");
    try {
      const result = await recognizeBusinessCard(file);
      setOcrText(result.text);
      setFields(guessSalesCardFields(result.text));
      setStatus(result.note);
    } catch (error) { setStatus(error instanceof Error ? error.message : "글자 인식에 실패했습니다. 네트워크를 확인하거나 직접 입력해 주세요."); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!file || busy) return;
    setBusy(true);
    setStatus("명함 저장 중…");
    try {
      const path = `${organizationId}/${crypto.randomUUID()}.${types[file.type]}`;
      const supabase = createClient();
      const upload = await supabase.storage.from("sales-cards").upload(path, file, { contentType: file.type, upsert: false });
      if (upload.error) throw new Error("이미지 업로드에 실패했습니다. 버킷과 관리자 정책을 확인해 주세요.");
      const result = await saveBusinessCard({ organizationId, imagePath: path, ocrText, fields });
      if (result.error) {
        await supabase.storage.from("sales-cards").remove([path]);
        throw new Error(result.error);
      }
      setFile(null); setOcrText(""); setFields({ name: "", organization: "", title: "", phone: "", email: "" });
      setStatus("명함을 저장했습니다.");
      router.refresh();
    } catch (error) { setStatus(error instanceof Error ? error.message : "명함을 저장하지 못했습니다."); }
    finally { setBusy(false); }
  }

  return <div className="mt-4 rounded-xl bg-slate-50 p-3"><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" aria-label="명함 사진 선택" onChange={(event) => { const next = event.target.files?.[0] ?? null; if (next && (!types[next.type] || next.size > 10 * 1024 * 1024)) { setStatus("JPG, PNG, WebP 파일을 10MB 이하로 선택해 주세요."); setFile(null); return; } setFile(next); setOcrText(""); setStatus(""); }} className="w-full text-sm"/><button type="button" onClick={() => void recognize()} disabled={!file || busy} className="mt-3 rounded-xl border border-indigo-300 px-4 py-2 text-sm font-semibold text-indigo-700 disabled:opacity-50">사진에서 글자 인식</button><p role="status" className="mt-2 text-sm text-slate-600">{status}</p>{file && <div className="mt-3 space-y-3"><label className="block text-sm">인식된 전체 텍스트<textarea value={ocrText} onChange={(event) => setOcrText(event.target.value)} rows={5} maxLength={20000} className="mt-1 w-full rounded-xl border border-slate-300 p-3"/></label><div className="grid gap-2 sm:grid-cols-2">{Object.entries(names).map(([key, name]) => <label key={key} className="text-sm">{name}<input value={fields[key as keyof SalesCardFields]} onChange={(event) => setFields({ ...fields, [key]: event.target.value })} maxLength={500} className="mt-1 w-full rounded-xl border border-slate-300 p-3"/></label>)}</div><button type="button" onClick={() => void save()} disabled={busy} className="rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white disabled:opacity-50">명함과 텍스트 저장</button></div>}</div>;
}
