export type EmsRole =
  | "employee"
  | "manager"
  | "director"
  | "super_admin";

export const ALL_ROLES = [
  "employee",
  "manager",
  "director",
  "super_admin",
] as const;

export const TEAM_ROLES = ["manager", "director", "super_admin"] as const;
export const ADMIN_ROLES = ["super_admin"] as const;

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
  roles: readonly EmsRole[];
};

export type NavGroup = {
  label?: string;
  items: NavItem[];
};

export const navigationGroups: NavGroup[] = [
  {
    items: [
      {
        label: "My day & scrum",
        href: "/my-day",
        icon: "sun",
        roles: ALL_ROLES,
      },
      {
        label: "Requests",
        href: "/requests",
        icon: "inbox",
        roles: ALL_ROLES,
      },
    ],
  },
  {
    label: "Team",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: "grid",
        roles: TEAM_ROLES,
      },
      {
        label: "Live view",
        href: "/live-view",
        icon: "radio",
        roles: TEAM_ROLES,
      },
      {
        label: "Scrum board",
        href: "/scrum-board",
        icon: "clip",
        roles: TEAM_ROLES,
      },
      {
        label: "Attendance",
        href: "/attendance",
        icon: "cal",
        roles: TEAM_ROLES,
      },
      {
        label: "Employees",
        href: "/employees",
        icon: "users",
        roles: TEAM_ROLES,
      },
      {
        label: "Reports",
        href: "/reports",
        icon: "chart",
        roles: TEAM_ROLES,
      },
    ],
  },
  {
    label: "Admin",
    items: [
      {
        label: "Audit log",
        href: "/audit",
        icon: "scroll",
        roles: ADMIN_ROLES,
      },
      {
        label: "Settings",
        href: "/settings",
        icon: "gear",
        roles: ADMIN_ROLES,
      },
    ],
  },
  {
    items: [
      {
        label: "What we record",
        href: "/privacy",
        icon: "shield",
        roles: ALL_ROLES,
      },
    ],
  },
];

export function isEmsRole(value: unknown): value is EmsRole {
  return (
    value === "employee" ||
    value === "manager" ||
    value === "director" ||
    value === "super_admin"
  );
}

export function roleLabel(role: EmsRole) {
  switch (role) {
    case "employee":
      return "Employee";
    case "manager":
      return "Manager";
    case "director":
      return "Director";
    case "super_admin":
      return "Super Admin";
  }
}

export function homeForRole(role: EmsRole) {
  return role === "employee" ? "/my-day" : "/dashboard";
}
