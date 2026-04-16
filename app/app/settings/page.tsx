"use client";

import { useAppState } from "@/components/app-state";
import { getViewerRoleLabel } from "@/lib/household";
import { PageIntro } from "@/components/shell/page-intro";

const settingsIcons = {
  email: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  ),
  database: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5V19A9 3 0 0 0 21 19V5" />
      <path d="M3 12A9 3 0 0 0 21 12" />
    </svg>
  )
};

export default function SettingsPage() {
  const { account, state } = useAppState();
  const viewerRoleLabel = getViewerRoleLabel(account.role);

  const items = [
    { icon: settingsIcons.email, label: "Account email", value: account.email },
    { icon: settingsIcons.database, label: "Signed-in view", value: viewerRoleLabel },
    { icon: settingsIcons.database, label: "Linked learner", value: state.profile.name },
    {
      icon: settingsIcons.database,
      label: "Household code",
      value: state.profile.householdInviteCode ?? "Add one in Setup to link parent and teen accounts"
    },
    { icon: settingsIcons.calendar, label: "Target test date", value: state.profile.targetTestDate ?? "Not set" },
    { icon: settingsIcons.bell, label: "Notification style", value: "In-app reminders enabled" },
    {
      icon: settingsIcons.database,
      label: "Checklist source",
      value: `${state.profile.stateCode} seeded DMV-style skill catalog`
    }
  ];

  return (
    <div className="stack-lg">
      <PageIntro
        eyebrow="Household settings"
        title="Keep the demo tuned to the right learner"
        description="Review the signed-in account, the linked learner, and which DMV-style checklist is powering the practice plan."
        stats={[
          {
            label: "Role",
            value: viewerRoleLabel,
            detail: "This comes from the signed-in account",
            tone: "teal"
          },
          {
            label: "Target date",
            value: state.profile.targetTestDate ?? "Not set",
            detail: "A clear deadline helps prioritize practice intensity",
            tone: "amber"
          },
          {
            label: "Checklist",
            value: state.profile.stateCode,
            detail: "Seeded with DMV-style requirements for this state",
            tone: "blue"
          }
        ]}
      />

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Program settings</h2>
            <p className="subtle-text">Account details, learner linkage, and the current checklist target.</p>
          </div>
        </div>

        <div className="settings-list">
          {items.map((item) => (
            <div key={item.label} className="settings-item">
              <div className="settings-icon">{item.icon}</div>
              <div className="settings-item-content">
                <strong>{item.label}</strong>
                <span>{item.value}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
