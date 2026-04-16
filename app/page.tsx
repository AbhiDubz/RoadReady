import Link from "next/link";
import type { Route } from "next";

const features = [
  {
    icon: "clipboard",
    color: "icon-teal",
    title: "Track every session with skill-level ratings",
    description:
      "Log each drive with skill ratings, road types, and conditions. The engine learns which skills need focus and which are improving."
  },
  {
    icon: "radar",
    color: "icon-amber",
    title: "Identify weak, overdue, or never-attempted skills",
    description:
      "A gap analysis engine instantly surfaces your blind spots — skills you've skipped, ones that are fading, and areas rated low."
  },
  {
    icon: "route",
    color: "icon-blue",
    title: "Generate practice routes matched to gaps",
    description:
      "RoadReady builds a nearby driving loop with practice stops, each one selected to target the skills that need the most reps."
  },
  {
    icon: "users",
    color: "icon-green",
    title: "Give parents and teens one clear dashboard",
    description:
      "Both the teen driver and supervising parent see a shared readiness score, coaching prompts, and a transparent practice history."
  }
];

const highlights = [
  { label: "Practice hours tracked", value: "42.5", note: "Across logged sessions" },
  { label: "Skills surfaced automatically", value: "18", note: "Weak, overdue, and skipped" },
  { label: "Next route generated", value: "24 min", note: "Balanced loop near home" }
];

const journeySteps = [
  {
    step: "01",
    title: "Log the real drive",
    description: "Capture where the learner drove, which road types showed up, and how each skill actually felt."
  },
  {
    step: "02",
    title: "Spot the hidden gaps",
    description: "RoadReady weighs low confidence, skipped skills, and stale practice to surface the next best focus."
  },
  {
    step: "03",
    title: "Practice the right route",
    description: "A targeted loop turns that gap into a repeatable session with coaching prompts for both teen and parent."
  }
];

function FeatureIcon({ type }: { type: string }) {
  switch (type) {
    case "clipboard":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <path d="M12 11h4" />
          <path d="M12 16h4" />
          <path d="M8 11h.01" />
          <path d="M8 16h.01" />
        </svg>
      );
    case "radar":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19.07 4.93A10 10 0 0 0 6.99 3.34" />
          <path d="M4 6h.01" />
          <path d="M2.29 9.62A10 10 0 1 0 21.31 8.35" />
          <path d="M16.24 7.76A6 6 0 1 0 8.23 16.67" />
          <path d="M12 18h.01" />
          <path d="M17.99 11.66A6 6 0 0 1 15.77 16.67" />
          <circle cx="12" cy="12" r="2" />
          <path d="m13.41 10.59 5.66-5.66" />
        </svg>
      );
    case "route":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="6" cy="19" r="3" />
          <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
          <circle cx="18" cy="5" r="3" />
        </svg>
      );
    case "users":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    default:
      return null;
  }
}

export default function LandingPage() {
  const loginHref = "/login" as Route;
  const registerHref = "/login?mode=register" as Route;

  return (
    <main className="landing-page">
      <section className="landing-hero">
        <div className="stack-lg">
          <div className="hero-badge">
            <span className="badge-dot" />
            Adaptive driving coach for new drivers
          </div>
          <h1>
            <span className="gradient-text">Personalized driving practice</span> for teens learning to drive
          </h1>
          <p className="hero-copy">
            RoadReady turns post-drive reflections into a smart practice plan. It tracks sessions, scores skill gaps,
            prioritizes the next focus areas, and recommends nearby routes to practice what matters most.
          </p>
          <div className="button-row">
            <Link href={loginHref} className="primary-button">
              Sign in to RoadReady
            </Link>
            <Link href={registerHref} className="secondary-button">
              Create an account
            </Link>
          </div>
          <div className="hero-highlights">
            {highlights.map((highlight) => (
              <div key={highlight.label} className="hero-highlight-card">
                <span>{highlight.label}</span>
                <strong>{highlight.value}</strong>
                <p>{highlight.note}</p>
              </div>
            ))}
          </div>
          <div className="trust-badge">
            <div className="trust-badge-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <div className="trust-badge-text">
              <strong>Built for every state&apos;s requirements</strong>
              DMV-aligned skill checklists covering all 50 states
            </div>
          </div>
        </div>

        <div className="landing-card">
          <div className="hero-panel-head">
            <div>
              <span className="eyebrow">Live plan preview</span>
              <h2>From last drive to next practice</h2>
            </div>
            <span className="status-pill">AI-assisted</span>
          </div>
          <div className="hero-route-line">
            <span className="hero-route-stop active">School pickup</span>
            <span className="hero-route-dash" />
            <span className="hero-route-stop">Protected left turn</span>
            <span className="hero-route-dash" />
            <span className="hero-route-stop">Freeway on-ramp</span>
          </div>
          <div className="mini-stat">
            <span>Next Best Practice</span>
            <strong>Highway merge + lane changes</strong>
            <p>Confidence is trending up on neighborhood driving, so the plan shifts toward higher-speed reps.</p>
          </div>
          <div className="mini-stat">
            <span>Route Suggestion</span>
            <strong>24-minute balanced loop</strong>
            <p>Starts on familiar streets, then builds toward lane changes and a single merge before heading home.</p>
          </div>
          <div className="mini-stat">
            <span>Coach Insight</span>
            <strong>Repeat merges at lower-traffic times first</strong>
            <p>Use quiet windows to rehearse lane timing, then repeat the route during moderate traffic later this week.</p>
          </div>
        </div>
      </section>

      <section className="landing-grid">
        {features.map((feature, index) => (
          <article key={feature.title} className="feature-card">
            <span className="feature-number">0{index + 1}</span>
            <div className={`feature-icon ${feature.color}`}>
              <FeatureIcon type={feature.icon} />
            </div>
            <h2>{feature.title}</h2>
            <p>{feature.description}</p>
          </article>
        ))}
      </section>

      <section className="landing-section-head">
        <div>
          <span className="eyebrow">Practice loop</span>
          <h2>From one reflection to the next route</h2>
        </div>
        <p className="subtle-text">
          RoadReady is strongest when each drive feeds the next one immediately instead of letting the details fade.
        </p>
      </section>

      <section className="landing-process-grid">
        {journeySteps.map((step) => (
          <article key={step.step} className="process-card">
            <span className="process-step-number">{step.step}</span>
            <h2>{step.title}</h2>
            <p>{step.description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
