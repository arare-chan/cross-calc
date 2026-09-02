# Issue tracker

## 方針

作業管理には [GitHub Issues](https://github.com/arare-chan/cross-calc/issues) を使う。ただし個人開発のため、現在の依頼をその場で完了できる小さな変更は Issue を経由せず直接実施してよい。後日対応する作業、未確定事項、複数工程に分かれる変更だけを Issue に残す。

Pull Request は作成しない。変更は `main` に直接コミットして `origin/main` へ push する。

## Issueの書き方

- タイトルは成果が分かる動詞句にする。
- 本文に背景、対象ファイル、完了条件、確認方法を書く。
- 外部情報に基づく数値更新では、確認すべき公式URLと調査日を含める。
- 個人運用のため、担当者、見積り、承認欄は必須にしない。
- リポジトリに triage スキルがない間は、状態管理専用のラベル体系を追加しない。

## 操作

GitHub CLI が利用でき、認証済みなら次のコマンドを使う。利用できない環境では GitHub のWeb画面で同じ操作を行う。

```text
gh issue create --title "..." --body "..."
gh issue view <number> --comments
gh issue list --state open
gh issue comment <number> --body "..."
gh issue close <number> --comment "..."
```

## 完了条件

Issue に紐づく作業は、変更の検証、`main` へのコミット、`origin/main` への push、GitHub Pages のデプロイ成功、公開ページの応答確認を終えてから close する。push できない場合やデプロイが失敗した場合は close せず、理由を記録する。
