"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/current-profile";
import { ADMIN_ROLES } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/server";

export type AttendanceCorrectionResult = {
  ok: boolean;
  message?: string;
};

function cleanError(message: string) {
  return message.replace(/^.*?:\s*/, "").trim() || "Attendance correction failed.";
}

function validTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function zonedLocalToIso(
  dateValue: string,
  timeValue: string,
  timeZone: string,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !validTime(timeValue)) {
    throw new Error("Use a valid date and time.");
  }

  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = target;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  for (let index = 0; index < 3; index += 1) {
    const parts = formatter.formatToParts(new Date(guess));
    const value = (type: string) =>
      Number(parts.find((part) => part.type === type)?.value ?? 0);

    const observed = Date.UTC(
      value("year"),
      value("month") - 1,
      value("day"),
      value("hour"),
      value("minute"),
      0,
    );

    guess += target - observed;
  }

  return new Date(guess).toISOString();
}

export async function correctAttendance(input: {
  employeeId: string;
  workDate: string;
  timezone: string;
  firstSignInTime?: string;
  finalSignOffTime?: string;
  breakMinutes?: number;
  reason: string;
}): Promise<AttendanceCorrectionResult> {
  await requireRole(ADMIN_ROLES);

  const reason = input.reason.trim();
  if (!reason) {
    return { ok: false, message: "A correction reason is required." };
  }

  if (
    input.breakMinutes != null &&
    (!Number.isFinite(input.breakMinutes) || input.breakMinutes < 0)
  ) {
    return { ok: false, message: "Break minutes must be zero or more." };
  }

  let firstIso: string | undefined;
  let finalIso: string | undefined;

  try {
    firstIso = input.firstSignInTime
      ? zonedLocalToIso(
          input.workDate,
          input.firstSignInTime,
          input.timezone,
        )
      : undefined;

    finalIso = input.finalSignOffTime
      ? zonedLocalToIso(
          input.workDate,
          input.finalSignOffTime,
          input.timezone,
        )
      : undefined;
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Invalid correction time.",
    };
  }

  if (
    firstIso == null &&
    finalIso == null &&
    input.breakMinutes == null
  ) {
    return { ok: false, message: "Change at least one attendance value." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("attendance_correct_day", {
    p_employee_id: input.employeeId,
    p_work_date: input.workDate,
    p_first_sign_in_at: firstIso,
    p_final_sign_off_at: finalIso,
    p_break_minutes: input.breakMinutes,
    p_reason: reason,
  });

  if (error) {
    return { ok: false, message: cleanError(error.message) };
  }

  revalidatePath("/attendance");
  revalidatePath("/live-view");
  revalidatePath("/dashboard");

  return { ok: true };
}
