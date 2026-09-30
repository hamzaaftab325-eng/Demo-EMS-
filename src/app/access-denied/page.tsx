import { ShieldX } from "lucide-react";
import { logout } from "@/app/auth/actions";

const messages: Record<string, { title: string; body: string }> = {
  profile: {
    title: "EMS profile not linked",
    body: "Your authenticated account is not linked to an EMS employee profile.",
  },
  inactive: {
    title: "Account inactive",
    body: "Your employee profile is inactive or deactivated.",
  },
  role: {
    title: "You do not have access to this area",
    body: "Your EMS role does not allow this page. Database RLS remains the final data-access control.",
  },
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AccessDeniedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const reason = single(params.reason) ?? "role";
  const message = messages[reason] ?? messages.role;

  return (
    <main className="login-page">
      <section className="access-card">
        <div className="login-lock">
          <ShieldX size={20} />
        </div>
        <h1>{message.title}</h1>
        <p className="mut">{message.body}</p>

        <form action={logout}>
          <button className="btn pri" type="submit">
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}
