# Gemini Illustration Game - 仕様書 (初版)

## 1. 目的
プレイヤー最大4人が同一のお題を描き、AIが最初に正解したプレイヤーへ得点を付与するリアルタイム対戦ゲームを提供する。

## 2. 用語
- ルーム: 1ゲームセッション
- ラウンド: 1お題分の対戦単位
- スナップショット: キャンバス画像を一定間隔でAI評価に送るデータ
- 正解判定: AI推定が現在ラウンドのお題と一致した状態

## 3. ゲームルール
- プレイヤー数は1〜4人
- 全員に同一のお題を提示する
- お題は色などの属性を含まない単純名詞のみで構成する（例: パンダ、木、テニス）
- AIにはお題そのものは渡さず、お題プール全件(`choices`)を文脈として渡す
- デフォルトお題プールは約300件
- 1ゲームで使うお題はプールから10件をランダム抽出
- AIが任意プレイヤーの絵を正解した瞬間、そのプレイヤーへ1点
- 得点確定と同時に、全員を強制的に次ラウンドへ移行
- 指定ラウンド数(例: 10)消化後、最高得点プレイヤーが勝利

## 4. 機能要件
### 4.1 ルーム管理
- ルーム作成
  - ホスト名
  - ラウンド数(1-30)
  - お題プールはシステム固定（入力不要）
- ルーム参加
  - 部屋ID + プレイヤー名
- ホストによるゲーム開始

### 4.2 ラウンド進行
- ルーム作成時にお題プールからそのゲームで使う10件をランダム抽出
- 開始時、ラウンド0を `active` にする
- `active` ラウンド中はキャンバス画像を定期送信
- 正解時に以下を同時に実施
  - 勝者記録
  - 得点+1
  - ラウンド終了 (`finished`)
  - 次ラウンド `active` 化
- 最終ラウンド終了時はルーム状態を `finished`

### 4.3 AI評価
- 入力
  - 画像(data URL)
  - 選択肢(お題プール全件)
- 出力
  - 推定語(`guess`)
  - 信頼度(`confidence`)
  - provider名
- provider切替
  - `mock`
  - `google-live` (Gemini APIへ実リクエスト)
- ゲーム開始前にAPIキー/モデルの有効性チェックを実施

### 4.4 スコア/結果
- スコアボードをリアルタイム更新
- ゲーム終了後は順位表示

### 4.5 オプション機能
- 最も良いイラストをAIが選定し、NanoBananaで彩色して結果画面に表示
- 現行セットアップでは連携ポイントのみを準備

## 5. 非機能要件
- スタック: Next.js (App Router) フルスタック
- MVPではメモリ内状態管理(単一プロセス)
- 将来拡張で Redis / DB / WebSocket に置き換え可能な構成
- モバイル・デスクトップ双方で操作可能

## 6. API設計 (MVP)
- `POST /api/rooms`
  - ルーム作成
- `GET /api/rooms/:roomId`
  - ルーム状態取得
- `POST /api/rooms/:roomId/players`
  - 参加
- `POST /api/rooms/:roomId/start`
  - ゲーム開始（事前にAI接続チェック）
- `POST /api/rooms/:roomId/snapshot`
  - スナップショット評価 + 正解時の状態遷移
- `POST /api/ai/validate`
  - AI設定・APIキー有効性チェック

## 7. データモデル
### Player
- id
- name
- score
- joinedAt

### GameRound
- index
- prompt
- choices
- status (`pending|active|finished`)
- winnerPlayerId
- winningGuess
- winningConfidence
- startedAt / endedAt

### GameRoom
- id
- hostPlayerId
- status (`lobby|in_round|finished`)
- maxPlayers (=4)
- targetRoundCount
- currentRoundIndex
- promptPool
- players[]
- rounds[]

## 8. 開発マイルストーン
1. MVP土台 (完了)
   - Next.js基盤
   - ルーム/ラウンド/スコア遷移
   - モックAI評価
2. AI実接続 (完了)
   - Gemini APIで `evaluateWithGoogleLive` 実装
   - 選択肢プロンプト設計・判定精度改善
3. リアルタイム強化
   - ポーリング→WebSocket/SSE移行
   - 同期遅延/競合対策
4. 永続化
   - Redis or DB導入
   - セッション復帰
5. オプション実装
   - NanoBanana彩色パイプライン

## 9. 既知の制約 (現状)
- サーバ再起動でゲーム状態は消える
- ポーリング方式のため厳密なリアルタイム性は限定的
- NanoBanana はスタブ接続点のみ

## 10. 初期ディレクトリ構成
- `app/` UI・API
- `components/` ロビー・キャンバス
- `lib/game/` ドメインモデル・状態遷移
- `lib/ai/` AI provider 抽象と実装ポイント
- `spec.md` 仕様書
