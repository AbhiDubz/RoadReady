import Link from "next/link";

const highlights = [
  "Track every driving practice session with skill-level ratings",
  "Identify weak, overdue, or never-attempted skills automatically",
  "Generate nearby practice routes matched to the learner's gaps",
  "Give parents and teens one clear readiness dashboard"
];

export default function LandingPage() {
  return (
    <main className="landing-page">
      <section className="landing-hero">
        <div className="stack-lg">
          <span className="eyebrow">Hackathon-ready adaptive coaching</span>
          <h1>Personalized driving practice for new drivers</h1>
          <p className="hero-copy">
            RoadReady turns post-drive reflections into a smart practice plan. It tracks sessions, scores skill gaps,
            prioritizes the next focus areas, and recommends nearby routes to practice what matters most.
          </p>
          <div className="button-row">
            <Link href="/app" className="primary-button">
              Launch demo app
            </Link>
            <Link href="/app/setup" className="secondary-button">
              Edit learner profile
            </Link>
          </div>
        </div>

        <div className="landing-card">
          <div className="mini-stat">
            <span>Next best practice</span>
            <strong>Highway merge + lane changes</strong>
          </div>
          <div className="mini-stat">
            <span>Route suggestion</span>
            <strong>24-minute balanced loop</strong>
          </div>
          <div className="mini-stat">
            <span>Coach insight</span>
            <strong>Repeat merges at lower-traffic times first</strong>
          </div>
        </div>
      </section>

      <section className="landing-grid">
        {highlights.map((item) => (
          <article key={item} className="feature-card">
            <h2>{item}</h2>
            <p>
              Built for an MVP demo flow: onboarding, session logging, a transparent scoring engine, route generation,
              and parent visibility.
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}

