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
  buildNotifications,
  createSessionRecord,
  generateRoutePlan,
  getReadinessSnapshot,
  getRecommendations,
  isValidRoutePlan,
  recomputeProgress
} from "@/lib/logic";
import {
  buildOwnedHouseholdInviteCode,
  normalizeHouseholdInviteCode
} from "@/lib/household";
import { createDemoState, getChecklistForState } from "@/lib/mock-data";
import {
  AuthAccount,
  AppState,
  GeneratedContentSource,
  OnboardingInput,
  PracticeSession,
  PracticePlanningState,
  RouteApprovalStatus,
  RoutePlan,
  SessionInput,
  SessionReviewInput,
  UserProfile
} from "@/lib/types";

const DEMO_ACCOUNT_EMAIL = "demo@roadready.local";

type HouseholdLink = {
  householdInviteCode?: string;
  householdOwnerId?: string;
};

interface AppStateContextValue {
  account: AuthAccount;
  state: AppState;
  isPending: boolean;
  readiness: ReturnType<typeof getReadinessSnapshot>;
  completeOnboarding: (input: OnboardingInput) => Promise<void>;
  logSession: (input: SessionInput, aiSummary?: string, summarySource?: GeneratedContentSource) => void;
  reviewSession: (input: SessionReviewInput) => void;
  saveRoute: (route: RoutePlan) => void;
  reviewRoute: (status: RouteApprovalStatus, note?: string) => void;
  updatePlanning: (next: Partial<PracticePlanningState>) => void;
  resetDemo: () => void;
}

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);

function getAccountStateKey(accountId: string) {
  return `roadready-demo-state:${accountId}`;
}

function getAccountLinkKey(accountId: string) {
  return `roadready-account-link:${accountId}`;
}

function getHouseholdStateKey(ownerTeenId: string) {
  return `roadready-household-state:${ownerTeenId}`;
}

function getDefaultPlanning(): PracticePlanningState {
  return {
    selectedSkillIds: [],
    preferredDifficulty: "balanced",
    preferredSessionDurationMinutes: 45,
    requireParentApprovalForConfident: false,
    requireRouteApproval: true
  };
}

function readStoredLink(accountId: string): HouseholdLink {
  const raw = window.localStorage.getItem(getAccountLinkKey(accountId));

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as HouseholdLink;
    return {
      householdInviteCode: normalizeHouseholdInviteCode(parsed.householdInviteCode ?? "") || undefined,
      householdOwnerId: parsed.householdOwnerId ?? undefined
    };
  } catch {
    return {};
  }
}

function writeStoredLink(accountId: string, link: HouseholdLink) {
  if (!link.householdInviteCode || !link.householdOwnerId) {
    window.localStorage.removeItem(getAccountLinkKey(accountId));
    return;
  }

  window.localStorage.setItem(
    getAccountLinkKey(accountId),
    JSON.stringify({
      householdInviteCode: link.householdInviteCode,
      householdOwnerId: link.householdOwnerId
    })
  );
}

function withDerivedState(baseState: AppState): AppState {
  const planning = {
    ...getDefaultPlanning(),
    ...baseState.planning
  };
  const progress = recomputeProgress(baseState.skills, baseState.sessions);
  const readiness = getReadinessSnapshot({
    ...baseState,
    planning,
    progress
  });

  return {
    ...baseState,
    planning,
    progress,
    coachTip: buildCoachTip(readiness.topRecommendations),
    notifications: buildNotifications({
      ...baseState,
      planning,
      progress
    })
  };
}

function normalizeSession(session: PracticeSession): PracticeSession {
  return {
    ...session,
    parentComment: session.parentComment ?? "",
    reviewStatus: session.reviewStatus ?? (session.parentComment ? "reviewed" : "pending"),
    summarySource: session.aiSummary ? session.summarySource ?? "rules-based" : undefined,
    practicedSkills: session.practicedSkills.map((entry) => ({
      ...entry,
      teenRating: entry.teenRating ?? entry.rating,
      rating: entry.rating ?? entry.teenRating ?? 1
    }))
  };
}

function normalizeLegacyRouteCopy(route: RoutePlan, skills: AppState["skills"]): RoutePlan {
  const hasLegacyMalformedExplanation =
    route.explanation?.includes("malformed and incomplete") ||
    route.explanation?.includes("No specific route guidance explanation was provided");
  const hasLegacyMalformedCoachNote =
    route.coachNote?.includes("No coach note was available due to the malformed output");

  if (!hasLegacyMalformedExplanation && !hasLegacyMalformedCoachNote) {
    return route;
  }

  const skillLabels = route.prioritySkillIds
    .map((skillId) => skills.find((skill) => skill.id === skillId)?.label.toLowerCase())
    .filter((label): label is string => Boolean(label));
  const focusSummary = skillLabels.length ? skillLabels.join(", ") : "the selected priority skills";

  return {
    ...route,
    explanation: hasLegacyMalformedExplanation
      ? `This route focuses on ${focusSummary} and keeps the drive compact enough to repeat the hardest section while the learner is still fresh.`
      : route.explanation,
    coachNote: hasLegacyMalformedCoachNote
      ? "Preview the turn points in Maps first and repeat the hardest maneuver only if the learner still feels calm and precise."
      : route.coachNote
  };
}

function buildFreshState(account: AuthAccount): AppState {
  const seeded = withDerivedState(createDemoState());
  const isDemoAccount = account.email === DEMO_ACCOUNT_EMAIL;

  if (isDemoAccount) {
    return {
      ...seeded,
      profile: {
        ...seeded.profile,
        id: account.id,
        householdOwnerId: account.id,
        householdInviteCode: buildOwnedHouseholdInviteCode(account.id),
        linkedTeenName: seeded.profile.name
      }
    };
  }

  const learnerName = account.role === "teen" ? account.name : "Teen learner";

  return withDerivedState({
    ...seeded,
    profile: {
      ...seeded.profile,
      id: account.id,
      name: learnerName,
      email: account.role === "teen" ? account.email : undefined,
      age: 16,
      role: "teen",
      householdName: undefined,
      householdInviteCode: account.role === "teen" ? buildOwnedHouseholdInviteCode(account.id) : undefined,
      householdOwnerId: account.role === "teen" ? account.id : undefined,
      linkedTeenName: learnerName,
      completedOnboarding: false
    },
    sessions: [],
    latestRoute: undefined,
    planning: getDefaultPlanning(),
    notifications: []
  });
}

function normalizeStateForViewer(
  account: AuthAccount,
  parsed: AppState,
  link: HouseholdLink
): AppState {
  const teenOwnedInviteCode = account.role === "teen" ? buildOwnedHouseholdInviteCode(account.id) : undefined;
  const householdOwnerId =
    account.role === "teen" ? account.id : parsed.profile.householdOwnerId ?? link.householdOwnerId;
  const householdInviteCode =
    teenOwnedInviteCode ||
    normalizeHouseholdInviteCode(link.householdInviteCode ?? "") ||
    normalizeHouseholdInviteCode(parsed.profile.householdInviteCode ?? "") ||
    (householdOwnerId ? buildOwnedHouseholdInviteCode(householdOwnerId) : undefined);

  const shouldUseAccountIdentityForTeen =
    account.role === "teen" &&
    (!parsed.profile.completedOnboarding ||
      !parsed.profile.name ||
      parsed.profile.name === "Maya Chen" ||
      parsed.profile.id !== account.id);

  const normalizedProfile: UserProfile = {
    ...parsed.profile,
    id: account.role === "teen" ? account.id : parsed.profile.id,
    name: shouldUseAccountIdentityForTeen ? account.name : parsed.profile.name,
    role: "teen",
    email: account.role === "teen" ? parsed.profile.email ?? account.email : undefined,
    linkedTeenName:
      account.role === "teen"
        ? shouldUseAccountIdentityForTeen
          ? account.name
          : parsed.profile.linkedTeenName ?? parsed.profile.name
        : parsed.profile.linkedTeenName ?? parsed.profile.name,
    householdInviteCode,
    householdOwnerId
  };

  return withDerivedState({
    ...parsed,
    profile: normalizedProfile,
    sessions: parsed.sessions.map((session) => normalizeSession(session as PracticeSession)),
    latestRoute:
      parsed.latestRoute && !isValidRoutePlan(parsed.latestRoute)
        ? undefined
        : parsed.latestRoute
          ? {
              ...normalizeLegacyRouteCopy(parsed.latestRoute, parsed.skills),
              approvalStatus: parsed.latestRoute.approvalStatus ?? "pending"
            }
          : undefined,
    planning: {
      ...getDefaultPlanning(),
      ...parsed.planning
    }
  });
}

function buildStateFromOnboarding(
  account: AuthAccount,
  input: OnboardingInput,
  sourceState: AppState,
  link: Required<HouseholdLink>
): AppState {
  const profile: UserProfile = {
    id: link.householdOwnerId,
    name: sourceState.profile.name || input.name,
    email: sourceState.profile.email || input.email,
    role: "teen",
    age: input.age,
    stateCode: input.stateCode,
    experienceLevel: input.experienceLevel,
    targetTestDate: input.targetTestDate,
    householdName: input.householdName || sourceState.profile.householdName,
    householdInviteCode: link.householdInviteCode,
    householdOwnerId: link.householdOwnerId,
    linkedTeenName: sourceState.profile.name || input.name,
    completedOnboarding: true
  };

  const stateChanged = sourceState.profile.stateCode !== input.stateCode;
  const skills = stateChanged ? getChecklistForState(input.stateCode) : sourceState.skills;
  const sessions = stateChanged ? [] : sourceState.sessions;
  const latestRoute =
    stateChanged || sourceState.latestRoute?.approvalStatus === "needs_changes"
      ? undefined
      : sourceState.latestRoute;
  const planning = {
    ...getDefaultPlanning(),
    ...sourceState.planning,
    selectedSkillIds:
      sourceState.planning.selectedSkillIds.length > 0
        ? sourceState.planning.selectedSkillIds
        : sourceState.progress
            .filter((entry) => entry.status !== "confident")
            .slice(0, 3)
            .map((entry) => entry.skillId)
  };

  const nextState = withDerivedState({
    profile,
    skills,
    progress: [],
    sessions,
    latestRoute,
    planning,
    coachTip: "",
    notifications: []
  });

  return {
    ...nextState,
    notifications: [
      account.role === "parent"
        ? `Linked to ${profile.name}'s plan with invite code ${link.householdInviteCode}.`
        : `Your household invite code is ${link.householdInviteCode}. Share it with a parent account to link access.`,
      ...nextState.notifications
    ].slice(0, 5)
  };
}

async function resolveHouseholdLink(
  account: AuthAccount,
  input: OnboardingInput
): Promise<Required<HouseholdLink>> {
  if (account.role === "teen") {
    return {
      householdOwnerId: account.id,
      householdInviteCode: buildOwnedHouseholdInviteCode(account.id)
    };
  }

  const inviteCode = normalizeHouseholdInviteCode(input.householdInviteCode ?? "");

  if (!inviteCode) {
    throw new Error("Enter the teen invite code to link this parent account.");
  }

  const response = await fetch("/api/households/resolve", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ inviteCode })
  });

  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
    ownerTeenId?: string;
    inviteCode?: string;
  };

  if (!response.ok || !payload.ownerTeenId || !payload.inviteCode) {
    throw new Error(payload.message ?? "Unable to link that household code yet.");
  }

  return {
    householdOwnerId: payload.ownerTeenId,
    householdInviteCode: payload.inviteCode
  };
}

export function AppStateProvider({ account, children }: { account: AuthAccount; children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => buildFreshState(account));
  const [isHydrated, setIsHydrated] = useState(false);
  const [link, setLink] = useState<HouseholdLink>({});
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const storedLink = readStoredLink(account.id);
    const storedState = storedLink.householdOwnerId
      ? window.localStorage.getItem(getHouseholdStateKey(storedLink.householdOwnerId))
      : window.localStorage.getItem(getAccountStateKey(account.id));

    if (!storedState) {
      const freshState = buildFreshState(account);
      setLink({
        householdInviteCode: freshState.profile.householdInviteCode,
        householdOwnerId: freshState.profile.householdOwnerId
      });
      setState(freshState);
      setIsHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(storedState) as AppState;
      const normalized = normalizeStateForViewer(account, parsed, storedLink);
      const nextLink = {
        householdInviteCode: normalized.profile.householdInviteCode,
        householdOwnerId: normalized.profile.householdOwnerId
      };

      setLink(nextLink);
      writeStoredLink(account.id, nextLink);
      setState(normalized);
    } catch {
      const freshState = buildFreshState(account);
      setLink({
        householdInviteCode: freshState.profile.householdInviteCode,
        householdOwnerId: freshState.profile.householdOwnerId
      });
      setState(freshState);
    }

    setIsHydrated(true);
  }, [account]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.localStorage.setItem(getAccountStateKey(account.id), JSON.stringify(state));

    if (link.householdOwnerId) {
      window.localStorage.setItem(getHouseholdStateKey(link.householdOwnerId), JSON.stringify(state));
    }

    writeStoredLink(account.id, {
      householdInviteCode: state.profile.householdInviteCode,
      householdOwnerId: state.profile.householdOwnerId
    });
  }, [account.id, isHydrated, link.householdOwnerId, state]);

  const value = useMemo<AppStateContextValue>(() => {
    const readiness = getReadinessSnapshot(state);

    return {
      account,
      state,
      isPending,
      readiness,
      async completeOnboarding(input) {
        const resolvedLink = await resolveHouseholdLink(account, input);
        const sourceRaw =
          window.localStorage.getItem(getHouseholdStateKey(resolvedLink.householdOwnerId)) ??
          window.localStorage.getItem(getAccountStateKey(account.id));
        const sourceState = sourceRaw
          ? normalizeStateForViewer(account, JSON.parse(sourceRaw) as AppState, resolvedLink)
          : buildFreshState(account);

        startTransition(() => {
          setLink(resolvedLink);
          setState(buildStateFromOnboarding(account, input, sourceState, resolvedLink));
        });
      },
      logSession(input, aiSummary, summarySource) {
        startTransition(() => {
          const session = {
            ...createSessionRecord(input),
            aiSummary,
            summarySource
          };
          const sessions = [session, ...state.sessions].sort((a, b) => b.date.localeCompare(a.date));
          const nextState = withDerivedState({
            ...state,
            sessions
          });

          setState({
            ...nextState,
            notifications: [
              `Logged ${input.durationMinutes} minutes in ${input.areaDriven}.`,
              ...nextState.notifications
            ].slice(0, 5)
          });
        });
      },
      reviewSession(input) {
        startTransition(() => {
          const sessions = state.sessions.map((session) => {
            if (session.id !== input.sessionId) {
              return session;
            }

            return {
              ...session,
              parentComment: input.parentComment,
              reviewStatus: input.reviewStatus,
              reviewedAt: new Date().toISOString(),
              reviewedByName: account.name,
              verifiedAt: input.reviewStatus === "verified" ? new Date().toISOString() : session.verifiedAt,
              verifiedByName: input.reviewStatus === "verified" ? account.name : session.verifiedByName,
              practicedSkills: session.practicedSkills.map((entry) => {
                const override = input.skillOverrides[entry.skillId];
                const nextComment = input.skillComments[entry.skillId];

                return {
                  ...entry,
                  parentOverrideRating: override ?? entry.parentOverrideRating,
                  rating: override ?? entry.teenRating,
                  parentComment: nextComment ?? entry.parentComment
                };
              })
            };
          });
          const nextState = withDerivedState({
            ...state,
            sessions
          });

          setState({
            ...nextState,
            notifications: [
              input.reviewStatus === "verified"
                ? "Session verified and skill trends refreshed."
                : "Session review saved for the learner.",
              ...nextState.notifications
            ].slice(0, 5)
          });
        });
      },
      saveRoute(route) {
        startTransition(() => {
          const approvalStatus =
            state.planning.requireRouteApproval
              ? "pending"
              : account.role === "parent"
                ? "approved"
                : route.approvalStatus ?? "approved";
          const nextRoute: RoutePlan = {
            ...route,
            approvalStatus,
            approvedAt: approvalStatus === "approved" ? new Date().toISOString() : undefined,
            approvedByName: approvalStatus === "approved" ? account.name : undefined
          };
          const nextState = withDerivedState({
            ...state,
            latestRoute: nextRoute
          });

          setState({
            ...nextState,
            notifications: [
              approvalStatus === "pending"
                ? "New route generated and waiting for parent approval."
                : "New route generated and ready to use.",
              ...nextState.notifications
            ].slice(0, 5)
          });
        });
      },
      reviewRoute(status, note) {
        if (!state.latestRoute) {
          return;
        }

        startTransition(() => {
          const nextState = withDerivedState({
            ...state,
            latestRoute: {
              ...state.latestRoute!,
              approvalStatus: status,
              approvalNote: note || undefined,
              approvedAt: status === "approved" ? new Date().toISOString() : undefined,
              approvedByName: status === "approved" ? account.name : undefined
            }
          });

          setState({
            ...nextState,
            notifications: [
              status === "approved"
                ? "Route approved for the next drive."
                : status === "needs_changes"
                  ? "Route sent back for a safer or easier revision."
                  : "Route was rejected and removed from the next plan.",
              ...nextState.notifications
            ].slice(0, 5)
          });
        });
      },
      updatePlanning(next) {
        startTransition(() => {
          setState((current) =>
            withDerivedState({
              ...current,
              planning: {
                ...current.planning,
                ...next
              }
            })
          );
        });
      },
      resetDemo() {
        startTransition(() => {
          const freshState = buildFreshState(account);
          setLink({
            householdInviteCode: freshState.profile.householdInviteCode,
            householdOwnerId: freshState.profile.householdOwnerId
          });
          setState(freshState);
        });
      }
    };
  }, [account, isPending, state]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error("useAppState must be used inside AppStateProvider");
  }

  return context;
}
