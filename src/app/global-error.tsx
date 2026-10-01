"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main className="login-page">
          <section className="access-card" aria-labelledby="global-error-title">
            <p className="login-eyebrow">eMarketSelect EMS</p>
            <h1 id="global-error-title">EMS could not start</h1>
            <p className="mut">
              A foundation-level error prevented the application shell from
              loading. Retry once. If it continues, report the incident to the
              EMS administrator.
            </p>
            <button className="btn pri" type="button" onClick={reset}>
              Retry EMS
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
