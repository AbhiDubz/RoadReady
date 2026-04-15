"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { PropsWithChildren } from "react";
import { useAppState } from "@/components/app-state";

const navItems: { href: Route; label: string }[] = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/setup", label: "Setup" },
  { href: "/app/checklist", label: "Checklist" },
  { href: "/app/sessions", label: "Sessions" },
  { href: "/app/routes", label: "Routes" },
  { href: "/app/parent", label: "Parent View" },
  { href: "/app/settings", label: "Settings" }
];

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { state, readiness, resetDemo } = useAppState();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-panel">
          <Link href="/" className="brand-link">
            RoadReady
          </Link>
          <p className="eyebrow">Adaptive driving practice planner</p>
        </div>

        <div className="profile-card">
          <span className="status-pill">{state.profile.role === "teen" ? "Teen learner" : "Parent view"}</span>
          <h2>{state.profile.name}</h2>
          <p>
            {state.profile.stateCode} checklist • {readiness.readinessScore}% readiness
          </p>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname === item.href ? "nav-item active" : "nav-item"}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <button type="button" className="ghost-button" onClick={resetDemo}>
          Reset seeded demo
        </button>
      </aside>

      <main className="page-frame">{children}</main>
    </div>
  );
}
