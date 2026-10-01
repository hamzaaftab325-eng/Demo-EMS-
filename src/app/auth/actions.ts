"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homeForRole, isEmsRole } from "@/lib/navigation";
import { sanitizeNextPath } from "@/lib/auth/paths";

function loginError(code: string, nextPath?: string | null): never {
  const params = new URLSearchParams({ error: code });

  if (nextPath) {
    params.set("next", nextPath);
  }

  redirect(`/login?${params.toString()}`);
}

export async function login(formData: FormData) {
  const emailValue = formData.get("email");
  const passwordValue = formData.get("password");
  const requestedNext = sanitizeNextPath(formData.get("next"));

  const email =
    typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
  const password = typeof passwordValue === "string" ? passwordValue : "";

  if (!email || !password) {
    loginError("missing_credentials", requestedNext);
  }

  let supabase;

  try {
    supabase = await createClient();
  } catch {
    loginError("configuration", requestedNext);
  }

  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (authError || !authData.user) {
    loginError("invalid_credentials", requestedNext);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "id, role, is_active, employment_status, auth_user_id, is_test_account, auth_activated_at",
    )
    .eq("auth_user_id", authData.user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    !isEmsRole(profile.role) ||
    !profile.is_active ||
    profile.employment_status === "deactivated"
  ) {
    await supabase.auth.signOut();
    loginError(
      profile && !profile.is_active ? "inactive_account" : "not_authorized",
      requestedNext,
    );
  }

  if (!profile.auth_activated_at) {
    redirect("/set-password");
  }

  redirect(requestedNext ?? homeForRole(profile.role));
}

export async function logout() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } finally {
    redirect("/login");
  }
}
