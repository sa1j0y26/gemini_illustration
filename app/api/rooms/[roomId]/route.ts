import { getPublicRoomById } from "@/lib/game/store";

interface Params {
  params: Promise<{ roomId: string }>;
}

export async function GET(_: Request, context: Params): Promise<Response> {
  const { roomId } = await context.params;
  const room = getPublicRoomById(roomId);

  if (!room) {
    return Response.json({ error: "ROOM_NOT_FOUND" }, { status: 404 });
  }

  return Response.json({ room });
}
