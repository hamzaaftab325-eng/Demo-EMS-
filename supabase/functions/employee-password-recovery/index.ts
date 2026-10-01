import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.1";

const allowedOrigins = new Set([
  "https://demo-ems-ten.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

const passwordResetRedirect =
  "https://demo-ems-ten.vercel.app/set-password";

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";

  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin)
      ? origin
      : "https://demo-ems-ten.vercel.app",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function response(req: Request) {
  return new Response(
    JSON.stringify({
      ok: true,
      message:
        "If an active EMS account exists for that login email, a password reset link has been sent.",
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders(req),
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
}

function getDefaultKey(jsonValue: string | undefined, fallback?: string) {
  if (jsonValue) {
    try {
      const values = JSON.parse(jsonValue) as Record<string, string>;
      if (values.default) return values.default;
    } catch {
      // Fall through to the legacy key while it remains available.
    }
  }

  return fallback ?? "";
}

function normalizedEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return response(req);
  }

  let email = "";

  try {
    const body = (await req.json()) as { email?: unknown };
    email = normalizedEmail(body.email);
  } catch {
    return response(req);
  }

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return response(req);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const publishableKey = getDefaultKey(
    Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? undefined,
    Deno.env.get("SUPABASE_ANON_KEY") ?? undefined,
  );
  const secretKey = getDefaultKey(
    Deno.env.get("SUPABASE_SECRET_KEYS") ?? undefined,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? undefined,
  );

  if (!supabaseUrl || !publishableKey || !secretKey) {
    return response(req);
  }

  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile } = await adminClient
    .from("profiles")
    .select(
      "id, email, auth_user_id, auth_activated_at, is_active, employment_status",
    )
    .ilike("email", email)
    .maybeSingle();

  if (
    !profile ||
    !profile.auth_user_id ||
    !profile.auth_activated_at ||
    !profile.is_active ||
    profile.employment_status === "deactivated"
  ) {
    return response(req);
  }

  const publicClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await publicClient.auth.resetPasswordForEmail(profile.email, {
    redirectTo: passwordResetRedirect,
  });

  return response(req);
});
