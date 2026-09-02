import { describe, expect, it, vi } from "vitest";

import {
  InvalidStockCodeError,
  QuoteNotFoundError,
  QuoteUpstreamError,
  fetchYahooQuote,
} from "./quote";

describe("fetchYahooQuote", () => {
  it("returns a normalized Japanese stock quote", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          chart: {
            result: [
              {
                meta: {
                  symbol: "9861.T",
                  regularMarketPrice: 3012,
                  regularMarketTime: 1788318000,
                },
              },
            ],
            error: null,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    await expect(fetchYahooQuote("9861", fetcher)).resolves.toEqual({
      code: "9861",
      name: "吉野家ホールディングス",
      price: 3012,
      marketTime: 1788318000,
      source: "Yahoo Finance",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects values that are not stock codes before fetching", async () => {
    const fetcher = vi.fn<typeof fetch>();

    await expect(fetchYahooQuote("https://example.com", fetcher)).rejects.toBeInstanceOf(
      InvalidStockCodeError,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reports a missing quote when Yahoo returns no market price", async () => {
    const fetcher = vi.fn<typeof fetch>();

    await expect(fetchYahooQuote("9999", fetcher)).rejects.toBeInstanceOf(QuoteNotFoundError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reports an upstream failure when the chart endpoint is rate limited", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }));

    await expect(fetchYahooQuote("9861", fetcher)).rejects.toBeInstanceOf(QuoteUpstreamError);
  });

  it("normalizes network failures as upstream errors", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("network failed"));

    await expect(fetchYahooQuote("9861", fetcher)).rejects.toBeInstanceOf(QuoteUpstreamError);
  });

  it("rejects malformed chart data as an upstream error", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ chart: { result: {} } }), { status: 200 }));

    await expect(fetchYahooQuote("9861", fetcher)).rejects.toBeInstanceOf(QuoteUpstreamError);
  });

  it("maps an upstream 404 to a missing quote", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("missing", { status: 404 }));

    await expect(fetchYahooQuote("9861", fetcher)).rejects.toBeInstanceOf(QuoteNotFoundError);
  });
});
