export type EmsRole = "employee" | "manager" | "super_admin";

export type NavItem = {
  label: string;
  href: string;
  icon:
    | "dashboard"
    | "day"
    | "requests"
    | "live"
    | "scrum"
    | "attendance"
    | "employees"
    | "reports"
    | "audit"
    | "settings";
  phase: number;
  roles: EmsRole[];
};

export const navigation: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "dashboard", phase: 7, roles: ["manager", "super_admin"] },
  { label: "My Day", href: "/my-day", icon: "day", phase: 4, roles: ["employee", "manager", "super_admin"] },
  { label: "Requests", href: "/requests", icon: "requests", phase: 6, roles: ["employee", "manager", "super_admin"] },
  { label: "Live View", href: "/live-view", icon: "live", phase: 5, roles: ["manager", "super_admin"] },
  { label: "Scrum Board", href: "/scrum-board", icon: "scrum", phase: 7, roles: ["manager", "super_admin"] },
  { label: "Attendance", href: "/attendance", icon: "attendance", phase: 5, roles: ["employee", "manager", "super_admin"] },
  { label: "Employees", href: "/employees", icon: "employees", phase: 3, roles: ["manager", "super_admin"] },
  { label: "Reports", href: "/reports", icon: "reports", phase: 7, roles: ["manager", "super_admin"] },
  { label: "Audit", href: "/audit", icon: "audit", phase: 8, roles: ["super_admin"] },
  { label: "Settings", href: "/settings", icon: "settings", phase: 8, roles: ["super_admin"] }
];
