import { STOCK_NAMES } from "./stock-names";

export interface StockQuote {
  code: string;
  name: string | null;
  price: number;
  marketTime: number | null;
  source: "Yahoo Finance";
}

export class InvalidStockCodeError extends Error {
  constructor() {
    super("銘柄コードは4〜5文字の半角英数字で入力してください");
    this.name = "InvalidStockCodeError";
  }
}

export class QuoteNotFoundError extends Error {
  constructor() {
    super("銘柄または株価が見つかりませんでした");
    this.name = "QuoteNotFoundError";
  }
}

export class QuoteUpstreamError extends Error {
  constructor(message = "株価の取得先から正常な応答がありませんでした") {
    super(message);
    this.name = "QuoteUpstreamError";
  }
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function fetchJson(fetcher: Fetcher, url: string, signal?: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    response = await fetcher(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; YutaiCrossCalculator/1.0)",
      },
      signal,
    });
  } catch {
    throw new QuoteUpstreamError("株価の取得先へ接続できませんでした");
  }

  if (response.status === 404) throw new QuoteNotFoundError();
  if (!response.ok) {
    throw new QuoteUpstreamError(`株価の取得先が HTTP ${response.status} を返しました`);
  }

  try {
    return await response.json();
  } catch {
    throw new QuoteUpstreamError("株価の取得先から不正なJSONが返されました");
  }
}

function readChart(payload: unknown): { price: number; marketTime: number | null } {
  if (!isRecord(payload) || !isRecord(payload.chart)) {
    throw new QuoteUpstreamError("株価の取得先から想定外のデータが返されました");
  }

  const result = payload.chart.result;
  if (result === null || (Array.isArray(result) && result.length === 0)) {
    throw new QuoteNotFoundError();
  }
  if (!Array.isArray(result) || !isRecord(result[0]) || !isRecord(result[0].meta)) {
    throw new QuoteUpstreamError("株価の取得先から想定外のデータが返されました");
  }

  const { regularMarketPrice, regularMarketTime } = result[0].meta;
  if (
    typeof regularMarketPrice !== "number" ||
    !Number.isFinite(regularMarketPrice) ||
    regularMarketPrice <= 0
  ) {
    throw new QuoteNotFoundError();
  }

  return {
    price: regularMarketPrice,
    marketTime:
      typeof regularMarketTime === "number" && Number.isFinite(regularMarketTime)
        ? regularMarketTime
        : null,
  };
}

export async function fetchYahooQuote(
  rawCode: string,
  fetcher: Fetcher = fetch,
  signal?: AbortSignal,
): Promise<StockQuote> {
  const code = rawCode.trim().toUpperCase();
  if (!/^[0-9A-Z]{4,5}$/.test(code)) {
    throw new InvalidStockCodeError();
  }
  const name = STOCK_NAMES[code];
  if (!name) throw new QuoteNotFoundError();

  const symbol = `${code}.T`;
  const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
  const { price, marketTime } = readChart(await fetchJson(fetcher, chartUrl, signal));

  return {
    code,
    name,
    price,
    marketTime,
    source: "Yahoo Finance",
  };
}
