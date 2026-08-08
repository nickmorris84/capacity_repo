// Capacity Simulator — owner / maintainer: nick_morris
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// model/domain.js
var require_domain = __commonJS({
  "model/domain.js"(exports, module) {
    function processesOf2(model, rt) {
      if (!rt) return [];
      if (Array.isArray(rt.processIds))
        return rt.processIds.map((id) => (model.processes || []).find((x) => x.id === id)).filter(Boolean);
      return rt.processes || [];
    }
    var LEVELS = ["brandId", "buId", "requestTypeId", "channelId"];
    var assignedBrands = (rt, model) => rt.brandIds && rt.brandIds.length ? rt.brandIds : (model.brands || []).map((b) => b.id);
    var assignedBUs = (rt, model) => rt.buIds && rt.buIds.length ? rt.buIds : (model.businessUnits || []).map((b) => b.id);
    function leaves(model) {
      const out = [];
      for (const rt of model.requestTypes || [])
        for (const brandId of assignedBrands(rt, model))
          for (const buId of assignedBUs(rt, model))
            for (const p of processesOf2(model, rt))
              out.push({ brandId, buId, requestTypeId: rt.id, channelId: p.channelId, rt, process: p });
      return out;
    }
    var keyOf2 = (a) => [a.brandId || "", a.buId || "", a.requestTypeId || "", a.channelId || ""].join("|");
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
        for (const p of processesOf2(model, rt)) {
          if (!chIds.has(p.channelId))
            errors.push({ kind: "dangling_channel", requestTypeId: rt.id, message: `Request type "${rt.name}" has a process on a missing channel.` });
          for (const s of p.steps || []) if (!qIds.has(s.queueId))
            errors.push({ kind: "dangling_queue", requestTypeId: rt.id, queueId: s.queueId, message: `A step of "${rt.name}" references a missing queue.` });
          if ((p.steps || []).length && !(p.steps || []).some((s) => s.terminal))
            errors.push({ kind: "endpoint_missing", requestTypeId: rt.id, channelId: p.channelId, message: `"${rt.name}" (${p.channelId}) has no terminal step \u2014 the process leads nowhere.` });
        }
      }
      const cover = /* @__PURE__ */ new Map();
      for (const l of leaves(model)) {
        const k = l.rt.groupId + "|" + l.brandId + "|" + l.buId + "|" + l.channelId;
        if (!cover.has(k)) cover.set(k, /* @__PURE__ */ new Set());
        cover.get(k).add(l.requestTypeId);
      }
      const nameOf2 = (id) => ((model.requestTypes || []).find((r) => r.id === id) || {}).name || id;
      for (const [k, rts] of cover) if (rts.size > 1) {
        const [groupId, brandId, buId, channelId] = k.split("|");
        const g = (model.processGroups || []).find((x) => x.id === groupId);
        warnings.push({
          kind: "double_cover",
          groupId,
          brandId,
          buId,
          channelId,
          requestTypeIds: [...rts],
          message: `${g ? g.name : groupId} appears handled twice for the same brand/BU/channel (${[...rts].map(nameOf2).join(" and ")}).`
        });
      }
      return { ok: errors.length === 0, errors, warnings };
    }
    var guard = (blockedBy) => ({ ok: blockedBy.length === 0, blockedBy });
    function canDeleteBrand2(model, id) {
      const b = [];
      for (const rt of model.requestTypes || []) if ((rt.brandIds || []).includes(id)) b.push({ kind: "requestType", id: rt.id });
      for (const q of model.queues || []) if (q.homeBrandId === id) b.push({ kind: "queue", id: q.id });
      for (const e of model.volumeEntries || []) if ((e.scope || {}).brandId === id) b.push({ kind: "volumeEntry", id: e.id });
      return guard(b);
    }
    function canDeleteBU2(model, id) {
      const b = [];
      for (const rt of model.requestTypes || []) if ((rt.buIds || []).includes(id)) b.push({ kind: "requestType", id: rt.id });
      for (const q of model.queues || []) if (q.homeBuId === id) b.push({ kind: "queue", id: q.id });
      for (const e of model.volumeEntries || []) if ((e.scope || {}).buId === id) b.push({ kind: "volumeEntry", id: e.id });
      return guard(b);
    }
    function canDeleteChannel2(model, id) {
      const b = [];
      for (const rt of model.requestTypes || []) if (processesOf2(model, rt).some((p) => p.channelId === id)) b.push({ kind: "requestType", id: rt.id });
      for (const pr of model.processes || []) if (pr.channelId === id) b.push({ kind: "process", id: pr.id });
      for (const e of model.volumeEntries || []) if ((e.scope || {}).channelId === id) b.push({ kind: "volumeEntry", id: e.id });
      return guard(b);
    }
    function canDeleteGroup2(model, id) {
      return guard((model.requestTypes || []).filter((rt) => rt.groupId === id).map((rt) => ({ kind: "requestType", id: rt.id })));
    }
    function canDeleteProduct2(model, id) {
      return guard((model.requestTypes || []).filter((rt) => rt.productId === id).map((rt) => ({ kind: "requestType", id: rt.id })));
    }
    function canDeleteQueue3(model, id) {
      const b = [];
      for (const rt of model.requestTypes || [])
        for (const p of processesOf2(model, rt))
          if ((p.steps || []).some((s) => s.queueId === id)) b.push({ kind: "requestType", id: rt.id, channelId: p.channelId });
      return guard(b);
    }
    function canDeleteRequestType2(model, id) {
      return guard((model.volumeEntries || []).filter((e) => (e.scope || {}).requestTypeId === id).map((e) => ({ kind: "volumeEntry", id: e.id })));
    }
    function queueUsage2(model, queueId) {
      let processes = 0;
      const brands = /* @__PURE__ */ new Set();
      for (const rt of model.requestTypes || [])
        for (const p of processesOf2(model, rt))
          if ((p.steps || []).some((s) => s.queueId === queueId)) {
            processes++;
            for (const b of assignedBrands(rt, model)) brands.add(b);
          }
      return { processes, brands: brands.size };
    }
    module.exports = {
      processesOf: processesOf2,
      LEVELS,
      keyOf: keyOf2,
      leaves,
      assignedBrands,
      assignedBUs,
      validateDomain,
      canDeleteBrand: canDeleteBrand2,
      canDeleteBU: canDeleteBU2,
      canDeleteChannel: canDeleteChannel2,
      canDeleteGroup: canDeleteGroup2,
      canDeleteProduct: canDeleteProduct2,
      canDeleteQueue: canDeleteQueue3,
      canDeleteRequestType: canDeleteRequestType2,
      queueUsage: queueUsage2
    };
  }
});

// model/cascade.js
var require_cascade = __commonJS({
  "model/cascade.js"(exports, module) {
    var { LEVELS, keyOf: keyOf2, leaves } = require_domain();
    function entryIndex(model) {
      const totals = /* @__PURE__ */ new Map(), shapes = /* @__PURE__ */ new Map();
      for (const e of model.volumeEntries || []) {
        const k = keyOf2(e.scope || {});
        let daily = e.daily != null ? +e.daily : null;
        if (Array.isArray(e.weekly) && e.weekly.length) {
          const sum = e.weekly.reduce((a, v) => a + (+v || 0), 0);
          if (daily == null) daily = sum / e.weekly.length / 7;
          const mean = sum / e.weekly.length;
          if (mean > 0 && !shapes.has(k)) shapes.set(k, e.weekly.map((v) => (+v || 0) / mean));
        }
        if (daily != null) totals.set(k, (totals.get(k) || 0) + daily);
      }
      return { totals, shapes };
    }
    function distribute(parentTotal, kids, notes, at) {
      const out = /* @__PURE__ */ new Map();
      const entered = kids.filter((k) => k.entered != null);
      const un = kids.filter((k) => k.entered == null);
      const s = entered.reduce((a, k) => a + k.entered, 0);
      if (parentTotal == null) {
        for (const k of kids) out.set(k.key, { total: k.entered, prov: k.entered != null ? "entered" : "none" });
        return { out, parentTotal: entered.length && un.length === 0 ? s : null, parentProv: "sum" };
      }
      if (!entered.length) {
        for (const k of kids) out.set(k.key, { total: parentTotal / kids.length, prov: "equal" });
        return { out };
      }
      if (!un.length || s > parentTotal + 1e-9) {
        const f = s > 0 ? parentTotal / s : 0;
        if (Math.abs(f - 1) > 1e-9) notes.push({ kind: "scaled", at, factor: f, message: `entries under ${at || "the estate"} scaled \xD7${f.toFixed(2)} to reconcile with the level above` });
        for (const k of entered) out.set(k.key, { total: k.entered * f, prov: Math.abs(f - 1) > 1e-9 ? "scaled" : "entered" });
        for (const k of un) out.set(k.key, { total: 0, prov: "equal" });
        return { out };
      }
      const r = (parentTotal - s) / un.length;
      for (const k of entered) out.set(k.key, { total: k.entered, prov: "entered" });
      for (const k of un) out.set(k.key, { total: r, prov: "equal" });
      return { out };
    }
    function resolveVolumes(model) {
      const L = leaves(model);
      const { totals: enteredMap, shapes } = entryIndex(model);
      const notes = [];
      const nodes = /* @__PURE__ */ new Map();
      function rec(prefix, li, subset, total, shape, parentProv) {
        if (li === LEVELS.length) {
          const n = nodes.get(keyOf2(prefix)) || { prov: "none" };
          const l = subset[0];
          return [{
            brandId: l.brandId,
            buId: l.buId,
            requestTypeId: l.requestTypeId,
            channelId: l.channelId,
            rt: l.rt,
            process: l.process,
            total: total != null ? total : 0,
            shape,
            provenance: n.prov
          }];
        }
        const lev = LEVELS[li];
        const idsHere = [...new Set(subset.map((x) => x[lev]))];
        const kids = idsHere.map((id) => {
          const p = { ...prefix, [lev]: id };
          const k = keyOf2(p);
          return { id, key: k, prefix: p, entered: enteredMap.has(k) ? enteredMap.get(k) : null };
        });
        const d = distribute(total, kids, notes, keyOf2(prefix).replace(/\|+$/, "") || null);
        if (total == null && d.parentTotal != null && !nodes.has(keyOf2(prefix)))
          nodes.set(keyOf2(prefix), { total: d.parentTotal, prov: d.parentProv });
        let acc = [];
        for (const kid of kids) {
          const r = d.out.get(kid.key);
          const prov = kids.length === 1 && kid.entered == null && parentProv ? parentProv : r.prov;
          nodes.set(kid.key, { total: r.total, prov });
          const kidShape = shapes.get(kid.key) || shape;
          acc = acc.concat(rec(kid.prefix, li + 1, subset.filter((x) => x[lev] === kid.id), r.total, kidShape, prov));
        }
        return acc;
      }
      const rootKey = keyOf2({});
      const rootTotal = enteredMap.has(rootKey) ? enteredMap.get(rootKey) : null;
      const resolved = L.length ? rec({}, 0, L, rootTotal, shapes.get(rootKey) || null, rootTotal != null ? "entered" : null) : [];
      for (let li = LEVELS.length - 1; li >= 0; li--) {
        const sums = /* @__PURE__ */ new Map();
        for (const l of resolved) {
          const p = {};
          for (let i = 0; i < li; i++) p[LEVELS[i]] = l[LEVELS[i]];
          const k = keyOf2(p);
          sums.set(k, (sums.get(k) || 0) + l.total);
        }
        for (const [k, t] of sums) if (!nodes.has(k) || nodes.get(k).total == null) nodes.set(k, { total: t, prov: "sum" });
      }
      const uncovered = [];
      for (const k of enteredMap.keys()) {
        if (k === rootKey) continue;
        if (!nodes.has(k))
          uncovered.push({ kind: "uncovered_volume", at: k, message: `A volume entry at ${k.replace(/\|/g, " \u203A ").trim()} matches no assigned request type/process \u2014 it is inert.` });
      }
      return { leaves: resolved, nodes, notes, uncovered };
    }
    module.exports = { resolveVolumes, entryIndex, distribute };
  }
});

// model/propagate.js
var require_propagate = __commonJS({
  "model/propagate.js"(exports, module) {
    var { resolveVolumes } = require_cascade();
    var { validateDomain, queueUsage: queueUsage2 } = require_domain();
    var WEEKS = 52;
    function propagateDomain2(model) {
      const { leaves, nodes, notes, uncovered } = resolveVolumes(model);
      const agg = /* @__PURE__ */ new Map();
      for (const leaf of leaves) {
        if (!(leaf.total > 0)) continue;
        const shape = leaf.shape;
        for (const step of leaf.process.steps || []) {
          const split = (step.splitPct != null ? step.splitPct : 100) / 100;
          const sampling = (step.samplingPct != null ? step.samplingPct : 100) / 100;
          const v = leaf.total * split * sampling;
          if (!(v > 0)) continue;
          const aht = leaf.rt.ahtSec != null ? leaf.rt.ahtSec : null;
          if (!agg.has(step.queueId)) agg.set(step.queueId, { volume: 0, minuteSum: 0, weekly: new Array(WEEKS).fill(0), byRequestType: [] });
          const a = agg.get(step.queueId);
          a.volume += v;
          a.byRequestType.push({ requestTypeId: leaf.requestTypeId, brandId: leaf.brandId, buId: leaf.buId, channelId: leaf.channelId, volume: v, aht, provenance: leaf.provenance });
          for (let w = 0; w < WEEKS; w++) a.weekly[w] += v * (shape ? shape[w] != null ? shape[w] : 1 : 1);
          a.minuteSum += 0;
        }
      }
      const queues = /* @__PURE__ */ new Map();
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
        const marker = distinct.size <= 1 ? contributing[0] && contributing[0].ahtSource === "rt" ? "svc" : "queue" : "weighted";
        queues.set(q.id, {
          queueId: q.id,
          name: q.name,
          type: q.type,
          volume: a.volume,
          effectiveAht,
          ahtMarker: marker,
          weekly: a.weekly,
          byRequestType: contributing.sort((x, y) => y.volume - x.volume),
          usage: queueUsage2(model, q.id)
        });
      }
      const validation = validateDomain(model);
      validation.warnings = validation.warnings.concat(uncovered);
      return { queues, leaves, nodes, notes, validation };
    }
    module.exports = { propagateDomain: propagateDomain2, WEEKS };
  }
});

// engine/engine.js
var require_engine = __commonJS({
  "engine/engine.js"(exports, module) {
    var clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    var sum = (a) => a.reduce((s, v) => s + v, 0);
    var norm = (a) => {
      const t = sum(a) || 1;
      return a.map((v) => v / t);
    };
    var uid = () => Math.random().toString(36).slice(2, 9);
    var DEFAULT_PROFILE = [
      0.35,
      0.55,
      0.85,
      1.1,
      1.35,
      1.45,
      1.4,
      1.25,
      1.05,
      0.9,
      0.85,
      0.95,
      1.15,
      1.3,
      1.25,
      1.1,
      0.95,
      0.8,
      0.7,
      0.6,
      0.45,
      0.35,
      0.25,
      0.2
    ];
    var _bCache = /* @__PURE__ */ new Map();
    function erlangB(N, A) {
      if (A <= 0) return 0;
      if (N <= 0) return 1;
      const key = N * 33554432 + Math.round(A * 20);
      const hit = _bCache.get(key);
      if (hit !== void 0) return hit;
      let invB = 1;
      for (let n = 1; n <= N; n++) invB = 1 + invB * n / A;
      const B = 1 / invB;
      if (_bCache.size < 4e5) _bCache.set(key, B);
      return B;
    }
    function erlangC(N, A) {
      if (A <= 0) return 0;
      if (N <= A) return 1;
      const B = erlangB(N, A);
      const rho = A / N;
      const den = 1 - rho * (1 - B);
      if (den <= 1e-12) return 1;
      return clamp(B / den, 0, 1);
    }
    var _vCache = /* @__PURE__ */ new Map();
    var _vpSub = null;
    var _vpAht = NaN;
    var _vpPat = NaN;
    var _vpTgt = NaN;
    function voiceRaw(N, A, aht, pat, target) {
      if (A <= 0) return { asa: 0, sl: 1, abandon: 0, occ: 0 };
      if (N < 1) return { asa: pat, sl: 0, abandon: 1, occ: 1 };
      if (aht !== _vpAht || pat !== _vpPat || target !== _vpTgt) {
        const pk = aht + "|" + pat + "|" + target;
        let sub = _vCache.get(pk);
        if (!sub) {
          sub = /* @__PURE__ */ new Map();
          _vCache.set(pk, sub);
        }
        _vpSub = sub;
        _vpAht = aht;
        _vpPat = pat;
        _vpTgt = target;
      }
      const key = N * 33554432 + Math.round(A * 20);
      const hit = _vpSub.get(key);
      if (hit) return hit;
      const gamma = 1 / pat;
      const probe = (ab2) => {
        const Aeff = A * (1 - ab2);
        if (Aeff >= N - 1e-9) return { resid: 1, C: 1, drain: 0, Aeff };
        const C = erlangC(N, Aeff);
        const drain = (N - Aeff) / aht;
        return { resid: C * gamma / (gamma + drain) - ab2, C, drain, Aeff };
      };
      let lo = 0, hi = 1;
      for (let k = 0; k < 24; k++) {
        const m = (lo + hi) / 2;
        if (probe(m).resid > 0) lo = m;
        else hi = m;
      }
      const ab = clamp((lo + hi) / 2, 0, 1);
      const e = probe(ab);
      const rate = e.drain + gamma;
      const asa = rate > 0 ? e.C / rate : pat;
      const sl = rate > 0 ? clamp(1 - e.C + e.C * (e.drain / rate) * (1 - Math.exp(-rate * target)), 0, 1) : 0;
      const out = { asa, sl, abandon: ab, occ: clamp(e.Aeff / N, 0, 1) };
      if (_vpSub.size < 3e5) _vpSub.set(key, out);
      return out;
    }
    function voiceInterval(agents, arrivals, intervalSec, aht, pat, target) {
      const A = arrivals / intervalSec * aht;
      const lo = Math.floor(agents), hi = Math.ceil(agents);
      if (lo === hi) return voiceRaw(lo, A, aht, pat, target);
      const f = agents - lo;
      const a = voiceRaw(lo, A, aht, pat, target), b = voiceRaw(hi, A, aht, pat, target);
      return {
        asa: a.asa * (1 - f) + b.asa * f,
        sl: a.sl * (1 - f) + b.sl * f,
        abandon: a.abandon * (1 - f) + b.abandon * f,
        occ: a.occ * (1 - f) + b.occ * f
      };
    }
    var _raCache = /* @__PURE__ */ new Map();
    var _raSub = null;
    var _raAht = NaN;
    var _raPat = NaN;
    var _raTgt = NaN;
    var _raAb = NaN;
    var _raOcc = NaN;
    function requiredAgentsInterval(arrivals, intervalSec, aht, pat, target, maxAband, occCeil) {
      if (arrivals <= 0) return 0;
      const A = arrivals / intervalSec * aht;
      if (aht !== _raAht || pat !== _raPat || target !== _raTgt || maxAband !== _raAb || occCeil !== _raOcc) {
        const pk = aht + "|" + pat + "|" + target + "|" + maxAband + "|" + occCeil;
        let sub = _raCache.get(pk);
        if (!sub) {
          sub = /* @__PURE__ */ new Map();
          _raCache.set(pk, sub);
        }
        _raSub = sub;
        _raAht = aht;
        _raPat = pat;
        _raTgt = target;
        _raAb = maxAband;
        _raOcc = occCeil;
      }
      const start = Math.max(1, Math.ceil(A));
      const key = Math.round(A * 20) * 1048576 + start;
      const memo = _raSub.get(key);
      if (memo !== void 0) return memo;
      let out = Math.ceil(A) + 400;
      for (let N = start; N <= Math.ceil(A) + 400; N++) {
        const r = voiceRaw(N, A, aht, pat, target);
        if (r.asa <= target && r.abandon <= maxAband && r.occ <= occCeil) {
          out = N;
          break;
        }
      }
      if (_raSub.size < 2e5) _raSub.set(key, out);
      return out;
    }
    var _rcCache = /* @__PURE__ */ new Map();
    var _profIds = /* @__PURE__ */ new WeakMap();
    var _profSeq = 0;
    function profileId(profile) {
      let id = _profIds.get(profile);
      if (id === void 0) {
        id = ++_profSeq;
        _profIds.set(profile, id);
      }
      return id;
    }
    function reqCurveVoice(q, volume, eng, cache) {
      const key = "v" + profileId(q.profile) + "|" + Math.round(volume) + "|" + q.aht + "|" + q.asaTarget + "|" + q.maxAbandon + "|" + q.patience + "|" + eng.occupancyCeiling + "|" + eng.intervalMin;
      const hit = _rcCache.get(key);
      if (hit) return hit;
      const p = norm(q.profile), iSec = eng.intervalMin * 60, iHrs = eng.intervalMin / 60;
      const agents = p.map(
        (share) => requiredAgentsInterval(volume * share, iSec, q.aht, q.patience, q.asaTarget, q.maxAbandon, eng.occupancyCeiling)
      );
      const out = { agents, hours: sum(agents) * iHrs };
      if (_rcCache.size < 1e5) _rcCache.set(key, out);
      return out;
    }
    function reqCurveDigitalCustomer(q, volume, eng, cache) {
      const conc = q.concurrency > 0 ? q.concurrency : 1;
      const pat = customerPatience(q), maxAb = customerMaxAbandon(q);
      const target = q.digitalSlaMinutes * 60;
      const key = "dc" + profileId(q.profile) + "|" + Math.round(volume) + "|" + q.aht + "|" + conc + "|" + q.digitalSlaMinutes + "|" + pat + "|" + maxAb + "|" + eng.occupancyCeiling + "|" + eng.intervalMin;
      const hit = _rcCache.get(key);
      if (hit) return hit;
      const p = norm(q.profile), iSec = eng.intervalMin * 60, iHrs = eng.intervalMin / 60;
      const agents = p.map((share) => {
        const nServers = requiredAgentsInterval(volume * share, iSec, q.aht, pat, target, maxAb, eng.occupancyCeiling);
        return nServers / conc;
      });
      const out = { agents, hours: sum(agents) * iHrs };
      if (_rcCache.size < 1e5) _rcCache.set(key, out);
      return out;
    }
    function reqCurveWorkflow(q, volume, eng, cache) {
      const key = "w" + profileId(q.profile) + "|" + Math.round(volume) + "|" + q.aht + "|" + eng.occupancyCeiling + "|" + eng.intervalMin;
      const hit = _rcCache.get(key);
      if (hit) return hit;
      const hours = volume * q.aht / 3600 / eng.occupancyCeiling;
      const n = q.profile.length, iHrs = eng.intervalMin / 60;
      const agents = new Array(n).fill(n > 0 ? hours / (n * iHrs) : 0);
      const out = { agents, hours };
      if (_rcCache.size < 1e5) _rcCache.set(key, out);
      return out;
    }
    var digitalSubtype = (q) => q.type === "digital" ? q.subtype === "workflow" ? "workflow" : "customer" : null;
    var CUSTOMER_PATIENCE_DEFAULT = 180;
    var CUSTOMER_MAXABANDON_DEFAULT = 0.05;
    var customerPatience = (q) => q.patience != null ? q.patience : CUSTOMER_PATIENCE_DEFAULT;
    var customerMaxAbandon = (q) => q.maxAbandon != null ? q.maxAbandon : CUSTOMER_MAXABANDON_DEFAULT;
    var reqCurve = (q, v, eng, cache) => q.type === "voice" ? reqCurveVoice(q, v, eng, cache) : q.subtype === "workflow" ? reqCurveWorkflow(q, v, eng, cache) : reqCurveDigitalCustomer(q, v, eng, cache);
    var _normCache = /* @__PURE__ */ new WeakMap();
    function normProfile(profile) {
      let n = _normCache.get(profile);
      if (!n) {
        n = norm(profile);
        _normCache.set(profile, n);
      }
      return n;
    }
    function runVoiceDay(q, volume, productiveHours, eng, rc, lite) {
      const iSec = eng.intervalMin * 60;
      const cover = rc.hours > 0 ? productiveHours / rc.hours : 1;
      const p = normProfile(q.profile);
      let tv = 0, wAsa = 0, wSl = 0, wAb = 0, occN = 0, occD = 0;
      const byInterval = lite ? null : [];
      for (let i = 0; i < p.length; i++) {
        const arrivals = volume * p[i];
        const agents = rc.agents[i] * cover;
        const r = voiceInterval(agents, arrivals, iSec, q.aht, q.patience, q.asaTarget);
        if (!lite) byInterval.push({ i, arrivals, agents, req: rc.agents[i], ...r });
        tv += arrivals;
        wAsa += r.asa * arrivals;
        wSl += r.sl * arrivals;
        wAb += r.abandon * arrivals;
        occN += r.occ * agents;
        occD += agents;
      }
      return {
        volume: tv,
        cover,
        asa: tv > 0 ? wAsa / tv : 0,
        sl: tv > 0 ? wSl / tv : 1,
        abandon: tv > 0 ? wAb / tv : 0,
        occ: occD > 0 ? occN / occD : 0,
        byInterval
      };
    }
    function runDigitalDay(q, volume, productiveHours, startBacklog, eng, rc, lite) {
      const iSec = eng.intervalMin * 60, iMin = eng.intervalMin, iHrs = eng.intervalMin / 60;
      const cover = rc.hours > 0 ? productiveHours / rc.hours : 1;
      const p = normProfile(q.profile);
      let B = startBacklog, tv = 0, inSla = 0, respW = 0, occN = 0, occD = 0;
      const byInterval = lite ? null : [];
      for (let i = 0; i < p.length; i++) {
        const arrivals = volume * p[i];
        const agents = rc.agents[i] * cover;
        const cap = agents * q.concurrency * iSec / q.aht;
        const rIn = arrivals / iMin, rOut = cap / iMin;
        let wStart, wEnd, Bend;
        if (rOut <= 1e-9) {
          Bend = B + arrivals;
          wStart = wEnd = iMin * 400;
        } else {
          Bend = Math.max(0, B + (rIn - rOut) * iMin);
          wStart = B / rOut;
          wEnd = Bend / rOut;
        }
        const served = Math.max(0, B + arrivals - Bend);
        const s = q.digitalSlaMinutes;
        const lo = Math.min(wStart, wEnd), hi = Math.max(wStart, wEnd);
        const frac = hi <= s ? 1 : lo >= s ? 0 : (s - lo) / Math.max(1e-9, hi - lo);
        inSla += arrivals * frac;
        respW += arrivals * ((wStart + wEnd) / 2);
        tv += arrivals;
        const occ = cap > 0 ? clamp(served / cap, 0, 1) : 1;
        occN += occ * agents;
        occD += agents;
        if (!lite) byInterval.push({ i, arrivals, agents, req: rc.agents[i], cap, served, backlog: Bend, resp: (wStart + wEnd) / 2, occ });
        B = Bend;
      }
      return {
        volume: tv,
        cover,
        sl: tv > 0 ? inSla / tv : 1,
        respMin: tv > 0 ? respW / tv : 0,
        endBacklog: B,
        occ: occD > 0 ? occN / occD : 0,
        byInterval
      };
    }
    function runDigitalCustomerDay(q, volume, productiveHours, eng, rc, lite) {
      const iSec = eng.intervalMin * 60;
      const cover = rc.hours > 0 ? productiveHours / rc.hours : 1;
      const p = normProfile(q.profile);
      const conc = q.concurrency > 0 ? q.concurrency : 1;
      const pat = customerPatience(q), target = q.digitalSlaMinutes * 60;
      let tv = 0, wAsa = 0, wSl = 0, wAb = 0, occN = 0, occD = 0;
      const byInterval = lite ? null : [];
      for (let i = 0; i < p.length; i++) {
        const arrivals = volume * p[i];
        const agents = rc.agents[i] * cover;
        const servers = agents * conc;
        const r = voiceInterval(servers, arrivals, iSec, q.aht, pat, target);
        if (!lite) byInterval.push({ i, arrivals, agents, servers, req: rc.agents[i], ...r });
        tv += arrivals;
        wAsa += r.asa * arrivals;
        wSl += r.sl * arrivals;
        wAb += r.abandon * arrivals;
        occN += r.occ * servers;
        occD += servers;
      }
      const asa = tv > 0 ? wAsa / tv : 0;
      return {
        volume: tv,
        cover,
        asa,
        sl: tv > 0 ? wSl / tv : 1,
        abandon: tv > 0 ? wAb / tv : 0,
        respMin: asa / 60,
        occ: occD > 0 ? occN / occD : 0,
        byInterval
      };
    }
    function runWorkflowDay(q, volume, productiveHours, startBacklog, eng, rc, lite) {
      const cap = q.aht > 0 ? productiveHours * 3600 / q.aht : 0;
      const cover = rc && rc.hours > 0 ? productiveHours / rc.hours : 1;
      const slaDays = (q.workflowSlaHours != null ? q.workflowSlaHours : 24) / 24;
      let wStart, wEnd, Bend;
      if (cap <= 1e-9) {
        Bend = startBacklog + volume;
        wStart = wEnd = 400;
      } else {
        Bend = Math.max(0, startBacklog + volume - cap);
        wStart = startBacklog / cap;
        wEnd = Bend / cap;
      }
      const served = Math.max(0, startBacklog + volume - Bend);
      const lo = Math.min(wStart, wEnd), hi = Math.max(wStart, wEnd);
      const frac = volume <= 0 ? 1 : hi <= slaDays ? 1 : lo >= slaDays ? 0 : (slaDays - lo) / Math.max(1e-9, hi - lo);
      const meanWaitDays = (wStart + wEnd) / 2;
      return {
        volume,
        cover,
        sl: clamp(frac, 0, 1),
        respMin: meanWaitDays * 24 * 60,
        respHours: meanWaitDays * 24,
        endBacklog: Bend,
        occ: cap > 0 ? clamp(served / cap, 0, 1) : 1,
        byInterval: null
      };
    }
    var hoursPerHeadDay = (q, eng) => eng.hoursPerFteDay * (eng.daysWorkedPerFte / eng.daysPerWeek) * (1 - clamp(q.shrinkage, 0, 0.95));
    function stretchCurve(curve, startProf, stretch) {
      const n = Math.max(1, Math.round(curve.length * stretch));
      const out = [];
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 1 : i / (n - 1);
        out.push(clamp(startProf + (1 - startProf) * t, 0.05, 1));
      }
      return out;
    }
    var blankAgg = () => ({
      volume: 0,
      baseVolume: 0,
      hours: 0,
      reqHours: 0,
      svcHours: 0,
      asaW: 0,
      slW: 0,
      abW: 0,
      occW: 0,
      occDen: 0,
      respW: 0,
      redial: 0,
      deflected: 0,
      backlog: 0,
      flexIn: 0,
      repeatAdd: 0,
      otHours: 0,
      reclaimedHours: 0,
      recycledIn: 0,
      poolIn: 0,
      leveragedIn: 0
    });
    var blankTot = () => ({
      volume: 0,
      cost: 0,
      trainCost: 0,
      waste: 0,
      churnCost: 0,
      churnCustomers: 0,
      paid: 0,
      reqFte: 0,
      svcHours: 0,
      trained: 0,
      inTraining: 0,
      ramping: 0,
      // Seeded so a §24.9 blank world (zero queues) still reports finite totals;
      // the queue loop adds onto these, so populated configs are unchanged.
      active: 0,
      otHours: 0,
      otCost: 0
    });
    var MONTH_DAYS = 30.44;
    var monthOfWeek = (w, startMonth) => (startMonth + Math.floor(w * 7 / MONTH_DAYS)) % 12;
    function parseISODate(s) {
      const [y, m, d] = String(s).split("-").map(Number);
      return Date.UTC(y, (m || 1) - 1, d || 1);
    }
    function monthForWeek(cfg, w) {
      const cal = settingsOf(cfg).calendar;
      if (cal && cal.weekOneDate) return new Date(parseISODate(cal.weekOneDate) + w * 7 * 864e5).getUTCMonth();
      return monthOfWeek(w, cfg.seasonality.startMonth);
    }
    function seasonalMult(w, cfg, q) {
      const m = monthForWeek(cfg, w);
      const sys = cfg.seasonality.system[m] ?? 1;
      const qm = (q.seasonal && q.seasonal[m]) ?? 1;
      return sys * qm;
    }
    function generateWeeklySeries(cfg, base, months, horizon) {
      const n = horizon != null ? horizon : resolveHorizon(cfg);
      const m12 = months && months.length === 12 ? months : new Array(12).fill(1);
      return Array.from({ length: n }, (_, w) => base * (m12[monthForWeek(cfg, w)] ?? 1));
    }
    var SEASONAL_PRESETS2 = {
      "Flat": [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      "Retail Christmas": [0.9, 0.85, 0.9, 0.95, 1, 1, 1, 1.05, 1.1, 1.15, 1.35, 1.5],
      "Summer lull": [1.05, 1.05, 1.05, 1, 0.95, 0.85, 0.8, 0.8, 0.95, 1.05, 1.1, 1.1],
      "FY-end Q4": [1.2, 1.25, 1.35, 0.95, 0.9, 0.95, 1, 1, 1, 1.05, 1.05, 1.1],
      "School-term": [1.1, 1.1, 1.05, 1.05, 1, 0.8, 0.75, 0.8, 1.15, 1.1, 1.05, 0.95]
    };
    var BUILTIN_STRATEGIES = [
      { id: "S1", name: "Meet requirement", baseType: "meet", builtin: true },
      { id: "S2", name: "Buffer above", baseType: "buffer", builtin: true },
      // §24.4: the default lives ON the strategy object (user-editable, 1–6).
      { id: "S3", name: "Forward backfill", baseType: "backfill", builtin: true, forwardMonths: 3 },
      { id: "S4", name: "Manual plan", baseType: "manual", builtin: true }
    ];
    function strategyById(cfg, id) {
      return (cfg && cfg.strategies || []).find((s) => s.id === id) || BUILTIN_STRATEGIES.find((s) => s.id === id) || null;
    }
    function strategyAt(cfg, idOrObj, w, seen) {
      const s = typeof idOrObj === "string" ? strategyById(cfg, idOrObj) : idOrObj;
      if (!s) return { id: String(idOrObj), name: String(idOrObj), baseType: "meet" };
      if (s.baseType !== "schedule") return s;
      seen = seen || /* @__PURE__ */ new Set();
      if (seen.has(s.id)) return { id: s.id, name: s.name, baseType: "meet" };
      seen.add(s.id);
      const segs = [...s.segments || []].sort((a, b) => (a.fromWeek || 1) - (b.fromWeek || 1));
      let pick = null;
      for (const seg of segs) if ((seg.fromWeek || 1) <= w + 1) pick = seg;
      if (!pick) pick = segs[0];
      if (!pick) return { id: s.id, name: s.name, baseType: "meet" };
      return strategyAt(cfg, pick.strategyId, w, seen);
    }
    function strategyAllManual(cfg, idOrObj) {
      const H2 = resolveHorizon(cfg);
      for (let w = 0; w < H2; w++) {
        if (strategyAt(cfg, idOrObj, w).baseType !== "manual") return false;
      }
      return true;
    }
    function effectiveSupports(cfg) {
      const map = {};
      for (const q of cfg.queues) {
        map[q.id] = (q.supports || []).map((s) => ({
          queueId: s.queueId,
          priority: s.priority != null ? s.priority : 1,
          maxSharePct: s.maxSharePct != null ? s.maxSharePct : null
        }));
      }
      for (const r of cfg.queues) {
        (r.crossSkill || []).forEach((donorId, i) => {
          const list = map[donorId];
          if (!list || list.some((s) => s.queueId === r.id)) return;
          list.push({ queueId: r.id, priority: i + 1, maxSharePct: 100 });
        });
      }
      return map;
    }
    function supportersOf(cfg, qid) {
      const map = effectiveSupports(cfg);
      const out = [];
      for (const q of cfg.queues) {
        for (const s of map[q.id]) if (s.queueId === qid) out.push({ queueId: q.id, priority: s.priority, maxSharePct: s.maxSharePct });
      }
      return out.sort((a, b) => a.priority - b.priority);
    }
    function resolveStartingHC(cfg) {
      const out = {};
      const blanks = [];
      let explicitSum = 0;
      for (const q of cfg.queues) {
        if (q.resourcing === "supported" || q.resourcing === "unmanned") {
          out[q.id] = 0;
          continue;
        }
        if (q.fte == null || q.fte === "") blanks.push(q);
        else {
          out[q.id] = q.fte;
          explicitSum += q.fte;
        }
      }
      if (blanks.length) {
        const g = cfg.engine.globalStartingHC;
        const pool = g != null ? Math.max(0, g - explicitSum) : 0;
        const wts = blanks.map((q) => q.dailyVolume * q.aht / Math.max(1e-9, q.concurrency || 1));
        const tot = sum(wts) || 1;
        blanks.forEach((q, i) => {
          out[q.id] = pool * (wts[i] / tot);
        });
      }
      return out;
    }
    var R2_DEFAULTS = {
      ot: { maxDailyHours: 2, weeklyCeiling: 10, premium: 1.5, burnoutLoad: 10 },
      training: { weeks: 4, learningCurve: [0.6, 0.75, 0.9, 1], shrinkagePct: 0.05 },
      trainingDebt: { accumRate: 20, recoveryRate: 10, maxAhtPenalty: 0.08, maxAttritionMult: 1.5 },
      // Channel knock-on defaults. null = fall through to the legacy loops values
      // (voice repeat ← loops.redial, digital spill ← loops.deflection) so
      // un-migrated configs reproduce their numbers exactly.
      knockOn: {
        voice: { repeatPct: null, spillPct: 0, spillTargetQueue: null },
        digital: { repeatPct: 0, spillPct: null, spillTargetQueue: null },
        support: { repeatPct: 0, spillPct: 0, spillTargetQueue: null }
      },
      // §24.6/§24.10 calendar anchor: week 1 of the horizon corresponds to this
      // ISO date ("YYYY-MM-DD"). null = legacy behaviour (seasonality.startMonth).
      calendar: { weekOneDate: null },
      // §20a risk thresholds (amber/red bands). The engine only SHIPS these; risk
      // scoring against them happens at render time in the UI.
      risk: {
        slaBreachRun: { amber: 2, red: 4 },
        tippingMargin: { amber: 2, red: 0 },
        burnout: { amber: 60, red: 85 },
        trainingDebt: { amber: 40, red: 70 },
        otStreakWeeks: { amber: 4, red: 8 },
        borrowedShare: { amber: 0.25, red: 0.5 },
        unmannedStarvation: { floorCover: 0.5, weeks: 4 },
        knockOnShare: { amber: 0.2, red: 0.35 },
        overCapacityPct: { amber: 0.1, red: 0.2 }
      },
      horizon: { min: 24, max: 78, default: 52 }
    };
    function mergeDeep(base, over) {
      if (over == null) return base;
      const out = Array.isArray(base) ? [...base] : { ...base };
      for (const k of Object.keys(over)) {
        const b = base ? base[k] : void 0, o = over[k];
        out[k] = o != null && typeof o === "object" && !Array.isArray(o) && b != null && typeof b === "object" && !Array.isArray(b) ? mergeDeep(b, o) : o === void 0 ? b : o;
      }
      return out;
    }
    var _settingsCache = /* @__PURE__ */ new WeakMap();
    function settingsOf(cfg) {
      const hit = _settingsCache.get(cfg);
      if (hit && hit.src === cfg.settings) return hit.val;
      const val = mergeDeep(R2_DEFAULTS, cfg.settings || null);
      _settingsCache.set(cfg, { src: cfg.settings, val });
      return val;
    }
    function resolveHorizon(cfg) {
      const s = settingsOf(cfg).horizon;
      const w = Math.round(cfg.engine.horizonWeeks || s.default);
      return clamp(w, s.min, s.max);
    }
    var channelOf = (q) => q.channel || (q.type === "voice" ? "voice" : "digital");
    var brandFor = (cfg, q) => (cfg.brands || []).find((b) => b.id === q.brandId) || null;
    var channelTemplate = (cfg, q) => (cfg.channels || {})[channelOf(q)] || null;
    function resolveTraining(cfg, q) {
      const b = brandFor(cfg, q);
      const bt = b && b.training ? b.training : null;
      const s = settingsOf(cfg).training;
      const wf = q.wf || {};
      return {
        trainingWeeks: wf.trainingWeeks != null ? wf.trainingWeeks : bt && bt.trainingWeeks != null ? bt.trainingWeeks : s.weeks,
        learningCurve: wf.learningCurve != null ? wf.learningCurve : bt && bt.learningCurve != null ? bt.learningCurve : s.learningCurve,
        trainingShrinkagePct: wf.trainingShrinkagePct != null ? wf.trainingShrinkagePct : bt && bt.trainingShrinkagePct != null ? bt.trainingShrinkagePct : s.shrinkagePct
      };
    }
    function primaryVoiceQueue(cfg, brandId) {
      const voice = cfg.queues.filter((q) => channelOf(q) === "voice");
      return voice.find((q) => q.brandId === brandId) || voice[0] || null;
    }
    function resolveKnockOn(cfg, q) {
      if (q.knock) {
        const k = q.knock;
        const target = k.convertTarget !== void 0 ? k.convertTarget : (primaryVoiceQueue(cfg, q.brandId) || {}).id || null;
        return {
          repeatPct: k.repeatPct != null ? k.repeatPct : 0,
          spillPct: k.convertPct != null ? k.convertPct : 0,
          spillTargetQueue: target
        };
      }
      const ch = channelOf(q);
      const tpl = channelTemplate(cfg, q);
      const sd = settingsOf(cfg).knockOn[ch] || {};
      const tk = tpl && tpl.knockOn || {};
      const pick = (qv, tv, sv, legacy) => qv != null ? qv : tv != null ? tv : sv != null ? sv : legacy;
      return {
        repeatPct: pick(q.repeatPct, tk.repeatPct, sd.repeatPct, ch === "voice" ? cfg.loops.redial : 0),
        spillPct: pick(q.spillPct, tk.spillPct, sd.spillPct, ch === "digital" ? cfg.loops.deflection : 0),
        spillTargetQueue: pick(q.spillTargetQueue, tk.spillTargetQueue, sd.spillTargetQueue, q.deflectsTo || null)
      };
    }
    function blendedAht(q, shares) {
      const segs = q.volumeProfile && q.volumeProfile.segments;
      if (!segs || !segs.length) return q.aht;
      const sh = shares || segs.map((s) => s.sharePct);
      const tot = sum(sh) || 1;
      let aht = 0;
      for (let i = 0; i < segs.length; i++) aht += sh[i] / tot * segs[i].aht;
      return aht;
    }
    function unifiedHits(s, q, cfg) {
      const sc = s.scope;
      if (!sc || sc === "all" || sc.kind === "all") return s.queueIds === "all" || s.queueIds == null || Array.isArray(s.queueIds) && s.queueIds.includes(q.id);
      if (sc.kind === "template") return channelOf(q) === sc.channel;
      if (sc.kind === "brand") return q.brandId === sc.brandId;
      if (sc.kind === "queues") return (sc.queueIds || []).includes(q.id);
      return false;
    }
    function seriesValueAt(s, week, day, cfg) {
      const ser = s.p && s.p.series;
      if (!ser) return void 0;
      let key;
      if (s.granularity === "day") key = week * cfg.engine.daysPerWeek + day;
      else if (s.granularity === "month") key = monthForWeek(cfg, week);
      else key = week;
      const v = ser[key] != null ? ser[key] : ser[String(key)];
      return v;
    }
    function scenarioFor(week, day, q, cfg, activeIds) {
      const out = { volMult: 1, attritionAdd: 0, freeze: false, ahtMult: 1, slaMult: 1, repeatAdd: 0, training: null, profileShares: null, forcedReclaim: 0, headcountStep: 0, tags: null };
      let growthMult = 1, manualG = null;
      for (const s of cfg.scenarios) {
        if (!activeIds.has(s.id)) continue;
        const hits = s.type === "unified" ? unifiedHits(s, q, cfg) : s.queueIds === "all" || (s.queueIds || []).includes(q.id);
        const opWide = s.type === "hiringFreeze" || s.type === "attritionShock" || s.type === "reducedTraining" || s.type === "freezeManual";
        if (!hits && !opWide) continue;
        const w = week - (s.startWeek || 0);
        if (w < 0) continue;
        if (s.type === "unified") {
          const stop = s.stopWeek;
          const inWindow = stop == null || week < stop;
          const mech = s.mechanism || "step";
          const p = s.p || {};
          let v;
          if (mech === "step") v = inWindow ? p.value : void 0;
          else if (mech === "growthRate") {
            const wEff = stop != null ? Math.max(0, Math.min(w, stop - (s.startWeek || 0))) : w;
            v = Math.pow(1 + (p.rate || 0), wEff / 4.345) - 1;
          } else if (mech === "manualSeries") v = seriesValueAt(s, week, day, cfg);
          if (out.tags === null) out.tags = [];
          if (out.tags.indexOf(s.tag || "custom") < 0) out.tags.push(s.tag || "custom");
          const param = s.parameter;
          if (param === "volume") {
            if (mech === "growthRate") growthMult *= 1 + (v || 0);
            else if (mech === "manualSeries" && v != null && p.overrideGrowth) manualG = (manualG == null ? 1 : manualG) * (1 + v);
            else if (v != null) out.volMult *= 1 + v;
          } else if (param === "aht") {
            if (v != null) out.ahtMult *= 1 + v;
          } else if (param === "sla") {
            if (v != null) out.slaMult *= 1 + v;
          } else if (param === "profileShares") {
            if (mech === "manualSeries") {
              if (v != null) out.profileShares = v;
            } else if (inWindow && p.shares) out.profileShares = p.shares;
          } else if (param === "people") {
            const sub = p.kind;
            if (sub === "attritionDelta") {
              if (v != null) out.attritionAdd += v;
            } else if (sub === "hiringFreeze") {
              if (mech === "manualSeries") {
                if (seriesValueAt(s, week, day, cfg)) out.freeze = true;
              } else if (inWindow) out.freeze = true;
            } else if (sub === "trainingShrinkage") {
              if (v != null && inWindow) out.forcedReclaim = Math.max(out.forcedReclaim, v);
            } else if (sub === "headcountStep") {
              if (week === (s.startWeek || 0)) out.headcountStep += p.value || 0;
            } else if (sub === "trainingProgramme") {
              out.training = p.programme;
              out.ahtMult *= 1 + (p.programme.ahtPenalty || 0);
              out.repeatAdd += p.programme.repeatUplift || 0;
            }
          }
          continue;
        }
        if (out.tags === null) out.tags = [];
        if (out.tags.indexOf(s.type) < 0) out.tags.push(s.type);
        if (s.type === "growth") {
          const wEff = s.p.stopWeek != null ? Math.max(0, Math.min(w, s.p.stopWeek - s.startWeek)) : w;
          growthMult *= Math.pow(1 + s.p.rate, wEff / 4.345);
        } else if (s.type === "growthManual") {
          const v = s.p && s.p.weeklyPct ? s.p.weeklyPct[week] != null ? s.p.weeklyPct[week] : s.p.weeklyPct[String(week)] : void 0;
          if (v != null) manualG = (manualG == null ? 1 : manualG) * (1 + v);
        } else if (s.type === "freezeManual") {
          if ((s.p.weeks || []).includes(week)) out.freeze = true;
        } else if (s.type === "launch") {
          const { ramp, peak, decay } = s.p;
          let m = 0;
          if (w < ramp) m = peak * ((w + 1) / ramp);
          else if (w < ramp + decay) m = peak * (1 - (w - ramp) / decay);
          out.volMult *= 1 + Math.max(0, m);
        } else if (s.type === "p1") {
          if (week === s.startWeek && day < s.p.days) out.volMult *= 1 + s.p.spike;
        } else if (s.type === "forecastError") out.volMult *= 1 + s.p.error;
        else if (s.type === "attritionShock") out.attritionAdd += s.p.add;
        else if (s.type === "hiringFreeze") {
          if (w < s.p.weeks) out.freeze = true;
        } else if (s.type === "reducedTraining") {
          out.training = s.p;
          out.ahtMult *= 1 + s.p.ahtPenalty;
          out.repeatAdd += s.p.repeatUplift;
        }
      }
      out.volMult *= manualG != null ? manualG : growthMult;
      return out;
    }
    function brandShareVolume(cfg, q, week) {
      const b = brandFor(cfg, q);
      if (!b) return 0;
      const bVol = b.weeklyVolumes && b.weeklyVolumes[week] != null ? b.weeklyVolumes[week] : b.dailyVolume;
      if (bVol == null) return 0;
      let tot = 0;
      for (const x of cfg.queues) {
        if (x.brandId === q.brandId && x.dailyVolume == null && !(x.weeklyVolumes && x.weeklyVolumes[week] != null) && x.volumeShare != null) tot += x.volumeShare;
      }
      if (tot <= 0) return 0;
      return bVol * ((q.volumeShare || 0) / tot);
    }
    function exogenousVolume(q, week, day, cfg, activeIds, sc) {
      const base = q.weeklyVolumes && q.weeklyVolumes[week] != null ? q.weeklyVolumes[week] : q.dailyVolume != null ? q.dailyVolume : brandShareVolume(cfg, q, week);
      return base * seasonalMult(week, cfg, q) * (sc || scenarioFor(week, day, q, cfg, activeIds)).volMult;
    }
    function projectSupply(state, q, ahead, wkAttr) {
      let trained = state.trained;
      let ramp = state.ramp.map((c) => ({ ...c }));
      let training = state.training.map((c) => ({ ...c }));
      let pipe = state.pipeline.map((c) => ({ ...c }));
      const curve = state.lastCurve || q.wf.learningCurve;
      for (let k = 0; k < ahead; k++) {
        pipe.forEach((c) => c.left -= 1);
        const started = pipe.filter((c) => c.left <= 0);
        pipe = pipe.filter((c) => c.left > 0);
        started.forEach((c) => training.push({ heads: c.heads, left: c.trainWeeks }));
        training.forEach((c) => c.left -= 1);
        const grad = training.filter((c) => c.left <= 0);
        training = training.filter((c) => c.left > 0);
        grad.forEach((c) => ramp.push({ heads: c.heads, age: 0 }));
        ramp.forEach((c) => c.age += 1);
        const done = ramp.filter((c) => c.age >= curve.length);
        ramp = ramp.filter((c) => c.age < curve.length);
        done.forEach((c) => trained += c.heads);
        const pool = trained + sum(ramp.map((c) => c.heads));
        const leavers = pool * wkAttr;
        const tShare = pool > 0 ? trained / pool : 1;
        trained = Math.max(0, trained - leavers * tShare);
        ramp.forEach((c) => c.heads *= 1 - wkAttr);
      }
      const effective = trained + sum(ramp.map((c) => c.heads * (curve[c.age] ?? 1)));
      const heads = trained + sum(ramp.map((c) => c.heads));
      return { effective, heads, leaversNext: (trained + sum(ramp.map((c) => c.heads))) * wkAttr };
    }
    function decideHiring(cfg, st, w, activeIds, strategy, reqFteAt) {
      const sObj = strategyAt(cfg, strategy, w);
      const excluded = new Set(sObj.excludedQueueIds || []);
      const wants = [];
      for (const q of cfg.queues) {
        if (q.resourcing === "supported" || q.resourcing === "unmanned") continue;
        if (excluded.has(q.id)) continue;
        const s = st[q.id];
        const sc = scenarioFor(w, 0, q, cfg, activeIds);
        if (sc.freeze) continue;
        const tr = resolveTraining(cfg, q);
        const lead = q.wf.reqToStart + (sc.training ? Math.max(1, tr.trainingWeeks - (sc.training.cutWeeks || 0)) : tr.trainingWeeks);
        const L = w + lead;
        const wkAttr = clamp(q.wf.attrition * (1 + q.wf.attritionGrowth * (w / 4.345)) + sc.attritionAdd, 0, 0.6) / 4.345;
        const proj = projectSupply(s, q, lead, wkAttr);
        let want = 0;
        if (sObj.baseType === "manual") {
          want = (q.wf.hires || []).filter((h) => h.week === w).reduce((a, b) => a + b.heads, 0);
        } else if (sObj.baseType === "backfill") {
          const fm = sObj.forwardMonths;
          if (fm != null) {
            const ahead = Math.max(1, Math.round(clamp(fm, 1, 6) * (52 / 12)));
            want = projectSupply(s, q, ahead, wkAttr).leaversNext * 1;
          } else {
            want = proj.leaversNext * 1;
          }
        } else {
          const buf = sObj.baseType === "buffer" ? sObj.bufferPct != null ? sObj.bufferPct : cfg.hiring.buffer : 0;
          const target = reqFteAt(q, L) * (1 + buf);
          want = Math.max(0, target - proj.effective);
        }
        if (want <= 1e-6) continue;
        const rq = Math.max(0.5, reqFteAt(q, L));
        const churnProb = q.type === "voice" ? cfg.cx.churnAbandon : cfg.cx.churnDigital;
        const marginal = exogenousVolume(q, Math.min(L, resolveHorizon(cfg) - 1), 0, cfg, activeIds) * 7 * churnProb * cfg.cx.costPerLostCustomer / rq;
        let breachWk = resolveHorizon(cfg);
        for (let f = w; f < Math.min(w + lead + 8, resolveHorizon(cfg)); f++) {
          const p = projectSupply(s, q, f - w, wkAttr);
          if (p.effective < reqFteAt(q, f) * 0.999) {
            breachWk = f;
            break;
          }
        }
        wants.push({ q, want, marginal, breachWk });
      }
      wants.sort((a, b) => b.marginal - a.marginal || a.breachWk - b.breachWk);
      const totalWant = sum(wants.map((x) => x.want));
      const caps = cfg.hiring.caps || null;
      const hasSeg = !!(caps && caps.segments && Object.keys(caps.segments).length);
      const hasBrand = !!(caps && caps.brands && Object.keys(caps.brands).length);
      if (sObj.baseType !== "manual" && (hasSeg || hasBrand)) {
        const brandName = (id) => ((cfg.brands || []).find((b) => b.id === id) || { name: String(id) }).name;
        const segKey = (q) => (q.brandId || "") + "|" + channelOf(q);
        const segCap = (q) => {
          const v = caps.segments ? caps.segments[segKey(q)] : null;
          return v != null ? v : Infinity;
        };
        const segLeft = {};
        const granted = [];
        const boundBy = [];
        for (const x of wants) {
          const k = segKey(x.q);
          if (segLeft[k] == null) segLeft[k] = segCap(x.q);
          const give = Math.min(segLeft[k], x.want);
          segLeft[k] -= give;
          granted.push({ x, give });
          if (give < x.want - 1e-6) {
            const label = brandName(x.q.brandId) + " \xD7 " + channelOf(x.q) + " cap";
            if (!boundBy.includes(label)) boundBy.push(label);
          }
        }
        if (hasBrand) {
          for (const bid of Object.keys(caps.brands)) {
            const ceil = caps.brands[bid];
            if (ceil == null) continue;
            let tot = granted.reduce((a, g) => a + ((g.x.q.brandId || "") === bid ? g.give : 0), 0);
            if (tot <= ceil + 1e-9) continue;
            boundBy.push(brandName(bid) + " ceiling");
            for (let i = granted.length - 1; i >= 0 && tot > ceil + 1e-9; i--) {
              const g = granted[i];
              if ((g.x.q.brandId || "") !== bid || g.give <= 1e-9) continue;
              const cut = Math.min(g.give, tot - ceil);
              g.give -= cut;
              tot -= cut;
            }
          }
        }
        if (caps.total != null) {
          let tot = granted.reduce((a, g) => a + g.give, 0);
          if (tot > caps.total + 1e-9) {
            boundBy.push("Total");
            for (let i = granted.length - 1; i >= 0 && tot > caps.total + 1e-9; i--) {
              const g = granted[i];
              if (g.give <= 1e-9) continue;
              const cut = Math.min(g.give, tot - caps.total);
              g.give -= cut;
              tot -= cut;
            }
          }
        }
        const grants2 = {}, denied2 = {};
        for (const g of granted) {
          if (g.give > 1e-6) grants2[g.x.q.id] = g.give;
          if (g.x.want - g.give > 1e-6) denied2[g.x.q.id] = g.x.want - g.give;
        }
        return {
          grants: grants2,
          trace: {
            week: w,
            cap: caps.total != null ? caps.total : null,
            want: totalWant,
            grants: Object.fromEntries(Object.entries(grants2).map(([k, v]) => [k, +v.toFixed(2)])),
            denied: Object.fromEntries(Object.entries(denied2).map(([k, v]) => [k, +v.toFixed(2)])),
            binding: boundBy.length > 0,
            order: wants.map((x) => x.q.id),
            boundBy
          }
        };
      }
      const cap = sObj.baseType === "manual" ? Infinity : caps && caps.total != null ? caps.total : cfg.hiring.cap;
      let left = cap;
      const grants = {}, denied = {};
      for (const x of wants) {
        const give = Math.min(left, x.want);
        if (give > 1e-6) grants[x.q.id] = give;
        if (x.want - give > 1e-6) denied[x.q.id] = x.want - give;
        left -= give;
      }
      return {
        grants,
        trace: {
          week: w,
          cap: cap === Infinity ? null : cap,
          want: totalWant,
          grants: Object.fromEntries(Object.entries(grants).map(([k, v]) => [k, +v.toFixed(2)])),
          denied: Object.fromEntries(Object.entries(denied).map(([k, v]) => [k, +v.toFixed(2)])),
          binding: Number.isFinite(cap) && totalWant > cap + 1e-6,
          order: wants.map((x) => x.q.id),
          boundBy: Number.isFinite(cap) && totalWant > cap + 1e-6 ? ["Total"] : []
        }
      };
    }
    function simulate3(cfg, opts = {}) {
      const eng = cfg.engine;
      const set = settingsOf(cfg);
      const H2 = resolveHorizon(cfg);
      const strategy = opts.strategy || cfg.hiring.activeStrategy || "S1";
      const activeIds = new Set(opts.viewIds != null ? opts.viewIds : cfg.scenarios.filter((s) => s.enabled).map((s) => s.id));
      const rcCache = /* @__PURE__ */ new Map();
      const reqFteCache = /* @__PURE__ */ new Map();
      const reqFteAt = (q, wk) => {
        const w2 = Math.min(wk, H2 - 1);
        const key = q.id + "|" + w2;
        if (reqFteCache.has(key)) return reqFteCache.get(key);
        const vol = exogenousVolume(q, w2, 0, cfg, activeIds);
        const bAht = blendedAht(q, null);
        const rq = bAht !== q.aht ? { ...q, aht: bAht } : q;
        const hrs = reqCurve(rq, vol, eng, rcCache).hours;
        const fte = hrs / Math.max(0.01, hoursPerHeadDay(q, eng));
        reqFteCache.set(key, fte);
        return fte;
      };
      const startHC = resolveStartingHC(cfg);
      const supportsMap = effectiveSupports(cfg);
      const knMap = {};
      for (const q of cfg.queues) knMap[q.id] = resolveKnockOn(cfg, q);
      const st = {};
      for (const q of cfg.queues) {
        st[q.id] = {
          trained: startHC[q.id],
          ramp: [],
          training: [],
          pipeline: [],
          burnout: 0,
          backlog: 0,
          deflectIn: 0,
          repeatNext: 0,
          cumChurn: 0,
          lastCurve: resolveTraining(cfg, q).learningCurve,
          trainingDebt: 0,
          otStreak: 0
        };
      }
      const weeks = [], allocTrace = [];
      const svcUsed = {};
      const isReceiver = (q) => channelOf(q) === "support" || q.resourcing === "unmanned" || q.resourcing === "supported";
      const isAutoDonor = (q) => q.resourcing === "leveraged";
      for (let w = 0; w < H2; w++) {
        for (const q of cfg.queues) {
          const s = st[q.id];
          const sc = scenarioFor(w, 0, q, cfg, activeIds);
          const tr = resolveTraining(cfg, q);
          const curve = sc.training ? stretchCurve(tr.learningCurve, sc.training.startProficiency, sc.training.stretch) : tr.learningCurve;
          if (sc.headcountStep) s.trained = Math.max(0, s.trained + sc.headcountStep);
          s.pipeline.forEach((c) => c.left -= 1);
          const started = s.pipeline.filter((c) => c.left <= 0);
          s.pipeline = s.pipeline.filter((c) => c.left > 0);
          started.forEach((c) => s.training.push({ heads: c.heads, left: c.trainWeeks }));
          s.training.forEach((c) => c.left -= 1);
          const graduated = s.training.filter((c) => c.left <= 0);
          s.training = s.training.filter((c) => c.left > 0);
          graduated.forEach((c) => s.ramp.push({ heads: c.heads, age: 0 }));
          s.ramp.forEach((c) => c.age += 1);
          const done = s.ramp.filter((c) => c.age >= curve.length);
          s.ramp = s.ramp.filter((c) => c.age < curve.length);
          done.forEach((c) => s.trained += c.heads);
          const bMult = 1 + s.burnout / 100 * (q.burn.maxAttritionMult - 1);
          const dMult = 1 + s.trainingDebt / 100 * (set.trainingDebt.maxAttritionMult - 1);
          const monthly = q.wf.attrition * (1 + q.wf.attritionGrowth * (w / 4.345)) + sc.attritionAdd;
          const wk2 = clamp(monthly, 0, 0.6) / 4.345 * bMult * dMult;
          const pool = s.trained + sum(s.ramp.map((c) => c.heads));
          const leavers = pool * wk2;
          const tShare = pool > 0 ? s.trained / pool : 1;
          s.trained = Math.max(0, s.trained - leavers * tShare);
          s.ramp.forEach((c) => c.heads *= 1 - wk2);
          s.lastLeavers = leavers;
          s.lastCurve = curve;
          s.wkAttr = wk2;
          const heads = s.trained + sum(s.ramp.map((c) => c.heads));
          s.otWeeklyCap = Math.min(set.ot.maxDailyHours * eng.daysWorkedPerFte, set.ot.weeklyCeiling) * heads;
          s.otLeft = s.otWeeklyCap;
          s.otHeads = heads;
          s.reclaimShrink = Math.min(tr.trainingShrinkagePct, q.shrinkage || 0);
        }
        const { grants, trace } = decideHiring(cfg, st, w, activeIds, strategy, reqFteAt);
        allocTrace.push(trace);
        for (const q of cfg.queues) {
          const g = grants[q.id] || 0;
          if (g > 0) {
            const sc = scenarioFor(w, 0, q, cfg, activeIds);
            const tr = resolveTraining(cfg, q);
            const tw = sc.training ? Math.max(1, tr.trainingWeeks - (sc.training.cutWeeks || 0)) : tr.trainingWeeks;
            st[q.id].pipeline.push({ heads: g, left: q.wf.reqToStart, trainWeeks: tw });
          }
          st[q.id].lastReqs = g;
        }
        const agg = {};
        for (const q of cfg.queues) agg[q.id] = blankAgg();
        for (const t of cfg.serviceTeams) svcUsed[t.id] = 0;
        let firstDayIntraday = null;
        const dayTrace = [];
        for (let d = 0; d < eng.daysPerWeek; d++) {
          const hrs = {}, req = {}, vol = {}, rc = {}, exo = {}, scq = {};
          for (const q of cfg.queues) {
            const s = st[q.id];
            const sc = scenarioFor(w, d, q, cfg, activeIds);
            scq[q.id] = sc;
            let prof2 = s.trained;
            for (let i = 0; i < s.ramp.length; i++) prof2 += s.ramp[i].heads * (s.lastCurve[s.ramp[i].age] ?? 1);
            const absence = s.burnout / 100 * q.burn.absenceUplift;
            s.dayProf = prof2;
            hrs[q.id] = prof2 * eng.hoursPerFteDay * (eng.daysWorkedPerFte / eng.daysPerWeek) * clamp(1 - q.shrinkage - absence, 0.02, 1);
            exo[q.id] = exogenousVolume(q, w, d, cfg, activeIds, sc);
            vol[q.id] = exo[q.id] + s.deflectIn + s.repeatNext;
            s.deflectIn = 0;
            s.repeatNext = 0;
          }
          for (const q of cfg.queues) {
            const s = st[q.id], sc = scq[q.id];
            const debtAht = 1 + s.trainingDebt / 100 * set.trainingDebt.maxAhtPenalty;
            const effAht = blendedAht(q, sc.profileShares) * sc.ahtMult * debtAht;
            const slaM = sc.slaMult;
            const eq = effAht !== q.aht || slaM !== 1 ? {
              ...q,
              aht: effAht,
              asaTarget: q.asaTarget * slaM,
              digitalSlaMinutes: q.digitalSlaMinutes * slaM,
              // §24.5: the workflow SLA window shifts with sla scenarios too.
              ...q.subtype === "workflow" ? { workflowSlaHours: (q.workflowSlaHours != null ? q.workflowSlaHours : 24) * slaM } : null
            } : q;
            rc[q.id] = reqCurve(eq, vol[q.id], eng, rcCache);
            req[q.id] = rc[q.id].hours;
            s.eq = eq;
            if (d === 0) {
              s.wkAht = effAht;
              s.wkSla = q.type === "voice" ? eq.asaTarget : q.subtype === "workflow" ? eq.workflowSlaHours != null ? eq.workflowSlaHours : 24 : eq.digitalSlaMinutes;
              s.wkSlaMult = slaM;
              s.wkTags = sc.tags;
            }
          }
          for (const q of cfg.queues) {
            const s = st[q.id], sc = scq[q.id];
            const a = agg[q.id];
            let deficit2 = Math.max(0, req[q.id] - hrs[q.id]);
            if (deficit2 > 1e-9 && s.otLeft > 1e-9 && s.otHeads > 1e-9) {
              const ot = Math.min(deficit2, set.ot.maxDailyHours * s.otHeads, s.otLeft);
              hrs[q.id] += ot;
              s.otLeft -= ot;
              a.otHours += ot;
              deficit2 -= ot;
            }
            const reclaimCapDay = s.reclaimShrink * s.dayProf * eng.hoursPerFteDay * (eng.daysWorkedPerFte / eng.daysPerWeek);
            s.reclaimLeftDay = reclaimCapDay;
            if (reclaimCapDay > 1e-9) {
              const forced = (sc.forcedReclaim || 0) * reclaimCapDay;
              const wanted = Math.max(forced, Math.min(deficit2, reclaimCapDay));
              if (wanted > 1e-9) {
                hrs[q.id] += wanted;
                a.reclaimedHours += wanted;
                s.reclaimLeftDay = reclaimCapDay - wanted;
              }
            }
            s.reclaimCapDay = reclaimCapDay;
          }
          const spare = {}, deficit = {};
          for (const q of cfg.queues) {
            spare[q.id] = Math.max(0, hrs[q.id] - req[q.id]);
            deficit[q.id] = Math.max(0, req[q.id] - hrs[q.id]);
          }
          const prof = eng.crossSkillProficiency;
          for (const donor of cfg.queues) {
            const outs = supportsMap[donor.id] || [];
            if (!outs.length || spare[donor.id] <= 1e-9) continue;
            const S0 = spare[donor.id];
            const tiers = [...new Set(outs.map((o) => o.priority))].sort((a, b) => a - b);
            for (const tier of tiers) {
              if (spare[donor.id] <= 1e-9) break;
              const rec = outs.filter((o) => o.priority === tier && st[o.queueId] && deficit[o.queueId] > 1e-9).map((o) => ({
                qid: o.queueId,
                need: deficit[o.queueId] / prof,
                // in donor-hours
                cap: o.maxSharePct != null ? o.maxSharePct / 100 * S0 : Infinity,
                taken: 0
              }));
              let avail = spare[donor.id];
              for (let guard = 0; guard < rec.length + 2 && avail > 1e-9; guard++) {
                const act = rec.filter((r) => Math.min(r.need, r.cap) - r.taken > 1e-9);
                if (!act.length) break;
                const totNeed = act.reduce((a, r) => a + (r.need - r.taken), 0);
                let gave = 0;
                for (const r of act) {
                  const give = Math.min(Math.min(r.need, r.cap) - r.taken, avail * ((r.need - r.taken) / totNeed));
                  r.taken += give;
                  gave += give;
                }
                avail -= gave;
                if (gave <= 1e-9) break;
              }
              for (const r of rec) {
                if (r.taken <= 1e-9) continue;
                spare[donor.id] -= r.taken;
                hrs[donor.id] -= r.taken;
                const recv = r.taken * prof;
                hrs[r.qid] += recv;
                deficit[r.qid] = Math.max(0, deficit[r.qid] - recv);
                agg[r.qid].flexIn += recv;
              }
            }
          }
          const fillProRata = (avail, recs) => {
            let given = 0;
            for (let guard = 0; guard < recs.length + 2 && avail - given > 1e-9; guard++) {
              const act = recs.filter((r) => r.need - r.taken > 1e-9);
              if (!act.length) break;
              const tot = act.reduce((x, r) => x + (r.need - r.taken), 0);
              let pass = 0;
              for (const r of act) {
                const give = Math.min(r.need - r.taken, (avail - given) * ((r.need - r.taken) / tot));
                r.taken += give;
                pass += give;
              }
              given += pass;
              if (pass <= 1e-9) break;
            }
            return given;
          };
          for (const donor of cfg.queues) {
            if (!isAutoDonor(donor) || spare[donor.id] <= 1e-9) continue;
            const recvs = cfg.queues.filter((r) => r.id !== donor.id && r.brandId != null && r.brandId === donor.brandId && isReceiver(r) && deficit[r.id] > 1e-9);
            if (!recvs.length) continue;
            const tiers = [...new Set(recvs.map((r) => r.priority != null ? r.priority : 999))].sort((a, b) => a - b);
            for (const tier of tiers) {
              if (spare[donor.id] <= 1e-9) break;
              const recs = recvs.filter((r) => (r.priority != null ? r.priority : 999) === tier && deficit[r.id] > 1e-9).map((r) => ({ qid: r.id, need: deficit[r.id] / prof, taken: 0 }));
              fillProRata(spare[donor.id], recs);
              for (const r of recs) {
                if (r.taken <= 1e-9) continue;
                spare[donor.id] -= r.taken;
                hrs[donor.id] -= r.taken;
                const recv = r.taken * prof;
                hrs[r.qid] += recv;
                deficit[r.qid] = Math.max(0, deficit[r.qid] - recv);
                agg[r.qid].recycledIn += recv;
              }
            }
          }
          const sharers = cfg.queues.filter((x) => x.sharing && Array.isArray(x.sharing.sharesWith) && x.sharing.sharesWith.length);
          if (sharers.length) {
            const stageSpare = {};
            for (const x of sharers) stageSpare[x.id] = spare[x.id];
            const shareRecs = (donor) => (donor.sharing.sharesWith || []).filter((id) => id !== donor.id && st[id] && deficit[id] > 1e-9).map((id) => ({ qid: id, need: deficit[id] / prof, taken: 0 }));
            const deliver = (recs) => {
              for (const r of recs) {
                if (r.taken <= 1e-9) continue;
                const recv = r.taken * prof;
                hrs[r.qid] += recv;
                deficit[r.qid] = Math.max(0, deficit[r.qid] - recv);
                agg[r.qid].poolIn += recv;
              }
            };
            for (const donor of sharers) {
              if (stageSpare[donor.id] <= 1e-9) continue;
              const offer = clamp((donor.sharing.sharePct != null ? donor.sharing.sharePct : 100) / 100, 0, 1) * stageSpare[donor.id];
              if (offer <= 1e-9) continue;
              const recs = shareRecs(donor);
              if (!recs.length) continue;
              const given = fillProRata(Math.min(offer, spare[donor.id]), recs);
              if (given <= 1e-9) continue;
              spare[donor.id] -= given;
              hrs[donor.id] -= given;
              deliver(recs);
            }
            for (const donor of sharers) {
              if (stageSpare[donor.id] <= 1e-9) continue;
              const s2 = st[donor.id];
              if ((s2.reclaimLeftDay || 0) <= 1e-9) continue;
              const recs = shareRecs(donor);
              if (!recs.length) continue;
              const given = fillProRata(Math.min(s2.reclaimLeftDay, recs.reduce((a, r) => a + r.need, 0)), recs);
              if (given <= 1e-9) continue;
              s2.reclaimLeftDay -= given;
              agg[donor.id].reclaimedHours += given;
              deliver(recs);
            }
          }
          for (const pool of cfg.pools || []) {
            const members = (pool.members || []).map((m) => ({ m, q: cfg.queues.find((x) => x.id === m.queueId) })).filter((x) => x.q);
            const recs = members.filter((x) => deficit[x.q.id] > 1e-9).map((x) => ({ qid: x.q.id, need: deficit[x.q.id] / prof, taken: 0 }));
            if (!recs.length) continue;
            const donors = members.filter((x) => spare[x.q.id] > 1e-9 && deficit[x.q.id] <= 1e-9).map((x) => ({ qid: x.q.id, avail: spare[x.q.id] * clamp((x.m.sharePct != null ? x.m.sharePct : 100) / 100, 0, 1), fed: 0 }));
            let avail = donors.reduce((a, x) => a + x.avail, 0);
            const demand = recs.reduce((a, r) => a + r.need, 0);
            if (demand > avail + 1e-9) {
              let shortfall = demand - avail;
              for (const x of donors) {
                if (shortfall <= 1e-9) break;
                const s2 = st[x.qid];
                const feed = Math.min(shortfall, Math.max(0, s2.reclaimLeftDay || 0));
                if (feed > 1e-9) {
                  x.fed = feed;
                  s2.reclaimLeftDay -= feed;
                  agg[x.qid].reclaimedHours += feed;
                  avail += feed;
                  shortfall -= feed;
                }
              }
            }
            const given = fillProRata(avail, recs);
            if (given <= 1e-9) continue;
            for (const r of recs) {
              if (r.taken <= 1e-9) continue;
              const recv = r.taken * prof;
              hrs[r.qid] += recv;
              deficit[r.qid] = Math.max(0, deficit[r.qid] - recv);
              agg[r.qid].poolIn += recv;
            }
            let toCharge = given - donors.reduce((a, x) => a + x.fed, 0);
            for (const x of donors) {
              if (toCharge <= 1e-9) break;
              const take = Math.min(toCharge, x.avail, spare[x.qid]);
              if (take > 1e-9) {
                spare[x.qid] -= take;
                hrs[x.qid] -= take;
                toCharge -= take;
              }
            }
          }
          for (const L of cfg.queues) {
            if (L.resourcing !== "leveraged" || !L.leverage) continue;
            const lev = L.leverage;
            const sL = st[L.id];
            if (sL.levLeft == null || d === 0) sL.levLeft = lev.capHoursPerWeek != null ? lev.capHoursPerWeek : Infinity;
            if (sL.levLeft <= 1e-9 || hrs[L.id] <= 1e-9) continue;
            let targets;
            if (lev.targets === "priority-above") {
              const myPri = L.priority != null ? L.priority : 999;
              targets = cfg.queues.filter((x) => x.id !== L.id && (x.priority != null ? x.priority : 999) < myPri);
            } else targets = (Array.isArray(lev.targets) ? lev.targets : [lev.targets]).map((id) => cfg.queues.find((x) => x.id === id)).filter(Boolean);
            const recs = targets.filter((x) => deficit[x.id] > 1e-9).map((x) => ({ qid: x.id, need: deficit[x.id] / prof, taken: 0 }));
            if (!recs.length) continue;
            const avail = Math.min(sL.levLeft, hrs[L.id]);
            const given = fillProRata(avail, recs);
            if (given <= 1e-9) continue;
            sL.levLeft -= given;
            hrs[L.id] -= given;
            spare[L.id] = Math.max(0, hrs[L.id] - req[L.id]);
            deficit[L.id] = Math.max(0, req[L.id] - hrs[L.id]);
            for (const r of recs) {
              if (r.taken <= 1e-9) continue;
              const recv = r.taken * prof;
              hrs[r.qid] += recv;
              deficit[r.qid] = Math.max(0, deficit[r.qid] - recv);
              agg[r.qid].leveragedIn += recv;
            }
          }
          for (const t of cfg.serviceTeams) {
            const poolWeekHrs = t.size * t.maxHoursPerWeek * t.proficiency;
            let left = Math.max(0, poolWeekHrs - (svcUsed[t.id] || 0));
            const cand = (t.coversQueues || []).map((id) => cfg.queues.find((q) => q.id === id)).filter(Boolean).map((q) => {
              const preview = q.type === "voice" ? runVoiceDay(st[q.id].eq, vol[q.id], hrs[q.id], eng, rc[q.id], true) : q.subtype === "workflow" ? runWorkflowDay(st[q.id].eq, vol[q.id], hrs[q.id], st[q.id].backlog, eng, rc[q.id], true) : runDigitalCustomerDay(st[q.id].eq, vol[q.id], hrs[q.id], eng, rc[q.id], true);
              return { q, deficit: Math.max(0, req[q.id] - hrs[q.id]), occ: preview.occ };
            }).filter((c) => c.deficit > 0 && c.occ >= t.triggerOccupancy).sort((a, b) => b.deficit - a.deficit);
            for (const c of cand) {
              if (left <= 0) break;
              const give = Math.min(left, c.deficit, poolWeekHrs / eng.daysPerWeek);
              hrs[c.q.id] += give;
              left -= give;
              svcUsed[t.id] = (svcUsed[t.id] || 0) + give;
              agg[c.q.id].svcHours += give;
            }
          }
          const dayRes = {};
          for (const q of cfg.queues) {
            if (q.type !== "digital") continue;
            const s = st[q.id];
            const kn = knMap[q.id];
            if (q.subtype === "workflow") {
              let r;
              const m = s.dm;
              if (d !== 0 && m && m.vol === vol[q.id] && m.hrs === hrs[q.id] && m.aht === s.eq.aht && m.slaMin === s.eq.digitalSlaMinutes && m.backlog0 === s.backlog) {
                r = m.r;
              } else {
                r = runWorkflowDay(s.eq, vol[q.id], hrs[q.id], s.backlog, eng, rc[q.id], d !== 0);
                s.dm = { vol: vol[q.id], hrs: hrs[q.id], aht: s.eq.aht, slaMin: s.eq.digitalSlaMinutes, backlog0: s.backlog, r };
              }
              let deflected = 0;
              const excess = Math.max(0, r.endBacklog - q.backlogLimit);
              if (excess > 0) {
                deflected = excess * kn.spillPct;
                s.backlog = r.endBacklog - deflected;
              } else s.backlog = r.endBacklog;
              if (deflected > 0 && kn.spillTargetQueue && st[kn.spillTargetQueue]) st[kn.spillTargetQueue].deflectIn += deflected;
              let repeats = 0;
              if (kn.repeatPct > 0) {
                repeats = r.volume * (1 - r.sl) * kn.repeatPct;
                s.repeatNext += repeats;
              }
              dayRes[q.id] = { ...r, deflected, repeats };
            } else {
              let r;
              const m = s.dm;
              if (d !== 0 && m && m.vol === vol[q.id] && m.hrs === hrs[q.id] && m.aht === s.eq.aht && m.slaMin === s.eq.digitalSlaMinutes) {
                r = m.r;
              } else {
                r = runDigitalCustomerDay(s.eq, vol[q.id], hrs[q.id], eng, rc[q.id], d !== 0);
                s.dm = { vol: vol[q.id], hrs: hrs[q.id], aht: s.eq.aht, slaMin: s.eq.digitalSlaMinutes, r };
              }
              const abandoned = r.volume * r.abandon;
              let deflected = kn.spillPct > 0 ? abandoned * kn.spillPct : 0;
              if (deflected > 0 && kn.spillTargetQueue && st[kn.spillTargetQueue]) st[kn.spillTargetQueue].deflectIn += deflected;
              let repeats = kn.repeatPct > 0 ? abandoned * kn.repeatPct : 0;
              if (repeats > 0) s.repeatNext += repeats;
              s.backlog = 0;
              dayRes[q.id] = { ...r, deflected, repeats };
            }
          }
          for (const q of cfg.queues) {
            if (q.type !== "voice") continue;
            const kn = knMap[q.id];
            const s = st[q.id];
            let r = null, redial = 0, curve = rc[q.id], iters = 0;
            const m = s.vm;
            if (d !== 0 && m && m.vol === vol[q.id] && m.hrs === hrs[q.id] && m.aht === s.eq.aht && m.asaT === s.eq.asaTarget) {
              r = m.r;
              redial = m.redial;
              iters = m.iters;
              curve = m.curve;
            } else {
              let v = vol[q.id];
              for (let k = 0; k < 3; k++) {
                iters = k + 1;
                const vc = Math.min(v, vol[q.id] * 4);
                curve = reqCurve(s.eq, vc, eng, rcCache);
                r = runVoiceDay(s.eq, vc, hrs[q.id], eng, curve, d !== 0);
                const nr = r.volume * r.abandon * kn.repeatPct;
                if (Math.abs(nr - redial) < 0.5) {
                  redial = nr;
                  break;
                }
                redial = nr;
                v = vol[q.id] + redial;
              }
              s.vm = { vol: vol[q.id], hrs: hrs[q.id], aht: s.eq.aht, asaT: s.eq.asaTarget, r, redial, iters, curve };
            }
            req[q.id] = curve.hours;
            rc[q.id] = curve;
            let spilled = 0;
            if (kn.spillPct > 0 && kn.spillTargetQueue && st[kn.spillTargetQueue]) {
              spilled = r.volume * r.abandon * kn.spillPct;
              st[kn.spillTargetQueue].deflectIn += spilled;
            }
            dayRes[q.id] = { ...r, redial, redialIters: iters, deflected: spilled };
          }
          for (const q of cfg.queues) {
            const a = agg[q.id], r = dayRes[q.id], v = r.volume;
            const sc = scq[q.id];
            a.volume += v;
            a.baseVolume += exo[q.id];
            a.hours += hrs[q.id];
            a.reqHours += req[q.id];
            a.slW += r.sl * v;
            a.occW += r.occ * v;
            a.occDen += v;
            a.repeatAdd = sc.repeatAdd;
            if (q.type === "voice") {
              a.asaW += r.asa * v;
              a.abW += r.abandon * v;
              a.redial += r.redial || 0;
              a.deflected += r.deflected || 0;
            } else {
              a.respW += r.respMin * v;
              a.redial += r.repeats || 0;
              a.deflected += r.deflected || 0;
              a.backlog = st[q.id].backlog;
              if (r.abandon != null) {
                a.asaW += r.asa * v;
                a.abW += r.abandon * v;
              }
            }
          }
          if (d === 0) firstDayIntraday = { hrs: { ...hrs }, vol: { ...vol }, res: dayRes };
          if (opts.captureDaily) dayTrace.push(Object.fromEntries(cfg.queues.map((q) => [q.id, { vol: vol[q.id], deflected: dayRes[q.id].deflected || 0, redial: dayRes[q.id].redial || 0, backlog: q.type === "digital" ? st[q.id].backlog : 0 }])));
        }
        const wk = { week: w, queues: {}, totals: blankTot() };
        for (const q of cfg.queues) {
          const s = st[q.id], a = agg[q.id];
          const V = a.volume || 1;
          const asa = a.asaW / V, sl = a.slW / V, ab = a.abW / V, occ = a.occDen > 0 ? a.occW / a.occDen : 0;
          const resp = a.respW / V;
          if (occ > q.burn.occThreshold) s.burnout = clamp(s.burnout + (occ - q.burn.occThreshold) * 100 * q.burn.sensitivity, 0, 100);
          else s.burnout = clamp(s.burnout - q.burn.recovery, 0, 100);
          if (a.otHours > 1e-9 && s.otWeeklyCap > 1e-9) {
            s.burnout = clamp(s.burnout + set.ot.burnoutLoad * (a.otHours / s.otWeeklyCap), 0, 100);
          }
          const reclaimWeekCap = (s.reclaimCapDay || 0) * eng.daysPerWeek;
          const reclaimShare = reclaimWeekCap > 1e-9 ? clamp(a.reclaimedHours / reclaimWeekCap, 0, 1) : 0;
          if (reclaimShare > 1e-6) s.trainingDebt = clamp(s.trainingDebt + set.trainingDebt.accumRate * reclaimShare, 0, 100);
          else s.trainingDebt = clamp(s.trainingDebt - set.trainingDebt.recoveryRate, 0, 100);
          s.otStreak = a.otHours > 1e-6 ? (s.otStreak || 0) + 1 : 0;
          const headsRamp = sum(s.ramp.map((c) => c.heads));
          const headsTrain = sum(s.training.map((c) => c.heads));
          const headsPipe = sum(s.pipeline.map((c) => c.heads));
          const paid = s.trained + headsRamp + headsTrain;
          const reqFte = a.reqHours / eng.daysPerWeek / Math.max(0.01, hoursPerHeadDay(q, eng));
          const wkCost = q.agentCostMonthly != null ? paid * q.agentCostMonthly * 12 / 52 : paid * q.agentCost / 52;
          const trainCost = q.agentCostMonthly != null ? headsTrain * q.agentCostMonthly * 12 / 52 : headsTrain * q.agentCost / 52;
          const hourly = (q.agentCostMonthly != null ? q.agentCostMonthly * 12 / 52 : q.agentCost / 52) / (eng.hoursPerFteDay * eng.daysWorkedPerFte);
          const waste = Math.max(0, a.hours - a.reqHours) * hourly;
          const cx = cfg.cx;
          const repeatShare = clamp((a.redial + a.deflected) / V, 0, 1);
          const uplift = 1 + (repeatShare + (a.repeatAdd || 0)) * (cx.repeatUplift - 1);
          let lost = 0;
          if (q.type === "voice") {
            lost += a.volume * ab * cx.churnAbandon * uplift;
            lost += a.volume * (1 - ab) * (1 - sl) * cx.churnWait * uplift;
          } else lost += a.volume * (1 - sl) * cx.churnDigital * uplift;
          lost = Math.max(0, lost);
          s.cumChurn += lost;
          const churnCost = lost * cx.costPerLostCustomer;
          const asaT = q.asaTarget * (s.wkSlaMult || 1);
          const wfQ = q.type === "digital" && q.subtype === "workflow";
          const wfPct = q.workflowSlaPct != null ? q.workflowSlaPct : 0.9;
          const ok = q.type === "voice" ? asa <= asaT && ab <= q.maxAbandon : wfQ ? sl >= wfPct && a.backlog <= (q.backlogLimit != null ? q.backlogLimit : Infinity) : sl >= q.digitalSlaPct;
          const near = q.type === "voice" ? asa <= asaT * 1.5 && ab <= q.maxAbandon * 1.5 : wfQ ? sl >= wfPct * 0.9 : sl >= q.digitalSlaPct * 0.9;
          const status = ok ? "green" : near ? "amber" : "red";
          const otCost = a.otHours * hourly * set.ot.premium;
          wk.queues[q.id] = {
            volume: a.volume,
            baseVolume: a.baseVolume,
            redial: a.redial,
            deflected: a.deflected,
            asa,
            sl,
            abandon: ab,
            occ,
            respMin: resp,
            backlog: a.backlog,
            trained: s.trained,
            ramp: headsRamp,
            training: headsTrain,
            pipeline: headsPipe,
            paid,
            // §14.6: active excludes trainees; startingHC is the week-0 resolved HC.
            active: s.trained + headsRamp,
            startingHC: startHC[q.id],
            resourcing: q.resourcing || "resourced",
            channel: channelOf(q),
            brandId: q.brandId || null,
            // §24.5 subtype + hour-grain response for workflow presentation.
            subtype: digitalSubtype(q),
            respHours: resp / 60,
            reqFte,
            hours: a.hours,
            reqHours: a.reqHours,
            svcHours: a.svcHours,
            flexIn: a.flexIn,
            cover: a.reqHours > 0 ? a.hours / a.reqHours : 1,
            burnout: s.burnout,
            leavers: s.lastLeavers || 0,
            reqsRaised: s.lastReqs || 0,
            attrInEffect: (s.wkAttr || 0) * 4.345,
            // §17/§20a risk-support + §16 audit fields.
            otHours: a.otHours,
            otCost,
            otStreakWeeks: s.otStreak || 0,
            reclaimedHours: a.reclaimedHours,
            trainingDebt: s.trainingDebt || 0,
            recycledIn: a.recycledIn,
            poolIn: a.poolIn,
            leveragedIn: a.leveragedIn,
            borrowedSharePct: a.reqHours > 1e-9 ? (a.flexIn + a.recycledIn + a.poolIn + a.leveragedIn + a.svcHours) / a.reqHours : 0,
            ahtInEffect: s.wkAht != null ? s.wkAht : q.aht,
            slaInEffect: s.wkSla != null ? s.wkSla : q.type === "voice" ? q.asaTarget : q.digitalSlaMinutes,
            trainShrinkInEffect: s.reclaimShrink || 0,
            scenarioTags: s.wkTags || null,
            cost: wkCost,
            trainCost,
            waste,
            churnCustomers: lost,
            churnCost,
            cumChurn: s.cumChurn,
            status
          };
          wk.totals.volume += a.volume;
          wk.totals.cost += wkCost;
          wk.totals.trainCost += trainCost;
          wk.totals.waste += waste;
          wk.totals.churnCost += churnCost;
          wk.totals.churnCustomers += lost;
          wk.totals.paid += paid;
          wk.totals.reqFte += reqFte;
          wk.totals.svcHours += a.svcHours;
          wk.totals.trained += s.trained;
          wk.totals.inTraining += headsTrain;
          wk.totals.ramping += headsRamp;
          wk.totals.active = (wk.totals.active || 0) + s.trained + headsRamp;
          wk.totals.otHours = (wk.totals.otHours || 0) + a.otHours;
          wk.totals.otCost = (wk.totals.otCost || 0) + otCost;
        }
        let svcCost = 0;
        for (const t of cfg.serviceTeams) {
          const hourly = t.agentCost / 52 / (eng.hoursPerFteDay * eng.daysWorkedPerFte);
          svcCost += (svcUsed[t.id] || 0) * hourly * (1 + t.premiumPct);
        }
        const managers = Math.ceil(wk.totals.paid / Math.max(1, cfg.costs.managerRatio));
        wk.totals.serviceCost = svcCost;
        wk.totals.managers = managers;
        wk.totals.managerCost = cfg.costs.managerCostMonthly != null ? managers * cfg.costs.managerCostMonthly * 12 / 52 : managers * cfg.costs.managerCost / 52;
        wk.totals.productiveCost = wk.totals.cost - wk.totals.trainCost;
        wk.totals.totalCost = wk.totals.cost + wk.totals.managerCost + svcCost + (wk.totals.otCost || 0);
        wk.totals.allInCost = wk.totals.totalCost + wk.totals.churnCost;
        wk.intraday = firstDayIntraday;
        if (opts.captureDaily) wk.days = dayTrace.slice(-eng.daysPerWeek);
        weeks.push(wk);
      }
      const out = { weeks, allocTrace, strategy, viewIds: [...activeIds], config: cfg };
      out.summary = summarise(cfg, weeks, allocTrace, strategy);
      return out;
    }
    function compactRun(cfg, sim) {
      return {
        headline: sim.summary,
        horizon: sim.weeks.length,
        strategy: sim.strategy,
        viewIds: sim.viewIds,
        totals: sim.weeks.map((w, i) => ({ wk: i + 1, cost: w.totals.totalCost, churn: w.totals.churnCost, waste: w.totals.waste, paid: w.totals.paid, req: w.totals.reqFte, volume: w.totals.volume })),
        queues: cfg.queues.map((q) => ({
          id: q.id,
          name: q.name,
          type: q.type,
          weeks: sim.weeks.map((w) => {
            const s = w.queues[q.id];
            return { st: s.status, cv: +s.cover.toFixed(3), asa: +s.asa.toFixed(1), sl: +s.sl.toFixed(3), ab: +s.abandon.toFixed(4), oc: +s.occ.toFixed(3), bu: +s.burnout.toFixed(0), pd: +s.paid.toFixed(1), rq: +s.reqFte.toFixed(1), co: Math.round(s.cost), ch: Math.round(s.churnCost), vo: Math.round(s.volume), lv: +(s.leavers || 0).toFixed(2), rr: +(s.reqsRaised || 0).toFixed(2) };
          })
        }))
      };
    }
    function summarise(cfg, weeks, allocTrace, strategy) {
      const cur = cfg.engine.currency;
      const f = (n) => cur + Math.round(n).toLocaleString();
      const totalCost = sum(weeks.map((w) => w.totals.totalCost));
      const churnCost = sum(weeks.map((w) => w.totals.churnCost));
      const waste = sum(weeks.map((w) => w.totals.waste));
      const lost = sum(weeks.map((w) => w.totals.churnCustomers));
      const findings = [];
      const flags = { tippingPoint: false, capInfeasible: false };
      const perQueue = {};
      const binding = (allocTrace || []).filter((t) => t.binding);
      if (binding.length) {
        flags.capInfeasible = true;
        const worst = binding.reduce((a, b) => b.want - b.cap > a.want - a.cap ? b : a);
        findings.push({ tone: "red", text: `Hiring cap binds in ${binding.length} week(s). Worst: week ${worst.week + 1} \u2014 cap ${worst.cap}, plan wants ${worst.want.toFixed(0)}; short queues: ${Object.keys(worst.denied).map((id) => cfg.queues.find((q) => q.id === id)?.name || id).join(", ")}.` });
      }
      const capTotal = cfg.hiring.caps && cfg.hiring.caps.total != null ? cfg.hiring.caps.total : cfg.hiring.cap;
      const leaversWk = weeks.map((w) => sum(cfg.queues.map((q) => w.queues[q.id].leavers)));
      const avgLeavers = sum(leaversWk.slice(-8)) / Math.min(8, Math.max(1, leaversWk.length));
      if (avgLeavers > capTotal * 1.0001 && !strategyAllManual(cfg, strategy)) {
        flags.tippingPoint = true;
        findings.push({ tone: "red", text: `Tipping point: the operation is losing ${avgLeavers.toFixed(1)} people/week against a hiring cap of ${capTotal}/week. Headcount cannot recover at any allocation.` });
      }
      for (const q of cfg.queues) {
        const series = weeks.map((w) => w.queues[q.id]);
        const qLabel = q.resourcing === "supported" ? `${q.name} (supported)` : q.resourcing === "unmanned" ? `${q.name} (unmanned)` : q.resourcing === "leveraged" ? `${q.name} (leveraged)` : q.name;
        const breachWeeks = series.filter((s) => s.status !== "green").length;
        const firstBreach = series.findIndex((s) => s.status === "red");
        const peakBurn = Math.max(...series.map((s) => s.burnout));
        const slaAttainment = series.length ? (series.length - breachWeeks) / series.length : 1;
        const slaTarget = q.slaAttainmentTarget != null ? q.slaAttainmentTarget : null;
        const slaRag = slaTarget == null ? null : slaAttainment >= slaTarget ? "green" : slaAttainment >= slaTarget * 0.9 ? "amber" : "red";
        perQueue[q.id] = { breachWeeks, firstBreach, peakBurn, slaAttainment, slaTarget, slaRag };
        if (firstBreach >= 0) {
          const lead = q.wf.reqToStart + q.wf.trainingWeeks + q.wf.learningCurve.length;
          const raiseBy = firstBreach - lead;
          findings.push({
            tone: "red",
            text: q.resourcing === "supported" || q.resourcing === "unmanned" ? `${qLabel} goes red in week ${firstBreach + 1}. It is staffed only from supporter spare hours \u2014 add support routes or resource it directly.` : raiseBy >= 0 ? `${qLabel} goes red in week ${firstBreach + 1}. Requisitions must land by week ${raiseBy + 1} given the ${lead}-week hire-to-productive lead.` : `${qLabel} goes red in week ${firstBreach + 1}, inside the ${lead}-week lead time. Hiring cannot fix it \u2014 cover with flexing, service teams or deferral.`
          });
        }
        if (peakBurn > 60) findings.push({ tone: "amber", text: `${qLabel} peaks at ${Math.round(peakBurn)}/100 burnout, lifting attrition and absence.` });
        const last = series[series.length - 1];
        if (last.paid > last.reqFte * 1.1 && last.reqFte > 0) {
          const excess = last.paid - last.reqFte;
          const perWeek = last.paid * (q.wf.attrition / 4.345);
          const wks = perWeek > 0 ? Math.ceil(excess / perWeek) : 999;
          const wkExcessCost = q.agentCostMonthly != null ? excess * q.agentCostMonthly * 12 / 52 : excess * q.agentCost / 52;
          findings.push({ tone: "amber", text: `${qLabel} ends ${excess.toFixed(0)} FTE over requirement. Under a freeze, attrition clears it in ~${wks} weeks (~${f(wkExcessCost * (wks / 2))} carrying cost).` });
        }
      }
      if (churnCost > 0) findings.push({ tone: churnCost > waste ? "red" : "green", text: `Over ${weeks.length} weeks: ${f(totalCost)} to run, ${f(churnCost)} lost to poor experience (${Math.round(lost).toLocaleString()} customers), ${f(waste)} idle pay.` });
      const hiring = { queues: {}, groups: {} };
      const blankAggRow = () => ({ volume: 0, required: 0, hiring: 0, pipelineEnd: 0, training: 0, active: 0, churnCount: 0, _avgActive: 0 });
      const groups = { voice: blankAggRow(), digital: blankAggRow(), overall: blankAggRow() };
      for (const q of cfg.queues) {
        const series = weeks.map((w) => w.queues[q.id]);
        const last = series[series.length - 1];
        const row = {
          name: q.name,
          type: q.type,
          resourcing: q.resourcing || "resourced",
          volume: sum(series.map((s) => s.volume)),
          required: last.reqFte,
          hiring: sum(series.map((s) => s.reqsRaised || 0)),
          pipelineEnd: last.pipeline,
          training: last.training,
          active: last.active != null ? last.active : last.trained + last.ramp,
          churnCount: sum(series.map((s) => s.leavers || 0))
        };
        const avgActive = sum(series.map((s) => s.active != null ? s.active : s.trained + s.ramp)) / Math.max(1, series.length);
        row.churnPct = avgActive > 1e-9 ? row.churnCount / avgActive : 0;
        hiring.queues[q.id] = row;
        for (const g of [groups[q.type] || (groups[q.type] = blankAggRow()), groups.overall]) {
          g.volume += row.volume;
          g.required += row.required;
          g.hiring += row.hiring;
          g.pipelineEnd += row.pipelineEnd;
          g.training += row.training;
          g.active += row.active;
          g.churnCount += row.churnCount;
          g._avgActive += avgActive;
        }
      }
      for (const k of Object.keys(groups)) {
        const g = groups[k];
        g.churnPct = g._avgActive > 1e-9 ? g.churnCount / g._avgActive : 0;
        delete g._avgActive;
      }
      hiring.groups = groups;
      const weeksN = Math.max(1, weeks.length);
      const finance = {
        monthlyRun: totalCost / weeksN * (52 / 12),
        annualRun: totalCost / weeksN * 52,
        monthlyAllIn: (totalCost + churnCost) / weeksN * (52 / 12),
        annualAllIn: (totalCost + churnCost) / weeksN * 52
      };
      return { totalCost, churnCost, waste, lost, allIn: totalCost + churnCost, findings: findings.slice(0, 10), flags, perQueue, strategy, hiring, finance };
    }
    function makeDefaultConfig2() {
      const wf = () => ({ attrition: 0.04, attritionGrowth: 0, reqToStart: 6, trainingWeeks: 4, learningCurve: [0.6, 0.75, 0.9, 1], hires: [] });
      const burn = () => ({ occThreshold: 0.85, sensitivity: 1.5, recovery: 8, maxAttritionMult: 2, absenceUplift: 0.05 });
      const v1 = "q_bill", v2 = "q_tech", d1 = "q_wapp", d2 = "q_chat";
      return {
        // §16/§22: default simulation window is 52 weeks (clamped [24, 78]).
        engine: { horizonWeeks: 52, dayStart: 8, dayEnd: 20, intervalMin: 30, occupancyCeiling: 0.85, currency: "\xA3", daysPerWeek: 7, hoursPerFteDay: 8, daysWorkedPerFte: 5, crossSkillProficiency: 0.9, globalStartingHC: null },
        // §16 Settings (physics). Empty object = every R2 default from settingsOf().
        settings: {},
        // §15 brands: one parameter block each — the training profile (null = inherit Settings).
        brands: [{ id: "b1", name: "Brand 1", training: null, dailyVolume: null, weeklyVolumes: null }],
        pools: [],
        // §19 scenario groups — the matrix rows; these REPLACE views in R2 (views kept for the un-migrated UI).
        groups: [{ id: "g_por", name: "Plan of record", builtin: true }, { id: "g_none", name: "No scenarios", builtin: true, scenarioIds: [] }],
        hiring: { cap: 18, buffer: 0.1, activeStrategy: "S1" },
        // §14.1: strategies live in config; built-ins S1–S4 are always present.
        // Users append custom entries ({name, baseType, bufferPct, excludedQueueIds,
        // segments}) and schedules. The default queue set keeps the legacy
        // `crossSkill` field; the §14.3 migration shim derives outbound `supports`
        // from it at simulate time, so old and new configs behave identically.
        strategies: BUILTIN_STRATEGIES.map((s) => ({ ...s })),
        seasonality: { startMonth: 0, system: [...SEASONAL_PRESETS2["Flat"]] },
        queues: [
          { id: v1, name: "Voice \u2014 Billing", type: "voice", brandId: "b1", channel: "voice", priority: 1, dailyVolume: 2e3, aht: 300, profile: [...DEFAULT_PROFILE], asaTarget: 30, maxAbandon: 0.05, patience: 90, shrinkage: 0.3, fte: 63, agentCost: 32e3, crossSkill: [v2], weeklyVolumes: null, seasonal: null, concurrency: 1, digitalSlaMinutes: 5, digitalSlaPct: 0.8, backlogLimit: 150, deflectsTo: null, resourcing: "resourced", supports: [], wf: wf(), burn: burn() },
          { id: v2, name: "Voice \u2014 Technical", type: "voice", brandId: "b1", channel: "voice", priority: 2, dailyVolume: 900, aht: 420, profile: [...DEFAULT_PROFILE], asaTarget: 45, maxAbandon: 0.06, patience: 100, shrinkage: 0.3, fte: 47, agentCost: 32e3, crossSkill: [], weeklyVolumes: null, seasonal: null, concurrency: 1, digitalSlaMinutes: 5, digitalSlaPct: 0.8, backlogLimit: 150, deflectsTo: null, resourcing: "resourced", supports: [], wf: wf(), burn: burn() },
          // §25.4: Digital Customer chat patience defaults to 180 s (people wait
          // longer on an async-feeling chat than on a phone line); maxAbandon 5%.
          { id: d1, name: "WhatsApp \u2014 Service", type: "digital", brandId: "b1", channel: "digital", priority: 3, dailyVolume: 1400, aht: 420, profile: [...DEFAULT_PROFILE], concurrency: 2.5, digitalSlaMinutes: 5, digitalSlaPct: 0.8, backlogLimit: 150, deflectsTo: v1, shrinkage: 0.3, fte: 20, agentCost: 3e4, crossSkill: [], weeklyVolumes: null, seasonal: null, asaTarget: 30, maxAbandon: 0.05, patience: 180, resourcing: "resourced", supports: [], wf: wf(), burn: burn() },
          { id: d2, name: "Chat \u2014 Sales", type: "digital", brandId: "b1", channel: "digital", priority: 4, dailyVolume: 700, aht: 360, profile: [...DEFAULT_PROFILE], concurrency: 2, digitalSlaMinutes: 3, digitalSlaPct: 0.8, backlogLimit: 80, deflectsTo: v1, shrinkage: 0.3, fte: 11, agentCost: 3e4, crossSkill: [], weeklyVolumes: null, seasonal: null, asaTarget: 30, maxAbandon: 0.05, patience: 180, resourcing: "resourced", supports: [], wf: wf(), burn: burn() }
        ],
        serviceTeams: [{ id: "st_1", name: "Flex pool", size: 12, premiumPct: 0.2, proficiency: 0.8, triggerOccupancy: 0.9, maxHoursPerWeek: 20, agentCost: 32e3, coversQueues: [v1, v2] }],
        costs: { managerCost: 48e3, managerRatio: 12 },
        cx: { customerBase: 2e5, costPerLostCustomer: 500, churnAbandon: 0.03, churnWait: 0.015, churnDigital: 0.02, repeatUplift: 1.5 },
        loops: { redial: 0.3, deflection: 0.4 },
        views: [{ id: "v_por", name: "Plan of record", builtin: true }, { id: "v_none", name: "No scenarios", builtin: true, scenarioIds: [] }],
        scenarios: [
          { id: "sc_growth", type: "growth", name: "Customer growth", enabled: true, startWeek: 0, queueIds: "all", p: { rate: 0.02 } },
          { id: "sc_launch", type: "launch", name: "Product launch", enabled: false, startWeek: 8, queueIds: "all", p: { ramp: 3, peak: 0.4, decay: 6 } },
          { id: "sc_p1", type: "p1", name: "P1 incident", enabled: false, startWeek: 12, queueIds: "all", p: { spike: 1.5, days: 2 } },
          { id: "sc_fe", type: "forecastError", name: "Forecast error", enabled: false, startWeek: 0, queueIds: "all", p: { error: 0.15 } },
          { id: "sc_as", type: "attritionShock", name: "Attrition shock", enabled: false, startWeek: 10, queueIds: "all", p: { add: 0.03 } },
          { id: "sc_hf", type: "hiringFreeze", name: "Hiring freeze", enabled: false, startWeek: 6, queueIds: "all", p: { weeks: 12 } },
          { id: "sc_rt", type: "reducedTraining", name: "Reduced training", enabled: false, startWeek: 0, queueIds: "all", p: { cutWeeks: 2, startProficiency: 0.4, stretch: 1.75, ahtPenalty: 0.12, repeatUplift: 0.08 } }
        ]
      };
    }
    function migrateScenarioToUnified(s, cfg) {
      const base = { id: s.id, type: "unified", name: s.name, enabled: s.enabled, startWeek: s.startWeek || 0, stopWeek: null, granularity: "week", queueIds: s.queueIds };
      const opWide = { ...base, queueIds: "all" };
      switch (s.type) {
        case "growth":
          return { ...base, tag: "growth", parameter: "volume", mechanism: "growthRate", stopWeek: s.p.stopWeek != null ? s.p.stopWeek : null, p: { rate: s.p.rate } };
        case "launch": {
          const series = {};
          for (let w = 0; w < s.p.ramp + s.p.decay; w++) {
            const m = w < s.p.ramp ? s.p.peak * ((w + 1) / s.p.ramp) : s.p.peak * (1 - (w - s.p.ramp) / s.p.decay);
            series[(s.startWeek || 0) + w] = Math.max(0, m);
          }
          return { ...base, tag: "launch", parameter: "volume", mechanism: "manualSeries", p: { series } };
        }
        case "p1": {
          const dpw = cfg ? cfg.engine.daysPerWeek : 7;
          const series = {};
          for (let d = 0; d < s.p.days; d++) series[(s.startWeek || 0) * dpw + d] = s.p.spike;
          return { ...base, tag: "p1", parameter: "volume", mechanism: "manualSeries", granularity: "day", p: { series } };
        }
        case "forecastError":
          return { ...base, tag: "custom", parameter: "volume", mechanism: "step", p: { value: s.p.error } };
        case "attritionShock":
          return { ...opWide, tag: "custom", parameter: "people", mechanism: "step", p: { kind: "attritionDelta", value: s.p.add } };
        case "hiringFreeze":
          return { ...opWide, tag: "custom", parameter: "people", mechanism: "step", stopWeek: (s.startWeek || 0) + s.p.weeks, p: { kind: "hiringFreeze" } };
        case "reducedTraining":
          return { ...opWide, tag: "custom", parameter: "people", mechanism: "step", p: { kind: "trainingProgramme", programme: { ...s.p } } };
        case "growthManual":
          return { ...base, tag: "growth", parameter: "volume", mechanism: "manualSeries", p: { series: { ...s.p.weeklyPct || {} }, overrideGrowth: true } };
        case "freezeManual": {
          const series = {};
          for (const w of s.p.weeks || []) series[w] = 1;
          return { ...opWide, tag: "custom", parameter: "people", mechanism: "manualSeries", p: { kind: "hiringFreeze", series } };
        }
        default:
          return s.type === "unified" ? s : { ...base, tag: "custom", parameter: "volume", mechanism: "step", p: { value: 0 } };
      }
    }
    function migrateServiceTeamsToLeveraged(cfg) {
      if (!cfg.serviceTeams || !cfg.serviceTeams.length) return cfg;
      const brandId = cfg.brands && cfg.brands[0] && cfg.brands[0].id || "b1";
      const wfDef = { attrition: 0.04, attritionGrowth: 0, reqToStart: 6, trainingWeeks: 4, learningCurve: [0.6, 0.75, 0.9, 1], hires: [] };
      const burnDef = { occThreshold: 0.85, sensitivity: 1.5, recovery: 8, maxAttritionMult: 2, absenceUplift: 0.05 };
      const extra = cfg.serviceTeams.map((t, i) => ({
        id: "q_" + t.id,
        name: t.name,
        type: "digital",
        channel: "support",
        brandId,
        priority: 900 + i,
        resourcing: "leveraged",
        dailyVolume: 0,
        aht: 300,
        concurrency: 1,
        profile: new Array(24).fill(1),
        digitalSlaMinutes: 60,
        digitalSlaPct: 0.8,
        backlogLimit: 1e9,
        deflectsTo: null,
        asaTarget: 30,
        maxAbandon: 0.05,
        patience: 90,
        shrinkage: 0.3,
        fte: t.size,
        agentCost: t.agentCost,
        crossSkill: [],
        supports: [],
        weeklyVolumes: null,
        seasonal: null,
        leverage: {
          capHoursPerWeek: t.size * t.maxHoursPerWeek,
          targets: [...t.coversQueues || []],
          premiumPct: t.premiumPct,
          // cost note (§21)
          note: "migrated service team \u2014 trigger occ " + t.triggerOccupancy + ", proficiency " + t.proficiency
        },
        wf: { ...wfDef },
        burn: { ...burnDef }
      }));
      return { ...cfg, queues: [...cfg.queues, ...extra], serviceTeams: [] };
    }
    function migrateConfigR2(cfg) {
      let out = { ...cfg };
      out.settings = out.settings || {};
      if (!out.brands || !out.brands.length) out.brands = [{ id: "b1", name: "Brand 1", training: null, dailyVolume: null, weeklyVolumes: null }];
      const brandId = out.brands[0].id;
      const supports = effectiveSupports(out);
      out.queues = out.queues.map((q, i) => {
        const kn = resolveKnockOn(out, q);
        return {
          ...q,
          brandId: q.brandId || brandId,
          channel: channelOf(q),
          priority: q.priority != null ? q.priority : i + 1,
          resourcing: q.resourcing === "supported" ? "unmanned" : !q.resourcing || q.resourcing === "resourced" ? "dedicated" : q.resourcing,
          supports: supports[q.id] || [],
          crossSkill: [],
          repeatPct: q.repeatPct != null ? q.repeatPct : kn.repeatPct,
          spillPct: q.spillPct != null ? q.spillPct : kn.spillPct,
          spillTargetQueue: q.spillTargetQueue != null ? q.spillTargetQueue : kn.spillTargetQueue
        };
      });
      out = migrateServiceTeamsToLeveraged(out);
      if (!out.groups || !out.groups.length) {
        out.groups = (out.views || []).map((v) => ({ id: v.id, name: v.name, builtin: !!v.builtin, scenarioIds: Array.isArray(v.scenarioIds) ? [...v.scenarioIds] : void 0 }));
        if (!out.groups.length) out.groups = [{ id: "g_por", name: "Plan of record", builtin: true }, { id: "g_none", name: "No scenarios", builtin: true, scenarioIds: [] }];
      }
      out.pools = out.pools || [];
      out.scenarios = out.scenarios.map((s) => migrateScenarioToUnified(s, out));
      return out;
    }
    function groupScenarioIds2(cfg, groupId) {
      const g = (cfg.groups || []).find((x) => x.id === groupId) || (cfg.groups || [])[0];
      if (g && Array.isArray(g.scenarioIds)) return g.scenarioIds.filter((id) => cfg.scenarios.some((s) => s.id === id));
      return cfg.scenarios.filter((s) => s.enabled).map((s) => s.id);
    }
    function groupScopeQueueIds(cfg, scope) {
      if (!scope) return null;
      const brands = new Set(scope.brandIds || []);
      const channels = new Set(scope.channels || []);
      const ids = new Set(scope.queueIds || []);
      if (!brands.size && !channels.size && !ids.size) return null;
      return cfg.queues.filter((q) => brands.has(q.brandId) || channels.has(channelOf(q)) || ids.has(q.id)).map((q) => q.id);
    }
    function applyGroupScope3(cfg, groupId) {
      const g = (cfg.groups || []).find((x) => x.id === groupId);
      const qids = g ? groupScopeQueueIds(cfg, g.scope) : null;
      if (!qids) return cfg;
      const inGroup = new Set(groupScenarioIds2(cfg, groupId));
      return {
        ...cfg,
        scenarios: cfg.scenarios.map((s) => inGroup.has(s.id) ? { ...s, scope: { kind: "queues", queueIds: qids }, queueIds: qids } : s)
      };
    }
    function makeBlankConfig() {
      return {
        engine: { horizonWeeks: 52, dayStart: 8, dayEnd: 20, intervalMin: 30, occupancyCeiling: 0.85, currency: "\xA3", daysPerWeek: 7, hoursPerFteDay: 8, daysWorkedPerFte: 5, crossSkillProficiency: 0.9, globalStartingHC: null },
        settings: {},
        brands: [],
        pools: [],
        groups: [{ id: "g_por", name: "Plan of record", builtin: true }, { id: "g_none", name: "No scenarios", builtin: true, scenarioIds: [] }],
        hiring: { cap: 18, buffer: 0.1, activeStrategy: "S1", caps: { segments: {}, brands: {}, total: 18 } },
        strategies: BUILTIN_STRATEGIES.map((s) => ({ ...s })),
        seasonality: { startMonth: 0, system: [...SEASONAL_PRESETS2["Flat"]] },
        queues: [],
        serviceTeams: [],
        costs: { managerCost: 48e3, managerCostMonthly: 4e3, managerRatio: 12 },
        cx: { customerBase: 0, costPerLostCustomer: 500, churnAbandon: 0.03, churnWait: 0.015, churnDigital: 0.02, repeatUplift: 1.5 },
        loops: { redial: 0.3, deflection: 0.4 },
        views: [],
        scenarios: []
      };
    }
    function migrateConfigR3(cfg) {
      const r2 = migrateConfigR2(cfg);
      const knockOf = {};
      for (const q of r2.queues) knockOf[q.id] = resolveKnockOn(r2, q);
      const shareOf = {};
      for (const pool of r2.pools || []) {
        for (const m of pool.members || []) {
          const others = (pool.members || []).filter((x) => x.queueId !== m.queueId).map((x) => x.queueId);
          const pct3 = m.sharePct != null ? m.sharePct : 100;
          const cur = shareOf[m.queueId];
          if (!cur) shareOf[m.queueId] = { sharePct: pct3, sharesWith: [...others] };
          else {
            cur.sharePct = Math.max(cur.sharePct, pct3);
            for (const id of others) if (!cur.sharesWith.includes(id)) cur.sharesWith.push(id);
          }
        }
      }
      return {
        ...r2,
        queues: r2.queues.map((q) => {
          const kn = knockOf[q.id];
          const primary = primaryVoiceQueue(r2, q.brandId);
          const knock = q.knock || {
            repeatPct: kn.repeatPct,
            convertPct: kn.spillPct,
            convertTarget: kn.spillTargetQueue != null ? kn.spillTargetQueue : kn.spillPct > 0 ? null : primary && primary.id !== q.id ? primary.id : null
          };
          return {
            ...q,
            knock,
            // Keep the legacy mirror fields aligned with the canonical knock block
            // (idempotency: a later R2 pass re-materialises from resolveKnockOn,
            // which now reads `knock`). Inert where they differ — convertPct 0.
            repeatPct: knock.repeatPct,
            spillPct: knock.convertPct,
            spillTargetQueue: knock.convertTarget,
            sharing: q.sharing || shareOf[q.id] || null,
            subtype: q.type === "digital" ? q.subtype || "customer" : q.subtype,
            // §25.4: Digital Customer queues gain patience 180 s + maxAbandon 5%
            // defaults (Erlang inputs); backlogLimit is retired for them (the field
            // may linger but the engine ignores it) — Workflow keeps it.
            patience: q.type === "digital" && (q.subtype || "customer") === "customer" ? q.patience != null ? q.patience : 180 : q.patience,
            maxAbandon: q.type === "digital" && (q.subtype || "customer") === "customer" ? q.maxAbandon != null ? q.maxAbandon : 0.05 : q.maxAbandon,
            agentCostMonthly: q.agentCostMonthly != null ? q.agentCostMonthly : q.agentCost != null ? q.agentCost / 12 : null,
            slaAttainmentTarget: q.slaAttainmentTarget != null ? q.slaAttainmentTarget : 0.9
          };
        }),
        pools: [],
        // §24.4: backfill strategies carry their forwardMonths default explicitly
        // (built-ins already ship 3; older saves gain it here). User-editable.
        strategies: (r2.strategies || []).map((s) => s.baseType === "backfill" && s.forwardMonths == null ? { ...s, forwardMonths: 3 } : s),
        hiring: {
          ...r2.hiring,
          caps: r2.hiring.caps || { segments: {}, brands: {}, total: r2.hiring.cap != null ? r2.hiring.cap : null }
        },
        costs: {
          ...r2.costs,
          managerCostMonthly: r2.costs.managerCostMonthly != null ? r2.costs.managerCostMonthly : r2.costs.managerCost != null ? r2.costs.managerCost / 12 : null
        }
      };
    }
    module.exports = {
      erlangB,
      erlangC,
      voiceRaw,
      voiceInterval,
      requiredAgentsInterval,
      reqCurve,
      runVoiceDay,
      runDigitalDay,
      hoursPerHeadDay,
      monthOfWeek,
      seasonalMult,
      SEASONAL_PRESETS: SEASONAL_PRESETS2,
      exogenousVolume,
      projectSupply,
      decideHiring,
      simulate: simulate3,
      compactRun,
      summarise,
      makeDefaultConfig: makeDefaultConfig2,
      DEFAULT_PROFILE,
      clamp,
      norm,
      sum,
      uid,
      stretchCurve,
      // Revision 1 (SPEC §14)
      BUILTIN_STRATEGIES,
      strategyById,
      strategyAt,
      strategyAllManual,
      effectiveSupports,
      supportersOf,
      resolveStartingHC,
      // Revision 2 (SPEC §15–§21)
      settingsOf,
      resolveHorizon,
      resolveTraining,
      resolveKnockOn,
      blendedAht,
      channelOf,
      brandFor,
      brandShareVolume,
      R2_DEFAULTS,
      migrateScenarioToUnified,
      migrateServiceTeamsToLeveraged,
      migrateConfigR2,
      groupScenarioIds: groupScenarioIds2,
      // Revision 3 (SPEC §24)
      migrateConfigR3,
      makeBlankConfig,
      runWorkflowDay,
      digitalSubtype,
      monthForWeek,
      generateWeeklySeries,
      primaryVoiceQueue,
      groupScopeQueueIds,
      applyGroupScope: applyGroupScope3,
      // Revision 3d (SPEC §25) — Digital Customer under Erlang
      runDigitalCustomerDay,
      reqCurveDigitalCustomer,
      customerPatience,
      customerMaxAbandon
    };
  }
});

// model/taxonomy.js
var require_taxonomy = __commonJS({
  "model/taxonomy.js"(exports, module) {
    var CHANNELS3 = ["voice", "third_party", "digital", "customer_management"];
    var ACTIVITIES2 = ["service_request", "lead", "decision", "collections", "upsell_xsell", "maintenance"];
    var PRODUCT_REQUESTS = ["new", "existing"];
    var QUEUE_TYPES2 = ["inbound_call", "outbound_call", "case_processing", "governance", "shared_capacity"];
    module.exports = { CHANNELS: CHANNELS3, ACTIVITIES: ACTIVITIES2, PRODUCT_REQUESTS, QUEUE_TYPES: QUEUE_TYPES2 };
  }
});

// model/bridge.js
var require_bridge = __commonJS({
  "model/bridge.js"(exports, module) {
    var { propagateDomain: propagateDomain2 } = require_propagate();
    var { DEFAULT_PROFILE } = require_engine();
    function engineTypeOf2(q) {
      if (q.staffing && q.staffing.type) return { type: q.staffing.type, subtype: q.staffing.subtype };
      if (q.type === "inbound_call" || q.type === "outbound_call") return { type: "voice" };
      return { type: "digital" };
    }
    var isSharedCapacity = (q) => q.type === "shared_capacity";
    function engineQueueDefaults2(brandId, channel) {
      return {
        brandId,
        channel,
        priority: 5,
        concurrency: 1,
        digitalSlaMinutes: 5,
        digitalSlaPct: 0.8,
        backlogLimit: 150,
        deflectsTo: null,
        crossSkill: [],
        supports: [],
        weeklyVolumes: null,
        seasonal: null,
        profile: [...DEFAULT_PROFILE],
        asaTarget: 30,
        maxAbandon: 0.05,
        patience: 90,
        shrinkage: 0.3,
        agentCost: 32e3,
        resourcing: "resourced",
        wf: { attrition: 0.04, attritionGrowth: 0, reqToStart: 6, trainingWeeks: 4, learningCurve: [0.6, 0.75, 0.9, 1], hires: [] },
        burn: { occThreshold: 0.85, sensitivity: 1.5, recovery: 8, maxAttritionMult: 2, absenceUplift: 0.05 }
      };
    }
    function domainToEngineConfig2(model) {
      const base = model.engineConfig;
      if (!base) throw new Error("domainToEngineConfig: model carries no engineConfig (migrate first, or attach one)");
      const p = propagateDomain2(model);
      const brandDefault = model.brands && model.brands[0] && model.brands[0].id || "b1";
      const queues = (model.queues || []).map((q) => {
        const d = p.queues.get(q.id) || { volume: 0, effectiveAht: q.fallbackAhtSec, weekly: null };
        const st = q.staffing || {};
        const et = engineTypeOf2(q);
        const channel = st.channel || (et.type === "voice" ? "voice" : "digital");
        const defaults = engineQueueDefaults2(q.homeBrandId || brandDefault, channel);
        const merged = { ...defaults, ...st };
        if (!st.wf && st.attritionPct != null) merged.wf = { ...defaults.wf, attrition: st.attritionPct / 100 / 12 };
        const hasShape = Array.isArray(d.weekly) && d.weekly.some((v) => Math.abs(v - d.volume) > 1e-9);
        const eq = {
          ...merged,
          id: q.id,
          name: q.name != null ? q.name : st.name,
          type: et.type,
          dailyVolume: d.volume,
          aht: d.effectiveAht,
          weeklyVolumes: hasShape ? d.weekly.slice() : null
        };
        if (et.subtype != null) eq.subtype = et.subtype;
        if (isSharedCapacity(q) && !st.resourcing) eq.resourcing = "leveraged";
        return eq;
      });
      return { ...base, queues };
    }
    module.exports = { domainToEngineConfig: domainToEngineConfig2, engineTypeOf: engineTypeOf2, engineQueueDefaults: engineQueueDefaults2, isSharedCapacity };
  }
});

// model/ops.js
var require_ops = __commonJS({
  "model/ops.js"(exports, module) {
    var {
      canDeleteBrand: canDeleteBrand2,
      canDeleteBU: canDeleteBU2,
      canDeleteChannel: canDeleteChannel2,
      canDeleteGroup: canDeleteGroup2,
      canDeleteProduct: canDeleteProduct2,
      canDeleteQueue: canDeleteQueue3,
      canDeleteRequestType: canDeleteRequestType2,
      keyOf: keyOf2,
      processesOf: processesOf2
    } = require_domain();
    var { CHANNELS: CHANNELS3 } = require_taxonomy();
    var { propagateDomain: propagateDomain2 } = require_propagate();
    var clone2 = (m) => JSON.parse(JSON.stringify(m));
    var _seq = 0;
    var uid = (p) => `${p}_${(++_seq).toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    function applyPatch(target, patch) {
      for (const [k, v] of Object.entries(patch)) {
        if (v === void 0) delete target[k];
        else target[k] = v;
      }
    }
    function addToList(listKey, prefix) {
      return (model, item = {}) => {
        const m = clone2(model);
        m[listKey] = m[listKey] || [];
        m[listKey].push({ id: item.id || uid(prefix), name: item.name || prefix, ...item });
        return m;
      };
    }
    function renameInList(listKey) {
      return (model, id, name) => {
        const m = clone2(model);
        const x = (m[listKey] || []).find((e) => e.id === id);
        if (x) x.name = name;
        return m;
      };
    }
    function deleteFromList(listKey, guardFn) {
      return (model, id) => {
        if (guardFn && !guardFn(model, id).ok) return model;
        const m = clone2(model);
        m[listKey] = (m[listKey] || []).filter((e) => e.id !== id);
        return m;
      };
    }
    var addBrand2 = addToList("brands", "b");
    var renameBrand2 = renameInList("brands");
    var deleteBrand2 = deleteFromList("brands", canDeleteBrand2);
    var addBusinessUnit2 = addToList("businessUnits", "bu");
    var renameBusinessUnit2 = renameInList("businessUnits");
    var deleteBusinessUnit2 = deleteFromList("businessUnits", canDeleteBU2);
    var addProcessGroup2 = addToList("processGroups", "pg");
    var renameProcessGroup2 = renameInList("processGroups");
    var deleteProcessGroup2 = deleteFromList("processGroups", canDeleteGroup2);
    var addProduct2 = (model, item = {}) => addToList("products", "prod")(model, item);
    function setProductBrand2(model, productId, brandId) {
      const m = clone2(model);
      const pr = (m.products || []).find((x) => x.id === productId);
      if (pr) {
        if (brandId) pr.brandId = brandId;
        else delete pr.brandId;
      }
      return m;
    }
    var renameProduct2 = renameInList("products");
    var deleteProduct2 = deleteFromList("products", canDeleteProduct2);
    function addChannel2(model, { key, id, name, defaults } = {}) {
      const taxonomy = CHANNELS3.includes(key);
      if (taxonomy && (model.channels || []).some((c) => c.key === key)) return model;
      if (!taxonomy && !(name && String(name).trim())) return model;
      const m = clone2(model);
      m.channels = m.channels || [];
      const k = taxonomy ? key : key || uid("chk");
      m.channels.push({ id: id || (taxonomy ? "ch_" + key : uid("ch")), key: k, name: name || key, ...defaults ? { defaults } : {} });
      return m;
    }
    function withDefaultChannels(model) {
      let m = model;
      for (const key of CHANNELS3) m = addChannel2(m, { key, name: CHANNEL_NAMES[key] });
      return m;
    }
    var CHANNEL_NAMES = { voice: "Voice", third_party: "Third party", digital: "Digital", customer_management: "Customer management" };
    var renameChannel2 = renameInList("channels");
    var deleteChannel2 = deleteFromList("channels", canDeleteChannel2);
    function setChannelDefaults2(model, channelId, patch) {
      const m = clone2(model);
      const c = (m.channels || []).find((x) => x.id === channelId);
      if (c) {
        c.defaults = c.defaults || {};
        applyPatch(c.defaults, patch);
      }
      return m;
    }
    var DEFAULT_STAFFING = {
      asaTarget: 30,
      maxAbandon: 0.05,
      patience: 90,
      shrinkage: 0.3,
      agentCost: 32e3,
      resourcing: "dedicated",
      occupancyCeiling: 0.85,
      churnCost: 500,
      failedToChurnPct: 6,
      attritionPct: 26
    };
    function addQueue2(model, { id, name, type, homeBrandId, homeBuId, fallbackAhtSec } = {}) {
      const m = clone2(model);
      m.queues = m.queues || [];
      const t = type || "inbound_call";
      const q = {
        id: id || uid("q"),
        name: name || `Queue ${m.queues.length + 1}`,
        type: t,
        fallbackAhtSec: fallbackAhtSec != null ? fallbackAhtSec : 300,
        // A shared-capacity queue lends hours to whatever routes through it rather
        // than being sized against its own SLA — that is "leveraged" to the engine.
        staffing: { ...DEFAULT_STAFFING, ...t === "shared_capacity" ? { resourcing: "leveraged" } : {} }
      };
      if (homeBrandId) q.homeBrandId = homeBrandId;
      if (homeBuId) q.homeBuId = homeBuId;
      m.queues.push(q);
      return m;
    }
    function updateQueue2(model, queueId, patch) {
      const m = clone2(model);
      const q = (m.queues || []).find((x) => x.id === queueId);
      if (q) {
        applyPatch(q, patch);
        if (patch.type === "shared_capacity" && q.staffing && q.staffing.resourcing === "dedicated")
          q.staffing.resourcing = "leveraged";
      }
      return m;
    }
    function updateQueueStaffing2(model, queueId, patch) {
      const m = clone2(model);
      const q = (m.queues || []).find((x) => x.id === queueId);
      if (q) {
        q.staffing = q.staffing || {};
        applyPatch(q.staffing, patch);
        q._modified = true;
      }
      return m;
    }
    function resetQueueStaffing2(model, queueId) {
      const m = clone2(model);
      const q = (m.queues || []).find((x) => x.id === queueId);
      if (q) {
        q.staffing = { ...DEFAULT_STAFFING };
        delete q._modified;
      }
      return m;
    }
    var deleteQueue2 = deleteFromList("queues", canDeleteQueue3);
    function addServiceTeam(model, team = {}) {
      const m = clone2(model);
      m.engineConfig = m.engineConfig || {};
      m.engineConfig.serviceTeams = m.engineConfig.serviceTeams || [];
      m.engineConfig.serviceTeams.push({
        id: team.id || uid("st"),
        name: team.name || "Shared team",
        size: 5,
        premiumPct: 0.1,
        proficiency: 0.8,
        triggerOccupancy: 0.9,
        maxHoursPerWeek: 100,
        agentCost: 32e3,
        coversQueues: [],
        ...team
      });
      return m;
    }
    function updateServiceTeam(model, teamId, patch) {
      const m = clone2(model);
      const t = ((m.engineConfig || {}).serviceTeams || []).find((x) => x.id === teamId);
      if (t) applyPatch(t, patch);
      return m;
    }
    function deleteServiceTeam(model, teamId) {
      const m = clone2(model);
      if (m.engineConfig && m.engineConfig.serviceTeams)
        m.engineConfig.serviceTeams = m.engineConfig.serviceTeams.filter((x) => x.id !== teamId);
      return m;
    }
    function addRequestType2(model, { id, name, groupId, activity, productRequest, productId } = {}) {
      const m = clone2(model);
      m.requestTypes = m.requestTypes || [];
      const rt = {
        id: id || uid("rt"),
        name: name || "New request type",
        activity: activity || "service_request",
        productRequest: productRequest || "existing",
        groupId,
        brandIds: [],
        buIds: [],
        processIds: []
      };
      if (productId != null) rt.productId = productId;
      m.requestTypes.push(rt);
      return m;
    }
    function updateRequestType2(model, rtId, patch) {
      const m = clone2(model);
      const rt = (m.requestTypes || []).find((x) => x.id === rtId);
      if (rt) applyPatch(rt, patch);
      return m;
    }
    function setAssignment2(model, rtId, { brandIds, buIds } = {}) {
      const m = clone2(model);
      const rt = (m.requestTypes || []).find((x) => x.id === rtId);
      if (rt) {
        if (brandIds) rt.brandIds = [...brandIds];
        if (buIds) rt.buIds = [...buIds];
      }
      return m;
    }
    var deleteRequestType2 = deleteFromList("requestTypes", canDeleteRequestType2);
    var procOf = (m, rtId, channelId) => {
      const rt = (m.requestTypes || []).find((x) => x.id === rtId);
      return rt ? { rt, p: processesOf2(m, rt).find((x) => x.channelId === channelId) } : { rt: null, p: null };
    };
    function createProcess2(model, { id, name, channelId, groupId, outcomes } = {}) {
      const m = clone2(model);
      m.processes = m.processes || [];
      m.processes.push({
        id: id || uid("proc"),
        name: name || "New process",
        channelId,
        ...groupId ? { groupId } : {},
        outcomes: outcomes ? [...outcomes] : ["completed"],
        steps: []
      });
      return m;
    }
    function updateProcessMeta2(model, processId, patch) {
      const m = clone2(model);
      const pr = (m.processes || []).find((x) => x.id === processId);
      if (pr) applyPatch(pr, patch);
      return m;
    }
    function deleteProcessById2(model, processId) {
      const m = clone2(model);
      m.processes = (m.processes || []).filter((x) => x.id !== processId);
      for (const rt of m.requestTypes || [])
        if (Array.isArray(rt.processIds)) rt.processIds = rt.processIds.filter((id) => id !== processId);
      return m;
    }
    function processUsage2(model, processId) {
      const rts = (model.requestTypes || []).filter((rt) => (rt.processIds || []).includes(processId));
      const brands = /* @__PURE__ */ new Set();
      for (const rt of rts) for (const b of rt.brandIds || []) brands.add(b);
      return { requestTypes: rts.length, brands: brands.size, names: rts.map((r) => r.name) };
    }
    function attachProcess2(model, rtId, processId) {
      const m = clone2(model);
      const rt = (m.requestTypes || []).find((x) => x.id === rtId);
      const pr = (m.processes || []).find((x) => x.id === processId);
      if (!rt || !pr) return model;
      rt.processIds = rt.processIds || [];
      if (rt.processIds.includes(processId)) return model;
      const taken = processesOf2(m, rt).some((x) => x.channelId === pr.channelId);
      if (taken) return model;
      rt.processIds.push(processId);
      return m;
    }
    function detachProcess(model, rtId, processId) {
      const m = clone2(model);
      const rt = (m.requestTypes || []).find((x) => x.id === rtId);
      if (!rt || !Array.isArray(rt.processIds)) return model;
      rt.processIds = rt.processIds.filter((id) => id !== processId);
      return m;
    }
    function addProcess2(model, rtId, channelId) {
      const { rt, p } = procOf(model, rtId, channelId);
      if (!rt || p) return model;
      const rtName = rt.name || "Process";
      const chName = ((model.channels || []).find((c) => c.id === channelId) || {}).name || channelId;
      let m = createProcess2(model, { name: `${rtName} \u2014 ${chName}`, channelId, groupId: rt.groupId });
      const created = m.processes[m.processes.length - 1];
      return attachProcess2(m, rtId, created.id);
    }
    function deleteProcess2(model, rtId, channelId) {
      const { p } = procOf(model, rtId, channelId);
      if (!p) return model;
      return p.id ? detachProcess(model, rtId, p.id) : legacyDropProcess(model, rtId, channelId);
    }
    function legacyDropProcess(model, rtId, channelId) {
      const m = clone2(model);
      const rt2 = m.requestTypes.find((x) => x.id === rtId);
      if (rt2 && rt2.processes) rt2.processes = rt2.processes.filter((x) => x.channelId !== channelId);
      return m;
    }
    function addStep(model, rtId, channelId, { queueId, splitPct, samplingPct } = {}) {
      const { p } = procOf(model, rtId, channelId);
      if (!p) return model;
      const m = clone2(model);
      const p2 = procOf(m, rtId, channelId).p;
      const step = { queueId, splitPct: splitPct != null ? splitPct : 100 };
      if (samplingPct != null) step.samplingPct = samplingPct;
      p2.steps.push(step);
      return m;
    }
    function updateStep(model, rtId, channelId, index, patch) {
      const { p } = procOf(model, rtId, channelId);
      if (!p || !p.steps[index]) return model;
      const m = clone2(model);
      const step = procOf(m, rtId, channelId).p.steps[index];
      applyPatch(step, patch);
      if (patch.terminal === false) {
        delete step.terminal;
        delete step.outcome;
      }
      return m;
    }
    function removeStep(model, rtId, channelId, index) {
      const { p } = procOf(model, rtId, channelId);
      if (!p || !p.steps[index]) return model;
      const m = clone2(model);
      procOf(m, rtId, channelId).p.steps.splice(index, 1);
      return m;
    }
    var byProcId = (m, processId) => (m.processes || []).find((x) => x.id === processId);
    function addProcessStep2(model, processId, { queueId, splitPct, samplingPct } = {}) {
      const m = clone2(model);
      const pr = byProcId(m, processId);
      if (!pr) return model;
      const step = { queueId, splitPct: splitPct != null ? splitPct : 100 };
      if (samplingPct != null) step.samplingPct = samplingPct;
      pr.steps.push(step);
      return m;
    }
    function updateProcessStep2(model, processId, index, patch) {
      const m = clone2(model);
      const pr = byProcId(m, processId);
      if (!pr || !pr.steps[index]) return model;
      applyPatch(pr.steps[index], patch);
      if (patch.terminal === false) {
        delete pr.steps[index].terminal;
        delete pr.steps[index].outcome;
      }
      return m;
    }
    function removeProcessStep2(model, processId, index) {
      const m = clone2(model);
      const pr = byProcId(m, processId);
      if (!pr || !pr.steps[index]) return model;
      pr.steps.splice(index, 1);
      return m;
    }
    function setProcessOutcomes2(model, processId, outcomes) {
      const m = clone2(model);
      const pr = byProcId(m, processId);
      if (!pr) return model;
      pr.outcomes = [...outcomes];
      return m;
    }
    function setOutcomes(model, rtId, channelId, outcomes) {
      const { p } = procOf(model, rtId, channelId);
      if (!p) return model;
      const m = clone2(model);
      procOf(m, rtId, channelId).p.outcomes = [...outcomes];
      return m;
    }
    function setVolumeEntry2(model, scope, { daily, weekly } = {}) {
      const m = clone2(model);
      m.volumeEntries = (m.volumeEntries || []).filter((e2) => keyOf2(e2.scope || {}) !== keyOf2(scope || {}));
      const e = { id: uid("ve"), scope: { ...scope } };
      if (daily != null) e.daily = daily;
      if (weekly != null) e.weekly = [...weekly];
      if (e.daily != null || e.weekly != null) m.volumeEntries.push(e);
      return m;
    }
    function clearVolumeEntry2(model, scope) {
      const m = clone2(model);
      m.volumeEntries = (m.volumeEntries || []).filter((e) => keyOf2(e.scope || {}) !== keyOf2(scope || {}));
      return m;
    }
    function blankDomainModel2(engineConfig) {
      const m = { brands: [], businessUnits: [], channels: [], processGroups: [], products: [], processes: [], queues: [], requestTypes: [], volumeEntries: [] };
      if (engineConfig) m.engineConfig = engineConfig;
      return withDefaultChannels(m);
    }
    function sampleDomainModel() {
      return {
        brands: [{ id: "b_acme", name: "Acme" }],
        businessUnits: [{ id: "bu_cs", name: "Customer Service" }],
        channels: [{ id: "ch_voice", key: "voice", name: "Voice" }, { id: "ch_digital", key: "digital", name: "Digital" }],
        processGroups: [{ id: "pg_billing", name: "Billing" }, { id: "pg_cards", name: "Cards" }],
        products: [{ id: "prod_cards", name: "Credit cards", brandId: "b_acme" }],
        // Processes are defined once and referenced; q_qa is reached from both.
        processes: [
          {
            id: "proc_billing_voice",
            name: "Billing enquiry \u2014 Voice",
            channelId: "ch_voice",
            groupId: "pg_billing",
            outcomes: ["completed"],
            steps: [
              { queueId: "q_inbound", splitPct: 100 },
              { queueId: "q_qa", splitPct: 100, samplingPct: 2, terminal: true, outcome: "completed" }
            ]
          },
          {
            id: "proc_newcard_digital",
            name: "New card \u2014 Digital",
            channelId: "ch_digital",
            groupId: "pg_cards",
            outcomes: ["completed", "rejected"],
            steps: [
              { queueId: "q_apps", splitPct: 100 },
              { queueId: "q_verify", splitPct: 60 },
              { queueId: "q_qa", splitPct: 100, samplingPct: 5, terminal: true, outcome: "completed" }
            ]
          }
        ],
        queues: [
          { id: "q_inbound", name: "Inbound \u2014 Billing", type: "inbound_call", homeBrandId: "b_acme", homeBuId: "bu_cs", fallbackAhtSec: 300, staffing: { ...DEFAULT_STAFFING } },
          { id: "q_verify", name: "Outbound \u2014 Verification", type: "outbound_call", homeBrandId: "b_acme", homeBuId: "bu_cs", fallbackAhtSec: 240, staffing: { ...DEFAULT_STAFFING } },
          { id: "q_apps", name: "Case \u2014 Applications", type: "case_processing", homeBrandId: "b_acme", homeBuId: "bu_cs", fallbackAhtSec: 540, staffing: { ...DEFAULT_STAFFING } },
          { id: "q_qa", name: "QA \u2014 Governance", type: "governance", fallbackAhtSec: 600, staffing: { ...DEFAULT_STAFFING } }
        ],
        requestTypes: [
          {
            id: "rt_billing",
            name: "Billing enquiry",
            activity: "service_request",
            productRequest: "existing",
            groupId: "pg_billing",
            brandIds: ["b_acme"],
            buIds: ["bu_cs"],
            processIds: ["proc_billing_voice"]
          },
          {
            id: "rt_newcard",
            name: "New card application",
            activity: "service_request",
            productRequest: "new",
            groupId: "pg_cards",
            productId: "prod_cards",
            ahtSec: 540,
            brandIds: ["b_acme"],
            buIds: ["bu_cs"],
            processIds: ["proc_newcard_digital"]
          }
        ],
        volumeEntries: [
          { id: "ve_billing", scope: { brandId: "b_acme", buId: "bu_cs", requestTypeId: "rt_billing" }, daily: 2398 },
          { id: "ve_newcard", scope: { brandId: "b_acme", buId: "bu_cs", requestTypeId: "rt_newcard" }, daily: 702 }
        ]
      };
    }
    function buildDomainImportReport2(model) {
      const v = propagateDomain2(model).validation;
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
          volumeEntries: (model.volumeEntries || []).length
        },
        errors: v.errors,
        warnings: v.warnings
      };
    }
    module.exports = {
      DEFAULT_STAFFING,
      uid,
      addBrand: addBrand2,
      renameBrand: renameBrand2,
      deleteBrand: deleteBrand2,
      addBusinessUnit: addBusinessUnit2,
      renameBusinessUnit: renameBusinessUnit2,
      deleteBusinessUnit: deleteBusinessUnit2,
      addProcessGroup: addProcessGroup2,
      renameProcessGroup: renameProcessGroup2,
      deleteProcessGroup: deleteProcessGroup2,
      addProduct: addProduct2,
      renameProduct: renameProduct2,
      deleteProduct: deleteProduct2,
      addChannel: addChannel2,
      renameChannel: renameChannel2,
      deleteChannel: deleteChannel2,
      setChannelDefaults: setChannelDefaults2,
      withDefaultChannels,
      CHANNEL_NAMES,
      setProductBrand: setProductBrand2,
      createProcess: createProcess2,
      updateProcessMeta: updateProcessMeta2,
      deleteProcessById: deleteProcessById2,
      processUsage: processUsage2,
      attachProcess: attachProcess2,
      detachProcess,
      addProcessStep: addProcessStep2,
      updateProcessStep: updateProcessStep2,
      removeProcessStep: removeProcessStep2,
      setProcessOutcomes: setProcessOutcomes2,
      addQueue: addQueue2,
      updateQueue: updateQueue2,
      updateQueueStaffing: updateQueueStaffing2,
      resetQueueStaffing: resetQueueStaffing2,
      deleteQueue: deleteQueue2,
      addServiceTeam,
      updateServiceTeam,
      deleteServiceTeam,
      addRequestType: addRequestType2,
      updateRequestType: updateRequestType2,
      setAssignment: setAssignment2,
      deleteRequestType: deleteRequestType2,
      addProcess: addProcess2,
      deleteProcess: deleteProcess2,
      addStep,
      updateStep,
      removeStep,
      setOutcomes,
      setVolumeEntry: setVolumeEntry2,
      clearVolumeEntry: clearVolumeEntry2,
      blankDomainModel: blankDomainModel2,
      sampleDomainModel,
      buildDomainImportReport: buildDomainImportReport2
    };
  }
});

// model/derive.js
var require_derive = __commonJS({
  "model/derive.js"(exports, module) {
    var LEVEL_DEPTH = { bu: 1, product: 2, channel: 3 };
    function indexStructure2(model) {
      const nodes = /* @__PURE__ */ new Map();
      const add = (id, level, name, parentId) => {
        const parent = parentId != null ? nodes.get(parentId) : null;
        const path = parent ? [...parent.path, id] : [id];
        const label = parent ? `${parent.label} \u203A ${name}` : name;
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
    var profileNodeId = (profile) => profile.appliesAt && profile.appliesAt.nodeId;
    function deriveServiceVolumes2(model, struct = indexStructure2(model)) {
      const perService = /* @__PURE__ */ new Map();
      for (const prof of model.profiles || []) {
        const nodeId = profileNodeId(prof);
        for (const m of prof.mix || []) {
          if (!perService.has(m.serviceId)) perService.set(m.serviceId, []);
          perService.get(m.serviceId).push({
            profileId: prof.id,
            nodeId,
            pct: m.pct || 0,
            total: prof.totalVolume || 0
          });
        }
      }
      const out = /* @__PURE__ */ new Map();
      for (const [serviceId, contribs] of perService) {
        const kept = contribs.map((c) => ({ ...c, superseded: false }));
        for (const c of kept) {
          for (const d of kept) {
            if (c === d || c.nodeId == null || d.nodeId == null) continue;
            if (c.nodeId !== d.nodeId && struct.isAncestorOrSelf(c.nodeId, d.nodeId)) {
              c.superseded = true;
            }
          }
        }
        let volume = 0;
        const sources = kept.map((c) => {
          const v = c.superseded ? 0 : c.total * c.pct / 100;
          volume += v;
          return { profileId: c.profileId, nodeId: c.nodeId, pct: c.pct, total: c.total, volume: v, superseded: c.superseded };
        });
        out.set(serviceId, { volume, sources });
      }
      return out;
    }
    function deriveQueueWorkload2(model, opts = {}) {
      const struct = opts.struct || indexStructure2(model);
      const svcVol = opts.serviceVolumes || deriveServiceVolumes2(model, struct);
      const queueById = new Map((model.queues || []).map((q) => [q.id, q]));
      const serviceById = new Map((model.services || []).map((s) => [s.id, s]));
      const agg = /* @__PURE__ */ new Map();
      for (const svc of model.services || []) {
        const sv = svcVol.get(svc.id);
        const serviceVolume = sv ? sv.volume : 0;
        for (const step of svc.journey || []) {
          const q = queueById.get(step.queueId);
          if (!q) continue;
          const split = (step.splitPct != null ? step.splitPct : 100) / 100;
          const sampling = (step.samplingPct != null ? step.samplingPct : 100) / 100;
          const stepVolume = serviceVolume * split * sampling;
          const svcAht = svc.ahtSec != null ? svc.ahtSec : q.fallbackAhtSec;
          const ahtSource = svc.ahtSec != null ? "svc" : "fallback";
          if (!agg.has(q.id)) agg.set(q.id, { volume: 0, minuteSum: 0, byService: [] });
          const a = agg.get(q.id);
          a.volume += stepVolume;
          a.minuteSum += stepVolume * svcAht;
          a.byService.push({
            serviceId: svc.id,
            serviceName: svc.name,
            volume: stepVolume,
            aht: svcAht,
            ahtSource,
            splitPct: step.splitPct != null ? step.splitPct : 100,
            samplingPct: step.samplingPct != null ? step.samplingPct : 100
          });
        }
      }
      const out = /* @__PURE__ */ new Map();
      for (const q of model.queues || []) {
        const a = agg.get(q.id) || { volume: 0, minuteSum: 0, byService: [] };
        const effectiveAht = a.volume > 0 ? a.minuteSum / a.volume : q.fallbackAhtSec;
        const contributing = a.byService.filter((s) => s.volume > 0);
        const marker = contributing.length <= 1 ? contributing[0] && contributing[0].ahtSource === "svc" ? "svc" : "queue" : "weighted";
        out.set(q.id, {
          queueId: q.id,
          name: q.name,
          type: q.type,
          shared: q.attachment && q.attachment.kind === "shared",
          volume: a.volume,
          effectiveAht,
          ahtMarker: marker,
          byService: a.byService.sort((x, y) => y.volume - x.volume)
        });
      }
      return out;
    }
    function crossStructureWarnings(model, struct = indexStructure2(model)) {
      const warnings = [];
      const queueById = new Map((model.queues || []).map((q) => [q.id, q]));
      const svcVol = deriveServiceVolumes2(model, struct);
      for (const svc of model.services || []) {
        const sv = svcVol.get(svc.id);
        const sources = sv ? sv.sources.filter((s) => !s.superseded && s.nodeId != null && s.volume > 0) : [];
        if (!sources.length) continue;
        for (const step of svc.journey || []) {
          const q = queueById.get(step.queueId);
          if (!q || !q.attachment || q.attachment.kind !== "structural") continue;
          const chId = q.attachment.channelInstanceId;
          const qn = struct.nodes.get(chId);
          for (const src of sources) {
            if (struct.isAncestorOrSelf(src.nodeId, chId)) continue;
            const fn = struct.nodes.get(src.nodeId);
            warnings.push({
              kind: "cross_structure",
              profileId: src.profileId,
              serviceId: svc.id,
              serviceName: svc.name,
              queueId: q.id,
              queueName: q.name,
              queuePath: qn ? qn.label : chId,
              feedNodePath: fn ? fn.label : src.nodeId,
              message: `Service "${svc.name}" routes to structural queue "${q.name}" (${qn ? qn.label : chId}) but volume from ${fn ? fn.label : src.nodeId} enters outside that path.`
            });
          }
        }
      }
      return warnings;
    }
    function mixWarnings(model) {
      const warnings = [];
      for (const prof of model.profiles || []) {
        const sum = (prof.mix || []).reduce((a, m) => a + (m.pct || 0), 0);
        if (sum < 100 - 1e-9) {
          warnings.push({
            kind: "unmodelled_remainder",
            profileId: prof.id,
            sumPct: sum,
            remainderPct: 100 - sum,
            message: `Profile mix sums to ${sum}% \u2014 ${(100 - sum).toFixed(1)}% of volume is unmodelled.`
          });
        }
      }
      return warnings;
    }
    function sharedQueueAllocation(model, opts = {}) {
      const struct = opts.struct || indexStructure2(model);
      const svcVol = opts.serviceVolumes || deriveServiceVolumes2(model, struct);
      const queueById = new Map((model.queues || []).map((q) => [q.id, q]));
      const out = /* @__PURE__ */ new Map();
      for (const q of model.queues || []) {
        if (!q.attachment || q.attachment.kind !== "shared") continue;
        const byNode = /* @__PURE__ */ new Map();
        for (const svc of model.services || []) {
          const step = (svc.journey || []).find((s) => s.queueId === q.id);
          if (!step) continue;
          const sv = svcVol.get(svc.id);
          if (!sv || sv.volume <= 0) continue;
          const split = (step.splitPct != null ? step.splitPct : 100) / 100;
          const sampling = (step.samplingPct != null ? step.samplingPct : 100) / 100;
          const svcAht = svc.ahtSec != null ? svc.ahtSec : q.fallbackAhtSec;
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
          nodeId,
          label: (struct.nodes.get(nodeId) || {}).label || nodeId,
          minutes,
          sharePct: total > 0 ? minutes / total * 100 : 0
        })).sort((a, b) => b.minutes - a.minutes);
        out.set(q.id, { queueId: q.id, name: q.name, totalMinutes: total, byNode: rows });
      }
      return out;
    }
    function canDeleteQueue3(model, queueId) {
      const blockedBy = (model.services || []).filter((s) => (s.journey || []).some((step) => step.queueId === queueId)).map((s) => ({ serviceId: s.id, serviceName: s.name }));
      return { ok: blockedBy.length === 0, blockedBy };
    }
    function canDeleteService2(model, serviceId) {
      const blockedBy = (model.profiles || []).filter((p) => (p.mix || []).some((m) => m.serviceId === serviceId)).map((p) => ({ profileId: p.id }));
      return { ok: blockedBy.length === 0, blockedBy };
    }
    function validateModel(model, struct = indexStructure2(model)) {
      const errors = [], warnings = [];
      const queueIds = new Set((model.queues || []).map((q) => q.id));
      const serviceIds = new Set((model.services || []).map((s) => s.id));
      for (const svc of model.services || []) {
        for (const step of svc.journey || []) {
          if (!queueIds.has(step.queueId)) {
            errors.push({
              kind: "dangling_journey_queue",
              serviceId: svc.id,
              queueId: step.queueId,
              message: `Service "${svc.name}" journey references missing queue ${step.queueId}.`
            });
          }
        }
      }
      for (const prof of model.profiles || []) {
        for (const m of prof.mix || []) {
          if (!serviceIds.has(m.serviceId)) {
            errors.push({
              kind: "dangling_mix_service",
              profileId: prof.id,
              serviceId: m.serviceId,
              message: `Profile ${prof.id} mix references missing service ${m.serviceId}.`
            });
          }
        }
        const nodeId = profileNodeId(prof);
        if (nodeId != null && !struct.nodes.has(nodeId)) {
          errors.push({
            kind: "dangling_profile_node",
            profileId: prof.id,
            nodeId,
            message: `Profile ${prof.id} applies at missing structure node ${nodeId}.`
          });
        }
        const sum = (prof.mix || []).reduce((a, m) => a + (m.pct || 0), 0);
        if (sum > 100 + 1e-9) {
          errors.push({
            kind: "mix_over_100",
            profileId: prof.id,
            sumPct: sum,
            message: `Profile ${prof.id} mix sums to ${sum}% (>100%).`
          });
        }
      }
      warnings.push(...mixWarnings(model));
      warnings.push(...crossStructureWarnings(model, struct));
      return { ok: errors.length === 0, errors, warnings };
    }
    function derive2(model) {
      const struct = indexStructure2(model);
      const serviceVolumes = deriveServiceVolumes2(model, struct);
      const queues = deriveQueueWorkload2(model, { struct, serviceVolumes });
      const sharedAllocation = sharedQueueAllocation(model, { struct, serviceVolumes });
      const validation = validateModel(model, struct);
      return {
        serviceVolumes: mapToObj(serviceVolumes),
        queues: mapToObj(queues),
        sharedAllocation: mapToObj(sharedAllocation),
        validation
      };
    }
    function mapToObj(m) {
      const o = {};
      for (const [k, v] of m) o[k] = v;
      return o;
    }
    module.exports = {
      LEVEL_DEPTH,
      indexStructure: indexStructure2,
      deriveServiceVolumes: deriveServiceVolumes2,
      deriveQueueWorkload: deriveQueueWorkload2,
      crossStructureWarnings,
      mixWarnings,
      sharedQueueAllocation,
      canDeleteQueue: canDeleteQueue3,
      canDeleteService: canDeleteService2,
      validateModel,
      derive: derive2
    };
  }
});

// model/migrate.js
var require_migrate = __commonJS({
  "model/migrate.js"(exports, module) {
    var CHANNEL_MAP = { voice: "voice", digital: "digital" };
    function v2QueueType(q) {
      if (q.type === "voice") return "inbound_call";
      return "case_processing";
    }
    function migrateV1ToV22(cfg) {
      const brands = [];
      const queues = [];
      const services = [];
      const profiles = [];
      const byBrand = /* @__PURE__ */ new Map();
      for (const q of cfg.queues || []) {
        const bId = q.brandId || "b1";
        if (!byBrand.has(bId)) byBrand.set(bId, []);
        byBrand.get(bId).push(q);
      }
      for (const b of cfg.brands || []) {
        const bQueues = byBrand.get(b.id) || [];
        const buId = `bu_${b.id}`;
        const prodId = `prod_${b.id}`;
        const channelInstances = /* @__PURE__ */ new Map();
        for (const q of bQueues) {
          const ch = CHANNEL_MAP[q.channel] || "digital";
          if (!channelInstances.has(ch)) channelInstances.set(ch, `ci_${b.id}_${ch}`);
        }
        brands.push({
          id: b.id,
          name: b.name,
          businessUnits: [{
            id: buId,
            name: `${b.name} \u2014 Main`,
            products: [{
              id: prodId,
              name: "Main",
              channels: [...channelInstances.entries()].map(([channel, id]) => ({ id, channel }))
            }]
          }]
        });
        for (const q of bQueues) {
          const ch = CHANNEL_MAP[q.channel] || "digital";
          const ciId = channelInstances.get(ch);
          const svcId = `svc_${q.id}`;
          const pfId = `pf_${q.id}`;
          queues.push({
            id: q.id,
            name: q.name,
            type: v2QueueType(q),
            attachment: { kind: "structural", channelInstanceId: ciId },
            fallbackAhtSec: q.aht,
            staffing: q
          });
          services.push({
            id: svcId,
            name: `${q.name} demand`,
            activity: "service_request",
            productRequest: "existing",
            ahtSec: q.aht,
            journey: [{ queueId: q.id, splitPct: 100 }]
          });
          profiles.push({
            id: pfId,
            appliesAt: { level: "channel", nodeId: ciId },
            totalVolume: q.dailyVolume,
            mix: [{ serviceId: svcId, pct: 100 }]
          });
        }
      }
      const engineConfig = { ...cfg };
      delete engineConfig.queues;
      return { brands, queues, services, profiles, engineConfig };
    }
    module.exports = { migrateV1ToV2: migrateV1ToV22, CHANNEL_MAP, v2QueueType };
  }
});

// model/adapter.js
var require_adapter = __commonJS({
  "model/adapter.js"(exports, module) {
    var D = require_derive();
    var { DEFAULT_PROFILE } = require_engine();
    function engineTypeOf2(q) {
      if (q.staffing && q.staffing.type) return { type: q.staffing.type, subtype: q.staffing.subtype };
      if (q.type === "inbound_call" || q.type === "outbound_call") return { type: "voice" };
      return { type: "digital" };
    }
    function v2ToEngineConfig2(model, opts = {}) {
      const struct = D.indexStructure(model);
      const serviceVolumes = D.deriveServiceVolumes(model, struct);
      const derived = D.deriveQueueWorkload(model, { struct, serviceVolumes });
      const base = model.engineConfig || opts.engineConfig;
      if (!base) throw new Error("v2ToEngineConfig: no engineConfig carried on the model (migrate first, or pass opts.engineConfig)");
      const brandDefault = model.brands && model.brands[0] && model.brands[0].id || "b1";
      const resolveChannelBrand = (q) => {
        if (q.attachment && q.attachment.kind === "structural") {
          const n = struct.nodes.get(q.attachment.channelInstanceId);
          if (n && n.path && n.path.length) return { channel: n.name, brandId: n.path[0] };
        }
        return { channel: q.type === "inbound_call" || q.type === "outbound_call" ? "voice" : "digital", brandId: brandDefault };
      };
      const queues = (model.queues || []).map((q) => {
        const d = derived.get(q.id) || { volume: 0, effectiveAht: q.fallbackAhtSec };
        const st = q.staffing || {};
        const et = engineTypeOf2(q);
        const cb = resolveChannelBrand(q);
        const defaults = engineQueueDefaults2(cb);
        const merged = { ...defaults, ...st };
        if (!st.wf && st.attritionPct != null) merged.wf = { ...defaults.wf, attrition: st.attritionPct / 100 / 12 };
        const eq = {
          ...merged,
          id: q.id,
          name: q.name != null ? q.name : st.name,
          type: et.type,
          brandId: merged.brandId,
          channel: merged.channel,
          dailyVolume: d.volume,
          aht: d.effectiveAht
        };
        if (et.subtype != null) eq.subtype = et.subtype;
        return eq;
      });
      return { ...base, queues };
    }
    function engineQueueDefaults2(cb) {
      return {
        brandId: cb.brandId,
        channel: cb.channel,
        priority: 5,
        concurrency: 1,
        digitalSlaMinutes: 5,
        digitalSlaPct: 0.8,
        backlogLimit: 150,
        deflectsTo: null,
        crossSkill: [],
        supports: [],
        weeklyVolumes: null,
        seasonal: null,
        profile: [...DEFAULT_PROFILE],
        // intraday arrival pattern (normProfile WeakMap key)
        asaTarget: 30,
        maxAbandon: 0.05,
        patience: 90,
        shrinkage: 0.3,
        agentCost: 32e3,
        resourcing: "resourced",
        wf: { attrition: 0.04, attritionGrowth: 0, reqToStart: 6, trainingWeeks: 4, learningCurve: [0.6, 0.75, 0.9, 1], hires: [] },
        burn: { occThreshold: 0.85, sensitivity: 1.5, recovery: 8, maxAttritionMult: 2, absenceUplift: 0.05 }
      };
    }
    function roundTripConfig(cfg) {
      const { migrateV1ToV2: migrateV1ToV22 } = require_migrate();
      return v2ToEngineConfig2(migrateV1ToV22(cfg));
    }
    module.exports = { v2ToEngineConfig: v2ToEngineConfig2, roundTripConfig, engineTypeOf: engineTypeOf2 };
  }
});

// model/migrate-domain.js
var require_migrate_domain = __commonJS({
  "model/migrate-domain.js"(exports, module) {
    var { indexStructure: indexStructure2, deriveServiceVolumes: deriveServiceVolumes2 } = require_derive();
    var CH_LABEL = { voice: "Voice", third_party: "Third party", digital: "Digital", customer_management: "Customer management" };
    function queueChannelKey(q) {
      if (q.staffing && q.staffing.channel === "voice") return "voice";
      if (q.type === "inbound_call" || q.type === "outbound_call") return "voice";
      return "digital";
    }
    function migrateV2ToDomain2(v2) {
      const struct = indexStructure2(v2);
      const sv = deriveServiceVolumes2(v2, struct);
      const brands = (v2.brands || []).map((b) => ({ id: b.id, name: b.name }));
      const businessUnits = [];
      for (const b of v2.brands || []) for (const bu of b.businessUnits || [])
        businessUnits.push({ id: bu.id, name: bu.name });
      const chKeys = [...new Set((v2.queues || []).map(queueChannelKey))];
      const channels = chKeys.map((k) => ({ id: "ch_" + k, key: k, name: CH_LABEL[k] || k }));
      const chIdOf = (k) => "ch_" + k;
      const products = [];
      for (const b of v2.brands || []) for (const bu of b.businessUnits || []) for (const p of bu.products || [])
        products.push({ id: p.id, name: p.name });
      const queues = (v2.queues || []).map((q) => {
        const out2 = { id: q.id, name: q.name, type: q.type, fallbackAhtSec: q.fallbackAhtSec, staffing: q.staffing };
        if (q.attachment && q.attachment.kind === "structural") {
          const n = struct.nodes.get(q.attachment.channelInstanceId);
          if (n && n.path) {
            out2.homeBrandId = n.path[0];
            out2.homeBuId = n.path[1];
          }
        }
        return out2;
      });
      const processGroups = [];
      const processes = [];
      const requestTypes = [];
      const volumeEntries = [];
      for (const s of v2.services || []) {
        const gId = "pg_" + s.id;
        processGroups.push({ id: gId, name: s.name });
        const rec = sv.get(s.id);
        const sources = rec ? rec.sources.filter((x) => !x.superseded && x.volume > 0) : [];
        const brandIds = [...new Set(sources.map((x) => (struct.nodes.get(x.nodeId) || { path: [] }).path[0]).filter(Boolean))];
        const buIds = [...new Set(sources.map((x) => (struct.nodes.get(x.nodeId) || { path: [] }).path[1]).filter(Boolean))];
        const firstQ = (v2.queues || []).find((q) => q.id === ((s.journey || [])[0] || {}).queueId);
        const chKey = firstQ ? queueChannelKey(firstQ) : chKeys[0] || "voice";
        const rtId = "rt_" + s.id;
        const steps = (s.journey || []).map((st, i, arr) => {
          const step = { queueId: st.queueId, splitPct: st.splitPct != null ? st.splitPct : 100 };
          if (st.samplingPct != null) step.samplingPct = st.samplingPct;
          if (i === arr.length - 1) {
            step.terminal = true;
            step.outcome = "completed";
          }
          return step;
        });
        const procId = "proc_" + s.id;
        processes.push({ id: procId, name: s.name, channelId: chIdOf(chKey), groupId: gId, outcomes: ["completed"], steps });
        const rt = {
          id: rtId,
          name: s.name,
          activity: s.activity,
          productRequest: s.productRequest,
          groupId: gId,
          brandIds,
          buIds,
          processIds: [procId]
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
      const out = { brands, businessUnits, channels, processGroups, products, processes, queues, requestTypes, volumeEntries };
      if (v2.engineConfig) out.engineConfig = v2.engineConfig;
      return out;
    }
    module.exports = { migrateV2ToDomain: migrateV2ToDomain2 };
  }
});

// model/store-domain.js
var require_store_domain = __commonJS({
  "model/store-domain.js"(exports, module) {
    var { migrateV2ToDomain: migrateV2ToDomain2 } = require_migrate_domain();
    var V3_KEY = "capacity.v3.model";
    var V2_KEY = "capacity.v2.model";
    var defaultStorage = () => typeof localStorage !== "undefined" ? localStorage : null;
    function saveDomainModel2(model, storage = defaultStorage()) {
      try {
        if (!storage) return false;
        storage.setItem(V3_KEY, JSON.stringify(model));
        return true;
      } catch {
        return false;
      }
    }
    function loadDomainModel2(storage = defaultStorage()) {
      if (!storage) return null;
      try {
        const raw = storage.getItem(V3_KEY);
        if (raw) return { model: JSON.parse(raw), migratedFrom: null };
      } catch {
      }
      try {
        const old = storage.getItem(V2_KEY);
        if (!old) return null;
        const v2model = JSON.parse(old);
        const model = migrateV2ToDomain2(v2model);
        saveDomainModel2(model, storage);
        return { model, migratedFrom: "v2.4" };
      } catch {
        return null;
      }
    }
    function clearDomainModel(storage = defaultStorage()) {
      try {
        if (storage) storage.removeItem(V3_KEY);
      } catch {
      }
    }
    module.exports = { saveDomainModel: saveDomainModel2, loadDomainModel: loadDomainModel2, clearDomainModel, V3_KEY, V2_KEY };
  }
});

// model/template-domain.js
var require_template_domain = __commonJS({
  "model/template-domain.js"(exports, module) {
    var SHEET_NAMES2 = ["Registry", "Queues", "Request types", "Processes", "Steps", "Volume entries"];
    var WEEKS = 52;
    var blank = (v) => v === void 0 || v === null ? "" : v;
    var numOrU = (v) => v === "" || v == null ? void 0 : +v;
    var strOrU = (v) => v === "" || v == null ? void 0 : String(v);
    var joinIds = (a) => (a || []).join(";");
    var splitIds = (s) => s === "" || s == null ? [] : String(s).split(";").filter(Boolean);
    function modelToDomainSheets2(model) {
      const Registry = [];
      const reg = (kind, e) => Registry.push({
        Kind: kind,
        Id: e.id,
        Name: blank(e.name),
        Key: blank(e.key),
        BrandId: blank(e.brandId),
        // products may belong to one brand, or all when blank
        DefaultsJson: e.defaults ? JSON.stringify(e.defaults) : ""
      });
      for (const b of model.brands || []) reg("brand", b);
      for (const b of model.businessUnits || []) reg("businessUnit", b);
      for (const c of model.channels || []) reg("channel", c);
      for (const g of model.processGroups || []) reg("processGroup", g);
      for (const p of model.products || []) reg("product", p);
      const Queues = (model.queues || []).map((q) => ({
        QueueId: q.id,
        Name: q.name,
        Type: q.type,
        HomeBrandId: blank(q.homeBrandId),
        HomeBuId: blank(q.homeBuId),
        FallbackAhtSec: q.fallbackAhtSec,
        Modified: q._modified ? "yes" : "",
        StaffingJson: q.staffing ? JSON.stringify(q.staffing) : ""
      }));
      const RT = (model.requestTypes || []).map((rt) => ({
        RequestTypeId: rt.id,
        Name: rt.name,
        Activity: rt.activity,
        ProductRequest: rt.productRequest,
        GroupId: rt.groupId,
        ProductId: blank(rt.productId),
        AhtSec: blank(rt.ahtSec),
        BrandIds: joinIds(rt.brandIds),
        BuIds: joinIds(rt.buIds),
        ProcessIds: joinIds(rt.processIds)
      }));
      const Processes = (model.processes || []).map((p) => ({
        ProcessId: p.id,
        Name: blank(p.name),
        ChannelId: p.channelId,
        GroupId: blank(p.groupId),
        Outcomes: joinIds(p.outcomes)
      }));
      const Steps = [];
      for (const p of model.processes || []) {
        const head = { ProcessId: p.id };
        if (!(p.steps || []).length) {
          Steps.push({ ...head, StepOrder: "", QueueId: "", SplitPct: "", SamplingPct: "", Terminal: "", Outcome: "" });
          continue;
        }
        p.steps.forEach((s, i) => Steps.push({
          ...head,
          StepOrder: i + 1,
          QueueId: s.queueId,
          SplitPct: s.splitPct,
          SamplingPct: blank(s.samplingPct),
          Terminal: s.terminal ? "yes" : "",
          Outcome: blank(s.outcome)
        }));
      }
      const Volume = (model.volumeEntries || []).map((e) => {
        const row = {
          EntryId: blank(e.id),
          BrandId: blank((e.scope || {}).brandId),
          BuId: blank((e.scope || {}).buId),
          RequestTypeId: blank((e.scope || {}).requestTypeId),
          ChannelId: blank((e.scope || {}).channelId),
          Daily: blank(e.daily)
        };
        for (let w = 0; w < WEEKS; w++) row["W" + (w + 1)] = e.weekly ? blank(e.weekly[w]) : "";
        return row;
      });
      return { Registry, Queues, "Request types": RT, Processes, Steps, "Volume entries": Volume };
    }
    function domainSheetsToModel2(sheets) {
      const model = { brands: [], businessUnits: [], channels: [], processGroups: [], products: [], processes: [], queues: [], requestTypes: [], volumeEntries: [] };
      const listOf = { brand: "brands", businessUnit: "businessUnits", channel: "channels", processGroup: "processGroups", product: "products" };
      for (const r of sheets.Registry || []) {
        const list = model[listOf[r.Kind]];
        if (!list) continue;
        const e = { id: r.Id, name: r.Name };
        if (r.Key !== "" && r.Key != null) e.key = r.Key;
        const rb = strOrU(r.BrandId);
        if (rb) e.brandId = rb;
        if (r.DefaultsJson) e.defaults = JSON.parse(r.DefaultsJson);
        list.push(e);
      }
      for (const r of sheets.Queues || []) {
        const q = { id: r.QueueId, name: r.Name, type: r.Type, fallbackAhtSec: +r.FallbackAhtSec };
        const hb = strOrU(r.HomeBrandId);
        if (hb) q.homeBrandId = hb;
        const hu = strOrU(r.HomeBuId);
        if (hu) q.homeBuId = hu;
        if (r.StaffingJson) q.staffing = JSON.parse(r.StaffingJson);
        if (r.Modified === "yes") q._modified = true;
        model.queues.push(q);
      }
      const rtById = /* @__PURE__ */ new Map();
      for (const r of sheets["Request types"] || []) {
        const rt = {
          id: r.RequestTypeId,
          name: r.Name,
          activity: r.Activity,
          productRequest: r.ProductRequest,
          groupId: r.GroupId,
          brandIds: splitIds(r.BrandIds),
          buIds: splitIds(r.BuIds),
          processIds: splitIds(r.ProcessIds)
        };
        const pid = strOrU(r.ProductId);
        if (pid) rt.productId = pid;
        const aht = numOrU(r.AhtSec);
        if (aht !== void 0) rt.ahtSec = aht;
        rtById.set(rt.id, rt);
        model.requestTypes.push(rt);
      }
      const procs = /* @__PURE__ */ new Map();
      for (const r of sheets.Processes || []) {
        const p = { id: r.ProcessId, name: r.Name, channelId: r.ChannelId, outcomes: splitIds(r.Outcomes), steps: [] };
        const g = strOrU(r.GroupId);
        if (g) p.groupId = g;
        procs.set(p.id, p);
        model.processes.push(p);
      }
      for (const r of sheets.Steps || []) {
        const p = procs.get(r.ProcessId);
        if (!p) continue;
        if (r.StepOrder !== "" && r.StepOrder != null && r.QueueId) {
          const s = { queueId: r.QueueId, splitPct: +r.SplitPct };
          const samp = numOrU(r.SamplingPct);
          if (samp !== void 0) s.samplingPct = samp;
          if (r.Terminal === "yes") {
            s.terminal = true;
            const o = strOrU(r.Outcome);
            if (o) s.outcome = o;
          }
          p.steps.push(s);
        }
      }
      for (const r of sheets["Volume entries"] || []) {
        const e = { scope: {} };
        const id = strOrU(r.EntryId);
        if (id) e.id = id;
        for (const [col, key] of [["BrandId", "brandId"], ["BuId", "buId"], ["RequestTypeId", "requestTypeId"], ["ChannelId", "channelId"]]) {
          const v = strOrU(r[col]);
          if (v) e.scope[key] = v;
        }
        const daily = numOrU(r.Daily);
        if (daily !== void 0) e.daily = daily;
        const weekly = [];
        let any = false;
        for (let w = 0; w < WEEKS; w++) {
          const v = numOrU(r["W" + (w + 1)]);
          weekly.push(v !== void 0 ? v : 0);
          if (v !== void 0) any = true;
        }
        if (any) e.weekly = weekly;
        if (e.daily !== void 0 || e.weekly) model.volumeEntries.push(e);
      }
      return { model };
    }
    module.exports = { SHEET_NAMES: SHEET_NAMES2, modelToDomainSheets: modelToDomainSheets2, domainSheetsToModel: domainSheetsToModel2 };
  }
});

// ui/v2/template-domain-xlsx.js
var template_domain_xlsx_exports = {};
__export(template_domain_xlsx_exports, {
  downloadDomainTemplate: () => downloadDomainTemplate,
  exportDomainWorkbook: () => exportDomainWorkbook,
  importDomainWorkbook: () => importDomainWorkbook
});
async function exportDomainWorkbook(model) {
  const XLSX = await import("xlsx");
  const sheets = (0, import_template_domain.modelToDomainSheets)(model);
  const wb = XLSX.utils.book_new();
  for (const name of import_template_domain.SHEET_NAMES) {
    const ws = XLSX.utils.json_to_sheet(sheets[name] || [], { skipHeader: false });
    XLSX.utils.book_append_sheet(wb, ws, sheetKey(name));
  }
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}
async function importDomainWorkbook(data) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(data, { type: "array" });
  const sheets = {};
  for (const name of import_template_domain.SHEET_NAMES) {
    const ws = wb.Sheets[sheetKey(name)] || wb.Sheets[name];
    sheets[name] = ws ? XLSX.utils.sheet_to_json(ws, { defval: "" }) : [];
  }
  return (0, import_template_domain.domainSheetsToModel)(sheets);
}
async function downloadDomainTemplate(model, filename = "capacity-model.xlsx") {
  const bytes = await exportDomainWorkbook(model);
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
var import_template_domain, sheetKey;
var init_template_domain_xlsx = __esm({
  "ui/v2/template-domain-xlsx.js"() {
    import_template_domain = __toESM(require_template_domain());
    sheetKey = (name) => name.slice(0, 31);
  }
});

// ui/v2/app-main.jsx
import { createRoot } from "react-dom/client";

// ui/v2/App.jsx
import { useState as useState7, useEffect as useEffect6, useMemo as useMemo6, useRef as useRef5, useCallback as useCallback2 } from "react";

// ui/v2/SetupV3Page.jsx
var import_propagate = __toESM(require_propagate());
var import_domain = __toESM(require_domain());
var import_engine = __toESM(require_engine());
var import_taxonomy2 = __toESM(require_taxonomy());
var import_bridge = __toESM(require_bridge());
var Ops = __toESM(require_ops());
import { useState, useMemo, useRef, useEffect } from "react";

// ui/v2/model.js
var import_derive = __toESM(require_derive());
var import_taxonomy = __toESM(require_taxonomy());
var ACTIVITIES = ["service_request", "lead", "decision", "collections", "upsell_xsell", "maintenance"];
var QUEUE_TYPES = ["inbound_call", "outbound_call", "case_processing", "governance", "shared_capacity"];
var ACTIVITY_LABELS = {
  service_request: "Service request",
  lead: "Lead",
  decision: "Decision",
  collections: "Collections",
  upsell_xsell: "Up-sell / x-sell",
  maintenance: "Maintenance"
};
var CHANNEL_LABELS = { voice: "Voice", third_party: "Third party", digital: "Digital", customer_management: "Customer management" };
var QTYPE_LABELS = { inbound_call: "inbound call", outbound_call: "outbound call", case_processing: "case processing", governance: "governance", shared_capacity: "shared capacity" };
var clone = (m) => JSON.parse(JSON.stringify(m));
function setHiringBuffer(model, pct3) {
  const m = clone(model);
  ensureEngine(m).hiring.buffer = (+pct3 || 0) / 100;
  return m;
}
function setForwardMonths(model, strategyId, months) {
  const m = clone(model);
  const s = (ensureEngine(m).strategies || []).find((x) => x.id === strategyId);
  if (s) s.forwardMonths = Math.max(1, Math.min(6, +months || 1));
  return m;
}
function setTotalCap(model, cap) {
  const m = clone(model);
  const h = ensureEngine(m).hiring;
  h.caps = h.caps || { total: null, segments: {} };
  h.caps.total = cap === "" || cap == null ? null : +cap;
  h.cap = h.caps.total != null ? h.caps.total : h.cap;
  return m;
}
function setSegmentCap(model, brandId, channel, cap) {
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

// ui/v2/tokens.js
var FAMILY_COLORS = {
  inputs: "#185FA5",
  // blue
  performance: "#0F6E56",
  // teal
  efficiency: "#534AB7",
  // purple
  workforce: "#993C1D",
  // coral
  customer: "#993556",
  // pink
  outputs: "#BA7517"
  // amber (ink-safe)
};
var CSS = `
:root{
  --blue:#185FA5; --blue-deep:#0C447C; --blue-tint:#E6F1FB; --blue-line:#B5D4F4; --blue-mid:#378ADD;
  --purple:#534AB7; --purple-bg:#EEEDFE;
  --teal:#0F6E56; --teal-bg:#E1F5EE;
  --amber:#EF9F27; --amber-bg:#FAEEDA; --amber-ink:#633806;
  --green-bg:#EAF3DE; --green-ink:#27500A;
  --coral:#993C1D; --coral-bg:#FAECE7;
  --pink:#993556; --pink-bg:#FBEAF0;
  --red:#E24B4A; --red-bg:#FCEBEB; --red-ink:#791F1F; --red-line:#F0B4B4;
  /* --ink-3 was #8a887f: 3.40:1 on canvas at 9-12.5px, i.e. below AA for most
     of the words on the surface. #6f6d64 is 4.97:1 on canvas and 4.53:1 on
     blue-tint, with --ink-2 at 6.61:1 so the three-step hierarchy survives. */
  --ink:#1a1a1a; --ink-2:#5c5a54; --ink-3:#6f6d64;
  --line:#e4e2db; --canvas:#fbfaf7;
}
*{box-sizing:border-box; margin:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  background:var(--canvas); color:var(--ink); font-size:14px; line-height:1.5; -webkit-font-smoothing:antialiased}
.num{font-variant-numeric:tabular-nums}
.shell{max-width:960px; margin:0 auto; padding:0 16px 60px}

header.top{display:flex; align-items:center; justify-content:space-between;
  padding:14px 0; border-bottom:0.5px solid var(--line); margin-bottom:18px}
.brand{display:flex; align-items:center; gap:10px}
.mark{width:32px; height:32px; border-radius:9px; background:var(--blue); color:var(--blue-tint);
  display:flex; align-items:center; justify-content:center; font-weight:600; font-size:16px}
.brand h1{font-size:15px; font-weight:600}
.brand small{display:block; font-size:11.5px; color:var(--ink-3); font-weight:400}
.tabs{display:flex; gap:2px; font-size:12.5px; color:var(--ink-3)}
.tabs button{padding:4px 8px; border-radius:7px; border:none; background:none; font:inherit; font-size:12.5px; color:var(--ink-3); cursor:pointer}
.tabs button.on{background:var(--blue-tint); color:var(--blue-deep); font-weight:600}
.tabs button:focus-visible{outline:2px solid var(--blue); outline-offset:2px}

h2{font-size:20px; font-weight:600; letter-spacing:-0.015em}
.lede{font-size:12.5px; color:var(--ink-2); margin:2px 0 16px}

.btn{border:0.5px solid var(--blue-line); background:#fff; color:var(--blue); border-radius:8px;
  padding:6px 11px; font:inherit; font-size:12.5px; font-weight:500; cursor:pointer}
.btn:hover{background:var(--blue-tint)}
.btn:focus-visible{outline:2px solid var(--blue); outline-offset:2px}
.btn:disabled{opacity:0.45; cursor:not-allowed}
.btn:disabled:hover{background:#fff}
.dots:disabled{opacity:0.4; cursor:not-allowed}
.btn.primary{background:var(--blue); border-color:var(--blue); color:#fff}
.btn.sm{padding:4px 9px; font-size:11.5px}
.btn.danger{color:var(--red-ink); border-color:var(--red-line)}
.btn.danger:hover{background:var(--red-bg)}
.hint{font-size:12px; color:var(--ink-3)}

.sec{background:#fff; border:0.5px solid var(--line); border-radius:14px; margin-bottom:12px; overflow:hidden}
.sechead{display:flex; align-items:center; gap:10px; width:100%; background:none; border:none;
  font:inherit; text-align:left; padding:13px 16px; cursor:pointer}
.sechead:focus-visible{outline:2px solid var(--blue); outline-offset:-2px}
.secnum{width:24px; height:24px; border-radius:50%; background:var(--blue-tint); color:var(--blue-deep);
  font-size:12px; font-weight:600; display:flex; align-items:center; justify-content:center; flex:none}
.sechead b{font-size:14px; font-weight:600}
.sechead small{display:block; font-size:11.5px; color:var(--ink-3); font-weight:400}
.badge{margin-left:auto; font-size:11px; font-weight:600; padding:3px 10px; border-radius:999px;
  background:var(--green-bg); color:var(--green-ink); white-space:nowrap}
.badge.todo{background:var(--amber-bg); color:var(--amber-ink)}
.chev{color:var(--ink-3); font-size:11px; margin-left:6px}
.sec.open .chev{display:inline-block; transform:rotate(180deg)}
.secbody{display:none; border-top:0.5px solid var(--line); padding:14px 16px}
.sec.open .secbody{display:block}

.bu{border:0.5px solid var(--line); border-radius:11px; margin-bottom:8px; overflow:hidden}
.buhead{display:flex; align-items:center; gap:8px; width:100%; background:var(--canvas); border:none;
  font:inherit; text-align:left; padding:10px 12px; cursor:pointer}
.buhead:focus-visible{outline:2px solid var(--blue); outline-offset:-2px}
.buhead b{font-size:13px; font-weight:600}
.buhead .sum{margin-left:auto; font-size:11.5px; color:var(--ink-3)}
.bu.open .chev{transform:rotate(180deg)}
.bubody{display:none; padding:8px 12px 12px}
.bu.open .bubody{display:block}
.prod{display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding:7px 0 7px 14px;
  border-left:2px solid var(--blue-line); margin:6px 0}
.prod b{font-size:12.5px; font-weight:600}
.chip{font-size:10.5px; font-weight:600; padding:2px 9px; border-radius:999px;
  background:var(--blue-tint); color:var(--blue-deep); white-space:nowrap; border:none; font-family:inherit}
.chip.off{background:var(--canvas); border:0.5px dashed var(--line); color:var(--ink-3); cursor:pointer}
.chip.on-toggle{cursor:pointer}
.chip.shared{background:var(--teal-bg); color:var(--teal)}
.tax{font-size:10.5px; font-weight:600; padding:2px 8px; border-radius:999px;
  background:var(--canvas); border:0.5px solid var(--line); color:var(--ink-2); white-space:nowrap}

.qline{display:flex; align-items:center; gap:8px; padding:9px 6px; border-bottom:0.5px solid var(--line); cursor:pointer; flex-wrap:wrap; width:100%; background:none; border-left:none; border-right:none; border-top:none; font:inherit; text-align:left}
.qline:hover{background:var(--blue-tint)}
.qline:last-child{border-bottom:none}
.qline:focus-visible{outline:2px solid var(--blue); outline-offset:-2px}
.qline b{font-size:12.5px; font-weight:600}
.qstats{margin-left:auto; display:flex; gap:16px; align-items:center; font-size:12px; color:var(--ink-2); flex-wrap:wrap}
.qstats .lab{font-size:9.5px; color:var(--ink-3); display:block}
.moddot{display:inline-block; width:7px; height:7px; border-radius:50%; background:var(--amber); margin-left:6px; vertical-align:1px}
.spark{width:60px; height:20px}

.card{border:0.5px solid var(--line); border-radius:11px; margin-bottom:8px; overflow:hidden}
.cardhead{display:flex; align-items:center; gap:8px; flex-wrap:wrap; width:100%; background:none; border:none;
  font:inherit; text-align:left; padding:10px 12px; cursor:pointer}
.cardhead:focus-visible{outline:2px solid var(--blue); outline-offset:-2px}
.cardhead b{font-size:13px; font-weight:600}
.card.open .chev{transform:rotate(180deg)}
.cardbody{display:none; border-top:0.5px solid var(--line); padding:10px 12px}
.card.open .cardbody{display:block}
.jour{display:flex; align-items:center; gap:4px; flex-wrap:wrap; margin-top:4px}
.jstep{font-size:10.5px; font-weight:600; padding:2px 8px; border-radius:999px;
  background:var(--blue-tint); color:var(--blue-deep); white-space:nowrap}
.jstep.gov{background:var(--purple-bg); color:var(--purple)}
.jarr{color:var(--ink-3); font-size:10px}
.fields{display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px}
.field label{display:block; font-size:11.5px; font-weight:500; color:var(--ink-2); margin-bottom:3px}
.field input,.field select{width:100%; font:inherit; font-size:13px; padding:7px 9px;
  border:0.5px solid var(--line); border-radius:8px; background:#fff}
.field input:focus-visible,.field select:focus-visible{outline:2px solid var(--blue); outline-offset:0}
.mixrow{display:flex; align-items:center; gap:8px; padding:5px 0; border-bottom:0.5px solid var(--line); font-size:12.5px}
.mixrow select{flex:1; font:inherit; font-size:12.5px; padding:5px 8px; border:0.5px solid var(--line); border-radius:7px}
.mixrow input{width:64px; text-align:right; font:inherit; font-size:12.5px; padding:5px 8px; border:0.5px solid var(--line); border-radius:7px}
.mixsum{display:flex; justify-content:space-between; padding:7px 0 0; font-size:12.5px; font-weight:600; color:var(--green-ink)}
.mixsum.warn{color:var(--amber-ink)}
.path{font-size:11px; font-weight:600; color:var(--purple); background:var(--purple-bg);
  padding:2px 9px; border-radius:999px; white-space:nowrap}
.warnmsg{margin-top:8px; font-size:12px; color:var(--amber-ink)}

.importbox{margin-top:4px; border:0.5px dashed var(--blue-line); border-radius:12px; padding:12px 14px;
  display:flex; gap:12px; align-items:center; justify-content:space-between; flex-wrap:wrap}
.importbox p{font-size:12.5px; color:var(--ink-2)}
.importbox b{font-weight:600; color:var(--ink)}

.scrim{display:none; position:fixed; inset:0; background:rgba(26,26,26,.35); z-index:10}
.scrim.on{display:block}
.drawer{position:fixed; top:0; right:-420px; width:min(420px,100%); height:100%; background:#fff; z-index:11;
  box-shadow:-12px 0 40px rgba(12,68,124,.15); transition:right .22s ease; display:flex; flex-direction:column}
.drawer.on{right:0}
.dhead{padding:14px 16px 10px; border-bottom:0.5px solid var(--line); display:flex; justify-content:space-between}
.dhead h3{font-size:15px; font-weight:600}
.dhead p{font-size:11.5px; color:var(--ink-3)}
.close{background:none; border:none; font-size:17px; color:var(--ink-3); cursor:pointer; padding:4px 8px; border-radius:6px}
.dbody{overflow-y:auto; padding:8px 16px 22px; flex:1}
.acc{border:0.5px solid var(--line); border-radius:10px; margin-top:8px; overflow:hidden}
.acchead{display:flex; align-items:center; gap:9px; width:100%; background:none; border:none; font:inherit;
  padding:10px 11px; cursor:pointer; text-align:left}
.acchead:focus-visible{outline:2px solid var(--blue); outline-offset:-2px}
.fam{width:4px; align-self:stretch; border-radius:2px}
.acchead b{font-size:12.5px; font-weight:600}
.acchead small{display:block; font-size:11px; color:var(--ink-3); font-weight:400}
.accbody{display:none; padding:4px 11px 12px; border-top:0.5px solid var(--line)}
.acc.open .accbody{display:block}
.acc.open .chev{transform:rotate(180deg)}

.note{margin-top:18px; font-size:12.5px; color:var(--ink-3); border-top:0.5px solid var(--line); padding-top:12px}
.note b{color:var(--ink-2); font-weight:600}

/* ---- Results (results-page-v2.html) ---- */
.ctx{display:flex; gap:8px; align-items:center; flex-wrap:wrap; background:#fff;
  border:0.5px solid var(--line); border-radius:12px; padding:10px 12px; margin-bottom:12px}
.ctx label{font-size:11px; font-weight:600; color:var(--ink-3)}
.ctx select{font:inherit; font-size:12.5px; padding:5px 8px; border:0.5px solid var(--line); border-radius:7px; background:#fff}
.fresh{margin-left:auto; font-size:11.5px; font-weight:600; color:var(--green-ink); background:var(--green-bg); padding:3px 10px; border-radius:999px}
.fresh.stale{color:var(--amber-ink); background:var(--amber-bg)}
.sub{display:flex; gap:4px; margin-bottom:14px; overflow-x:auto}
.sub button{border:none; background:none; font:inherit; font-size:13px; font-weight:500; color:var(--ink-2); padding:7px 13px; border-radius:9px; cursor:pointer; white-space:nowrap}
.sub button.on{background:var(--blue); color:#fff}
.sub button:focus-visible{outline:2px solid var(--blue); outline-offset:2px}
.panel{background:#fff; border:0.5px solid var(--line); border-radius:14px; padding:16px; margin-bottom:12px}
.panel h3{font-size:14px; font-weight:600; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center}
.panel h3 small{font-size:11.5px; color:var(--ink-3); font-weight:400}
.verdict{font-size:13.5px; color:var(--ink-2); border-left:3px solid var(--blue); padding-left:10px; margin-bottom:14px}
.verdict b{color:var(--ink); font-weight:600}
.weight{display:flex; align-items:center; gap:10px; margin-bottom:10px; flex-wrap:wrap}
.weight label{font-size:11.5px; font-weight:500; color:var(--ink-2)}
.weight input{flex:1; min-width:130px; accent-color:var(--blue)}
.mx{width:100%; border-collapse:separate; border-spacing:4px}
.mx th{font-size:10.5px; font-weight:600; color:var(--ink-3); text-align:center; padding:2px}
.mx th.rh{text-align:left; font-size:11px; color:var(--ink-2); white-space:nowrap}
.cell{border:0.5px solid var(--line); border-radius:9px; background:#fff; padding:7px 5px; font:inherit; cursor:pointer; width:100%; text-align:center; position:relative}
.cell:hover{border-color:var(--blue-line)}
.cell.sel{border-color:var(--blue); background:var(--blue-tint)}
.cell:focus-visible{outline:2px solid var(--blue); outline-offset:1px}
.cell .c1{font-size:12.5px; font-weight:600; color:var(--amber-ink)}
.cell .c2{font-size:11px; color:var(--teal); font-weight:600}
.cell .c3{font-size:10.5px; font-weight:600}
.cell .c3.ok{color:var(--green-ink)} .cell .c3.warn{color:var(--amber-ink)} .cell .c3.bad{color:var(--red-ink)}
.best{position:absolute; top:-8px; left:50%; transform:translateX(-50%); background:var(--blue); color:#fff; font-size:9px; font-weight:600; padding:2px 7px; border-radius:999px; white-space:nowrap}
.fam6{display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:10px}
.fcard{background:#fff; border:0.5px solid var(--line); border-left-width:3px; padding:10px 12px; border-radius:8px}
.fcard .fl{font-size:11px; font-weight:600}
.fcard .fv{font-size:20px; font-weight:600; margin:1px 0}
.fcard .fs{font-size:11px; color:var(--ink-2)}
.risk{width:100%; border-collapse:collapse; font-size:12.5px}
.risk th{font-size:11px; font-weight:600; color:var(--ink-3); text-align:left; padding:5px 6px; border-bottom:0.5px solid var(--line)}
.risk td{padding:7px 6px; border-bottom:0.5px solid var(--line); vertical-align:top}
.sev{font-size:10.5px; font-weight:600; padding:1px 8px; border-radius:999px; white-space:nowrap}
.sev.red{background:var(--red-bg); color:var(--red-ink)} .sev.amb{background:var(--amber-bg); color:var(--amber-ink)} .sev.grn{background:var(--green-bg); color:var(--green-ink)}
.filters{display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-bottom:8px}
.filters select{font:inherit; font-size:12px; padding:4px 8px; border:0.5px solid var(--line); border-radius:7px; background:#fff}
.filters label{font-size:11px; font-weight:600; color:var(--ink-3)}
.ribwrap{overflow-x:auto}
.ribbon{border-collapse:collapse}
.ribbon th{font-size:10px; color:var(--ink-3); font-weight:500; padding:1px}
.ribbon .qh{font-size:11.5px; font-weight:600; color:var(--ink-2); text-align:left; padding-right:8px; white-space:nowrap}
.ribbon .gh{font-size:10.5px; font-weight:600; color:var(--blue-deep); text-align:left; padding:5px 0 2px}
.rc{width:15px; height:17px; border:none; padding:0; cursor:pointer; font-size:8.5px; line-height:17px; text-align:center; border-radius:3px; color:#fff}
.rc.g{background:#97C459; color:#27500A} .rc.a{background:#FAC775; color:#633806} .rc.r{background:#F09595; color:#501313}
.rc.cur{outline:2px solid var(--blue); outline-offset:1px}
.wklabel{font-size:12.5px; color:var(--ink-2); margin:8px 0}
.wklabel b{color:var(--blue-deep); font-weight:600}
.inherit{font-size:12px; color:var(--blue-deep); background:var(--blue-tint); display:inline-flex; gap:8px; align-items:center; padding:5px 10px; border-radius:999px; margin-bottom:10px}
.inherit button{border:none; background:none; color:var(--blue); font-weight:600; cursor:pointer; font:inherit; font-size:12px; padding:0 4px}
.dtab{width:100%; border-collapse:collapse; font-size:12px}
.dtab th{padding:5px 8px; text-align:right; font-size:10.5px; font-weight:600; border-bottom:0.5px solid var(--line)}
.dtab td{padding:6px 8px; text-align:right; border-bottom:0.5px solid var(--line)}
.dtab .l{text-align:left}
.gInp{color:var(--blue-deep)} .gPerf{color:var(--teal)} .gWf{color:var(--coral)} .gOut{color:var(--amber-ink)}
.dtab .grp td{background:var(--canvas); font-size:11px; font-weight:600; color:var(--blue-deep); text-align:left}
.flowctl{display:flex; gap:10px; align-items:center; margin-bottom:10px; flex-wrap:wrap}
.flowctl input[type=range]{flex:1; min-width:120px; accent-color:var(--blue)}
.flowctl .wk{font-size:12.5px; font-weight:600; color:var(--blue-deep); min-width:64px}
.hide{display:none}

/* ---- Levers (levers-page-v2.html) ---- */
.cardlist{display:grid; gap:8px}
.scard{border:0.5px solid var(--line); border-radius:11px; background:#fff}
.schead{display:flex; align-items:center; gap:8px; width:100%; background:none; border:none; font:inherit; text-align:left; padding:11px 12px; cursor:pointer}
.schead:focus-visible{outline:2px solid var(--blue); outline-offset:-2px}
.schead b{font-size:13.5px; font-weight:600}
.schead .desc{display:block; font-size:12px; color:var(--ink-2); font-weight:400}
.pill{font-size:10.5px; font-weight:600; padding:2px 8px; border-radius:999px; background:var(--blue-tint); color:var(--blue-deep); white-space:nowrap}
.pill.builtin{background:var(--canvas); color:var(--ink-3); border:0.5px solid var(--line)}
.pill.shared{background:#E1F5EE; color:#0F6E56}
.param{margin-left:auto; font-size:12px; color:var(--ink-2)}
.param b{font-weight:600; color:var(--ink)}
.param input{font:inherit; font-size:12px; padding:3px 6px; border:0.5px solid var(--line); border-radius:6px; text-align:right}
.scard .chev{color:var(--ink-3); font-size:11px; margin-left:8px}
.scbody{display:none; border-top:0.5px solid var(--line); padding:10px 12px; font-size:12.5px; color:var(--ink-2)}
.scard.open .scbody{display:block}
.scard.open .chev{transform:rotate(180deg); display:inline-block}
.grph{font-size:11px; font-weight:600; color:var(--blue-deep); margin:8px 0 4px}
.qtoggle{display:flex; justify-content:space-between; padding:3px 0}
.tl{display:flex; gap:1px; margin-top:6px}
.tl span{flex:1; height:6px; border-radius:2px; background:var(--line)}
.tl span.on{background:#97C459}
.mxnote{font-size:12px; color:var(--ink-3); margin-top:8px}
.caps{width:100%; border-collapse:collapse; font-size:13px}
.caps th{font-size:11.5px; font-weight:600; color:var(--ink-3); text-align:left; padding:6px 8px; border-bottom:0.5px solid var(--line)}
.caps td{padding:7px 8px; border-bottom:0.5px solid var(--line)}
.caps input{width:70px; font:inherit; font-size:13px; padding:5px 8px; border:0.5px solid var(--line); border-radius:7px; text-align:right}
@media(min-width:760px){ .cols{display:grid; grid-template-columns:1fr 1fr; gap:14px} }

/* ---- Home (home-page-v2.html) ---- */
.avatar{width:32px; height:32px; border-radius:50%; background:var(--blue-tint); color:var(--blue-deep); display:flex; align-items:center; justify-content:center; font-weight:600; font-size:12px}
.pagehead{display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px; flex-wrap:wrap}
.pagehead h2{font-size:22px; font-weight:600; letter-spacing:-0.015em}
.toolbar{display:flex; gap:10px; margin-bottom:20px; flex-wrap:wrap}
.search{flex:1; min-width:200px; display:flex; align-items:center; gap:8px; background:#fff; border:0.5px solid var(--line); border-radius:9px; padding:8px 12px; color:var(--ink-3); font-size:13px}
.grid{display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:14px}
.card{background:#fff; border:0.5px solid var(--line); border-radius:14px; padding:16px; display:flex; flex-direction:column; gap:12px}
.card:hover{border-color:var(--blue-line)}
.head{display:flex; gap:14px; align-items:flex-start}
.thumb{flex:none; width:84px; height:70px; background:var(--canvas); border:0.5px solid var(--line); border-radius:10px; display:flex; align-items:center; justify-content:center; cursor:pointer; padding:0}
.thumb:focus-visible{outline:2px solid var(--blue); outline-offset:2px}
.card h3{font-size:14.5px; font-weight:600; letter-spacing:-0.01em}
.meta{font-size:12px; color:var(--ink-3); margin-top:1px}
.dots{margin-left:auto; color:var(--ink-3); background:none; border:none; font-size:18px; cursor:pointer; line-height:1; padding:2px 6px; border-radius:6px}
.dots:hover{background:var(--canvas)}
.chips{display:flex; gap:6px; flex-wrap:wrap}
.chips .chip{font-size:11.5px; font-weight:500; padding:3px 9px; border-radius:999px; background:var(--blue-tint); color:var(--blue-deep)}
.chip.money{background:var(--amber-bg); color:var(--amber-ink)}
.chip.hc{background:#FAECE7; color:#712B13}
.chip.ok{background:var(--green-bg); color:var(--green-ink)}
.chip.warn{background:var(--amber-bg); color:var(--amber-ink)}
.chip.bad{background:var(--red-bg); color:var(--red-ink)}
.open{width:100%}
.newcard{border:1.5px dashed var(--blue-line); background:transparent; border-radius:14px; padding:16px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; color:var(--blue); font:inherit; font-size:13.5px; font-weight:500; cursor:pointer; min-height:180px}
.newcard:hover{background:var(--blue-tint)}
.newcard .plus{font-size:26px; font-weight:400; line-height:1}
.newcard small{color:var(--ink-3); font-weight:400; font-size:12px}
.overlay{display:none; position:fixed; inset:0; background:rgba(26,26,26,.35); z-index:10; align-items:center; justify-content:center; padding:20px}
.overlay.on{display:flex}
.modal{background:#fff; border-radius:16px; padding:22px; max-width:520px; width:100%; box-shadow:0 20px 60px rgba(12,68,124,.18)}
.modal h3{font-size:17px; font-weight:600; margin-bottom:2px; letter-spacing:-0.01em}
.modal>p{font-size:13px; color:var(--ink-2); margin-bottom:16px}
.forks{display:grid; gap:10px}
.fork{display:flex; gap:14px; align-items:center; text-align:left; background:#fff; border:0.5px solid var(--line); border-radius:12px; padding:14px; font:inherit; cursor:pointer; width:100%}
.fork:hover{border-color:var(--blue); background:var(--blue-tint)}
.fork .t{font-size:14px; font-weight:600}
.fork .d{font-size:12.5px; color:var(--ink-2); margin-top:1px}
.foot{display:flex; justify-content:space-between; align-items:center; margin-top:16px}
.link{background:none; border:none; color:var(--blue); font:inherit; font-size:13px; font-weight:500; cursor:pointer; padding:0}
.link:hover{text-decoration:underline}
.eco-scrim{display:none; position:fixed; inset:0; background:rgba(26,26,26,.45); z-index:20; align-items:center; justify-content:center; padding:16px}
.eco-scrim.on{display:flex}
.eco{background:#fff; border-radius:16px; max-width:680px; width:100%; max-height:92vh; overflow-y:auto; padding:20px}
.eco h3{font-size:16px; font-weight:600}
.eco .sub{font-size:12px; color:var(--ink-3); margin-bottom:10px}
.legend{display:flex; gap:8px; flex-wrap:wrap; margin:10px 0}
.lg{font-size:11px; font-weight:600; padding:3px 9px; border-radius:999px}
.lg.pool{background:#EEEDFE; color:#534AB7}
.lg.sup{background:#E1F5EE; color:#0F6E56}
.lg.ovf{background:var(--amber-bg); color:var(--amber-ink)}
.ecofoot{display:flex; justify-content:space-between; align-items:center; margin-top:12px; flex-wrap:wrap; gap:8px}
.ecohint{font-size:12px; color:var(--ink-2)}

/* ---- domain redesign: six-tab Setup shell (U1) ---- */
.linkbtn{background:none; border:none; color:var(--blue); font:inherit; font-size:12px; font-weight:500; cursor:pointer; padding:0}
.linkbtn:hover{text-decoration:underline}
.pstrip{display:flex; align-items:center; gap:9px; font-size:12.5px; color:var(--amber-ink); background:var(--amber-bg);
  border:0.5px solid #EAD1A4; border-radius:10px; padding:8px 12px; margin-bottom:12px}
.pstrip.done{color:var(--green-ink); background:var(--green-bg); border-color:#CBDDB4}
.pstrip .btn{margin-left:auto}
.glyph{font-size:10px}
.glyph.ok{color:var(--green-ink)}
.glyph.todo{color:var(--amber-ink)}
.subtabs{display:flex; gap:6px; border-bottom:0.5px solid var(--line); margin-bottom:18px; overflow-x:auto}
.subtabs button{display:flex; align-items:center; gap:6px; padding:9px 13px; border:none; border-bottom:2px solid transparent;
  background:none; font:inherit; font-size:13px; color:var(--ink-2); cursor:pointer; white-space:nowrap}
.subtabs button.on{color:var(--blue-deep); font-weight:600; border-bottom-color:var(--blue)}
.subtabs button:focus-visible{outline:2px solid var(--blue); outline-offset:-2px}
.subtabs .count{font-size:10.5px; color:var(--ink-3); background:var(--canvas); border:0.5px solid var(--line); border-radius:999px; padding:1px 7px}
.subtabs button.on .count{background:var(--blue-tint); border-color:var(--blue-line); color:var(--blue-deep)}
/* The Setup tabpanel is NOT a card: it already sits inside the tab chrome, and
   filling it white made every nested list/row/detail card white-on-white with
   hairlines as the only separation. Scoped with .flat so the real cards on
   Results and Levers keep .panel (and their own h3 sizing) untouched. */
.panel.flat{background:transparent; border:none; border-radius:0; padding:0}
/* A segment body is already inside the .sec card, so the panel inside it must
   add no second card \u2014 but it keeps the section's own padding. */
/* One collapsible idiom for the option groups INSIDE a tab: registry lists,
   request-type sections, queue KPI families, Defaults groups. Collapse is
   CSS-driven so the fields stay mounted and a half-typed value survives a
   toggle. */
.drw{width:100%; border:0.5px solid var(--line); border-radius:11px; background:#fff; margin-bottom:8px}
.drwhead{display:flex; align-items:center; gap:9px; width:100%; background:none; border:none; font:inherit;
  text-align:left; padding:10px 13px; cursor:pointer; border-radius:11px}
.drwhead:hover b{color:var(--blue-deep)}
.drwhead:focus-visible{outline:2px solid var(--blue); outline-offset:-2px}
.drwhead b{font-size:13px; font-weight:600}
.drwhead small{display:block; font-size:11.5px; color:var(--ink-3); font-weight:400; margin-top:1px}
.drwhead .count{margin-left:auto; font-size:10.5px; color:var(--ink-3); background:var(--canvas);
  border:0.5px solid var(--line); border-radius:999px; padding:1px 8px; white-space:nowrap}
.drwhead .chev{font-size:8px; color:var(--ink-3); transition:transform 0.12s}
.drw.open>.drwhead .chev{transform:rotate(180deg)}
.usagenote{cursor:help; border-bottom:0.5px dotted var(--line)}
.usage-none{opacity:0.75; font-style:italic}
.prodbrand{font-size:11.5px; padding:3px 7px; border:0.5px solid var(--line); border-radius:7px; background:#fff; font-family:inherit}
.info{display:inline-flex; align-items:center; justify-content:center; width:16px; height:16px; flex:none;
  border-radius:50%; border:0.5px solid var(--line); background:var(--canvas); color:var(--ink-3);
  font-size:9.5px; font-weight:700; cursor:help; margin-left:6px; vertical-align:1px}
.info:hover{border-color:var(--blue-line); background:var(--blue-tint); color:var(--blue-deep)}
.tabnote{font-size:12px; color:var(--ink-2); background:var(--canvas); border:0.5px solid var(--line);
  border-radius:9px; padding:8px 12px; margin:0 0 14px}
.drwbody{display:none; padding:2px 13px 12px}
.drw.open>.drwbody{display:block}
.panel.flat h3{font-size:15px; font-weight:600; margin-bottom:2px}
.panel.flat>.hint{margin-bottom:12px}
.phase-note{font-size:11.5px; color:var(--ink-3); border-top:0.5px dashed var(--line); margin-top:16px; padding-top:8px}
.reglist{border:0.5px solid var(--line); border-radius:10px; background:#fff; padding:10px 12px; margin-bottom:8px}
.reghead{display:flex; align-items:center; gap:8px; font-size:12.5px; margin-bottom:6px}
.reghead .count{font-size:10.5px; color:var(--ink-3); background:var(--canvas); border:0.5px solid var(--line); border-radius:999px; padding:1px 7px}
.regchips{display:flex; gap:6px; flex-wrap:wrap}
.regchips .chip small{color:inherit; opacity:0.7; font-size:10px}
.regrow{border:0.5px solid var(--line); border-radius:10px; background:var(--canvas); padding:8px 10px; margin-bottom:6px}
.regrow:hover{border-color:var(--blue-line)}
.regmain{display:flex; align-items:center; gap:8px; flex-wrap:wrap; row-gap:4px}
.regmain input{flex:1 1 200px; min-width:0; border:0.5px solid var(--line); border-radius:7px; padding:5px 8px; font:inherit; font-size:12.5px; background:#fff}
.regmain input:hover{border-color:var(--blue-line)}
.regmain input:focus{border-color:var(--blue); background:#fff; outline:none}
/* Touch has no hover, so the rename field would be invisible on the very
   layout the owner flagged \u2014 reveal it where hover cannot. */
.regdel{margin-left:auto; border:none; background:none; color:var(--ink-3); font:inherit; font-size:12px; cursor:pointer; padding:2px 6px; border-radius:6px}
.regdel:hover{color:var(--red-ink); background:var(--red-bg)}
.blocked{margin-left:auto; min-width:0; color:var(--amber-ink)}
.regoff{display:flex; gap:6px; flex-wrap:wrap; margin-top:8px}
.chdefaults{margin:4px 0 8px; padding:10px 12px; border:0.5px solid var(--line); border-radius:10px; background:var(--canvas)}
.glyph.err{color:var(--red-ink)}
.rtrow small{display:block}
.proc{border:0.5px solid var(--line); border-radius:10px; background:var(--canvas); padding:10px 12px; margin-bottom:8px}
.prochead{display:flex; align-items:center; gap:8px; margin-bottom:6px}
.prochead .regdel{margin-left:auto}
.termlab{display:flex; align-items:center; gap:4px; white-space:nowrap}
.rework{white-space:nowrap; color:var(--purple)}
.chipx{border:none; background:none; color:inherit; font:inherit; font-size:10px; cursor:pointer; padding:0 0 0 4px; opacity:0.7}
.chipx:hover{opacity:1; color:var(--red-ink)}
.outin{border:0.5px solid var(--line); border-radius:7px; padding:4px 8px; font:inherit; font-size:11.5px; width:120px}
.applies{margin-top:8px}
.v3banner{display:flex; align-items:center; gap:14px; border:0.5px solid var(--blue-line); background:var(--blue-tint);
  border-radius:12px; padding:12px 16px; margin-bottom:16px}
.v3banner b{font-size:13px; color:var(--blue-deep)}
.v3banner p{font-size:12px; color:var(--ink-2); margin-top:2px}
.v3banner .btn{margin-left:auto; white-space:nowrap}
.structgrid{display:block}
/* The step grid's own columns need 478px (550px with a sampling column), which
   overflows the detail pane at every window width \u2014 so it must be its own
   scroll container at ALL widths, not just on a phone. Making .steps a scroll
   container is the load-bearing half: it zeroes the automatic minimum size the
   grid would otherwise force onto .mddetail and out to the page. */
.steps{margin-top:2px; overflow-x:auto; padding-bottom:4px; -webkit-overflow-scrolling:touch}
.steprow{display:grid; grid-template-columns:44px minmax(150px,1.4fr) 64px 44px minmax(110px,1fr) 26px; gap:8px; align-items:center; padding:3px 0; min-width:min-content}
.steps.with-sample .steprow{grid-template-columns:44px minmax(150px,1.4fr) 64px 64px 44px minmax(110px,1fr) 26px}
.steprow.head span{font-size:10.5px; color:var(--ink-3); font-weight:600}
.steprow.head{border-bottom:0.5px solid var(--line); padding-bottom:3px; margin-bottom:2px}
.stepno{font-size:11px; color:var(--ink-3)}
.stepdash{color:var(--ink-3); text-align:center; font-size:11px}
.steprow input[type="checkbox"]{justify-self:start; margin:0}
.scrollx{overflow-x:auto}
.mdgroup{margin-bottom:10px}
.mdgrouplab{font-size:10.5px; color:var(--ink-3); font-weight:600; margin:2px 0 4px}
.fam-sec{border-top:0.5px solid var(--line); padding:0; margin-top:0}
.famhead{display:flex; align-items:center; gap:8px; width:100%; background:none; border:none; font:inherit;
  text-align:left; padding:11px 2px; cursor:pointer}
.famhead .chev{margin-left:auto; font-size:8px; color:var(--ink-3); transition:transform 0.12s}
.fam-sec.open .famhead .chev{transform:rotate(180deg)}
.famhead:hover b{color:var(--blue-deep)}
.famhead:focus-visible{outline:2px solid var(--blue); outline-offset:-2px}
/* Collapse via CSS, not conditional rendering: the fields stay mounted so a
   half-typed value survives a toggle. */
.fambody{display:none; padding:0 2px 12px}
.fam-sec.open .fambody{display:block}
.famhead b{font-size:12.5px}
.derived-strip{margin:6px 0 4px}
.volgrid{min-width:560px}
.volrow{display:grid; grid-template-columns:minmax(220px,1fr) 90px 100px 90px; gap:10px; align-items:center; padding:3px 0; border-bottom:0.5px dashed var(--line)}
.volrow.head{border-bottom:0.5px solid var(--line)}
.volrow.head span{font-size:10.5px; color:var(--ink-3); font-weight:600}
/* Weight must decrease with depth, or the request type outranks the brand that
   contains it while being indented further \u2014 indent and weight disagreeing
   about the same tree is why the grid was hard to read. */
.volrow.lvl0 .volname{font-weight:600}
.volrow.lvl1 .volname{font-weight:600}
.volrow.lvl2 .volname{font-weight:500}
.volname{font-size:12.5px; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  padding-left:calc(var(--lvl,0) * 18px)}
/* The cascade and step grids were the only inputs in the stylesheet never given
   a skin \u2014 they rendered as raw UA widgets next to styled siblings. Written as
   one block with the alignment so the two rules cannot drift apart. Base-block
   font-size on purpose: the phone block (later in source) raises it to 16px. */
.volrow input,.steprow input:not([type="checkbox"]),.steprow select{
  width:100%; font:inherit; font-size:13px; padding:6px 8px;
  border:0.5px solid var(--line); border-radius:8px; background:#fff}
.field input.num,.volrow input,.steprow input:not([type="checkbox"]){text-align:right}
.volrow.head span:nth-child(2),.steprow.head span:nth-child(3){text-align:right}
.steps.with-sample .steprow.head span:nth-child(4){text-align:right}
.prov{font-size:10.5px; border-radius:999px; padding:1px 8px; text-align:center; white-space:nowrap}
.prov.entered{background:var(--blue-tint); color:var(--blue-deep); font-weight:600}
/* equal/sum are the automatic majority \u2014 de-chromed so the two badges worth
   finding (a human number, and a reconciliation) are the only ones that carry
   fill. Flagging fails when every row shouts equally (REVIEW-SETUP \xA73.4 V5). */
.prov.equal{color:var(--ink-3)}
.prov.sum{color:var(--ink-3)}
.prov.scaled{background:var(--amber-bg); color:var(--amber-ink); font-weight:600}
.prov.none{color:var(--ink-3)}
.shapecell{text-align:left; font-size:11px}
.shapecell.set{color:var(--purple); font-weight:600}
.shapebox{grid-column:1/-1; border:0.5px solid var(--line); border-radius:10px; background:var(--canvas); padding:10px 12px; margin:6px 0}
.shapebox textarea{width:100%; border:0.5px solid var(--line); border-radius:8px; font:inherit; font-size:11.5px; padding:6px 8px; margin:8px 0}
.mapsvg{display:block}
.mnode:not(.team) rect{cursor:pointer}
.mnode rect{fill:#fff; stroke:var(--line); stroke-width:1}
.mnode.on rect{stroke:var(--blue); fill:var(--blue-tint)}
.mnode.team rect{fill:var(--canvas); stroke:var(--purple)}
.mnode .mname{font-size:11.5px; font-weight:600; fill:var(--ink); pointer-events:none}
.mnode .mmeta{font-size:9.5px; fill:var(--ink-3); pointer-events:none}
.medge line{stroke:var(--ink-3); stroke-width:1}
.medge.cap line{stroke:var(--purple)}
.medge text{font-size:9px; fill:var(--ink-3); text-anchor:middle}
.medge.cap text{fill:var(--purple)}

/* Focus rings for every control the six-tab Setup introduced. Grouped so a new
   control cannot ship without one \u2014 keyboard users get the same visible focus
   the v2.4 surfaces already had. */
.linkbtn:focus-visible,.chip:focus-visible,.regdel:focus-visible,.chipx:focus-visible,
.mdlist button:focus-visible,.shapecell:focus-visible,.outin:focus-visible,
.volrow input:focus-visible,.steprow input:focus-visible,.steprow select:focus-visible,
.regmain input:focus-visible,.shapebox textarea:focus-visible,.famhead button:focus-visible{
  outline:2px solid var(--blue); outline-offset:2px; border-radius:6px}
.mnode:focus-visible{outline:none}
.mnode:focus-visible rect{stroke:var(--blue); stroke-width:2}
.mnode rect{transition:stroke 0.12s}
/* Team nodes are not selectable \u2014 they must not advertise that they are. */
.mnode:not(.team):hover rect{stroke:var(--blue-mid)}

.md{display:grid; grid-template-columns:minmax(220px,1fr) minmax(260px,1.4fr); gap:12px; align-items:start}
.mdlist{display:flex; flex-direction:column; gap:4px}
.mdlist button{display:grid; grid-template-columns:1fr auto; gap:1px 8px; text-align:left; border:0.5px solid var(--line);
  background:#fff; border-radius:10px; padding:8px 11px; font:inherit; cursor:pointer}
.mdlist button b{font-size:12.5px; font-weight:600}
.mdlist button small{grid-column:1; font-size:10.5px; color:var(--ink-3)}
.mdlist button .qstats{grid-row:1/3; align-self:center; font-size:11px; color:var(--ink-2)}
.mdlist button.on{border-color:var(--blue); background:var(--blue-tint)}
.mdlist button.on small{color:var(--ink-2)}
.mdlist button.shared-cap{border-left:3px solid var(--teal)}
/* :not(.on) \u2014 a bare hover rule has the same specificity as .mdlist button.on
   and, placed after it, would silently clobber the selected row's blue border. */
.mdlist button:not(.on):hover{border-color:var(--blue-line)}
.chip.off:hover,.chip.on-toggle:hover{background:var(--blue-tint); color:var(--blue-deep)}
.subtabs button:hover{color:var(--blue-deep)}
.mddetail{border:0.5px solid var(--line); border-radius:12px; background:#fff; padding:14px 16px}
.mddetail h4{font-size:14px; font-weight:600}
.mddetail>.hint{margin-bottom:10px}
.kv{display:flex; justify-content:space-between; gap:10px; font-size:12.5px; padding:5px 0; border-bottom:0.5px dashed var(--line)}
.kv span{color:var(--ink-2)}
.usage{font-size:12px; color:var(--ink-2); margin-top:8px}
.rtcard{border:0.5px solid var(--line); border-radius:12px; background:#fff; padding:12px 14px; margin-bottom:8px}
.rthead{display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:6px}
.rthead b{font-size:13px}
.procline{display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:12px; padding:5px 0; border-top:0.5px dashed var(--line)}
.procline .chain{color:var(--ink-2)}
.vtable{width:100%; border-collapse:collapse; font-size:12.5px; background:#fff; border:0.5px solid var(--line); border-radius:10px}
.vtable th{text-align:left; font-size:11px; color:var(--ink-3); font-weight:600; padding:7px 10px; border-bottom:0.5px solid var(--line)}
.vtable th.num,.vtable td.num{text-align:right}
.vtable td{padding:7px 10px; border-bottom:0.5px dashed var(--line)}
.valpanel{border:0.5px solid var(--line); border-radius:10px; background:#fff; padding:10px 12px; margin-top:10px}
.okmsg{font-size:12.5px; color:var(--green-ink)}
.errmsg{font-size:12.5px; color:var(--red-ink)}

/* ==== phone layout ===========================================================
   MUST stay last in this stylesheet: these are max-width overrides with the
   same specificity as the base rules, so source order decides. (An earlier
   pass placed this block mid-file, where the later base rules silently beat
   half of it \u2014 the master\u2013detail rows never actually restacked.) */
@media(max-width:640px){
  .shell{padding:0 12px 44px}
  header.top{flex-wrap:wrap; row-gap:6px; padding:10px 0; margin-bottom:12px}
  .tabs{overflow-x:auto; max-width:100%}
  h2{font-size:18px}
  .v3banner{flex-direction:column; align-items:stretch; gap:8px}
  .v3banner .btn{margin-left:0}
  .pstrip{flex-wrap:wrap}
  .pstrip .btn{margin-left:0}
  .subtabs{gap:0; margin-bottom:14px}
  .subtabs button{padding:9px 10px; font-size:12.5px}
  .regmain input{flex:1 1 auto; min-width:0}
  .blocked{white-space:normal; margin-left:0; flex:1 1 100%}
  .md{grid-template-columns:1fr}
  .mdlist button{grid-template-columns:1fr}
  .mdlist button .qstats{grid-row:auto; grid-column:1; margin-top:1px}
  .mddetail{padding:12px}
  .volgrid{min-width:0}
  .volrow{grid-template-columns:1fr 74px 84px; grid-template-areas:"name val prov" "shape shape shape"; gap:6px 8px; padding:6px 0}
  .volrow>.volname{grid-area:name}
  .volrow>input{grid-area:val}
  .volrow>.prov{grid-area:prov}
  .volrow>.shapecell{grid-area:shape; padding-left:0}
  /* The header row is the ONLY place the unit "Daily" appears \u2014 hiding it on
     the contributor's own tab invites weekly figures in a per-day box. */
  .volrow.head>span:nth-child(4){grid-area:shape; padding-left:0}
  .volname{padding-left:calc(var(--lvl,0) * 9px)}
  .fam-sec{padding:8px 0 10px}
  .mddetail{scroll-margin-top:12px}
  .panel.flat h3{flex-wrap:wrap; gap:2px 10px; align-items:baseline}

  /* iOS Safari auto-zooms on focus for any control under 16px and never zooms
     back out \u2014 one tap on any field would leave the page horizontally scrolled
     for the rest of the session. This is the single most disruptive phone bug
     on the surface, so every control is raised together. */
  .field input,.field select,.regmain input,.mixrow input,.mixrow select,
  .outin,.shapebox textarea,.volrow input,.steprow input,.steprow select{font-size:16px}
  .outin{width:100%; flex:1 1 140px}

  /* Comfortable touch targets. button.chip, not .chip \u2014 several .chip are
     non-interactive spans here and on Home, and inflating those adds chrome. */
  .regdel,.chipx{min-width:32px; min-height:32px; display:inline-flex; align-items:center; justify-content:center}
  .steprow .regdel{min-width:0}
  button.chip{min-height:38px}
  .btn.sm{padding:7px 11px}
  .linkbtn{padding:10px 8px; display:inline-block}
  .steprow input[type="checkbox"]{width:20px; height:20px; min-height:24px}
}
@media(max-width:400px){
  /* One field per row: two 150px columns inside a padded card is unreadable
     once labels are as long as "Cross-skill proficiency (%)". */
  .fields{grid-template-columns:1fr}
}
`;

// ui/v2/SetupV3Page.jsx
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var fmt = (n) => n == null || isNaN(n) ? "\u2014" : Math.round(n).toLocaleString("en-GB");
var NAV = [["home", "Home"], ["setup", "Setup"], ["levers", "Levers"], ["results", "Results"]];
var SETUP_TABS = [
  ["structure", "Structure", "The vocabulary of the estate \u2014 brands, business units, channels and products. Each shows what it is used for, so you can see the shape of the estate at a glance. Products belong to a brand, or to all of them."],
  ["queues", "Queues", "The stations work actually lands on, and the physics that staff them. Volume and effective AHT are derived from your processes \u2014 they are never entered here. Tap a queue to open its editor."],
  ["processes", "Processes", "The journeys work can take, defined once and reused. A process is a channel-specific route through your queues, ending in a declared outcome \u2014 attach the same one to as many request types as need it. Process groups are managed here."],
  ["requestTypes", "Request types", "What customers ask for, and how each one is handled. This is the only place brands, business units, channels and queues are wired together \u2014 one process per channel, ending in a declared outcome."],
  ["volume", "Volume", "How much arrives. Type a figure at any level you know; it is authoritative beneath, entered finer figures act as weights, and the rest splits equally. Every number shows where it came from."],
  ["map", "Map", "A generated picture of the estate: routing taken from your process steps, capacity sharing drawn dashed. Nothing is authored here \u2014 it redraws from the model, and lists anything that does not hang together."],
  ["defaults", "Defaults", "The physics every queue inherits unless it overrides them. Channel defaults live in Structure; shared teams live in Queues; risk thresholds are a reading lens on Results."]
];
function computeStatus(model, p) {
  const nBrands = (model.brands || []).length, nBus = (model.businessUnits || []).length, nChans = (model.channels || []).length, nQ = (model.queues || []).length, nRt = (model.requestTypes || []).length, nVe = (model.volumeEntries || []).length;
  const errs = p.validation.errors, warns = p.validation.warnings;
  const nProc = (model.processes || []).length;
  const procBad = (model.processes || []).filter(
    (pr) => !(pr.steps || []).length || !(pr.steps || []).some((st) => st.terminal)
  ).length;
  const structOk = nBrands > 0 && nBus > 0 && nChans > 0;
  const rtErrs = errs.length;
  const uncovered = warns.filter((w) => w.kind === "uncovered_volume").length;
  return [
    {
      key: "structure",
      ok: structOk,
      badge: `${nBrands + nBus + nChans + (model.processGroups || []).length + (model.products || []).length} entities`,
      next: "Add your first brand, business unit and channel in Structure."
    },
    {
      key: "queues",
      ok: nQ > 0,
      badge: `${nQ} queue${nQ === 1 ? "" : "s"}`,
      next: "Add the queues work actually lands on."
    },
    {
      key: "processes",
      ok: nProc > 0 && procBad === 0,
      badge: procBad ? `${procBad} incomplete` : `${nProc} process${nProc === 1 ? "" : "es"}`,
      next: nProc === 0 ? "Define the journeys work can take." : "Finish the processes that do not reach an end point."
    },
    {
      key: "requestTypes",
      ok: nRt > 0 && rtErrs === 0,
      badge: rtErrs ? `${rtErrs} error${rtErrs === 1 ? "" : "s"}` : `${nRt} type${nRt === 1 ? "" : "s"}`,
      next: nRt === 0 ? "Define a request type and wire its process." : "Fix the process errors flagged in Request types."
    },
    {
      key: "volume",
      ok: nVe > 0 && uncovered === 0,
      badge: uncovered ? `${uncovered} uncovered` : `${nVe} entr${nVe === 1 ? "y" : "ies"}`,
      next: nVe === 0 ? "Enter volume at whatever level you know it." : "Cover the volume flagged as reaching no process."
    },
    {
      key: "map",
      ok: p.validation.ok,
      badge: p.validation.ok ? "no issues" : `${errs.length + warns.length} issue${errs.length + warns.length === 1 ? "" : "s"}`,
      next: "Resolve the issues listed in Map."
    },
    {
      key: "defaults",
      ok: !!model.engineConfig,
      badge: model.engineConfig ? "attached" : "missing",
      next: "Attach engine defaults (import a model or start from the sample)."
    }
  ];
}
function DomainImportReport({ report, onDismiss }) {
  const err = report.error;
  const errors = report.errors || [], warnings = report.warnings || [];
  const tone = err || errors.length ? "err" : warnings.length ? "warn" : "ok";
  const bg = tone === "err" ? "var(--red-bg)" : tone === "warn" ? "var(--amber-bg)" : "var(--green-bg)";
  const ink = tone === "err" ? "var(--red-ink)" : tone === "warn" ? "var(--amber-ink)" : "var(--green-ink)";
  const c = report.counts || {};
  return /* @__PURE__ */ jsxs("div", { "data-testid": "import-report", role: "status", style: { border: "0.5px solid " + ink, background: bg, color: ink, borderRadius: 12, padding: "12px 14px", marginBottom: 14 }, children: [
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "flex-start", gap: 8 }, children: [
      /* @__PURE__ */ jsx("b", { style: { fontSize: 13 }, children: tone === "err" ? "\u2715 Import failed" : "Template imported" + (report.filename ? ` \u2014 ${report.filename}` : "") }),
      /* @__PURE__ */ jsx("button", { className: "close", onClick: onDismiss, "aria-label": "Dismiss import report", style: { marginLeft: "auto", color: ink, background: "none", border: "none", cursor: "pointer" }, children: "\u2715" })
    ] }),
    err ? /* @__PURE__ */ jsx("p", { style: { fontSize: 12.5, marginTop: 4 }, children: err }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("p", { style: { fontSize: 12.5, marginTop: 4 }, children: [
        "Loaded ",
        c.brands || 0,
        " brand",
        c.brands === 1 ? "" : "s",
        " \xB7 ",
        c.queues || 0,
        " queue",
        c.queues === 1 ? "" : "s",
        " \xB7 ",
        c.requestTypes || 0,
        " request type",
        c.requestTypes === 1 ? "" : "s",
        " \xB7 ",
        c.volumeEntries || 0,
        " volume entr",
        c.volumeEntries === 1 ? "y" : "ies",
        ".",
        errors.length ? ` ${errors.length} error${errors.length === 1 ? "" : "s"} must be fixed.` : warnings.length ? ` ${warnings.length} warning${warnings.length === 1 ? "" : "s"} to review.` : " No issues."
      ] }),
      errors.slice(0, 5).map((e, i) => /* @__PURE__ */ jsxs("p", { style: { fontSize: 12, marginTop: 2 }, children: [
        "\u2715 ",
        e.message
      ] }, "e" + i)),
      warnings.slice(0, 5).map((w, i) => /* @__PURE__ */ jsxs("p", { style: { fontSize: 12, marginTop: 2 }, children: [
        "\u25B2 ",
        w.message
      ] }, "w" + i))
    ] })
  ] });
}
function SetupV3Page({ model, onModelChange, onNav = () => {
}, onOpenClassic, onDownloadTemplate, onUploadTemplate, importReport, onDismissImport }) {
  const p = useMemo(() => (0, import_propagate.propagateDomain)(model), [model]);
  const status = useMemo(() => computeStatus(model, p), [model, p]);
  const [tab, setTab] = useState("structure");
  const firstTodo = status.find((s) => !s.ok);
  const activeTabRef = useRef(null);
  useEffect(() => {
    activeTabRef.current?.scrollIntoView?.({ inline: "center", block: "nearest" });
  }, [tab]);
  return /* @__PURE__ */ jsxs("div", { className: "shell", children: [
    /* @__PURE__ */ jsxs("header", { className: "top", children: [
      /* @__PURE__ */ jsxs("div", { className: "brand", children: [
        /* @__PURE__ */ jsx("div", { className: "mark", children: "C" }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h1", { children: model.brands && model.brands[0] && model.brands[0].name || "Simulation" }),
          /* @__PURE__ */ jsx("small", { children: "Capacity Simulator" })
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "tabs", role: "tablist", "aria-label": "Sections", children: NAV.map(([k, label]) => /* @__PURE__ */ jsx("button", { role: "tab", className: k === "setup" ? "on" : "", "aria-selected": k === "setup", onClick: () => onNav(k), children: label }, k)) })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "baseline", gap: 10 }, children: [
      /* @__PURE__ */ jsx("h2", { children: "Setup" }),
      onOpenClassic ? /* @__PURE__ */ jsx("button", { className: "linkbtn", onClick: onOpenClassic, children: "\u2190 classic Setup" }) : null
    ] }),
    /* @__PURE__ */ jsx("p", { className: "lede", children: "Six tabs in dependency order \u2014 each consumes what the previous ones defined." }),
    importReport ? /* @__PURE__ */ jsx(DomainImportReport, { report: importReport, onDismiss: onDismissImport }) : null,
    firstTodo ? /* @__PURE__ */ jsxs("div", { className: "pstrip", role: "status", children: [
      /* @__PURE__ */ jsx("span", { className: "glyph todo", children: "\u25B2" }),
      /* @__PURE__ */ jsxs("span", { children: [
        /* @__PURE__ */ jsx("b", { children: "Next:" }),
        " ",
        firstTodo.next
      ] }),
      /* @__PURE__ */ jsx("button", { className: "btn sm", onClick: () => setTab(firstTodo.key), children: "Go" })
    ] }) : null,
    /* @__PURE__ */ jsx("div", { className: "subtabs", role: "tablist", "aria-label": "Setup tabs", children: SETUP_TABS.map(([k, label]) => {
      const s = status.find((x) => x.key === k);
      const on = tab === k;
      return /* @__PURE__ */ jsxs(
        "button",
        {
          role: "tab",
          id: "tab-" + k,
          "aria-controls": "setup-panel",
          "aria-selected": on,
          ref: on ? activeTabRef : null,
          className: on ? "on" : "",
          onClick: () => setTab(k),
          "aria-label": s.ok ? label : label + " \u2014 needs attention: " + s.next,
          children: [
            label,
            !s.ok ? /* @__PURE__ */ jsx("span", { className: "glyph todo", title: s.next, children: "\u25B2" }) : null
          ]
        },
        k
      );
    }) }),
    /* @__PURE__ */ jsxs("div", { role: "tabpanel", id: "setup-panel", "aria-labelledby": "tab-" + tab, "data-tab": tab, className: "panel flat", children: [
      /* @__PURE__ */ jsx("p", { className: "tabnote", "data-testid": "tab-note", children: (SETUP_TABS.find(([k]) => k === tab) || [])[2] }),
      tab === "structure" && /* @__PURE__ */ jsx(StructurePanel, { model, set: onModelChange }),
      tab === "queues" && /* @__PURE__ */ jsx(QueuesPanel, { model, set: onModelChange, p }),
      tab === "processes" && /* @__PURE__ */ jsx(ProcessesPanel, { model, set: onModelChange, p }),
      tab === "requestTypes" && /* @__PURE__ */ jsx(RequestTypesPanel, { model, set: onModelChange, p }),
      tab === "volume" && /* @__PURE__ */ jsx(VolumePanel, { model, set: onModelChange, p }),
      tab === "map" && /* @__PURE__ */ jsx(MapPanel, { model, p, onJump: setTab }),
      tab === "defaults" && /* @__PURE__ */ jsx(DefaultsPanel, { model, set: onModelChange })
    ] }),
    onDownloadTemplate || onUploadTemplate ? /* @__PURE__ */ jsxs("div", { className: "importbox", children: [
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("b", { children: "Bulk edit via the five-sheet template." }),
        " Download comes pre-filled; re-upload validates first."
      ] }),
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 8 }, children: [
        onDownloadTemplate ? /* @__PURE__ */ jsx("button", { className: "btn sm", onClick: () => onDownloadTemplate(model), children: "Download template" }) : null,
        onUploadTemplate ? /* @__PURE__ */ jsx("button", { className: "btn sm primary", onClick: () => onUploadTemplate(), children: "Upload data" }) : null
      ] })
    ] }) : null
  ] });
}
function useRevealOnSelect(sel) {
  const ref = useRef(null);
  useEffect(() => {
    if (sel == null || !ref.current) return;
    ref.current.focus?.();
    if (window.matchMedia?.("(max-width:640px)")?.matches) ref.current.scrollIntoView?.({ block: "start" });
  }, [sel]);
  return ref;
}
function Drawer({ title, sub, info, count, defaultOpen, children, testid }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return /* @__PURE__ */ jsxs("div", { className: "drw" + (open ? " open" : ""), "data-testid": testid, children: [
    /* @__PURE__ */ jsxs("button", { className: "drwhead", "aria-expanded": open, onClick: () => setOpen(!open), children: [
      /* @__PURE__ */ jsxs("span", { children: [
        /* @__PURE__ */ jsx("b", { children: title }),
        info ? /* @__PURE__ */ jsx("span", { className: "info", title: info, "aria-label": info, children: "i" }) : null,
        sub ? /* @__PURE__ */ jsx("small", { children: sub }) : null
      ] }),
      count != null ? /* @__PURE__ */ jsx("span", { className: "count", children: count }) : null,
      /* @__PURE__ */ jsx("span", { className: "chev", children: "\u25BC" })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "drwbody", children })
  ] });
}
var nameOf = (list, id) => {
  const e = (list || []).find((x) => x.id === id);
  return e ? e.name : id;
};
var CH_INFO = "The contact channels this estate uses. All four defaults are ready to use; add your own for anything else. Each channel carries the defaults new processes inherit \u2014 ASA, abandon, patience, concurrency and SLA.";
var REG_INFO = {
  Brands: "The brands you plan for. A request type is assigned to one or more; leaving it unassigned means it applies to every brand.",
  "Business units": "An independent axis from brands \u2014 one BU can serve many brands. Used to scope request types and to give a queue its home.",
  "Process groups": "A way of reporting on similar processes together. The double-cover warning is scoped to a group: two request types in the same group covering the same brand, BU and channel is flagged.",
  Products: "Optional. Tag a request type with the product it concerns, for reporting."
};
var KIND_LABELS = { requestType: ["request type", "request types"], queue: ["queue", "queues"], volumeEntry: ["volume entry", "volume entries"], process: ["process", "processes"] };
function guardSummary(guard) {
  const byKind = {};
  for (const b of guard.blockedBy) byKind[b.kind] = (byKind[b.kind] || 0) + 1;
  return Object.entries(byKind).map(([k, n]) => {
    const [one, many] = KIND_LABELS[k] || [k, k + "s"];
    return `${n} ${n === 1 ? one : many}`;
  }).join(" \xB7 ");
}
function usageOf(model, kind, id) {
  const rts = (model.requestTypes || []).filter((rt) => {
    if (kind === "brand") return (rt.brandIds || []).length ? rt.brandIds.includes(id) : true;
    if (kind === "bu") return (rt.buIds || []).length ? rt.buIds.includes(id) : true;
    if (kind === "channel") return (0, import_domain.processesOf)(model, rt).some((pr) => pr.channelId === id);
    if (kind === "product") return rt.productId === id;
    return false;
  });
  return rts.map((rt) => rt.name);
}
function UsageNote({ names, none }) {
  if (!names.length) return /* @__PURE__ */ jsx("span", { className: "hint usage-none", children: none });
  const shown = names.slice(0, 3).join(", ");
  return /* @__PURE__ */ jsxs("span", { className: "hint usagenote", title: names.join(", "), children: [
    names.length,
    " request type",
    names.length === 1 ? "" : "s",
    ": ",
    shown,
    names.length > 3 ? ` +${names.length - 3}` : ""
  ] });
}
function RegRow({ entity, onRename, guard, onDelete, extra, children }) {
  return /* @__PURE__ */ jsxs("div", { className: "regrow", children: [
    /* @__PURE__ */ jsxs("div", { className: "regmain", children: [
      /* @__PURE__ */ jsx("input", { value: entity.name, onChange: (e) => onRename(e.target.value), "aria-label": "Rename " + entity.name }),
      extra,
      guard.ok ? /* @__PURE__ */ jsx("button", { className: "regdel", onClick: onDelete, "aria-label": "Delete " + entity.name, children: "\u2715" }) : /* @__PURE__ */ jsxs("span", { className: "hint blocked", title: "Referenced by " + guardSummary(guard), children: [
        "\u25B2 in use \u2014 ",
        guardSummary(guard)
      ] })
    ] }),
    children
  ] });
}
function RegistryList({ title, list, hint, info, onAdd, addLabel, row, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return /* @__PURE__ */ jsxs("div", { className: "reglist drw" + (open ? " open" : ""), children: [
    /* @__PURE__ */ jsxs("button", { className: "reghead drwhead", "aria-expanded": open, onClick: () => setOpen(!open), children: [
      /* @__PURE__ */ jsxs("span", { children: [
        /* @__PURE__ */ jsx("b", { children: title }),
        info ? /* @__PURE__ */ jsx("span", { className: "info", title: info, "aria-label": info, children: "i" }) : null
      ] }),
      /* @__PURE__ */ jsx("span", { className: "count", children: (list || []).length }),
      /* @__PURE__ */ jsx("span", { className: "chev", children: "\u25BC" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "drwbody", children: [
      hint ? /* @__PURE__ */ jsx("p", { className: "hint", style: { marginBottom: 6 }, children: hint }) : null,
      (list || []).length === 0 ? /* @__PURE__ */ jsx("span", { className: "hint", children: "none yet" }) : list.map(row),
      onAdd ? /* @__PURE__ */ jsx("div", { style: { marginTop: 8 }, children: /* @__PURE__ */ jsx("button", { className: "btn sm", onClick: onAdd, children: addLabel || "+ Add" }) }) : null
    ] })
  ] });
}
var CH_DEFAULT_FIELDS = [
  ["asaTarget", "ASA target (s)", 1],
  ["maxAbandon", "Max abandon (%)", 100],
  ["patience", "Patience (s)", 1],
  ["concurrency", "Concurrency", 1],
  ["digitalSlaMinutes", "SLA within (min)", 1],
  ["digitalSlaPct", "SLA target (%)", 100]
];
function ChannelRow({ model, c, set }) {
  const [open, setOpen] = useState(false);
  const d = c.defaults || {};
  return /* @__PURE__ */ jsx(
    RegRow,
    {
      entity: c,
      onRename: (name) => set(Ops.renameChannel(model, c.id, name)),
      guard: (0, import_domain.canDeleteChannel)(model, c.id),
      onDelete: () => set(Ops.deleteChannel(model, c.id)),
      extra: /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("span", { className: "tax", children: CHANNEL_LABELS[c.key] || "custom" }),
        /* @__PURE__ */ jsx(UsageNote, { names: usageOf(model, "channel", c.id), none: "not used yet" }),
        /* @__PURE__ */ jsxs("button", { className: "linkbtn", onClick: () => setOpen(!open), "aria-expanded": open, children: [
          "defaults",
          Object.keys(d).length ? " \u25CF" : "",
          /* @__PURE__ */ jsx("span", { className: "chev", children: "\u25BC" })
        ] })
      ] }),
      children: open ? /* @__PURE__ */ jsxs("div", { className: "fields chdefaults", "data-testid": "channel-defaults-" + c.key, children: [
        CH_DEFAULT_FIELDS.map(([k, label, scale]) => /* @__PURE__ */ jsxs("div", { className: "field", children: [
          /* @__PURE__ */ jsx("label", { children: label }),
          /* @__PURE__ */ jsx(
            "input",
            {
              className: "num",
              placeholder: "\u2014",
              value: d[k] != null ? Math.round(d[k] * scale * 100) / 100 : "",
              onChange: (e) => set(Ops.setChannelDefaults(model, c.id, { [k]: e.target.value === "" ? void 0 : (+e.target.value || 0) / scale }))
            }
          )
        ] }, k)),
        /* @__PURE__ */ jsx("p", { className: "hint", style: { gridColumn: "1/-1" }, children: "New processes on this channel inherit these; a queue can still override them." })
      ] }) : null
    }
  );
}
function AddChannel({ model, set }) {
  const [name, setName] = useState("");
  const commit = () => {
    const n = name.trim();
    if (!n) return;
    set(Ops.addChannel(model, { name: n }));
    setName("");
  };
  return /* @__PURE__ */ jsxs("span", { style: { display: "inline-flex", gap: 6, alignItems: "center" }, children: [
    /* @__PURE__ */ jsx(
      "input",
      {
        className: "outin",
        value: name,
        placeholder: "add a channel\u2026",
        "aria-label": "New channel name",
        onChange: (e) => setName(e.target.value),
        onKeyDown: (e) => {
          if (e.key === "Enter") commit();
        }
      }
    ),
    /* @__PURE__ */ jsx("button", { className: "btn sm", disabled: !name.trim(), onClick: commit, children: "Add" })
  ] });
}
function StructurePanel({ model, set }) {
  const plain = [
    ["Brands", "brands", Ops.addBrand, Ops.renameBrand, Ops.deleteBrand, import_domain.canDeleteBrand, "New brand", "+ Brand"],
    ["Business units", "businessUnits", Ops.addBusinessUnit, Ops.renameBusinessUnit, Ops.deleteBusinessUnit, import_domain.canDeleteBU, "New business unit", "+ Business unit"],
    ["Products", "products", Ops.addProduct, Ops.renameProduct, Ops.deleteProduct, import_domain.canDeleteProduct, "New product", "+ Product"]
  ];
  const USAGE_KIND = { brands: "brand", businessUnits: "bu", products: "product" };
  const extraFor = (key, e) => {
    const bits = [];
    if (key === "products") {
      bits.push(
        /* @__PURE__ */ jsxs(
          "select",
          {
            className: "prodbrand",
            value: e.brandId || "",
            "aria-label": "Brand for " + e.name,
            onChange: (ev) => set(Ops.setProductBrand(model, e.id, ev.target.value)),
            children: [
              /* @__PURE__ */ jsx("option", { value: "", children: "All brands" }),
              (model.brands || []).map((b) => /* @__PURE__ */ jsx("option", { value: b.id, children: b.name }, b.id))
            ]
          },
          "brand"
        )
      );
    }
    if (USAGE_KIND[key]) bits.push(/* @__PURE__ */ jsx(UsageNote, { names: usageOf(model, USAGE_KIND[key], e.id), none: "not used yet" }, "u"));
    return bits;
  };
  const enabledKeys = new Set((model.channels || []).map((c) => c.key));
  const offKeys = import_taxonomy2.CHANNELS.filter((k) => !enabledKeys.has(k));
  const [brandsL, busL, prodsL] = plain.map(([title, key, add, rename, del, guard, seed, addLabel]) => /* @__PURE__ */ jsx(
    RegistryList,
    {
      title,
      list: model[key],
      info: REG_INFO[title],
      defaultOpen: key === "brands",
      onAdd: () => set(add(model, { name: seed })),
      addLabel,
      row: (e) => /* @__PURE__ */ jsx(
        RegRow,
        {
          entity: e,
          onRename: (name) => set(rename(model, e.id, name)),
          guard: guard(model, e.id),
          onDelete: () => set(del(model, e.id)),
          extra: extraFor(key, e)
        },
        e.id
      )
    },
    key
  ));
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("h3", { children: [
      "Structure ",
      /* @__PURE__ */ jsx("small", { children: "the vocabulary of the estate" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "structgrid", children: [
      brandsL,
      busL,
      /* @__PURE__ */ jsx(ChannelList, { model, set }),
      prodsL
    ] })
  ] });
}
function ChannelList({ model, set }) {
  const [open, setOpen] = useState(false);
  const enabledKeys = new Set((model.channels || []).map((c) => c.key));
  const offKeys = import_taxonomy2.CHANNELS.filter((k) => !enabledKeys.has(k));
  return /* @__PURE__ */ jsxs("div", { className: "reglist drw" + (open ? " open" : ""), children: [
    /* @__PURE__ */ jsxs("button", { className: "reghead drwhead", "aria-expanded": open, onClick: () => setOpen(!open), children: [
      /* @__PURE__ */ jsxs("span", { children: [
        /* @__PURE__ */ jsx("b", { children: "Channels" }),
        /* @__PURE__ */ jsx("span", { className: "info", "aria-label": CH_INFO, title: CH_INFO, children: "i" })
      ] }),
      /* @__PURE__ */ jsx("span", { className: "count", children: (model.channels || []).length }),
      /* @__PURE__ */ jsx("span", { className: "chev", children: "\u25BC" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "drwbody", children: [
      (model.channels || []).length === 0 ? /* @__PURE__ */ jsx("span", { className: "hint", children: "none yet" }) : null,
      (model.channels || []).map((c) => /* @__PURE__ */ jsx(ChannelRow, { model, c, set }, c.id)),
      /* @__PURE__ */ jsxs("div", { className: "regoff", children: [
        offKeys.map((k) => /* @__PURE__ */ jsxs("button", { className: "chip off", onClick: () => set(Ops.addChannel(model, { key: k, name: CHANNEL_LABELS[k] })), "aria-label": "Enable " + CHANNEL_LABELS[k], children: [
          "+ ",
          CHANNEL_LABELS[k]
        ] }, k)),
        /* @__PURE__ */ jsx(AddChannel, { model, set })
      ] })
    ] })
  ] });
}
function NumF({ label, value, onChange, placeholder }) {
  return /* @__PURE__ */ jsxs("div", { className: "field", children: [
    /* @__PURE__ */ jsx("label", { children: label }),
    /* @__PURE__ */ jsx(
      "input",
      {
        className: "num",
        value,
        placeholder: placeholder || "",
        "aria-label": label,
        onChange: (e) => onChange(e.target.value)
      }
    )
  ] });
}
var n0 = (v) => +v || 0;
var FAM_INFO = {
  Inputs: "What arrives and what it costs to handle. Volume and effective AHT are derived from the processes that route here \u2014 the fallback AHT is only used when a request type does not declare its own.",
  Performance: "The service promise for this queue. Voice queues answer on ASA and abandon; digital queues answer on a percentage within a time. This is what red and amber are measured against.",
  Efficiency: "How hard staff can be run. The occupancy ceiling caps sustainable utilisation; the advanced burnout block models what happens when you exceed it \u2014 attrition rises and handling slows.",
  Workforce: "Who staffs this queue and how they arrive. Covers the hiring pipeline (request to start, training, learning curve), shrinkage, attrition, cross-skilling, and the manual hire plan the Manual strategy uses.",
  Customer: "What a failure here costs commercially \u2014 the churn value applied when this queue misses.",
  Outputs: "The unit costs the plan is priced with."
};
function Fam({ fam, name, children, advanced, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [adv, setAdv] = useState(false);
  return /* @__PURE__ */ jsxs("section", { className: "fam-sec" + (open ? " open" : ""), children: [
    /* @__PURE__ */ jsxs("button", { className: "famhead", onClick: () => setOpen(!open), "aria-expanded": open, children: [
      /* @__PURE__ */ jsx("span", { className: "fam", style: { background: FAMILY_COLORS[fam] } }),
      /* @__PURE__ */ jsx("b", { children: name }),
      FAM_INFO[name] ? /* @__PURE__ */ jsx("span", { className: "info", title: FAM_INFO[name], "aria-label": FAM_INFO[name], children: "i" }) : null,
      /* @__PURE__ */ jsx("span", { className: "chev", children: "\u25BC" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "fambody", children: [
      children,
      advanced ? /* @__PURE__ */ jsx("button", { className: "linkbtn", onClick: () => setAdv(!adv), "aria-expanded": adv, children: adv ? "Hide advanced" : `Advanced (${advanced.count})` }) : null,
      adv && advanced ? /* @__PURE__ */ jsx("div", { style: { marginTop: 8 }, children: advanced.body }) : null
    ] })
  ] });
}
function QueueChips({ model, selfId, list, onToggle, label }) {
  return /* @__PURE__ */ jsxs("div", { className: "field", style: { gridColumn: "1/-1" }, children: [
    /* @__PURE__ */ jsx("label", { children: label }),
    /* @__PURE__ */ jsx("div", { className: "regoff", style: { marginTop: 2 }, children: (model.queues || []).filter((x) => x.id !== selfId).map((x) => {
      const on = (list || []).includes(x.id);
      return /* @__PURE__ */ jsx("button", { className: "chip" + (on ? " on-toggle" : " off"), "aria-pressed": on, onClick: () => onToggle(x.id), children: x.name }, x.id);
    }) })
  ] });
}
function QueueDetail({ model, set, q, d, detailRef, onClosed }) {
  const st = q.staffing || {};
  const et = (0, import_bridge.engineTypeOf)(q);
  const DEF = (0, import_bridge.engineQueueDefaults)(q.homeBrandId || (model.brands[0] || {}).id || "b1", st.channel || (et.type === "voice" ? "voice" : "digital"));
  const eff = { ...DEF, ...st };
  const wf = { ...DEF.wf, ...st.wf || {} };
  const burn = { ...DEF.burn, ...st.burn || {} };
  const upd = (patch) => set(Ops.updateQueueStaffing(model, q.id, patch));
  const updWf = (patch) => upd({ wf: { ...wf, ...patch } });
  const updBurn = (patch) => upd({ burn: { ...burn, ...patch } });
  const updQ = (patch) => set(Ops.updateQueue(model, q.id, patch));
  const usage = (0, import_domain.queueUsage)(model, q.id);
  const guard = (0, import_domain.canDeleteQueue)(model, q.id);
  const voice = et.type === "voice";
  const hires = wf.hires || [];
  const setHires = (h) => updWf({ hires: h });
  return /* @__PURE__ */ jsxs("div", { className: "dbody", "data-testid": "queue-detail", ref: detailRef, tabIndex: -1, "aria-label": q.name, children: [
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }, children: [
      /* @__PURE__ */ jsx("h4", { style: { marginRight: "auto" }, children: q._modified ? /* @__PURE__ */ jsxs(Fragment, { children: [
        "Tuned",
        /* @__PURE__ */ jsx("span", { className: "moddot", style: { marginLeft: 6 }, "aria-label": "modified" })
      ] }) : "Defaults" }),
      /* @__PURE__ */ jsx("button", { className: "btn sm", onClick: () => set(Ops.resetQueueStaffing(model, q.id)), children: "Reset to defaults" }),
      guard.ok ? /* @__PURE__ */ jsx("button", { className: "btn sm danger", onClick: () => {
        set(Ops.deleteQueue(model, q.id));
        onClosed && onClosed();
      }, children: "Delete" }) : /* @__PURE__ */ jsx("span", { className: "hint blocked", style: { marginLeft: 0 }, title: "Referenced by " + guardSummary(guard), children: "\u25B2 in use" })
    ] }),
    /* @__PURE__ */ jsxs("p", { className: "hint derived-strip", children: [
      "Derived: ",
      /* @__PURE__ */ jsxs("b", { className: "num", children: [
        fmt(d ? d.volume : 0),
        "/day"
      ] }),
      " \xB7 eff. AHT ",
      /* @__PURE__ */ jsxs("b", { className: "num", children: [
        fmt(d ? d.effectiveAht : q.fallbackAhtSec),
        " s"
      ] }),
      d && d.ahtMarker !== "queue" ? ` (${d.ahtMarker})` : "",
      " \xB7 ",
      usage.processes ? `used in ${usage.processes} process${usage.processes === 1 ? "" : "es"} across ${usage.brands} brand${usage.brands === 1 ? "" : "s"}` : "not used by any process yet"
    ] }),
    /* @__PURE__ */ jsx(
      Fam,
      {
        fam: "inputs",
        name: "Inputs",
        defaultOpen: true,
        advanced: { count: voice ? 2 : 5, body: /* @__PURE__ */ jsxs("div", { className: "fields", children: [
          /* @__PURE__ */ jsx(NumF, { label: "Priority", value: eff.priority, onChange: (v) => upd({ priority: n0(v) }) }),
          !voice ? /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(NumF, { label: "Concurrency", value: eff.concurrency, onChange: (v) => upd({ concurrency: n0(v) }) }),
            /* @__PURE__ */ jsx(NumF, { label: "Backlog limit", value: eff.backlogLimit, onChange: (v) => upd({ backlogLimit: n0(v) }) }),
            /* @__PURE__ */ jsxs("div", { className: "field", children: [
              /* @__PURE__ */ jsx("label", { children: "Subtype" }),
              /* @__PURE__ */ jsxs("select", { value: st.subtype || "", "aria-label": "Subtype", onChange: (e) => upd({ subtype: e.target.value || void 0 }), children: [
                /* @__PURE__ */ jsx("option", { value: "", children: "Workflow (backlog)" }),
                /* @__PURE__ */ jsx("option", { value: "customer", children: "Customer (live SLA)" })
              ] })
            ] })
          ] }) : null,
          /* @__PURE__ */ jsxs("div", { className: "field", children: [
            /* @__PURE__ */ jsx("label", { children: "Deflects to" }),
            /* @__PURE__ */ jsxs("select", { value: eff.deflectsTo || "", "aria-label": "Deflects to", onChange: (e) => upd({ deflectsTo: e.target.value || null }), children: [
              /* @__PURE__ */ jsx("option", { value: "", children: "\u2014 none" }),
              (model.queues || []).filter((x) => x.id !== q.id).map((x) => /* @__PURE__ */ jsx("option", { value: x.id, children: x.name }, x.id))
            ] })
          ] })
        ] }) },
        children: /* @__PURE__ */ jsxs("div", { className: "fields", children: [
          /* @__PURE__ */ jsxs("div", { className: "field", children: [
            /* @__PURE__ */ jsx("label", { children: "Name" }),
            /* @__PURE__ */ jsx("input", { value: q.name, "aria-label": "Queue name", onChange: (e) => updQ({ name: e.target.value }) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "field", children: [
            /* @__PURE__ */ jsx("label", { children: "Type" }),
            /* @__PURE__ */ jsx("select", { value: q.type, "aria-label": "Queue type", onChange: (e) => updQ({ type: e.target.value }), children: QUEUE_TYPES.map((t) => /* @__PURE__ */ jsx("option", { value: t, children: QTYPE_LABELS[t] }, t)) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "field", children: [
            /* @__PURE__ */ jsx("label", { children: "Home brand" }),
            /* @__PURE__ */ jsxs("select", { value: q.homeBrandId || "", "aria-label": "Home brand", onChange: (e) => updQ({ homeBrandId: e.target.value || void 0 }), children: [
              /* @__PURE__ */ jsx("option", { value: "", children: "\u2014 global" }),
              (model.brands || []).map((b) => /* @__PURE__ */ jsx("option", { value: b.id, children: b.name }, b.id))
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "field", children: [
            /* @__PURE__ */ jsx("label", { children: "Home BU" }),
            /* @__PURE__ */ jsxs("select", { value: q.homeBuId || "", "aria-label": "Home BU", onChange: (e) => updQ({ homeBuId: e.target.value || void 0 }), children: [
              /* @__PURE__ */ jsx("option", { value: "", children: "\u2014 global" }),
              (model.businessUnits || []).map((b) => /* @__PURE__ */ jsx("option", { value: b.id, children: b.name }, b.id))
            ] })
          ] }),
          /* @__PURE__ */ jsx(NumF, { label: "Fallback AHT (s)", value: q.fallbackAhtSec, onChange: (v) => updQ({ fallbackAhtSec: n0(v) }) })
        ] })
      }
    ),
    /* @__PURE__ */ jsx(Fam, { fam: "performance", name: "Performance", children: /* @__PURE__ */ jsxs("div", { className: "fields", children: [
      voice ? /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(NumF, { label: "ASA target (s)", value: eff.asaTarget, onChange: (v) => upd({ asaTarget: n0(v) }) }),
        /* @__PURE__ */ jsx(NumF, { label: "Max abandon (%)", value: Math.round(eff.maxAbandon * 100), onChange: (v) => upd({ maxAbandon: n0(v) / 100 }) })
      ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(NumF, { label: "SLA within (min)", value: eff.digitalSlaMinutes, onChange: (v) => upd({ digitalSlaMinutes: n0(v) }) }),
        /* @__PURE__ */ jsx(NumF, { label: "SLA target (%)", value: Math.round(eff.digitalSlaPct * 100), onChange: (v) => upd({ digitalSlaPct: n0(v) / 100 }) })
      ] }),
      /* @__PURE__ */ jsx(NumF, { label: "Patience (s)", value: eff.patience, onChange: (v) => upd({ patience: n0(v) }) })
    ] }) }),
    /* @__PURE__ */ jsx(
      Fam,
      {
        fam: "efficiency",
        name: "Efficiency",
        advanced: { count: 5, body: /* @__PURE__ */ jsxs("div", { className: "fields", children: [
          /* @__PURE__ */ jsx(NumF, { label: "Burnout threshold (%)", value: Math.round(burn.occThreshold * 100), onChange: (v) => updBurn({ occThreshold: n0(v) / 100 }) }),
          /* @__PURE__ */ jsx(NumF, { label: "Burnout sensitivity", value: burn.sensitivity, onChange: (v) => updBurn({ sensitivity: n0(v) }) }),
          /* @__PURE__ */ jsx(NumF, { label: "Recovery (weeks)", value: burn.recovery, onChange: (v) => updBurn({ recovery: n0(v) }) }),
          /* @__PURE__ */ jsx(NumF, { label: "Max attrition \xD7", value: burn.maxAttritionMult, onChange: (v) => updBurn({ maxAttritionMult: n0(v) }) }),
          /* @__PURE__ */ jsx(NumF, { label: "Absence uplift (%)", value: Math.round(burn.absenceUplift * 100), onChange: (v) => updBurn({ absenceUplift: n0(v) / 100 }) })
        ] }) },
        children: /* @__PURE__ */ jsx("div", { className: "fields", children: /* @__PURE__ */ jsx(NumF, { label: "Occupancy ceiling (%)", value: Math.round((eff.occupancyCeiling ?? 0.85) * 100), onChange: (v) => upd({ occupancyCeiling: n0(v) / 100 }) }) })
      }
    ),
    /* @__PURE__ */ jsx(
      Fam,
      {
        fam: "workforce",
        name: "Workforce",
        advanced: { count: 4 + 1, body: /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsxs("div", { className: "fields", children: [
            /* @__PURE__ */ jsx(NumF, { label: "Attrition growth (/mo)", value: wf.attritionGrowth, onChange: (v) => updWf({ attritionGrowth: n0(v) }) }),
            /* @__PURE__ */ jsxs("div", { className: "field", children: [
              /* @__PURE__ */ jsx("label", { children: "Learning curve (\xD7 by week)" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  value: (wf.learningCurve || []).join(", "),
                  "aria-label": "Learning curve",
                  placeholder: "0.6, 0.8, 0.9, 1",
                  onChange: (e) => updWf({ learningCurve: e.target.value.split(",").map((x) => +x.trim()).filter((x) => !isNaN(x)) })
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsx(
            QueueChips,
            {
              model,
              selfId: q.id,
              list: eff.crossSkill,
              label: "Cross-skilled with",
              onToggle: (id) => upd({ crossSkill: (eff.crossSkill || []).includes(id) ? eff.crossSkill.filter((x) => x !== id) : [...eff.crossSkill || [], id] })
            }
          ),
          /* @__PURE__ */ jsx(
            QueueChips,
            {
              model,
              selfId: q.id,
              list: eff.supports,
              label: "Supports (capacity link)",
              onToggle: (id) => upd({ supports: (eff.supports || []).includes(id) ? eff.supports.filter((x) => x !== id) : [...eff.supports || [], id] })
            }
          ),
          /* @__PURE__ */ jsxs("div", { className: "field", style: { gridColumn: "1/-1", marginTop: 6 }, children: [
            /* @__PURE__ */ jsx("label", { children: "Manual hires (week \xD7 heads)" }),
            hires.map((h, i) => /* @__PURE__ */ jsxs("div", { className: "mixrow", children: [
              /* @__PURE__ */ jsx("span", { className: "hint", children: "week" }),
              /* @__PURE__ */ jsx("input", { className: "num", value: h.week, "aria-label": `hire ${i + 1} week`, onChange: (e) => setHires(hires.map((x, j) => j === i ? { ...x, week: n0(e.target.value) } : x)) }),
              /* @__PURE__ */ jsx("span", { className: "hint", children: "heads" }),
              /* @__PURE__ */ jsx("input", { className: "num", value: h.heads, "aria-label": `hire ${i + 1} heads`, onChange: (e) => setHires(hires.map((x, j) => j === i ? { ...x, heads: n0(e.target.value) } : x)) }),
              /* @__PURE__ */ jsx("button", { className: "regdel", onClick: () => setHires(hires.filter((_, j) => j !== i)), "aria-label": `remove hire ${i + 1}`, children: "\u2715" })
            ] }, i)),
            /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx("button", { className: "btn sm", onClick: () => setHires([...hires, { week: 1, heads: 1 }]), children: "+ Hire" }) })
          ] })
        ] }) },
        children: /* @__PURE__ */ jsxs("div", { className: "fields", children: [
          /* @__PURE__ */ jsxs("div", { className: "field", children: [
            /* @__PURE__ */ jsx("label", { children: "Resourcing" }),
            /* @__PURE__ */ jsxs("select", { value: eff.resourcing || "resourced", "aria-label": "Resourcing", onChange: (e) => upd({ resourcing: e.target.value }), children: [
              /* @__PURE__ */ jsx("option", { value: "resourced", children: "Resourced \u2014 own headcount" }),
              /* @__PURE__ */ jsx("option", { value: "dedicated", children: "Dedicated" }),
              /* @__PURE__ */ jsx("option", { value: "leveraged", children: "Leveraged \u2014 shared pool" }),
              /* @__PURE__ */ jsx("option", { value: "overflow_only", children: "Overflow only" })
            ] })
          ] }),
          /* @__PURE__ */ jsx(NumF, { label: "Starting FTE", value: eff.fte != null ? eff.fte : "", placeholder: "\u2014 sized by strategy", onChange: (v) => upd({ fte: v === "" ? void 0 : n0(v) }) }),
          /* @__PURE__ */ jsx(NumF, { label: "Shrinkage (%)", value: Math.round(eff.shrinkage * 100), onChange: (v) => upd({ shrinkage: n0(v) / 100 }) }),
          /* @__PURE__ */ jsx(NumF, { label: "Attrition (%/mo)", value: Math.round(wf.attrition * 1e3) / 10, onChange: (v) => updWf({ attrition: n0(v) / 100 }) }),
          /* @__PURE__ */ jsx(NumF, { label: "Req \u2192 start (weeks)", value: wf.reqToStart, onChange: (v) => updWf({ reqToStart: n0(v) }) }),
          /* @__PURE__ */ jsx(NumF, { label: "Training (weeks)", value: wf.trainingWeeks, onChange: (v) => updWf({ trainingWeeks: n0(v) }) })
        ] })
      }
    ),
    /* @__PURE__ */ jsx(Fam, { fam: "customer", name: "Customer", children: /* @__PURE__ */ jsxs("div", { className: "fields", children: [
      /* @__PURE__ */ jsx(NumF, { label: "Churn cost (\xA3)", value: eff.churnCost ?? 500, onChange: (v) => upd({ churnCost: n0(v) }) }),
      /* @__PURE__ */ jsx(NumF, { label: "Failed \u2192 churn (%)", value: eff.failedToChurnPct ?? 6, onChange: (v) => upd({ failedToChurnPct: n0(v) }) })
    ] }) }),
    /* @__PURE__ */ jsx(Fam, { fam: "outputs", name: "Outputs", children: /* @__PURE__ */ jsx("div", { className: "fields", children: /* @__PURE__ */ jsx(NumF, { label: "Agent cost (\xA3/yr)", value: eff.agentCost, onChange: (v) => upd({ agentCost: n0(v) }) }) }) })
  ] });
}
function QueuesPanel({ model, set, p }) {
  const queues = model.queues || [];
  const [sel, setSel] = useState(null);
  const detailRef = useRevealOnSelect(sel && sel.id);
  const close = () => setSel(null);
  const q = sel && sel.kind === "queue" ? queues.find((x) => x.id === sel.id) : null;
  const open = !!q;
  const groups = [];
  const byKey = /* @__PURE__ */ new Map();
  for (const x of queues) {
    const label = x.homeBrandId ? nameOf(model.brands, x.homeBrandId) + (x.homeBuId ? " \u203A " + nameOf(model.businessUnits, x.homeBuId) : "") : "Global \u2014 no home";
    if (!byKey.has(label)) {
      byKey.set(label, []);
      groups.push(label);
    }
    byKey.get(label).push(x);
  }
  groups.sort((a, b) => a === "Global \u2014 no home" ? 1 : b === "Global \u2014 no home" ? -1 : 0);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("h3", { children: [
      "Queues ",
      /* @__PURE__ */ jsx("small", { children: "volume and AHT are derived \u2014 tap a queue to edit" })
    ] }),
    /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsxs("div", { children: [
      groups.map((label) => /* @__PURE__ */ jsxs("div", { className: "mdgroup", children: [
        /* @__PURE__ */ jsx("p", { className: "mdgrouplab", children: label }),
        /* @__PURE__ */ jsx("div", { className: "mdlist", role: "listbox", "aria-label": label, children: byKey.get(label).map((x) => {
          const dx = p.queues.get(x.id);
          const u = (0, import_domain.queueUsage)(model, x.id);
          const on = sel && sel.kind === "queue" && sel.id === x.id;
          const shared = x.type === "shared_capacity";
          return /* @__PURE__ */ jsxs("button", { role: "option", "aria-selected": on, className: (on ? "on" : "") + (shared ? " shared-cap" : ""), onClick: () => setSel({ kind: "queue", id: x.id }), children: [
            /* @__PURE__ */ jsxs("b", { children: [
              x.name,
              x._modified ? /* @__PURE__ */ jsx("span", { className: "moddot", style: { marginLeft: 5 }, "aria-label": "modified" }) : null
            ] }),
            /* @__PURE__ */ jsxs("small", { children: [
              QTYPE_LABELS[x.type] || x.type,
              u.processes ? ` \xB7 ${u.processes} process${u.processes === 1 ? "" : "es"} \xB7 ${u.brands} brand${u.brands === 1 ? "" : "s"}` : " \xB7 unused"
            ] }),
            /* @__PURE__ */ jsx("span", { className: "qstats num", children: shared ? "lends capacity" : `${fmt(dx ? dx.volume : 0)}/day \xB7 ${fmt(dx ? dx.effectiveAht : x.fallbackAhtSec)} s${dx && dx.ahtMarker === "weighted" ? " \xB7 weighted" : dx && dx.ahtMarker === "svc" ? " \xB7 svc" : ""}` })
          ] }, x.id);
        }) })
      ] }, label)),
      /* @__PURE__ */ jsx("button", { className: "btn sm", onClick: () => {
        const m2 = Ops.addQueue(model, { name: "New queue", type: "inbound_call" });
        set(m2);
        setSel({ kind: "queue", id: m2.queues[m2.queues.length - 1].id });
      }, children: "+ Queue" })
    ] }) }),
    /* @__PURE__ */ jsx("div", { className: "scrim" + (open ? " on" : ""), onClick: close }),
    /* @__PURE__ */ jsx("aside", { className: "drawer" + (open ? " on" : ""), "aria-label": "Edit queue", "aria-hidden": !open, children: q ? /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("div", { className: "dhead", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h3", { children: q.name }),
          /* @__PURE__ */ jsxs("p", { children: [
            QTYPE_LABELS[q.type] || q.type,
            q.homeBrandId ? " \xB7 " + nameOf(model.brands, q.homeBrandId) : " \xB7 no home"
          ] })
        ] }),
        /* @__PURE__ */ jsx("button", { className: "close", onClick: close, "aria-label": "Close", children: "\u2715" })
      ] }),
      /* @__PURE__ */ jsx(QueueDetail, { model, set, q, d: p.queues.get(q.id), detailRef, onClosed: close })
    ] }) : null })
  ] });
}
function ProcessesPanel({ model, set, p }) {
  const procs = model.processes || [];
  const [sel, setSel] = useState(null);
  const proc = sel ? procs.find((x) => x.id === sel) : null;
  const close = () => setSel(null);
  const detailRef = useRevealOnSelect(sel);
  const groups = model.processGroups || [];
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("h3", { children: [
      "Processes ",
      /* @__PURE__ */ jsx("small", { children: "defined once, attached to any request type" })
    ] }),
    /* @__PURE__ */ jsxs(
      Drawer,
      {
        title: "Process groups",
        count: groups.length,
        defaultOpen: false,
        info: "A way of reporting on similar processes together. The double-cover warning is scoped to a group: two request types in the same group covering the same brand, BU and channel is flagged.",
        children: [
          groups.length === 0 ? /* @__PURE__ */ jsx("span", { className: "hint", children: "none yet" }) : groups.map((g) => /* @__PURE__ */ jsx(
            RegRow,
            {
              entity: g,
              onRename: (name) => set(Ops.renameProcessGroup(model, g.id, name)),
              guard: (0, import_domain.canDeleteGroup)(model, g.id),
              onDelete: () => set(Ops.deleteProcessGroup(model, g.id))
            },
            g.id
          )),
          /* @__PURE__ */ jsx("div", { style: { marginTop: 8 }, children: /* @__PURE__ */ jsx("button", { className: "btn sm", onClick: () => set(Ops.addProcessGroup(model, { name: "New group" })), children: "+ Group" }) })
        ]
      }
    ),
    /* @__PURE__ */ jsxs(
      Drawer,
      {
        title: "Processes",
        count: procs.length,
        defaultOpen: true,
        info: "Each process is one specific journey on one channel. Steps route a percentage of what reaches them to a queue; the step marked Ends declares the outcome. Reuse is the point \u2014 the same process can serve many request types.",
        children: [
          procs.length === 0 ? /* @__PURE__ */ jsx("p", { className: "hint", children: "No processes yet \u2014 add one, then attach it to a request type." }) : null,
          /* @__PURE__ */ jsx("div", { className: "mdlist", role: "listbox", "aria-label": "Processes", children: procs.map((x) => {
            const u = Ops.processUsage(model, x.id);
            const bad = !(x.steps || []).length || !(x.steps || []).some((st) => st.terminal);
            return /* @__PURE__ */ jsxs("button", { role: "option", "aria-selected": sel === x.id, className: sel === x.id ? "on" : "", onClick: () => setSel(x.id), children: [
              /* @__PURE__ */ jsxs("b", { children: [
                x.name,
                " ",
                /* @__PURE__ */ jsx("span", { className: "glyph " + (bad ? "err" : "ok"), children: bad ? "\u2715" : "\u25CF" })
              ] }),
              /* @__PURE__ */ jsxs("small", { children: [
                nameOf(model.channels, x.channelId),
                x.groupId ? " \xB7 " + nameOf(groups, x.groupId) : "",
                " \xB7 ",
                (x.steps || []).length,
                " step",
                (x.steps || []).length === 1 ? "" : "s"
              ] }),
              /* @__PURE__ */ jsx("span", { className: "qstats", children: u.requestTypes ? `used by ${u.requestTypes} request type${u.requestTypes === 1 ? "" : "s"}` : "not attached yet" })
            ] }, x.id);
          }) }),
          /* @__PURE__ */ jsx("div", { style: { marginTop: 8 }, children: /* @__PURE__ */ jsx("button", { className: "btn sm", disabled: !(model.channels || []).length, onClick: () => {
            const m2 = Ops.createProcess(model, { name: "New process", channelId: model.channels[0].id });
            set(m2);
            setSel(m2.processes[m2.processes.length - 1].id);
          }, children: "+ Process" }) })
        ]
      }
    ),
    /* @__PURE__ */ jsx("div", { className: "scrim" + (proc ? " on" : ""), onClick: close }),
    /* @__PURE__ */ jsx("aside", { className: "drawer" + (proc ? " on" : ""), "aria-label": "Edit process", "aria-hidden": !proc, children: proc ? /* @__PURE__ */ jsx(ProcessDetail, { model, set, proc, detailRef, onClosed: close }) : null })
  ] });
}
function ProcessDetail({ model, set, proc, detailRef, onClosed }) {
  const u = Ops.processUsage(model, proc.id);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("div", { className: "dhead", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h3", { children: proc.name }),
        /* @__PURE__ */ jsxs("p", { children: [
          nameOf(model.channels, proc.channelId),
          " \xB7 ",
          u.requestTypes ? `used by ${u.names.join(", ")}` : "not attached to any request type"
        ] })
      ] }),
      /* @__PURE__ */ jsx("button", { className: "close", onClick: onClosed, "aria-label": "Close", children: "\u2715" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "dbody", "data-testid": "process-detail", ref: detailRef, tabIndex: -1, children: [
      u.requestTypes > 1 ? /* @__PURE__ */ jsxs("p", { className: "warnmsg", children: [
        "\u25B2 Shared by ",
        u.requestTypes,
        " request types \u2014 an edit here changes all of them."
      ] }) : null,
      /* @__PURE__ */ jsxs("div", { className: "fields", children: [
        /* @__PURE__ */ jsxs("div", { className: "field", children: [
          /* @__PURE__ */ jsx("label", { children: "Name" }),
          /* @__PURE__ */ jsx("input", { value: proc.name, "aria-label": "Process name", onChange: (e) => set(Ops.updateProcessMeta(model, proc.id, { name: e.target.value })) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "field", children: [
          /* @__PURE__ */ jsx("label", { children: "Channel" }),
          /* @__PURE__ */ jsx("select", { value: proc.channelId, "aria-label": "Process channel", onChange: (e) => set(Ops.updateProcessMeta(model, proc.id, { channelId: e.target.value })), children: (model.channels || []).map((c) => /* @__PURE__ */ jsx("option", { value: c.id, children: c.name }, c.id)) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "field", children: [
          /* @__PURE__ */ jsx("label", { children: "Process group" }),
          /* @__PURE__ */ jsxs("select", { value: proc.groupId || "", "aria-label": "Process group", onChange: (e) => set(Ops.updateProcessMeta(model, proc.id, { groupId: e.target.value || void 0 })), children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "\u2014 none" }),
            (model.processGroups || []).map((g) => /* @__PURE__ */ jsx("option", { value: g.id, children: g.name }, g.id))
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx(ProcessSteps, { model, set, proc }),
      /* @__PURE__ */ jsx("div", { style: { marginTop: 16, borderTop: "0.5px solid var(--line)", paddingTop: 10 }, children: /* @__PURE__ */ jsxs("button", { className: "btn sm danger", onClick: () => {
        set(Ops.deleteProcessById(model, proc.id));
        onClosed && onClosed();
      }, children: [
        "Delete process",
        u.requestTypes ? ` (detaches from ${u.requestTypes})` : ""
      ] }) })
    ] })
  ] });
}
var fmtPct = (x) => (Math.round(x * 10) / 10).toLocaleString("en-GB");
function ToggleChips({ label, options, selected, onToggle, allLabel }) {
  return /* @__PURE__ */ jsxs("div", { className: "field", children: [
    /* @__PURE__ */ jsx("label", { children: label }),
    /* @__PURE__ */ jsxs("div", { className: "regoff", role: "group", "aria-label": label, children: [
      options.map((o) => {
        const on = selected.includes(o.id);
        return /* @__PURE__ */ jsx(
          "button",
          {
            className: "chip" + (on ? " on-toggle" : " off"),
            "aria-pressed": on,
            onClick: () => onToggle(o.id),
            children: on ? o.name : "+ " + o.name
          },
          o.id
        );
      }),
      options.length === 0 ? /* @__PURE__ */ jsx("span", { className: "hint", children: allLabel }) : null
    ] })
  ] });
}
function ProcessSteps({ model, set, proc }) {
  const [newOutcome, setNewOutcome] = useState("");
  const upd = (i, patch) => set(Ops.updateProcessStep(model, proc.id, i, patch));
  const noTerminal = (proc.steps || []).length > 0 && !proc.steps.some((s) => s.terminal);
  const hasGov = (proc.steps || []).some((s) => {
    const q = (model.queues || []).find((x) => x.id === s.queueId);
    return q && q.type === "governance";
  });
  const pid = proc.id;
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    (proc.steps || []).length === 0 ? /* @__PURE__ */ jsx("p", { className: "hint", style: { margin: "4px 0" }, children: "No steps yet \u2014 this process is inert until it routes somewhere." }) : /* @__PURE__ */ jsxs("div", { className: "steps" + (hasGov ? " with-sample" : ""), children: [
      /* @__PURE__ */ jsxs("div", { className: "steprow head", children: [
        /* @__PURE__ */ jsx("span", { children: "Step" }),
        /* @__PURE__ */ jsx("span", { children: "Queue" }),
        /* @__PURE__ */ jsx("span", { children: "Split %" }),
        hasGov ? /* @__PURE__ */ jsx("span", { children: "Sample %" }) : null,
        /* @__PURE__ */ jsx("span", { children: "Ends" }),
        /* @__PURE__ */ jsx("span", { children: "Outcome" }),
        /* @__PURE__ */ jsx("span", {})
      ] }),
      (proc.steps || []).map((s, i) => {
        const q = (model.queues || []).find((x) => x.id === s.queueId);
        const gov = q && q.type === "governance";
        const p01 = (+s.splitPct || 0) / 100;
        const reworkTitle = p01 > 0 && p01 < 1 ? `Routes ${s.splitPct}% of what reaches it. If this branch is rework, repeated rounds compound to an effective ${fmtPct(p01 / (1 - p01) * 100)}%.` : void 0;
        return /* @__PURE__ */ jsxs("div", { className: "steprow", children: [
          /* @__PURE__ */ jsx("span", { className: "stepno", children: i === 0 ? "entry" : i + 1 }),
          /* @__PURE__ */ jsx("select", { value: s.queueId, onChange: (e) => upd(i, { queueId: e.target.value }), "aria-label": `${pid} step ${i + 1} queue`, children: (model.queues || []).map((x) => /* @__PURE__ */ jsx("option", { value: x.id, children: x.name }, x.id)) }),
          /* @__PURE__ */ jsx("input", { className: "num", value: s.splitPct, title: reworkTitle, onChange: (e) => upd(i, { splitPct: +e.target.value || 0 }), "aria-label": `${pid} step ${i + 1} split percent` }),
          hasGov ? gov ? /* @__PURE__ */ jsx(
            "input",
            {
              className: "num",
              value: s.samplingPct != null ? s.samplingPct : "",
              placeholder: "\u2014",
              onChange: (e) => upd(i, { samplingPct: e.target.value === "" ? void 0 : +e.target.value }),
              "aria-label": `${pid} step ${i + 1} sampling percent`
            }
          ) : /* @__PURE__ */ jsx("span", { className: "stepdash", children: "\u2014" }) : null,
          /* @__PURE__ */ jsx("input", { type: "checkbox", checked: !!s.terminal, onChange: (e) => upd(i, { terminal: e.target.checked ? true : false }), "aria-label": `${pid} step ${i + 1} terminal` }),
          s.terminal ? /* @__PURE__ */ jsxs("select", { value: s.outcome || "", onChange: (e) => upd(i, { outcome: e.target.value || void 0 }), "aria-label": `${pid} step ${i + 1} outcome`, children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "outcome\u2026" }),
            (proc.outcomes || []).map((o) => /* @__PURE__ */ jsx("option", { value: o, children: o }, o))
          ] }) : /* @__PURE__ */ jsx("span", { className: "stepdash", children: "\u2014" }),
          /* @__PURE__ */ jsx("button", { className: "regdel", onClick: () => set(Ops.removeProcessStep(model, proc.id, i)), "aria-label": `${pid} remove step ${i + 1}`, children: "\u2715" })
        ] }, i);
      })
    ] }),
    noTerminal ? /* @__PURE__ */ jsx("p", { className: "errmsg", children: '\u2715 No terminal step \u2014 the process leads nowhere. Mark the final step "ends" and pick its outcome.' }) : null,
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 6 }, children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          className: "btn sm",
          disabled: !(model.queues || []).length,
          onClick: () => set(Ops.addProcessStep(model, proc.id, { queueId: model.queues[0].id })),
          children: "+ Step"
        }
      ),
      /* @__PURE__ */ jsx("span", { className: "hint", style: { marginLeft: 8 }, children: "outcomes:" }),
      (proc.outcomes || []).map((o) => {
        const used = (proc.steps || []).some((s) => s.outcome === o);
        return /* @__PURE__ */ jsxs("span", { className: "chip", children: [
          o,
          used ? /* @__PURE__ */ jsx("small", { title: "Referenced by a terminal step", children: " \xB7in use" }) : /* @__PURE__ */ jsx("button", { className: "chipx", onClick: () => set(Ops.setProcessOutcomes(model, proc.id, proc.outcomes.filter((x) => x !== o))), "aria-label": "Remove outcome " + o, children: "\u2715" })
        ] }, o);
      }),
      /* @__PURE__ */ jsx("input", { className: "outin", placeholder: "add outcome\u2026", value: newOutcome, onChange: (e) => setNewOutcome(e.target.value), "aria-label": `${pid} new outcome` }),
      /* @__PURE__ */ jsx("button", { className: "btn sm", disabled: !newOutcome.trim(), onClick: () => {
        const o = newOutcome.trim();
        if (o && !(proc.outcomes || []).includes(o)) set(Ops.setProcessOutcomes(model, proc.id, [...proc.outcomes || [], o]));
        setNewOutcome("");
      }, children: "Add" })
    ] })
  ] });
}
function ProcessEditor({ model, set, rt, proc }) {
  const [armed, setArmed] = useState(false);
  const chName = nameOf(model.channels, proc.channelId);
  const usage = proc.id ? Ops.processUsage(model, proc.id) : { requestTypes: 1 };
  const detach = () => set(Ops.deleteProcess(model, rt.id, proc.channelId));
  const needsConfirm = (proc.steps || []).length > 0;
  return /* @__PURE__ */ jsxs("div", { className: "proc", "data-testid": "process-" + rt.id + "-" + proc.channelId, children: [
    /* @__PURE__ */ jsxs("div", { className: "prochead", children: [
      /* @__PURE__ */ jsx("span", { className: "chip on-toggle", children: chName }),
      /* @__PURE__ */ jsxs("span", { className: "hint", children: [
        proc.name,
        usage.requestTypes > 1 ? ` \xB7 shared with ${usage.requestTypes - 1} other request type${usage.requestTypes === 2 ? "" : "s"}` : ""
      ] }),
      armed ? /* @__PURE__ */ jsxs(
        "button",
        {
          className: "btn sm danger",
          style: { marginLeft: "auto" },
          "aria-label": "Remove " + chName + " process",
          onBlur: () => setArmed(false),
          onKeyDown: (e) => {
            if (e.key === "Escape") setArmed(false);
          },
          onClick: detach,
          children: [
            "Remove ",
            (proc.steps || []).length,
            " step",
            (proc.steps || []).length === 1 ? "" : "s",
            "?"
          ]
        }
      ) : /* @__PURE__ */ jsx(
        "button",
        {
          className: "regdel",
          "aria-label": "Remove " + chName + " process",
          onClick: () => needsConfirm ? setArmed(true) : detach(),
          children: "\u2715"
        }
      )
    ] }),
    usage.requestTypes > 1 ? /* @__PURE__ */ jsx("p", { className: "hint", style: { marginBottom: 4 }, children: "Editing these steps changes every request type that uses this process." }) : null,
    /* @__PURE__ */ jsx(ProcessSteps, { model, set, proc })
  ] });
}
function AttachProcess({ model, set, rt, offChannels }) {
  const taken = new Set((0, import_domain.processesOf)(model, rt).map((x) => x.channelId));
  const available = (model.processes || []).filter(
    (x) => !(rt.processIds || []).includes(x.id) && !taken.has(x.channelId)
  );
  const [pick, setPick] = useState("");
  return /* @__PURE__ */ jsxs("div", { style: { marginTop: 8 }, children: [
    available.length ? /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }, children: [
      /* @__PURE__ */ jsx("span", { className: "hint", children: "Reuse an existing process:" }),
      /* @__PURE__ */ jsxs("select", { value: pick, "aria-label": "Attach an existing process", onChange: (e) => setPick(e.target.value), children: [
        /* @__PURE__ */ jsx("option", { value: "", children: "choose\u2026" }),
        available.map((x) => /* @__PURE__ */ jsxs("option", { value: x.id, children: [
          x.name,
          " \u2014 ",
          nameOf(model.channels, x.channelId)
        ] }, x.id))
      ] }),
      /* @__PURE__ */ jsx("button", { className: "btn sm", disabled: !pick, onClick: () => {
        set(Ops.attachProcess(model, rt.id, pick));
        setPick("");
      }, children: "Attach" })
    ] }) : null,
    offChannels.length ? /* @__PURE__ */ jsxs("div", { className: "regoff", children: [
      /* @__PURE__ */ jsx("span", { className: "hint", style: { alignSelf: "center" }, children: "or start a new one:" }),
      offChannels.map((c) => /* @__PURE__ */ jsxs("button", { className: "chip off", onClick: () => set(Ops.addProcess(model, rt.id, c.id)), "aria-label": "Add " + c.name + " process", children: [
        "+ ",
        c.name
      ] }, c.id))
    ] }) : null
  ] });
}
function RequestTypesPanel({ model, set, p }) {
  const rts = model.requestTypes || [];
  const [sel, setSel] = useState(rts[0] ? rts[0].id : null);
  const detailRef = useRevealOnSelect(sel);
  const rt = rts.find((x) => x.id === sel) || rts[0] || null;
  const rtErr = (x) => p.validation.errors.filter((e) => e.requestTypeId === x.id);
  const rtWarn = (x) => p.validation.warnings.filter((w) => (w.requestTypeIds || []).includes(x.id));
  const assignLine = (x) => {
    const b = (x.brandIds || []).length ? x.brandIds.map((i) => nameOf(model.brands, i)).join(", ") : "all brands";
    const u = (x.buIds || []).length ? x.buIds.map((i) => nameOf(model.businessUnits, i)).join(", ") : "all BUs";
    return b + " \xB7 " + u;
  };
  const offChannels = rt ? (model.channels || []).filter((c) => !(0, import_domain.processesOf)(model, rt).some((pr) => pr.channelId === c.id)) : [];
  const guard = rt ? (0, import_domain.canDeleteRequestType)(model, rt.id) : { ok: true, blockedBy: [] };
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("h3", { children: [
      "Request types ",
      /* @__PURE__ */ jsx("small", { children: "the only place things are wired together" })
    ] }),
    rts.length === 0 ? /* @__PURE__ */ jsx("p", { className: "hint", children: "No request types yet \u2014 add one to wire brands, channels and queues together." }) : null,
    /* @__PURE__ */ jsxs("div", { className: "md", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("div", { className: "mdlist", role: "listbox", "aria-label": "Request types", children: rts.map((x) => {
          const errs = rtErr(x), warns = rtWarn(x);
          return /* @__PURE__ */ jsxs("button", { role: "option", "aria-selected": !!(rt && rt.id === x.id), className: "rtrow" + (rt && rt.id === x.id ? " on" : ""), onClick: () => setSel(x.id), children: [
            /* @__PURE__ */ jsxs("b", { children: [
              x.name,
              " ",
              /* @__PURE__ */ jsx("span", { className: "glyph " + (errs.length ? "err" : warns.length ? "todo" : "ok"), children: errs.length ? "\u2715" : warns.length ? "\u25B2" : "\u25CF" })
            ] }),
            /* @__PURE__ */ jsxs("small", { children: [
              nameOf(model.processGroups, x.groupId) || "no group",
              x.productId ? " \xB7 " + nameOf(model.products, x.productId) : "",
              " \xB7 ",
              assignLine(x)
            ] }),
            /* @__PURE__ */ jsx("small", { children: (0, import_domain.processesOf)(model, x).map((pr) => nameOf(model.channels, pr.channelId)).join(" \xB7 ") || "no processes" })
          ] }, x.id);
        }) }),
        /* @__PURE__ */ jsx("button", { className: "btn sm", style: { marginTop: 4 }, onClick: () => {
          const m2 = Ops.addRequestType(model, { name: "New request type", groupId: (model.processGroups[0] || {}).id });
          set(m2);
          setSel(m2.requestTypes[m2.requestTypes.length - 1].id);
        }, children: "+ Request type" })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "mddetail", "data-testid": "rt-detail", ref: detailRef, tabIndex: -1, children: rt ? /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(
          Drawer,
          {
            title: "Identity",
            defaultOpen: true,
            info: "What this request is and how it is classified. The process group drives double-cover reporting; the AHT override replaces the queue's own handling time wherever this request type is routed.",
            children: /* @__PURE__ */ jsxs("div", { className: "fields", children: [
              /* @__PURE__ */ jsxs("div", { className: "field", children: [
                /* @__PURE__ */ jsx("label", { children: "Name" }),
                /* @__PURE__ */ jsx("input", { value: rt.name, onChange: (e) => set(Ops.updateRequestType(model, rt.id, { name: e.target.value })), "aria-label": "Request type name" })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "field", children: [
                /* @__PURE__ */ jsx("label", { children: "Activity" }),
                /* @__PURE__ */ jsx("select", { value: rt.activity, "aria-label": "Activity", onChange: (e) => set(Ops.updateRequestType(model, rt.id, { activity: e.target.value })), children: ACTIVITIES.map((a) => /* @__PURE__ */ jsx("option", { value: a, children: ACTIVITY_LABELS[a] }, a)) })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "field", children: [
                /* @__PURE__ */ jsx("label", { children: "Product request" }),
                /* @__PURE__ */ jsxs("select", { value: rt.productRequest, "aria-label": "Product request", onChange: (e) => set(Ops.updateRequestType(model, rt.id, { productRequest: e.target.value })), children: [
                  /* @__PURE__ */ jsx("option", { value: "existing", children: "Existing product" }),
                  /* @__PURE__ */ jsx("option", { value: "new", children: "New product" })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "field", children: [
                /* @__PURE__ */ jsx("label", { children: "Process group" }),
                /* @__PURE__ */ jsxs("select", { value: rt.groupId || "", onChange: (e) => set(Ops.updateRequestType(model, rt.id, { groupId: e.target.value || void 0 })), "aria-label": "Process group", children: [
                  /* @__PURE__ */ jsx("option", { value: "", children: "\u2014 none" }),
                  (model.processGroups || []).map((g) => /* @__PURE__ */ jsx("option", { value: g.id, children: g.name }, g.id))
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "field", children: [
                /* @__PURE__ */ jsx("label", { children: "Product (optional)" }),
                /* @__PURE__ */ jsxs("select", { value: rt.productId || "", onChange: (e) => set(Ops.updateRequestType(model, rt.id, { productId: e.target.value || void 0 })), "aria-label": "Product", children: [
                  /* @__PURE__ */ jsx("option", { value: "", children: "\u2014 none" }),
                  (model.products || []).map((g) => /* @__PURE__ */ jsx("option", { value: g.id, children: g.name }, g.id))
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "field", children: [
                /* @__PURE__ */ jsx("label", { children: "AHT override (s) \u2014 optional" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    className: "num",
                    placeholder: "\u2014 uses queue AHT",
                    value: rt.ahtSec != null ? rt.ahtSec : "",
                    onChange: (e) => set(Ops.updateRequestType(model, rt.id, { ahtSec: e.target.value === "" ? void 0 : +e.target.value })),
                    "aria-label": "AHT override"
                  }
                )
              ] })
            ] })
          }
        ),
        /* @__PURE__ */ jsxs(
          Drawer,
          {
            title: "Assignment",
            info: "Which brands and business units this request type applies to. Selecting none means ALL \u2014 useful for a request every brand handles the same way. Two request types in the same process group covering the same brand, BU and channel raise a double-cover warning.",
            children: [
              /* @__PURE__ */ jsx("p", { className: "hint", children: "None selected = applies to all." }),
              /* @__PURE__ */ jsx(
                ToggleChips,
                {
                  label: "Brands",
                  options: model.brands || [],
                  selected: rt.brandIds || [],
                  allLabel: "no brands defined yet",
                  onToggle: (id) => set(Ops.setAssignment(model, rt.id, { brandIds: (rt.brandIds || []).includes(id) ? rt.brandIds.filter((x) => x !== id) : [...rt.brandIds || [], id] }))
                }
              ),
              /* @__PURE__ */ jsx(
                ToggleChips,
                {
                  label: "Business units",
                  options: model.businessUnits || [],
                  selected: rt.buIds || [],
                  allLabel: "no business units defined yet",
                  onToggle: (id) => set(Ops.setAssignment(model, rt.id, { buIds: (rt.buIds || []).includes(id) ? rt.buIds.filter((x) => x !== id) : [...rt.buIds || [], id] }))
                }
              ),
              /* @__PURE__ */ jsxs("p", { className: "hint applies", "data-testid": "applies-line", children: [
                /* @__PURE__ */ jsx("b", { children: "Applies to:" }),
                " ",
                assignLine(rt)
              ] }),
              rtWarn(rt).map((w, i) => /* @__PURE__ */ jsxs("p", { className: "warnmsg", children: [
                "\u25B2 ",
                w.message
              ] }, i))
            ]
          }
        ),
        /* @__PURE__ */ jsxs(
          Drawer,
          {
            title: "Processes \u2014 one per channel",
            defaultOpen: true,
            info: "The journey this request takes, per channel. Each step routes a percentage of what reaches it to a queue; a step marked Ends declares the outcome. A branch under 100% doubles as rework \u2014 hover the split to see the multi-round effective rate.",
            children: [
              (0, import_domain.processesOf)(model, rt).map((pr) => /* @__PURE__ */ jsx(ProcessEditor, { model, set, rt, proc: pr }, pr.id || pr.channelId)),
              /* @__PURE__ */ jsx(AttachProcess, { model, set, rt, offChannels })
            ]
          }
        ),
        /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: 8, marginTop: 16, borderTop: "0.5px solid var(--line)", paddingTop: 10 }, children: guard.ok ? /* @__PURE__ */ jsx("button", { className: "btn sm danger", onClick: () => {
          set(Ops.deleteRequestType(model, rt.id));
          setSel(null);
        }, children: "Delete request type" }) : /* @__PURE__ */ jsxs("span", { className: "hint blocked", style: { marginLeft: 0 }, children: [
          "\u25B2 Delete blocked \u2014 referenced by ",
          guardSummary(guard),
          ". Remove them first."
        ] }) })
      ] }) : null })
    ] })
  ] });
}
var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
var PROV_LABELS = { entered: "entered", scaled: "scaled", equal: "equal split", sum: "sum", none: "\u2014" };
function entryAt(model, scope) {
  const k = (0, import_domain.keyOf)(scope || {});
  return (model.volumeEntries || []).find((e) => (0, import_domain.keyOf)(e.scope || {}) === k);
}
function ShapeEditor({ model, set, scope, entry, daily }) {
  const [text, setText] = useState(entry && entry.weekly ? entry.weekly.map((v) => Math.round(v)).join(", ") : "");
  const [err, setErr] = useState(null);
  const apply = (weekly) => {
    const d = entry && entry.daily != null ? entry.daily : daily;
    set(Ops.setVolumeEntry(model, scope, { daily: d, weekly }));
  };
  return /* @__PURE__ */ jsxs("div", { className: "shapebox", "data-testid": "shape-editor", children: [
    /* @__PURE__ */ jsx("div", { className: "regoff", children: Object.keys(import_engine.SEASONAL_PRESETS).map((name) => /* @__PURE__ */ jsx("button", { className: "chip off", onClick: () => {
      const d = (entry && entry.daily != null ? entry.daily : daily) || 0;
      if (name === "Flat") {
        set(Ops.setVolumeEntry(model, scope, { daily: d }));
        setText("");
        setErr(null);
        return;
      }
      const preset = import_engine.SEASONAL_PRESETS[name];
      const weekly = Array.from({ length: 52 }, (_, w) => Math.round(d * preset[Math.min(11, Math.floor(w * 12 / 52))]));
      apply(weekly);
      setText(weekly.join(", "));
      setErr(null);
    }, children: name }, name)) }),
    /* @__PURE__ */ jsx(
      "textarea",
      {
        rows: 2,
        value: text,
        placeholder: "52 weekly values, comma-separated \u2014 or pick a preset",
        "aria-label": "Weekly series",
        onChange: (e) => setText(e.target.value)
      }
    ),
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [
      /* @__PURE__ */ jsx("button", { className: "btn sm", onClick: () => {
        const vals = text.split(/[\s,;]+/).filter(Boolean).map(Number);
        if (vals.length !== 52 || vals.some(isNaN)) {
          setErr(`need 52 numbers, got ${vals.filter((v) => !isNaN(v)).length}`);
          return;
        }
        apply(vals);
        setErr(null);
      }, children: "Apply series" }),
      err ? /* @__PURE__ */ jsxs("span", { className: "hint", style: { color: "var(--red-ink)" }, children: [
        "\u2715 ",
        err
      ] }) : null
    ] })
  ] });
}
function VolRow({ model, set, level, name, scope, node, hasOwnShape, inheritsShape }) {
  const [shapeOpen, setShapeOpen] = useState(false);
  const entry = entryAt(model, scope);
  const total = node ? node.total : 0;
  const prov = node ? node.prov : "none";
  const shown = total ? Math.round(total * 10) / 10 : prov === "entered" ? 0 : "";
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("div", { className: "volrow lvl" + level, "data-key": (0, import_domain.keyOf)(scope), style: { "--lvl": level }, children: [
      /* @__PURE__ */ jsx("span", { className: "volname", children: name }),
      /* @__PURE__ */ jsx(
        "input",
        {
          className: "num",
          value: shown === "" ? "" : shown,
          placeholder: "\u2014",
          "aria-label": "Volume at " + name,
          onChange: (e) => {
            const v = e.target.value.trim();
            if (v === "") set(Ops.clearVolumeEntry(model, scope));
            else set(Ops.setVolumeEntry(model, scope, { daily: +v || 0, ...entry && entry.weekly ? { weekly: entry.weekly } : {} }));
          }
        }
      ),
      /* @__PURE__ */ jsxs("span", { className: "prov " + prov, children: [
        PROV_LABELS[prov] || prov,
        prov === "scaled" ? " \u25B2" : ""
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          className: "linkbtn shapecell" + (hasOwnShape ? " set" : ""),
          onClick: () => setShapeOpen(!shapeOpen),
          "aria-expanded": shapeOpen,
          "aria-label": "Shape at " + name,
          children: hasOwnShape ? "52-wk \u25CF" : inheritsShape ? "inherited" : "flat"
        }
      )
    ] }),
    shapeOpen ? /* @__PURE__ */ jsx(ShapeEditor, { model, set, scope, entry, daily: total }) : null
  ] });
}
function VolumePanel({ model, set, p }) {
  const rows = [];
  const seen = /* @__PURE__ */ new Set();
  const hasShapeAt = (scope) => {
    const e = entryAt(model, scope);
    return !!(e && e.weekly);
  };
  rows.push({ level: 0, name: "Whole estate", scope: {} });
  for (const leaf of p.leaves) {
    const bKey = leaf.brandId;
    if (!seen.has(bKey)) {
      seen.add(bKey);
      rows.push({ level: 1, name: nameOf(model.brands, leaf.brandId), scope: { brandId: leaf.brandId } });
    }
    const buKey = leaf.brandId + "|" + leaf.buId;
    if (!seen.has(buKey)) {
      seen.add(buKey);
      rows.push({ level: 2, name: nameOf(model.businessUnits, leaf.buId), scope: { brandId: leaf.brandId, buId: leaf.buId } });
    }
    const rtKey = buKey + "|" + leaf.requestTypeId;
    if (!seen.has(rtKey)) {
      seen.add(rtKey);
      rows.push({ level: 3, name: leaf.rt.name, scope: { brandId: leaf.brandId, buId: leaf.buId, requestTypeId: leaf.requestTypeId } });
    }
    rows.push({ level: 4, name: nameOf(model.channels, leaf.channelId), scope: { brandId: leaf.brandId, buId: leaf.buId, requestTypeId: leaf.requestTypeId, channelId: leaf.channelId } });
  }
  const uncovered = p.validation.warnings.filter((w) => w.kind === "uncovered_volume");
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("h3", { children: [
      "Volume ",
      /* @__PURE__ */ jsx("small", { children: "type a number at any row" })
    ] }),
    rows.length <= 1 ? /* @__PURE__ */ jsx("p", { className: "hint", children: "Assign request types first \u2014 the spine builds itself from them." }) : /* @__PURE__ */ jsx("div", { className: "scrollx", children: /* @__PURE__ */ jsxs("div", { className: "volgrid", "data-testid": "cascade-grid", children: [
      /* @__PURE__ */ jsxs("div", { className: "volrow head", children: [
        /* @__PURE__ */ jsx("span", { className: "volname", children: "Spine" }),
        /* @__PURE__ */ jsx("span", { children: "Daily" }),
        /* @__PURE__ */ jsx("span", { children: "Provenance" }),
        /* @__PURE__ */ jsx("span", { children: "Shape" })
      ] }),
      rows.map((r) => {
        const anc = [];
        if (r.scope.brandId) {
          anc.push({});
          anc.push({ brandId: r.scope.brandId });
          if (r.scope.buId) anc.push({ brandId: r.scope.brandId, buId: r.scope.buId });
          if (r.scope.requestTypeId) anc.push({ brandId: r.scope.brandId, buId: r.scope.buId, requestTypeId: r.scope.requestTypeId });
          anc.pop();
        }
        return /* @__PURE__ */ jsx(
          VolRow,
          {
            model,
            set,
            level: r.level,
            name: r.name,
            scope: r.scope,
            node: p.nodes.get((0, import_domain.keyOf)(r.scope)),
            hasOwnShape: hasShapeAt(r.scope),
            inheritsShape: anc.some((a) => hasShapeAt(a))
          },
          (0, import_domain.keyOf)(r.scope)
        );
      })
    ] }) }),
    (p.notes || []).length || uncovered.length ? /* @__PURE__ */ jsxs("div", { className: "valpanel", "data-testid": "volume-notes", children: [
      (p.notes || []).map((n, i) => /* @__PURE__ */ jsxs("p", { className: "warnmsg", children: [
        "\u25B2 ",
        n.message || String(n)
      ] }, "n" + i)),
      uncovered.map((w, i) => /* @__PURE__ */ jsxs("p", { className: "warnmsg", children: [
        "\u25B2 ",
        w.message
      ] }, "u" + i))
    ] }) : null
  ] });
}
var NODE_W = 168;
var NODE_H = 52;
var COL_W = 212;
var ROW_H = 76;
var trunc = (s, n = 22) => s.length > n ? s.slice(0, n - 1) + "\u2026" : s;
function buildMap(model, p) {
  const depth = /* @__PURE__ */ new Map();
  for (const rt of model.requestTypes || [])
    for (const proc of (0, import_domain.processesOf)(model, rt))
      proc.steps.forEach((s, i) => {
        if (!depth.has(s.queueId) || i < depth.get(s.queueId)) depth.set(s.queueId, i);
      });
  const maxD = Math.max(0, ...depth.values());
  const cols = [];
  for (const q of model.queues || []) {
    const d = depth.has(q.id) ? depth.get(q.id) : maxD + 1;
    (cols[d] = cols[d] || []).push(q);
  }
  const pos = /* @__PURE__ */ new Map();
  cols.forEach((col, d) => (col || []).forEach((q, i) => pos.set(q.id, { x: 20 + d * COL_W, y: 24 + i * ROW_H })));
  const teams = model.engineConfig && model.engineConfig.serviceTeams || [];
  const teamY = 24 + Math.max(1, ...cols.map((c) => (c || []).length)) * ROW_H + 10;
  teams.forEach((tm, i) => pos.set("team:" + tm.id, { x: 20 + i * COL_W, y: teamY }));
  const flow = [], seenF = /* @__PURE__ */ new Set();
  for (const rt of model.requestTypes || [])
    for (const proc of (0, import_domain.processesOf)(model, rt))
      for (let i = 0; i + 1 < proc.steps.length; i++) {
        const s = proc.steps[i + 1];
        const label = s.splitPct + "%" + (s.samplingPct != null ? " \xB7 sample " + s.samplingPct + "%" : "");
        const k = proc.steps[i].queueId + ">" + s.queueId + ">" + label;
        if (!seenF.has(k)) {
          seenF.add(k);
          flow.push({ from: proc.steps[i].queueId, to: s.queueId, label });
        }
      }
  const cap = [], seenC = /* @__PURE__ */ new Set();
  for (const q of model.queues || []) {
    const st = q.staffing || {};
    for (const t of st.supports || []) {
      const k = q.id + ">" + t;
      if (pos.has(t) && !seenC.has(k)) {
        seenC.add(k);
        cap.push({ from: q.id, to: t, label: "supports" });
      }
    }
    for (const t of st.crossSkill || []) {
      const k = [q.id, t].sort().join(">");
      if (pos.has(t) && !seenC.has(k)) {
        seenC.add(k);
        cap.push({ from: q.id, to: t, label: "cross-skill" });
      }
    }
  }
  for (const tm of teams)
    for (const t of tm.coversQueues || [])
      if (pos.has(t)) cap.push({ from: "team:" + tm.id, to: t, label: "covers" });
  const width = Math.max(40 + (maxD + 2) * COL_W, 40 + teams.length * COL_W);
  const height = teamY + (teams.length ? NODE_H + 30 : 6);
  return { pos, flow, cap, teams, width, height };
}
function MapPanel({ model, p, onJump }) {
  const { ok, errors, warnings } = p.validation;
  const [selQ, setSelQ] = useState(null);
  const m = buildMap(model, p);
  const center = (id) => {
    const c = m.pos.get(id);
    return c ? { cx: c.x + NODE_W / 2, cy: c.y + NODE_H / 2 } : null;
  };
  const edge = (e, i, dashed) => {
    const a = center(e.from), b = center(e.to);
    if (!a || !b) return null;
    const midX = (a.cx + b.cx) / 2, midY = (a.cy + b.cy) / 2;
    return /* @__PURE__ */ jsxs("g", { className: dashed ? "medge cap" : "medge flow", children: [
      /* @__PURE__ */ jsx("line", { x1: a.cx, y1: a.cy, x2: b.cx, y2: b.cy, strokeDasharray: dashed ? "5 4" : void 0, markerEnd: dashed ? void 0 : "url(#arr)" }),
      /* @__PURE__ */ jsx("text", { x: midX, y: midY - 4, children: e.label })
    ] }, (dashed ? "c" : "f") + i);
  };
  const issues = [
    ...errors.map((e) => ({ tone: "err", message: e.message, tab: "requestTypes", tabName: "Request types" })),
    ...warnings.map((w) => ({
      tone: "warn",
      message: w.message,
      tab: w.kind === "uncovered_volume" ? "volume" : "requestTypes",
      tabName: w.kind === "uncovered_volume" ? "Volume" : "Request types"
    })),
    ...(p.notes || []).map((n) => ({ tone: "warn", message: n.message, tab: "volume", tabName: "Volume" }))
  ];
  const selected = selQ && (model.queues || []).find((x) => x.id === selQ);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("h3", { children: [
      "Map ",
      /* @__PURE__ */ jsx("small", { children: "generated \u2014 nothing authored here" })
    ] }),
    (model.queues || []).length === 0 ? /* @__PURE__ */ jsx("p", { className: "hint", children: "The map draws itself once queues and processes exist." }) : /* @__PURE__ */ jsx("div", { className: "scrollx", children: /* @__PURE__ */ jsxs("svg", { className: "mapsvg", "data-testid": "map-svg", "aria-labelledby": "mapttl", width: m.width, height: m.height, viewBox: `0 0 ${m.width} ${m.height}`, children: [
      /* @__PURE__ */ jsx("title", { id: "mapttl", children: "Queue map" }),
      /* @__PURE__ */ jsxs("desc", { children: [
        (model.queues || []).length,
        " queues, ",
        m.flow.length,
        " routing links and ",
        m.cap.length,
        " capacity links, generated from the request-type processes."
      ] }),
      /* @__PURE__ */ jsx("defs", { children: /* @__PURE__ */ jsx("marker", { id: "arr", markerWidth: "8", markerHeight: "8", refX: "7", refY: "3", orient: "auto", children: /* @__PURE__ */ jsx("path", { d: "M0,0 L7,3 L0,6 z", fill: "var(--ink-3)" }) }) }),
      m.flow.map((e, i) => edge(e, i, false)),
      m.cap.map((e, i) => edge(e, i, true)),
      (model.queues || []).map((q) => {
        const c = m.pos.get(q.id);
        const d = p.queues.get(q.id);
        return /* @__PURE__ */ jsxs(
          "g",
          {
            className: "mnode" + (selQ === q.id ? " on" : ""),
            "data-node": q.id,
            tabIndex: 0,
            role: "button",
            "aria-pressed": selQ === q.id,
            "aria-label": q.name + " \u2014 " + (QTYPE_LABELS[q.type] || q.type) + ", " + fmt(d ? d.volume : 0) + " per day",
            onClick: () => setSelQ(selQ === q.id ? null : q.id),
            onKeyDown: (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelQ(selQ === q.id ? null : q.id);
              }
            },
            children: [
              /* @__PURE__ */ jsx("rect", { x: c.x, y: c.y, width: NODE_W, height: NODE_H, rx: "9" }),
              /* @__PURE__ */ jsx("text", { className: "mname", x: c.x + 10, y: c.y + 21, children: trunc(q.name) }),
              /* @__PURE__ */ jsxs("text", { className: "mmeta", x: c.x + 10, y: c.y + 38, children: [
                fmt(d ? d.volume : 0),
                "/day \xB7 ",
                QTYPE_LABELS[q.type] || q.type
              ] })
            ]
          },
          q.id
        );
      }),
      m.teams.map((tm) => {
        const c = m.pos.get("team:" + tm.id);
        return /* @__PURE__ */ jsxs("g", { className: "mnode team", "data-node": "team:" + tm.id, children: [
          /* @__PURE__ */ jsx("rect", { x: c.x, y: c.y, width: NODE_W, height: NODE_H, rx: "9", strokeDasharray: "5 4" }),
          /* @__PURE__ */ jsx("text", { className: "mname", x: c.x + 10, y: c.y + 21, children: trunc(tm.name) }),
          /* @__PURE__ */ jsxs("text", { className: "mmeta", x: c.x + 10, y: c.y + 38, children: [
            tm.size,
            " FTE shared"
          ] })
        ] }, tm.id);
      })
    ] }) }),
    selected ? /* @__PURE__ */ jsx("div", { className: "valpanel", "data-testid": "map-node-detail", children: /* @__PURE__ */ jsxs("p", { style: { fontSize: 12.5 }, children: [
      /* @__PURE__ */ jsx("b", { children: selected.name }),
      " \xB7 ",
      QTYPE_LABELS[selected.type] || selected.type,
      " \xB7 ",
      fmt((p.queues.get(selected.id) || {}).volume || 0),
      "/day",
      /* @__PURE__ */ jsx("button", { className: "btn sm", style: { marginLeft: 10 }, onClick: () => onJump && onJump("queues"), children: "Edit in Queues" })
    ] }) }) : null,
    /* @__PURE__ */ jsxs("div", { className: "valpanel", "data-testid": "validation-panel", children: [
      ok && !warnings.length && !(p.notes || []).length ? /* @__PURE__ */ jsx("p", { className: "okmsg", children: "\u25CF No issues \u2014 every process reaches an end point and every reference resolves." }) : null,
      issues.map((it, i) => /* @__PURE__ */ jsxs("p", { className: it.tone === "err" ? "errmsg" : "warnmsg", style: { display: "flex", gap: 8, alignItems: "baseline" }, children: [
        /* @__PURE__ */ jsxs("span", { style: { flex: 1 }, children: [
          it.tone === "err" ? "\u2715" : "\u25B2",
          " ",
          it.message
        ] }),
        /* @__PURE__ */ jsxs("button", { className: "linkbtn", onClick: () => onJump && onJump(it.tab), children: [
          "Fix in ",
          it.tabName,
          " \u2192"
        ] })
      ] }, i))
    ] })
  ] });
}
var G_INFO = {
  "Simulation frame": "How long the simulation runs and what a working day looks like. Changing the horizon or the operating day re-scores every strategy in the decision matrix.",
  "Workforce policy": "Global hiring limits. The cap is the most heads that can start in any one week across the estate; the buffer is the headroom the sizing strategies aim for above bare requirement.",
  "Overtime": "How far the estate can push existing staff before hiring. The premium multiplies the hourly rate; the burnout load feeds the attrition model, so heavy overtime costs you people as well as money.",
  "Cost model": "Costs that are not per-agent. Manager cost and span of control set the overhead layered on top of the agent cost each queue carries.",
  "Customer behaviour": "What poor service costs you. These drive the churn and lost-value figures on Results \u2014 the difference between an SLA miss and a commercial number.",
  "Pattern libraries": "Reusable shapes. The system seasonality preset is the same library that powers the shape chips on the Volume tab."
};
function G({ name, children, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return /* @__PURE__ */ jsxs("div", { className: "drw" + (open ? " open" : ""), children: [
    /* @__PURE__ */ jsxs("button", { className: "drwhead", "aria-expanded": open, onClick: () => setOpen(!open), children: [
      /* @__PURE__ */ jsxs("span", { children: [
        /* @__PURE__ */ jsx("b", { children: name }),
        G_INFO[name] ? /* @__PURE__ */ jsx("span", { className: "info", title: G_INFO[name], "aria-label": G_INFO[name], children: "i" }) : null
      ] }),
      /* @__PURE__ */ jsx("span", { className: "chev", children: "\u25BC" })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "drwbody", children: /* @__PURE__ */ jsx("div", { className: "fields", children }) })
  ] });
}
function DefaultsPanel({ model, set }) {
  const ec = model.engineConfig;
  if (!ec) return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("h3", { children: "Defaults" }),
    /* @__PURE__ */ jsx("p", { className: "warnmsg", children: "\u25B2 No engine defaults attached \u2014 import a model or start from the sample." })
  ] });
  const eng = ec.engine || {}, hiring = ec.hiring || {}, costs = ec.costs || {}, cx = ec.cx || {};
  const ot = (ec.settings || {}).ot || { maxDailyHours: 2, weeklyCeiling: 10, premium: 1.5, burnoutLoad: 10 };
  const season = ec.seasonality || { startMonth: 0, system: new Array(12).fill(1) };
  const updEC = (block, patch) => {
    const m = JSON.parse(JSON.stringify(model));
    m.engineConfig[block] = { ...m.engineConfig[block] || {}, ...patch };
    set(m);
  };
  const updOt = (patch) => {
    const m = JSON.parse(JSON.stringify(model));
    m.engineConfig.settings = m.engineConfig.settings || {};
    m.engineConfig.settings.ot = { ...ot, ...patch };
    set(m);
  };
  const presetName = Object.keys(import_engine.SEASONAL_PRESETS).find((k) => JSON.stringify(import_engine.SEASONAL_PRESETS[k]) === JSON.stringify(season.system)) || "";
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("h3", { children: [
      "Defaults ",
      /* @__PURE__ */ jsx("small", { children: "what every queue inherits" })
    ] }),
    /* @__PURE__ */ jsxs(G, { name: "Simulation frame", defaultOpen: true, children: [
      /* @__PURE__ */ jsx(NumF, { label: "Horizon (weeks)", value: eng.horizonWeeks, onChange: (v) => updEC("engine", { horizonWeeks: n0(v) }) }),
      /* @__PURE__ */ jsx(NumF, { label: "Day start (h)", value: eng.dayStart, onChange: (v) => updEC("engine", { dayStart: n0(v) }) }),
      /* @__PURE__ */ jsx(NumF, { label: "Day end (h)", value: eng.dayEnd, onChange: (v) => updEC("engine", { dayEnd: n0(v) }) }),
      /* @__PURE__ */ jsx(NumF, { label: "Interval (min)", value: eng.intervalMin, onChange: (v) => updEC("engine", { intervalMin: n0(v) }) }),
      /* @__PURE__ */ jsx(NumF, { label: "Days per week", value: eng.daysPerWeek, onChange: (v) => updEC("engine", { daysPerWeek: n0(v) }) }),
      /* @__PURE__ */ jsx(NumF, { label: "Hours per FTE day", value: eng.hoursPerFteDay, onChange: (v) => updEC("engine", { hoursPerFteDay: n0(v) }) }),
      /* @__PURE__ */ jsx(NumF, { label: "Days worked per FTE", value: eng.daysWorkedPerFte, onChange: (v) => updEC("engine", { daysWorkedPerFte: n0(v) }) }),
      /* @__PURE__ */ jsx(NumF, { label: "Occupancy ceiling (%)", value: Math.round((eng.occupancyCeiling || 0.85) * 100), onChange: (v) => updEC("engine", { occupancyCeiling: n0(v) / 100 }) }),
      /* @__PURE__ */ jsx(NumF, { label: "Cross-skill proficiency (%)", value: Math.round((eng.crossSkillProficiency || 0.9) * 100), onChange: (v) => updEC("engine", { crossSkillProficiency: n0(v) / 100 }) }),
      /* @__PURE__ */ jsxs("div", { className: "field", children: [
        /* @__PURE__ */ jsx("label", { children: "Currency" }),
        /* @__PURE__ */ jsx("input", { value: eng.currency || "\xA3", "aria-label": "Currency", onChange: (e) => updEC("engine", { currency: e.target.value }) })
      ] })
    ] }),
    /* @__PURE__ */ jsxs(G, { name: "Workforce policy", children: [
      /* @__PURE__ */ jsx(NumF, { label: "Hiring cap (/wk)", value: hiring.cap, onChange: (v) => updEC("hiring", { cap: n0(v) }) }),
      /* @__PURE__ */ jsx(NumF, { label: "Hiring buffer (%)", value: Math.round((hiring.buffer || 0) * 100), onChange: (v) => updEC("hiring", { buffer: n0(v) / 100 }) })
    ] }),
    /* @__PURE__ */ jsxs(G, { name: "Overtime", children: [
      /* @__PURE__ */ jsx(NumF, { label: "Max OT (h/day)", value: ot.maxDailyHours, onChange: (v) => updOt({ maxDailyHours: n0(v) }) }),
      /* @__PURE__ */ jsx(NumF, { label: "OT ceiling (h/wk)", value: ot.weeklyCeiling, onChange: (v) => updOt({ weeklyCeiling: n0(v) }) }),
      /* @__PURE__ */ jsx(NumF, { label: "OT premium (\xD7)", value: ot.premium, onChange: (v) => updOt({ premium: n0(v) }) }),
      /* @__PURE__ */ jsx(NumF, { label: "OT burnout load", value: ot.burnoutLoad, onChange: (v) => updOt({ burnoutLoad: n0(v) }) })
    ] }),
    /* @__PURE__ */ jsxs(G, { name: "Cost model", children: [
      /* @__PURE__ */ jsx(NumF, { label: "Manager cost (\xA3/yr)", value: costs.managerCost, onChange: (v) => updEC("costs", { managerCost: n0(v) }) }),
      /* @__PURE__ */ jsx(NumF, { label: "Manager ratio (1:n)", value: costs.managerRatio, onChange: (v) => updEC("costs", { managerRatio: n0(v) }) })
    ] }),
    /* @__PURE__ */ jsxs(G, { name: "Customer behaviour", children: [
      /* @__PURE__ */ jsx(NumF, { label: "Customer base", value: cx.customerBase, onChange: (v) => updEC("cx", { customerBase: n0(v) }) }),
      /* @__PURE__ */ jsx(NumF, { label: "Cost per lost customer (\xA3)", value: cx.costPerLostCustomer, onChange: (v) => updEC("cx", { costPerLostCustomer: n0(v) }) }),
      /* @__PURE__ */ jsx(NumF, { label: "Churn on abandon (%)", value: Math.round((cx.churnAbandon || 0) * 1e3) / 10, onChange: (v) => updEC("cx", { churnAbandon: n0(v) / 100 }) }),
      /* @__PURE__ */ jsx(NumF, { label: "Churn on long wait (%)", value: Math.round((cx.churnWait || 0) * 1e3) / 10, onChange: (v) => updEC("cx", { churnWait: n0(v) / 100 }) }),
      /* @__PURE__ */ jsx(NumF, { label: "Churn on digital miss (%)", value: Math.round((cx.churnDigital || 0) * 1e3) / 10, onChange: (v) => updEC("cx", { churnDigital: n0(v) / 100 }) }),
      /* @__PURE__ */ jsx(NumF, { label: "Repeat uplift (\xD7)", value: cx.repeatUplift, onChange: (v) => updEC("cx", { repeatUplift: n0(v) }) })
    ] }),
    /* @__PURE__ */ jsxs(G, { name: "Pattern libraries", children: [
      /* @__PURE__ */ jsxs("div", { className: "field", children: [
        /* @__PURE__ */ jsx("label", { children: "System seasonality" }),
        /* @__PURE__ */ jsxs("select", { value: presetName, "aria-label": "System seasonality", onChange: (e) => {
          const nm = e.target.value;
          if (nm) updEC("seasonality", { system: [...import_engine.SEASONAL_PRESETS[nm]] });
        }, children: [
          presetName === "" ? /* @__PURE__ */ jsx("option", { value: "", children: "custom" }) : null,
          Object.keys(import_engine.SEASONAL_PRESETS).map((k) => /* @__PURE__ */ jsx("option", { value: k, children: k }, k))
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "field", children: [
        /* @__PURE__ */ jsx("label", { children: "Season starts" }),
        /* @__PURE__ */ jsx(
          "select",
          {
            value: season.startMonth || 0,
            "aria-label": "Season start month",
            onChange: (e) => updEC("seasonality", { startMonth: n0(e.target.value) }),
            children: MONTHS.map((mn, i) => /* @__PURE__ */ jsx("option", { value: i, children: mn }, mn))
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "field", style: { gridColumn: "1/-1" }, children: [
        /* @__PURE__ */ jsx("label", { children: "Presets" }),
        /* @__PURE__ */ jsx("p", { className: "hint", children: "The same library powers the shape chips on the Volume tab." })
      ] })
    ] })
  ] });
}

// ui/v2/LeversPage.jsx
import { useState as useState4, useMemo as useMemo3, Fragment as Fragment2 } from "react";

// ui/v2/compute.js
var import_adapter = __toESM(require_adapter());
var import_bridge2 = __toESM(require_bridge());
var import_engine3 = __toESM(require_engine());

// ui/sim-set.js
var import_engine2 = __toESM(require_engine());
import { useRef as useRef2, useState as useState2, useEffect as useEffect2, useMemo as useMemo2 } from "react";

// ui/views.js
var STRATEGIES = [
  { id: "S1", name: "Meet requirement", blurb: "Close the gap to required FTE at the landing week." },
  { id: "S2", name: "Buffer above", blurb: "Target requirement \xD7 (1 + buffer)." },
  { id: "S3", name: "Forward backfill", blurb: "Replace projected leavers only \u2014 never hire for growth." },
  { id: "S4", name: "Manual plan", blurb: "Your per-queue hires, exactly as entered; ignores the cap." }
];
var STRATEGY_IDS = STRATEGIES.map((s) => s.id);
function strategyList(config) {
  const list = config && config.strategies || [];
  return list.length ? list : STRATEGIES.map((s, i) => ({ id: s.id, name: s.name, baseType: ["meet", "buffer", "backfill", "manual"][i], builtin: true }));
}
var groupList = (config) => config && config.groups || [];
function groupScenarioIds(config, groupId) {
  const g = groupList(config).find((x) => x.id === groupId) || groupList(config)[0];
  if (g && Array.isArray(g.scenarioIds)) return g.scenarioIds.filter((id) => config.scenarios.some((s) => s.id === id));
  return config.scenarios.filter((s) => s.enabled).map((s) => s.id);
}

// ui/sim-set.js
function bestCell(matrix) {
  if (!matrix || !matrix.cells) return null;
  let best = null;
  const better = (a, b) => {
    if (a.holds !== b.holds) return a.holds;
    if (a.holds) return a.allIn < b.allIn;
    if (a.redWeeks !== b.redWeeks) return a.redWeeks < b.redWeeks;
    return a.allIn < b.allIn;
  };
  for (const gid of Object.keys(matrix.cells)) {
    for (const sid of Object.keys(matrix.cells[gid])) {
      const c = matrix.cells[gid][sid];
      const cand = { gid, sid, allIn: c.allIn, redWeeks: c.redWeeks, holds: c.redWeeks === 0 };
      if (!best || better(cand, best)) best = cand;
    }
  }
  return best ? { gid: best.gid, sid: best.sid } : null;
}

// ui/v2/compute.js
var toEngineCfg = (model) => model && model.requestTypes && model.volumeEntries ? (0, import_bridge2.domainToEngineConfig)(model) : (0, import_adapter.v2ToEngineConfig)(model);
function richMatrix(cfg) {
  const groups = cfg.groups || [];
  const strategies = strategyList(cfg);
  const cells = {};
  for (const g of groups) {
    const ids = groupScenarioIds(cfg, g.id);
    const scoped = (0, import_engine3.applyGroupScope)(cfg, g.id);
    cells[g.id] = {};
    for (const s of strategies) {
      const sim = (0, import_engine3.simulate)(scoped, { strategy: s.id, viewIds: ids });
      let redWeeks = 0, greenQW = 0, totalQW = 0;
      for (const w of sim.weeks) {
        if (cfg.queues.some((q) => w.queues[q.id].status === "red")) redWeeks++;
        for (const q of cfg.queues) {
          totalQW++;
          if (w.queues[q.id].status === "green") greenQW++;
        }
      }
      const flags = sim.summary.flags;
      const status = flags.capInfeasible || flags.tippingPoint || redWeeks > 0 ? redWeeks > sim.weeks.length * 0.1 || flags.tippingPoint ? "red" : "amber" : "green";
      cells[g.id][s.id] = {
        allIn: sim.summary.allIn,
        redWeeks,
        status,
        tipping: !!flags.tippingPoint,
        capInfeasible: !!flags.capInfeasible,
        sla: totalQW ? greenQW / totalQW : 1
      };
    }
  }
  return { cells };
}
function computeBase(model) {
  const cfg = toEngineCfg(model);
  const matrix = richMatrix(cfg);
  const strategies = strategyList(cfg);
  const groups = (cfg.groups || []).map((g) => ({ id: g.id, name: g.name }));
  return { cfg, matrix, strategies, groups };
}
function computeDetail(cfg, selected) {
  const scoped = (0, import_engine3.applyGroupScope)(cfg, selected.gid);
  const detail = (0, import_engine3.simulate)(scoped, { strategy: selected.sid, viewIds: groupScenarioIds(cfg, selected.gid), captureDaily: true });
  return { detail, summary: detail.summary };
}
function pickSelection(selected, base) {
  return normalizeSel(selected, base.matrix, base.groups, base.strategies);
}
function quickHeadline(model) {
  const cfg = toEngineCfg(model);
  const sim = (0, import_engine3.simulate)(cfg, { strategy: "S1" });
  const w = sim.weeks;
  const lastWk = w[w.length - 1];
  const availFte = cfg.queues.reduce((a, q) => a + (lastWk.queues[q.id].active || 0), 0);
  let worst = "green";
  for (const wk of w) for (const q of cfg.queues) {
    const st = wk.queues[q.id].status;
    if (st === "red") worst = "red";
    else if (st === "amber" && worst !== "red") worst = "amber";
  }
  return {
    horizon: w.length,
    queues: cfg.queues.length,
    allIn: sim.summary.allIn,
    availFte,
    worst,
    lost: sim.summary.lost
  };
}
function normalizeSel(selected, matrix, groups, strategies) {
  const gids = groups.map((g) => g.id), sids = strategies.map((s) => s.id);
  if (selected && gids.includes(selected.gid) && sids.includes(selected.sid)) return { gid: selected.gid, sid: selected.sid };
  return bestCell(matrix) || { gid: gids[0], sid: sids[0] };
}

// ui/v2/hooks.js
import { useState as useState3, useEffect as useEffect3, useRef as useRef3 } from "react";
function useDeferred(input, compute) {
  const [value, setValue] = useState3(() => compute(input));
  const [pending, setPending] = useState3(false);
  const seen = useRef3(input);
  useEffect3(() => {
    if (input === seen.current) return;
    seen.current = input;
    setPending(true);
    const id = setTimeout(() => {
      setValue(compute(input));
      setPending(false);
    }, 0);
    return () => clearTimeout(id);
  }, [input]);
  return { value, pending };
}

// ui/v2/LeversPage.jsx
import { Fragment as Fragment3, jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var fmtM = (n) => "\xA3" + (n / 1e6).toFixed(1) + "m";
var pct = (n) => Math.round(n * 100) + "%";
var GLYPH = { ok: "\u25CF", warn: "\u25B2", bad: "\u2715" };
var NAV2 = [["home", "Home"], ["setup", "Setup"], ["levers", "Levers"], ["results", "Results"]];
function LeversPage({ model, onModelChange, onNav = () => {
}, selected: selProp, onSelectedChange }) {
  const { value: base, pending } = useDeferred(model, computeBase);
  const [weight, setWeight] = useState4(50);
  const [localSel, setLocalSel] = useState4(null);
  const sel = selProp !== void 0 ? selProp : localSel;
  const setSel = onSelectedChange || setLocalSel;
  const best = useMemo3(() => bestUnderWeight(base, weight / 100), [base, weight]);
  const cfg = base.cfg;
  const set = onModelChange;
  return /* @__PURE__ */ jsxs2("div", { className: "shell", children: [
    /* @__PURE__ */ jsxs2("header", { className: "top", children: [
      /* @__PURE__ */ jsxs2("div", { className: "brand", children: [
        /* @__PURE__ */ jsx2("div", { className: "mark", children: "C" }),
        /* @__PURE__ */ jsxs2("div", { children: [
          /* @__PURE__ */ jsx2("h1", { children: cfg.brands && cfg.brands[0] ? cfg.brands[0].name : "Simulation" }),
          /* @__PURE__ */ jsx2("small", { children: "Capacity Simulator" })
        ] })
      ] }),
      /* @__PURE__ */ jsx2("div", { className: "tabs", role: "tablist", "aria-label": "Sections", children: NAV2.map(([k, label]) => /* @__PURE__ */ jsx2("button", { role: "tab", className: k === "levers" ? "on" : "", "aria-selected": k === "levers", onClick: () => onNav(k), children: label }, k)) })
    ] }),
    /* @__PURE__ */ jsx2("h2", { style: { marginBottom: 14 }, children: "Levers" }),
    /* @__PURE__ */ jsxs2("div", { className: "panel", children: [
      /* @__PURE__ */ jsxs2("h3", { children: [
        "Decision matrix ",
        /* @__PURE__ */ jsx2("small", { children: pending ? "recalculating\u2026" : "every scenario group \xD7 every strategy" })
      ] }),
      /* @__PURE__ */ jsxs2("div", { className: "weight", children: [
        /* @__PURE__ */ jsx2("label", { children: "Lowest cost" }),
        /* @__PURE__ */ jsx2("input", { type: "range", min: "0", max: "100", value: weight, onChange: (e) => setWeight(+e.target.value), "aria-label": "cost versus service weighting" }),
        /* @__PURE__ */ jsx2("label", { children: "Best service" })
      ] }),
      /* @__PURE__ */ jsx2("div", { style: { overflowX: "auto" }, children: /* @__PURE__ */ jsxs2("table", { className: "mx", children: [
        /* @__PURE__ */ jsx2("thead", { children: /* @__PURE__ */ jsxs2("tr", { children: [
          /* @__PURE__ */ jsx2("th", { className: "rh", "aria-hidden": "true" }),
          base.strategies.map((s) => /* @__PURE__ */ jsx2("th", { children: s.name }, s.id))
        ] }) }),
        /* @__PURE__ */ jsx2("tbody", { children: base.groups.map((g) => /* @__PURE__ */ jsxs2("tr", { children: [
          /* @__PURE__ */ jsx2("th", { className: "rh", children: g.name }),
          base.strategies.map((s) => {
            const c = base.matrix.cells[g.id][s.id];
            const flag = c.redWeeks === 0 ? "ok" : c.redWeeks <= 2 ? "warn" : "bad";
            const isSel = sel && sel.gid === g.id && sel.sid === s.id;
            const isBest = best && best.gid === g.id && best.sid === s.id;
            return /* @__PURE__ */ jsx2("td", { children: /* @__PURE__ */ jsxs2("button", { className: "cell" + (isSel ? " sel" : ""), onClick: () => setSel({ gid: g.id, sid: s.id }), "aria-label": `${g.name} \xD7 ${s.name}`, children: [
              isBest ? /* @__PURE__ */ jsx2("span", { className: "best", children: "Best fit" }) : null,
              /* @__PURE__ */ jsx2("div", { className: "c1 num", children: fmtM(c.allIn) }),
              /* @__PURE__ */ jsxs2("div", { className: "c2 num", children: [
                pct(c.sla),
                " SLA"
              ] }),
              /* @__PURE__ */ jsxs2("div", { className: "c3 " + flag, children: [
                GLYPH[flag],
                " ",
                c.redWeeks,
                " red wk"
              ] })
            ] }) }, s.id);
          })
        ] }, g.id)) })
      ] }) }),
      /* @__PURE__ */ jsxs2("p", { className: "mxnote", children: [
        "Tap a cell to make that pair the live context on every tab. Badge = best fit under your weighting.",
        sel && base.strategies.find((s) => s.id === sel.sid) ? /* @__PURE__ */ jsxs2(Fragment3, { children: [
          " Selected: ",
          /* @__PURE__ */ jsxs2("b", { children: [
            base.strategies.find((s) => s.id === sel.sid).name,
            " \xD7 ",
            base.groups.find((g) => g.id === sel.gid).name
          ] }),
          ". ",
          /* @__PURE__ */ jsx2("button", { className: "link", style: { background: "none", border: "none", color: "var(--blue)", font: "inherit", cursor: "pointer", padding: 0, fontWeight: 600 }, onClick: () => onNav("results"), children: "Review in Results \u2192" })
        ] }) : null
      ] })
    ] }),
    /* @__PURE__ */ jsxs2("div", { className: "cols", children: [
      /* @__PURE__ */ jsxs2("div", { className: "panel", children: [
        /* @__PURE__ */ jsxs2("h3", { children: [
          "Strategies ",
          /* @__PURE__ */ jsx2("small", { children: "what we could do" })
        ] }),
        /* @__PURE__ */ jsx2("div", { className: "cardlist", children: base.strategies.map((s) => /* @__PURE__ */ jsx2(StrategyCard, { s, cfg, model, set }, s.id)) })
      ] }),
      /* @__PURE__ */ jsxs2("div", { className: "panel", children: [
        /* @__PURE__ */ jsxs2("h3", { children: [
          "Scenario groups ",
          /* @__PURE__ */ jsx2("small", { children: "what could happen" })
        ] }),
        /* @__PURE__ */ jsx2("div", { className: "cardlist", children: base.groups.map((g) => /* @__PURE__ */ jsx2(GroupCard, { g, cfg }, g.id)) })
      ] })
    ] }),
    /* @__PURE__ */ jsx2(HiringCaps, { cfg, model, set }),
    /* @__PURE__ */ jsxs2("p", { className: "note", children: [
      /* @__PURE__ */ jsx2("b", { children: "Design notes:" }),
      " strategies and scenarios flank the matrix they feed \xB7 each cell = cost (amber) + SLA (teal) + red weeks (glyph) \xB7 Best fit follows the cost\u2194service slider \xB7 cell tap sets live context \xB7 caps live here (a lever, not a setting)."
    ] })
  ] });
}
var BLURB = {
  meet: "Close the requirement gap at the landing week.",
  buffer: "Requirement \xD7 (1 + buffer).",
  backfill: "Replace projected leavers only \u2014 never hire for growth.",
  manual: "Your per-queue hires exactly as entered; ignores the cap."
};
function StrategyCard({ s, cfg, model, set }) {
  const [open, setOpen] = useState4(false);
  const buffer = Math.round((cfg.hiring.buffer || 0) * 100);
  const grouped = groupQueues(cfg);
  return /* @__PURE__ */ jsxs2("div", { className: "scard" + (open ? " open" : ""), children: [
    /* @__PURE__ */ jsxs2("button", { className: "schead", onClick: () => setOpen((o) => !o), children: [
      /* @__PURE__ */ jsxs2("span", { children: [
        /* @__PURE__ */ jsx2("b", { children: s.name }),
        " ",
        /* @__PURE__ */ jsx2("span", { className: "pill builtin", children: "built-in" }),
        /* @__PURE__ */ jsx2("br", {}),
        /* @__PURE__ */ jsx2("span", { className: "desc", children: BLURB[s.baseType] || "" })
      ] }),
      s.baseType === "buffer" ? /* @__PURE__ */ jsxs2("span", { className: "param", onClick: (e) => e.stopPropagation(), children: [
        "Buffer ",
        /* @__PURE__ */ jsx2(
          "input",
          {
            className: "num",
            style: { width: 52 },
            value: buffer,
            onChange: (e) => set(setHiringBuffer(model, e.target.value)),
            "aria-label": "buffer percent"
          }
        ),
        " %"
      ] }) : s.baseType === "backfill" ? /* @__PURE__ */ jsxs2("span", { className: "param", onClick: (e) => e.stopPropagation(), children: [
        "Look-ahead ",
        /* @__PURE__ */ jsx2(
          "input",
          {
            className: "num",
            style: { width: 46 },
            value: s.forwardMonths || 3,
            onChange: (e) => set(setForwardMonths(model, s.id, e.target.value)),
            "aria-label": "look-ahead months"
          }
        ),
        " mo"
      ] }) : null,
      /* @__PURE__ */ jsx2("span", { className: "chev", children: "\u25BC" })
    ] }),
    /* @__PURE__ */ jsx2("div", { className: "scbody", children: grouped.map((grp) => /* @__PURE__ */ jsxs2(Fragment2, { children: [
      /* @__PURE__ */ jsx2("div", { className: "grph", children: /* @__PURE__ */ jsx2("span", { className: "path", children: grp.label }) }),
      grp.queues.map((q) => /* @__PURE__ */ jsxs2("div", { className: "qtoggle", children: [
        /* @__PURE__ */ jsx2("span", { children: q.name }),
        /* @__PURE__ */ jsx2("b", { children: "included" })
      ] }, q.id))
    ] }, grp.key)) })
  ] });
}
function GroupCard({ g, cfg }) {
  const [open, setOpen] = useState4(false);
  const ids = groupScenarioIdsLocal(cfg, g.id);
  const factors = (cfg.scenarios || []).filter((s) => ids.includes(s.id));
  return /* @__PURE__ */ jsxs2("div", { className: "scard" + (open ? " open" : ""), children: [
    /* @__PURE__ */ jsxs2("button", { className: "schead", onClick: () => setOpen((o) => !o), children: [
      /* @__PURE__ */ jsxs2("span", { children: [
        /* @__PURE__ */ jsx2("b", { children: g.name }),
        " ",
        /* @__PURE__ */ jsx2("span", { className: "pill builtin", children: "built-in" }),
        " ",
        /* @__PURE__ */ jsx2("span", { className: "pill", children: g.id === "g_none" ? "reference" : "all services" }),
        /* @__PURE__ */ jsx2("br", {}),
        /* @__PURE__ */ jsxs2("span", { className: "desc", children: [
          factors.length,
          " factor",
          factors.length === 1 ? "" : "s",
          " in force"
        ] })
      ] }),
      /* @__PURE__ */ jsx2("span", { className: "chev", children: "\u25BC" })
    ] }),
    /* @__PURE__ */ jsx2("div", { className: "scbody", children: factors.length ? factors.map((f) => /* @__PURE__ */ jsxs2(Fragment2, { children: [
      /* @__PURE__ */ jsxs2("div", { className: "grph", children: [
        f.name,
        " \xB7 from week ",
        (f.startWeek || 0) + 1
      ] }),
      /* @__PURE__ */ jsx2("div", { className: "tl", children: Array.from({ length: 13 }, (_, i) => {
        const wk = i * 4;
        const on = wk >= (f.startWeek || 0);
        return /* @__PURE__ */ jsx2("span", { className: on ? "on" : "" }, i);
      }) })
    ] }, f.id)) : /* @__PURE__ */ jsx2("span", { children: "Empty by design \u2014 every delta is measured against this." }) })
  ] });
}
function HiringCaps({ cfg, model, set }) {
  const brands = cfg.brands || [];
  const channels = [...new Set(cfg.queues.map((q) => q.channel))];
  const caps = cfg.hiring.caps || {};
  const segVal = (bid, ch) => {
    const v = caps.segments ? caps.segments[bid + "|" + ch] : null;
    return v != null ? v : "";
  };
  const total = caps.total != null ? caps.total : cfg.hiring.cap;
  return /* @__PURE__ */ jsxs2("div", { className: "panel", children: [
    /* @__PURE__ */ jsxs2("h3", { children: [
      "Hiring caps ",
      /* @__PURE__ */ jsx2("small", { children: "brand \xD7 channel \xB7 effective limit = tightest of segment, brand and total" })
    ] }),
    /* @__PURE__ */ jsx2("div", { style: { overflowX: "auto" }, children: /* @__PURE__ */ jsxs2("table", { className: "caps", children: [
      /* @__PURE__ */ jsx2("thead", { children: /* @__PURE__ */ jsxs2("tr", { children: [
        /* @__PURE__ */ jsx2("th", { children: "Brand" }),
        channels.map((ch) => /* @__PURE__ */ jsx2("th", { style: { textTransform: "capitalize" }, children: ch }, ch))
      ] }) }),
      /* @__PURE__ */ jsx2("tbody", { children: brands.map((b) => /* @__PURE__ */ jsxs2("tr", { children: [
        /* @__PURE__ */ jsx2("td", { children: /* @__PURE__ */ jsx2("b", { children: b.name }) }),
        channels.map((ch) => /* @__PURE__ */ jsx2("td", { children: /* @__PURE__ */ jsx2(
          "input",
          {
            className: "num",
            value: segVal(b.id, ch),
            placeholder: "\u2014",
            onChange: (e) => set(setSegmentCap(model, b.id, ch, e.target.value)),
            "aria-label": `${b.name} ${ch} cap`
          }
        ) }, ch))
      ] }, b.id)) })
    ] }) }),
    /* @__PURE__ */ jsxs2("p", { className: "hint", style: { marginTop: 8 }, children: [
      "Total ceiling ",
      /* @__PURE__ */ jsx2(
        "input",
        {
          className: "num",
          style: { width: 60 },
          value: total,
          onChange: (e) => set(setTotalCap(model, e.target.value)),
          "aria-label": "total ceiling"
        }
      ),
      " / week across all segments."
    ] })
  ] });
}
function groupQueues(cfg) {
  const groups = /* @__PURE__ */ new Map();
  for (const q of cfg.queues) {
    const brand = (cfg.brands || []).find((b) => b.id === q.brandId);
    const key = (q.brandId || "b") + "|" + q.channel;
    if (!groups.has(key)) groups.set(key, { key, label: `${brand ? brand.name : "Brand"} \u203A ${q.channel}`, queues: [] });
    groups.get(key).queues.push(q);
  }
  return [...groups.values()];
}
function groupScenarioIdsLocal(cfg, gid) {
  const g = (cfg.groups || []).find((x) => x.id === gid);
  if (g && Array.isArray(g.scenarioIds)) return g.scenarioIds;
  return (cfg.scenarios || []).filter((s) => s.enabled).map((s) => s.id);
}
function bestUnderWeight(base, w) {
  const cells = [];
  for (const g of base.groups) for (const s of base.strategies) {
    const c = base.matrix.cells[g.id][s.id];
    cells.push({ gid: g.id, sid: s.id, cost: c.allIn, svc: c.sla - c.redWeeks * 0.01 });
  }
  const costs = cells.map((c) => c.cost), svcs = cells.map((c) => c.svc);
  const cmin = Math.min(...costs), cmax = Math.max(...costs), smin = Math.min(...svcs), smax = Math.max(...svcs);
  let best = null, bestScore = -Infinity;
  for (const c of cells) {
    const cs = 1 - (c.cost - cmin) / (cmax - cmin || 1);
    const ss = (c.svc - smin) / (smax - smin || 1);
    const score = (1 - w) * cs + w * ss;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

// ui/v2/ResultsPage.jsx
import { useState as useState5, useMemo as useMemo4, useEffect as useEffect4, useRef as useRef4, useCallback, Fragment as Fragment4 } from "react";
import { Fragment as Fragment5, jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
var fmtGBP = (n) => "\xA3" + Math.round(n).toLocaleString("en-GB");
var fmtM2 = (n) => "\xA3" + (n / 1e6).toFixed(1) + "m";
var fmtN = (n) => Math.round(n).toLocaleString("en-GB");
var pct2 = (n) => Math.round(n * 100) + "%";
var RC = { green: "g", amber: "a", red: "r" };
var GLYPH2 = { green: "\u25CF", amber: "\u25B2", red: "\u2715", g: "\u25CF", a: "\u25B2", r: "\u2715" };
var NAV3 = [["home", "Home"], ["setup", "Setup"], ["levers", "Levers"], ["results", "Results"]];
function ResultsPage({ model, onNav = () => {
}, selected: selProp, onSelectedChange }) {
  const { value: base, pending } = useDeferred(model, computeBase);
  const [localSel, setLocalSel] = useState5(null);
  const selected = selProp !== void 0 ? selProp : localSel;
  const setSelected = onSelectedChange || setLocalSel;
  const sel = useMemo4(() => pickSelection(selected, base), [selected, base]);
  const { detail, summary } = useMemo4(() => computeDetail(base.cfg, sel), [base, sel]);
  const weeks = detail.weeks;
  const cfg = base.cfg;
  const [lens, setLens] = useState5(0);
  const [week, setWeek] = useState5(0);
  const [weight, setWeight] = useState5(50);
  const scrub = useCallback((w) => setWeek((prev) => {
    const next = typeof w === "function" ? w(prev) : w;
    return Math.max(0, Math.min(weeks.length - 1, Number.isFinite(next) ? next : prev));
  }), [weeks.length]);
  const stratName = base.strategies.find((s) => s.id === sel.sid)?.name || sel.sid;
  const grpName = base.groups.find((g) => g.id === sel.gid)?.name || sel.gid;
  return /* @__PURE__ */ jsxs3("div", { className: "shell", children: [
    /* @__PURE__ */ jsxs3("header", { className: "top", children: [
      /* @__PURE__ */ jsxs3("div", { className: "brand", children: [
        /* @__PURE__ */ jsx3("div", { className: "mark", children: "C" }),
        /* @__PURE__ */ jsxs3("div", { children: [
          /* @__PURE__ */ jsx3("h1", { children: cfg.brands && cfg.brands[0] ? cfg.brands[0].name : "Simulation" }),
          /* @__PURE__ */ jsx3("small", { children: "Capacity Simulator" })
        ] })
      ] }),
      /* @__PURE__ */ jsx3("div", { className: "tabs", role: "tablist", "aria-label": "Sections", children: NAV3.map(([k, label]) => /* @__PURE__ */ jsx3("button", { role: "tab", className: k === "results" ? "on" : "", "aria-selected": k === "results", onClick: () => onNav(k), children: label }, k)) })
    ] }),
    /* @__PURE__ */ jsxs3("div", { className: "ctx", children: [
      /* @__PURE__ */ jsx3("label", { children: "Strategy" }),
      /* @__PURE__ */ jsx3("select", { value: sel.sid, onChange: (e) => setSelected({ gid: sel.gid, sid: e.target.value }), children: base.strategies.map((s) => /* @__PURE__ */ jsx3("option", { value: s.id, children: s.name }, s.id)) }),
      /* @__PURE__ */ jsx3("label", { children: "Scenario" }),
      /* @__PURE__ */ jsx3("select", { value: sel.gid, onChange: (e) => setSelected({ gid: e.target.value, sid: sel.sid }), children: base.groups.map((g) => /* @__PURE__ */ jsx3("option", { value: g.id, children: g.name }, g.id)) }),
      /* @__PURE__ */ jsx3("button", { className: "btn", disabled: true, title: "Saved runs are not available in this build yet", children: "Save run" }),
      /* @__PURE__ */ jsx3("span", { className: "fresh" + (pending ? " stale" : ""), children: pending ? "recalculating\u2026" : "\u25CF Up to date" })
    ] }),
    /* @__PURE__ */ jsx3("div", { className: "sub", role: "tablist", "aria-label": "Lenses", children: ["Summary", "Plan", "Intraday", "Data", "Flow"].map((l, i) => /* @__PURE__ */ jsx3("button", { role: "tab", "aria-selected": lens === i, className: lens === i ? "on" : "", onClick: () => setLens(i), children: l }, l)) }),
    lens === 0 && /* @__PURE__ */ jsx3(Summary, { base, sel, setSelected, summary, weeks, cfg, stratName, grpName, weight, setWeight, model }),
    lens === 1 && /* @__PURE__ */ jsx3(Plan, { weeks, cfg, week, setWeek: scrub }),
    lens === 2 && /* @__PURE__ */ jsx3(Intraday, { weeks, cfg, week, setWeek: scrub }),
    lens === 3 && /* @__PURE__ */ jsx3(DataLens, { weeks, cfg }),
    lens === 4 && /* @__PURE__ */ jsx3(Flow, { weeks, cfg, week, setWeek: scrub }),
    /* @__PURE__ */ jsxs3("p", { className: "note", children: [
      /* @__PURE__ */ jsx3("b", { children: "Design notes:" }),
      " one context bar, five lenses, one week cursor \xB7 Summary = year (matrix + six family cards + risk register) \xB7 Plan sets the cursor \xB7 Intraday & Flow inherit it \xB7 Data grouped by path, export = template \xB7 Flow animates cached weekly results \u2014 no re-simulation."
    ] })
  ] });
}
function Summary({ base, sel, setSelected, summary, weeks, cfg, stratName, grpName, weight, setWeight, model }) {
  const redOf = (gid, sid) => base.matrix.cells[gid][sid].redWeeks;
  const costOf = (gid, sid) => base.matrix.cells[gid][sid].allIn;
  const best = useMemo4(() => bestUnderWeight2(base, weight / 100), [base, weight]);
  const totalVol = weeks.reduce((a, w) => a + w.totals.volume, 0);
  const greenWeeks = weeks.reduce((a, w) => a + (cfg.queues.every((q) => w.queues[q.id].status === "green") ? 1 : 0), 0);
  const slaAtt = weeks.length ? greenWeeks / weeks.length : 1;
  let occN = 0, occD = 0;
  for (const w of weeks) for (const q of cfg.queues) {
    occN += w.queues[q.id].occ;
    occD++;
  }
  const avgOcc = occD ? occN / occD : 0;
  const lastWk = weeks[weeks.length - 1];
  const availFte = cfg.queues.reduce((a, q) => a + (lastWk.queues[q.id].active || 0), 0);
  const redQW = weeks.reduce((a, w) => a + cfg.queues.filter((q) => w.queues[q.id].status === "red").length, 0);
  const atRiskQW = weeks.reduce((a, w) => a + cfg.queues.filter((q) => w.queues[q.id].status === "amber").length, 0);
  const cards = [
    { key: "inputs", name: "Inputs", v: fmtN(totalVol), s: "contacts over horizon" },
    { key: "performance", name: "Performance", v: pct2(slaAtt), s: slaAtt >= 0.95 ? "\u25CF on track" : "\u25B2 watch" },
    { key: "efficiency", name: "Efficiency", v: pct2(avgOcc), s: "avg occupancy" },
    { key: "workforce", name: "Workforce", v: fmtN(availFte) + " FTE", s: "active, final week" },
    { key: "customer", name: "Customer", v: fmtN(summary.lost), s: "customers lost" },
    { key: "outputs", name: "Outputs", v: fmtM2(summary.allIn), s: (totalVol ? fmtGBP(summary.allIn / totalVol) : "\xA30") + " / contact" }
  ];
  return /* @__PURE__ */ jsxs3(Fragment5, { children: [
    /* @__PURE__ */ jsxs3("div", { className: "panel", children: [
      /* @__PURE__ */ jsxs3("h3", { children: [
        "Decision matrix ",
        /* @__PURE__ */ jsx3("small", { children: "tap a cell \u2014 the whole page reviews that mix \xB7 full editing in Levers" })
      ] }),
      /* @__PURE__ */ jsxs3("div", { className: "weight", children: [
        /* @__PURE__ */ jsx3("label", { children: "Lowest cost" }),
        /* @__PURE__ */ jsx3("input", { type: "range", min: "0", max: "100", value: weight, onChange: (e) => setWeight(+e.target.value), "aria-label": "cost versus service weighting" }),
        /* @__PURE__ */ jsx3("label", { children: "Best service" })
      ] }),
      /* @__PURE__ */ jsx3("div", { style: { overflowX: "auto" }, children: /* @__PURE__ */ jsxs3("table", { className: "mx", children: [
        /* @__PURE__ */ jsx3("thead", { children: /* @__PURE__ */ jsxs3("tr", { children: [
          /* @__PURE__ */ jsx3("th", { className: "rh" }),
          base.strategies.map((s) => /* @__PURE__ */ jsx3("th", { children: s.name }, s.id))
        ] }) }),
        /* @__PURE__ */ jsx3("tbody", { children: base.groups.map((g) => /* @__PURE__ */ jsxs3("tr", { children: [
          /* @__PURE__ */ jsx3("th", { className: "rh", children: g.name }),
          base.strategies.map((s) => {
            const isSel = sel.gid === g.id && sel.sid === s.id;
            const red = redOf(g.id, s.id);
            const flag = red === 0 ? "ok" : red <= 2 ? "warn" : "bad";
            const isBest = best && best.gid === g.id && best.sid === s.id;
            return /* @__PURE__ */ jsx3("td", { children: /* @__PURE__ */ jsxs3("button", { className: "cell" + (isSel ? " sel" : ""), onClick: () => setSelected({ gid: g.id, sid: s.id }), "aria-label": `${g.name} \xD7 ${s.name}`, children: [
              isBest ? /* @__PURE__ */ jsx3("span", { className: "best", children: "Best fit" }) : null,
              /* @__PURE__ */ jsx3("div", { className: "c1 num", children: fmtM2(costOf(g.id, s.id)) }),
              /* @__PURE__ */ jsxs3("div", { className: "c3 " + flag, children: [
                GLYPH2[flag === "ok" ? "g" : flag === "warn" ? "a" : "r"],
                " ",
                red,
                " red"
              ] })
            ] }) }, s.id);
          })
        ] }, g.id)) })
      ] }) }),
      /* @__PURE__ */ jsxs3("p", { className: "wklabel", children: [
        "Reviewing ",
        /* @__PURE__ */ jsxs3("b", { children: [
          stratName,
          " \xD7 ",
          grpName
        ] }),
        " \u2014 every lens on this page shows this mix."
      ] })
    ] }),
    /* @__PURE__ */ jsxs3("div", { className: "panel", children: [
      /* @__PURE__ */ jsxs3("p", { className: "verdict", children: [
        "Across ",
        weeks.length,
        " weeks, ",
        cfg.queues.length,
        " queues, ",
        /* @__PURE__ */ jsxs3("b", { children: [
          weeks.length * cfg.queues.length - redQW - atRiskQW,
          " queue-weeks meet SLA, ",
          atRiskQW,
          " at risk, ",
          redQW,
          " red"
        ] }),
        " under ",
        stratName,
        " \xD7 ",
        grpName,
        ". All-in ",
        /* @__PURE__ */ jsx3("b", { children: fmtM2(summary.allIn) }),
        "; ",
        fmtGBP(summary.churnCost),
        " lost to poor experience (",
        fmtN(summary.lost),
        " customers)."
      ] }),
      /* @__PURE__ */ jsx3("div", { className: "fam6", children: cards.map((c) => /* @__PURE__ */ jsxs3("div", { className: "fcard", style: { borderLeftColor: FAMILY_COLORS[c.key] }, children: [
        /* @__PURE__ */ jsx3("div", { className: "fl", style: { color: FAMILY_COLORS[c.key] }, children: c.name }),
        /* @__PURE__ */ jsx3("div", { className: "fv num", children: c.v }),
        /* @__PURE__ */ jsx3("div", { className: "fs", children: c.s })
      ] }, c.key)) })
    ] }),
    /* @__PURE__ */ jsx3(RiskRegister, { summary, cfg, model })
  ] });
}
function RiskRegister({ summary, cfg, model }) {
  const [bu, setBu] = useState5("all");
  const [ch, setCh] = useState5("all");
  const isDomain = !!model.businessUnits;
  const bus = useMemo4(() => isDomain ? (model.businessUnits || []).map((x) => x.name) : (model.brands || []).flatMap((b) => (b.businessUnits || []).map((x) => x.name)), [model, isDomain]);
  const channels = useMemo4(() => [...new Set((cfg.queues || []).map((q) => q.channel))], [cfg]);
  const queueBu = useMemo4(() => {
    const map = {};
    if (isDomain) {
      const buName = {};
      for (const b of model.businessUnits || []) buName[b.id] = b.name;
      for (const q of model.queues || []) map[q.name] = q.homeBuId ? buName[q.homeBuId] || null : "Shared";
      return map;
    }
    const chBu = {};
    for (const b of model.brands || []) for (const bu2 of b.businessUnits || []) for (const p of bu2.products || []) for (const c of p.channels || []) chBu[c.id] = bu2.name;
    for (const q of model.queues || []) map[q.name] = q.attachment && q.attachment.kind === "structural" ? chBu[q.attachment.channelInstanceId] || null : "Shared";
    return map;
  }, [model, isDomain]);
  const rows = useMemo4(() => summary.findings.filter((f) => f.tone !== "green").map((f) => {
    const q = cfg.queues.find((qq) => f.text.includes(qq.name));
    return { tone: f.tone, text: f.text, channel: q ? q.channel : null, bu: q ? queueBu[q.name] : null };
  }), [summary, cfg, queueBu]);
  const shown = rows.filter((r) => (bu === "all" || r.bu === bu) && (ch === "all" || r.channel === ch));
  return /* @__PURE__ */ jsxs3("div", { className: "panel", children: [
    /* @__PURE__ */ jsxs3("h3", { children: [
      "Risk register ",
      /* @__PURE__ */ jsxs3("small", { children: [
        shown.length,
        " risk(s) shown \xB7 thresholds in Setup"
      ] })
    ] }),
    /* @__PURE__ */ jsxs3("div", { className: "filters", children: [
      /* @__PURE__ */ jsx3("label", { children: "Business unit" }),
      /* @__PURE__ */ jsxs3("select", { value: bu, onChange: (e) => setBu(e.target.value), children: [
        /* @__PURE__ */ jsx3("option", { value: "all", children: "All" }),
        bus.map((n) => /* @__PURE__ */ jsx3("option", { children: n }, n))
      ] }),
      /* @__PURE__ */ jsx3("label", { children: "Channel" }),
      /* @__PURE__ */ jsxs3("select", { value: ch, onChange: (e) => setCh(e.target.value), children: [
        /* @__PURE__ */ jsx3("option", { value: "all", children: "All" }),
        channels.map((c) => /* @__PURE__ */ jsx3("option", { value: c, children: c }, c))
      ] })
    ] }),
    /* @__PURE__ */ jsxs3("table", { className: "risk", children: [
      /* @__PURE__ */ jsx3("thead", { children: /* @__PURE__ */ jsxs3("tr", { children: [
        /* @__PURE__ */ jsx3("th", { children: "Risk" }),
        /* @__PURE__ */ jsx3("th", { children: "Severity" })
      ] }) }),
      /* @__PURE__ */ jsx3("tbody", { children: shown.length ? shown.map((r, i) => /* @__PURE__ */ jsxs3("tr", { children: [
        /* @__PURE__ */ jsx3("td", { children: r.text }),
        /* @__PURE__ */ jsx3("td", { children: /* @__PURE__ */ jsx3("span", { className: "sev " + (r.tone === "red" ? "red" : "amb"), children: r.tone === "red" ? "\u2715 red" : "\u25B2 amber" }) })
      ] }, i)) : /* @__PURE__ */ jsx3("tr", { children: /* @__PURE__ */ jsx3("td", { colSpan: 2, className: "hint", children: "No risks under this mix \u2014 every queue holds SLA." }) }) })
    ] })
  ] });
}
function Plan({ weeks, cfg, week, setWeek }) {
  const grouped = groupQueues2(cfg);
  return /* @__PURE__ */ jsxs3(Fragment5, { children: [
    /* @__PURE__ */ jsxs3("div", { className: "panel", children: [
      /* @__PURE__ */ jsxs3("h3", { children: [
        "RAG ribbon ",
        /* @__PURE__ */ jsx3("small", { children: "tap a week \u2014 every lens follows it" })
      ] }),
      /* @__PURE__ */ jsx3("div", { className: "ribwrap", children: /* @__PURE__ */ jsx3("table", { className: "ribbon", children: /* @__PURE__ */ jsxs3("tbody", { children: [
        /* @__PURE__ */ jsxs3("tr", { children: [
          /* @__PURE__ */ jsx3("th", { "aria-hidden": "true" }),
          weeks.map((w, i) => /* @__PURE__ */ jsx3("th", { children: i === 0 || (i + 1) % 4 === 0 ? i + 1 : "" }, i))
        ] }),
        grouped.map((grp) => /* @__PURE__ */ jsxs3(Fragment4, { children: [
          /* @__PURE__ */ jsx3("tr", { children: /* @__PURE__ */ jsx3("td", { className: "gh", colSpan: weeks.length + 1, children: grp.label }) }),
          grp.queues.map((q) => /* @__PURE__ */ jsxs3("tr", { children: [
            /* @__PURE__ */ jsx3("th", { className: "qh", children: q.name }),
            weeks.map((w, i) => {
              const st = RC[w.queues[q.id].status] || "g";
              return /* @__PURE__ */ jsx3("td", { children: /* @__PURE__ */ jsx3("button", { className: "rc " + st + (i === week ? " cur" : ""), onClick: () => setWeek(i), "aria-label": `${q.name} week ${i + 1}`, children: GLYPH2[st] }) }, i);
            })
          ] }, q.id))
        ] }, grp.key))
      ] }) }) }),
      /* @__PURE__ */ jsxs3("p", { className: "wklabel", children: [
        "Selected: ",
        /* @__PURE__ */ jsxs3("b", { children: [
          "week ",
          week + 1
        ] }),
        " \u2014 Intraday and Flow follow this cursor."
      ] })
    ] }),
    /* @__PURE__ */ jsxs3("div", { className: "panel", children: [
      /* @__PURE__ */ jsxs3("h3", { children: [
        "Required vs active FTE ",
        /* @__PURE__ */ jsx3("small", { children: "total operation" })
      ] }),
      /* @__PURE__ */ jsx3(FteChart, { weeks, cfg, week })
    ] })
  ] });
}
function FteChart({ weeks, cfg, week }) {
  const req = weeks.map((w) => w.totals.reqFte);
  const act = weeks.map((w) => w.totals.active || w.totals.paid);
  const max = Math.max(1, ...req, ...act);
  const X = (i) => 12 + i * 596 / Math.max(1, weeks.length - 1);
  const Y = (v) => 112 - v / max * 100;
  const line = (arr) => arr.map((v, i) => X(i) + "," + Y(v)).join(" ");
  const cx = X(week);
  return /* @__PURE__ */ jsxs3("svg", { width: "100%", viewBox: "0 0 620 130", "aria-label": "Required versus active FTE across the horizon", children: [
    /* @__PURE__ */ jsx3("polyline", { fill: "none", stroke: FAMILY_COLORS.workforce, strokeWidth: "2", points: line(req) }),
    /* @__PURE__ */ jsx3("polyline", { fill: "none", stroke: FAMILY_COLORS.inputs, strokeWidth: "2", points: line(act) }),
    /* @__PURE__ */ jsx3("line", { x1: cx, x2: cx, y1: "6", y2: "112", stroke: "#EF9F27", strokeWidth: "1.5", strokeDasharray: "4 3" }),
    /* @__PURE__ */ jsx3("text", { x: "10", y: "14", fontSize: "10.5", fill: FAMILY_COLORS.workforce, children: "required" }),
    /* @__PURE__ */ jsx3("text", { x: "70", y: "14", fontSize: "10.5", fill: FAMILY_COLORS.inputs, children: "active" }),
    /* @__PURE__ */ jsx3("text", { x: "10", y: "126", fontSize: "10", fill: "#8a887f", children: "wk 1" }),
    /* @__PURE__ */ jsxs3("text", { x: "588", y: "126", fontSize: "10", fill: "#8a887f", children: [
      "wk ",
      weeks.length
    ] })
  ] });
}
function Intraday({ weeks, cfg, week, setWeek }) {
  const wk = weeks[week];
  const q0 = cfg.queues[0];
  const intr = wk && wk.intraday && wk.intraday.res && wk.intraday.res[q0.id];
  const byInt = intr && intr.byInterval ? intr.byInterval : [];
  const max = Math.max(1, ...byInt.map((b) => Math.max(b.req || 0, b.agents || 0)));
  return /* @__PURE__ */ jsxs3("div", { className: "panel", children: [
    /* @__PURE__ */ jsxs3("span", { className: "inherit", children: [
      "Week ",
      /* @__PURE__ */ jsx3("b", { className: "num", children: week + 1 }),
      " \xB7 inherited from Plan",
      /* @__PURE__ */ jsx3("button", { onClick: () => setWeek(week - 1), "aria-label": "previous week", children: "\u2212" }),
      /* @__PURE__ */ jsx3("button", { onClick: () => setWeek(week + 1), "aria-label": "next week", children: "+" })
    ] }),
    /* @__PURE__ */ jsxs3("h3", { children: [
      "Required vs available agents ",
      /* @__PURE__ */ jsxs3("small", { children: [
        q0.name,
        " \xB7 first day of week ",
        week + 1
      ] })
    ] }),
    /* @__PURE__ */ jsxs3("svg", { width: "100%", viewBox: "0 0 620 140", "aria-label": "Intraday required versus available agents", children: [
      byInt.map((b, i) => {
        const x = 12 + i * 596 / Math.max(1, byInt.length);
        const wdt = Math.max(3, 596 / byInt.length / 2 - 1);
        const rH = (b.req || 0) / max * 110, aH = (b.agents || 0) / max * 110;
        return /* @__PURE__ */ jsxs3("g", { children: [
          /* @__PURE__ */ jsx3("rect", { x, y: 120 - rH, width: wdt, height: rH, fill: "#F0997B" }),
          /* @__PURE__ */ jsx3("rect", { x: x + wdt + 1, y: 120 - aH, width: wdt, height: aH, fill: FAMILY_COLORS.inputs })
        ] }, i);
      }),
      /* @__PURE__ */ jsx3("text", { x: "12", y: "136", fontSize: "10", fill: "#8a887f", children: "required" }),
      /* @__PURE__ */ jsx3("text", { x: "80", y: "136", fontSize: "10", fill: FAMILY_COLORS.inputs, children: "available" })
    ] }),
    /* @__PURE__ */ jsx3("p", { className: "wklabel", children: byInt.length ? `Week ${week + 1} \xB7 ${byInt.length} intervals` : "No intraday detail captured for this queue." })
  ] });
}
function DataLens({ weeks, cfg }) {
  const grouped = groupQueues2(cfg);
  const csv = useCallback(() => {
    const head = ["Group", "Queue", "Week", "Volume", "AHT", "SLA", "Abandon", "ReqFTE", "Active", "RunCost", "ChurnCost"];
    const lines = [head.join(",")];
    for (const grp of grouped) for (const q of grp.queues) weeks.forEach((w, i) => {
      const s = w.queues[q.id];
      lines.push([grp.label, q.name, i + 1, Math.round(s.volume), Math.round(s.ahtInEffect), (s.sl * 100).toFixed(1), (s.abandon * 100).toFixed(1), s.reqFte.toFixed(1), (s.active || 0).toFixed(1), Math.round(s.cost), Math.round(s.churnCost)].join(","));
    });
    return lines.join("\n");
  }, [weeks, grouped]);
  const [csvOut, setCsvOut] = useState5("");
  const q0 = cfg.queues[0];
  const someWeeks = [0, Math.floor(weeks.length / 2), weeks.length - 1];
  return /* @__PURE__ */ jsxs3("div", { className: "panel", children: [
    /* @__PURE__ */ jsxs3("h3", { children: [
      "Weekly data ",
      /* @__PURE__ */ jsx3("small", { children: "grouped by path \xB7 columns by KPI family \xB7 export matches the template" })
    ] }),
    /* @__PURE__ */ jsxs3("div", { style: { display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }, children: [
      /* @__PURE__ */ jsx3("span", { className: "sev", style: { background: "var(--blue-tint)", color: "var(--blue-deep)" }, children: "Inputs" }),
      /* @__PURE__ */ jsx3("span", { className: "sev", style: { background: "var(--teal-bg)", color: "var(--teal)" }, children: "Performance" }),
      /* @__PURE__ */ jsx3("span", { className: "sev", style: { background: "var(--coral-bg)", color: "var(--coral)" }, children: "Workforce" }),
      /* @__PURE__ */ jsx3("span", { className: "sev", style: { background: "var(--amber-bg)", color: "var(--amber-ink)" }, children: "Outputs" }),
      /* @__PURE__ */ jsx3("button", { className: "btn", style: { marginLeft: "auto" }, onClick: () => setCsvOut(csv()), children: "Export CSV" })
    ] }),
    /* @__PURE__ */ jsx3("div", { style: { overflowX: "auto" }, children: /* @__PURE__ */ jsxs3("table", { className: "dtab", children: [
      /* @__PURE__ */ jsx3("thead", { children: /* @__PURE__ */ jsxs3("tr", { children: [
        /* @__PURE__ */ jsx3("th", { className: "l", children: "Week" }),
        /* @__PURE__ */ jsx3("th", { className: "gInp", children: "Volume" }),
        /* @__PURE__ */ jsx3("th", { className: "gInp", children: "AHT" }),
        /* @__PURE__ */ jsx3("th", { className: "gPerf", children: "SLA" }),
        /* @__PURE__ */ jsx3("th", { className: "gPerf", children: "Abandon" }),
        /* @__PURE__ */ jsx3("th", { className: "gWf", children: "Req FTE" }),
        /* @__PURE__ */ jsx3("th", { className: "gWf", children: "Active" }),
        /* @__PURE__ */ jsx3("th", { className: "gOut", children: "Run \xA3" }),
        /* @__PURE__ */ jsx3("th", { className: "gOut", children: "Churn \xA3" })
      ] }) }),
      /* @__PURE__ */ jsx3("tbody", { children: groupQueues2(cfg).map((grp) => grp.queues.map((q) => /* @__PURE__ */ jsxs3(Fragment4, { children: [
        /* @__PURE__ */ jsx3("tr", { className: "grp", children: /* @__PURE__ */ jsxs3("td", { colSpan: 9, children: [
          grp.label,
          " \xB7 ",
          q.name
        ] }) }),
        someWeeks.map((i) => {
          const s = weeks[i].queues[q.id];
          return /* @__PURE__ */ jsxs3("tr", { children: [
            /* @__PURE__ */ jsx3("td", { className: "l num", children: i + 1 }),
            /* @__PURE__ */ jsx3("td", { className: "num", children: fmtN(s.volume) }),
            /* @__PURE__ */ jsxs3("td", { className: "num", children: [
              Math.round(s.ahtInEffect),
              " s"
            ] }),
            /* @__PURE__ */ jsx3("td", { className: "num", children: pct2(s.sl) }),
            /* @__PURE__ */ jsxs3("td", { className: "num", children: [
              (s.abandon * 100).toFixed(1),
              "%"
            ] }),
            /* @__PURE__ */ jsx3("td", { className: "num", children: s.reqFte.toFixed(1) }),
            /* @__PURE__ */ jsx3("td", { className: "num", children: (s.active || 0).toFixed(1) }),
            /* @__PURE__ */ jsx3("td", { className: "num", children: fmtGBP(s.cost) }),
            /* @__PURE__ */ jsx3("td", { className: "num", children: fmtGBP(s.churnCost) })
          ] }, q.id + i);
        })
      ] }, q.id))) })
    ] }) }),
    csvOut ? /* @__PURE__ */ jsx3("textarea", { readOnly: true, className: "num", "data-testid": "csv", style: { width: "100%", height: 60, marginTop: 8, fontSize: 11 }, value: csvOut }) : null
  ] });
}
function Flow({ weeks, cfg, week, setWeek }) {
  const [playing, setPlaying] = useState5(false);
  const timer = useRef4(null);
  useEffect4(() => {
    if (!playing) return;
    timer.current = setInterval(() => setWeek((w) => w >= weeks.length - 1 ? 0 : w + 1), 300);
    return () => clearInterval(timer.current);
  }, [playing, weeks.length, setWeek]);
  const wk = weeks[week];
  const vol = wk.totals.volume;
  const lost = cfg.queues.reduce((a, q) => a + (wk.queues[q.id].churnCustomers || 0), 0);
  const failPct = vol > 0 ? Math.min(0.5, lost / vol) : 0;
  const anyRed = cfg.queues.some((q) => wk.queues[q.id].status === "red");
  const anyAmb = cfg.queues.some((q) => wk.queues[q.id].status === "amber");
  const tint = anyRed ? "#F09595" : anyAmb ? "#FAC775" : "#E6F1FB";
  const H2 = 210, y0 = 30, resH = H2 * (1 - failPct), failH = Math.max(8, H2 * failPct);
  return /* @__PURE__ */ jsxs3("div", { className: "panel", children: [
    /* @__PURE__ */ jsxs3("h3", { children: [
      "Flow ",
      /* @__PURE__ */ jsx3("small", { children: "the plan, played through the horizon" })
    ] }),
    /* @__PURE__ */ jsxs3("div", { className: "flowctl", children: [
      /* @__PURE__ */ jsx3("button", { className: "btn primary", onClick: () => setPlaying((p) => !p), children: playing ? "\u275A\u275A Pause" : "\u25B6 Play" }),
      /* @__PURE__ */ jsx3("input", { type: "range", min: "1", max: weeks.length, value: week + 1, onChange: (e) => setWeek(+e.target.value - 1), "aria-label": "week scrubber" }),
      /* @__PURE__ */ jsxs3("span", { className: "wk num", children: [
        "Week ",
        week + 1
      ] })
    ] }),
    /* @__PURE__ */ jsxs3("svg", { width: "100%", viewBox: "0 0 640 300", "aria-label": "Volume flow for the selected week", children: [
      /* @__PURE__ */ jsx3("text", { x: "60", y: "18", textAnchor: "middle", fontSize: "10.5", fill: "#8a887f", children: "Brand" }),
      /* @__PURE__ */ jsx3("text", { x: "330", y: "18", textAnchor: "middle", fontSize: "10.5", fill: "#8a887f", children: "Queues" }),
      /* @__PURE__ */ jsx3("text", { x: "590", y: "18", textAnchor: "middle", fontSize: "10.5", fill: "#8a887f", children: "Outcome" }),
      /* @__PURE__ */ jsx3("rect", { x: "16", y: y0, width: "88", height: H2, rx: "8", fill: "#E6F1FB", stroke: "#185FA5" }),
      /* @__PURE__ */ jsxs3("text", { x: "60", y: y0 + H2 / 2, textAnchor: "middle", fontSize: "11.5", fontWeight: "600", fill: "#0C447C", children: [
        fmtN(vol),
        "/day"
      ] }),
      /* @__PURE__ */ jsx3("polygon", { points: `104,${y0} 250,${y0} 250,${y0 + H2} 104,${y0 + H2}`, fill: tint, fillOpacity: "0.35" }),
      /* @__PURE__ */ jsx3("rect", { x: "250", y: y0, width: "160", height: H2, rx: "8", fill: tint, stroke: "#185FA5" }),
      /* @__PURE__ */ jsxs3("text", { x: "330", y: y0 + H2 / 2, textAnchor: "middle", fontSize: "11", fontWeight: "600", fill: "#0C447C", children: [
        cfg.queues.length,
        " stations ",
        anyRed ? "\u2715" : anyAmb ? "\u25B2" : "\u25CF"
      ] }),
      /* @__PURE__ */ jsx3("polygon", { points: `410,${y0} 540,${y0} 540,${y0 + resH} 410,${y0 + resH}`, fill: "#1D9E75", fillOpacity: "0.25" }),
      /* @__PURE__ */ jsx3("rect", { x: "540", y: y0, width: "84", height: resH, rx: "8", fill: "#E1F5EE", stroke: "#0F6E56" }),
      /* @__PURE__ */ jsxs3("text", { x: "582", y: y0 + resH / 2, textAnchor: "middle", fontSize: "11", fontWeight: "600", fill: "#085041", children: [
        "Resolved ",
        Math.round((1 - failPct) * 100),
        "%"
      ] }),
      /* @__PURE__ */ jsx3("rect", { x: "540", y: y0 + resH + 6, width: "84", height: failH, rx: "6", fill: "#FAEEDA", stroke: "#BA7517" }),
      /* @__PURE__ */ jsxs3("text", { x: "582", y: y0 + resH + 6 + failH / 2 + 3, textAnchor: "middle", fontSize: "9.5", fontWeight: "600", fill: "#633806", children: [
        "Failed ",
        (failPct * 100).toFixed(1),
        "%"
      ] })
    ] }),
    /* @__PURE__ */ jsxs3("p", { className: "wklabel", children: [
      "Week ",
      week + 1,
      " \u2014 ",
      anyRed ? "queues strained, failure widening." : anyAmb ? "volume climbing, tinting amber." : "flows within capacity.",
      " Animated from cached results \u2014 no re-simulation."
    ] })
  ] });
}
function groupQueues2(cfg) {
  const groups = /* @__PURE__ */ new Map();
  for (const q of cfg.queues) {
    const brand = (cfg.brands || []).find((b) => b.id === q.brandId);
    const key = (q.brandId || "b") + "|" + q.channel;
    const label = `${brand ? brand.name : "Brand"} \u203A ${q.channel}`;
    if (!groups.has(key)) groups.set(key, { key, label, queues: [] });
    groups.get(key).queues.push(q);
  }
  return [...groups.values()];
}
function bestUnderWeight2(base, w) {
  const cells = [];
  for (const g of base.groups) for (const s of base.strategies) {
    const c = base.matrix.cells[g.id][s.id];
    cells.push({ gid: g.id, sid: s.id, cost: c.allIn, svc: -c.redWeeks });
  }
  const costs = cells.map((c) => c.cost), svcs = cells.map((c) => c.svc);
  const cmin = Math.min(...costs), cmax = Math.max(...costs), smin = Math.min(...svcs), smax = Math.max(...svcs);
  let best = null, bestScore = -Infinity;
  for (const c of cells) {
    const cs = 1 - (c.cost - cmin) / (cmax - cmin || 1);
    const ss = (c.svc - smin) / (smax - smin || 1);
    const score = (1 - w) * cs + w * ss;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

// ui/v2/HomePage.jsx
import { useState as useState6, useMemo as useMemo5, useEffect as useEffect5 } from "react";

// ui/v2/ecosystem.js
var import_derive2 = __toESM(require_derive());
var COLW = 96;
var GAPX = 40;
var H = 250;
var TOP = 28;
var GAPY = 6;
function stack(nodes, total) {
  const gaps = GAPY * Math.max(0, nodes.length - 1);
  const scale = total > 0 ? (H - gaps) / total : 0;
  let y = TOP;
  for (const n of nodes) {
    n.h = Math.max(3, n.value * scale);
    n.y = y;
    y += n.h + GAPY;
  }
  return scale;
}
function ribbon(x1, ys, x2, yt, wSrc, wTgt) {
  return `${x1},${ys} ${x2},${yt} ${x2},${yt + wTgt} ${x1},${ys + wSrc}`;
}
function sankeyLayout(model, opts = {}) {
  const struct = (0, import_derive2.indexStructure)(model);
  const sv = (0, import_derive2.deriveServiceVolumes)(model, struct);
  const qd = (0, import_derive2.deriveQueueWorkload)(model, { struct, serviceVolumes: sv });
  const failedPct = Math.max(0, Math.min(0.6, opts.failedPct || 0));
  const brandName = model.brands && model.brands[0] && model.brands[0].name || "Brand";
  const chLabel = { voice: "Voice", third_party: "Third party", digital: "Digital", customer_management: "Customer mgmt" };
  const services = [];
  for (const s of model.services || []) {
    const rec = sv.get(s.id);
    const vol = rec ? rec.volume : 0;
    if (vol <= 0) continue;
    const src = (rec.sources || []).filter((x) => !x.superseded && x.volume > 0).sort((a, b) => b.volume - a.volume)[0];
    const node = src ? struct.nodes.get(src.nodeId) : null;
    const chKey = node && node.level === "channel" ? node.name : "mixed";
    services.push({ id: s.id, name: s.name, value: vol, channel: chKey, journey: s.journey || [] });
  }
  const total = services.reduce((a, s) => a + s.value, 0) || 1;
  const chMap = /* @__PURE__ */ new Map();
  for (const s of services) chMap.set(s.channel, (chMap.get(s.channel) || 0) + s.value);
  const channels = [...chMap.entries()].map(([k, v]) => ({ id: "ch_" + k, label: chLabel[k] || k, value: v }));
  const queues = (model.queues || []).map((q) => {
    const d = qd.get(q.id) || { volume: 0 };
    return { id: q.id, name: q.name, type: q.type, value: d.volume, shared: q.attachment && q.attachment.kind === "shared" };
  }).filter((q) => q.value > 0).sort((a, b) => b.value - a.value);
  const totalQ = queues.reduce((a, q) => a + q.value, 0) || 1;
  const resolved = { id: "resolved", label: "Resolved", value: totalQ * (1 - failedPct) };
  const failed = { id: "failed", label: "Failed", value: Math.max(totalQ * failedPct, totalQ * 1e-3) };
  const X = (col) => 16 + col * (COLW + GAPX);
  const brand = [{ id: "brand", label: brandName, value: total }];
  stack(brand, total);
  stack(channels, total);
  stack(services, total);
  const qScale = stack(queues, totalQ);
  stack([resolved, failed], totalQ);
  const nodeX = { brand: X(0), channel: X(1), service: X(2), queue: X(3), outcome: X(4) };
  const links = [];
  const cur = {};
  const push = (fromNode, fromX, toNode, toX, value, colScaleFrom, colScaleTo, cls) => {
    const wFrom = value * colScaleFrom, wTo = value * colScaleTo;
    const ysKey = "s" + fromNode.id, ytKey = "t" + toNode.id;
    const ys = cur[ysKey] = cur[ysKey] ?? fromNode.y;
    cur[ysKey] += wFrom;
    const yt = cur[ytKey] = cur[ytKey] ?? toNode.y;
    cur[ytKey] += wTo;
    links.push({ points: ribbon(fromX + COLW, ys, toX, yt, wFrom, wTo), cls });
  };
  const scaleTotal = (H - GAPY * Math.max(0, services.length - 1)) / total;
  const scaleQ = qScale;
  for (const c of channels) push(brand[0], nodeX.brand, c, nodeX.channel, c.value, scaleTotal, scaleTotal, "vol");
  for (const s of services) {
    const c = channels.find((x) => x.id === "ch_" + s.channel);
    if (c) push(c, nodeX.channel, s, nodeX.service, s.value, scaleTotal, scaleTotal, "vol");
  }
  const qById = new Map(queues.map((q) => [q.id, q]));
  for (const s of services) for (const step of s.journey) {
    const q = qById.get(step.queueId);
    if (!q) continue;
    const split = (step.splitPct != null ? step.splitPct : 100) / 100;
    const sampling = (step.samplingPct != null ? step.samplingPct : 100) / 100;
    const v = s.value * split * sampling;
    push(s, nodeX.service, q, nodeX.queue, v, scaleTotal, scaleQ, q.type === "governance" ? "gov" : "vol");
  }
  for (const q of queues) {
    push(q, nodeX.queue, resolved, nodeX.outcome, q.value * (1 - failedPct), scaleQ, scaleQ, "res");
    push(q, nodeX.queue, failed, nodeX.outcome, q.value * failedPct, scaleQ, scaleQ, "fail");
  }
  return {
    brandName,
    total,
    totalQ,
    failedPct,
    width: X(4) + COLW + 16,
    height: H + TOP + 20,
    columns: [
      { key: "brand", x: nodeX.brand, label: "Brand", nodes: brand },
      { key: "channel", x: nodeX.channel, label: "Channel", nodes: channels },
      { key: "service", x: nodeX.service, label: "Service mix", nodes: services.map((s) => ({ id: s.id, label: s.name, value: s.value, y: s.y, h: s.h })) },
      { key: "queue", x: nodeX.queue, label: "Journey queues", nodes: queues.map((q) => ({ id: q.id, label: q.name, value: q.value, y: q.y, h: q.h, gov: q.type === "governance", shared: q.shared })) },
      { key: "outcome", x: nodeX.outcome, label: "Outcome", nodes: [resolved, failed] }
    ],
    links,
    colw: COLW
  };
}

// ui/v2/HomePage.jsx
import { jsx as jsx4, jsxs as jsxs4 } from "react/jsx-runtime";
var fmtM3 = (n) => "\xA3" + (n / 1e6).toFixed(1) + "m";
var fmtN2 = (n) => Math.round(n).toLocaleString("en-GB");
var RAG = { green: { cls: "ok", glyph: "\u25CF", label: "on track" }, amber: { cls: "warn", glyph: "\u25B2", label: "at risk" }, red: { cls: "bad", glyph: "\u2715", label: "red risks" } };
function HomePage({ simulations, onOpen, onNew }) {
  const [modal, setModal] = useState6(false);
  const [eco, setEco] = useState6(null);
  const [query, setQuery] = useState6("");
  const shown = simulations.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));
  const soon = "Not available in this build yet";
  return /* @__PURE__ */ jsxs4("div", { className: "shell", children: [
    /* @__PURE__ */ jsxs4("header", { className: "top", children: [
      /* @__PURE__ */ jsxs4("div", { className: "brand", children: [
        /* @__PURE__ */ jsx4("div", { className: "mark", children: "C" }),
        /* @__PURE__ */ jsxs4("div", { children: [
          /* @__PURE__ */ jsx4("h1", { children: "Capacity Simulator" }),
          /* @__PURE__ */ jsx4("small", { children: "Acme workspace" })
        ] })
      ] }),
      /* @__PURE__ */ jsx4("div", { className: "avatar", "aria-label": "Nick Morris", children: "NM" })
    ] }),
    /* @__PURE__ */ jsxs4("div", { className: "pagehead", children: [
      /* @__PURE__ */ jsx4("h2", { children: "Simulations" }),
      /* @__PURE__ */ jsx4("button", { className: "btn primary", onClick: () => setModal(true), children: "+ New simulation" })
    ] }),
    /* @__PURE__ */ jsxs4("div", { className: "toolbar", children: [
      /* @__PURE__ */ jsxs4("label", { className: "search", children: [
        "\u2315 ",
        /* @__PURE__ */ jsx4("input", { value: query, onChange: (e) => setQuery(e.target.value), placeholder: "Search simulations", "aria-label": "Search simulations", style: { border: "none", background: "none", font: "inherit", flex: 1, outline: "none", color: "var(--ink)" } })
      ] }),
      /* @__PURE__ */ jsx4("button", { className: "btn", onClick: () => setEco(simulations[0]), children: "Ecosystem" }),
      /* @__PURE__ */ jsx4("button", { className: "btn", disabled: true, title: soon, children: "Compare" }),
      /* @__PURE__ */ jsx4("button", { className: "btn", disabled: true, title: soon, children: "Presets" })
    ] }),
    /* @__PURE__ */ jsxs4("div", { className: "grid", children: [
      shown.map((sim) => /* @__PURE__ */ jsx4(SimCard, { sim, onEco: () => setEco(sim), onOpen, soon }, sim.id)),
      query && !shown.length ? /* @__PURE__ */ jsxs4("p", { className: "hint", style: { gridColumn: "1 / -1" }, children: [
        "No simulations match \u201C",
        query,
        "\u201D."
      ] }) : null,
      /* @__PURE__ */ jsxs4("button", { className: "newcard", onClick: () => setModal(true), children: [
        /* @__PURE__ */ jsx4("span", { className: "plus", children: "+" }),
        "New simulation",
        /* @__PURE__ */ jsx4("small", { children: "Ecosystem, subset, or single service" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs4("p", { className: "note", children: [
      /* @__PURE__ */ jsx4("b", { children: "Design notes:" }),
      " one primary action per view \xB7 destructive actions behind \u22EF with type-to-confirm \xB7 thumbnails show scope \xB7 status always colour + glyph (\u2715 \u25B2 \u25CF) \xB7 chips use KPI-family colours \xB7 tabular numerals throughout."
    ] }),
    modal ? /* @__PURE__ */ jsx4(ForkModal, { onClose: () => setModal(false), onNew }) : null,
    eco ? /* @__PURE__ */ jsx4(Ecosystem, { sim: eco, onClose: () => setEco(null), onEditInSetup: () => {
      setEco(null);
      onOpen && onOpen();
    } }) : null
  ] });
}
function SimCard({ sim, onEco, onOpen, soon }) {
  const h = sim.headline;
  const rag = RAG[h.worst];
  return /* @__PURE__ */ jsxs4("article", { className: "card", children: [
    /* @__PURE__ */ jsxs4("div", { className: "head", children: [
      /* @__PURE__ */ jsx4("button", { className: "thumb", onClick: onEco, "aria-label": "Open ecosystem view for " + sim.name, children: /* @__PURE__ */ jsx4(Thumb, { model: sim.model }) }),
      /* @__PURE__ */ jsxs4("div", { style: { minWidth: 0 }, children: [
        /* @__PURE__ */ jsx4("h3", { children: sim.name }),
        /* @__PURE__ */ jsxs4("p", { className: "meta", children: [
          sim.scope,
          " \xB7 updated ",
          sim.updated,
          " \xB7 ",
          sim.runs,
          " runs"
        ] })
      ] }),
      /* @__PURE__ */ jsx4("button", { className: "dots", "aria-label": "More actions for " + sim.name, disabled: true, title: soon, children: "\u22EF" })
    ] }),
    /* @__PURE__ */ jsxs4("div", { className: "chips", children: [
      /* @__PURE__ */ jsxs4("span", { className: "chip num", children: [
        h.horizon,
        " wk"
      ] }),
      /* @__PURE__ */ jsxs4("span", { className: "chip num", children: [
        sim.services,
        " svc \xB7 ",
        h.queues,
        " queues"
      ] }),
      /* @__PURE__ */ jsxs4("span", { className: "chip hc num", children: [
        fmtN2(h.availFte),
        " FTE avail."
      ] }),
      /* @__PURE__ */ jsxs4("span", { className: "chip money num", children: [
        fmtM3(h.allIn),
        " all-in"
      ] }),
      /* @__PURE__ */ jsxs4("span", { className: "chip " + rag.cls, children: [
        rag.glyph,
        " ",
        h.worst === "green" ? "on track" : rag.label
      ] })
    ] }),
    /* @__PURE__ */ jsx4("button", { className: "btn open", onClick: onOpen, children: "Open" })
  ] });
}
function Thumb({ model }) {
  const nodes = (model.queues || []).slice(0, 6);
  const pts = [[20, 14], [56, 12], [14, 45], [46, 49], [66, 38], [38, 31]];
  return /* @__PURE__ */ jsx4("svg", { width: "76", height: "62", viewBox: "0 0 76 62", "aria-hidden": "true", children: nodes.map((q, i) => {
    const [cx, cy] = pts[i % pts.length];
    const voice = q.type === "inbound_call" || q.type === "outbound_call";
    return /* @__PURE__ */ jsx4("circle", { cx, cy, r: i === 0 ? 7 : 6, fill: voice ? "#185FA5" : q.type === "governance" ? "#534AB7" : "#378ADD" }, q.id);
  }) });
}
function ForkModal({ onClose, onNew }) {
  const forks = [
    { t: "Whole ecosystem", d: "Start fresh and build every service, journey and queue in Setup." },
    { t: "Subset", d: "Start fresh, then add the services and journey queues you want." },
    { t: "Single service", d: "Start fresh with one service and its journey. Ready in under a minute." }
  ];
  const enter = () => {
    onClose();
    onNew && onNew();
  };
  useEffect5(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return /* @__PURE__ */ jsx4("div", { className: "overlay on", onClick: (e) => {
    if (e.target === e.currentTarget) onClose();
  }, children: /* @__PURE__ */ jsxs4("div", { className: "modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "forktitle", children: [
    /* @__PURE__ */ jsx4("h3", { id: "forktitle", children: "New simulation" }),
    /* @__PURE__ */ jsx4("p", { children: "Choose the scope \u2014 it opens in Setup, where you can refine everything." }),
    /* @__PURE__ */ jsx4("div", { className: "forks", children: forks.map((f) => /* @__PURE__ */ jsx4("button", { className: "fork", onClick: enter, children: /* @__PURE__ */ jsxs4("span", { children: [
      /* @__PURE__ */ jsx4("span", { className: "t", children: f.t }),
      /* @__PURE__ */ jsx4("br", {}),
      /* @__PURE__ */ jsx4("span", { className: "d", children: f.d })
    ] }) }, f.t)) }),
    /* @__PURE__ */ jsxs4("div", { className: "foot", children: [
      /* @__PURE__ */ jsx4("button", { className: "link", disabled: true, title: "Not available in this build yet", style: { opacity: 0.5, cursor: "not-allowed" }, children: "Start from a template" }),
      /* @__PURE__ */ jsx4("button", { className: "btn", onClick: onClose, children: "Cancel" })
    ] })
  ] }) });
}
function Ecosystem({ sim, onClose, onEditInSetup }) {
  const layout = useMemo5(() => sankeyLayout(sim.model, { failedPct: sim.headline.allIn && sim.headline ? failedFrac(sim) : 0.02 }), [sim]);
  const fill = (cls) => cls === "gov" ? "#7F77DD" : cls === "res" ? "#1D9E75" : cls === "fail" ? "#EF9F27" : "#378ADD";
  const nodeFill = (col, n) => col.key === "outcome" ? n.id === "failed" ? "#FAEEDA" : "#E1F5EE" : col.key === "service" ? "#fff" : n.gov ? "#EEEDFE" : "#E6F1FB";
  const nodeStroke = (col, n) => col.key === "outcome" ? n.id === "failed" ? "#BA7517" : "#0F6E56" : n.gov ? "#534AB7" : "#185FA5";
  return /* @__PURE__ */ jsx4("div", { className: "eco-scrim on", onClick: (e) => {
    if (e.target === e.currentTarget) onClose();
  }, children: /* @__PURE__ */ jsxs4("div", { className: "eco", role: "dialog", "aria-modal": "true", "aria-labelledby": "ecotitle", children: [
    /* @__PURE__ */ jsxs4("h3", { id: "ecotitle", children: [
      "Ecosystem \u2014 ",
      layout.brandName
    ] }),
    /* @__PURE__ */ jsx4("p", { className: "sub", children: "Volume flow \xB7 brand \u2192 channel \u2192 service mix \u2192 journey queues \u2192 outcome \xB7 view only, edit in Setup" }),
    /* @__PURE__ */ jsx4("div", { style: { overflowX: "auto" }, children: /* @__PURE__ */ jsxs4("svg", { width: "100%", viewBox: `0 0 ${layout.width} ${layout.height}`, "aria-label": "Ecosystem volume flow", style: { minWidth: 560 }, children: [
      layout.columns.map((col) => /* @__PURE__ */ jsx4("text", { x: col.x + layout.colw / 2, y: "16", textAnchor: "middle", fontSize: "10.5", fill: "#8a887f", children: col.label }, col.key)),
      layout.links.map((lk, i) => /* @__PURE__ */ jsx4("polygon", { points: lk.points, fill: fill(lk.cls), fillOpacity: lk.cls === "fail" ? "0.5" : "0.28" }, i)),
      layout.columns.map((col) => col.nodes.map((n) => /* @__PURE__ */ jsxs4("g", { children: [
        /* @__PURE__ */ jsx4("rect", { x: col.x, y: n.y, width: layout.colw, height: n.h, rx: "7", fill: nodeFill(col, n), stroke: nodeStroke(col, n) }),
        /* @__PURE__ */ jsxs4("text", { x: col.x + layout.colw / 2, y: n.y + n.h / 2 + 3, textAnchor: "middle", fontSize: "9.5", fontWeight: "600", fill: "#0C447C", children: [
          clip(n.label),
          col.key === "outcome" ? " " + Math.round(n.value / layout.totalQ * 100) + "%" : ""
        ] })
      ] }, n.id)))
    ] }) }),
    /* @__PURE__ */ jsxs4("p", { className: "ecohint", style: { marginTop: 6 }, children: [
      "Channel volume profiles split by service mix %; journeys route it onward. Governance stations (purple) sample a % of cases. ",
      /* @__PURE__ */ jsx4("b", { children: "Queue volumes are derived, never entered." })
    ] }),
    /* @__PURE__ */ jsxs4("div", { className: "legend", children: [
      /* @__PURE__ */ jsx4("span", { className: "lg pool", children: "ribbon = volume share" }),
      /* @__PURE__ */ jsx4("span", { className: "lg sup", children: "green = resolved" }),
      /* @__PURE__ */ jsx4("span", { className: "lg ovf", children: "amber = failed" })
    ] }),
    /* @__PURE__ */ jsxs4("div", { className: "ecofoot", children: [
      /* @__PURE__ */ jsx4("span", { className: "ecohint", children: "Flows shown for the current plan; scrub weeks in Results \u203A Flow." }),
      /* @__PURE__ */ jsxs4("div", { style: { display: "flex", gap: 8 }, children: [
        /* @__PURE__ */ jsx4("button", { className: "btn", onClick: onEditInSetup, children: "Edit in Setup" }),
        /* @__PURE__ */ jsx4("button", { className: "btn primary", onClick: onClose, children: "Close" })
      ] })
    ] })
  ] }) });
}
var clip = (s) => s && s.length > 16 ? s.slice(0, 15) + "\u2026" : s;
function failedFrac(sim) {
  const h = sim.headline;
  const est = h.lost && h.queues ? Math.min(0.12, h.lost / Math.max(1, h.horizon * 5e3 * h.queues)) : 0.02;
  return est;
}

// ui/v2/store.js
var KEY = "capacity.v2.model";
function loadModel() {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ui/v2/App.jsx
var import_store_domain = __toESM(require_store_domain());
var import_migrate_domain = __toESM(require_migrate_domain());
var import_ops = __toESM(require_ops());
import { Fragment as Fragment6, jsx as jsx5, jsxs as jsxs5 } from "react/jsx-runtime";
function App({ initialModel }) {
  const [model, setModel] = useState7(() => {
    try {
      const r = (0, import_store_domain.loadDomainModel)();
      if (r) return r.model;
    } catch {
    }
    try {
      return (0, import_migrate_domain.migrateV2ToDomain)(loadModel() || initialModel);
    } catch {
      return (0, import_migrate_domain.migrateV2ToDomain)(initialModel);
    }
  });
  const [tab, setTab] = useState7("home");
  const [importReport, setImportReport] = useState7(null);
  const [selected, setSelected] = useState7(null);
  const nav = useCallback2((t) => setTab(t), []);
  const newSimulation = useCallback2(() => {
    setModel((m) => (0, import_ops.blankDomainModel)(m.engineConfig || initialModel.engineConfig));
    setSelected(null);
    setTab("setup");
  }, [initialModel]);
  const timer = useRef5(null);
  useEffect6(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => (0, import_store_domain.saveDomainModel)(model), 300);
    return () => clearTimeout(timer.current);
  }, [model]);
  const lastHeadline = useRef5(null);
  const simulations = useMemo6(() => {
    let headline = lastHeadline.current;
    if (tab === "home" || !headline) {
      try {
        headline = quickHeadline(model);
        lastHeadline.current = headline;
      } catch {
        headline = headline || { horizon: 0, queues: (model.queues || []).length, allIn: 0, availFte: 0, worst: "amber", lost: 0 };
      }
    }
    return [{
      id: "sim_full",
      name: (model.brands[0] && model.brands[0].name || "New simulation") + " \u2014 full estate",
      scope: "Whole ecosystem",
      updated: "just now",
      runs: 3,
      model,
      services: (model.requestTypes || []).length,
      headline
    }];
  }, [model, tab]);
  const onDownloadTemplate = useCallback2(async (m) => {
    const { downloadDomainTemplate: downloadDomainTemplate2 } = await Promise.resolve().then(() => (init_template_domain_xlsx(), template_domain_xlsx_exports));
    await downloadDomainTemplate2(m);
  }, []);
  const onUploadTemplate = useCallback2(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls";
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        const { importDomainWorkbook: importDomainWorkbook2 } = await Promise.resolve().then(() => (init_template_domain_xlsx(), template_domain_xlsx_exports));
        const buf = await file.arrayBuffer();
        const { model: imported } = await importDomainWorkbook2(new Uint8Array(buf));
        const merged = { ...imported, engineConfig: model.engineConfig };
        setModel(merged);
        setSelected(null);
        setImportReport({ ...(0, import_ops.buildDomainImportReport)(merged), filename: file.name });
        setTab("setup");
      } catch (e) {
        setImportReport({ error: `Couldn\u2019t read \u201C${file.name}\u201D. ${e.message}` });
        setTab("setup");
      }
    };
    input.click();
  }, [model]);
  return /* @__PURE__ */ jsxs5(Fragment6, { children: [
    tab === "home" && /* @__PURE__ */ jsx5(HomePage, { simulations, onOpen: () => setTab("setup"), onNew: newSimulation, onNav: nav }),
    tab === "setup" && /* @__PURE__ */ jsx5(SetupV3Page, { model, onModelChange: setModel, onNav: nav, onDownloadTemplate, onUploadTemplate, importReport, onDismissImport: () => setImportReport(null) }),
    tab === "levers" && /* @__PURE__ */ jsx5(LeversPage, { model, onModelChange: setModel, onNav: nav, selected, onSelectedChange: setSelected }),
    tab === "results" && /* @__PURE__ */ jsx5(ResultsPage, { model, onNav: nav, selected, onSelectedChange: setSelected })
  ] });
}

// ui/v2/app-main.jsx
var import_engine4 = __toESM(require_engine());
var import_migrate = __toESM(require_migrate());
import { jsx as jsx6 } from "react/jsx-runtime";
var OWNER = "nick_morris";
function seedModel() {
  return (0, import_migrate.migrateV1ToV2)((0, import_engine4.makeDefaultConfig)());
}
function injectStyle() {
  if (typeof document === "undefined" || document.getElementById("capacity-v2-style")) return;
  const el2 = document.createElement("style");
  el2.id = "capacity-v2-style";
  el2.textContent = CSS;
  document.head.appendChild(el2);
}
function mount(container, opts = {}) {
  injectStyle();
  const root = createRoot(container);
  root.render(/* @__PURE__ */ jsx6(App, { initialModel: opts.model || seedModel() }));
  return root;
}
var el = typeof document !== "undefined" ? document.getElementById("root") : null;
if (el) mount(el);
var app_main_default = App;
export {
  App,
  OWNER,
  app_main_default as default,
  mount,
  seedModel
};
