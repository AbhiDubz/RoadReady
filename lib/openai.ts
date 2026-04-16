import "server-only";

type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";

type TextGenerationOptions = {
  model: string;
  instructions: string;
  prompt: string;
  maxOutputTokens?: number;
  reasoningEffort?: ReasoningEffort;
};

type StructuredGenerationOptions = TextGenerationOptions & {
  schemaName: string;
  schema: Record<string, unknown>;
};

type GeminiPart = {
  text?: string;
};

type GeminiCandidate = {
  content?: {
    parts?: GeminiPart[];
  };
  finishReason?: string;
};

type GeminiResponsePayload = {
  candidates?: GeminiCandidate[];
  promptFeedback?: {
    blockReason?: string;
  };
  error?: {
    message?: string;
  };
};

const GEMINI_API_BASE_URL =
  process.env.GEMINI_API_BASE_URL?.replace(/\/$/, "") ??
  "https://generativelanguage.googleapis.com/v1beta";

function sanitizeSchemaForGemini(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeSchemaForGemini(entry));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const unsupportedKeys = new Set([
    "additionalProperties",
    "$schema",
    "strict"
  ]);
  const result: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (unsupportedKeys.has(key)) {
      continue;
    }

    result[key] = sanitizeSchemaForGemini(entry);
  }

  return result;
}

function getApiKey() {
  return process.env.GEMINI_API_KEY ?? process.env.OPENAI_API_KEY ?? null;
}

function buildContents(prompt: string) {
  return [
    {
      role: "user",
      parts: [
        {
          text: prompt
        }
      ]
    }
  ];
}

function getTemperatureForEffort(effort: ReasoningEffort | undefined) {
  switch (effort) {
    case "none":
    case "minimal":
      return 0.1;
    case "low":
      return 0.2;
    case "medium":
      return 0.35;
    case "high":
    case "xhigh":
      return 0.45;
    default:
      return 0.2;
  }
}

function supportsThinkingConfig(model: string) {
  return /gemini-2\.5/i.test(model);
}

function getThinkingBudget(effort: ReasoningEffort | undefined) {
  switch (effort) {
    case "medium":
      return 256;
    case "high":
      return 1024;
    case "xhigh":
      return 2048;
    case "none":
    case "minimal":
    case "low":
    default:
      return 0;
  }
}

function buildGenerationConfig(
  options: TextGenerationOptions,
  responseMimeType: "text/plain" | "application/json",
  extras?: Record<string, unknown>
) {
  const generationConfig: Record<string, unknown> = {
    temperature: getTemperatureForEffort(options.reasoningEffort),
    maxOutputTokens: options.maxOutputTokens ?? 320,
    responseMimeType,
    ...extras
  };

  if (supportsThinkingConfig(options.model)) {
    generationConfig.thinkingConfig = {
      thinkingBudget: getThinkingBudget(options.reasoningEffort)
    };
  }

  return generationConfig;
}

function extractOutputText(payload: GeminiResponsePayload) {
  for (const candidate of payload.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (typeof part.text === "string" && part.text.trim()) {
        return part.text.trim();
      }
    }
  }

  return null;
}

function extractJsonLikeSubstring(text: string) {
  const objectStart = text.indexOf("{");
  const objectEnd = text.lastIndexOf("}");

  if (objectStart !== -1 && objectEnd !== -1 && objectEnd > objectStart) {
    return text.slice(objectStart, objectEnd + 1);
  }

  const arrayStart = text.indexOf("[");
  const arrayEnd = text.lastIndexOf("]");

  if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
    return text.slice(arrayStart, arrayEnd + 1);
  }

  return null;
}

async function createResponse(body: Record<string, unknown>, model: string) {
  const apiKey = getApiKey();

  if (!apiKey) {
    return null;
  }

  const response = await fetch(`${GEMINI_API_BASE_URL}/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    console.warn(`Gemini request failed with status ${response.status}${details ? `: ${details}` : ""}`);
    return null;
  }

  return (await response.json()) as GeminiResponsePayload;
}

export function isOpenAIConfigured() {
  return Boolean(getApiKey());
}

export async function generateText(options: TextGenerationOptions) {
  const payload = await createResponse(
    {
      systemInstruction: {
        parts: [
          {
            text: options.instructions
          }
        ]
      },
      contents: buildContents(options.prompt),
      generationConfig: buildGenerationConfig(options, "text/plain")
    },
    options.model
  );

  if (!payload) {
    return null;
  }

  return extractOutputText(payload);
}

export async function generateStructuredObject<T>(options: StructuredGenerationOptions) {
  const sanitizedSchema = sanitizeSchemaForGemini(options.schema);
  const payload = await createResponse(
    {
      systemInstruction: {
        parts: [
          {
            text: options.instructions
          }
        ]
      },
      contents: buildContents(options.prompt),
      generationConfig: buildGenerationConfig(options, "application/json", {
        responseSchema: sanitizedSchema
      })
    },
    options.model
  );

  if (!payload) {
    return null;
  }

  const outputText = extractOutputText(payload);
  if (!outputText) {
    return null;
  }

  try {
    return JSON.parse(outputText) as T;
  } catch (error) {
    const jsonLikeSubstring = extractJsonLikeSubstring(outputText);

    if (jsonLikeSubstring) {
      try {
        return JSON.parse(jsonLikeSubstring) as T;
      } catch {
        // Fall through to repair attempt below.
      }
    }

    const repairedText = await generateText({
      model: options.model,
      reasoningEffort: "minimal",
      maxOutputTokens: options.maxOutputTokens ?? 600,
      instructions:
        "You convert malformed model output into valid raw JSON that matches the requested schema. " +
        "Return only JSON and no explanatory text.",
      prompt:
        `Schema name: ${options.schemaName}\n` +
        `Expected schema: ${JSON.stringify(sanitizedSchema)}\n` +
        `Malformed output:\n${outputText}`
    });

    if (!repairedText) {
      console.warn("Gemini JSON parsing failed.", error);
      return null;
    }

    try {
      return JSON.parse(repairedText) as T;
    } catch (repairError) {
      const repairedSubstring = extractJsonLikeSubstring(repairedText);

      if (repairedSubstring) {
        try {
          return JSON.parse(repairedSubstring) as T;
        } catch {
          // Fall through to warning below.
        }
      }

      console.warn("Gemini JSON repair failed.", repairError);
      return null;
    }
  }
}
