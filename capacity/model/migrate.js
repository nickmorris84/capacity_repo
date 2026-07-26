/* v2.4 rebuild — Step 1 companion: v1 → v2 model migration.
 *
 * PURE. No DOM, no engine import. Turns the shipped v1 flat config (brand → queue,
 * with a hand-entered dailyVolume and AHT per queue) into the v2.4 domain model
 * per the checklist: "each existing queue becomes one queue + one service
 * ("<queue> demand", 100% mix) + one channel profile."
 *
 * The migration is designed for an EXACT round-trip through the derivation module:
 *   • derived queue volume  === the queue's old dailyVolume
 *   • derived effective AHT === the queue's old AHT
 * so migrating a config and deriving it reproduces the same demand the engine
 * saw before — no numbers move. Structure levels absent in v1 (Business Unit,
 * Product) are synthesised as a single default node each, per D19a.
 *
 * Deterministic ids (no uid()/random): the migration is reproducible and its
 * output diffs cleanly.
 */

// v1 channel ('voice'|'digital') → v2 taxonomy channel. v1 only ever produced
// voice and digital; the other two taxonomy channels (third_party,
// customer_management) have no v1 source and are introduced in the v2 UI.
const CHANNEL_MAP = { voice: "voice", digital: "digital" };

// v1 queue type/subtype → v2 queue type. Voice is an inbound call; digital
// (live chat / workflow) becomes case processing. Outbound/governance queue
// types have no v1 source and are authored in the v2 UI.
function v2QueueType(q) {
  if (q.type === "voice") return "inbound_call";
  return "case_processing";
}

function migrateV1ToV2(cfg) {
  const brands = [];
  const queues = [];
  const services = [];
  const profiles = [];

  const byBrand = new Map();
  for (const q of cfg.queues || []) {
    const bId = q.brandId || "b1";
    if (!byBrand.has(bId)) byBrand.set(bId, []);
    byBrand.get(bId).push(q);
  }

  for (const b of cfg.brands || []) {
    const bQueues = byBrand.get(b.id) || [];
    const buId = `bu_${b.id}`;
    const prodId = `prod_${b.id}`;
    // One channel instance per distinct v1 channel used by this brand's queues.
    const channelInstances = new Map(); // v2channel → ciId
    for (const q of bQueues) {
      const ch = CHANNEL_MAP[q.channel] || "digital";
      if (!channelInstances.has(ch)) channelInstances.set(ch, `ci_${b.id}_${ch}`);
    }
    brands.push({
      id: b.id, name: b.name,
      businessUnits: [{
        id: buId, name: `${b.name} — Main`,
        products: [{
          id: prodId, name: "Main",
          channels: [...channelInstances.entries()].map(([channel, id]) => ({ id, channel })),
        }],
      }],
    });

    for (const q of bQueues) {
      const ch = CHANNEL_MAP[q.channel] || "digital";
      const ciId = channelInstances.get(ch);
      const svcId = `svc_${q.id}`;
      const pfId = `pf_${q.id}`;
      // Queue: structural, pinned to its channel instance; fallback AHT = old AHT.
      // `staffing` carries the original engine parameters verbatim (the prompt's
      // Queue.staffing = "reuse existing engine parameters"). The adapter
      // (model/adapter.js) overrides only the demand-derived fields (dailyVolume,
      // aht) from the derivation module, so the round-trip is exact.
      queues.push({
        id: q.id, name: q.name, type: v2QueueType(q),
        attachment: { kind: "structural", channelInstanceId: ciId },
        fallbackAhtSec: q.aht,
        staffing: q,
      });
      // Service: carries the demand as a single-step journey through its queue.
      // Declaring ahtSec = old AHT makes the derived effective AHT exact even
      // if a later edit changes the queue fallback.
      services.push({
        id: svcId, name: `${q.name} demand`,
        activity: "service_request", productRequest: "existing",
        ahtSec: q.aht,
        journey: [{ queueId: q.id, splitPct: 100 }],
      });
      // Channel volume profile: total = old dailyVolume, 100% to this service.
      profiles.push({
        id: pfId, appliesAt: { level: "channel", nodeId: ciId },
        totalVolume: q.dailyVolume, mix: [{ serviceId: svcId, pct: 100 }],
      });
    }
  }

  // The engine's global config (everything except the queue list) is preserved
  // verbatim — v2.4 restructures DEMAND (queues/services/profiles) and the UI,
  // not the engine's settings/hiring/scenario machinery. The adapter reassembles
  // a runnable cfg from this carry plus the derived per-queue demand.
  const engineConfig = { ...cfg };
  delete engineConfig.queues;

  return { brands, queues, services, profiles, engineConfig };
}

module.exports = { migrateV1ToV2, CHANNEL_MAP, v2QueueType };
