import { NextRequest, NextResponse } from "next/server";
import {
  clearSession,
  getSessionCookieConfig,
  getSessionCookieName
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get(getSessionCookieName())?.value;

  await clearSession(sessionToken);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(getSessionCookieName(), "", {
    ...getSessionCookieConfig(),
    maxAge: 0
  });

  return response;
}
