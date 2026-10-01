import Image from "next/image";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { login } from "@/app/auth/actions";

const errorMessages: Record<string, string> = {
  configuration:
    "EMS authentication is not configured on this deployment yet. Add the Supabase public environment variables in Vercel.",
  invalid_credentials: "The email or password is incorrect.",
  missing_credentials: "Enter both your email and password.",
  not_authorized:
    "This account is not linked to an active EMS employee profile.",
  inactive_account:
    "This EMS account is inactive. Contact an administrator if you need access.",
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const errorCode = single(params.error);
  const nextPath = single(params.next);
  const message = errorCode ? errorMessages[errorCode] : null;

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
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
            <h1 id="login-title">Welcome back</h1>
            <p className="login-copy">
              Sign in with your current EMS login email and password.
            </p>
          </div>
        </div>

        <div className="login-form-panel">
          <div className="login-lock" aria-hidden="true">
            <LockKeyhole size={18} />
          </div>

          <h2>Sign in</h2>
          <p className="mut login-help">
            Sign in with your employee account. New employees activate access
            from the invitation sent by a Super Admin. Public sign-up is disabled.
          </p>

          {message ? (
            <div className="login-error" role="alert">
              {message}
            </div>
          ) : null}

          <form action={login}>
            {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}

            <label className="f">
              <span>Work / login email</span>
              <input
                type="email"
                name="email"
                autoComplete="username"
                defaultValue="demo.admin@example.test"
                required
              />
            </label>

            <label className="f">
              <span>Password</span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
              />
            </label>

            <button className="btn brand login-submit" type="submit">
              Sign in to EMS
            </button>
          </form>

          <div className="login-secondary-action">
            <Link href="/forgot-password">Forgot your password?</Link>
          </div>

          <div className="login-note">
            <b>Development account</b>
            <span>demo.admin@example.test · Super Admin</span>
          </div>
        </div>
      </section>
    </main>
  );
}
