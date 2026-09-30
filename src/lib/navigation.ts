export type EmsRole = "employee" | "manager" | "super_admin";

export type NavIcon =
  | "sun"
  | "inbox"
  | "grid"
  | "radio"
  | "clip"
  | "cal"
  | "users"
  | "chart"
  | "scroll"
  | "gear"
  | "shield";

export type NavItem = {
  label: string;
  href: string;
  icon: NavIcon;
  roles: EmsRole[];
};

export type NavGroup = {
  label?: string;
  items: NavItem[];
};

export const navigationGroups: NavGroup[] = [
  {
    items: [
      { label: "My day & scrum", href: "/my-day", icon: "sun", roles: ["employee","manager","super_admin"] },
      { label: "Requests", href: "/requests", icon: "inbox", roles: ["employee","manager","super_admin"] },
    ],
  },
  {
    label: "Team",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: "grid", roles: ["manager","super_admin"] },
      { label: "Live view", href: "/live-view", icon: "radio", roles: ["manager","super_admin"] },
      { label: "Scrum board", href: "/scrum-board", icon: "clip", roles: ["manager","super_admin"] },
      { label: "Attendance", href: "/attendance", icon: "cal", roles: ["manager","super_admin"] },
      { label: "Employees", href: "/employees", icon: "users", roles: ["manager","super_admin"] },
      { label: "Reports", href: "/reports", icon: "chart", roles: ["manager","super_admin"] },
    ],
  },
  {
    label: "Admin",
    items: [
      { label: "Audit log", href: "/audit", icon: "scroll", roles: ["super_admin"] },
      { label: "Settings", href: "/settings", icon: "gear", roles: ["super_admin"] },
    ],
  },
  {
    items: [
      { label: "What we record", href: "/privacy", icon: "shield", roles: ["employee","manager","super_admin"] },
    ],
  },
];
