import {
  InvalidStockCodeError,
  QuoteNotFoundError,
  QuoteUpstreamError,
  fetchYahooQuote,
  type StockQuote,
} from "@/lib/quote";

type QuoteFetcher = (
  code: string,
  fetcher?: typeof fetch,
  signal?: AbortSignal,
) => Promise<StockQuote>;

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

function json(body: unknown, status: number, cacheControl = "no-store") {
  return Response.json(body, {
    status,
    headers: {
      ...JSON_HEADERS,
      "Cache-Control": cacheControl,
    },
  });
}

export function createQuoteHandler(fetchQuote: QuoteFetcher = fetchYahooQuote) {
  return async function GET(request: Request): Promise<Response> {
    const code = new URL(request.url).searchParams.get("code") ?? "";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6_000);

    try {
      const quote = await fetchQuote(code, fetch, controller.signal);
      return json(quote, 200, "public, max-age=15, s-maxage=30, stale-while-revalidate=30");
    } catch (error) {
      if (error instanceof InvalidStockCodeError) {
        return json({ error: error.message }, 400);
      }
      if (error instanceof QuoteNotFoundError) {
        return json({ error: error.message }, 404, "public, max-age=60, s-maxage=300");
      }
      if (error instanceof QuoteUpstreamError || controller.signal.aborted) {
        const message =
          error instanceof QuoteUpstreamError
            ? error.message
            : "株価の取得先が時間内に応答しませんでした";
        return json({ error: message }, 502);
      }

      return json({ error: "株価の取得中に予期しない問題が発生しました" }, 500);
    } finally {
      clearTimeout(timeout);
    }
  };
}

export const GET = createQuoteHandler();
