import {
  Recommendation,
  RouteCoordinate,
  RouteDirectionStep,
  RouteLeg,
  RoutePlan,
  RouteRequest,
  RouteStop,
  SkillDefinition
} from "@/lib/types";
import { generateStructuredObject } from "@/lib/openai";

export class RouteGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RouteGenerationError";
  }
}

type SuggestedStop = {
  title: string;
  searchQuery: string;
  reason: string;
  tag: string;
  alternateQueries?: string[];
  skillId?: string;
  skillLabel?: string;
  source?: "ai" | "heuristic";
};

type RouteGuidance = {
  coachNote: string;
  explanation: string;
};

type GeocodeResult = {
  latitude: number;
  longitude: number;
  address: string;
};

type OsrmRouteResponse = {
  code: string;
  routes?: Array<{
    geometry?: {
      coordinates?: [number, number][];
    };
    legs?: Array<{
      distance: number;
      duration: number;
      steps?: Array<{
        distance: number;
        duration: number;
        name: string;
        maneuver?: {
          type?: string;
          modifier?: string;
        };
      }>;
    }>;
  }>;
};

type OsrmNearestResponse = {
  code: string;
  waypoints?: Array<{
    location?: [number, number];
  }>;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  center?: {
    lat: number;
    lon: number;
  };
  tags?: Record<string, string>;
};

type FeatureMatch = {
  point: Pick<GeocodeResult, "latitude" | "longitude">;
  addressHint?: string;
  verificationStatus: "verified" | "approximate";
};

type RoadWay = OverpassElement & { type: "way"; nodes: number[] };

type RoadTopology = {
  nodeElements: Map<number, OverpassElement & { type: "node"; lat: number; lon: number }>;
  roadWays: RoadWay[];
  waysById: Map<number, RoadWay>;
  wayIdsByNode: Map<number, Set<number>>;
};

type ScoredFeatureCandidate = FeatureMatch & {
  score: number;
};

type TurnDirection = "forward" | "backward";

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

  return {
    latitude,
    longitude,
    address: startLocation
  } satisfies GeocodeResult;
}

const routeTagAliases: Record<string, string> = {
  "quiet-block": "curbside",
  "suburban-evening": "well-lit-loop",
  "stop-controlled": "residential-grid",
  "gentle-stop-zone": "residential-grid",
  "school-zone": "residential-grid",
  "curved-road": "arterial"
};

const stopDescriptors: Record<
  string,
  { title: string; searchHint: string; reason: string }
> = {
  "highway-on-ramp": {
    title: "Highway merge practice",
    searchHint: "public highway on-ramp",
    reason: "Builds acceleration-lane confidence and merge timing."
  },
  "freeway-connector": {
    title: "Freeway connector segment",
    searchHint: "short freeway connector",
    reason: "Adds another higher-speed positioning rep without making the route too long."
  },
  arterial: {
    title: "Arterial road segment",
    searchHint: "multi-lane arterial road",
    reason: "Useful for lane centering and steady speed control."
  },
  "busy-intersection": {
    title: "Signalized turn practice",
    searchHint: "signalized intersection",
    reason: "Targets gap judgment and smoother turn decisions."
  },
  "signalized-left": {
    title: "Second left-turn rep",
    searchHint: "left-turn intersection",
    reason: "Adds another repeatable turn decision in the same drive."
  },
  "multi-lane-arterial": {
    title: "Lane-change segment",
    searchHint: "multi-lane road",
    reason: "Good for mirror-signal-blind-spot lane-change reps."
  },
  boulevard: {
    title: "Return boulevard",
    searchHint: "boulevard or broad collector road",
    reason: "Lets the learner repeat lane positioning while returning."
  },
  "residential-grid": {
    title: "Residential stop practice",
    searchHint: "residential street grid with stop signs",
    reason: "Good for lower-speed stop-sign repetitions."
  },
  curbside: {
    title: "Curbside parking practice",
    searchHint: "quiet residential street with curb parking",
    reason: "Useful for repeated parallel-parking setup attempts."
  },
  "well-lit-loop": {
    title: "Evening visibility practice",
    searchHint: "well-lit main street or downtown road",
    reason: "A lower-stress evening segment with better visibility."
  }
};

const ROUTE_STOP_SUGGESTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    stops: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          searchQuery: { type: "string" },
          reason: { type: "string" },
          tag: { type: "string" },
          alternateQueries: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["title", "searchQuery", "reason", "tag"]
      }
    }
  },
  required: ["stops"]
} as const;

const ROUTE_GUIDANCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    explanation: {
      type: "string"
    },
    coachNote: {
      type: "string"
    }
  },
  required: ["explanation", "coachNote"]
} as const;

type SkillTarget = {
  skillId: string;
  skillLabel: string;
  skillDescription: string;
  tags: string[];
  primaryTag: string;
};

function formatSkillLabelList(labels: string[]) {
  if (labels.length <= 1) {
    return labels[0] ?? "";
  }

  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }

  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}

function normalizeQueryList(queries: Array<string | null | undefined>) {
  return [...new Set(queries.map((query) => query?.trim()).filter((query): query is string => Boolean(query)))];
}

function canonicalizeTags(skills: SkillDefinition[], request: RouteRequest) {
  const selectedSkills = skills.filter((skill) => request.skillIds.includes(skill.id));
  return [
    ...new Set(selectedSkills.flatMap((skill) => skill.routeTags.map((tag) => routeTagAliases[tag] ?? tag)))
  ];
}

function buildSkillTargets(skills: SkillDefinition[], request: RouteRequest): SkillTarget[] {
  return skills
    .filter((skill) => request.skillIds.includes(skill.id))
    .map((skill) => {
      const tags = [...new Set(skill.routeTags.map((tag) => routeTagAliases[tag] ?? tag))];

      return {
        skillId: skill.id,
        skillLabel: skill.label,
        skillDescription: skill.description,
        tags,
        primaryTag: tags[0] ?? "arterial"
      };
    });
}

function buildTagFocusMap(skills: SkillDefinition[], request: RouteRequest) {
  const selectedSkills = skills.filter((skill) => request.skillIds.includes(skill.id));
  const focusMap: Record<string, string[]> = {};

  for (const skill of selectedSkills) {
    for (const rawTag of skill.routeTags) {
      const canonicalTag = routeTagAliases[rawTag] ?? rawTag;
      focusMap[canonicalTag] = [...new Set([...(focusMap[canonicalTag] ?? []), skill.label])];
    }
  }

  return focusMap;
}

function buildSkillFocusedTitle(tag: string, focusLabels: string[]) {
  const primaryFocus = focusLabels[0];
  if (primaryFocus) {
    return `${primaryFocus} practice`;
  }

  return stopDescriptors[tag]?.title ?? "Practice stop";
}

function extractCity(startLocation: string) {
  const locationParts = startLocation
    .split(",")
    .map((part) => part.trim())
    .filter(
      (part) =>
        Boolean(part) &&
        !/^\d{5}(?:-\d{4})?$/.test(part) &&
        !/^(united states|usa)$/i.test(part)
    );

  if (locationParts.length >= 2) {
    return locationParts[locationParts.length - 2] ?? startLocation.trim();
  }

  return locationParts[0] ?? startLocation.trim();
}

function buildLocationSearchContext(startLocation: string) {
  const locationParts = startLocation
    .split(",")
    .map((part) => part.trim())
    .filter(
      (part) =>
        Boolean(part) &&
        !/^\d{5}(?:-\d{4})?$/.test(part) &&
        !/^(united states|usa)$/i.test(part)
    );

  if (locationParts.length >= 2) {
    return locationParts.slice(-2).join(", ");
  }

  return locationParts[0] ?? startLocation.trim();
}

function buildHeuristicStops(
  startLocation: string,
  skillTargets: SkillTarget[]
): SuggestedStop[] {
  const city = extractCity(startLocation);
  const locationSearchContext = buildLocationSearchContext(startLocation);

  return skillTargets.map((target) => {
    const tag = target.primaryTag;
    const descriptor = stopDescriptors[tag] ?? {
      title: "Practice stop",
      searchHint: "public road",
      reason: "Selected to reinforce the current priority skill mix."
    };

    return {
      tag,
      skillId: target.skillId,
      skillLabel: target.skillLabel,
      title: `${city} ${target.skillLabel} practice`.trim(),
      searchQuery: `${descriptor.searchHint} near ${locationSearchContext}`,
      alternateQueries: normalizeQueryList([
        `${target.skillLabel} practice route near ${locationSearchContext}`,
        `${descriptor.title} near ${locationSearchContext}`,
        `${descriptor.searchHint} in ${city}`
      ]),
      reason: `Targets ${target.skillLabel}. ${target.skillDescription}`,
      source: "heuristic"
    };
  });
}

function buildCandidateStopsForSkills(
  startLocation: string,
  skillTargets: SkillTarget[],
  aiStops: SuggestedStop[] | null
) {
  const heuristicStops = buildHeuristicStops(startLocation, skillTargets);
  const unusedAiStops = [...(aiStops ?? [])];

  return skillTargets.map((target, index) => {
    const matchingAiStopIndex = unusedAiStops.findIndex(
      (stop) =>
        target.tags.includes(stop.tag) ||
        stop.title.toLowerCase().includes(target.skillLabel.toLowerCase()) ||
        stop.reason.toLowerCase().includes(target.skillLabel.toLowerCase())
    );

    if (matchingAiStopIndex === -1) {
      return heuristicStops[index];
    }

    const [matchingAiStop] = unusedAiStops.splice(matchingAiStopIndex, 1);
    return {
      ...matchingAiStop,
      skillId: target.skillId,
      skillLabel: target.skillLabel,
      tag: target.tags.includes(matchingAiStop.tag) ? matchingAiStop.tag : target.primaryTag,
      alternateQueries: normalizeQueryList([
        ...(matchingAiStop.alternateQueries ?? []),
        heuristicStops[index]?.searchQuery,
        ...(heuristicStops[index]?.alternateQueries ?? [])
      ]),
      source: "ai" as const
    };
  });
}

function normalizeSuggestedStops(stops: SuggestedStop[] | null | undefined) {
  if (!Array.isArray(stops)) {
    return [];
  }

  return stops
    .filter(
      (stop) =>
        typeof stop?.title === "string" &&
        typeof stop?.searchQuery === "string" &&
        typeof stop?.reason === "string" &&
        typeof stop?.tag === "string"
    )
    .map((stop) => ({
      ...stop,
      alternateQueries: normalizeQueryList(stop.alternateQueries ?? [])
    }))
    .slice(0, 4);
}

async function suggestStopsWithOpenAI(
  request: RouteRequest,
  recommendations: Recommendation[],
  tags: string[]
): Promise<SuggestedStop[] | null> {
  const model = process.env.GEMINI_ROUTE_MODEL ?? process.env.OPENAI_ROUTE_MODEL ?? "gemini-2.5-flash";
  const priorityLabels = recommendations
    .filter((entry) => request.skillIds.includes(entry.skillId))
    .map((entry) => entry.label)
    .slice(0, 4);
  const parsed = await generateStructuredObject<{ stops: SuggestedStop[] }>({
    model,
    reasoningEffort: "low",
    schemaName: "roadready_route_stop_suggestions",
    schema: ROUTE_STOP_SUGGESTION_SCHEMA,
    maxOutputTokens: 420,
    instructions:
      "You generate nearby driving-practice stop suggestions for a teen driving coach app. " +
      "Choose public, drivable road locations near the provided starting area. " +
      "Avoid parks, trails, golf courses, private campuses, parking lots, bodies of water, or vague landmarks unless curbside parking is explicitly relevant. " +
      "Each stop must have a human-readable title, a geocodable search query, one or two alternate geocodable phrasings, a grounded reason, and one of the provided canonical tags. " +
      "Prefer safer, repeatable reps over flashy or risky roads.",
    prompt:
      `Start location: ${request.startLocation}\n` +
      `Difficulty: ${request.difficulty}\n` +
      `Priority skills: ${priorityLabels.join(", ") || "general practice"}\n` +
      `Canonical route tags: ${tags.join(", ")}\n` +
      "Return 3 to 4 stop suggestions."
  });

  if (!Array.isArray(parsed?.stops)) {
    return null;
  }

  return normalizeSuggestedStops(parsed.stops);
}

async function suggestStopRetriesWithOpenAI(
  request: RouteRequest,
  target: SkillTarget,
  candidate: SuggestedStop
) {
  const model = process.env.GEMINI_ROUTE_MODEL ?? process.env.OPENAI_ROUTE_MODEL ?? "gemini-2.5-flash";
  const parsed = await generateStructuredObject<{ stops: SuggestedStop[] }>({
    model,
    reasoningEffort: "low",
    schemaName: "roadready_route_stop_retries",
    schema: ROUTE_STOP_SUGGESTION_SCHEMA,
    maxOutputTokens: 320,
    instructions:
      "You help recover a failed driving-route search for a teen driving practice app. " +
      "Return 2 or 3 nearby public-road alternatives for the one skill provided. " +
      "Keep every candidate within the same general metro area as the start location. " +
      "Avoid private campuses, parking lots, trailheads, vague landmarks, and anything that is not a road feature someone could verify in maps. " +
      "Use only the allowed canonical tags and give each result a geocodable search query plus one or two alternate phrasings.",
    prompt:
      `Start location: ${request.startLocation}\n` +
      `Difficulty: ${request.difficulty}\n` +
      `Target skill: ${target.skillLabel}\n` +
      `Skill description: ${target.skillDescription}\n` +
      `Allowed tags: ${target.tags.join(", ")}\n` +
      `Failed search query: ${candidate.searchQuery}\n` +
      `Existing alternate queries: ${JSON.stringify(candidate.alternateQueries ?? [])}\n` +
      "Return only stronger nearby alternatives for this one skill."
  });

  if (!Array.isArray(parsed?.stops)) {
    return null;
  }

  return normalizeSuggestedStops(parsed.stops).map((stop) => ({
    ...stop,
    skillId: target.skillId,
    skillLabel: target.skillLabel,
    tag: target.tags.includes(stop.tag) ? stop.tag : target.primaryTag,
    alternateQueries: normalizeQueryList([
      ...(stop.alternateQueries ?? []),
      candidate.searchQuery,
      ...(candidate.alternateQueries ?? [])
    ]),
    source: "ai" as const
  }));
}

function buildViewbox(latitude: number, longitude: number) {
  const latDelta = 0.06;
  const lonDelta = 0.08;

  return `${longitude - lonDelta},${latitude + latDelta},${longitude + lonDelta},${latitude - latDelta}`;
}

async function geocodeQuery(query: string, anchor?: Pick<GeocodeResult, "latitude" | "longitude">) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("q", query);
  if (anchor) {
    url.searchParams.set("viewbox", buildViewbox(anchor.latitude, anchor.longitude));
  }

  const response = await fetch(url, {
    headers: {
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": "RoadReady/0.1 (route generation)"
    }
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;

  const first = data[0];
  if (!first) {
    return null;
  }

  return {
    latitude: Number(first.lat),
    longitude: Number(first.lon),
    address: first.display_name
  } satisfies GeocodeResult;
}

function distanceKm(a: Pick<GeocodeResult, "latitude" | "longitude">, b: Pick<GeocodeResult, "latitude" | "longitude">) {
  const earthRadiusKm = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

function buildExplanation(request: RouteRequest, recommendations: Recommendation[]) {
  const recommendationLabels = recommendations
    .filter((entry) => request.skillIds.includes(entry.skillId))
    .map((entry) => entry.label.toLowerCase());

  return `This route starts near ${request.startLocation} and focuses on ${recommendationLabels.join(
    ", "
  )}. It favors public-road segments that should be easier to open in maps and practice repeatedly.`;
}

function buildFallbackCoachNote(route: Pick<RoutePlan, "difficulty" | "segments">) {
  const firstFocus = route.segments[0]?.focusSkillLabels?.[0]?.toLowerCase();
  const firstStop = route.segments[0]?.title;

  if (firstFocus && firstStop) {
    return `Start with ${firstStop} to settle into ${firstFocus}, then keep the loop short enough to repeat the toughest section while attention is still fresh.`;
  }

  return route.difficulty === "stretch"
    ? "Preview the route in Maps first, then pause after the hardest segment if the learner starts to sound overloaded."
    : "Preview the route in Maps first and repeat the hardest segment once more if the learner is still calm and focused.";
}

async function buildRouteGuidanceWithOpenAI(
  request: RouteRequest,
  recommendations: Recommendation[],
  route: Pick<RoutePlan, "difficulty" | "segments"> & { estimatedMinutes: number }
) {
  const model = process.env.GEMINI_ROUTE_MODEL ?? process.env.OPENAI_ROUTE_MODEL ?? "gemini-2.5-flash";
  const selectedRecommendations = recommendations
    .filter((entry) => request.skillIds.includes(entry.skillId))
    .map((entry) => ({
      label: entry.label,
      reasons: entry.reasons
    }));
  const segmentSummary = route.segments.map((segment, index) => ({
    stop: index + 1,
    title: segment.title,
    address: segment.address,
    reason: segment.reason,
    focusSkillLabels: segment.focusSkillLabels ?? [],
    verificationStatus: segment.verificationStatus ?? "verified"
  }));
  const guidance = await generateStructuredObject<RouteGuidance>({
    model,
    reasoningEffort: "low",
    schemaName: "roadready_route_guidance",
    schema: ROUTE_GUIDANCE_SCHEMA,
    maxOutputTokens: 260,
    instructions:
      "You write grounded route explanations for a teen driving practice app. " +
      "Stay tightly anchored to the verified route stops, priorities, and duration provided. " +
      "Keep the explanation to 2 concise sentences and the coach note to 1 concise sentence. " +
      "Do not claim turn-by-turn guarantees, legal compliance, or safety certainty.",
    prompt:
      `Start location: ${request.startLocation}\n` +
      `Difficulty: ${route.difficulty}\n` +
      `Estimated minutes: ${route.estimatedMinutes}\n` +
      `Priority skills and reasons: ${JSON.stringify(selectedRecommendations)}\n` +
      `Verified route stops: ${JSON.stringify(segmentSummary)}\n`
  });

  if (!guidance?.explanation?.trim() || !guidance.coachNote?.trim()) {
    return null;
  }

  return {
    explanation: guidance.explanation.trim(),
    coachNote: guidance.coachNote.trim()
  };
}

const fourWayStopRoadPattern = /^(primary|secondary|tertiary|unclassified|residential|living_street)$/;
const majorRoadPattern = /^(trunk|primary|secondary|tertiary)$/;
const highSpeedRoadPattern = /^(motorway|trunk|motorway_link|trunk_link)$/;
const rampRoadPattern = /^(motorway_link|trunk_link)$/;
const surfaceRoadPattern = /^(primary|secondary|tertiary|unclassified|residential|living_street)$/;
const arterialRoadPattern = /^(primary|secondary|tertiary)$/;
const residentialRoadPattern = /^(residential|living_street|unclassified)$/;
const maxFourWayStopLineDistanceKm = 0.045;

function buildNodeElementMap(elements: OverpassElement[]) {
  return new Map(
    elements
      .filter(
        (element): element is OverpassElement & { type: "node"; lat: number; lon: number } =>
          element.type === "node" &&
          typeof element.lat === "number" &&
          typeof element.lon === "number"
      )
      .map((element) => [element.id, element])
  );
}

function getOverpassPoint(
  element: OverpassElement,
  nodeElements?: Map<number, OverpassElement & { type: "node"; lat: number; lon: number }>
) {
  if (typeof element.lat === "number" && typeof element.lon === "number") {
    return {
      latitude: element.lat,
      longitude: element.lon
    };
  }

  if (element.center) {
    return {
      latitude: element.center.lat,
      longitude: element.center.lon
    };
  }

  if (element.type === "way" && Array.isArray(element.nodes) && nodeElements?.size) {
    const midpointNode = nodeElements.get(element.nodes[Math.floor(element.nodes.length / 2)]);
    if (midpointNode) {
      return {
        latitude: midpointNode.lat,
        longitude: midpointNode.lon
      };
    }
  }

  return null;
}

function isRoadWay(
  element: OverpassElement,
  highwayPattern: RegExp
): element is RoadWay {
  return (
    element.type === "way" &&
    Array.isArray(element.nodes) &&
    Boolean(element.tags?.highway && highwayPattern.test(element.tags.highway))
  );
}

function buildIntersectionLabel(roadNames: string[]) {
  const uniqueRoadNames = [...new Set(roadNames.map((name) => name.trim()).filter(Boolean))];
  if (uniqueRoadNames.length < 2) {
    return null;
  }

  return `${uniqueRoadNames[0]} & ${uniqueRoadNames[1]}`;
}

function isStopControlNode(
  element: OverpassElement
): element is OverpassElement & { type: "node"; lat: number; lon: number } {
  return (
    element.type === "node" &&
    typeof element.lat === "number" &&
    typeof element.lon === "number" &&
    (element.tags?.highway === "stop" || element.tags?.traffic_sign === "stop")
  );
}

function isLocalIntersectionRoadType(highway?: string) {
  return Boolean(highway && /^(tertiary|unclassified|residential|living_street)$/.test(highway));
}

function getWayName(way: RoadWay) {
  return way.tags?.name?.trim() || way.tags?.ref?.trim() || null;
}

function buildRoadTopology(elements: OverpassElement[], highwayPattern: RegExp): RoadTopology {
  const nodeElements = buildNodeElementMap(elements);
  const roadWays = elements.filter((element): element is RoadWay => isRoadWay(element, highwayPattern));
  const waysById = new Map<number, RoadWay>();
  const wayIdsByNode = new Map<number, Set<number>>();

  for (const way of roadWays) {
    waysById.set(way.id, way);
    for (const nodeId of way.nodes) {
      const connectedWayIds = wayIdsByNode.get(nodeId) ?? new Set<number>();
      connectedWayIds.add(way.id);
      wayIdsByNode.set(nodeId, connectedWayIds);
    }
  }

  return {
    nodeElements,
    roadWays,
    waysById,
    wayIdsByNode
  };
}

function getConnectedWays(topology: RoadTopology, nodeId: number, excludeWayId?: number) {
  return [...(topology.wayIdsByNode.get(nodeId) ?? [])]
    .filter((wayId) => wayId !== excludeWayId)
    .map((wayId) => topology.waysById.get(wayId))
    .filter((way): way is RoadWay => Boolean(way));
}

function parseNumericTag(value?: string) {
  if (!value) {
    return null;
  }

  const match = value.match(/\d+/);
  if (!match) {
    return null;
  }

  const parsed = Number.parseInt(match[0], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function getLaneCountFromTurnLanes(value?: string) {
  if (!value) {
    return null;
  }

  return value.split("|").length;
}

function getTotalLaneCount(tags?: Record<string, string>) {
  const explicitLanes = parseNumericTag(tags?.lanes);
  if (explicitLanes) {
    return explicitLanes;
  }

  const forwardLanes = parseNumericTag(tags?.["lanes:forward"]);
  const backwardLanes = parseNumericTag(tags?.["lanes:backward"]);
  if (forwardLanes || backwardLanes) {
    return (forwardLanes ?? 0) + (backwardLanes ?? 0);
  }

  const directTurnLaneCount = getLaneCountFromTurnLanes(tags?.["turn:lanes"]);
  if (directTurnLaneCount) {
    return directTurnLaneCount;
  }

  const directionalTurnLaneCount =
    (getLaneCountFromTurnLanes(tags?.["turn:lanes:forward"]) ?? 0) +
    (getLaneCountFromTurnLanes(tags?.["turn:lanes:backward"]) ?? 0);
  return directionalTurnLaneCount || null;
}

function getMaxDirectionalLaneCount(tags?: Record<string, string>) {
  return Math.max(
    parseNumericTag(tags?.["lanes:forward"]) ?? 0,
    parseNumericTag(tags?.["lanes:backward"]) ?? 0,
    getLaneCountFromTurnLanes(tags?.["turn:lanes:forward"]) ?? 0,
    getLaneCountFromTurnLanes(tags?.["turn:lanes:backward"]) ?? 0,
    tags?.oneway === "yes" ? getTotalLaneCount(tags) ?? 0 : 0
  );
}

function countLeftTurnLanes(tags?: Record<string, string>) {
  const turnLaneValues = [
    tags?.["turn:lanes"],
    tags?.["turn:lanes:forward"],
    tags?.["turn:lanes:backward"]
  ].filter((value): value is string => Boolean(value));

  return turnLaneValues.reduce((count, value) => {
    const laneCount = value
      .split("|")
      .filter((lane) => lane.split(";").some((token) => token.trim() === "left")).length;
    return Math.max(count, laneCount);
  }, 0);
}

function hasLeftToken(value?: string) {
  if (!value) {
    return false;
  }

  return value
    .split("|")
    .some((lane) => lane.split(";").some((token) => token.trim() === "left"));
}

function getLeftTurnDirections(tags?: Record<string, string>) {
  const forward = hasLeftToken(tags?.["turn:lanes:forward"]);
  const backward = hasLeftToken(tags?.["turn:lanes:backward"]);
  const undirected = hasLeftToken(tags?.["turn:lanes"]);
  const isOneWay = tags?.oneway === "yes";

  if (forward || backward) {
    return {
      forward: forward || (undirected && isOneWay),
      backward
    };
  }

  if (undirected) {
    return {
      forward: true,
      backward: !isOneWay
    };
  }

  return {
    forward: false,
    backward: false
  };
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number) {
  return (value * 180) / Math.PI;
}

function getBearingDegrees(
  from: Pick<GeocodeResult, "latitude" | "longitude">,
  to: Pick<GeocodeResult, "latitude" | "longitude">
) {
  const latitude1 = toRadians(from.latitude);
  const latitude2 = toRadians(to.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);

  const y = Math.sin(deltaLongitude) * Math.cos(latitude2);
  const x =
    Math.cos(latitude1) * Math.sin(latitude2) -
    Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(deltaLongitude);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

function normalizeSignedAngle(angle: number) {
  let normalized = angle;

  while (normalized > 180) {
    normalized -= 360;
  }

  while (normalized <= -180) {
    normalized += 360;
  }

  return normalized;
}

function hasProtectedLeftSignalMetadata(tags?: Record<string, string>) {
  if (!tags) {
    return false;
  }

  return Object.entries(tags).some(([key, value]) => {
    const normalizedKey = key.trim().toLowerCase();
    const normalizedValue = value.trim().toLowerCase();
    const isSignalRelated =
      normalizedKey.includes("traffic_signal") ||
      normalizedKey.includes("traffic_signals") ||
      normalizedKey.includes("signal");

    if (!isSignalRelated) {
      return false;
    }

    return (
      /protected|arrow|left_turn|leftturn/.test(normalizedKey) ||
      /protected|left arrow|green arrow/.test(normalizedValue)
    );
  });
}

function interpolatePoint(
  from: Pick<GeocodeResult, "latitude" | "longitude">,
  to: Pick<GeocodeResult, "latitude" | "longitude">,
  fraction: number
) {
  return {
    latitude: from.latitude + (to.latitude - from.latitude) * fraction,
    longitude: from.longitude + (to.longitude - from.longitude) * fraction
  };
}

function buildPointPastIntersection(
  intersectionNodeId: number,
  nextNodeId: number,
  topology: RoadTopology,
  distanceMeters = 45
) {
  const intersectionNode = topology.nodeElements.get(intersectionNodeId);
  const nextNode = topology.nodeElements.get(nextNodeId);

  if (!intersectionNode || !nextNode) {
    return null;
  }

  const segmentDistanceKm = distanceKm(
    { latitude: intersectionNode.lat, longitude: intersectionNode.lon },
    { latitude: nextNode.lat, longitude: nextNode.lon }
  );

  if (segmentDistanceKm === 0) {
    return {
      latitude: nextNode.lat,
      longitude: nextNode.lon
    };
  }

  const fraction = Math.min((distanceMeters / 1000) / segmentDistanceKm, 0.82);

  return interpolatePoint(
    { latitude: intersectionNode.lat, longitude: intersectionNode.lon },
    { latitude: nextNode.lat, longitude: nextNode.lon },
    fraction
  );
}

function getWayNeighborNodeIds(way: RoadWay, nodeId: number) {
  const nodeIndex = way.nodes.indexOf(nodeId);

  if (nodeIndex === -1) {
    return [];
  }

  return [
    nodeIndex > 0 ? way.nodes[nodeIndex - 1] : undefined,
    nodeIndex < way.nodes.length - 1 ? way.nodes[nodeIndex + 1] : undefined
  ].filter((candidate): candidate is number => typeof candidate === "number");
}

function getApproachNodeForDirection(
  way: RoadWay,
  nodeId: number,
  direction: TurnDirection
) {
  const nodeIndex = way.nodes.indexOf(nodeId);

  if (nodeIndex === -1) {
    return null;
  }

  if (direction === "forward") {
    return nodeIndex > 0 ? way.nodes[nodeIndex - 1] : null;
  }

  return nodeIndex < way.nodes.length - 1 ? way.nodes[nodeIndex + 1] : null;
}

function findUnprotectedLeftTurnCandidate(
  signalNode: OverpassElement & { type: "node"; lat: number; lon: number },
  connectedWays: RoadWay[],
  topology: RoadTopology
) {
  const signalPoint = {
    latitude: signalNode.lat,
    longitude: signalNode.lon
  };

  const candidates = connectedWays
    .flatMap((approachWay) => {
      const approachName = getWayName(approachWay);
      const leftTurnDirections = getLeftTurnDirections(approachWay.tags);
      const approachDirections: TurnDirection[] = [];

      if (leftTurnDirections.forward) {
        approachDirections.push("forward");
      }

      if (leftTurnDirections.backward) {
        approachDirections.push("backward");
      }

      return approachDirections.flatMap((direction) => {
        const approachNodeId = getApproachNodeForDirection(approachWay, signalNode.id, direction);
        const approachNode = approachNodeId ? topology.nodeElements.get(approachNodeId) : null;

        if (!approachNode || !approachName) {
          return [];
        }

        const approachBearing = getBearingDegrees(
          { latitude: approachNode.lat, longitude: approachNode.lon },
          signalPoint
        );

        return connectedWays
          .filter((candidateWay) => candidateWay.id !== approachWay.id)
          .flatMap((destinationWay) => {
            const destinationName = getWayName(destinationWay);

            if (!destinationName || destinationName === approachName) {
              return [];
            }

            return getWayNeighborNodeIds(destinationWay, signalNode.id)
              .map((neighborNodeId) => {
                const destinationNode = topology.nodeElements.get(neighborNodeId);

                if (!destinationNode) {
                  return null;
                }

                const outgoingBearing = getBearingDegrees(signalPoint, {
                  latitude: destinationNode.lat,
                  longitude: destinationNode.lon
                });
                const turnAngle = normalizeSignedAngle(outgoingBearing - approachBearing);

                if (turnAngle < 35 || turnAngle > 170) {
                  return null;
                }

                const point = buildPointPastIntersection(signalNode.id, neighborNodeId, topology);
                if (!point) {
                  return null;
                }

                const approachHighway = approachWay.tags?.highway ?? "";
                const destinationHighway = destinationWay.tags?.highway ?? "";
                const leftTurnLanes = countLeftTurnLanes(approachWay.tags);
                const totalLanes = getTotalLaneCount(approachWay.tags) ?? 0;
                const approachDirectionalLanes =
                  getMaxDirectionalLaneCount(approachWay.tags) || totalLanes;
                const destinationDirectionalLanes =
                  getMaxDirectionalLaneCount(destinationWay.tags) ||
                  getTotalLaneCount(destinationWay.tags) ||
                  0;
                const approachMaxSpeed = parseMaxSpeed(approachWay.tags) ?? 0;
                const destinationMaxSpeed = parseMaxSpeed(destinationWay.tags) ?? 0;
                const bothRoadsAreMajor =
                  /^(primary|secondary)$/.test(approachHighway) &&
                  /^(primary|secondary)$/.test(destinationHighway);

                if (leftTurnLanes === 0 || leftTurnLanes > 1) {
                  return null;
                }

                if (/^trunk$/.test(approachHighway) || /^trunk$/.test(destinationHighway)) {
                  return null;
                }

                if (approachDirectionalLanes > 3 || destinationDirectionalLanes > 4) {
                  return null;
                }

                if (approachMaxSpeed > 40 || destinationMaxSpeed > 45) {
                  return null;
                }

                if (bothRoadsAreMajor && (approachDirectionalLanes >= 3 || destinationDirectionalLanes >= 3)) {
                  return null;
                }

                const calmApproachBonus =
                  /^(tertiary|unclassified|residential|living_street)$/.test(approachHighway)
                    ? 10
                    : approachHighway === "secondary"
                      ? 4
                      : 0;
                const calmDestinationBonus =
                  /^(tertiary|unclassified|residential|living_street)$/.test(destinationHighway)
                    ? 8
                    : destinationHighway === "secondary"
                      ? 3
                      : 0;
                const lanePenalty =
                  Math.max(0, approachDirectionalLanes - 2) * 8 +
                  Math.max(0, destinationDirectionalLanes - 2) * 5;
                const speedPenalty = Math.max(0, approachMaxSpeed - 30) + Math.max(0, destinationMaxSpeed - 35);
                const majorRoadPenalty = bothRoadsAreMajor ? 12 : /^(primary|secondary)$/.test(approachHighway) ? 4 : 0;

                return {
                  point,
                  addressHint: `Left from ${approachName} onto ${destinationName}`,
                  verificationStatus: "verified" as const,
                  score:
                    42 +
                    calmApproachBonus +
                    calmDestinationBonus +
                    Math.round((180 - Math.abs(90 - turnAngle)) / 10) -
                    lanePenalty -
                    Math.round(speedPenalty / 4) -
                    majorRoadPenalty
                };
              })
              .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);
          });
      });
    })
    .sort((a, b) => b.score - a.score);

  return candidates[0] ?? null;
}

function parseMaxSpeed(tags?: Record<string, string>) {
  return parseNumericTag(tags?.maxspeed);
}

function hasPositiveParkingTag(tags?: Record<string, string>) {
  if (!tags) {
    return false;
  }

  return Object.entries(tags).some(([key, value]) => {
    if (!key.startsWith("parking")) {
      return false;
    }

    const normalizedValue = value.trim().toLowerCase();
    return normalizedValue !== "no" && normalizedValue !== "none";
  });
}

function hasLitTag(tags?: Record<string, string>) {
  if (!tags?.lit) {
    return false;
  }

  return tags.lit.trim().toLowerCase() !== "no";
}

function buildRoadAddressHint(way: RoadWay) {
  return getWayName(way) ?? undefined;
}

function selectBestFeatureCandidate(
  candidates: ScoredFeatureCandidate[],
  startPoint: Pick<GeocodeResult, "latitude" | "longitude">,
  existingStops: RouteStop[]
) {
  const rankedCandidates = candidates
    .map((candidate) => ({
      ...candidate,
      distanceFromStart: distanceKm(startPoint, candidate.point),
      distanceFromExisting: existingStops.length
        ? Math.min(
            ...existingStops.map((segment) =>
              distanceKm(
                { latitude: segment.latitude, longitude: segment.longitude },
                candidate.point
              )
            )
          )
        : Number.POSITIVE_INFINITY
    }))
    .filter((candidate) => candidate.distanceFromExisting > 0.2)
    .sort((a, b) => b.score - a.score || a.distanceFromStart - b.distanceFromStart);

  const bestCandidate = rankedCandidates[0];
  if (!bestCandidate) {
    return null;
  }

  return {
    point: bestCandidate.point,
    addressHint: bestCandidate.addressHint,
    verificationStatus: bestCandidate.verificationStatus
  } satisfies FeatureMatch;
}

function findVerifiedRoadSegmentMatch(
  elements: OverpassElement[],
  startPoint: Pick<GeocodeResult, "latitude" | "longitude">,
  existingStops: RouteStop[],
  options: {
    highwayPattern: RegExp;
    buildCandidate: (
      way: RoadWay,
      topology: RoadTopology,
      point: Pick<GeocodeResult, "latitude" | "longitude">
    ) => ScoredFeatureCandidate | null;
  }
) {
  const topology = buildRoadTopology(elements, options.highwayPattern);
  if (!topology.roadWays.length) {
    return null;
  }

  const candidates = topology.roadWays
    .map((way) => {
      const point = getOverpassPoint(way, topology.nodeElements);
      if (!point) {
        return null;
      }

      return options.buildCandidate(way, topology, point);
    })
    .filter((candidate): candidate is ScoredFeatureCandidate => Boolean(candidate));

  return selectBestFeatureCandidate(candidates, startPoint, existingStops);
}

function findVerifiedSignalizedIntersectionMatch(
  elements: OverpassElement[],
  startPoint: Pick<GeocodeResult, "latitude" | "longitude">,
  existingStops: RouteStop[],
  options: {
    requireLeftTurnLane: boolean;
    preferBusyIntersection: boolean;
    requireSpecificLeftTurnPath?: boolean;
  }
) {
  const topology = buildRoadTopology(elements, majorRoadPattern);
  const signalNodes = elements.filter(
    (element): element is OverpassElement & { type: "node"; lat: number; lon: number } =>
      element.type === "node" &&
      typeof element.lat === "number" &&
      typeof element.lon === "number" &&
      element.tags?.highway === "traffic_signals" &&
      element.tags?.traffic_signals !== "pedestrian_crossing"
  );

  const candidates = signalNodes
    .map((signalNode) => {
      const connectedWays = getConnectedWays(topology, signalNode.id);
      if (connectedWays.length < 2) {
        return null;
      }

      const roadNames = [
        ...new Set(
          connectedWays
            .map((way) => getWayName(way))
            .filter((name): name is string => Boolean(name))
        )
      ];
      if (roadNames.length < 2) {
        return null;
      }

      const totalLanes = Math.max(...connectedWays.map((way) => getTotalLaneCount(way.tags) ?? 0));
      const leftTurnLanes = Math.max(...connectedWays.map((way) => countLeftTurnLanes(way.tags)));
      const majorRoadCount = connectedWays.filter((way) =>
        Boolean(way.tags?.highway && /^(trunk|primary|secondary)$/.test(way.tags.highway))
      ).length;
      const hasProtectedLeftSignals =
        hasProtectedLeftSignalMetadata(signalNode.tags) ||
        connectedWays.some((way) => hasProtectedLeftSignalMetadata(way.tags));

      if (options.requireLeftTurnLane && leftTurnLanes === 0) {
        return null;
      }

      if (options.preferBusyIntersection && totalLanes < 4 && majorRoadCount === 0) {
        return null;
      }

      if (options.requireSpecificLeftTurnPath) {
        if (hasProtectedLeftSignals) {
          return null;
        }

        const leftTurnCandidate = findUnprotectedLeftTurnCandidate(signalNode, connectedWays, topology);

        if (!leftTurnCandidate) {
          return null;
        }

        return {
          ...leftTurnCandidate,
          score: leftTurnCandidate.score + totalLanes + majorRoadCount * 3 + roadNames.length
        };
      }

      return {
        point: {
          latitude: signalNode.lat,
          longitude: signalNode.lon
        },
        addressHint: buildIntersectionLabel(roadNames) ?? undefined,
        verificationStatus: "verified" as const,
        score:
          leftTurnLanes * 8 +
          totalLanes * 2 +
          majorRoadCount * 4 +
          roadNames.length
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));

  return selectBestFeatureCandidate(candidates, startPoint, existingStops);
}

function findVerifiedRampMatch(
  elements: OverpassElement[],
  startPoint: Pick<GeocodeResult, "latitude" | "longitude">,
  existingStops: RouteStop[],
  options: {
    connectorMode: boolean;
  }
) {
  const topology = buildRoadTopology(elements, /^(motorway|trunk|motorway_link|trunk_link|primary|secondary|tertiary|unclassified|residential|living_street)$/);
  const rampWays = topology.roadWays.filter((way) =>
    Boolean(way.tags?.highway && rampRoadPattern.test(way.tags.highway))
  );

  const candidates = rampWays
    .map((way) => {
      const point = getOverpassPoint(way, topology.nodeElements);
      if (!point) {
        return null;
      }

      const endpointNodeIds = [way.nodes[0], way.nodes[way.nodes.length - 1]].filter(
        (nodeId): nodeId is number => typeof nodeId === "number"
      );
      const endpointConnections = endpointNodeIds.map((nodeId) => getConnectedWays(topology, nodeId, way.id));
      const connectedWays = endpointConnections.flat();
      const surfaceConnections = connectedWays.filter((connectedWay) =>
        Boolean(
          connectedWay.tags?.highway &&
            surfaceRoadPattern.test(connectedWay.tags.highway) &&
            !highSpeedRoadPattern.test(connectedWay.tags.highway)
        )
      );
      const highSpeedConnections = connectedWays.filter((connectedWay) =>
        Boolean(connectedWay.tags?.highway && highSpeedRoadPattern.test(connectedWay.tags.highway))
      );
      const highSpeedEndpoints = endpointConnections.filter((connectedSet) =>
        connectedSet.some(
          (connectedWay) =>
            Boolean(connectedWay.tags?.highway && highSpeedRoadPattern.test(connectedWay.tags.highway))
        )
      ).length;

      if (options.connectorMode) {
        if (!highSpeedConnections.length || highSpeedEndpoints < 1) {
          return null;
        }
      } else if (!highSpeedConnections.length || !surfaceConnections.length) {
        return null;
      }

      const surfaceRoadName = surfaceConnections.map((connectedWay) => getWayName(connectedWay)).find(Boolean);
      const highSpeedRoadName = highSpeedConnections.map((connectedWay) => getWayName(connectedWay)).find(Boolean);
      const addressHint = options.connectorMode
        ? [getWayName(way), highSpeedRoadName].filter(Boolean).join(" near ") || getWayName(way) || undefined
        : surfaceRoadName && highSpeedRoadName
          ? `${surfaceRoadName} ramp toward ${highSpeedRoadName}`
          : getWayName(way) ?? highSpeedRoadName ?? undefined;

      return {
        point,
        addressHint,
        verificationStatus: "verified" as const,
        score:
          highSpeedConnections.length * 6 +
          highSpeedEndpoints * 4 +
          surfaceConnections.length * (options.connectorMode ? 1 : 4) +
          (getWayName(way) ? 2 : 0)
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));

  return selectBestFeatureCandidate(candidates, startPoint, existingStops);
}

function findVerifiedFourWayStopMatch(
  elements: OverpassElement[],
  startPoint: Pick<GeocodeResult, "latitude" | "longitude">,
  existingStops: RouteStop[]
): FeatureMatch | null {
  const rankedJunctions = rankFourWayStopJunctions(elements, startPoint, existingStops);
  const bestMatch = rankedJunctions.find(
    (junction) => junction.explicitAllWayStop || junction.controlledApproachCount >= 4
  );

  if (!bestMatch) {
    return null;
  }

  return {
    point: bestMatch.point,
    addressHint: bestMatch.addressHint ?? undefined,
    verificationStatus: "verified"
  };
}

function rankFourWayStopJunctions(
  elements: OverpassElement[],
  startPoint: Pick<GeocodeResult, "latitude" | "longitude">,
  existingStops: RouteStop[]
) {
  const topology = buildRoadTopology(elements, fourWayStopRoadPattern);
  if (!topology.roadWays.length) {
    return [];
  }

  const junctions = new Map<
    number,
    {
      point: Pick<GeocodeResult, "latitude" | "longitude">;
      roadNames: Set<string>;
      branchNodeIds: Set<number>;
      controlledApproachIds: Set<number>;
      explicitAllWayStop: boolean;
      connectedHighwayTypes: Set<string>;
    }
  >();

  for (const [nodeId, connectedWayIds] of topology.wayIdsByNode.entries()) {
    if (connectedWayIds.size < 2) {
      continue;
    }

    const nodeElement = topology.nodeElements.get(nodeId);
    if (!nodeElement || nodeElement.tags?.highway === "traffic_signals") {
      continue;
    }

    const point = getOverpassPoint(nodeElement);
    if (!point) {
      continue;
    }

    const roadNames = new Set<string>();
    const branchNodeIds = new Set<number>();
    const connectedHighwayTypes = new Set<string>();

    for (const wayId of connectedWayIds) {
      const way = topology.waysById.get(wayId);
      if (!way) {
        continue;
      }

      if (way.tags?.highway) {
        connectedHighwayTypes.add(way.tags.highway);
      }

      if (way.tags?.name?.trim()) {
        roadNames.add(way.tags.name.trim());
      }

      for (let index = 0; index < way.nodes.length; index += 1) {
        if (way.nodes[index] !== nodeId) {
          continue;
        }

        if (index > 0) {
          branchNodeIds.add(way.nodes[index - 1]);
        }

        if (index < way.nodes.length - 1) {
          branchNodeIds.add(way.nodes[index + 1]);
        }
      }
    }

    if (branchNodeIds.size < 4) {
      continue;
    }

    junctions.set(nodeId, {
      point,
      roadNames,
      branchNodeIds,
      controlledApproachIds: new Set<number>(),
      explicitAllWayStop:
        nodeElement.tags?.stop === "all" || nodeElement.tags?.highway === "stop",
      connectedHighwayTypes
    });
  }

  if (!junctions.size) {
    return [];
  }

  const stopNodes = elements.filter(isStopControlNode);

  for (const stopNode of stopNodes) {
    const containingWayIds = topology.wayIdsByNode.get(stopNode.id);
    if (!containingWayIds?.size) {
      continue;
    }

    const stopPoint = {
      latitude: stopNode.lat,
      longitude: stopNode.lon
    };

    let bestMatch:
      | {
          junctionId: number;
          branchNodeId: number;
          distanceFromJunction: number;
        }
      | null = null;

    for (const wayId of containingWayIds) {
      const way = topology.waysById.get(wayId);
      if (!way) {
        continue;
      }

      const stopIndex = way.nodes.indexOf(stopNode.id);
      if (stopIndex === -1) {
        continue;
      }

      for (let junctionIndex = 0; junctionIndex < way.nodes.length; junctionIndex += 1) {
        const junctionId = way.nodes[junctionIndex];
        const junction = junctions.get(junctionId);
        if (!junction || junctionIndex === stopIndex) {
          continue;
        }

        const distanceFromJunction = distanceKm(stopPoint, junction.point);
        if (distanceFromJunction > maxFourWayStopLineDistanceKm) {
          continue;
        }

        const branchNodeId =
          stopIndex > junctionIndex ? way.nodes[junctionIndex + 1] : way.nodes[junctionIndex - 1];
        if (!branchNodeId || !junction.branchNodeIds.has(branchNodeId)) {
          continue;
        }

        if (!bestMatch || distanceFromJunction < bestMatch.distanceFromJunction) {
          bestMatch = {
            junctionId,
            branchNodeId,
            distanceFromJunction
          };
        }
      }
    }

    if (bestMatch) {
      const matchedJunction = junctions.get(bestMatch.junctionId);
      matchedJunction?.controlledApproachIds.add(bestMatch.branchNodeId);

      if (stopNode.tags?.stop === "all") {
        matchedJunction!.explicitAllWayStop = true;
      }
    }
  }

  return [...junctions.values()]
    .map((junction) => {
      const distanceFromStart = distanceKm(startPoint, junction.point);
      const distanceFromExisting = existingStops.length
        ? Math.min(
            ...existingStops.map((segment) =>
              distanceKm(
                { latitude: segment.latitude, longitude: segment.longitude },
                junction.point
              )
            )
          )
        : Number.POSITIVE_INFINITY;

      return {
        ...junction,
        distanceFromStart,
        distanceFromExisting,
        addressHint: buildIntersectionLabel([...junction.roadNames]),
        controlledApproachCount: junction.controlledApproachIds.size,
        localRoadOnly: [...junction.connectedHighwayTypes].every((highway) =>
          isLocalIntersectionRoadType(highway)
        )
      };
    })
    .filter((junction) => junction.distanceFromExisting > 0.2)
    .sort(
      (a, b) =>
        Number(b.explicitAllWayStop) - Number(a.explicitAllWayStop) ||
        b.controlledApproachCount - a.controlledApproachCount ||
        Number(b.localRoadOnly) - Number(a.localRoadOnly) ||
        a.distanceFromStart - b.distanceFromStart
    );
}

function findVerifiedResidentialStopMatch(
  elements: OverpassElement[],
  startPoint: Pick<GeocodeResult, "latitude" | "longitude">,
  existingStops: RouteStop[]
) {
  const stopNodePoints = elements
    .filter(
      (element): element is OverpassElement & { type: "node"; lat: number; lon: number } =>
        element.type === "node" &&
        typeof element.lat === "number" &&
        typeof element.lon === "number" &&
        (element.tags?.highway === "stop" || element.tags?.traffic_sign === "stop")
    )
    .map((element) => ({
      latitude: element.lat,
      longitude: element.lon
    }));

  return findVerifiedRoadSegmentMatch(elements, startPoint, existingStops, {
    highwayPattern: residentialRoadPattern,
    buildCandidate: (way, _topology, point) => {
      const nearbyStopCount = stopNodePoints.filter((stopPoint) => distanceKm(stopPoint, point) < 0.12).length;
      if (!nearbyStopCount) {
        return null;
      }

      return {
        point,
        addressHint: buildRoadAddressHint(way),
        verificationStatus: "verified",
        score: nearbyStopCount * 6 + (getWayName(way) ? 2 : 0) + (parseMaxSpeed(way.tags) ? 2 : 0)
      };
    }
  });
}

function findVerifiedArterialMatch(
  elements: OverpassElement[],
  startPoint: Pick<GeocodeResult, "latitude" | "longitude">,
  existingStops: RouteStop[]
) {
  return findVerifiedRoadSegmentMatch(elements, startPoint, existingStops, {
    highwayPattern: arterialRoadPattern,
    buildCandidate: (way, _topology, point) => {
      const laneCount = getTotalLaneCount(way.tags) ?? 0;
      const maxSpeed = parseMaxSpeed(way.tags) ?? 0;
      const highway = way.tags?.highway ?? "";

      if (!getWayName(way)) {
        return null;
      }

      if (laneCount < 2 && maxSpeed < 25 && highway === "tertiary") {
        return null;
      }

      return {
        point,
        addressHint: buildRoadAddressHint(way),
        verificationStatus: "verified",
        score:
          (highway === "primary" ? 8 : highway === "secondary" ? 6 : 4) +
          laneCount * 2 +
          Math.floor(maxSpeed / 10)
      };
    }
  });
}

function findVerifiedMultiLaneArterialMatch(
  elements: OverpassElement[],
  startPoint: Pick<GeocodeResult, "latitude" | "longitude">,
  existingStops: RouteStop[]
) {
  return findVerifiedRoadSegmentMatch(elements, startPoint, existingStops, {
    highwayPattern: arterialRoadPattern,
    buildCandidate: (way, _topology, point) => {
      const totalLanes = getTotalLaneCount(way.tags) ?? 0;
      const directionalLanes = getMaxDirectionalLaneCount(way.tags);
      const highway = way.tags?.highway ?? "";

      if (!getWayName(way) || (totalLanes < 4 && directionalLanes < 2)) {
        return null;
      }

      return {
        point,
        addressHint: buildRoadAddressHint(way),
        verificationStatus: "verified",
        score:
          totalLanes * 3 +
          directionalLanes * 4 +
          (highway === "primary" ? 6 : highway === "secondary" ? 4 : 2)
      };
    }
  });
}

function findVerifiedBoulevardMatch(
  elements: OverpassElement[],
  startPoint: Pick<GeocodeResult, "latitude" | "longitude">,
  existingStops: RouteStop[]
) {
  return findVerifiedRoadSegmentMatch(elements, startPoint, existingStops, {
    highwayPattern: arterialRoadPattern,
    buildCandidate: (way, _topology, point) => {
      const totalLanes = getTotalLaneCount(way.tags) ?? 0;
      const maxSpeed = parseMaxSpeed(way.tags) ?? 0;
      const highway = way.tags?.highway ?? "";

      if (!getWayName(way)) {
        return null;
      }

      if (totalLanes < 3 && maxSpeed < 25 && highway === "tertiary") {
        return null;
      }

      return {
        point,
        addressHint: buildRoadAddressHint(way),
        verificationStatus: "verified",
        score:
          (highway === "primary" ? 7 : highway === "secondary" ? 5 : 3) +
          totalLanes * 2 +
          Math.floor(maxSpeed / 10)
      };
    }
  });
}

function findVerifiedLitRoadMatch(
  elements: OverpassElement[],
  startPoint: Pick<GeocodeResult, "latitude" | "longitude">,
  existingStops: RouteStop[]
) {
  return findVerifiedRoadSegmentMatch(elements, startPoint, existingStops, {
    highwayPattern: arterialRoadPattern,
    buildCandidate: (way, _topology, point) => {
      if (!getWayName(way) || !hasLitTag(way.tags)) {
        return null;
      }

      return {
        point,
        addressHint: buildRoadAddressHint(way),
        verificationStatus: "verified",
        score:
          (way.tags?.highway === "primary" ? 7 : way.tags?.highway === "secondary" ? 5 : 3) +
          (getTotalLaneCount(way.tags) ?? 0) * 2 +
          Math.floor((parseMaxSpeed(way.tags) ?? 0) / 10)
      };
    }
  });
}

function findVerifiedCurbsideMatch(
  elements: OverpassElement[],
  startPoint: Pick<GeocodeResult, "latitude" | "longitude">,
  existingStops: RouteStop[]
) {
  return findVerifiedRoadSegmentMatch(elements, startPoint, existingStops, {
    highwayPattern: residentialRoadPattern,
    buildCandidate: (way, _topology, point) => {
      if (!getWayName(way) || !hasPositiveParkingTag(way.tags)) {
        return null;
      }

      const maxSpeed = parseMaxSpeed(way.tags) ?? 0;

      return {
        point,
        addressHint: buildRoadAddressHint(way),
        verificationStatus: "verified",
        score: 8 + (maxSpeed > 0 && maxSpeed <= 25 ? 2 : 0)
      };
    }
  });
}

function buildRoadNetworkQuery(
  latitude: number,
  longitude: number,
  radiusMeters: number,
  roadPattern: string,
  extraStatements: string[] = []
) {
  return `
[out:json][timeout:20];
way(around:${radiusMeters},${latitude},${longitude})[highway~"${roadPattern}"]->.roads;
node(w.roads)->.roadNodes;
(
  .roads;
  .roadNodes;
  ${extraStatements.join("\n  ")}
);
out body;`;
}

function buildOverpassQuery(
  startPoint: Pick<GeocodeResult, "latitude" | "longitude">,
  skillId: string | undefined,
  tag: string,
  radiusMeters: number
) {
  const lat = startPoint.latitude;
  const lon = startPoint.longitude;

  if (skillId === "four-way-stop") {
    return buildRoadNetworkQuery(
      lat,
      lon,
      radiusMeters,
      "primary|secondary|tertiary|unclassified|residential|living_street",
      [
        `node(w.roads)[highway=stop];`,
        `node(w.roads)[traffic_sign=stop];`
      ]
    );
  }

  switch (tag) {
    case "highway-on-ramp":
      return buildRoadNetworkQuery(
        lat,
        lon,
        radiusMeters,
        "motorway|trunk|motorway_link|trunk_link|primary|secondary|tertiary|unclassified|residential|living_street",
        [`node(around:${radiusMeters},${lat},${lon})[highway=motorway_junction];`]
      );
    case "freeway-connector":
      return buildRoadNetworkQuery(
        lat,
        lon,
        radiusMeters,
        "motorway|trunk|motorway_link|trunk_link|primary|secondary|tertiary|unclassified|residential|living_street",
        [`node(around:${radiusMeters},${lat},${lon})[highway=motorway_junction];`]
      );
    case "busy-intersection":
    case "signalized-left":
      return buildRoadNetworkQuery(
        lat,
        lon,
        radiusMeters,
        "trunk|primary|secondary|tertiary",
        [`node(around:${radiusMeters},${lat},${lon})[highway=traffic_signals];`]
      );
    case "multi-lane-arterial":
      return buildRoadNetworkQuery(
        lat,
        lon,
        radiusMeters,
        "primary|secondary|tertiary"
      );
    case "arterial":
    case "boulevard":
      return buildRoadNetworkQuery(lat, lon, radiusMeters, "primary|secondary|tertiary");
    case "residential-grid":
      return buildRoadNetworkQuery(
        lat,
        lon,
        radiusMeters,
        "residential|living_street|unclassified",
        [`node(around:${radiusMeters},${lat},${lon})[highway=stop];`]
      );
    case "curbside":
      return buildRoadNetworkQuery(lat, lon, radiusMeters, "residential|living_street|unclassified");
    case "well-lit-loop":
      return buildRoadNetworkQuery(lat, lon, radiusMeters, "primary|secondary|tertiary");
    default:
      return buildRoadNetworkQuery(
        lat,
        lon,
        radiusMeters,
        "motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street"
      );
  }
}

async function findNearbyFeatureForTag(
  skillId: string | undefined,
  tag: string,
  searchPoint: Pick<GeocodeResult, "latitude" | "longitude">,
  startPoint: Pick<GeocodeResult, "latitude" | "longitude">,
  existingStops: RouteStop[]
): Promise<FeatureMatch | null> {
  const radiusCandidates = skillId === "four-way-stop"
    ? [1800, 3200, 5500, 8000]
    : tag === "highway-on-ramp" || tag === "freeway-connector"
      ? [6000, 12000, 20000, 32000]
      : tag === "busy-intersection" || tag === "signalized-left"
        ? [5000, 9000, 15000]
        : tag === "multi-lane-arterial" || tag === "boulevard" || tag === "arterial" || tag === "well-lit-loop"
          ? [3500, 6500, 10000]
          : tag === "residential-grid" || tag === "curbside"
            ? [2500, 5000, 8000]
        : [2500, 5000];

  for (const radiusMeters of radiusCandidates) {
    const query = buildOverpassQuery(searchPoint, skillId, tag, radiusMeters);
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=UTF-8",
        "User-Agent": "RoadReady/0.1 (feature search)"
      },
      body: query,
      next: {
        revalidate: 0
      }
    });

    if (!response.ok) {
      continue;
    }

    const data = (await response.json()) as OverpassResponse;
    const elements = Array.isArray(data.elements) ? data.elements : [];
    if (skillId === "four-way-stop") {
      const verifiedFourWayStop = findVerifiedFourWayStopMatch(elements, startPoint, existingStops);
      if (verifiedFourWayStop) {
        return verifiedFourWayStop;
      }

      continue;
    }

    let verifiedMatch: FeatureMatch | null = null;
    switch (tag) {
      case "highway-on-ramp":
        verifiedMatch = findVerifiedRampMatch(elements, startPoint, existingStops, {
          connectorMode: false
        });
        break;
      case "freeway-connector":
        verifiedMatch = findVerifiedRampMatch(elements, startPoint, existingStops, {
          connectorMode: true
        });
        break;
      case "busy-intersection":
        verifiedMatch = findVerifiedSignalizedIntersectionMatch(elements, startPoint, existingStops, {
          requireLeftTurnLane: true,
          preferBusyIntersection: true,
          requireSpecificLeftTurnPath: false
        });
        break;
      case "signalized-left":
        verifiedMatch = findVerifiedSignalizedIntersectionMatch(elements, startPoint, existingStops, {
          requireLeftTurnLane: true,
          preferBusyIntersection: false,
          requireSpecificLeftTurnPath: true
        });
        break;
      case "multi-lane-arterial":
        verifiedMatch = findVerifiedMultiLaneArterialMatch(elements, startPoint, existingStops);
        break;
      case "boulevard":
        verifiedMatch = findVerifiedBoulevardMatch(elements, startPoint, existingStops);
        break;
      case "arterial":
        verifiedMatch = findVerifiedArterialMatch(elements, startPoint, existingStops);
        break;
      case "residential-grid":
        verifiedMatch = findVerifiedResidentialStopMatch(elements, startPoint, existingStops);
        break;
      case "curbside":
        verifiedMatch = findVerifiedCurbsideMatch(elements, startPoint, existingStops);
        break;
      case "well-lit-loop":
        verifiedMatch = findVerifiedLitRoadMatch(elements, startPoint, existingStops);
        break;
      default:
        verifiedMatch = null;
        break;
    }

    if (verifiedMatch) {
      return verifiedMatch;
    }
  }

  return null;
}

async function findNearbyFeatureForTarget(
  target: SkillTarget,
  searchPoints: Array<Pick<GeocodeResult, "latitude" | "longitude">>,
  startPoint: Pick<GeocodeResult, "latitude" | "longitude">,
  existingStops: RouteStop[]
) {
  for (const searchPoint of searchPoints) {
    for (const tag of target.tags) {
      const feature = await findNearbyFeatureForTag(
        target.skillId,
        tag,
        searchPoint,
        startPoint,
        existingStops
      );

      if (feature) {
        return {
          tag,
          feature
        };
      }
    }
  }

  return null;
}

async function snapToNearestRoad(point: Pick<GeocodeResult, "latitude" | "longitude">) {
  const url = new URL(
    `https://router.project-osrm.org/nearest/v1/driving/${point.longitude},${point.latitude}`
  );
  url.searchParams.set("number", "1");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "RoadReady/0.1 (road snapping)"
    },
    next: {
      revalidate: 0
    }
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as OsrmNearestResponse;
  const location = data.waypoints?.[0]?.location;
  if (!location || location.length < 2) {
    return null;
  }

  return {
    latitude: location[1],
    longitude: location[0]
  };
}

async function reverseGeocodePoint(point: Pick<GeocodeResult, "latitude" | "longitude">) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(point.latitude));
  url.searchParams.set("lon", String(point.longitude));

  const response = await fetch(url, {
    headers: {
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": "RoadReady/0.1 (reverse geocode)"
    },
    next: {
      revalidate: 0
    }
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { display_name?: string };
  return data.display_name ?? null;
}

async function normalizeStopPoint(
  result: GeocodeResult,
  options?: {
    preferredAddress?: string;
  }
) {
  const snapped = (await snapToNearestRoad(result)) ?? {
    latitude: result.latitude,
    longitude: result.longitude
  };
  const address =
    options?.preferredAddress ??
    (await reverseGeocodePoint(snapped)) ??
    result.address;

  return {
    latitude: snapped.latitude,
    longitude: snapped.longitude,
    address
  } satisfies GeocodeResult;
}

function dedupeSearchPoints(points: Array<Pick<GeocodeResult, "latitude" | "longitude">>) {
  return points.filter(
    (point, pointIndex, collection) =>
      collection.findIndex(
        (candidatePoint) =>
          Math.abs(candidatePoint.latitude - point.latitude) < 0.0001 &&
          Math.abs(candidatePoint.longitude - point.longitude) < 0.0001
      ) === pointIndex
  );
}

async function resolveCandidateSearchAnchors(
  candidate: SuggestedStop,
  startPoint: GeocodeResult
) {
  const resolvedAnchors: GeocodeResult[] = [];
  const searchQueries = normalizeQueryList([candidate.searchQuery, ...(candidate.alternateQueries ?? [])]).slice(0, 5);

  for (const searchQuery of searchQueries) {
    const geocoded = await geocodeQuery(searchQuery, startPoint);
    if (!geocoded || distanceKm(startPoint, geocoded) > 40) {
      continue;
    }

    const alreadyIncluded = resolvedAnchors.some(
      (anchor) =>
        Math.abs(anchor.latitude - geocoded.latitude) < 0.0001 &&
        Math.abs(anchor.longitude - geocoded.longitude) < 0.0001
    );
    if (!alreadyIncluded) {
      resolvedAnchors.push(geocoded);
    }
  }

  return resolvedAnchors;
}

async function findVerifiedFeatureForCandidate(
  target: SkillTarget,
  candidate: SuggestedStop,
  startPoint: GeocodeResult,
  existingStops: RouteStop[]
) {
  const searchAnchors = await resolveCandidateSearchAnchors(candidate, startPoint);
  const searchPoints = dedupeSearchPoints([...searchAnchors, startPoint]);
  const prioritizedTarget: SkillTarget = {
    ...target,
    primaryTag: candidate.tag,
    tags: [candidate.tag, ...target.tags.filter((tag) => tag !== candidate.tag)]
  };

  return findNearbyFeatureForTarget(prioritizedTarget, searchPoints, startPoint, existingStops);
}

function mergeSkillIntoSegment(segment: RouteStop, focusLabels: string[]) {
  const existingLabels = segment.focusSkillLabels ?? [];
  const newLabels = focusLabels.filter((label) => !existingLabels.includes(label));
  if (!newLabels.length) {
    return;
  }

  segment.focusSkillLabels = [...existingLabels, ...newLabels];
  if (!segment.reason.toLowerCase().includes("also reinforces")) {
    segment.reason = `${segment.reason} Also reinforces ${formatSkillLabelList(newLabels).toLowerCase()}.`;
  }
}

function buildVerifiedFailureMessage(request: RouteRequest, target: SkillTarget) {
  const tailoredSuggestion =
    target.skillId === "highway-merge"
      ? "Try a start point closer to a known freeway entrance or arterial that feeds an on-ramp."
      : target.skillId === "unprotected-left"
        ? "Try a start point closer to a signalized commercial corridor with dedicated turn lanes."
        : target.skillId === "four-way-stop"
          ? "Try a quieter neighborhood intersection with clearly mapped stop-sign control."
          : "Try a more specific start point or nearby intersection.";

  return `RoadReady's AI planner could not map-verify a ${target.skillLabel.toLowerCase()} segment near ${request.startLocation}. ${tailoredSuggestion}`;
}

function formatRoadName(name: string) {
  return name.trim() || "the road ahead";
}

function describeManeuver(step: {
  name: string;
  maneuver?: {
    type?: string;
    modifier?: string;
  };
}) {
  const maneuverType = step.maneuver?.type ?? "continue";
  const modifier = step.maneuver?.modifier;
  const roadName = formatRoadName(step.name);

  switch (maneuverType) {
    case "depart":
      return `Start out toward ${roadName}.`;
    case "arrive":
      return "Arrive at this stop.";
    case "turn":
      return modifier ? `Turn ${modifier} onto ${roadName}.` : `Turn onto ${roadName}.`;
    case "new name":
      return `Continue onto ${roadName}.`;
    case "merge":
      return modifier ? `Merge ${modifier} onto ${roadName}.` : `Merge onto ${roadName}.`;
    case "on ramp":
      return modifier ? `Take the ${modifier} ramp onto ${roadName}.` : `Take the ramp onto ${roadName}.`;
    case "off ramp":
      return modifier ? `Take the ${modifier} exit toward ${roadName}.` : `Take the exit toward ${roadName}.`;
    case "fork":
      return modifier ? `Keep ${modifier} toward ${roadName}.` : `Keep toward ${roadName}.`;
    case "roundabout":
    case "rotary":
      return `Enter the roundabout and continue toward ${roadName}.`;
    case "end of road":
      return modifier ? `At the end of the road, turn ${modifier}.` : "At the end of the road, turn.";
    case "continue":
    case "notification":
      return `Continue on ${roadName}.`;
    default:
      return modifier ? `${maneuverType} ${modifier} toward ${roadName}.` : `Continue toward ${roadName}.`;
  }
}

function mapRouteSteps(
  steps: Array<{
    distance: number;
    duration: number;
    name: string;
    maneuver?: {
      type?: string;
      modifier?: string;
    };
  }>
): RouteDirectionStep[] {
  return steps
    .filter((step) => step.distance > 0 || step.maneuver?.type === "arrive")
    .map((step) => ({
      instruction: describeManeuver(step),
      distanceMeters: step.distance,
      durationSeconds: step.duration,
      roadName: step.name || undefined,
      maneuverType: step.maneuver?.type,
      maneuverModifier: step.maneuver?.modifier
    }));
}

async function buildRoadRoute(
  startPoint: GeocodeResult,
  route: Pick<RoutePlan, "startLocation" | "segments">
): Promise<{
  routePath: RouteCoordinate[];
  routeLegs: RouteLeg[];
} | null> {
  const waypoints = [
    [startPoint.longitude, startPoint.latitude],
    ...route.segments.map((segment) => [segment.longitude, segment.latitude] as [number, number]),
    [startPoint.longitude, startPoint.latitude]
  ];
  const coordinateString = waypoints.map(([longitude, latitude]) => `${longitude},${latitude}`).join(";");
  const url = new URL(`https://router.project-osrm.org/route/v1/driving/${coordinateString}`);
  url.searchParams.set("steps", "true");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("overview", "full");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "RoadReady/0.1 (road routing)"
    },
    next: {
      revalidate: 0
    }
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as OsrmRouteResponse;
  if (data.code !== "Ok" || !data.routes?.[0]) {
    return null;
  }

  const firstRoute = data.routes[0];
  const geometry = firstRoute.geometry?.coordinates ?? [];
  const routePath = geometry.map(([longitude, latitude]) => ({
    latitude,
    longitude
  }));
  const labels = [
    route.startLocation,
    ...route.segments.map((segment) => segment.title),
    "Start / finish"
  ];
  const routeLegs =
    firstRoute.legs?.map((leg, index) => ({
      id: `leg-${index}`,
      fromLabel: labels[index] ?? `Stop ${index}`,
      toLabel: labels[index + 1] ?? "Destination",
      distanceMeters: leg.distance,
      durationSeconds: leg.duration,
      steps: mapRouteSteps(leg.steps ?? [])
    })) ?? [];

  if (!routePath.length || !routeLegs.length) {
    return null;
  }

  return { routePath, routeLegs };
}

export async function generateSmartRoutePlan(
  skills: SkillDefinition[],
  recommendations: Recommendation[],
  request: RouteRequest
): Promise<RoutePlan> {
  const explicitStartPoint =
    typeof request.startLatitude === "number" &&
    Number.isFinite(request.startLatitude) &&
    typeof request.startLongitude === "number" &&
    Number.isFinite(request.startLongitude)
      ? {
          latitude: request.startLatitude,
          longitude: request.startLongitude,
          address: request.startLocation
        }
      : parseCoordinateLocation(request.startLocation);
  const startPoint = explicitStartPoint ?? (await geocodeQuery(request.startLocation));
  if (!startPoint) {
    throw new RouteGenerationError("RoadReady could not locate that starting point precisely. Try a more specific address or intersection.");
  }

  const tags = canonicalizeTags(skills, request);
  const skillTargets = buildSkillTargets(skills, request);
  const tagFocusMap = buildTagFocusMap(skills, request);
  const aiStops = await suggestStopsWithOpenAI(request, recommendations, tags);
  const candidates = buildCandidateStopsForSkills(request.startLocation, skillTargets, aiStops);
  const segments: RouteStop[] = [];
  let usedAIPlanning = candidates.some((candidate) => candidate.source === "ai");

  for (const [index, target] of skillTargets.entries()) {
    let activeCandidate = candidates[index];
    let featureMatch = await findVerifiedFeatureForCandidate(target, activeCandidate, startPoint, segments);
    if (!featureMatch) {
      const aiRetryCandidates = await suggestStopRetriesWithOpenAI(request, target, activeCandidate);
      if (aiRetryCandidates?.length) {
        usedAIPlanning = true;
      }

      for (const retryCandidate of aiRetryCandidates ?? []) {
        activeCandidate = retryCandidate;
        featureMatch = await findVerifiedFeatureForCandidate(target, activeCandidate, startPoint, segments);
        if (featureMatch) {
          break;
        }
      }
    }

    const resolvedTag = featureMatch?.tag ?? activeCandidate.tag ?? target.primaryTag;
    const focusLabels = activeCandidate.skillLabel ? [activeCandidate.skillLabel] : tagFocusMap[resolvedTag] ?? [];
    if (!featureMatch) {
      throw new RouteGenerationError(buildVerifiedFailureMessage(request, target));
    }

    const resolved = {
      latitude: featureMatch.feature.point.latitude,
      longitude: featureMatch.feature.point.longitude,
      address: featureMatch.feature.addressHint ?? activeCandidate.searchQuery
    };

    const nearbyExistingSegment = segments.find(
      (segment) =>
        distanceKm(
          { latitude: segment.latitude, longitude: segment.longitude },
          { latitude: resolved.latitude, longitude: resolved.longitude }
        ) < 0.35
    );

    if (nearbyExistingSegment) {
      mergeSkillIntoSegment(nearbyExistingSegment, focusLabels);
      continue;
    }

    const normalizedStop = await normalizeStopPoint(resolved, {
      preferredAddress: featureMatch.feature.addressHint
    });
    const verifiedMovementLabel =
      resolvedTag === "signalized-left" && featureMatch.feature.addressHint?.startsWith("Left from ")
        ? featureMatch.feature.addressHint
        : undefined;
    const resolvedReasonBase =
      verifiedMovementLabel
        ? `Verified left-turn movement: ${verifiedMovementLabel}. ${activeCandidate.reason}`
        : activeCandidate.reason;

    segments.push({
      id: `${target.skillId}-${segments.length}`,
      tag: resolvedTag,
      title: verifiedMovementLabel ?? buildSkillFocusedTitle(resolvedTag, focusLabels) ?? activeCandidate.title,
      address: normalizedStop.address,
      reason: resolvedReasonBase,
      focusSkillLabels: focusLabels,
      etaMinutes: 5 + segments.length * 6,
      latitude: normalizedStop.latitude,
      longitude: normalizedStop.longitude,
      source: "resolved",
      verificationStatus: "verified"
    });
  }

  if (!segments.length) {
    throw new RouteGenerationError("RoadReady could not verify a route for that start point yet. Try a more specific location.");
  }

  const estimatedMinutes = request.difficulty === "gentle" ? 18 : request.difficulty === "stretch" ? 30 : 24;
  const roadRoute = await buildRoadRoute(startPoint, {
    startLocation: request.startLocation,
    segments
  });

  if (!roadRoute) {
    throw new RouteGenerationError(
      "RoadReady planned verified practice stops but could not connect them into a drivable road route from this start point. Try a nearby intersection or a slightly different starting point."
    );
  }

  const aiGuidance = await buildRouteGuidanceWithOpenAI(request, recommendations, {
    difficulty: request.difficulty,
    estimatedMinutes,
    segments
  });
  const usedAI = usedAIPlanning || Boolean(aiGuidance);

  return {
    id: `route-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    startLocation: request.startLocation,
    startLatitude: startPoint.latitude,
    startLongitude: startPoint.longitude,
    estimatedMinutes,
    difficulty: request.difficulty,
    prioritySkillIds: request.skillIds,
    explanation: aiGuidance?.explanation ?? buildExplanation(request, recommendations),
    coachNote: aiGuidance?.coachNote ?? buildFallbackCoachNote({ difficulty: request.difficulty, segments }),
    segments,
    routePath: roadRoute.routePath,
    routeLegs: roadRoute.routeLegs,
    generationSource: usedAI ? "ai-assisted" : "rules-based",
    routingSource: "road-route",
    approvalStatus: "pending"
  };
}
