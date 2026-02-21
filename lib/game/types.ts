export type RoomStatus = "lobby" | "in_round" | "finished";
export type RoundStatus = "pending" | "active" | "finished";

export interface Player {
  id: string;
  name: string;
  score: number;
  joinedAt: number;
}

export interface GameRound {
  index: number;
  prompt: string;
  choices: string[];
  status: RoundStatus;
  startedAt?: number;
  endedAt?: number;
  winnerPlayerId?: string;
  winningGuess?: string;
  winningConfidence?: number;
}

export interface GameRoom {
  id: string;
  hostPlayerId: string;
  status: RoomStatus;
  maxPlayers: number;
  targetRoundCount: number;
  currentRoundIndex: number;
  promptPool: string[];
  players: Player[];
  rounds: GameRound[];
  createdAt: number;
  updatedAt: number;
}

export interface PublicGameRoom {
  id: string;
  hostPlayerId: string;
  status: RoomStatus;
  maxPlayers: number;
  targetRoundCount: number;
  currentRoundIndex: number;
  players: Player[];
  rounds: GameRound[];
  createdAt: number;
  updatedAt: number;
}

export interface DrawingEvaluation {
  guess: string;
  confidence: number;
  provider: "mock" | "google-live" | "nanobanana";
  reason?: string;
}
