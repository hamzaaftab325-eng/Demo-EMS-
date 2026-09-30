import type { ReactNode } from "react";

export function PageHead({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="ph">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div>{actions}</div> : null}
    </div>
  );
}

export function StatusPill({
  label,
  tone = "active",
}: {
  label: string;
  tone?: "active" | "idle" | "away" | "break" | "meeting" | "offline" | "ended";
}) {
  return (
    <span
      className="pill"
      style={{
        background: `color-mix(in srgb,var(--${tone}) 15%,transparent)`,
      }}
    >
      <i className="dot" style={{ background: `var(--${tone})` }} />
      {label}
    </span>
  );
}

export function Avatar({
  initials,
  color = "#00AFDD",
  size = 30,
}: {
  initials: string;
  color?: string;
  size?: number;
}) {
  return (
    <span
      className="av"
      style={{ width: size, height: size, background: color }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
