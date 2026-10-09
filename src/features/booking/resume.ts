export const MAX_RESUME_SIZE = 5 * 1024 * 1024;
export const RESUME_TYPES: Record<string, string> = { pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
export function resumeError(name: string, size: number) {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  if (!RESUME_TYPES[extension]) return "PDF 또는 Word(.doc, .docx) 파일을 선택해 주세요.";
  if (!Number.isInteger(size) || size <= 0 || size > MAX_RESUME_SIZE) return "파일은 0바이트보다 크고 최대 5MB 이하여야 합니다.";
  return "";
}
