import { LockKeyhole } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#F5F7F9] p-5">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/40 sm:p-9">
        <div className="grid size-12 place-items-center rounded-2xl bg-[#0D1B2A] text-white">
          <LockKeyhole className="size-5" />
        </div>

        <Badge className="mt-6">Phase 2</Badge>

        <h1 className="mt-3 text-2xl font-bold tracking-tight">
          EMS authentication
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          The login route is prepared in Phase 1. Password authentication and
          session protection are implemented in Phase 2.
        </p>

        <div className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Development account prepared:{" "}
          <span className="font-semibold text-slate-900">
            demo.admin@example.test
          </span>
        </div>
      </section>
    </main>
  );
}
