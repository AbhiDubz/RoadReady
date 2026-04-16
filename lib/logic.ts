import {
  AppState,
  CategoryCoverage,
  ParentCategorySummary,
  PracticeSession,
  ReadinessSnapshot,
  Recommendation,
  RoutePlan,
  RouteRequest,
  RouteStop,
  SessionInput,
  SkillInsight,
  SkillDefinition,
  SkillProgress,
  SkillStatus,
  SkillTrend,
  UserProfile
} from "@/lib/types";
import { getStateMetadataByCode } from "@/lib/mock-data";

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }

  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function daysSince(date?: string): number {
  if (!date) {
    return 999;
  }

  const then = new Date(date).getTime();
  const now = new Date("2026-04-14T12:00:00").getTime();
  return Math.max(0, Math.floor((now - then) / (1000 * 60 * 60 * 24)));
}

function daysUntil(date?: string): number | undefined {
  if (!date) {
    return undefined;
  }

  const then = new Date(date).getTime();
  const now = new Date("2026-04-14T12:00:00").getTime();
  return Math.ceil((then - now) / (1000 * 60 * 60 * 24));
}

function getSkillStatus(attemptsCount: number, averageRating: number, lastPracticedAt?: string): SkillStatus {
  if (attemptsCount === 0) {
    return "not_attempted";
  }

  if (attemptsCount >= 3 && averageRating >= 2.6 && daysSince(lastPracticedAt) <= 14) {
    return "confident";
  }

  return "needs_work";
}

export function recomputeProgress(
  skills: SkillDefinition[],
  sessions: PracticeSession[]
): SkillProgress[] {
  return skills.map((skill) => {
    const attempts = sessions
      .flatMap((session) =>
        session.practicedSkills
          .filter((entry) => entry.skillId === skill.id)
          .map((entry) => ({ date: session.date, rating: entry.rating }))
      )
      .sort((a, b) => a.date.localeCompare(b.date));

    const attemptsCount = attempts.length;
    const averageRating = average(attempts.map((attempt) => attempt.rating));
    const lastPracticedAt = attempts.at(-1)?.date;
    const recencyPenalty = Math.min(daysSince(lastPracticedAt) / 21, 1);
    const confidenceScore = Number(Math.max(0, Math.min(100, averageRating / 3 * 72 + attemptsCount * 9 - recencyPenalty * 20)).toFixed(0));

    return {
      skillId: skill.id,
      attemptsCount,
      averageRating,
      lastPracticedAt,
      confidenceScore,
      status: getSkillStatus(attemptsCount, averageRating, lastPracticedAt)
    };
  });
}

export function createSessionRecord(input: SessionInput): PracticeSession {
  return {
    id: `session-${Math.random().toString(36).slice(2, 8)}`,
    date: input.date,
    durationMinutes: input.durationMinutes,
    areaDriven: input.areaDriven,
    roadTypes: input.roadTypes,
    practicedSkills: input.skillRatings.map((entry) => ({
      skillId: entry.skillId,
      teenRating: entry.rating,
      rating: entry.rating
    })),
    notes: input.notes,
    parentComment: input.parentComment,
    weather: input.weather,
    trafficLevel: input.trafficLevel,
    conditions: input.conditions,
    reviewStatus: input.parentComment ? "reviewed" : "pending"
  };
}

export function getCategoryCoverage(
  skills: SkillDefinition[],
  progress: SkillProgress[]
): CategoryCoverage[] {
  const categories = [...new Set(skills.map((skill) => skill.category))];

  return categories.map((category) => {
    const skillsInCategory = skills.filter((skill) => skill.category === category);
    const progressInCategory = progress.filter((entry) =>
      skillsInCategory.some((skill) => skill.id === entry.skillId)
    );
    const attemptedPercent =
      (progressInCategory.filter((entry) => entry.attemptsCount > 0).length / skillsInCategory.length) * 100;
    const confidentPercent =
      (progressInCategory.filter((entry) => entry.status === "confident").length / skillsInCategory.length) * 100;
    const coverageScore = Number((0.5 * attemptedPercent + 0.5 * confidentPercent).toFixed(0));

    return {
      category,
      attemptedPercent: Number(attemptedPercent.toFixed(0)),
      confidentPercent: Number(confidentPercent.toFixed(0)),
      coverageScore
    };
  });
}

export function getParentCategorySummaries(
  skills: SkillDefinition[],
  progress: SkillProgress[]
): ParentCategorySummary[] {
  return getCategoryCoverage(skills, progress).map((entry) => {
    const categorySkills = skills.filter((skill) => skill.category === entry.category);
    const categoryProgress = progress.filter((item) => categorySkills.some((skill) => skill.id === item.skillId));
    const weakSkillsCount = categoryProgress.filter((item) => item.status !== "confident").length;
    const status = categoryProgress.every((item) => item.status === "confident")
      ? "confident"
      : categoryProgress.some((item) => item.attemptsCount > 0)
        ? "needs_work"
        : "not_attempted";

    return {
      category: entry.category,
      coveragePercent: entry.coverageScore,
      status,
      weakSkillsCount
    };
  });
}

export function getRecommendations(
  profile: UserProfile,
  skills: SkillDefinition[],
  progress: SkillProgress[]
): Recommendation[] {
  const targetDateBoost = profile.targetTestDate ? 10 : 0;

  return progress
    .map((entry) => {
      const skill = skills.find((item) => item.id === entry.skillId)!;
      const neverAttempted = entry.attemptsCount === 0 ? 40 : 0;
      const confidenceGap = Math.max(0, 3 - entry.averageRating) * 20;
      const recencyGap = Math.min(daysSince(entry.lastPracticedAt) * 2, 30);
      const testBoost = skill.requiredForTest ? 18 : 6;
      const priorityScore = Math.round(neverAttempted + confidenceGap + recencyGap + testBoost + targetDateBoost);

      const reasons: string[] = [];
      if (entry.attemptsCount === 0) {
        reasons.push("Never practiced yet");
      }
      if (entry.averageRating > 0 && entry.averageRating < 2.3) {
        reasons.push("Recent ratings are still low");
      }
      if (daysSince(entry.lastPracticedAt) > 10) {
        reasons.push(`Not practiced in ${daysSince(entry.lastPracticedAt)} days`);
      }
      if (skill.requiredForTest) {
        reasons.push("Important for the road test");
      }

      return {
        skillId: skill.id,
        label: skill.label,
        category: skill.category,
        priorityScore,
        reasons
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

export function getReadinessSnapshot(state: AppState): ReadinessSnapshot {
  const coverage = getCategoryCoverage(state.skills, state.progress);
  const categorySummaries = getParentCategorySummaries(state.skills, state.progress);
  const recommendations = getRecommendations(state.profile, state.skills, state.progress);
  const overdueSkills = state.progress.filter((entry) => daysSince(entry.lastPracticedAt) > 10);
  const totalHours = Number(
    (state.sessions.reduce((sum, session) => sum + session.durationMinutes, 0) / 60).toFixed(1)
  );
  const coverageAverage = average(coverage.map((entry) => entry.coverageScore));
  const criticalScore = average(
    state.progress
      .filter((entry) => state.skills.find((skill) => skill.id === entry.skillId)?.requiredForTest)
      .map((entry) => entry.confidenceScore)
  );
  const consistencyScore = Math.max(30, 100 - overdueSkills.length * 10);
  const readinessScore = Math.round(coverageAverage * 0.35 + criticalScore * 0.45 + consistencyScore * 0.2);
  const lastSessionDate = state.sessions[0]?.date;

  return {
    readinessScore,
    totalHours,
    overdueSkills,
    topRecommendations: recommendations.slice(0, 3),
    coverage,
    categorySummaries,
    lastSessionDate,
    targetTestCountdownDays: daysUntil(state.profile.targetTestDate)
  };
}

export function getSkillTrend(skillId: string, sessions: PracticeSession[]): SkillTrend {
  const ratings = sessions
    .flatMap((session) =>
      session.practicedSkills
        .filter((entry) => entry.skillId === skillId)
        .map((entry) => ({ date: session.date, rating: entry.rating }))
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((entry) => entry.rating);

  if (ratings.length < 2) {
    return "not_enough_data";
  }

  const recent = ratings.slice(-3);
  const delta = recent.at(-1)! - recent[0]!;

  if (delta >= 1) {
    return "improving";
  }

  if (delta <= -1) {
    return "declining";
  }

  return "stagnant";
}

export function getSkillInsights(state: AppState): SkillInsight[] {
  return state.skills.map((skill) => {
    const progress = state.progress.find((entry) => entry.skillId === skill.id);
    const parentComments = state.sessions
      .flatMap((session) =>
        session.practicedSkills
          .filter((entry) => entry.skillId === skill.id)
          .map((entry) => entry.parentComment)
          .filter((comment): comment is string => Boolean(comment))
      )
      .concat(
        state.sessions
          .filter(
            (session) =>
              session.parentComment &&
              session.practicedSkills.some((entry) => entry.skillId === skill.id)
          )
          .map((session) => session.parentComment)
      );

    return {
      skillId: skill.id,
      label: skill.label,
      category: skill.category,
      attemptsCount: progress?.attemptsCount ?? 0,
      averageRating: progress?.averageRating ?? 0,
      lastPracticedAt: progress?.lastPracticedAt,
      trend: getSkillTrend(skill.id, state.sessions),
      parentComments: [...new Set(parentComments)].slice(0, 3)
    };
  });
}

export function buildNotifications(state: AppState): string[] {
  const readiness = getReadinessSnapshot(state);
  const notes: string[] = [];
  const latestSession = state.sessions[0];
  const pendingReview = state.sessions.find((session) => session.reviewStatus === "pending");
  const basicControlSummary = readiness.categorySummaries.find((entry) => entry.category === "Basic Control");

  if (!latestSession || daysSince(latestSession.date) > 7) {
    notes.push("No session has been logged in the last 7 days.");
  }

  if (pendingReview) {
    notes.push(`A session from ${pendingReview.date} is waiting for parent review.`);
  }

  if (state.planning.requireRouteApproval && state.latestRoute?.approvalStatus === "pending") {
    notes.push("A new route is waiting for parent approval.");
  }

  if (readiness.overdueSkills[0]) {
    const overdueSkill = state.skills.find((skill) => skill.id === readiness.overdueSkills[0]?.skillId);
    if (overdueSkill) {
      notes.push(`${overdueSkill.label} has not been practiced recently.`);
    }
  }

  if (basicControlSummary?.coveragePercent === 100) {
    notes.push("Milestone reached: all Basic Control skills have been practiced.");
  }

  if (readiness.targetTestCountdownDays !== undefined) {
    if (readiness.targetTestCountdownDays >= 0) {
      notes.push(`${readiness.targetTestCountdownDays} days remain until the target test date.`);
    } else {
      notes.push("The target test date has passed. Review the plan and set a new date.");
    }
  }

  return notes.slice(0, 5);
}

type RouteLibraryEntry = {
  title: string;
  address: string;
  reason: string;
  tag: string;
  latitude: number;
  longitude: number;
};

type LocationAnchor = {
  city: string;
  stateCode: string;
  latitude: number;
  longitude: number;
};

function parseCoordinateLocation(startLocation: string) {
  const match = startLocation.trim().match(
    /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/
  );

  if (!match) {
    return null;
  }

  const latitude = Number(match[1]);
  const longitude = Number(match[2]);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

const routeTagAliases: Record<string, string> = {
  "quiet-block": "curbside",
  "suburban-evening": "well-lit-loop",
  "stop-controlled": "residential-grid",
  "gentle-stop-zone": "residential-grid",
  "school-zone": "residential-grid",
  "curved-road": "arterial"
};

function buildApproximateFallbackReason(skillLabel: string, baseReason: string) {
  return `${baseReason} This fallback stop is only an approximate practice area for ${skillLabel.toLowerCase()}, so preview it in Maps before driving it.`;
}

function buildGenericRouteLibrary(anchor: LocationAnchor): Record<string, RouteLibraryEntry> {
  return {
    "highway-on-ramp": {
      title: `${anchor.city} highway merge rep`,
      address: `Major on-ramp near ${anchor.city}, ${anchor.stateCode}`,
      reason: "Provides a controlled merge opportunity for acceleration-lane practice.",
      tag: "highway-on-ramp",
      latitude: anchor.latitude + 0.018,
      longitude: anchor.longitude + 0.02
    },
    "freeway-connector": {
      title: `${anchor.city} connector segment`,
      address: `Short freeway connector near ${anchor.city}, ${anchor.stateCode}`,
      reason: "Adds a second merge and freeway positioning repetition.",
      tag: "freeway-connector",
      latitude: anchor.latitude + 0.026,
      longitude: anchor.longitude - 0.012
    },
    arterial: {
      title: `${anchor.city} arterial segment`,
      address: `Multi-lane arterial near ${anchor.city}, ${anchor.stateCode}`,
      reason: "Useful for lane centering and steady speed control.",
      tag: "arterial",
      latitude: anchor.latitude + 0.008,
      longitude: anchor.longitude + 0.016
    },
    "busy-intersection": {
      title: `${anchor.city} intersection practice`,
      address: `Signalized intersection near downtown ${anchor.city}, ${anchor.stateCode}`,
      reason: "Targets gap judgment and left-turn timing.",
      tag: "busy-intersection",
      latitude: anchor.latitude + 0.011,
      longitude: anchor.longitude - 0.008
    },
    "signalized-left": {
      title: `${anchor.city} second turn rep`,
      address: `Secondary turn intersection near ${anchor.city}, ${anchor.stateCode}`,
      reason: "Adds another left-turn repetition in the same drive.",
      tag: "signalized-left",
      latitude: anchor.latitude - 0.006,
      longitude: anchor.longitude + 0.013
    },
    "multi-lane-arterial": {
      title: `${anchor.city} lane-change stretch`,
      address: `Three-lane corridor near ${anchor.city}, ${anchor.stateCode}`,
      reason: "Builds mirror-signal-blind-spot lane-change consistency.",
      tag: "multi-lane-arterial",
      latitude: anchor.latitude - 0.013,
      longitude: anchor.longitude + 0.019
    },
    boulevard: {
      title: `${anchor.city} return boulevard`,
      address: `Broad return road near ${anchor.city}, ${anchor.stateCode}`,
      reason: "Lets the learner repeat lane positioning on the way back.",
      tag: "boulevard",
      latitude: anchor.latitude - 0.017,
      longitude: anchor.longitude - 0.015
    },
    "residential-grid": {
      title: `${anchor.city} neighborhood stop loop`,
      address: `Residential stop-sign grid near ${anchor.city}, ${anchor.stateCode}`,
      reason: "Calmer streets for repeated stop-sign practice.",
      tag: "residential-grid",
      latitude: anchor.latitude + 0.004,
      longitude: anchor.longitude - 0.02
    },
    curbside: {
      title: `${anchor.city} curbside parking block`,
      address: `Quiet curb near ${anchor.city}, ${anchor.stateCode}`,
      reason: "Useful for parallel parking setup and curb approach repetition.",
      tag: "curbside",
      latitude: anchor.latitude - 0.01,
      longitude: anchor.longitude - 0.01
    },
    "well-lit-loop": {
      title: `${anchor.city} evening visibility loop`,
      address: `Well-lit collectors near ${anchor.city}, ${anchor.stateCode}`,
      reason: "A safe evening loop for building night-driving confidence.",
      tag: "well-lit-loop",
      latitude: anchor.latitude + 0.009,
      longitude: anchor.longitude - 0.018
    }
  };
}

function getRouteLibrary(anchor: LocationAnchor) {
  return buildGenericRouteLibrary(anchor);
}

const stateNameToCode = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY"
} as const satisfies Record<string, string>;

const cityCoordinateLibrary: Record<string, LocationAnchor> = {
  "sunnyvale,ca": { city: "Sunnyvale", stateCode: "CA", latitude: 37.3688, longitude: -122.0363 },
  "santa clara,ca": { city: "Santa Clara", stateCode: "CA", latitude: 37.3541, longitude: -121.9552 },
  "mountain view,ca": { city: "Mountain View", stateCode: "CA", latitude: 37.3861, longitude: -122.0839 },
  "cupertino,ca": { city: "Cupertino", stateCode: "CA", latitude: 37.323, longitude: -122.0322 },
  "brooklyn,ny": { city: "Brooklyn", stateCode: "NY", latitude: 40.6782, longitude: -73.9442 },
  "queens,ny": { city: "Queens", stateCode: "NY", latitude: 40.7282, longitude: -73.7949 },
  "manhattan,ny": { city: "Manhattan", stateCode: "NY", latitude: 40.7831, longitude: -73.9712 },
  "new york,ny": { city: "New York", stateCode: "NY", latitude: 40.7128, longitude: -74.006 },
  "seattle,wa": { city: "Seattle", stateCode: "WA", latitude: 47.6062, longitude: -122.3321 },
  "bothell,wa": { city: "Bothell", stateCode: "WA", latitude: 47.7607, longitude: -122.2051 },
  "bellevue,wa": { city: "Bellevue", stateCode: "WA", latitude: 47.6101, longitude: -122.2015 },
  "redmond,wa": { city: "Redmond", stateCode: "WA", latitude: 47.674, longitude: -122.1215 },
  "everett,wa": { city: "Everett", stateCode: "WA", latitude: 47.9789, longitude: -122.2021 }
};

function inferStateCodeFromLocation(startLocation: string, fallbackStateCode: string) {
  const normalized = startLocation.toLowerCase();

  const directCodeMatch = normalized.match(/\b([A-Z]{2})\b/i)?.[1]?.toUpperCase();
  if (directCodeMatch && getStateMetadataByCode(directCodeMatch).code === directCodeMatch) {
    return directCodeMatch;
  }

  for (const [stateName, stateCode] of Object.entries(stateNameToCode)) {
    if (normalized.includes(stateName)) {
      return stateCode;
    }
  }

  return fallbackStateCode;
}

function extractCityName(startLocation: string, fallbackCity: string) {
  const firstPart = startLocation
    .split(",")[0]
    ?.trim()
    .replace(/\s+/g, " ");

  return firstPart || fallbackCity;
}

function geocodeStartLocation(startLocation: string, fallbackStateCode: string): LocationAnchor {
  const explicitCoordinates = parseCoordinateLocation(startLocation);
  if (explicitCoordinates) {
    const state = getStateMetadataByCode(fallbackStateCode);
    return {
      city: state.defaultCity,
      stateCode: fallbackStateCode,
      latitude: explicitCoordinates.latitude,
      longitude: explicitCoordinates.longitude
    };
  }

  const stateCode = inferStateCodeFromLocation(startLocation, fallbackStateCode);
  const state = getStateMetadataByCode(stateCode);
  const city = extractCityName(startLocation, state.defaultCity);
  const normalizedKey = `${city.toLowerCase()},${stateCode.toLowerCase()}`;
  const directMatch = cityCoordinateLibrary[normalizedKey];

  if (directMatch) {
    return directMatch;
  }

  const statewideMatch = Object.values(cityCoordinateLibrary).find(
    (entry) => entry.stateCode === stateCode && entry.city.toLowerCase() === city.toLowerCase()
  );
  if (statewideMatch) {
    return statewideMatch;
  }

  return {
    city,
    stateCode,
    latitude: state.latitude,
    longitude: state.longitude
  };
}

export function generateRoutePlan(
  skills: SkillDefinition[],
  recommendations: Recommendation[],
  request: RouteRequest
): RoutePlan {
  const fallbackStateCode = skills[0]?.stateCode ?? "CA";
  const selectedSkills = skills.filter((skill) => request.skillIds.includes(skill.id));
  const difficultyMinutes = request.difficulty === "gentle" ? 18 : request.difficulty === "stretch" ? 30 : 24;
  const startPoint =
    typeof request.startLatitude === "number" &&
    Number.isFinite(request.startLatitude) &&
    typeof request.startLongitude === "number" &&
    Number.isFinite(request.startLongitude)
      ? {
          city: extractCityName(request.startLocation, getStateMetadataByCode(fallbackStateCode).defaultCity),
          stateCode: inferStateCodeFromLocation(request.startLocation, fallbackStateCode),
          latitude: request.startLatitude,
          longitude: request.startLongitude
        }
      : geocodeStartLocation(request.startLocation, fallbackStateCode);
  const routeLibrary = getRouteLibrary(startPoint);
  const segments: RouteStop[] = selectedSkills.slice(0, 4).map((skill, index) => {
    const primaryTag = skill.routeTags.map((tag) => routeTagAliases[tag] ?? tag)[0] ?? "arterial";
    const segment = routeLibrary[primaryTag] ?? {
      title: `Practice stop ${index + 1}`,
      address: `${request.startLocation}`,
      reason: "Selected to reinforce the current priority skill mix.",
      tag: primaryTag,
      latitude: startPoint.latitude + (index + 1) * 0.005,
      longitude: startPoint.longitude + (index % 2 === 0 ? 0.007 : -0.006)
    };

    return {
      id: `${skill.id}-${index}`,
      title: `Approximate ${skill.label} practice area`,
      address: segment.address,
      reason: buildApproximateFallbackReason(skill.label, segment.reason),
      tag: primaryTag,
      focusSkillLabels: [skill.label],
      etaMinutes: 5 + index * 6,
      latitude: segment.latitude + index * 0.002,
      longitude: segment.longitude + (index % 2 === 0 ? 0.002 : -0.002),
      source: "fallback",
      verificationStatus: "approximate"
    };
  });

  const recommendationLabels = recommendations
    .filter((entry) => request.skillIds.includes(entry.skillId))
    .map((entry) => entry.label.toLowerCase());

  return {
    id: `route-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    startLocation: request.startLocation,
    startLatitude: startPoint.latitude,
    startLongitude: startPoint.longitude,
    estimatedMinutes: difficultyMinutes,
    difficulty: request.difficulty,
    prioritySkillIds: request.skillIds,
    explanation: `This loop starts near ${request.startLocation} and focuses on ${recommendationLabels.join(
      ", "
    )}. It balances realistic reps with lower-risk segments so the learner can repeat weak skills without an overly long drive.`,
    segments,
    generationSource: "rules-based",
    routingSource: "straight-line",
    warnings: [
      "RoadReady could not confirm a full road-mapped route for this start point, so this fallback loop uses approximate practice areas. Open each stop in Maps before using it for a skill-specific drive."
    ],
    approvalStatus: "pending"
  };
}

export function isValidRoutePlan(route?: Partial<RoutePlan>): route is RoutePlan {
  if (!route) {
    return false;
  }

  const validStart =
    typeof route.startLatitude === "number" &&
    Number.isFinite(route.startLatitude) &&
    typeof route.startLongitude === "number" &&
    Number.isFinite(route.startLongitude);

  const validSegments =
    Array.isArray(route.segments) &&
    route.segments.every(
      (segment) =>
        typeof segment.latitude === "number" &&
        Number.isFinite(segment.latitude) &&
        typeof segment.longitude === "number" &&
        Number.isFinite(segment.longitude)
    );

  return validStart && validSegments;
}

export function buildCoachTip(recommendations: Recommendation[]): string {
  const top = recommendations[0];
  const second = recommendations[1];

  if (!top) {
    return "Keep logging drives to unlock a sharper next-practice recommendation.";
  }

  if (!second) {
    return `Next session: focus on ${top.label.toLowerCase()} and give yourself at least three clean repetitions.`;
  }

  return `Your best next session would pair ${top.label.toLowerCase()} with ${second.label.toLowerCase()} so you can work one stress point and one supporting skill in the same drive.`;
}

export function buildSessionSummary(
  skills: SkillDefinition[],
  input: SessionInput
): string {
  const sorted = [...input.skillRatings].sort((a, b) => b.rating - a.rating);
  const strengths = sorted
    .filter((entry) => entry.rating >= 3)
    .map((entry) => skills.find((skill) => skill.id === entry.skillId)?.label.toLowerCase())
    .filter(Boolean);
  const weakSpots = sorted
    .filter((entry) => entry.rating <= 2)
    .map((entry) => skills.find((skill) => skill.id === entry.skillId)?.label.toLowerCase())
    .filter(Boolean);

  const strengthsText = strengths.length ? strengths.join(" and ") : "basic comfort behind the wheel";
  const weakText = weakSpots.length ? weakSpots.join(" and ") : "building consistency";

  return `This session showed solid progress with ${strengthsText}, while ${weakText} still need more repetition. Keep the next practice short and intentional so confidence builds without adding too much pressure.`;
}
