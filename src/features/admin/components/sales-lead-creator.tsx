"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../../lib/supabase/client";
import { createSalesLead } from "@/app/admin/sales/actions";
import { classifySalesCard, extractSelectedCardField, guessSalesCardFields, type SalesCardFields, type SalesKind } from "@/features/admin/sales-card-ocr";
import { recognizeBusinessCard, recognizeBusinessCardField, type CardField } from "@/features/admin/recognize-business-card";
import { BusinessCardCropper } from "@/features/admin/components/business-card-cropper";
import { BusinessCardFilePicker } from "@/features/admin/components/business-card-file-picker";

const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const emptyFields: SalesCardFields = { name: "", organization: "", title: "", phone: "", mobile: "", email: "" };
const inputClass = "mt-1 w-full min-w-0 rounded-xl border border-slate-300 bg-white p-3 text-base";

export function SalesLeadCreator() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [croppedFile, setCroppedFile] = useState<File | null>(null);
  const [fields, setFields] = useState<SalesCardFields>(emptyFields);
  const [role, setRole] = useState("");
  const [kind, setKind] = useState<SalesKind>("institution");
  const [kindTouched, setKindTouched] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function selectCard(next: File | null) {
    if (busy) return;
    if (next && (!extensions[next.type] || next.size > 10 * 1024 * 1024 || next.size === 0)) {
      setFile(null);
      setCroppedFile(null);
      setMessage(/\.(?:heic|heif)$/i.test(next.name) || /hei[cf]/i.test(next.type)
        ? "이 휴대폰의 고효율 사진(HEIC)은 인식할 수 없습니다. 카메라 설정에서 고효율 사진을 끄고 다시 촬영하거나 JPG 사진을 선택해 주세요."
        : "JPG, PNG, WebP 이미지를 10MB 이하로 선택해 주세요.");
      return;
    }
    setFile(next);
    setCroppedFile(null);
    setOcrText("");
    setFields(emptyFields);
    setRole("");
    setKind("institution");
    setKindTouched(false);
    if (!next) { setMessage(""); return; }
    setMessage("사진이 선택됐습니다. 사진 아래의 '이 사진 글자 인식'을 눌러 주세요. 영역 선택은 선택 사항입니다.");
  }

  async function recognizeCard(cropped: File) {
    setBusy(true);
    setMessage("기기에서 명함 글자를 인식 중입니다…");
    try {
      const recognized = await recognizeBusinessCard(cropped);
      const result = guessSalesCardFields(recognized.text, recognized.identityText);
      setCroppedFile(cropped);
      setOcrText(recognized.text);
      setFields(result);
      setKind(result.organization ? classifySalesCard(result.organization) : "institution");
      setKindTouched(false);
      const missing = [!result.organization && "기관명", !result.name && "담당자 이름"].filter(Boolean).join("·");
      setMessage(`${recognized.note}${missing ? ` ${missing}은 직접 확인해 주세요.` : ""}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "글자 인식에 실패했습니다. 직접 입력한 뒤 저장할 수 있습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function recognizeField(cropped: File, field: CardField) {
    setBusy(true);
    setMessage(`${field === "name" ? "이름" : "기관명"} 영역을 다시 읽는 중입니다…`);
    try {
      const text = await recognizeBusinessCardField(cropped, field);
      const value = extractSelectedCardField(text, field);
      if (!value) {
        setMessage(`선택 영역에서 ${field === "name" ? "이름" : "기관명"}을 확실히 찾지 못했습니다. 영역을 좁혀 다시 시도하거나 사진을 보고 직접 입력해 주세요.`);
        return;
      }
      setFields((current) => ({ ...current, [field]: value }));
      if (field === "organization" && !kindTouched) setKind(classifySalesCard(value));
      setOcrText((current) => [current, text].filter(Boolean).join("\n"));
      setMessage(`선택 영역을 우선 적용해 ${field === "name" ? "이름" : "기관명"}을 '${value}'(으)로 변경했습니다. 사진과 대조해 확인해 주세요.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "선택 영역을 읽지 못했습니다. 직접 입력해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!fields.organization.trim()) { setMessage("기관·학교·업체명을 입력해 주세요."); return; }
    if ((fields.title.trim() || role.trim() || fields.phone.trim() || fields.mobile.trim() || fields.email.trim()) && !fields.name.trim()) {
      setMessage("담당자의 직책·역할·연락처를 저장하려면 이름도 입력해 주세요.");
      return;
    }
    if (file && !extensions[file.type]) { setMessage("명함 파일 형식을 확인해 주세요."); return; }
    setBusy(true);
    setMessage("영업 대상을 저장하는 중입니다…");
    const organizationId = crypto.randomUUID();
    const supabase = createClient();
    let imagePath = "";
    try {
      const imageFile = croppedFile ?? file;
      if (imageFile) {
        imagePath = `${organizationId}/${crypto.randomUUID()}.${extensions[imageFile.type]}`;
        const { error } = await supabase.storage.from("sales-cards").upload(imagePath, imageFile, { contentType: imageFile.type, upsert: false });
        if (error) throw new Error("명함 업로드에 실패했습니다. sales-cards 버킷과 관리자 권한을 확인해 주세요.");
      }
      const result = await createSalesLead({
        organizationId, name: fields.organization, kind,
        contact: { name: fields.name, title: fields.title, role, phone: fields.phone, mobile: fields.mobile, email: fields.email },
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
    <p className="mt-1 text-sm text-slate-600">명함 촬영 또는 앨범 선택 → 글자 인식 → 내용 확인 후 등록. 같은 이름의 기관이 있으면 새 기관 대신 그 기관에 담당자를 추가합니다.</p>
    <form onSubmit={(event) => void submit(event)} className="mt-4 space-y-5">
      <div className="rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 p-4">
        <h3 className="font-semibold text-indigo-950">1. 명함 사진 준비</h3>
        <div className="mt-2"><BusinessCardFilePicker busy={busy} file={file} onSelect={selectCard} /></div>
        <p className="mt-2 text-xs text-slate-600">명함을 밝고 선명하게 촬영해 주세요. JPG·PNG·WebP, 최대 10MB. 글자 인식은 기기에서 처리하며 OCR 서비스로 사진을 전송하지 않습니다. 등록한 명함은 관리자 전용 비공개 저장소에 보관됩니다.</p>
        {message && <p role="status" className="mt-2 text-sm font-medium text-indigo-900">{message}</p>}
        {file && <BusinessCardCropper key={`${file.name}:${file.size}:${file.lastModified}`} file={file} busy={busy} canRefine={Boolean(croppedFile)} onCrop={(cropped, field) => field ? recognizeField(cropped, field) : recognizeCard(cropped)} />}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium sm:col-span-2">기관·학교·업체명 <span className="text-red-600">*</span><input required maxLength={200} value={fields.organization} onChange={(event) => { const organization = event.target.value; setFields({ ...fields, organization }); if (!kindTouched) setKind(organization ? classifySalesCard(organization) : "institution"); }} placeholder="기관·학교·업체명" className={inputClass}/></label>
        <label className="block text-sm font-medium">대상 유형<select value={kind} onChange={(event) => { setKind(event.target.value as SalesKind); setKindTouched(true); }} className={inputClass}><option value="institution">기관</option><option value="school">학교</option><option value="other">기타·업체</option></select></label>
        <label className="block text-sm font-medium">담당자 이름<input maxLength={120} value={fields.name} onChange={(event) => setFields({ ...fields, name: event.target.value })} placeholder="담당자 이름" className={inputClass}/></label>
        <label className="block text-sm font-medium">직책<input maxLength={120} value={fields.title} onChange={(event) => setFields({ ...fields, title: event.target.value })} placeholder="직책" className={inputClass}/></label>
        <label className="block text-sm font-medium">담당 역할<input maxLength={200} value={role} onChange={(event) => setRole(event.target.value)} placeholder="예: 예산 결정, 교육 운영" className={inputClass}/></label>
        <label className="block text-sm font-medium">전화번호 (Tel)<input type="tel" maxLength={80} value={fields.phone} onChange={(event) => setFields({ ...fields, phone: event.target.value })} placeholder="회사·기관 전화번호" className={inputClass}/></label>
        <label className="block text-sm font-medium">휴대폰 (Mobile)<input type="tel" maxLength={80} value={fields.mobile} onChange={(event) => setFields({ ...fields, mobile: event.target.value })} placeholder="담당자 휴대폰" className={inputClass}/></label>
        <label className="block text-sm font-medium sm:col-span-2">이메일<input type="email" maxLength={200} value={fields.email} onChange={(event) => setFields({ ...fields, email: event.target.value })} placeholder="이메일" className={inputClass}/></label>
      </div>
      {file && <label className="block text-sm font-medium">인식된 전체 텍스트<textarea rows={4} maxLength={20000} value={ocrText} onChange={(event) => setOcrText(event.target.value)} className={inputClass}/></label>}
      <div className="flex flex-wrap items-center gap-3"><button type="submit" disabled={busy} className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? "처리 중…" : "확인 후 등록"}</button></div>
    </form>
  </section>;
}
