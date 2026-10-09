"use server";

import { createClient } from "../../../../lib/supabase/server";
import { DEMO_DATES, DEMO_TIMES } from "@/features/booking/demo-data";

export type CreateInterviewInput = {
  name: string;
  phone: string;
  interviewDate: string;
  interviewTime: string;
};

export type CreateInterviewResult =
  | { success: true }
  | { success: false; message: string };

const PHONE_PATTERN = /^[0-9+() -]{8,20}$/;

export async function createInterview(
  input: CreateInterviewInput,
): Promise<CreateInterviewResult> {
  const name = input.name.trim();
  const phone = input.phone.trim();

  if (!name || name.length > 60) {
    return { success: false, message: "지원자 이름을 확인해 주세요." };
  }

  if (!PHONE_PATTERN.test(phone)) {
    return { success: false, message: "전화번호를 확인해 주세요." };
  }

  if (!DEMO_DATES.includes(input.interviewDate)) {
    return { success: false, message: "예약 가능한 날짜를 선택해 주세요." };
  }

  if (!DEMO_TIMES.includes(input.interviewTime)) {
    return { success: false, message: "예약 가능한 시간을 선택해 주세요." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.schema("scheduler").from("interviews").insert({
      name,
      phone,
      interview_date: input.interviewDate,
      interview_time: input.interviewTime,
      status: "confirmed",
    });

    if (error) {
      console.error("Supabase interview insert failed", {
        code: error.code,
        message: error.message,
      });

      if (error.code === "23505") {
        return {
          success: false,
          message: "방금 다른 지원자가 선택한 시간입니다. 다른 시간을 선택해 주세요.",
        };
      }

      return {
        success: false,
        message: "예약 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Interview creation failed", error);
    return {
      success: false,
      message: "예약 시스템 설정을 확인할 수 없습니다. 관리자에게 문의해 주세요.",
    };
  }
}
