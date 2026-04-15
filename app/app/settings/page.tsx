"use client";

import { useAppState } from "@/components/app-state";

export default function SettingsPage() {
  const { state } = useAppState();

  return (
    <div className="stack-lg">
      <section className="panel">
        <div className="panel-head">
          <h1>Settings</h1>
          <p className="subtle-text">A lightweight MVP settings view for account, test date, and notification preferences.</p>
        </div>

        <div className="settings-list">
          <div className="settings-item">
            <strong>Account email</strong>
            <span>{state.profile.email}</span>
          </div>
          <div className="settings-item">
            <strong>Target test date</strong>
            <span>{state.profile.targetTestDate ?? "Not set"}</span>
          </div>
          <div className="settings-item">
            <strong>Notification style</strong>
            <span>In-app reminders enabled</span>
          </div>
          <div className="settings-item">
            <strong>Checklist source</strong>
            <span>{state.profile.stateCode} seeded DMV-style skill catalog</span>
          </div>
        </div>
      </section>
    </div>
  );
}

