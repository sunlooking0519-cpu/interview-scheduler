const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export type CardRecognition = { text: string; source: "local"; note: string };

export async function recognizeBusinessCard(file: File): Promise<CardRecognition> {
  if (!supportedTypes.has(file.type) || file.size === 0 || file.size > 10 * 1024 * 1024) {
    throw new Error("JPG, PNG, WebP 사진을 10MB 이하로 선택해 주세요.");
  }

  // Browser OCR keeps business-card images off paid OCR APIs.
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("kor+eng");
  try {
    const text = (await worker.recognize(file)).data.text.trim();
    return {
      text,
      source: "local",
      note: text
        ? "기기에서 글자를 인식했습니다. 자동 입력된 항목을 확인하고 수정해 주세요."
        : "글자를 찾지 못했습니다. 명함 영역을 다시 지정하거나 직접 입력해 주세요.",
    };
  } finally {
    await worker.terminate();
  }
}
