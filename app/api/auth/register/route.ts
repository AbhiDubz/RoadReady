import { NextRequest, NextResponse } from "next/server";
import {
  AuthError,
  getSessionCookieConfig,
  getSessionCookieName,
  registerAccount
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
    };

    const result = await registerAccount({
      name: body.name ?? "",
      email: body.email ?? "",
      password: body.password ?? "",
      role: body.role ?? ""
    });

    const response = NextResponse.json({ user: result.user });
    response.cookies.set(getSessionCookieName(), result.sessionToken, getSessionCookieConfig());

    return response;
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: "Unable to create that account right now." }, { status: 500 });
  }
}
