import { redirect } from "next/navigation";
import { getCurrentAccess } from "@/lib/auth/current-profile";
import { homeForRole } from "@/lib/navigation";

export default async function HomePage() {
  const { userId, profile } = await getCurrentAccess();

  if (!userId) {
    redirect("/login");
  }

  if (!profile) {
    redirect("/access-denied?reason=profile");
  }

  if (!profile.is_active || profile.employment_status === "deactivated") {
    redirect("/access-denied?reason=inactive");
  }

  if (!profile.auth_activated_at) {
    redirect("/signup");
  }

  redirect(homeForRole(profile.role));
}
