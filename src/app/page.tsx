import { redirect } from "next/navigation";
import { getCurrentAccess } from "@/lib/auth/current-profile";
import { homeForRole } from "@/lib/navigation";

export default async function HomePage() {
  const { userId, profile } = await getCurrentAccess();

  if (!userId) {
    redirect("/login");
  }

  if (!profile || !profile.is_active || profile.employment_status === "deactivated") {
    redirect("/access-denied?reason=profile");
  }

  redirect(homeForRole(profile.role));
}
