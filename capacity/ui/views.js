/* Scenario views + hiring strategies — the vocabulary the P3 comparison layer
   speaks. A *view* is a named set of enabled scenarios; the engine takes the
   resolved scenario-id list via simulate(cfg, { viewIds }). A *strategy* is one
   of S1–S4, passed via simulate(cfg, { strategy }). Both are pure derivations
   from config, so a (config, viewId, strategy) triple fully keys a simulation. */

export const STRATEGIES = [
  { id: "S1", name: "Meet requirement", blurb: "Close the gap to required FTE at the landing week." },
  { id: "S2", name: "Buffer above", blurb: "Target requirement × (1 + buffer)." },
  { id: "S3", name: "Forward backfill", blurb: "Replace projected leavers only — never hire for growth." },
  { id: "S4", name: "Manual plan", blurb: "Your per-queue hires, exactly as entered; ignores the cap." },
];
export const STRATEGY_IDS = STRATEGIES.map((s) => s.id);
export const strategyName = (id) => (STRATEGIES.find((s) => s.id === id) || { name: id }).name;

// Resolve a view id to the concrete scenario-id list simulate() expects.
// "Plan of record" has no fixed set — it tracks whatever is currently enabled;
// every other view carries an explicit (possibly empty) scenarioIds list.
// Ids of scenarios that have since been deleted are filtered out.
export function viewIdsFor(config, viewId) {
  const v = config.views.find((x) => x.id === viewId) || config.views[0];
  if (v && Array.isArray(v.scenarioIds)) {
    return v.scenarioIds.filter((id) => config.scenarios.some((s) => s.id === id));
  }
  return config.scenarios.filter((s) => s.enabled).map((s) => s.id);
}

export const viewName = (config, viewId) => {
  const v = config.views.find((x) => x.id === viewId);
  return v ? v.name : viewId;
};

// Headline comparison numbers for one simulation (SPEC §3 table columns).
export function strategyStats(sim) {
  if (!sim) return null;
  const cfg = sim.config;
  let redWeeks = 0, amberWeeks = 0;
  for (const w of sim.weeks) {
    const sts = cfg.queues.map((q) => w.queues[q.id].status);
    if (sts.includes("red")) redWeeks++;
    else if (sts.includes("amber")) amberWeeks++;
  }
  const endHC = sim.weeks.length ? sim.weeks[sim.weeks.length - 1].totals.paid : 0;
  const flags = sim.summary.flags;
  const feasible = !flags.capInfeasible && !flags.tippingPoint && redWeeks === 0;
  return {
    redWeeks, amberWeeks, endHC,
    runCost: sim.summary.totalCost,
    churn: sim.summary.churnCost,
    allIn: sim.summary.allIn,
    flags, feasible,
  };
}

// The recommended strategy (SPEC §7): lowest all-in cost that holds SLA; if none
// holds, the least-bad by all-in cost. Returns the strategy id.
export function recommendStrategy(statsById) {
  const entries = Object.entries(statsById).filter(([, s]) => s);
  if (!entries.length) return null;
  const holding = entries.filter(([, s]) => s.feasible);
  const pool = holding.length ? holding : entries;
  return pool.reduce((best, cur) => (cur[1].allIn < best[1].allIn ? cur : best))[0];
}
