"use client";

import Link from "next/link";
import { useAppState } from "@/components/app-state";

function getSkillLabel(skillId: string, labels: Record<string, string>) {
  return labels[skillId] ?? skillId;
}

export function DashboardView() {
  const { state, readiness } = useAppState();
  const labels = Object.fromEntries(state.skills.map((skill) => [skill.id, skill.label]));

  return (
    <div className="stack-lg">
      <section className="hero-card">
        <div>
          <span className="eyebrow">Practice smarter, not just longer</span>
          <h1>{state.profile.name}'s driving readiness plan</h1>
          <p className="hero-copy">
            RoadReady turns each logged drive into targeted next steps, route suggestions, and coaching insights for
            the next practice session.
          </p>
        </div>
        <div className="hero-score">
          <span>Readiness</span>
          <strong>{readiness.readinessScore}%</strong>
          <p>{readiness.totalHours} hours logged</p>
        </div>
      </section>

      <section className="metric-grid">
        <article className="metric-card accent-amber">
          <span>Focus Next</span>
          <strong>{readiness.topRecommendations[0]?.label ?? "Log a session"}</strong>
          <p>{readiness.topRecommendations[0]?.reasons.join(" • ")}</p>
        </article>
        <article className="metric-card accent-green">
          <span>Coach Tip</span>
          <strong>Adaptive guidance</strong>
          <p>{state.coachTip}</p>
        </article>
        <article className="metric-card accent-blue">
          <span>Overdue Skills</span>
          <strong>{readiness.overdueSkills.length}</strong>
          <p>Skills that have not been practiced in the last 10 days.</p>
        </article>
      </section>

      <section className="two-column-grid">
        <article className="panel">
          <div className="panel-head">
            <h2>Category coverage</h2>
            <span className="subtle-text">attempted + confident skills</span>
          </div>
          <div className="coverage-list">
            {readiness.coverage.map((entry) => (
              <div key={entry.category} className="coverage-row">
                <div>
                  <strong>{entry.category}</strong>
                  <p>
                    Attempted {entry.attemptedPercent}% • Confident {entry.confidentPercent}%
                  </p>
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
            <h2>Top 3 priorities</h2>
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
            <h2>Recent sessions</h2>
            <Link href="/app/sessions" className="inline-link">
              Log another
            </Link>
          </div>
          <div className="timeline-list">
            {state.sessions.slice(0, 4).map((session) => (
              <div key={session.id} className="timeline-item">
                <strong>{session.areaDriven}</strong>
                <p>
                  {session.date} • {session.durationMinutes} min • {session.trafficLevel} traffic
                </p>
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
            <h2>Notifications</h2>
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
