import { z } from "zod";
import { createRoom } from "@/lib/game/store";

const createRoomSchema = z.object({
  hostName: z.string().min(1).max(24),
  targetRoundCount: z.number().int().min(1).max(30).optional(),
  promptPool: z.array(z.string().min(1).max(32)).min(4).optional()
});

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const parsed = createRoomSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: "INVALID_BODY", detail: parsed.error.flatten() }, { status: 400 });
    }

    const result = createRoom(parsed.data);
    return Response.json(result, { status: 201 });
  } catch {
    return Response.json({ error: "FAILED_TO_CREATE_ROOM" }, { status: 500 });
  }
}
