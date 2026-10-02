"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/current-profile";
import { getEmployeeById } from "@/lib/data/organization";
import { createClient } from "@/lib/supabase/server";
import { TEAM_ROLES } from "@/lib/navigation";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function finish(kind: "success" | "error", message: string, date: string): never {
  const params = new URLSearchParams({ date, [kind]: message });
  redirect("/scrum-board?" + params.toString());
}

export async function assignManagerScrumTask(formData: FormData) {
  const current = await requireRole(TEAM_ROLES);
  const employeeId = textValue(formData, "employee_id");
  const projectCode = textValue(formData, "project_code");
  const title = textValue(formData, "title");
  const description = textValue(formData, "description");
  const date = textValue(formData, "date");

  if (!employeeId || !title) {
    finish("error", "Choose an employee and enter a task title.", date);
  }

  const employee = await getEmployeeById(current, employeeId);

  if (!employee || employee.id === current.id || !employee.isActive) {
    finish("error", "Choose an active employee in your reporting scope.", date);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("phase7_assign_scrum_task", {
    p_employee_id: employee.id,
    p_project_code: projectCode,
    p_title: title,
    p_description: description || undefined,
  });

  if (error) {
    finish("error", error.message, date);
  }

  revalidatePath("/scrum-board");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  finish("success", "Task assigned to the employee Scrum backlog.", date);
}

export async function resolveScrumObstacle(formData: FormData) {
  await requireRole(TEAM_ROLES);
  const obstacleId = textValue(formData, "obstacle_id");
  const resolutionNote = textValue(formData, "resolution_note");
  const date = textValue(formData, "date");

  if (!obstacleId || !resolutionNote) {
    finish("error", "Add a resolution note before resolving the blocker.", date);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("phase7_resolve_scrum_obstacle", {
    p_obstacle_id: obstacleId,
    p_resolution_note: resolutionNote,
  });

  if (error) {
    finish("error", error.message, date);
  }

  revalidatePath("/scrum-board");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  finish("success", "Blocker resolved.", date);
}
