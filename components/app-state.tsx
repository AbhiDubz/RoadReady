"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition
} from "react";
import {
  buildCoachTip,
  createSessionRecord,
  generateRoutePlan,
  getReadinessSnapshot,
  getRecommendations,
  isValidRoutePlan,
  recomputeProgress
} from "@/lib/logic";
import { createDemoState, createProfileFromOnboarding, getChecklistForState } from "@/lib/mock-data";
import {
  AppState,
  OnboardingInput,
  RoutePlan,
  SessionInput
} from "@/lib/types";

interface AppStateContextValue {
  state: AppState;
  isPending: boolean;
  readiness: ReturnType<typeof getReadinessSnapshot>;
  completeOnboarding: (input: OnboardingInput) => void;
  logSession: (input: SessionInput, aiSummary?: string) => void;
  saveRoute: (route: RoutePlan) => void;
  resetDemo: () => void;
}

const STORAGE_KEY = "roadready-demo-state";

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);

function buildFreshState(input?: OnboardingInput): AppState {
  if (!input) {
    const seeded = createDemoState();
    const seededProgress = recomputeProgress(seeded.skills, seeded.sessions);
    const recommendations = getReadinessSnapshot({ ...seeded, progress: seededProgress }).topRecommendations;

    return {
      ...seeded,
      progress: seededProgress,
      coachTip: buildCoachTip(recommendations)
    };
  }

  const profile = createProfileFromOnboarding(input);
  const skills = getChecklistForState(input.stateCode);

  return {
    profile,
    skills,
    progress: recomputeProgress(skills, []),
    sessions: [],
    coachTip: "Start with a short practice drive and log it to unlock your first adaptive recommendation.",
    notifications: [
      "Checklist initialized for your selected state.",
      "Log your first drive to generate readiness and route suggestions."
    ]
  };
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => createDemoState());
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      const fresh = buildFreshState();
      setState(fresh);
      return;
    }

    try {
      const parsed = JSON.parse(stored) as AppState;
      const progress = recomputeProgress(parsed.skills, parsed.sessions);
      const recommendations = getRecommendations(parsed.profile, parsed.skills, progress);
      const legacyRoute = parsed.latestRoute as Partial<RoutePlan> | undefined;
      const latestRoute =
        legacyRoute && !isValidRoutePlan(legacyRoute)
          ? legacyRoute.prioritySkillIds?.length
            ? generateRoutePlan(parsed.skills, recommendations, {
                startLocation: legacyRoute.startLocation ?? "Cupertino, CA",
                difficulty: legacyRoute.difficulty ?? "balanced",
                skillIds: legacyRoute.prioritySkillIds
              })
            : undefined
          : legacyRoute;

      setState({
        ...parsed,
        latestRoute,
        progress,
        coachTip: buildCoachTip(getReadinessSnapshot({ ...parsed, progress }).topRecommendations)
      });
    } catch {
      setState(buildFreshState());
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const value = useMemo<AppStateContextValue>(() => {
    const readiness = getReadinessSnapshot(state);

    return {
      state,
      isPending,
      readiness,
      completeOnboarding(input) {
        startTransition(() => {
          setState(buildFreshState(input));
        });
      },
      logSession(input, aiSummary) {
        startTransition(() => {
          const session = createSessionRecord(input);
          const sessions = [{ ...session, aiSummary }, ...state.sessions];
          const progress = recomputeProgress(state.skills, sessions);
          const recommendations = getReadinessSnapshot({ ...state, sessions, progress }).topRecommendations;

          setState({
            ...state,
            sessions,
            progress,
            coachTip: buildCoachTip(recommendations),
            notifications: [
              `Logged ${input.durationMinutes} minutes in ${input.areaDriven}.`,
              `${recommendations[0]?.label ?? "Your next focus area"} is now the top recommendation.`,
              ...state.notifications
            ].slice(0, 5)
          });
        });
      },
      saveRoute(route) {
        startTransition(() => {
          setState({
            ...state,
            latestRoute: route,
            notifications: [
              `New ${route.estimatedMinutes}-minute route generated from ${route.startLocation}.`,
              ...state.notifications
            ].slice(0, 5)
          });
        });
      },
      resetDemo() {
        startTransition(() => {
          setState(buildFreshState());
        });
      }
    };
  }, [isPending, state]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error("useAppState must be used inside AppStateProvider");
  }

  return context;
}
