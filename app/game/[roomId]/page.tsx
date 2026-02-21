"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { DrawingBoard } from "@/components/drawing-board";
import type { DrawingEvaluation, PublicGameRoom } from "@/lib/game/types";

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

    const response = await fetch(`/api/rooms/${roomId}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestedByPlayerId: playerId })
    });

    const data = await response.json();
    setBusy(false);

    if (!response.ok) {
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

  return (
    <main>
      <section>
        <h1>Game Room</h1>
        <p>
          Room ID: <span className="code">{roomId}</span>
        </p>
        <p>
          Player ID: <span className="code">{playerId || "(missing)"}</span>
        </p>
      </section>

      {error ? (
        <section>
          <p style={{ color: "#9b1c1c" }}>
            Error: <span className="code">{error}</span>
          </p>
        </section>
      ) : null}

      {!room ? (
        <section>
          <p>読み込み中...</p>
        </section>
      ) : (
        <>
          <section>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <h2>ゲーム状態</h2>
                <p className="muted">
                  status: <span className="code">{room.status}</span> | round {Math.min(room.currentRoundIndex + 1, room.rounds.length)}/
                  {room.rounds.length}
                </p>
              </div>
              <div className="row">
                {room.status === "lobby" && room.hostPlayerId === playerId ? (
                  <button className="primary" onClick={() => void handleStart()} disabled={busy}>
                    {busy ? "開始中..." : "ゲーム開始"}
                  </button>
                ) : null}
              </div>
            </div>

            {currentRound ? (
              <div style={{ marginTop: 10 }}>
                <p>
                  現在のお題: <strong>{currentRound.prompt}</strong>
                </p>
                <p className="muted">AIへの選択肢: {currentRound.choices.join(" / ")}</p>
              </div>
            ) : (
              <p>ラウンド情報なし</p>
            )}

            {matchedText ? <p className="good" style={{ marginTop: 8 }}>{matchedText}</p> : null}
          </section>

          <section>
            <h2>スコアボード</h2>
            <div className="grid" style={{ marginTop: 8 }}>
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

          <DrawingBoard disabled={room.status !== "in_round"} onSnapshot={handleSnapshot} />

          <section>
            <h3>最新の AI 判定</h3>
            {!lastEvaluation ? (
              <p className="muted">まだ判定がありません。</p>
            ) : (
              <p>
                推定: <strong>{lastEvaluation.guess}</strong> / 信頼度: {lastEvaluation.confidence} / provider: {" "}
                <span className="code">{lastEvaluation.provider}</span>
              </p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
