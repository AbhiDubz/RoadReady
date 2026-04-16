import { NextRequest, NextResponse } from "next/server";
import { getSessionCookieName, getUserForSessionToken } from "@/lib/auth";
import { generateSmartRoutePlan, RouteGenerationError } from "@/lib/route-generation";
import { Recommendation, RouteRequest, SkillDefinition } from "@/lib/types";

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get(getSessionCookieName())?.value;
  const user = await getUserForSessionToken(sessionToken);

  if (!user) {
    return NextResponse.json({ message: "Sign in to generate practice routes." }, { status: 401 });
  }

  const body = (await request.json()) as {
    skills: SkillDefinition[];
    recommendations: Recommendation[];
    request: RouteRequest;
  };

  try {
    return NextResponse.json({
      route: await generateSmartRoutePlan(body.skills, body.recommendations, body.request)
    });
  } catch (error) {
    if (error instanceof RouteGenerationError) {
      return NextResponse.json({ message: error.message }, { status: 422 });
    }

    return NextResponse.json({ message: "RoadReady could not generate a verified route right now." }, { status: 500 });
  }
}
