/* v2.4 model → domain model v1.2 (DOMAIN-MODEL §10). PURE, deterministic.
 *
 * Mapping: each v2.4 service → a request type in its own process group; its
 * journey → one process on the inferred channel; each NON-SUPERSEDED profile
 * source feeding a service → a volume entry at (brand, BU, request type),
 * daily = that source's contribution. Because entries at the same address sum
 * and steps/AHT copy verbatim, propagateDomain() reproduces the old
 * deriveQueueWorkload() volumes and effective AHT exactly (the round-trip
 * gate asserts it). Deepest-wins is applied ONCE here, via the old model's
 * own source resolution — after migration the cascade semantics own the data.
 */
const { indexStructure, deriveServiceVolumes } = require("./derive.js");

const CH_LABEL = { voice: "Voice", third_party: "Third party", digital: "Digital", customer_management: "Customer management" };

// A v2.4 queue's taxonomy channel: voice-ish types are voice, the rest digital
// unless the carried staffing says otherwise.
function queueChannelKey(q) {
  if (q.staffing && q.staffing.channel === "voice") return "voice";
  if (q.type === "inbound_call" || q.type === "outbound_call") return "voice";
  return "digital";
}

function migrateV2ToDomain(v2) {
  const struct = indexStructure(v2);
  const sv = deriveServiceVolumes(v2, struct);

  const brands = (v2.brands || []).map((b) => ({ id: b.id, name: b.name }));
  const businessUnits = [];
  for (const b of v2.brands || []) for (const bu of b.businessUnits || [])
    businessUnits.push({ id: bu.id, name: bu.name });

  // Channels: the taxonomy keys actually in use across queues.
  const chKeys = [...new Set((v2.queues || []).map(queueChannelKey))];
  const channels = chKeys.map((k) => ({ id: "ch_" + k, key: k, name: CH_LABEL[k] || k }));
  const chIdOf = (k) => "ch_" + k;

  const products = [];
  for (const b of v2.brands || []) for (const bu of b.businessUnits || []) for (const p of bu.products || [])
    products.push({ id: p.id, name: p.name });

  // Queue home from the old structural attachment (path = [brand, bu, ...]).
  const queues = (v2.queues || []).map((q) => {
    const out = { id: q.id, name: q.name, type: q.type, fallbackAhtSec: q.fallbackAhtSec, staffing: q.staffing };
    if (q.attachment && q.attachment.kind === "structural") {
      const n = struct.nodes.get(q.attachment.channelInstanceId);
      if (n && n.path) { out.homeBrandId = n.path[0]; out.homeBuId = n.path[1]; }
    }
    return out;
  });

  const processGroups = [];
  const requestTypes = [];
  const volumeEntries = [];

  for (const s of v2.services || []) {
    const gId = "pg_" + s.id;
    processGroups.push({ id: gId, name: s.name });

    const rec = sv.get(s.id);
    const sources = rec ? rec.sources.filter((x) => !x.superseded && x.volume > 0) : [];
    const brandIds = [...new Set(sources.map((x) => (struct.nodes.get(x.nodeId) || { path: [] }).path[0]).filter(Boolean))];
    const buIds = [...new Set(sources.map((x) => (struct.nodes.get(x.nodeId) || { path: [] }).path[1]).filter(Boolean))];

    // Channel: from the journey's first queue (a v2.4 journey is channel-blind).
    const firstQ = (v2.queues || []).find((q) => q.id === ((s.journey || [])[0] || {}).queueId);
    const chKey = firstQ ? queueChannelKey(firstQ) : chKeys[0] || "voice";

    const rtId = "rt_" + s.id;
    const steps = (s.journey || []).map((st, i, arr) => {
      const step = { queueId: st.queueId, splitPct: st.splitPct != null ? st.splitPct : 100 };
      if (st.samplingPct != null) step.samplingPct = st.samplingPct;
      if (i === arr.length - 1) { step.terminal = true; step.outcome = "completed"; }
      return step;
    });
    const rt = {
      id: rtId, name: s.name, activity: s.activity, productRequest: s.productRequest,
      groupId: gId, brandIds, buIds,
      processes: [{ channelId: chIdOf(chKey), outcomes: ["completed"], steps }],
    };
    if (s.ahtSec != null) rt.ahtSec = s.ahtSec;
    requestTypes.push(rt);

    for (const src of sources) {
      const n = struct.nodes.get(src.nodeId) || { path: [] };
      const scope = { requestTypeId: rtId };
      if (n.path[0]) scope.brandId = n.path[0];
      if (n.path[1]) scope.buId = n.path[1];
      volumeEntries.push({ id: "ve_" + src.profileId + "_" + s.id, scope, daily: src.volume });
    }
  }

  const out = { brands, businessUnits, channels, processGroups, products, queues, requestTypes, volumeEntries };
  if (v2.engineConfig) out.engineConfig = v2.engineConfig;
  return out;
}

module.exports = { migrateV2ToDomain };
