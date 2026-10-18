import { guessSalesCardFields } from "@/features/admin/sales-card-ocr";

const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export type CardRecognition = { text: string; identityText: string; source: "local"; note: string };
export type CardField = "organization" | "name";

function assertSupported(file: File) {
  if (!supportedTypes.has(file.type) || file.size === 0 || file.size > 10 * 1024 * 1024) {
    throw new Error("JPG, PNG, WebP 사진을 10MB 이하로 선택해 주세요.");
  }
}

export async function recognizeBusinessCard(file: File): Promise<CardRecognition> {
  assertSupported(file);

  // Browser OCR keeps business-card images off paid OCR APIs.
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("kor+eng");
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    const fullText = (await worker.recognize(file)).data.text.trim();
    let identityText = "";
    const fields = guessSalesCardFields(fullText);

    // A second, smaller pass helps with names and organizations embedded in mixed card layouts.
    if ((!fields.name || !fields.organization) && typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(file);
        const width = bitmap.width;
        const height = bitmap.height;
        bitmap.close();
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
        identityText = (await worker.recognize(file, {
          rectangle: { left: 0, top: 0, width, height: Math.max(1, Math.round(height * 0.75)) },
        })).data.text.trim();
      } catch {
        // The first pass remains available if the browser cannot decode or re-read a photo.
      }
    }

    const text = [fullText, identityText].filter(Boolean).join("\n\n");
    return {
      text,
      identityText,
      source: "local",
      note: text
        ? "기기에서 글자를 인식했습니다. 비어 있거나 잘못 읽힌 항목을 확인해 주세요."
        : "글자를 찾지 못했습니다. 명함 영역을 다시 지정하거나 직접 입력해 주세요.",
    };
  } finally {
    await worker.terminate();
  }
}

export async function recognizeBusinessCardField(file: File, field: CardField): Promise<string> {
  assertSupported(file);
  const { createWorker, PSM } = await import("tesseract.js");
  // A manually selected name area contains Korean text; keeping English out of this pass
  // prevents nearby Latin logos from competing with Korean glyphs.
  const worker = await createWorker(field === "name" ? "kor" : "kor+eng");
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
    return (await worker.recognize(file)).data.text.trim();
  } finally {
    await worker.terminate();
  }
}
