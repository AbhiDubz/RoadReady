"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { PropsWithChildren, useState } from "react";
import { useAppState } from "@/components/app-state";
import { getViewerRoleLabel } from "@/lib/household";

const navItems: { href: Route; label: string; icon: string }[] = [
  { href: "/app", label: "Dashboard", icon: "grid" },
  { href: "/app/setup", label: "Setup", icon: "user" },
  { href: "/app/checklist", label: "Checklist", icon: "check-square" },
  { href: "/app/sessions", label: "Sessions", icon: "edit" },
  { href: "/app/routes", label: "Routes", icon: "map" },
  { href: "/app/parent", label: "Parent View", icon: "users" },
  { href: "/app/settings", label: "Settings", icon: "settings" }
];

const navDescriptions: Record<string, string> = {
  "/app": "See readiness, focus areas, and the next best practice move.",
  "/app/setup": "Shape the learner profile, household details, and test target.",
  "/app/checklist": "Track confident, rusty, and untouched checklist skills.",
  "/app/sessions": "Capture each practice drive while it is still fresh.",
  "/app/routes": "Generate targeted driving loops around the skills that need reps.",
  "/app/parent": "Share coaching context, comments, and readiness with the household.",
  "/app/settings": "Review account details, reminders, and checklist defaults."
};

function isActivePath(pathname: string, href: Route) {
  if (href === "/app") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavIcon({ type }: { type: string }) {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "nav-icon"
  };

  switch (type) {
    case "grid":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case "user":
      return (
        <svg {...props}>
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case "check-square":
      return (
        <svg {...props}>
          <path d="m9 11 3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
    case "edit":
      return (
        <svg {...props}>
          <path d="M12 20h9" />
          <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
        </svg>
      );
    case "map":
      return (
        <svg {...props}>
          <path d="m3 7 6-3 6 3 6-3v13l-6 3-6-3-6 3Z" />
          <path d="M9 4v13" />
          <path d="M15 7v13" />
        </svg>
      );
    case "users":
      return (
        <svg {...props}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "settings":
      return (
        <svg {...props}>
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    default:
      return null;
  }
}

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const { account, state, readiness, resetDemo } = useAppState();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const visibleNavItems = navItems.filter((item) => account.role === "parent" || item.href !== "/app/parent");
  const activeNavItem = visibleNavItems.find((item) => isActivePath(pathname, item.href)) ?? visibleNavItems[0];

  const initials = account.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const totalSessions = state.sessions.length;
  const topFocus = readiness.topRecommendations[0]?.label ?? "Log a session";
  const activeDescription = navDescriptions[activeNavItem.href] ?? navDescriptions["/app"];
  const viewerRoleLabel = getViewerRoleLabel(account.role);
  const learnerPlanLabel =
    account.role === "parent"
      ? `Viewing ${state.profile.name}'s ${state.profile.stateCode} checklist | ${readiness.readinessScore}% ready`
      : `${state.profile.stateCode} checklist | ${readiness.readinessScore}% ready`;

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login" as Route);
      router.refresh();
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-panel">
          <Link href="/" className="brand-link">
            <span className="brand-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="m16 10-4 4-4-4" />
              </svg>
            </span>
            RoadReady
          </Link>
          <p className="eyebrow brand-caption">Adaptive driving practice planner</p>
        </div>

        <div className="profile-card">
          <div className="profile-avatar">{initials}</div>
          <div className="profile-info">
            <span className="status-pill">{viewerRoleLabel}</span>
            <h2>{account.name}</h2>
            <p>{learnerPlanLabel}</p>
            <span className="profile-account-email">{account.email}</span>
          </div>
        </div>

        <div className="sidebar-readiness">
          <div className="sidebar-readiness-track">
            <div className="sidebar-readiness-fill" style={{ width: `${readiness.readinessScore}%` }} />
          </div>
          <span className="sidebar-readiness-label">{readiness.readinessScore}%</span>
        </div>

        <div className="sidebar-stats">
          <div className="sidebar-stat">
            <span className="sidebar-stat-value">{totalSessions}</span>
            <span className="sidebar-stat-label">Sessions</span>
          </div>
          <div className="sidebar-stat">
            <span className="sidebar-stat-value">{readiness.totalHours}</span>
            <span className="sidebar-stat-label">Hours</span>
          </div>
          <div className="sidebar-stat">
            <span className="sidebar-stat-value">{readiness.overdueSkills.length}</span>
            <span className="sidebar-stat-label">Overdue</span>
          </div>
        </div>

        <nav className="nav-list">
          {visibleNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={isActivePath(pathname, item.href) ? "nav-item active" : "nav-item"}
            >
              <NavIcon type={item.icon} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-callout">
            <span className="sidebar-callout-label">Current focus</span>
            <strong>{topFocus}</strong>
            <p>Use the route builder to turn this into a focused practice loop.</p>
            <Link href="/app/routes" className="inline-link">
              Open route planner
            </Link>
          </div>
          <button type="button" className="ghost-button" onClick={resetDemo}>
            Reset seeded demo
          </button>
          <button type="button" className="ghost-button" onClick={handleSignOut} disabled={isSigningOut}>
            {isSigningOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </aside>

      <main className="page-frame">
        <div className="mobile-shell-header">
          <div className="mobile-shell-topline">
            <div className="mobile-shell-title">
              <span className="eyebrow">RoadReady demo</span>
              <div className="mobile-shell-brand-row">
                <Link href="/" className="brand-link mobile-brand-link">
                  <span className="brand-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="m16 10-4 4-4-4" />
                    </svg>
                  </span>
                  RoadReady
                </Link>
                <span className="status-pill">{activeNavItem.label}</span>
              </div>
            </div>

            <div className="mobile-shell-score">
              <strong>{readiness.readinessScore}%</strong>
              <span>Ready</span>
            </div>
          </div>

          <p className="mobile-shell-copy">
            {activeDescription} Top focus: {topFocus}.
          </p>

          <div className="mobile-shell-overview">
            <article className="mobile-shell-stat">
              <span>Account</span>
              <strong>{account.name}</strong>
              <p>{viewerRoleLabel} | {account.email}</p>
            </article>
            <article className="mobile-shell-stat">
              <span>Learner plan</span>
              <strong>{state.profile.name}</strong>
              <p>{state.profile.stateCode} checklist</p>
            </article>
            <article className="mobile-shell-stat">
              <span>Attention</span>
              <strong>{readiness.overdueSkills.length} overdue</strong>
              <p>Use the planner to turn the next gap into reps.</p>
            </article>
          </div>

          <div className="mobile-shell-actions">
            <button type="button" className="ghost-button" onClick={resetDemo}>
              Reset demo
            </button>
            <button type="button" className="ghost-button" onClick={handleSignOut} disabled={isSigningOut}>
              {isSigningOut ? "Signing out..." : "Sign out"}
            </button>
          </div>

          <nav className="mobile-nav-row">
            {visibleNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={isActivePath(pathname, item.href) ? "mobile-nav-item active" : "mobile-nav-item"}
              >
                <NavIcon type={item.icon} />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>

        {children}
      </main>
    </div>
  );
}
