/* Storage adapter (SPEC §10). Priority: the artifact's async window.storage →
   localStorage (standalone HTML) → in-memory (with a visible notice that
   downloads are the durable save). One uniform async API regardless of backend;
   values are JSON round-tripped; a missing key resolves to undefined (the
   artifact store throws on missing — that's caught here). Keys are slugged by
   the callers. */
export function makeStorageAdapter() {
  // Artifact store: async get/set/delete/list; get throws on a missing key.
  if (typeof window !== "undefined" && window.storage && typeof window.storage.get === "function") {
    const s = window.storage;
    return {
      mode: "artifact",
      notice: null,
      async get(k) {
        try {
          const v = await s.get(k);
          if (v == null) return undefined;
          return typeof v === "string" ? JSON.parse(v) : v;
        } catch (e) { return undefined; }
      },
      async set(k, v) { await s.set(k, JSON.stringify(v)); },
      async del(k) { try { await s.delete(k); } catch (e) { /* already gone */ } },
      async list() { try { return (await s.list()) || []; } catch (e) { return []; } },
    };
  }

  // Standalone HTML: localStorage.
  if (typeof localStorage !== "undefined") {
    try {
      const probe = "__cap_probe__";
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      return {
        mode: "local",
        notice: null,
        async get(k) { const v = localStorage.getItem(k); return v == null ? undefined : JSON.parse(v); },
        async set(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
        async del(k) { localStorage.removeItem(k); },
        async list() { return Object.keys(localStorage); },
      };
    } catch (e) { /* fall through to memory */ }
  }

  // Last resort: in-memory, with a visible notice.
  const mem = new Map();
  return {
    mode: "memory",
    notice: "No durable storage here — your saved runs, presets and views live only in this tab. Downloads are your durable save.",
    async get(k) { return mem.has(k) ? JSON.parse(mem.get(k)) : undefined; },
    async set(k, v) { mem.set(k, JSON.stringify(v)); },
    async del(k) { mem.delete(k); },
    async list() { return [...mem.keys()]; },
  };
}

// Deterministic, filesystem-safe key slug.
export const slugify = (s) =>
  (String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48)) || "item";

export const KEYS = {
  index: "sim-index",
  run: (slug) => "sim-" + slug,
  intraday: "presets-intraday",
  seasonality: "presets-seasonality",
  views: "views",
  // R3d-B: last decision-matrix result (hash + cells) plus the selected
  // (group × strategy) pair, so a reopen can auto-select or restore.
  matrix: "matrix-state",
};
