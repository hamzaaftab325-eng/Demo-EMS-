"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentProfile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export type MyDayActionResult = {
  ok: boolean;
  message?: string;
};

export type SignInDraftItem = {
  projectCode: string;
  title: string;
  percent: number;
};

export type BacklogDraftItem = {
  projectCode: string;
  title: string;
};

export type SignOffDraftItem = {
  entryItemId: string;
  percent: number;
  note?: string;
};

function cleanMessage(message: string) {
  const normalized = message.replace(/^.*?:\s*/, "").trim();

  if (normalized.includes("duplicate key")) {
    return "This action was already recorded. Refresh and try again.";
  }

  if (normalized.includes("row-level security")) {
    return "Your account does not have permission to perform this action.";
  }

  return normalized || "The action could not be completed.";
}

async function rpc(
  name:
    | "my_day_sign_in"
    | "my_day_update_progress"
    | "my_day_add_cycle_item"
    | "my_day_add_obstacle"
    | "my_day_start_interval"
    | "my_day_end_interval"
    | "my_day_sign_off"
    | "my_day_sign_back_in",
  args?: Record<string, unknown>,
): Promise<MyDayActionResult> {
  await requireCurrentProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc(
    name,
    (args ?? {}) as never,
  );

  if (error) {
    return { ok: false, message: cleanMessage(error.message) };
  }

  revalidatePath("/my-day");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function signInMyDay(input: {
  existingItemIds: string[];
  newCycleItems: SignInDraftItem[];
  newBacklogItems: BacklogDraftItem[];
  obstacle?: string;
}) {
  const cycle = input.newCycleItems
    .map((item) => ({
      project_code: item.projectCode.trim().toUpperCase(),
      title: item.title.trim(),
      percent: Math.max(0, Math.min(99, Math.round(item.percent))),
    }))
    .filter((item) => item.title);

  const backlog = input.newBacklogItems
    .map((item) => ({
      project_code: item.projectCode.trim().toUpperCase(),
      title: item.title.trim(),
    }))
    .filter((item) => item.title);

  return rpc("my_day_sign_in", {
    p_existing_item_ids: input.existingItemIds,
    p_new_cycle_items: cycle as unknown as Json,
    p_new_backlog_items: backlog as unknown as Json,
    p_obstacle: input.obstacle?.trim() || undefined,
  });
}

export async function updateMyDayProgress(input: {
  entryItemId: string;
  percent: number;
  note?: string;
}) {
  return rpc("my_day_update_progress", {
    p_entry_item_id: input.entryItemId,
    p_percent: Math.max(0, Math.min(100, Math.round(input.percent))),
    p_note: input.note?.trim() || undefined,
  });
}

export async function addMyDayCycleItem(input: {
  projectCode: string;
  title: string;
  startingPercent: number;
  description?: string;
}) {
  return rpc("my_day_add_cycle_item", {
    p_project_code: input.projectCode.trim().toUpperCase(),
    p_title: input.title.trim(),
    p_starting_percent: Math.max(
      0,
      Math.min(99, Math.round(input.startingPercent)),
    ),
    p_description: input.description?.trim() || undefined,
  });
}

export async function addMyDayObstacle(description: string) {
  return rpc("my_day_add_obstacle", {
    p_description: description.trim(),
  });
}

export async function startMyDayInterval(
  intervalType: "break" | "meeting",
) {
  return rpc("my_day_start_interval", {
    p_interval_type: intervalType,
  });
}

export async function endMyDayInterval() {
  return rpc("my_day_end_interval");
}

export async function signOffMyDay(input: {
  items: SignOffDraftItem[];
  obstacle?: string;
}) {
  const items = input.items.map((item) => ({
    entry_item_id: item.entryItemId,
    percent: Math.max(0, Math.min(100, Math.round(item.percent))),
    note: item.note?.trim() || null,
  }));

  return rpc("my_day_sign_off", {
    p_items: items as unknown as Json,
    p_obstacle: input.obstacle?.trim() || undefined,
  });
}

export async function signBackInMyDay() {
  return rpc("my_day_sign_back_in");
}
