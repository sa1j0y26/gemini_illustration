# Gemini Illustration

Next.js フルスタックで作る、最大4人のイラスト対戦ゲームの開発ベースです。

## セットアップ

```bash
npm install
cp .env.example .env.local
npm run dev
```

`AI_EVALUATOR_PROVIDER=mock` でモック判定、`google-live` で Gemini API に実際の画像判定リクエストを送信します。
`google-live` 利用時はゲーム開始前に API キー/モデルの有効性チェックを実施します。

## 現在のゲーム設定

- デフォルトお題プール: 300件
- お題形式: 色などを含まない単純名詞（例: パンダ / 木 / テニス）
- 1ゲームのお題数: 10件（プールからランダム抽出）
- AIへの候補入力: お題プール全件

## 仕様

- 要件詳細は `spec.md` を参照
- 現行実装は MVP 基礎セットアップ（インメモリ状態）
