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
import { simulate, applyGroupScope } from "../../engine/engine.js";
import { runMatrix, bestCell } from "../sim-set.js";
import { strategyList, groupScenarioIds } from "../views.js";

// Selection-independent base: the engine cfg + decision matrix + axes. Memoise
// this on the model — running the 4×N matrix once, not per cell selection.
export function computeBase(model) {
  const cfg = v2ToEngineConfig(model);
  const matrix = runMatrix(cfg);
  const strategies = strategyList(cfg);          // [{ id, name }]
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
