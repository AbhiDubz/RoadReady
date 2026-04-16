import { NextRequest, NextResponse } from "next/server";
import { getSessionCookieName, getUserForSessionToken } from "@/lib/auth";
import { searchLocationSuggestions } from "@/lib/location-search";

export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get(getSessionCookieName())?.value;
  const user = await getUserForSessionToken(sessionToken);

  if (!user) {
    return NextResponse.json({ message: "Sign in to search locations." }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("q") ?? "";
  const latitude = Number(request.nextUrl.searchParams.get("lat"));
  const longitude = Number(request.nextUrl.searchParams.get("lon"));
  const anchor =
    Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : undefined;

  try {
    const suggestions = await searchLocationSuggestions(query, anchor);
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] }, { status: 200 });
  }
}
