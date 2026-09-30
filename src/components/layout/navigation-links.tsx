"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ChartNoAxesCombined,
  Radio,
  ClipboardList,
  Grid2X2,
  Inbox,
  ScrollText,
  Settings,
  ShieldCheck,
  Sun,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  navigationGroups,
  type EmsRole,
  type NavIcon,
} from "@/lib/navigation";

const icons: Record<NavIcon, LucideIcon> = {
  sun: Sun,
  inbox: Inbox,
  grid: Grid2X2,
  radio: Radio,
  clip: ClipboardList,
  cal: CalendarDays,
  users: Users,
  chart: ChartNoAxesCombined,
  scroll: ScrollText,
  gear: Settings,
  shield: ShieldCheck,
};

export function NavigationLinks({
  role,
  onNavigate,
}: {
  role: EmsRole;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="nav" aria-label="EMS navigation">
      {navigationGroups.map((group, groupIndex) => {
        const visibleItems = group.items.filter((item) =>
          item.roles.includes(role),
        );

        if (visibleItems.length === 0) {
          return null;
        }

        return (
          <div className="navgroup" key={group.label ?? `group-${groupIndex}`}>
            {group.label ? <div className="gl">{group.label}</div> : null}

            {visibleItems.map((item) => {
              const Icon = icons[item.icon];
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={active ? "on" : undefined}
                  onClick={onNavigate}
                >
                  <Icon strokeWidth={2} />
                  {item.label}

                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
