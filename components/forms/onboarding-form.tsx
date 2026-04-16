"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppState } from "@/components/app-state";
import {
  buildOwnedHouseholdInviteCode,
  getViewerRoleLabel,
  normalizeHouseholdInviteCode
} from "@/lib/household";
import { stateCatalog } from "@/lib/mock-data";
import { ExperienceLevel } from "@/lib/types";

export function OnboardingForm() {
  const { account, state, completeOnboarding, isPending } = useAppState();
  const router = useRouter();
  const [name, setName] = useState(state.profile.name);
  const [email, setEmail] = useState(state.profile.email ?? "");
  const [age, setAge] = useState(String(state.profile.age));
  const [stateCode, setStateCode] = useState(state.profile.stateCode);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(state.profile.experienceLevel);
  const [targetTestDate, setTargetTestDate] = useState(state.profile.targetTestDate ?? "");
  const [householdName, setHouseholdName] = useState(state.profile.householdName ?? "");
  const [householdInviteCode, setHouseholdInviteCode] = useState(state.profile.householdInviteCode ?? "");
  const [error, setError] = useState<string | null>(null);
  const viewerRoleLabel = getViewerRoleLabel(account.role);
  const ownedInviteCode = useMemo(() => buildOwnedHouseholdInviteCode(account.id), [account.id]);
  const normalizedHouseholdInviteCode =
    account.role === "teen" ? ownedInviteCode : normalizeHouseholdInviteCode(householdInviteCode);
  const summaryCards = [
    {
      label: "Checklist source",
      value: stateCode,
      detail: "DMV-style skill coverage updates instantly when you switch states."
    },
    {
      label: "Readiness target",
      value: targetTestDate || "Pick a target date",
      detail: "A clear deadline helps RoadReady frame the right practice pace."
    },
    {
      label: "Shared access",
      value: householdName || "Solo profile",
      detail: normalizedHouseholdInviteCode
        ? account.role === "teen"
          ? `Share code ${normalizedHouseholdInviteCode} with the parent account.`
          : `Link this parent account with teen code ${normalizedHouseholdInviteCode}.`
        : "Enter the teen invite code to connect this parent account to one shared plan."
    }
  ];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      await completeOnboarding({
        name,
        email: email || undefined,
        age: Number(age),
        stateCode,
        experienceLevel,
        targetTestDate: targetTestDate || undefined,
        householdName: householdName || undefined,
        householdInviteCode: normalizedHouseholdInviteCode || undefined
      });

      router.push("/app");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save the learner profile yet.");
    }
  }

  return (
    <form className="panel form-panel" onSubmit={handleSubmit}>
      <div className="panel-head form-panel-head">
        <div className="section-header-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <h1>Set up the learner profile</h1>
        </div>
        <p className="subtle-text">Choose the learner details, readiness target, and household code that links parent and teen accounts.</p>
      </div>

      <div className="summary-card-grid">
        {summaryCards.map((card) => (
          <article key={card.label} className="summary-card">
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <p>{card.detail}</p>
          </article>
        ))}
      </div>

      <div className="form-section-grid">
        <section className="form-section-card">
          <div className="form-section-head">
            <span className="eyebrow">Learner identity</span>
            <h2>Who is this plan for?</h2>
            <p className="subtle-text">You are signed in as {viewerRoleLabel}. These fields describe the teen learner profile shared across the household.</p>
          </div>

          <div className="form-grid">
            <label>
              <span>Signed-in view</span>
              <input value={viewerRoleLabel} readOnly />
            </label>

            <label>
              <span>Learner name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>

            <label>
              <span>Learner email {account.role === "teen" ? "(optional)" : ""}</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={account.role === "parent" ? "teen@example.com" : account.email}
              />
            </label>

            <label>
              <span>Learner age</span>
              <input type="number" min="14" max="22" value={age} onChange={(event) => setAge(event.target.value)} />
            </label>
          </div>
        </section>

        <section className="form-section-card">
          <div className="form-section-head">
            <span className="eyebrow">Practice setup</span>
            <h2>Match the right checklist and goal</h2>
            <p className="subtle-text">Pick the state, current experience, and the household code both logins will use to open the same learner plan.</p>
          </div>

          <div className="form-grid">
            <label>
              <span>State</span>
              <select value={stateCode} onChange={(event) => setStateCode(event.target.value)}>
                {stateCatalog.map((entry) => (
                  <option key={entry.code} value={entry.code}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Experience level</span>
              <select
                value={experienceLevel}
                onChange={(event) => setExperienceLevel(event.target.value as ExperienceLevel)}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="test_soon">Test soon</option>
              </select>
            </label>

            <label>
              <span>Target test date</span>
              <input type="date" value={targetTestDate} onChange={(event) => setTargetTestDate(event.target.value)} />
            </label>

            <label>
              <span>Household name</span>
              <input value={householdName} onChange={(event) => setHouseholdName(event.target.value)} />
            </label>

            <label>
              <span>Household invite code</span>
              {account.role === "teen" ? (
                <input value={ownedInviteCode} readOnly />
              ) : (
                <input
                  value={householdInviteCode}
                  onChange={(event) => setHouseholdInviteCode(event.target.value)}
                  placeholder="RR-XXXX-XXXX-XXXX"
                />
              )}
            </label>
          </div>
          <p className="subtle-text">
            {account.role === "teen"
              ? "This invite code is unique to the teen account. Share it with a parent or instructor to link the same household plan."
              : "Paste the teen account's invite code here to link this parent view to that learner."}
          </p>
        </section>
      </div>

      {error ? (
        <div className="panel" style={{ borderColor: "rgba(248, 113, 113, 0.45)" }}>
          <p>{error}</p>
        </div>
      ) : null}

      <div className="form-footer-bar">
        <div className="form-footer-copy">
          <strong>Save the learner profile and seed the plan</strong>
          <p className="subtle-text">
            {account.role === "teen"
              ? "Saving creates the learner plan and keeps this teen invite code ready for a parent link."
              : "Saving links this parent account to the teen's shared learner plan."}
          </p>
        </div>
        <button type="submit" className="primary-button" disabled={isPending}>
          Save profile and load checklist
        </button>
      </div>
    </form>
  );
}
