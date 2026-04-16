import type { ReactNode } from "react";

type PageIntroTone = "teal" | "amber" | "blue" | "green";

interface PageIntroStat {
  label: string;
  value: string;
  detail?: string;
  tone?: PageIntroTone;
}

interface PageIntroProps {
  eyebrow?: string;
  title: string;
  description: string;
  stats?: PageIntroStat[];
  children?: ReactNode;
}

export function PageIntro({ eyebrow, title, description, stats = [], children }: PageIntroProps) {
  return (
    <section className="page-intro">
      <div className="page-intro-copy">
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        <p>{description}</p>
        {children ? <div className="page-intro-actions">{children}</div> : null}
      </div>

      {stats.length ? (
        <div className="page-intro-stat-grid">
          {stats.map((stat) => (
            <article key={stat.label} className={`page-intro-stat tone-${stat.tone ?? "teal"}`}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              {stat.detail ? <p>{stat.detail}</p> : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
