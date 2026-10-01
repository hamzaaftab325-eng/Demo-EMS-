"use client";

import Image from "next/image";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ScreenState = "checking" | "ready" | "invalid" | "saving";

export function SetPasswordForm({
  mode = "reset",
}: {
  mode?: "invite" | "reset";
}) {
  const [state, setState] = useState<ScreenState>("checking");
  const [message, setMessage] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function establishSession() {
      const supabase = createClient();
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const errorDescription = hash.get("error_description");
      const search = new URLSearchParams(window.location.search);
      const code = search.get("code");
      const inviteMode =
        mode === "invite" ||
        search.get("mode") === "invite" ||
        hash.get("type") === "invite";

      if (errorDescription) {
        if (!cancelled) {
          setMessage(decodeURIComponent(errorDescription));
          setState("invalid");
        }
        return;
      }

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          if (!cancelled) {
            setMessage("This setup link is invalid or has expired.");
            setState("invalid");
          }
          return;
        }

        if (inviteMode) {
          window.location.replace("/signup");
          return;
        }

        window.history.replaceState({}, document.title, "/set-password");
      } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          if (!cancelled) {
            setMessage("This setup link is invalid or has expired.");
            setState("invalid");
          }
          return;
        }

        if (inviteMode) {
          window.location.replace("/signup");
          return;
        }

        window.history.replaceState({}, document.title, "/set-password");
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!cancelled) {
        if (user) {
          setState("ready");
        } else {
          setMessage(
            "Open the latest invitation or password reset email to continue.",
          );
          setState("invalid");
        }
      }
    }

    void establishSession();

    return () => {
      cancelled = true;
    };
  }, [mode]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (
      password.length < 12 ||
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      setMessage(
        "Use at least 12 characters with uppercase, lowercase and a number.",
      );
      return;
    }

    if (password !== confirm) {
      setMessage("Passwords do not match.");
      return;
    }

    setState("saving");

    const supabase = createClient();

    const { error: passwordError } = await supabase.auth.updateUser({
      password,
    });

    if (passwordError) {
      setMessage(passwordError.message || "Could not update the password.");
      setState("ready");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Your session expired. Open the setup email again.");
      setState("invalid");
      return;
    }

    let activated = false;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("auth_activated_at, is_active, employment_status")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (
        profileError ||
        !profile ||
        !profile.is_active ||
        profile.employment_status === "deactivated"
      ) {
        setMessage(
          "Your EMS employee profile is unavailable. Contact an administrator.",
        );
        setState("invalid");
        return;
      }

      if (profile.auth_activated_at) {
        activated = true;
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    if (!activated) {
      setMessage(
        "Your password was saved, but account activation did not complete. Contact an administrator before signing in.",
      );
      setState("ready");
      return;
    }

    window.location.replace("/");
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="password-title">
        <div className="login-brand">
          <Image
            src="/emarketselect-logo.png"
            alt="eMarketSelect"
            width={330}
            height={52}
            priority
          />

          <div>
            <p className="login-eyebrow">Employee Management System</p>
            <h1 id="password-title">
              {mode === "invite" ? "Create your EMS account" : "Set your password"}
            </h1>
            <p className="login-copy">
              {mode === "invite"
                ? "Choose your password to activate your employee account and continue to EMS."
                : "Choose a new password using the secure recovery link sent to your email."}
            </p>
          </div>
        </div>

        <div className="login-form-panel">
          <div className="login-lock" aria-hidden="true">
            <LockKeyhole size={18} />
          </div>

          <h2>{mode === "invite" ? "Sign up" : "Password setup"}</h2>
          <p className="mut login-help">
            Your administrator never sees this password.
          </p>

          {message ? (
            <div
              className={state === "invalid" ? "login-error" : "form-error"}
              role="alert"
            >
              {message}
            </div>
          ) : null}

          {state === "checking" ? (
            <p className="mut">Checking your secure setup link…</p>
          ) : state === "invalid" ? (
            <Link className="btn brand login-submit" href="/login">
              Return to sign in
            </Link>
          ) : (
            <form onSubmit={submit}>
              <label className="f">
                <span>New password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={12}
                  required
                  disabled={state === "saving"}
                />
              </label>

              <label className="f">
                <span>Confirm password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  minLength={12}
                  required
                  disabled={state === "saving"}
                />
              </label>

              <p className="mut password-requirements">
                At least 12 characters with uppercase, lowercase and a number.
              </p>

              <button
                className="btn brand login-submit"
                type="submit"
                disabled={state === "saving"}
              >
                {state === "saving"
                  ? "Activating…"
                  : mode === "invite"
                    ? "Create account & sign in"
                    : "Save new password"}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
