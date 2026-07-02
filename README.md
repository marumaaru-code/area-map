# Instagram運用支援ツール（エリアマップ分析）

工務店のInstagram運用担当者向けの社内Webツールです。

## 機能

- **エリアマップ** (`/map`): OpenStreetMapベースの地図上に工務店・結婚式場・道の駅・保育園・家具屋をピン表示。施設の手動追加・Instagram URL登録が可能。
- **狙い目エリア** (`/areas`): 指定エリアをグリッド分割してスコアリング（競合工務店少 × 関連施設多 = 高スコア）。
- **投稿企画** (`/posts`): 投稿ログを蓄積し、Claude AIが次の企画案を3〜5個提案。
- **類似アカウント** (`/similar`): 手動メモ済みの工務店を自社コンセプトとAIが比較・ランキング。

## セットアップ

### 1. 環境変数

`.env.local` を編集し、以下を設定してください：

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciO...
ANTHROPIC_API_KEY=sk-ant-...
```

### 2. Supabaseのテーブル作成

Supabaseプロジェクトの「SQL Editor」に `supabase-schema.sql` の内容を貼り付けて実行してください。

### 3. 開発サーバー起動

```bash
npm run dev
```

http://localhost:3000 にアクセスすると `/map` にリダイレクトされます。

## ⚠️ 工務店データの精度について

工務店・建築会社はOpenStreetMap（OSM）上のタグ付けが日本では不十分なため、**Overpass APIの検索結果だけでは対象施設を網羅できない場合があります**。

実際の運用では、以下のフローを推奨します：
1. Overpass APIで取得されたピンを確認
2. 不足している工務店は「施設を手動追加」ボタンから追加
3. 各施設のメモ欄にテイスト・価格帯・施工エリアを記録

## 技術スタック

- **フロントエンド**: Next.js (App Router) + TypeScript + Tailwind CSS
- **地図**: Leaflet.js + react-leaflet（無料・APIキー不要）
- **POI検索**: Overpass API（OpenStreetMapデータ、無料）
- **住所変換**: Nominatim API（OSM公式、無料）
- **DB**: Supabase（無料枠）
- **AI**: Anthropic Claude API (`claude-sonnet-4-6`)

## デプロイ（Vercel）

Vercelに接続し、環境変数（`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`）をVercelの設定画面から追加してください。

