import { NextResponse } from "next/server";
import { generateSmartRoutePlan } from "@/lib/route-generation";
import { Recommendation, RouteRequest, SkillDefinition } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    skills: SkillDefinition[];
    recommendations: Recommendation[];
    request: RouteRequest;
  };

  return NextResponse.json({
    route: await generateSmartRoutePlan(body.skills, body.recommendations, body.request)
  });
}
