import { NextRequest, NextResponse } from "next/server";
import { getUserForSessionToken, getSessionCookieName } from "@/lib/auth";
import { buildSessionSummary } from "@/lib/logic";
import { generateStructuredObject } from "@/lib/openai";
import { GeneratedContentSource, SessionInput, SkillDefinition } from "@/lib/types";

type SessionSummaryPayload = {
  summary: string;
};

const SESSION_SUMMARY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: {
      type: "string"
    }
  },
  required: ["summary"]
} as const;

async function generateSessionSummary(
  skills: SkillDefinition[],
  session: SessionInput
): Promise<{ summary: string; source: GeneratedContentSource }> {
  const fallbackSummary = buildSessionSummary(skills, session);
  const model = process.env.GEMINI_SESSION_MODEL ?? process.env.OPENAI_SESSION_MODEL ?? "gemini-2.5-flash";
  const skillContext = session.skillRatings
    .map((entry) => {
      const skill = skills.find((candidate) => candidate.id === entry.skillId);
      return `${skill?.label ?? entry.skillId}: ${entry.rating}/3`;
    })
    .join("\n");

  const aiSummary = await generateStructuredObject<SessionSummaryPayload>({
    model,
    reasoningEffort: "low",
    schemaName: "roadready_session_summary",
    schema: SESSION_SUMMARY_SCHEMA,
    maxOutputTokens: 180,
    instructions:
      "You write grounded post-drive coaching summaries for a teen driving practice app. " +
      "Stay faithful to the provided ratings and notes. Keep the tone supportive, practical, and concise. " +
      "Return one short paragraph with 2 or 3 sentences. Mention one clear strength and one next focus area. " +
      "Do not invent maneuvers, locations, or safety claims that were not provided.",
    prompt:
      `Learner drove in ${session.areaDriven} on ${session.date} for ${session.durationMinutes} minutes.\n` +
      `Weather: ${session.weather}\n` +
      `Traffic: ${session.trafficLevel}\n` +
      `Road types: ${session.roadTypes.join(", ") || "Not provided"}\n` +
      `Conditions: ${session.conditions.join(", ") || "Not provided"}\n` +
      `Skill ratings:\n${skillContext || "No rated skills provided"}\n` +
      `Teen notes: ${session.notes || "None"}\n` +
      `Parent comment: ${session.parentComment || "None"}\n`
  });

  if (!aiSummary?.summary?.trim()) {
    return {
      summary: fallbackSummary,
      source: "rules-based"
    };
  }

  return {
    summary: aiSummary.summary.trim(),
    source: "ai"
  };
}

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get(getSessionCookieName())?.value;
  const user = await getUserForSessionToken(sessionToken);

  if (!user) {
    return NextResponse.json({ message: "Sign in to use RoadReady's session tools." }, { status: 401 });
  }

  const body = (await request.json()) as {
    skills: SkillDefinition[];
    session: SessionInput;
  };
  const summary = await generateSessionSummary(body.skills, body.session);

  return NextResponse.json(summary);
}
