import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.1";

type InviteBody = {
  action: "invite";
  employee_id: string;
};

const allowedOrigins = new Set([
  "https://demo-ems-ten.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

const accountSetupRedirect =
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

function json(req: Request, status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
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

function emailFailureStatus(message: string) {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("email address not authorized") ||
    normalized.includes("not authorized")
  ) {
    return "demo_email_not_authorized";
  }

  return "failed";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return json(req, 405, { error: "Method not allowed." });
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
    return json(req, 500, {
      error: "Supabase function configuration is incomplete.",
    });
  }

  const authorization = req.headers.get("Authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (!token) {
    return json(req, 401, { error: "Authentication required." });
  }

  const publicClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userError,
  } = await publicClient.auth.getUser(token);

  if (userError || !user) {
    return json(req, 401, { error: "Invalid or expired session." });
  }

  const { data: caller, error: callerError } = await adminClient
    .from("profiles")
    .select("id, role, is_active, employment_status, is_test_account")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (
    callerError ||
    !caller ||
    !caller.is_active ||
    caller.employment_status === "deactivated"
  ) {
    return json(req, 403, { error: "Active EMS profile required." });
  }

  if (caller.role !== "super_admin") {
    return json(req, 403, { error: "Super Admin access required." });
  }

  let body: InviteBody;

  try {
    body = (await req.json()) as InviteBody;
  } catch {
    return json(req, 400, { error: "Invalid request body." });
  }

  if (body.action !== "invite" || !body.employee_id) {
    return json(req, 400, { error: "Invalid employee invitation request." });
  }

  const { data: target, error: targetError } = await adminClient
    .from("profiles")
    .select(
      "id, email, full_name, employee_code, job_title, role, is_active, employment_status, is_test_account, auth_user_id, auth_invited_at, auth_activated_at",
    )
    .eq("id", body.employee_id)
    .maybeSingle();

  if (
    targetError ||
    !target ||
    !target.is_active ||
    target.employment_status === "deactivated" ||
    target.is_test_account !== caller.is_test_account
  ) {
    return json(req, 404, {
      error: "Employee is not available for invitation.",
    });
  }

  if (target.auth_activated_at) {
    return json(req, 200, {
      ok: true,
      status: "already_active",
    });
  }

  if (target.email.toLowerCase().endsWith("@example.test")) {
    return json(req, 200, {
      ok: false,
      status: "demo_address",
      message:
        "The @example.test address is intentionally non-deliverable. Use an approved real mailbox to test email delivery.",
    });
  }

  async function writeAudit(action: string, invitedAt: string) {
    await adminClient.from("audit_logs").insert({
      actor_id: caller.id,
      action,
      entity_type: "profile",
      entity_id: target.id,
      before_data: {
        auth_user_id: target.auth_user_id,
        auth_invited_at: target.auth_invited_at,
      },
      after_data: {
        email: target.email,
        auth_invited_at: invitedAt,
      },
      reason: "Employee account setup email",
    });
  }

  if (target.auth_user_id) {
    const { error: resendError } =
      await publicClient.auth.resetPasswordForEmail(target.email, {
        redirectTo: accountSetupRedirect,
      });

    if (resendError) {
      return json(req, 200, {
        ok: false,
        status: emailFailureStatus(resendError.message),
        message: resendError.message,
      });
    }

    const invitedAt = new Date().toISOString();

    const { error: updateError } = await adminClient
      .from("profiles")
      .update({
        auth_invited_at: invitedAt,
        updated_at: invitedAt,
      })
      .eq("id", target.id);

    if (updateError) {
      return json(req, 500, {
        error: "Setup email was sent, but EMS could not record its timestamp.",
      });
    }

    await writeAudit("employee_setup_link_resent", invitedAt);

    return json(req, 200, {
      ok: true,
      status: "resent",
    });
  }

  const { data: inviteData, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(target.email, {
      redirectTo: accountSetupRedirect,
      data: {
        full_name: target.full_name,
        employee_code: target.employee_code,
        job_title: target.job_title,
        role: target.role,
      },
    });

  if (inviteError || !inviteData.user) {
    const message = inviteError?.message ?? "Invitation could not be sent.";

    return json(req, 200, {
      ok: false,
      status: emailFailureStatus(message),
      message,
    });
  }

  const invitedAt = new Date().toISOString();

  const { data: linkedProfile, error: linkError } = await adminClient
    .from("profiles")
    .update({
      auth_invited_at: invitedAt,
      updated_at: invitedAt,
    })
    .eq("id", target.id)
    .select("auth_user_id")
    .maybeSingle();

  if (linkError || linkedProfile?.auth_user_id !== inviteData.user.id) {
    return json(req, 500, {
      error:
        "Invitation was created, but the EMS profile did not link correctly.",
    });
  }

  await writeAudit("employee_invitation_sent", invitedAt);

  return json(req, 200, {
    ok: true,
    status: "sent",
  });
});
