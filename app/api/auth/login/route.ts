import { NextRequest, NextResponse } from "next/server";
import {
  AuthError,
  getSessionCookieConfig,
  getSessionCookieName,
  loginAccount
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };

    const result = await loginAccount({
      email: body.email ?? "",
      password: body.password ?? ""
    });

    const response = NextResponse.json({ user: result.user });
    response.cookies.set(getSessionCookieName(), result.sessionToken, getSessionCookieConfig());

    return response;
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: "Unable to sign in right now." }, { status: 500 });
  }
}
