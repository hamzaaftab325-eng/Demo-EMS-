import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireCurrentProfile } from "@/lib/auth/current-profile";
import { getUnreadNotificationCount } from "@/lib/data/notifications";

export default async function EmsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profile = await requireCurrentProfile();
  const unreadNotifications = await getUnreadNotificationCount(profile);

  return (
    <AppShell
      profile={profile}
      unreadNotifications={unreadNotifications}
    >
      {children}
    </AppShell>
  );
}
