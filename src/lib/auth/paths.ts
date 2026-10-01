const ALLOWED_APP_PATHS = [
  "/my-day",
  "/requests",
  "/dashboard",
  "/live-view",
  "/scrum-board",
  "/attendance",
  "/employees",
  "/reports",
  "/audit",
  "/settings",
  "/privacy",
  "/notifications",
] as const;

export function sanitizeNextPath(value: FormDataEntryValue | string | null) {
  if (typeof value !== "string") return null;

  const raw = value.trim();

  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return null;
  }

  let url: URL;

  try {
    url = new URL(raw, "https://ems.local");
  } catch {
    return null;
  }

  if (url.origin !== "https://ems.local") {
    return null;
  }

  if (url.pathname === "/") {
    return "/";
  }

  const allowed = ALLOWED_APP_PATHS.some(
    (path) => url.pathname === path || url.pathname.startsWith(path + "/"),
  );

  if (!allowed) {
    return null;
  }

  return url.pathname + url.search;
}
