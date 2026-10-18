"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "../../../../lib/supabase/client";
import { createSalesLead } from "@/app/admin/sales/actions";
import { classifySalesCard, guessSalesCardFields, type SalesCardFields, type SalesKind } from "@/features/admin/sales-card-ocr";

const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const emptyFields: SalesCardFields = { name: "", organization: "", title: "", phone: "", email: "" };
const inputClass = "mt-1 w-full min-w-0 rounded-xl border border-slate-300 bg-white p-3 text-base";

export function SalesLeadCreator() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [fields, setFields] = useState<SalesCardFields>(emptyFields);
  const [kind, setKind] = useState<SalesKind>("institution");
  const [ocrText, setOcrText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (previewUrl) return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function selectCard(next: File | null) {
    if (busy) return;
    if (next && (!extensions[next.type] || next.size > 10 * 1024 * 1024 || next.size === 0)) {
      setMessage("JPG, PNG, WebP 이미지를 10MB 이하로 선택해 주세요.");
      return;
    }
    setFile(next);
    setPreviewUrl(next ? URL.createObjectURL(next) : "");
    setOcrText("");
    if (!next) { setMessage(""); return; }
    setBusy(true);
    setMessage("명함의 한글·영문을 읽는 중입니다. 첫 실행 시 언어 파일을 내려받습니다.");
    let worker: Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>> | undefined;
    try {
      const { createWorker } = await import("tesseract.js");
      worker = await createWorker("kor+eng");
      const recognized = (await worker.recognize(next)).data.text.trim();
      const result = guessSalesCardFields(recognized);
      setOcrText(recognized);
      setFields(result);
      setKind(classifySalesCard(result.organization));
      setMessage("자동 분류와 글자 인식을 마쳤습니다. 내용을 확인하고 수정해 주세요.");
    } catch {
      setMessage("글자 인식에 실패했습니다. 직접 입력한 뒤 저장할 수 있습니다.");
    } finally {
      await worker?.terminate();
      setBusy(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!fields.organization.trim()) { setMessage("기관·학교·업체명을 입력해 주세요."); return; }
    if ((fields.title.trim() || fields.phone.trim() || fields.email.trim()) && !fields.name.trim()) {
      setMessage("담당자의 직책·연락처를 저장하려면 이름도 입력해 주세요.");
      return;
    }
    if (file && !extensions[file.type]) { setMessage("명함 파일 형식을 확인해 주세요."); return; }
    setBusy(true);
    setMessage("영업 대상을 저장하는 중입니다…");
    const organizationId = crypto.randomUUID();
    const supabase = createClient();
    let imagePath = "";
    try {
      if (file) {
        imagePath = `${organizationId}/${crypto.randomUUID()}.${extensions[file.type]}`;
        const { error } = await supabase.storage.from("sales-cards").upload(imagePath, file, { contentType: file.type, upsert: false });
        if (error) throw new Error("명함 업로드에 실패했습니다. sales-cards 버킷과 관리자 권한을 확인해 주세요.");
      }
      const result = await createSalesLead({
        organizationId, name: fields.organization, kind,
        contact: { name: fields.name, title: fields.title, phone: fields.phone, email: fields.email },
        imagePath, ocrText,
      });
      if (result.error) throw new Error(result.error);
      router.push(`/admin/sales/${result.id}`);
      router.refresh();
    } catch (error) {
      if (imagePath) await supabase.storage.from("sales-cards").remove([imagePath]);
      setMessage(error instanceof Error ? error.message : "영업 대상을 저장하지 못했습니다.");
      setBusy(false);
    }
  }

  return <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
    <h2 className="text-lg font-bold">영업 대상 추가</h2>
    <p className="mt-1 text-sm text-slate-600">명함을 촬영하면 기관명과 담당자 정보를 읽고 유형을 추천합니다. 사진 없이 직접 입력할 수도 있습니다.</p>
    <form onSubmit={(event) => void submit(event)} className="mt-4 space-y-5">
      <div className="rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 p-4">
        <label htmlFor="sales-card-photo" className="block font-semibold text-indigo-950">명함 촬영·사진 선택</label>
        <input id="sales-card-photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={busy} onChange={(event) => void selectCard(event.target.files?.[0] ?? null)} className="mt-2 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-2 file:font-semibold file:text-white" />
        <p className="mt-2 text-xs text-slate-600">JPG·PNG·WebP, 최대 10MB. 명함은 관리자만 볼 수 있는 비공개 저장소에 보관됩니다.</p>
        {previewUrl && <div className="relative mt-3 h-52 w-full"><Image src={previewUrl} alt="선택한 명함 미리보기" fill unoptimized className="rounded-lg border border-slate-200 object-contain" /></div>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium sm:col-span-2">기관·학교·업체명 <span className="text-red-600">*</span><input required maxLength={200} value={fields.organization} onChange={(event) => setFields({ ...fields, organization: event.target.value })} placeholder="기관·학교·업체명" className={inputClass}/></label>
        <label className="block text-sm font-medium">대상 유형<select value={kind} onChange={(event) => setKind(event.target.value as SalesKind)} className={inputClass}><option value="institution">기관</option><option value="school">학교</option><option value="other">기타·업체</option></select></label>
        <label className="block text-sm font-medium">담당자 이름<input maxLength={120} value={fields.name} onChange={(event) => setFields({ ...fields, name: event.target.value })} placeholder="담당자 이름" className={inputClass}/></label>
        <label className="block text-sm font-medium">직책<input maxLength={120} value={fields.title} onChange={(event) => setFields({ ...fields, title: event.target.value })} placeholder="직책" className={inputClass}/></label>
        <label className="block text-sm font-medium">전화번호<input type="tel" maxLength={80} value={fields.phone} onChange={(event) => setFields({ ...fields, phone: event.target.value })} placeholder="전화번호" className={inputClass}/></label>
        <label className="block text-sm font-medium sm:col-span-2">이메일<input type="email" maxLength={200} value={fields.email} onChange={(event) => setFields({ ...fields, email: event.target.value })} placeholder="이메일" className={inputClass}/></label>
      </div>
      {file && <label className="block text-sm font-medium">인식된 전체 텍스트<textarea rows={4} maxLength={20000} value={ocrText} onChange={(event) => setOcrText(event.target.value)} className={inputClass}/></label>}
      <div className="flex flex-wrap items-center gap-3"><button type="submit" disabled={busy} className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? "처리 중…" : "확인 후 등록"}</button><p role="status" className="text-sm text-slate-600">{message}</p></div>
    </form>
  </section>;
}
