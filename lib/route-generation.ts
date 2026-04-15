import { generateRoutePlan } from "@/lib/logic";
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

type SuggestedStop = {
  title: string;
  searchQuery: string;
  reason: string;
  tag: string;
  skillId?: string;
  skillLabel?: string;
  source?: "ai" | "heuristic";
};

type GeocodeResult = {
  latitude: number;
  longitude: number;
  address: string;
};

type RawFallbackStop = {
  skillId: string;
  skillLabel: string;
  tag: string;
  title: string;
  reason: string;
  address: string;
  etaMinutes: number;
  latitude: number;
  longitude: number;
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
  center?: {
    lat: number;
    lon: number;
  };
  tags?: Record<string, string>;
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

const strictFeatureTags = new Set([
  "highway-on-ramp",
  "freeway-connector",
  "busy-intersection",
  "signalized-left"
]);

type SkillTarget = {
  skillId: string;
  skillLabel: string;
  skillDescription: string;
  tags: string[];
  primaryTag: string;
};

function isStrictSkillTarget(target: SkillTarget) {
  return target.skillId === "four-way-stop" || target.tags.some((tag) => strictFeatureTags.has(tag));
}

function formatSkillLabelList(labels: string[]) {
  if (labels.length <= 1) {
    return labels[0] ?? "";
  }

  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }

  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
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
  return startLocation.split(",")[0]?.trim() || startLocation.trim();
}

function buildHeuristicStops(
  startLocation: string,
  skillTargets: SkillTarget[]
): SuggestedStop[] {
  const city = extractCity(startLocation);

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
      searchQuery: `${descriptor.searchHint} near ${startLocation}`,
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
      source: "ai" as const
    };
  });
}

async function suggestStopsWithOpenAI(
  request: RouteRequest,
  recommendations: Recommendation[],
  tags: string[]
): Promise<SuggestedStop[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.OPENAI_ROUTE_MODEL ?? "gpt-4.1-mini";
  const priorityLabels = recommendations
    .filter((entry) => request.skillIds.includes(entry.skillId))
    .map((entry) => entry.label)
    .slice(0, 4);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      instructions:
        "You generate nearby driving-practice stop suggestions. Return only valid JSON. " +
        "Choose public, drivable road locations near the provided starting area. " +
        "Avoid parks, golf courses, private campuses, trails, bodies of water, parking lots unless the skill explicitly needs curb parking, and vague non-road landmarks. " +
        "Each stop needs a human-readable title, a geocodable searchQuery, a short reason, and the provided tag.",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                `Start location: ${request.startLocation}\n` +
                `Difficulty: ${request.difficulty}\n` +
                `Priority skills: ${priorityLabels.join(", ") || "general practice"}\n` +
                `Canonical route tags: ${tags.join(", ")}\n` +
                'Return JSON with shape {"stops":[{"title":"...","searchQuery":"...","reason":"...","tag":"..."}]}. ' +
                "Return 3 to 4 stops total."
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_object"
        }
      }
    })
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { output_text?: string };
  if (!data.output_text) {
    return null;
  }

  try {
    const parsed = JSON.parse(data.output_text) as { stops?: SuggestedStop[] };
    if (!Array.isArray(parsed.stops)) {
      return null;
    }

    return parsed.stops
      .filter(
        (stop) =>
          typeof stop?.title === "string" &&
          typeof stop?.searchQuery === "string" &&
          typeof stop?.reason === "string" &&
          typeof stop?.tag === "string"
      )
      .slice(0, 4);
  } catch {
    return null;
  }
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

function buildFallbackTitle(tag: string, focusLabels: string[]) {
  const primaryFocus = focusLabels[0];
  if (primaryFocus) {
    return `Approximate ${primaryFocus} practice`;
  }

  return `Approximate ${stopDescriptors[tag]?.title.toLowerCase() ?? "practice area"}`;
}

function getOverpassPoint(element: OverpassElement) {
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

  return null;
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
    return `
[out:json][timeout:20];
(
  node(around:${radiusMeters},${lat},${lon})[highway=stop];
);
out 40;`;
  }

  switch (tag) {
    case "highway-on-ramp":
      return `
[out:json][timeout:20];
(
  way(around:${radiusMeters},${lat},${lon})[highway~"motorway_link|trunk_link"];
  node(around:${radiusMeters},${lat},${lon})[highway=motorway_junction];
);
out center 12;`;
    case "freeway-connector":
      return `
[out:json][timeout:20];
(
  way(around:${radiusMeters},${lat},${lon})[highway~"motorway|trunk|motorway_link|trunk_link"];
);
out center 12;`;
    case "busy-intersection":
    case "signalized-left":
      return `
[out:json][timeout:20];
(
  node(around:${radiusMeters},${lat},${lon})[highway=traffic_signals];
);
out 12;`;
    case "multi-lane-arterial":
      return `
[out:json][timeout:20];
(
  way(around:${radiusMeters},${lat},${lon})[highway~"primary|secondary"][lanes];
);
out center 12;`;
    case "arterial":
    case "boulevard":
      return `
[out:json][timeout:20];
(
  way(around:${radiusMeters},${lat},${lon})[highway~"primary|secondary|tertiary"];
);
out center 12;`;
    case "residential-grid":
    case "curbside":
      return `
[out:json][timeout:20];
(
  way(around:${radiusMeters},${lat},${lon})[highway~"residential|living_street|unclassified"];
);
out center 12;`;
    case "well-lit-loop":
      return `
[out:json][timeout:20];
(
  way(around:${radiusMeters},${lat},${lon})[highway~"primary|secondary"][lit=yes];
  way(around:${radiusMeters},${lat},${lon})[highway~"primary|secondary|tertiary"];
);
out center 12;`;
    default:
      return `
[out:json][timeout:20];
(
  way(around:${radiusMeters},${lat},${lon})[highway];
);
out center 12;`;
  }
}

async function findNearbyFeatureForTag(
  skillId: string | undefined,
  tag: string,
  startPoint: Pick<GeocodeResult, "latitude" | "longitude">,
  existingStops: RouteStop[],
  options?: {
    allowApproximate?: boolean;
  }
) {
  const allowApproximate = Boolean(options?.allowApproximate);
  const radiusCandidates = skillId === "four-way-stop"
    ? [1800, 3200, 5500, 8000]
    : tag === "highway-on-ramp" || tag === "freeway-connector"
      ? [6000, 12000, 20000, 32000]
      : strictFeatureTags.has(tag)
        ? [5000, 9000, 15000]
        : [2500, 5000];

  for (const radiusMeters of radiusCandidates) {
    const query = buildOverpassQuery(startPoint, skillId, tag, radiusMeters);
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
    const stopNodes = skillId === "four-way-stop"
      ? elements
          .map((element) => getOverpassPoint(element))
          .filter((point): point is NonNullable<typeof point> => Boolean(point))
      : [];
    const rankedPoints = elements
      .map((element) => {
        const point = getOverpassPoint(element);
        if (!point) {
          return null;
        }

        const distanceFromStart = distanceKm(startPoint, point);
        const distanceFromExisting = existingStops.length
          ? Math.min(
              ...existingStops.map((segment) =>
                distanceKm(
                  { latitude: segment.latitude, longitude: segment.longitude },
                  point
                )
              )
            )
          : Number.POSITIVE_INFINITY;
        const nearbyStopCount =
          skillId === "four-way-stop"
            ? stopNodes.filter((candidate) => distanceKm(candidate, point) < 0.06).length
            : 0;

        return {
          point,
          distanceFromStart,
          distanceFromExisting,
          nearbyStopCount,
          hasAllWayStopTag: element.tags?.stop === "all"
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .filter((entry) => entry.distanceFromExisting > 0.2)
      .filter((entry) =>
        skillId === "four-way-stop"
          ? entry.hasAllWayStopTag || entry.nearbyStopCount >= (allowApproximate ? 2 : 3)
          : true
      )
      .sort((a, b) =>
        skillId === "four-way-stop"
          ? Number(b.hasAllWayStopTag) - Number(a.hasAllWayStopTag) ||
            b.nearbyStopCount - a.nearbyStopCount ||
            a.distanceFromStart - b.distanceFromStart
          : a.distanceFromStart - b.distanceFromStart
      );

    if (rankedPoints[0]) {
      return rankedPoints[0].point;
    }
  }

  return null;
}

async function findNearbyFeatureForTarget(
  target: SkillTarget,
  startPoint: Pick<GeocodeResult, "latitude" | "longitude">,
  existingStops: RouteStop[],
  options?: {
    allowApproximate?: boolean;
  }
) {
  for (const tag of target.tags) {
    const point = await findNearbyFeatureForTag(target.skillId, tag, startPoint, existingStops, options);

    if (point) {
      return {
        tag,
        point
      };
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

async function normalizeStopPoint(result: GeocodeResult) {
  const snapped = (await snapToNearestRoad(result)) ?? {
    latitude: result.latitude,
    longitude: result.longitude
  };
  const address = (await reverseGeocodePoint(snapped)) ?? result.address;

  return {
    latitude: snapped.latitude,
    longitude: snapped.longitude,
    address
  } satisfies GeocodeResult;
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function moveCoordinate(
  origin: Pick<GeocodeResult, "latitude" | "longitude">,
  distanceKm: number,
  bearingDegrees: number
) {
  const earthRadiusKm = 6371;
  const angularDistance = distanceKm / earthRadiusKm;
  const bearingRadians = (bearingDegrees * Math.PI) / 180;
  const startLatitude = (origin.latitude * Math.PI) / 180;
  const startLongitude = (origin.longitude * Math.PI) / 180;

  const latitude = Math.asin(
    Math.sin(startLatitude) * Math.cos(angularDistance) +
      Math.cos(startLatitude) * Math.sin(angularDistance) * Math.cos(bearingRadians)
  );

  const longitude =
    startLongitude +
    Math.atan2(
      Math.sin(bearingRadians) * Math.sin(angularDistance) * Math.cos(startLatitude),
      Math.cos(angularDistance) - Math.sin(startLatitude) * Math.sin(latitude)
    );

  return {
    latitude: (latitude * 180) / Math.PI,
    longitude: (longitude * 180) / Math.PI
  };
}

function buildFallbackSegmentsNearStart(
  startPoint: GeocodeResult,
  skillTargets: SkillTarget[],
  startLocation: string,
  tagFocusMap: Record<string, string[]>
): RawFallbackStop[] {
  const seed = hashString(
    `${startLocation}:${startPoint.latitude.toFixed(5)}:${startPoint.longitude.toFixed(5)}`
  );

  return skillTargets.map((target, index) => {
    const tag = target.primaryTag;
    const descriptor = stopDescriptors[tag] ?? {
      title: "Practice stop",
      searchHint: "public road",
      reason: "Selected to reinforce the current priority skill mix."
    };
    const tagSeed = hashString(`${tag}:${seed}:${index}`);
    const bearing = (tagSeed % 360 + index * 67) % 360;
    const distanceKm = 0.45 + ((tagSeed % 6) * 0.18 + index * 0.12);
    const coordinate = moveCoordinate(startPoint, distanceKm, bearing);
    const focusLabels = tagFocusMap[tag] ?? [];

    return {
      skillId: target.skillId,
      skillLabel: target.skillLabel,
      tag,
      title: buildFallbackTitle(tag, focusLabels),
      address: `Approximate road segment about ${distanceKm.toFixed(1)} km from ${startLocation}`,
      reason: focusLabels.length
        ? `Approximate fallback for ${focusLabels.join(" and ")} near your selected start point.`
        : "Generated as a nearby fallback around your selected start point. Confirm this stop matches the intended maneuver before driving it.",
      etaMinutes: 5 + index * 6,
      latitude: coordinate.latitude,
      longitude: coordinate.longitude
    };
  });
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
    return generateRoutePlan(skills, recommendations, request);
  }

  const tags = canonicalizeTags(skills, request);
  const skillTargets = buildSkillTargets(skills, request);
  const tagFocusMap = buildTagFocusMap(skills, request);
  const aiStops = await suggestStopsWithOpenAI(request, recommendations, tags);
  const candidates = buildCandidateStopsForSkills(request.startLocation, skillTargets, aiStops);
  const segments: RouteStop[] = [];
  const warnings = new Set<string>();

  for (const [index, target] of skillTargets.entries()) {
    const candidate = candidates[index];
    const featureMatch = await findNearbyFeatureForTarget(target, startPoint, segments);
    const resolvedTag = featureMatch?.tag ?? candidate.tag ?? target.primaryTag;
    const requiresVerifiedFeature = isStrictSkillTarget(target);
    const focusLabels = candidate.skillLabel ? [candidate.skillLabel] : tagFocusMap[resolvedTag] ?? [];
    const resolved =
      featureMatch
        ? {
            latitude: featureMatch.point.latitude,
            longitude: featureMatch.point.longitude,
            address: candidate.searchQuery
          }
        : requiresVerifiedFeature
          ? null
          : await geocodeQuery(candidate.searchQuery, startPoint);
    if (!resolved) {
      if (requiresVerifiedFeature) {
        const approximateFeatureMatch = await findNearbyFeatureForTarget(target, startPoint, segments, {
          allowApproximate: true
        });

        if (approximateFeatureMatch) {
          const normalizedApproximateStop = await normalizeStopPoint({
            latitude: approximateFeatureMatch.point.latitude,
            longitude: approximateFeatureMatch.point.longitude,
            address: candidate.searchQuery
          });

          segments.push({
            id: `${target.skillId}-${segments.length}`,
            tag: approximateFeatureMatch.tag,
            title: buildFallbackTitle(approximateFeatureMatch.tag, focusLabels),
            address: normalizedApproximateStop.address,
            reason: `${candidate.reason} Nearby map data suggests this is an approximate match, so confirm the maneuver before driving it.`,
            focusSkillLabels: focusLabels,
            etaMinutes: 5 + segments.length * 6,
            latitude: normalizedApproximateStop.latitude,
            longitude: normalizedApproximateStop.longitude,
            source: "fallback",
            verificationStatus: "approximate"
          });
        }
      }

      continue;
    }

    const tooCloseToExisting = segments.some(
      (segment) =>
        distanceKm(
          { latitude: segment.latitude, longitude: segment.longitude },
          { latitude: resolved.latitude, longitude: resolved.longitude }
        ) < 0.35
    );

    if (tooCloseToExisting) {
      continue;
    }

    const normalizedStop = await normalizeStopPoint(resolved);

    segments.push({
      id: `${target.skillId}-${segments.length}`,
      tag: resolvedTag,
      title: buildSkillFocusedTitle(resolvedTag, focusLabels) || candidate.title,
      address: normalizedStop.address,
      reason: featureMatch
        ? candidate.reason
        : `${candidate.reason} Preview this stop in Maps to confirm it matches the intended maneuver before driving it.`,
      focusSkillLabels: focusLabels,
      etaMinutes: 5 + segments.length * 6,
      latitude: normalizedStop.latitude,
      longitude: normalizedStop.longitude,
      source: "resolved",
      verificationStatus: featureMatch ? "verified" : "approximate"
    });
  }

  const coveredSkillLabels = new Set(segments.flatMap((segment) => segment.focusSkillLabels ?? []));
  const uncoveredSkillTargets = skillTargets.filter((target) => !coveredSkillLabels.has(target.skillLabel));
  const approximateFallbackTargets = uncoveredSkillTargets.filter((target) => !isStrictSkillTarget(target));
  const fallbackSegments = buildFallbackSegmentsNearStart(
    startPoint,
    approximateFallbackTargets,
    request.startLocation,
    tagFocusMap
  );

  for (const fallbackSegment of fallbackSegments) {
    const tooCloseToExisting = segments.some(
      (segment) =>
        distanceKm(
          { latitude: segment.latitude, longitude: segment.longitude },
          { latitude: fallbackSegment.latitude, longitude: fallbackSegment.longitude }
        ) < 0.25
    );

    if (tooCloseToExisting) {
      continue;
    }

    const normalizedFallback = await normalizeStopPoint({
      latitude: fallbackSegment.latitude,
      longitude: fallbackSegment.longitude,
      address: fallbackSegment.address
    });

    segments.push({
      id: `${fallbackSegment.tag}-${segments.length}`,
      tag: fallbackSegment.tag,
      title: fallbackSegment.title,
      address: normalizedFallback.address,
      reason: fallbackSegment.reason,
      focusSkillLabels: [fallbackSegment.skillLabel],
      etaMinutes: fallbackSegment.etaMinutes,
      latitude: normalizedFallback.latitude,
      longitude: normalizedFallback.longitude,
      source: "fallback",
      verificationStatus: "approximate"
    });
  }

  const finalCoveredSkillLabels = new Set(segments.flatMap((segment) => segment.focusSkillLabels ?? []));
  const missingSkillTargets = skillTargets.filter((target) => !finalCoveredSkillLabels.has(target.skillLabel));
  const strictMissingSkillTargets = missingSkillTargets.filter((target) => isStrictSkillTarget(target));

  if (strictMissingSkillTargets.length) {
    warnings.add(
      `Couldn't verify nearby practice stops for ${formatSkillLabelList(
        strictMissingSkillTargets.map((target) => target.skillLabel)
      )}. Try a more specific start point or preview nearby intersections in Maps before practicing that skill.`
    );
  }

  if (segments.some((segment) => segment.verificationStatus !== "verified")) {
    warnings.add(
      "Some stops are approximate area suggestions instead of map-verified maneuvers. Open each stop in Maps before using it for a skill-specific practice drive."
    );
  }

  if (!segments.length) {
    return generateRoutePlan(skills, recommendations, request);
  }

  const estimatedMinutes = request.difficulty === "gentle" ? 18 : request.difficulty === "stretch" ? 30 : 24;
  const roadRoute = await buildRoadRoute(startPoint, {
    startLocation: request.startLocation,
    segments
  });

  return {
    id: `route-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    startLocation: request.startLocation,
    startLatitude: startPoint.latitude,
    startLongitude: startPoint.longitude,
    estimatedMinutes,
    difficulty: request.difficulty,
    prioritySkillIds: request.skillIds,
    explanation: buildExplanation(request, recommendations),
    segments,
    routePath: roadRoute?.routePath,
    routeLegs: roadRoute?.routeLegs,
    generationSource: candidates.some((candidate) => candidate.source === "ai") ? "ai-assisted" : "rules-based",
    routingSource: roadRoute ? "road-route" : "straight-line",
    warnings: warnings.size ? [...warnings] : undefined
  };
}
