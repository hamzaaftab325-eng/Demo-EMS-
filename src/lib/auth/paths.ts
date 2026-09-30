export function sanitizeNextPath(value: FormDataEntryValue | string | null) {
  if (typeof value !== "string") return null;

  const path = value.trim();

  if (!path.startsWith("/") || path.startsWith("//")) {
    return null;
  }

  if (path.startsWith("/login") || path.startsWith("/access-denied")) {
    return null;
  }

  return path;
}
