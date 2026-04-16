"use client";

import Link from "next/link";
import { useAppState } from "@/components/app-state";

function getSkillLabel(skillId: string, labels: Record<string, string>) {
  return labels[skillId] ?? skillId;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function ReadinessRing({ score, hours }: { score: number; hours: number }) {
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="readiness-ring-wrapper">
      <div className="readiness-ring">
        <svg viewBox="0 0 140 140">
          <defs>
            <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2dd4bf" />
              <stop offset="50%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
          </defs>
          <circle className="ring-track" cx="70" cy="70" r={radius} />
          <circle
            className="ring-fill"
            cx="70"
            cy="70"
            r={radius}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ "--circumference": circumference } as React.CSSProperties}
          />
        </svg>
        <div className="ring-value">
          <span className="ring-percent">{score}%</span>
          <span className="ring-label">Ready</span>
        </div>
      </div>
      <span className="readiness-ring-meta">{hours} hours logged</span>
    </div>
  );
}

function IconTarget() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function IconLightbulb() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6" />
      <path d="M10 22h4" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconBarChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  );
}

function IconFlag() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

export function DashboardView() {
  const { account, state, readiness } = useAppState();
  const labels = Object.fromEntries(state.skills.map((skill) => [skill.id, skill.label]));
  const greeting = getGreeting();
  const displayName = account.role === "teen" ? account.name : state.profile.name;
  const firstName = displayName.split(" ")[0];
  const nextRecommendation = readiness.topRecommendations[0];

  return (
    <div className="stack-lg">
      <section className="hero-card">
        <div>
          <span className="eyebrow">{greeting}, {firstName}</span>
          <h1>{displayName}&apos;s driving readiness plan</h1>
          <p className="hero-copy">
            RoadReady turns each logged drive into targeted next steps, route suggestions, and coaching insights for
            the next practice session.
          </p>
          <div className="hero-action-row">
            <Link href="/app/sessions" className="primary-button">
              Log today&apos;s drive
            </Link>
            <Link href="/app/routes" className="secondary-button">
              Build targeted route
            </Link>
          </div>
          <div className="dashboard-highlight-strip">
            <div className="dashboard-highlight-card">
              <span>Next focus</span>
              <strong>{nextRecommendation?.label ?? "Log a session"}</strong>
              <p>{nextRecommendation?.reasons[0] ?? "Capture a drive to unlock personalized guidance."}</p>
            </div>
            <div className="dashboard-highlight-card">
              <span>Practice streak</span>
              <strong>{Math.min(state.sessions.length, 4)} sessions</strong>
              <p>Recent repetition is building confidence and making route suggestions more precise.</p>
            </div>
          </div>
        </div>
        <ReadinessRing score={readiness.readinessScore} hours={readiness.totalHours} />
      </section>

      <section className="metric-grid">
        <article className="metric-card accent-amber">
          <div className="metric-icon"><IconTarget /></div>
          <span>Focus Next</span>
          <strong>{nextRecommendation?.label ?? "Log a session"}</strong>
          <p>{nextRecommendation?.reasons.join(" • ") ?? "New recommendations appear after each logged drive."}</p>
        </article>
        <article className="metric-card accent-green">
          <div className="metric-icon"><IconLightbulb /></div>
          <span>Coach Tip</span>
          <strong>Adaptive guidance</strong>
          <p>{state.coachTip}</p>
        </article>
        <article className="metric-card accent-blue">
          <div className="metric-icon"><IconClock /></div>
          <span>Overdue Skills</span>
          <strong>{readiness.overdueSkills.length}</strong>
          <p>Skills that have not been practiced in the last 10 days.</p>
        </article>
      </section>

      <section className="two-column-grid">
        <article className="panel">
          <div className="panel-head">
            <div className="section-header-icon">
              <IconBarChart />
              <h2>Category coverage</h2>
            </div>
            <span className="subtle-text">attempted + confident skills</span>
          </div>
          <div className="coverage-list">
            {readiness.coverage.map((entry) => (
              <div key={entry.category} className="coverage-row">
                <div>
                  <strong>{entry.category}</strong>
                  <p>Attempted {entry.attemptedPercent}% • Confident {entry.confidentPercent}%</p>
                </div>
                <div className="progress-track">
                  <span style={{ width: `${entry.coverageScore}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-head">
            <div className="section-header-icon">
              <IconFlag />
              <h2>Top 3 priorities</h2>
            </div>
            <Link href="/app/routes" className="inline-link">
              Build practice route
            </Link>
          </div>
          <div className="priority-list">
            {readiness.topRecommendations.map((recommendation, index) => (
              <div key={recommendation.skillId} className="priority-item">
                <span className="priority-rank">0{index + 1}</span>
                <div>
                  <strong>{recommendation.label}</strong>
                  <p>{recommendation.reasons.join(" • ")}</p>
                </div>
                <span className="score-chip">{recommendation.priorityScore}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="two-column-grid">
        <article className="panel">
          <div className="panel-head">
            <div className="section-header-icon">
              <IconCalendar />
              <h2>Recent sessions</h2>
            </div>
            <Link href="/app/sessions" className="inline-link">
              Log another
            </Link>
          </div>
          <div className="timeline-list">
            {state.sessions.slice(0, 4).map((session) => (
              <div key={session.id} className="timeline-item">
                <strong>{session.areaDriven}</strong>
                <p>{session.date} • {session.durationMinutes} min • {session.trafficLevel} traffic</p>
                <span className="subtle-text">
                  Practiced{" "}
                  {session.practicedSkills
                    .map((entry) => getSkillLabel(entry.skillId, labels))
                    .join(", ")}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-head">
            <div className="section-header-icon">
              <IconBell />
              <h2>Notifications</h2>
            </div>
            <span className="subtle-text">in-app reminders</span>
          </div>
          <div className="notification-list">
            {state.notifications.map((note, index) => (
              <div key={`${index}-${note}`} className="notification-item">
                {note}
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
