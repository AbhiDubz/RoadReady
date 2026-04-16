"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { useAppState } from "@/components/app-state";
import { buildSessionSummary } from "@/lib/logic";
import { GeneratedContentSource } from "@/lib/types";

const roadTypeOptions = ["Residential", "Neighborhood arterials", "Multi-lane arterial", "Highway"];
const conditionOptions = ["night", "rain", "traffic", "construction", "afternoon", "evening", "rush hour"];

function IconEdit() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m2 12 8.58 3.91a2 2 0 0 0 1.66 0L21 12" />
      <path d="m2 17 8.58 3.91a2 2 0 0 0 1.66 0L21 17" />
    </svg>
  );
}

function IconStar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function IconMessageSquare() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

const STEPS = ["Details", "Road & Conditions", "Skill Ratings", "Notes"];

export function SessionLogger() {
  const { state, logSession, isPending } = useAppState();
  const [date, setDate] = useState("2026-04-14");
  const [durationMinutes, setDurationMinutes] = useState("45");
  const [areaDriven, setAreaDriven] = useState("Cupertino loop");
  const [notes, setNotes] = useState("");
  const [parentComment, setParentComment] = useState("");
  const [weather, setWeather] = useState("Clear");
  const [trafficLevel, setTrafficLevel] = useState("Medium");
  const [roadTypes, setRoadTypes] = useState<string[]>(["Residential"]);
  const [conditions, setConditions] = useState<string[]>(["afternoon"]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [activeStep, setActiveStep] = useState(0);
  const stepRefs = useRef<Array<HTMLElement | null>>([]);

  const selectedRatings = useMemo(
    () =>
      Object.entries(ratings)
        .filter(([, rating]) => rating > 0)
        .map(([skillId, rating]) => ({ skillId, rating })),
    [ratings]
  );

  function toggleSelection(value: string, current: string[], setter: (next: string[]) => void) {
    setter(current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input = {
      date,
      durationMinutes: Number(durationMinutes),
      areaDriven,
      roadTypes,
      notes,
      parentComment,
      weather,
      trafficLevel,
      conditions,
      skillRatings: selectedRatings
    };

    let aiSummary = buildSessionSummary(state.skills, input);
    let summarySource: GeneratedContentSource = "rules-based";

    try {
      const response = await fetch("/api/ai/session-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ skills: state.skills, session: input })
      });

      if (response.ok) {
        const data = (await response.json()) as {
          source?: GeneratedContentSource;
          summary: string;
        };
        aiSummary = data.summary;
        summarySource = data.source ?? "rules-based";
      }
    } catch {
      // Keep the local fallback summary if the route is unavailable.
    }

    logSession(input, aiSummary, summarySource);
    setNotes("");
    setParentComment("");
    setRatings({});
    setActiveStep(0);
  }

  function getStepState(index: number) {
    if (index < activeStep) return "completed";
    if (index === activeStep) return "active";
    return "";
  }

  function goToStep(index: number) {
    setActiveStep(index);
    stepRefs.current[index]?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  const sessionHighlights = [
    {
      label: "Planned duration",
      value: `${durationMinutes} min`,
      detail: areaDriven
    },
    {
      label: "Conditions tagged",
      value: String(roadTypes.length + conditions.length),
      detail: `${roadTypes.length} road types | ${conditions.length} conditions`
    },
    {
      label: "Skills rated",
      value: `${selectedRatings.length}/${state.skills.length}`,
      detail: selectedRatings.length ? "Ratings ready for the recommendation engine" : "Add at least one rating to save"
    }
  ];

  return (
    <form className="stack-lg" onSubmit={handleSubmit}>
      <div className="session-stepper">
        {STEPS.map((step, index) => (
          <button
            key={step}
            type="button"
            className={`session-step-pill ${getStepState(index)}`}
            onClick={() => goToStep(index)}
          >
            <span className="session-step-count">0{index + 1}</span>
            <span>{step}</span>
          </button>
        ))}
      </div>

      <div className="session-kpi-grid">
        {sessionHighlights.map((highlight) => (
          <article key={highlight.label} className="session-kpi-card">
            <span>{highlight.label}</span>
            <strong>{highlight.value}</strong>
            <p>{highlight.detail}</p>
          </article>
        ))}
      </div>

      <section
        ref={(node) => {
          stepRefs.current[0] = node;
        }}
        className="panel session-step-section"
        onClick={() => setActiveStep(0)}
      >
        <div className="panel-head">
          <div className="section-header-icon">
            <IconEdit />
            <h2>Add a practice session</h2>
          </div>
          <p className="subtle-text">Capture what happened right after the drive so the recommendation engine stays sharp.</p>
        </div>

        <div className="form-grid">
          <label>
            <span>Date</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label>
            <span>Duration (minutes)</span>
            <input
              type="number"
              min="10"
              max="180"
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(event.target.value)}
            />
          </label>
          <label>
            <span>Area driven</span>
            <input value={areaDriven} onChange={(event) => setAreaDriven(event.target.value)} />
          </label>
          <label>
            <span>Weather</span>
            <input value={weather} onChange={(event) => setWeather(event.target.value)} />
          </label>
          <label>
            <span>Traffic level</span>
            <select value={trafficLevel} onChange={(event) => setTrafficLevel(event.target.value)}>
              <option>Light</option>
              <option>Medium</option>
              <option>Heavy</option>
            </select>
          </label>
        </div>
      </section>

      <section
        ref={(node) => {
          stepRefs.current[1] = node;
        }}
        className="panel session-step-section"
        onClick={() => setActiveStep(1)}
      >
        <div className="panel-head">
          <div className="section-header-icon">
            <IconLayers />
            <h2>Road types and conditions</h2>
          </div>
          <span className="subtle-text">Tap all that apply</span>
        </div>
        <div className="chip-wrap">
          {roadTypeOptions.map((option) => (
            <button
              key={option}
              type="button"
              className={roadTypes.includes(option) ? "chip active" : "chip"}
              onClick={() => toggleSelection(option, roadTypes, setRoadTypes)}
            >
              {option}
            </button>
          ))}
        </div>
        <div className="chip-wrap" style={{ marginTop: 12 }}>
          {conditionOptions.map((option) => (
            <button
              key={option}
              type="button"
              className={conditions.includes(option) ? "chip active" : "chip"}
              onClick={() => toggleSelection(option, conditions, setConditions)}
            >
              {option}
            </button>
          ))}
        </div>
      </section>

      <section
        ref={(node) => {
          stepRefs.current[2] = node;
        }}
        className="panel session-step-section"
        onClick={() => setActiveStep(2)}
      >
        <div className="panel-head">
          <div className="section-header-icon">
            <IconStar />
            <h2>Rate practiced skills</h2>
          </div>
          <span className="subtle-text">1 = needs a lot of support, 2 = mixed, 3 = confident</span>
        </div>
        <div className="rating-grid">
          {state.skills.map((skill) => (
            <div key={skill.id} className="rating-card">
              <div>
                <strong>{skill.label}</strong>
                <p>{skill.category}</p>
              </div>
              <div className="rating-buttons">
                {[1, 2, 3].map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={ratings[skill.id] === value ? "rating-button active" : "rating-button"}
                    onClick={() => setRatings((current) => ({ ...current, [skill.id]: value }))}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        ref={(node) => {
          stepRefs.current[3] = node;
        }}
        className="panel session-step-section"
        onClick={() => setActiveStep(3)}
      >
        <div className="panel-head">
          <div className="section-header-icon">
            <IconMessageSquare />
            <h2>Notes and comments</h2>
          </div>
        </div>
        <div className="form-grid">
          <label className="full-width">
            <span>Teen notes</span>
            <textarea
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="What felt easier? What felt stressful?"
            />
          </label>
          <label className="full-width">
            <span>Parent / instructor comment</span>
            <textarea
              rows={4}
              value={parentComment}
              onChange={(event) => setParentComment(event.target.value)}
              placeholder="Add observations, reminders, or confirmation."
            />
          </label>
        </div>
        <div className="form-footer-bar" style={{ marginTop: 16 }}>
          <div>
            <strong>Save the session and refresh the plan</strong>
            <p className="subtle-text">At least one skill rating is required so the next recommendation has something real to learn from.</p>
          </div>
          <button type="submit" className="primary-button" disabled={isPending || selectedRatings.length === 0}>
            Save session and update recommendations
          </button>
        </div>
      </section>
    </form>
  );
}
