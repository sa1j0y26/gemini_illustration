"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { DrawingBoard } from "@/components/drawing-board";
import type { DrawingEvaluation, PublicGameRoom } from "@/lib/game/types";
import { ROUND_TIME_LIMIT_MS } from "@/lib/game/config";

interface RoomResponse {
  room: PublicGameRoom;
}

interface SnapshotResponse {
  room: PublicGameRoom;
  matched: boolean;
  correctPrompt?: string;
  evaluation: DrawingEvaluation;
  transientError?: string;
}

function formatGameError(code: string | undefined): string {
  const normalized = code?.toLowerCase() ?? "";
  switch (code) {
    case "GOOGLE_LIVE_TIMEOUT":
      return "AI応答がタイムアウトしました。少し待って再試行してください。";
    case "GOOGLE_LIVE_SOCKET_CLOSED":
    case "GOOGLE_LIVE_SOCKET_ERROR":
      return "AI接続が不安定です。再試行してください。";
    case "GOOGLE_LIVE_EMPTY_RESPONSE":
    case "EMPTY_MODEL_RESPONSE":
    case "MODEL_RESPONSE_NOT_JSON":
    case "MODEL_GUESS_EMPTY":
      return "AI応答を取得できませんでした。再試行してください。";
    case "GOOGLE_API_KEY_MISSING":
    case "GOOGLE_API_KEY_INVALID_OR_MODEL_UNAVAILABLE":
    case "GOOGLE_API_MODEL_NOT_FOUND":
      return "AI設定に問題があります。APIキーとモデルを確認してください。";
    case "GOOGLE_API_RATE_LIMIT":
      return "AI APIの利用上限に達しました。時間をおいて再試行してください。";
    default:
      if (normalized.includes("aborted")) {
        return "AI接続を再試行しています。";
      }
      return code ?? "エラーが発生しました。再試行してください。";
  }
}

function isTransientSnapshotError(code: string | undefined): boolean {
  const normalized = code?.toLowerCase() ?? "";
  return (
    normalized.includes("aborted") ||
    normalized.includes("timeout") ||
    code === "GOOGLE_LIVE_TIMEOUT" ||
    code === "GOOGLE_LIVE_SOCKET_CLOSED" ||
    code === "GOOGLE_LIVE_SOCKET_ERROR" ||
    code === "GOOGLE_LIVE_EMPTY_RESPONSE" ||
    code === "EMPTY_MODEL_RESPONSE" ||
    code === "MODEL_RESPONSE_NOT_JSON" ||
    code === "MODEL_GUESS_EMPTY" ||
    code === "GOOGLE_API_RATE_LIMIT"
  );
}

export default function GamePage() {
  const params = useParams<{ roomId: string }>();
  const searchParams = useSearchParams();
  const playerId = searchParams.get("playerId") ?? "";
  const roomId = params.roomId;

  const [room, setRoom] = useState<PublicGameRoom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastEvaluation, setLastEvaluation] = useState<DrawingEvaluation | null>(null);
  const [matchedText, setMatchedText] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const handledTimeoutForRoundRef = useRef<number>(-1);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [clearSignal, setClearSignal] = useState(0);
  const [successSignal, setSuccessSignal] = useState(0);
  const [successLabel, setSuccessLabel] = useState("正解!");
  const lastWinEventRef = useRef<string>("");

  const fetchRoom = useCallback(async () => {
    const response = await fetch(`/api/rooms/${roomId}`, { cache: "no-store" });
    const data = (await response.json()) as RoomResponse;

    if (!response.ok) {
      throw new Error((data as { error?: string }).error ?? "ROOM_FETCH_FAILED");
    }

    setRoom(data.room);
  }, [roomId]);

  useEffect(() => {
    void fetchRoom().catch((cause) => {
      setError(cause instanceof Error ? cause.message : "ROOM_FETCH_FAILED");
    });
  }, [fetchRoom]);

  useEffect(() => {
    const timer = setInterval(() => {
      void fetchRoom().catch(() => {
        // polling中の一時エラーは次回リトライ
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [fetchRoom]);

  async function handleStart(): Promise<void> {
    if (!playerId) {
      setError("playerId が不足しています");
      return;
    }

    setBusy(true);
    setError(null);
    setAiStatus("AI接続を確認中...");

    const validateResponse = await fetch("/api/ai/validate", { method: "POST" });
    const validateData = await validateResponse.json();
    if (!validateResponse.ok || !validateData?.ok) {
      setBusy(false);
      setAiStatus(null);
      setError(formatGameError(validateData?.error ?? "AI_KEY_OR_MODEL_INVALID"));
      return;
    }
    setAiStatus(`AI接続OK (${validateData.provider}${validateData.detail ? `: ${validateData.detail}` : ""})`);

    const response = await fetch(`/api/rooms/${roomId}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestedByPlayerId: playerId })
    });

    const data = await response.json();
    setBusy(false);

    if (!response.ok) {
      setAiStatus(null);
      setError(formatGameError(data?.error ?? "START_FAILED"));
      return;
    }

    setRoom(data.room);
  }

  async function handleSnapshot(imageDataUrl: string): Promise<boolean> {
    if (!playerId || !room) {
      return false;
    }
    if (room.status !== "in_round") {
      return true;
    }

    try {
      const response = await fetch(`/api/rooms/${roomId}/snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, imageDataUrl })
      });

      const data = (await response.json()) as SnapshotResponse & { error?: string };

      if (!response.ok) {
        const code = data?.error ?? "SNAPSHOT_FAILED";
        if (isTransientSnapshotError(code)) {
          setError(null);
          return false;
        }
        setError(formatGameError(code));
        return false;
      }

      setRoom(data.room);
      if (data.evaluation.reason !== "ai-soft-failure") {
        setLastEvaluation(data.evaluation);
        setError(null);
        return true;
      }

      if (isTransientSnapshotError(data.transientError)) {
        setError(null);
        return false;
      }

      setError(formatGameError(data.transientError ?? "SNAPSHOT_FAILED"));
      return false;
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "SNAPSHOT_NETWORK_ERROR";
      if (isTransientSnapshotError(code)) {
        setError(null);
        return false;
      }
      setError(formatGameError(code));
      return false;
    }
  }

  const currentRound = useMemo(() => {
    if (!room) {
      return null;
    }
    return room.rounds[room.currentRoundIndex] ?? null;
  }, [room]);

  const sortedPlayers = useMemo(() => {
    if (!room) {
      return [];
    }
    return [...room.players].sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt);
  }, [room]);

  const roundProgress = useMemo(() => {
    if (!room || room.rounds.length === 0) {
      return 0;
    }
    return Math.min(100, Math.round(((room.currentRoundIndex + (room.status === "finished" ? 1 : 0)) / room.rounds.length) * 100));
  }, [room]);

  useEffect(() => {
    if (!currentRound || currentRound.status !== "active" || !currentRound.startedAt) {
      setTimeLeft(null);
      return;
    }

    const compute = () => Math.max(0, Math.ceil((ROUND_TIME_LIMIT_MS - (Date.now() - currentRound.startedAt!)) / 1000));
    setTimeLeft(compute());

    const timer = setInterval(() => setTimeLeft(compute()), 250);
    return () => clearInterval(timer);
  }, [currentRound?.index, currentRound?.status, currentRound?.startedAt]);

  useEffect(() => {
    if (timeLeft !== 0 || !currentRound || currentRound.status !== "active") return;
    if (handledTimeoutForRoundRef.current === currentRound.index) return;
    const idx = currentRound.index;
    handledTimeoutForRoundRef.current = idx;
    void fetch(`/api/rooms/${roomId}/timeout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roundIndex: idx })
    }).then(async (res) => {
      if (res.ok) {
        const data = (await res.json()) as RoomResponse;
        setRoom(data.room);
        return;
      }
      if (handledTimeoutForRoundRef.current === idx) {
        handledTimeoutForRoundRef.current = -1;
      }
    }).catch(() => {
      if (handledTimeoutForRoundRef.current === idx) {
        handledTimeoutForRoundRef.current = -1;
      }
    });
  }, [timeLeft, currentRound, roomId]);

  useEffect(() => {
    if (!room) {
      return;
    }
    const latestWinRound = [...room.rounds]
      .filter((round) => round.status === "finished" && round.winnerPlayerId)
      .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))[0];

    if (!latestWinRound?.winnerPlayerId) {
      return;
    }

    const eventKey = `${latestWinRound.index}:${latestWinRound.winnerPlayerId}:${latestWinRound.endedAt ?? 0}`;
    if (eventKey === lastWinEventRef.current) {
      return;
    }
    lastWinEventRef.current = eventKey;

    const winnerName = room.players.find((player) => player.id === latestWinRound.winnerPlayerId)?.name ?? "誰か";
    const prompt = latestWinRound.winningGuess ?? latestWinRound.prompt;
    const message = `正解! ${winnerName} が「${prompt}」を当てました。`;

    setMatchedText(message);
    setSuccessLabel(`${winnerName} 正解!`);
    setClearSignal(Date.now());
    setSuccessSignal(Date.now());
    setTimeout(() => setMatchedText(null), 2500);
  }, [room]);

  return (
    <main className="game-screen">
      <section className="game-top game-panel">
        <div className="game-top-row">
          <div className="game-headline">
            <p className="panel-kicker">Live Match</p>
            <h1>Game Room</h1>
            <div className="game-meta-chips">
              <span className="game-chip">
                Room: <span className="code">{roomId}</span>
              </span>
              <span className="game-chip">
                You: <span className="code">{playerId || "(missing)"}</span>
              </span>
              {room ? (
                <span className="game-chip">
                  Status: <span className="code">{room.status}</span>
                </span>
              ) : null}
            </div>
          </div>

          <div className="row game-top-actions">
            {room?.status === "lobby" && room.hostPlayerId === playerId ? (
              <button className="primary" onClick={() => void handleStart()} disabled={busy}>
                {busy ? "開始中..." : "ゲーム開始"}
              </button>
            ) : null}
          </div>
        </div>

        {room ? (
          <div className="game-progress">
            <div className="game-progress-head">
              <p className="muted">
                round {Math.min(room.currentRoundIndex + 1, room.rounds.length)}/{room.rounds.length}
              </p>
              <p className="muted">{roundProgress}%</p>
            </div>
            <div className="game-progress-bar">
              <span style={{ width: `${roundProgress}%` }} />
            </div>
          </div>
        ) : null}

        {room && currentRound ? (
          <div className="game-round-row game-round-card">
            <div>
              <p className="muted">現在のお題</p>
              <p className="game-prompt-word">{currentRound.prompt}</p>
            </div>
            {timeLeft !== null ? (
              <p className={`game-timer ${timeLeft <= 10 ? "danger" : timeLeft <= 20 ? "warn" : ""}`}>{timeLeft}s</p>
            ) : (
              <p className="muted">--</p>
            )}
          </div>
        ) : null}

        {aiStatus ? <p className="muted game-inline-status">{aiStatus}</p> : null}
        {error ? (
          <p className="error-box game-inline-status">
            Error: <span className="code">{error}</span>
          </p>
        ) : null}
        {matchedText ? <p className="good game-inline-status">{matchedText}</p> : null}
      </section>

      {!room ? (
        <section className="game-loading game-panel">
          <p>読み込み中...</p>
        </section>
      ) : (
        <div className="game-content">
          <div className="game-canvas-pane">
            <DrawingBoard
              disabled={room.status !== "in_round" || timeLeft === 0}
              onSnapshot={handleSnapshot}
              canvasHeight="min(58vh, 500px)"
              roundKey={currentRound?.index}
              clearSignal={clearSignal}
              successSignal={successSignal}
              successLabel={successLabel}
            />
          </div>

          <div className="game-side-pane">
            <section className="game-card">
              <div className="game-card-head">
                <h2>スコアボード</h2>
                <span className="game-chip">{sortedPlayers.length} players</span>
              </div>
              <div className="game-score-list">
                {sortedPlayers.map((player, index) => (
                  <div key={player.id} className={`game-score-row ${index === 0 ? "lead" : ""}`}>
                    <p>
                      {index + 1}. {player.name}
                      {player.id === room.hostPlayerId ? " (host)" : ""}
                    </p>
                    <p>
                      <strong>{player.score}</strong> pt
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="game-card">
              <div className="game-card-head">
                <h3>最新の AI 判定</h3>
                <span className="game-chip">Live</span>
              </div>
              {!lastEvaluation ? (
                <p className="muted">まだ判定がありません。</p>
              ) : (
                <p className="game-ai-result">
                  推定: <strong>{lastEvaluation.guess}</strong>
                  <br />
                  信頼度: {lastEvaluation.confidence}
                  <br />
                  provider: <span className="code">{lastEvaluation.provider}</span>
                </p>
              )}
            </section>
          </div>
        </div>
      )}
    </main>
  );
}
