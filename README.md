# RoadReady

RoadReady is an adaptive driving practice planner for teen drivers and parents. It turns driving logs into a focused practice plan by tracking skill progress, surfacing weak or overdue areas, recommending the next best skills to practice, and generating a demo-friendly nearby route plan.

## What’s in this MVP

- Landing page with product framing and demo launch
- Learner setup flow with role, state, experience level, and target test date
- State-based skill checklist for California and New York
- Session logger with per-skill ratings, conditions, notes, and parent comments
- Skill progress engine that updates attempts, average ratings, confidence, and status
- Gap analysis engine for readiness, overdue skills, and top-priority practice targets
- Route recommendation page with skill-based practice stops and route rationale
- Parent / instructor dashboard for comments, gaps, and coaching prompts
- AI-style session summaries through a local route handler fallback

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Local-first seeded demo state stored in `localStorage`

## Project Structure

```text
app/
  page.tsx                 Landing page
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

## Demo Story

1. Open the landing page and launch the demo.
2. Review the seeded dashboard for readiness, weak skills, and recent sessions.
3. Log a new driving session on `/app/sessions`.
4. Watch the dashboard and recommendations update.
5. Generate a tailored route on `/app/routes`.
6. Show the parent view on `/app/parent`.

## Current Simplifications

- Authentication is represented as a profile and role flow rather than a production auth backend.
- DMV checklists are seeded for two states instead of pulling from a live official source.
- Route generation is rules-based and demo-oriented, not turn-by-turn navigation.
- AI coaching is deterministic and local so the app works without API keys.

## Future Upgrades

- Supabase or Firebase auth and persistence
- Real household linking and role-based access
- Live maps integration with Mapbox or Google Maps
- OpenAI-powered coaching summaries and explanations
- Notifications, weather-aware planning, and readiness forecasting
