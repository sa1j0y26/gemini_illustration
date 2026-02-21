import { z } from "zod";
import { validateAiEvaluatorBeforeGameStart } from "@/lib/ai/evaluator";
import { startGame } from "@/lib/game/store";

const startSchema = z.object({
  requestedByPlayerId: z.string().min(1)
});

interface Params {
  params: Promise<{ roomId: string }>;
}

export async function POST(req: Request, context: Params): Promise<Response> {
  try {
    const body = await req.json();
    const parsed = startSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: "INVALID_BODY", detail: parsed.error.flatten() }, { status: 400 });
    }

    const { roomId } = await context.params;
    await validateAiEvaluatorBeforeGameStart();
    const room = startGame(roomId, parsed.data.requestedByPlayerId);
    return Response.json({ room });
  } catch (error) {
    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: "FAILED_TO_START_GAME" }, { status: 500 });
  }
}
