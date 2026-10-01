import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

const required = [
  "src/lib/auth/current-profile.ts",
  "src/lib/auth/paths.ts",
  "src/app/auth/actions.ts",
  "src/lib/supabase/proxy.ts",
  "src/app/(app)/layout.tsx",
  "src/lib/navigation.ts",
  "supabase/migrations/20261001124046_phase2_require_completed_account_activation.sql",
  "supabase/migrations/20261001124343_phase2_restore_authenticated_rls_helpers.sql",
];

const missing = required.filter((path) => !existsSync(join(root, path)));
const failures = [];

if (missing.length) {
  failures.push(...missing.map((path) => "Missing: " + path));
}

if (!missing.length) {
  const profile = read("src/lib/auth/current-profile.ts");
  const home = read("src/app/page.tsx");
  const login = read("src/app/auth/actions.ts");
  const proxy = read("src/lib/supabase/proxy.ts");
  const paths = read("src/lib/auth/paths.ts");
  const navigation = read("src/lib/navigation.ts");

  if (!profile.includes('redirect("/signup")')) {
    failures.push("Shared profile guard must send unactivated accounts to /signup.");
  }

  if (!profile.includes('employment_status === "deactivated"')) {
    failures.push("Shared profile guard must reject deactivated accounts.");
  }

  if (!home.includes('redirect("/access-denied?reason=inactive")')) {
    failures.push("Root route must distinguish inactive access.");
  }

  if (!home.includes('redirect("/signup")')) {
    failures.push("Root route must block unactivated accounts.");
  }

  if (!login.includes('supabase.auth.signInWithPassword')) {
    failures.push("Password login action is missing.");
  }

  if (!login.includes('await supabase.auth.signOut()')) {
    failures.push("Unauthorized login must terminate the Supabase session.");
  }

  if (!proxy.includes("supabase.auth.getClaims()")) {
    failures.push("Route proxy must verify authenticated claims.");
  }

  if (!paths.includes("ALLOWED_APP_PATHS")) {
    failures.push("Post-login next-path allow-list is missing.");
  }

  for (const role of ["employee", "manager", "director", "super_admin"]) {
    if (!navigation.includes('"' + role + '"')) {
      failures.push("Navigation role missing: " + role);
    }
  }
}

if (failures.length) {
  console.error("Phase 2 authentication verification failed.");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}

console.log(
  "Phase 2 authentication verified: session, activation, inactive-user, role navigation and redirect guards are present.",
);
