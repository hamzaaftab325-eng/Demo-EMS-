"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ChartNoAxesCombined,
  CircleRadio,
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
import { navigationGroups, type NavIcon } from "@/lib/navigation";

const icons: Record<NavIcon, LucideIcon> = {
  sun: Sun,
  inbox: Inbox,
  grid: Grid2X2,
  radio: CircleRadio,
  clip: ClipboardList,
  cal: CalendarDays,
  users: Users,
  chart: ChartNoAxesCombined,
  scroll: ScrollText,
  gear: Settings,
  shield: ShieldCheck,
};

export function NavigationLinks({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="nav" aria-label="EMS navigation">
      {navigationGroups.map((group, groupIndex) => (
        <div className="navgroup" key={group.label ?? `group-${groupIndex}`}>
          {group.label ? <div className="gl">{group.label}</div> : null}
          {group.items.map((item) => {
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
                {item.href === "/requests" ? (
                  <span
                    style={{
                      marginLeft: "auto",
                      background: "var(--gold)",
                      color: "#181818",
                      borderRadius: 999,
                      padding: "0 7px",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    2
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
