import { z } from "zod";
import { evaluateDrawing } from "@/lib/ai/evaluator";
import { applyEvaluationResult, getCurrentRound } from "@/lib/game/store";

const snapshotSchema = z.object({
  playerId: z.string().min(1),
  imageDataUrl: z.string().min(1)
});

interface Params {
  params: Promise<{ roomId: string }>;
}

export async function POST(req: Request, context: Params): Promise<Response> {
  try {
    const { roomId } = await context.params;
    const body = await req.json();
    const parsed = snapshotSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: "INVALID_BODY", detail: parsed.error.flatten() }, { status: 400 });
    }

    const round = getCurrentRound(roomId);
    if (!round) {
      return Response.json({ error: "ROOM_OR_ROUND_NOT_FOUND" }, { status: 404 });
    }

    const evaluation = await evaluateDrawing({
      imageDataUrl: parsed.data.imageDataUrl,
      choices: round.choices
    });

    const result = applyEvaluationResult({
      roomId,
      playerId: parsed.data.playerId,
      evaluation
    });

    return Response.json({
      evaluation,
      matched: result.matched,
      correctPrompt: result.correctPrompt,
      room: result.room
    });
  } catch (error) {
    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: "FAILED_TO_EVALUATE_SNAPSHOT" }, { status: 500 });
  }
}
