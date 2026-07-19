var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
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

// engine/engine.js
var require_engine = __commonJS({
  "engine/engine.js"(exports, module) {
    var clamp2 = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    var sum = (a) => a.reduce((s, v) => s + v, 0);
    var norm = (a) => {
      const t = sum(a) || 1;
      return a.map((v) => v / t);
    };
    var uid3 = () => Math.random().toString(36).slice(2, 9);
    var DEFAULT_PROFILE2 = [
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
      return clamp2(B / den, 0, 1);
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
      const ab = clamp2((lo + hi) / 2, 0, 1);
      const e = probe(ab);
      const rate = e.drain + gamma;
      const asa = rate > 0 ? e.C / rate : pat;
      const sl = rate > 0 ? clamp2(1 - e.C + e.C * (e.drain / rate) * (1 - Math.exp(-rate * target)), 0, 1) : 0;
      const out = { asa, sl, abandon: ab, occ: clamp2(e.Aeff / N, 0, 1) };
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
    function reqCurveDigital(q, volume, eng, cache) {
      const key = "d" + profileId(q.profile) + "|" + Math.round(volume) + "|" + q.aht + "|" + q.concurrency + "|" + eng.occupancyCeiling + "|" + eng.intervalMin;
      const hit = _rcCache.get(key);
      if (hit) return hit;
      const p = norm(q.profile), iSec = eng.intervalMin * 60, iHrs = eng.intervalMin / 60;
      const agents = p.map((share) => volume * share * q.aht / (q.concurrency * iSec * eng.occupancyCeiling));
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
    var reqCurve = (q, v, eng, cache) => q.type === "voice" ? reqCurveVoice(q, v, eng, cache) : q.subtype === "workflow" ? reqCurveWorkflow(q, v, eng, cache) : reqCurveDigital(q, v, eng, cache);
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
        const occ = cap > 0 ? clamp2(served / cap, 0, 1) : 1;
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
        sl: clamp2(frac, 0, 1),
        respMin: meanWaitDays * 24 * 60,
        respHours: meanWaitDays * 24,
        endBacklog: Bend,
        occ: cap > 0 ? clamp2(served / cap, 0, 1) : 1,
        byInterval: null
      };
    }
    var hoursPerHeadDay = (q, eng) => eng.hoursPerFteDay * (eng.daysWorkedPerFte / eng.daysPerWeek) * (1 - clamp2(q.shrinkage, 0, 0.95));
    function stretchCurve(curve, startProf, stretch) {
      const n = Math.max(1, Math.round(curve.length * stretch));
      const out = [];
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 1 : i / (n - 1);
        out.push(clamp2(startProf + (1 - startProf) * t, 0.05, 1));
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
    function seasonalMult2(w, cfg, q) {
      const m = monthForWeek(cfg, w);
      const sys = cfg.seasonality.system[m] ?? 1;
      const qm = (q.seasonal && q.seasonal[m]) ?? 1;
      return sys * qm;
    }
    function generateWeeklySeries2(cfg, base, months, horizon) {
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
      const H = resolveHorizon(cfg);
      for (let w = 0; w < H; w++) {
        if (strategyAt(cfg, idOrObj, w).baseType !== "manual") return false;
      }
      return true;
    }
    function effectiveSupports2(cfg) {
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
    function supportersOf2(cfg, qid) {
      const map = effectiveSupports2(cfg);
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
    var R2_DEFAULTS2 = {
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
      const val = mergeDeep(R2_DEFAULTS2, cfg.settings || null);
      _settingsCache.set(cfg, { src: cfg.settings, val });
      return val;
    }
    function resolveHorizon(cfg) {
      const s = settingsOf(cfg).horizon;
      const w = Math.round(cfg.engine.horizonWeeks || s.default);
      return clamp2(w, s.min, s.max);
    }
    var channelOf3 = (q) => q.channel || (q.type === "voice" ? "voice" : "digital");
    var brandFor = (cfg, q) => (cfg.brands || []).find((b) => b.id === q.brandId) || null;
    var channelTemplate = (cfg, q) => (cfg.channels || {})[channelOf3(q)] || null;
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
    function primaryVoiceQueue2(cfg, brandId) {
      const voice = cfg.queues.filter((q) => channelOf3(q) === "voice");
      return voice.find((q) => q.brandId === brandId) || voice[0] || null;
    }
    function resolveKnockOn2(cfg, q) {
      if (q.knock) {
        const k = q.knock;
        const target = k.convertTarget !== void 0 ? k.convertTarget : (primaryVoiceQueue2(cfg, q.brandId) || {}).id || null;
        return {
          repeatPct: k.repeatPct != null ? k.repeatPct : 0,
          spillPct: k.convertPct != null ? k.convertPct : 0,
          spillTargetQueue: target
        };
      }
      const ch = channelOf3(q);
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
      if (sc.kind === "template") return channelOf3(q) === sc.channel;
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
      return base * seasonalMult2(week, cfg, q) * (sc || scenarioFor(week, day, q, cfg, activeIds)).volMult;
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
        const wkAttr = clamp2(q.wf.attrition * (1 + q.wf.attritionGrowth * (w / 4.345)) + sc.attritionAdd, 0, 0.6) / 4.345;
        const proj = projectSupply(s, q, lead, wkAttr);
        let want = 0;
        if (sObj.baseType === "manual") {
          want = (q.wf.hires || []).filter((h) => h.week === w).reduce((a, b) => a + b.heads, 0);
        } else if (sObj.baseType === "backfill") {
          const fm = sObj.forwardMonths;
          if (fm != null) {
            const ahead = Math.max(1, Math.round(clamp2(fm, 1, 6) * (52 / 12)));
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
        const segKey = (q) => (q.brandId || "") + "|" + channelOf3(q);
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
            const label = brandName(x.q.brandId) + " \xD7 " + channelOf3(x.q) + " cap";
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
      const H = resolveHorizon(cfg);
      const strategy = opts.strategy || cfg.hiring.activeStrategy || "S1";
      const activeIds = new Set(opts.viewIds != null ? opts.viewIds : cfg.scenarios.filter((s) => s.enabled).map((s) => s.id));
      const rcCache = /* @__PURE__ */ new Map();
      const reqFteCache = /* @__PURE__ */ new Map();
      const reqFteAt = (q, wk) => {
        const w2 = Math.min(wk, H - 1);
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
      const supportsMap = effectiveSupports2(cfg);
      const knMap = {};
      for (const q of cfg.queues) knMap[q.id] = resolveKnockOn2(cfg, q);
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
      const isReceiver = (q) => channelOf3(q) === "support" || q.resourcing === "unmanned" || q.resourcing === "supported";
      const isAutoDonor = (q) => q.resourcing === "leveraged";
      for (let w = 0; w < H; w++) {
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
          const wk2 = clamp2(monthly, 0, 0.6) / 4.345 * bMult * dMult;
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
            hrs[q.id] = prof2 * eng.hoursPerFteDay * (eng.daysWorkedPerFte / eng.daysPerWeek) * clamp2(1 - q.shrinkage - absence, 0.02, 1);
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
              const offer = clamp2((donor.sharing.sharePct != null ? donor.sharing.sharePct : 100) / 100, 0, 1) * stageSpare[donor.id];
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
            const donors = members.filter((x) => spare[x.q.id] > 1e-9 && deficit[x.q.id] <= 1e-9).map((x) => ({ qid: x.q.id, avail: spare[x.q.id] * clamp2((x.m.sharePct != null ? x.m.sharePct : 100) / 100, 0, 1), fed: 0 }));
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
              const preview = q.type === "voice" ? runVoiceDay(st[q.id].eq, vol[q.id], hrs[q.id], eng, rc[q.id], true) : runDigitalDay(st[q.id].eq, vol[q.id], hrs[q.id], st[q.id].backlog, eng, rc[q.id], true);
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
            let r;
            const m = s.dm;
            if (d !== 0 && m && m.vol === vol[q.id] && m.hrs === hrs[q.id] && m.aht === s.eq.aht && m.slaMin === s.eq.digitalSlaMinutes && m.backlog0 === s.backlog) {
              r = m.r;
            } else {
              r = q.subtype === "workflow" ? runWorkflowDay(s.eq, vol[q.id], hrs[q.id], s.backlog, eng, rc[q.id], d !== 0) : runDigitalDay(s.eq, vol[q.id], hrs[q.id], s.backlog, eng, rc[q.id], d !== 0);
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
          if (occ > q.burn.occThreshold) s.burnout = clamp2(s.burnout + (occ - q.burn.occThreshold) * 100 * q.burn.sensitivity, 0, 100);
          else s.burnout = clamp2(s.burnout - q.burn.recovery, 0, 100);
          if (a.otHours > 1e-9 && s.otWeeklyCap > 1e-9) {
            s.burnout = clamp2(s.burnout + set.ot.burnoutLoad * (a.otHours / s.otWeeklyCap), 0, 100);
          }
          const reclaimWeekCap = (s.reclaimCapDay || 0) * eng.daysPerWeek;
          const reclaimShare = reclaimWeekCap > 1e-9 ? clamp2(a.reclaimedHours / reclaimWeekCap, 0, 1) : 0;
          if (reclaimShare > 1e-6) s.trainingDebt = clamp2(s.trainingDebt + set.trainingDebt.accumRate * reclaimShare, 0, 100);
          else s.trainingDebt = clamp2(s.trainingDebt - set.trainingDebt.recoveryRate, 0, 100);
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
          const repeatShare = clamp2((a.redial + a.deflected) / V, 0, 1);
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
          const ok = q.type === "voice" ? asa <= asaT && ab <= q.maxAbandon : wfQ ? sl >= wfPct && a.backlog <= (q.backlogLimit != null ? q.backlogLimit : Infinity) : sl >= q.digitalSlaPct && a.backlog <= q.backlogLimit;
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
            channel: channelOf3(q),
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
    function compactRun3(cfg, sim) {
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
          { id: v1, name: "Voice \u2014 Billing", type: "voice", brandId: "b1", channel: "voice", priority: 1, dailyVolume: 2e3, aht: 300, profile: [...DEFAULT_PROFILE2], asaTarget: 30, maxAbandon: 0.05, patience: 90, shrinkage: 0.3, fte: 63, agentCost: 32e3, crossSkill: [v2], weeklyVolumes: null, seasonal: null, concurrency: 1, digitalSlaMinutes: 5, digitalSlaPct: 0.8, backlogLimit: 150, deflectsTo: null, resourcing: "resourced", supports: [], wf: wf(), burn: burn() },
          { id: v2, name: "Voice \u2014 Technical", type: "voice", brandId: "b1", channel: "voice", priority: 2, dailyVolume: 900, aht: 420, profile: [...DEFAULT_PROFILE2], asaTarget: 45, maxAbandon: 0.06, patience: 100, shrinkage: 0.3, fte: 47, agentCost: 32e3, crossSkill: [], weeklyVolumes: null, seasonal: null, concurrency: 1, digitalSlaMinutes: 5, digitalSlaPct: 0.8, backlogLimit: 150, deflectsTo: null, resourcing: "resourced", supports: [], wf: wf(), burn: burn() },
          { id: d1, name: "WhatsApp \u2014 Service", type: "digital", brandId: "b1", channel: "digital", priority: 3, dailyVolume: 1400, aht: 420, profile: [...DEFAULT_PROFILE2], concurrency: 2.5, digitalSlaMinutes: 5, digitalSlaPct: 0.8, backlogLimit: 150, deflectsTo: v1, shrinkage: 0.3, fte: 20, agentCost: 3e4, crossSkill: [], weeklyVolumes: null, seasonal: null, asaTarget: 30, maxAbandon: 0.05, patience: 90, resourcing: "resourced", supports: [], wf: wf(), burn: burn() },
          { id: d2, name: "Chat \u2014 Sales", type: "digital", brandId: "b1", channel: "digital", priority: 4, dailyVolume: 700, aht: 360, profile: [...DEFAULT_PROFILE2], concurrency: 2, digitalSlaMinutes: 3, digitalSlaPct: 0.8, backlogLimit: 80, deflectsTo: v1, shrinkage: 0.3, fte: 11, agentCost: 3e4, crossSkill: [], weeklyVolumes: null, seasonal: null, asaTarget: 30, maxAbandon: 0.05, patience: 90, resourcing: "resourced", supports: [], wf: wf(), burn: burn() }
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
      const supports = effectiveSupports2(out);
      out.queues = out.queues.map((q, i) => {
        const kn = resolveKnockOn2(out, q);
        return {
          ...q,
          brandId: q.brandId || brandId,
          channel: channelOf3(q),
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
      return cfg.queues.filter((q) => brands.has(q.brandId) || channels.has(channelOf3(q)) || ids.has(q.id)).map((q) => q.id);
    }
    function applyGroupScope2(cfg, groupId) {
      const g = (cfg.groups || []).find((x) => x.id === groupId);
      const qids = g ? groupScopeQueueIds(cfg, g.scope) : null;
      if (!qids) return cfg;
      const inGroup = new Set(groupScenarioIds2(cfg, groupId));
      return {
        ...cfg,
        scenarios: cfg.scenarios.map((s) => inGroup.has(s.id) ? { ...s, scope: { kind: "queues", queueIds: qids }, queueIds: qids } : s)
      };
    }
    function makeBlankConfig2() {
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
      for (const q of r2.queues) knockOf[q.id] = resolveKnockOn2(r2, q);
      const shareOf = {};
      for (const pool of r2.pools || []) {
        for (const m of pool.members || []) {
          const others = (pool.members || []).filter((x) => x.queueId !== m.queueId).map((x) => x.queueId);
          const pct2 = m.sharePct != null ? m.sharePct : 100;
          const cur = shareOf[m.queueId];
          if (!cur) shareOf[m.queueId] = { sharePct: pct2, sharesWith: [...others] };
          else {
            cur.sharePct = Math.max(cur.sharePct, pct2);
            for (const id of others) if (!cur.sharesWith.includes(id)) cur.sharesWith.push(id);
          }
        }
      }
      return {
        ...r2,
        queues: r2.queues.map((q) => {
          const kn = knockOf[q.id];
          const primary = primaryVoiceQueue2(r2, q.brandId);
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
      seasonalMult: seasonalMult2,
      SEASONAL_PRESETS: SEASONAL_PRESETS2,
      exogenousVolume,
      projectSupply,
      decideHiring,
      simulate: simulate3,
      compactRun: compactRun3,
      summarise,
      makeDefaultConfig: makeDefaultConfig2,
      DEFAULT_PROFILE: DEFAULT_PROFILE2,
      clamp: clamp2,
      norm,
      sum,
      uid: uid3,
      stretchCurve,
      // Revision 1 (SPEC §14)
      BUILTIN_STRATEGIES,
      strategyById,
      strategyAt,
      strategyAllManual,
      effectiveSupports: effectiveSupports2,
      supportersOf: supportersOf2,
      resolveStartingHC,
      // Revision 2 (SPEC §15–§21)
      settingsOf,
      resolveHorizon,
      resolveTraining,
      resolveKnockOn: resolveKnockOn2,
      blendedAht,
      channelOf: channelOf3,
      brandFor,
      brandShareVolume,
      R2_DEFAULTS: R2_DEFAULTS2,
      migrateScenarioToUnified,
      migrateServiceTeamsToLeveraged,
      migrateConfigR2,
      groupScenarioIds: groupScenarioIds2,
      // Revision 3 (SPEC §24)
      migrateConfigR3,
      makeBlankConfig: makeBlankConfig2,
      runWorkflowDay,
      digitalSubtype,
      monthForWeek,
      generateWeeklySeries: generateWeeklySeries2,
      primaryVoiceQueue: primaryVoiceQueue2,
      groupScopeQueueIds,
      applyGroupScope: applyGroupScope2
    };
  }
});

// ui/main.jsx
import { createRoot } from "react-dom/client";

// ui/App.jsx
var import_engine10 = __toESM(require_engine());
import { useState as useState18, useMemo as useMemo3, useEffect as useEffect4, useRef as useRef4, useCallback as useCallback4 } from "react";

// ui/sim-set.js
var import_engine = __toESM(require_engine());
import { useRef, useState, useEffect, useMemo } from "react";

// ui/views.js
var STRATEGIES = [
  { id: "S1", name: "Meet requirement", blurb: "Close the gap to required FTE at the landing week." },
  { id: "S2", name: "Buffer above", blurb: "Target requirement \xD7 (1 + buffer)." },
  { id: "S3", name: "Forward backfill", blurb: "Replace projected leavers only \u2014 never hire for growth." },
  { id: "S4", name: "Manual plan", blurb: "Your per-queue hires, exactly as entered; ignores the cap." }
];
var STRATEGY_IDS = STRATEGIES.map((s) => s.id);
var strategyName = (id) => (STRATEGIES.find((s) => s.id === id) || { name: id }).name;
var BASE_BLURB = {
  meet: "Close the requirement gap at the landing week.",
  buffer: "Target requirement \xD7 (1 + buffer).",
  backfill: "Replace projected leavers only \u2014 never hire for growth.",
  manual: "Your per-queue hires, exactly as entered; ignores the cap.",
  schedule: "An ordered plan that pivots strategy at set weeks."
};
function strategyList(config) {
  const list = config && config.strategies || [];
  return list.length ? list : STRATEGIES.map((s, i) => ({ id: s.id, name: s.name, baseType: ["meet", "buffer", "backfill", "manual"][i], builtin: true }));
}
function strategyObj(config, id) {
  return strategyList(config).find((s) => s.id === id) || null;
}
function resolveStrategyName(config, id) {
  const s = strategyObj(config, id);
  return s ? s.name : id;
}
var isSchedule = (s) => !!s && s.baseType === "schedule";
var strategyBlurb = (s) => s && s.blurb || s && BASE_BLURB[s.baseType] || "";
function scheduleSummary(config, strat) {
  if (!isSchedule(strat) || !(strat.segments || []).length) return "";
  const segs = [...strat.segments].sort((a, b) => (a.fromWeek || 1) - (b.fromWeek || 1));
  return segs.map((seg, i) => {
    const nm = resolveStrategyName(config, seg.strategyId);
    return i === 0 ? nm : `${nm} from wk ${seg.fromWeek}`;
  }).join(" \u2192 ");
}
var viewName = (config, viewId) => {
  const v = config.views.find((x) => x.id === viewId);
  return v ? v.name : viewId;
};
var CHANNEL_ORDER = [
  { key: "voice", label: "Voice" },
  { key: "digital", label: "Digital" },
  { key: "support", label: "Support" }
];
var channelOfQueue = (q) => q.channel || (q.type === "voice" ? "voice" : "digital");
function hierarchy(config) {
  const brands = config.brands && config.brands.length ? config.brands : [{ id: "__none", name: "Unbranded" }];
  return brands.map((b) => {
    const qs = config.queues.filter((q) => (q.brandId || "__none") === b.id);
    const channels = CHANNEL_ORDER.map((c) => ({ ...c, queues: qs.filter((q) => channelOfQueue(q) === c.key) })).filter((c) => c.queues.length);
    return { brand: b, queues: qs, channels };
  }).filter((row) => row.queues.length);
}
function orderedQueues(config) {
  return hierarchy(config).flatMap((row) => row.channels.flatMap((c) => c.queues));
}
var groupList = (config) => config && config.groups || [];
var groupName = (config, groupId) => {
  const g = groupList(config).find((x) => x.id === groupId);
  return g ? g.name : groupId;
};
function groupScenarioIds(config, groupId) {
  const g = groupList(config).find((x) => x.id === groupId) || groupList(config)[0];
  if (g && Array.isArray(g.scenarioIds)) return g.scenarioIds.filter((id) => config.scenarios.some((s) => s.id === id));
  return config.scenarios.filter((s) => s.enabled).map((s) => s.id);
}
function strategyStats(sim) {
  if (!sim) return null;
  const cfg = sim.config;
  let redWeeks = 0, amberWeeks = 0;
  for (const w of sim.weeks) {
    const sts = cfg.queues.map((q) => w.queues[q.id].status);
    if (sts.includes("red")) redWeeks++;
    else if (sts.includes("amber")) amberWeeks++;
  }
  const endHC = sim.weeks.length ? sim.weeks[sim.weeks.length - 1].totals.paid : 0;
  const flags = sim.summary.flags;
  const feasible = !flags.capInfeasible && !flags.tippingPoint && redWeeks === 0;
  return {
    redWeeks,
    amberWeeks,
    endHC,
    runCost: sim.summary.totalCost,
    churn: sim.summary.churnCost,
    allIn: sim.summary.allIn,
    flags,
    feasible
  };
}
function recommendStrategy(statsById) {
  const entries = Object.entries(statsById).filter(([, s]) => s);
  if (!entries.length) return null;
  const holding = entries.filter(([, s]) => s.feasible);
  const pool = holding.length ? holding : entries;
  return pool.reduce((best, cur) => cur[1].allIn < best[1].allIn ? cur : best)[0];
}

// ui/sim-set.js
var now = () => typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
var CACHE_MAX = 128;
var BUDGET = 8;
var keyFor = (hash, sid, gid) => hash + "|" + sid + "|" + gid;
function simHash(config) {
  const { settings, channelDefs, ...rest } = config;
  let s = settings;
  if (settings && (settings.risk || settings.dataColours)) {
    s = { ...settings };
    delete s.risk;
    delete s.dataColours;
  }
  return JSON.stringify({ ...rest, settings: s });
}
function useStrategySims(config, activeStrategyId, activeGroupId, delay = 160) {
  const hash = useMemo(() => simHash(config), [config]);
  const cacheRef = useRef(/* @__PURE__ */ new Map());
  const stratIds = useMemo(() => {
    const all = strategyList(config).map((s) => s.id);
    const ordered = [activeStrategyId, ...all.filter((id) => id !== activeStrategyId)].filter((v, i, a) => a.indexOf(v) === i);
    return ordered.slice(0, BUDGET);
  }, [hash, activeStrategyId]);
  const runInto = (missing) => {
    const scoped = (0, import_engine.applyGroupScope)(config, activeGroupId);
    for (const m of missing) cacheRef.current.set(m.k, (0, import_engine.simulate)(scoped, { strategy: m.sid, viewIds: groupScenarioIds(config, activeGroupId) }));
    while (cacheRef.current.size > CACHE_MAX) cacheRef.current.delete(cacheRef.current.keys().next().value);
  };
  const needed = useMemo(
    () => stratIds.map((sid) => ({ k: keyFor(hash, sid, activeGroupId), sid })),
    [hash, activeGroupId, stratIds.join(",")]
  );
  const buildSnapshot = () => {
    const sims = {};
    for (const sid of stratIds) sims[sid] = cacheRef.current.get(keyFor(hash, sid, activeGroupId));
    return { sims, activeSim: sims[activeStrategyId], stratIds, hash };
  };
  const [snap, setSnap] = useState(() => {
    runInto(needed.filter((x) => !cacheRef.current.has(x.k)));
    return { ...buildSnapshot(), computeMs: 0, computeCount: 0 };
  });
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const missing = needed.filter((x) => !cacheRef.current.has(x.k));
    if (missing.length === 0) {
      setPending(false);
      setSnap({ ...buildSnapshot(), computeMs: 0, computeCount: 0 });
      return;
    }
    if (cacheRef.current.has(keyFor(hash, activeStrategyId, activeGroupId))) {
      setSnap({ ...buildSnapshot(), computeMs: 0, computeCount: 0 });
    }
    setPending(true);
    const id = setTimeout(() => {
      const t0 = now();
      runInto(missing);
      setSnap({ ...buildSnapshot(), computeMs: now() - t0, computeCount: missing.length });
      setPending(false);
    }, delay);
    return () => clearTimeout(id);
  }, [hash, activeStrategyId, activeGroupId, stratIds.join(",")]);
  return { ...snap, pending };
}
function runMatrix(config) {
  const groups = config.groups || [];
  const strategies = strategyList(config);
  const cells = {};
  for (const g of groups) {
    const ids = groupScenarioIds(config, g.id);
    const scoped = (0, import_engine.applyGroupScope)(config, g.id);
    cells[g.id] = {};
    for (const s of strategies) {
      const sim = (0, import_engine.simulate)(scoped, { strategy: s.id, viewIds: ids });
      let redWeeks = 0;
      for (const w of sim.weeks) if (config.queues.some((q) => w.queues[q.id].status === "red")) redWeeks++;
      const flags = sim.summary.flags;
      const status = flags.capInfeasible || flags.tippingPoint || redWeeks > 0 ? redWeeks > sim.weeks.length * 0.1 || flags.tippingPoint ? "red" : "amber" : "green";
      cells[g.id][s.id] = { allIn: sim.summary.allIn, redWeeks, tipping: !!flags.tippingPoint, capInfeasible: !!flags.capInfeasible, status };
    }
  }
  return { hash: simHash(config), cells };
}

// ui/config-ops.js
import { useMemo as useMemo2, useCallback } from "react";

// ui/format.js
var RAG = {
  green: "#1f9d55",
  amber: "#d98a0b",
  red: "#d63b3b",
  greenSoft: "#e6f4ec",
  amberSoft: "#fbf0dc",
  redSoft: "#f9e3e3"
};
function money(cur, n) {
  const v = Math.round(n || 0);
  const abs = Math.abs(v);
  if (abs >= 1e6) return cur + (v / 1e6).toFixed(v % 1e6 === 0 ? 0 : 1) + "m";
  if (abs >= 1e3) return cur + (v / 1e3).toFixed(abs >= 1e4 ? 0 : 1) + "k";
  return cur + v.toLocaleString();
}
var moneyFull = (cur, n) => cur + Math.round(n || 0).toLocaleString();
var pct = (v, dp = 0) => v == null || Number.isNaN(v) ? "\u2013" : (v * 100).toFixed(dp) + "%";
var num = (v, dp = 0) => v == null || Number.isNaN(v) ? "\u2013" : (+v).toFixed(dp);
var secs = (v) => v == null || Number.isNaN(v) ? "\u2013" : Math.round(v) + "s";
var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function intervalLabel(i, eng) {
  const mins = eng.dayStart * 60 + i * eng.intervalMin;
  const h = Math.floor(mins / 60), m = mins % 60;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}
function setPath(obj, path, value) {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  const clone2 = Array.isArray(obj) ? obj.slice() : { ...obj };
  clone2[head] = setPath(obj ? obj[head] : void 0, rest, value);
  return clone2;
}

// ui/config-ops.js
var import_engine2 = __toESM(require_engine());
var clone = (o) => JSON.parse(JSON.stringify(o));
var blankQueue = (n) => ({
  id: "q_" + (0, import_engine2.uid)(),
  name: "New queue " + n,
  type: "voice",
  dailyVolume: 500,
  aht: 300,
  profile: new Array(24).fill(1),
  asaTarget: 30,
  maxAbandon: 0.05,
  patience: 90,
  shrinkage: 0.3,
  fte: 10,
  agentCost: 32e3,
  agentCostMonthly: 32e3 / 12,
  resourcing: "resourced",
  supports: [],
  crossSkill: [],
  weeklyVolumes: null,
  seasonal: null,
  concurrency: 1,
  digitalSlaMinutes: 5,
  digitalSlaPct: 0.8,
  backlogLimit: 100,
  deflectsTo: null,
  // §24.1 knock-on (two figures), §24.2 sharing, §24.5 subtype, §24.10 SLA target.
  knock: { repeatPct: 0, convertPct: 0, convertTarget: null },
  sharing: null,
  subtype: "customer",
  workflowSlaHours: 24,
  workflowSlaPct: 0.9,
  slaAttainmentTarget: 0.9,
  wf: { attrition: 0.04, attritionGrowth: 0, reqToStart: 6, trainingWeeks: 4, learningCurve: [0.6, 0.75, 0.9, 1], hires: [] },
  burn: { occThreshold: 0.85, sensitivity: 1.5, recovery: 8, maxAttritionMult: 2, absenceUplift: 0.05 }
});
var SCENARIO_DEFAULTS = {
  growth: { name: "Growth", p: { rate: 0.02, stopWeek: null } },
  launch: { name: "Product launch", p: { ramp: 3, peak: 0.4, decay: 6 } },
  p1: { name: "P1 incident", p: { spike: 1.5, days: 2 } },
  forecastError: { name: "Forecast error", p: { error: 0.15 } },
  attritionShock: { name: "Attrition shock", p: { add: 0.03 } },
  hiringFreeze: { name: "Hiring freeze", p: { weeks: 12 } },
  reducedTraining: { name: "Reduced training", p: { cutWeeks: 2, startProficiency: 0.4, stretch: 1.75, ahtPenalty: 0.12, repeatUplift: 0.08 } },
  growthManual: { name: "Manual weekly growth", p: { weeklyPct: {} } },
  freezeManual: { name: "Manual freeze", p: { weeks: [] } }
};
var STRATEGY_DEFAULTS = {
  meet: { name: "Custom meet", baseType: "meet" },
  buffer: { name: "Custom buffer", baseType: "buffer", bufferPct: 0.1 },
  backfill: { name: "Custom backfill", baseType: "backfill" },
  manual: { name: "Custom manual", baseType: "manual" },
  schedule: { name: "Custom schedule", baseType: "schedule", segments: [{ fromWeek: 1, strategyId: "S1" }] }
};
var blankChannel = () => ({ knockOn: { repeatPct: null, spillPct: null, spillTargetQueue: null } });
var defaultChannels = () => ({ voice: blankChannel(), digital: blankChannel(), support: blankChannel() });
var CHANNEL_PRESETS = {
  voice: { label: "Voice (Erlang)", kind: "voice", group: "voice", template: { type: "voice", subtype: null, asaTarget: 30, maxAbandon: 0.05, patience: 90 } },
  digitalCustomer: { label: "Digital Customer (live)", kind: "digitalCustomer", group: "digital", template: { type: "digital", subtype: "customer", concurrency: 2.5, digitalSlaMinutes: 5, digitalSlaPct: 0.8 } },
  digitalWorkflow: { label: "Digital Workflow (backlog)", kind: "digitalWorkflow", group: "digital", template: { type: "digital", subtype: "workflow", workflowSlaHours: 24, workflowSlaPct: 0.9 } },
  serviceWorkflow: { label: "Service Workflow (support)", kind: "serviceWorkflow", group: "support", template: { type: "digital", subtype: "workflow", workflowSlaHours: 120, workflowSlaPct: 0.95, slaUnit: "days" } }
};
var CHANNEL_PRESET_LIST = Object.entries(CHANNEL_PRESETS).map(([k, v]) => ({ value: k, label: v.label }));
var defaultChannelDefs = () => [
  { id: "ch_voice", name: "Voice", kind: "voice", group: "voice", builtin: true, template: JSON.parse(JSON.stringify(CHANNEL_PRESETS.voice.template)) },
  { id: "ch_digcust", name: "Digital Customer", kind: "digitalCustomer", group: "digital", builtin: true, template: JSON.parse(JSON.stringify(CHANNEL_PRESETS.digitalCustomer.template)) },
  { id: "ch_digwf", name: "Digital Workflow", kind: "digitalWorkflow", group: "digital", builtin: true, template: JSON.parse(JSON.stringify(CHANNEL_PRESETS.digitalWorkflow.template)) },
  { id: "ch_svcwf", name: "Service Workflow", kind: "serviceWorkflow", group: "support", builtin: true, template: JSON.parse(JSON.stringify(CHANNEL_PRESETS.serviceWorkflow.template)) }
];
function migrateConfig(config) {
  const map = (0, import_engine2.effectiveSupports)(config);
  const brands = config.brands && config.brands.length ? config.brands : config.queues && config.queues.length ? [{ id: "b1", name: "Brand 1", training: null, dailyVolume: null, weeklyVolumes: null }] : [];
  const brandId = (brands[0] || {}).id;
  const queues = config.queues.map((q, i) => ({
    ...q,
    brandId: q.brandId || brandId,
    channel: q.channel || (q.type === "voice" ? "voice" : "digital"),
    priority: q.priority != null ? q.priority : i + 1,
    resourcing: q.resourcing === "supported" ? "unmanned" : !q.resourcing || q.resourcing === "resourced" ? "dedicated" : q.resourcing,
    overrides: { seasonality: Array.isArray(q.seasonal), knockOn: q.repeatPct != null || q.spillPct != null, ...q.overrides || {} },
    supports: (map[q.id] || []).map((s) => ({ queueId: s.queueId, priority: s.priority, maxSharePct: s.maxSharePct == null ? 100 : s.maxSharePct })),
    crossSkill: []
  }));
  const out = { ...config, queues, brands };
  out.pools = Array.isArray(config.pools) ? config.pools : [];
  out.channels = config.channels || defaultChannels();
  out.channelDefs = Array.isArray(config.channelDefs) && config.channelDefs.length ? config.channelDefs : defaultChannelDefs();
  if (!Array.isArray(out.groups) || !out.groups.length) {
    const fromViews = (config.views || []).map((v) => ({ id: v.id.replace(/^v_/, "g_"), name: v.name, builtin: !!v.builtin, scenarioIds: Array.isArray(v.scenarioIds) ? [...v.scenarioIds] : void 0 }));
    out.groups = fromViews.length ? fromViews : [{ id: "g_por", name: "Plan of record", builtin: true }, { id: "g_none", name: "No scenarios", builtin: true, scenarioIds: [] }];
  }
  out.settings = mergeSettings(clone(import_engine2.R2_DEFAULTS), config.settings || {});
  if (!Array.isArray(out.strategies) || !out.strategies.length) {
    out.strategies = [
      { id: "S1", name: "Meet requirement", baseType: "meet", builtin: true },
      { id: "S2", name: "Buffer above", baseType: "buffer", builtin: true },
      { id: "S3", name: "Forward backfill", baseType: "backfill", builtin: true },
      { id: "S4", name: "Manual plan", baseType: "manual", builtin: true }
    ];
  }
  if (out.engine.globalStartingHC === void 0) out.engine = { ...out.engine, globalStartingHC: null };
  if (out.engine.horizonWeeks == null) out.engine = { ...out.engine, horizonWeeks: 52 };
  return migrateR3(out);
}
function migrateR3(cfg) {
  const shareOf = {};
  for (const pool of cfg.pools || []) {
    for (const m of pool.members || []) {
      const others = (pool.members || []).filter((x) => x.queueId !== m.queueId).map((x) => x.queueId);
      const pctv = m.sharePct != null ? m.sharePct : 100;
      const cur = shareOf[m.queueId];
      if (!cur) shareOf[m.queueId] = { sharePct: pctv, sharesWith: [...others] };
      else {
        cur.sharePct = Math.max(cur.sharePct, pctv);
        for (const id of others) if (!cur.sharesWith.includes(id)) cur.sharesWith.push(id);
      }
    }
  }
  const queues = cfg.queues.map((q) => {
    const kn = q.knock ? null : (0, import_engine2.resolveKnockOn)(cfg, q);
    const primary = (0, import_engine2.primaryVoiceQueue)(cfg, q.brandId);
    const knock = q.knock || {
      repeatPct: kn.repeatPct,
      convertPct: kn.spillPct,
      convertTarget: kn.spillTargetQueue != null ? kn.spillTargetQueue : kn.spillPct > 0 ? null : primary && primary.id !== q.id ? primary.id : null
    };
    const subtype = q.type === "digital" ? q.subtype || "customer" : q.subtype;
    const channelId = q.channelId || (q.channel === "support" ? "ch_svcwf" : q.type === "voice" || q.channel === "voice" ? "ch_voice" : subtype === "workflow" ? "ch_digwf" : "ch_digcust");
    return {
      ...q,
      knock,
      repeatPct: knock.repeatPct,
      spillPct: knock.convertPct,
      spillTargetQueue: knock.convertTarget,
      sharing: q.sharing !== void 0 ? q.sharing : shareOf[q.id] || null,
      subtype,
      channelId,
      workflowSlaHours: q.workflowSlaHours != null ? q.workflowSlaHours : 24,
      workflowSlaPct: q.workflowSlaPct != null ? q.workflowSlaPct : 0.9,
      agentCostMonthly: q.agentCostMonthly != null ? q.agentCostMonthly : q.agentCost != null ? q.agentCost / 12 : null,
      slaAttainmentTarget: q.slaAttainmentTarget != null ? q.slaAttainmentTarget : 0.9
    };
  });
  const out = { ...cfg, queues, pools: [] };
  out.strategies = (cfg.strategies || []).map((s) => s.baseType === "backfill" && s.forwardMonths == null ? { ...s, forwardMonths: 3 } : s);
  out.hiring = {
    ...cfg.hiring,
    caps: cfg.hiring.caps || { segments: {}, brands: {}, total: cfg.hiring.cap != null ? cfg.hiring.cap : null }
  };
  out.costs = {
    ...cfg.costs,
    managerCostMonthly: cfg.costs.managerCostMonthly != null ? cfg.costs.managerCostMonthly : cfg.costs.managerCost != null ? cfg.costs.managerCost / 12 : null
  };
  if (!out.settings.calendar) out.settings = { ...out.settings, calendar: { weekOneDate: null } };
  return out;
}
function resolvePresets(cfg, seasPresets, arrPresets) {
  const seas = cfg.seasonality || {};
  let system = seas.system;
  if (seas.systemPresetId) {
    const p = (seasPresets || []).find((x) => x.id === seas.systemPresetId);
    if (p && Array.isArray(p.months)) system = p.months;
  }
  const queues = cfg.queues.map((q) => {
    let nq = q;
    if (q.seasonalPresetId && q.overrides && q.overrides.seasonality) {
      const p = (seasPresets || []).find((x) => x.id === q.seasonalPresetId);
      if (p && Array.isArray(p.months)) nq = { ...nq, seasonal: p.months };
    }
    if (q.arrivalPresetId) {
      const p = (arrPresets || []).find((x) => x.id === q.arrivalPresetId);
      if (p && Array.isArray(p.curve)) nq = { ...nq, profile: p.curve };
    }
    return nq;
  });
  return { ...cfg, seasonality: { ...seas, system }, queues };
}
function mergeSettings(base, over) {
  if (over == null) return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const k of Object.keys(over)) {
    const b = base ? base[k] : void 0, o = over[k];
    out[k] = o != null && typeof o === "object" && !Array.isArray(o) && b != null && typeof b === "object" && !Array.isArray(b) ? mergeSettings(b, o) : o === void 0 ? b : o;
  }
  return out;
}
function useConfigOps(setConfig) {
  const patch = useCallback((path, value) => setConfig((c) => setPath(c, path, value)), [setConfig]);
  const patchQueue = useCallback((qid, path, value) => {
    setConfig((c) => {
      const idx = c.queues.findIndex((q) => q.id === qid);
      if (idx < 0) return c;
      const nextQueues = c.queues.slice();
      nextQueues[idx] = setPath(nextQueues[idx], path, value);
      return { ...c, queues: nextQueues };
    });
  }, [setConfig]);
  const addQueue = useCallback(() => {
    setConfig((c) => {
      const q = blankQueue(c.queues.length + 1);
      q.brandId = c.brands && c.brands[0] && c.brands[0].id || "b1";
      q.channel = "voice";
      q.priority = c.queues.reduce((m, x) => Math.max(m, x.priority || 0), 0) + 1;
      q.resourcing = "dedicated";
      q.overrides = { seasonality: false, knockOn: false };
      return { ...c, queues: [...c.queues, q] };
    });
  }, [setConfig]);
  const duplicateQueue = useCallback((qid) => {
    setConfig((c) => {
      const src = c.queues.find((q) => q.id === qid);
      if (!src) return c;
      const copy = JSON.parse(JSON.stringify(src));
      copy.id = "q_" + (0, import_engine2.uid)();
      copy.name = src.name + " (copy)";
      const idx = c.queues.findIndex((q) => q.id === qid);
      const nextQueues = c.queues.slice();
      nextQueues.splice(idx + 1, 0, copy);
      return { ...c, queues: nextQueues };
    });
  }, [setConfig]);
  const deleteQueue = useCallback((qid) => {
    setConfig((c) => ({
      ...c,
      queues: c.queues.filter((q) => q.id !== qid).map((q) => ({
        ...q,
        crossSkill: (q.crossSkill || []).filter((id) => id !== qid),
        deflectsTo: q.deflectsTo === qid ? null : q.deflectsTo
      })),
      serviceTeams: c.serviceTeams.map((t) => ({ ...t, coversQueues: (t.coversQueues || []).filter((id) => id !== qid) })),
      scenarios: c.scenarios.map((s) => Array.isArray(s.queueIds) ? { ...s, queueIds: s.queueIds.filter((id) => id !== qid) } : s)
    }));
  }, [setConfig]);
  const addHire = useCallback((qid) => {
    setConfig((c) => {
      const idx = c.queues.findIndex((q) => q.id === qid);
      if (idx < 0) return c;
      const nextQueues = c.queues.slice();
      const wf = nextQueues[idx].wf;
      nextQueues[idx] = { ...nextQueues[idx], wf: { ...wf, hires: [...wf.hires || [], { week: 0, heads: 1 }] } };
      return { ...c, queues: nextQueues };
    });
  }, [setConfig]);
  const patchHire = useCallback((qid, hireIdx, key, value) => {
    setConfig((c) => {
      const idx = c.queues.findIndex((q) => q.id === qid);
      if (idx < 0) return c;
      const nextQueues = c.queues.slice();
      const wf = nextQueues[idx].wf;
      const hires = wf.hires.slice();
      hires[hireIdx] = { ...hires[hireIdx], [key]: value };
      nextQueues[idx] = { ...nextQueues[idx], wf: { ...wf, hires } };
      return { ...c, queues: nextQueues };
    });
  }, [setConfig]);
  const deleteHire = useCallback((qid, hireIdx) => {
    setConfig((c) => {
      const idx = c.queues.findIndex((q) => q.id === qid);
      if (idx < 0) return c;
      const nextQueues = c.queues.slice();
      const wf = nextQueues[idx].wf;
      nextQueues[idx] = { ...nextQueues[idx], wf: { ...wf, hires: wf.hires.filter((_, i) => i !== hireIdx) } };
      return { ...c, queues: nextQueues };
    });
  }, [setConfig]);
  const addServiceTeam = useCallback(() => {
    setConfig((c) => ({
      ...c,
      serviceTeams: [...c.serviceTeams, {
        id: "st_" + (0, import_engine2.uid)(),
        name: "Flex pool " + (c.serviceTeams.length + 1),
        size: 8,
        premiumPct: 0.2,
        proficiency: 0.8,
        triggerOccupancy: 0.9,
        maxHoursPerWeek: 20,
        agentCost: 32e3,
        coversQueues: []
      }]
    }));
  }, [setConfig]);
  const patchServiceTeam = useCallback((idx, path, value) => {
    setConfig((c) => {
      const next = c.serviceTeams.slice();
      next[idx] = setPath(next[idx], path, value);
      return { ...c, serviceTeams: next };
    });
  }, [setConfig]);
  const deleteServiceTeam = useCallback((tid) => {
    setConfig((c) => ({ ...c, serviceTeams: c.serviceTeams.filter((t) => t.id !== tid) }));
  }, [setConfig]);
  const addScenario = useCallback((type) => {
    setConfig((c) => {
      const d = SCENARIO_DEFAULTS[type];
      if (!d) return c;
      const s = { id: "sc_" + (0, import_engine2.uid)(), type, name: d.name, enabled: true, startWeek: 0, queueIds: "all", p: { ...d.p } };
      return { ...c, scenarios: [...c.scenarios, s] };
    });
  }, [setConfig]);
  const patchScenario = useCallback((idx, path, value) => {
    setConfig((c) => {
      const next = c.scenarios.slice();
      next[idx] = setPath(next[idx], path, value);
      return { ...c, scenarios: next };
    });
  }, [setConfig]);
  const deleteScenario = useCallback((sid) => {
    setConfig((c) => ({
      ...c,
      scenarios: c.scenarios.filter((s) => s.id !== sid),
      // keep saved views coherent when a scenario disappears
      views: c.views.map((v) => Array.isArray(v.scenarioIds) ? { ...v, scenarioIds: v.scenarioIds.filter((id) => id !== sid) } : v)
    }));
  }, [setConfig]);
  const addView = useCallback((name, scenarioIds) => {
    const id = "v_" + (0, import_engine2.uid)();
    setConfig((c) => ({ ...c, views: [...c.views, { id, name: name || "New view", builtin: false, scenarioIds: [...scenarioIds || []] }] }));
    return id;
  }, [setConfig]);
  const renameView = useCallback((vid, name) => {
    setConfig((c) => ({ ...c, views: c.views.map((v) => v.id === vid ? { ...v, name } : v) }));
  }, [setConfig]);
  const toggleViewScenario = useCallback((vid, sid, on) => {
    setConfig((c) => ({
      ...c,
      views: c.views.map((v) => {
        if (v.id !== vid || !Array.isArray(v.scenarioIds)) return v;
        const has = v.scenarioIds.includes(sid);
        if (on && !has) return { ...v, scenarioIds: [...v.scenarioIds, sid] };
        if (!on && has) return { ...v, scenarioIds: v.scenarioIds.filter((x) => x !== sid) };
        return v;
      })
    }));
  }, [setConfig]);
  const deleteView = useCallback((vid) => {
    setConfig((c) => ({ ...c, views: c.views.filter((v) => v.id !== vid || v.builtin) }));
  }, [setConfig]);
  const setResourcing = useCallback((qid, mode) => {
    setConfig((c) => ({ ...c, queues: c.queues.map((q) => q.id === qid ? { ...q, resourcing: mode } : q) }));
  }, [setConfig]);
  const addSupport = useCallback((qid, targetId) => {
    setConfig((c) => ({
      ...c,
      queues: c.queues.map((q) => {
        if (q.id !== qid) return q;
        const supports = q.supports || [];
        if (!targetId || supports.some((s) => s.queueId === targetId)) return q;
        const nextPri = supports.reduce((m, s) => Math.max(m, s.priority || 1), 0) + 1;
        return { ...q, supports: [...supports, { queueId: targetId, priority: nextPri, maxSharePct: 100 }] };
      })
    }));
  }, [setConfig]);
  const patchSupport = useCallback((qid, idx, key, value) => {
    setConfig((c) => ({
      ...c,
      queues: c.queues.map((q) => {
        if (q.id !== qid) return q;
        const supports = q.supports.slice();
        supports[idx] = { ...supports[idx], [key]: value };
        return { ...q, supports };
      })
    }));
  }, [setConfig]);
  const deleteSupport = useCallback((qid, idx) => {
    setConfig((c) => ({ ...c, queues: c.queues.map((q) => q.id === qid ? { ...q, supports: q.supports.filter((_, i) => i !== idx) } : q) }));
  }, [setConfig]);
  const addStrategy = useCallback((baseType) => {
    const d = STRATEGY_DEFAULTS[baseType];
    if (!d) return;
    const id = "str_" + (0, import_engine2.uid)();
    setConfig((c) => ({ ...c, strategies: [...c.strategies || [], { id, ...d, name: d.name, segments: d.segments ? d.segments.map((s) => ({ ...s })) : void 0 }] }));
    return id;
  }, [setConfig]);
  const duplicateStrategy = useCallback((sid) => {
    setConfig((c) => {
      const src = (c.strategies || []).find((s) => s.id === sid);
      if (!src) return c;
      const copy = JSON.parse(JSON.stringify(src));
      copy.id = "str_" + (0, import_engine2.uid)();
      copy.name = src.name + " (copy)";
      copy.builtin = false;
      const idx = c.strategies.findIndex((s) => s.id === sid);
      const next = c.strategies.slice();
      next.splice(idx + 1, 0, copy);
      return { ...c, strategies: next };
    });
  }, [setConfig]);
  const deleteStrategy = useCallback((sid) => {
    setConfig((c) => ({ ...c, strategies: (c.strategies || []).filter((s) => s.id !== sid || s.builtin) }));
  }, [setConfig]);
  const patchStrategy = useCallback((sid, path, value) => {
    setConfig((c) => ({ ...c, strategies: (c.strategies || []).map((s) => s.id === sid ? setPath(s, path, value) : s) }));
  }, [setConfig]);
  const addSegment = useCallback((sid) => {
    setConfig((c) => ({
      ...c,
      strategies: (c.strategies || []).map((s) => {
        if (s.id !== sid) return s;
        const segs = s.segments || [];
        const nextWeek = segs.reduce((m, x) => Math.max(m, x.fromWeek || 1), 0) + 5;
        return { ...s, segments: [...segs, { fromWeek: nextWeek, strategyId: "S1" }] };
      })
    }));
  }, [setConfig]);
  const patchSegment = useCallback((sid, idx, key, value) => {
    setConfig((c) => ({
      ...c,
      strategies: (c.strategies || []).map((s) => {
        if (s.id !== sid) return s;
        const segs = s.segments.slice();
        segs[idx] = { ...segs[idx], [key]: value };
        return { ...s, segments: segs };
      })
    }));
  }, [setConfig]);
  const deleteSegment = useCallback((sid, idx) => {
    setConfig((c) => ({ ...c, strategies: (c.strategies || []).map((s) => s.id === sid ? { ...s, segments: s.segments.filter((_, i) => i !== idx) } : s) }));
  }, [setConfig]);
  const saveScheduleAsStrategy = useCallback((name, segments) => {
    const id = "str_" + (0, import_engine2.uid)();
    setConfig((c) => ({ ...c, strategies: [...c.strategies || [], { id, name: name || "Saved schedule", baseType: "schedule", segments: segments.map((s) => ({ ...s })) }] }));
    return id;
  }, [setConfig]);
  const addGroup = useCallback((name, scenarioIds) => {
    const id = "g_" + (0, import_engine2.uid)();
    setConfig((c) => ({ ...c, groups: [...c.groups || [], { id, name: name || "New group", builtin: false, scenarioIds: [...scenarioIds || []] }] }));
    return id;
  }, [setConfig]);
  const renameGroup = useCallback((gid, name) => setConfig((c) => ({ ...c, groups: (c.groups || []).map((g) => g.id === gid ? { ...g, name } : g) })), [setConfig]);
  const deleteGroup = useCallback((gid) => setConfig((c) => ({ ...c, groups: (c.groups || []).filter((g) => g.id !== gid || g.builtin) })), [setConfig]);
  const toggleGroupScenario = useCallback((gid, sid, on) => {
    setConfig((c) => ({
      ...c,
      groups: (c.groups || []).map((g) => {
        if (g.id !== gid || !Array.isArray(g.scenarioIds)) return g;
        const has = g.scenarioIds.includes(sid);
        if (on && !has) return { ...g, scenarioIds: [...g.scenarioIds, sid] };
        if (!on && has) return { ...g, scenarioIds: g.scenarioIds.filter((x) => x !== sid) };
        return g;
      })
    }));
  }, [setConfig]);
  const addBrand = useCallback((name) => {
    const id = "b_" + (0, import_engine2.uid)();
    setConfig((c) => ({ ...c, brands: [...c.brands || [], { id, name: name || "New brand", training: null, dailyVolume: null, weeklyVolumes: null }] }));
    return id;
  }, [setConfig]);
  const patchBrand = useCallback((bid, path, value) => setConfig((c) => ({ ...c, brands: (c.brands || []).map((b) => b.id === bid ? setPath(b, path, value) : b) })), [setConfig]);
  const deleteBrand = useCallback((bid) => setConfig((c) => {
    if ((c.brands || []).length <= 1) return c;
    const fallback = (c.brands.find((b) => b.id !== bid) || {}).id;
    return { ...c, brands: c.brands.filter((b) => b.id !== bid), queues: c.queues.map((q) => q.brandId === bid ? { ...q, brandId: fallback } : q) };
  }), [setConfig]);
  const setQueueBrand = useCallback((qid, bid) => setConfig((c) => ({ ...c, queues: c.queues.map((q) => q.id === qid ? { ...q, brandId: bid } : q) })), [setConfig]);
  const toggleBrandTraining = useCallback((bid, on) => setConfig((c) => ({
    ...c,
    brands: (c.brands || []).map((b) => b.id === bid ? { ...b, training: on ? b.training || { trainingWeeks: 4, learningCurve: [0.6, 0.75, 0.9, 1], trainingShrinkagePct: 0.05 } : null } : b)
  })), [setConfig]);
  const addPool = useCallback((name) => {
    const id = "pool_" + (0, import_engine2.uid)();
    setConfig((c) => ({ ...c, pools: [...c.pools || [], { id, name: name || "New pool", members: [] }] }));
    return id;
  }, [setConfig]);
  const renamePool = useCallback((pid, name) => setConfig((c) => ({ ...c, pools: (c.pools || []).map((p) => p.id === pid ? { ...p, name } : p) })), [setConfig]);
  const deletePool = useCallback((pid) => setConfig((c) => ({ ...c, pools: (c.pools || []).filter((p) => p.id !== pid) })), [setConfig]);
  const setPoolMember = useCallback((pid, qid, on) => setConfig((c) => ({
    ...c,
    pools: (c.pools || []).map((p) => {
      if (p.id !== pid) return p;
      const has = (p.members || []).some((m) => m.queueId === qid);
      if (on && !has) return { ...p, members: [...p.members || [], { queueId: qid, sharePct: 100 }] };
      if (!on && has) return { ...p, members: p.members.filter((m) => m.queueId !== qid) };
      return p;
    })
  })), [setConfig]);
  const patchPoolMember = useCallback((pid, qid, sharePct) => setConfig((c) => ({
    ...c,
    pools: (c.pools || []).map((p) => p.id === pid ? { ...p, members: (p.members || []).map((m) => m.queueId === qid ? { ...m, sharePct } : m) } : p)
  })), [setConfig]);
  const patchChannel = useCallback((ch, path, value) => setConfig((c) => ({ ...c, channels: setPath(c.channels || { voice: {}, digital: {}, support: {} }, [ch, ...path], value) })), [setConfig]);
  const addChannel = useCallback((name, presetKind) => {
    const preset = CHANNEL_PRESETS[presetKind] || CHANNEL_PRESETS.voice;
    const id = "ch_" + (0, import_engine2.uid)();
    setConfig((c) => ({ ...c, channelDefs: [...c.channelDefs || [], { id, name: name || preset.label, kind: preset.kind, group: preset.group, builtin: false, template: JSON.parse(JSON.stringify(preset.template)) }] }));
    return id;
  }, [setConfig]);
  const patchChannelDef = useCallback((id, path, value) => setConfig((c) => ({ ...c, channelDefs: (c.channelDefs || []).map((d) => d.id === id ? setPath(d, path, value) : d) })), [setConfig]);
  const deleteChannelDef = useCallback((id) => setConfig((c) => ({
    ...c,
    channelDefs: (c.channelDefs || []).filter((d) => d.id !== id),
    queues: c.queues.map((q) => q.channelId === id ? { ...q, channelId: null } : q)
  })), [setConfig]);
  const attachQueueChannel = useCallback((qid, defId) => setConfig((c) => {
    const def = (c.channelDefs || []).find((d) => d.id === defId);
    if (!def) return c;
    const t = def.template || {};
    return {
      ...c,
      queues: c.queues.map((q) => {
        if (q.id !== qid) return q;
        const nq = { ...q, channelId: def.id, channel: def.group, type: t.type || q.type };
        if (t.subtype !== void 0) nq.subtype = t.subtype;
        ["asaTarget", "maxAbandon", "patience", "concurrency", "digitalSlaMinutes", "digitalSlaPct", "workflowSlaHours", "workflowSlaPct"].forEach((k) => {
          if (t[k] != null) nq[k] = t[k];
        });
        return nq;
      })
    };
  }), [setConfig]);
  const setOverride = useCallback((qid, section, on) => setConfig((c) => ({
    ...c,
    queues: c.queues.map((q) => q.id === qid ? { ...q, overrides: { ...q.overrides || {}, [section]: on } } : q)
  })), [setConfig]);
  const addUnifiedScenario = useCallback(() => {
    const s = { id: "sc_" + (0, import_engine2.uid)(), type: "unified", name: "New scenario", enabled: true, tag: "custom", parameter: "volume", mechanism: "step", granularity: "week", startWeek: 0, stopWeek: null, scope: "all", queueIds: "all", p: { value: 0.1 } };
    setConfig((c) => ({ ...c, scenarios: [...c.scenarios, s] }));
    return s.id;
  }, [setConfig]);
  const setSharing = useCallback((qid, on) => setConfig((c) => ({
    ...c,
    queues: c.queues.map((q) => q.id === qid ? { ...q, sharing: on ? q.sharing || { sharePct: 100, sharesWith: [] } : null } : q)
  })), [setConfig]);
  const patchSharing = useCallback((qid, key, value) => setConfig((c) => ({
    ...c,
    queues: c.queues.map((q) => q.id === qid ? { ...q, sharing: { ...q.sharing || { sharePct: 100, sharesWith: [] }, [key]: value } } : q)
  })), [setConfig]);
  const toggleSharesWith = useCallback((qid, targetId, on) => setConfig((c) => ({
    ...c,
    queues: c.queues.map((q) => {
      if (q.id !== qid) return q;
      const sh = q.sharing || { sharePct: 100, sharesWith: [] };
      const list = sh.sharesWith || [];
      const has = list.includes(targetId);
      const next = on && !has ? [...list, targetId] : !on && has ? list.filter((x) => x !== targetId) : list;
      return { ...q, sharing: { ...sh, sharesWith: next } };
    })
  })), [setConfig]);
  const patchKnock = useCallback((qid, key, value) => setConfig((c) => ({
    ...c,
    queues: c.queues.map((q) => {
      if (q.id !== qid) return q;
      const knock = { ...q.knock || { repeatPct: 0, convertPct: 0, convertTarget: null }, [key]: value };
      return { ...q, knock, repeatPct: knock.repeatPct, spillPct: knock.convertPct, spillTargetQueue: knock.convertTarget };
    })
  })), [setConfig]);
  const patchCapSegment = useCallback((brandId, channel, value) => setConfig((c) => {
    const caps = c.hiring.caps || { segments: {}, brands: {}, total: c.hiring.cap };
    const segments = { ...caps.segments || {} };
    const k = brandId + "|" + channel;
    if (value == null || value === "") delete segments[k];
    else segments[k] = value;
    return { ...c, hiring: { ...c.hiring, caps: { ...caps, segments } } };
  }), [setConfig]);
  const patchCapBrand = useCallback((brandId, value) => setConfig((c) => {
    const caps = c.hiring.caps || { segments: {}, brands: {}, total: c.hiring.cap };
    const brands = { ...caps.brands || {} };
    if (value == null || value === "") delete brands[brandId];
    else brands[brandId] = value;
    return { ...c, hiring: { ...c.hiring, caps: { ...caps, brands } } };
  }), [setConfig]);
  const patchCapTotal = useCallback((value) => setConfig((c) => {
    const caps = c.hiring.caps || { segments: {}, brands: {}, total: c.hiring.cap };
    return { ...c, hiring: { ...c.hiring, cap: value != null && value !== "" ? value : c.hiring.cap, caps: { ...caps, total: value === "" ? null : value } } };
  }), [setConfig]);
  const setWeekOneDate = useCallback((iso) => setConfig((c) => setPath(c, ["settings", "calendar", "weekOneDate"], iso || null)), [setConfig]);
  const setQueueVolume = useCallback((qid, mode, payload) => setConfig((c) => ({
    ...c,
    queues: c.queues.map((q) => {
      if (q.id !== qid) return q;
      if (mode === "single") return { ...q, dailyVolume: payload, weeklyVolumes: null };
      if (mode === "series") return { ...q, weeklyVolumes: payload, dailyVolume: null };
      if (mode === "inherit") return { ...q, dailyVolume: null, weeklyVolumes: null, volumeShare: q.volumeShare != null ? q.volumeShare : 1 };
      return q;
    })
  })), [setConfig]);
  const patchWeeklyVolume = useCallback((qid, week, value) => setConfig((c) => ({
    ...c,
    queues: c.queues.map((q) => {
      if (q.id !== qid) return q;
      let arr;
      if (Array.isArray(q.weeklyVolumes)) arr = q.weeklyVolumes.slice();
      else arr = new Array(c.engine.horizonWeeks).fill(q.dailyVolume != null ? q.dailyVolume : 0);
      arr[week] = value;
      return { ...q, weeklyVolumes: arr, dailyVolume: null };
    })
  })), [setConfig]);
  const patchGroupScope = useCallback((gid, scope) => setConfig((c) => ({
    ...c,
    groups: (c.groups || []).map((g) => g.id === gid ? { ...g, scope } : g)
  })), [setConfig]);
  const toggleGroupScopeTarget = useCallback((gid, kind, id, on) => setConfig((c) => ({
    ...c,
    groups: (c.groups || []).map((g) => {
      if (g.id !== gid) return g;
      const scope = { brandIds: [], channels: [], queueIds: [], ...g.scope || {} };
      const key = kind === "brand" ? "brandIds" : kind === "channel" ? "channels" : "queueIds";
      const list = scope[key] || [];
      scope[key] = on ? list.includes(id) ? list : [...list, id] : list.filter((x) => x !== id);
      return { ...g, scope };
    })
  })), [setConfig]);
  const addFactor = useCallback((gid) => {
    const id = "sc_" + (0, import_engine2.uid)();
    const s = { id, type: "unified", name: "New factor", enabled: true, tag: "custom", parameter: "volume", mechanism: "step", granularity: "week", startWeek: 0, stopWeek: null, scope: "all", queueIds: "all", p: { value: 0.1 } };
    setConfig((c) => ({
      ...c,
      scenarios: [...c.scenarios, s],
      groups: (c.groups || []).map((g) => g.id === gid ? { ...g, scenarioIds: [...Array.isArray(g.scenarioIds) ? g.scenarioIds : [], id] } : g)
    }));
    return id;
  }, [setConfig]);
  const setQueueSubtype = useCallback((qid, subtype) => setConfig((c) => ({
    ...c,
    queues: c.queues.map((q) => q.id === qid ? { ...q, subtype } : q)
  })), [setConfig]);
  return useMemo2(() => ({
    patch,
    patchQueue,
    addQueue,
    duplicateQueue,
    deleteQueue,
    addHire,
    patchHire,
    deleteHire,
    addServiceTeam,
    patchServiceTeam,
    deleteServiceTeam,
    addScenario,
    addUnifiedScenario,
    patchScenario,
    deleteScenario,
    addView,
    renameView,
    toggleViewScenario,
    deleteView,
    addGroup,
    renameGroup,
    deleteGroup,
    toggleGroupScenario,
    addBrand,
    patchBrand,
    deleteBrand,
    setQueueBrand,
    toggleBrandTraining,
    addPool,
    renamePool,
    deletePool,
    setPoolMember,
    patchPoolMember,
    patchChannel,
    setOverride,
    addChannel,
    patchChannelDef,
    deleteChannelDef,
    attachQueueChannel,
    setResourcing,
    addSupport,
    patchSupport,
    deleteSupport,
    addStrategy,
    duplicateStrategy,
    deleteStrategy,
    patchStrategy,
    addSegment,
    patchSegment,
    deleteSegment,
    saveScheduleAsStrategy,
    // R3 (§24)
    setSharing,
    patchSharing,
    toggleSharesWith,
    patchKnock,
    patchCapSegment,
    patchCapBrand,
    patchCapTotal,
    setWeekOneDate,
    setQueueVolume,
    patchWeeklyVolume,
    patchGroupScope,
    toggleGroupScopeTarget,
    addFactor,
    setQueueSubtype
  }), [patch, patchQueue, addQueue, duplicateQueue, deleteQueue, addHire, patchHire, deleteHire, addServiceTeam, patchServiceTeam, deleteServiceTeam, addScenario, addUnifiedScenario, patchScenario, deleteScenario, addView, renameView, toggleViewScenario, deleteView, addGroup, renameGroup, deleteGroup, toggleGroupScenario, addBrand, patchBrand, deleteBrand, setQueueBrand, toggleBrandTraining, addPool, renamePool, deletePool, setPoolMember, patchPoolMember, patchChannel, setOverride, addChannel, patchChannelDef, deleteChannelDef, attachQueueChannel, setResourcing, addSupport, patchSupport, deleteSupport, addStrategy, duplicateStrategy, deleteStrategy, patchStrategy, addSegment, patchSegment, deleteSegment, saveScheduleAsStrategy, setSharing, patchSharing, toggleSharesWith, patchKnock, patchCapSegment, patchCapBrand, patchCapTotal, setWeekOneDate, setQueueVolume, patchWeeklyVolume, patchGroupScope, toggleGroupScopeTarget, addFactor, setQueueSubtype]);
}

// ui/presets.js
var import_engine3 = __toESM(require_engine());
var dbl = [...import_engine3.DEFAULT_PROFILE];
var INTRADAY_PRESETS = [
  { id: "ip_double", name: "Double hump", builtin: true, curve: dbl },
  { id: "ip_morning", name: "Morning-heavy B2B", builtin: true, curve: [0.9, 1.25, 1.5, 1.55, 1.5, 1.35, 1.2, 1.1, 1, 0.9, 0.8, 0.75, 0.7, 0.62, 0.55, 0.48, 0.42, 0.36, 0.3, 0.26, 0.22, 0.18, 0.15, 0.12] },
  { id: "ip_evening", name: "Evening consumer", builtin: true, curve: [0.25, 0.3, 0.38, 0.46, 0.55, 0.62, 0.7, 0.78, 0.88, 0.98, 1.05, 1.1, 1.2, 1.32, 1.42, 1.5, 1.55, 1.5, 1.4, 1.25, 1.05, 0.85, 0.6, 0.4] },
  { id: "ip_lunch", name: "Lunchtime spike", builtin: true, curve: [0.5, 0.6, 0.72, 0.82, 0.9, 1, 1.25, 1.5, 1.65, 1.5, 1.2, 0.95, 0.85, 0.82, 0.8, 0.78, 0.72, 0.66, 0.6, 0.52, 0.44, 0.36, 0.28, 0.22] },
  { id: "ip_flat", name: "Flat", builtin: true, curve: new Array(24).fill(1) },
  { id: "ip_weekend", name: "Weekend-shifted", builtin: true, curve: [0.3, 0.4, 0.55, 0.7, 0.85, 0.98, 1.08, 1.15, 1.2, 1.22, 1.2, 1.15, 1.12, 1.08, 1.05, 1, 0.95, 0.88, 0.8, 0.72, 0.62, 0.52, 0.42, 0.32] }
];
var SEASONALITY_PRESETS = Object.entries(import_engine3.SEASONAL_PRESETS).map(([name, months], i) => ({
  id: "sp_" + i,
  name,
  builtin: true,
  months: [...months]
}));
var makeIntradayPreset = (name, curve) => ({ id: "ip_" + (0, import_engine3.uid)(), name, builtin: false, curve: [...curve] });
var makeSeasonalityPreset = (name, months) => ({ id: "sp_" + (0, import_engine3.uid)(), name, builtin: false, months: [...months] });

// ui/storage.js
function makeStorageAdapter() {
  if (typeof window !== "undefined" && window.storage && typeof window.storage.get === "function") {
    const s = window.storage;
    return {
      mode: "artifact",
      notice: null,
      async get(k) {
        try {
          const v = await s.get(k);
          if (v == null) return void 0;
          return typeof v === "string" ? JSON.parse(v) : v;
        } catch (e) {
          return void 0;
        }
      },
      async set(k, v) {
        await s.set(k, JSON.stringify(v));
      },
      async del(k) {
        try {
          await s.delete(k);
        } catch (e) {
        }
      },
      async list() {
        try {
          return await s.list() || [];
        } catch (e) {
          return [];
        }
      }
    };
  }
  if (typeof localStorage !== "undefined") {
    try {
      const probe = "__cap_probe__";
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      return {
        mode: "local",
        notice: null,
        async get(k) {
          const v = localStorage.getItem(k);
          return v == null ? void 0 : JSON.parse(v);
        },
        async set(k, v) {
          localStorage.setItem(k, JSON.stringify(v));
        },
        async del(k) {
          localStorage.removeItem(k);
        },
        async list() {
          return Object.keys(localStorage);
        }
      };
    } catch (e) {
    }
  }
  const mem = /* @__PURE__ */ new Map();
  return {
    mode: "memory",
    notice: "No durable storage here \u2014 your saved runs, presets and views live only in this tab. Downloads are your durable save.",
    async get(k) {
      return mem.has(k) ? JSON.parse(mem.get(k)) : void 0;
    },
    async set(k, v) {
      mem.set(k, JSON.stringify(v));
    },
    async del(k) {
      mem.delete(k);
    },
    async list() {
      return [...mem.keys()];
    }
  };
}
var slugify = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "item";
var KEYS = {
  index: "sim-index",
  run: (slug) => "sim-" + slug,
  intraday: "presets-intraday",
  seasonality: "presets-seasonality",
  views: "views"
};

// ui/saved-runs.js
var import_engine4 = __toESM(require_engine());
function makeSavedRun(name, config, sim, savedAt) {
  const slug = slugify(name);
  return {
    name: name || "Untitled run",
    slug,
    savedAt: savedAt || (/* @__PURE__ */ new Date()).toISOString(),
    strategy: sim.strategy,
    allIn: Math.round(sim.summary.allIn),
    config,
    run: (0, import_engine4.compactRun)(config, sim)
  };
}
var indexEntry = (r) => ({ slug: r.slug, name: r.name, savedAt: r.savedAt, strategy: r.strategy, allIn: r.allIn });
var runTotals = (r) => {
  const t = r.run.totals;
  return {
    cost: t.reduce((a, w) => a + w.cost, 0),
    churn: t.reduce((a, w) => a + w.churn, 0),
    waste: t.reduce((a, w) => a + w.waste, 0),
    volume: t.reduce((a, w) => a + w.volume, 0),
    allIn: t.reduce((a, w) => a + w.cost + w.churn, 0),
    endPaid: t.length ? t[t.length - 1].paid : 0
  };
};
function totalsDelta(runs) {
  if (!runs.length) return { rows: [], metrics: [] };
  const metrics = [
    { key: "cost", label: "Run cost" },
    { key: "churn", label: "Churn cost" },
    { key: "allIn", label: "All-in" },
    { key: "waste", label: "Idle pay" },
    { key: "endPaid", label: "End HC" }
  ];
  const totals = runs.map(runTotals);
  const base = totals[0];
  const rows = runs.map((r, i) => ({
    name: r.name,
    baseline: i === 0,
    values: Object.fromEntries(metrics.map((m) => [m.key, totals[i][m.key]])),
    deltas: Object.fromEntries(metrics.map((m) => [m.key, totals[i][m.key] - base[m.key]]))
  }));
  return { rows, metrics };
}
function allInOverlay(runs) {
  const len = runs.reduce((m, r) => Math.max(m, r.run.totals.length), 0);
  const data = [];
  for (let w = 0; w < len; w++) {
    const row = { wk: w + 1 };
    runs.forEach((r) => {
      let c = 0;
      for (let i = 0; i <= w && i < r.run.totals.length; i++) c += r.run.totals[i].cost + r.run.totals[i].churn;
      row[r.slug] = Math.round(c);
    });
    data.push(row);
  }
  return data;
}
function perQueueBlocks(runs) {
  const names = [];
  for (const r of runs) for (const q of r.run.queues) if (!names.includes(q.name)) names.push(q.name);
  return names.map((name) => {
    const cells = runs.map((r) => {
      const q = r.run.queues.find((x) => x.name === name);
      if (!q) return { present: false, run: r };
      const weeks = q.weeks;
      const redWeeks = weeks.filter((w) => w.st !== "green").length;
      const avgCover = weeks.reduce((a, w) => a + w.cv, 0) / Math.max(1, weeks.length);
      const worst = q.type === "voice" ? { label: "Worst ASA", value: Math.max(...weeks.map((w) => w.asa)), fmt: "s" } : { label: "Worst SL", value: Math.min(...weeks.map((w) => w.sl)), fmt: "%" };
      return {
        present: true,
        run: r,
        type: q.type,
        redWeeks,
        avgCover,
        worst,
        cost: weeks.reduce((a, w) => a + w.co, 0),
        churn: weeks.reduce((a, w) => a + w.ch, 0),
        coverSeries: weeks.map((w, i) => ({ wk: i + 1, cover: +(w.cv * 100).toFixed(1) }))
      };
    });
    return { name, cells };
  });
}

// ui/print.jsx
import { createContext, useContext, useState as useState2, useEffect as useEffect2, useCallback as useCallback2 } from "react";
import { flushSync } from "react-dom";
import { jsx } from "react/jsx-runtime";
var PrintCtx = createContext({ printing: false, printWidth: 660 });
var usePrinting = () => useContext(PrintCtx);
function PrintProvider({ children, printWidth = 660 }) {
  const [printing, setPrinting] = useState2(false);
  useEffect2(() => {
    if (typeof window === "undefined" || !window.addEventListener) return;
    const on = () => {
      try {
        flushSync(() => setPrinting(true));
      } catch (e) {
        setPrinting(true);
      }
    };
    const off = () => {
      try {
        flushSync(() => setPrinting(false));
      } catch (e) {
        setPrinting(false);
      }
    };
    window.addEventListener("beforeprint", on);
    window.addEventListener("afterprint", off);
    let mq;
    if (window.matchMedia) {
      mq = window.matchMedia("print");
      const onMq = (e) => e.matches ? on() : off();
      if (mq.addEventListener) mq.addEventListener("change", onMq);
      else if (mq.addListener) mq.addListener(onMq);
      mq._onMq = onMq;
    }
    return () => {
      window.removeEventListener("beforeprint", on);
      window.removeEventListener("afterprint", off);
      if (mq) {
        if (mq.removeEventListener) mq.removeEventListener("change", mq._onMq);
        else if (mq.removeListener) mq.removeListener(mq._onMq);
      }
    };
  }, []);
  return /* @__PURE__ */ jsx(PrintCtx.Provider, { value: { printing, printWidth }, children });
}
function usePrintPage() {
  return useCallback2(() => {
    if (typeof window !== "undefined" && window.print) window.print();
  }, []);
}
function PrintButton({ label = "Print / PDF this page", className = "btn sm", testid = "print-page" }) {
  const print = usePrintPage();
  return /* @__PURE__ */ jsx("button", { type: "button", className, "data-testid": testid, onClick: print, children: label });
}

// ui/hooks.js
var import_engine5 = __toESM(require_engine());
import { useState as useState3, useEffect as useEffect3, useRef as useRef2, useLayoutEffect, useCallback as useCallback3 } from "react";
function useMeasuredWidth(fallback = 640) {
  const ref = useRef2(null);
  const [w, setW] = useState3(fallback);
  useLayoutEffect(() => {
    const el2 = ref.current;
    if (!el2) return;
    const measure = () => {
      const bw = el2.clientWidth || el2.getBoundingClientRect && el2.getBoundingClientRect().width || 0;
      if (bw && bw > 0) setW(Math.round(bw));
    };
    measure();
    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure);
      ro.observe(el2);
    }
    window.addEventListener("resize", measure);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  return [ref, w];
}
function useDisclosure() {
  const [open, setOpen] = useState3(false);
  const ref = useRef2(null);
  useEffect3(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const toggle = useCallback3(() => setOpen((o) => !o), []);
  return { open, setOpen, toggle, ref };
}

// ui/components/ContextBar.jsx
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
function ContextBar({ config, activeStrategyId, onSetActiveStrategy, activeGroupId, onSetActiveGroup, ops, snapshots, viewingSlug, onSelectSnapshot, pending }) {
  const strat = strategyObj(config, activeStrategyId);
  const sched = isSchedule(strat) ? scheduleSummary(config, strat) : "";
  const disc = useDisclosure();
  return /* @__PURE__ */ jsxs("div", { className: "ctxbar", role: "region", "aria-label": "Plan context", children: [
    /* @__PURE__ */ jsxs("div", { className: "ctx-item ctx-strat", ref: disc.ref, children: [
      /* @__PURE__ */ jsx2("span", { className: "ctx-label", children: "Strategy" }),
      /* @__PURE__ */ jsxs("button", { type: "button", className: "ctx-chip", "aria-expanded": disc.open, onClick: disc.toggle, "data-testid": "ctx-strategy", children: [
        /* @__PURE__ */ jsx2("strong", { children: strat ? strat.name : activeStrategyId }),
        sched ? /* @__PURE__ */ jsx2("span", { className: "ctx-sub", children: sched }) : null,
        /* @__PURE__ */ jsx2("span", { className: "chev", style: { marginLeft: 4 }, children: "\u25BE" })
      ] }),
      disc.open && /* @__PURE__ */ jsxs("div", { className: "pop ctx-pop", role: "dialog", "aria-label": "Active strategy", children: [
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx2("span", { className: "lab", children: "Active strategy / schedule" }),
          /* @__PURE__ */ jsx2("select", { value: activeStrategyId, onChange: (e) => onSetActiveStrategy(e.target.value), "data-testid": "ctx-strategy-select", children: strategyList(config).map((s) => /* @__PURE__ */ jsxs("option", { value: s.id, children: [
            s.name,
            s.baseType === "schedule" ? " (schedule)" : ""
          ] }, s.id)) })
        ] }),
        isSchedule(strat) && /* @__PURE__ */ jsxs("div", { style: { marginTop: 10 }, children: [
          /* @__PURE__ */ jsx2("div", { className: "lab", style: { marginBottom: 6 }, children: "Segments" }),
          (strat.segments || []).map((seg, i) => /* @__PURE__ */ jsxs("div", { className: "rowflex", style: { marginBottom: 6 }, children: [
            /* @__PURE__ */ jsx2("span", { style: { fontSize: 11, color: "#c9d6de" }, children: "from wk" }),
            /* @__PURE__ */ jsx2(
              "input",
              {
                type: "number",
                className: "inp",
                style: { width: 64 },
                min: 1,
                value: seg.fromWeek,
                onChange: (e) => ops.patchSegment(strat.id, i, "fromWeek", Math.max(1, Number(e.target.value) || 1)),
                "data-testid": "seg-week-" + i
              }
            ),
            /* @__PURE__ */ jsx2("select", { className: "inp", style: { flex: 1 }, value: seg.strategyId, onChange: (e) => ops.patchSegment(strat.id, i, "strategyId", e.target.value), "data-testid": "seg-strat-" + i, children: strategyList(config).filter((s) => s.id !== strat.id).map((s) => /* @__PURE__ */ jsx2("option", { value: s.id, children: s.name }, s.id)) }),
            /* @__PURE__ */ jsx2("button", { type: "button", className: "btn sm danger", onClick: () => ops.deleteSegment(strat.id, i), "aria-label": "Remove segment", children: "\xD7" })
          ] }, i)),
          /* @__PURE__ */ jsx2("button", { type: "button", className: "btn sm", onClick: () => ops.addSegment(strat.id), "data-testid": "seg-add", children: "+ Segment" })
        ] }),
        /* @__PURE__ */ jsx2("p", { className: "note", style: { marginTop: 10, background: "rgba(255,255,255,.06)", borderColor: "rgba(255,255,255,.12)", color: "#c9d6de" }, children: "Build reusable schedules on the Strategies tab. The active plan drives every tab." })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "ctx-item", children: [
      /* @__PURE__ */ jsx2("span", { className: "ctx-label", children: "Scenario group" }),
      /* @__PURE__ */ jsx2("select", { className: "ctx-select", value: activeGroupId, onChange: (e) => onSetActiveGroup(e.target.value), "aria-label": "Active scenario group", "data-testid": "ctx-group", children: groupList(config).map((g) => /* @__PURE__ */ jsx2("option", { value: g.id, children: g.name }, g.id)) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "ctx-item", children: [
      /* @__PURE__ */ jsx2("span", { className: "ctx-label", children: "Snapshot" }),
      /* @__PURE__ */ jsxs("select", { className: "ctx-select", value: viewingSlug || "", onChange: (e) => onSelectSnapshot(e.target.value || null), "aria-label": "View snapshot", "data-testid": "ctx-snapshot", children: [
        /* @__PURE__ */ jsx2("option", { value: "", children: "\u2014 Live \u2014" }),
        snapshots.map((r) => /* @__PURE__ */ jsx2("option", { value: r.slug, children: r.name }, r.slug))
      ] })
    ] }),
    /* @__PURE__ */ jsx2("span", { className: "spacer" }),
    /* @__PURE__ */ jsxs("span", { className: "recalc" + (pending ? "" : " idle"), role: "status", "aria-live": "polite", style: { marginRight: 8 }, children: [
      /* @__PURE__ */ jsx2("span", { className: "dot", "aria-hidden": "true" }),
      pending ? "Recalculating\u2026" : "Up to date"
    ] }),
    /* @__PURE__ */ jsx2(PrintButton, {})
  ] });
}

// ui/components/SummaryTab.jsx
import { useState as useState4 } from "react";

// ui/components/primitives.jsx
import { Fragment, jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
function Hint({ text, label = "More information" }) {
  const { open, toggle, ref } = useDisclosure();
  return /* @__PURE__ */ jsxs2("span", { className: "hint", ref, children: [
    /* @__PURE__ */ jsx3(
      "button",
      {
        type: "button",
        "aria-label": label,
        "aria-expanded": open,
        onClick: toggle,
        children: "?"
      }
    ),
    open && /* @__PURE__ */ jsx3("span", { className: "pop", role: "tooltip", children: text })
  ] });
}
function NumField({ label, value, onChange, unit, hint, step = "any", min, max, id }) {
  return /* @__PURE__ */ jsxs2("label", { className: "field", children: [
    /* @__PURE__ */ jsxs2("span", { className: "lab", children: [
      label,
      unit ? /* @__PURE__ */ jsxs2("span", { className: "unit", children: [
        "(",
        unit,
        ")"
      ] }) : null,
      hint ? /* @__PURE__ */ jsx3(Hint, { text: hint }) : null
    ] }),
    /* @__PURE__ */ jsx3(
      "input",
      {
        type: "number",
        id,
        value: value ?? "",
        step,
        min,
        max,
        onChange: (e) => {
          const raw = e.target.value;
          onChange(raw === "" ? 0 : Number(raw));
        }
      }
    )
  ] });
}
function TextField({ label, value, onChange, hint, id }) {
  return /* @__PURE__ */ jsxs2("label", { className: "field", children: [
    /* @__PURE__ */ jsxs2("span", { className: "lab", children: [
      label,
      hint ? /* @__PURE__ */ jsx3(Hint, { text: hint }) : null
    ] }),
    /* @__PURE__ */ jsx3("input", { type: "text", id, value: value ?? "", onChange: (e) => onChange(e.target.value) })
  ] });
}
function SelectField({ label, value, onChange, options, hint, id }) {
  return /* @__PURE__ */ jsxs2("label", { className: "field", children: [
    /* @__PURE__ */ jsxs2("span", { className: "lab", children: [
      label,
      hint ? /* @__PURE__ */ jsx3(Hint, { text: hint }) : null
    ] }),
    /* @__PURE__ */ jsx3("select", { id, value: value ?? "", onChange: (e) => onChange(e.target.value), children: options.map((o) => /* @__PURE__ */ jsx3("option", { value: o.value, children: o.label }, o.value)) })
  ] });
}
function Toggle({ checked, onChange, label }) {
  return /* @__PURE__ */ jsxs2("label", { className: "switch", children: [
    /* @__PURE__ */ jsx3("input", { type: "checkbox", checked: !!checked, onChange: (e) => onChange(e.target.checked) }),
    /* @__PURE__ */ jsx3("span", { className: "track", "aria-hidden": "true" }),
    label ? /* @__PURE__ */ jsx3("span", { children: label }) : null
  ] });
}
function Card({ title, sub, right, hint, children }) {
  return /* @__PURE__ */ jsxs2("section", { className: "card", children: [
    (title || right) && /* @__PURE__ */ jsxs2("div", { className: "card-h", children: [
      title ? /* @__PURE__ */ jsx3("h3", { children: title }) : null,
      sub ? /* @__PURE__ */ jsx3("span", { className: "sub", children: sub }) : null,
      hint ? /* @__PURE__ */ jsx3(Hint, { text: hint }) : null,
      right ? /* @__PURE__ */ jsxs2(Fragment, { children: [
        /* @__PURE__ */ jsx3("span", { className: "spacer" }),
        right
      ] }) : null
    ] }),
    /* @__PURE__ */ jsx3("div", { className: "card-b", children })
  ] });
}
function Chart({ title, hint, height = 250, children }) {
  const [ref, measured] = useMeasuredWidth(620);
  const { printing, printWidth } = usePrinting();
  const w = printing ? printWidth : Math.max(280, measured - 16);
  return /* @__PURE__ */ jsxs2("div", { className: "chart" + (printing ? " printing" : ""), "data-print-w": printing ? printWidth : void 0, children: [
    /* @__PURE__ */ jsxs2("div", { className: "chart-h", children: [
      /* @__PURE__ */ jsx3("h4", { children: title }),
      hint ? /* @__PURE__ */ jsx3(Hint, { text: hint }) : null
    ] }),
    /* @__PURE__ */ jsx3("div", { className: "chart-b", ref, children: children(w, height) })
  ] });
}

// ui/components/HierTable.jsx
import { Fragment as Fragment2 } from "react";
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
function HierTable({ config, testid, columns, metric, aggregate, firstLabel = "Queue" }) {
  const rows = hierarchy(config);
  const allLeaf = [];
  const cellsFor = (m) => columns.map((c) => /* @__PURE__ */ jsx4("td", { className: c.cls ? c.cls(m) : void 0, style: c.align ? { textAlign: c.align } : void 0, children: c.fmt(m) }, c.key));
  return /* @__PURE__ */ jsx4("div", { className: "tbl-wrap", children: /* @__PURE__ */ jsxs3("table", { className: "data", "data-testid": testid, children: [
    /* @__PURE__ */ jsx4("thead", { children: /* @__PURE__ */ jsxs3("tr", { children: [
      /* @__PURE__ */ jsx4("th", { children: firstLabel }),
      columns.map((c) => /* @__PURE__ */ jsx4("th", { children: c.label }, c.key))
    ] }) }),
    /* @__PURE__ */ jsxs3("tbody", { children: [
      rows.map((row) => {
        const brandLeaf = [];
        const brandBody = row.channels.map((ch) => {
          const ms = ch.queues.map((q) => ({ q, m: metric(q) }));
          ms.forEach((x) => {
            brandLeaf.push(x.m);
            allLeaf.push(x.m);
          });
          return /* @__PURE__ */ jsxs3(Fragment2, { children: [
            ms.map(({ q, m }) => /* @__PURE__ */ jsxs3("tr", { children: [
              /* @__PURE__ */ jsxs3("td", { style: { textAlign: "left", fontWeight: 600 }, children: [
                q.name,
                q.resourcing && q.resourcing !== "dedicated" && q.resourcing !== "resourced" ? ` (${q.resourcing})` : ""
              ] }),
              cellsFor(m)
            ] }, q.id)),
            /* @__PURE__ */ jsxs3("tr", { className: "grp sub-chan", "data-testid": `hier-chan-${row.brand.id}-${ch.key}`, children: [
              /* @__PURE__ */ jsxs3("td", { style: { textAlign: "left" }, children: [
                ch.label,
                " subtotal"
              ] }),
              cellsFor(aggregate(ms.map((x) => x.m)))
            ] })
          ] }, ch.key);
        });
        return /* @__PURE__ */ jsxs3(Fragment2, { children: [
          brandBody,
          /* @__PURE__ */ jsxs3("tr", { className: "grp sub-brand", "data-testid": `hier-brand-${row.brand.id}`, children: [
            /* @__PURE__ */ jsxs3("td", { style: { textAlign: "left" }, children: [
              row.brand.name,
              " \u2014 total"
            ] }),
            cellsFor(aggregate(brandLeaf))
          ] })
        ] }, row.brand.id);
      }),
      /* @__PURE__ */ jsxs3("tr", { className: "grp total", children: [
        /* @__PURE__ */ jsx4("td", { style: { textAlign: "left" }, children: "Total" }),
        cellsFor(aggregate(allLeaf))
      ] })
    ] })
  ] }) });
}

// ui/reporting.js
var import_engine6 = __toESM(require_engine());
function buildWeeklyRows(sim, queue, config) {
  const qid = queue.id;
  const reqs = sim.weeks.map((w) => w.queues[qid].reqsRaised || 0);
  const lead = Math.max(0, Math.round(queue.wf.reqToStart));
  return sim.weeks.map((w, i) => {
    const s = w.queues[qid];
    const hiresLanding = i - lead >= 0 ? reqs[i - lead] : 0;
    return {
      week: i + 1,
      base: s.baseVolume,
      // §24.6 the genuine per-week volume INPUT (editable in the Data tab): the
      // queue's weekly series value if present, else its single daily figure.
      volInput: Array.isArray(queue.weeklyVolumes) && queue.weeklyVolumes[i] != null ? queue.weeklyVolumes[i] : queue.dailyVolume != null ? queue.dailyVolume : null,
      seasonalMult: (0, import_engine6.seasonalMult)(i, config, queue),
      deflected: s.deflected || 0,
      redial: s.redial || 0,
      volume: s.volume,
      cover: s.cover,
      asa: s.asa,
      respMin: s.respMin,
      sl: s.sl,
      abandon: s.abandon,
      occ: s.occ,
      backlog: s.backlog || 0,
      burnout: s.burnout,
      leavers: s.leavers || 0,
      attrInEffect: s.attrInEffect || 0,
      reqsRaised: s.reqsRaised || 0,
      hiresLanding,
      training: s.training,
      ramping: s.ramp,
      trained: s.trained,
      active: s.active != null ? s.active : s.trained + s.ramp,
      startingHC: s.startingHC != null ? s.startingHC : 0,
      paid: s.paid,
      reqFte: s.reqFte,
      cost: s.cost,
      churnCost: s.churnCost,
      customersLost: s.churnCustomers,
      status: s.status,
      // §16/§17/§20a R2 audit + supply-ladder fields.
      otHours: s.otHours || 0,
      otCost: s.otCost || 0,
      reclaimedHours: s.reclaimedHours || 0,
      trainingDebt: s.trainingDebt || 0,
      trainShrink: s.trainShrinkInEffect || 0,
      recycledIn: s.recycledIn || 0,
      poolIn: s.poolIn || 0,
      leveragedIn: s.leveragedIn || 0,
      borrowedShare: s.borrowedSharePct || 0,
      ahtInEffect: s.ahtInEffect != null ? s.ahtInEffect : queue.aht,
      slaInEffect: s.slaInEffect != null ? s.slaInEffect : queue.type === "voice" ? queue.asaTarget : queue.digitalSlaMinutes,
      scenarioTags: (s.scenarioTags || []).join(", ")
    };
  });
}
function assumptionsColumns(queue, cur = "\xA3") {
  return [
    { key: "week", label: "Week", fmt: (v) => String(v) },
    { key: "volume", label: "Volume", fmt: (v) => num(v, 0) },
    { key: "ahtInEffect", label: "Blended AHT (s)", fmt: (v) => num(v, 0) },
    { key: "slaInEffect", label: "SLA in effect", fmt: (v) => num(v, queue.type === "voice" ? 0 : 1) },
    { key: "attrInEffect", label: "Attrition %", fmt: (v) => pct(v, 1) },
    { key: "trainShrink", label: "Train shrink %", fmt: (v) => pct(v, 1) },
    { key: "trainingDebt", label: "Training debt", fmt: (v) => num(v, 0) },
    { key: "scenarioTags", label: "Active scenarios", fmt: (v) => v || "\u2014" }
  ];
}
function queueSummaryMetric(sim, q) {
  const series = sim.weeks.map((w) => w.queues[q.id]);
  const last = series[series.length - 1] || {};
  return {
    volume: series.reduce((a, s) => a + s.volume, 0),
    required: last.reqFte || 0,
    active: last.active != null ? last.active : (last.trained || 0) + (last.ramp || 0),
    coverSum: series.reduce((a, s) => a + s.cover, 0),
    coverN: Math.max(1, series.length),
    weeksRed: series.filter((s) => s.status === "red").length,
    churn: series.reduce((a, s) => a + s.churnCost, 0)
  };
}
function sumQueueSummary(list) {
  return list.reduce((t, m) => ({
    volume: t.volume + m.volume,
    required: t.required + m.required,
    active: t.active + m.active,
    coverSum: t.coverSum + m.coverSum,
    coverN: t.coverN + m.coverN,
    weeksRed: t.weeksRed + m.weeksRed,
    churn: t.churn + m.churn
  }), { volume: 0, required: 0, active: 0, coverSum: 0, coverN: 0, weeksRed: 0, churn: 0 });
}
function columnsFor(queue, cur = "\xA3") {
  const P0 = (v) => pct(v, 0);
  const P1 = (v) => pct(v, 1);
  const N0 = (v) => num(v, 0);
  const N1 = (v) => num(v, 1);
  const M = (v) => money(cur, v);
  const service = queue.type === "voice" ? [
    { key: "cover", label: "Coverage", group: "Service", fmt: P0 },
    { key: "asa", label: "ASA (s)", group: "Service", fmt: (v) => secs(v) },
    { key: "sl", label: "SL", group: "Service", fmt: P0 },
    { key: "abandon", label: "Abandon", group: "Service", fmt: P1 },
    { key: "occ", label: "Occupancy", group: "Service", fmt: P0 }
  ] : [
    { key: "cover", label: "Coverage", group: "Service", fmt: P0 },
    { key: "respMin", label: "Response (m)", group: "Service", fmt: N1 },
    { key: "sl", label: "In SLA", group: "Service", fmt: P0 },
    { key: "backlog", label: "Backlog", group: "Service", fmt: N0 },
    { key: "occ", label: "Occupancy", group: "Service", fmt: P0 }
  ];
  return [
    { key: "week", label: "Week", group: "Week", fmt: (v) => String(v) },
    { key: "base", label: "Base vol", group: "Demand", fmt: N0 },
    // Editable input column (§24.6): writes back to the queue's weekly series.
    { key: "volInput", label: "Vol input", group: "Demand", fmt: N0, input: "volume" },
    { key: "seasonalMult", label: "Seasonal \xD7", group: "Demand", fmt: (v) => v.toFixed(2) },
    { key: "deflected", label: "Deflected", group: "Demand", fmt: N0 },
    { key: "redial", label: "Redial", group: "Demand", fmt: N0 },
    { key: "volume", label: "Total vol", group: "Demand", fmt: N0 },
    ...service,
    { key: "startingHC", label: "Starting HC", group: "People", fmt: N1 },
    { key: "burnout", label: "Burnout", group: "People", fmt: N0 },
    { key: "leavers", label: "Attrition #", group: "People", fmt: N1 },
    { key: "attrInEffect", label: "Attrition %", group: "People", fmt: P1 },
    { key: "reqsRaised", label: "Reqs raised", group: "People", fmt: N1 },
    { key: "hiresLanding", label: "Hires start", group: "People", fmt: N1 },
    { key: "training", label: "In training", group: "People", fmt: N1 },
    { key: "ramping", label: "Ramping", group: "People", fmt: N1 },
    { key: "trained", label: "Trained", group: "People", fmt: N1 },
    { key: "active", label: "Active FTE", group: "People", fmt: N1 },
    { key: "reqFte", label: "Req FTE", group: "People", fmt: N1 },
    { key: "otHours", label: "OT hours", group: "Supply", fmt: N1 },
    { key: "trainShrink", label: "Train shrink", group: "Supply", fmt: (v) => pct(v, 1) },
    { key: "trainingDebt", label: "Training debt", group: "Supply", fmt: N0 },
    { key: "recycledIn", label: "Recycled in", group: "Supply", fmt: N0 },
    { key: "poolIn", label: "Pool in", group: "Supply", fmt: N0 },
    { key: "leveragedIn", label: "Leveraged in", group: "Supply", fmt: N0 },
    { key: "borrowedShare", label: "Borrowed %", group: "Supply", fmt: P0 },
    { key: "cost", label: "Run cost", group: "Money", fmt: M },
    { key: "otCost", label: "OT cost", group: "Money", fmt: M },
    { key: "churnCost", label: "Churn cost", group: "Money", fmt: M },
    { key: "customersLost", label: "Cust. lost", group: "Money", fmt: N0 },
    { key: "status", label: "Status", group: "Status", fmt: (v) => v }
  ];
}
var COLUMN_GROUPS = ["Week", "Demand", "Service", "People", "Supply", "Money", "Status"];
function buildVerdict(strategySims, activeStrategyId, activeViewId, config) {
  const statsById = {};
  for (const s of STRATEGIES) if (strategySims[s.id]) statsById[s.id] = strategyStats(strategySims[s.id]);
  const recommended = recommendStrategy(statsById);
  const active = strategySims[activeStrategyId];
  const cur = config.engine.currency;
  let green = 0, amber = 0, red = 0;
  if (active) {
    for (const w of active.weeks) for (const q of config.queues) {
      const st = w.queues[q.id].status;
      if (st === "green") green++;
      else if (st === "amber") amber++;
      else red++;
    }
  }
  const recStats = recommended ? statsById[recommended] : null;
  const others = Object.entries(statsById).filter(([id]) => id !== recommended);
  const cheapestOther = others.length ? others.reduce((a, b) => a[1].allIn < b[1].allIn ? a : b) : null;
  const holds = recStats && recStats.feasible;
  const paragraph = recommended ? `Across ${active.weeks.length} weeks and ${config.queues.length} queues under the ${viewName(config, activeViewId)} view, ${green} queue-weeks meet SLA, ${amber} are at risk and ${red} breach. The recommended strategy is ${recommended} (${strategyName(recommended)}) \u2014 ${holds ? "the lowest all-in cost that holds SLA" : "the least-bad option; no strategy holds SLA everywhere"} at ${moneyFull(cur, recStats.allIn)} all-in` + (cheapestOther ? `, versus ${moneyFull(cur, cheapestOther[1].allIn)} for the next-best ${cheapestOther[0]}.` : ".") : "No simulations are available yet.";
  return { statsById, recommended, active: activeStrategyId, rag: { green, amber, red }, paragraph, holds };
}
function buildAudienceBlocks(sim, config) {
  const cur = config.engine.currency;
  const weeks = sim.weeks;
  const sm = sim.summary;
  const totalVolume = weeks.reduce((a, w) => a + w.totals.volume, 0);
  const totalCost = sm.totalCost;
  const churn = sm.churnCost;
  const idle = sm.waste;
  let breakEven = null;
  for (let i = 1; i < weeks.length; i++) {
    const a = weeks[i - 1].totals.waste - weeks[i - 1].totals.churnCost;
    const b = weeks[i].totals.waste - weeks[i].totals.churnCost;
    if (a === 0 || a < 0 !== b < 0) {
      breakEven = i + 1;
      break;
    }
  }
  const leaversWk = weeks.map((w) => config.queues.reduce((a, q) => a + w.queues[q.id].leavers, 0));
  const avgLeavers = leaversWk.reduce((a, v) => a + v, 0) / Math.max(1, leaversWk.length);
  const peakBurn = Math.max(0, ...config.queues.map((q) => Math.max(...weeks.map((w) => w.queues[q.id].burnout))));
  const avgTraining = weeks.reduce((a, w) => a + w.totals.inTraining, 0) / Math.max(1, weeks.length);
  const totalReqs = weeks.reduce((a, w) => a + config.queues.reduce((s, q) => s + (w.queues[q.id].reqsRaised || 0), 0), 0);
  const perQueueSla = config.queues.map((q) => {
    const greenWeeks = weeks.filter((w) => w.queues[q.id].status === "green").length;
    return { name: q.name, attainment: greenWeeks / Math.max(1, weeks.length) };
  });
  const totalDeflected = weeks.reduce((a, w) => a + config.queues.reduce((s, q) => s + (w.queues[q.id].deflected || 0), 0), 0);
  const p1Enabled = config.scenarios.some((s) => s.type === "p1" && (sim.viewIds || []).includes(s.id));
  return {
    finance: {
      runCost: totalCost,
      churn,
      idle,
      allIn: sm.allIn,
      costPerContact: totalVolume > 0 ? totalCost / totalVolume : 0,
      breakEven
    },
    hr: {
      totalReqs,
      cap: config.hiring.cap,
      avgLeavers,
      tippingMargin: config.hiring.cap - avgLeavers,
      peakBurn,
      avgTraining,
      tippingPoint: sm.flags.tippingPoint
    },
    business: {
      perQueueSla,
      customersLost: sm.lost,
      totalDeflected,
      p1Enabled,
      capInfeasible: sm.flags.capInfeasible
    }
  };
}
function buildRiskRegister(sim, config) {
  const cur = config.engine.currency;
  const weeks = sim.weeks;
  const R = config.settings && config.settings.risk || {};
  const th = {
    burnout: R.burnout || { amber: 60, red: 85 },
    trainingDebt: R.trainingDebt || { amber: 40, red: 70 },
    otStreakWeeks: R.otStreakWeeks || { amber: 4, red: 8 },
    borrowedShare: R.borrowedShare || { amber: 0.25, red: 0.5 },
    unmanned: R.unmannedStarvation || { floorCover: 0.5, weeks: 4 },
    overCap: R.overCapacityPct || { amber: 0.1, red: 0.2 }
  };
  const risks = [];
  const push = (r) => risks.push(r);
  const binding = (sim.allocTrace || []).filter((t) => t.binding);
  if (binding.length) {
    const first = binding[0];
    const shortNames = Object.keys(first.denied).map((id) => (config.queues.find((q) => q.id === id) || {}).name || id);
    let projChurn = 0;
    for (const t of binding) for (const id of Object.keys(t.denied)) {
      const q = config.queues.find((x) => x.id === id);
      const lead = q ? q.wf.reqToStart + q.wf.trainingWeeks + q.wf.learningCurve.length : 8;
      for (let w = t.week; w < Math.min(t.week + lead, weeks.length); w++) projChurn += weeks[w].queues[id].churnCost;
    }
    push({
      risk: "Hiring cap infeasible",
      driver: `Plan wants more than +${config.hiring.cap}/wk; ${shortNames.join(", ")} go short`,
      week: first.week + 1,
      severityValue: projChurn,
      severityMoney: projChurn,
      sla: `${binding.length} cap-bound wk`,
      lever: "Raise the global cap or hire earlier"
    });
  }
  if (sim.summary.flags.tippingPoint) {
    push({
      risk: "Attrition tipping point",
      driver: "Weekly leavers exceed hiring throughput",
      week: null,
      severityValue: Infinity,
      severityMoney: null,
      sla: "Headcount cannot recover",
      lever: "Cut attrition/burnout or raise the cap"
    });
  }
  for (const q of config.queues) {
    const series = weeks.map((w) => w.queues[q.id]);
    const firstBreach = series.findIndex((s) => s.status === "red");
    const redWeeks = series.filter((s) => s.status !== "green").length;
    const qChurn = series.reduce((a, s) => a + s.churnCost, 0);
    if (firstBreach >= 0) {
      const lead = q.wf.reqToStart + q.wf.trainingWeeks + q.wf.learningCurve.length;
      push({
        risk: `${q.name} breaches SLA`,
        driver: firstBreach < lead ? "Breach lands inside the hire-to-productive lead" : "Demand outruns supply",
        week: firstBreach + 1,
        severityValue: qChurn,
        severityMoney: qChurn,
        sla: `${redWeeks} wk not green`,
        lever: firstBreach < lead ? "Cover with flex, service teams or deferral" : "Hire earlier / raise cap"
      });
    }
    const peakBurn = Math.max(...series.map((s) => s.burnout));
    if (peakBurn >= th.burnout.amber) {
      const wk = series.findIndex((s) => s.burnout === peakBurn);
      push({
        risk: `${q.name} burnout peak`,
        driver: `Occupancy over threshold lifts attrition (peak ${Math.round(peakBurn)}/100)`,
        week: wk + 1,
        severityValue: peakBurn * 1e3,
        severityMoney: null,
        sla: `${Math.round(peakBurn)}/100`,
        lever: "Add heads or ease occupancy",
        band: peakBurn >= th.burnout.red ? "red" : "amber"
      });
    }
    const peakOtStreak = Math.max(0, ...series.map((s) => s.otStreakWeeks || 0));
    if (peakOtStreak >= th.otStreakWeeks.amber) {
      const wk = series.findIndex((s) => (s.otStreakWeeks || 0) === peakOtStreak);
      const otCost = series.reduce((a, s) => a + (s.otCost || 0), 0);
      push({
        risk: `${q.name} sustained overtime`,
        driver: `OT used ${peakOtStreak} consecutive weeks`,
        week: wk + 1,
        severityValue: otCost,
        severityMoney: otCost,
        sla: `${peakOtStreak} wk streak`,
        lever: "Hire \u2014 OT is masking a structural shortfall",
        band: peakOtStreak >= th.otStreakWeeks.red ? "red" : "amber"
      });
    }
    const peakDebt = Math.max(0, ...series.map((s) => s.trainingDebt || 0));
    if (peakDebt >= th.trainingDebt.amber) {
      const wk = series.findIndex((s) => (s.trainingDebt || 0) === peakDebt);
      push({
        risk: `${q.name} training debt`,
        driver: `Reclaimed training accrues debt (peak ${Math.round(peakDebt)}/100 \u2014 AHT + attrition drift up)`,
        week: wk + 1,
        severityValue: peakDebt * 1500,
        severityMoney: null,
        sla: `${Math.round(peakDebt)}/100`,
        lever: "Restore training hours to let debt decay",
        band: peakDebt >= th.trainingDebt.red ? "red" : "amber"
      });
    }
    const peakBorrow = Math.max(0, ...series.map((s) => s.borrowedSharePct || 0));
    if (peakBorrow > th.borrowedShare.amber) {
      const wk = series.findIndex((s) => (s.borrowedSharePct || 0) === peakBorrow);
      push({
        risk: `${q.name} borrowed-capacity dependence`,
        driver: `Meets ${Math.round(peakBorrow * 100)}% of requirement from pools / leverage / recycling`,
        week: wk + 1,
        severityValue: peakBorrow * 5e3,
        severityMoney: null,
        sla: `${Math.round(peakBorrow * 100)}% borrowed`,
        lever: "Resource this queue directly to reduce fragility",
        band: peakBorrow > th.borrowedShare.red ? "red" : "amber"
      });
    }
    if (q.resourcing === "unmanned" || q.resourcing === "supported") {
      const starved = series.filter((s) => s.cover < th.unmanned.floorCover).length;
      if (starved >= th.unmanned.weeks) {
        const wk = series.findIndex((s) => s.cover < th.unmanned.floorCover);
        push({
          risk: `${q.name} unmanned starvation`,
          driver: `Below ${Math.round(th.unmanned.floorCover * 100)}% cover for ${starved} weeks with no own staff`,
          week: wk + 1,
          severityValue: starved * 4e3 + qChurn,
          severityMoney: qChurn,
          sla: `${starved} wk starved`,
          lever: "Add a supporter/pool donor or give it dedicated HC",
          band: "red"
        });
      }
    }
    const last = series[series.length - 1];
    if (last.paid > last.reqFte * (1 + th.overCap.amber) && last.reqFte > 0) {
      const excess = last.paid - last.reqFte;
      const perWeek = last.paid * (q.wf.attrition / 4.345);
      const wks = perWeek > 0 ? Math.ceil(excess / perWeek) : 999;
      const carry = excess * q.agentCost / 52 * (wks / 2);
      push({
        risk: `${q.name} over capacity`,
        driver: `${excess.toFixed(0)} FTE above requirement at horizon end`,
        week: weeks.length,
        severityValue: carry,
        severityMoney: carry,
        sla: `~${wks} wk to clear under a freeze`,
        lever: "Freeze hiring; let attrition rebalance"
      });
    }
    if (q.type === "digital") {
      const totalDefl = series.reduce((a, s) => a + (s.deflected || 0), 0);
      if (totalDefl > q.dailyVolume) {
        push({
          risk: `${q.name} deflection spiral`,
          driver: `${Math.round(totalDefl).toLocaleString()} contacts deflected to voice`,
          week: series.findIndex((s) => (s.deflected || 0) > 0) + 1,
          severityValue: totalDefl * 10,
          severityMoney: null,
          sla: `${Math.round(totalDefl).toLocaleString()} deflected`,
          lever: "Add digital capacity or raise the backlog limit"
        });
      }
    }
  }
  risks.sort((a, b) => b.severityValue - a.severityValue || (a.week || 999) - (b.week || 999));
  return risks;
}

// ui/components/SummaryTab.jsx
import { jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
var Stat = ({ l, v, sub }) => /* @__PURE__ */ jsxs4("div", { className: "stat", children: [
  /* @__PURE__ */ jsx5("div", { className: "l", children: l }),
  /* @__PURE__ */ jsxs4("div", { className: "v", children: [
    v,
    sub ? /* @__PURE__ */ jsxs4("small", { children: [
      " ",
      sub
    ] }) : null
  ] })
] });
function DecisionMatrix({ config, matrix, matrixStale, onRunMatrix, onSelectCell, activeGroupId, activeStrategy }) {
  const cur = config.engine.currency;
  const groups = groupList(config);
  const strategies = strategyList(config);
  return /* @__PURE__ */ jsxs4(Card, { title: "Decision matrix", sub: "groups \xD7 strategies", hint: "Every scenario group against every hiring strategy. Rows and columns stay in definition order. Click a cell to make that pair the live context across all tabs.", children: [
    matrixStale && /* @__PURE__ */ jsxs4("div", { className: "mx-stale", "data-testid": "matrix-stale", children: [
      /* @__PURE__ */ jsx5("span", { children: matrix ? "Config changed \u2014 the matrix is stale." : "Matrix not yet computed." }),
      /* @__PURE__ */ jsx5("button", { type: "button", className: "btn sm primary", onClick: onRunMatrix, "data-testid": "run-matrix", children: "Run matrix" })
    ] }),
    !matrixStale && /* @__PURE__ */ jsxs4("div", { className: "btnbar", style: { marginBottom: 8 }, children: [
      /* @__PURE__ */ jsx5("button", { type: "button", className: "btn sm", onClick: onRunMatrix, "data-testid": "run-matrix", children: "Re-run matrix" }),
      /* @__PURE__ */ jsx5("span", { className: "note", style: { padding: "6px 10px" }, children: "Cached. Click any cell to select the (group \xD7 strategy) context." })
    ] }),
    /* @__PURE__ */ jsx5("div", { className: "tbl-wrap", children: /* @__PURE__ */ jsxs4("table", { className: "matrix", "data-testid": "decision-matrix", children: [
      /* @__PURE__ */ jsx5("thead", { children: /* @__PURE__ */ jsxs4("tr", { children: [
        /* @__PURE__ */ jsx5("th", { className: "row-h" }),
        strategies.map((s) => /* @__PURE__ */ jsx5("th", { "data-testid": "mx-col-" + s.id, children: s.name }, s.id))
      ] }) }),
      /* @__PURE__ */ jsx5("tbody", { children: groups.map((g) => /* @__PURE__ */ jsxs4("tr", { children: [
        /* @__PURE__ */ jsx5("th", { className: "row-h", "data-testid": "mx-row-" + g.id, children: g.name }),
        strategies.map((s) => {
          const cell = matrix && matrix.cells[g.id] && matrix.cells[g.id][s.id];
          const sel = g.id === activeGroupId && s.id === activeStrategy;
          const flags = cell ? [cell.redWeeks ? `${cell.redWeeks} red` : null, cell.tipping ? "\u26A0 tip" : null, cell.capInfeasible ? "\u26A0 cap" : null].filter(Boolean).join(" \xB7 ") : "";
          return /* @__PURE__ */ jsx5("td", { style: { padding: 0 }, children: /* @__PURE__ */ jsxs4(
            "button",
            {
              type: "button",
              className: "mx-cell " + (cell ? cell.status : "") + (sel ? " sel" : ""),
              onClick: () => onSelectCell(g.id, s.id),
              "data-testid": "mx-" + g.id + "-" + s.id,
              "aria-pressed": sel,
              children: [
                /* @__PURE__ */ jsx5("div", { className: "mx-all", children: cell ? money(cur, cell.allIn) : "\u2014" }),
                /* @__PURE__ */ jsx5("div", { className: "mx-flags", children: cell ? flags || "holds" : "not run" })
              ]
            }
          ) }, s.id);
        })
      ] }, g.id)) })
    ] }) })
  ] });
}
function QueueSummaryTable({ sim, config }) {
  const cur = config.engine.currency;
  const columns = [
    { key: "volume", label: "Volume", fmt: (m) => num(m.volume, 0) },
    { key: "required", label: "Required", fmt: (m) => num(m.required, 1) },
    { key: "active", label: "Active", fmt: (m) => num(m.active, 1) },
    { key: "cover", label: "Coverage", fmt: (m) => pct(m.coverN ? m.coverSum / m.coverN : 0) },
    { key: "weeksRed", label: "Weeks red", fmt: (m) => num(m.weeksRed, 0), cls: (m) => m.weeksRed ? "st-red" : "st-green" },
    { key: "churn", label: "Churn \xA3", fmt: (m) => money(cur, m.churn) }
  ];
  return /* @__PURE__ */ jsx5(HierTable, { config, testid: "queue-summary", columns, metric: (q) => queueSummaryMetric(sim, q), aggregate: sumQueueSummary });
}
function SummaryTab({ sim, sims, stratIds, config, activeStrategy, activeGroupId, onSetActive, matrix, matrixStale, onRunMatrix, onSelectCell }) {
  const cur = config.engine.currency;
  const verdict = buildVerdict(sims, activeStrategy, activeGroupId, config);
  const blocks = buildAudienceBlocks(sim, config);
  const risks = buildRiskRegister(sim, config);
  const [sort, setSort] = useState4({ key: "severityValue", dir: -1 });
  const f = blocks.finance, hr = blocks.hr, bz = blocks.business;
  const sortedRisks = [...risks].sort((a, b) => {
    const dir = sort.dir;
    if (sort.key === "week") return dir * ((a.week || 999) - (b.week || 999));
    if (sort.key === "risk") return dir * a.risk.localeCompare(b.risk);
    return dir * ((a.severityValue || 0) - (b.severityValue || 0));
  });
  const setSortKey = (key) => setSort((s) => ({ key, dir: s.key === key ? -s.dir : key === "risk" ? 1 : -1 }));
  const arrow = (key) => sort.key === key ? sort.dir < 0 ? " \u2193" : " \u2191" : "";
  return /* @__PURE__ */ jsxs4("div", { className: "grid summary-print", style: { gap: 16 }, "data-testid": "summary-panel", children: [
    /* @__PURE__ */ jsx5("div", { className: "btnbar", children: /* @__PURE__ */ jsxs4("span", { className: "note", style: { padding: "6px 10px" }, children: [
      "Leadership one-pager \u2014 ",
      resolveStrategyName(config, activeStrategy),
      " \xB7 group ",
      groupName(config, activeGroupId),
      ". Print or save to PDF from the context bar above."
    ] }) }),
    /* @__PURE__ */ jsx5(DecisionMatrix, { config, matrix, matrixStale, onRunMatrix, onSelectCell, activeGroupId, activeStrategy }),
    /* @__PURE__ */ jsxs4(Card, { title: "Verdict & key findings", children: [
      /* @__PURE__ */ jsx5("p", { style: { margin: "0 0 12px", fontSize: 14, lineHeight: 1.55 }, children: verdict.paragraph }),
      /* @__PURE__ */ jsxs4("div", { className: "findings", children: [
        sim.summary.findings.map((fd, i) => /* @__PURE__ */ jsxs4("div", { className: "finding " + fd.tone, children: [
          /* @__PURE__ */ jsx5("span", { className: "pip" }),
          /* @__PURE__ */ jsx5("span", { children: fd.text })
        ] }, i)),
        sim.summary.findings.length === 0 && /* @__PURE__ */ jsx5("div", { className: "empty", children: "The plan holds across the horizon." })
      ] })
    ] }),
    /* @__PURE__ */ jsx5(Card, { title: "Queue summary", sub: "under the active strategy", hint: "Brand \u2192 Voice / Digital / Support \u2192 queue, with channel and brand subtotal rows.", children: /* @__PURE__ */ jsx5(QueueSummaryTable, { sim, config }) }),
    /* @__PURE__ */ jsxs4("div", { className: "grid cols-2", children: [
      /* @__PURE__ */ jsx5(Card, { title: "Finance", children: /* @__PURE__ */ jsxs4("div", { className: "stat-row", style: { flexDirection: "column", gap: 12 }, children: [
        /* @__PURE__ */ jsx5(Stat, { l: "Run cost", v: money(cur, f.runCost) }),
        /* @__PURE__ */ jsx5(Stat, { l: "OT cost", v: money(cur, sim.weeks.reduce((a, w) => a + (w.totals.otCost || 0), 0)) }),
        /* @__PURE__ */ jsx5(Stat, { l: "Churn cost", v: money(cur, f.churn) }),
        /* @__PURE__ */ jsx5(Stat, { l: "Idle pay", v: money(cur, f.idle) }),
        /* @__PURE__ */ jsx5(Stat, { l: "All-in", v: money(cur, f.allIn) }),
        /* @__PURE__ */ jsx5(Stat, { l: "Cost / contact", v: moneyFull(cur, f.costPerContact) }),
        /* @__PURE__ */ jsx5(Stat, { l: "Break-even week", v: f.breakEven ?? "\u2013" })
      ] }) }),
      /* @__PURE__ */ jsx5(Card, { title: "HR", children: /* @__PURE__ */ jsxs4("div", { className: "stat-row", style: { flexDirection: "column", gap: 12 }, children: [
        /* @__PURE__ */ jsx5(Stat, { l: "Total reqs raised", v: num(hr.totalReqs, 0) }),
        /* @__PURE__ */ jsx5(Stat, { l: "Global cap", v: hr.cap, sub: "/wk" }),
        /* @__PURE__ */ jsx5(Stat, { l: "Avg leavers", v: num(hr.avgLeavers, 1), sub: "/wk" }),
        /* @__PURE__ */ jsx5(Stat, { l: "Tipping margin", v: num(hr.tippingMargin, 1), sub: hr.tippingPoint ? "\xB7 tipped" : "/wk" }),
        /* @__PURE__ */ jsx5(Stat, { l: "Peak burnout", v: num(hr.peakBurn, 0) + "/100" }),
        /* @__PURE__ */ jsx5(Stat, { l: "Peak training debt", v: num(Math.max(0, ...config.queues.map((q) => Math.max(0, ...sim.weeks.map((w) => w.queues[q.id].trainingDebt || 0)))), 0) + "/100" })
      ] }) }),
      /* @__PURE__ */ jsxs4(Card, { title: "Business", hint: "Per-queue SLA target vs simulated attainment, RAG'd (\xA724.10), plus incident readiness.", children: [
        /* @__PURE__ */ jsx5(Stat, { l: "Cap infeasible", v: bz.capInfeasible ? "yes" : "no" }),
        /* @__PURE__ */ jsx5("div", { className: "tbl-wrap", style: { marginTop: 10 }, children: /* @__PURE__ */ jsxs4("table", { className: "data", "data-testid": "business-box", children: [
          /* @__PURE__ */ jsx5("thead", { children: /* @__PURE__ */ jsxs4("tr", { children: [
            /* @__PURE__ */ jsx5("th", { children: "Queue" }),
            /* @__PURE__ */ jsx5("th", { children: "SLA target" }),
            /* @__PURE__ */ jsx5("th", { children: "Attainment" }),
            /* @__PURE__ */ jsx5("th", { children: "RAG" })
          ] }) }),
          /* @__PURE__ */ jsx5("tbody", { children: config.queues.map((q) => {
            const pq = (sim.summary.perQueue || {})[q.id] || {};
            const target = pq.slaTarget != null ? pq.slaTarget : q.slaAttainmentTarget != null ? q.slaAttainmentTarget : 0.9;
            const att = pq.slaAttainment != null ? pq.slaAttainment : null;
            const rag = pq.slaRag || (att == null ? null : att >= target ? "green" : att >= target * 0.9 ? "amber" : "red");
            return /* @__PURE__ */ jsxs4("tr", { children: [
              /* @__PURE__ */ jsx5("td", { style: { textAlign: "left", fontWeight: 600 }, children: q.name }),
              /* @__PURE__ */ jsx5("td", { children: pct(target) }),
              /* @__PURE__ */ jsx5("td", { children: att == null ? "\u2013" : pct(att) }),
              /* @__PURE__ */ jsx5("td", { children: /* @__PURE__ */ jsx5("span", { className: "badge " + (rag || "amber"), "data-testid": "biz-rag-" + q.id, children: rag || "\u2013" }) })
            ] }, q.id);
          }) })
        ] }) })
      ] }),
      /* @__PURE__ */ jsx5(Card, { title: "CX", hint: "Customer experience economics.", children: /* @__PURE__ */ jsxs4("div", { className: "stat-row", style: { flexDirection: "column", gap: 12 }, children: [
        /* @__PURE__ */ jsx5(Stat, { l: "Customers lost", v: num(bz.customersLost, 0) }),
        /* @__PURE__ */ jsx5(Stat, { l: "Churn cost", v: money(cur, f.churn) }),
        /* @__PURE__ */ jsx5(Stat, { l: "Deflected \u2192 voice", v: num(bz.totalDeflected, 0) }),
        /* @__PURE__ */ jsx5(Stat, { l: "Repeat-contact uplift", v: "\xD7" + num(config.cx.repeatUplift, 2) })
      ] }) })
    ] }),
    /* @__PURE__ */ jsx5(Card, { title: "Risk register", sub: `${risks.length} risk(s) \xB7 thresholds in Settings`, children: /* @__PURE__ */ jsx5("div", { className: "tbl-wrap", children: /* @__PURE__ */ jsxs4("table", { className: "data", "data-testid": "risk-table", children: [
      /* @__PURE__ */ jsx5("thead", { children: /* @__PURE__ */ jsxs4("tr", { children: [
        /* @__PURE__ */ jsxs4("th", { style: { cursor: "pointer" }, onClick: () => setSortKey("risk"), children: [
          "Risk",
          arrow("risk")
        ] }),
        /* @__PURE__ */ jsx5("th", { children: "Driver" }),
        /* @__PURE__ */ jsxs4("th", { style: { cursor: "pointer" }, onClick: () => setSortKey("week"), children: [
          "Week",
          arrow("week")
        ] }),
        /* @__PURE__ */ jsxs4("th", { style: { cursor: "pointer" }, onClick: () => setSortKey("severityValue"), children: [
          "Severity",
          arrow("severityValue")
        ] }),
        /* @__PURE__ */ jsx5("th", { children: "SLA impact" }),
        /* @__PURE__ */ jsx5("th", { children: "Suggested lever" })
      ] }) }),
      /* @__PURE__ */ jsxs4("tbody", { children: [
        sortedRisks.map((r, i) => /* @__PURE__ */ jsxs4("tr", { children: [
          /* @__PURE__ */ jsxs4("td", { style: { textAlign: "left", fontWeight: 600 }, children: [
            r.band && /* @__PURE__ */ jsx5("span", { className: "badge " + r.band, style: { marginRight: 6 }, children: r.band }),
            r.risk
          ] }),
          /* @__PURE__ */ jsx5("td", { style: { textAlign: "left", whiteSpace: "normal", maxWidth: 280 }, children: r.driver }),
          /* @__PURE__ */ jsx5("td", { children: r.week ?? "\u2013" }),
          /* @__PURE__ */ jsx5("td", { children: r.severityMoney != null ? money(cur, r.severityMoney) : "\u2014" }),
          /* @__PURE__ */ jsx5("td", { style: { textAlign: "left" }, children: r.sla || "\u2013" }),
          /* @__PURE__ */ jsx5("td", { style: { textAlign: "left", whiteSpace: "normal", maxWidth: 240 }, children: r.lever })
        ] }, i)),
        sortedRisks.length === 0 && /* @__PURE__ */ jsx5("tr", { children: /* @__PURE__ */ jsx5("td", { colSpan: 6, className: "empty", children: "No material risks \u2014 the plan holds across the horizon." }) })
      ] })
    ] }) }) })
  ] });
}

// ui/components/StrategiesTab.jsx
import { useState as useState5 } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { jsx as jsx6, jsxs as jsxs5 } from "react/jsx-runtime";
var SERIES = ["#0e7c86", "#d98a0b", "#5a54c9", "#c0417a", "#2f8f4e", "#b0602a", "#3a7bd5", "#8a51b0"];
var METRICS = [
  { id: "allin", label: "All-in cost", cost: true },
  { id: "hccost", label: "HC cost only", cost: true },
  { id: "coverage", label: "Coverage", cost: false }
];
function scopeQueues(config, scope) {
  if (scope === "overall") return config.queues;
  if (scope === "voice") return config.queues.filter((q) => q.type === "voice");
  if (scope === "digital") return config.queues.filter((q) => q.type === "digital");
  return config.queues.filter((q) => q.id === scope);
}
function weekValue(week, metric, scope, config) {
  if (metric === "coverage") {
    let act = 0, req = 0;
    for (const q of scopeQueues(config, scope)) {
      const s = week.queues[q.id];
      act += s.active != null ? s.active : s.trained + s.ramp;
      req += s.reqFte;
    }
    return req > 0 ? act / req : 1;
  }
  if (scope === "overall") return metric === "allin" ? week.totals.allInCost : week.totals.totalCost;
  let v = 0;
  for (const q of scopeQueues(config, scope)) {
    const s = week.queues[q.id];
    v += metric === "allin" ? s.cost + s.churnCost : s.cost;
  }
  return v;
}
function Comparison({ sims, stratIds, config }) {
  const cur = config.engine.currency;
  const [metric, setMetric] = useState5("allin");
  const [scope, setScope] = useState5("overall");
  const m = METRICS.find((x) => x.id === metric);
  const scopeOpts = [
    { value: "overall", label: "Overall" },
    { value: "voice", label: "Voice" },
    { value: "digital", label: "Digital" },
    ...config.queues.map((q) => ({ value: q.id, label: q.name }))
  ];
  const live = stratIds.filter((id) => sims[id]);
  const len = live.reduce((a, id) => Math.max(a, sims[id].weeks.length), 0);
  const data = [];
  for (let w = 0; w < len; w++) {
    const row = { wk: w + 1 };
    for (const id of live) {
      const sim = sims[id];
      if (w >= sim.weeks.length) continue;
      if (m.cost) {
        let c = 0;
        for (let i = 0; i <= w; i++) c += weekValue(sim.weeks[i], metric, scope, config);
        row[id] = Math.round(c);
      } else row[id] = +(weekValue(sim.weeks[w], metric, scope, config) * 100).toFixed(1);
    }
    data.push(row);
  }
  const fmtY = m.cost ? (v) => money(cur, v) : (v) => v + "%";
  const summary = live.map((id) => {
    const sim = sims[id];
    let val;
    if (m.cost) val = sim.weeks.reduce((a, wk) => a + weekValue(wk, metric, scope, config), 0);
    else val = sim.weeks.reduce((a, wk) => a + weekValue(wk, metric, scope, config), 0) / sim.weeks.length;
    return { id, val };
  });
  return /* @__PURE__ */ jsxs5(
    Card,
    {
      title: "Detailed comparison",
      hint: "Compare strategies on a chosen metric and scope. Cost metrics are cumulative over the horizon; coverage is the active-vs-required ratio.",
      right: /* @__PURE__ */ jsxs5("div", { className: "rowflex", children: [
        /* @__PURE__ */ jsx6("select", { className: "inp", style: { width: 150 }, value: metric, onChange: (e) => setMetric(e.target.value), "data-testid": "cmp-metric", "aria-label": "Metric", children: METRICS.map((x) => /* @__PURE__ */ jsx6("option", { value: x.id, children: x.label }, x.id)) }),
        /* @__PURE__ */ jsx6("select", { className: "inp", style: { width: 150 }, value: scope, onChange: (e) => setScope(e.target.value), "data-testid": "cmp-scope", "aria-label": "Scope", children: scopeOpts.map((o) => /* @__PURE__ */ jsx6("option", { value: o.value, children: o.label }, o.value)) })
      ] }),
      children: [
        /* @__PURE__ */ jsx6("div", { "data-testid": "cmp-chart", "data-series": live.length, children: /* @__PURE__ */ jsx6(Chart, { title: "", height: 280, children: (w, h) => /* @__PURE__ */ jsxs5(LineChart, { width: w, height: h, data, margin: { top: 8, right: 16, left: 8, bottom: 4 }, children: [
          /* @__PURE__ */ jsx6(CartesianGrid, { strokeDasharray: "3 3", stroke: "#eef2f5" }),
          /* @__PURE__ */ jsx6(XAxis, { dataKey: "wk", tick: { fontSize: 11 }, interval: "preserveStartEnd", minTickGap: 18 }),
          /* @__PURE__ */ jsx6(YAxis, { tick: { fontSize: 11 }, width: 54, tickFormatter: fmtY }),
          /* @__PURE__ */ jsx6(Tooltip, { formatter: fmtY }),
          /* @__PURE__ */ jsx6(Legend, { wrapperStyle: { fontSize: 11 } }),
          live.map((id, i) => /* @__PURE__ */ jsx6(Line, { type: "monotone", dataKey: id, name: resolveStrategyName(config, id), stroke: SERIES[i % SERIES.length], dot: false, strokeWidth: 2, isAnimationActive: false }, id))
        ] }) }) }),
        /* @__PURE__ */ jsx6("div", { className: "tbl-wrap", style: { marginTop: 12 }, children: /* @__PURE__ */ jsxs5("table", { className: "data", "data-testid": "cmp-table", children: [
          /* @__PURE__ */ jsx6("thead", { children: /* @__PURE__ */ jsxs5("tr", { children: [
            /* @__PURE__ */ jsx6("th", { children: "Strategy" }),
            /* @__PURE__ */ jsxs5("th", { children: [
              m.label,
              " (",
              m.cost ? "total" : "avg",
              ")"
            ] })
          ] }) }),
          /* @__PURE__ */ jsx6("tbody", { children: summary.map((s) => /* @__PURE__ */ jsxs5("tr", { children: [
            /* @__PURE__ */ jsx6("td", { style: { textAlign: "left" }, children: resolveStrategyName(config, s.id) }),
            /* @__PURE__ */ jsx6("td", { children: m.cost ? money(cur, s.val) : pct(s.val) })
          ] }, s.id)) })
        ] }) })
      ]
    }
  );
}
function StrategyEditor({ config, ops, activeStrategyId }) {
  const [newType, setNewType] = useState5("");
  const [schedName, setSchedName] = useState5("");
  const list = strategyList(config);
  const active = strategyObj(config, activeStrategyId);
  return /* @__PURE__ */ jsxs5(
    Card,
    {
      title: "Strategies",
      hint: "Built-ins S1\u2013S4 plus your own. Custom strategies parameterise a base type; schedules pivot between strategies at set weeks.",
      right: /* @__PURE__ */ jsx6("div", { className: "rowflex", children: /* @__PURE__ */ jsxs5("select", { className: "inp", style: { width: 160 }, value: newType, onChange: (e) => {
        if (e.target.value) {
          ops.addStrategy(e.target.value);
          setNewType("");
        }
      }, "data-testid": "add-strategy", "aria-label": "Add strategy", children: [
        /* @__PURE__ */ jsx6("option", { value: "", children: "+ Add strategy\u2026" }),
        /* @__PURE__ */ jsx6("option", { value: "meet", children: "Meet requirement" }),
        /* @__PURE__ */ jsx6("option", { value: "buffer", children: "Buffer above" }),
        /* @__PURE__ */ jsx6("option", { value: "backfill", children: "Forward backfill" }),
        /* @__PURE__ */ jsx6("option", { value: "manual", children: "Manual plan" }),
        /* @__PURE__ */ jsx6("option", { value: "schedule", children: "Schedule" })
      ] }) }),
      children: [
        isSchedule(active) && /* @__PURE__ */ jsxs5("div", { className: "rowflex", style: { marginBottom: 12 }, children: [
          /* @__PURE__ */ jsx6("input", { type: "text", className: "inp", style: { maxWidth: 220 }, placeholder: "name this schedule", value: schedName, onChange: (e) => setSchedName(e.target.value), "data-testid": "save-schedule-name" }),
          /* @__PURE__ */ jsx6("button", { type: "button", className: "btn sm", disabled: !schedName.trim(), onClick: () => {
            ops.saveScheduleAsStrategy(schedName.trim(), active.segments || []);
            setSchedName("");
          }, "data-testid": "save-schedule", children: "Save current schedule as strategy" })
        ] }),
        /* @__PURE__ */ jsx6("div", { className: "rows", children: list.map((s) => /* @__PURE__ */ jsxs5("details", { className: "erow", children: [
          /* @__PURE__ */ jsxs5("summary", { children: [
            /* @__PURE__ */ jsx6("span", { className: "chev", children: "\u25B6" }),
            /* @__PURE__ */ jsx6("strong", { children: s.name }),
            /* @__PURE__ */ jsx6("span", { className: "pill", children: s.baseType }),
            s.builtin && /* @__PURE__ */ jsx6("span", { className: "pill", children: "built-in" }),
            s.id === activeStrategyId && /* @__PURE__ */ jsx6("span", { className: "tag soft", children: "active" }),
            /* @__PURE__ */ jsx6("span", { className: "spacer" }),
            /* @__PURE__ */ jsxs5("span", { className: "btnbar", onClick: (e) => e.preventDefault(), children: [
              /* @__PURE__ */ jsx6("button", { type: "button", className: "btn sm", onClick: () => ops.duplicateStrategy(s.id), children: "Duplicate" }),
              !s.builtin && /* @__PURE__ */ jsx6("button", { type: "button", className: "btn sm danger", onClick: () => ops.deleteStrategy(s.id), children: "Delete" })
            ] })
          ] }),
          /* @__PURE__ */ jsxs5("div", { className: "erow-b", children: [
            /* @__PURE__ */ jsx6("p", { className: "note", children: strategyBlurb(s) }),
            s.baseType === "manual" && /* @__PURE__ */ jsx6("p", { className: "note", "data-testid": "strat-manual-note-" + s.id, children: "Manual (S4): simulates exactly the hiring plan you enter on each queue, and ignores the hiring cap." }),
            /* @__PURE__ */ jsxs5("div", { className: "fieldrow", children: [
              !s.builtin && /* @__PURE__ */ jsx6(TextField, { label: "Name", value: s.name, onChange: (v) => ops.patchStrategy(s.id, ["name"], v) }),
              s.baseType === "buffer" && /* @__PURE__ */ jsx6(
                NumField,
                {
                  label: "Buffer",
                  unit: "%",
                  id: "strat-buffer-" + s.id,
                  value: +((s.bufferPct != null ? s.bufferPct : config.hiring.buffer) * 100).toFixed(0),
                  onChange: (v) => ops.patchStrategy(s.id, ["bufferPct"], v / 100),
                  hint: "Target = requirement \xD7 (1 + buffer). Editable per strategy."
                }
              ),
              s.baseType === "backfill" && /* @__PURE__ */ jsx6(
                NumField,
                {
                  label: "Forward months",
                  id: "strat-fwd-" + s.id,
                  min: 1,
                  max: 6,
                  value: s.forwardMonths != null ? s.forwardMonths : 3,
                  onChange: (v) => ops.patchStrategy(s.id, ["forwardMonths"], Math.max(1, Math.min(6, Math.round(v || 3)))),
                  hint: "How far ahead (1\u20136 months) the leaver projection looks when sizing replacement hiring."
                }
              )
            ] }),
            ["meet", "buffer", "backfill", "manual"].includes(s.baseType) && /* @__PURE__ */ jsxs5("div", { children: [
              /* @__PURE__ */ jsxs5("div", { className: "lab", style: { marginBottom: 6, display: "flex", gap: 6 }, children: [
                "Excluded queues ",
                /* @__PURE__ */ jsx6(Hint, { text: "Queues this strategy raises no requisitions for." })
              ] }),
              /* @__PURE__ */ jsx6("div", { className: "rowflex", children: config.queues.map((q) => {
                const on = (s.excludedQueueIds || []).includes(q.id);
                return /* @__PURE__ */ jsxs5("label", { className: "switch", children: [
                  /* @__PURE__ */ jsx6("input", { type: "checkbox", checked: on, onChange: (e) => {
                    const cur = s.excludedQueueIds || [];
                    ops.patchStrategy(s.id, ["excludedQueueIds"], e.target.checked ? [...cur, q.id] : cur.filter((x) => x !== q.id));
                  } }),
                  /* @__PURE__ */ jsx6("span", { className: "track", "aria-hidden": "true" }),
                  /* @__PURE__ */ jsx6("span", { children: q.name })
                ] }, q.id);
              }) })
            ] }),
            s.baseType === "schedule" && /* @__PURE__ */ jsxs5("div", { children: [
              /* @__PURE__ */ jsxs5("div", { className: "lab", style: { marginBottom: 6 }, children: [
                "Segments \u2014 ",
                scheduleSummary(config, s) || "empty"
              ] }),
              (s.segments || []).map((seg, i) => /* @__PURE__ */ jsxs5("div", { className: "rowflex", style: { marginBottom: 6 }, children: [
                /* @__PURE__ */ jsx6("span", { style: { fontSize: 12, color: "var(--muted)" }, children: "from wk" }),
                /* @__PURE__ */ jsx6("input", { type: "number", className: "inp", style: { width: 70 }, min: 1, value: seg.fromWeek, onChange: (e) => ops.patchSegment(s.id, i, "fromWeek", Math.max(1, Number(e.target.value) || 1)) }),
                /* @__PURE__ */ jsx6("select", { className: "inp", style: { flex: 1, maxWidth: 220 }, value: seg.strategyId, onChange: (e) => ops.patchSegment(s.id, i, "strategyId", e.target.value), children: list.filter((x) => x.id !== s.id).map((x) => /* @__PURE__ */ jsx6("option", { value: x.id, children: x.name }, x.id)) }),
                /* @__PURE__ */ jsx6("button", { type: "button", className: "btn sm danger", onClick: () => ops.deleteSegment(s.id, i), children: "Remove" })
              ] }, i)),
              /* @__PURE__ */ jsx6("button", { type: "button", className: "btn sm", onClick: () => ops.addSegment(s.id), children: "+ Segment" })
            ] })
          ] })
        ] }, s.id)) })
      ]
    }
  );
}
function StrategiesTab({ simSet, config, activeStrategy, ops }) {
  return /* @__PURE__ */ jsxs5("div", { className: "grid", style: { gap: 16 }, "data-testid": "strategies-panel", children: [
    /* @__PURE__ */ jsx6(StrategyEditor, { config, ops, activeStrategyId: activeStrategy }),
    /* @__PURE__ */ jsx6(Comparison, { sims: simSet.sims, stratIds: simSet.stratIds, config })
  ] });
}

// ui/components/PlanTab.jsx
import { useState as useState7 } from "react";

// ui/components/Ribbon.jsx
import { jsx as jsx7, jsxs as jsxs6 } from "react/jsx-runtime";
function Ribbon({ sim, selectedWeek, onScrub }) {
  const cfg = sim.config;
  const activeSet = new Set(sim.viewIds || []);
  const eventWeeks = {};
  for (const s of cfg.scenarios) {
    if (!activeSet.has(s.id)) continue;
    (eventWeeks[s.startWeek] = eventWeeks[s.startWeek] || []).push(s);
  }
  const weeks = sim.weeks;
  return /* @__PURE__ */ jsxs6("div", { children: [
    /* @__PURE__ */ jsx7("div", { className: "ribbon-wrap", children: /* @__PURE__ */ jsxs6("table", { className: "ribbon", children: [
      /* @__PURE__ */ jsx7("thead", { children: /* @__PURE__ */ jsxs6("tr", { children: [
        /* @__PURE__ */ jsx7("th", {}),
        weeks.map((w) => /* @__PURE__ */ jsx7("th", { className: "wk", children: w.week % 4 === 0 || w.week === weeks.length - 1 ? w.week + 1 : "" }, w.week))
      ] }) }),
      /* @__PURE__ */ jsx7("tbody", { children: cfg.queues.map((q) => /* @__PURE__ */ jsxs6("tr", { children: [
        /* @__PURE__ */ jsx7("th", { scope: "row", children: q.name }),
        weeks.map((w) => {
          const st = w.queues[q.id].status;
          const marked = !!eventWeeks[w.week];
          return /* @__PURE__ */ jsx7("td", { style: { padding: 0 }, children: /* @__PURE__ */ jsx7(
            "button",
            {
              type: "button",
              className: "cell" + (w.week === selectedWeek ? " scrubbed" : "") + (marked ? " evmark" : ""),
              "data-st": st,
              "aria-label": `${q.name}, week ${w.week + 1}: ${st}`,
              "aria-pressed": w.week === selectedWeek,
              onClick: () => onScrub(w.week)
            }
          ) }, w.week);
        })
      ] }, q.id)) })
    ] }) }),
    /* @__PURE__ */ jsxs6("div", { className: "ribbon-scrub", children: [
      /* @__PURE__ */ jsxs6("span", { className: "legend", children: [
        /* @__PURE__ */ jsxs6("span", { children: [
          /* @__PURE__ */ jsx7("span", { className: "sw", style: { background: RAG.green } }),
          "Meets SLA"
        ] }),
        /* @__PURE__ */ jsxs6("span", { children: [
          /* @__PURE__ */ jsx7("span", { className: "sw", style: { background: RAG.amber } }),
          "At risk"
        ] }),
        /* @__PURE__ */ jsxs6("span", { children: [
          /* @__PURE__ */ jsx7("span", { className: "sw", style: { background: RAG.red } }),
          "Breach"
        ] }),
        /* @__PURE__ */ jsxs6("span", { children: [
          /* @__PURE__ */ jsx7("span", { className: "sw", style: { background: "var(--ink)" } }),
          "Scenario event"
        ] })
      ] }),
      /* @__PURE__ */ jsx7("span", { className: "spacer" }),
      Object.keys(eventWeeks).length > 0 && /* @__PURE__ */ jsx7("span", { className: "legend", children: Object.entries(eventWeeks).sort((a, b) => a[0] - b[0]).map(([wk, list]) => /* @__PURE__ */ jsxs6("span", { className: "pill", children: [
        "wk ",
        Number(wk) + 1,
        ": ",
        list.map((s) => s.name).join(", ")
      ] }, wk)) })
    ] })
  ] });
}

// ui/components/HolisticPanel.jsx
import { useState as useState6 } from "react";
import { jsx as jsx8, jsxs as jsxs7 } from "react/jsx-runtime";
function queueMetrics(sim, q) {
  const series = sim.weeks.map((w) => w.queues[q.id]);
  const last = series[series.length - 1];
  const n = Math.max(1, series.length);
  const sumOf = (f) => series.reduce((a, s) => a + (f(s) || 0), 0);
  return {
    id: q.id,
    name: q.name,
    reqFte: last.reqFte,
    hires: sumOf((s) => s.reqsRaised),
    active: last.active != null ? last.active : last.trained + last.ramp,
    attrition: sumOf((s) => s.leavers),
    agentMonthly: sumOf((s) => s.cost) / n * (52 / 12),
    otMonthly: sumOf((s) => s.otCost) / n * (52 / 12),
    custMonthly: sumOf((s) => s.churnCost) / n * (52 / 12)
  };
}
function HierarchyBlocks({ sim }) {
  const cfg = sim.config;
  const cur = cfg.engine.currency;
  const rows = hierarchy(cfg);
  const agg = (queues) => {
    let req = 0, active = 0, pipe = 0;
    for (const q of queues) {
      const last = sim.weeks[sim.weeks.length - 1].queues[q.id];
      req += last.reqFte;
      active += last.active != null ? last.active : last.trained + last.ramp;
      pipe += last.pipeline || 0;
    }
    return { req, active, pipe };
  };
  const block = (label, sub, queues, key) => {
    const a = agg(queues);
    return /* @__PURE__ */ jsxs7("div", { className: "holo-block", "data-testid": "holo-block-" + key, children: [
      /* @__PURE__ */ jsxs7("div", { className: "holo-block-h", children: [
        /* @__PURE__ */ jsx8("strong", { children: label }),
        sub ? /* @__PURE__ */ jsx8("span", { className: "pill", children: sub }) : null
      ] }),
      /* @__PURE__ */ jsxs7("div", { className: "holo-mini", children: [
        /* @__PURE__ */ jsxs7("div", { children: [
          /* @__PURE__ */ jsx8("span", { className: "l", children: "Required" }),
          /* @__PURE__ */ jsx8("span", { className: "v", children: num(a.req, 0) })
        ] }),
        /* @__PURE__ */ jsxs7("div", { children: [
          /* @__PURE__ */ jsx8("span", { className: "l", children: "Active" }),
          /* @__PURE__ */ jsx8("span", { className: "v", children: num(a.active, 0) })
        ] }),
        /* @__PURE__ */ jsxs7("div", { children: [
          /* @__PURE__ */ jsx8("span", { className: "l", children: "Pipeline" }),
          /* @__PURE__ */ jsx8("span", { className: "v", children: num(a.pipe, 0) })
        ] })
      ] })
    ] }, key);
  };
  return /* @__PURE__ */ jsx8("div", { className: "holo-grid", "data-testid": "holo-hierarchy", children: rows.map((row) => [
    block(row.brand.name, `${row.queues.length} queue(s)`, row.queues, row.brand.id),
    ...row.channels.map((c) => block(`${row.brand.name} \xB7 ${c.label}`, null, c.queues, row.brand.id + "-" + c.key))
  ]).flat() });
}
function CapsContext({ sim }) {
  const cfg = sim.config;
  const caps = cfg.hiring.caps || { total: cfg.hiring.cap, segments: {}, brands: {} };
  const trace = sim.allocTrace || [];
  const binding = trace.filter((t) => t.binding);
  const levels = /* @__PURE__ */ new Set();
  for (const t of binding) for (const l of t.boundBy || []) levels.add(l);
  const segEntries = Object.entries(caps.segments || {});
  return /* @__PURE__ */ jsxs7("p", { className: "note", "data-testid": "holo-caps", style: { marginTop: 12 }, children: [
    "Hiring caps \u2014 total ",
    caps.total == null ? "\u221E" : caps.total + "/wk",
    segEntries.length ? `; ${segEntries.length} segment cap(s) set` : "; no segment caps",
    ".",
    binding.length ? ` The cap binds in ${binding.length} week(s); binding level(s): ${[...levels].join(", ") || "Total"}.` : " The plan fits within every cap across the horizon."
  ] });
}
function HolisticPanel({ sim }) {
  const cfg = sim.config;
  const cur = cfg.engine.currency;
  const queues = orderedQueues(cfg);
  const [active, setActive] = useState6(() => new Set(queues.map((q) => q.id)));
  const [showTrace, setShowTrace] = useState6(false);
  const metrics = queues.map((q) => queueMetrics(sim, q));
  const on = (id) => active.has(id);
  const toggle = (id) => setActive((s) => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const shown = metrics.filter((m) => on(m.id));
  const totals = shown.reduce((t, m) => ({
    reqFte: t.reqFte + m.reqFte,
    hires: t.hires + m.hires,
    active: t.active + m.active,
    attrition: t.attrition + m.attrition,
    agentMonthly: t.agentMonthly + m.agentMonthly,
    otMonthly: t.otMonthly + m.otMonthly,
    custMonthly: t.custMonthly + m.custMonthly
  }), { reqFte: 0, hires: 0, active: 0, attrition: 0, agentMonthly: 0, otMonthly: 0, custMonthly: 0 });
  return /* @__PURE__ */ jsxs7(
    Card,
    {
      title: "Holistic requirement panel",
      hint: "Required, active and pipeline headcount across the hierarchy, then an interactive per-queue table. Toggle a queue chip to include or exclude it \u2014 the capacity required and the totals recompute live.",
      right: /* @__PURE__ */ jsx8("button", { type: "button", className: "btn sm", onClick: () => setShowTrace((s) => !s), "data-testid": "holo-toggle-trace", children: showTrace ? "Hide cap trace" : "Show cap trace" }),
      children: [
        /* @__PURE__ */ jsx8(HierarchyBlocks, { sim }),
        /* @__PURE__ */ jsxs7("div", { className: "stat-row", style: { marginTop: 14 }, children: [
          /* @__PURE__ */ jsxs7("div", { className: "stat", children: [
            /* @__PURE__ */ jsx8("div", { className: "l", children: "Total capacity required (filtered)" }),
            /* @__PURE__ */ jsxs7("div", { className: "v", "data-testid": "holo-capacity-required", children: [
              num(totals.reqFte, 0),
              /* @__PURE__ */ jsx8("small", { children: " FTE" })
            ] })
          ] }),
          /* @__PURE__ */ jsxs7("div", { className: "stat", children: [
            /* @__PURE__ */ jsx8("div", { className: "l", children: "Queues included" }),
            /* @__PURE__ */ jsxs7("div", { className: "v", "data-testid": "holo-active-count", children: [
              shown.length,
              /* @__PURE__ */ jsxs7("small", { children: [
                "/",
                metrics.length
              ] })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsx8("div", { className: "rowflex", style: { marginTop: 10 }, "data-testid": "holo-chips", children: metrics.map((m) => /* @__PURE__ */ jsx8(
          "button",
          {
            type: "button",
            className: "chip" + (on(m.id) ? " on" : ""),
            "aria-pressed": on(m.id),
            "data-testid": "holo-chip-" + m.id,
            onClick: () => toggle(m.id),
            children: m.name
          },
          m.id
        )) }),
        /* @__PURE__ */ jsx8("div", { className: "tbl-wrap", style: { marginTop: 12 }, children: /* @__PURE__ */ jsxs7("table", { className: "data", "data-testid": "holo-table", children: [
          /* @__PURE__ */ jsx8("thead", { children: /* @__PURE__ */ jsxs7("tr", { children: [
            /* @__PURE__ */ jsx8("th", { children: "Queue" }),
            /* @__PURE__ */ jsx8("th", { children: "Capacity req." }),
            /* @__PURE__ */ jsx8("th", { children: "Hires" }),
            /* @__PURE__ */ jsx8("th", { children: "Active" }),
            /* @__PURE__ */ jsx8("th", { children: "Attrition #" }),
            /* @__PURE__ */ jsx8("th", { children: "Agent \xA3/mo" }),
            /* @__PURE__ */ jsx8("th", { children: "OT \xA3/mo" }),
            /* @__PURE__ */ jsx8("th", { children: "Customer \xA3/mo" })
          ] }) }),
          /* @__PURE__ */ jsxs7("tbody", { children: [
            shown.map((m) => /* @__PURE__ */ jsxs7("tr", { children: [
              /* @__PURE__ */ jsx8("td", { style: { textAlign: "left", fontWeight: 600 }, children: m.name }),
              /* @__PURE__ */ jsx8("td", { children: num(m.reqFte, 1) }),
              /* @__PURE__ */ jsx8("td", { children: num(m.hires, 1) }),
              /* @__PURE__ */ jsx8("td", { children: num(m.active, 1) }),
              /* @__PURE__ */ jsx8("td", { children: num(m.attrition, 1) }),
              /* @__PURE__ */ jsx8("td", { children: money(cur, m.agentMonthly) }),
              /* @__PURE__ */ jsx8("td", { children: money(cur, m.otMonthly) }),
              /* @__PURE__ */ jsx8("td", { children: money(cur, m.custMonthly) })
            ] }, m.id)),
            shown.length === 0 && /* @__PURE__ */ jsx8("tr", { children: /* @__PURE__ */ jsx8("td", { colSpan: 8, className: "empty", children: "No queues selected \u2014 tap a chip to include one." }) }),
            /* @__PURE__ */ jsxs7("tr", { className: "grp total", children: [
              /* @__PURE__ */ jsxs7("td", { style: { textAlign: "left" }, children: [
                "Totals (",
                shown.length,
                ")"
              ] }),
              /* @__PURE__ */ jsx8("td", { "data-testid": "holo-total-req", children: num(totals.reqFte, 1) }),
              /* @__PURE__ */ jsx8("td", { "data-testid": "holo-total-hires", children: num(totals.hires, 1) }),
              /* @__PURE__ */ jsx8("td", { "data-testid": "holo-total-active", children: num(totals.active, 1) }),
              /* @__PURE__ */ jsx8("td", { "data-testid": "holo-total-attrition", children: num(totals.attrition, 1) }),
              /* @__PURE__ */ jsx8("td", { "data-testid": "holo-total-agent", children: money(cur, totals.agentMonthly) }),
              /* @__PURE__ */ jsx8("td", { "data-testid": "holo-total-ot", children: money(cur, totals.otMonthly) }),
              /* @__PURE__ */ jsx8("td", { "data-testid": "holo-total-cust", children: money(cur, totals.custMonthly) })
            ] })
          ] })
        ] }) }),
        /* @__PURE__ */ jsx8(WeeklyTable, { sim, active }),
        /* @__PURE__ */ jsx8(CapsContext, { sim }),
        showTrace && /* @__PURE__ */ jsx8(AllocationTrace, { sim })
      ]
    }
  );
}
function WeeklyTable({ sim, active }) {
  const cfg = sim.config;
  const cur = cfg.engine.currency;
  const ids = cfg.queues.map((q) => q.id).filter((id) => active.has(id));
  const rows = sim.weeks.map((w, i) => {
    let reqFte = 0, hires = 0, act = 0, attrition = 0, agent = 0, ot = 0, cust = 0;
    for (const id of ids) {
      const s = w.queues[id];
      reqFte += s.reqFte || 0;
      hires += s.reqsRaised || 0;
      act += s.active != null ? s.active : (s.trained || 0) + (s.ramp || 0);
      attrition += s.leavers || 0;
      agent += s.cost || 0;
      ot += s.otCost || 0;
      cust += s.churnCost || 0;
    }
    return { week: i + 1, reqFte, hires, act, attrition, agent, ot, cust };
  });
  return /* @__PURE__ */ jsx8("div", { className: "tbl-wrap", style: { marginTop: 14, maxHeight: 360 }, children: /* @__PURE__ */ jsxs7("table", { className: "data", "data-testid": "holo-weekly-table", children: [
    /* @__PURE__ */ jsx8("thead", { children: /* @__PURE__ */ jsxs7("tr", { children: [
      /* @__PURE__ */ jsx8("th", { children: "Week" }),
      /* @__PURE__ */ jsx8("th", { children: "Capacity req." }),
      /* @__PURE__ */ jsx8("th", { children: "Hires" }),
      /* @__PURE__ */ jsx8("th", { children: "Active" }),
      /* @__PURE__ */ jsx8("th", { children: "Attrition #" }),
      /* @__PURE__ */ jsx8("th", { children: "Agent \xA3" }),
      /* @__PURE__ */ jsx8("th", { children: "OT \xA3" }),
      /* @__PURE__ */ jsx8("th", { children: "Customer \xA3" })
    ] }) }),
    /* @__PURE__ */ jsx8("tbody", { children: rows.map((r) => /* @__PURE__ */ jsxs7("tr", { "data-testid": "holo-weekly-row", children: [
      /* @__PURE__ */ jsx8("td", { style: { textAlign: "left", fontWeight: 600 }, children: r.week }),
      /* @__PURE__ */ jsx8("td", { "data-testid": r.week === 1 ? "holo-wk1-cap" : void 0, children: num(r.reqFte, 1) }),
      /* @__PURE__ */ jsx8("td", { children: num(r.hires, 1) }),
      /* @__PURE__ */ jsx8("td", { children: num(r.act, 1) }),
      /* @__PURE__ */ jsx8("td", { children: num(r.attrition, 1) }),
      /* @__PURE__ */ jsx8("td", { children: money(cur, r.agent) }),
      /* @__PURE__ */ jsx8("td", { children: money(cur, r.ot) }),
      /* @__PURE__ */ jsx8("td", { children: money(cur, r.cust) })
    ] }, r.week)) })
  ] }) });
}
function AllocationTrace({ sim }) {
  const cfg = sim.config;
  const cur = cfg.engine.currency;
  const trace = sim.allocTrace || [];
  const binding = trace.filter((t) => t.binding);
  const rows = binding.length ? binding : trace.slice(0, 8);
  const qName = (id) => (cfg.queues.find((q) => q.id === id) || { name: id }).name;
  return /* @__PURE__ */ jsx8("div", { className: "tbl-wrap", style: { marginTop: 12, maxHeight: 340 }, children: /* @__PURE__ */ jsxs7("table", { className: "data", "data-testid": "holo-trace", children: [
    /* @__PURE__ */ jsx8("thead", { children: /* @__PURE__ */ jsxs7("tr", { children: [
      /* @__PURE__ */ jsx8("th", { children: "Week" }),
      /* @__PURE__ */ jsx8("th", { children: "Cap" }),
      /* @__PURE__ */ jsx8("th", { children: "Wanted" }),
      cfg.queues.map((q) => /* @__PURE__ */ jsx8("th", { children: q.name }, q.id)),
      /* @__PURE__ */ jsx8("th", { children: "Bound by" })
    ] }) }),
    /* @__PURE__ */ jsxs7("tbody", { children: [
      rows.map((t) => /* @__PURE__ */ jsxs7("tr", { style: t.binding ? { background: "var(--red-s)" } : void 0, children: [
        /* @__PURE__ */ jsx8("td", { children: t.week + 1 }),
        /* @__PURE__ */ jsx8("td", { children: t.cap == null ? "\u221E" : t.cap }),
        /* @__PURE__ */ jsxs7("td", { children: [
          num(t.want, 0),
          t.binding ? " \u26A0" : ""
        ] }),
        cfg.queues.map((q) => {
          const g = t.grants[q.id] || 0, d = t.denied[q.id] || 0;
          return /* @__PURE__ */ jsxs7("td", { className: d > 0.05 ? "st-red" : void 0, children: [
            g > 0.05 ? num(g, 0) : "\u2013",
            d > 0.05 ? ` (\u2212${num(d, 0)})` : ""
          ] }, q.id);
        }),
        /* @__PURE__ */ jsx8("td", { style: { textAlign: "left" }, children: (t.boundBy || []).join(", ") || (t.binding ? "Total" : "\u2013") })
      ] }, t.week)),
      rows.length === 0 && /* @__PURE__ */ jsx8("tr", { children: /* @__PURE__ */ jsx8("td", { colSpan: 4 + cfg.queues.length, className: "empty", children: "No allocation activity." }) })
    ] })
  ] }) });
}

// ui/components/charts.jsx
import {
  LineChart as LineChart2,
  Line as Line2,
  BarChart,
  Bar,
  ComposedChart,
  Area,
  XAxis as XAxis2,
  YAxis as YAxis2,
  CartesianGrid as CartesianGrid2,
  Tooltip as Tooltip2,
  Legend as Legend2,
  ReferenceLine
} from "recharts";
import { jsx as jsx9, jsxs as jsxs8 } from "react/jsx-runtime";
var SERIES2 = ["#0e7c86", "#d98a0b", "#5a54c9", "#c0417a", "#2f8f4e", "#b0602a", "#3a7bd5", "#8a51b0"];
var AX = { fontSize: 11 };
var common = { margin: { top: 8, right: 14, left: 4, bottom: 4 } };
var wkX = { dataKey: "wk", tick: AX, interval: "preserveStartEnd", minTickGap: 18 };
function markLine(selectedWeek) {
  if (selectedWeek == null) return null;
  return /* @__PURE__ */ jsx9(ReferenceLine, { x: selectedWeek + 1, stroke: "#0f1720", strokeDasharray: "3 3", strokeOpacity: 0.5 });
}
function CoverageChart({ sim, selectedWeek }) {
  const cfg = sim.config;
  const data = sim.weeks.map((w) => {
    const row = { wk: w.week + 1 };
    for (const q of cfg.queues) row[q.id] = +(w.queues[q.id].cover * 100).toFixed(1);
    return row;
  });
  return /* @__PURE__ */ jsx9(Chart, { title: "Coverage", hint: "Available productive hours \xF7 required hours, laid along the requirement curve. 100% means SLA is met in every interval; below is a uniform shortfall.", children: (w, h) => /* @__PURE__ */ jsxs8(LineChart2, { width: w, height: h, data, ...common, children: [
    /* @__PURE__ */ jsx9(CartesianGrid2, { strokeDasharray: "3 3", stroke: "#eef2f5" }),
    /* @__PURE__ */ jsx9(XAxis2, { ...wkX }),
    /* @__PURE__ */ jsx9(YAxis2, { tick: AX, width: 40, domain: [0, "auto"], tickFormatter: (v) => v + "%" }),
    /* @__PURE__ */ jsx9(Tooltip2, { formatter: (v) => v + "%" }),
    /* @__PURE__ */ jsx9(Legend2, { wrapperStyle: { fontSize: 11 } }),
    /* @__PURE__ */ jsx9(ReferenceLine, { y: 100, stroke: "#1f9d55", strokeDasharray: "4 2" }),
    markLine(selectedWeek),
    cfg.queues.map((q, i) => /* @__PURE__ */ jsx9(Line2, { type: "monotone", dataKey: q.id, name: q.name, stroke: SERIES2[i % SERIES2.length], dot: false, strokeWidth: 2, isAnimationActive: false }, q.id))
  ] }) });
}
function HeadcountChart({ sim, selectedWeek }) {
  const data = sim.weeks.map((w) => ({
    wk: w.week + 1,
    trained: +w.totals.trained.toFixed(1),
    ramping: +w.totals.ramping.toFixed(1),
    training: +w.totals.inTraining.toFixed(1),
    required: +w.totals.reqFte.toFixed(1)
  }));
  return /* @__PURE__ */ jsx9(Chart, { title: "Headcount \u2014 trained / ramping / training vs required", hint: "Paid heads split by readiness. Trainees cost full salary but deliver zero; ramping agents deliver their learning-curve share. The line is required FTE.", children: (w, h) => /* @__PURE__ */ jsxs8(ComposedChart, { width: w, height: h, data, ...common, children: [
    /* @__PURE__ */ jsx9(CartesianGrid2, { strokeDasharray: "3 3", stroke: "#eef2f5" }),
    /* @__PURE__ */ jsx9(XAxis2, { ...wkX }),
    /* @__PURE__ */ jsx9(YAxis2, { tick: AX, width: 40 }),
    /* @__PURE__ */ jsx9(Tooltip2, {}),
    /* @__PURE__ */ jsx9(Legend2, { wrapperStyle: { fontSize: 11 } }),
    /* @__PURE__ */ jsx9(Area, { type: "monotone", dataKey: "trained", stackId: "hc", stroke: "#0e7c86", fill: "#0e7c86", fillOpacity: 0.75, isAnimationActive: false }),
    /* @__PURE__ */ jsx9(Area, { type: "monotone", dataKey: "ramping", stackId: "hc", stroke: "#12a3b0", fill: "#57c3cc", fillOpacity: 0.7, isAnimationActive: false }),
    /* @__PURE__ */ jsx9(Area, { type: "monotone", dataKey: "training", stackId: "hc", stroke: "#d98a0b", fill: "#f0c774", fillOpacity: 0.7, isAnimationActive: false }),
    /* @__PURE__ */ jsx9(Line2, { type: "monotone", dataKey: "required", stroke: "#0f1720", strokeWidth: 2, dot: false, isAnimationActive: false }),
    markLine(selectedWeek)
  ] }) });
}
function VolumeChart({ sim, selectedWeek }) {
  const cfg = sim.config;
  const data = sim.weeks.map((w) => {
    let base = 0, deflected = 0, redial = 0;
    for (const q of cfg.queues) {
      const s = w.queues[q.id];
      base += s.baseVolume;
      deflected += s.deflected || 0;
      redial += s.redial || 0;
    }
    return { wk: w.week + 1, base: Math.round(base), deflected: Math.round(deflected), redial: Math.round(redial) };
  });
  return /* @__PURE__ */ jsx9(Chart, { title: "Volume composition", hint: "Exogenous base volume (after seasonality and scenarios) plus endogenous load: digital\u2192voice deflection and abandoned-caller redials.", children: (w, h) => /* @__PURE__ */ jsxs8(BarChart, { width: w, height: h, data, ...common, children: [
    /* @__PURE__ */ jsx9(CartesianGrid2, { strokeDasharray: "3 3", stroke: "#eef2f5" }),
    /* @__PURE__ */ jsx9(XAxis2, { ...wkX }),
    /* @__PURE__ */ jsx9(YAxis2, { tick: AX, width: 48, tickFormatter: (v) => v >= 1e3 ? (v / 1e3).toFixed(0) + "k" : v }),
    /* @__PURE__ */ jsx9(Tooltip2, {}),
    /* @__PURE__ */ jsx9(Legend2, { wrapperStyle: { fontSize: 11 } }),
    /* @__PURE__ */ jsx9(Bar, { dataKey: "base", name: "Base", stackId: "v", fill: "#0e7c86", isAnimationActive: false }),
    /* @__PURE__ */ jsx9(Bar, { dataKey: "deflected", name: "Deflected", stackId: "v", fill: "#5a54c9", isAnimationActive: false }),
    /* @__PURE__ */ jsx9(Bar, { dataKey: "redial", name: "Redial", stackId: "v", fill: "#d98a0b", isAnimationActive: false }),
    markLine(selectedWeek)
  ] }) });
}
function CostChart({ sim, selectedWeek }) {
  const cur = sim.config.engine.currency;
  const data = sim.weeks.map((w) => ({
    wk: w.week + 1,
    productive: Math.round(w.totals.productiveCost),
    training: Math.round(w.totals.trainCost),
    managers: Math.round(w.totals.managerCost),
    service: Math.round(w.totals.serviceCost || 0)
  }));
  return /* @__PURE__ */ jsx9(Chart, { title: "Cost breakdown", hint: "Weekly run cost by component: productive salary, trainee salary, management overhead, and service-team premium hours.", children: (w, h) => /* @__PURE__ */ jsxs8(BarChart, { width: w, height: h, data, ...common, children: [
    /* @__PURE__ */ jsx9(CartesianGrid2, { strokeDasharray: "3 3", stroke: "#eef2f5" }),
    /* @__PURE__ */ jsx9(XAxis2, { ...wkX }),
    /* @__PURE__ */ jsx9(YAxis2, { tick: AX, width: 48, tickFormatter: (v) => money(cur, v) }),
    /* @__PURE__ */ jsx9(Tooltip2, { formatter: (v) => money(cur, v) }),
    /* @__PURE__ */ jsx9(Legend2, { wrapperStyle: { fontSize: 11 } }),
    /* @__PURE__ */ jsx9(Bar, { dataKey: "productive", name: "Productive", stackId: "c", fill: "#0e7c86", isAnimationActive: false }),
    /* @__PURE__ */ jsx9(Bar, { dataKey: "training", name: "Training", stackId: "c", fill: "#d98a0b", isAnimationActive: false }),
    /* @__PURE__ */ jsx9(Bar, { dataKey: "managers", name: "Managers", stackId: "c", fill: "#5a54c9", isAnimationActive: false }),
    /* @__PURE__ */ jsx9(Bar, { dataKey: "service", name: "Service team", stackId: "c", fill: "#2f8f4e", isAnimationActive: false }),
    markLine(selectedWeek)
  ] }) });
}
function IdleChurnChart({ sim, selectedWeek }) {
  const cur = sim.config.engine.currency;
  const data = sim.weeks.map((w) => ({
    wk: w.week + 1,
    idle: Math.round(w.totals.waste),
    churn: Math.round(w.totals.churnCost)
  }));
  let cross = null;
  for (let i = 1; i < data.length; i++) {
    const a = data[i - 1].idle - data[i - 1].churn;
    const b = data[i].idle - data[i].churn;
    if (a === 0 || a < 0 !== b < 0) {
      cross = data[i].wk;
      break;
    }
  }
  return /* @__PURE__ */ jsx9(Chart, { title: "Idle pay vs churn cost", hint: "Over-staffing wastes salary; under-staffing loses customers. The break-even week is where the two curves cross \u2014 the cheapest place to sit.", children: (w, h) => /* @__PURE__ */ jsxs8(LineChart2, { width: w, height: h, data, ...common, children: [
    /* @__PURE__ */ jsx9(CartesianGrid2, { strokeDasharray: "3 3", stroke: "#eef2f5" }),
    /* @__PURE__ */ jsx9(XAxis2, { ...wkX }),
    /* @__PURE__ */ jsx9(YAxis2, { tick: AX, width: 48, tickFormatter: (v) => money(cur, v) }),
    /* @__PURE__ */ jsx9(Tooltip2, { formatter: (v) => money(cur, v) }),
    /* @__PURE__ */ jsx9(Legend2, { wrapperStyle: { fontSize: 11 } }),
    /* @__PURE__ */ jsx9(Line2, { type: "monotone", dataKey: "idle", name: "Idle pay", stroke: "#3a7bd5", strokeWidth: 2, dot: false, isAnimationActive: false }),
    /* @__PURE__ */ jsx9(Line2, { type: "monotone", dataKey: "churn", name: "Churn cost", stroke: "#c0417a", strokeWidth: 2, dot: false, isAnimationActive: false }),
    cross != null && /* @__PURE__ */ jsx9(ReferenceLine, { x: cross, stroke: "#1f9d55", label: { value: "break-even", fontSize: 10, fill: "#1f9d55", position: "top" } }),
    markLine(selectedWeek)
  ] }) });
}
function BurnoutChart({ sim, selectedWeek }) {
  const cfg = sim.config;
  const data = sim.weeks.map((w) => {
    const row = { wk: w.week + 1 };
    for (const q of cfg.queues) row[q.id] = Math.round(w.queues[q.id].burnout);
    return row;
  });
  return /* @__PURE__ */ jsx9(Chart, { title: "Burnout index", hint: "Accumulates while occupancy exceeds the threshold, multiplying attrition and adding absence shrinkage; recovers when occupancy eases.", children: (w, h) => /* @__PURE__ */ jsxs8(LineChart2, { width: w, height: h, data, ...common, children: [
    /* @__PURE__ */ jsx9(CartesianGrid2, { strokeDasharray: "3 3", stroke: "#eef2f5" }),
    /* @__PURE__ */ jsx9(XAxis2, { ...wkX }),
    /* @__PURE__ */ jsx9(YAxis2, { tick: AX, width: 36, domain: [0, 100] }),
    /* @__PURE__ */ jsx9(Tooltip2, {}),
    /* @__PURE__ */ jsx9(Legend2, { wrapperStyle: { fontSize: 11 } }),
    cfg.queues.map((q, i) => /* @__PURE__ */ jsx9(Line2, { type: "monotone", dataKey: q.id, name: q.name, stroke: SERIES2[i % SERIES2.length], dot: false, strokeWidth: 2, isAnimationActive: false }, q.id)),
    markLine(selectedWeek)
  ] }) });
}

// ui/components/PlanTab.jsx
import { Fragment as Fragment3, jsx as jsx10, jsxs as jsxs9 } from "react/jsx-runtime";
function Findings({ findings }) {
  if (!findings || !findings.length) return /* @__PURE__ */ jsx10("div", { className: "empty", children: "No findings \u2014 the plan holds across the horizon." });
  return /* @__PURE__ */ jsx10("div", { className: "findings", children: findings.map((f, i) => /* @__PURE__ */ jsxs9("div", { className: "finding " + f.tone, children: [
    /* @__PURE__ */ jsx10("span", { className: "pip" }),
    /* @__PURE__ */ jsx10("span", { children: f.text })
  ] }, i)) });
}
function QueueCard({ q, s }) {
  const voice = q.type === "voice";
  return /* @__PURE__ */ jsxs9("div", { className: "qcard " + s.status, children: [
    /* @__PURE__ */ jsxs9("div", { className: "qn", children: [
      /* @__PURE__ */ jsx10("span", { children: q.name }),
      /* @__PURE__ */ jsx10("span", { className: "spacer" }),
      q.resourcing === "supported" && /* @__PURE__ */ jsx10("span", { className: "badge amber", title: void 0, children: "supported" }),
      /* @__PURE__ */ jsx10("span", { className: "qtype", children: q.type })
    ] }),
    /* @__PURE__ */ jsxs9("div", { className: "kpis", children: [
      /* @__PURE__ */ jsxs9("div", { className: "kpi", children: [
        /* @__PURE__ */ jsx10("div", { className: "l", children: "Volume" }),
        /* @__PURE__ */ jsx10("div", { className: "v", children: num(s.volume, 0) })
      ] }),
      /* @__PURE__ */ jsxs9("div", { className: "kpi", children: [
        /* @__PURE__ */ jsx10("div", { className: "l", children: "Coverage" }),
        /* @__PURE__ */ jsx10("div", { className: "v", children: pct(s.cover) })
      ] }),
      voice ? /* @__PURE__ */ jsxs9(Fragment3, { children: [
        /* @__PURE__ */ jsxs9("div", { className: "kpi", children: [
          /* @__PURE__ */ jsx10("div", { className: "l", children: "ASA" }),
          /* @__PURE__ */ jsx10("div", { className: "v", children: secs(s.asa) })
        ] }),
        /* @__PURE__ */ jsxs9("div", { className: "kpi", children: [
          /* @__PURE__ */ jsx10("div", { className: "l", children: "Abandon" }),
          /* @__PURE__ */ jsx10("div", { className: "v", children: pct(s.abandon, 1) })
        ] })
      ] }) : /* @__PURE__ */ jsxs9(Fragment3, { children: [
        /* @__PURE__ */ jsxs9("div", { className: "kpi", children: [
          /* @__PURE__ */ jsx10("div", { className: "l", children: "Response" }),
          /* @__PURE__ */ jsxs9("div", { className: "v", children: [
            num(s.respMin, 1),
            "m"
          ] })
        ] }),
        /* @__PURE__ */ jsxs9("div", { className: "kpi", children: [
          /* @__PURE__ */ jsx10("div", { className: "l", children: "In SLA" }),
          /* @__PURE__ */ jsx10("div", { className: "v", children: pct(s.sl) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs9("div", { className: "kpi", children: [
        /* @__PURE__ */ jsx10("div", { className: "l", children: "Occupancy" }),
        /* @__PURE__ */ jsx10("div", { className: "v", children: pct(s.occ) })
      ] }),
      /* @__PURE__ */ jsxs9("div", { className: "kpi", children: [
        /* @__PURE__ */ jsx10("div", { className: "l", children: "Active / req" }),
        /* @__PURE__ */ jsxs9("div", { className: "v", children: [
          num(s.active != null ? s.active : s.trained + s.ramp, 0),
          "/",
          num(s.reqFte, 0)
        ] })
      ] })
    ] })
  ] });
}
function hiringMetric(sim, q) {
  const h = sim.summary.hiring;
  const r = h && h.queues[q.id] || { volume: 0, required: 0, hiring: 0, training: 0, active: 0, churnCount: 0 };
  const series = sim.weeks.map((w) => w.queues[q.id]);
  const avgActive = series.reduce((a, s) => a + (s.active != null ? s.active : (s.trained || 0) + (s.ramp || 0)), 0) / Math.max(1, series.length);
  return { volume: r.volume, required: r.required, hiring: r.hiring, training: r.training, active: r.active, churnCount: r.churnCount, avgActive };
}
function sumHiring(list) {
  return list.reduce((t, m) => ({
    volume: t.volume + m.volume,
    required: t.required + m.required,
    hiring: t.hiring + m.hiring,
    training: t.training + m.training,
    active: t.active + m.active,
    churnCount: t.churnCount + m.churnCount,
    avgActive: t.avgActive + m.avgActive
  }), { volume: 0, required: 0, hiring: 0, training: 0, active: 0, churnCount: 0, avgActive: 0 });
}
function HiringSummary({ sim, cur }) {
  const h = sim.summary.hiring;
  if (!h) return null;
  const columns = [
    { key: "volume", label: "Volume", fmt: (m) => num(m.volume, 0) },
    { key: "required", label: "Required", fmt: (m) => num(m.required, 1) },
    { key: "hiring", label: "Hiring", fmt: (m) => num(m.hiring, 1) },
    { key: "training", label: "Training", fmt: (m) => num(m.training, 1) },
    { key: "active", label: "Active", fmt: (m) => num(m.active, 1) },
    { key: "churnCount", label: "Churn #", fmt: (m) => num(m.churnCount, 1) },
    { key: "churnPct", label: "Churn %", fmt: (m) => pct(m.avgActive > 1e-9 ? m.churnCount / m.avgActive : 0, 1) }
  ];
  return /* @__PURE__ */ jsx10(Card, { title: "Hiring summary", hint: "Volume, required HC, hiring (requisitions raised over the horizon), training and active heads, and agent churn \u2014 Brand \u2192 Voice / Digital / Support \u2192 queue with channel and brand subtotal rows.", children: /* @__PURE__ */ jsx10(HierTable, { config: sim.config, testid: "hiring-summary", firstLabel: "Scope", columns, metric: (q) => hiringMetric(sim, q), aggregate: sumHiring }) });
}
function PlanTab({ sim, viewLabel }) {
  const cfg = sim.config;
  const [selectedWeek, setSelectedWeek] = useState7(0);
  const wk = Math.min(selectedWeek, sim.weeks.length - 1);
  const week = sim.weeks[wk];
  const sm = sim.summary;
  const cur = cfg.engine.currency;
  return /* @__PURE__ */ jsxs9(
    "div",
    {
      className: "grid",
      style: { gap: 16 },
      "data-testid": "plan-panel",
      "data-active-strategy": sm.strategy,
      "data-active-allin": Math.round(sm.allIn),
      children: [
        /* @__PURE__ */ jsx10(Card, { title: "Findings", hint: "Auto-written from the active strategy. Red demands a decision; amber is a watch item.", children: /* @__PURE__ */ jsx10(Findings, { findings: sm.findings }) }),
        /* @__PURE__ */ jsx10(
          Card,
          {
            title: "RAG ribbon",
            sub: "week \xD7 queue \u2014 click any cell to scrub the dashboard",
            hint: "Each square is a queue-week's SLA verdict. Dots mark weeks where an enabled scenario fires.",
            children: /* @__PURE__ */ jsx10(Ribbon, { sim, selectedWeek: wk, onScrub: setSelectedWeek })
          }
        ),
        /* @__PURE__ */ jsxs9(Card, { title: `Queue status \u2014 week ${wk + 1}`, sub: `${sm.strategy} active \xB7 view: ${viewLabel || "Plan of record"}`, children: [
          /* @__PURE__ */ jsx10("div", { className: "qcards", children: cfg.queues.map((q) => /* @__PURE__ */ jsx10(QueueCard, { q, s: week.queues[q.id] }, q.id)) }),
          /* @__PURE__ */ jsx10("hr", { className: "sep", style: { margin: "14px 0" } }),
          /* @__PURE__ */ jsxs9("div", { className: "stat-row", children: [
            /* @__PURE__ */ jsxs9("div", { className: "stat", children: [
              /* @__PURE__ */ jsx10("div", { className: "l", children: "Week run cost" }),
              /* @__PURE__ */ jsx10("div", { className: "v", children: money(cur, week.totals.totalCost) })
            ] }),
            /* @__PURE__ */ jsxs9("div", { className: "stat", children: [
              /* @__PURE__ */ jsx10("div", { className: "l", children: "Week churn cost" }),
              /* @__PURE__ */ jsx10("div", { className: "v", children: money(cur, week.totals.churnCost) })
            ] }),
            /* @__PURE__ */ jsxs9("div", { className: "stat", children: [
              /* @__PURE__ */ jsx10("div", { className: "l", children: "Active FTE" }),
              /* @__PURE__ */ jsxs9("div", { className: "v", children: [
                num(week.totals.active != null ? week.totals.active : week.totals.paid, 0),
                " ",
                /* @__PURE__ */ jsxs9("small", { children: [
                  "/ ",
                  num(week.totals.reqFte, 0),
                  " req"
                ] })
              ] })
            ] }),
            /* @__PURE__ */ jsxs9("div", { className: "stat", children: [
              /* @__PURE__ */ jsx10("div", { className: "l", children: "Horizon all-in" }),
              /* @__PURE__ */ jsx10("div", { className: "v", children: money(cur, sm.allIn) })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsx10(HiringSummary, { sim, cur }),
        /* @__PURE__ */ jsxs9("div", { className: "grid cols-2", children: [
          /* @__PURE__ */ jsx10(CoverageChart, { sim, selectedWeek: wk }),
          /* @__PURE__ */ jsx10(HeadcountChart, { sim, selectedWeek: wk }),
          /* @__PURE__ */ jsx10(VolumeChart, { sim, selectedWeek: wk }),
          /* @__PURE__ */ jsx10(CostChart, { sim, selectedWeek: wk }),
          /* @__PURE__ */ jsx10(IdleChurnChart, { sim, selectedWeek: wk }),
          /* @__PURE__ */ jsx10(BurnoutChart, { sim, selectedWeek: wk })
        ] }),
        /* @__PURE__ */ jsx10(HolisticPanel, { sim })
      ]
    }
  );
}

// ui/components/DataTab.jsx
import { useState as useState8 } from "react";

// ui/exports.js
var import_engine7 = __toESM(require_engine());
import * as XLSX from "xlsx";
var ENGINE_KEYS = ["horizonWeeks", "occupancyCeiling", "currency", "dayStart", "dayEnd", "intervalMin", "daysPerWeek", "hoursPerFteDay", "daysWorkedPerFte", "crossSkillProficiency"];
var QUEUE_KEYS = ["name", "type", "dailyVolume", "aht", "asaTarget", "maxAbandon", "patience", "concurrency", "digitalSlaMinutes", "digitalSlaPct", "backlogLimit", "shrinkage", "fte", "agentCost", "deflectsTo"];
var WF_KEYS = ["attrition", "attritionGrowth", "reqToStart", "trainingWeeks"];
var BURN_KEYS = ["occThreshold", "sensitivity", "recovery", "maxAttritionMult", "absenceUplift"];
function flattenParameters(config) {
  const rows = [];
  const add = (path, setting, value) => rows.push({ path, setting, value });
  for (const k of ENGINE_KEYS) add("engine." + k, "Engine \xB7 " + k, config.engine[k]);
  add("hiring.cap", "Hiring \xB7 global cap", config.hiring.cap);
  add("hiring.buffer", "Hiring \xB7 buffer", config.hiring.buffer);
  add("costs.managerCost", "Costs \xB7 manager cost", config.costs.managerCost);
  add("costs.managerRatio", "Costs \xB7 manager ratio", config.costs.managerRatio);
  for (const k of ["customerBase", "costPerLostCustomer", "churnAbandon", "churnWait", "churnDigital", "repeatUplift"]) add("cx." + k, "CX \xB7 " + k, config.cx[k]);
  add("loops.redial", "Loops \xB7 redial", config.loops.redial);
  add("loops.deflection", "Loops \xB7 deflection", config.loops.deflection);
  add("seasonality.startMonth", "Seasonality \xB7 start month", config.seasonality.startMonth);
  for (const q of config.queues) {
    for (const k of QUEUE_KEYS) add(`queues.${q.id}.${k}`, `${q.name} \xB7 ${k}`, q[k]);
    for (const k of WF_KEYS) add(`queues.${q.id}.wf.${k}`, `${q.name} \xB7 wf.${k}`, q.wf[k]);
    for (const k of BURN_KEYS) add(`queues.${q.id}.burn.${k}`, `${q.name} \xB7 burn.${k}`, q.burn[k]);
  }
  return rows;
}
var coerce = (prev, raw) => {
  if (raw === "" || raw == null) return prev === null || typeof prev === "object" ? null : raw;
  if (typeof prev === "number") {
    const n = Number(raw);
    return Number.isNaN(n) ? prev : n;
  }
  if (typeof prev === "boolean") return String(raw).toLowerCase() === "true";
  return raw;
};
function applyParameter(config, path, rawValue) {
  const parts = path.split(".");
  const next = { ...config };
  if (parts[0] === "queues") {
    const [, id, ...rest] = parts;
    const idx = config.queues.findIndex((q2) => q2.id === id);
    if (idx < 0) return config;
    const queues = config.queues.slice();
    let q = { ...queues[idx] };
    if (rest.length === 1) {
      q[rest[0]] = coerce(q[rest[0]], rawValue);
    } else if (rest.length === 2 && (rest[0] === "wf" || rest[0] === "burn")) {
      q[rest[0]] = { ...q[rest[0]], [rest[1]]: coerce(q[rest[0]][rest[1]], rawValue) };
    } else return config;
    queues[idx] = q;
    next.queues = queues;
    return next;
  }
  const [group, key] = parts;
  if (!next[group] || !(key in next[group])) return config;
  next[group] = { ...next[group], [key]: coerce(next[group][key], rawValue) };
  return next;
}
function applyParameters(config, rows) {
  return rows.reduce((c, r) => applyParameter(c, r.path, r.value), config);
}
function volumesAOA(config) {
  const N = config.engine.horizonWeeks;
  const rawBase = (q, w) => q.weeklyVolumes && q.weeklyVolumes[w] != null ? q.weeklyVolumes[w] : q.dailyVolume;
  const header = ["Week", ...config.queues.map((q) => q.name)];
  const rows = [];
  for (let w = 0; w < N; w++) rows.push([w + 1, ...config.queues.map((q) => Math.round(rawBase(q, w)))]);
  return [header, ...rows];
}
function applyVolumes(config, aoa) {
  if (!aoa || aoa.length < 2) return config;
  const header = aoa[0];
  const queues = config.queues.map((q) => ({ ...q }));
  for (let c = 1; c < header.length; c++) {
    const name = String(header[c]).trim();
    const q = queues.find((x) => x.name === name);
    if (!q) continue;
    const vals = [];
    for (let r = 1; r < aoa.length; r++) vals.push(Number(aoa[r][c]) || 0);
    q.weeklyVolumes = vals;
  }
  return { ...config, queues };
}
function summaryAOA(sim, strategySims, activeStrategyId, activeViewId, config) {
  const cur = config.engine.currency;
  const v = buildVerdict(strategySims, activeStrategyId, activeViewId, config);
  const sm = sim.summary;
  return [
    ["Capacity simulation \u2014 summary"],
    ["Active strategy", activeStrategyId],
    ["Recommended strategy", v.recommended || ""],
    ["Horizon weeks", sim.weeks.length],
    ["Queue-weeks green", v.rag.green],
    ["Queue-weeks amber", v.rag.amber],
    ["Queue-weeks red", v.rag.red],
    ["Total run cost", Math.round(sm.totalCost)],
    ["Churn cost", Math.round(sm.churnCost)],
    ["Idle pay", Math.round(sm.waste)],
    ["All-in cost", Math.round(sm.allIn)],
    ["Customers lost", Math.round(sm.lost)],
    ["Currency", cur],
    ["Verdict", v.paragraph]
  ];
}
function strategyAOA(strategySims, config) {
  const cur = config.engine.currency;
  const head = ["Strategy", "Name", "Red weeks", "End HC", "Run cost", "Churn", "All-in", "Feasible"];
  const rows = STRATEGIES.filter((s) => strategySims[s.id]).map((s) => {
    const st = strategyStats(strategySims[s.id]);
    return [s.id, s.name, st.redWeeks, Math.round(st.endHC), Math.round(st.runCost), Math.round(st.churn), Math.round(st.allIn), st.feasible ? "yes" : "no"];
  });
  return [head, ...rows];
}
function findingsAOA(sim, config) {
  const out = [["Findings"], ["Tone", "Finding"]];
  for (const f of sim.summary.findings) out.push([f.tone, f.text]);
  out.push([], ["Risk register"], ["Risk", "Driver", "Week", "Severity", "SLA impact", "Suggested lever"]);
  for (const r of buildRiskRegister(sim, config)) {
    out.push([r.risk, r.driver, r.week ?? "", r.severityMoney != null ? Math.round(r.severityMoney) : "", r.sla || "", r.lever]);
  }
  return out;
}
function queueAOA(sim, queue, config) {
  const cols = columnsFor(queue, config.engine.currency);
  const rows = buildWeeklyRows(sim, queue, config);
  const header = cols.map((c) => c.label);
  const body = rows.map((row) => cols.map((c) => {
    const v = row[c.key];
    if (c.key === "status" || c.key === "week") return v;
    return typeof v === "number" ? +Number(v).toFixed(4) : v;
  }));
  return [header, ...body];
}
function brandsAOA(config) {
  const out = [["Brand", "ID", "Training weeks", "Training shrinkage %", "Brand daily volume"]];
  for (const b of config.brands || []) {
    const tr = b.training || {};
    out.push([b.name, b.id, tr.trainingWeeks ?? "(inherit)", tr.trainingShrinkagePct != null ? +(tr.trainingShrinkagePct * 100).toFixed(1) : "(inherit)", b.dailyVolume ?? "(per-queue)"]);
  }
  return out;
}
function poolsAOA(config) {
  const out = [["Pool", "ID", "Member queue", "Share %"]];
  const nameOf = (id) => (config.queues.find((q) => q.id === id) || { name: id }).name;
  for (const p of config.pools || []) {
    if (!(p.members || []).length) {
      out.push([p.name, p.id, "(no members)", ""]);
      continue;
    }
    for (const m of p.members) out.push([p.name, p.id, nameOf(m.queueId), m.sharePct != null ? m.sharePct : 100]);
  }
  return out;
}
function profilesAOA(config) {
  const out = [["Queue", "Segment", "Share %", "AHT (s)"]];
  for (const q of config.queues) {
    const segs = q.volumeProfile && q.volumeProfile.segments;
    if (!segs || !segs.length) {
      out.push([q.name, "(single \u2014 blended = base AHT)", 100, q.aht]);
      continue;
    }
    for (const s of segs) out.push([q.name, s.label || "segment", s.sharePct, s.aht]);
  }
  return out;
}
function groupsAOA(config) {
  const out = [["Group", "ID", "Built-in", "Scenarios"]];
  const nameOf = (id) => (config.scenarios.find((s) => s.id === id) || { name: id }).name;
  for (const g of config.groups || []) {
    const list = Array.isArray(g.scenarioIds) ? g.scenarioIds.map(nameOf).join("; ") : "(tracks enabled set)";
    out.push([g.name, g.id, g.builtin ? "yes" : "no", list || "(none)"]);
  }
  return out;
}
function buildWorkbook(sim, strategySims, config, activeStrategyId, activeViewId) {
  const wb = XLSX.utils.book_new();
  const S = (aoa, name) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
  S(summaryAOA(sim, strategySims, activeStrategyId, activeViewId, config), "Summary");
  S(strategyAOA(strategySims, config), "Strategy comparison");
  S(findingsAOA(sim, config), "Findings & risks");
  S(brandsAOA(config), "Brands");
  S(poolsAOA(config), "Pools");
  S(profilesAOA(config), "Profiles");
  S(groupsAOA(config), "Groups");
  S([["Path", "Setting", "Value"], ...flattenParameters(config).map((r) => [r.path, r.setting, r.value])], "Parameters");
  S(volumesAOA(config), "Volumes");
  const used = /* @__PURE__ */ new Set(["Summary", "Strategy comparison", "Findings & risks", "Brands", "Pools", "Profiles", "Groups", "Parameters", "Volumes"]);
  for (const q of config.queues) {
    let name = q.name.replace(/[\\/?*[\]:]/g, " ").slice(0, 28) || q.id;
    let n = name, i = 2;
    while (used.has(n)) n = (name.slice(0, 25) + " " + i++).slice(0, 31);
    used.add(n);
    S(queueAOA(sim, q, config), n);
  }
  return new Uint8Array(XLSX.write(wb, { bookType: "xlsx", type: "array" }));
}
function parseWorkbook(bytes) {
  const wb = XLSX.read(bytes, { type: "array" });
  const out = { params: [], volumes: null, sheetNames: wb.SheetNames };
  if (wb.Sheets["Parameters"]) {
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets["Parameters"], { header: 1 });
    for (let r = 1; r < aoa.length; r++) {
      const [path, , value] = aoa[r];
      if (path) out.params.push({ path: String(path), value });
    }
  }
  if (wb.Sheets["Volumes"]) out.volumes = XLSX.utils.sheet_to_json(wb.Sheets["Volumes"], { header: 1 });
  return out;
}
function applyWorkbookImport(config, parsed) {
  let c = config;
  if (parsed.params && parsed.params.length) c = applyParameters(c, parsed.params);
  if (parsed.volumes) c = applyVolumes(c, parsed.volumes);
  return c;
}
var csvCell = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
var toCSV = (aoa) => aoa.map((row) => row.map(csvCell).join(",")).join("\n");
function queueCSV(sim, queue, config) {
  const cols = columnsFor(queue, config.engine.currency);
  const rows = buildWeeklyRows(sim, queue, config);
  return toCSV([cols.map((c) => c.label), ...rows.map((row) => cols.map((c) => c.fmt(row[c.key])))]);
}
function parametersCSV(config) {
  return toCSV([["Path", "Setting", "Value"], ...flattenParameters(config).map((r) => [r.path, r.setting, r.value])]);
}
function volumesCSV(config) {
  return toCSV(volumesAOA(config));
}
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length && !(r.length === 1 && r[0] === ""));
}
function parseParametersCSV(text) {
  const rows = parseCSV(text);
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const [path, , value] = rows[i];
    if (path) out.push({ path: String(path).trim(), value });
  }
  return out;
}
var configJSON = (config) => JSON.stringify(config, null, 2);
function runJSON(sim, config) {
  return JSON.stringify({ kind: "capacity-run", savedAt: null, config, run: (0, import_engine7.compactRun)(config, sim) }, null, 2);
}
function parseConfigJSON(text) {
  const c = JSON.parse(text);
  if (!c || !Array.isArray(c.queues) || !c.engine) throw new Error("Not a valid config file");
  return c;
}
function parseRunJSON(text) {
  const o = JSON.parse(text);
  if (!o || o.kind !== "capacity-run" || !o.config) throw new Error("Not a valid saved-run file");
  return o;
}
function anchorDownload(filename, blob) {
  const a = document.createElement("a");
  const url = typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(blob) : "";
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (url && URL.revokeObjectURL) setTimeout(() => URL.revokeObjectURL(url), 0);
}
function downloadBytes(filename, u8, mime = "application/octet-stream") {
  anchorDownload(filename, new Blob([u8], { type: mime }));
}
function downloadText(filename, text, mime = "text/plain") {
  anchorDownload(filename, new Blob([text], { type: mime }));
}

// ui/components/DataTab.jsx
import { Fragment as Fragment4, jsx as jsx11, jsxs as jsxs10 } from "react/jsx-runtime";
var DEFAULT_GROUP_COLOURS = {
  Week: "#7a828a",
  Demand: "#0e7c86",
  Service: "#3a7bd5",
  People: "#5a54c9",
  Supply: "#10966e",
  Money: "#d98a0b",
  Status: "#7a828a"
};
function hexToRgba(hex, a) {
  const h = (hex || "#888888").replace("#", "");
  const n = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r || 0},${g || 0},${b || 0},${a})`;
}
function DataTab({ sim, config, ops, activeGroupId, onSelectGroup }) {
  const [qid, setQid] = useState8(config.queues[0] ? config.queues[0].id : "");
  const [hidden, setHidden] = useState8(() => /* @__PURE__ */ new Set());
  const [mode, setMode] = useState8("outputs");
  const queue = config.queues.find((q) => q.id === qid) || config.queues[0];
  if (!queue) return /* @__PURE__ */ jsx11("div", { className: "empty", children: "No queues configured." });
  const cur = config.engine.currency;
  const rows = buildWeeklyRows(sim, queue, config);
  const outCols = columnsFor(queue, cur).filter((c) => !hidden.has(c.group));
  const asmCols = assumptionsColumns(queue, cur);
  const colours = config.settings && config.settings.dataColours || {};
  const colourOf = (g) => colours[g] || DEFAULT_GROUP_COLOURS[g] || "#7a828a";
  const firstOfGroup = {};
  let prevGroup = null;
  for (const c of outCols) {
    if (c.group !== prevGroup) {
      firstOfGroup[c.key] = true;
      prevGroup = c.group;
    }
  }
  const toggleGroup = (g) => setHidden((h) => {
    const n = new Set(h);
    n.has(g) ? n.delete(g) : n.add(g);
    return n;
  });
  return /* @__PURE__ */ jsxs10("div", { className: "grid", style: { gap: 16 }, children: [
    /* @__PURE__ */ jsxs10(Card, { title: "Per-queue data", hint: "Every weekly datapoint. Input columns (the weekly volume series) are editable here and re-simulate; computed outcome columns are read-only.", children: [
      /* @__PURE__ */ jsxs10("div", { className: "fieldrow", style: { maxWidth: 720 }, children: [
        /* @__PURE__ */ jsx11(SelectField, { label: "Queue", value: queue.id, onChange: setQid, options: config.queues.map((q) => ({ value: q.id, label: q.name })) }),
        /* @__PURE__ */ jsx11(SelectField, { label: "Scenario group", value: activeGroupId, onChange: onSelectGroup, options: groupList(config).map((g) => ({ value: g.id, label: g.name })) }),
        /* @__PURE__ */ jsx11(SelectField, { label: "View", value: mode, onChange: setMode, options: [{ value: "outputs", label: "Outputs" }, { value: "assumptions", label: "Assumptions over time" }] })
      ] }),
      mode === "outputs" && /* @__PURE__ */ jsxs10(Fragment4, { children: [
        /* @__PURE__ */ jsxs10("div", { className: "rowflex", style: { marginTop: 12 }, children: [
          /* @__PURE__ */ jsxs10("span", { className: "lab", style: { display: "flex", alignItems: "center", gap: 6 }, children: [
            "Column groups ",
            /* @__PURE__ */ jsx11(Hint, { text: "Toggle groups of columns. All are on by default." })
          ] }),
          COLUMN_GROUPS.filter((g) => g !== "Week").map((g) => /* @__PURE__ */ jsxs10("label", { className: "switch", children: [
            /* @__PURE__ */ jsx11("input", { type: "checkbox", checked: !hidden.has(g), onChange: () => toggleGroup(g) }),
            /* @__PURE__ */ jsx11("span", { className: "track", "aria-hidden": "true" }),
            /* @__PURE__ */ jsx11("span", { children: g })
          ] }, g)),
          /* @__PURE__ */ jsx11("span", { className: "spacer" }),
          /* @__PURE__ */ jsx11("button", { type: "button", className: "btn sm", onClick: () => downloadText(`${queue.name.replace(/\s+/g, "_")}_weekly.csv`, queueCSV(sim, queue, config), "text/csv"), children: "Export CSV" })
        ] }),
        /* @__PURE__ */ jsxs10("div", { className: "rowflex", style: { marginTop: 10, gap: 14 }, "data-testid": "data-colours", children: [
          /* @__PURE__ */ jsxs10("span", { className: "lab", style: { display: "flex", alignItems: "center", gap: 6 }, children: [
            "Segment colours ",
            /* @__PURE__ */ jsx11(Hint, { text: "Pick a colour per column group. Saved with the config; the header underline and cell tint follow it." })
          ] }),
          COLUMN_GROUPS.filter((g) => g !== "Week").map((g) => /* @__PURE__ */ jsxs10("label", { className: "rowflex", style: { gap: 5 }, title: g, children: [
            /* @__PURE__ */ jsx11(
              "input",
              {
                type: "color",
                value: colourOf(g),
                "data-testid": "data-colour-" + g,
                onChange: (e) => ops.patch(["settings", "dataColours", g], e.target.value),
                "aria-label": g + " colour",
                style: { width: 26, height: 22, padding: 0, border: "1px solid var(--line-2)", borderRadius: 5 }
              }
            ),
            /* @__PURE__ */ jsx11("span", { style: { fontSize: 11, color: "var(--muted)" }, children: g })
          ] }, g))
        ] })
      ] })
    ] }),
    mode === "outputs" ? /* @__PURE__ */ jsx11(Card, { title: `${queue.name} \u2014 weekly`, sub: `${rows.length} weeks \xB7 ${outCols.length} columns`, children: /* @__PURE__ */ jsx11("div", { className: "tbl-wrap", style: { maxHeight: 560 }, children: /* @__PURE__ */ jsxs10("table", { className: "data grouped seg", "data-testid": "data-table", children: [
      /* @__PURE__ */ jsx11("thead", { children: /* @__PURE__ */ jsx11("tr", { children: outCols.map((c) => /* @__PURE__ */ jsxs10(
        "th",
        {
          className: "grp-" + c.group.toLowerCase() + (firstOfGroup[c.key] ? " seg-first" : "") + (c.input ? " col-input" : ""),
          style: { borderBottom: "2px solid " + colourOf(c.group) },
          children: [
            c.label,
            c.input ? " \u270E" : ""
          ]
        },
        c.key
      )) }) }),
      /* @__PURE__ */ jsx11("tbody", { children: rows.map((row) => /* @__PURE__ */ jsx11("tr", { children: outCols.map((c) => {
        const tint = { background: hexToRgba(colourOf(c.group), 0.06) };
        const base = "grp-" + c.group.toLowerCase() + (firstOfGroup[c.key] ? " seg-first" : "");
        if (c.input === "volume") {
          return /* @__PURE__ */ jsx11("td", { className: base + " col-input", style: tint, children: /* @__PURE__ */ jsx11(
            "input",
            {
              type: "number",
              className: "cell-inp",
              value: row.volInput == null ? "" : Math.round(row.volInput),
              "data-testid": "cell-vol-" + row.week,
              onChange: (e) => ops.patchWeeklyVolume(queue.id, row.week - 1, e.target.value === "" ? 0 : Number(e.target.value)),
              "aria-label": "Week " + row.week + " volume"
            }
          ) }, c.key);
        }
        return /* @__PURE__ */ jsx11("td", { className: base + " cell-ro" + (c.key === "status" ? " st-" + row.status : ""), style: tint, "data-ro": "1", "data-testid": c.key === "cover" ? "cell-cover-" + row.week : void 0, children: c.fmt(row[c.key]) }, c.key);
      }) }, row.week)) })
    ] }) }) }) : /* @__PURE__ */ jsx11(Card, { title: `${queue.name} \u2014 assumptions in effect`, sub: "inputs in force", hint: "The resolved inputs the engine used each week: volume after profile/seasonality/scenarios, blended AHT, SLA, attrition, training shrinkage and the active scenario tags.", children: /* @__PURE__ */ jsx11("div", { className: "tbl-wrap", style: { maxHeight: 560 }, children: /* @__PURE__ */ jsxs10("table", { className: "data", "data-testid": "assumptions-table", children: [
      /* @__PURE__ */ jsx11("thead", { children: /* @__PURE__ */ jsx11("tr", { children: asmCols.map((c) => /* @__PURE__ */ jsx11("th", { children: c.label }, c.key)) }) }),
      /* @__PURE__ */ jsx11("tbody", { children: rows.map((row) => /* @__PURE__ */ jsx11("tr", { children: asmCols.map((c) => /* @__PURE__ */ jsx11("td", { style: c.key === "scenarioTags" ? { textAlign: "left" } : void 0, children: c.fmt(row[c.key]) }, c.key)) }, row.week)) })
    ] }) }) })
  ] });
}

// ui/components/IntradayTab.jsx
import { useState as useState9 } from "react";
import { BarChart as BarChart2, Bar as Bar2, ComposedChart as ComposedChart2, Line as Line3, XAxis as XAxis3, YAxis as YAxis3, CartesianGrid as CartesianGrid3, Tooltip as Tooltip3, Legend as Legend3 } from "recharts";
import { Fragment as Fragment5, jsx as jsx12, jsxs as jsxs11 } from "react/jsx-runtime";
function IntradayTab({ sim }) {
  const cfg = sim.config;
  const eng = cfg.engine;
  const [qid, setQid] = useState9(cfg.queues[0] ? cfg.queues[0].id : "");
  const [wk, setWk] = useState9(0);
  const q = cfg.queues.find((x) => x.id === qid) || cfg.queues[0];
  if (!q) return /* @__PURE__ */ jsx12("div", { className: "empty", children: "No queues configured." });
  const week = sim.weeks[Math.min(wk, sim.weeks.length - 1)];
  const day = week.intraday;
  const byInterval = day && day.res[q.id] && day.res[q.id].byInterval || [];
  const voice = q.type === "voice";
  const data = byInterval.map((iv) => ({
    t: intervalLabel(iv.i, eng),
    required: +iv.req.toFixed(2),
    available: +iv.agents.toFixed(2),
    arrivals: Math.round(iv.arrivals)
  }));
  return /* @__PURE__ */ jsxs11("div", { className: "grid", style: { gap: 16 }, children: [
    /* @__PURE__ */ jsxs11(Card, { title: "Intraday view", sub: "first day of the selected week", hint: "Pick a queue, then click any week in the strip \u2014 coloured by that queue's SLA verdict \u2014 to load its first-day intraday profile.", children: [
      /* @__PURE__ */ jsx12("div", { className: "fieldrow", style: { maxWidth: 320, marginBottom: 12 }, children: /* @__PURE__ */ jsx12(
        SelectField,
        {
          label: "Queue",
          value: q.id,
          onChange: setQid,
          options: cfg.queues.map((x) => ({ value: x.id, label: x.name }))
        }
      ) }),
      /* @__PURE__ */ jsxs11("div", { className: "lab", style: { marginBottom: 6 }, children: [
        "Weeks \u2014 ",
        q.name,
        " (click to load)"
      ] }),
      /* @__PURE__ */ jsx12("div", { className: "week-strip", "data-testid": "week-strip", children: sim.weeks.map((w) => {
        const st = w.queues[q.id].status;
        const sel = w.week === Math.min(wk, sim.weeks.length - 1);
        return /* @__PURE__ */ jsx12(
          "button",
          {
            type: "button",
            className: "wk-cell" + (sel ? " sel" : ""),
            "data-st": st,
            "aria-pressed": sel,
            "aria-label": `Week ${w.week + 1}: ${st}`,
            onClick: () => setWk(w.week),
            children: w.week + 1
          },
          w.week
        );
      }) })
    ] }),
    /* @__PURE__ */ jsx12(Chart, { title: `Required vs available agents \u2014 ${q.name}`, hint: "Available agent-hours are laid along the requirement curve (engineering note E2), so quiet intervals still receive proportionally more agents. Bars are required; the line is available.", children: (w, h) => /* @__PURE__ */ jsxs11(ComposedChart2, { width: w, height: h, data, margin: { top: 8, right: 14, left: 4, bottom: 4 }, children: [
      /* @__PURE__ */ jsx12(CartesianGrid3, { strokeDasharray: "3 3", stroke: "#eef2f5" }),
      /* @__PURE__ */ jsx12(XAxis3, { dataKey: "t", tick: { fontSize: 10 }, interval: "preserveStartEnd", minTickGap: 16 }),
      /* @__PURE__ */ jsx12(YAxis3, { tick: { fontSize: 11 }, width: 40 }),
      /* @__PURE__ */ jsx12(Tooltip3, {}),
      /* @__PURE__ */ jsx12(Legend3, { wrapperStyle: { fontSize: 11 } }),
      /* @__PURE__ */ jsx12(Bar2, { dataKey: "required", name: "Required agents", fill: "#0e7c86", isAnimationActive: false }),
      /* @__PURE__ */ jsx12(Line3, { type: "monotone", dataKey: "available", name: "Available agents", stroke: "#d98a0b", strokeWidth: 2, dot: false, isAnimationActive: false })
    ] }) }),
    /* @__PURE__ */ jsx12(Card, { title: "Interval detail", sub: `${q.name} \xB7 week ${Math.min(wk, sim.weeks.length - 1) + 1}`, children: /* @__PURE__ */ jsx12("div", { className: "tbl-wrap", style: { maxHeight: 460 }, children: /* @__PURE__ */ jsxs11("table", { className: "data", children: [
      /* @__PURE__ */ jsx12("thead", { children: /* @__PURE__ */ jsxs11("tr", { children: [
        /* @__PURE__ */ jsx12("th", { children: "Interval" }),
        /* @__PURE__ */ jsx12("th", { children: "Arrivals" }),
        /* @__PURE__ */ jsx12("th", { children: "Required" }),
        /* @__PURE__ */ jsx12("th", { children: "Available" }),
        voice ? /* @__PURE__ */ jsxs11(Fragment5, { children: [
          /* @__PURE__ */ jsx12("th", { children: "ASA" }),
          /* @__PURE__ */ jsx12("th", { children: "Abandon" }),
          /* @__PURE__ */ jsx12("th", { children: "SL" })
        ] }) : /* @__PURE__ */ jsxs11(Fragment5, { children: [
          /* @__PURE__ */ jsx12("th", { children: "Backlog" }),
          /* @__PURE__ */ jsx12("th", { children: "Response" }),
          /* @__PURE__ */ jsx12("th", { children: "Served" })
        ] }),
        /* @__PURE__ */ jsx12("th", { children: "Occupancy" })
      ] }) }),
      /* @__PURE__ */ jsxs11("tbody", { children: [
        byInterval.map((iv) => /* @__PURE__ */ jsxs11("tr", { children: [
          /* @__PURE__ */ jsx12("td", { children: intervalLabel(iv.i, eng) }),
          /* @__PURE__ */ jsx12("td", { children: Math.round(iv.arrivals) }),
          /* @__PURE__ */ jsx12("td", { children: num(iv.req, 1) }),
          /* @__PURE__ */ jsx12("td", { children: num(iv.agents, 1) }),
          voice ? /* @__PURE__ */ jsxs11(Fragment5, { children: [
            /* @__PURE__ */ jsx12("td", { children: secs(iv.asa) }),
            /* @__PURE__ */ jsx12("td", { children: pct(iv.abandon, 1) }),
            /* @__PURE__ */ jsx12("td", { children: pct(iv.sl) })
          ] }) : /* @__PURE__ */ jsxs11(Fragment5, { children: [
            /* @__PURE__ */ jsx12("td", { children: num(iv.backlog, 0) }),
            /* @__PURE__ */ jsxs11("td", { children: [
              num(iv.resp || 0, 1),
              "m"
            ] }),
            /* @__PURE__ */ jsx12("td", { children: num(iv.served || 0, 0) })
          ] }),
          /* @__PURE__ */ jsx12("td", { children: pct(iv.occ) })
        ] }, iv.i)),
        byInterval.length === 0 && /* @__PURE__ */ jsx12("tr", { children: /* @__PURE__ */ jsx12("td", { colSpan: 8, className: "empty", children: "No intraday detail for this selection." }) })
      ] })
    ] }) }) })
  ] });
}

// ui/components/SnapshotsTab.jsx
import { useState as useState11 } from "react";
import { LineChart as LineChart3, Line as Line4, XAxis as XAxis4, YAxis as YAxis4, CartesianGrid as CartesianGrid4, Tooltip as Tooltip4, Legend as Legend4 } from "recharts";

// ui/components/FilesCard.jsx
import { useState as useState10, useRef as useRef3 } from "react";
import { jsx as jsx13, jsxs as jsxs12 } from "react/jsx-runtime";
var readArrayBuffer = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(new Uint8Array(r.result));
  r.onerror = rej;
  r.readAsArrayBuffer(file);
});
var readText = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = rej;
  r.readAsText(file);
});
function FilesCard({ sim, strategySims, config, activeStrategy, activeViewId, onImportConfig, title = "Files" }) {
  const [msg, setMsg] = useState10(null);
  const wbInput = useRef3(null), cfgInput = useRef3(null), runInput = useRef3(null), csvInput = useRef3(null);
  const say = (text, tone = "ok") => setMsg({ text, tone });
  const onWorkbook = () => {
    const bytes = buildWorkbook(sim, strategySims, config, activeStrategy, activeViewId);
    downloadBytes("capacity-plan.xlsx", bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  };
  const importWorkbook = async (file) => {
    try {
      const parsed = parseWorkbook(await readArrayBuffer(file));
      onImportConfig(applyWorkbookImport(config, parsed));
      say(`Imported ${parsed.params.length} parameter(s)${parsed.volumes ? " and volumes" : ""}.`);
    } catch (e) {
      say("Workbook import failed: " + e.message, "err");
    }
  };
  const importConfig = async (file) => {
    try {
      onImportConfig(parseConfigJSON(await readText(file)));
      say("Config imported.");
    } catch (e) {
      say("Config import failed: " + e.message, "err");
    }
  };
  const importRun = async (file) => {
    try {
      const o = parseRunJSON(await readText(file));
      onImportConfig(o.config);
      say("Saved run loaded \u2014 its config is now active.");
    } catch (e) {
      say("Run import failed: " + e.message, "err");
    }
  };
  const importParamsCSV = async (file) => {
    try {
      const rows = parseParametersCSV(await readText(file));
      onImportConfig(applyParameters(config, rows));
      say(`Imported ${rows.length} parameter(s) from CSV.`);
    } catch (e) {
      say("Parameters CSV import failed: " + e.message, "err");
    }
  };
  const Section = ({ label, hint, children }) => /* @__PURE__ */ jsxs12("div", { className: "files-row", children: [
    /* @__PURE__ */ jsxs12("div", { className: "files-row-h", children: [
      /* @__PURE__ */ jsx13("strong", { children: label }),
      hint ? /* @__PURE__ */ jsx13("span", { className: "note", style: { background: "none", border: 0, padding: 0 }, children: hint }) : null
    ] }),
    /* @__PURE__ */ jsx13("div", { className: "btnbar", children })
  ] });
  return /* @__PURE__ */ jsxs12(Card, { title, hint: "One workbook round-trips Parameters and Volumes; config and saved-run JSON share whole plans; CSVs are plain-text fallbacks.", children: [
    /* @__PURE__ */ jsxs12("div", { className: "grid", style: { gap: 14 }, children: [
      /* @__PURE__ */ jsxs12(Section, { label: "Excel package", hint: "One workbook carries every sheet; re-import reads only Parameters and Volumes.", children: [
        /* @__PURE__ */ jsx13("button", { type: "button", className: "btn primary", "data-testid": "export-workbook", onClick: onWorkbook, children: "Export workbook" }),
        /* @__PURE__ */ jsx13("button", { type: "button", className: "btn", onClick: () => wbInput.current && wbInput.current.click(), children: "Import workbook" }),
        /* @__PURE__ */ jsx13("button", { type: "button", className: "btn", "data-testid": "export-params-csv", onClick: () => downloadText("parameters.csv", parametersCSV(config), "text/csv"), children: "Parameters CSV" }),
        /* @__PURE__ */ jsx13("button", { type: "button", className: "btn", "data-testid": "export-volumes-csv", onClick: () => downloadText("volumes.csv", volumesCSV(config), "text/csv"), children: "Volumes CSV" }),
        /* @__PURE__ */ jsx13("button", { type: "button", className: "btn", onClick: () => csvInput.current && csvInput.current.click(), children: "Import parameters CSV" })
      ] }),
      /* @__PURE__ */ jsxs12(Section, { label: "Config JSON", hint: "The whole plan as JSON \u2014 export to share, import to replace.", children: [
        /* @__PURE__ */ jsx13("button", { type: "button", className: "btn", "data-testid": "export-config", onClick: () => downloadText("capacity-config.json", configJSON(config), "application/json"), children: "Export config" }),
        /* @__PURE__ */ jsx13("button", { type: "button", className: "btn", onClick: () => cfgInput.current && cfgInput.current.click(), children: "Import config" })
      ] }),
      /* @__PURE__ */ jsxs12(Section, { label: "Run files", hint: "A saved run bundles the config with its results; importing one makes that config active.", children: [
        /* @__PURE__ */ jsx13("button", { type: "button", className: "btn", "data-testid": "export-run", onClick: () => downloadText("capacity-run.json", runJSON(sim, config), "application/json"), children: "Export run" }),
        /* @__PURE__ */ jsx13("button", { type: "button", className: "btn", onClick: () => runInput.current && runInput.current.click(), children: "Import run" })
      ] }),
      /* @__PURE__ */ jsx13("input", { ref: wbInput, type: "file", accept: ".xlsx", "data-testid": "import-workbook", style: { display: "none" }, onChange: (e) => e.target.files[0] && importWorkbook(e.target.files[0]) }),
      /* @__PURE__ */ jsx13("input", { ref: cfgInput, type: "file", accept: ".json", "data-testid": "import-config", style: { display: "none" }, onChange: (e) => e.target.files[0] && importConfig(e.target.files[0]) }),
      /* @__PURE__ */ jsx13("input", { ref: runInput, type: "file", accept: ".json", "data-testid": "import-run", style: { display: "none" }, onChange: (e) => e.target.files[0] && importRun(e.target.files[0]) }),
      /* @__PURE__ */ jsx13("input", { ref: csvInput, type: "file", accept: ".csv", "data-testid": "import-params-csv", style: { display: "none" }, onChange: (e) => e.target.files[0] && importParamsCSV(e.target.files[0]) })
    ] }),
    msg && /* @__PURE__ */ jsx13("p", { className: "note", style: { marginTop: 12, color: msg.tone === "err" ? "var(--red)" : void 0 }, children: msg.text })
  ] });
}

// ui/components/SnapshotsTab.jsx
import { Fragment as Fragment6, jsx as jsx14, jsxs as jsxs13 } from "react/jsx-runtime";
var SERIES3 = ["#0e7c86", "#d98a0b", "#5a54c9", "#c0417a"];
var dt = (iso) => {
  try {
    return iso.replace("T", " ").slice(0, 16);
  } catch (e) {
    return iso;
  }
};
function SnapshotsTab({ snapshots, storageMode, storageNotice, compareSel, setCompareSel, onSave, onLoadSettings, onDelete, onRefresh, config, sim, sims, activeStrategy, activeViewId, onImportConfig }) {
  const [name, setName] = useState11("");
  const cur = config.engine.currency;
  const toggle = (slug) => setCompareSel((sel) => sel.includes(slug) ? sel.filter((s) => s !== slug) : [...sel, slug]);
  const selected = snapshots.filter((r) => compareSel.includes(r.slug));
  return /* @__PURE__ */ jsxs13("div", { className: "grid", style: { gap: 16 }, children: [
    /* @__PURE__ */ jsxs13("p", { className: "note", "data-testid": "snapshots-copy", children: [
      /* @__PURE__ */ jsx14("strong", { children: "Snapshots" }),
      " are frozen results \u2014 capture the plan now to compare before/after or share it. ",
      /* @__PURE__ */ jsx14("strong", { children: "Views" }),
      " (top bar) are live scenario lenses on the current model, not saved."
    ] }),
    /* @__PURE__ */ jsxs13(
      Card,
      {
        title: "Snapshots",
        sub: `storage: ${storageMode}`,
        hint: "Save the current plan as a named snapshot, then tick snapshots to compare them.",
        right: /* @__PURE__ */ jsx14("button", { type: "button", className: "btn sm", onClick: onRefresh, children: "Refresh" }),
        children: [
          storageNotice && /* @__PURE__ */ jsx14("p", { className: "note", style: { marginBottom: 12, color: "var(--amber)" }, children: storageNotice }),
          /* @__PURE__ */ jsxs13("div", { className: "rowflex", children: [
            /* @__PURE__ */ jsx14("input", { type: "text", className: "inp", style: { maxWidth: 260 }, placeholder: "snapshot name", value: name, onChange: (e) => setName(e.target.value), "data-testid": "snapshot-name" }),
            /* @__PURE__ */ jsx14("button", { type: "button", className: "btn primary", "data-testid": "save-snapshot", disabled: !name.trim(), onClick: () => {
              onSave(name.trim());
              setName("");
            }, children: "Save current plan" })
          ] }),
          /* @__PURE__ */ jsx14("div", { className: "tbl-wrap", style: { marginTop: 14 }, children: /* @__PURE__ */ jsxs13("table", { className: "data", "data-testid": "snapshots-table", children: [
            /* @__PURE__ */ jsx14("thead", { children: /* @__PURE__ */ jsxs13("tr", { children: [
              /* @__PURE__ */ jsx14("th", { children: "Compare" }),
              /* @__PURE__ */ jsx14("th", { children: "Name" }),
              /* @__PURE__ */ jsx14("th", { children: "Saved" }),
              /* @__PURE__ */ jsx14("th", { children: "Strategy" }),
              /* @__PURE__ */ jsx14("th", { children: "All-in" }),
              /* @__PURE__ */ jsx14("th", { children: "Actions" })
            ] }) }),
            /* @__PURE__ */ jsxs13("tbody", { children: [
              snapshots.map((r) => /* @__PURE__ */ jsxs13("tr", { children: [
                /* @__PURE__ */ jsx14("td", { children: /* @__PURE__ */ jsxs13("label", { className: "switch", style: { justifyContent: "center" }, children: [
                  /* @__PURE__ */ jsx14("input", { type: "checkbox", checked: compareSel.includes(r.slug), onChange: () => toggle(r.slug), "data-testid": "tick-" + r.slug }),
                  /* @__PURE__ */ jsx14("span", { className: "track", "aria-hidden": "true" })
                ] }) }),
                /* @__PURE__ */ jsx14("td", { style: { textAlign: "left", fontWeight: 600 }, children: r.name }),
                /* @__PURE__ */ jsx14("td", { children: dt(r.savedAt) }),
                /* @__PURE__ */ jsx14("td", { children: r.strategy }),
                /* @__PURE__ */ jsx14("td", { children: money(cur, r.allIn) }),
                /* @__PURE__ */ jsx14("td", { children: /* @__PURE__ */ jsxs13("span", { className: "btnbar", children: [
                  /* @__PURE__ */ jsx14("button", { type: "button", className: "btn sm", onClick: () => onLoadSettings(r), children: "Load settings" }),
                  /* @__PURE__ */ jsx14("button", { type: "button", className: "btn sm", onClick: () => downloadText(`${r.slug}.json`, JSON.stringify({ kind: "capacity-run", savedAt: r.savedAt, config: r.config, run: r.run }, null, 2), "application/json"), children: "Download" }),
                  /* @__PURE__ */ jsx14("button", { type: "button", className: "btn sm danger", onClick: () => onDelete(r), children: "Delete" })
                ] }) })
              ] }, r.slug)),
              snapshots.length === 0 && /* @__PURE__ */ jsx14("tr", { children: /* @__PURE__ */ jsx14("td", { colSpan: 6, className: "empty", children: "No snapshots yet \u2014 save the current plan above." }) })
            ] })
          ] }) })
        ]
      }
    ),
    selected.length > 0 && /* @__PURE__ */ jsxs13(Card, { title: "Compare", sub: `${selected.length} snapshot(s) ticked`, hint: "Ticked snapshots compared side by side. Deltas are versus the first ticked snapshot.", children: [
      /* @__PURE__ */ jsx14(TotalsDelta, { runs: selected, cur }),
      /* @__PURE__ */ jsx14("h4", { style: { margin: "18px 0 6px", fontSize: 13 }, children: "Cumulative all-in cost" }),
      /* @__PURE__ */ jsx14(AllInOverlay, { runs: selected, cur }),
      /* @__PURE__ */ jsx14("h4", { style: { margin: "18px 0 6px", fontSize: 13 }, children: "Per-queue comparison (matched by name)" }),
      /* @__PURE__ */ jsx14(PerQueue, { runs: selected, cur })
    ] }),
    /* @__PURE__ */ jsx14(FilesCard, { sim, strategySims: sims, config, activeStrategy, activeViewId, onImportConfig, title: "Files" })
  ] });
}
function TotalsDelta({ runs, cur }) {
  const { rows, metrics } = totalsDelta(runs);
  const fmt = (k, v) => k === "endPaid" ? num(v, 0) : money(cur, v);
  return /* @__PURE__ */ jsx14("div", { className: "tbl-wrap", children: /* @__PURE__ */ jsxs13("table", { className: "data", "data-testid": "totals-delta", children: [
    /* @__PURE__ */ jsx14("thead", { children: /* @__PURE__ */ jsxs13("tr", { children: [
      /* @__PURE__ */ jsx14("th", { children: "Snapshot" }),
      metrics.map((m) => /* @__PURE__ */ jsx14("th", { children: m.label }, m.key))
    ] }) }),
    /* @__PURE__ */ jsx14("tbody", { children: rows.map((r) => /* @__PURE__ */ jsxs13("tr", { children: [
      /* @__PURE__ */ jsxs13("td", { style: { textAlign: "left", fontWeight: 600 }, children: [
        r.name,
        r.baseline ? " (baseline)" : ""
      ] }),
      metrics.map((m) => /* @__PURE__ */ jsxs13("td", { children: [
        fmt(m.key, r.values[m.key]),
        !r.baseline && /* @__PURE__ */ jsxs13("span", { style: { color: r.deltas[m.key] > 0 ? "var(--red)" : "var(--green)", fontSize: 11, marginLeft: 6 }, children: [
          r.deltas[m.key] > 0 ? "\u25B2" : "\u25BC",
          fmt(m.key, Math.abs(r.deltas[m.key]))
        ] })
      ] }, m.key))
    ] }, r.name)) })
  ] }) });
}
function AllInOverlay({ runs, cur }) {
  const data = allInOverlay(runs);
  return /* @__PURE__ */ jsx14(Chart, { title: "", height: 240, children: (w, h) => /* @__PURE__ */ jsxs13(LineChart3, { width: w, height: h, data, margin: { top: 8, right: 16, left: 8, bottom: 4 }, children: [
    /* @__PURE__ */ jsx14(CartesianGrid4, { strokeDasharray: "3 3", stroke: "#eef2f5" }),
    /* @__PURE__ */ jsx14(XAxis4, { dataKey: "wk", tick: { fontSize: 11 }, interval: "preserveStartEnd", minTickGap: 18 }),
    /* @__PURE__ */ jsx14(YAxis4, { tick: { fontSize: 11 }, width: 52, tickFormatter: (v) => money(cur, v) }),
    /* @__PURE__ */ jsx14(Tooltip4, { formatter: (v) => money(cur, v) }),
    /* @__PURE__ */ jsx14(Legend4, { wrapperStyle: { fontSize: 11 } }),
    runs.map((r, i) => /* @__PURE__ */ jsx14(Line4, { type: "monotone", dataKey: r.slug, name: r.name, stroke: SERIES3[i % SERIES3.length], dot: false, strokeWidth: 2, isAnimationActive: false }, r.slug))
  ] }) });
}
function PerQueue({ runs, cur }) {
  const blocks = perQueueBlocks(runs);
  return /* @__PURE__ */ jsx14("div", { className: "grid", style: { gap: 12 }, "data-testid": "per-queue-compare", children: blocks.map((b) => /* @__PURE__ */ jsxs13("div", { className: "erow", children: [
    /* @__PURE__ */ jsx14("div", { className: "erow-h", children: /* @__PURE__ */ jsx14("strong", { children: b.name }) }),
    /* @__PURE__ */ jsx14("div", { className: "erow-b", children: /* @__PURE__ */ jsx14("div", { className: "tbl-wrap", children: /* @__PURE__ */ jsxs13("table", { className: "data", children: [
      /* @__PURE__ */ jsx14("thead", { children: /* @__PURE__ */ jsxs13("tr", { children: [
        /* @__PURE__ */ jsx14("th", { children: "Snapshot" }),
        /* @__PURE__ */ jsx14("th", { children: "Red wks" }),
        /* @__PURE__ */ jsx14("th", { children: "Avg cover" }),
        /* @__PURE__ */ jsx14("th", { children: "Worst" }),
        /* @__PURE__ */ jsx14("th", { children: "Cost" }),
        /* @__PURE__ */ jsx14("th", { children: "Churn" })
      ] }) }),
      /* @__PURE__ */ jsx14("tbody", { children: b.cells.map((c, i) => /* @__PURE__ */ jsxs13("tr", { children: [
        /* @__PURE__ */ jsx14("td", { style: { textAlign: "left" }, children: c.run.name }),
        c.present ? /* @__PURE__ */ jsxs13(Fragment6, { children: [
          /* @__PURE__ */ jsx14("td", { className: c.redWeeks ? "st-red" : "st-green", children: c.redWeeks }),
          /* @__PURE__ */ jsx14("td", { children: pct(c.avgCover) }),
          /* @__PURE__ */ jsx14("td", { children: c.worst.fmt === "s" ? secs(c.worst.value) : pct(c.worst.value) }),
          /* @__PURE__ */ jsx14("td", { children: money(cur, c.cost) }),
          /* @__PURE__ */ jsx14("td", { children: money(cur, c.churn) })
        ] }) : /* @__PURE__ */ jsx14("td", { colSpan: 5, className: "empty", children: "not in this snapshot" })
      ] }, i)) })
    ] }) }) })
  ] }, b.name)) });
}

// ui/editors/QueuesEditor.jsx
import { useState as useState14 } from "react";

// ui/editors/PresetBar.jsx
import { useState as useState12 } from "react";
import { jsx as jsx15, jsxs as jsxs14 } from "react/jsx-runtime";
function ApplyPreset({ presets, onApply, label = "Apply pattern", id }) {
  const [pick, setPick] = useState12("");
  return /* @__PURE__ */ jsx15("div", { style: { minWidth: 200, maxWidth: 260 }, children: /* @__PURE__ */ jsx15(
    SelectField,
    {
      label,
      id,
      value: pick,
      onChange: (v) => {
        const p = presets.find((x) => x.id === v);
        if (p) onApply(p);
        setPick("");
      },
      options: [{ value: "", label: "Apply a pattern\u2026" }, ...presets.map((p) => ({ value: p.id, label: p.name + (p.builtin ? "" : " \u2605") }))]
    }
  ) });
}
function IntradaySliders({ curve, onChange, eng }) {
  const stepMin = eng.intervalMin;
  return /* @__PURE__ */ jsx15("div", { className: "sliders", children: curve.map((v, i) => {
    const mins = eng.dayStart * 60 + i * stepMin;
    const label = String(Math.floor(mins / 60)).padStart(2, "0") + ":" + String(mins % 60).padStart(2, "0");
    return /* @__PURE__ */ jsxs14("div", { className: "slider-cell", children: [
      /* @__PURE__ */ jsx15("span", { className: "val", children: v.toFixed(2) }),
      /* @__PURE__ */ jsx15(
        "input",
        {
          type: "range",
          min: "0",
          max: "2",
          step: "0.05",
          value: v,
          "aria-label": "Interval " + label,
          onChange: (e) => {
            const next = curve.slice();
            next[i] = Number(e.target.value);
            onChange(next);
          }
        }
      ),
      /* @__PURE__ */ jsx15("span", { className: "t", children: label })
    ] }, i);
  }) });
}

// ui/components/DependencyView.jsx
import { useState as useState13 } from "react";
import { Fragment as Fragment7, jsx as jsx16, jsxs as jsxs15 } from "react/jsx-runtime";
var CH_COLOR = { voice: "#0e7c86", digital: "#5a54c9", support: "#b0602a" };
var EDGE_STYLE = {
  share: { stroke: "#1f9d55", label: "shares with" },
  leverage: { stroke: "#d98a0b", label: "leverages to" },
  convert: { stroke: "#c0417a", label: "converts to" },
  support: { stroke: "#3a7bd5", label: "supports" }
};
function buildEdges(cfg) {
  const has = (id) => cfg.queues.some((q) => q.id === id);
  const edges = [];
  for (const q of cfg.queues) {
    const sh = q.sharing && Array.isArray(q.sharing.sharesWith) ? q.sharing.sharesWith : [];
    for (const t of sh) if (has(t)) edges.push({ from: q.id, to: t, type: "share" });
    if (q.resourcing === "leveraged" && q.leverage) {
      const tg = q.leverage.targets;
      const list = tg === "priority-above" ? [] : Array.isArray(tg) ? tg : tg ? [tg] : [];
      for (const t of list) if (has(t)) edges.push({ from: q.id, to: t, type: "leverage" });
    }
    const ct = q.knock && q.knock.convertTarget;
    if (ct && has(ct)) edges.push({ from: q.id, to: ct, type: "convert" });
    for (const s of q.supports || []) if (has(s.queueId)) edges.push({ from: q.id, to: s.queueId, type: "support" });
  }
  return edges;
}
function nodeFlows(sim, qid, w) {
  const wk = sim.weeks[Math.min(w, sim.weeks.length - 1)];
  const s = wk ? wk.queues[qid] : null;
  if (!s) return null;
  return {
    sharedIn: s.poolIn || 0,
    leveragedIn: s.leveragedIn || 0,
    supportIn: s.flexIn || 0,
    convertedOut: s.deflected || 0,
    redialOut: s.redial || 0
  };
}
function Graph({ cfg, sim, edges, selected, onSelect, week }) {
  const qs = cfg.queues;
  const n = qs.length;
  const W = 640, H = Math.max(300, 120 + n * 8), cx = W / 2, cy = H / 2;
  const R = Math.min(W, H) / 2 - 70;
  const pos = {};
  qs.forEach((q, i) => {
    const a = i / Math.max(1, n) * Math.PI * 2 - Math.PI / 2;
    pos[q.id] = { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });
  const badge = (q) => q.resourcing === "unmanned" ? "U" : q.resourcing === "leveraged" ? "L" : "D";
  return /* @__PURE__ */ jsx16("div", { className: "tbl-wrap", style: { border: 0 }, children: /* @__PURE__ */ jsxs15("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, style: { maxWidth: "100%", height: "auto" }, "data-testid": "dep-graph", role: "img", "aria-label": "Queue dependency graph", children: [
    /* @__PURE__ */ jsx16("defs", { children: Object.entries(EDGE_STYLE).map(([k, v]) => /* @__PURE__ */ jsx16("marker", { id: "arrow-" + k, viewBox: "0 0 10 10", refX: "9", refY: "5", markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse", children: /* @__PURE__ */ jsx16("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: v.stroke }) }, k)) }),
    edges.map((e, i) => {
      const a = pos[e.from], b = pos[e.to];
      if (!a || !b) return null;
      const st = EDGE_STYLE[e.type];
      const hot = selected && (e.from === selected || e.to === selected);
      return /* @__PURE__ */ jsx16("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: st.stroke, strokeWidth: hot ? 2.5 : 1.2, strokeOpacity: selected && !hot ? 0.15 : 0.7, markerEnd: "url(#arrow-" + e.type + ")" }, i);
    }),
    qs.map((q) => {
      const p = pos[q.id];
      const sel = selected === q.id;
      return /* @__PURE__ */ jsxs15("g", { transform: `translate(${p.x},${p.y})`, style: { cursor: "pointer" }, onClick: () => onSelect(sel ? null : q.id), "data-testid": "dep-node-" + q.id, children: [
        /* @__PURE__ */ jsx16("circle", { r: sel ? 16 : 13, fill: CH_COLOR[channelOfQueue(q)] || "#5c6b7a", stroke: sel ? "#0f1720" : "#fff", strokeWidth: sel ? 3 : 1.5 }),
        /* @__PURE__ */ jsx16("text", { textAnchor: "middle", dy: "4", fontSize: "11", fontWeight: "700", fill: "#fff", children: badge(q) }),
        /* @__PURE__ */ jsx16("text", { textAnchor: "middle", y: 26, fontSize: "10", fill: "#1b2733", children: q.name.length > 16 ? q.name.slice(0, 15) + "\u2026" : q.name })
      ] }, q.id);
    })
  ] }) });
}
function FlowsPanel({ cfg, sim, selected, week }) {
  if (!selected) return /* @__PURE__ */ jsx16("p", { className: "note", "data-testid": "dep-flows-empty", children: "Tap a node to see its simulated flows for the selected week." });
  const q = cfg.queues.find((x) => x.id === selected);
  const f = nodeFlows(sim, selected, week);
  if (!q || !f) return /* @__PURE__ */ jsx16("p", { className: "note", children: "No simulated data for this queue." });
  const row = (l, v, unit) => /* @__PURE__ */ jsxs15("div", { className: "kpi", children: [
    /* @__PURE__ */ jsx16("div", { className: "l", children: l }),
    /* @__PURE__ */ jsxs15("div", { className: "v", children: [
      num(v, 0),
      /* @__PURE__ */ jsxs15("small", { children: [
        " ",
        unit
      ] })
    ] })
  ] });
  return /* @__PURE__ */ jsxs15("div", { className: "qcard", "data-testid": "dep-flows", style: { marginTop: 12 }, children: [
    /* @__PURE__ */ jsxs15("div", { className: "qn", children: [
      /* @__PURE__ */ jsx16("span", { children: q.name }),
      /* @__PURE__ */ jsx16("span", { className: "spacer" }),
      /* @__PURE__ */ jsxs15("span", { className: "qtype", children: [
        "week ",
        Math.min(week, sim.weeks.length - 1) + 1
      ] })
    ] }),
    /* @__PURE__ */ jsxs15("div", { className: "kpis", children: [
      row("Shared in", f.sharedIn, "h"),
      row("Leveraged in", f.leveragedIn, "h"),
      row("Support in", f.supportIn, "h"),
      row("Converted out", f.convertedOut, "vol"),
      row("Repeat/redial", f.redialOut, "vol")
    ] })
  ] });
}
function LinkTable({ cfg, edges }) {
  const qn = (id) => (cfg.queues.find((q) => q.id === id) || { name: id }).name;
  return /* @__PURE__ */ jsx16("div", { className: "tbl-wrap", children: /* @__PURE__ */ jsxs15("table", { className: "data", "data-testid": "dep-table", children: [
    /* @__PURE__ */ jsx16("thead", { children: /* @__PURE__ */ jsxs15("tr", { children: [
      /* @__PURE__ */ jsx16("th", { children: "From" }),
      /* @__PURE__ */ jsx16("th", { children: "Link" }),
      /* @__PURE__ */ jsx16("th", { children: "To" })
    ] }) }),
    /* @__PURE__ */ jsxs15("tbody", { children: [
      edges.map((e, i) => /* @__PURE__ */ jsxs15("tr", { children: [
        /* @__PURE__ */ jsx16("td", { style: { textAlign: "left" }, children: qn(e.from) }),
        /* @__PURE__ */ jsx16("td", { children: /* @__PURE__ */ jsx16("span", { className: "pill", style: { color: EDGE_STYLE[e.type].stroke, borderColor: EDGE_STYLE[e.type].stroke }, children: EDGE_STYLE[e.type].label }) }),
        /* @__PURE__ */ jsx16("td", { style: { textAlign: "left" }, children: qn(e.to) })
      ] }, i)),
      edges.length === 0 && /* @__PURE__ */ jsx16("tr", { children: /* @__PURE__ */ jsx16("td", { colSpan: 3, className: "empty", children: "No dependency links yet. Add sharing, leverage or converts-to-calls on a queue below." }) })
    ] })
  ] }) });
}
function DependencyView({ config, sim }) {
  const [view, setView] = useState13("graph");
  const [selected, setSelected] = useState13(null);
  const [week, setWeek] = useState13(0);
  const edges = buildEdges(config);
  const maxWk = sim ? sim.weeks.length : 1;
  return /* @__PURE__ */ jsx16(
    Card,
    {
      title: "Dependencies",
      sub: "how capacity and contacts move between queues",
      hint: "Nodes are queues (colour = channel, letter = D dedicated / L leveraged / U unmanned). Edges are sharing, leverage and converts-to-calls links. Tap a node to see the simulated flows for the chosen week.",
      right: /* @__PURE__ */ jsxs15("div", { className: "btnbar", children: [
        /* @__PURE__ */ jsx16("button", { type: "button", className: "btn sm" + (view === "graph" ? " primary" : ""), onClick: () => setView("graph"), "data-testid": "dep-view-graph", "aria-pressed": view === "graph", children: "Graph" }),
        /* @__PURE__ */ jsx16("button", { type: "button", className: "btn sm" + (view === "table" ? " primary" : ""), onClick: () => setView("table"), "data-testid": "dep-view-table", "aria-pressed": view === "table", children: "Table" })
      ] }),
      children: view === "graph" ? /* @__PURE__ */ jsxs15(Fragment7, { children: [
        /* @__PURE__ */ jsxs15("div", { className: "rowflex", style: { marginBottom: 8 }, children: [
          /* @__PURE__ */ jsxs15("label", { className: "field", style: { maxWidth: 260 }, children: [
            /* @__PURE__ */ jsxs15("span", { className: "lab", children: [
              "Week ",
              Math.min(week, maxWk - 1) + 1
            ] }),
            /* @__PURE__ */ jsx16("input", { type: "range", min: 0, max: Math.max(0, maxWk - 1), value: Math.min(week, maxWk - 1), onChange: (e) => setWeek(Number(e.target.value)), "data-testid": "dep-week", "aria-label": "Selected week" })
          ] }),
          /* @__PURE__ */ jsx16("div", { className: "legend", style: { flexWrap: "wrap" }, children: Object.entries(EDGE_STYLE).map(([k, v]) => /* @__PURE__ */ jsxs15("span", { className: "legend-item", children: [
            /* @__PURE__ */ jsx16("span", { className: "sw", style: { background: v.stroke } }),
            v.label
          ] }, k)) })
        ] }),
        sim ? /* @__PURE__ */ jsx16(Graph, { cfg: config, sim, edges, selected, onSelect: setSelected, week }) : /* @__PURE__ */ jsx16("p", { className: "note", children: "Recalculating\u2026" }),
        sim && /* @__PURE__ */ jsx16(FlowsPanel, { cfg: config, sim, selected, week })
      ] }) : /* @__PURE__ */ jsx16(LinkTable, { cfg: config, edges })
    }
  );
}

// ui/editors/QueuesEditor.jsx
var import_engine8 = __toESM(require_engine());
import { Fragment as Fragment8, jsx as jsx17, jsxs as jsxs16 } from "react/jsx-runtime";
var RES_OPTIONS = [
  { value: "dedicated", label: "Dedicated" },
  { value: "leveraged", label: "Leveraged" },
  { value: "unmanned", label: "Unmanned" }
];
var badgeFor = (r) => r === "unmanned" ? "red" : r === "leveraged" ? "amber" : null;
function InheritHeader({ q, section, label, ops, source }) {
  const overridden = !!(q.overrides && q.overrides[section]);
  return /* @__PURE__ */ jsxs16("span", { className: "rowflex", style: { gap: 8, alignItems: "center" }, children: [
    /* @__PURE__ */ jsx17("strong", { children: label }),
    /* @__PURE__ */ jsx17("span", { className: "inherit-ind " + (overridden ? "overridden" : "inherited"), "data-testid": "inherit-" + section, children: overridden ? "overridden" : "inherited from " + source }),
    /* @__PURE__ */ jsx17("span", { className: "spacer" }),
    /* @__PURE__ */ jsxs16("label", { className: "switch", onClick: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ jsx17("input", { type: "checkbox", checked: overridden, onChange: (e) => ops.setOverride(q.id, section, e.target.checked), "data-testid": "override-" + section }),
      /* @__PURE__ */ jsx17("span", { className: "track", "aria-hidden": "true" }),
      /* @__PURE__ */ jsx17("span", { style: { fontSize: 11 }, children: "Override" })
    ] })
  ] });
}
function HCField({ value, onChange, disabled }) {
  return /* @__PURE__ */ jsxs16("label", { className: "field", children: [
    /* @__PURE__ */ jsxs16("span", { className: "lab", children: [
      "Starting HC ",
      /* @__PURE__ */ jsx17(Hint, { text: "Leave blank to draw a workload-weighted share of the global starting HC (Settings). Unmanned queues have no HC." })
    ] }),
    /* @__PURE__ */ jsx17(
      "input",
      {
        type: "number",
        value: disabled ? "" : value == null ? "" : value,
        placeholder: disabled ? "(unmanned \u2014 no HC)" : "(global share)",
        disabled,
        onChange: (e) => onChange(e.target.value === "" ? null : Number(e.target.value)),
        "data-testid": "hc-input"
      }
    )
  ] });
}
function SharingEditor({ config, q, ops }) {
  const on = !!q.sharing;
  const sh = q.sharing || { sharePct: 100, sharesWith: [] };
  const others = config.queues.filter((x) => x.id !== q.id);
  return /* @__PURE__ */ jsxs16("div", { children: [
    /* @__PURE__ */ jsx17("div", { className: "rowflex", style: { marginBottom: 8 }, children: /* @__PURE__ */ jsxs16("label", { className: "switch", children: [
      /* @__PURE__ */ jsx17("input", { type: "checkbox", checked: on, onChange: (e) => ops.setSharing(q.id, e.target.checked), "data-testid": "sharing-on" }),
      /* @__PURE__ */ jsx17("span", { className: "track", "aria-hidden": "true" }),
      /* @__PURE__ */ jsx17("span", { children: "This queue shares its spare" })
    ] }) }),
    on ? /* @__PURE__ */ jsxs16(Fragment8, { children: [
      /* @__PURE__ */ jsx17("div", { className: "fieldrow", style: { maxWidth: 260 }, children: /* @__PURE__ */ jsx17(
        NumField,
        {
          label: "Share of spare",
          unit: "%",
          value: sh.sharePct == null ? 100 : sh.sharePct,
          onChange: (v) => ops.patchSharing(q.id, "sharePct", v),
          hint: "How much of this queue's spare capacity (above its own requirement) it offers to the queues below, split pro-rata by their shortfall."
        }
      ) }),
      /* @__PURE__ */ jsx17("div", { className: "lab", style: { margin: "10px 0 6px" }, children: "Shares with" }),
      /* @__PURE__ */ jsxs16("div", { className: "rowflex", style: { flexWrap: "wrap" }, children: [
        others.map((x) => /* @__PURE__ */ jsxs16("label", { className: "switch", children: [
          /* @__PURE__ */ jsx17("input", { type: "checkbox", checked: (sh.sharesWith || []).includes(x.id), onChange: (e) => ops.toggleSharesWith(q.id, x.id, e.target.checked), "data-testid": "shares-" + q.id + "-" + x.id }),
          /* @__PURE__ */ jsx17("span", { className: "track", "aria-hidden": "true" }),
          /* @__PURE__ */ jsxs16("span", { children: [
            x.name,
            " ",
            /* @__PURE__ */ jsx17("span", { className: "pill", children: (0, import_engine8.channelOf)(x) })
          ] })
        ] }, x.id)),
        others.length === 0 && /* @__PURE__ */ jsx17("p", { className: "note", children: "No other queues to share with." })
      ] })
    ] }) : /* @__PURE__ */ jsx17("p", { className: "note", children: "Not sharing. Turn on to lend this queue's spare to others in deficit." })
  ] });
}
function SupportsEditor({ config, q, ops }) {
  const others = config.queues.filter((x) => x.id !== q.id);
  const inbound = (0, import_engine8.supportersOf)(config, q.id);
  const nameOf = (id) => (config.queues.find((x) => x.id === id) || { name: id }).name;
  return /* @__PURE__ */ jsxs16("div", { children: [
    /* @__PURE__ */ jsxs16("div", { className: "lab", style: { marginBottom: 6 }, children: [
      "Supports / dependency list (outbound) ",
      /* @__PURE__ */ jsx17(Hint, { text: "Queues this one lends spare hours to. Lower priority = served first; within a tier spare splits by deficit." })
    ] }),
    (q.supports || []).length === 0 ? /* @__PURE__ */ jsx17("p", { className: "note", style: { marginBottom: 8 }, children: "Not supporting any queue." }) : /* @__PURE__ */ jsx17("div", { className: "rows", style: { marginBottom: 8 }, children: q.supports.map((s, i) => /* @__PURE__ */ jsxs16("div", { className: "rowflex", children: [
      /* @__PURE__ */ jsx17("span", { style: { minWidth: 130, fontWeight: 600 }, children: nameOf(s.queueId) }),
      /* @__PURE__ */ jsx17("div", { style: { width: 96 }, children: /* @__PURE__ */ jsx17(NumField, { label: "Priority", value: s.priority, min: 1, onChange: (v) => ops.patchSupport(q.id, i, "priority", Math.max(1, v)) }) }),
      /* @__PURE__ */ jsx17("div", { style: { width: 110 }, children: /* @__PURE__ */ jsx17(NumField, { label: "Max share", unit: "%", value: s.maxSharePct == null ? 100 : s.maxSharePct, onChange: (v) => ops.patchSupport(q.id, i, "maxSharePct", v) }) }),
      /* @__PURE__ */ jsx17("button", { type: "button", className: "btn sm danger", style: { alignSelf: "flex-end" }, onClick: () => ops.deleteSupport(q.id, i), children: "Remove" })
    ] }, i)) }),
    /* @__PURE__ */ jsx17(
      SelectField,
      {
        label: "Add a queue to support",
        value: "",
        onChange: (v) => v && ops.addSupport(q.id, v),
        options: [{ value: "", label: "Choose a queue\u2026" }, ...others.filter((x) => !(q.supports || []).some((s) => s.queueId === x.id)).map((x) => ({ value: x.id, label: x.name }))]
      }
    ),
    /* @__PURE__ */ jsx17("div", { className: "lab", style: { margin: "12px 0 4px" }, children: "Supported by (inbound)" }),
    inbound.length ? /* @__PURE__ */ jsx17("div", { className: "rowflex", children: inbound.map((s) => /* @__PURE__ */ jsxs16("span", { className: "pill", children: [
      nameOf(s.queueId),
      " \xB7 pri ",
      s.priority
    ] }, s.queueId)) }) : /* @__PURE__ */ jsx17("p", { className: "note", children: "No queue currently supports this one." })
  ] });
}
function groupTargetsQueue(group, q) {
  const sc = group.scope;
  if (!sc) return true;
  const anyTarget = (sc.brandIds || []).length || (sc.channels || []).length || (sc.queueIds || []).length;
  if (!anyTarget) return true;
  return (sc.brandIds || []).includes(q.brandId) || (sc.channels || []).includes((0, import_engine8.channelOf)(q)) || (sc.queueIds || []).includes(q.id);
}
function ScenariosAffecting({ config, q }) {
  const groups = (config.groups || []).filter((g) => Array.isArray(g.scenarioIds) && g.scenarioIds.length && groupTargetsQueue(g, q));
  const rows = groups.map((g) => ({
    group: g,
    factors: g.scenarioIds.map((id) => config.scenarios.find((s) => s.id === id)).filter(Boolean)
  })).filter((r) => r.factors.length);
  if (!rows.length) return /* @__PURE__ */ jsx17("p", { className: "note", children: "No scenario groups currently target this queue. Create and target groups on the Scenarios tab." });
  return /* @__PURE__ */ jsxs16("div", { className: "rows", style: { gap: 8 }, "data-testid": "q-scenarios-readonly", children: [
    /* @__PURE__ */ jsx17("p", { className: "note", children: "Read-only. Scenario groups are created and targeted on the Scenarios tab; this shows the ones that reach this queue." }),
    rows.map(({ group, factors }) => /* @__PURE__ */ jsxs16("div", { className: "rowflex", style: { flexWrap: "wrap", gap: 6 }, children: [
      /* @__PURE__ */ jsx17("span", { className: "tag soft", children: group.name }),
      factors.map((s) => /* @__PURE__ */ jsxs16("span", { className: "pill", children: [
        s.name,
        s.enabled ? "" : " (off)"
      ] }, s.id))
    ] }, group.id))
  ] });
}
function AssumptionsMini({ sim, config, q }) {
  if (!sim || !sim.weeks.length || !sim.weeks[0].queues[q.id]) return /* @__PURE__ */ jsx17("p", { className: "note", children: "Recalculating\u2026" });
  const cols = assumptionsColumns(q, config.engine.currency);
  const rows = buildWeeklyRows(sim, q, config).filter((_, i) => i % 4 === 0);
  return /* @__PURE__ */ jsx17("div", { className: "tbl-wrap", style: { maxHeight: 260 }, children: /* @__PURE__ */ jsxs16("table", { className: "data", children: [
    /* @__PURE__ */ jsx17("thead", { children: /* @__PURE__ */ jsx17("tr", { children: cols.map((c) => /* @__PURE__ */ jsx17("th", { children: c.label }, c.key)) }) }),
    /* @__PURE__ */ jsx17("tbody", { children: rows.map((r) => /* @__PURE__ */ jsx17("tr", { children: cols.map((c) => /* @__PURE__ */ jsx17("td", { style: c.key === "scenarioTags" ? { textAlign: "left" } : void 0, children: c.fmt(r[c.key]) }, c.key)) }, r.week)) })
  ] }) });
}
function VolumesSection({ config, q, ops, seasonalityPresets }) {
  const [wizBase, setWizBase] = useState14(q.dailyVolume != null ? q.dailyVolume : 500);
  const [wizPattern, setWizPattern] = useState14("");
  const [csv, setCsv] = useState14("");
  const mode = Array.isArray(q.weeklyVolumes) ? "series" : q.dailyVolume == null ? "inherit" : "single";
  const runWizard = () => {
    const preset = seasonalityPresets.find((p) => p.id === wizPattern);
    const months = preset ? preset.months : new Array(12).fill(1);
    const series = (0, import_engine8.generateWeeklySeries)(config, Number(wizBase) || 0, months, config.engine.horizonWeeks);
    ops.setQueueVolume(q.id, "series", series);
  };
  const pasteCsv = () => {
    const arr = csv.split(/[\s,]+/).map((x) => Number(x)).filter((x) => !Number.isNaN(x));
    if (arr.length) ops.setQueueVolume(q.id, "series", arr);
  };
  return /* @__PURE__ */ jsxs16("div", { className: "acc-b", children: [
    /* @__PURE__ */ jsx17("div", { className: "fieldrow", style: { maxWidth: 320, marginBottom: 8 }, children: /* @__PURE__ */ jsx17(
      SelectField,
      {
        label: "Volume source",
        value: mode,
        "data-testid": "vol-mode",
        onChange: (v) => {
          if (v === "single") ops.setQueueVolume(q.id, "single", q.dailyVolume != null ? q.dailyVolume : 500);
          else if (v === "inherit") ops.setQueueVolume(q.id, "inherit");
          else if (v === "series") ops.setQueueVolume(q.id, "series", Array.isArray(q.weeklyVolumes) ? q.weeklyVolumes : (0, import_engine8.generateWeeklySeries)(config, q.dailyVolume || 500, new Array(12).fill(1), config.engine.horizonWeeks));
        },
        options: [{ value: "single", label: "Single figure" }, { value: "series", label: "Weekly series (CSV / wizard)" }, { value: "inherit", label: "Inherit from brand" }]
      }
    ) }),
    mode === "single" && /* @__PURE__ */ jsx17("div", { className: "fieldrow", style: { maxWidth: 240 }, children: /* @__PURE__ */ jsx17(NumField, { label: "Base daily volume", value: q.dailyVolume, onChange: (v) => ops.patchQueue(q.id, ["dailyVolume"], v) }) }),
    mode === "inherit" && /* @__PURE__ */ jsx17("div", { className: "fieldrow", style: { maxWidth: 240 }, children: /* @__PURE__ */ jsx17(NumField, { label: "Brand share", value: q.volumeShare == null ? 1 : q.volumeShare, onChange: (v) => ops.patchQueue(q.id, ["volumeShare"], v), hint: "This queue's proportional share of its brand's volume, split across brand queues that inherit." }) }),
    mode === "series" && /* @__PURE__ */ jsxs16(Fragment8, { children: [
      /* @__PURE__ */ jsxs16("div", { className: "rowflex", style: { marginBottom: 8 }, children: [
        /* @__PURE__ */ jsx17(NumField, { label: "Weekly figure", value: wizBase, onChange: setWizBase }),
        /* @__PURE__ */ jsx17("div", { style: { minWidth: 180 }, children: /* @__PURE__ */ jsx17(
          SelectField,
          {
            label: "Seasonality pattern",
            value: wizPattern,
            onChange: setWizPattern,
            options: [{ value: "", label: "Flat" }, ...seasonalityPresets.map((p) => ({ value: p.id, label: p.name }))]
          }
        ) }),
        /* @__PURE__ */ jsx17("button", { type: "button", className: "btn sm primary", onClick: runWizard, "data-testid": "vol-wizard-run", style: { alignSelf: "flex-end" }, children: "Run seasonality wizard" })
      ] }),
      /* @__PURE__ */ jsx17("p", { className: "note", style: { marginBottom: 8 }, "data-testid": "vol-wizard-note", children: "The wizard multiplies your weekly figure by the chosen pattern's monthly multipliers, anchored to the Settings week-1 date, to fill every week. Every week stays editable below." }),
      /* @__PURE__ */ jsxs16("div", { className: "rowflex", style: { marginBottom: 8 }, children: [
        /* @__PURE__ */ jsx17("input", { type: "text", className: "inp", style: { flex: 1, minWidth: 220 }, placeholder: "paste a CSV weekly list (52+)", value: csv, onChange: (e) => setCsv(e.target.value), "data-testid": "vol-csv" }),
        /* @__PURE__ */ jsx17("button", { type: "button", className: "btn sm", onClick: pasteCsv, "data-testid": "vol-csv-apply", children: "Apply CSV" })
      ] }),
      Array.isArray(q.weeklyVolumes) && /* @__PURE__ */ jsx17("div", { className: "fieldrow", "data-testid": "vol-series", style: { gridTemplateColumns: "repeat(auto-fill, minmax(74px, 1fr))" }, children: q.weeklyVolumes.slice(0, config.engine.horizonWeeks).map((v, w) => /* @__PURE__ */ jsx17("div", { style: { width: 74 }, children: /* @__PURE__ */ jsx17(NumField, { label: "W" + (w + 1), value: Math.round(v), onChange: (nv) => ops.patchWeeklyVolume(q.id, w, nv) }) }, w)) })
    ] })
  ] });
}
function QueueCard2({ config, q, ops, sim, intradayPresets, seasonalityPresets, defaultOpen }) {
  const eng = config.engine, wf = q.wf, burn = q.burn;
  const res = q.resourcing || "dedicated";
  const unmanned = res === "unmanned";
  const ch = (0, import_engine8.channelOf)(q);
  const chLabel = ch.charAt(0).toUpperCase() + ch.slice(1);
  const bdg = badgeFor(res);
  const isDigital = q.type === "digital";
  const workflow = isDigital && q.subtype === "workflow";
  const voiceQueues = config.queues.filter((x) => (0, import_engine8.channelOf)(x) === "voice" && x.id !== q.id);
  return /* @__PURE__ */ jsxs16("details", { className: "erow", open: defaultOpen, children: [
    /* @__PURE__ */ jsxs16("summary", { children: [
      /* @__PURE__ */ jsx17("span", { className: "chev", children: "\u25B6" }),
      /* @__PURE__ */ jsx17("strong", { children: q.name }),
      isDigital && /* @__PURE__ */ jsx17("span", { className: "qtype", children: q.subtype === "workflow" ? "workflow" : "customer" }),
      bdg && /* @__PURE__ */ jsx17("span", { className: "badge " + bdg, children: res }),
      /* @__PURE__ */ jsx17("span", { className: "spacer" }),
      /* @__PURE__ */ jsxs16("span", { className: "btnbar", onClick: (e) => e.preventDefault(), children: [
        /* @__PURE__ */ jsx17("button", { type: "button", className: "btn sm", onClick: () => ops.duplicateQueue(q.id), children: "Duplicate" }),
        /* @__PURE__ */ jsx17("button", { type: "button", className: "btn sm danger", onClick: () => ops.deleteQueue(q.id), children: "Delete" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs16("div", { className: "erow-b", children: [
      /* @__PURE__ */ jsxs16("details", { className: "acc-sec", open: defaultOpen, children: [
        /* @__PURE__ */ jsx17("summary", { children: /* @__PURE__ */ jsx17("strong", { children: "Description" }) }),
        /* @__PURE__ */ jsxs16("div", { className: "acc-b", children: [
          /* @__PURE__ */ jsxs16("div", { className: "fieldrow", children: [
            /* @__PURE__ */ jsx17(TextField, { label: "Name", value: q.name, onChange: (v) => ops.patchQueue(q.id, ["name"], v) }),
            /* @__PURE__ */ jsx17(
              SelectField,
              {
                label: "Channel",
                value: q.channelId || "",
                onChange: (v) => v && ops.attachQueueChannel(q.id, v),
                id: "queue-channel-" + q.id,
                options: [{ value: "", label: "\u2014 pick a channel \u2014" }, ...(config.channelDefs || []).map((d) => ({ value: d.id, label: d.name }))]
              }
            ),
            isDigital && /* @__PURE__ */ jsx17(
              SelectField,
              {
                label: "Digital subtype",
                value: q.subtype || "customer",
                onChange: (v) => ops.setQueueSubtype(q.id, v),
                id: "subtype-" + q.id,
                options: [{ value: "customer", label: "Customer (live)" }, { value: "workflow", label: "Workflow (backlog)" }]
              }
            ),
            /* @__PURE__ */ jsx17(NumField, { label: workflow ? "Handle time / item" : "AHT", unit: "s", value: q.aht, onChange: (v) => ops.patchQueue(q.id, ["aht"], v) })
          ] }),
          /* @__PURE__ */ jsxs16("p", { className: "note", children: [
            "Attaching a channel sets this queue's channel group (",
            chLabel,
            ") and inherits its template sections. Create channels in Settings \u2192 Channels.",
            isDigital ? workflow ? " Workflow: backlog processing \u2014 no concurrency; SLA in hours." : " Customer: live interaction \u2014 concurrency and a minutes SLA." : ""
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs16("details", { className: "acc-sec", children: [
        /* @__PURE__ */ jsx17("summary", { children: /* @__PURE__ */ jsx17("strong", { children: "Volumes" }) }),
        /* @__PURE__ */ jsx17(VolumesSection, { config, q, ops, seasonalityPresets })
      ] }),
      /* @__PURE__ */ jsxs16("details", { className: "acc-sec", children: [
        /* @__PURE__ */ jsx17("summary", { children: /* @__PURE__ */ jsx17("strong", { children: "Arrival pattern" }) }),
        /* @__PURE__ */ jsxs16("div", { className: "acc-b", children: [
          /* @__PURE__ */ jsxs16("div", { className: "rowflex", children: [
            /* @__PURE__ */ jsx17(ApplyPreset, { presets: intradayPresets, onApply: (p) => {
              ops.patchQueue(q.id, ["profile"], [...p.curve]);
              ops.patchQueue(q.id, ["arrivalPresetId"], p.id);
            }, label: "Apply arrival pattern" }),
            /* @__PURE__ */ jsx17("span", { className: "note", style: { padding: "6px 10px" }, children: "Apply a pattern to link it live; editing that pattern in Settings re-simulates this queue. Hand-tuning below unlinks it." })
          ] }),
          /* @__PURE__ */ jsx17(IntradaySliders, { curve: q.profile, eng, onChange: (next) => {
            ops.patchQueue(q.id, ["profile"], next);
            ops.patchQueue(q.id, ["arrivalPresetId"], null);
          } })
        ] })
      ] }),
      /* @__PURE__ */ jsxs16("details", { className: "acc-sec", children: [
        /* @__PURE__ */ jsx17("summary", { children: /* @__PURE__ */ jsx17(InheritHeader, { q, section: "workforce", label: "Workforce", ops, source: chLabel + " template" }) }),
        /* @__PURE__ */ jsxs16("div", { className: "acc-b", children: [
          /* @__PURE__ */ jsxs16("div", { className: "fieldrow", children: [
            /* @__PURE__ */ jsx17(NumField, { label: "Agent cost", unit: "/mo", value: q.agentCostMonthly != null ? q.agentCostMonthly : q.agentCost != null ? Math.round(q.agentCost / 12) : 0, onChange: (v) => {
              ops.patchQueue(q.id, ["agentCostMonthly"], v);
              ops.patchQueue(q.id, ["agentCost"], v * 12);
            }, hint: "Fully-loaded monthly cost per agent. The engine works weekly (\xD7 12 \xF7 52)." }),
            /* @__PURE__ */ jsx17(NumField, { label: "Shrinkage", unit: "%", value: +(q.shrinkage * 100).toFixed(1), onChange: (v) => ops.patchQueue(q.id, ["shrinkage"], v / 100), hint: "Paid time not on contacts \u2014 leave, sickness, meetings." }),
            /* @__PURE__ */ jsx17(NumField, { label: "Attrition", unit: "%/mo", value: +(wf.attrition * 100).toFixed(2), onChange: (v) => ops.patchQueue(q.id, ["wf", "attrition"], v / 100) })
          ] }),
          /* @__PURE__ */ jsxs16("div", { className: "fieldrow", children: [
            /* @__PURE__ */ jsx17(NumField, { label: "Req-to-start", unit: "wk", value: wf.reqToStart, onChange: (v) => ops.patchQueue(q.id, ["wf", "reqToStart"], v) }),
            /* @__PURE__ */ jsx17(NumField, { label: "Training", unit: "wk", value: wf.trainingWeeks, onChange: (v) => ops.patchQueue(q.id, ["wf", "trainingWeeks"], v) }),
            /* @__PURE__ */ jsx17(NumField, { label: "Burnout occ.", unit: "%", value: +(burn.occThreshold * 100).toFixed(0), onChange: (v) => ops.patchQueue(q.id, ["burn", "occThreshold"], v / 100) })
          ] }),
          /* @__PURE__ */ jsxs16("div", { style: { marginTop: 8 }, children: [
            /* @__PURE__ */ jsxs16("div", { className: "lab", style: { marginBottom: 6, display: "flex", gap: 6, alignItems: "center" }, children: [
              "Manual hires (manual strategy) ",
              /* @__PURE__ */ jsx17("span", { className: "spacer" }),
              /* @__PURE__ */ jsx17("button", { type: "button", className: "btn sm", onClick: () => ops.addHire(q.id), disabled: unmanned, children: "+ Add hire" })
            ] }),
            (wf.hires || []).length === 0 ? /* @__PURE__ */ jsx17("p", { className: "note", children: "No manual hires." }) : /* @__PURE__ */ jsx17("div", { className: "rows", children: wf.hires.map((h, hi) => /* @__PURE__ */ jsxs16("div", { className: "rowflex", children: [
              /* @__PURE__ */ jsx17("div", { style: { width: 120 }, children: /* @__PURE__ */ jsx17(NumField, { label: "Week", value: h.week + 1, min: 1, onChange: (v) => ops.patchHire(q.id, hi, "week", Math.max(0, v - 1)) }) }),
              /* @__PURE__ */ jsx17("div", { style: { width: 120 }, children: /* @__PURE__ */ jsx17(NumField, { label: "Heads", value: h.heads, onChange: (v) => ops.patchHire(q.id, hi, "heads", v) }) }),
              /* @__PURE__ */ jsx17("button", { type: "button", className: "btn sm danger", style: { alignSelf: "flex-end" }, onClick: () => ops.deleteHire(q.id, hi), children: "Remove" })
            ] }, hi)) })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs16("details", { className: "acc-sec", children: [
        /* @__PURE__ */ jsx17("summary", { children: /* @__PURE__ */ jsx17(InheritHeader, { q, section: "sla", label: "SLA", ops, source: chLabel + " template" }) }),
        /* @__PURE__ */ jsxs16("div", { className: "acc-b", children: [
          q.type === "voice" ? /* @__PURE__ */ jsxs16("div", { className: "fieldrow", children: [
            /* @__PURE__ */ jsx17(NumField, { label: "ASA target", unit: "s", value: q.asaTarget, onChange: (v) => ops.patchQueue(q.id, ["asaTarget"], v) }),
            /* @__PURE__ */ jsx17(NumField, { label: "Max abandon", unit: "%", value: +(q.maxAbandon * 100).toFixed(2), onChange: (v) => ops.patchQueue(q.id, ["maxAbandon"], v / 100) }),
            /* @__PURE__ */ jsx17(NumField, { label: "Patience", unit: "s", value: q.patience, onChange: (v) => ops.patchQueue(q.id, ["patience"], v), hint: "Average seconds a caller waits before hanging up \u2014 drives abandonment; behaviour, not a target." })
          ] }) : workflow ? /* @__PURE__ */ jsxs16("div", { className: "fieldrow", children: [
            /* @__PURE__ */ jsx17(NumField, { label: "SLA within", unit: "h", value: q.workflowSlaHours != null ? q.workflowSlaHours : 24, onChange: (v) => ops.patchQueue(q.id, ["workflowSlaHours"], v), id: "q-sla-hours-" + q.id }),
            /* @__PURE__ */ jsx17(NumField, { label: "SLA target", unit: "%", value: +((q.workflowSlaPct != null ? q.workflowSlaPct : 0.9) * 100).toFixed(0), onChange: (v) => ops.patchQueue(q.id, ["workflowSlaPct"], v / 100) }),
            /* @__PURE__ */ jsx17(NumField, { label: "Backlog limit", value: q.backlogLimit, onChange: (v) => ops.patchQueue(q.id, ["backlogLimit"], v) })
          ] }) : /* @__PURE__ */ jsxs16("div", { className: "fieldrow", children: [
            /* @__PURE__ */ jsx17(NumField, { label: "Concurrency", value: q.concurrency, onChange: (v) => ops.patchQueue(q.id, ["concurrency"], v), id: "q-concurrency-" + q.id }),
            /* @__PURE__ */ jsx17(NumField, { label: "SLA within", unit: "min", value: q.digitalSlaMinutes, onChange: (v) => ops.patchQueue(q.id, ["digitalSlaMinutes"], v) }),
            /* @__PURE__ */ jsx17(NumField, { label: "SLA target", unit: "%", value: +(q.digitalSlaPct * 100).toFixed(1), onChange: (v) => ops.patchQueue(q.id, ["digitalSlaPct"], v / 100) }),
            /* @__PURE__ */ jsx17(NumField, { label: "Backlog limit", value: q.backlogLimit, onChange: (v) => ops.patchQueue(q.id, ["backlogLimit"], v) })
          ] }),
          /* @__PURE__ */ jsx17("div", { className: "fieldrow", style: { maxWidth: 220 }, children: /* @__PURE__ */ jsx17(NumField, { label: "SLA attainment target", unit: "%", value: +((q.slaAttainmentTarget != null ? q.slaAttainmentTarget : 0.9) * 100).toFixed(0), onChange: (v) => ops.patchQueue(q.id, ["slaAttainmentTarget"], v / 100), hint: "Share of weeks that must hold SLA for the Business box to read green." }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs16("details", { className: "acc-sec", children: [
        /* @__PURE__ */ jsx17("summary", { children: /* @__PURE__ */ jsx17("strong", { children: "Knock-on" }) }),
        /* @__PURE__ */ jsx17("div", { className: "acc-b", children: /* @__PURE__ */ jsxs16("div", { className: "fieldrow", children: [
          /* @__PURE__ */ jsx17(NumField, { label: "Repeat contacts", unit: "%", value: +(((q.knock || {}).repeatPct || 0) * 100).toFixed(0), onChange: (v) => ops.patchKnock(q.id, "repeatPct", v / 100), hint: "Share of failed contacts that retry THIS queue next day.", "data-testid": "knock-repeat" }),
          /* @__PURE__ */ jsx17(NumField, { label: "Converts to calls", unit: "%", value: +(((q.knock || {}).convertPct || 0) * 100).toFixed(0), onChange: (v) => ops.patchKnock(q.id, "convertPct", v / 100), hint: "Share of failed contacts that turn into a call on the target voice queue." }),
          /* @__PURE__ */ jsx17(
            SelectField,
            {
              label: "Call queue",
              value: (q.knock || {}).convertTarget || "",
              onChange: (v) => ops.patchKnock(q.id, "convertTarget", v || null),
              options: [{ value: "", label: "\u2014 none \u2014" }, ...voiceQueues.map((x) => ({ value: x.id, label: x.name }))]
            }
          )
        ] }) })
      ] }),
      /* @__PURE__ */ jsxs16("details", { className: "acc-sec", children: [
        /* @__PURE__ */ jsx17("summary", { children: /* @__PURE__ */ jsx17("strong", { children: "Sharing" }) }),
        /* @__PURE__ */ jsx17("div", { className: "acc-b", children: /* @__PURE__ */ jsx17(SharingEditor, { config, q, ops }) })
      ] }),
      /* @__PURE__ */ jsxs16("details", { className: "acc-sec", open: defaultOpen, children: [
        /* @__PURE__ */ jsx17("summary", { children: /* @__PURE__ */ jsx17("strong", { children: "Dependencies & mode" }) }),
        /* @__PURE__ */ jsxs16("div", { className: "acc-b", children: [
          /* @__PURE__ */ jsxs16("div", { className: "fieldrow", children: [
            /* @__PURE__ */ jsx17(SelectField, { label: "Brand", value: q.brandId, onChange: (v) => ops.setQueueBrand(q.id, v), options: config.brands.map((b) => ({ value: b.id, label: b.name })), id: "queue-brand-" + q.id }),
            /* @__PURE__ */ jsx17(SelectField, { label: "Resourcing", value: res, onChange: (v) => ops.setResourcing(q.id, v), options: RES_OPTIONS }),
            /* @__PURE__ */ jsx17(NumField, { label: "Priority", value: q.priority, min: 1, onChange: (v) => ops.patchQueue(q.id, ["priority"], Math.max(1, Math.round(v))) }),
            /* @__PURE__ */ jsx17(HCField, { value: q.fte, disabled: unmanned, onChange: (v) => ops.patchQueue(q.id, ["fte"], v) })
          ] }),
          unmanned && /* @__PURE__ */ jsx17("span", { className: "badge red", children: "unmanned \u2014 served only via sharing / leverage" }),
          res === "leveraged" && /* @__PURE__ */ jsx17("span", { className: "badge amber", children: "leveraged \u2014 donates to its targets" }),
          /* @__PURE__ */ jsx17("hr", { className: "sep", style: { margin: "12px 0" } }),
          /* @__PURE__ */ jsx17(SupportsEditor, { config, q, ops })
        ] })
      ] }),
      /* @__PURE__ */ jsxs16("details", { className: "acc-sec", children: [
        /* @__PURE__ */ jsx17("summary", { children: /* @__PURE__ */ jsx17(InheritHeader, { q, section: "seasonality", label: "Seasonality", ops, source: "system pattern" }) }),
        /* @__PURE__ */ jsx17("div", { className: "acc-b", children: q.overrides && q.overrides.seasonality ? /* @__PURE__ */ jsxs16(Fragment8, { children: [
          /* @__PURE__ */ jsxs16("div", { className: "rowflex", style: { marginBottom: 8 }, children: [
            /* @__PURE__ */ jsx17("button", { type: "button", className: "btn sm", onClick: () => ops.patchQueue(q.id, ["seasonal"], Array.isArray(q.seasonal) ? q.seasonal : new Array(12).fill(1)), children: "Initialise overlay" }),
            /* @__PURE__ */ jsx17(ApplyPreset, { presets: seasonalityPresets, onApply: (p) => {
              ops.patchQueue(q.id, ["seasonal"], [...p.months]);
              ops.patchQueue(q.id, ["seasonalPresetId"], p.id);
            }, label: "Apply seasonality pattern" }),
            q.seasonalPresetId ? /* @__PURE__ */ jsx17("span", { className: "pill", "data-testid": "q-seasonal-linked-" + q.id, children: "linked" }) : /* @__PURE__ */ jsx17("span", { className: "note", style: { padding: "6px 10px" }, children: "Multiplies on top of the system pattern. Apply a pattern to link it live." })
          ] }),
          Array.isArray(q.seasonal) && /* @__PURE__ */ jsx17("div", { className: "fieldrow", children: q.seasonal.map((v, i) => /* @__PURE__ */ jsx17("div", { style: { width: 72 }, children: /* @__PURE__ */ jsx17(NumField, { label: "M" + (i + 1), unit: "%", value: +(v * 100).toFixed(0), onChange: (nv) => {
            const n = q.seasonal.slice();
            n[i] = nv / 100;
            ops.patchQueue(q.id, ["seasonal"], n);
            ops.patchQueue(q.id, ["seasonalPresetId"], null);
          } }) }, i)) })
        ] }) : /* @__PURE__ */ jsx17("p", { className: "note", children: "Inheriting the system seasonality only. Turn on Override to add a queue overlay." }) })
      ] }),
      /* @__PURE__ */ jsxs16("details", { className: "acc-sec", children: [
        /* @__PURE__ */ jsx17("summary", { children: /* @__PURE__ */ jsx17("strong", { children: "Scenarios affecting this queue" }) }),
        /* @__PURE__ */ jsx17("div", { className: "acc-b", children: /* @__PURE__ */ jsx17(ScenariosAffecting, { config, q }) })
      ] }),
      /* @__PURE__ */ jsxs16("details", { className: "acc-sec", children: [
        /* @__PURE__ */ jsx17("summary", { children: /* @__PURE__ */ jsx17("strong", { children: "Assumptions over time" }) }),
        /* @__PURE__ */ jsx17("div", { className: "acc-b", children: /* @__PURE__ */ jsx17(AssumptionsMini, { sim, config, q }) })
      ] })
    ] })
  ] });
}
function SystemSeasonality({ config, ops, seasonalityPresets }) {
  const seas = config.seasonality;
  const usingPreset = seas.systemPresetId ? seasonalityPresets.find((p) => p.id === seas.systemPresetId) : null;
  return /* @__PURE__ */ jsxs16(Card, { title: "System seasonality", hint: "One multiplier per calendar month, applied to every queue from the week-1 date across the horizon. Apply a pattern to link it live \u2014 editing that pattern in Settings then re-simulates every queue. Hand-editing a month unlinks it.", children: [
    /* @__PURE__ */ jsxs16("div", { className: "rowflex", style: { marginBottom: 12 }, children: [
      /* @__PURE__ */ jsx17(ApplyPreset, { presets: seasonalityPresets, onApply: (p) => {
        ops.patch(["seasonality", "system"], [...p.months]);
        ops.patch(["seasonality", "systemPresetId"], p.id);
      }, label: "Apply seasonality pattern", id: "system-seasonality-apply" }),
      usingPreset ? /* @__PURE__ */ jsxs16("span", { className: "pill", "data-testid": "system-seasonality-linked", children: [
        "Linked \xB7 ",
        usingPreset.name
      ] }) : /* @__PURE__ */ jsx17("span", { className: "note", style: { padding: "6px 10px" }, children: "Create and edit patterns in Settings \u2192 Seasonality patterns." })
    ] }),
    /* @__PURE__ */ jsx17("div", { className: "fieldrow", children: MONTHS.map((m, i) => /* @__PURE__ */ jsx17("div", { style: { width: 82 }, children: /* @__PURE__ */ jsx17(
      NumField,
      {
        label: m,
        unit: "%",
        value: +((seas.system[i] || 0) * 100).toFixed(0),
        onChange: (v) => {
          const n = seas.system.slice();
          n[i] = v / 100;
          ops.patch(["seasonality", "system"], n);
          ops.patch(["seasonality", "systemPresetId"], null);
        }
      }
    ) }, m)) })
  ] });
}
function QueuesEditor({ config, ops, sim, intradayPresets, setIntradayPresets, seasonalityPresets, setSeasonalityPresets }) {
  let first = true;
  const brandSection = (b) => {
    const qs = config.queues.filter((q) => q.brandId === b.id);
    const byCh = (ch) => qs.filter((q) => (0, import_engine8.channelOf)(q) === ch);
    const chBlock = (label, list) => list.length ? /* @__PURE__ */ jsxs16("div", { children: [
      /* @__PURE__ */ jsxs16("div", { className: "section-title", style: { marginTop: 6 }, children: [
        label,
        " ",
        /* @__PURE__ */ jsx17("span", { className: "pill", children: list.length })
      ] }),
      /* @__PURE__ */ jsx17("div", { className: "rows", children: list.map((q) => {
        const open = first;
        first = false;
        return /* @__PURE__ */ jsx17(QueueCard2, { config, q, ops, sim, intradayPresets, seasonalityPresets, defaultOpen: open }, q.id);
      }) })
    ] }, label) : null;
    return /* @__PURE__ */ jsxs16("div", { className: "grid", style: { gap: 8 }, "data-testid": "brand-section-" + b.id, children: [
      /* @__PURE__ */ jsxs16("div", { className: "section-title", style: { fontSize: 15, color: "var(--ink)" }, children: [
        "Brand \xB7 ",
        b.name,
        " ",
        /* @__PURE__ */ jsxs16("span", { className: "pill", children: [
          qs.length,
          " queue(s)"
        ] })
      ] }),
      ["voice", "digital", "support"].map((ch) => chBlock(ch.charAt(0).toUpperCase() + ch.slice(1), byCh(ch))),
      qs.length === 0 && /* @__PURE__ */ jsx17("p", { className: "note", children: "No queues in this brand yet." })
    ] }, b.id);
  };
  return /* @__PURE__ */ jsxs16("div", { className: "grid", style: { gap: 18 }, children: [
    /* @__PURE__ */ jsxs16("div", { className: "btnbar", children: [
      /* @__PURE__ */ jsx17("button", { type: "button", className: "btn primary", onClick: () => ops.addQueue(), children: "+ Add queue" }),
      /* @__PURE__ */ jsxs16("span", { className: "note", style: { padding: "6px 10px" }, children: [
        config.queues.length,
        " queue(s). New queues default to Voice / the first brand \u2014 change in the card. Create brands in Settings."
      ] })
    ] }),
    /* @__PURE__ */ jsx17(DependencyView, { config, sim }),
    /* @__PURE__ */ jsx17(SystemSeasonality, { config, ops, seasonalityPresets }),
    config.brands.map((b) => brandSection(b))
  ] });
}

// ui/editors/ScenariosEditor.jsx
import { useState as useState15 } from "react";
import { Fragment as Fragment9, jsx as jsx18, jsxs as jsxs17 } from "react/jsx-runtime";
var CHANNELS = [{ key: "voice", label: "Voice" }, { key: "digital", label: "Digital" }, { key: "support", label: "Support" }];
function WeekGrid({ horizon, value, onToggle, render }) {
  return /* @__PURE__ */ jsx18("div", { className: "rowflex", style: { gap: 4, flexWrap: "wrap" }, "data-testid": "week-grid", children: Array.from({ length: horizon }, (_, w) => {
    const on = value(w);
    return /* @__PURE__ */ jsxs17("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }, children: [
      /* @__PURE__ */ jsx18(
        "button",
        {
          type: "button",
          className: "wk-cell" + (on ? " sel" : ""),
          "data-st": on ? "green" : void 0,
          style: on ? void 0 : { background: "var(--panel-2)", color: "var(--muted)" },
          onClick: () => onToggle(w),
          "aria-pressed": on,
          "aria-label": "Week " + (w + 1),
          children: w + 1
        }
      ),
      on && render ? render(w) : null
    ] }, w);
  }) });
}
function FactorParams({ s, ti, ops, horizon }) {
  const p = s.p || {};
  const set = (k, v) => ops.patchScenario(ti, ["p", k], v);
  return /* @__PURE__ */ jsxs17(Fragment9, { children: [
    /* @__PURE__ */ jsxs17("div", { className: "fieldrow", children: [
      /* @__PURE__ */ jsx18(
        SelectField,
        {
          label: "Tag",
          value: s.tag || "custom",
          onChange: (v) => ops.patchScenario(ti, ["tag"], v),
          options: ["growth", "launch", "digitization", "p1", "custom"].map((v) => ({ value: v, label: v }))
        }
      ),
      /* @__PURE__ */ jsx18(
        SelectField,
        {
          label: "Parameter",
          value: s.parameter,
          onChange: (v) => ops.patchScenario(ti, ["parameter"], v),
          options: [{ value: "volume", label: "Volume" }, { value: "aht", label: "AHT" }, { value: "sla", label: "SLA" }, { value: "profileShares", label: "Profile shares" }, { value: "people", label: "People" }]
        }
      ),
      /* @__PURE__ */ jsx18(
        SelectField,
        {
          label: "Mechanism",
          value: s.mechanism,
          onChange: (v) => ops.patchScenario(ti, ["mechanism"], v),
          options: [{ value: "step", label: "Step" }, { value: "growthRate", label: "Growth rate" }, { value: "manualSeries", label: "Manual series" }]
        }
      ),
      /* @__PURE__ */ jsx18(
        SelectField,
        {
          label: "Granularity",
          value: s.granularity || "week",
          onChange: (v) => ops.patchScenario(ti, ["granularity"], v),
          options: [{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }]
        }
      )
    ] }),
    /* @__PURE__ */ jsxs17("div", { className: "fieldrow", children: [
      /* @__PURE__ */ jsx18(NumField, { label: "Start week", value: s.startWeek + 1, min: 1, onChange: (v) => ops.patchScenario(ti, ["startWeek"], Math.max(0, v - 1)) }),
      /* @__PURE__ */ jsx18(NumField, { label: "Stop week", value: s.stopWeek == null ? "" : s.stopWeek + 1, onChange: (v) => ops.patchScenario(ti, ["stopWeek"], v ? v - 1 : null), hint: "Blank = runs to the horizon." })
    ] }),
    s.mechanism === "step" && s.parameter !== "people" && s.parameter !== "profileShares" && /* @__PURE__ */ jsx18(NumField, { label: "Step value", unit: "%", value: +((p.value || 0) * 100).toFixed(1), onChange: (v) => set("value", v / 100) }),
    s.mechanism === "growthRate" && /* @__PURE__ */ jsx18(NumField, { label: "Growth rate", unit: "%/mo", value: +((p.rate || 0) * 100).toFixed(1), onChange: (v) => set("rate", v / 100) }),
    s.parameter === "people" && /* @__PURE__ */ jsx18(
      SelectField,
      {
        label: "People change",
        value: p.kind || "attritionDelta",
        onChange: (v) => set("kind", v),
        options: [{ value: "attritionDelta", label: "Attrition delta" }, { value: "hiringFreeze", label: "Hiring freeze" }, { value: "trainingShrinkage", label: "Training shrinkage" }, { value: "headcountStep", label: "Headcount step" }]
      }
    ),
    s.mechanism === "manualSeries" && /* @__PURE__ */ jsxs17("div", { style: { marginTop: 8 }, children: [
      /* @__PURE__ */ jsxs17("div", { className: "lab", style: { marginBottom: 6 }, children: [
        "Manual series \u2014 click a ",
        s.granularity || "week",
        " to add it, then set its value"
      ] }),
      /* @__PURE__ */ jsx18(WeekGrid, { horizon, value: (w) => (p.series || {})[w] != null, onToggle: (w) => {
        const ser = { ...p.series || {} };
        if (ser[w] != null) delete ser[w];
        else ser[w] = 0.1;
        set("series", ser);
      }, render: (w) => /* @__PURE__ */ jsx18(
        "input",
        {
          type: "number",
          className: "inp",
          style: { width: 48, fontSize: 11, padding: "2px 4px" },
          value: +(((p.series || {})[w] || 0) * 100).toFixed(0),
          onChange: (e) => set("series", { ...p.series || {}, [w]: Number(e.target.value) / 100 }),
          "aria-label": "Period " + (w + 1) + " value"
        }
      ) })
    ] })
  ] });
}
function ScopeEditor({ config, group, ops }) {
  const scope = group.scope || {};
  const chip = (kind, id, label, on) => /* @__PURE__ */ jsxs17("label", { className: "switch", children: [
    /* @__PURE__ */ jsx18("input", { type: "checkbox", checked: on, onChange: (e) => ops.toggleGroupScopeTarget(group.id, kind, id, e.target.checked), "data-testid": "scope-" + kind + "-" + id }),
    /* @__PURE__ */ jsx18("span", { className: "track", "aria-hidden": "true" }),
    /* @__PURE__ */ jsx18("span", { children: label })
  ] }, kind + id);
  const anyTarget = (scope.brandIds || []).length || (scope.channels || []).length || (scope.queueIds || []).length;
  return /* @__PURE__ */ jsxs17("div", { children: [
    /* @__PURE__ */ jsxs17("div", { className: "lab", style: { marginBottom: 6 }, children: [
      "Targets ",
      /* @__PURE__ */ jsx18(Hint, { text: "Brands, channels or queues this group's factors apply to. Empty = the whole operation." })
    ] }),
    /* @__PURE__ */ jsx18("div", { className: "rowflex", style: { flexWrap: "wrap", marginBottom: 6 }, children: (config.brands || []).map((b) => chip("brand", b.id, "Brand: " + b.name, (scope.brandIds || []).includes(b.id))) }),
    /* @__PURE__ */ jsx18("div", { className: "rowflex", style: { flexWrap: "wrap", marginBottom: 6 }, children: CHANNELS.map((c) => chip("channel", c.key, c.label, (scope.channels || []).includes(c.key))) }),
    /* @__PURE__ */ jsx18("div", { className: "rowflex", style: { flexWrap: "wrap" }, children: config.queues.map((q) => chip("queue", q.id, q.name, (scope.queueIds || []).includes(q.id))) }),
    !anyTarget && /* @__PURE__ */ jsx18("p", { className: "note", style: { marginTop: 6 }, children: "No targets \u2014 this group applies to the whole operation." })
  ] });
}
function GroupCard({ config, group, ops, horizon }) {
  const factorIds = Array.isArray(group.scenarioIds) ? group.scenarioIds : null;
  const editable = !group.builtin && factorIds != null;
  const factors = (factorIds || []).map((id) => config.scenarios.findIndex((s) => s.id === id)).filter((i) => i >= 0);
  return /* @__PURE__ */ jsxs17("div", { className: "erow", "data-testid": "group-card", children: [
    /* @__PURE__ */ jsxs17("div", { className: "erow-h", children: [
      group.builtin ? /* @__PURE__ */ jsx18("span", { className: "pill", children: "built-in" }) : /* @__PURE__ */ jsx18("span", { className: "tag soft", children: "group" }),
      editable ? /* @__PURE__ */ jsx18("input", { type: "text", className: "inp", style: { maxWidth: 240 }, value: group.name, "aria-label": "Group name", onChange: (e) => ops.renameGroup(group.id, e.target.value) }) : /* @__PURE__ */ jsx18("strong", { children: group.name }),
      /* @__PURE__ */ jsxs17("span", { className: "pill", children: [
        groupScenarioIds(config, group.id).length,
        " factor(s)"
      ] }),
      /* @__PURE__ */ jsx18("span", { className: "spacer" }),
      editable && /* @__PURE__ */ jsx18("button", { type: "button", className: "btn sm primary", onClick: () => ops.addFactor(group.id), "data-testid": "add-factor-" + group.id, children: "+ Add factor" }),
      !group.builtin && /* @__PURE__ */ jsx18("button", { type: "button", className: "btn sm danger", onClick: () => ops.deleteGroup(group.id), children: "Delete" })
    ] }),
    /* @__PURE__ */ jsxs17("div", { className: "erow-b", children: [
      !factorIds && /* @__PURE__ */ jsx18("p", { className: "note", children: "Built-in group \u2014 tracks the live enabled set of every group's factors." }),
      editable && /* @__PURE__ */ jsxs17(Fragment9, { children: [
        /* @__PURE__ */ jsx18(ScopeEditor, { config, group, ops }),
        /* @__PURE__ */ jsx18("hr", { className: "sep", style: { margin: "12px 0" } }),
        /* @__PURE__ */ jsxs17("div", { className: "rows", "data-testid": "scenario-rows", children: [
          factors.map((ti) => {
            const s = config.scenarios[ti];
            return /* @__PURE__ */ jsxs17("div", { className: "erow", children: [
              /* @__PURE__ */ jsxs17("div", { className: "erow-h", children: [
                /* @__PURE__ */ jsx18(Toggle, { checked: s.enabled, onChange: (v) => ops.patchScenario(ti, ["enabled"], v) }),
                /* @__PURE__ */ jsx18("input", { type: "text", className: "inp", style: { maxWidth: 220 }, value: s.name, "aria-label": "Factor name", onChange: (e) => ops.patchScenario(ti, ["name"], e.target.value) }),
                /* @__PURE__ */ jsxs17("span", { className: "pill", children: [
                  s.parameter,
                  " \xB7 ",
                  s.mechanism
                ] }),
                /* @__PURE__ */ jsx18("span", { className: "spacer" }),
                /* @__PURE__ */ jsx18("button", { type: "button", className: "btn sm danger", onClick: () => ops.deleteScenario(s.id), children: "Remove" })
              ] }),
              /* @__PURE__ */ jsx18("div", { className: "erow-b", children: /* @__PURE__ */ jsx18(FactorParams, { s, ti, ops, horizon }) })
            ] }, s.id);
          }),
          factors.length === 0 && /* @__PURE__ */ jsx18("p", { className: "note", children: "No factors yet. Add one above." })
        ] })
      ] })
    ] })
  ] });
}
function ParameterTimeline({ config }) {
  const N = config.engine.horizonWeeks;
  const enabled = config.scenarios.filter((s) => s.enabled);
  if (!enabled.length) return /* @__PURE__ */ jsx18("p", { className: "note", children: "No factors enabled \u2014 nothing in force." });
  const fires = (s, w) => {
    const start = s.startWeek || 0;
    const stop = s.stopWeek != null ? s.stopWeek : s.p && s.p.stopWeek != null ? s.p.stopWeek : null;
    if (w < start) return false;
    if (stop != null && w >= stop) return false;
    return true;
  };
  const weeks = Array.from({ length: Math.min(N, 52) }, (_, w) => w);
  return /* @__PURE__ */ jsx18("div", { className: "tbl-wrap", children: /* @__PURE__ */ jsxs17("table", { className: "data", "data-testid": "parameter-timeline", children: [
    /* @__PURE__ */ jsx18("thead", { children: /* @__PURE__ */ jsxs17("tr", { children: [
      /* @__PURE__ */ jsx18("th", { style: { textAlign: "left" }, children: "Factor" }),
      weeks.filter((w) => w % 4 === 0).map((w) => /* @__PURE__ */ jsx18("th", { children: w + 1 }, w))
    ] }) }),
    /* @__PURE__ */ jsx18("tbody", { children: enabled.map((s) => /* @__PURE__ */ jsxs17("tr", { children: [
      /* @__PURE__ */ jsx18("td", { style: { textAlign: "left", fontWeight: 600 }, children: s.name }),
      weeks.filter((w) => w % 4 === 0).map((w) => /* @__PURE__ */ jsx18("td", { className: fires(s, w) ? "st-green" : "", children: fires(s, w) ? "\u25CF" : "\xB7" }, w))
    ] }, s.id)) })
  ] }) });
}
function ScenariosEditor({ config, ops }) {
  const [name, setName] = useState15("");
  const horizon = config.engine.horizonWeeks;
  return /* @__PURE__ */ jsxs17("div", { className: "grid", style: { gap: 14 }, children: [
    /* @__PURE__ */ jsxs17("div", { className: "btnbar", children: [
      /* @__PURE__ */ jsx18("input", { type: "text", className: "inp", style: { maxWidth: 220 }, placeholder: "new scenario group name", value: name, onChange: (e) => setName(e.target.value), "data-testid": "group-name" }),
      /* @__PURE__ */ jsx18("button", { type: "button", className: "btn primary", onClick: () => {
        ops.addGroup(name.trim() || "New group", []);
        setName("");
      }, "data-testid": "add-group", children: "+ New scenario group" }),
      /* @__PURE__ */ jsxs17("span", { className: "note", style: { padding: "6px 10px" }, children: [
        "A group scopes its factors to brands, channels or queues. ",
        config.groups.length,
        " group(s)."
      ] })
    ] }),
    /* @__PURE__ */ jsx18("div", { className: "rows", "data-testid": "groups", children: (config.groups || []).map((g) => /* @__PURE__ */ jsx18(GroupCard, { config, group: g, ops, horizon }, g.id)) }),
    /* @__PURE__ */ jsx18(Card, { title: "Parameter timeline", sub: "what is in force each week", hint: "Which enabled factors fire in each 4-weekly checkpoint across the horizon.", children: /* @__PURE__ */ jsx18(ParameterTimeline, { config }) })
  ] });
}

// ui/editors/SettingsEditor.jsx
import { useState as useState17 } from "react";

// ui/editors/PresetLibrary.jsx
import { useState as useState16 } from "react";
import { jsx as jsx19, jsxs as jsxs18 } from "react/jsx-runtime";
function MonthEditor({ months, onChange, testid }) {
  return /* @__PURE__ */ jsx19("div", { className: "fieldrow", "data-testid": testid, children: MONTHS.map((m, i) => /* @__PURE__ */ jsx19("div", { style: { width: 82 }, children: /* @__PURE__ */ jsx19(
    NumField,
    {
      label: m,
      unit: "%",
      value: +(months[i] * 100).toFixed(0),
      id: testid ? testid + "-" + i : void 0,
      onChange: (v) => {
        const n = months.slice();
        n[i] = v / 100;
        onChange(n);
      }
    }
  ) }, m)) });
}
function PresetLibrary({ kind, presets, setPresets, eng }) {
  const [newName, setNewName] = useState16("");
  const isSeason = kind === "seasonality";
  const make = isSeason ? (name) => makeSeasonalityPreset(name, new Array(12).fill(1)) : (name) => makeIntradayPreset(name, new Array(24).fill(1));
  const valuesOf = (p) => isSeason ? p.months : p.curve;
  const update = (id, patch) => setPresets((lib) => lib.map((p) => p.id === id ? { ...p, ...patch } : p));
  const remove = (id) => setPresets((lib) => lib.filter((p) => p.id !== id));
  const add = () => {
    const name = newName.trim() || (isSeason ? "New seasonality" : "New arrival");
    setPresets((lib) => [...lib, make(name)]);
    setNewName("");
  };
  return /* @__PURE__ */ jsxs18("div", { className: "preset-lib", children: [
    /* @__PURE__ */ jsxs18("div", { className: "rowflex", children: [
      /* @__PURE__ */ jsx19(
        "input",
        {
          type: "text",
          className: "inp",
          style: { maxWidth: 220 },
          placeholder: "new pattern name",
          value: newName,
          onChange: (e) => setNewName(e.target.value),
          "data-testid": "preset-new-" + kind
        }
      ),
      /* @__PURE__ */ jsx19("button", { type: "button", className: "btn sm primary", onClick: add, "data-testid": "preset-add-" + kind, children: "+ Add pattern" }),
      /* @__PURE__ */ jsxs18("span", { className: "note", style: { padding: "6px 10px" }, children: [
        presets.length,
        " pattern(s). Create, edit and delete freely \u2014 edits flow to any queue using the pattern on the next re-simulation. Apply patterns on the Queues tab."
      ] })
    ] }),
    presets.map((p) => /* @__PURE__ */ jsxs18("div", { className: "preset-item", "data-testid": "preset-item-" + p.id, children: [
      /* @__PURE__ */ jsxs18("div", { className: "preset-item-h", children: [
        /* @__PURE__ */ jsx19("input", { type: "text", className: "inp", style: { maxWidth: 220 }, value: p.name, "aria-label": "Pattern name", onChange: (e) => update(p.id, { name: e.target.value }) }),
        /* @__PURE__ */ jsx19("span", { className: "pill", children: p.builtin ? "built-in" : "custom" }),
        /* @__PURE__ */ jsx19("span", { className: "spacer" }),
        /* @__PURE__ */ jsx19("button", { type: "button", className: "btn sm danger", onClick: () => remove(p.id), "data-testid": "preset-del-" + p.id, children: "Delete" })
      ] }),
      isSeason ? /* @__PURE__ */ jsx19(MonthEditor, { months: valuesOf(p), onChange: (next) => update(p.id, { months: next }), testid: "preset-months-" + p.id }) : /* @__PURE__ */ jsx19(IntradaySliders, { curve: valuesOf(p), eng, onChange: (next) => update(p.id, { curve: next }) })
    ] }, p.id))
  ] });
}

// ui/editors/SettingsEditor.jsx
var import_engine9 = __toESM(require_engine());
import { Fragment as Fragment10, jsx as jsx20, jsxs as jsxs19 } from "react/jsx-runtime";
var CHANNELS2 = [{ key: "voice", label: "Voice" }, { key: "digital", label: "Digital" }, { key: "support", label: "Support" }];
var KIND_LABEL = { voice: "Voice \xB7 Erlang", digitalCustomer: "Digital Customer \xB7 live", digitalWorkflow: "Digital Workflow \xB7 backlog", serviceWorkflow: "Service Workflow \xB7 support" };
function ChannelTemplateFields({ d, ops }) {
  const t = d.template || {};
  const T = (path, v) => ops.patchChannelDef(d.id, ["template", ...path], v);
  return /* @__PURE__ */ jsxs19("div", { className: "fieldrow", children: [
    d.kind === "voice" && /* @__PURE__ */ jsxs19(Fragment10, { children: [
      /* @__PURE__ */ jsx20(NumField, { label: "ASA target", unit: "s", value: t.asaTarget, onChange: (v) => T(["asaTarget"], v), id: "chdef-" + d.id + "-asa" }),
      /* @__PURE__ */ jsx20(NumField, { label: "Max abandon", unit: "%", value: +((t.maxAbandon || 0) * 100).toFixed(1), onChange: (v) => T(["maxAbandon"], v / 100) }),
      /* @__PURE__ */ jsx20(NumField, { label: "Patience", unit: "s", value: t.patience, onChange: (v) => T(["patience"], v) })
    ] }),
    d.kind === "digitalCustomer" && /* @__PURE__ */ jsxs19(Fragment10, { children: [
      /* @__PURE__ */ jsx20(NumField, { label: "Concurrency", value: t.concurrency, onChange: (v) => T(["concurrency"], v), id: "chdef-" + d.id + "-concurrency" }),
      /* @__PURE__ */ jsx20(NumField, { label: "SLA within", unit: "min", value: t.digitalSlaMinutes, onChange: (v) => T(["digitalSlaMinutes"], v), id: "chdef-" + d.id + "-slamins" }),
      /* @__PURE__ */ jsx20(NumField, { label: "SLA target", unit: "%", value: +((t.digitalSlaPct || 0) * 100).toFixed(0), onChange: (v) => T(["digitalSlaPct"], v / 100) })
    ] }),
    d.kind === "digitalWorkflow" && /* @__PURE__ */ jsxs19(Fragment10, { children: [
      /* @__PURE__ */ jsx20(NumField, { label: "SLA within", unit: "h", value: t.workflowSlaHours, onChange: (v) => T(["workflowSlaHours"], v), id: "chdef-" + d.id + "-slahours" }),
      /* @__PURE__ */ jsx20(NumField, { label: "SLA target", unit: "%", value: +((t.workflowSlaPct || 0) * 100).toFixed(0), onChange: (v) => T(["workflowSlaPct"], v / 100) })
    ] }),
    d.kind === "serviceWorkflow" && /* @__PURE__ */ jsxs19(Fragment10, { children: [
      /* @__PURE__ */ jsx20(NumField, { label: "SLA within", unit: "days", value: Math.round((t.workflowSlaHours || 0) / 24), onChange: (v) => T(["workflowSlaHours"], (v || 0) * 24), id: "chdef-" + d.id + "-sladays" }),
      /* @__PURE__ */ jsx20(NumField, { label: "SLA target", unit: "%", value: +((t.workflowSlaPct || 0) * 100).toFixed(0), onChange: (v) => T(["workflowSlaPct"], v / 100) })
    ] })
  ] });
}
function ChannelsManager({ config, ops }) {
  const [name, setName] = useState17("");
  const [preset, setPreset] = useState17("voice");
  return /* @__PURE__ */ jsxs19(Card, { title: "Channels", hint: "Create a channel from a preset \u2014 its template carries the mechanics of that kind (Voice Erlang; Digital Customer concurrency + minutes SLA; Digital Workflow no concurrency + hours SLA; Service Workflow days SLA). Queues attach to a channel on the Queues tab and inherit its sections.", children: [
    /* @__PURE__ */ jsxs19("div", { className: "rowflex", style: { marginBottom: 10 }, children: [
      /* @__PURE__ */ jsx20("input", { type: "text", className: "inp", style: { maxWidth: 200 }, placeholder: "new channel name", value: name, onChange: (e) => setName(e.target.value), "data-testid": "channel-name" }),
      /* @__PURE__ */ jsx20("div", { style: { minWidth: 210 }, children: /* @__PURE__ */ jsx20(SelectField, { label: "Preset", value: preset, onChange: setPreset, options: CHANNEL_PRESET_LIST, id: "channel-preset" }) }),
      /* @__PURE__ */ jsx20("button", { type: "button", className: "btn sm primary", style: { alignSelf: "flex-end" }, onClick: () => {
        ops.addChannel(name.trim() || void 0, preset);
        setName("");
      }, "data-testid": "add-channel", children: "+ Add channel" })
    ] }),
    /* @__PURE__ */ jsx20("div", { className: "rows", children: (config.channelDefs || []).map((d) => {
      const count = (config.queues || []).filter((q) => q.channelId === d.id).length;
      return /* @__PURE__ */ jsxs19("div", { className: "erow", "data-testid": "chdef-" + d.id, children: [
        /* @__PURE__ */ jsxs19("div", { className: "erow-h", children: [
          /* @__PURE__ */ jsx20("input", { type: "text", className: "inp", style: { maxWidth: 200 }, value: d.name, "aria-label": "Channel name", onChange: (e) => ops.patchChannelDef(d.id, ["name"], e.target.value) }),
          /* @__PURE__ */ jsx20("span", { className: "pill", children: KIND_LABEL[d.kind] || d.kind }),
          /* @__PURE__ */ jsx20("span", { className: "pill", children: d.group }),
          /* @__PURE__ */ jsxs19("span", { className: "pill", children: [
            count,
            " queue(s)"
          ] }),
          /* @__PURE__ */ jsx20("span", { className: "spacer" }),
          /* @__PURE__ */ jsx20("button", { type: "button", className: "btn sm danger", onClick: () => ops.deleteChannelDef(d.id), "data-testid": "chdef-del-" + d.id, children: "Delete" })
        ] }),
        /* @__PURE__ */ jsx20("div", { className: "erow-b", children: /* @__PURE__ */ jsx20(ChannelTemplateFields, { d, ops }) })
      ] }, d.id);
    }) })
  ] });
}
function OrgSetup({ config, ops }) {
  const cal = config.settings && config.settings.calendar || {};
  return /* @__PURE__ */ jsxs19(Card, { title: "Organisation & calendar", hint: "Create brands here (name only). A queue's channel \u2014 Voice, Digital or Support \u2014 and, for digital, its Customer/Workflow subtype are chosen per queue on the Queues tab.", children: [
    /* @__PURE__ */ jsxs19("div", { className: "rowflex", style: { marginBottom: 10 }, children: [
      /* @__PURE__ */ jsxs19("label", { className: "field", style: { maxWidth: 220 }, children: [
        /* @__PURE__ */ jsxs19("span", { className: "lab", children: [
          "Week-1 date ",
          /* @__PURE__ */ jsx20(Hint, { text: "The calendar date week 1 of the horizon starts on. Anchors the seasonality wizard and month-granular scenarios to real months. Blank = start from January." })
        ] }),
        /* @__PURE__ */ jsx20("input", { type: "date", value: cal.weekOneDate || "", onChange: (e) => ops.setWeekOneDate(e.target.value || null), "data-testid": "week-one-date" })
      ] }),
      /* @__PURE__ */ jsx20("button", { type: "button", className: "btn sm primary", onClick: () => ops.addBrand(), "data-testid": "add-brand", style: { alignSelf: "flex-end" }, children: "+ Add brand" })
    ] }),
    /* @__PURE__ */ jsx20("div", { className: "rows", children: (config.brands || []).map((b) => /* @__PURE__ */ jsxs19("div", { className: "erow", children: [
      /* @__PURE__ */ jsxs19("div", { className: "erow-h", children: [
        /* @__PURE__ */ jsx20("input", { type: "text", className: "inp", style: { maxWidth: 220 }, value: b.name, "aria-label": "Brand name", onChange: (e) => ops.patchBrand(b.id, ["name"], e.target.value) }),
        /* @__PURE__ */ jsxs19("span", { className: "pill", children: [
          (config.queues || []).filter((q) => q.brandId === b.id).length,
          " queue(s)"
        ] }),
        /* @__PURE__ */ jsx20("span", { className: "spacer" }),
        /* @__PURE__ */ jsxs19("label", { className: "switch", children: [
          /* @__PURE__ */ jsx20("input", { type: "checkbox", checked: !!b.training, onChange: (e) => ops.toggleBrandTraining(b.id, e.target.checked) }),
          /* @__PURE__ */ jsx20("span", { className: "track", "aria-hidden": "true" }),
          /* @__PURE__ */ jsx20("span", { style: { fontSize: 11 }, children: "Training profile" })
        ] }),
        (config.brands || []).length > 1 && /* @__PURE__ */ jsx20("button", { type: "button", className: "btn sm danger", onClick: () => ops.deleteBrand(b.id), children: "Delete" })
      ] }),
      b.training && /* @__PURE__ */ jsx20("div", { className: "erow-b", children: /* @__PURE__ */ jsxs19("div", { className: "fieldrow", children: [
        /* @__PURE__ */ jsx20(NumField, { label: "Training weeks", value: b.training.trainingWeeks, onChange: (v) => ops.patchBrand(b.id, ["training", "trainingWeeks"], v) }),
        /* @__PURE__ */ jsx20(NumField, { label: "Training shrinkage", unit: "%", value: +((b.training.trainingShrinkagePct || 0) * 100).toFixed(1), onChange: (v) => ops.patchBrand(b.id, ["training", "trainingShrinkagePct"], v / 100) })
      ] }) })
    ] }, b.id)) })
  ] });
}
function CapsMatrix({ config, ops }) {
  const caps = config.hiring.caps || { segments: {}, brands: {}, total: config.hiring.cap };
  const brands = config.brands || [];
  const segVal = (bid, ch) => {
    const v = (caps.segments || {})[bid + "|" + ch];
    return v == null ? "" : v;
  };
  return /* @__PURE__ */ jsxs19(Card, { title: "Hiring caps", sub: "brand \xD7 channel", hint: "Requisitions per week allowed in each brand \xD7 channel segment (blank = unlimited), plus optional per-brand and total ceilings. When a ceiling binds, scarce hires are trimmed from the lowest marginal-churn grant first.", children: [
    /* @__PURE__ */ jsx20("div", { className: "tbl-wrap", children: /* @__PURE__ */ jsxs19("table", { className: "data", "data-testid": "caps-matrix", children: [
      /* @__PURE__ */ jsx20("thead", { children: /* @__PURE__ */ jsxs19("tr", { children: [
        /* @__PURE__ */ jsx20("th", { children: "Brand" }),
        CHANNELS2.map((c) => /* @__PURE__ */ jsx20("th", { children: c.label }, c.key)),
        /* @__PURE__ */ jsx20("th", { children: "Brand ceiling" })
      ] }) }),
      /* @__PURE__ */ jsx20("tbody", { children: brands.map((b) => /* @__PURE__ */ jsxs19("tr", { children: [
        /* @__PURE__ */ jsx20("td", { style: { textAlign: "left", fontWeight: 600 }, children: b.name }),
        CHANNELS2.map((c) => /* @__PURE__ */ jsx20("td", { children: /* @__PURE__ */ jsx20(
          "input",
          {
            type: "number",
            className: "inp",
            style: { width: 72 },
            value: segVal(b.id, c.key),
            placeholder: "\u221E",
            "data-testid": "cap-" + b.id + "-" + c.key,
            onChange: (e) => ops.patchCapSegment(b.id, c.key, e.target.value === "" ? null : Number(e.target.value)),
            "aria-label": b.name + " " + c.label + " cap"
          }
        ) }, c.key)),
        /* @__PURE__ */ jsx20("td", { children: /* @__PURE__ */ jsx20(
          "input",
          {
            type: "number",
            className: "inp",
            style: { width: 72 },
            value: (caps.brands || {})[b.id] == null ? "" : (caps.brands || {})[b.id],
            placeholder: "\u221E",
            "data-testid": "cap-brand-" + b.id,
            onChange: (e) => ops.patchCapBrand(b.id, e.target.value === "" ? null : Number(e.target.value)),
            "aria-label": b.name + " ceiling"
          }
        ) })
      ] }, b.id)) })
    ] }) }),
    /* @__PURE__ */ jsxs19("div", { className: "rowflex", style: { marginTop: 10 }, children: [
      /* @__PURE__ */ jsx20(NumField, { label: "Total ceiling", unit: "/wk", id: "cap-total", value: caps.total == null ? "" : caps.total, onChange: (v) => ops.patchCapTotal(v), hint: "The operation-wide weekly cap across all segments. Blank = no total ceiling." }),
      /* @__PURE__ */ jsx20("span", { className: "note", style: { padding: "6px 10px" }, children: "Effective limit for a segment = the tightest of its segment cap, its brand ceiling and the total ceiling." })
    ] })
  ] });
}
function SettingsEditor({ config, ops, intradayPresets, setIntradayPresets, seasonalityPresets, setSeasonalityPresets }) {
  const eng = config.engine, hir = config.hiring, costs = config.costs, cx = config.cx, loops = config.loops;
  const set = config.settings || {};
  const ot = set.ot || {}, tr = set.training || {}, debt = set.trainingDebt || {}, kn = set.knockOn || {}, risk = set.risk || {};
  const P = (path, v) => ops.patch(path, v);
  const S = (path, v) => ops.patch(["settings", ...path], v);
  const band = (fam, key, testid) => /* @__PURE__ */ jsxs19("div", { className: "rowflex", style: { gap: 8 }, children: [
    /* @__PURE__ */ jsx20("span", { style: { minWidth: 150, fontSize: 12, fontWeight: 600 }, children: key }),
    /* @__PURE__ */ jsx20("div", { style: { width: 96 }, children: /* @__PURE__ */ jsx20(NumField, { label: "Amber", value: (risk[fam] || {}).amber, onChange: (v) => S(["risk", fam, "amber"], v), id: testid + "-amber" }) }),
    /* @__PURE__ */ jsx20("div", { style: { width: 96 }, children: /* @__PURE__ */ jsx20(NumField, { label: "Red", value: (risk[fam] || {}).red, onChange: (v) => S(["risk", fam, "red"], v), id: testid + "-red" }) })
  ] });
  return /* @__PURE__ */ jsxs19("div", { className: "grid", style: { gap: 16 }, children: [
    /* @__PURE__ */ jsx20(OrgSetup, { config, ops }),
    /* @__PURE__ */ jsx20(ChannelsManager, { config, ops }),
    /* @__PURE__ */ jsx20(CapsMatrix, { config, ops }),
    /* @__PURE__ */ jsxs19("div", { className: "grid cols-2", style: { alignItems: "start" }, children: [
      /* @__PURE__ */ jsxs19(Card, { title: "Engine & simulation window", children: [
        /* @__PURE__ */ jsxs19("div", { className: "fieldrow", children: [
          /* @__PURE__ */ jsx20(
            NumField,
            {
              id: "horizon-input",
              label: "Simulation window",
              unit: "wk",
              value: eng.horizonWeeks,
              min: 24,
              max: 78,
              onChange: (v) => P(["engine", "horizonWeeks"], (0, import_engine9.clamp)(Math.round(v || 52), 24, 78)),
              hint: "Weekly horizon, clamped to [24, 78]. 24 floors it because the 10-week hire-to-productive pipeline plus ramp needs room to matter; default 52."
            }
          ),
          /* @__PURE__ */ jsx20(NumField, { label: "Occupancy ceiling", unit: "%", value: +(eng.occupancyCeiling * 100).toFixed(0), onChange: (v) => P(["engine", "occupancyCeiling"], v / 100) }),
          /* @__PURE__ */ jsx20(TextField, { label: "Currency", value: eng.currency, onChange: (v) => P(["engine", "currency"], v || "\xA3") })
        ] }),
        /* @__PURE__ */ jsxs19("div", { className: "fieldrow", children: [
          /* @__PURE__ */ jsx20(NumField, { label: "Day start", unit: "h", value: eng.dayStart, onChange: (v) => P(["engine", "dayStart"], v) }),
          /* @__PURE__ */ jsx20(NumField, { label: "Day end", unit: "h", value: eng.dayEnd, onChange: (v) => P(["engine", "dayEnd"], v) }),
          /* @__PURE__ */ jsx20(NumField, { label: "Interval", unit: "min", value: eng.intervalMin, onChange: (v) => P(["engine", "intervalMin"], v) }),
          /* @__PURE__ */ jsx20(NumField, { label: "Support prof.", unit: "%", value: +(eng.crossSkillProficiency * 100).toFixed(0), onChange: (v) => P(["engine", "crossSkillProficiency"], v / 100) })
        ] })
      ] }),
      /* @__PURE__ */ jsx20(Card, { title: "Global starting HC", hint: "Queues left blank share this pool, weighted by workload (volume \xD7 AHT \xF7 concurrency). Explicit per-queue HC wins; unmanned queues are excluded.", children: /* @__PURE__ */ jsxs19("label", { className: "field", style: { maxWidth: 240 }, children: [
        /* @__PURE__ */ jsx20("span", { className: "lab", children: "Global starting HC" }),
        /* @__PURE__ */ jsx20(
          "input",
          {
            type: "number",
            value: eng.globalStartingHC == null ? "" : eng.globalStartingHC,
            placeholder: "(none \u2014 blanks resolve to 0)",
            onChange: (e) => P(["engine", "globalStartingHC"], e.target.value === "" ? null : Number(e.target.value)),
            "data-testid": "global-hc"
          }
        )
      ] }) }),
      /* @__PURE__ */ jsx20(Card, { title: "Overtime rules", hint: "Rung 2 of the supply ladder: own overtime, capped per agent per day AND by a weekly ceiling, costed at a premium and feeding the burnout index.", children: /* @__PURE__ */ jsxs19("div", { className: "fieldrow", children: [
        /* @__PURE__ */ jsx20(NumField, { label: "Max / agent / day", unit: "h", value: ot.maxDailyHours, step: "0.5", onChange: (v) => S(["ot", "maxDailyHours"], v) }),
        /* @__PURE__ */ jsx20(NumField, { label: "Weekly ceiling", unit: "h", value: ot.weeklyCeiling, onChange: (v) => S(["ot", "weeklyCeiling"], v) }),
        /* @__PURE__ */ jsx20(NumField, { label: "Premium", unit: "\xD7", value: ot.premium, step: "0.1", onChange: (v) => S(["ot", "premium"], v) }),
        /* @__PURE__ */ jsx20(NumField, { label: "Burnout load", value: ot.burnoutLoad, onChange: (v) => S(["ot", "burnoutLoad"], v) })
      ] }) }),
      /* @__PURE__ */ jsxs19(Card, { title: "Training & debt", hint: "Rung 3: training reclaim converts up to the training-shrinkage share back to service, accruing a debt index that lifts AHT and attrition until training is restored.", children: [
        /* @__PURE__ */ jsxs19("div", { className: "fieldrow", children: [
          /* @__PURE__ */ jsx20(NumField, { label: "Default training", unit: "wk", value: tr.weeks, onChange: (v) => S(["training", "weeks"], v) }),
          /* @__PURE__ */ jsx20(NumField, { label: "Training shrinkage", unit: "%", value: +((tr.shrinkagePct || 0) * 100).toFixed(1), onChange: (v) => S(["training", "shrinkagePct"], v / 100) })
        ] }),
        /* @__PURE__ */ jsxs19("div", { className: "fieldrow", children: [
          /* @__PURE__ */ jsx20(NumField, { label: "Debt accrual", value: debt.accumRate, onChange: (v) => S(["trainingDebt", "accumRate"], v) }),
          /* @__PURE__ */ jsx20(NumField, { label: "Debt recovery", value: debt.recoveryRate, onChange: (v) => S(["trainingDebt", "recoveryRate"], v) }),
          /* @__PURE__ */ jsx20(NumField, { label: "Max AHT penalty", unit: "%", value: +((debt.maxAhtPenalty || 0) * 100).toFixed(0), onChange: (v) => S(["trainingDebt", "maxAhtPenalty"], v / 100) }),
          /* @__PURE__ */ jsx20(NumField, { label: "Max attrition", unit: "\xD7", value: debt.maxAttritionMult, step: "0.1", onChange: (v) => S(["trainingDebt", "maxAttritionMult"], v) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs19(Card, { title: "Knock-on channel defaults", hint: "Repeat and spill shares a queue inherits unless it overrides them. Voice repeat defaults to the legacy redial; digital spill to the legacy deflection.", children: [
        ["voice", "digital", "support"].map((ch) => /* @__PURE__ */ jsxs19("div", { className: "fieldrow", children: [
          /* @__PURE__ */ jsx20("div", { style: { minWidth: 70, alignSelf: "flex-end", fontSize: 12, fontWeight: 600, paddingBottom: 8, textTransform: "capitalize" }, children: ch }),
          /* @__PURE__ */ jsx20(NumField, { label: "Repeat", unit: "%", value: (kn[ch] || {}).repeatPct == null ? "" : +((kn[ch] || {}).repeatPct * 100).toFixed(0), onChange: (v) => S(["knockOn", ch, "repeatPct"], v === 0 ? 0 : v / 100) }),
          /* @__PURE__ */ jsx20(NumField, { label: "Spill", unit: "%", value: (kn[ch] || {}).spillPct == null ? "" : +((kn[ch] || {}).spillPct * 100).toFixed(0), onChange: (v) => S(["knockOn", ch, "spillPct"], v === 0 ? 0 : v / 100) })
        ] }, ch)),
        /* @__PURE__ */ jsxs19("p", { className: "note", style: { marginTop: 8 }, children: [
          "Blank = inherit the legacy loop (voice redial ",
          Math.round(loops.redial * 100),
          "%, digital deflection ",
          Math.round(loops.deflection * 100),
          "%)."
        ] })
      ] }),
      /* @__PURE__ */ jsxs19(Card, { title: "Hiring, costs & CX", children: [
        /* @__PURE__ */ jsxs19("div", { className: "fieldrow", children: [
          /* @__PURE__ */ jsx20(NumField, { label: "Default buffer", unit: "%", value: +(hir.buffer * 100).toFixed(0), onChange: (v) => P(["hiring", "buffer"], v / 100), hint: "Fallback buffer for buffer strategies that don't set their own. Hiring caps live in the Hiring caps card below." }),
          /* @__PURE__ */ jsx20(NumField, { label: "Manager cost", unit: "/mo", value: costs.managerCostMonthly != null ? costs.managerCostMonthly : costs.managerCost != null ? costs.managerCost / 12 : 0, onChange: (v) => {
            P(["costs", "managerCostMonthly"], v);
            P(["costs", "managerCost"], v * 12);
          }, hint: "Monthly manager cost. The engine works weekly (\xD7 12 \xF7 52); outputs report monthly and annual." }),
          /* @__PURE__ */ jsx20(NumField, { label: "Manager ratio", unit: "1:n", value: costs.managerRatio, onChange: (v) => P(["costs", "managerRatio"], v) })
        ] }),
        /* @__PURE__ */ jsxs19("div", { className: "fieldrow", children: [
          /* @__PURE__ */ jsx20(NumField, { label: "\xA3 / lost customer", value: cx.costPerLostCustomer, onChange: (v) => P(["cx", "costPerLostCustomer"], v) }),
          /* @__PURE__ */ jsx20(NumField, { label: "Repeat uplift", unit: "\xD7", value: cx.repeatUplift, step: "0.1", onChange: (v) => P(["cx", "repeatUplift"], v) }),
          /* @__PURE__ */ jsx20(NumField, { label: "Redial rate", unit: "%", value: +(loops.redial * 100).toFixed(0), onChange: (v) => P(["loops", "redial"], v / 100) }),
          /* @__PURE__ */ jsx20(NumField, { label: "Deflection rate", unit: "%", value: +(loops.deflection * 100).toFixed(0), onChange: (v) => P(["loops", "deflection"], v / 100) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs19(Card, { title: "Risk parameters", hint: "Amber and red bands per risk family. The Summary risk register re-scores from these instantly \u2014 changing a band does not re-run the simulation.", children: [
      /* @__PURE__ */ jsxs19("div", { className: "grid cols-2", style: { gap: 10 }, children: [
        band("slaBreachRun", "SLA breach run (wk)", "risk-slabreach"),
        band("burnout", "Burnout peak (/100)", "risk-burnout"),
        band("trainingDebt", "Training-debt peak", "risk-debt"),
        band("otStreakWeeks", "Overtime streak (wk)", "risk-otstreak"),
        band("tippingMargin", "Tipping margin (/wk)", "risk-tipping"),
        band("knockOnShare", "Knock-on share", "risk-knockon")
      ] }),
      /* @__PURE__ */ jsx20("hr", { className: "sep", style: { margin: "12px 0" } }),
      /* @__PURE__ */ jsxs19("div", { className: "grid cols-2", style: { gap: 10 }, children: [
        /* @__PURE__ */ jsxs19("div", { className: "rowflex", style: { gap: 8 }, children: [
          /* @__PURE__ */ jsx20("span", { style: { minWidth: 150, fontSize: 12, fontWeight: 600 }, children: "Borrowed-capacity share" }),
          /* @__PURE__ */ jsx20("div", { style: { width: 96 }, children: /* @__PURE__ */ jsx20(NumField, { label: "Amber", unit: "%", value: +(((risk.borrowedShare || {}).amber || 0) * 100).toFixed(0), onChange: (v) => S(["risk", "borrowedShare", "amber"], v / 100), id: "risk-borrowed-amber" }) }),
          /* @__PURE__ */ jsx20("div", { style: { width: 96 }, children: /* @__PURE__ */ jsx20(NumField, { label: "Red", unit: "%", value: +(((risk.borrowedShare || {}).red || 0) * 100).toFixed(0), onChange: (v) => S(["risk", "borrowedShare", "red"], v / 100), id: "risk-borrowed-red" }) })
        ] }),
        /* @__PURE__ */ jsxs19("div", { className: "rowflex", style: { gap: 8 }, children: [
          /* @__PURE__ */ jsx20("span", { style: { minWidth: 150, fontSize: 12, fontWeight: 600 }, children: "Unmanned starvation" }),
          /* @__PURE__ */ jsx20("div", { style: { width: 110 }, children: /* @__PURE__ */ jsx20(NumField, { label: "Floor cover", unit: "%", value: +(((risk.unmannedStarvation || {}).floorCover || 0) * 100).toFixed(0), onChange: (v) => S(["risk", "unmannedStarvation", "floorCover"], v / 100) }) }),
          /* @__PURE__ */ jsx20("div", { style: { width: 96 }, children: /* @__PURE__ */ jsx20(NumField, { label: "\u2265 weeks", value: (risk.unmannedStarvation || {}).weeks, onChange: (v) => S(["risk", "unmannedStarvation", "weeks"], v) }) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx20(Card, { title: "Seasonality patterns", sub: "library", hint: "Named monthly-multiplier patterns. Create, edit and delete them here; apply a pattern to the system or a queue on the Queues tab.", children: /* @__PURE__ */ jsx20(PresetLibrary, { kind: "seasonality", presets: seasonalityPresets, setPresets: setSeasonalityPresets, eng: config.engine }) }),
    /* @__PURE__ */ jsx20(Card, { title: "Arrival patterns", sub: "library", hint: "Named intraday arrival curves. Create, edit and delete them here; apply a pattern to a queue on the Queues tab.", children: /* @__PURE__ */ jsx20(PresetLibrary, { kind: "arrival", presets: intradayPresets, setPresets: setIntradayPresets, eng: config.engine }) })
  ] });
}

// ui/App.jsx
import { jsx as jsx21, jsxs as jsxs20 } from "react/jsx-runtime";
var TABS = [
  { id: "summary", label: "Summary" },
  { id: "strategies", label: "Strategies" },
  { id: "plan", label: "Plan" },
  { id: "data", label: "Data" },
  { id: "intraday", label: "Intraday" },
  { id: "queues", label: "Queues" },
  { id: "scenarios", label: "Scenarios" },
  { id: "snapshots", label: "Snapshots" },
  { id: "settings", label: "Settings" }
];
function App() {
  const [config, setConfig] = useState18(() => migrateConfig((0, import_engine10.makeDefaultConfig)()));
  const [tab, setTab] = useState18("summary");
  const [intradayPresets, setIntradayPresets] = useState18(INTRADAY_PRESETS);
  const [seasonalityPresets, setSeasonalityPresets] = useState18(SEASONALITY_PRESETS);
  const ops = useConfigOps(setConfig);
  const [activeStrategyId, setActiveStrategyId] = useState18("S1");
  const [activeGroupId, setActiveGroupId] = useState18("g_por");
  const stratIdsAll = strategyList(config).map((s) => s.id);
  const safeStrategy = stratIdsAll.includes(activeStrategyId) ? activeStrategyId : stratIdsAll[0] || "S1";
  const groupIds = groupList(config).map((g) => g.id);
  const safeGroup = groupIds.includes(activeGroupId) ? activeGroupId : groupIds[0] || "g_por";
  const storage = useMemo3(() => makeStorageAdapter(), []);
  const [snapshots, setSnapshots] = useState18([]);
  const [compareSel, setCompareSel] = useState18([]);
  const [viewingSlug, setViewingSlug] = useState18(null);
  const hydrated = useRef4(false);
  const loadSnapshots = useCallback4(async () => {
    const index = await storage.get(KEYS.index) || [];
    const runs = [];
    for (const e of index) {
      const r = await storage.get(KEYS.run(e.slug));
      if (r) runs.push(r);
    }
    setSnapshots(runs);
  }, [storage]);
  useEffect4(() => {
    let alive = true;
    (async () => {
      const [ip, sp] = await Promise.all([storage.get(KEYS.intraday), storage.get(KEYS.seasonality)]);
      if (!alive) return;
      if (Array.isArray(ip) && ip.length) setIntradayPresets([...INTRADAY_PRESETS, ...ip]);
      if (Array.isArray(sp) && sp.length) setSeasonalityPresets([...SEASONALITY_PRESETS, ...sp]);
      await loadSnapshots();
      hydrated.current = true;
    })();
    return () => {
      alive = false;
    };
  }, [storage, loadSnapshots]);
  useEffect4(() => {
    if (hydrated.current) storage.set(KEYS.intraday, intradayPresets.filter((p) => !p.builtin));
  }, [intradayPresets, storage]);
  useEffect4(() => {
    if (hydrated.current) storage.set(KEYS.seasonality, seasonalityPresets.filter((p) => !p.builtin));
  }, [seasonalityPresets, storage]);
  const viewing = viewingSlug ? snapshots.find((r) => r.slug === viewingSlug) : null;
  const effectiveConfig = viewing ? migrateConfig(viewing.config) : config;
  const readOnly = !!viewing;
  const simConfig = useMemo3(() => resolvePresets(effectiveConfig, seasonalityPresets, intradayPresets), [effectiveConfig, seasonalityPresets, intradayPresets]);
  const simSet = useStrategySims(simConfig, safeStrategy, safeGroup);
  const { activeSim, pending } = simSet;
  const [matrix, setMatrix] = useState18(null);
  const liveHash = useMemo3(() => simHash(simConfig), [simConfig]);
  const matrixStale = !matrix || matrix.hash !== liveHash;
  const onRunMatrix = useCallback4(() => setMatrix(runMatrix(simConfig)), [simConfig]);
  const onSelectCell = useCallback4((gid, sid) => {
    setActiveGroupId(gid);
    setActiveStrategyId(sid);
  }, []);
  const saveSnapshot = useCallback4(async (name) => {
    if (!activeSim) return;
    const rec = makeSavedRun(name, activeSim.config, activeSim);
    await storage.set(KEYS.run(rec.slug), rec);
    const index = await storage.get(KEYS.index) || [];
    await storage.set(KEYS.index, [...index.filter((e) => e.slug !== rec.slug), indexEntry(rec)]);
    setSnapshots((rs) => [...rs.filter((r) => r.slug !== rec.slug), rec]);
  }, [activeSim, storage]);
  const deleteSnapshot = useCallback4(async (r) => {
    await storage.del(KEYS.run(r.slug));
    const index = await storage.get(KEYS.index) || [];
    await storage.set(KEYS.index, index.filter((e) => e.slug !== r.slug));
    setSnapshots((rs) => rs.filter((x) => x.slug !== r.slug));
    setCompareSel((sel) => sel.filter((s) => s !== r.slug));
    setViewingSlug((v) => v === r.slug ? null : v);
  }, [storage]);
  const loadSnapshotSettings = useCallback4((r) => {
    setConfig(migrateConfig(r.config));
    setViewingSlug(null);
    setTab("plan");
  }, []);
  const importConfig = useCallback4((c) => {
    setConfig(migrateConfig(c));
    setViewingSlug(null);
  }, []);
  const newSimulation = useCallback4((kind) => {
    setViewingSlug(null);
    if (kind === "duplicate") setConfig((c) => migrateConfig(JSON.parse(JSON.stringify(c))));
    else if (kind === "blank") setConfig(migrateConfig((0, import_engine10.makeBlankConfig)()));
    else setConfig(migrateConfig((0, import_engine10.makeDefaultConfig)()));
    setTab("plan");
  }, []);
  const isBlank = effectiveConfig.brands.length === 0 && effectiveConfig.queues.length === 0;
  const tabProps = {
    simSet,
    activeSim,
    sims: simSet.sims,
    stratIds: simSet.stratIds,
    config: effectiveConfig,
    ops,
    activeStrategy: safeStrategy,
    activeGroupId: safeGroup,
    onSetActive: setActiveStrategyId,
    onSelectGroup: setActiveGroupId,
    onImportConfig: importConfig,
    matrix,
    matrixStale,
    onRunMatrix,
    onSelectCell,
    intradayPresets,
    setIntradayPresets,
    seasonalityPresets,
    setSeasonalityPresets,
    snapshots,
    compareSel,
    setCompareSel,
    storage,
    onSaveSnapshot: saveSnapshot,
    onDeleteSnapshot: deleteSnapshot,
    onLoadSnapshotSettings: loadSnapshotSettings,
    onRefreshSnapshots: loadSnapshots
  };
  return /* @__PURE__ */ jsx21(PrintProvider, { children: /* @__PURE__ */ jsxs20("div", { className: "app", children: [
    /* @__PURE__ */ jsxs20("header", { className: "topbar", children: [
      /* @__PURE__ */ jsxs20("div", { className: "brand", children: [
        /* @__PURE__ */ jsx21("span", { className: "mark", children: "C" }),
        /* @__PURE__ */ jsx21("span", { children: "Capacity Simulator" }),
        /* @__PURE__ */ jsx21("small", { children: "call centre planning" })
      ] }),
      /* @__PURE__ */ jsx21("span", { className: "spacer" }),
      /* @__PURE__ */ jsxs20("div", { className: "topctrl", children: [
        /* @__PURE__ */ jsx21("span", { children: "New simulation" }),
        /* @__PURE__ */ jsxs20("select", { value: "", onChange: (e) => {
          if (e.target.value) newSimulation(e.target.value);
        }, "data-testid": "new-sim", "aria-label": "New simulation", children: [
          /* @__PURE__ */ jsx21("option", { value: "", children: "Choose\u2026" }),
          /* @__PURE__ */ jsx21("option", { value: "duplicate", children: "Duplicate current" }),
          /* @__PURE__ */ jsx21("option", { value: "defaults", children: "Start from defaults" }),
          /* @__PURE__ */ jsx21("option", { value: "blank", children: "Start blank" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx21("nav", { className: "tabs", role: "tablist", "aria-label": "Sections", children: TABS.map((t) => /* @__PURE__ */ jsx21("button", { type: "button", role: "tab", id: "tab-" + t.id, "aria-selected": tab === t.id, "aria-controls": "panel-" + t.id, className: "tab", onClick: () => setTab(t.id), children: t.label }, t.id)) }),
    /* @__PURE__ */ jsx21(
      ContextBar,
      {
        config: effectiveConfig,
        activeStrategyId: safeStrategy,
        onSetActiveStrategy: setActiveStrategyId,
        activeGroupId: safeGroup,
        onSetActiveGroup: setActiveGroupId,
        ops,
        snapshots,
        viewingSlug,
        onSelectSnapshot: setViewingSlug,
        pending
      }
    ),
    readOnly && /* @__PURE__ */ jsxs20("div", { className: "ro-banner", role: "status", "data-testid": "readonly-banner", children: [
      "Viewing snapshot ",
      /* @__PURE__ */ jsx21("strong", { children: viewing.name }),
      " \u2014 read-only. Editors are disabled.",
      /* @__PURE__ */ jsx21("button", { type: "button", className: "btn sm", style: { marginLeft: 12 }, onClick: () => setViewingSlug(null), "data-testid": "exit-snapshot", children: "Return to live model" })
    ] }),
    /* @__PURE__ */ jsxs20("main", { className: "main", children: [
      isBlank && /* @__PURE__ */ jsxs20("div", { className: "empty-state", "data-testid": "blank-empty-state", children: [
        /* @__PURE__ */ jsx21("div", { className: "es-mark", children: "\u2726" }),
        /* @__PURE__ */ jsx21("h2", { children: "Start from nothing" }),
        /* @__PURE__ */ jsx21("p", { children: "This simulation has no brands and no queues yet. Build it up from scratch: create a brand in Settings, then add your first queue." }),
        /* @__PURE__ */ jsxs20("div", { className: "btnbar", style: { justifyContent: "center" }, children: [
          /* @__PURE__ */ jsx21("button", { type: "button", className: "btn primary", onClick: () => setTab("settings"), "data-testid": "es-add-brand", children: "Create a brand (Settings)" }),
          /* @__PURE__ */ jsx21("button", { type: "button", className: "btn", onClick: () => setTab("queues"), "data-testid": "es-add-queue", children: "Add a queue (Queues)" }),
          /* @__PURE__ */ jsx21("button", { type: "button", className: "btn", onClick: () => newSimulation("defaults"), children: "Load the demo defaults" })
        ] })
      ] }),
      /* @__PURE__ */ jsx21("fieldset", { className: "ro-fieldset", disabled: readOnly, style: { border: 0, margin: 0, padding: 0, minInlineSize: "auto" }, children: TABS.map((t) => /* @__PURE__ */ jsx21("div", { role: "tabpanel", id: "panel-" + t.id, "aria-labelledby": "tab-" + t.id, hidden: tab !== t.id, children: tab === t.id && /* @__PURE__ */ jsx21(TabBody, { id: t.id, ...tabProps }) }, t.id)) })
    ] })
  ] }) });
}
function TabBody(props) {
  const { id, simSet, activeSim, config, ops } = props;
  switch (id) {
    case "summary":
      return /* @__PURE__ */ jsx21(SummaryTab, { sim: activeSim, sims: simSet.sims, stratIds: simSet.stratIds, config, activeStrategy: props.activeStrategy, activeGroupId: props.activeGroupId, onSetActive: props.onSetActive, matrix: props.matrix, matrixStale: props.matrixStale, onRunMatrix: props.onRunMatrix, onSelectCell: props.onSelectCell });
    case "strategies":
      return /* @__PURE__ */ jsx21(StrategiesTab, { simSet, config, activeStrategy: props.activeStrategy, ops });
    case "plan":
      return /* @__PURE__ */ jsx21(PlanTab, { sim: activeSim, config, viewLabel: groupName(config, props.activeGroupId) });
    case "data":
      return /* @__PURE__ */ jsx21(DataTab, { sim: activeSim, config, ops, activeGroupId: props.activeGroupId, onSelectGroup: props.onSelectGroup });
    case "intraday":
      return /* @__PURE__ */ jsx21(IntradayTab, { sim: activeSim });
    case "queues":
      return /* @__PURE__ */ jsx21(QueuesEditor, { config, ops, sim: activeSim, intradayPresets: props.intradayPresets, setIntradayPresets: props.setIntradayPresets, seasonalityPresets: props.seasonalityPresets, setSeasonalityPresets: props.setSeasonalityPresets });
    case "scenarios":
      return /* @__PURE__ */ jsx21(ScenariosEditor, { config, ops });
    case "snapshots":
      return /* @__PURE__ */ jsx21(
        SnapshotsTab,
        {
          snapshots: props.snapshots,
          storageMode: props.storage.mode,
          storageNotice: props.storage.notice,
          compareSel: props.compareSel,
          setCompareSel: props.setCompareSel,
          config,
          sim: activeSim,
          sims: simSet.sims,
          activeStrategy: props.activeStrategy,
          activeViewId: props.activeGroupId,
          onImportConfig: props.onImportConfig,
          onSave: props.onSaveSnapshot,
          onDelete: props.onDeleteSnapshot,
          onLoadSettings: props.onLoadSnapshotSettings,
          onRefresh: props.onRefreshSnapshots
        }
      );
    case "settings":
      return /* @__PURE__ */ jsx21(SettingsEditor, { config, ops, intradayPresets: props.intradayPresets, setIntradayPresets: props.setIntradayPresets, seasonalityPresets: props.seasonalityPresets, setSeasonalityPresets: props.setSeasonalityPresets });
    default:
      return null;
  }
}

// ui/style.js
var CSS = `
:root {
  --ink: #0f1720; --ink-2: #17222e; --panel: #ffffff; --panel-2: #f5f7f9;
  --line: #e2e7ec; --line-2: #cdd6de; --text: #1b2733; --muted: #5c6b7a;
  --accent: #0e7c86; --accent-2: #12a3b0; --accent-ink: #063e44;
  --green: #1f9d55; --amber: #d98a0b; --red: #d63b3b;
  --green-s: #e6f4ec; --amber-s: #fbf0dc; --red-s: #f9e3e3;
  --shadow: 0 1px 2px rgba(15,23,32,.06), 0 4px 16px rgba(15,23,32,.05);
  --radius: 12px; --radius-s: 8px;
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: var(--sans); color: var(--text); background: var(--panel-2); -webkit-font-smoothing: antialiased; font-size: 14px; line-height: 1.45; }
.app { min-height: 100vh; display: flex; flex-direction: column; }

/* ---- top bar ---- */
.topbar { display: flex; align-items: center; gap: 14px; padding: 10px 18px; background: var(--ink); color: #eaf2f4; position: sticky; top: 0; z-index: 30; }
.brand { display: flex; align-items: baseline; gap: 9px; font-weight: 700; letter-spacing: .2px; }
.brand .mark { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 7px; background: linear-gradient(135deg, var(--accent-2), var(--accent)); color: #fff; font-size: 15px; font-weight: 800; box-shadow: inset 0 0 0 1px rgba(255,255,255,.15); }
.brand small { color: #90a4b0; font-weight: 500; letter-spacing: .3px; }
.topbar .spacer { flex: 1; }
.topctrls { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.topctrl { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #90a4b0; }
.topctrl > span { font-weight: 600; letter-spacing: .2px; }
.topctrl select { font: inherit; font-size: 12px; font-weight: 600; padding: 5px 8px; border-radius: 7px; border: 1px solid rgba(255,255,255,.14); background: #0b131b; color: #eaf2f4; }
.topctrl select:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 1px; }
.recalc { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; color: #bfe9ee; background: rgba(18,163,176,.16); padding: 5px 11px; border-radius: 999px; }
.recalc .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent-2); animation: pulse 1s ease-in-out infinite; }
.recalc.idle { color: #7f93a0; background: rgba(255,255,255,.05); }
.recalc.idle .dot { background: #4a5a67; animation: none; }
@keyframes pulse { 0%,100% { opacity: .35; transform: scale(.85); } 50% { opacity: 1; transform: scale(1.15); } }

/* ---- context bar (\xA714.8) ---- */
.ctxbar { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; padding: 8px 18px; background: var(--ink-2); color: #d6e3ea; border-bottom: 1px solid rgba(255,255,255,.06); position: sticky; top: 85px; z-index: 24; }
.ctx-item { display: flex; align-items: center; gap: 7px; position: relative; }
.ctx-label { font-size: 10px; text-transform: uppercase; letter-spacing: .6px; color: #7f93a0; font-weight: 700; }
.ctx-chip { appearance: none; border: 1px solid rgba(255,255,255,.14); background: #0b131b; color: #eaf2f4; border-radius: 8px; padding: 5px 10px; font: inherit; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 8px; white-space: nowrap; max-width: 340px; }
.ctx-chip strong { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ctx-strat { position: relative; }
.ctx-chip:hover { border-color: var(--accent-2); }
.ctx-chip:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 1px; }
.ctx-chip .ctx-sub { font-size: 11px; color: #9db6c2; font-weight: 500; }
.ctx-select { font: inherit; font-size: 13px; font-weight: 600; padding: 5px 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,.14); background: #0b131b; color: #eaf2f4; }
.ctx-select:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 1px; }
.ctx-snapshot { font-size: 13px; font-weight: 600; color: #bfe9ee; }
.ctx-pop { top: 40px; left: 0; transform: none; width: 320px; max-width: 88vw; text-align: left; }
.ctx-pop .field .lab { color: #c9d6de; }
.ctx-pop select, .ctx-pop input { background: #0b131b; color: #eaf2f4; border-color: rgba(255,255,255,.16); }
@media (max-width: 760px) { .ctxbar { position: static; } }

/* ---- tabs ---- */
.tabs { display: flex; gap: 2px; overflow-x: auto; background: var(--ink-2); padding: 0 8px; position: sticky; top: 46px; z-index: 25; scrollbar-width: thin; }
.tab { appearance: none; border: 0; background: transparent; color: #9db0bd; font: inherit; font-weight: 600; font-size: 13px; padding: 11px 15px; cursor: pointer; white-space: nowrap; border-bottom: 3px solid transparent; }
.tab:hover { color: #d6e3ea; }
.tab[aria-selected="true"] { color: #fff; border-bottom-color: var(--accent-2); }
.tab:focus-visible { outline: 2px solid var(--accent-2); outline-offset: -2px; border-radius: 4px; }

/* ---- layout ---- */
/* Rule 9: the document itself never scrolls horizontally. Sticky chrome (topbar,
   tabs, context bar) are siblings of .main, so clipping overflow here is safe and
   never disables their stickiness. Intrinsically-wide content still scrolls
   internally inside its own width-capped .tbl-wrap / .ribbon-wrap / .chart. */
.main { flex: 1; padding: 18px; max-width: 1360px; width: 100%; margin: 0 auto; overflow-x: clip; }
.grid { display: grid; gap: 16px; min-width: 0; }
.grid > * { min-width: 0; }
.cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
@media (max-width: 900px) { .cols-2, .cols-3 { grid-template-columns: 1fr; } }

/* ---- card ---- */
.card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); max-width: 100%; min-width: 0; }
.card > .card-h { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px solid var(--line); }
.card > .card-h h3, .card > .card-h h4 { margin: 0; font-size: 13px; font-weight: 700; letter-spacing: .2px; }
.card > .card-h .sub { color: var(--muted); font-size: 12px; font-weight: 500; }
.card > .card-b { padding: 14px; }
.section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: var(--muted); margin: 4px 2px 10px; }

/* ---- findings strip ---- */
.findings { display: flex; gap: 10px; overflow-x: auto; padding: 2px; scrollbar-width: thin; }
.finding { flex: 0 0 auto; max-width: 340px; display: flex; gap: 9px; align-items: flex-start; padding: 10px 12px; border-radius: var(--radius-s); border: 1px solid var(--line); background: var(--panel); font-size: 12.5px; line-height: 1.4; }
.finding .pip { width: 9px; height: 9px; border-radius: 50%; margin-top: 4px; flex: 0 0 auto; }
.finding.red { background: var(--red-s); border-color: #eec4c4; }
.finding.amber { background: var(--amber-s); border-color: #ecd8ac; }
.finding.green { background: var(--green-s); border-color: #c4e3d0; }
.finding.red .pip { background: var(--red); } .finding.amber .pip { background: var(--amber); } .finding.green .pip { background: var(--green); }

/* ---- RAG ribbon ---- */
.ribbon-wrap { overflow-x: auto; scrollbar-width: thin; max-width: 100%; }
.ribbon { border-collapse: separate; border-spacing: 3px; }
.ribbon th { font-size: 11px; font-weight: 600; color: var(--muted); text-align: right; padding: 2px 6px; white-space: nowrap; position: sticky; left: 0; background: var(--panel); z-index: 2; }
.ribbon thead th { text-align: center; position: static; }
.ribbon .wk { font-size: 10px; color: var(--muted); font-weight: 600; }
.cell { width: 22px; height: 22px; border-radius: 5px; border: 0; padding: 0; cursor: pointer; position: relative; transition: transform .08s ease; }
.cell:hover { transform: scale(1.18); z-index: 3; }
.cell:focus-visible { outline: 2px solid var(--ink); outline-offset: 1px; }
.cell[data-st="green"] { background: var(--green); } .cell[data-st="amber"] { background: var(--amber); } .cell[data-st="red"] { background: var(--red); }
.cell.scrubbed { box-shadow: 0 0 0 2px var(--ink); }
.evmark { position: relative; }
.evmark::after { content: ""; position: absolute; top: -1px; right: -1px; width: 6px; height: 6px; border-radius: 50%; background: var(--ink); box-shadow: 0 0 0 1.5px #fff; }
.ribbon-scrub { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--line); }
.scrub-week { font-weight: 700; font-size: 13px; }
.legend { display: flex; gap: 12px; align-items: center; font-size: 11.5px; color: var(--muted); }
.legend .sw { display: inline-block; width: 11px; height: 11px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; }

/* ---- intraday week strip (\xA714, R1) ---- */
.week-strip { display: flex; flex-wrap: wrap; gap: 4px; }
.wk-cell { width: 34px; height: 30px; border-radius: 6px; border: 1px solid var(--line); color: #fff; font-size: 11px; font-weight: 700; cursor: pointer; font-variant-numeric: tabular-nums; }
.wk-cell[data-st="green"] { background: var(--green); } .wk-cell[data-st="amber"] { background: var(--amber); } .wk-cell[data-st="red"] { background: var(--red); }
.wk-cell:hover { filter: brightness(1.08); }
.wk-cell.sel { box-shadow: 0 0 0 2px var(--ink); }
.wk-cell:focus-visible { outline: 2px solid var(--ink); outline-offset: 1px; }

/* ---- queue status cards ---- */
.qcards { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.qcard { border: 1px solid var(--line); border-radius: var(--radius-s); padding: 12px; background: var(--panel); border-left: 4px solid var(--line-2); }
.qcard.green { border-left-color: var(--green); } .qcard.amber { border-left-color: var(--amber); } .qcard.red { border-left-color: var(--red); }
.qcard .qn { font-weight: 700; font-size: 13px; display: flex; align-items: center; gap: 7px; }
.qcard .qtype { font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: var(--muted); border: 1px solid var(--line); border-radius: 999px; padding: 1px 7px; }
.qcard .kpis { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; margin-top: 10px; }
.qcard .kpi .l { font-size: 11px; color: var(--muted); }
.qcard .kpi .v { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
.badge { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; padding: 2px 7px; border-radius: 999px; }
.badge.green { background: var(--green-s); color: #10673a; } .badge.amber { background: var(--amber-s); color: #8a5a06; } .badge.red { background: var(--red-s); color: #952727; }

/* ---- charts ---- */
.chart { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; max-width: 100%; min-width: 0; }
.chart-h { display: flex; align-items: center; gap: 8px; padding: 11px 14px 6px; }
.chart-h h4 { margin: 0; font-size: 13px; font-weight: 700; }
.chart-b { padding: 4px 8px 10px; overflow-x: auto; }
.recharts-text { font-size: 11px; fill: var(--muted); }
.recharts-cartesian-axis-tick-value { font-size: 11px; }

/* ---- tables ---- */
.tbl-wrap { overflow-x: auto; scrollbar-width: thin; border: 1px solid var(--line); border-radius: var(--radius-s); max-width: 100%; }
table.data { border-collapse: collapse; width: 100%; font-size: 12px; font-variant-numeric: tabular-nums; }
table.data th, table.data td { padding: 7px 10px; text-align: right; white-space: nowrap; border-bottom: 1px solid var(--line); }
table.data th:first-child, table.data td:first-child { text-align: left; }
table.data thead th { position: sticky; top: 0; background: var(--panel-2); font-size: 11px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); z-index: 1; }
table.data tbody tr:hover { background: var(--panel-2); }
table.data td.st-green { color: #10673a; } table.data td.st-amber { color: #8a5a06; } table.data td.st-red { color: #952727; font-weight: 700; }
/* Data-tab column-group tints (\xA714.6) */
table.data.grouped td.grp-demand { background: rgba(14,124,134,.055); }
table.data.grouped td.grp-service { background: rgba(58,123,213,.06); }
table.data.grouped td.grp-people { background: rgba(90,84,201,.055); }
table.data.grouped td.grp-money { background: rgba(217,138,11,.06); }
table.data.grouped thead th.grp-demand { border-bottom: 2px solid var(--accent); }
table.data.grouped thead th.grp-service { border-bottom: 2px solid #3a7bd5; }
table.data.grouped thead th.grp-people { border-bottom: 2px solid #5a54c9; }
table.data.grouped thead th.grp-money { border-bottom: 2px solid var(--amber); }
table.data.grouped tbody tr:hover td { background: var(--panel-2); }
/* hiring summary group rows */
table.data tr.grp td { background: var(--panel-2); border-top: 1px solid var(--line-2); }
table.data tr.grp.total td { background: rgba(14,124,134,.08); font-weight: 700; }

/* ---- form controls ---- */
.field { display: flex; flex-direction: column; gap: 4px; }
.field > .lab { font-size: 11.5px; color: var(--muted); font-weight: 600; display: flex; align-items: center; gap: 6px; }
.field input, .field select, input.inp, select.inp { font: inherit; font-size: 13px; padding: 7px 9px; border: 1px solid var(--line-2); border-radius: var(--radius-s); background: var(--panel); color: var(--text); width: 100%; }
.field input:focus, .field select:focus, input.inp:focus, select.inp:focus, .field input:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 0; border-color: var(--accent-2); }
.field .unit { color: var(--muted); font-size: 11px; }
.fieldrow { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }

/* ---- buttons ---- */
.btn { appearance: none; font: inherit; font-weight: 600; font-size: 13px; padding: 8px 13px; border-radius: var(--radius-s); border: 1px solid var(--line-2); background: var(--panel); color: var(--text); cursor: pointer; display: inline-flex; align-items: center; gap: 7px; }
.btn:hover { background: var(--panel-2); }
.btn:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 1px; }
.btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.btn.primary:hover { background: var(--accent-ink); }
.btn.ghost { border-color: transparent; background: transparent; color: var(--accent); }
.btn.danger { color: var(--red); border-color: #e6bcbc; }
.btn.danger:hover { background: var(--red-s); }
.btn.sm { padding: 5px 9px; font-size: 12px; }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.btnbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

/* ---- toggle / switch ---- */
.switch { display: inline-flex; align-items: center; gap: 9px; cursor: pointer; user-select: none; }
.switch input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.switch .track { width: 38px; height: 22px; border-radius: 999px; background: var(--line-2); position: relative; transition: background .15s; flex: 0 0 auto; }
.switch .track::after { content: ""; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.2); transition: transform .15s; }
.switch input:checked + .track { background: var(--accent); }
.switch input:checked + .track::after { transform: translateX(16px); }
.switch input:focus-visible + .track { outline: 2px solid var(--accent-2); outline-offset: 2px; }

/* ---- hint (tap to reveal, not hover title) ---- */
.hint { position: relative; display: inline-flex; }
.hint > button { appearance: none; border: 1px solid var(--line-2); background: var(--panel-2); color: var(--muted); width: 16px; height: 16px; border-radius: 50%; font-size: 10px; font-weight: 700; line-height: 1; cursor: pointer; padding: 0; display: inline-grid; place-items: center; }
.hint > button:hover { color: var(--accent); border-color: var(--accent-2); }
.hint > button:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 1px; }
.hint .pop { position: absolute; top: 22px; left: 50%; transform: translateX(-50%); width: max-content; max-width: 260px; background: var(--ink); color: #eef4f6; font-size: 12px; font-weight: 400; line-height: 1.4; padding: 9px 11px; border-radius: 8px; box-shadow: 0 6px 24px rgba(0,0,0,.25); z-index: 40; text-transform: none; letter-spacing: 0; }
.hint .pop::before { content: ""; position: absolute; top: -5px; left: 50%; transform: translateX(-50%); border: 5px solid transparent; border-bottom-color: var(--ink); border-top: 0; }

/* ---- editor list rows ---- */
.rows { display: flex; flex-direction: column; gap: 12px; }
.erow { border: 1px solid var(--line); border-radius: var(--radius-s); background: var(--panel); }
.erow > summary, .erow .erow-h { list-style: none; cursor: pointer; padding: 12px 14px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.erow > summary::-webkit-details-marker { display: none; }
.erow-h .drag { color: var(--muted); }
.erow[open] > summary { border-bottom: 1px solid var(--line); }
.erow .erow-b { padding: 14px; display: flex; flex-direction: column; gap: 14px; }
.chev { transition: transform .12s; color: var(--muted); }
.erow[open] .chev { transform: rotate(90deg); }
.pill { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--panel-2); border: 1px solid var(--line); color: var(--muted); }

/* ---- intraday sliders ---- */
.sliders { display: grid; grid-template-columns: repeat(auto-fit, minmax(52px, 1fr)); gap: 6px; align-items: end; }
.slider-cell { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.slider-cell input[type=range] { writing-mode: vertical-lr; direction: rtl; width: 20px; height: 90px; accent-color: var(--accent); }
.slider-cell .t { font-size: 9px; color: var(--muted); font-variant-numeric: tabular-nums; }
.slider-cell .val { font-size: 9px; color: var(--text); font-variant-numeric: tabular-nums; }

/* ---- misc ---- */
.stat-row { display: flex; gap: 18px; flex-wrap: wrap; }
.stat { min-width: 110px; }
.stat .l { font-size: 11px; color: var(--muted); }
.stat .v { font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: -.4px; }
.stat .v small { font-size: 12px; font-weight: 600; color: var(--muted); }
.empty { color: var(--muted); font-size: 13px; padding: 24px; text-align: center; }
.note { font-size: 12px; color: var(--muted); background: var(--panel-2); border: 1px dashed var(--line-2); border-radius: var(--radius-s); padding: 10px 12px; }
.tag { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 6px; background: var(--accent); color: #fff; }
.tag.soft { background: rgba(14,124,134,.12); color: var(--accent-ink); }
.rowflex { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.spacer { flex: 1; }
hr.sep { border: 0; border-top: 1px solid var(--line); margin: 4px 0; }

@media (max-width: 760px) {
  .topbar { flex-wrap: wrap; }
  .topctrls { order: 3; width: 100%; }
  .topctrl { flex: 1; }
  .topctrl select { flex: 1; }
}
@media (max-width: 640px) {
  .main { padding: 12px; }
  .topbar { padding: 9px 12px; }
  .brand small { display: none; }
  .qcards { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 420px) { .qcards { grid-template-columns: 1fr; } }

/* ---- report ---- */
.report { display: flex; flex-direction: column; gap: 16px; }
.report-section { break-inside: avoid; }
.report-section h2 { font-size: 20px; }
.report-section h3 { font-size: 15px; margin: 0 0 10px; }
.report-section h4 { font-size: 13px; margin: 16px 0 8px; color: var(--muted); }
.report-chart { overflow-x: auto; margin: 4px 0; }

@media print {
  .topbar, .tabs, .recalc, .btnbar, .hint, .topctrls { display: none !important; }
  body { background: #fff; font-size: 12px; }
  .main { padding: 0; max-width: none; }
  .card, .chart { box-shadow: none; break-inside: avoid; }
  .report-section { break-inside: avoid; page-break-inside: avoid; }
  .report-chart { overflow: visible; }
  /* only the report panel prints; other tab panels are already hidden */
  [role="tabpanel"][hidden] { display: none !important; }
}

/* ---- P7b (Revision 2) additions ---- */
.ro-banner { background: var(--amber-s); color: #8a5a06; border-bottom: 1px solid var(--amber); padding: 8px 20px; font-size: 13px; display: flex; align-items: center; gap: 6px; }
table.data.grouped td.grp-week { background: rgba(120,130,140,.05); }
table.data.grouped td.grp-supply { background: rgba(16,150,110,.06); }
table.data.grouped td.grp-status { background: rgba(120,130,140,.04); }
table.data.grouped thead th.grp-week { border-bottom: 2px solid #7a828a; }
table.data.grouped thead th.grp-supply { border-bottom: 2px solid #10966e; }
table.data.grouped thead th.grp-status { border-bottom: 2px solid #7a828a; }

/* decision matrix (\xA719) */
table.matrix { border-collapse: separate; border-spacing: 4px; }
table.matrix th { font-size: 11px; color: var(--muted); font-weight: 700; padding: 4px 8px; text-align: center; }
table.matrix th.row-h { text-align: right; white-space: nowrap; }
.mx-cell { border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; min-width: 116px; cursor: pointer; background: var(--panel); text-align: center; font-variant-numeric: tabular-nums; }
.mx-cell:hover { filter: brightness(0.98); box-shadow: 0 0 0 1px var(--line-2); }
.mx-cell.green { background: var(--green-s); } .mx-cell.amber { background: var(--amber-s); } .mx-cell.red { background: var(--red-s); }
.mx-cell.sel { box-shadow: 0 0 0 2px var(--ink); }
.mx-cell .mx-all { font-weight: 700; font-size: 13px; }
.mx-cell .mx-flags { font-size: 10px; color: var(--muted); margin-top: 2px; }
.mx-stale { background: var(--amber-s); color: #8a5a06; border: 1px solid var(--amber); border-radius: 8px; padding: 8px 12px; font-size: 12px; margin-bottom: 10px; display: flex; align-items: center; gap: 10px; }

/* \xA724 holistic hierarchy blocks + filter chips */
.holo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
.holo-block { border: 1px solid var(--line); border-radius: var(--radius-s); padding: 10px 12px; background: var(--panel-2); }
.holo-block-h { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.holo-block-h strong { font-size: 12.5px; }
.holo-mini { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.holo-mini .l { font-size: 10px; color: var(--muted); display: block; }
.holo-mini .v { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
.chip { appearance: none; font: inherit; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--line-2); background: var(--panel); color: var(--muted); cursor: pointer; }
.chip.on { background: var(--accent); border-color: var(--accent); color: #fff; }
.chip:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 1px; }
.legend-item { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: var(--muted); margin-right: 10px; }

/* \xA724.9 blank empty state */
.empty-state { text-align: center; padding: 40px 20px; border: 1px dashed var(--line-2); border-radius: var(--radius); background: var(--panel); margin-bottom: 16px; }
.empty-state .es-mark { font-size: 34px; color: var(--accent-2); }
.empty-state h2 { margin: 8px 0 6px; font-size: 20px; }
.empty-state p { color: var(--muted); max-width: 520px; margin: 0 auto 16px; }

/* files card rows */
.files-row { border: 1px solid var(--line); border-radius: var(--radius-s); padding: 12px 14px; background: var(--panel-2); }
.files-row-h { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.files-row-h strong { font-size: 12.5px; }
.files-row-h .note { font-size: 11.5px; }

/* preset library (Settings) rows */
.preset-lib { display: flex; flex-direction: column; gap: 10px; }
.preset-item { border: 1px solid var(--line); border-radius: var(--radius-s); background: var(--panel); padding: 10px 12px; }
.preset-item .preset-item-h { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }

/* inheritance indicator (\xA716) */
.inherit-ind { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; padding: 2px 7px; border-radius: 999px; }
.inherit-ind.inherited { background: rgba(58,123,213,.12); color: #2b5a9c; }
.inherit-ind.overridden { background: var(--amber-s); color: #8a5a06; }
.acc-sec { border: 1px solid var(--line); border-radius: 10px; margin-bottom: 8px; }
.acc-sec > summary { list-style: none; cursor: pointer; padding: 10px 12px; display: flex; align-items: center; gap: 8px; font-weight: 600; }
.acc-sec > summary::-webkit-details-marker { display: none; }
.acc-sec > .acc-b { padding: 0 12px 12px; }

/* \xA724.6 (R3c) Data tab \u2014 clear vertical divider between column groups, editable
   input cells and a muted read-only treatment so the input/outcome boundary
   reads at a glance. */
table.data.seg th.seg-first, table.data.seg td.seg-first { border-left: 2px solid var(--line-2); }
table.data td.cell-ro { color: var(--muted); }
table.data th.col-input { color: var(--accent-ink); }
table.data td.col-input { background: rgba(31,157,85,.05); }
.cell-inp { width: 74px; font: inherit; font-size: 12px; padding: 3px 6px; border: 1px solid var(--accent-2); border-radius: 5px; background: var(--panel); color: var(--text); text-align: right; font-variant-numeric: tabular-nums; }
.cell-inp:focus { outline: 2px solid var(--accent-2); outline-offset: 0; }
`;

// ui/main.jsx
import { jsx as jsx22 } from "react/jsx-runtime";
function injectStyle() {
  if (document.getElementById("capacity-sim-style")) return;
  const el2 = document.createElement("style");
  el2.id = "capacity-sim-style";
  el2.textContent = CSS;
  document.head.appendChild(el2);
}
function mount(container) {
  injectStyle();
  const root = createRoot(container);
  root.render(/* @__PURE__ */ jsx22(App, {}));
  return root;
}
var el = typeof document !== "undefined" ? document.getElementById("root") : null;
if (el) mount(el);
var main_default = App;
export {
  App,
  main_default as default,
  mount
};
