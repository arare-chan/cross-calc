import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const calculatorPath = fileURLToPath(new URL("./calculator.html", import.meta.url));

function costs(dom: JSDOM, broker: string, timing = "open") {
  const result = dom.window.eval(`calcBroker('${broker}', '${timing}')`);
  if (
    !result ||
    typeof result !== "object" ||
    !("total" in result) ||
    typeof result.total !== "number" ||
    !("interestDays" in result) ||
    typeof result.interestDays !== "number" ||
    !("items" in result) ||
    !Array.isArray(result.items)
  )
    throw new Error("Invalid calculation result");
  const items = result.items.map((item: unknown) => {
    if (
      !item ||
      typeof item !== "object" ||
      !("label" in item) ||
      typeof item.label !== "string" ||
      !("amount" in item) ||
      typeof item.amount !== "number" ||
      !("formula" in item) ||
      typeof item.formula !== "string"
    )
      throw new Error("Invalid cost item");
    return { label: item.label, amount: item.amount, formula: item.formula };
  });
  return { total: result.total, interestDays: result.interestDays, items };
}

async function calculator(executionDate = "2026-10-23") {
  const dom = new JSDOM(await readFile(calculatorPath, "utf8"), {
    runScripts: "dangerously",
    url: "https://calculator.test/",
  });
  for (const [selector, value] of [
    ["#inPrice", "2323"],
    ["#inShares", "100"],
    ["#inLast", "2026-10-28"],
    ["#inTate", executionDate],
  ]) {
    const input = dom.window.document.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  }
  return dom;
}

describe("opening and closing cost comparison", () => {
  it("keeps the Nikko opening total at 107 yen and shows the full closing total of 130 yen", async () => {
    const dom = await calculator();
    try {
      const card = dom.window.document.querySelector('[data-broker="nikko"]')!;
      expect(card.querySelector(".total .num")?.textContent).toBe("107");
      expect(card.querySelector(".close-comparison")?.textContent).toBe(
        "大引けの場合：130円（寄りとの差 ＋23円）",
      );
      const close = costs(dom, "nikko", "close");
      expect(close.interestDays).toBe(2);
      expect(dom.window.eval("toYMD(calcBroker('nikko', 'close').genbikiDate)")).toBe("2026-10-26");
      expect(dom.window.eval("toYMD(calcBroker('nikko', 'close').genbikiSettle)")).toBe(
        "2026-10-28",
      );
      expect(
        close.items.find((item: { label: string }) => item.label.startsWith("貸株料"))?.amount,
      ).toBe(84);
      expect(
        close.items.find((item: { label: string }) => item.label.startsWith("買い建て金利"))
          ?.amount,
      ).toBe(46);
    } finally {
      dom.window.close();
    }
  });

  it("counts Friday through Monday and applies Nikko's rate change on October 26", async () => {
    const dom = await calculator("2026-10-21");
    try {
      const card = dom.window.document.querySelector('[data-broker="nikko"]')!;
      expect(card.querySelector(".total .num")?.textContent).toBe("155");
      expect(card.querySelector(".close-comparison")?.textContent).toBe(
        "大引けの場合：224円（寄りとの差 ＋69円）",
      );
      const close = costs(dom, "nikko", "close");
      expect(close.interestDays).toBe(4);
      expect(dom.window.eval("toYMD(calcBroker('nikko', 'close').genbikiSettle)")).toBe(
        "2026-10-26",
      );
      expect(
        close.items.find((item: { label: string }) => item.label.startsWith("買い建て金利"))
          ?.formula,
      ).toContain("3.54% × 3日 + 3.69% × 1日");
      // At a manually fixed 3.69%, the same settlement dates still require four days.
      dom.window.eval("config.brokers.nikko.buyInterest = 3.69; renderCards();");
      expect(dom.window.eval("calcBroker('nikko').total")).toBe(156);
      expect(dom.window.eval("calcBroker('nikko', 'close').total")).toBe(226);
    } finally {
      dom.window.close();
    }
  });

  it("includes a public holiday between the opening and closing settlement dates", async () => {
    const dom = await calculator("2026-10-29");
    try {
      dom.window.eval("inputState.ochi = '2026-11-27';");
      expect(dom.window.eval("calcBroker('nikko', 'close').interestDays")).toBe(3);
      expect(dom.window.eval("toYMD(calcBroker('nikko', 'close').genbikiSettle)")).toBe(
        "2026-11-04",
      );
    } finally {
      dom.window.close();
    }
  });

  it.each([
    ["rakuten", "15:45"],
    ["sbi", "16:00"],
    ["esmart", "15:44"],
  ])("uses same-day delivery for %s within its own cutoff", async (broker, cutoff) => {
    const dom = await calculator("2026-10-21");
    try {
      dom.window.eval(`inputState.buyMethod.${broker} = 'genbiki'; renderCards();`);
      const card = dom.window.document.querySelector(`[data-broker="${broker}"]`)!;
      const opening = costs(dom, broker);
      const closing = costs(dom, broker, "close");
      expect(closing.interestDays).toBe(1);
      expect(closing.total).toBe(opening.total);
      expect(card.querySelector(".close-comparison")?.textContent).toContain("差額0円");
      expect(card.textContent).toContain(cutoff);
      expect(card.textContent).toContain("翌営業日");
    } finally {
      dom.window.close();
    }
  });

  it.each(["nikko", "rakuten", "sbi", "esmart"])(
    "does not charge buy interest for %s physical purchases",
    async (broker) => {
      const dom = await calculator();
      try {
        dom.window.eval(`inputState.buyMethod.${broker} = 'physical'; renderCards();`);
        const opening = costs(dom, broker);
        const closing = costs(dom, broker, "close");
        expect(closing.total).toBe(opening.total);
        expect(
          closing.items.some((item: { label: string }) => item.label.startsWith("買い建て金利")),
        ).toBe(false);
        const card = dom.window.document.querySelector(`[data-broker="${broker}"]`)!;
        expect(card.querySelector(".close-comparison")?.textContent).toContain("差額0円");
      } finally {
        dom.window.close();
      }
    },
  );

  it("compares totals including management fees, premiums, HYPER fees and configured commissions", async () => {
    const dom = await calculator("2026-09-15");
    try {
      dom.window.eval(`
        inputState.sellType.rakuten = 'mukigen';
        inputState.sellType.sbi = 'hyper';
        inputState.premiumPerShare = 0.5;
        inputState.hyperPerShare = 1.2;
        for (const key of BROKER_ORDER) {
          inputState.buyMethod[key] = 'genbiki';
          config.brokers[key].marginFee = 100;
        }
      `);
      for (const broker of ["nikko", "rakuten", "sbi", "esmart"]) {
        const opening = costs(dom, broker);
        const closing = costs(dom, broker, "close");
        const withoutInterest = (items: Array<{ label: string; amount: number }>) =>
          items.filter((item) => !item.label.startsWith("買い建て金利"));
        expect(withoutInterest(closing.items)).toEqual(withoutInterest(opening.items));
        expect(closing.total).toBe(
          closing.items.reduce((sum: number, item: { amount: number }) => sum + item.amount, 0),
        );
      }
      expect(
        dom.window.eval(
          "calcBroker('rakuten', 'close').items.find(i => i.label.startsWith('事務管理費')).amount",
        ),
      ).toBe(110);
      expect(
        dom.window.eval(
          "calcBroker('esmart', 'close').items.find(i => i.label === 'プレミアム料').amount",
        ),
      ).toBeGreaterThan(0);
      expect(
        dom.window.eval("calcBroker('sbi', 'close').items.find(i => i.label === 'HYPER料').amount"),
      ).toBeGreaterThan(0);
    } finally {
      dom.window.close();
    }
  });

  it("warns that Nikko closing purchases on the last entitlement day cannot obtain the benefit", async () => {
    const dom = await calculator("2026-10-28");
    try {
      const card = dom.window.document.querySelector('[data-broker="nikko"]')!;
      expect(card.textContent).toContain("大引け取得では今回の優待を取得できません");
    } finally {
      dom.window.close();
    }
  });

  it("hides comparisons when inputs are incomplete and preserves the existing input controls", async () => {
    const dom = await calculator();
    try {
      const controlValues = () =>
        dom.window.eval(
          "[...document.querySelectorAll('input, select')].map(el => [el.id, el.dataset.sel, el.value])",
        );
      const controls = controlValues();
      dom.window.eval("renderCards();");
      expect(controlValues()).toEqual(controls);
      expect(dom.window.document.querySelectorAll(".card")).toHaveLength(4);
      dom.window.eval("inputState.price = ''; renderCards();");
      expect(dom.window.document.querySelectorAll(".close-comparison")).toHaveLength(0);
    } finally {
      dom.window.close();
    }
  });
});
