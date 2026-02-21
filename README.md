# Gemini Illustration

Next.js フルスタックで作る、最大4人のイラスト対戦ゲームの開発ベースです。

## セットアップ

```bash
npm install
cp .env.example .env.local
npm run dev
```

`AI_EVALUATOR_PROVIDER=mock` でモック判定、`google-live` で Google LiveAPI 連携ポイントを利用できます。

## 仕様

- 要件詳細は `spec.md` を参照
- 現行実装は MVP 基礎セットアップ（インメモリ状態 + API スタブ）
