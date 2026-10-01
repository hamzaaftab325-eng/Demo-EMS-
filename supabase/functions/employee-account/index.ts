import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.1";

type InviteBody = {
  action: "invite";
  employee_id: string;
};

type AssignWorkEmailBody = {
  action: "assign_work_email";
  employee_id: string;
  work_email: string;
};

type DeleteDemoEmployeeBody = {
  action: "delete_demo_employee";
  employee_id: string;
  reason: string;
};

type RequestBody =
  | InviteBody
  | AssignWorkEmailBody
  | DeleteDemoEmployeeBody;

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
    normalized.includes("not authorized") ||
    normalized.includes("you can only send testing emails to your own email address") ||
    normalized.includes("verify a domain")
  ) {
    return "demo_email_not_authorized";
  }

  if (
    normalized.includes("rate limit") ||
    normalized.includes("too many requests") ||
    normalized.includes("email rate limit exceeded")
  ) {
    return "email_rate_limited";
  }

  return "failed";
}

function normalizedEmail(value: string) {
  return value.trim().toLowerCase();
}

function validEmail(value: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
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

  let body: RequestBody;

  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json(req, 400, { error: "Invalid request body." });
  }

  if (!body.employee_id) {
    return json(req, 400, { error: "Employee ID is required." });
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
      error: "Employee is not available for this access action.",
    });
  }

  async function writeFailureAudit(
    action: string,
    status: string,
    message: string,
  ) {
    await adminClient.from("audit_logs").insert({
      actor_id: caller.id,
      action,
      entity_type: "profile",
      entity_id: target.id,
      after_data: {
        email: target.email,
        status,
      },
      reason: message.slice(0, 500),
    });
  }

  if (body.action === "delete_demo_employee") {
    const reason = body.reason?.trim() ?? "";

    if (!reason) {
      return json(req, 200, {
        ok: false,
        status: "delete_failed",
        message: "A deletion reason is required.",
      });
    }

    if (!target.is_test_account) {
      return json(req, 200, {
        ok: false,
        status: "delete_not_allowed",
        message:
          "Permanent deletion is available only for demo/test employees. Deactivate production employees instead.",
      });
    }

    if (target.id === caller.id) {
      return json(req, 200, {
        ok: false,
        status: "delete_not_allowed",
        message: "You cannot delete your own Super Admin account.",
      });
    }

    const previousAuthEmail = target.email;
    const tombstoneEmail =
      "deleted+" + target.id.replaceAll("-", "") + "@example.test";
    let authTombstoned = false;

    if (target.auth_user_id) {
      const { error: authTombstoneError } =
        await adminClient.auth.admin.updateUserById(target.auth_user_id, {
          email: tombstoneEmail,
          email_confirm: true,
        });

      if (authTombstoneError) {
        await writeFailureAudit(
          "employee_delete_failed",
          "auth_tombstone_failed",
          authTombstoneError.message,
        );

        return json(req, 200, {
          ok: false,
          status: "delete_failed",
          message: "The employee Auth identity could not be released for reuse.",
        });
      }

      authTombstoned = true;
    }

    const { error: archiveError } = await adminClient.rpc(
      "service_archive_demo_employee",
      {
        p_employee_id: target.id,
        p_actor_id: caller.id,
        p_reason: reason,
      },
    );

    if (archiveError) {
      if (authTombstoned && target.auth_user_id) {
        await adminClient.auth.admin.updateUserById(target.auth_user_id, {
          email: previousAuthEmail,
          email_confirm: true,
        });
      }

      await writeFailureAudit(
        "employee_delete_failed",
        "archive_failed",
        archiveError.message,
      );

      return json(req, 200, {
        ok: false,
        status: "delete_failed",
        message: archiveError.message,
      });
    }

    return json(req, 200, {
      ok: true,
      status: "deleted",
    });
  }

  if (body.action === "assign_work_email") {
    if (!target.auth_user_id || !target.auth_activated_at) {
      return json(req, 200, {
        ok: false,
        status: "requires_activation",
        message:
          "The employee must complete account setup before a work login email can be assigned.",
      });
    }

    const workEmail = normalizedEmail(body.work_email ?? "");

    if (!validEmail(workEmail)) {
      return json(req, 200, {
        ok: false,
        status: "invalid_work_email",
        message: "Enter a valid work email.",
      });
    }

    if (
      !target.is_test_account &&
      !/^[^@\s]+@emarketselect\.com$/i.test(workEmail)
    ) {
      return json(req, 200, {
        ok: false,
        status: "invalid_work_email",
        message: "Production work email must use @emarketselect.com.",
      });
    }

    const { data: accessContact } = await adminClient
      .from("employee_access_contacts")
      .select("work_email")
      .eq("employee_id", target.id)
      .maybeSingle();

    if (
      normalizedEmail(target.email) === workEmail &&
      normalizedEmail(accessContact?.work_email ?? "") === workEmail
    ) {
      return json(req, 200, {
        ok: true,
        status: "work_email_already_assigned",
      });
    }

    const previousLoginEmail = target.email;

    const { error: authUpdateError } =
      await adminClient.auth.admin.updateUserById(target.auth_user_id, {
        email: workEmail,
        email_confirm: true,
      });

    if (authUpdateError) {
      await writeFailureAudit(
        "employee_work_email_assignment_failed",
        "auth_update_failed",
        authUpdateError.message,
      );

      return json(req, 200, {
        ok: false,
        status: "work_email_failed",
        message: authUpdateError.message,
      });
    }

    const { error: profileUpdateError } = await adminClient.rpc(
      "service_assign_employee_work_email",
      {
        p_employee_id: target.id,
        p_work_email: workEmail,
        p_actor_id: caller.id,
      },
    );

    if (profileUpdateError) {
      await adminClient.auth.admin.updateUserById(target.auth_user_id, {
        email: previousLoginEmail,
        email_confirm: true,
      });

      await writeFailureAudit(
        "employee_work_email_assignment_failed",
        "profile_update_failed",
        profileUpdateError.message,
      );

      return json(req, 200, {
        ok: false,
        status: "work_email_failed",
        message:
          "The work email could not be assigned. The previous login email was restored.",
      });
    }

    return json(req, 200, {
      ok: true,
      status: "work_email_assigned",
    });
  }

  if (body.action !== "invite") {
    return json(req, 400, { error: "Unsupported employee access action." });
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
        "The @example.test address is intentionally non-deliverable. Use a deliverable setup mailbox for email testing.",
    });
  }

  const wasResend = Boolean(target.auth_user_id);

  if (target.auth_user_id) {
    const { error: deleteError } =
      await adminClient.auth.admin.deleteUser(target.auth_user_id);

    if (deleteError) {
      await writeFailureAudit(
        "employee_invitation_failed",
        "replace_invite_failed",
        deleteError.message,
      );

      return json(req, 200, {
        ok: false,
        status: "failed",
        message:
          "The previous incomplete setup session could not be replaced. Try again.",
      });
    }
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
    const status = emailFailureStatus(message);

    await writeFailureAudit("employee_invitation_failed", status, message);

    return json(req, 200, {
      ok: false,
      status,
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

  await adminClient.from("audit_logs").insert({
    actor_id: caller.id,
    action: wasResend
      ? "employee_setup_invitation_resent"
      : "employee_invitation_sent",
    entity_type: "profile",
    entity_id: target.id,
    before_data: {
      auth_user_id: target.auth_user_id,
      auth_invited_at: target.auth_invited_at,
    },
    after_data: {
      email: target.email,
      auth_user_id: inviteData.user.id,
      auth_invited_at: invitedAt,
    },
    reason: wasResend
      ? "Employee account setup invitation replaced and resent"
      : "Employee account setup invitation sent",
  });

  return json(req, 200, {
    ok: true,
    status: wasResend ? "resent" : "sent",
  });
});
