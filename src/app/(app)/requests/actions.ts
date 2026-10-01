"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentProfile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type RequestType = Database["public"]["Enums"]["request_type"];
type ApprovalDecision = Database["public"]["Enums"]["approval_decision"];

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function finish(kind: "success" | "error", message: string): never {
  const params = new URLSearchParams({ [kind]: message });
  redirect("/requests?" + params.toString());
}

function refreshRequestSurfaces() {
  revalidatePath("/requests");
  revalidatePath("/dashboard");
  revalidatePath("/attendance");
  revalidatePath("/live-view");
  revalidatePath("/employees");
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export async function createLeaveRequest(formData: FormData) {
  await requireCurrentProfile();
  const supabase = await createClient();

  const leaveTypeId = textValue(formData, "leave_type_id");
  const startDate = textValue(formData, "start_date");
  const endDate = textValue(formData, "end_date");
  const reason = textValue(formData, "reason");

  if (!leaveTypeId || !startDate || !endDate) {
    finish("error", "Complete the leave type and date range.");
  }

  const { error } = await supabase.rpc("request_submit_leave", {
    p_leave_type_id: leaveTypeId,
    p_start_date: startDate,
    p_end_date: endDate,
    p_reason: reason || undefined,
  });

  if (error) {
    finish("error", error.message);
  }

  refreshRequestSurfaces();
  finish("success", "Leave request submitted for manager review.");
}

export async function createScheduleRequest(formData: FormData) {
  await requireCurrentProfile();
  const supabase = await createClient();

  const requestType = textValue(formData, "request_type") as RequestType;
  const startDate = textValue(formData, "start_date");
  const endDate = textValue(formData, "end_date") || startDate;
  const newStartTime = textValue(formData, "new_start_time");
  const newEndTime = textValue(formData, "new_end_time");
  const reason = textValue(formData, "reason");
  const isPermanent = formData.get("is_permanent") === "on";

  if (
    !["shift_change", "hour_change"].includes(requestType) ||
    !startDate ||
    !endDate ||
    !newStartTime ||
    !newEndTime ||
    !reason
  ) {
    finish("error", "Complete all required schedule-change fields.");
  }

  const { error } = await supabase.rpc("request_submit_schedule_change", {
    p_request_type: requestType,
    p_start_date: startDate,
    p_end_date: endDate,
    p_new_start_time: newStartTime,
    p_new_end_time: newEndTime,
    p_is_permanent: requestType === "shift_change" && isPermanent,
    p_reason: reason,
  });

  if (error) {
    finish("error", error.message);
  }

  refreshRequestSurfaces();
  finish(
    "success",
    requestType === "shift_change"
      ? "Shift-change request submitted for manager review."
      : "Hour-change request submitted for manager review.",
  );
}

export async function cancelRequest(formData: FormData) {
  await requireCurrentProfile();
  const supabase = await createClient();

  const requestId = textValue(formData, "request_id");
  const reason = textValue(formData, "reason");

  if (!requestId) {
    finish("error", "Request ID is missing.");
  }

  const { error } = await supabase.rpc("request_cancel", {
    p_request_id: requestId,
    p_reason: reason || undefined,
  });

  if (error) {
    finish("error", error.message);
  }

  refreshRequestSurfaces();
  finish("success", "Request cancelled.");
}

export async function decideRequest(formData: FormData) {
  await requireCurrentProfile();
  const supabase = await createClient();

  const requestId = textValue(formData, "request_id");
  const decision = textValue(formData, "decision") as ApprovalDecision;
  const comment = textValue(formData, "comment");

  if (!requestId || !["approved", "rejected"].includes(decision)) {
    finish("error", "Approval decision is invalid.");
  }

  if (decision === "rejected" && !comment) {
    finish("error", "Add a comment before rejecting a request.");
  }

  const { error } = await supabase.rpc("request_decide", {
    p_request_id: requestId,
    p_decision: decision,
    p_comment: comment || undefined,
  });

  if (error) {
    finish("error", error.message);
  }

  refreshRequestSurfaces();
  finish(
    "success",
    decision === "approved" ? "Request approved." : "Request rejected.",
  );
}

export async function reassignRequestApprover(formData: FormData) {
  await requireCurrentProfile();
  const supabase = await createClient();

  const requestId = textValue(formData, "request_id");
  const approverId = textValue(formData, "approver_id");
  const comment = textValue(formData, "comment");

  if (!requestId || !approverId) {
    finish("error", "Choose a valid approver.");
  }

  const { error } = await supabase.rpc("request_reassign_approver", {
    p_request_id: requestId,
    p_new_approver_id: approverId,
    p_comment: comment || undefined,
  });

  if (error) {
    finish("error", error.message);
  }

  refreshRequestSurfaces();
  finish("success", "Approval reassigned successfully.");
}
