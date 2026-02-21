import { validateAiEvaluatorBeforeGameStart } from "@/lib/ai/evaluator";

export async function POST(): Promise<Response> {
  try {
    const result = await validateAiEvaluatorBeforeGameStart();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI_VALIDATE_FAILED";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
