/* v2.4 rebuild — Step 1: the derivation module (the heart of the change).
 *
 * PURE. No DOM, no React, no engine import. Destined to run in a Web Worker.
 * Turns the v2.4 domain model — Brand → BU → Product → Channel(instance) → Queue,
 * a catalog of Services (each with a journey through queues), and Channel volume
 * profiles (demand entry points) — into derived queue workload, so that queue
 * volume and effective AHT are NEVER user-entered.
 *
 * Implements the seven derivation rules from the implementation prompt §1.
 * Owner decisions locked (prompt defaults):
 *   • journey-step lag is OUT of v1 — lagDays is parsed but not applied.
 *   • shared-queue cost allocation is by HANDLING MINUTES (volume × per-svc AHT).
 *   • a mix summing under 100% WARNS (unmodelled remainder), never blocks.
 *   • cross-structure volume WARNS (structural queues), never blocks; shared
 *     queues accept volume from any journey silently.
 *
 * ------------------------------------------------------------------ model shape
 * model = {
 *   brands:   [{ id, name, businessUnits: [
 *                { id, name, products: [
 *                  { id, name, channels: [ { id, channel } ] } ] } ] }],
 *   queues:   [{ id, name, type, attachment, fallbackAhtSec }],
 *     attachment = { kind:'structural', channelInstanceId } | { kind:'shared' }
 *   services: [{ id, name, activity, productRequest, ahtSec?, journey: [
 *                { queueId, splitPct, samplingPct?, lagDays? } ] }],
 *   profiles: [{ id, appliesAt:{ level:'bu'|'product'|'channel', nodeId },
 *                totalVolume, mix: [{ serviceId, pct }] }],
 * }
 * `totalVolume` is a plain number in v1 (one representative total). The 52-week
 * WeeklySeries expansion layers on top later — the derivation logic below is
 * per-total and week-independent in structure, so it is unaffected.
 */

const LEVEL_DEPTH = { bu: 1, product: 2, channel: 3 };

// ---------------------------------------------------------------- structure index
// Flattens the brand tree into a node map with parent pointers, ancestor sets and
// human-readable paths. channelInstanceId resolves to its brand›BU›product›channel.
function indexStructure(model) {
  const nodes = new Map(); // id → { id, level, name, parentId, path:[ids], label }
  const add = (id, level, name, parentId) => {
    const parent = parentId != null ? nodes.get(parentId) : null;
    const path = parent ? [...parent.path, id] : [id];
    const label = parent ? `${parent.label} › ${name}` : name;
    nodes.set(id, { id, level, name, parentId: parentId ?? null, path, label });
  };
  for (const b of model.brands || []) {
    add(b.id, "brand", b.name, null);
    for (const bu of b.businessUnits || []) {
      add(bu.id, "bu", bu.name, b.id);
      for (const p of bu.products || []) {
        add(p.id, "product", p.name, bu.id);
        for (const ch of p.channels || []) {
          add(ch.id, "channel", ch.channel, p.id);
        }
      }
    }
  }
  const isAncestorOrSelf = (ancId, descId) => {
    const d = nodes.get(descId);
    return !!d && d.path.includes(ancId);
  };
  return { nodes, isAncestorOrSelf };
}

// The structural node a profile's volume enters at.
const profileNodeId = (profile) => profile.appliesAt && profile.appliesAt.nodeId;

// ------------------------------------------------------- rule 1: volume propagation
// service volume = deepest applicable profile total × mix %. When profiles that
// feed the same service sit on the SAME structural path (one an ancestor of the
// other), only the deepest counts ("deepest wins"); profiles on disjoint paths
// both contribute and are summed.
function deriveServiceVolumes(model, struct = indexStructure(model)) {
  // Collect every (profile, service) contribution.
  const perService = new Map(); // serviceId → [{ profileId, nodeId, pct, total }]
  for (const prof of model.profiles || []) {
    const nodeId = profileNodeId(prof);
    for (const m of prof.mix || []) {
      if (!perService.has(m.serviceId)) perService.set(m.serviceId, []);
      perService.get(m.serviceId).push({
        profileId: prof.id, nodeId, pct: m.pct || 0, total: prof.totalVolume || 0,
      });
    }
  }

  const out = new Map(); // serviceId → { volume, sources:[{profileId,nodeId,pct,total,volume,superseded}] }
  for (const [serviceId, contribs] of perService) {
    // Drop any contribution whose node is a strict ancestor of another
    // contribution's node (same path) — the deeper profile supersedes it.
    const kept = contribs.map((c) => ({ ...c, superseded: false }));
    for (const c of kept) {
      for (const d of kept) {
        if (c === d || c.nodeId == null || d.nodeId == null) continue;
        // c is superseded if d sits strictly deeper on the same path.
        if (c.nodeId !== d.nodeId && struct.isAncestorOrSelf(c.nodeId, d.nodeId)) {
          c.superseded = true;
        }
      }
    }
    let volume = 0;
    const sources = kept.map((c) => {
      const v = c.superseded ? 0 : (c.total * c.pct) / 100;
      volume += v;
      return { profileId: c.profileId, nodeId: c.nodeId, pct: c.pct, total: c.total, volume: v, superseded: c.superseded };
    });
    out.set(serviceId, { volume, sources });
  }
  return out;
}

// -------------------------------------- rules 1+2: queue workload & effective AHT
// Queue workload = Σ over services of (service volume × splitPct × samplingPct).
// per-service AHT at a queue = service.ahtSec ?? queue.fallbackAhtSec.
// queue effective AHT = volume-weighted average of the per-service AHTs.
function deriveQueueWorkload(model, opts = {}) {
  const struct = opts.struct || indexStructure(model);
  const svcVol = opts.serviceVolumes || deriveServiceVolumes(model, struct);
  const queueById = new Map((model.queues || []).map((q) => [q.id, q]));
  const serviceById = new Map((model.services || []).map((s) => [s.id, s]));

  const agg = new Map(); // queueId → { volume, minuteSum, byService:[...] }
  for (const svc of model.services || []) {
    const sv = svcVol.get(svc.id);
    const serviceVolume = sv ? sv.volume : 0;
    for (const step of svc.journey || []) {
      const q = queueById.get(step.queueId);
      if (!q) continue; // dangling reference — surfaced by validateModel()
      const split = (step.splitPct != null ? step.splitPct : 100) / 100;
      const sampling = (step.samplingPct != null ? step.samplingPct : 100) / 100;
      const stepVolume = serviceVolume * split * sampling;
      const svcAht = svc.ahtSec != null ? svc.ahtSec : q.fallbackAhtSec;
      const ahtSource = svc.ahtSec != null ? "svc" : "fallback";
      if (!agg.has(q.id)) agg.set(q.id, { volume: 0, minuteSum: 0, byService: [] });
      const a = agg.get(q.id);
      a.volume += stepVolume;
      a.minuteSum += stepVolume * svcAht; // handling-time units (volume × AHT)
      a.byService.push({
        serviceId: svc.id, serviceName: svc.name, volume: stepVolume,
        aht: svcAht, ahtSource, splitPct: step.splitPct != null ? step.splitPct : 100,
        samplingPct: step.samplingPct != null ? step.samplingPct : 100,
      });
    }
  }

  const out = new Map();
  for (const q of model.queues || []) {
    const a = agg.get(q.id) || { volume: 0, minuteSum: 0, byService: [] };
    const effectiveAht = a.volume > 0 ? a.minuteSum / a.volume : q.fallbackAhtSec;
    // Table marker: 'svc' when a single service drives the queue with its own
    // AHT; 'weighted' when the effective AHT is a volume-weighted blend.
    const contributing = a.byService.filter((s) => s.volume > 0);
    const marker = contributing.length <= 1
      ? (contributing[0] && contributing[0].ahtSource === "svc" ? "svc" : "queue")
      : "weighted";
    out.set(q.id, {
      queueId: q.id, name: q.name, type: q.type, shared: q.attachment && q.attachment.kind === "shared",
      volume: a.volume, effectiveAht, ahtMarker: marker,
      byService: a.byService.sort((x, y) => y.volume - x.volume),
    });
  }
  return out;
}

// ------------------------------------------------ rule 4: cross-structure guard
// Per PROFILE SOURCE: a journey step feeding a STRUCTURAL queue whose
// channel-instance path does not contain THE FEEDING PROFILE's node raises a
// WARNING (never a block). Evaluated per feeding profile, so a service fed both
// in-path (e.g. its own channel) and out-of-path (e.g. a sibling product's
// profile) flags only the out-of-path source — matching the mockup's Loans case.
// Shared queues accept volume from any journey silently.
function crossStructureWarnings(model, struct = indexStructure(model)) {
  const warnings = [];
  const queueById = new Map((model.queues || []).map((q) => [q.id, q]));
  const svcVol = deriveServiceVolumes(model, struct);
  for (const svc of model.services || []) {
    const sv = svcVol.get(svc.id);
    const sources = sv ? sv.sources.filter((s) => !s.superseded && s.nodeId != null && s.volume > 0) : [];
    if (!sources.length) continue;
    for (const step of svc.journey || []) {
      const q = queueById.get(step.queueId);
      if (!q || !q.attachment || q.attachment.kind !== "structural") continue; // shared/dangling: silent
      const chId = q.attachment.channelInstanceId;
      const qn = struct.nodes.get(chId);
      for (const src of sources) {
        if (struct.isAncestorOrSelf(src.nodeId, chId)) continue; // this source is in-path
        const fn = struct.nodes.get(src.nodeId);
        warnings.push({
          kind: "cross_structure", profileId: src.profileId,
          serviceId: svc.id, serviceName: svc.name,
          queueId: q.id, queueName: q.name,
          queuePath: qn ? qn.label : chId,
          feedNodePath: fn ? fn.label : src.nodeId,
          message: `Service "${svc.name}" routes to structural queue "${q.name}" (${qn ? qn.label : chId}) but volume from ${fn ? fn.label : src.nodeId} enters outside that path.`,
        });
      }
    }
  }
  return warnings;
}

// ---------------------------------- rule 1 companion: unmodelled-remainder warnings
// A profile whose mix sums under 100% leaves an unmodelled remainder (WARN).
// Over 100% is a harder error (surfaced by validateModel as an error).
function mixWarnings(model) {
  const warnings = [];
  for (const prof of model.profiles || []) {
    const sum = (prof.mix || []).reduce((a, m) => a + (m.pct || 0), 0);
    if (sum < 100 - 1e-9) {
      warnings.push({
        kind: "unmodelled_remainder", profileId: prof.id, sumPct: sum, remainderPct: 100 - sum,
        message: `Profile mix sums to ${sum}% — ${(100 - sum).toFixed(1)}% of volume is unmodelled.`,
      });
    }
  }
  return warnings;
}

// ------------------------------------ rule 5: shared-queue cost allocation (minutes)
// Allocate a shared queue's workload back to the structures that feed it, by
// handling minutes (volume × per-service AHT) — consistent with the effective-AHT
// rule. Returns per shared queue a breakdown keyed by feeding structural node.
function sharedQueueAllocation(model, opts = {}) {
  const struct = opts.struct || indexStructure(model);
  const svcVol = opts.serviceVolumes || deriveServiceVolumes(model, struct);
  const queueById = new Map((model.queues || []).map((q) => [q.id, q]));
  const out = new Map(); // queueId → { totalMinutes, byNode:[{nodeId,label,minutes,sharePct}] }

  for (const q of model.queues || []) {
    if (!q.attachment || q.attachment.kind !== "shared") continue;
    const byNode = new Map(); // nodeId → minutes
    for (const svc of model.services || []) {
      const step = (svc.journey || []).find((s) => s.queueId === q.id);
      if (!step) continue;
      const sv = svcVol.get(svc.id);
      if (!sv || sv.volume <= 0) continue;
      const split = (step.splitPct != null ? step.splitPct : 100) / 100;
      const sampling = (step.samplingPct != null ? step.samplingPct : 100) / 100;
      const svcAht = svc.ahtSec != null ? svc.ahtSec : q.fallbackAhtSec;
      // Split this service's minutes across ITS feeding nodes in proportion to
      // each node's share of the service's volume.
      const activeSources = sv.sources.filter((s) => !s.superseded && s.volume > 0);
      const denom = activeSources.reduce((a, s) => a + s.volume, 0) || 1;
      for (const src of activeSources) {
        const nodeShare = src.volume / denom;
        const minutes = sv.volume * split * sampling * svcAht * nodeShare;
        byNode.set(src.nodeId, (byNode.get(src.nodeId) || 0) + minutes);
      }
    }
    let total = 0;
    for (const m of byNode.values()) total += m;
    const rows = [...byNode.entries()].map(([nodeId, minutes]) => ({
      nodeId, label: (struct.nodes.get(nodeId) || {}).label || nodeId,
      minutes, sharePct: total > 0 ? (minutes / total) * 100 : 0,
    })).sort((a, b) => b.minutes - a.minutes);
    out.set(q.id, { queueId: q.id, name: q.name, totalMinutes: total, byNode: rows });
  }
  return out;
}

// --------------------------------------------- rule 6: referential integrity guards
function canDeleteQueue(model, queueId) {
  const blockedBy = (model.services || [])
    .filter((s) => (s.journey || []).some((step) => step.queueId === queueId))
    .map((s) => ({ serviceId: s.id, serviceName: s.name }));
  return { ok: blockedBy.length === 0, blockedBy };
}
function canDeleteService(model, serviceId) {
  const blockedBy = (model.profiles || [])
    .filter((p) => (p.mix || []).some((m) => m.serviceId === serviceId))
    .map((p) => ({ profileId: p.id }));
  return { ok: blockedBy.length === 0, blockedBy };
}

// ---------------------------------------------- validation: errors vs warnings
// Errors block a run; warnings inform. Dangling references (a journey step or a
// mix entry pointing at a missing entity) are errors.
function validateModel(model, struct = indexStructure(model)) {
  const errors = [], warnings = [];
  const queueIds = new Set((model.queues || []).map((q) => q.id));
  const serviceIds = new Set((model.services || []).map((s) => s.id));

  for (const svc of model.services || []) {
    for (const step of svc.journey || []) {
      if (!queueIds.has(step.queueId)) {
        errors.push({ kind: "dangling_journey_queue", serviceId: svc.id, queueId: step.queueId,
          message: `Service "${svc.name}" journey references missing queue ${step.queueId}.` });
      }
    }
  }
  for (const prof of model.profiles || []) {
    for (const m of prof.mix || []) {
      if (!serviceIds.has(m.serviceId)) {
        errors.push({ kind: "dangling_mix_service", profileId: prof.id, serviceId: m.serviceId,
          message: `Profile ${prof.id} mix references missing service ${m.serviceId}.` });
      }
    }
    const nodeId = profileNodeId(prof);
    if (nodeId != null && !struct.nodes.has(nodeId)) {
      errors.push({ kind: "dangling_profile_node", profileId: prof.id, nodeId,
        message: `Profile ${prof.id} applies at missing structure node ${nodeId}.` });
    }
    const sum = (prof.mix || []).reduce((a, m) => a + (m.pct || 0), 0);
    if (sum > 100 + 1e-9) {
      errors.push({ kind: "mix_over_100", profileId: prof.id, sumPct: sum,
        message: `Profile ${prof.id} mix sums to ${sum}% (>100%).` });
    }
  }
  warnings.push(...mixWarnings(model));
  warnings.push(...crossStructureWarnings(model, struct));
  return { ok: errors.length === 0, errors, warnings };
}

// ------------------------------------------------- one-pass aggregate (the worker)
// Everything the UI needs from one call, sharing a single structure index and
// service-volume pass. This is the function the Web Worker wraps.
function derive(model) {
  const struct = indexStructure(model);
  const serviceVolumes = deriveServiceVolumes(model, struct);
  const queues = deriveQueueWorkload(model, { struct, serviceVolumes });
  const sharedAllocation = sharedQueueAllocation(model, { struct, serviceVolumes });
  const validation = validateModel(model, struct);
  return {
    serviceVolumes: mapToObj(serviceVolumes),
    queues: mapToObj(queues),
    sharedAllocation: mapToObj(sharedAllocation),
    validation,
  };
}

function mapToObj(m) {
  const o = {};
  for (const [k, v] of m) o[k] = v;
  return o;
}

module.exports = {
  LEVEL_DEPTH,
  indexStructure,
  deriveServiceVolumes,
  deriveQueueWorkload,
  crossStructureWarnings,
  mixWarnings,
  sharedQueueAllocation,
  canDeleteQueue,
  canDeleteService,
  validateModel,
  derive,
};
