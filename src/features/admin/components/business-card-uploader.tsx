"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../../lib/supabase/client";
import { saveBusinessCard } from "@/app/admin/sales/actions";
import { guessSalesCardFields, type SalesCardFields } from "@/features/admin/sales-card-ocr";
import { recognizeBusinessCard, recognizeBusinessCardField, type CardField } from "@/features/admin/recognize-business-card";
import { BusinessCardCropper } from "@/features/admin/components/business-card-cropper";

const types: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const names: Record<string, string> = { name: "이름", organization: "기관·회사", title: "직책", phone: "전화", email: "이메일" };
const emptyFields: SalesCardFields = { name: "", organization: "", title: "", phone: "", email: "" };

export function BusinessCardUploader({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [croppedFile, setCroppedFile] = useState<File | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [fields, setFields] = useState<SalesCardFields>(emptyFields);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  function selectCard(next: File | null) {
    if (next && (!types[next.type] || next.size === 0 || next.size > 10 * 1024 * 1024)) {
      setFile(null);
      setCroppedFile(null);
      setStatus("JPG, PNG, WebP 파일을 10MB 이하로 선택해 주세요.");
      return;
    }
    setFile(next);
    setCroppedFile(null);
    setOcrText("");
    setFields(emptyFields);
    setStatus(next ? "명함 영역을 지정한 뒤 글자 인식을 눌러 주세요." : "");
  }

  async function recognize(cropped: File) {
    setBusy(true);
    setStatus("기기에서 명함 글자를 인식 중입니다…");
    try {
      const result = await recognizeBusinessCard(cropped);
      setCroppedFile(cropped);
      setOcrText(result.text);
      const extracted = guessSalesCardFields(result.text, result.identityText);
      setFields(extracted);
      const missing = [!extracted.organization && "기관명", !extracted.name && "이름"].filter(Boolean).join("·");
      setStatus(`${result.note}${missing ? ` ${missing}은 직접 확인해 주세요.` : ""}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "글자 인식에 실패했습니다. 직접 입력해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function recognizeField(cropped: File, field: CardField) {
    setBusy(true);
    setStatus(`${field === "name" ? "이름" : "기관명"} 영역을 다시 읽는 중입니다…`);
    try {
      const text = await recognizeBusinessCardField(cropped, field);
      const value = guessSalesCardFields(text)[field];
      if (!value) {
        setStatus("선택 영역에서 확실한 결과를 찾지 못했습니다. 영역을 좁혀 다시 시도하거나 직접 입력해 주세요.");
        return;
      }
      setFields((current) => ({ ...current, [field]: value }));
      setOcrText((current) => [current, text].filter(Boolean).join("\n"));
      setStatus(`'${value}'를 입력했습니다. 사진과 대조해 확인해 주세요.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "선택 영역을 읽지 못했습니다. 직접 입력해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const imageFile = croppedFile ?? file;
    if (!imageFile || busy) return;
    setBusy(true);
    setStatus("명함 저장 중…");
    try {
      const path = `${organizationId}/${crypto.randomUUID()}.${types[imageFile.type]}`;
      const supabase = createClient();
      const upload = await supabase.storage.from("sales-cards").upload(path, imageFile, { contentType: imageFile.type, upsert: false });
      if (upload.error) throw new Error("이미지 업로드에 실패했습니다. 버킷과 관리자 정책을 확인해 주세요.");
      const result = await saveBusinessCard({ organizationId, imagePath: path, ocrText, fields });
      if (result.error) {
        await supabase.storage.from("sales-cards").remove([path]);
        throw new Error(result.error);
      }
      setFile(null);
      setCroppedFile(null);
      setOcrText("");
      setFields(emptyFields);
      setStatus("명함을 저장했습니다.");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "명함을 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-4 rounded-xl bg-slate-50 p-3">
    <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" aria-label="명함 사진 선택" disabled={busy} onChange={(event) => selectCard(event.target.files?.[0] ?? null)} className="w-full text-sm" />
    <p className="mt-2 text-xs text-slate-600">JPG·PNG·WebP, 최대 10MB. 글자 인식은 기기에서 처리합니다. 저장하면 명함은 관리자 전용 비공개 저장소에 보관됩니다.</p>
    {file && <BusinessCardCropper key={`${file.name}:${file.size}:${file.lastModified}`} file={file} busy={busy} canRefine={Boolean(croppedFile)} onCrop={(cropped, field) => field ? recognizeField(cropped, field) : recognize(cropped)} />}
    <p role="status" className="mt-2 text-sm text-slate-600">{status}</p>
    {file && <div className="mt-3 space-y-3">
      <label className="block text-sm">인식된 전체 텍스트<textarea value={ocrText} onChange={(event) => setOcrText(event.target.value)} rows={5} maxLength={20000} className="mt-1 w-full rounded-xl border border-slate-300 p-3" /></label>
      <div className="grid gap-2 sm:grid-cols-2">{Object.entries(names).map(([key, name]) => <label key={key} className="text-sm">{name}<input value={fields[key as keyof SalesCardFields]} onChange={(event) => setFields({ ...fields, [key]: event.target.value })} maxLength={500} className="mt-1 w-full rounded-xl border border-slate-300 p-3" /></label>)}</div>
      <button type="button" onClick={() => void save()} disabled={busy} className="rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white disabled:opacity-50">명함과 텍스트 저장</button>
    </div>}
  </div>;
}
