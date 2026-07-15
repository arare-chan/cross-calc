/**
 * 自分専用の株価取得中継(Google Apps Script)
 *
 * シミュレーターの株価「⚡ 自動取得」は、ブラウザの制約(CORS)のため中継サーバー経由で
 * Yahoo Finance のデータを取る。公開の無料中継は不安定なので、自分の Google アカウントで
 * 専用中継を1つ作っておくと安定して使える(無料・所要約5分)。
 *
 * 作り方:
 * 1. https://script.new を開く(自分の Google アカウントでログイン)
 * 2. このファイルの中身をエディタに貼り付けて保存
 * 3. 右上「デプロイ」>「新しいデプロイ」> 種類の選択「ウェブアプリ」
 *      - 次のユーザーとして実行: 自分
 *      - アクセスできるユーザー: 全員
 * 4. 「デプロイ」を押し、表示されたウェブアプリ URL(https://script.google.com/macros/s/…/exec)をコピー
 * 5. シミュレーターの ⚙設定 >「株価取得の中継URL」の先頭行に、次の形式で貼る:
 *      <コピーしたURL>?url={url}
 *
 * 補足:
 * - URL を知っている人は誰でもこの中継を使えるが、Yahoo Finance の公開データを読むだけの
 *   機能なので実害はない。無効化したくなったらデプロイを削除(アーカイブ)すればよい。
 * - 取得先は query1.finance.yahoo.com に限定してある(オープンプロキシ化の防止)。
 */
function doGet(e) {
  const url = (e && e.parameter && e.parameter.url) || '';
  if (!/^https:\/\/query1\.finance\.yahoo\.com\//.test(url)) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'bad url' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const res = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  return ContentService.createTextOutput(res.getContentText())
    .setMimeType(ContentService.MimeType.JSON);
}
