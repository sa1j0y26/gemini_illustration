import { evaluateWithGoogleLive } from "@/lib/ai/googleLive";
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
    try {
      return await evaluateWithGoogleLive(input);
    } catch {
      return mockEvaluation(input.choices);
    }
  }

  return mockEvaluation(input.choices);
}
