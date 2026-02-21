import { Lobby } from "@/components/lobby";

export default function HomePage() {
  return (
    <main>
      <section>
        <h1>Gemini Illustration Game</h1>
        <p>
          最大4人で同じお題を描き、AIが最初に正解したプレイヤーに1点が入るリアルタイム対戦の開発ベースです。
        </p>
      </section>

      <Lobby />
    </main>
  );
}
