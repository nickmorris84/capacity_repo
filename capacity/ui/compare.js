import { simulate, applyGroupScope, compactRun } from "../engine/engine.js";
import { groupScenarioIds, resolveStrategyName } from "./views.js";
import { flattenParameters } from "./exports.js";

/* §26.7 comparison engine (pure). A COMPARATOR normalises a saved Run or a
   "Live now" simulation to one shape:
     { key, kind:'run'|'live', simId, simName, name, label, config, run }
   where `run` is a compactRun. Runs render instantly; live comparators are
   computed on demand (computeLive) and cached by the caller until the
   simulation's updatedAt changes. Every metric below is derived from the
   compactRun, so Runs and live comparators are measured identically. */

// Colour chips — persistent per comparator (index order), used everywhere.
export const CHIP_COLORS = ["#4655c9", "#b5822c", "#2f8f5b", "#b23c2a"];

export function runComparator(record, run) {
  return {
    key: "run:" + run.id, kind: "run", simId: record.id, simName: record.name,
    name: run.name, label: (run.savedAt || "").replace("T", " ").slice(0, 16),
    config: run.config, run: run.run, strategy: run.strategy,
  };
}

// Compute a "Live now" comparator from a record's current config + selected
// pair — the same path the workspace uses to build activeSim, so the numbers
// match what the simulation shows.
export function computeLive(record) {
  const cfg = record.config;
  const gid = (record.selectedPair && record.selectedPair.gid) || "g_por";
  const sid = (record.selectedPair && record.selectedPair.sid) || "S1";
  const scoped = applyGroupScope(cfg, gid);
  const sim = simulate(scoped, { strategy: sid, viewIds: groupScenarioIds(cfg, gid) });
  return {
    key: "live:" + record.id, kind: "live", simId: record.id, simName: record.name,
    name: record.name, label: "Live now",
    config: sim.config, run: compactRun(sim.config, sim), strategy: sim.strategy,
  };
}

// ---- headline metrics from a comparator's compactRun ----
const weeksRedOf = (run) => {
  const n = run.horizon || (run.totals ? run.totals.length : 0);
  let red = 0;
  for (let w = 0; w < n; w++) if (run.queues.some((q) => q.weeks[w] && q.weeks[w].st === "red")) red++;
  return red;
};
export function headline(c) {
  const h = c.run.headline || {};
  return { allIn: Math.round(h.allIn || 0), lost: Math.round(h.lost || 0), weeksRed: weeksRedOf(c.run) };
}

// ---- direction-aware delta colouring (§26.7: colour by good/bad DIRECTION,
// never by arithmetic sign). 'higherBad' → up is red; 'higherGood' → up is
// green; 'neutral' → no colour. ----
export function dirClass(dir, delta) {
  if (!delta || Math.abs(delta) < 1e-9 || dir === "neutral") return "";
  const up = delta > 0;
  if (dir === "higherBad") return up ? "delta-bad" : "delta-good";
  return up ? "delta-good" : "delta-bad";
}

// One-line auto-verdict vs the reference.
export function verdict(c, ref, cur = "£") {
  if (c.key === ref.key) return "Reference — every delta is measured against this.";
  const money = (n) => cur + Math.round(Math.abs(n)).toLocaleString();
  const hc = headline(c), hr = headline(ref);
  const dCost = hc.allIn - hr.allIn, dRed = hc.weeksRed - hr.weeksRed;
  const costPhrase = Math.abs(dCost) < 1 ? "matches the all-in cost of" : dCost > 0 ? `costs ${money(dCost)} more than` : `saves ${money(dCost)} against`;
  const redPhrase = dRed === 0 ? "with no change in red weeks" : dRed > 0 ? `and adds ${dRed} red week${dRed === 1 ? "" : "s"}` : `and clears ${-dRed} red week${dRed === -1 ? "" : "s"}`;
  return `'${c.name}' ${costPhrase} '${ref.name}' ${redPhrase}.`;
}

// ---- §26.7.2 "What changed": exact config diff vs the reference ----
export function configDiff(ref, cmp) {
  const changes = [];
  // scalar parameters (labelled) via the shared flattener
  const refRows = new Map(flattenParameters(ref.config).map((r) => [r.path, r]));
  const cmpRows = flattenParameters(cmp.config);
  for (const r of cmpRows) {
    const prev = refRows.get(r.path);
    if (prev && String(prev.value) !== String(r.value)) {
      changes.push({ kind: "param", label: r.setting, from: prev.value, to: r.value });
    }
  }
  // strategy (the compared pair's strategy)
  if (ref.strategy !== cmp.strategy) {
    changes.push({ kind: "strategy", label: "Active strategy", from: resolveStrategyName(ref.config, ref.strategy), to: resolveStrategyName(cmp.config, cmp.strategy) });
  }
  // scenario factors added / removed / toggled
  const refSc = new Map((ref.config.scenarios || []).map((s) => [s.id, s]));
  const cmpSc = new Map((cmp.config.scenarios || []).map((s) => [s.id, s]));
  for (const [id, s] of cmpSc) { if (!refSc.has(id)) changes.push({ kind: "scenario", label: "Scenario added", to: s.name }); }
  for (const [id, s] of refSc) { if (!cmpSc.has(id)) changes.push({ kind: "scenario", label: "Scenario removed", from: s.name }); }
  for (const [id, s] of cmpSc) { const p = refSc.get(id); if (p && !!p.enabled !== !!s.enabled) changes.push({ kind: "scenario", label: s.name, from: p.enabled ? "on" : "off", to: s.enabled ? "on" : "off" }); }
  return changes;
}

// ---- section series + deltas (Money / Service / People) ----
const sumq = (run, f) => run.queues.reduce((a, q) => a + q.weeks.reduce((b, w) => b + f(w), 0), 0);
const avgCoverWeek = (run, w) => {
  const vs = run.queues.map((q) => q.weeks[w] && q.weeks[w].cv).filter((v) => v != null);
  return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : 0;
};
export function metrics(c) {
  const run = c.run, n = run.horizon || run.totals.length;
  const cost = run.totals.reduce((a, w) => a + w.cost, 0);
  const churn = run.totals.reduce((a, w) => a + w.churn, 0);
  const endHC = run.totals.length ? run.totals[run.totals.length - 1].paid : 0;
  const attrition = sumq(run, (w) => w.lv || 0);
  const burnoutPeak = Math.max(0, ...run.queues.flatMap((q) => q.weeks.map((w) => w.bu || 0)));
  const avgCover = n ? run.totals.reduce((a, _w, i) => a + avgCoverWeek(run, i), 0) / n : 0;
  const h = headline(c);
  return { allIn: h.allIn, cost: Math.round(cost), churn: Math.round(churn), lost: h.lost, weeksRed: h.weeksRed, endHC: Math.round(endHC), attrition: Math.round(attrition), burnoutPeak: Math.round(burnoutPeak), avgCover };
}

// Money: cumulative all-in per week, aligned, keyed by comparator key.
export function moneyOverlay(comparators) {
  const len = comparators.reduce((m, c) => Math.max(m, c.run.totals.length), 0);
  const data = [];
  for (let w = 0; w < len; w++) {
    const row = { wk: w + 1 };
    comparators.forEach((c) => {
      let cum = 0;
      for (let i = 0; i <= w && i < c.run.totals.length; i++) cum += c.run.totals[i].cost + c.run.totals[i].churn;
      row[c.key] = Math.round(cum);
    });
    data.push(row);
  }
  return data;
}
// Service: average coverage per week, keyed by comparator.
export function coverageOverlay(comparators) {
  const len = comparators.reduce((m, c) => Math.max(m, c.run.totals.length), 0);
  const data = [];
  for (let w = 0; w < len; w++) {
    const row = { wk: w + 1 };
    comparators.forEach((c) => { row[c.key] = +(avgCoverWeek(c.run, w) * 100).toFixed(1); });
    data.push(row);
  }
  return data;
}
// Service heat strip: weeks-red per queue (matched by name) per comparator.
export function weeksRedPerQueue(comparators) {
  const names = [];
  for (const c of comparators) for (const q of c.run.queues) if (!names.includes(q.name)) names.push(q.name);
  return names.map((name) => ({
    name,
    cells: comparators.map((c) => {
      const q = c.run.queues.find((x) => x.name === name);
      return { key: c.key, red: q ? q.weeks.filter((w) => w.st === "red").length : null, weeks: q ? q.weeks.length : 0 };
    }),
  }));
}

// ---- §26.7.4 per-queue accordion, matched by name, sorted by |Δ all-in| ----
export function perQueue(comparators, ref) {
  const names = [];
  for (const c of comparators) for (const q of c.run.queues) if (!names.includes(q.name)) names.push(q.name);
  const qMetrics = (run, name) => {
    const q = run.queues.find((x) => x.name === name);
    if (!q) return null;
    const cost = q.weeks.reduce((a, w) => a + w.co + w.ch, 0);
    const redWeeks = q.weeks.filter((w) => w.st !== "green").length;
    const avgCover = q.weeks.reduce((a, w) => a + w.cv, 0) / Math.max(1, q.weeks.length);
    return { type: q.type, cost: Math.round(cost), redWeeks, avgCover };
  };
  const rows = names.map((name) => {
    const refM = qMetrics(ref.run, name);
    const cells = comparators.map((c) => ({ key: c.key, m: qMetrics(c.run, name) }));
    const maxAbs = Math.max(0, ...cells.map((cl) => (cl.m && refM ? Math.abs(cl.m.cost - refM.cost) : 0)));
    return { name, refCost: refM ? refM.cost : 0, cells, maxAbs };
  });
  rows.sort((a, b) => b.maxAbs - a.maxAbs);
  return rows;
}
