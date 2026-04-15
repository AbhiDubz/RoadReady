import {
  AppState,
  OnboardingInput,
  PracticeSession,
  SkillDefinition,
  SkillProgress,
  UserProfile
} from "@/lib/types";

type StateMetadata = {
  code: string;
  label: string;
  defaultCity: string;
  latitude: number;
  longitude: number;
};

const baseSkills: Omit<SkillDefinition, "stateCode">[] = [
  {
    id: "smooth-braking",
    category: "Basic Control",
    label: "Smooth braking",
    description: "Brake gradually without jolting the vehicle or stopping too late.",
    requiredForTest: true,
    routeTags: ["gentle-stop-zone", "school-zone"]
  },
  {
    id: "lane-position",
    category: "Basic Control",
    label: "Lane position",
    description: "Maintain centered lane placement through straightaways and curves.",
    requiredForTest: true,
    routeTags: ["arterial", "curved-road"]
  },
  {
    id: "four-way-stop",
    category: "Intersections",
    label: "4-way stops",
    description: "Handle arrival order, eye contact, and full stops with confidence.",
    requiredForTest: true,
    routeTags: ["residential-grid", "stop-controlled"]
  },
  {
    id: "unprotected-left",
    category: "Intersections",
    label: "Unprotected left turns",
    description: "Judge gaps, keep wheels straight, and complete the turn smoothly.",
    requiredForTest: true,
    routeTags: ["busy-intersection", "signalized-left"]
  },
  {
    id: "lane-change",
    category: "Road Types",
    label: "Multi-lane lane changes",
    description: "Mirror, signal, blind spot, and merge with stable speed control.",
    requiredForTest: true,
    routeTags: ["multi-lane-arterial", "boulevard"]
  },
  {
    id: "parallel-parking",
    category: "Maneuvers",
    label: "Parallel parking",
    description: "Set up correctly and reverse smoothly into a curbside space.",
    requiredForTest: false,
    routeTags: ["curbside", "quiet-block"]
  },
  {
    id: "night-driving",
    category: "Conditions",
    label: "Night driving",
    description: "Drive safely with reduced visibility and increased scan distance.",
    requiredForTest: false,
    routeTags: ["well-lit-loop", "suburban-evening"]
  },
  {
    id: "highway-merge",
    category: "Highway Skills",
    label: "Highway merge",
    description: "Use ramp speed confidently and merge into faster traffic safely.",
    requiredForTest: true,
    routeTags: ["highway-on-ramp", "freeway-connector"]
  }
];

export const stateCatalog: StateMetadata[] = [
  { code: "AL", label: "Alabama", defaultCity: "Birmingham", latitude: 33.5186, longitude: -86.8104 },
  { code: "AK", label: "Alaska", defaultCity: "Anchorage", latitude: 61.2181, longitude: -149.9003 },
  { code: "AZ", label: "Arizona", defaultCity: "Phoenix", latitude: 33.4484, longitude: -112.074 },
  { code: "AR", label: "Arkansas", defaultCity: "Little Rock", latitude: 34.7465, longitude: -92.2896 },
  { code: "CA", label: "California", defaultCity: "Cupertino", latitude: 37.323, longitude: -122.0322 },
  { code: "CO", label: "Colorado", defaultCity: "Denver", latitude: 39.7392, longitude: -104.9903 },
  { code: "CT", label: "Connecticut", defaultCity: "Hartford", latitude: 41.7658, longitude: -72.6734 },
  { code: "DE", label: "Delaware", defaultCity: "Wilmington", latitude: 39.7447, longitude: -75.5484 },
  { code: "FL", label: "Florida", defaultCity: "Orlando", latitude: 28.5383, longitude: -81.3792 },
  { code: "GA", label: "Georgia", defaultCity: "Atlanta", latitude: 33.749, longitude: -84.388 },
  { code: "HI", label: "Hawaii", defaultCity: "Honolulu", latitude: 21.3069, longitude: -157.8583 },
  { code: "ID", label: "Idaho", defaultCity: "Boise", latitude: 43.615, longitude: -116.2023 },
  { code: "IL", label: "Illinois", defaultCity: "Chicago", latitude: 41.8781, longitude: -87.6298 },
  { code: "IN", label: "Indiana", defaultCity: "Indianapolis", latitude: 39.7684, longitude: -86.1581 },
  { code: "IA", label: "Iowa", defaultCity: "Des Moines", latitude: 41.5868, longitude: -93.625 },
  { code: "KS", label: "Kansas", defaultCity: "Wichita", latitude: 37.6872, longitude: -97.3301 },
  { code: "KY", label: "Kentucky", defaultCity: "Louisville", latitude: 38.2527, longitude: -85.7585 },
  { code: "LA", label: "Louisiana", defaultCity: "Baton Rouge", latitude: 30.4515, longitude: -91.1871 },
  { code: "ME", label: "Maine", defaultCity: "Portland", latitude: 43.6591, longitude: -70.2568 },
  { code: "MD", label: "Maryland", defaultCity: "Baltimore", latitude: 39.2904, longitude: -76.6122 },
  { code: "MA", label: "Massachusetts", defaultCity: "Boston", latitude: 42.3601, longitude: -71.0589 },
  { code: "MI", label: "Michigan", defaultCity: "Detroit", latitude: 42.3314, longitude: -83.0458 },
  { code: "MN", label: "Minnesota", defaultCity: "Minneapolis", latitude: 44.9778, longitude: -93.265 },
  { code: "MS", label: "Mississippi", defaultCity: "Jackson", latitude: 32.2988, longitude: -90.1848 },
  { code: "MO", label: "Missouri", defaultCity: "St. Louis", latitude: 38.627, longitude: -90.1994 },
  { code: "MT", label: "Montana", defaultCity: "Billings", latitude: 45.7833, longitude: -108.5007 },
  { code: "NE", label: "Nebraska", defaultCity: "Omaha", latitude: 41.2565, longitude: -95.9345 },
  { code: "NV", label: "Nevada", defaultCity: "Las Vegas", latitude: 36.1699, longitude: -115.1398 },
  { code: "NH", label: "New Hampshire", defaultCity: "Manchester", latitude: 42.9956, longitude: -71.4548 },
  { code: "NJ", label: "New Jersey", defaultCity: "Newark", latitude: 40.7357, longitude: -74.1724 },
  { code: "NM", label: "New Mexico", defaultCity: "Albuquerque", latitude: 35.0844, longitude: -106.6504 },
  { code: "NY", label: "New York", defaultCity: "Queens", latitude: 40.7282, longitude: -73.7949 },
  { code: "NC", label: "North Carolina", defaultCity: "Charlotte", latitude: 35.2271, longitude: -80.8431 },
  { code: "ND", label: "North Dakota", defaultCity: "Fargo", latitude: 46.8772, longitude: -96.7898 },
  { code: "OH", label: "Ohio", defaultCity: "Columbus", latitude: 39.9612, longitude: -82.9988 },
  { code: "OK", label: "Oklahoma", defaultCity: "Oklahoma City", latitude: 35.4676, longitude: -97.5164 },
  { code: "OR", label: "Oregon", defaultCity: "Portland", latitude: 45.5152, longitude: -122.6784 },
  { code: "PA", label: "Pennsylvania", defaultCity: "Philadelphia", latitude: 39.9526, longitude: -75.1652 },
  { code: "RI", label: "Rhode Island", defaultCity: "Providence", latitude: 41.824, longitude: -71.4128 },
  { code: "SC", label: "South Carolina", defaultCity: "Columbia", latitude: 34.0007, longitude: -81.0348 },
  { code: "SD", label: "South Dakota", defaultCity: "Sioux Falls", latitude: 43.5446, longitude: -96.7311 },
  { code: "TN", label: "Tennessee", defaultCity: "Nashville", latitude: 36.1627, longitude: -86.7816 },
  { code: "TX", label: "Texas", defaultCity: "Austin", latitude: 30.2672, longitude: -97.7431 },
  { code: "UT", label: "Utah", defaultCity: "Salt Lake City", latitude: 40.7608, longitude: -111.891 },
  { code: "VT", label: "Vermont", defaultCity: "Burlington", latitude: 44.4759, longitude: -73.2121 },
  { code: "VA", label: "Virginia", defaultCity: "Richmond", latitude: 37.5407, longitude: -77.436 },
  { code: "WA", label: "Washington", defaultCity: "Seattle", latitude: 47.6062, longitude: -122.3321 },
  { code: "WV", label: "West Virginia", defaultCity: "Charleston", latitude: 38.3498, longitude: -81.6326 },
  { code: "WI", label: "Wisconsin", defaultCity: "Milwaukee", latitude: 43.0389, longitude: -87.9065 },
  { code: "WY", label: "Wyoming", defaultCity: "Cheyenne", latitude: 41.14, longitude: -104.8202 }
];

const stateMetadataByCode = Object.fromEntries(stateCatalog.map((state) => [state.code, state])) as Record<
  string,
  StateMetadata
>;

export function getStateMetadataByCode(stateCode: string): StateMetadata {
  return stateMetadataByCode[stateCode] ?? stateMetadataByCode.CA;
}

export function getChecklistForState(stateCode: string): SkillDefinition[] {
  return baseSkills.map((skill) => ({
    ...skill,
    stateCode
  }));
}

export function createEmptyProgress(skills: SkillDefinition[]): SkillProgress[] {
  return skills.map((skill) => ({
    skillId: skill.id,
    status: "not_attempted",
    attemptsCount: 0,
    averageRating: 0,
    confidenceScore: 0
  }));
}

const demoProfile: UserProfile = {
  id: "teen-1",
  name: "Maya Chen",
  email: "maya@example.com",
  role: "teen",
  age: 16,
  stateCode: "CA",
  experienceLevel: "intermediate",
  targetTestDate: "2026-05-02",
  householdName: "Chen Family",
  householdInviteCode: "READY-247",
  linkedTeenName: "Maya Chen",
  completedOnboarding: true
};

export const demoSessions: PracticeSession[] = [
  {
    id: "session-1",
    date: "2026-04-05",
    durationMinutes: 55,
    areaDriven: "Sunnyvale residential loop",
    roadTypes: ["Residential", "Neighborhood arterials"],
    practicedSkills: [
      { skillId: "smooth-braking", rating: 4 },
      { skillId: "lane-position", rating: 4 },
      { skillId: "four-way-stop", rating: 3 }
    ],
    notes: "Felt calmer than last week. Still hesitated at one busy stop.",
    parentComment: "Good awareness overall. Work on committing earlier at intersections.",
    weather: "Clear",
    trafficLevel: "Light",
    conditions: ["afternoon"]
  },
  {
    id: "session-2",
    date: "2026-04-10",
    durationMinutes: 70,
    areaDriven: "El Camino corridor",
    roadTypes: ["Multi-lane arterial", "Signalized intersections"],
    practicedSkills: [
      { skillId: "lane-change", rating: 3 },
      { skillId: "unprotected-left", rating: 2 },
      { skillId: "lane-position", rating: 4 }
    ],
    notes: "Traffic was heavier. Left turns felt stressful.",
    parentComment: "Lane changes looked safer. Left-turn gap judgment still needs reps.",
    weather: "Clear",
    trafficLevel: "Medium",
    conditions: ["rush hour"]
  },
  {
    id: "session-3",
    date: "2026-04-13",
    durationMinutes: 48,
    areaDriven: "101 southbound practice",
    roadTypes: ["Highway", "On-ramp", "Surface streets"],
    practicedSkills: [
      { skillId: "highway-merge", rating: 2 },
      { skillId: "lane-change", rating: 3 },
      { skillId: "smooth-braking", rating: 4 }
    ],
    notes: "Needed coaching to match ramp speed before merging.",
    parentComment: "Biggest gap is still merging assertively without braking on the ramp.",
    weather: "Cloudy",
    trafficLevel: "Medium",
    conditions: ["evening"]
  }
];

export function createProfileFromOnboarding(input: OnboardingInput): UserProfile {
  return {
    id: "teen-1",
    completedOnboarding: true,
    linkedTeenName: input.role === "parent" ? "Teen learner" : input.name,
    householdInviteCode: "READY-247",
    ...input
  };
}

export function createDemoState(): AppState {
  const skills = getChecklistForState(demoProfile.stateCode);

  return {
    profile: demoProfile,
    skills,
    progress: createEmptyProgress(skills),
    sessions: demoSessions,
    coachTip:
      "Practice assertive but calm merges on a lower-traffic freeway entrance before repeating them in busier conditions.",
    notifications: [
      "Highway merging has the biggest confidence gap right now.",
      "Night driving has not been attempted yet.",
      "You have 18 days left until the target test date."
    ]
  };
}
