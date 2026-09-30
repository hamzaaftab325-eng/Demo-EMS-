"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { LogOut, Menu, Moon } from "lucide-react";
import { logout } from "@/app/auth/actions";
import { NavigationLinks } from "@/components/layout/navigation-links";
import { PresenceHeartbeat } from "@/components/presence/presence-heartbeat";
import { roleLabel } from "@/lib/navigation";
import type { CurrentProfile } from "@/lib/auth/current-profile";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AppShell({
  profile,
  children,
}: {
  profile: CurrentProfile;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const avatar = useMemo(() => initials(profile.full_name) || "EMS", [profile.full_name]);

  useEffect(() => {
    const saved = window.localStorage.getItem("ems-theme");

    if (saved === "light" || saved === "dark") {
      document.documentElement.dataset.theme = saved;
    }
  }, []);

  function toggleTheme() {
    const current =
      document.documentElement.dataset.theme ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light");
    const next = current === "dark" ? "light" : "dark";

    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("ems-theme", next);
  }

  return (
    <div className="app">
      <PresenceHeartbeat />
      {menuOpen ? (
        <button
          className="mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <aside className={`side ${menuOpen ? "open" : ""}`}>
        <div className="logo">
          <Image
            src="/emarketselect-logo.png"
            alt="eMarketSelect"
            width={330}
            height={52}
            priority
          />
        </div>

        <NavigationLinks
          role={profile.role}
          onNavigate={() => setMenuOpen(false)}
        />
      </aside>

      <div className="main">
        {profile.is_test_account ? (
          <div className="demo">
            <b>Development account.</b>
            <span>
              Phases 1–5 are live on Supabase. Later modules remain clearly staged.
            </span>
          </div>
        ) : null}

        <header className="top">
          <button
            className="btn ghost menu"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={18} />
          </button>

          <div className="sp" />

          <div className="account-copy hide-sm">
            <strong>{profile.full_name}</strong>
            <span>{roleLabel(profile.role)}</span>
          </div>

          <button
            className="btn ghost"
            aria-label="Toggle dark mode"
            onClick={toggleTheme}
          >
            <Moon size={17} />
          </button>

          <span
            className="av"
            title={profile.full_name}
            style={{ width: 32, height: 32, background: "#00AFDD" }}
          >
            {avatar}
          </span>

          <form action={logout}>
            <button className="btn ghost" type="submit" aria-label="Sign out">
              <LogOut size={17} />
              <span className="hide-sm">Sign out</span>
            </button>
          </form>
        </header>

        <main className="content">
          <div className="wrap">{children}</div>
        </main>
      </div>
    </div>
  );
}
