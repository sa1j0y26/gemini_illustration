"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function Lobby() {
  const router = useRouter();
  const [hostName, setHostName] = useState("Player1");
  const [roundCount, setRoundCount] = useState(10);
  const [joinName, setJoinName] = useState("Player2");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateRoom(): Promise<void> {
    setBusy(true);
    setError(null);

    const response = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hostName,
        targetRoundCount: roundCount
      })
    });

    const data = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(data?.error ?? "部屋作成に失敗しました");
      return;
    }

    router.push(`/game/${data.room.id}?playerId=${data.player.id}`);
  }

  async function handleJoinRoom(): Promise<void> {
    if (!joinRoomId.trim()) {
      setError("参加する部屋IDを入力してください");
      return;
    }

    setBusy(true);
    setError(null);

    const response = await fetch(`/api/rooms/${joinRoomId}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerName: joinName })
    });

    const data = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(data?.error ?? "部屋参加に失敗しました");
      return;
    }

    router.push(`/game/${data.room.id}?playerId=${data.player.id}`);
  }

  return (
    <div className="grid two">
      <section>
        <h2>部屋を作成</h2>
        <p className="muted">ホストとして部屋を作り、最大4人でゲームを開始します。</p>
        <div style={{ height: 10 }} />

        <label>
          プレイヤー名
          <input value={hostName} maxLength={24} onChange={(event) => setHostName(event.target.value)} />
        </label>

        <label>
          お題数
          <input
            type="number"
            min={1}
            max={30}
            value={roundCount}
            onChange={(event) => setRoundCount(Number(event.target.value))}
          />
        </label>

        <button className="primary" onClick={handleCreateRoom} disabled={busy}>
          {busy ? "作成中..." : "部屋を作る"}
        </button>
      </section>

      <section>
        <h2>部屋に参加</h2>
        <p className="muted">招待された部屋IDを使って参加します。</p>
        <div style={{ height: 10 }} />

        <label>
          部屋ID
          <input
            value={joinRoomId}
            maxLength={16}
            onChange={(event) => setJoinRoomId(event.target.value.trim())}
            placeholder="例: ab12cd34"
          />
        </label>

        <label>
          プレイヤー名
          <input value={joinName} maxLength={24} onChange={(event) => setJoinName(event.target.value)} />
        </label>

        <button onClick={handleJoinRoom} disabled={busy}>
          {busy ? "参加中..." : "参加する"}
        </button>

        {error ? (
          <p style={{ marginTop: 12, color: "#9b1c1c" }}>
            Error: <span className="code">{error}</span>
          </p>
        ) : null}
      </section>
    </div>
  );
}
