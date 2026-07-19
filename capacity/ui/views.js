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

const BASE_BLURB = {
  meet: "Close the requirement gap at the landing week.",
  buffer: "Target requirement × (1 + buffer).",
  backfill: "Replace projected leavers only — never hire for growth.",
  manual: "Your per-queue hires, exactly as entered; ignores the cap.",
  schedule: "An ordered plan that pivots strategy at set weeks.",
};

// §14.1: strategies live in config.strategies (built-ins + custom + schedules).
// Fall back to the four built-ins for configs that predate the array.
export function strategyList(config) {
  const list = (config && config.strategies) || [];
  return list.length ? list : STRATEGIES.map((s, i) => ({ id: s.id, name: s.name, baseType: ["meet", "buffer", "backfill", "manual"][i], builtin: true }));
}
export function strategyObj(config, id) {
  return strategyList(config).find((s) => s.id === id) || null;
}
export function resolveStrategyName(config, id) {
  const s = strategyObj(config, id);
  return s ? s.name : id;
}
export const isSchedule = (s) => !!s && s.baseType === "schedule";
export const strategyBlurb = (s) => (s && s.blurb) || (s && BASE_BLURB[s.baseType]) || "";

// "S3 → S1 from wk 10" style one-liner for a schedule strategy.
export function scheduleSummary(config, strat) {
  if (!isSchedule(strat) || !(strat.segments || []).length) return "";
  const segs = [...strat.segments].sort((a, b) => (a.fromWeek || 1) - (b.fromWeek || 1));
  return segs.map((seg, i) => {
    const nm = resolveStrategyName(config, seg.strategyId);
    return i === 0 ? nm : `${nm} from wk ${seg.fromWeek}`;
  }).join(" → ");
}

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

// ---- §24 hierarchy (Brand → Voice/Digital/Support → queue) ----
// The one shared grouping used by Plan, Summary and Data. Channels appear in a
// stable order and only when populated; brands in config definition order.
const CHANNEL_ORDER = [
  { key: "voice", label: "Voice" },
  { key: "digital", label: "Digital" },
  { key: "support", label: "Support" },
];
export const channelOfQueue = (q) => q.channel || (q.type === "voice" ? "voice" : "digital");
export function hierarchy(config) {
  const brands = (config.brands && config.brands.length) ? config.brands : [{ id: "__none", name: "Unbranded" }];
  return brands.map((b) => {
    const qs = config.queues.filter((q) => (q.brandId || "__none") === b.id);
    const channels = CHANNEL_ORDER
      .map((c) => ({ ...c, queues: qs.filter((q) => channelOfQueue(q) === c.key) }))
      .filter((c) => c.queues.length);
    return { brand: b, queues: qs, channels };
  }).filter((row) => row.queues.length);
}
// A flat, hierarchy-ordered queue list (Brand → channel → queue).
export function orderedQueues(config) {
  return hierarchy(config).flatMap((row) => row.channels.flatMap((c) => c.queues));
}

// ---- §19 scenario groups (replace views everywhere in R2) ----
export const groupList = (config) => (config && config.groups) || [];
export const groupName = (config, groupId) => {
  const g = groupList(config).find((x) => x.id === groupId);
  return g ? g.name : groupId;
};
// Resolve a group id to the concrete scenario-id list simulate() expects.
// A group with an explicit scenarioIds array uses it (filtered to live
// scenarios); a group without one tracks the currently-enabled set.
export function groupScenarioIds(config, groupId) {
  const g = groupList(config).find((x) => x.id === groupId) || groupList(config)[0];
  if (g && Array.isArray(g.scenarioIds)) return g.scenarioIds.filter((id) => config.scenarios.some((s) => s.id === id));
  return config.scenarios.filter((s) => s.enabled).map((s) => s.id);
}

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
