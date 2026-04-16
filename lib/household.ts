import { Role } from "@/lib/types";

export function normalizeHouseholdInviteCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function buildOwnedHouseholdInviteCode(accountId: string) {
  const condensed = accountId.replace(/-/g, "").toUpperCase().slice(0, 12);
  const grouped = condensed.match(/.{1,4}/g)?.join("-") ?? condensed;
  return `RR-${grouped}`;
}

export function buildSuggestedHouseholdInviteCode(...values: Array<string | undefined>) {
  for (const value of values) {
    const normalized = normalizeHouseholdInviteCode(value ?? "");
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

export function getViewerRoleLabel(role: Role) {
  return role === "teen" ? "Teen learner" : "Parent / instructor";
}
