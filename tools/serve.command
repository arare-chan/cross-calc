#!/bin/bash
# 優待クロス コスト計算シミュレーターを localhost で開く起動スクリプト(macOS)。
#
# ダブルクリックで実行すると、簡易サーバーを立ててブラウザでシミュレーターを開く。
# ファイルを直接開く(file://)のと違い、localhost になるため株価の「⚡ 自動取得」が
# 無料中継(corsproxy.io は無料枠が localhost 限定)で使える。
#
# 終了するには、このターミナルウィンドウで Ctrl+C を押すか、ウィンドウを閉じる。
cd "$(dirname "$0")"
PORT=8931
( sleep 1; open "http://localhost:$PORT/cost-simulator.html" ) &
exec python3 -m http.server "$PORT"
