import { NextResponse } from "next/server";
import { buildSessionSummary } from "@/lib/logic";
import { SessionInput, SkillDefinition } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    skills: SkillDefinition[];
    session: SessionInput;
  };

  return NextResponse.json({
    summary: buildSessionSummary(body.skills, body.session)
  });
}

