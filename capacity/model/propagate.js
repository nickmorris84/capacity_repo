/* Demand propagation for the domain model (DOMAIN-MODEL §2, §6). PURE.
 *
 * Cascade leaves → queue workload: for every resolved (brand, BU, request
 * type, channel) leaf, walk its process steps; each step lands
 * volume × splitPct × samplingPct on its queue. Per-step AHT is the request
 * type's override ?? the queue's fallback; a queue's effective AHT is the
 * volume-weighted blend (marker: svc | weighted | queue). Weekly series =
 * leaf total × leaf shape, blended volume-weighted per queue (shapes
 * aggregate up). Queue volume and AHT remain DERIVED, never entered.
 */
const { resolveVolumes } = require("./cascade.js");
const { validateDomain, queueUsage } = require("./domain.js");

const WEEKS = 52;

function propagateDomain(model) {
  const { leaves, nodes, notes, uncovered } = resolveVolumes(model);
  const agg = new Map(); // queueId → accumulator

  for (const leaf of leaves) {
    if (!(leaf.total > 0)) continue;
    const shape = leaf.shape; // null = flat
    for (const step of leaf.process.steps || []) {
      const split = (step.splitPct != null ? step.splitPct : 100) / 100;
      const sampling = (step.samplingPct != null ? step.samplingPct : 100) / 100;
      const v = leaf.total * split * sampling;
      if (!(v > 0)) continue;
      const aht = leaf.rt.ahtSec != null ? leaf.rt.ahtSec : null; // null → queue fallback at finish
      if (!agg.has(step.queueId)) agg.set(step.queueId, { volume: 0, minuteSum: 0, weekly: new Array(WEEKS).fill(0), byRequestType: [] });
      const a = agg.get(step.queueId);
      a.volume += v;
      a.byRequestType.push({ requestTypeId: leaf.requestTypeId, brandId: leaf.brandId, buId: leaf.buId, channelId: leaf.channelId, volume: v, aht, provenance: leaf.provenance });
      for (let w = 0; w < WEEKS; w++) a.weekly[w] += v * (shape ? (shape[w] != null ? shape[w] : 1) : 1);
      a.minuteSum += 0; // filled below once fallback AHT is known
    }
  }

  const queues = new Map();
  for (const q of model.queues || []) {
    const a = agg.get(q.id) || { volume: 0, minuteSum: 0, weekly: new Array(WEEKS).fill(0), byRequestType: [] };
    let minuteSum = 0;
    for (const r of a.byRequestType) {
      r.aht = r.aht != null ? r.aht : q.fallbackAhtSec;
      r.ahtSource = r.aht === q.fallbackAhtSec && (model.requestTypes.find((t) => t.id === r.requestTypeId) || {}).ahtSec == null ? "fallback" : "rt";
      minuteSum += r.volume * r.aht;
    }
    const effectiveAht = a.volume > 0 ? minuteSum / a.volume : q.fallbackAhtSec;
    const contributing = a.byRequestType.filter((r) => r.volume > 0);
    const distinct = new Set(contributing.map((r) => r.requestTypeId));
    const marker = distinct.size <= 1
      ? (contributing[0] && contributing[0].ahtSource === "rt" ? "svc" : "queue")
      : "weighted";
    queues.set(q.id, {
      queueId: q.id, name: q.name, type: q.type,
      volume: a.volume, effectiveAht, ahtMarker: marker,
      weekly: a.weekly,
      byRequestType: contributing.sort((x, y) => y.volume - x.volume),
      usage: queueUsage(model, q.id),
    });
  }

  const validation = validateDomain(model);
  validation.warnings = validation.warnings.concat(uncovered);
  return { queues, leaves, nodes, notes, validation };
}

module.exports = { propagateDomain, WEEKS };
