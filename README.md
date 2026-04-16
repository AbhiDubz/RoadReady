# RoadReady

RoadReady is a driving-practice planner for teen drivers and parents. Instead of treating every session the same, it tracks actual practice history, identifies weak or overdue skills, and recommends the next best route and coaching focus.

## Hackathon Summary

RoadReady helps families answer a simple but frustrating question: "What should we practice next?"

Most teen driving practice is inconsistent. Important skills get skipped, parents do not always know what to coach, and learners repeat familiar routes instead of targeting their real gaps. RoadReady turns session logs into a focused practice plan by:

- tracking driving sessions and per-skill confidence
- surfacing weak, stale, or never-practiced skills
- generating a nearby practice route based on those gaps
- giving both teen and parent a shared view of readiness and next steps

## What Makes It Useful

- Adaptive practice planning instead of a static checklist
- Shared teen and parent workflow with comments and review
- Route generation tied to actual skill gaps
- AI-assisted summaries and route guidance with rules-based fallbacks
- Demo-friendly seeded data so judges can see value quickly

## Core Features

- Landing page and product overview
- Local sign-in, account creation, and demo access
- Learner onboarding with role, state, experience level, and test date
- State-based checklist support for California and New York
- Session logger with ratings, road types, conditions, notes, and parent comments
- Progress and readiness engine for attempts, averages, confidence, and status
- Gap analysis for weak, overdue, and never-attempted skills
- Route recommendation flow with practice stops and route rationale
- Parent dashboard for review, coaching prompts, and approval workflow

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Leaflet and React Leaflet for maps
- Cookie-based local auth for demo access
- Local-first browser state with seeded demo data
- Gemini-compatible AI integration with fallback logic

## Demo Flow

For a hackathon demo, the fastest path is:

1. Open the landing page.
2. Click into the login flow.
3. Use the demo account to enter the seeded experience.
4. Review the dashboard and recommended focus areas.
5. Log a new driving session on `/app/sessions`.
6. Generate a tailored route on `/app/routes`.
7. Show the parent view on `/app/parent`.

## Local Setup

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Optional AI Setup

AI is optional. The app still works without an API key by falling back to deterministic summaries and route heuristics.

If you want model-backed summaries and route guidance, create a `.env.local` file with:

```env
GEMINI_API_KEY=your_key_here
GEMINI_SESSION_MODEL=gemini-2.5-flash
GEMINI_ROUTE_MODEL=gemini-2.5-flash
```

The app also accepts `OPENAI_API_KEY`, `OPENAI_SESSION_MODEL`, and `OPENAI_ROUTE_MODEL` as compatible fallbacks in the current implementation.

## Available Scripts

- `npm run dev` starts the local development server
- `npm run build` creates a production build
- `npm run start` runs the production server
- `npm run typecheck` runs TypeScript checks

## Project Structure

```text
app/
  page.tsx                 Landing page
  login/                   Sign-in and account creation page
  app/                     Main product experience
  api/                     Demo API routes for auth, summaries, and routes
components/
  app-state.tsx            Shared client-side app state
  dashboard/               Dashboard view
  forms/                   Onboarding and session logging
  routes/                  Route generation UI
  shell/                   App shell and navigation
lib/
  auth.ts                  Local auth and cookie session logic
  logic.ts                 Readiness, recommendation, and progress logic
  mock-data.ts             Seeded demo users, sessions, and checklists
  route-generation.ts      Route generation and verification logic
  types.ts                 Shared app types
```

## Current Scope

This is a hackathon MVP, so a few parts are intentionally simplified:

- authentication is local and file-backed for demo purposes
- checklist support is currently seeded for California and New York
- route generation relies on OpenStreetMap, Overpass, Photon, and OSRM
- AI output is assistive, not authoritative
- long-term persistence is not yet backed by a hosted database

## What We Would Build Next

- Hosted auth and database persistence
- Support for more states and official checklist sources
- Stronger household linking and role-based collaboration
- Production-grade maps stack with better routing controls
- Richer coaching, forecasting, reminders, and progress analytics

## Submission Notes

For judging, the most important idea is that RoadReady does not just log practice. It helps families decide what to practice next, why it matters, and where to do it.
