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
      expect(dom.window.document.querySelector("#outTopixDate")?.textContent).toBe("2026/10");
      expect(dom.window.document.querySelector("#outTopixCategory")?.textContent).toBe("継続");

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

  it.each([
    ["1723", "新規"],
    ["593A", "新規"],
    ["1301", "移行"],
    ["9861", "継続"],
    ["1380", "構成外"],
  ])("shows the October 2026 TOPIX classification for %s", async (code, expectedCategory) => {
    const html = await readFile(calculatorPath, "utf8");
    const dom = new JSDOM(html, {
      beforeParse(window) {
        Object.defineProperty(window, "fetch", {
          value: vi.fn(() => new Promise(() => {})),
        });
      },
      runScripts: "dangerously",
      url: "https://calculator.test/",
    });

    try {
      const codeInput = dom.window.document.querySelector<HTMLInputElement>("#inCode");
      const topixDate = dom.window.document.querySelector<HTMLOutputElement>("#outTopixDate");
      const topixCategory =
        dom.window.document.querySelector<HTMLOutputElement>("#outTopixCategory");

      expect(codeInput).not.toBeNull();
      codeInput!.value = code;
      codeInput!.dispatchEvent(new dom.window.Event("input", { bubbles: true }));

      expect(topixDate?.textContent).toBe("2026/10");
      expect(topixCategory?.textContent).toBe(expectedCategory);
    } finally {
      dom.window.close();
    }
  });

  it("has a searchable stock name for every classified TOPIX code", async () => {
    const html = await readFile(calculatorPath, "utf8");
    const dom = new JSDOM(html, {
      runScripts: "dangerously",
      url: "https://calculator.test/",
    });

    try {
      const missing = dom.window.eval(
        "[...TOPIX_NEW, ...TOPIX_TRANSITION, ...TOPIX_CONTINUED].filter(code => !STOCK_NAMES[code])",
      );
      expect(missing).toEqual([]);
    } finally {
      dom.window.close();
    }
  });
});

describe("SMBC Nikko buy interest", () => {
  it.each([
    ["2026-10-21", "3.54%"],
    ["2026-10-22", "3.69%"],
  ])("uses the rate effective on the execution date %s", async (executionDate, expectedRate) => {
    const html = await readFile(calculatorPath, "utf8");
    const dom = new JSDOM(html, {
      runScripts: "dangerously",
      url: "https://calculator.test/",
    });

    try {
      const setInput = (selector: string, value: string) => {
        const input = dom.window.document.querySelector<HTMLInputElement>(selector);
        expect(input).not.toBeNull();
        input!.value = value;
        input!.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      };

      setInput("#inPrice", "1000");
      setInput("#inShares", "100");
      setInput("#inLast", "2026-10-28");
      setInput("#inTate", executionDate);

      const nikkoCard = dom.window.document.querySelector('[data-broker="nikko"]');
      expect(nikkoCard?.textContent).toContain(`買い建て金利(制度 ${expectedRate})`);
    } finally {
      dom.window.close();
    }
  });

  it("switches existing positions to the new rate from the October 26 calculation", async () => {
    const html = await readFile(calculatorPath, "utf8");
    const dom = new JSDOM(html, {
      runScripts: "dangerously",
      url: "https://calculator.test/",
    });

    try {
      dom.window.eval("config.calc.interestDays = 4; renderAll();");
      for (const [selector, value] of [
        ["#inPrice", "1000"],
        ["#inShares", "100"],
        ["#inLast", "2026-10-28"],
        ["#inTate", "2026-10-21"],
      ]) {
        const input = dom.window.document.querySelector<HTMLInputElement>(selector);
        expect(input).not.toBeNull();
        input!.value = value;
        input!.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      }

      const nikkoCard = dom.window.document.querySelector('[data-broker="nikko"]');
      expect(nikkoCard?.textContent).toContain("買い建て金利(制度 3.54%→3.69%)");
      expect(nikkoCard?.textContent).toContain("3.54% × 3日 + 3.69% × 1日");
    } finally {
      dom.window.close();
    }
  });
});
