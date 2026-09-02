import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { JSDOM, VirtualConsole } from "jsdom";
import { describe, expect, it, vi } from "vitest";

const calculatorPath = fileURLToPath(new URL("./calculator.html", import.meta.url));

describe("calculator stock-name search", () => {
  it("selects a visible name candidate and fetches its quote", async () => {
    const html = await readFile(calculatorPath, "utf8");
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        code: "9861",
        name: "吉野家ホールディングス",
        price: 3_000,
        marketTime: 0,
        source: "test",
      }),
    }));
    const virtualConsole = new VirtualConsole();
    const dom = new JSDOM(html, {
      beforeParse(window) {
        Object.defineProperty(window, "fetch", { value: fetchMock });
      },
      runScripts: "dangerously",
      url: "https://calculator.test/",
      virtualConsole,
    });

    try {
      const nameInput = dom.window.document.querySelector<HTMLInputElement>("#inName");
      const codeInput = dom.window.document.querySelector<HTMLInputElement>("#inCode");
      const priceInput = dom.window.document.querySelector<HTMLInputElement>("#inPrice");

      expect(nameInput).not.toBeNull();
      nameInput!.value = "吉野家";
      nameInput!.dispatchEvent(new dom.window.Event("input", { bubbles: true }));

      const candidate = dom.window.document.querySelector<HTMLButtonElement>(
        '[data-stock-code="9861"]',
      );
      expect(candidate).not.toBeNull();

      candidate!.click();
      expect(codeInput?.value).toBe("9861");

      await vi.waitFor(
        () => {
          expect(fetchMock).toHaveBeenCalledWith(
            "/api/quote?code=9861",
            expect.objectContaining({ cache: "no-store" }),
          );
          expect(priceInput?.value).toBe("3000");
        },
        { timeout: 1_500 },
      );
    } finally {
      dom.window.close();
    }
  }, 20_000);
});
