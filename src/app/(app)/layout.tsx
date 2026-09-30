import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireCurrentProfile } from "@/lib/auth/current-profile";

export default async function EmsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profile = await requireCurrentProfile();

  return <AppShell profile={profile}>{children}</AppShell>;
}
