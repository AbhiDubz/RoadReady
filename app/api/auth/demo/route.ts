import { NextResponse } from "next/server";
import {
  getSessionCookieConfig,
  getSessionCookieName,
  loginDemoAccount
} from "@/lib/auth";

export async function POST() {
  const result = await loginDemoAccount();
  const response = NextResponse.json({ user: result.user });
  response.cookies.set(getSessionCookieName(), result.sessionToken, getSessionCookieConfig());

  return response;
}
