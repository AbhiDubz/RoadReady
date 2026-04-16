import { redirect } from "next/navigation";
import { LoginCard } from "@/components/auth/login-card";
import { getCurrentUser } from "@/lib/auth";

const authHighlights = [
  {
    label: "Protected planner",
    value: "Private RoadReady workspace",
    detail: "The dashboard, route builder, and session tools now sit behind an authenticated session."
  },
  {
    label: "Local-first accounts",
    value: "Created on this device",
    detail: "No external auth provider is required for the demo, so you can sign in immediately."
  },
  {
    label: "Per-account demo state",
    value: "Separate learner data",
    detail: "Each signed-in account gets its own stored RoadReady state instead of sharing one browser profile."
  },
  {
    label: "Fast preview",
    value: "One-click demo access",
    detail: "Try the seeded Maya Chen learner flow without creating an account first."
  }
];

export default async function LoginPage() {
  const account = await getCurrentUser();

  if (account) {
    redirect("/app");
  }

  return (
    <main className="auth-page">
      <div className="auth-layout">
        <section className="auth-hero">
          <div className="auth-hero-copy">
            <div className="hero-badge">
              <span className="badge-dot" />
              Account access for the RoadReady demo
            </div>
            <h1>
              Sign in before you plan the next <span className="gradient-text">practice drive</span>
            </h1>
            <p className="hero-copy">
              RoadReady now protects the driving dashboard, route generation, and session summaries behind a real
              login. Create an account once on this device, then come back to the same learner workspace each time.
            </p>
          </div>

          <div className="summary-card-grid auth-highlight-grid">
            {authHighlights.map((item) => (
              <article key={item.label} className="summary-card">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <LoginCard />
      </div>
    </main>
  );
}
