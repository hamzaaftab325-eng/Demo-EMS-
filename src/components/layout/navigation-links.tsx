"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  CalendarClock,
  ClipboardList,
  FileBarChart,
  Gauge,
  ListChecks,
  Settings,
  ShieldCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { navigation, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const icons: Record<NavItem["icon"], LucideIcon> = {
  dashboard: Gauge,
  day: ListChecks,
  requests: ClipboardList,
  live: Activity,
  scrum: CalendarClock,
  attendance: CalendarClock,
  employees: UsersRound,
  reports: FileBarChart,
  audit: ShieldCheck,
  settings: Settings,
};

export function NavigationLinks({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1" aria-label="EMS navigation">
      {navigation.map((item) => {
        const Icon = icons[item.icon];
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-cyan-50 text-cyan-800"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
            )}
          >
            <Icon className="size-4.5 shrink-0" aria-hidden="true" />
            <span className="flex-1">{item.label}</span>
            <span className="text-[10px] font-semibold text-slate-400">
              P{item.phase}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
