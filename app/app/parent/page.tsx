"use client";

import { useAppState } from "@/components/app-state";

export default function ParentPage() {
  const { state, readiness } = useAppState();

  return (
    <div className="stack-lg">
      <section className="panel">
        <div className="panel-head">
          <h1>Parent / instructor view</h1>
          <span className="subtle-text">Shared household visibility for coaching and sign-off</span>
        </div>
        <div className="metric-grid">
          <article className="metric-card accent-blue">
            <span>Linked household</span>
            <strong>{state.profile.householdName ?? "Not set"}</strong>
            <p>Invite code: {state.profile.householdInviteCode ?? "READY-247"}</p>
          </article>
          <article className="metric-card accent-amber">
            <span>Current top gap</span>
            <strong>{readiness.topRecommendations[0]?.label ?? "No sessions yet"}</strong>
            <p>{readiness.topRecommendations[0]?.reasons.join(" • ")}</p>
          </article>
          <article className="metric-card accent-green">
            <span>Readiness trend</span>
            <strong>{readiness.readinessScore}%</strong>
            <p>Use this as a coaching aid, not a replacement for supervised judgment.</p>
          </article>
        </div>
      </section>

      <section className="two-column-grid">
        <article className="panel">
          <div className="panel-head">
            <h2>Recent instructor comments</h2>
            <span className="subtle-text">Pulled from session logs</span>
          </div>
          <div className="timeline-list">
            {state.sessions.map((session) => (
              <div key={session.id} className="timeline-item">
                <strong>{session.date}</strong>
                <p>{session.parentComment || "No comment added for this session."}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-head">
            <h2>Recommended coaching prompts</h2>
            <span className="subtle-text">Use before the next drive</span>
          </div>
          <div className="notification-list">
            <div className="notification-item">Ask the teen to narrate gap choices before unprotected left turns.</div>
            <div className="notification-item">Keep the next highway merge session short and repeatable rather than long.</div>
            <div className="notification-item">Confirm whether stress comes from traffic speed, lane choice, or late mirror checks.</div>
          </div>
        </article>
      </section>
    </div>
  );
}

