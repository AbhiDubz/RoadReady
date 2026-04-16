"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAppState } from "@/components/app-state";
import { getSkillInsights } from "@/lib/logic";

function formatDate(value?: string) {
  if (!value) {
    return "Not set";
  }

  return new Date(value).toLocaleDateString();
}

function trendLabel(value: string) {
  return value.replace(/_/g, " ");
}

export default function ParentPage() {
  const router = useRouter();
  const { account, state, readiness, reviewSession, reviewRoute, updatePlanning } = useAppState();
  const [selectedSessionId, setSelectedSessionId] = useState(state.sessions[0]?.id ?? "");
  const [routeNote, setRouteNote] = useState(state.latestRoute?.approvalNote ?? "");
  const skillLabels = Object.fromEntries(state.skills.map((skill) => [skill.id, skill.label]));
  const selectedSession = state.sessions.find((session) => session.id === selectedSessionId) ?? state.sessions[0];
  const [sessionComment, setSessionComment] = useState(selectedSession?.parentComment ?? "");
  const [overrideRatings, setOverrideRatings] = useState<Record<string, number | undefined>>({});
  const [skillComments, setSkillComments] = useState<Record<string, string | undefined>>({});
  const skillInsights = useMemo(() => getSkillInsights(state), [state]);
  const topInsights = skillInsights
    .sort((a, b) => a.averageRating - b.averageRating || a.attemptsCount - b.attemptsCount)
    .slice(0, 5);
  const countdownLabel =
    readiness.targetTestCountdownDays === undefined
      ? "No target date"
      : readiness.targetTestCountdownDays >= 0
        ? `${readiness.targetTestCountdownDays} days left`
        : `${Math.abs(readiness.targetTestCountdownDays)} days past target`;

  useEffect(() => {
    if (account.role !== "parent") {
      router.replace("/app");
    }
  }, [account.role, router]);

  if (account.role !== "parent") {
    return null;
  }

  function syncSessionEditor(sessionId: string) {
    const session = state.sessions.find((entry) => entry.id === sessionId);
    setSelectedSessionId(sessionId);
    setSessionComment(session?.parentComment ?? "");
    setOverrideRatings({});
    setSkillComments({});
  }

  function saveSessionReview(status: "reviewed" | "verified") {
    if (!selectedSession) {
      return;
    }

    reviewSession({
      sessionId: selectedSession.id,
      parentComment: sessionComment,
      skillOverrides: overrideRatings,
      skillComments,
      reviewStatus: status
    });
  }

  return (
    <div className="stack-lg">
      <section className="hero-card">
        <div>
          <span className="eyebrow">Parent / instructor view</span>
          <h1>Coach {state.profile.name} with shared context</h1>
          <p className="hero-copy">
            This view stays linked through the teen-owned invite code and focuses on actionable coaching, session review,
            and route approval instead of micromanagement.
          </p>
          <div className="hero-action-row">
            <Link href="/app/routes" className="primary-button">
              Open route planner
            </Link>
            <Link href="/app/setup" className="secondary-button">
              Manage household link
            </Link>
          </div>
        </div>
      </section>

      <section className="metric-grid">
        <article className="metric-card accent-green">
          <span>Readiness score</span>
          <strong>{readiness.readinessScore}%</strong>
          <p>Based on skill coverage, recent ratings, and consistency.</p>
        </article>
        <article className="metric-card accent-blue">
          <span>Target test date</span>
          <strong>{formatDate(state.profile.targetTestDate)}</strong>
          <p>{countdownLabel}</p>
        </article>
        <article className="metric-card accent-amber">
          <span>Total driving hours</span>
          <strong>{readiness.totalHours}</strong>
          <p>Most recent session: {readiness.lastSessionDate ?? "No sessions yet"}</p>
        </article>
        <article className="metric-card accent-blue">
          <span>Household link</span>
          <strong>{state.profile.householdInviteCode ?? "Not linked"}</strong>
          <p>
            {account.role === "parent"
              ? "This parent account opens the teen plan through that invite code."
              : "Share this invite code with a parent or instructor account."}
          </p>
        </article>
      </section>

      <section className="two-column-grid">
        <article className="panel">
          <div className="panel-head">
            <h2>Category status</h2>
            <span className="subtle-text">Coverage and weak-skill counts</span>
          </div>
          <div className="timeline-list">
            {readiness.categorySummaries.map((summary) => (
              <div key={summary.category} className="timeline-item">
                <div className="history-card-head">
                  <strong>{summary.category}</strong>
                  <span className="status-pill">{summary.status.replace("_", " ")}</span>
                </div>
                <p>{summary.coveragePercent}% coverage</p>
                <p className="subtle-text">{summary.weakSkillsCount} weak or overdue skills still need attention.</p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-head">
            <h2>Priority skills</h2>
            <span className="subtle-text">Top 3 next-session recommendations</span>
          </div>
          <div className="priority-list">
            {readiness.topRecommendations.map((recommendation, index) => (
              <div key={recommendation.skillId} className="priority-item">
                <span className="priority-rank">0{index + 1}</span>
                <div>
                  <strong>{recommendation.label}</strong>
                  <p>{recommendation.reasons.join(" • ")}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="two-column-grid">
        <article className="panel">
          <div className="panel-head">
            <h2>Practice planning</h2>
            <span className="subtle-text">Guide the next drive without taking over</span>
          </div>
          <div className="form-grid">
            <label className="full-width">
              <span>Target skills</span>
              <div className="chip-wrap" style={{ marginTop: 10 }}>
                {state.skills.map((skill) => {
                  const active = state.planning.selectedSkillIds.includes(skill.id);
                  return (
                    <button
                      key={skill.id}
                      type="button"
                      className={active ? "chip active" : "chip"}
                      onClick={() => {
                        const nextIds = active
                          ? state.planning.selectedSkillIds.filter((id) => id !== skill.id)
                          : [...state.planning.selectedSkillIds, skill.id].slice(0, 3);
                        updatePlanning({ selectedSkillIds: nextIds });
                      }}
                    >
                      {skill.label}
                    </button>
                  );
                })}
              </div>
            </label>

            <label>
              <span>Difficulty</span>
              <select
                value={state.planning.preferredDifficulty}
                onChange={(event) => updatePlanning({ preferredDifficulty: event.target.value as "gentle" | "balanced" | "stretch" })}
              >
                <option value="gentle">Gentle</option>
                <option value="balanced">Balanced</option>
                <option value="stretch">Stretch</option>
              </select>
            </label>

            <label>
              <span>Session length</span>
              <input
                type="number"
                min="15"
                max="120"
                value={state.planning.preferredSessionDurationMinutes}
                onChange={(event) =>
                  updatePlanning({ preferredSessionDurationMinutes: Number(event.target.value) || 45 })
                }
              />
            </label>
          </div>
          <div className="notification-list" style={{ marginTop: 16 }}>
            <div className="notification-item">
              Route approval: {state.planning.requireRouteApproval ? "required before use" : "optional"}
            </div>
            <div className="notification-item">
              Confident-skill approval: {state.planning.requireParentApprovalForConfident ? "required" : "optional"}
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-head">
            <h2>Route review</h2>
            <span className="subtle-text">Approve, reject, or ask for a safer revision</span>
          </div>
          {state.latestRoute ? (
            <div className="timeline-list">
              <div className="timeline-item">
                <strong>{state.latestRoute.startLocation}</strong>
                <p>
                  {state.latestRoute.estimatedMinutes} min • {state.latestRoute.difficulty} •{" "}
                  {state.latestRoute.approvalStatus.replace("_", " ")}
                </p>
                <p className="subtle-text">
                  Targets: {state.latestRoute.prioritySkillIds.map((skillId) => skillLabels[skillId]).join(", ")}
                </p>
                <p>{state.latestRoute.explanation}</p>
              </div>

              <label className="full-width">
                <span>Approval note</span>
                <textarea rows={3} value={routeNote} onChange={(event) => setRouteNote(event.target.value)} />
              </label>

              <div className="hero-action-row">
                <button type="button" className="primary-button" onClick={() => reviewRoute("approved", routeNote)}>
                  Approve route
                </button>
                <button type="button" className="secondary-button" onClick={() => reviewRoute("needs_changes", routeNote)}>
                  Request changes
                </button>
                <button type="button" className="secondary-button" onClick={() => reviewRoute("rejected", routeNote)}>
                  Reject route
                </button>
              </div>
            </div>
          ) : (
            <p className="subtle-text">No route has been generated yet. Save planning targets here, then open the route planner.</p>
          )}
        </article>
      </section>

      <section className="two-column-grid">
        <article className="panel">
          <div className="panel-head">
            <h2>Session review and verification</h2>
            <span className="subtle-text">Comments and rating overrides feed the progress model</span>
          </div>
          <div className="chip-wrap" style={{ marginBottom: 16 }}>
            {state.sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                className={selectedSession?.id === session.id ? "chip active" : "chip"}
                onClick={() => syncSessionEditor(session.id)}
              >
                {session.date}
              </button>
            ))}
          </div>
          {selectedSession ? (
            <div className="timeline-list">
              <div className="timeline-item">
                <strong>{selectedSession.areaDriven}</strong>
                <p>
                  {selectedSession.date} • {selectedSession.durationMinutes} min • {selectedSession.trafficLevel} traffic
                </p>
                <p className="subtle-text">{selectedSession.notes || "No teen notes added."}</p>
              </div>

              {selectedSession.practicedSkills.map((entry) => (
                <div key={entry.skillId} className="timeline-item">
                  <div className="history-card-head">
                    <strong>{skillLabels[entry.skillId]}</strong>
                    <span className="status-pill">teen {entry.teenRating}/3</span>
                  </div>
                  <div className="form-grid" style={{ marginTop: 10 }}>
                    <label>
                      <span>Parent override</span>
                      <select
                        value={overrideRatings[entry.skillId] ?? entry.parentOverrideRating ?? entry.rating}
                        onChange={(event) =>
                          setOverrideRatings((current) => ({
                            ...current,
                            [entry.skillId]: Number(event.target.value)
                          }))
                        }
                      >
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                      </select>
                    </label>
                    <label className="full-width">
                      <span>Skill comment</span>
                      <input
                        value={skillComments[entry.skillId] ?? entry.parentComment ?? ""}
                        onChange={(event) =>
                          setSkillComments((current) => ({
                            ...current,
                            [entry.skillId]: event.target.value
                          }))
                        }
                      />
                    </label>
                  </div>
                </div>
              ))}

              <label className="full-width">
                <span>Session comment</span>
                <textarea rows={4} value={sessionComment} onChange={(event) => setSessionComment(event.target.value)} />
              </label>

              <div className="hero-action-row">
                <button type="button" className="secondary-button" onClick={() => saveSessionReview("reviewed")}>
                  Mark reviewed
                </button>
                <button type="button" className="primary-button" onClick={() => saveSessionReview("verified")}>
                  Verify session
                </button>
              </div>
            </div>
          ) : (
            <p className="subtle-text">No sessions are available to review yet.</p>
          )}
        </article>

        <article className="panel">
          <div className="panel-head">
            <h2>Skill-level insights</h2>
            <span className="subtle-text">Attempts, trends, and parent comments over time</span>
          </div>
          <div className="timeline-list">
            {topInsights.map((insight) => (
              <div key={insight.skillId} className="timeline-item">
                <div className="history-card-head">
                  <strong>{insight.label}</strong>
                  <span className="status-pill">{trendLabel(insight.trend)}</span>
                </div>
                <p>
                  {insight.attemptsCount} attempts • avg {insight.averageRating.toFixed(1) || "0.0"}/3 • last{" "}
                  {insight.lastPracticedAt ?? "never"}
                </p>
                <p className="subtle-text">
                  {insight.parentComments[0] ?? "No parent comments captured for this skill yet."}
                </p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Notifications and alerts</h2>
          <span className="subtle-text">Meaningful reminders only</span>
        </div>
        <div className="notification-list">
          {state.notifications.map((note) => (
            <div key={note} className="notification-item">
              {note}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
