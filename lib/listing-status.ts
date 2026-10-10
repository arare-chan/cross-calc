import { read, utils } from "xlsx";

export const JPX = {
  listed: "https://www.jpx.co.jp/markets/statistics-equities/misc/01.html",
  improvement: "https://www.jpx.co.jp/listing/market-alerts/improvement-period/",
  supervision: "https://www.jpx.co.jp/listing/market-alerts/supervision/index.html",
  transfers: "https://www.jpx.co.jp/listing/stocks/transfers/index.html",
  newlyListed: "https://www.jpx.co.jp/listing/stocks/new/index.html",
  delisted: "https://www.jpx.co.jp/listing/stocks/delisted/index.html",
} as const;

export type Market = "プライム" | "スタンダード" | "グロース";
export type ListingLabel = "計画入り" | "監理銘柄" | "整理銘柄";
export interface ListingEntry {
  name: string;
  market: Market | null;
  labels: ListingLabel[];
  details: string[];
  delisted?: boolean;
}
export interface ListingSnapshot {
  schemaVersion: 1;
  checkedAt: string;
  marketBaseDate: string;
  planPublishedDate: string;
  entries: Record<string, ListingEntry>;
  sources: typeof JPX;
}

export const DAY_MS = 24 * 60 * 60 * 1000;
const CODE = /^[0-9][0-9A-Z]{3,4}$/;
const markets: Market[] = ["プライム", "スタンダード", "グロース"];
const normalized = (value: unknown) =>
  String(value ?? "")
    .normalize("NFKC")
    .trim();
const marketOf = (value: unknown): Market | null => {
  const text = normalized(value);
  return (
    markets.find(
      (market) =>
        text === market || text.startsWith(`${market}（`) || text.startsWith(`${market}(`),
    ) ?? null
  );
};

function htmlText(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code: string) =>
      String.fromCodePoint(
        code[0].toLowerCase() === "x" ? parseInt(code.slice(1), 16) : Number(code),
      ),
    )
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function tableRows(html: string): string[][] {
  return [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
    [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => htmlText(cell[1])),
  );
}

function dataRows(html: string, firstHeading: string): string[][] {
  const tables = [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)];
  const table = tables.find(([value]) => tableRows(value)[0]?.[0].startsWith(firstHeading));
  if (!table) throw new Error(`東証の表を確認できません: ${firstHeading}`);
  return tableRows(table[0]);
}

export function spreadsheetLink(html: string, page: string, pattern: RegExp): string {
  const links = [...html.matchAll(/href=["']([^"']+)["']/gi)].map(
    (match) => new URL(match[1], page),
  );
  const link = links.find(
    (url) =>
      url.protocol === "https:" && url.hostname === "www.jpx.co.jp" && pattern.test(url.pathname),
  );
  if (!link) throw new Error("東証のExcel資料へのリンクを確認できません");
  return link.href;
}

function workbookRows(data: ArrayBuffer): unknown[][] {
  const book = read(data, { type: "array" });
  return utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, defval: "" });
}

function japaneseDate(text: string): string {
  const match = text.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);
  if (!match) throw new Error("東証資料の公表日を確認できません");
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

export function parseListed(
  data: ArrayBuffer,
): Pick<ListingSnapshot, "entries" | "marketBaseDate"> {
  const rows = workbookRows(data);
  if (normalized(rows[0]?.[1]) !== "コード" || normalized(rows[0]?.[3]) !== "市場・商品区分") {
    throw new Error("東証上場銘柄一覧の形式が変わりました");
  }
  const entries: Record<string, ListingEntry> = {};
  for (const row of rows.slice(1)) {
    const code = normalized(row[1]);
    const market = marketOf(row[3]);
    if (market && CODE.test(code))
      entries[code] = { name: normalized(row[2]), market, labels: [], details: [] };
  }
  const date = normalized(rows[1]?.[0]);
  if (!/^\d{8}$/.test(date) || Object.keys(entries).length < 3000)
    throw new Error("東証上場銘柄一覧が不完全です");
  return { entries, marketBaseDate: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}` };
}

export function parseImprovement(data: ArrayBuffer): { codes: string[]; publishedDate: string } {
  const rows = workbookRows(data);
  const header = rows.findIndex(
    (row) => normalized(row[0]) === "コード" && normalized(row[2]) === "市場区分",
  );
  if (header < 0) throw new Error("改善期間一覧の形式が変わりました");
  const codes = rows
    .slice(header + 1)
    .filter((row) => CODE.test(normalized(row[0])))
    .map((row) => normalized(row[0]));
  if (!codes.length && !rows.flat().some((value) => /該当.*ありません/.test(String(value))))
    throw new Error("改善期間一覧が空です");
  return { codes, publishedDate: japaneseDate(String(rows[0]?.[0])) };
}

function addLabel(entry: ListingEntry, label: ListingLabel, detail?: string) {
  if (!entry.labels.includes(label)) entry.labels.push(label);
  if (detail && !entry.details.includes(detail)) entry.details.push(detail);
}

export function applySupervision(entries: Record<string, ListingEntry>, html: string) {
  const sections = [...html.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h[23]\b|$)/gi)];
  for (const heading of ["監理銘柄（確認中）", "監理銘柄（審査中）", "整理銘柄"]) {
    const section = sections.find((match) => htmlText(match[1]) === heading)?.[2];
    if (!section) throw new Error(`東証の指定状況を確認できません: ${heading}`);
    if (/該当する銘柄は現在ありません/.test(htmlText(section))) continue;
    const rows = dataRows(section, "指定年月日");
    for (const row of rows.slice(1)) {
      if (!CODE.test(row[2]) || !marketOf(row[3]))
        throw new Error("監理・整理銘柄一覧の形式が変わりました");
      const entry = (entries[row[2]] ??= {
        name: normalized(row[1]),
        market: marketOf(row[3]),
        labels: [],
        details: [],
      });
      addLabel(
        entry,
        heading === "整理銘柄" ? "整理銘柄" : "監理銘柄",
        `${heading} (${row[0]}指定)`,
      );
      if (row[5]?.includes("超過計画開示会社")) addLabel(entry, "計画入り", row[5]);
    }
  }
}

// 月末一覧以後の市場変更・新規上場・上場廃止を発効日で補正する。将来の予定は先取りしない。
export function applyMarketEvents(
  entries: Record<string, ListingEntry>,
  html: { transfers: string; newlyListed: string; delisted: string },
  today: string,
) {
  for (const row of dataRows(html.transfers, "変更日").slice(1).reverse()) {
    const dates = row[0].match(/\d{4}\/\d{2}\/\d{2}/g) ?? [];
    if (!dates.length) throw new Error("市場変更日の形式が変わりました");
    if (dates[dates.length - 1].replaceAll("/", "-") > today) continue;
    if (!CODE.test(row[2]) || !marketOf(row[3]))
      throw new Error("市場変更一覧の形式が変わりました");
    const entry = (entries[row[2]] ??= {
      name: normalized(row[1]),
      market: null,
      labels: [],
      details: [],
    });
    entry.market = marketOf(row[3]);
  }
  const rows = dataRows(html.newlyListed, "上場日");
  for (let index = 2; index < rows.length; index += 2) {
    const row = rows[index];
    const market = marketOf(rows[index + 1]?.[0]);
    const date = row[0].match(/^\d{4}\/\d{2}\/\d{2}/)?.[0].replaceAll("/", "-");
    if (!date || !CODE.test(row[2]) || !market) throw new Error("新規上場一覧の形式が変わりました");
    if (date <= today && !entries[row[2]])
      entries[row[2]] = { name: normalized(row[1]), market, labels: [], details: [] };
  }
  for (const row of dataRows(html.delisted, "上場廃止日").slice(1)) {
    const date = row[0].match(/^\d{4}\/\d{2}\/\d{2}$/)?.[0].replaceAll("/", "-");
    if (!date || !CODE.test(row[2])) throw new Error("上場廃止一覧の形式が変わりました");
    if (date <= today)
      entries[row[2]] = {
        name: normalized(row[1]),
        market: null,
        labels: [],
        details: [`${date} 上場廃止`],
        delisted: true,
      };
  }
}

export async function fetchListingSnapshot(
  fetcher: typeof fetch = fetch,
  now = new Date(),
): Promise<ListingSnapshot> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  async function get(url: string) {
    const response = await fetcher(url, {
      signal: controller.signal,
      redirect: "manual",
      headers: {
        Accept: "text/html,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
    if (!response.ok) throw new Error(`東証資料を取得できません (HTTP ${response.status})`);
    return response;
  }
  try {
    const [listedHtml, improvementHtml, supervision, transfers, newlyListed, delisted] =
      await Promise.all(Object.values(JPX).map(async (url) => (await get(url)).text()));
    const [listed, improvement] = await Promise.all([
      get(spreadsheetLink(listedHtml, JPX.listed, /\/data_j\.xlsx$/)).then((response) =>
        response.arrayBuffer(),
      ),
      get(
        spreadsheetLink(
          improvementHtml,
          JPX.improvement,
          /\/Companies_ImprovementPeriod_JP_[^/]+\.xlsx$/,
        ),
      ).then((response) => response.arrayBuffer()),
    ]);
    const { entries, marketBaseDate } = parseListed(listed);
    const plan = parseImprovement(improvement);
    for (const code of plan.codes) {
      if (!entries[code]) throw new Error(`改善期間一覧の銘柄 ${code} を上場一覧と照合できません`);
      addLabel(entries[code], "計画入り", "上場維持基準の改善期間に該当");
    }
    applySupervision(entries, supervision);
    const today = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    applyMarketEvents(entries, { transfers, newlyListed, delisted }, today);
    return {
      schemaVersion: 1,
      checkedAt: now.toISOString(),
      marketBaseDate,
      planPublishedDate: plan.publishedDate,
      entries,
      sources: JPX,
    };
  } finally {
    clearTimeout(timeout);
  }
}
