import { evaluateWithGoogleLive, validateGoogleLiveApiKey } from "@/lib/ai/googleLive";
import type { DrawingEvaluation } from "@/lib/game/types";

function mockEvaluation(choices: string[]): DrawingEvaluation {
  const guess = choices[Math.floor(Math.random() * choices.length)] ?? "";
  return {
    provider: "mock",
    guess,
    confidence: Number((0.2 + Math.random() * 0.7).toFixed(2)),
    reason: "mock-evaluation"
  };
}

export async function evaluateDrawing(input: {
  imageDataUrl: string;
  choices: string[];
}): Promise<DrawingEvaluation> {
  const provider = process.env.AI_EVALUATOR_PROVIDER ?? "mock";

  if (provider === "google-live") {
    return evaluateWithGoogleLive(input);
  }

  if (provider === "mock") {
    return mockEvaluation(input.choices);
  }

  throw new Error("INVALID_AI_EVALUATOR_PROVIDER");
}

export async function validateAiEvaluatorBeforeGameStart(): Promise<{
  provider: string;
  detail?: string;
}> {
  const provider = process.env.AI_EVALUATOR_PROVIDER ?? "mock";

  if (provider === "google-live") {
    const result = await validateGoogleLiveApiKey();
    return { provider, detail: result.model };
  }

  if (provider === "mock") {
    return { provider, detail: "mock-mode" };
  }

  throw new Error("INVALID_AI_EVALUATOR_PROVIDER");
}
