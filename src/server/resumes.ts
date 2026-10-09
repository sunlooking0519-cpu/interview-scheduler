import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createServiceClient } from "../../lib/supabase/service";
import { MAX_RESUME_SIZE, RESUME_TYPES } from "@/features/booking/resume";

function sign(value: string) {
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Resume storage is not configured");
  return createHmac("sha256", secret).update(`resume-upload:${value}`).digest("base64url");
}
export function resumeTicket(path: string, name: string, phone: string) {
  const payload = Buffer.from(JSON.stringify({ path, name: name.trim(), phone: phone.trim(), expires: Date.now() + 60 * 60 * 1000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}
export function readResumeTicket(ticket: string, name: string, phone: string): string {
  const [payload, signature] = ticket.split(".");
  if (!payload || !signature) throw new Error("Invalid resume ticket");
  const expected = sign(payload);
  if (Buffer.byteLength(signature) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error("Invalid resume ticket");
  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (data.name !== name.trim() || data.phone !== phone.trim() || data.expires < Date.now() || !/^uploads\/[0-9a-f-]{36}\.(pdf|doc|docx)$/.test(data.path)) throw new Error("Expired or invalid resume ticket");
  return data.path;
}
export function newResumePath(extension: string) { return `uploads/${randomUUID()}.${extension}`; }

export async function verifyUploadedResume(path: string) {
  const storage = createServiceClient().storage.from("resumes");
  const { data, error } = await storage.download(path);
  if (error || !data || !data.size || data.size > MAX_RESUME_SIZE) throw new Error("Resume upload missing or invalid");
  const bytes = new Uint8Array(await data.arrayBuffer());
  const extension = path.split(".").pop()!;
  const valid = extension === "pdf" ? Buffer.from(bytes.slice(0, 5)).toString() === "%PDF-"
    : extension === "doc" ? Buffer.from(bytes.slice(0, 8)).toString("hex") === "d0cf11e0a1b11ae1"
    : bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 3 && bytes[3] === 4 && Buffer.from(bytes).includes(Buffer.from("word/"));
  if (!valid || !RESUME_TYPES[extension]) throw new Error("Invalid resume format");
  return storage.getPublicUrl(path).data.publicUrl;
}
export async function removeUploadedResume(path: string) {
  try {
    const service = createServiceClient();
    const url = service.storage.from("resumes").getPublicUrl(path).data.publicUrl;
    const { count, error: readError } = await service.schema("scheduler").from("interviews").select("id", { count: "exact", head: true }).eq("resume_url", url);
    if (readError || count !== 0) return;
    const { error } = await service.storage.from("resumes").remove([path]);
    if (error) console.error("Resume cleanup failed");
  }
  catch { console.error("Resume cleanup failed"); }
}
