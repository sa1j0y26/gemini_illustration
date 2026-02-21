import type { DrawingEvaluation } from "@/lib/game/types";

export async function evaluateWithGoogleLive(input: {
  imageDataUrl: string;
  choices: string[];
}): Promise<DrawingEvaluation> {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY;

  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY_MISSING");
  }

  // NOTE:
  // Google LiveAPI 連携ポイント。ここで choices を文脈として与え、
  // 画像から最も近い推定お題を返す実装へ置き換える。
  // 現時点は基礎セットアップのためスタブを返す。
  const guess = input.choices[Math.floor(Math.random() * input.choices.length)] ?? "";

  return {
    provider: "google-live",
    guess,
    confidence: Number((0.4 + Math.random() * 0.5).toFixed(2)),
    reason: "stubbed-google-live"
  };
}
