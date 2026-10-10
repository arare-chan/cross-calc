import { describe, expect, it, vi } from "vitest";
import { createListingStatusHandler } from "./route";
import { DAY_MS, JPX, type ListingSnapshot } from "@/lib/listing-status";

const snapshot = (time: number): ListingSnapshot => ({
  schemaVersion: 1,
  checkedAt: new Date(time).toISOString(),
  marketBaseDate: "2026-09-30",
  planPublishedDate: "2026-10-07",
  entries: {},
  sources: JPX,
});
const emptyStore = () => ({ read: vi.fn(async () => undefined), write: vi.fn(async () => {}) });

describe("on-demand listing cache", () => {
  it("reuses results for 24 hours and fetches only on the first request after expiry", async () => {
    let now = Date.parse("2026-10-11T00:00:00Z");
    const load = vi.fn(async () => snapshot(now));
    const storage = emptyStore();
    const get = createListingStatusHandler(load, storage, () => now);
    expect(load).not.toHaveBeenCalled();
    await Promise.all([get(), get()]);
    expect(load).toHaveBeenCalledTimes(1);
    now += DAY_MS - 1;
    await get();
    expect(load).toHaveBeenCalledTimes(1);
    now += 1;
    expect(await (await get()).json()).toMatchObject({ stale: false });
    expect(load).toHaveBeenCalledTimes(2);
    expect(storage.write).toHaveBeenCalledTimes(2);
  });

  it("reuses a shared fresh snapshot across handler instances", async () => {
    const now = Date.now();
    const load = vi.fn();
    const get = createListingStatusHandler(
      load,
      { read: async () => snapshot(now), write: async () => {} },
      () => now,
    );
    expect((await get()).status).toBe(200);
    expect(load).not.toHaveBeenCalled();
  });

  it("marks old data stale on failure without changing its original check time", async () => {
    let now = Date.now();
    const old = snapshot(now - DAY_MS);
    const load = vi.fn(async () => {
      throw new Error("offline");
    });
    const get = createListingStatusHandler(
      load,
      { read: async () => old, write: async () => {} },
      () => now,
    );
    const result = await (await get()).json();
    expect(result).toMatchObject({ stale: true, checkedAt: old.checkedAt });
    await get();
    expect(load).toHaveBeenCalledTimes(1);
    now += 15 * 60 * 1000;
    await get();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("returns an error instead of an empty normal status when no source is available", async () => {
    const get = createListingStatusHandler(async () => {
      throw new Error("changed upstream");
    }, emptyStore());
    const response = await get();
    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
