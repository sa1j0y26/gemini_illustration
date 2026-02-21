import type { DrawingEvaluation } from "@/lib/game/types";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "gemini-2.5-flash";
const VALIDATION_CACHE_TTL_MS = 60_000;

interface ValidationCache {
  verifiedAt: number;
  model: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __googleLiveValidationCache: ValidationCache | undefined;
}

interface GenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

function getApiKey(): string {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY_MISSING");
  }
  return apiKey;
}

function getModelName(): string {
  return process.env.GOOGLE_GENAI_MODEL?.trim() || DEFAULT_MODEL;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!match) {
    throw new Error("INVALID_IMAGE_DATA_URL");
  }
  return {
    mimeType: match[1],
    data: match[2]
  };
}

function extractTextFromResponse(response: GenerateContentResponse): string {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((part) => part.text ?? "").join("\n").trim();
  if (!text) {
    throw new Error("EMPTY_MODEL_RESPONSE");
  }
  return text;
}

function tryParseJson(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function extractJsonObject(text: string): Record<string, unknown> {
  const direct = tryParseJson(text);
  if (direct) {
    return direct;
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const parsedFenced = tryParseJson(fenced[1].trim());
    if (parsedFenced) {
      return parsedFenced;
    }
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const parsedSlice = tryParseJson(text.slice(firstBrace, lastBrace + 1));
    if (parsedSlice) {
      return parsedSlice;
    }
  }

  throw new Error("MODEL_RESPONSE_NOT_JSON");
}

async function callGenerateContent(parts: Array<Record<string, unknown>>, timeoutMs = 10_000): Promise<string> {
  const apiKey = getApiKey();
  const model = getModelName();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${GEMINI_API_BASE}/models/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts
          }
        ],
        generationConfig: {
          temperature: 0.1
        }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`GOOGLE_API_REQUEST_FAILED:${response.status}:${detail.slice(0, 300)}`);
    }

    const data = (await response.json()) as GenerateContentResponse;
    return extractTextFromResponse(data);
  } finally {
    clearTimeout(timer);
  }
}

export async function validateGoogleLiveApiKey(): Promise<{ model: string }> {
  const model = getModelName();
  const cache = global.__googleLiveValidationCache;
  const now = Date.now();
  if (cache && cache.model === model && now - cache.verifiedAt < VALIDATION_CACHE_TTL_MS) {
    return { model: cache.model };
  }

  const text = await callGenerateContent([{ text: 'Reply with exactly {"ok":true}.' }], 8_000);
  const parsed = extractJsonObject(text);
  if (parsed.ok !== true) {
    throw new Error("GOOGLE_API_KEY_INVALID_OR_MODEL_UNAVAILABLE");
  }

  global.__googleLiveValidationCache = { verifiedAt: now, model };
  return { model };
}

export async function evaluateWithGoogleLive(input: {
  imageDataUrl: string;
  choices: string[];
}): Promise<DrawingEvaluation> {
  if (input.choices.length === 0) {
    throw new Error("CHOICES_EMPTY");
  }

  const { mimeType, data } = parseDataUrl(input.imageDataUrl);
  const candidateList = input.choices.join(", ");

  const instruction = [
    "You are an image classification judge for a drawing game.",
    "From the candidate list, choose exactly one noun that best matches the drawing.",
    "Return ONLY JSON with this shape:",
    '{"guess":"<exactly one candidate>","confidence":0.0,"reason":"short"}',
    "Rules:",
    "- guess must exactly match one item from candidates.",
    "- confidence must be a number between 0 and 1.",
    `Candidates: ${candidateList}`
  ].join("\n");

  const responseText = await callGenerateContent([
    { text: instruction },
    {
      inline_data: {
        mime_type: mimeType,
        data
      }
    }
  ]);

  const parsed = extractJsonObject(responseText);
  const guessRaw = typeof parsed.guess === "string" ? parsed.guess.trim() : "";
  const reason = typeof parsed.reason === "string" ? parsed.reason : undefined;
  const confidenceRaw = typeof parsed.confidence === "number" ? parsed.confidence : Number(parsed.confidence);

  const normalizedMap = new Map(input.choices.map((choice) => [normalize(choice), choice]));
  const guess = normalizedMap.get(normalize(guessRaw));
  if (!guess) {
    throw new Error("MODEL_GUESS_OUT_OF_CHOICES");
  }

  const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0.3;

  return {
    provider: "google-live",
    guess,
    confidence: Number(confidence.toFixed(2)),
    reason
  };
}
