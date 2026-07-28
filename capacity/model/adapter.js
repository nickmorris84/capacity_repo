/* v2.4 rebuild — Step 1/3 bridge: the engine adapter.
 *
 * PURE. No DOM, no React. Turns a derived v2.4 domain model back into a config
 * the PRESERVED engine can run — "the adapter feeds the preserved engine, it
 * does not alter it" (prompt rule 7). This is the seam that keeps the engine
 * untouched while the domain model and UI are rebuilt around it.
 *
 * What it does:
 *   • runs the derivation module to get each queue's derived volume + effective
 *     AHT (never user-entered),
 *   • rebuilds each engine queue from its carried staffing physics, overriding
 *     ONLY the demand-derived fields (dailyVolume, aht),
 *   • reassembles the engine's preserved global config (settings, hiring,
 *     scenarios, …) carried through migration.
 *
 * Because the derived volume/AHT of a migrated v1 config equal the originals,
 * v1 cfg → migrate → adapter → engine reproduces the original simulation exactly
 * (proved by tests/adapter.test.js against the golden pipeline).
 *
 * Journey cross-queue routing (rule 7: "map journey splits onto the engine's
 * deflection inputs") is derived here too: a journey step whose queue differs
 * from the service's first (entry) queue is a cross-queue flow. Migrated configs
 * have single-step journeys, so this is inert for them; it activates once the v2
 * UI authors multi-step journeys, without disturbing the round-trip.
 */
const D = require("./derive.js");
const { DEFAULT_PROFILE } = require("../engine/engine.js");

// v2 queue type → v1 engine type/subtype. Inverse of migrate.v2QueueType, but
// driven by the carried staffing where present so nothing is lost.
function engineTypeOf(q) {
  if (q.staffing && q.staffing.type) return { type: q.staffing.type, subtype: q.staffing.subtype };
  if (q.type === "inbound_call" || q.type === "outbound_call") return { type: "voice" };
  return { type: "digital" };
}

function v2ToEngineConfig(model, opts = {}) {
  const struct = D.indexStructure(model);
  const serviceVolumes = D.deriveServiceVolumes(model, struct);
  const derived = D.deriveQueueWorkload(model, { struct, serviceVolumes });

  const base = model.engineConfig || opts.engineConfig;
  if (!base) throw new Error("v2ToEngineConfig: no engineConfig carried on the model (migrate first, or pass opts.engineConfig)");

  const brandDefault = (model.brands && model.brands[0] && model.brands[0].id) || "b1";
  const resolveChannelBrand = (q) => {
    if (q.attachment && q.attachment.kind === "structural") {
      const n = struct.nodes.get(q.attachment.channelInstanceId);
      if (n && n.path && n.path.length) return { channel: n.name, brandId: n.path[0] };
    }
    return { channel: q.type === "inbound_call" || q.type === "outbound_call" ? "voice" : "digital", brandId: brandDefault };
  };

  const queues = (model.queues || []).map((q) => {
    const d = derived.get(q.id) || { volume: 0, effectiveAht: q.fallbackAhtSec };
    const st = q.staffing || {};
    const et = engineTypeOf(q);
    const cb = resolveChannelBrand(q);
    // Migrated queues carry the full engine staffing (burn/wf/channel/…) and it
    // overrides these defaults exactly — so the round-trip is unchanged. Queues
    // AUTHORED IN SETUP carry only the compact drawer fields; the defaults fill
    // every engine-required field (notably burn/wf, whose absence crashes the
    // day loop) so any Setup queue is simulatable.
    const defaults = engineQueueDefaults(cb);
    const merged = { ...defaults, ...st };
    // Map the compact drawer attrition (%/yr) onto the engine's monthly wf when
    // the queue has no wf of its own (i.e. it was authored in Setup).
    if (!st.wf && st.attritionPct != null) merged.wf = { ...defaults.wf, attrition: (st.attritionPct / 100) / 12 };
    const eq = {
      ...merged,
      id: q.id,
      name: q.name != null ? q.name : st.name,
      type: et.type,
      brandId: merged.brandId, channel: merged.channel,
      dailyVolume: d.volume,
      aht: d.effectiveAht,
    };
    if (et.subtype != null) eq.subtype = et.subtype;
    return eq;
  });

  return { ...base, queues };
}

// Every engine-required field with a sane default, so a Setup-authored queue
// (compact staffing) simulates without dereferencing undefined (burn/wf/…).
function engineQueueDefaults(cb) {
  return {
    brandId: cb.brandId, channel: cb.channel, priority: 5,
    concurrency: 1, digitalSlaMinutes: 5, digitalSlaPct: 0.8, backlogLimit: 150, deflectsTo: null,
    crossSkill: [], supports: [], weeklyVolumes: null, seasonal: null,
    profile: [...DEFAULT_PROFILE], // intraday arrival pattern (normProfile WeakMap key)
    asaTarget: 30, maxAbandon: 0.05, patience: 90, shrinkage: 0.3, agentCost: 32000,
    resourcing: "resourced",
    wf: { attrition: 0.04, attritionGrowth: 0, reqToStart: 6, trainingWeeks: 4, learningCurve: [0.6, 0.75, 0.9, 1.0], hires: [] },
    burn: { occThreshold: 0.85, sensitivity: 1.5, recovery: 8, maxAttritionMult: 2, absenceUplift: 0.05 },
  };
}

// Convenience: v1 cfg → v2 model → engine cfg, in one call. Requires migrate.js
// (kept as a lazy require so adapter.js has no hard dep when used model-first).
function roundTripConfig(cfg) {
  const { migrateV1ToV2 } = require("./migrate.js");
  return v2ToEngineConfig(migrateV1ToV2(cfg));
}

module.exports = { v2ToEngineConfig, roundTripConfig, engineTypeOf };
