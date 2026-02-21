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
      setError(validateData?.error ?? "AI_KEY_OR_MODEL_INVALID");
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
      setError(data?.error ?? "START_FAILED");
      return;
    }

    setRoom(data.room);
  }

  async function handleSnapshot(imageDataUrl: string): Promise<void> {
    if (!playerId || !room) {
      return;
    }
    if (room.status !== "in_round") {
      return;
    }

    const response = await fetch(`/api/rooms/${roomId}/snapshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, imageDataUrl })
    });

    const data = (await response.json()) as SnapshotResponse & { error?: string };

    if (!response.ok) {
      setError(data?.error ?? "SNAPSHOT_FAILED");
      return;
    }

    setRoom(data.room);
    setLastEvaluation(data.evaluation);
    if (data.matched) {
      setMatchedText(`AIが正解: ${data.correctPrompt ?? "(unknown)"}. 次ラウンドへ移行しました。`);
      setTimeout(() => setMatchedText(null), 2500);
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
    handledTimeoutForRoundRef.current = currentRound.index;

    const idx = currentRound.index;
    void fetch(`/api/rooms/${roomId}/timeout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roundIndex: idx })
    }).then(async (res) => {
      if (res.ok) {
        const data = (await res.json()) as RoomResponse;
        setRoom(data.room);
      }
    });
  }, [timeLeft, currentRound, roomId]);

  return (
    <main className="game-screen">
      <section className="game-top">
        <div className="game-top-row">
          <div>
            <h1>Game Room</h1>
            <p className="muted">
              Room ID: <span className="code">{roomId}</span> | Player ID: <span className="code">{playerId || "(missing)"}</span>
            </p>
            {room ? (
              <p className="muted">
                status: <span className="code">{room.status}</span> | round {Math.min(room.currentRoundIndex + 1, room.rounds.length)}/
                {room.rounds.length}
              </p>
            ) : null}
          </div>

          <div className="row">
            {room?.status === "lobby" && room.hostPlayerId === playerId ? (
              <button className="primary" onClick={() => void handleStart()} disabled={busy}>
                {busy ? "開始中..." : "ゲーム開始"}
              </button>
            ) : null}
          </div>
        </div>

        {aiStatus ? <p className="muted" style={{ marginTop: 6 }}>{aiStatus}</p> : null}
        {error ? (
          <p style={{ marginTop: 6, color: "#9b1c1c" }}>
            Error: <span className="code">{error}</span>
          </p>
        ) : null}

        {room && currentRound ? (
          <div className="game-round-row">
            <p>
              現在のお題: <strong>{currentRound.prompt}</strong>
            </p>
            {timeLeft !== null ? (
              <p
                style={{
                  fontWeight: "bold",
                  fontSize: "1.2rem",
                  color: timeLeft <= 10 ? "#9b1c1c" : timeLeft <= 20 ? "#92400e" : undefined
                }}
              >
                {timeLeft}s
              </p>
            ) : null}
          </div>
        ) : null}

        {matchedText ? <p className="good" style={{ marginTop: 6 }}>{matchedText}</p> : null}
      </section>

      {!room ? (
        <section className="game-loading">
          <p>読み込み中...</p>
        </section>
      ) : (
        <div className="game-content">
          <div className="game-canvas-pane">
            <DrawingBoard
              disabled={room.status !== "in_round" || timeLeft === 0}
              onSnapshot={handleSnapshot}
              canvasHeight="min(58vh, 500px)"
            />
          </div>

          <div className="game-side-pane">
            <section className="game-card">
              <h2>スコアボード</h2>
              <div className="game-score-list">
                {sortedPlayers.map((player, index) => (
                  <div key={player.id} className="row" style={{ justifyContent: "space-between" }}>
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
              <h3>最新の AI 判定</h3>
              {!lastEvaluation ? (
                <p className="muted">まだ判定がありません。</p>
              ) : (
                <p>
                  推定: <strong>{lastEvaluation.guess}</strong> / 信頼度: {lastEvaluation.confidence} / provider:{" "}
                  <span className="code">{lastEvaluation.provider}</span>
                </p>
              )}
            </section>
          </div>
        </div>
      )}
    </main>
  );
}
