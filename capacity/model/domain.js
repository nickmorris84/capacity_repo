/* Domain model v1.2 (DOMAIN-MODEL.md) — shapes, scope, validation, guards.
 *
 * PURE. No DOM, no React, no engine import. The registry is FLAT: brands,
 * business units, channels, process groups and products are independent lists;
 * the request type is the only place they are linked. Queue-to-queue flow
 * (incl. knock-ons) is routing expressed as process steps — there is no
 * separate interaction entity.
 *
 * model = {
 *   brands:        [{ id, name }],
 *   businessUnits: [{ id, name }],
 *   channels:      [{ id, key, name?, defaults? }],   // key from the taxonomy
 *   processGroups: [{ id, name }],
 *   products:      [{ id, name }],
 *   queues:        [{ id, name, type, homeBrandId?, homeBuId?,
 *                     fallbackAhtSec, staffing }],
 *   requestTypes:  [{ id, name, activity, productRequest,
 *                     groupId, productId?, ahtSec?,
 *                     brandIds: [], buIds: [],        // empty ⇒ All
 *                     processes: [{ channelId, outcomes: [name],
 *                       steps: [{ queueId, splitPct, samplingPct?,
 *                                 terminal?, outcome? }] }] }],
 *   volumeEntries: [{ id?, scope: { brandId?, buId?, requestTypeId?,
 *                     channelId? }, daily? , weekly?: number[] }],
 *   engineConfig?  // preserved v1 global config, carried verbatim
 * }
 */

// v1.3: a process is a SHARED entity — request types reference processes by id,
// and the same process can serve several request types. v1.2 embedded them in
// the request type; resolve both shapes so stored models keep working.
function processesOf(model, rt) {
  if (!rt) return [];
  if (Array.isArray(rt.processIds))
    return rt.processIds.map((id) => (model.processes || []).find((x) => x.id === id)).filter(Boolean);
  return rt.processes || [];
}

const LEVELS = ["brandId", "buId", "requestTypeId", "channelId"];

const assignedBrands = (rt, model) =>
  rt.brandIds && rt.brandIds.length ? rt.brandIds : (model.brands || []).map((b) => b.id);
const assignedBUs = (rt, model) =>
  rt.buIds && rt.buIds.length ? rt.buIds : (model.businessUnits || []).map((b) => b.id);

// Every valid (brand, BU, request type, channel) combination — the cascade's
// leaf set, derived from assignments and processes, never from a tree.
function leaves(model) {
  const out = [];
  for (const rt of model.requestTypes || [])
    for (const brandId of assignedBrands(rt, model))
      for (const buId of assignedBUs(rt, model))
        for (const p of processesOf(model, rt))
          out.push({ brandId, buId, requestTypeId: rt.id, channelId: p.channelId, rt, process: p });
  return out;
}

const keyOf = (a) =>
  [a.brandId || "", a.buId || "", a.requestTypeId || "", a.channelId || ""].join("|");

// ---------------------------------------------------------------- validation
// Errors block a run; warnings inform (V1 coverage lives in cascade.js where
// the resolved node set exists; V5 reconciliation notes come from the resolver).
function validateDomain(model) {
  const errors = [], warnings = [];
  const ids = (list) => new Set((list || []).map((x) => x.id));
  const chIds = ids(model.channels), qIds = ids(model.queues);
  const gIds = ids(model.processGroups), pIds = ids(model.products);
  const bIds = ids(model.brands), buIds = ids(model.businessUnits);

  for (const rt of model.requestTypes || []) {
    if (!gIds.has(rt.groupId))
      errors.push({ kind: "dangling_group", requestTypeId: rt.id, message: `Request type "${rt.name}" references a missing process group.` });
    if (rt.productId != null && !pIds.has(rt.productId))
      errors.push({ kind: "dangling_product", requestTypeId: rt.id, message: `Request type "${rt.name}" references a missing product.` });
    for (const b of rt.brandIds || []) if (!bIds.has(b))
      errors.push({ kind: "dangling_brand", requestTypeId: rt.id, message: `Request type "${rt.name}" is assigned to a missing brand.` });
    for (const b of rt.buIds || []) if (!buIds.has(b))
      errors.push({ kind: "dangling_bu", requestTypeId: rt.id, message: `Request type "${rt.name}" is assigned to a missing business unit.` });
    for (const p of processesOf(model, rt)) {
      if (!chIds.has(p.channelId))
        errors.push({ kind: "dangling_channel", requestTypeId: rt.id, message: `Request type "${rt.name}" has a process on a missing channel.` });
      for (const s of p.steps || []) if (!qIds.has(s.queueId))
        errors.push({ kind: "dangling_queue", requestTypeId: rt.id, queueId: s.queueId, message: `A step of "${rt.name}" references a missing queue.` });
      // V3 — end-point completeness: a process with steps must declare where it ends.
      if ((p.steps || []).length && !(p.steps || []).some((s) => s.terminal))
        errors.push({ kind: "endpoint_missing", requestTypeId: rt.id, channelId: p.channelId, message: `"${rt.name}" (${p.channelId}) has no terminal step — the process leads nowhere.` });
    }
  }

  // V2 — double-cover, scoped to a group: two request types in one group
  // covering the same (brand, BU, channel) is probably the same work twice.
  const cover = new Map(); // group|brand|bu|channel → [rtId]
  for (const l of leaves(model)) {
    const k = l.rt.groupId + "|" + l.brandId + "|" + l.buId + "|" + l.channelId;
    if (!cover.has(k)) cover.set(k, new Set());
    cover.get(k).add(l.requestTypeId);
  }
  const nameOf = (id) => ((model.requestTypes || []).find((r) => r.id === id) || {}).name || id;
  for (const [k, rts] of cover) if (rts.size > 1) {
    const [groupId, brandId, buId, channelId] = k.split("|");
    const g = (model.processGroups || []).find((x) => x.id === groupId);
    warnings.push({ kind: "double_cover", groupId, brandId, buId, channelId, requestTypeIds: [...rts],
      message: `${g ? g.name : groupId} appears handled twice for the same brand/BU/channel (${[...rts].map(nameOf).join(" and ")}).` });
  }
  return { ok: errors.length === 0, errors, warnings };
}

// -------------------------------------------------- registry guards (V6/V4)
const guard = (blockedBy) => ({ ok: blockedBy.length === 0, blockedBy });

function canDeleteBrand(model, id) {
  const b = [];
  for (const rt of model.requestTypes || []) if ((rt.brandIds || []).includes(id)) b.push({ kind: "requestType", id: rt.id });
  for (const q of model.queues || []) if (q.homeBrandId === id) b.push({ kind: "queue", id: q.id });
  for (const e of model.volumeEntries || []) if ((e.scope || {}).brandId === id) b.push({ kind: "volumeEntry", id: e.id });
  return guard(b);
}
function canDeleteBU(model, id) {
  const b = [];
  for (const rt of model.requestTypes || []) if ((rt.buIds || []).includes(id)) b.push({ kind: "requestType", id: rt.id });
  for (const q of model.queues || []) if (q.homeBuId === id) b.push({ kind: "queue", id: q.id });
  for (const e of model.volumeEntries || []) if ((e.scope || {}).buId === id) b.push({ kind: "volumeEntry", id: e.id });
  return guard(b);
}
function canDeleteChannel(model, id) {
  const b = [];
  for (const rt of model.requestTypes || []) if (processesOf(model, rt).some((p) => p.channelId === id)) b.push({ kind: "requestType", id: rt.id });
  for (const pr of model.processes || []) if (pr.channelId === id) b.push({ kind: "process", id: pr.id });
  for (const e of model.volumeEntries || []) if ((e.scope || {}).channelId === id) b.push({ kind: "volumeEntry", id: e.id });
  return guard(b);
}
function canDeleteGroup(model, id) {
  return guard((model.requestTypes || []).filter((rt) => rt.groupId === id).map((rt) => ({ kind: "requestType", id: rt.id })));
}
function canDeleteProduct(model, id) {
  return guard((model.requestTypes || []).filter((rt) => rt.productId === id).map((rt) => ({ kind: "requestType", id: rt.id })));
}
function canDeleteQueue(model, id) {
  const b = [];
  for (const rt of model.requestTypes || [])
    for (const p of processesOf(model, rt))
      if ((p.steps || []).some((s) => s.queueId === id)) b.push({ kind: "requestType", id: rt.id, channelId: p.channelId });
  return guard(b);
}
function canDeleteRequestType(model, id) {
  return guard((model.volumeEntries || []).filter((e) => (e.scope || {}).requestTypeId === id).map((e) => ({ kind: "volumeEntry", id: e.id })));
}

// Blast radius for the queue list: "used in N processes across M brands".
function queueUsage(model, queueId) {
  let processes = 0;
  const brands = new Set();
  for (const rt of model.requestTypes || [])
    for (const p of processesOf(model, rt))
      if ((p.steps || []).some((s) => s.queueId === queueId)) {
        processes++;
        for (const b of assignedBrands(rt, model)) brands.add(b);
      }
  return { processes, brands: brands.size };
}

module.exports = {
  processesOf,
  LEVELS, keyOf, leaves, assignedBrands, assignedBUs, validateDomain,
  canDeleteBrand, canDeleteBU, canDeleteChannel, canDeleteGroup,
  canDeleteProduct, canDeleteQueue, canDeleteRequestType, queueUsage,
};
