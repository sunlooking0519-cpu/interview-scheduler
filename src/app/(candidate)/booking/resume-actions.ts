"use server";
import { createServiceClient } from "../../../../lib/supabase/service";
import { newResumePath, resumeTicket } from "@/server/resumes";
import { resumeError } from "@/features/booking/resume";

// Run supabase/resumes-migration.sql first: public resumes bucket, 5MB limit.
export async function prepareResumeUpload(input: { name: string; phone: string; fileName: string; size: number }) {
  if (!input.name?.trim() || input.name.trim().length > 60 || !/^[0-9+() -]{8,20}$/.test(input.phone?.trim())) return { error: "이름과 전화번호를 확인해 주세요." };
  const error = resumeError(input.fileName, input.size);
  if (error) return { error };
  try {
    const path = newResumePath(input.fileName.split(".").pop()!.toLowerCase());
    const { data, error } = await createServiceClient().storage.from("resumes").createSignedUploadUrl(path, { upsert: false });
    if (error || !data) return { error: "이력서 업로드를 준비하지 못했습니다. 관리자에게 문의해 주세요." };
    return { error: "", path, token: data.token, ticket: resumeTicket(path, input.name, input.phone) };
  } catch { return { error: "이력서 저장소 설정을 확인해 주세요." }; }
}
