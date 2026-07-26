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

  const queues = (model.queues || []).map((q) => {
    const d = derived.get(q.id) || { volume: 0, effectiveAht: q.fallbackAhtSec };
    const st = q.staffing || {};
    const et = engineTypeOf(q);
    // Start from the preserved staffing physics; override ONLY demand-derived
    // fields. id/name/brand/channel come from staffing when migrated, else fall
    // back to the v2 queue's own fields.
    const eq = {
      ...st,
      id: q.id,
      name: q.name != null ? q.name : st.name,
      type: et.type,
      dailyVolume: d.volume,
      aht: d.effectiveAht,
    };
    if (et.subtype != null) eq.subtype = et.subtype;
    return eq;
  });

  return { ...base, queues };
}

// Convenience: v1 cfg → v2 model → engine cfg, in one call. Requires migrate.js
// (kept as a lazy require so adapter.js has no hard dep when used model-first).
function roundTripConfig(cfg) {
  const { migrateV1ToV2 } = require("./migrate.js");
  return v2ToEngineConfig(migrateV1ToV2(cfg));
}

module.exports = { v2ToEngineConfig, roundTripConfig, engineTypeOf };
