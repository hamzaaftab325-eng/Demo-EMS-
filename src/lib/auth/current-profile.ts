import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEmsRole, type EmsRole } from "@/lib/navigation";

export type CurrentProfile = {
  id: string;
  employee_code: string;
  email: string;
  full_name: string;
  job_title: string | null;
  role: EmsRole;
  employment_status: string;
  is_active: boolean;
  is_test_account: boolean;
  timezone: string;
};

type AccessContext = {
  userId: string | null;
  profile: CurrentProfile | null;
};

export const getCurrentAccess = cache(async (): Promise<AccessContext> => {
  const supabase = await createClient();

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  const userId =
    !claimsError && claimsData?.claims?.sub
      ? String(claimsData.claims.sub)
      : null;

  if (!userId) {
    return { userId: null, profile: null };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, employee_code, email, full_name, job_title, role, employment_status, is_active, is_test_account, timezone",
    )
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (error || !data || !isEmsRole(data.role)) {
    return { userId, profile: null };
  }

  return {
    userId,
    profile: {
      ...data,
      role: data.role,
    },
  };
});

export async function requireCurrentProfile() {
  const access = await getCurrentAccess();

  if (!access.userId) {
    redirect("/login");
  }

  if (!access.profile) {
    redirect("/access-denied?reason=profile");
  }

  if (
    !access.profile.is_active ||
    access.profile.employment_status === "deactivated"
  ) {
    redirect("/access-denied?reason=inactive");
  }

  return access.profile;
}

export async function requireRole(roles: readonly EmsRole[]) {
  const profile = await requireCurrentProfile();

  if (!roles.includes(profile.role)) {
    redirect("/access-denied?reason=role");
  }

  return profile;
}
