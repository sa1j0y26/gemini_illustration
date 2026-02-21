import { Lobby } from "@/components/lobby";

export default function HomePage() {
  return (
    <main className="home-shell">
      <section className="hero-panel">
        <p className="hero-kicker">Real-time Sketch Battle</p>
        <h1>Gemini Illustration Game</h1>
        <p className="hero-copy">最大4人で同じお題を描き、AIが最初に正解したプレイヤーに1点が入る対戦ゲーム。</p>
        <div className="hero-stats">
          <div className="hero-stat">
            <strong>4</strong>
            <span>players max</span>
          </div>
          <div className="hero-stat">
            <strong>10</strong>
            <span>rounds default</span>
          </div>
          <div className="hero-stat">
            <strong>300</strong>
            <span>prompt pool</span>
          </div>
        </div>
      </section>

      <Lobby />
    </main>
  );
}
