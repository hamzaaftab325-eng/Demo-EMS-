"use client";

import Image from "next/image";
import Link from "next/link";
import { Mail } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    const supabase = createClient();

    await supabase.functions.invoke("employee-password-recovery", {
      body: {
        email: email.trim().toLowerCase(),
      },
    });

    setPending(false);
    setSent(true);
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="recovery-title">
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
            <h1 id="recovery-title">Reset your password</h1>
            <p className="login-copy">
              We will send a secure password setup link to the employee email
              attached to your EMS account.
            </p>
          </div>
        </div>

        <div className="login-form-panel">
          <div className="login-lock" aria-hidden="true">
            <Mail size={18} />
          </div>

          <h2>Password recovery</h2>

          {sent ? (
            <>
              <div className="form-success">
                If an EMS account exists for that email, a password reset link
                has been sent.
              </div>
              <Link className="btn brand login-submit" href="/login">
                Return to sign in
              </Link>
            </>
          ) : (
            <form onSubmit={submit}>
              <label className="f">
                <span>Current EMS login email</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  disabled={pending}
                />
              </label>

              <button
                className="btn brand login-submit"
                type="submit"
                disabled={pending}
              >
                {pending ? "Sending…" : "Send reset link"}
              </button>
            </form>
          )}

          <div className="login-secondary-action">
            <Link href="/login">Back to sign in</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
