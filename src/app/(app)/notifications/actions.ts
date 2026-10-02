"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentProfile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";

function notificationId(formData: FormData) {
  const value = formData.get("notification_id");
  return typeof value === "string" ? value : "";
}

function refresh() {
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export async function markNotificationRead(formData: FormData) {
  const profile = await requireCurrentProfile();
  const id = notificationId(formData);

  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("recipient_id", profile.id);

  if (error) {
    throw new Error("Could not mark notification as read.");
  }

  refresh();
}

export async function markAllNotificationsRead() {
  const profile = await requireCurrentProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("recipient_id", profile.id)
    .eq("is_read", false);

  if (error) {
    throw new Error("Could not mark notifications as read.");
  }

  refresh();
}


export async function openRequestNotification(formData: FormData) {
  const profile = await requireCurrentProfile();
  const id = notificationId(formData);
  const requestIdValue = formData.get("request_id");
  const requestId =
    typeof requestIdValue === "string" ? requestIdValue.trim() : "";

  if (!id || !requestId) {
    redirect("/notifications");
  }

  const supabase = await createClient();
  const { data: notification, error: loadError } = await supabase
    .from("notifications")
    .select("id, entity_type, entity_id")
    .eq("id", id)
    .eq("recipient_id", profile.id)
    .maybeSingle();

  if (
    loadError ||
    !notification ||
    notification.entity_type !== "request" ||
    notification.entity_id !== requestId
  ) {
    redirect("/notifications");
  }

  const { error } = await supabase
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("recipient_id", profile.id);

  if (error) {
    throw new Error("Could not open this request notification.");
  }

  refresh();
  const params = new URLSearchParams({ request: requestId });
  redirect("/requests?" + params.toString() + "#focused-request");
}
