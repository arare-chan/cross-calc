#!/usr/bin/env python3
"""cost-simulator.html の銘柄名辞書(STOCK_NAMES)を JPX 公式データから更新するスクリプト。

新規上場・社名変更・上場廃止を反映したいときに実行する(月1回程度で十分)。

使い方:
  1. 依存ライブラリ xlrd が必要(システムPythonが保護されている場合は venv で):
       python3 -m venv /tmp/jpx-venv && /tmp/jpx-venv/bin/pip install xlrd
  2. 実行:
       /tmp/jpx-venv/bin/python tools/update-stock-names.py
  3. cost-simulator.html 内の STOCK_NAMES ブロックが最新データで置き換わる。
     Artifact 配布版も更新する場合は Claude に「Artifactも更新して」と頼む。

データ出典: JPX「東証上場銘柄一覧」(月次更新)
  https://www.jpx.co.jp/markets/statistics-equities/misc/01.html
"""
import json
import os
import unicodedata
import urllib.request

import xlrd

XLS_URL = "https://www.jpx.co.jp/markets/statistics-equities/misc/tvdivq0000001vg2-att/data_j.xls"
HTML_PATH = os.path.join(os.path.dirname(__file__), "cost-simulator.html")

# 優待がありうる区分のみ(ETF・ETN、PRO Market は除外)
INCLUDE = {
    "プライム(内国株式)", "スタンダード(内国株式)", "グロース(内国株式)",
    "プライム(外国株式)", "スタンダード(外国株式)", "グロース(外国株式)",
    "REIT・ベンチャーファンド・カントリーファンド・インフラファンド", "出資証券",
}

MARKER_START = "/* === STOCK_NAMES:BEGIN(自動生成 — 手で編集しない) === */"
MARKER_END = "/* === STOCK_NAMES:END === */"


def norm(s: str) -> str:
    return unicodedata.normalize("NFKC", str(s)).strip()


def main() -> None:
    print("JPXから東証上場銘柄一覧をダウンロード中…")
    xls_bytes = urllib.request.urlopen(XLS_URL, timeout=60).read()
    book = xlrd.open_workbook(file_contents=xls_bytes)
    sh = book.sheet_by_index(0)

    names = {}
    base_date = None
    for r in range(1, sh.nrows):
        if base_date is None:
            base_date = str(int(sh.cell_value(r, 0)))
        # 市場区分も NFKC 正規化して比較(全角括弧の揺れを吸収)
        if norm(sh.cell_value(r, 3)) not in INCLUDE:
            continue
        code_v = sh.cell_value(r, 1)
        code = str(int(code_v)) if isinstance(code_v, float) else str(code_v).strip()
        names[code] = norm(sh.cell_value(r, 2))

    js = json.dumps(names, ensure_ascii=False, separators=(",", ":"))
    block = (
        MARKER_START + "\n"
        + "// 銘柄コード → 銘柄名の辞書。JPX「東証上場銘柄一覧」(data_j.xls、基準日 " + base_date + ")から生成。\n"
        + "// 更新するときは tools/update-stock-names.py を実行する(新規上場・社名変更・上場廃止の反映)。\n"
        + "const STOCK_NAMES = " + js + ";\n"
        + MARKER_END
    )

    src = open(HTML_PATH, encoding="utf-8").read()
    if MARKER_START not in src or MARKER_END not in src:
        raise SystemExit("STOCK_NAMES ブロックが見つかりません: " + HTML_PATH)
    pre, rest = src.split(MARKER_START, 1)
    _, post = rest.split(MARKER_END, 1)
    open(HTML_PATH, "w", encoding="utf-8").write(pre + block + post)
    print(f"更新完了: {len(names)}銘柄(基準日 {base_date})→ {HTML_PATH}")


if __name__ == "__main__":
    main()
