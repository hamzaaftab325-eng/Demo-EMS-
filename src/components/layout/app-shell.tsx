"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { Menu, Moon } from "lucide-react";
import { NavigationLinks } from "@/components/layout/navigation-links";

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("ems-theme");
    if (saved === "light" || saved === "dark") {
      document.documentElement.dataset.theme = saved;
    }
  }, []);

  function toggleTheme() {
    const current =
      document.documentElement.dataset.theme ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("ems-theme", next);
  }

  return (
    <div className="app">
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
        <NavigationLinks onNavigate={() => setMenuOpen(false)} />
      </aside>

      <div className="main">
        <div className="demo">
          <b>Preview with sample data.</b>
          <span>
            Buttons work here but nothing is saved. Switch &quot;View as&quot; to
            see each access level.
          </span>
        </div>

        <header className="top">
          <button
            className="btn ghost menu"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={18} />
          </button>

          <div className="sp" />

          <label className="mut hide-sm" htmlFor="roleSel" style={{ fontSize: 13 }}>
            View as
          </label>

          <select id="roleSel" aria-label="View as" defaultValue="super">
            <option value="super">Faisal · Super Admin</option>
            <option value="manager">Danish · Manager (Web)</option>
            <option value="employee">Ghulam · Employee</option>
          </select>

          <button
            className="btn ghost"
            aria-label="Toggle dark mode"
            onClick={toggleTheme}
          >
            <Moon size={17} />
          </button>

          <span
            className="av"
            style={{ width: 32, height: 32, background: "#00AFDD" }}
          >
            FA
          </span>
        </header>

        <main className="content">
          <div className="wrap">{children}</div>
        </main>
      </div>
    </div>
  );
}
