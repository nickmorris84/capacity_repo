/* Engine bridge (BUILD-PLAN M2). PURE. Domain model → the PRESERVED engine's
 * config — the domain twin of model/adapter.js, consuming propagateDomain()
 * instead of the old derivation.
 *
 * New capability landing here: a queue's weekly series (from the cascade's
 * shapes) maps onto the engine's `weeklyVolumes` input — weeklyVolumes[w] is a
 * DAILY volume in force for week w, substituting for dailyVolume, with the
 * engine's own seasonality multiplying on top. When the shape is flat the
 * bridge emits weeklyVolumes: null, keeping the output byte-identical to the
 * old adapter path (the M2 gate asserts full simulation equality there).
 * Everything else mirrors the adapter exactly: staffing physics carried,
 * defaults filled for Setup-authored queues, engineConfig reassembled.
 */
const { propagateDomain } = require("./propagate.js");
const { DEFAULT_PROFILE } = require("../engine/engine.js");

function engineTypeOf(q) {
  if (q.staffing && q.staffing.type) return { type: q.staffing.type, subtype: q.staffing.subtype };
  if (q.type === "inbound_call" || q.type === "outbound_call") return { type: "voice" };
  return { type: "digital" };
}

// Same defaults the old adapter fills — every engine-required field, so a
// Setup-authored queue (compact staffing) simulates without dereferencing
// undefined. Migrated queues carry full v1 staffing and override these exactly.
function engineQueueDefaults(brandId, channel) {
  return {
    brandId, channel, priority: 5,
    concurrency: 1, digitalSlaMinutes: 5, digitalSlaPct: 0.8, backlogLimit: 150, deflectsTo: null,
    crossSkill: [], supports: [], weeklyVolumes: null, seasonal: null,
    profile: [...DEFAULT_PROFILE],
    asaTarget: 30, maxAbandon: 0.05, patience: 90, shrinkage: 0.3, agentCost: 32000,
    resourcing: "resourced",
    wf: { attrition: 0.04, attritionGrowth: 0, reqToStart: 6, trainingWeeks: 4, learningCurve: [0.6, 0.75, 0.9, 1.0], hires: [] },
    burn: { occThreshold: 0.85, sensitivity: 1.5, recovery: 8, maxAttritionMult: 2, absenceUplift: 0.05 },
  };
}

function domainToEngineConfig(model) {
  const base = model.engineConfig;
  if (!base) throw new Error("domainToEngineConfig: model carries no engineConfig (migrate first, or attach one)");
  const p = propagateDomain(model);
  const brandDefault = (model.brands && model.brands[0] && model.brands[0].id) || "b1";

  const queues = (model.queues || []).map((q) => {
    const d = p.queues.get(q.id) || { volume: 0, effectiveAht: q.fallbackAhtSec, weekly: null };
    const st = q.staffing || {};
    const et = engineTypeOf(q);
    const channel = st.channel || (et.type === "voice" ? "voice" : "digital");
    const defaults = engineQueueDefaults(q.homeBrandId || brandDefault, channel);
    const merged = { ...defaults, ...st };
    if (!st.wf && st.attritionPct != null) merged.wf = { ...defaults.wf, attrition: (st.attritionPct / 100) / 12 };

    // Flat shape ⇒ null (identical to the adapter path); real shape ⇒ the
    // engine's per-week daily volumes.
    const hasShape = Array.isArray(d.weekly) && d.weekly.some((v) => Math.abs(v - d.volume) > 1e-9);

    const eq = {
      ...merged,
      id: q.id,
      name: q.name != null ? q.name : st.name,
      type: et.type,
      dailyVolume: d.volume,
      aht: d.effectiveAht,
      weeklyVolumes: hasShape ? d.weekly.slice() : null,
    };
    if (et.subtype != null) eq.subtype = et.subtype;
    return eq;
  });

  return { ...base, queues };
}

module.exports = { domainToEngineConfig, engineTypeOf, engineQueueDefaults };
