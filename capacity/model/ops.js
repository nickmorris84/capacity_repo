/* Domain edit operations (BUILD-PLAN M1). PURE reducers — every edit the six
 * Setup tabs make, in one tested layer. Each op takes a model and returns a
 * NEW model (deep clone); the input is never mutated. Guarded deletes are
 * enforced here: a delete whose guard fails returns the ORIGINAL model
 * unchanged (callers can test `out === model`), so the UI can never bypass a
 * guard by skipping the check. Ids are caller-suppliable (tests pass them);
 * the fallback generator is browser-only convenience.
 */
const {
  canDeleteBrand, canDeleteBU, canDeleteChannel, canDeleteGroup,
  canDeleteProduct, canDeleteQueue, canDeleteRequestType, keyOf,
} = require("./domain.js");
const { CHANNELS } = require("./taxonomy.js");
const { propagateDomain } = require("./propagate.js");

const clone = (m) => JSON.parse(JSON.stringify(m));
let _seq = 0;
const uid = (p) => `${p}_${(++_seq).toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// Merge a patch into an object; a key explicitly set to undefined is DELETED
// (how optional fields like samplingPct or a terminal flag are cleared).
function applyPatch(target, patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete target[k];
    else target[k] = v;
  }
}

// ------------------------------------------------------------------ registry
function addToList(listKey, prefix) {
  return (model, item = {}) => {
    const m = clone(model);
    m[listKey] = m[listKey] || [];
    m[listKey].push({ id: item.id || uid(prefix), name: item.name || prefix, ...item });
    return m;
  };
}
function renameInList(listKey) {
  return (model, id, name) => {
    const m = clone(model);
    const x = (m[listKey] || []).find((e) => e.id === id);
    if (x) x.name = name;
    return m;
  };
}
function deleteFromList(listKey, guardFn) {
  return (model, id) => {
    if (guardFn && !guardFn(model, id).ok) return model; // guarded → unchanged
    const m = clone(model);
    m[listKey] = (m[listKey] || []).filter((e) => e.id !== id);
    return m;
  };
}

const addBrand = addToList("brands", "b");
const renameBrand = renameInList("brands");
const deleteBrand = deleteFromList("brands", canDeleteBrand);

const addBusinessUnit = addToList("businessUnits", "bu");
const renameBusinessUnit = renameInList("businessUnits");
const deleteBusinessUnit = deleteFromList("businessUnits", canDeleteBU);

const addProcessGroup = addToList("processGroups", "pg");
const renameProcessGroup = renameInList("processGroups");
const deleteProcessGroup = deleteFromList("processGroups", canDeleteGroup);

const addProduct = addToList("products", "prod");
const renameProduct = renameInList("products");
const deleteProduct = deleteFromList("products", canDeleteProduct);

// Channels are enabled from the fixed taxonomy — one per key, defaults editable.
// The four taxonomy channels are the defaults every estate gets; anything else
// is a custom channel the owner adds (a key outside the taxonomy is allowed and
// gets a generated one). Taxonomy channels stay one-per-key so the enable chips
// cannot double-add; custom channels are only deduped by name.
function addChannel(model, { key, id, name, defaults } = {}) {
  const taxonomy = CHANNELS.includes(key);
  if (taxonomy && (model.channels || []).some((c) => c.key === key)) return model;
  if (!taxonomy && !(name && String(name).trim())) return model; // custom needs a name
  const m = clone(model);
  m.channels = m.channels || [];
  const k = taxonomy ? key : (key || uid("chk"));
  m.channels.push({ id: id || (taxonomy ? "ch_" + key : uid("ch")), key: k, name: name || key, ...(defaults ? { defaults } : {}) });
  return m;
}
// Every taxonomy channel, seeded so a new estate can use them immediately.
function withDefaultChannels(model) {
  let m = model;
  for (const key of CHANNELS) m = addChannel(m, { key, name: CHANNEL_NAMES[key] });
  return m;
}
const CHANNEL_NAMES = { voice: "Voice", third_party: "Third party", digital: "Digital", customer_management: "Customer management" };
const renameChannel = renameInList("channels");
const deleteChannel = deleteFromList("channels", canDeleteChannel);
function setChannelDefaults(model, channelId, patch) {
  const m = clone(model);
  const c = (m.channels || []).find((x) => x.id === channelId);
  if (c) { c.defaults = c.defaults || {}; applyPatch(c.defaults, patch); }
  return m;
}

// -------------------------------------------------------------------- queues
const DEFAULT_STAFFING = {
  asaTarget: 30, maxAbandon: 0.05, patience: 90, shrinkage: 0.3, agentCost: 32000,
  resourcing: "dedicated", occupancyCeiling: 0.85, churnCost: 500, failedToChurnPct: 6, attritionPct: 26,
};
function addQueue(model, { id, name, type, homeBrandId, homeBuId, fallbackAhtSec } = {}) {
  const m = clone(model);
  m.queues = m.queues || [];
  const q = {
    id: id || uid("q"), name: name || `Queue ${m.queues.length + 1}`,
    type: type || "inbound_call", fallbackAhtSec: fallbackAhtSec != null ? fallbackAhtSec : 300,
    staffing: { ...DEFAULT_STAFFING },
  };
  if (homeBrandId) q.homeBrandId = homeBrandId;
  if (homeBuId) q.homeBuId = homeBuId;
  m.queues.push(q);
  return m;
}
function updateQueue(model, queueId, patch) {
  const m = clone(model);
  const q = (m.queues || []).find((x) => x.id === queueId);
  if (q) applyPatch(q, patch);
  return m;
}
function updateQueueStaffing(model, queueId, patch) {
  const m = clone(model);
  const q = (m.queues || []).find((x) => x.id === queueId);
  if (q) { q.staffing = q.staffing || {}; applyPatch(q.staffing, patch); q._modified = true; }
  return m;
}
function resetQueueStaffing(model, queueId) {
  const m = clone(model);
  const q = (m.queues || []).find((x) => x.id === queueId);
  if (q) { q.staffing = { ...DEFAULT_STAFFING }; delete q._modified; }
  return m;
}
const deleteQueue = deleteFromList("queues", canDeleteQueue);

// Service teams (shared capacity) live in the preserved engineConfig.
function addServiceTeam(model, team = {}) {
  const m = clone(model);
  m.engineConfig = m.engineConfig || {};
  m.engineConfig.serviceTeams = m.engineConfig.serviceTeams || [];
  m.engineConfig.serviceTeams.push({
    id: team.id || uid("st"), name: team.name || "Shared team",
    size: 5, premiumPct: 0.1, proficiency: 0.8, triggerOccupancy: 0.9,
    maxHoursPerWeek: 100, agentCost: 32000, coversQueues: [], ...team,
  });
  return m;
}
function updateServiceTeam(model, teamId, patch) {
  const m = clone(model);
  const t = ((m.engineConfig || {}).serviceTeams || []).find((x) => x.id === teamId);
  if (t) applyPatch(t, patch);
  return m;
}
function deleteServiceTeam(model, teamId) {
  const m = clone(model);
  if (m.engineConfig && m.engineConfig.serviceTeams)
    m.engineConfig.serviceTeams = m.engineConfig.serviceTeams.filter((x) => x.id !== teamId);
  return m;
}

// ------------------------------------------------------------- request types
function addRequestType(model, { id, name, groupId, activity, productRequest, productId } = {}) {
  const m = clone(model);
  m.requestTypes = m.requestTypes || [];
  const rt = {
    id: id || uid("rt"), name: name || "New request type",
    activity: activity || "service_request", productRequest: productRequest || "existing",
    groupId, brandIds: [], buIds: [], processes: [],
  };
  if (productId != null) rt.productId = productId;
  m.requestTypes.push(rt);
  return m;
}
function updateRequestType(model, rtId, patch) {
  const m = clone(model);
  const rt = (m.requestTypes || []).find((x) => x.id === rtId);
  if (rt) applyPatch(rt, patch);
  return m;
}
function setAssignment(model, rtId, { brandIds, buIds } = {}) {
  const m = clone(model);
  const rt = (m.requestTypes || []).find((x) => x.id === rtId);
  if (rt) {
    if (brandIds) rt.brandIds = [...brandIds];
    if (buIds) rt.buIds = [...buIds];
  }
  return m;
}
const deleteRequestType = deleteFromList("requestTypes", canDeleteRequestType);

const procOf = (m, rtId, channelId) => {
  const rt = (m.requestTypes || []).find((x) => x.id === rtId);
  return rt ? { rt, p: (rt.processes || []).find((x) => x.channelId === channelId) } : { rt: null, p: null };
};
// One process per channel per request type — a second add is a no-op.
function addProcess(model, rtId, channelId) {
  const { rt, p } = procOf(model, rtId, channelId);
  if (!rt || p) return model;
  const m = clone(model);
  const rt2 = m.requestTypes.find((x) => x.id === rtId);
  rt2.processes.push({ channelId, outcomes: ["completed"], steps: [] });
  return m;
}
function deleteProcess(model, rtId, channelId) {
  const { p } = procOf(model, rtId, channelId);
  if (!p) return model;
  const m = clone(model);
  const rt2 = m.requestTypes.find((x) => x.id === rtId);
  rt2.processes = rt2.processes.filter((x) => x.channelId !== channelId);
  return m;
}
function addStep(model, rtId, channelId, { queueId, splitPct, samplingPct } = {}) {
  const { p } = procOf(model, rtId, channelId);
  if (!p) return model;
  const m = clone(model);
  const p2 = procOf(m, rtId, channelId).p;
  const step = { queueId, splitPct: splitPct != null ? splitPct : 100 };
  if (samplingPct != null) step.samplingPct = samplingPct;
  p2.steps.push(step);
  return m;
}
function updateStep(model, rtId, channelId, index, patch) {
  const { p } = procOf(model, rtId, channelId);
  if (!p || !p.steps[index]) return model;
  const m = clone(model);
  const step = procOf(m, rtId, channelId).p.steps[index];
  applyPatch(step, patch);
  if (patch.terminal === false) { delete step.terminal; delete step.outcome; }
  return m;
}
function removeStep(model, rtId, channelId, index) {
  const { p } = procOf(model, rtId, channelId);
  if (!p || !p.steps[index]) return model;
  const m = clone(model);
  procOf(m, rtId, channelId).p.steps.splice(index, 1);
  return m;
}
function setOutcomes(model, rtId, channelId, outcomes) {
  const { p } = procOf(model, rtId, channelId);
  if (!p) return model;
  const m = clone(model);
  procOf(m, rtId, channelId).p.outcomes = [...outcomes];
  return m;
}

// ------------------------------------------------------------ volume entries
// Upsert semantics: one entry per address through the ops layer (the resolver
// sums duplicates defensively, but ops keep the data canonical).
function setVolumeEntry(model, scope, { daily, weekly } = {}) {
  const m = clone(model);
  m.volumeEntries = (m.volumeEntries || []).filter((e) => keyOf(e.scope || {}) !== keyOf(scope || {}));
  const e = { id: uid("ve"), scope: { ...scope } };
  if (daily != null) e.daily = daily;
  if (weekly != null) e.weekly = [...weekly];
  if (e.daily != null || e.weekly != null) m.volumeEntries.push(e);
  return m;
}
function clearVolumeEntry(model, scope) {
  const m = clone(model);
  m.volumeEntries = (m.volumeEntries || []).filter((e) => keyOf(e.scope || {}) !== keyOf(scope || {}));
  return m;
}

// ----------------------------------------------------------------- fixtures
function blankDomainModel(engineConfig) {
  const m = { brands: [], businessUnits: [], channels: [], processGroups: [], products: [], queues: [], requestTypes: [], volumeEntries: [] };
  if (engineConfig) m.engineConfig = engineConfig;
  return withDefaultChannels(m);
}

// A worked demo estate — deterministic ids, valid, with a shared governance
// queue fed by two request types (so weighted AHT and sampling are exercised).
function sampleDomainModel() {
  return {
    brands: [{ id: "b_acme", name: "Acme" }],
    businessUnits: [{ id: "bu_cs", name: "Customer Service" }],
    channels: [{ id: "ch_voice", key: "voice", name: "Voice" }, { id: "ch_digital", key: "digital", name: "Digital" }],
    processGroups: [{ id: "pg_billing", name: "Billing" }, { id: "pg_cards", name: "Cards" }],
    products: [{ id: "prod_cards", name: "Credit cards" }],
    queues: [
      { id: "q_inbound", name: "Inbound — Billing", type: "inbound_call", homeBrandId: "b_acme", homeBuId: "bu_cs", fallbackAhtSec: 300, staffing: { ...DEFAULT_STAFFING } },
      { id: "q_verify", name: "Outbound — Verification", type: "outbound_call", homeBrandId: "b_acme", homeBuId: "bu_cs", fallbackAhtSec: 240, staffing: { ...DEFAULT_STAFFING } },
      { id: "q_apps", name: "Case — Applications", type: "case_processing", homeBrandId: "b_acme", homeBuId: "bu_cs", fallbackAhtSec: 540, staffing: { ...DEFAULT_STAFFING } },
      { id: "q_qa", name: "QA — Governance", type: "governance", fallbackAhtSec: 600, staffing: { ...DEFAULT_STAFFING } },
    ],
    requestTypes: [
      { id: "rt_billing", name: "Billing enquiry", activity: "service_request", productRequest: "existing",
        groupId: "pg_billing", brandIds: ["b_acme"], buIds: ["bu_cs"],
        processes: [{ channelId: "ch_voice", outcomes: ["completed"], steps: [
          { queueId: "q_inbound", splitPct: 100 },
          { queueId: "q_qa", splitPct: 100, samplingPct: 2, terminal: true, outcome: "completed" },
        ] }] },
      { id: "rt_newcard", name: "New card application", activity: "service_request", productRequest: "new",
        groupId: "pg_cards", productId: "prod_cards", ahtSec: 540, brandIds: ["b_acme"], buIds: ["bu_cs"],
        processes: [{ channelId: "ch_digital", outcomes: ["completed", "rejected"], steps: [
          { queueId: "q_apps", splitPct: 100 },
          { queueId: "q_verify", splitPct: 60 },
          { queueId: "q_qa", splitPct: 100, samplingPct: 5, terminal: true, outcome: "completed" },
        ] }] },
    ],
    volumeEntries: [
      { id: "ve_billing", scope: { brandId: "b_acme", buId: "bu_cs", requestTypeId: "rt_billing" }, daily: 2398 },
      { id: "ve_newcard", scope: { brandId: "b_acme", buId: "bu_cs", requestTypeId: "rt_newcard" }, daily: 702 },
    ],
  };
}

// Import validation report: what came in + the domain validation, for the
// upload banner (nothing is ever applied silently).
function buildDomainImportReport(model) {
  const v = propagateDomain(model).validation;
  return {
    ok: v.ok,
    counts: {
      brands: (model.brands || []).length,
      businessUnits: (model.businessUnits || []).length,
      channels: (model.channels || []).length,
      processGroups: (model.processGroups || []).length,
      products: (model.products || []).length,
      queues: (model.queues || []).length,
      requestTypes: (model.requestTypes || []).length,
      volumeEntries: (model.volumeEntries || []).length,
    },
    errors: v.errors, warnings: v.warnings,
  };
}

module.exports = {
  DEFAULT_STAFFING, uid,
  addBrand, renameBrand, deleteBrand,
  addBusinessUnit, renameBusinessUnit, deleteBusinessUnit,
  addProcessGroup, renameProcessGroup, deleteProcessGroup,
  addProduct, renameProduct, deleteProduct,
  addChannel, renameChannel, deleteChannel, setChannelDefaults, withDefaultChannels, CHANNEL_NAMES,
  addQueue, updateQueue, updateQueueStaffing, resetQueueStaffing, deleteQueue,
  addServiceTeam, updateServiceTeam, deleteServiceTeam,
  addRequestType, updateRequestType, setAssignment, deleteRequestType,
  addProcess, deleteProcess, addStep, updateStep, removeStep, setOutcomes,
  setVolumeEntry, clearVolumeEntry,
  blankDomainModel, sampleDomainModel, buildDomainImportReport,
};
