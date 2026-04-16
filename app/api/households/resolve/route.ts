import { NextRequest, NextResponse } from "next/server";
import {
  findTeenAccountByInviteCode,
  getSessionCookieName,
  getUserForSessionToken
} from "@/lib/auth";
import { buildOwnedHouseholdInviteCode, normalizeHouseholdInviteCode } from "@/lib/household";

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get(getSessionCookieName())?.value;
  const user = await getUserForSessionToken(sessionToken);

  if (!user) {
    return NextResponse.json({ message: "Sign in to link a household." }, { status: 401 });
  }

  const body = (await request.json()) as { inviteCode?: string };
  const inviteCode = normalizeHouseholdInviteCode(body.inviteCode ?? "");

  if (!inviteCode) {
    return NextResponse.json({ message: "Enter the teen invite code to connect this household." }, { status: 400 });
  }

  const teen = await findTeenAccountByInviteCode(inviteCode);

  if (!teen) {
    return NextResponse.json({ message: "That invite code does not match a teen account yet." }, { status: 404 });
  }

  return NextResponse.json({
    ownerTeenId: teen.id,
    ownerTeenName: teen.name,
    inviteCode: buildOwnedHouseholdInviteCode(teen.id)
  });
}
