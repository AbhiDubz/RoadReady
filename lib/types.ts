export type Role = "teen" | "parent";
export type SkillStatus = "not_attempted" | "needs_work" | "confident";
export type SkillCategory =
  | "Basic Control"
  | "Intersections"
  | "Road Types"
  | "Maneuvers"
  | "Conditions"
  | "Highway Skills";
export type SkillTrend = "improving" | "stagnant" | "declining" | "not_enough_data";
export type SessionReviewStatus = "pending" | "reviewed" | "verified";
export type RouteApprovalStatus = "pending" | "approved" | "rejected" | "needs_changes";
export type GeneratedContentSource = "ai" | "rules-based";

export type ExperienceLevel = "beginner" | "intermediate" | "test_soon";
export type DifficultyLevel = "gentle" | "balanced" | "stretch";

export interface AuthAccount {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  role: Role;
  age: number;
  stateCode: string;
  experienceLevel: ExperienceLevel;
  targetTestDate?: string;
  householdName?: string;
  householdInviteCode?: string;
  householdOwnerId?: string;
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
  teenRating: number;
  rating: number;
  parentOverrideRating?: number;
  parentComment?: string;
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
  reviewStatus: SessionReviewStatus;
  reviewedAt?: string;
  reviewedByName?: string;
  verifiedAt?: string;
  verifiedByName?: string;
  aiSummary?: string;
  summarySource?: GeneratedContentSource;
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
  coachNote?: string;
  segments: RouteStop[];
  routePath?: RouteCoordinate[];
  routeLegs?: RouteLeg[];
  generationSource?: "ai-assisted" | "rules-based";
  routingSource?: "road-route" | "straight-line";
  warnings?: string[];
  approvalStatus: RouteApprovalStatus;
  approvalNote?: string;
  approvedAt?: string;
  approvedByName?: string;
}

export interface CategoryCoverage {
  category: SkillCategory;
  attemptedPercent: number;
  confidentPercent: number;
  coverageScore: number;
}

export interface ParentCategorySummary {
  category: SkillCategory;
  coveragePercent: number;
  status: SkillStatus;
  weakSkillsCount: number;
}

export interface SkillInsight {
  skillId: string;
  label: string;
  category: SkillCategory;
  attemptsCount: number;
  averageRating: number;
  lastPracticedAt?: string;
  trend: SkillTrend;
  parentComments: string[];
}

export interface ReadinessSnapshot {
  readinessScore: number;
  totalHours: number;
  overdueSkills: SkillProgress[];
  topRecommendations: Recommendation[];
  coverage: CategoryCoverage[];
  categorySummaries: ParentCategorySummary[];
  lastSessionDate?: string;
  targetTestCountdownDays?: number;
}

export interface PracticePlanningState {
  selectedSkillIds: string[];
  preferredDifficulty: DifficultyLevel;
  preferredSessionDurationMinutes: number;
  requireParentApprovalForConfident: boolean;
  requireRouteApproval: boolean;
}

export interface AppState {
  profile: UserProfile;
  skills: SkillDefinition[];
  progress: SkillProgress[];
  sessions: PracticeSession[];
  latestRoute?: RoutePlan;
  planning: PracticePlanningState;
  coachTip: string;
  notifications: string[];
}

export interface OnboardingInput {
  name: string;
  email?: string;
  age: number;
  stateCode: string;
  experienceLevel: ExperienceLevel;
  targetTestDate?: string;
  householdName?: string;
  householdInviteCode?: string;
}

export interface SessionInput {
  date: string;
  durationMinutes: number;
  areaDriven: string;
  roadTypes: string[];
  skillRatings: Array<{ skillId: string; rating: number }>;
  notes: string;
  parentComment: string;
  weather: string;
  trafficLevel: string;
  conditions: string[];
}

export interface SessionReviewInput {
  sessionId: string;
  parentComment: string;
  skillOverrides: Record<string, number | undefined>;
  skillComments: Record<string, string | undefined>;
  reviewStatus: SessionReviewStatus;
}

export interface RouteRequest {
  startLocation: string;
  startLatitude?: number;
  startLongitude?: number;
  difficulty: DifficultyLevel;
  skillIds: string[];
}
