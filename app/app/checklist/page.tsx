"use client";

import { useAppState } from "@/components/app-state";

export default function ChecklistPage() {
  const { state } = useAppState();
  const grouped = state.skills.reduce<Record<string, typeof state.skills>>((accumulator, skill) => {
    const list = accumulator[skill.category] ?? [];
    accumulator[skill.category] = [...list, skill];
    return accumulator;
  }, {});

  return (
    <div className="stack-lg">
      <section className="panel">
        <div className="panel-head">
          <h1>{state.profile.stateCode} skill checklist</h1>
          <p className="subtle-text">Every skill starts unattempted and evolves as sessions are logged.</p>
        </div>
      </section>

      {Object.entries(grouped).map(([category, skills]) => (
        <section key={category} className="panel">
          <div className="panel-head">
            <h2>{category}</h2>
            <span className="subtle-text">{skills?.length ?? 0} skills</span>
          </div>
          <div className="checklist-grid">
            {skills?.map((skill) => {
              const progress = state.progress.find((entry) => entry.skillId === skill.id)!;

              return (
                <article key={skill.id} className="checklist-card">
                  <div className="checklist-header">
                    <strong>{skill.label}</strong>
                    <span className={`status-chip ${progress.status}`}>{progress.status.replace("_", " ")}</span>
                  </div>
                  <p>{skill.description}</p>
                  <div className="meta-row">
                    <span>{progress.attemptsCount} attempts</span>
                    <span>{progress.averageRating || "-"} avg rating</span>
                  </div>
                  <div className="meta-row">
                    <span>Last practiced: {progress.lastPracticedAt ?? "Not yet"}</span>
                    <span>{progress.confidenceScore}% confidence</span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
