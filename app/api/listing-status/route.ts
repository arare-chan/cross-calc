import { DAY_MS, fetchListingSnapshot, type ListingSnapshot } from "@/lib/listing-status";

type SnapshotStore = {
  read(): Promise<ListingSnapshot | undefined>;
  write(snapshot: ListingSnapshot): Promise<void>;
};
const CACHE_KEY = "https://listing-status.internal/jpx-snapshot-v1";
function cache() {
  return typeof caches !== "undefined"
    ? (caches as unknown as { default?: Cache }).default
    : undefined;
}
const store: SnapshotStore = {
  async read() {
    return (await cache()?.match(CACHE_KEY))?.json() as Promise<ListingSnapshot | undefined>;
  },
  async write(snapshot) {
    await cache()?.put(
      CACHE_KEY,
      Response.json(snapshot, { headers: { "Cache-Control": "public, max-age=604800" } }),
    );
  },
};

// リクエストがある時だけ更新する。地域別エッジキャッシュと同一インスタンス内の同時取得抑止を併用。
export function createListingStatusHandler(
  load: () => Promise<ListingSnapshot> = fetchListingSnapshot,
  storage: SnapshotStore = store,
  now: () => number = Date.now,
) {
  let memory: ListingSnapshot | undefined;
  let pending: Promise<ListingSnapshot> | undefined;
  let retryAfter = 0;
  return async function GET(): Promise<Response> {
    try {
      memory ??= await storage.read().catch(() => undefined);
      const age = memory ? now() - Date.parse(memory.checkedAt) : Infinity;
      const fresh = memory?.schemaVersion === 1 && age >= 0 && age < DAY_MS;
      let stale = !fresh;
      if (!fresh && now() >= retryAfter) {
        pending ??= load()
          .then(async (snapshot) => {
            memory = snapshot;
            retryAfter = 0;
            await storage.write(snapshot).catch(() => undefined);
            return snapshot;
          })
          .catch((error) => {
            console.error(
              "JPX listing refresh failed:",
              error instanceof Error ? error.message : "unknown error",
            );
            retryAfter = now() + 15 * 60 * 1000;
            throw error;
          })
          .finally(() => {
            pending = undefined;
          });
        try {
          await pending;
          stale = false;
        } catch {
          stale = true;
        }
      }
      if (!memory || memory.schemaVersion !== 1)
        return Response.json(
          { error: "東証の上場状態を取得できませんでした" },
          { status: 502, headers: { "Cache-Control": "no-store" } },
        );
      return Response.json({ ...memory, stale }, { headers: { "Cache-Control": "no-store" } });
    } catch {
      return Response.json(
        { error: "東証の上場状態を取得できませんでした" },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }
  };
}

export const GET = createListingStatusHandler();
