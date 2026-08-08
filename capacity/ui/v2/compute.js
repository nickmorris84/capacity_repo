/* v2.4 rebuild — Results compute (Step 3). PURE, worker-ready: takes a v2 model
 * (carrying engineConfig), adapts it to the preserved engine via model/adapter.js,
 * and runs the decision matrix + the detailed run for the selected cell. This is
 * the heavy compute the backlog wants off the main thread — isolated here behind
 * a plain function so a Web Worker wrapper is a thin drop-in (see runnerFor()).
 *
 * Reuses the v1 engine + the already-tested matrix helpers (runMatrix/bestCell)
 * — the adapter yields exactly the v1-shaped cfg they expect, so Results shares
 * one source of truth with the existing simulation layer.
 */
import { v2ToEngineConfig } from "../../model/adapter.js";
import { domainToEngineConfig } from "../../model/bridge.js";
import { simulate, applyGroupScope } from "../../engine/engine.js";

// One cfg boundary, two model generations: the domain model (v3 — flat
// registry + requestTypes) goes through the bridge; the v2.4 model keeps the
// old adapter. Everything downstream sees the same v1-shaped engine cfg.
export const toEngineCfg = (model) =>
  model && model.requestTypes && model.volumeEntries ? domainToEngineConfig(model) : v2ToEngineConfig(model);
import { bestCell } from "../sim-set.js";
import { strategyList, groupScenarioIds } from "../views.js";

// Richer decision matrix than sim-set.runMatrix: same allIn / redWeeks / status /
// bestCell-compatible shape, PLUS per-cell SLA attainment (share of green
// queue-weeks) that the Levers cells display. One matrix, consumed by both
// Results (cost + red) and Levers (cost + SLA + red) — one source of truth.
function richMatrix(cfg) {
  const groups = cfg.groups || [];
  const strategies = strategyList(cfg);
  const cells = {};
  for (const g of groups) {
    const ids = groupScenarioIds(cfg, g.id);
    const scoped = applyGroupScope(cfg, g.id);
    cells[g.id] = {};
    for (const s of strategies) {
      const sim = simulate(scoped, { strategy: s.id, viewIds: ids });
      let redWeeks = 0, greenQW = 0, totalQW = 0;
      for (const w of sim.weeks) {
        if (cfg.queues.some((q) => w.queues[q.id].status === "red")) redWeeks++;
        for (const q of cfg.queues) { totalQW++; if (w.queues[q.id].status === "green") greenQW++; }
      }
      const flags = sim.summary.flags;
      const status = flags.capInfeasible || flags.tippingPoint || redWeeks > 0
        ? (redWeeks > sim.weeks.length * 0.1 || flags.tippingPoint ? "red" : "amber") : "green";
      cells[g.id][s.id] = {
        allIn: sim.summary.allIn, redWeeks, status,
        tipping: !!flags.tippingPoint, capInfeasible: !!flags.capInfeasible,
        sla: totalQW ? greenQW / totalQW : 1,
      };
    }
  }
  return { cells };
}

// Selection-independent base: the engine cfg + decision matrix + axes. Memoise
// this on the model — running the 4×N matrix once, not per cell selection.
export function computeBase(model) {
  const cfg = toEngineCfg(model);
  const matrix = richMatrix(cfg);
  const strategies = strategyList(cfg);          // [{ id, name, baseType, forwardMonths? }]
  const groups = (cfg.groups || []).map((g) => ({ id: g.id, name: g.name }));
  return { cfg, matrix, strategies, groups };
}

// The detailed run for one selected (group × strategy), with daily capture for
// the Intraday lens. Same invocation shape runMatrix uses (group scope + views).
export function computeDetail(cfg, selected) {
  const scoped = applyGroupScope(cfg, selected.gid);
  const detail = simulate(scoped, { strategy: selected.sid, viewIds: groupScenarioIds(cfg, selected.gid), captureDaily: true });
  return { detail, summary: detail.summary };
}

// One-shot convenience (used by the gate): base + normalized selection + detail.
export function runResults(model, selected) {
  const base = computeBase(model);
  const sel = normalizeSel(selected, base.matrix, base.groups, base.strategies);
  const d = computeDetail(base.cfg, sel);
  return { ...base, selected: sel, ...d };
}

export function pickSelection(selected, base) {
  return normalizeSel(selected, base.matrix, base.groups, base.strategies);
}

// Cheap per-simulation headline for a Home card: ONE run (S1 · plan of record),
// not the 4×N matrix. Returns the chip figures + worst RAG for the card.
export function quickHeadline(model) {
  const cfg = toEngineCfg(model);
  const sim = simulate(cfg, { strategy: "S1" });
  const w = sim.weeks;
  const lastWk = w[w.length - 1];
  const availFte = cfg.queues.reduce((a, q) => a + (lastWk.queues[q.id].active || 0), 0);
  let worst = "green";
  for (const wk of w) for (const q of cfg.queues) {
    const st = wk.queues[q.id].status;
    if (st === "red") worst = "red"; else if (st === "amber" && worst !== "red") worst = "amber";
  }
  return {
    horizon: w.length, queues: cfg.queues.length,
    allIn: sim.summary.allIn, availFte, worst, lost: sim.summary.lost,
  };
}

function normalizeSel(selected, matrix, groups, strategies) {
  const gids = groups.map((g) => g.id), sids = strategies.map((s) => s.id);
  if (selected && gids.includes(selected.gid) && sids.includes(selected.sid)) return { gid: selected.gid, sid: selected.sid };
  return bestCell(matrix) || { gid: gids[0], sid: sids[0] };
}

/* Worker-ready boundary. In a browser we could post the model to a Worker and
 * receive the payload back; under test (and where Worker is absent) we run inline.
 * Kept as a factory so the call sites don't care which path is live. */
export function runnerFor() {
  return { run: (model, selected) => Promise.resolve(runResults(model, selected)) };
}
