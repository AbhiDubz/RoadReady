"use client";

import { SessionLogger } from "@/components/forms/session-logger";
import { useAppState } from "@/components/app-state";

export default function SessionsPage() {
  const { state } = useAppState();
  const skillLabels = Object.fromEntries(state.skills.map((skill) => [skill.id, skill.label]));

  return (
    <div className="stack-lg">
      <SessionLogger />

      <section className="panel">
        <div className="panel-head">
          <h2>Session history</h2>
          <span className="subtle-text">Recent drives, notes, and AI summaries</span>
        </div>

        <div className="history-list">
          {state.sessions.map((session) => (
            <article key={session.id} className="history-card">
              <div className="history-card-head">
                <div>
                  <strong>{session.areaDriven}</strong>
                  <p>
                    {session.date} • {session.durationMinutes} min • {session.weather}
                  </p>
                </div>
                <span className="status-pill">{session.trafficLevel} traffic</span>
              </div>

              <p className="subtle-text">
                Skills: {session.practicedSkills.map((entry) => skillLabels[entry.skillId]).join(", ")}
              </p>
              <p>{session.notes}</p>
              <p className="comment-block">Parent note: {session.parentComment || "No parent comment yet."}</p>
              <p className="insight-block">{session.aiSummary ?? "AI summary will appear after the next logged session."}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

