"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/current-profile";
import { ADMIN_ROLES } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/server";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(formData: FormData, key: string) {
  const value = textValue(formData, key);
  return value || null;
}

function integerValue(formData: FormData, key: string) {
  const value = Number(textValue(formData, key));
  return Number.isInteger(value) ? value : Number.NaN;
}

function numberOrNull(formData: FormData, key: string) {
  const raw = textValue(formData, key);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : Number.NaN;
}

function boolValue(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function finish(
  tab: "general" | "schedules" | "holidays" | "leave-types",
  kind: "success" | "error",
  message: string,
): never {
  const params = new URLSearchParams({ tab, [kind]: message });
  redirect("/settings?" + params.toString());
}

function rpcMessage(error: { message: string } | null, fallback: string) {
  return error?.message || fallback;
}

export async function updateCompanySettings(formData: FormData) {
  await requireRole(ADMIN_ROLES);

  const target = integerValue(formData, "default_daily_target_minutes");
  const grace = integerValue(formData, "grace_period_minutes");
  const heartbeat = integerValue(formData, "heartbeat_interval_seconds");
  const idle = integerValue(formData, "presence_idle_minutes");
  const away = integerValue(formData, "presence_away_minutes");
  const stale = integerValue(formData, "heartbeat_stale_minutes");
  const autoSignoff = integerValue(formData, "auto_signoff_idle_minutes");

  if (
    [target, grace, heartbeat, idle, away, stale, autoSignoff].some(
      (value) => !Number.isFinite(value),
    )
  ) {
    finish("general", "error", "Enter valid numeric settings.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("phase8_update_company_settings", {
    p_company_name: textValue(formData, "company_name"),
    p_timezone: textValue(formData, "timezone"),
    p_default_schedule_id: nullableText(formData, "default_schedule_id"),
    p_default_daily_target_minutes: target,
    p_grace_period_minutes: grace,
    p_heartbeat_interval_seconds: heartbeat,
    p_presence_idle_minutes: idle,
    p_presence_away_minutes: away,
    p_heartbeat_stale_minutes: stale,
    p_auto_signoff_idle_minutes: autoSignoff,
    p_require_scrum_for_signin: boolValue(
      formData,
      "require_scrum_for_signin",
    ),
    p_require_scrum_for_signoff: boolValue(
      formData,
      "require_scrum_for_signoff",
    ),
    p_require_final_request_approval: boolValue(
      formData,
      "require_final_request_approval",
    ),
    p_reason: nullableText(formData, "reason") ?? undefined,
  });

  if (error) {
    finish("general", "error", rpcMessage(error, "Could not update settings."));
  }

  revalidatePath("/settings");
  revalidatePath("/audit");
  revalidatePath("/dashboard");
  finish("general", "success", "Company settings updated.");
}

export async function saveSchedule(formData: FormData) {
  await requireRole(ADMIN_ROLES);

  const scheduleType = textValue(formData, "schedule_type");

  if (
    scheduleType !== "fixed" &&
    scheduleType !== "flexible" &&
    scheduleType !== "flexible_core"
  ) {
    finish("schedules", "error", "Select a valid schedule type.");
  }

  const target = integerValue(formData, "daily_target_minutes");
  const grace = integerValue(formData, "grace_minutes");

  if (!Number.isFinite(target) || !Number.isFinite(grace)) {
    finish("schedules", "error", "Enter valid schedule minutes.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("phase8_save_schedule", {
    p_schedule_id: nullableText(formData, "schedule_id"),
    p_name: textValue(formData, "name"),
    p_schedule_type: scheduleType,
    p_daily_target_minutes: target,
    p_start_time: nullableText(formData, "start_time"),
    p_end_time: nullableText(formData, "end_time"),
    p_core_start_time: nullableText(formData, "core_start_time"),
    p_core_end_time: nullableText(formData, "core_end_time"),
    p_grace_minutes: grace,
    p_timezone: textValue(formData, "timezone"),
    p_reason: nullableText(formData, "reason") ?? undefined,
  });

  if (error) {
    finish("schedules", "error", rpcMessage(error, "Could not save schedule."));
  }

  revalidatePath("/settings");
  revalidatePath("/audit");
  revalidatePath("/employees");
  finish("schedules", "success", "Work schedule saved.");
}

export async function setScheduleActive(formData: FormData) {
  await requireRole(ADMIN_ROLES);
  const scheduleId = textValue(formData, "schedule_id");
  const isActive = textValue(formData, "is_active") === "true";

  if (!scheduleId) {
    finish("schedules", "error", "Schedule is required.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("phase8_set_schedule_active", {
    p_schedule_id: scheduleId,
    p_is_active: isActive,
    p_reason: nullableText(formData, "reason") ?? undefined,
  });

  if (error) {
    finish(
      "schedules",
      "error",
      rpcMessage(error, "Could not update schedule status."),
    );
  }

  revalidatePath("/settings");
  revalidatePath("/audit");
  revalidatePath("/employees");
  finish(
    "schedules",
    "success",
    isActive ? "Schedule activated." : "Schedule deactivated.",
  );
}

export async function saveHoliday(formData: FormData) {
  await requireRole(ADMIN_ROLES);

  const holidayDate = textValue(formData, "holiday_date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(holidayDate)) {
    finish("holidays", "error", "Enter a valid holiday date.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("phase8_save_holiday", {
    p_holiday_id: nullableText(formData, "holiday_id"),
    p_name: textValue(formData, "name"),
    p_holiday_date: holidayDate,
    p_country_code: nullableText(formData, "country_code"),
    p_is_company_wide: boolValue(formData, "is_company_wide"),
    p_department_id: nullableText(formData, "department_id"),
    p_reason: nullableText(formData, "reason") ?? undefined,
  });

  if (error) {
    finish("holidays", "error", rpcMessage(error, "Could not save holiday."));
  }

  revalidatePath("/settings");
  revalidatePath("/audit");
  revalidatePath("/attendance");
  finish("holidays", "success", "Holiday saved.");
}

export async function deleteHoliday(formData: FormData) {
  await requireRole(ADMIN_ROLES);
  const holidayId = textValue(formData, "holiday_id");

  if (!holidayId) {
    finish("holidays", "error", "Holiday is required.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("phase8_delete_holiday", {
    p_holiday_id: holidayId,
    p_reason: nullableText(formData, "reason") ?? undefined,
  });

  if (error) {
    finish("holidays", "error", rpcMessage(error, "Could not delete holiday."));
  }

  revalidatePath("/settings");
  revalidatePath("/audit");
  revalidatePath("/attendance");
  finish("holidays", "success", "Future holiday deleted.");
}

export async function saveLeaveType(formData: FormData) {
  await requireRole(ADMIN_ROLES);

  const defaultDays = numberOrNull(formData, "default_annual_days");
  if (defaultDays !== null && !Number.isFinite(defaultDays)) {
    finish("leave-types", "error", "Enter a valid annual entitlement.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("phase8_save_leave_type", {
    p_leave_type_id: nullableText(formData, "leave_type_id"),
    p_code: textValue(formData, "code"),
    p_name: textValue(formData, "name"),
    p_is_paid: boolValue(formData, "is_paid"),
    p_requires_reason: boolValue(formData, "requires_reason"),
    p_default_annual_days: defaultDays,
    p_reason: nullableText(formData, "reason") ?? undefined,
  });

  if (error) {
    finish(
      "leave-types",
      "error",
      rpcMessage(error, "Could not save leave type."),
    );
  }

  revalidatePath("/settings");
  revalidatePath("/audit");
  revalidatePath("/requests");
  finish("leave-types", "success", "Leave type saved.");
}

export async function setLeaveTypeActive(formData: FormData) {
  await requireRole(ADMIN_ROLES);
  const leaveTypeId = textValue(formData, "leave_type_id");
  const isActive = textValue(formData, "is_active") === "true";

  if (!leaveTypeId) {
    finish("leave-types", "error", "Leave type is required.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("phase8_set_leave_type_active", {
    p_leave_type_id: leaveTypeId,
    p_is_active: isActive,
    p_reason: nullableText(formData, "reason") ?? undefined,
  });

  if (error) {
    finish(
      "leave-types",
      "error",
      rpcMessage(error, "Could not update leave type status."),
    );
  }

  revalidatePath("/settings");
  revalidatePath("/audit");
  revalidatePath("/requests");
  finish(
    "leave-types",
    "success",
    isActive ? "Leave type activated." : "Leave type deactivated.",
  );
}
