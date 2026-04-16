"use client";

import { useState } from "react";
import { useAppState } from "@/components/app-state";
import { PageIntro } from "@/components/shell/page-intro";

type FilterStatus = "all" | "confident" | "needs_work" | "not_attempted";

function StatusIcon({ status }: { status: string }) {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: `status-icon ${
      status === "confident"
        ? "icon-confident"
        : status === "needs_work"
          ? "icon-needs-work"
          : "icon-not-attempted"
    }`
  };

  if (status === "confident") {
    return (
      <svg {...props}>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    );
  }

  if (status === "needs_work") {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    );
  }

  return (
    <svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function getConfidenceFillClass(confidenceScore: number, status: string) {
  if (status === "confident") return "fill-green";
  if (status === "needs_work") return "fill-amber";
  return "fill-blue";
}

export default function ChecklistPage() {
  const { state } = useAppState();
  const [filter, setFilter] = useState<FilterStatus>("all");

  const allProgress = state.skills.map((skill) => ({
    skill,
    progress: state.progress.find((entry) => entry.skillId === skill.id)!
  }));

  const statusCounts = {
    all: allProgress.length,
    confident: allProgress.filter((item) => item.progress.status === "confident").length,
    needs_work: allProgress.filter((item) => item.progress.status === "needs_work").length,
    not_attempted: allProgress.filter((item) => item.progress.status === "not_attempted").length
  };

  const filteredProgress =
    filter === "all" ? allProgress : allProgress.filter((item) => item.progress.status === filter);

  const grouped = filteredProgress.reduce<Record<string, typeof filteredProgress>>((accumulator, item) => {
    const list = accumulator[item.skill.category] ?? [];
    accumulator[item.skill.category] = [...list, item];
    return accumulator;
  }, {});

  const filters: { key: FilterStatus; label: string }[] = [
    { key: "all", label: "All" },
    { key: "confident", label: "Confident" },
    { key: "needs_work", label: "Needs Work" },
    { key: "not_attempted", label: "Not Attempted" }
  ];

  return (
    <div className="stack-lg">
      <PageIntro
        eyebrow={`${state.profile.stateCode} checklist`}
        title="Skill confidence at a glance"
        description="Scan what feels solid, what is getting rusty, and what has not been attempted yet so every drive closes a real gap."
        stats={[
          {
            label: "Confident",
            value: String(statusCounts.confident),
            detail: "Skills that can be repeated under harder conditions",
            tone: "green"
          },
          {
            label: "Needs work",
            value: String(statusCounts.needs_work),
            detail: "Best candidates for focused practice this week",
            tone: "amber"
          },
          {
            label: "Not attempted",
            value: String(statusCounts.not_attempted),
            detail: "Untouched skills still waiting for first reps",
            tone: "blue"
          }
        ]}
      />

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Filter by confidence</h2>
            <p className="subtle-text">Every skill starts unattempted and evolves as sessions are logged.</p>
          </div>
        </div>

        <div className="filter-tabs">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              className={filter === f.key ? "filter-tab active" : "filter-tab"}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className="filter-tab-count">{statusCounts[f.key]}</span>
            </button>
          ))}
        </div>
      </section>

      {Object.entries(grouped).map(([category, items]) => (
        <section key={category} className="panel">
          <div className="panel-head">
            <h2>{category}</h2>
            <span className="subtle-text">{items?.length ?? 0} skills</span>
          </div>
          <div className="checklist-grid">
            {items?.map(({ skill, progress }) => (
              <article key={skill.id} className="checklist-card">
                <div className="checklist-header">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <StatusIcon status={progress.status} />
                    <strong>{skill.label}</strong>
                  </div>
                  <span className={`status-chip ${progress.status}`}>{progress.status.replace("_", " ")}</span>
                </div>
                <p>{skill.description}</p>
                <div className="checklist-confidence">
                  <div
                    className={`checklist-confidence-fill ${getConfidenceFillClass(progress.confidenceScore, progress.status)}`}
                    style={{ width: `${progress.confidenceScore}%` }}
                  />
                </div>
                <div className="meta-row">
                  <span>{progress.attemptsCount} attempts</span>
                  <span>{progress.averageRating || "-"} avg rating</span>
                </div>
                <div className="meta-row">
                  <span>Last practiced: {progress.lastPracticedAt ?? "Not yet"}</span>
                  <span>{progress.confidenceScore}% confidence</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      {Object.keys(grouped).length === 0 && (
        <section className="panel">
          <p className="subtle-text" style={{ textAlign: "center", padding: 24 }}>
            No skills match the selected filter.
          </p>
        </section>
      )}
    </div>
  );
}
