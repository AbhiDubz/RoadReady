"use client";

import { SessionLogger } from "@/components/forms/session-logger";
import { useAppState } from "@/components/app-state";
import { PageIntro } from "@/components/shell/page-intro";

export default function SessionsPage() {
  const { state } = useAppState();
  const skillLabels = Object.fromEntries(state.skills.map((skill) => [skill.id, skill.label]));
  const totalMinutes = state.sessions.reduce((sum, session) => sum + session.durationMinutes, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);
  const latestSession = state.sessions[0];

  return (
    <div className="stack-lg">
      <PageIntro
        eyebrow="Practice journal"
        title="Turn every drive into better next steps"
        description="Capture the route, conditions, and confidence ratings right after practice so RoadReady can sharpen the next recommendation."
        stats={[
          {
            label: "Drives logged",
            value: String(state.sessions.length),
            detail: "A stronger history makes coaching smarter",
            tone: "teal"
          },
          {
            label: "Hours tracked",
            value: totalHours,
            detail: "Seat time already captured in the demo",
            tone: "blue"
          },
          {
            label: "Latest drive",
            value: latestSession?.date ?? "None yet",
            detail: latestSession?.areaDriven ?? "Log a session to seed the timeline",
            tone: "amber"
          }
        ]}
      />

      <SessionLogger />

      <section className="panel">
        <div className="panel-head">
          <div className="section-header-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <h2>Session history</h2>
          </div>
          <span className="subtle-text">{state.sessions.length} drives logged</span>
        </div>

        <div className="timeline-list">
          {state.sessions.map((session) => (
            <article key={session.id} className="timeline-item">
              <div className="history-card-head">
                <div>
                  <strong>{session.areaDriven}</strong>
                  <p>
                    {session.date} • {session.durationMinutes} min • {session.weather}
                  </p>
                </div>
                <span className="status-pill">{(session.reviewStatus ?? "pending").replace("_", " ")}</span>
              </div>

              <p className="subtle-text" style={{ marginTop: 8 }}>
                Skills: {session.practicedSkills.map((entry) => skillLabels[entry.skillId]).join(", ")}
              </p>
              <p className="subtle-text" style={{ marginTop: 4 }}>
                Ratings:{" "}
                {session.practicedSkills
                  .map((entry) => {
                    const teenRating = entry.teenRating ?? entry.rating;
                    const parentOverride = entry.parentOverrideRating ? `, parent ${entry.parentOverrideRating}/3` : "";
                    return `${skillLabels[entry.skillId]} teen ${teenRating}/3${parentOverride}`;
                  })
                  .join(" | ")}
              </p>
              {session.notes ? <p style={{ marginTop: 4 }}>{session.notes}</p> : null}
              <p className="comment-block" style={{ marginTop: 6 }}>
                Parent note: {session.parentComment || "No parent comment yet."}
              </p>
              {session.aiSummary ? (
                <div className="history-card-head" style={{ marginTop: 6 }}>
                  <p className="subtle-text">
                    Summary source: {session.summarySource === "ai" ? "AI-generated" : "Rules-based fallback"}
                  </p>
                  {session.summarySource === "ai" ? <span className="status-pill">AI-powered</span> : null}
                </div>
              ) : null}
              <p className="insight-block" style={{ marginTop: 6 }}>
                {session.aiSummary ?? "AI summary will appear after the next logged session."}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
