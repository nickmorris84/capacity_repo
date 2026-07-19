import { compactRun } from "../engine/engine.js";
import { slugify } from "./storage.js";

/* Saved-run shape (SPEC §10): name, savedAt, config, and compact weekly results.
   Persisted one key per run (`sim-<slug>`) plus a `sim-index` of lightweight
   entries for the library list. */
export function makeSavedRun(name, config, sim, savedAt) {
  const slug = slugify(name);
  return {
    name: name || "Untitled run",
    slug,
    savedAt: savedAt || new Date().toISOString(),
    strategy: sim.strategy,
    allIn: Math.round(sim.summary.allIn),
    config,
    run: compactRun(config, sim),
  };
}

export const indexEntry = (r) => ({ slug: r.slug, name: r.name, savedAt: r.savedAt, strategy: r.strategy, allIn: r.allIn });

// ---- compare builders (all read compactRun shapes) ----
const runTotals = (r) => {
  const t = r.run.totals;
  return {
    cost: t.reduce((a, w) => a + w.cost, 0),
    churn: t.reduce((a, w) => a + w.churn, 0),
    waste: t.reduce((a, w) => a + w.waste, 0),
    volume: t.reduce((a, w) => a + w.volume, 0),
    allIn: t.reduce((a, w) => a + w.cost + w.churn, 0),
    endPaid: t.length ? t[t.length - 1].paid : 0,
  };
};

// Totals delta table vs the first (baseline) run.
export function totalsDelta(runs) {
  if (!runs.length) return { rows: [], metrics: [] };
  const metrics = [
    { key: "cost", label: "Run cost" },
    { key: "churn", label: "Churn cost" },
    { key: "allIn", label: "All-in" },
    { key: "waste", label: "Idle pay" },
    { key: "endPaid", label: "End HC" },
  ];
  const totals = runs.map(runTotals);
  const base = totals[0];
  const rows = runs.map((r, i) => ({
    name: r.name,
    baseline: i === 0,
    values: Object.fromEntries(metrics.map((m) => [m.key, totals[i][m.key]])),
    deltas: Object.fromEntries(metrics.map((m) => [m.key, totals[i][m.key] - base[m.key]])),
  }));
  return { rows, metrics };
}

// Cumulative all-in cost per run, aligned by week, for the overlay chart.
export function allInOverlay(runs) {
  const len = runs.reduce((m, r) => Math.max(m, r.run.totals.length), 0);
  const data = [];
  for (let w = 0; w < len; w++) {
    const row = { wk: w + 1 };
    runs.forEach((r) => {
      let c = 0;
      for (let i = 0; i <= w && i < r.run.totals.length; i++) c += r.run.totals[i].cost + r.run.totals[i].churn;
      row[r.slug] = Math.round(c);
    });
    data.push(row);
  }
  return data;
}

// Per-queue comparison blocks, matched by queue NAME across runs (SPEC §10).
export function perQueueBlocks(runs) {
  const names = [];
  for (const r of runs) for (const q of r.run.queues) if (!names.includes(q.name)) names.push(q.name);
  return names.map((name) => {
    const cells = runs.map((r) => {
      const q = r.run.queues.find((x) => x.name === name);
      if (!q) return { present: false, run: r };
      const weeks = q.weeks;
      const redWeeks = weeks.filter((w) => w.st !== "green").length;
      const avgCover = weeks.reduce((a, w) => a + w.cv, 0) / Math.max(1, weeks.length);
      const worst = q.type === "voice"
        ? { label: "Worst ASA", value: Math.max(...weeks.map((w) => w.asa)), fmt: "s" }
        : { label: "Worst SL", value: Math.min(...weeks.map((w) => w.sl)), fmt: "%" };
      return {
        present: true, run: r, type: q.type,
        redWeeks, avgCover, worst,
        cost: weeks.reduce((a, w) => a + w.co, 0),
        churn: weeks.reduce((a, w) => a + w.ch, 0),
        coverSeries: weeks.map((w, i) => ({ wk: i + 1, cover: +(w.cv * 100).toFixed(1) })),
      };
    });
    return { name, cells };
  });
}
