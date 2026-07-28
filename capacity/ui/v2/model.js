/* v2.4 rebuild — Setup state: the v2 domain model + pure reducer ops.
 * The UI edits this model; model/derive.js turns it into read-only queue
 * volume/AHT and validation. Ops are pure (return a new model) so React state
 * updates are clean and the reducers are unit-testable without a DOM.
 */
import { derive, canDeleteQueue, canDeleteService } from "../../model/derive.js";
export { canDeleteQueue, canDeleteService };
import { CHANNELS } from "../../model/taxonomy.js";

// Browser-only id generator (never used by the pure model/derive/migrate code).
let _seq = 0;
export function uid(prefix = "id") { _seq += 1; return `${prefix}_${_seq}_${Math.random().toString(36).slice(2, 7)}`; }

// ---- taxonomy (fixed enumerations, mirrored from model/taxonomy.js) ---------
export const ACTIVITIES = ["service_request", "lead", "decision", "collections", "upsell_xsell", "maintenance"];
export const PRODUCT_REQUESTS = ["new", "existing"];
export const QUEUE_TYPES = ["inbound_call", "outbound_call", "case_processing", "governance"];
export const ACTIVITY_LABELS = {
  service_request: "Service request", lead: "Lead", decision: "Decision",
  collections: "Collections", upsell_xsell: "Up-sell / x-sell", maintenance: "Maintenance",
};
export const CHANNEL_LABELS = { voice: "Voice", third_party: "Third party", digital: "Digital", customer_management: "Customer management" };
export const QTYPE_LABELS = { inbound_call: "inbound call", outbound_call: "outbound call", case_processing: "case processing", governance: "governance" };

// ---- derived-state helper ----------------------------------------------------
export function deriveModel(model) { return derive(model); }

// ---- structure ops -----------------------------------------------------------
const clone = (m) => JSON.parse(JSON.stringify(m));

export function addBusinessUnit(model, brandId) {
  const m = clone(model);
  const b = m.brands.find((x) => x.id === brandId) || m.brands[0];
  b.businessUnits.push({ id: uid("bu"), name: `Business unit ${b.businessUnits.length + 1}`, products: [] });
  return m;
}
export function addProduct(model, buId) {
  const m = clone(model);
  for (const b of m.brands) {
    const bu = b.businessUnits.find((x) => x.id === buId);
    if (bu) { bu.products.push({ id: uid("prod"), name: `Product ${bu.products.length + 1}`, channels: [] }); break; }
  }
  return m;
}
export function toggleChannel(model, productId, channelKey) {
  const m = clone(model);
  for (const b of m.brands) for (const bu of b.businessUnits) {
    const p = bu.products.find((x) => x.id === productId);
    if (!p) continue;
    const i = p.channels.findIndex((c) => c.channel === channelKey);
    if (i >= 0) p.channels.splice(i, 1);
    else p.channels.push({ id: uid("ci"), channel: channelKey });
    return m;
  }
  return m;
}
export function renameNode(model, kind, id, name) {
  const m = clone(model);
  for (const b of m.brands) {
    if (kind === "brand" && b.id === id) { b.name = name; return m; }
    for (const bu of b.businessUnits) {
      if (kind === "bu" && bu.id === id) { bu.name = name; return m; }
      for (const p of bu.products) if (kind === "product" && p.id === id) { p.name = name; return m; }
    }
  }
  return m;
}

// ---- queue ops ---------------------------------------------------------------
export function addQueue(model, { attachment, name, type }) {
  const m = clone(model);
  m.queues.push({
    id: uid("q"), name: name || `Queue ${m.queues.length + 1}`,
    type: type || "inbound_call",
    attachment: attachment || { kind: "shared" },
    fallbackAhtSec: 300,
    staffing: { asaTarget: 30, maxAbandon: 0.05, patience: 90, shrinkage: 0.3, agentCost: 32000, resourcing: "dedicated", occupancyCeiling: 0.85, churnCost: 500, failedToChurnPct: 6, attritionPct: 26 },
  });
  return m;
}
export function updateQueue(model, queueId, patch) {
  const m = clone(model);
  const q = m.queues.find((x) => x.id === queueId);
  if (q) Object.assign(q, patch);
  return m;
}
export function updateQueueStaffing(model, queueId, patch) {
  const m = clone(model);
  const q = m.queues.find((x) => x.id === queueId);
  if (q) { q.staffing = { ...(q.staffing || {}), ...patch }; q._modified = true; }
  return m;
}
export function deleteQueue(model, queueId) {
  const m = clone(model);
  m.queues = m.queues.filter((x) => x.id !== queueId);
  return m;
}
export function resetQueueStaffing(model, queueId) {
  const m = clone(model);
  const q = m.queues.find((x) => x.id === queueId);
  if (q) { q.staffing = defaultStaffing(); delete q._modified; }
  return m;
}
function defaultStaffing() {
  return { asaTarget: 30, maxAbandon: 0.05, patience: 90, shrinkage: 0.3, agentCost: 32000, resourcing: "dedicated", occupancyCeiling: 0.85, churnCost: 500, failedToChurnPct: 6, attritionPct: 26 };
}

// ---- service ops -------------------------------------------------------------
export function addService(model) {
  const m = clone(model);
  m.services.push({ id: uid("svc"), name: `Service ${m.services.length + 1}`, activity: "service_request", productRequest: "existing", journey: [] });
  return m;
}
export function updateService(model, serviceId, patch) {
  const m = clone(model);
  const s = m.services.find((x) => x.id === serviceId);
  if (s) Object.assign(s, patch);
  return m;
}
export function deleteService(model, serviceId) {
  const m = clone(model);
  m.services = m.services.filter((x) => x.id !== serviceId);
  return m;
}
export function addJourneyStep(model, serviceId, queueId) {
  const m = clone(model);
  const s = m.services.find((x) => x.id === serviceId);
  if (s) s.journey.push({ queueId: queueId || (m.queues[0] && m.queues[0].id), splitPct: s.journey.length === 0 ? 100 : 50 });
  return m;
}
export function updateJourneyStep(model, serviceId, stepIndex, patch) {
  const m = clone(model);
  const s = m.services.find((x) => x.id === serviceId);
  if (s && s.journey[stepIndex]) Object.assign(s.journey[stepIndex], patch);
  return m;
}
export function removeJourneyStep(model, serviceId, stepIndex) {
  const m = clone(model);
  const s = m.services.find((x) => x.id === serviceId);
  if (s) s.journey.splice(stepIndex, 1);
  return m;
}

// ---- profile ops -------------------------------------------------------------
export function addProfile(model, nodeId, level) {
  const m = clone(model);
  const node = nodeId || firstChannelNode(m);
  m.profiles.push({ id: uid("pf"), appliesAt: { level: level || "channel", nodeId: node }, totalVolume: 1000, mix: [] });
  return m;
}
export function updateProfile(model, profileId, patch) {
  const m = clone(model);
  const p = m.profiles.find((x) => x.id === profileId);
  if (p) Object.assign(p, patch);
  return m;
}
export function updateProfileNode(model, profileId, level, nodeId) {
  const m = clone(model);
  const p = m.profiles.find((x) => x.id === profileId);
  if (p) p.appliesAt = { level, nodeId };
  return m;
}
export function deleteProfile(model, profileId) {
  const m = clone(model);
  m.profiles = m.profiles.filter((x) => x.id !== profileId);
  return m;
}
export function addMixRow(model, profileId, serviceId) {
  const m = clone(model);
  const p = m.profiles.find((x) => x.id === profileId);
  if (p) p.mix.push({ serviceId: serviceId || (m.services[0] && m.services[0].id), pct: 0 });
  return m;
}
export function updateMixRow(model, profileId, rowIndex, patch) {
  const m = clone(model);
  const p = m.profiles.find((x) => x.id === profileId);
  if (p && p.mix[rowIndex]) Object.assign(p.mix[rowIndex], patch);
  return m;
}
export function removeMixRow(model, profileId, rowIndex) {
  const m = clone(model);
  const p = m.profiles.find((x) => x.id === profileId);
  if (p) p.mix.splice(rowIndex, 1);
  return m;
}

// ---- lever ops (edit the carried engineConfig; all matrix-affecting) --------
export function setHiringBuffer(model, pct) {
  const m = clone(model);
  ensureEngine(m).hiring.buffer = (+pct || 0) / 100;
  return m;
}
export function setForwardMonths(model, strategyId, months) {
  const m = clone(model);
  const s = (ensureEngine(m).strategies || []).find((x) => x.id === strategyId);
  if (s) s.forwardMonths = Math.max(1, Math.min(6, +months || 1));
  return m;
}
export function setTotalCap(model, cap) {
  const m = clone(model);
  const h = ensureEngine(m).hiring;
  h.caps = h.caps || { total: null, segments: {} };
  h.caps.total = cap === "" || cap == null ? null : +cap;
  h.cap = h.caps.total != null ? h.caps.total : h.cap; // keep legacy fallback in step
  return m;
}
export function setSegmentCap(model, brandId, channel, cap) {
  const m = clone(model);
  const h = ensureEngine(m).hiring;
  h.caps = h.caps || { total: null, segments: {} };
  h.caps.segments = h.caps.segments || {};
  const key = (brandId || "") + "|" + channel;
  if (cap === "" || cap == null) delete h.caps.segments[key];
  else h.caps.segments[key] = +cap;
  return m;
}
function ensureEngine(m) {
  if (!m.engineConfig) throw new Error("lever op needs a model carrying engineConfig (migrate first)");
  return m.engineConfig;
}

function firstChannelNode(m) {
  for (const b of m.brands) for (const bu of b.businessUnits) for (const p of bu.products) if (p.channels[0]) return p.channels[0].id;
  return null;
}

// ---- structure helpers for pickers / labels ---------------------------------
// All selectable structure nodes (bu / product / channel) with path labels.
export function structureNodes(model) {
  const out = [];
  for (const b of model.brands) for (const bu of b.businessUnits) {
    out.push({ id: bu.id, level: "bu", label: `${bu.name} (all products)` });
    for (const p of bu.products) {
      out.push({ id: p.id, level: "product", label: `${bu.name} › ${p.name} (all channels)` });
      for (const ch of p.channels) out.push({ id: ch.id, level: "channel", label: `${bu.name} › ${p.name} › ${CHANNEL_LABELS[ch.channel]}` });
    }
  }
  return out;
}
export const nodeLabel = (model, nodeId) => (structureNodes(model).find((n) => n.id === nodeId) || {}).label || "—";

// ---- blank + sample models ---------------------------------------------------
export function blankModel() {
  return { brands: [{ id: "b1", name: "Brand 1", businessUnits: [] }], queues: [], services: [], profiles: [] };
}

// A brand-new, EMPTY simulation that can still run the engine: no queues /
// services / profiles yet (the Setup wizard's true empty state), but it carries
// the preserved global engine config so Levers/Results don't break before the
// first queue exists. Reuses the current model's engineConfig.
export function emptyModel(engineConfig, name = "New simulation") {
  return {
    brands: [{ id: uid("b"), name, businessUnits: [] }],
    queues: [], services: [], profiles: [],
    engineConfig,
  };
}

// Mirrors setup-page-v3.html's worked example so the page is meaningful on first
// open and the gate has real, cross-linked data (derived volumes, weighted AHT,
// a cross-structure warning, governance sampling).
export function sampleModel() {
  return {
    brands: [{
      id: "b1", name: "Acme",
      businessUnits: [
        { id: "bu_retail", name: "Retail BU", products: [
          { id: "p_cards", name: "Credit cards", channels: [{ id: "ci_cards_voice", channel: "voice" }, { id: "ci_cards_digital", channel: "digital" }] },
          { id: "p_loans", name: "Loans", channels: [{ id: "ci_loans_voice", channel: "voice" }] },
        ] },
        { id: "bu_biz", name: "Business BU", products: [
          { id: "p_merch", name: "Merchant accounts", channels: [{ id: "ci_merch_voice", channel: "voice" }] },
        ] },
      ],
    }],
    queues: [
      { id: "q_billing", name: "Inbound — Billing", type: "inbound_call", attachment: { kind: "structural", channelInstanceId: "ci_cards_voice" }, fallbackAhtSec: 300, staffing: st(300) },
      { id: "q_verif", name: "Outbound — Verification", type: "outbound_call", attachment: { kind: "structural", channelInstanceId: "ci_cards_voice" }, fallbackAhtSec: 240, staffing: st(240) },
      { id: "q_apps", name: "Case — Applications", type: "case_processing", attachment: { kind: "structural", channelInstanceId: "ci_cards_digital" }, fallbackAhtSec: 540, staffing: st(540) },
      { id: "q_gov", name: "QA — Governance", type: "governance", attachment: { kind: "shared" }, fallbackAhtSec: 600, staffing: st(600) },
    ],
    services: [
      { id: "svc_billing", name: "Billing enquiry", activity: "service_request", productRequest: "existing",
        journey: [{ queueId: "q_billing", splitPct: 100 }, { queueId: "q_gov", splitPct: 100, samplingPct: 2 }] },
      { id: "svc_newcard", name: "New card application", activity: "service_request", productRequest: "new", ahtSec: 540,
        journey: [{ queueId: "q_apps", splitPct: 100 }, { queueId: "q_verif", splitPct: 60 }, { queueId: "q_gov", splitPct: 100, samplingPct: 5 }] },
    ],
    profiles: [
      { id: "pf_cards_voice", appliesAt: { level: "channel", nodeId: "ci_cards_voice" }, totalVolume: 2700, mix: [{ serviceId: "svc_billing", pct: 74 }, { serviceId: "svc_newcard", pct: 26 }] },
      { id: "pf_loans", appliesAt: { level: "product", nodeId: "p_loans" }, totalVolume: 400, mix: [{ serviceId: "svc_billing", pct: 100 }] },
    ],
  };
}
function st(aht) { return { asaTarget: 30, maxAbandon: 0.05, patience: 90, shrinkage: 0.3, agentCost: 32000, resourcing: "dedicated", occupancyCeiling: 0.85, churnCost: 500, failedToChurnPct: 6, attritionPct: 26 }; }
