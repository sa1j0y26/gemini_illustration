import { nanoid } from "nanoid";
import { DEFAULT_PROMPTS, DEFAULT_ROUND_COUNT, MAX_PLAYERS, ROUND_TIME_LIMIT_MS } from "@/lib/game/config";
import type { DrawingEvaluation, GameRoom, GameRound, Player, PublicGameRoom } from "@/lib/game/types";

type GameStore = {
  rooms: Map<string, GameRoom>;
};

declare global {
  // eslint-disable-next-line no-var
  var __geminiIllustrationStore: GameStore | undefined;
}

const store = global.__geminiIllustrationStore ?? { rooms: new Map<string, GameRoom>() };
if (!global.__geminiIllustrationStore) {
  global.__geminiIllustrationStore = store;
}

function shuffle<T>(arr: T[]): T[] {
  const next = [...arr];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function normalizePrompt(prompt: string): string {
  return prompt.trim().toLowerCase();
}

function selectRoundPrompts(promptPool: string[], targetRoundCount: number): string[] {
  const shuffled = shuffle(promptPool);
  if (shuffled.length >= targetRoundCount) {
    return shuffled.slice(0, targetRoundCount);
  }

  // promptPool が少ない場合は循環で補う
  const selected: string[] = [];
  while (selected.length < targetRoundCount) {
    selected.push(shuffled[selected.length % shuffled.length]);
  }
  return selected;
}

function buildRounds(promptPool: string[], targetRoundCount: number): GameRound[] {
  const base = promptPool.length > 0 ? [...promptPool] : [...DEFAULT_PROMPTS];
  const selectedPrompts = selectRoundPrompts(base, targetRoundCount);
  return selectedPrompts.map((prompt, index) => ({
    index,
    prompt,
    // AI にはお題プール全件を渡す
    choices: shuffle(base),
    status: "pending"
  }));
}

function now(): number {
  return Date.now();
}

function syncRoundTimeout(room: GameRoom): void {
  if (room.status !== "in_round") {
    return;
  }

  const round = room.rounds[room.currentRoundIndex];
  if (!round || round.status !== "active") {
    return;
  }

  const startedAt = round.startedAt ?? now();
  if (!round.startedAt) {
    round.startedAt = startedAt;
    room.updatedAt = now();
    store.rooms.set(room.id, room);
  }

  if (now() - startedAt < ROUND_TIME_LIMIT_MS) {
    return;
  }

  round.status = "finished";
  round.endedAt = now();
  advanceRound(room);
  store.rooms.set(room.id, room);
}

function cloneRoom(room: GameRoom): GameRoom {
  return structuredClone(room);
}

export function toPublicRoom(room: GameRoom): PublicGameRoom {
  return {
    id: room.id,
    hostPlayerId: room.hostPlayerId,
    status: room.status,
    maxPlayers: room.maxPlayers,
    targetRoundCount: room.targetRoundCount,
    currentRoundIndex: room.currentRoundIndex,
    players: room.players,
    rounds: room.rounds,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt
  };
}

export function createRoom(input: {
  hostName: string;
  targetRoundCount?: number;
}): { room: PublicGameRoom; player: Player } {
  const hostPlayer: Player = {
    id: nanoid(10),
    name: input.hostName.trim() || "Player 1",
    score: 0,
    joinedAt: now()
  };

  const promptPool = [...DEFAULT_PROMPTS];

  const room: GameRoom = {
    id: nanoid(8),
    hostPlayerId: hostPlayer.id,
    status: "lobby",
    maxPlayers: MAX_PLAYERS,
    targetRoundCount: input.targetRoundCount ?? DEFAULT_ROUND_COUNT,
    currentRoundIndex: 0,
    promptPool,
    players: [hostPlayer],
    rounds: buildRounds(promptPool, input.targetRoundCount ?? DEFAULT_ROUND_COUNT),
    createdAt: now(),
    updatedAt: now()
  };

  store.rooms.set(room.id, room);
  return { room: toPublicRoom(cloneRoom(room)), player: hostPlayer };
}

export function getRoom(roomId: string): GameRoom | undefined {
  const room = store.rooms.get(roomId);
  if (room) {
    syncRoundTimeout(room);
  }
  return room ? cloneRoom(room) : undefined;
}

export function getPublicRoomById(roomId: string): PublicGameRoom | undefined {
  const room = store.rooms.get(roomId);
  if (room) {
    syncRoundTimeout(room);
  }
  return room ? toPublicRoom(cloneRoom(room)) : undefined;
}

export function joinRoom(roomId: string, playerName: string): { room: PublicGameRoom; player: Player } {
  const room = store.rooms.get(roomId);
  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }
  if (room.status !== "lobby") {
    throw new Error("ROOM_ALREADY_STARTED");
  }
  if (room.players.length >= room.maxPlayers) {
    throw new Error("ROOM_FULL");
  }

  const player: Player = {
    id: nanoid(10),
    name: playerName.trim() || `Player ${room.players.length + 1}`,
    score: 0,
    joinedAt: now()
  };

  room.players.push(player);
  room.updatedAt = now();
  store.rooms.set(room.id, room);

  return { room: toPublicRoom(cloneRoom(room)), player };
}

export function startGame(roomId: string, requestedByPlayerId: string): PublicGameRoom {
  const room = store.rooms.get(roomId);
  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }
  if (room.hostPlayerId !== requestedByPlayerId) {
    throw new Error("ONLY_HOST_CAN_START");
  }
  if (room.status !== "lobby") {
    return toPublicRoom(cloneRoom(room));
  }

  room.status = "in_round";
  room.currentRoundIndex = 0;
  const firstRound = room.rounds[0];
  if (firstRound) {
    firstRound.status = "active";
    firstRound.startedAt = now();
  }
  room.updatedAt = now();
  store.rooms.set(room.id, room);

  return toPublicRoom(cloneRoom(room));
}

function advanceRound(room: GameRoom): void {
  const nextIndex = room.currentRoundIndex + 1;
  if (nextIndex >= room.rounds.length) {
    room.status = "finished";
    room.updatedAt = now();
    return;
  }

  room.currentRoundIndex = nextIndex;
  room.rounds[nextIndex].status = "active";
  room.rounds[nextIndex].startedAt = now();
  room.updatedAt = now();
}

export function applyEvaluationResult(input: {
  roomId: string;
  playerId: string;
  evaluation: DrawingEvaluation;
}): {
  matched: boolean;
  room: PublicGameRoom;
  correctPrompt?: string;
} {
  const room = store.rooms.get(input.roomId);
  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }
  syncRoundTimeout(room);
  if (room.status !== "in_round") {
    return { matched: false, room: toPublicRoom(cloneRoom(room)) };
  }

  const round = room.rounds[room.currentRoundIndex];
  if (!round || round.status !== "active") {
    return { matched: false, room: toPublicRoom(cloneRoom(room)) };
  }

  const guessed = normalizePrompt(input.evaluation.guess);
  const expected = normalizePrompt(round.prompt);

  if (guessed !== expected) {
    return { matched: false, room: toPublicRoom(cloneRoom(room)), correctPrompt: round.prompt };
  }

  const player = room.players.find((item) => item.id === input.playerId);
  if (!player) {
    throw new Error("PLAYER_NOT_FOUND");
  }

  round.status = "finished";
  round.endedAt = now();
  round.winnerPlayerId = player.id;
  round.winningGuess = input.evaluation.guess;
  round.winningConfidence = input.evaluation.confidence;
  player.score += 1;

  advanceRound(room);
  store.rooms.set(room.id, room);

  return { matched: true, room: toPublicRoom(cloneRoom(room)), correctPrompt: round.prompt };
}

export function timeoutCurrentRound(roomId: string, roundIndex: number): PublicGameRoom {
  const room = store.rooms.get(roomId);
  if (!room) throw new Error("ROOM_NOT_FOUND");
  syncRoundTimeout(room);
  if (room.status !== "in_round") return toPublicRoom(cloneRoom(room));

  const round = room.rounds[room.currentRoundIndex];
  if (!round || round.status !== "active" || round.index !== roundIndex) {
    return toPublicRoom(cloneRoom(room));
  }

  const elapsed = now() - (round.startedAt ?? 0);
  if (elapsed < ROUND_TIME_LIMIT_MS) {
    return toPublicRoom(cloneRoom(room));
  }

  round.status = "finished";
  round.endedAt = now();

  advanceRound(room);
  store.rooms.set(room.id, room);

  return toPublicRoom(cloneRoom(room));
}

export function getCurrentRound(roomId: string): GameRound | undefined {
  const room = store.rooms.get(roomId);
  if (!room) {
    return undefined;
  }
  syncRoundTimeout(room);
  return structuredClone(room.rounds[room.currentRoundIndex]);
}
