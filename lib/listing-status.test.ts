import { describe, expect, it } from "vitest";
import { utils, write } from "xlsx";
import {
  applyMarketEvents,
  applySupervision,
  parseImprovement,
  spreadsheetLink,
  JPX,
  type ListingEntry,
} from "./listing-status";

const table = (rows: string[][]) =>
  `<table>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</table>`;
const emptyEntry = (): ListingEntry => ({
  name: "テスト",
  market: "グロース",
  labels: [],
  details: [],
});

describe("JPX listing status parsing", () => {
  it("reads plan codes and the publication date from the current spreadsheet layout", () => {
    const book = utils.book_new();
    utils.book_append_sheet(
      book,
      utils.aoa_to_sheet([
        ["改善期間該当銘柄一覧（2026年10月7日公表）"],
        ["説明", "計画期間"],
        ["コード", "銘柄名", "市場区分"],
        ["184A", "学びエイド", "グロース"],
        [2930, "北の達人", "プライム"],
      ]),
    );
    expect(parseImprovement(write(book, { type: "array", bookType: "xlsx" }))).toEqual({
      codes: ["184A", "2930"],
      publishedDate: "2026-10-07",
    });
  });

  it("discovers the current spreadsheet and rejects links outside JPX", () => {
    expect(
      spreadsheetLink(
        '<a href="/listing/Companies_ImprovementPeriod_JP_261014.xlsx">Excel</a>',
        JPX.improvement,
        /Companies_ImprovementPeriod_JP_.*\.xlsx$/,
      ),
    ).toBe("https://www.jpx.co.jp/listing/Companies_ImprovementPeriod_JP_261014.xlsx");
    expect(() =>
      spreadsheetLink(
        '<a href="https://example.com/data_j.xlsx">Excel</a>',
        JPX.listed,
        /data_j\.xlsx$/,
      ),
    ).toThrow();
  });

  it("keeps simultaneous plan and supervision labels and distinguishes liquidation", () => {
    const header = ["指定年月日", "銘柄名", "コード", "市場区分", "詳細", "備考"];
    const html =
      `<h3><span>監理銘柄（確認中）</span></h3>${table([header, ["2026/07/01", "新東", "5380", "スタンダード", "", "超過計画開示会社"]])}` +
      `<h3>監理銘柄（審査中）</h3>${table([header, ["2026/10/01", "アドバンスクリエイト", "8798", "プライム", "", ""]])}` +
      `<h3>整理銘柄</h3>${table([header, ["2026/10/09", "新光商事", "8141", "プライム", "", ""]])}`;
    const entries: Record<string, ListingEntry> = {};
    applySupervision(entries, html);
    expect(entries["5380"].labels).toEqual(["監理銘柄", "計画入り"]);
    expect(entries["8798"].labels).toEqual(["監理銘柄"]);
    expect(entries["8141"].labels).toEqual(["整理銘柄"]);
    expect(() => applySupervision({}, "<h1>メンテナンス中</h1>")).toThrow();
  });

  it("applies effective market changes and delistings but not future announcements", () => {
    const entries: Record<string, ListingEntry> = {
      "4586": emptyEntry(),
      "4475": emptyEntry(),
      "1234": emptyEntry(),
    };
    applyMarketEvents(
      entries,
      {
        transfers: table([
          ["変更日", "会社名", "コード", "市場区分"],
          ["2026/10/20 ～ 2026/10/22", "HENNGE", "4475", "プライム"],
          ["2026/10/07", "メドレックス", "4586", "スタンダード"],
        ]),
        newlyListed: table([
          ["上場日", "会社名", "コード"],
          ["市場区分"],
          ["2026/10/01（2026/09/01）", "新規", "641A"],
          ["プライム"],
          ["2026/11/10（2026/10/06）", "予定", "660A"],
          ["グロース"],
        ]),
        delisted: table([
          ["上場廃止日", "銘柄名", "コード"],
          ["2026/10/10", "廃止", "1234"],
        ]),
      },
      "2026-10-11",
    );
    expect(entries["4586"].market).toBe("スタンダード");
    expect(entries["4475"].market).toBe("グロース");
    expect(entries["1234"].market).toBeNull();
    expect(entries["1234"].delisted).toBe(true);
    expect(entries).toHaveProperty("641A.market", "プライム");
    expect(entries).not.toHaveProperty("660A");
  });
});
