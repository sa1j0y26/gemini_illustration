import { z } from "zod";
import { joinRoom } from "@/lib/game/store";

const joinSchema = z.object({
  playerName: z.string().min(1).max(24)
});

interface Params {
  params: Promise<{ roomId: string }>;
}

export async function POST(req: Request, context: Params): Promise<Response> {
  try {
    const { roomId } = await context.params;
    const body = await req.json();
    const parsed = joinSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: "INVALID_BODY", detail: parsed.error.flatten() }, { status: 400 });
    }

    const result = joinRoom(roomId, parsed.data.playerName);
    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: "FAILED_TO_JOIN_ROOM" }, { status: 500 });
  }
}
