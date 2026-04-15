"use client";

import { FormEvent, useMemo, useState } from "react";
import { useAppState } from "@/components/app-state";
import { buildSessionSummary } from "@/lib/logic";

const roadTypeOptions = ["Residential", "Neighborhood arterials", "Multi-lane arterial", "Highway"];
const conditionOptions = ["night", "rain", "traffic", "construction", "afternoon", "evening", "rush hour"];

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

    try {
      const response = await fetch("/api/ai/session-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ skills: state.skills, session: input })
      });

      if (response.ok) {
        const data = (await response.json()) as { summary: string };
        aiSummary = data.summary;
      }
    } catch {
      // Keep the local fallback summary if the route is unavailable.
    }

    logSession(input, aiSummary);
    setNotes("");
    setParentComment("");
    setRatings({});
  }

  return (
    <form className="stack-lg" onSubmit={handleSubmit}>
      <section className="panel">
        <div className="panel-head">
          <h1>Log a practice session</h1>
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

      <section className="panel">
        <div className="panel-head">
          <h2>Road types and conditions</h2>
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
        <div className="chip-wrap">
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

      <section className="panel">
        <div className="panel-head">
          <h2>Rate practiced skills</h2>
          <span className="subtle-text">1 = shaky, 5 = confident</span>
        </div>
        <div className="rating-grid">
          {state.skills.map((skill) => (
            <div key={skill.id} className="rating-card">
              <div>
                <strong>{skill.label}</strong>
                <p>{skill.category}</p>
              </div>
              <div className="rating-buttons">
                {[1, 2, 3, 4, 5].map((value) => (
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

      <section className="panel">
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
        <button type="submit" className="primary-button" disabled={isPending || selectedRatings.length === 0}>
          Save session and update recommendations
        </button>
      </section>
    </form>
  );
}

