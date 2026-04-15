"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppState } from "@/components/app-state";
import { stateCatalog } from "@/lib/mock-data";
import { ExperienceLevel, Role } from "@/lib/types";

export function OnboardingForm() {
  const { state, completeOnboarding, isPending } = useAppState();
  const router = useRouter();
  const [role, setRole] = useState<Role>(state.profile.role);
  const [name, setName] = useState(state.profile.name);
  const [email, setEmail] = useState(state.profile.email);
  const [age, setAge] = useState(String(state.profile.age));
  const [stateCode, setStateCode] = useState(state.profile.stateCode);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(state.profile.experienceLevel);
  const [targetTestDate, setTargetTestDate] = useState(state.profile.targetTestDate ?? "");
  const [householdName, setHouseholdName] = useState(state.profile.householdName ?? "");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    completeOnboarding({
      name,
      email,
      role,
      age: Number(age),
      stateCode,
      experienceLevel,
      targetTestDate: targetTestDate || undefined,
      householdName: householdName || undefined
    });

    router.push("/app");
  }

  return (
    <form className="panel form-panel" onSubmit={handleSubmit}>
      <div className="panel-head">
        <h1>Set up the learner profile</h1>
        <p className="subtle-text">Choose the state checklist, role, and readiness target.</p>
      </div>

      <div className="form-grid">
        <label>
          <span>Role</span>
          <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
            <option value="teen">Teen driver</option>
            <option value="parent">Parent / instructor</option>
          </select>
        </label>

        <label>
          <span>Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>

        <label>
          <span>Email</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>

        <label>
          <span>Age</span>
          <input type="number" min="14" max="22" value={age} onChange={(event) => setAge(event.target.value)} />
        </label>

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
      </div>

      <button type="submit" className="primary-button" disabled={isPending}>
        Save profile and load checklist
      </button>
    </form>
  );
}

