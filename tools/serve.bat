@echo off
chcp 65001 >nul
rem 優待クロス コスト計算シミュレーターを localhost で開く起動スクリプト(Windows用)。
rem ダブルクリックで実行すると、簡易サーバーを立ててブラウザでシミュレーターを開く。
rem ファイルを直接開く(file://)のと違い、株価の「自動取得」が使える。
rem 終了するには、このウィンドウを閉じる(または Ctrl+C)。
rem ※Python が必要。無い場合は cost-simulator.html をダブルクリックで開く(株価は手入力になる)。
cd /d "%~dp0"
start "" /min cmd /c "timeout /t 1 /nobreak >nul && start "" http://localhost:8931/cost-simulator.html"
where py >nul 2>nul
if %errorlevel%==0 (
  py -m http.server 8931
) else (
  python -m http.server 8931
)
echo.
echo サーバーを終了しました。Python が見つからない場合は cost-simulator.html を直接開いてください(株価は手入力)。
pause
