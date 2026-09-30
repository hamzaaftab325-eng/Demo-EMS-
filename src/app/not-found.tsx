import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50 p-6">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold text-cyan-700">404</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          Page not found
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          The EMS route you requested does not exist.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-xl bg-[#00AFDD] px-4 text-sm font-semibold text-white"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
