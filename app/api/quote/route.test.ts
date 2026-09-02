import { describe, expect, it, vi } from "vitest";

import { InvalidStockCodeError, QuoteNotFoundError, QuoteUpstreamError } from "@/lib/quote";
import { createQuoteHandler } from "./route";

describe("GET /api/quote", () => {
  it("returns normalized quotes with a short shared cache window", async () => {
    const quote = {
      code: "9861",
      name: "吉野家ホールディングス",
      price: 3012,
      marketTime: 1788318000,
      source: "Yahoo Finance" as const,
    };
    const fetchQuote = vi.fn().mockResolvedValue(quote);
    const handler = createQuoteHandler(fetchQuote);

    const response = await handler(new Request("https://example.test/api/quote?code=9861"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=30");
    await expect(response.json()).resolves.toEqual(quote);
  });

  it("maps invalid codes to a 400 JSON response", async () => {
    const fetchQuote = vi.fn().mockRejectedValue(new InvalidStockCodeError());
    const handler = createQuoteHandler(fetchQuote);

    const response = await handler(new Request("https://example.test/api/quote?code=bad/url"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "銘柄コードは4〜5文字の半角英数字で入力してください",
    });
  });

  it.each([
    [new QuoteNotFoundError(), 404],
    [new QuoteUpstreamError(), 502],
  ])("maps expected lookup failures to JSON responses", async (error, status) => {
    const handler = createQuoteHandler(vi.fn().mockRejectedValue(error));

    const response = await handler(new Request("https://example.test/api/quote?code=9861"));

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error: error.message });
  });
});
