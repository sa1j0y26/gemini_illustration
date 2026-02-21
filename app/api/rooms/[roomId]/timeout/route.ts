import { z } from "zod";
import { timeoutCurrentRound } from "@/lib/game/store";

const timeoutSchema = z.object({
  roundIndex: z.number().int().min(0)
});

interface Params {
  params: Promise<{ roomId: string }>;
}

export async function POST(req: Request, context: Params): Promise<Response> {
  try {
    const { roomId } = await context.params;
    const body = await req.json();
    const parsed = timeoutSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: "INVALID_BODY", detail: parsed.error.flatten() }, { status: 400 });
    }

    const room = timeoutCurrentRound(roomId, parsed.data.roundIndex);
    return Response.json({ room });
  } catch (error) {
    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: "TIMEOUT_FAILED" }, { status: 500 });
  }
}
