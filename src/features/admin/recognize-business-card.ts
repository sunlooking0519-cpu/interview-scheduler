import { createClient } from "../../../lib/supabase/client";

const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export type CardRecognition = { text: string; source: "vision" | "local"; note: string };

async function recognizeLocally(file: File, note: string): Promise<CardRecognition> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("kor+eng");
  try {
    return { text: (await worker.recognize(file)).data.text.trim(), source: "local", note };
  } finally {
    await worker.terminate();
  }
}

export async function recognizeBusinessCard(file: File): Promise<CardRecognition> {
  const ext = extensions[file.type];
  if (!ext || file.size === 0 || file.size > 10 * 1024 * 1024) throw new Error("JPG, PNG, WebP 사진을 10MB 이하로 선택해 주세요.");
  const path = `ocr-temp/${crypto.randomUUID()}.${ext}`;
  const storage = createClient().storage.from("sales-cards");
  const upload = await storage.upload(path, file, { contentType: file.type, upsert: false });
  if (upload.error) return recognizeLocally(file, "명함 임시 업로드에 실패하여 기존 OCR로 인식했습니다.");

  let text = "";
  let fallbackNote = "Google Vision 연결에 실패하여 기존 OCR로 인식했습니다.";
  try {
    const response = await fetch("/api/admin/sales/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
      cache: "no-store",
    });
    if (response.status === 401) throw new Error("관리자 로그인이 만료되었습니다. 다시 로그인해 주세요.");
    if (!response.ok) fallbackNote = response.status === 503
      ? "Google Vision 키가 설정되지 않아 기존 OCR로 인식했습니다."
      : "Google Vision 호출에 실패하여 기존 OCR로 인식했습니다.";
    else {
      const result = await response.json() as { text?: string };
      text = result.text?.trim() ?? "";
      if (!text) fallbackNote = "Google Vision에서 글자를 찾지 못해 기존 OCR로 재시도했습니다.";
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("관리자 로그인")) throw error;
  } finally {
    try { await storage.remove([path]); } catch { /* Server also removes temporary images. */ }
  }
  if (text) return { text, source: "vision", note: "Google Vision 인식 완료. 내용을 확인하고 수정해 주세요." };
  return recognizeLocally(file, fallbackNote);
}
