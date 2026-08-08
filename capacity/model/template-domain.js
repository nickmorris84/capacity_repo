/* Template v3 (BUILD-PLAN M4). PURE serialization between the domain model and
 * five flat sheets. The XLSX binding stays in ui/v2/template-xlsx.js style —
 * callers hand these row arrays to SheetJS; this layer is unit-testable
 * without the library.
 *
 * Sheets (DOMAIN-MODEL §10):
 *   Registry        — one row per reference entity (Kind discriminates)
 *   Queues          — one row per queue; the full staffing object rides in
 *                     StaffingJson so ANY staffing shape (incl. migrated v1
 *                     physics with wf/burn) round-trips exactly
 *   Request types   — one row per request type; id lists are ;-joined
 *   Steps           — one row per process step (empty processes get a blank
 *                     row so they survive the trip); ProcessOutcomes rides on
 *                     each row of its process
 *   Volume entries  — one row per entry; weekly series as W1..W52 columns
 *                     (hand-editable in a spreadsheet)
 *
 * engineConfig is a carry, not template content — same rule as template.js.
 * Round-trip guarantee: sheetsToModel(modelToSheets(m)) ≡ m (minus
 * engineConfig), asserted structurally by the M4 gate.
 */

const SHEET_NAMES = ["Registry", "Queues", "Request types", "Processes", "Steps", "Volume entries"];
const WEEKS = 52;

const blank = (v) => (v === undefined || v === null ? "" : v);
const numOrU = (v) => (v === "" || v == null ? undefined : +v);
const strOrU = (v) => (v === "" || v == null ? undefined : String(v));
const joinIds = (a) => (a || []).join(";");
const splitIds = (s) => (s === "" || s == null ? [] : String(s).split(";").filter(Boolean));

// ---- model → sheets ----------------------------------------------------------
function modelToDomainSheets(model) {
  const Registry = [];
  const reg = (kind, e) => Registry.push({
    Kind: kind, Id: e.id, Name: blank(e.name), Key: blank(e.key),
    BrandId: blank(e.brandId), // products may belong to one brand, or all when blank
    DefaultsJson: e.defaults ? JSON.stringify(e.defaults) : "",
  });
  for (const b of model.brands || []) reg("brand", b);
  for (const b of model.businessUnits || []) reg("businessUnit", b);
  for (const c of model.channels || []) reg("channel", c);
  for (const g of model.processGroups || []) reg("processGroup", g);
  for (const p of model.products || []) reg("product", p);

  const Queues = (model.queues || []).map((q) => ({
    QueueId: q.id, Name: q.name, Type: q.type,
    HomeBrandId: blank(q.homeBrandId), HomeBuId: blank(q.homeBuId),
    FallbackAhtSec: q.fallbackAhtSec, Modified: q._modified ? "yes" : "",
    StaffingJson: q.staffing ? JSON.stringify(q.staffing) : "",
  }));

  const RT = (model.requestTypes || []).map((rt) => ({
    RequestTypeId: rt.id, Name: rt.name, Activity: rt.activity, ProductRequest: rt.productRequest,
    GroupId: rt.groupId, ProductId: blank(rt.productId), AhtSec: blank(rt.ahtSec),
    BrandIds: joinIds(rt.brandIds), BuIds: joinIds(rt.buIds),
    ProcessIds: joinIds(rt.processIds),
  }));

  const Processes = (model.processes || []).map((p) => ({
    ProcessId: p.id, Name: blank(p.name), ChannelId: p.channelId,
    GroupId: blank(p.groupId), Outcomes: joinIds(p.outcomes),
  }));

  const Steps = [];
  for (const p of model.processes || []) {
    const head = { ProcessId: p.id };
    if (!(p.steps || []).length) { Steps.push({ ...head, StepOrder: "", QueueId: "", SplitPct: "", SamplingPct: "", Terminal: "", Outcome: "" }); continue; }
    p.steps.forEach((s, i) => Steps.push({
      ...head, StepOrder: i + 1, QueueId: s.queueId, SplitPct: s.splitPct,
      SamplingPct: blank(s.samplingPct), Terminal: s.terminal ? "yes" : "", Outcome: blank(s.outcome),
    }));
  }

  const Volume = (model.volumeEntries || []).map((e) => {
    const row = {
      EntryId: blank(e.id),
      BrandId: blank((e.scope || {}).brandId), BuId: blank((e.scope || {}).buId),
      RequestTypeId: blank((e.scope || {}).requestTypeId), ChannelId: blank((e.scope || {}).channelId),
      Daily: blank(e.daily),
    };
    for (let w = 0; w < WEEKS; w++) row["W" + (w + 1)] = e.weekly ? blank(e.weekly[w]) : "";
    return row;
  });

  return { Registry, Queues, "Request types": RT, Processes, Steps, "Volume entries": Volume };
}

// ---- sheets → model ----------------------------------------------------------
function domainSheetsToModel(sheets) {
  const model = { brands: [], businessUnits: [], channels: [], processGroups: [], products: [], processes: [], queues: [], requestTypes: [], volumeEntries: [] };
  const listOf = { brand: "brands", businessUnit: "businessUnits", channel: "channels", processGroup: "processGroups", product: "products" };

  for (const r of sheets.Registry || []) {
    const list = model[listOf[r.Kind]];
    if (!list) continue;
    const e = { id: r.Id, name: r.Name };
    if (r.Key !== "" && r.Key != null) e.key = r.Key;
    const rb = strOrU(r.BrandId); if (rb) e.brandId = rb;
    if (r.DefaultsJson) e.defaults = JSON.parse(r.DefaultsJson);
    list.push(e);
  }

  for (const r of sheets.Queues || []) {
    const q = { id: r.QueueId, name: r.Name, type: r.Type, fallbackAhtSec: +r.FallbackAhtSec };
    const hb = strOrU(r.HomeBrandId); if (hb) q.homeBrandId = hb;
    const hu = strOrU(r.HomeBuId); if (hu) q.homeBuId = hu;
    if (r.StaffingJson) q.staffing = JSON.parse(r.StaffingJson);
    if (r.Modified === "yes") q._modified = true;
    model.queues.push(q);
  }

  const rtById = new Map();
  for (const r of sheets["Request types"] || []) {
    const rt = {
      id: r.RequestTypeId, name: r.Name, activity: r.Activity, productRequest: r.ProductRequest,
      groupId: r.GroupId, brandIds: splitIds(r.BrandIds), buIds: splitIds(r.BuIds),
      processIds: splitIds(r.ProcessIds),
    };
    const pid = strOrU(r.ProductId); if (pid) rt.productId = pid;
    const aht = numOrU(r.AhtSec); if (aht !== undefined) rt.ahtSec = aht;
    rtById.set(rt.id, rt);
    model.requestTypes.push(rt);
  }

  const procs = new Map();
  for (const r of sheets.Processes || []) {
    const p = { id: r.ProcessId, name: r.Name, channelId: r.ChannelId, outcomes: splitIds(r.Outcomes), steps: [] };
    const g = strOrU(r.GroupId); if (g) p.groupId = g;
    procs.set(p.id, p);
    model.processes.push(p);
  }
  for (const r of sheets.Steps || []) {
    const p = procs.get(r.ProcessId);
    if (!p) continue;
    if (r.StepOrder !== "" && r.StepOrder != null && r.QueueId) {
      const s = { queueId: r.QueueId, splitPct: +r.SplitPct };
      const samp = numOrU(r.SamplingPct); if (samp !== undefined) s.samplingPct = samp;
      if (r.Terminal === "yes") { s.terminal = true; const o = strOrU(r.Outcome); if (o) s.outcome = o; }
      p.steps.push(s);
    }
  }

  for (const r of sheets["Volume entries"] || []) {
    const e = { scope: {} };
    const id = strOrU(r.EntryId); if (id) e.id = id;
    for (const [col, key] of [["BrandId", "brandId"], ["BuId", "buId"], ["RequestTypeId", "requestTypeId"], ["ChannelId", "channelId"]]) {
      const v = strOrU(r[col]); if (v) e.scope[key] = v;
    }
    const daily = numOrU(r.Daily); if (daily !== undefined) e.daily = daily;
    const weekly = [];
    let any = false;
    for (let w = 0; w < WEEKS; w++) {
      const v = numOrU(r["W" + (w + 1)]);
      weekly.push(v !== undefined ? v : 0);
      if (v !== undefined) any = true;
    }
    if (any) e.weekly = weekly;
    if (e.daily !== undefined || e.weekly) model.volumeEntries.push(e);
  }

  return { model };
}

module.exports = { SHEET_NAMES, modelToDomainSheets, domainSheetsToModel };
