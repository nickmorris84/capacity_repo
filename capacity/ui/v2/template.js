/* v2.4 rebuild — template round-trip (Step 6). PURE serialization between the v2
 * model and four flat sheets mirroring the Setup sections: Structure, Queues,
 * Services, Channel volume profiles. The XLSX binding (SheetJS) is lazy-loaded
 * separately (template-xlsx.js) — this layer is plain rows so the round-trip is
 * unit-testable without the 400 KB library.
 *
 * Round-trip guarantee: sheetsToModel(modelToSheets(m)) deep-equals m for the
 * four Setup sections, and modelToSheets is idempotent through a re-import. Ids
 * are carried so structure/refs reconstruct exactly. (Models authored in Setup
 * carry the compact staffing shape below; the engine's global config is a
 * separate carry, not part of the template.)
 */

// Fixed staffing columns (the six-family drawer fields). Order fixed for stable
// sheets; reconstruction restores exactly these keys.
const STAFFING_COLS = [
  ["asaTarget", "AsaTargetSec"], ["maxAbandon", "MaxAbandon"], ["patience", "PatienceSec"],
  ["shrinkage", "Shrinkage"], ["occupancyCeiling", "OccupancyCeiling"], ["resourcing", "Resourcing"],
  ["attritionPct", "AttritionPct"], ["churnCost", "ChurnCost"], ["failedToChurnPct", "FailedToChurnPct"],
  ["agentCost", "AgentCost"],
];
const blank = (v) => (v === undefined || v === null ? "" : v);
const numOrUndef = (v) => (v === "" || v === undefined || v === null ? undefined : +v);

export const SHEET_NAMES = ["Structure", "Queues", "Services", "Channel volume profiles"];

// ---- model → sheets ----------------------------------------------------------
export function modelToSheets(model) {
  const Structure = [];
  for (const b of model.brands || []) {
    if (!b.businessUnits || !b.businessUnits.length) { Structure.push(row(b, null, null, null)); continue; }
    for (const bu of b.businessUnits) {
      if (!bu.products || !bu.products.length) { Structure.push(row(b, bu, null, null)); continue; }
      for (const p of bu.products) {
        if (!p.channels || !p.channels.length) { Structure.push(row(b, bu, p, null)); continue; }
        for (const ch of p.channels) Structure.push(row(b, bu, p, ch));
      }
    }
  }

  const Queues = (model.queues || []).map((q) => {
    const st = q.staffing || {};
    const base = {
      QueueId: q.id, Name: q.name, Type: q.type,
      Attachment: q.attachment && q.attachment.kind === "shared" ? "shared" : "structural",
      ChannelId: q.attachment && q.attachment.kind === "structural" ? q.attachment.channelInstanceId : "",
      FallbackAhtSec: q.fallbackAhtSec,
    };
    for (const [k, col] of STAFFING_COLS) base[col] = blank(st[k]);
    return base;
  });

  const Services = [];
  for (const s of model.services || []) {
    const head = { ServiceId: s.id, ServiceName: s.name, Activity: s.activity, ProductRequest: s.productRequest, ServiceAhtSec: blank(s.ahtSec) };
    if (!s.journey || !s.journey.length) { Services.push({ ...head, StepOrder: "", QueueId: "", SplitPct: "", SamplingPct: "" }); continue; }
    s.journey.forEach((step, i) => Services.push({ ...head, StepOrder: i + 1, QueueId: step.queueId, SplitPct: step.splitPct, SamplingPct: blank(step.samplingPct) }));
  }

  const Profiles = [];
  for (const p of model.profiles || []) {
    const head = { ProfileId: p.id, AppliesLevel: p.appliesAt.level, AppliesNodeId: p.appliesAt.nodeId, TotalVolume: p.totalVolume };
    if (!p.mix || !p.mix.length) { Profiles.push({ ...head, MixServiceId: "", MixPct: "" }); continue; }
    for (const m of p.mix) Profiles.push({ ...head, MixServiceId: m.serviceId, MixPct: m.pct });
  }

  return { Structure, Queues, Services, "Channel volume profiles": Profiles };
}

function row(b, bu, p, ch) {
  return {
    BrandId: b.id, Brand: b.name,
    BUId: bu ? bu.id : "", BusinessUnit: bu ? bu.name : "",
    ProductId: p ? p.id : "", Product: p ? p.name : "",
    ChannelId: ch ? ch.id : "", Channel: ch ? ch.channel : "",
  };
}

// ---- sheets → model ----------------------------------------------------------
export function sheetsToModel(sheets) {
  const report = { warnings: [] };
  const S = sheets.Structure || [];
  const brands = [];
  const bById = new Map(), buById = new Map(), pById = new Map();
  for (const r of S) {
    let b = bById.get(r.BrandId);
    if (!b) { b = { id: r.BrandId, name: r.Brand, businessUnits: [] }; bById.set(b.id, b); brands.push(b); }
    if (!r.BUId) continue;
    let bu = buById.get(r.BUId);
    if (!bu) { bu = { id: r.BUId, name: r.BusinessUnit, products: [] }; buById.set(bu.id, bu); b.businessUnits.push(bu); }
    if (!r.ProductId) continue;
    let p = pById.get(r.ProductId);
    if (!p) { p = { id: r.ProductId, name: r.Product, channels: [] }; pById.set(p.id, p); bu.products.push(p); }
    if (!r.ChannelId) continue;
    if (!p.channels.some((c) => c.id === r.ChannelId)) p.channels.push({ id: r.ChannelId, channel: r.Channel });
  }

  const queues = (sheets.Queues || []).map((r) => {
    const staffing = {};
    for (const [k, col] of STAFFING_COLS) {
      const v = r[col];
      staffing[k] = k === "resourcing" ? (v || "dedicated") : numOrUndef(v);
    }
    return {
      id: r.QueueId, name: r.Name, type: r.Type,
      attachment: r.Attachment === "shared" ? { kind: "shared" } : { kind: "structural", channelInstanceId: r.ChannelId },
      fallbackAhtSec: +r.FallbackAhtSec, staffing,
    };
  });

  const services = [];
  const sById = new Map();
  for (const r of sheets.Services || []) {
    let s = sById.get(r.ServiceId);
    if (!s) {
      s = { id: r.ServiceId, name: r.ServiceName, activity: r.Activity, productRequest: r.ProductRequest, journey: [] };
      const aht = numOrUndef(r.ServiceAhtSec); if (aht !== undefined) s.ahtSec = aht;
      sById.set(s.id, s); services.push(s);
    }
    if (r.QueueId !== "" && r.QueueId != null && r.StepOrder !== "") {
      const step = { queueId: r.QueueId, splitPct: +r.SplitPct };
      const samp = numOrUndef(r.SamplingPct); if (samp !== undefined) step.samplingPct = samp;
      s.journey.push(step);
    }
  }

  const profiles = [];
  const pfById = new Map();
  for (const r of sheets["Channel volume profiles"] || []) {
    let pf = pfById.get(r.ProfileId);
    if (!pf) { pf = { id: r.ProfileId, appliesAt: { level: r.AppliesLevel, nodeId: r.AppliesNodeId }, totalVolume: +r.TotalVolume, mix: [] }; pfById.set(pf.id, pf); profiles.push(pf); }
    if (r.MixServiceId !== "" && r.MixServiceId != null) pf.mix.push({ serviceId: r.MixServiceId, pct: +r.MixPct });
  }

  return { model: { brands, queues, services, profiles }, report };
}

// Round-trip health check used by the import validation report.
export function validateRoundTrip(model) {
  const a = JSON.stringify(modelToSheets(model));
  const { model: m2 } = sheetsToModel(modelToSheets(model));
  const b = JSON.stringify(modelToSheets(m2));
  return { ok: a === b };
}
