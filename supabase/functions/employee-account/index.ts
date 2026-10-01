import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.1";

type ActionBody =
  | { action: "invite"; employee_id: string; redirect_to: string }
  | { action: "activate" };

const allowedOrigins = new Set([
  "https://demo-ems-ten.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin)
      ? origin
      : "https://demo-ems-ten.vercel.app",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
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

function validSetupRedirect(value: string) {
  try {
    const url = new URL(value);
    return allowedOrigins.has(url.origin) && url.pathname === "/set-password";
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return json(req, 405, { error: "Method not allowed." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(req, 500, { error: "Supabase function configuration is incomplete." });
  }

  const authorization = req.headers.get("Authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (!token) {
    return json(req, 401, { error: "Authentication required." });
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser(token);

  if (userError || !user) {
    return json(req, 401, { error: "Invalid or expired session." });
  }

  const { data: caller, error: callerError } = await adminClient
    .from("profiles")
    .select(
      "id, role, is_active, employment_status, is_test_account, auth_activated_at",
    )
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

  let body: ActionBody;
  try {
    body = (await req.json()) as ActionBody;
  } catch {
    return json(req, 400, { error: "Invalid request body." });
  }

  if (body.action === "activate") {
    if (!user.email_confirmed_at) {
      return json(req, 409, { error: "Confirm the invitation email first." });
    }

    const activatedAt = new Date().toISOString();
    const { error: activateError } = await adminClient
      .from("profiles")
      .update({
        auth_activated_at: activatedAt,
        updated_at: activatedAt,
      })
      .eq("id", caller.id)
      .eq("auth_user_id", user.id);

    if (activateError) {
      return json(req, 500, { error: "Could not activate the EMS account." });
    }

    return json(req, 200, { ok: true, status: "activated" });
  }

  if (body.action !== "invite") {
    return json(req, 400, { error: "Unsupported account action." });
  }

  if (caller.role !== "super_admin") {
    return json(req, 403, { error: "Super Admin access required." });
  }

  if (!body.employee_id || !validSetupRedirect(body.redirect_to)) {
    return json(req, 400, { error: "Invalid employee or setup URL." });
  }

  const { data: target, error: targetError } = await adminClient
    .from("profiles")
    .select(
      "id, email, full_name, is_active, employment_status, is_test_account, auth_user_id, auth_invited_at, auth_activated_at",
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
    return json(req, 404, { error: "Employee is not available for invitation." });
  }

  if (target.auth_activated_at) {
    return json(req, 200, { ok: true, status: "already_active" });
  }

  if (target.auth_user_id) {
    const { error: resendError } = await authClient.auth.resetPasswordForEmail(
      target.email,
      { redirectTo: body.redirect_to },
    );

    if (resendError) {
      return json(req, 502, { error: "Could not resend the password setup email." });
    }

    const invitedAt = new Date().toISOString();
    await adminClient
      .from("profiles")
      .update({ auth_invited_at: invitedAt, updated_at: invitedAt })
      .eq("id", target.id);

    return json(req, 200, { ok: true, status: "resent" });
  }

  const { data: inviteData, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(target.email, {
      redirectTo: body.redirect_to,
      data: {
        full_name: target.full_name,
        employee_id: target.id,
      },
    });

  if (inviteError || !inviteData.user) {
    return json(req, 502, { error: "Could not send the employee invitation." });
  }

  const invitedAt = new Date().toISOString();
  const { data: linkedProfile, error: linkError } = await adminClient
    .from("profiles")
    .update({ auth_invited_at: invitedAt, updated_at: invitedAt })
    .eq("id", target.id)
    .select("auth_user_id")
    .maybeSingle();

  if (linkError || linkedProfile?.auth_user_id !== inviteData.user.id) {
    return json(req, 500, {
      error: "Invitation was created, but the EMS profile did not link correctly.",
    });
  }

  return json(req, 200, { ok: true, status: "sent" });
});
