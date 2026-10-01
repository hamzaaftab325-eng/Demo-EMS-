import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import process from "node:process";

const root = process.cwd();

const requiredPaths = [
  ".env.example",
  ".node-version",
  "components.json",
  "next.config.ts",
  "src/proxy.ts",
  "src/app/layout.tsx",
  "src/app/error.tsx",
  "src/app/global-error.tsx",
  "src/app/loading.tsx",
  "src/app/not-found.tsx",
  "src/app/login/page.tsx",
  "src/lib/env.ts",
  "src/lib/supabase/client.ts",
  "src/lib/supabase/server.ts",
  "src/lib/supabase/proxy.ts",
  "src/types/database.ts",
  "supabase/baseline/20261001_phase1_schema_snapshot.sql",
];

const missing = requiredPaths.filter((path) => !existsSync(join(root, path)));

function filesUnder(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stats = statSync(path);
    if (stats.isDirectory()) out.push(...filesUnder(path));
    else out.push(path);
  }
  return out;
}

const browserFiles = [
  ...filesUnder(join(root, "src")),
  join(root, ".env.example"),
].filter((path) => existsSync(path));

const browserForbidden = [
  /SUPABASE_SERVICE_ROLE_KEY/i,
  /SUPABASE_SECRET_KEY/i,
  /service_role\s*[:=]/i,
];

const repositoryFiles = [
  ...browserFiles,
  ...filesUnder(join(root, "supabase")),
].filter((path) => existsSync(path));

const committedSecretValue = /sb_secret_[A-Za-z0-9_-]{16,}/i;

const secretHits = [];
for (const path of browserFiles) {
  const content = readFileSync(path, "utf8");
  for (const pattern of browserForbidden) {
    if (pattern.test(content)) {
      secretHits.push(relative(root, path) + " exposes " + pattern);
    }
  }
}

for (const path of repositoryFiles) {
  const content = readFileSync(path, "utf8");
  if (committedSecretValue.test(content)) {
    secretHits.push(relative(root, path) + " contains a committed Supabase secret value");
  }
}

const envExample = readFileSync(join(root, ".env.example"), "utf8");
const envContract = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
].filter((name) => !envExample.includes(name));

if (missing.length || secretHits.length || envContract.length) {
  console.error("Phase 1 foundation verification failed.");

  if (missing.length) {
    console.error("\nMissing required foundation paths:");
    for (const path of missing) console.error(" - " + path);
  }

  if (envContract.length) {
    console.error("\nMissing environment contract entries:");
    for (const name of envContract) console.error(" - " + name);
  }

  if (secretHits.length) {
    console.error("\nPotential privileged Supabase secret exposure:");
    for (const hit of secretHits) console.error(" - " + hit);
  }

  process.exit(1);
}

console.log(
  "Phase 1 foundation verified: structure, environment contract, baseline schema and secret guard are present.",
);
