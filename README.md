# RoadReady

RoadReady is an adaptive driving practice planner for teen drivers and parents. It turns driving logs into a focused practice plan by tracking skill progress, surfacing weak or overdue areas, recommending the next best skills to practice, and generating a demo-friendly nearby route plan.

## What’s in this MVP

- Landing page with product framing and demo launch
- Local credentials login with protected app routes and per-account demo state
- Learner setup flow with role, state, experience level, and target test date
- State-based skill checklist for California and New York
- Session logger with per-skill ratings, conditions, notes, and parent comments
- Skill progress engine that updates attempts, average ratings, confidence, and status
- Gap analysis engine for readiness, overdue skills, and top-priority practice targets
- Route recommendation page with skill-based practice stops and route rationale
- Parent / instructor dashboard for comments, gaps, and coaching prompts
- Gemini-powered session summaries and route guidance with rules-based fallbacks

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Local credentials auth with cookie sessions
- Local-first seeded demo state stored in `localStorage`

## Project Structure

```text
app/
  page.tsx                 Landing page
  login/                   Sign-in and account creation page
  app/                     Product experience pages
  api/                     Demo API routes for summaries and routes
components/
  app-state.tsx            Shared client-side app state
  dashboard/               Dashboard view
  forms/                   Onboarding and session logging
  routes/                  Route generation UI
  shell/                   Sidebar app shell
lib/
  logic.ts                 Readiness, recommendation, and route logic
  mock-data.ts             Seeded users, sessions, and state checklists
  types.ts                 Shared app types
```

## Run Locally

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Optional AI Setup

To enable AI summaries and AI-assisted route guidance, create `.env.local` with the variables in `.env.example`.

- `GEMINI_API_KEY` enables model-backed summaries and route guidance
- `GEMINI_SESSION_MODEL` optionally overrides the session-summary model
- `GEMINI_ROUTE_MODEL` optionally overrides the route-planning model

Without an API key, RoadReady falls back to deterministic summaries and route heuristics.

## Demo Story

1. Open the landing page and launch the demo.
2. Review the seeded dashboard for readiness, weak skills, and recent sessions.
3. Log a new driving session on `/app/sessions`.
4. Watch the dashboard and recommendations update.
5. Generate a tailored route on `/app/routes`.
6. Show the parent view on `/app/parent`.

## Current Simplifications

- Authentication is local-first and file-backed for the demo rather than using a hosted auth provider.
- DMV checklists are seeded for two states instead of pulling from a live official source.
- Route generation depends on OpenStreetMap, Overpass, Photon, and OSRM instead of a dedicated production maps stack.
- AI output is assistive only; the app still relies on route verification and local fallbacks so it works without API keys.

## Future Upgrades

- Hosted auth and persistence with Supabase or Firebase
- Real household linking and role-based access
- Live maps integration with Mapbox or Google Maps
- Richer Gemini-powered coaching, reflection, and planning flows
- Notifications, weather-aware planning, and readiness forecasting
