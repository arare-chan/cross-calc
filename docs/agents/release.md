# Sites release

## 前提

- `main` で作業し、Pull Requestや作業用ブランチは作らない。
- `.openai/hosting.json` の既存 `project_id` を必ず再利用する。
- Sitesへの公開前に、アクセス設定が意図した範囲（現在は一般公開）であることを確認する。

## 検証

```powershell
npm ci
npm test
npm run typecheck
npm run lint
npm run build
npm audit
```

ローカルで `/` が200を返すこと、`/api/quote?code=9861` がコード・銘柄名・株価・市場時刻・出典を返すこと、不正なコードが400、存在しないコードが404になることを確認する。

## 公開

1. 検証済みの変更をコミットし、`origin/main` へ直接pushする。
2. Sitesのソースリポジトリへ同じコミットをpushする。
3. 検証済みの `dist/` をSites用アーカイブへまとめ、コミットSHAとともにバージョン保存する。
4. 一般公開のSitesとして保存済みバージョンをデプロイし、完了まで状態を確認する。
5. 公開URLの `/`、`/calculator.html`、`/api/quote?code=9861` を確認する。

GitHub Pagesの停止は、Sitesの公開ページと株価取得がともに成功した後にだけ行う。初回移行後はGitHub Pagesを再度有効化しない。
