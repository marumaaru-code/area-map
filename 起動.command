#!/bin/bash
cd "$(dirname "$0")"

# nvm 経由で node を読み込む
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# 既に 3000 番ポートが使われていたら一度止める
lsof -ti:3000 | xargs kill -9 2>/dev/null

# 開発サーバー起動（バックグラウンド）
npm run dev &
SERVER_PID=$!

# 起動待ち → ブラウザで開く
sleep 4
open http://localhost:3000

# サーバーを前面に持ってきてターミナルを維持
wait $SERVER_PID
