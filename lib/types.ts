export type Role = "teen" | "parent";
export type SkillStatus = "not_attempted" | "needs_work" | "confident";
export type SkillCategory =
  | "Basic Control"
  | "Intersections"
  | "Road Types"
  | "Maneuvers"
  | "Conditions"
  | "Highway Skills";

export type ExperienceLevel = "beginner" | "intermediate" | "test_soon";
export type DifficultyLevel = "gentle" | "balanced" | "stretch";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: Role;
  age: number;
  stateCode: string;
  experienceLevel: ExperienceLevel;
  targetTestDate?: string;
  householdName?: string;
  householdInviteCode?: string;
  linkedTeenName?: string;
  completedOnboarding: boolean;
}

export interface SkillDefinition {
  id: string;
  stateCode: string;
  category: SkillCategory;
  label: string;
  description: string;
  requiredForTest: boolean;
  routeTags: string[];
}

export interface SkillProgress {
  skillId: string;
  status: SkillStatus;
  attemptsCount: number;
  averageRating: number;
  lastPracticedAt?: string;
  confidenceScore: number;
}

export interface SessionSkillRating {
  skillId: string;
  rating: number;
}

export interface PracticeSession {
  id: string;
  date: string;
  durationMinutes: number;
  areaDriven: string;
  roadTypes: string[];
  practicedSkills: SessionSkillRating[];
  notes: string;
  parentComment: string;
  weather: string;
  trafficLevel: string;
  conditions: string[];
  aiSummary?: string;
}

export interface Recommendation {
  skillId: string;
  label: string;
  category: SkillCategory;
  priorityScore: number;
  reasons: string[];
}

export interface RouteStop {
  id: string;
  title: string;
  address: string;
  reason: string;
  tag: string;
  focusSkillLabels?: string[];
  etaMinutes: number;
  latitude: number;
  longitude: number;
  source?: "resolved" | "fallback";
  verificationStatus?: "verified" | "approximate";
}

export interface RouteCoordinate {
  latitude: number;
  longitude: number;
}

export interface RouteDirectionStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  roadName?: string;
  maneuverType?: string;
  maneuverModifier?: string;
}

export interface RouteLeg {
  id: string;
  fromLabel: string;
  toLabel: string;
  distanceMeters: number;
  durationSeconds: number;
  steps: RouteDirectionStep[];
}

export interface RoutePlan {
  id: string;
  createdAt: string;
  startLocation: string;
  startLatitude: number;
  startLongitude: number;
  estimatedMinutes: number;
  difficulty: DifficultyLevel;
  prioritySkillIds: string[];
  explanation: string;
  segments: RouteStop[];
  routePath?: RouteCoordinate[];
  routeLegs?: RouteLeg[];
  generationSource?: "ai-assisted" | "rules-based";
  routingSource?: "road-route" | "straight-line";
  warnings?: string[];
}

export interface CategoryCoverage {
  category: SkillCategory;
  attemptedPercent: number;
  confidentPercent: number;
  coverageScore: number;
}

export interface ReadinessSnapshot {
  readinessScore: number;
  totalHours: number;
  overdueSkills: SkillProgress[];
  topRecommendations: Recommendation[];
  coverage: CategoryCoverage[];
}

export interface AppState {
  profile: UserProfile;
  skills: SkillDefinition[];
  progress: SkillProgress[];
  sessions: PracticeSession[];
  latestRoute?: RoutePlan;
  coachTip: string;
  notifications: string[];
}

export interface OnboardingInput {
  name: string;
  email: string;
  role: Role;
  age: number;
  stateCode: string;
  experienceLevel: ExperienceLevel;
  targetTestDate?: string;
  householdName?: string;
}

export interface SessionInput {
  date: string;
  durationMinutes: number;
  areaDriven: string;
  roadTypes: string[];
  skillRatings: SessionSkillRating[];
  notes: string;
  parentComment: string;
  weather: string;
  trafficLevel: string;
  conditions: string[];
}

export interface RouteRequest {
  startLocation: string;
  startLatitude?: number;
  startLongitude?: number;
  difficulty: DifficultyLevel;
  skillIds: string[];
}
