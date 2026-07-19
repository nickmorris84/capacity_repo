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
    var clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
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
      const key = N + "|" + Math.round(A * 20);
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
    function voiceRaw(N, A, aht, pat, target) {
      if (A <= 0) return { asa: 0, sl: 1, abandon: 0, occ: 0 };
      if (N < 1) return { asa: pat, sl: 0, abandon: 1, occ: 1 };
      const key = N + "|" + Math.round(A * 20) + "|" + aht + "|" + pat + "|" + target;
      const hit = _vCache.get(key);
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
      if (_vCache.size < 3e5) _vCache.set(key, out);
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
    function requiredAgentsInterval(arrivals, intervalSec, aht, pat, target, maxAband, occCeil) {
      if (arrivals <= 0) return 0;
      const A = arrivals / intervalSec * aht;
      for (let N = Math.max(1, Math.ceil(A)); N <= Math.ceil(A) + 400; N++) {
        const r = voiceRaw(N, A, aht, pat, target);
        if (r.asa <= target && r.abandon <= maxAband && r.occ <= occCeil) return N;
      }
      return Math.ceil(A) + 400;
    }
    function reqCurveVoice(q, volume, eng, cache) {
      const key = "v" + q.id + "|" + Math.round(volume) + "|" + q.aht + "|" + q.asaTarget + "|" + q.maxAbandon + "|" + q.patience + "|" + eng.occupancyCeiling;
      const hit = cache.get(key);
      if (hit) return hit;
      const p = norm(q.profile), iSec = eng.intervalMin * 60, iHrs = eng.intervalMin / 60;
      const agents = p.map(
        (share) => requiredAgentsInterval(volume * share, iSec, q.aht, q.patience, q.asaTarget, q.maxAbandon, eng.occupancyCeiling)
      );
      const out = { agents, hours: sum(agents) * iHrs };
      cache.set(key, out);
      return out;
    }
    function reqCurveDigital(q, volume, eng, cache) {
      const key = "d" + q.id + "|" + Math.round(volume) + "|" + q.aht + "|" + q.concurrency + "|" + eng.occupancyCeiling;
      const hit = cache.get(key);
      if (hit) return hit;
      const p = norm(q.profile), iSec = eng.intervalMin * 60, iHrs = eng.intervalMin / 60;
      const agents = p.map((share) => volume * share * q.aht / (q.concurrency * iSec * eng.occupancyCeiling));
      const out = { agents, hours: sum(agents) * iHrs };
      cache.set(key, out);
      return out;
    }
    var reqCurve = (q, v, eng, cache) => q.type === "voice" ? reqCurveVoice(q, v, eng, cache) : reqCurveDigital(q, v, eng, cache);
    function runVoiceDay(q, volume, productiveHours, eng, rc) {
      const iSec = eng.intervalMin * 60;
      const cover = rc.hours > 0 ? productiveHours / rc.hours : 1;
      const p = norm(q.profile);
      let tv = 0, wAsa = 0, wSl = 0, wAb = 0, occN = 0, occD = 0;
      const byInterval = [];
      for (let i = 0; i < p.length; i++) {
        const arrivals = volume * p[i];
        const agents = rc.agents[i] * cover;
        const r = voiceInterval(agents, arrivals, iSec, q.aht, q.patience, q.asaTarget);
        byInterval.push({ i, arrivals, agents, req: rc.agents[i], ...r });
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
    function runDigitalDay(q, volume, productiveHours, startBacklog, eng, rc) {
      const iSec = eng.intervalMin * 60, iMin = eng.intervalMin, iHrs = eng.intervalMin / 60;
      const cover = rc.hours > 0 ? productiveHours / rc.hours : 1;
      const p = norm(q.profile);
      let B = startBacklog, tv = 0, inSla = 0, respW = 0, occN = 0, occD = 0;
      const byInterval = [];
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
        byInterval.push({ i, arrivals, agents, req: rc.agents[i], cap, served, backlog: Bend, resp: (wStart + wEnd) / 2, occ });
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
      repeatAdd: 0
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
      ramping: 0
    });
    var MONTH_DAYS = 30.44;
    var monthOfWeek = (w, startMonth) => (startMonth + Math.floor(w * 7 / MONTH_DAYS)) % 12;
    function seasonalMult2(w, cfg, q) {
      const m = monthOfWeek(w, cfg.seasonality.startMonth);
      const sys = cfg.seasonality.system[m] ?? 1;
      const qm = (q.seasonal && q.seasonal[m]) ?? 1;
      return sys * qm;
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
      { id: "S3", name: "Forward backfill", baseType: "backfill", builtin: true },
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
      for (let w = 0; w < cfg.engine.horizonWeeks; w++) {
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
        if (q.resourcing === "supported") {
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
    function scenarioFor(week, day, q, cfg, activeIds) {
      const out = { volMult: 1, attritionAdd: 0, freeze: false, ahtMult: 1, repeatAdd: 0, training: null };
      let growthMult = 1, manualG = null;
      for (const s of cfg.scenarios) {
        if (!activeIds.has(s.id)) continue;
        const hits = s.queueIds === "all" || (s.queueIds || []).includes(q.id);
        const opWide = s.type === "hiringFreeze" || s.type === "attritionShock" || s.type === "reducedTraining" || s.type === "freezeManual";
        if (!hits && !opWide) continue;
        const w = week - s.startWeek;
        if (w < 0) continue;
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
    function exogenousVolume(q, week, day, cfg, activeIds) {
      const base = q.weeklyVolumes && q.weeklyVolumes[week] != null ? q.weeklyVolumes[week] : q.dailyVolume;
      return base * seasonalMult2(week, cfg, q) * scenarioFor(week, day, q, cfg, activeIds).volMult;
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
        if (q.resourcing === "supported") continue;
        if (excluded.has(q.id)) continue;
        const s = st[q.id];
        const sc = scenarioFor(w, 0, q, cfg, activeIds);
        if (sc.freeze) continue;
        const lead = q.wf.reqToStart + (sc.training ? Math.max(1, q.wf.trainingWeeks - sc.training.cutWeeks) : q.wf.trainingWeeks);
        const L = w + lead;
        if (L >= cfg.engine.horizonWeeks + lead) {
        }
        const wkAttr = clamp(q.wf.attrition * (1 + q.wf.attritionGrowth * (w / 4.345)) + sc.attritionAdd, 0, 0.6) / 4.345;
        const proj = projectSupply(s, q, lead, wkAttr);
        let want = 0;
        if (sObj.baseType === "manual") {
          want = (q.wf.hires || []).filter((h) => h.week === w).reduce((a, b) => a + b.heads, 0);
        } else if (sObj.baseType === "backfill") {
          want = proj.leaversNext * 1;
        } else {
          const buf = sObj.baseType === "buffer" ? sObj.bufferPct != null ? sObj.bufferPct : cfg.hiring.buffer : 0;
          const target = reqFteAt(q, L) * (1 + buf);
          want = Math.max(0, target - proj.effective);
        }
        if (want <= 1e-6) continue;
        const rq = Math.max(0.5, reqFteAt(q, L));
        const churnProb = q.type === "voice" ? cfg.cx.churnAbandon : cfg.cx.churnDigital;
        const marginal = exogenousVolume(q, Math.min(L, cfg.engine.horizonWeeks - 1), 0, cfg, activeIds) * 7 * churnProb * cfg.cx.costPerLostCustomer / rq;
        let breachWk = cfg.engine.horizonWeeks;
        for (let f = w; f < Math.min(w + lead + 8, cfg.engine.horizonWeeks); f++) {
          const p = projectSupply(s, q, f - w, wkAttr);
          if (p.effective < reqFteAt(q, f) * 0.999) {
            breachWk = f;
            break;
          }
        }
        wants.push({ q, want, marginal, breachWk });
      }
      wants.sort((a, b) => b.marginal - a.marginal || a.breachWk - b.breachWk);
      const cap = sObj.baseType === "manual" ? Infinity : cfg.hiring.cap;
      let left = cap;
      const grants = {}, denied = {};
      for (const x of wants) {
        const give = Math.min(left, x.want);
        if (give > 1e-6) grants[x.q.id] = give;
        if (x.want - give > 1e-6) denied[x.q.id] = x.want - give;
        left -= give;
      }
      const totalWant = sum(wants.map((x) => x.want));
      return {
        grants,
        trace: {
          week: w,
          cap: cap === Infinity ? null : cap,
          want: totalWant,
          grants: Object.fromEntries(Object.entries(grants).map(([k, v]) => [k, +v.toFixed(2)])),
          denied: Object.fromEntries(Object.entries(denied).map(([k, v]) => [k, +v.toFixed(2)])),
          binding: Number.isFinite(cap) && totalWant > cap + 1e-6,
          order: wants.map((x) => x.q.id)
        }
      };
    }
    function simulate3(cfg, opts = {}) {
      const eng = cfg.engine;
      const strategy = opts.strategy || cfg.hiring.activeStrategy || "S1";
      const activeIds = new Set(opts.viewIds != null ? opts.viewIds : cfg.scenarios.filter((s) => s.enabled).map((s) => s.id));
      const rcCache = /* @__PURE__ */ new Map();
      const reqFteCache = /* @__PURE__ */ new Map();
      const reqFteAt = (q, wk) => {
        const w2 = Math.min(wk, eng.horizonWeeks - 1);
        const key = q.id + "|" + w2;
        if (reqFteCache.has(key)) return reqFteCache.get(key);
        const vol = exogenousVolume(q, w2, 0, cfg, activeIds);
        const hrs = reqCurve(q, vol, eng, rcCache).hours;
        const fte = hrs / Math.max(0.01, hoursPerHeadDay(q, eng));
        reqFteCache.set(key, fte);
        return fte;
      };
      const startHC = resolveStartingHC(cfg);
      const supportsMap = effectiveSupports2(cfg);
      const st = {};
      for (const q of cfg.queues) {
        st[q.id] = { trained: startHC[q.id], ramp: [], training: [], pipeline: [], burnout: 0, backlog: 0, deflectIn: 0, cumChurn: 0, lastCurve: q.wf.learningCurve };
      }
      const weeks = [], allocTrace = [];
      const svcUsed = {};
      for (let w = 0; w < eng.horizonWeeks; w++) {
        for (const q of cfg.queues) {
          const s = st[q.id];
          const sc = scenarioFor(w, 0, q, cfg, activeIds);
          const curve = sc.training ? stretchCurve(q.wf.learningCurve, sc.training.startProficiency, sc.training.stretch) : q.wf.learningCurve;
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
          const monthly = q.wf.attrition * (1 + q.wf.attritionGrowth * (w / 4.345)) + sc.attritionAdd;
          const wk2 = clamp(monthly, 0, 0.6) / 4.345 * bMult;
          const pool = s.trained + sum(s.ramp.map((c) => c.heads));
          const leavers = pool * wk2;
          const tShare = pool > 0 ? s.trained / pool : 1;
          s.trained = Math.max(0, s.trained - leavers * tShare);
          s.ramp.forEach((c) => c.heads *= 1 - wk2);
          s.lastLeavers = leavers;
          s.lastCurve = curve;
          s.wkAttr = wk2;
        }
        const { grants, trace } = decideHiring(cfg, st, w, activeIds, strategy, reqFteAt);
        allocTrace.push(trace);
        for (const q of cfg.queues) {
          const g = grants[q.id] || 0;
          if (g > 0) {
            const sc = scenarioFor(w, 0, q, cfg, activeIds);
            const tw = sc.training ? Math.max(1, q.wf.trainingWeeks - sc.training.cutWeeks) : q.wf.trainingWeeks;
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
          const hrs = {}, req = {}, vol = {}, rc = {};
          for (const q of cfg.queues) {
            const s = st[q.id];
            const sc = scenarioFor(w, d, q, cfg, activeIds);
            const prof2 = s.trained + sum(s.ramp.map((c) => c.heads * (s.lastCurve[c.age] ?? 1)));
            const absence = s.burnout / 100 * q.burn.absenceUplift;
            hrs[q.id] = prof2 * eng.hoursPerFteDay * (eng.daysWorkedPerFte / eng.daysPerWeek) * clamp(1 - q.shrinkage - absence, 0.02, 1);
            vol[q.id] = exogenousVolume(q, w, d, cfg, activeIds) + (q.type === "voice" ? s.deflectIn : 0);
            s.deflectIn = 0;
            s.ahtMult = sc.ahtMult;
          }
          for (const q of cfg.queues) {
            const eq = st[q.id].ahtMult > 1.001 ? { ...q, aht: q.aht * st[q.id].ahtMult } : q;
            rc[q.id] = reqCurve(eq, vol[q.id], eng, rcCache);
            req[q.id] = rc[q.id].hours;
            st[q.id].eq = eq;
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
          for (const t of cfg.serviceTeams) {
            const poolWeekHrs = t.size * t.maxHoursPerWeek * t.proficiency;
            let left = Math.max(0, poolWeekHrs - (svcUsed[t.id] || 0));
            const cand = (t.coversQueues || []).map((id) => cfg.queues.find((q) => q.id === id)).filter(Boolean).map((q) => {
              const preview = q.type === "voice" ? runVoiceDay(st[q.id].eq, vol[q.id], hrs[q.id], eng, rc[q.id]) : runDigitalDay(st[q.id].eq, vol[q.id], hrs[q.id], st[q.id].backlog, eng, rc[q.id]);
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
            const r = runDigitalDay(s.eq, vol[q.id], hrs[q.id], s.backlog, eng, rc[q.id]);
            let deflected = 0;
            const excess = Math.max(0, r.endBacklog - q.backlogLimit);
            if (excess > 0) {
              deflected = excess * cfg.loops.deflection;
              s.backlog = r.endBacklog - deflected;
            } else s.backlog = r.endBacklog;
            if (deflected > 0 && q.deflectsTo && st[q.deflectsTo]) st[q.deflectsTo].deflectIn += deflected;
            dayRes[q.id] = { ...r, deflected };
          }
          for (const q of cfg.queues) {
            if (q.type !== "voice") continue;
            let v = vol[q.id], r = null, redial = 0, curve = rc[q.id], iters = 0;
            for (let k = 0; k < 3; k++) {
              iters = k + 1;
              const vc = Math.min(v, vol[q.id] * 4);
              curve = reqCurve(st[q.id].eq, vc, eng, rcCache);
              r = runVoiceDay(st[q.id].eq, vc, hrs[q.id], eng, curve);
              const nr = r.volume * r.abandon * cfg.loops.redial;
              if (Math.abs(nr - redial) < 0.5) {
                redial = nr;
                break;
              }
              redial = nr;
              v = vol[q.id] + redial;
            }
            req[q.id] = curve.hours;
            rc[q.id] = curve;
            dayRes[q.id] = { ...r, redial, redialIters: iters };
          }
          for (const q of cfg.queues) {
            const a = agg[q.id], r = dayRes[q.id], v = r.volume;
            const sc = scenarioFor(w, d, q, cfg, activeIds);
            a.volume += v;
            a.baseVolume += exogenousVolume(q, w, d, cfg, activeIds);
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
            } else {
              a.respW += r.respMin * v;
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
          if (occ > q.burn.occThreshold) s.burnout = clamp(s.burnout + (occ - q.burn.occThreshold) * 100 * q.burn.sensitivity, 0, 100);
          else s.burnout = clamp(s.burnout - q.burn.recovery, 0, 100);
          const headsRamp = sum(s.ramp.map((c) => c.heads));
          const headsTrain = sum(s.training.map((c) => c.heads));
          const headsPipe = sum(s.pipeline.map((c) => c.heads));
          const paid = s.trained + headsRamp + headsTrain;
          const reqFte = a.reqHours / eng.daysPerWeek / Math.max(0.01, hoursPerHeadDay(q, eng));
          const wkCost = paid * q.agentCost / 52;
          const trainCost = headsTrain * q.agentCost / 52;
          const hourly = q.agentCost / 52 / (eng.hoursPerFteDay * eng.daysWorkedPerFte);
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
          const ok = q.type === "voice" ? asa <= q.asaTarget && ab <= q.maxAbandon : sl >= q.digitalSlaPct && a.backlog <= q.backlogLimit;
          const near = q.type === "voice" ? asa <= q.asaTarget * 1.5 && ab <= q.maxAbandon * 1.5 : sl >= q.digitalSlaPct * 0.9;
          const status = ok ? "green" : near ? "amber" : "red";
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
        }
        let svcCost = 0;
        for (const t of cfg.serviceTeams) {
          const hourly = t.agentCost / 52 / (eng.hoursPerFteDay * eng.daysWorkedPerFte);
          svcCost += (svcUsed[t.id] || 0) * hourly * (1 + t.premiumPct);
        }
        const managers = Math.ceil(wk.totals.paid / Math.max(1, cfg.costs.managerRatio));
        wk.totals.serviceCost = svcCost;
        wk.totals.managers = managers;
        wk.totals.managerCost = managers * cfg.costs.managerCost / 52;
        wk.totals.productiveCost = wk.totals.cost - wk.totals.trainCost;
        wk.totals.totalCost = wk.totals.cost + wk.totals.managerCost + svcCost;
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
      const leaversWk = weeks.map((w) => sum(cfg.queues.map((q) => w.queues[q.id].leavers)));
      const avgLeavers = sum(leaversWk.slice(-8)) / Math.min(8, leaversWk.length);
      if (avgLeavers > cfg.hiring.cap * 1.0001 && !strategyAllManual(cfg, strategy)) {
        flags.tippingPoint = true;
        findings.push({ tone: "red", text: `Tipping point: the operation is losing ${avgLeavers.toFixed(1)} people/week against a hiring cap of ${cfg.hiring.cap}/week. Headcount cannot recover at any allocation.` });
      }
      for (const q of cfg.queues) {
        const series = weeks.map((w) => w.queues[q.id]);
        const qLabel = q.resourcing === "supported" ? `${q.name} (supported)` : q.name;
        const breachWeeks = series.filter((s) => s.status !== "green").length;
        const firstBreach = series.findIndex((s) => s.status === "red");
        const peakBurn = Math.max(...series.map((s) => s.burnout));
        perQueue[q.id] = { breachWeeks, firstBreach, peakBurn };
        if (firstBreach >= 0) {
          const lead = q.wf.reqToStart + q.wf.trainingWeeks + q.wf.learningCurve.length;
          const raiseBy = firstBreach - lead;
          findings.push({
            tone: "red",
            text: q.resourcing === "supported" ? `${qLabel} goes red in week ${firstBreach + 1}. It is staffed only from supporter spare hours \u2014 add support routes or resource it directly.` : raiseBy >= 0 ? `${qLabel} goes red in week ${firstBreach + 1}. Requisitions must land by week ${raiseBy + 1} given the ${lead}-week hire-to-productive lead.` : `${qLabel} goes red in week ${firstBreach + 1}, inside the ${lead}-week lead time. Hiring cannot fix it \u2014 cover with flexing, service teams or deferral.`
          });
        }
        if (peakBurn > 60) findings.push({ tone: "amber", text: `${qLabel} peaks at ${Math.round(peakBurn)}/100 burnout, lifting attrition and absence.` });
        const last = series[series.length - 1];
        if (last.paid > last.reqFte * 1.1 && last.reqFte > 0) {
          const excess = last.paid - last.reqFte;
          const perWeek = last.paid * (q.wf.attrition / 4.345);
          const wks = perWeek > 0 ? Math.ceil(excess / perWeek) : 999;
          findings.push({ tone: "amber", text: `${qLabel} ends ${excess.toFixed(0)} FTE over requirement. Under a freeze, attrition clears it in ~${wks} weeks (~${f(excess * q.agentCost / 52 * (wks / 2))} carrying cost).` });
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
      return { totalCost, churnCost, waste, lost, allIn: totalCost + churnCost, findings: findings.slice(0, 10), flags, perQueue, strategy, hiring };
    }
    function makeDefaultConfig2() {
      const wf = () => ({ attrition: 0.04, attritionGrowth: 0, reqToStart: 6, trainingWeeks: 4, learningCurve: [0.6, 0.75, 0.9, 1], hires: [] });
      const burn = () => ({ occThreshold: 0.85, sensitivity: 1.5, recovery: 8, maxAttritionMult: 2, absenceUplift: 0.05 });
      const v1 = "q_bill", v2 = "q_tech", d1 = "q_wapp", d2 = "q_chat";
      return {
        engine: { horizonWeeks: 26, dayStart: 8, dayEnd: 20, intervalMin: 30, occupancyCeiling: 0.85, currency: "\xA3", daysPerWeek: 7, hoursPerFteDay: 8, daysWorkedPerFte: 5, crossSkillProficiency: 0.9, globalStartingHC: null },
        hiring: { cap: 18, buffer: 0.1, activeStrategy: "S1" },
        // §14.1: strategies live in config; built-ins S1–S4 are always present.
        // Users append custom entries ({name, baseType, bufferPct, excludedQueueIds,
        // segments}) and schedules. The default queue set keeps the legacy
        // `crossSkill` field; the §14.3 migration shim derives outbound `supports`
        // from it at simulate time, so old and new configs behave identically.
        strategies: BUILTIN_STRATEGIES.map((s) => ({ ...s })),
        seasonality: { startMonth: 0, system: [...SEASONAL_PRESETS2["Flat"]] },
        queues: [
          { id: v1, name: "Voice \u2014 Billing", type: "voice", dailyVolume: 2e3, aht: 300, profile: [...DEFAULT_PROFILE2], asaTarget: 30, maxAbandon: 0.05, patience: 90, shrinkage: 0.3, fte: 63, agentCost: 32e3, crossSkill: [v2], weeklyVolumes: null, seasonal: null, concurrency: 1, digitalSlaMinutes: 5, digitalSlaPct: 0.8, backlogLimit: 150, deflectsTo: null, resourcing: "resourced", supports: [], wf: wf(), burn: burn() },
          { id: v2, name: "Voice \u2014 Technical", type: "voice", dailyVolume: 900, aht: 420, profile: [...DEFAULT_PROFILE2], asaTarget: 45, maxAbandon: 0.06, patience: 100, shrinkage: 0.3, fte: 47, agentCost: 32e3, crossSkill: [], weeklyVolumes: null, seasonal: null, concurrency: 1, digitalSlaMinutes: 5, digitalSlaPct: 0.8, backlogLimit: 150, deflectsTo: null, resourcing: "resourced", supports: [], wf: wf(), burn: burn() },
          { id: d1, name: "WhatsApp \u2014 Service", type: "digital", dailyVolume: 1400, aht: 420, profile: [...DEFAULT_PROFILE2], concurrency: 2.5, digitalSlaMinutes: 5, digitalSlaPct: 0.8, backlogLimit: 150, deflectsTo: v1, shrinkage: 0.3, fte: 20, agentCost: 3e4, crossSkill: [], weeklyVolumes: null, seasonal: null, asaTarget: 30, maxAbandon: 0.05, patience: 90, resourcing: "resourced", supports: [], wf: wf(), burn: burn() },
          { id: d2, name: "Chat \u2014 Sales", type: "digital", dailyVolume: 700, aht: 360, profile: [...DEFAULT_PROFILE2], concurrency: 2, digitalSlaMinutes: 3, digitalSlaPct: 0.8, backlogLimit: 80, deflectsTo: v1, shrinkage: 0.3, fte: 11, agentCost: 3e4, crossSkill: [], weeklyVolumes: null, seasonal: null, asaTarget: 30, maxAbandon: 0.05, patience: 90, resourcing: "resourced", supports: [], wf: wf(), burn: burn() }
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
      clamp,
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
      resolveStartingHC
    };
  }
});

// ui/main.jsx
import { createRoot } from "react-dom/client";

// ui/App.jsx
var import_engine9 = __toESM(require_engine());
import { useState as useState14, useMemo as useMemo3, useEffect as useEffect4, useRef as useRef4, useCallback as useCallback4 } from "react";

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
function viewIdsFor(config, viewId) {
  const v = config.views.find((x) => x.id === viewId) || config.views[0];
  if (v && Array.isArray(v.scenarioIds)) {
    return v.scenarioIds.filter((id) => config.scenarios.some((s) => s.id === id));
  }
  return config.scenarios.filter((s) => s.enabled).map((s) => s.id);
}
var viewName = (config, viewId) => {
  const v = config.views.find((x) => x.id === viewId);
  return v ? v.name : viewId;
};
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
var CACHE_MAX = 64;
var BUDGET = 8;
var keyFor = (hash, sid, vid) => hash + "|" + sid + "|" + vid;
function useStrategySims(config, activeStrategyId, activeViewId, delay = 160) {
  const hash = useMemo(() => JSON.stringify(config), [config]);
  const cacheRef = useRef(/* @__PURE__ */ new Map());
  const stratIds = useMemo(() => {
    const all = strategyList(config).map((s) => s.id);
    const ordered = [activeStrategyId, ...all.filter((id) => id !== activeStrategyId)].filter((v, i, a) => a.indexOf(v) === i);
    return ordered.slice(0, BUDGET);
  }, [hash, activeStrategyId]);
  const runInto = (missing) => {
    for (const m of missing) cacheRef.current.set(m.k, (0, import_engine.simulate)(config, { strategy: m.sid, viewIds: viewIdsFor(config, activeViewId) }));
    while (cacheRef.current.size > CACHE_MAX) cacheRef.current.delete(cacheRef.current.keys().next().value);
  };
  const needed = useMemo(
    () => stratIds.map((sid) => ({ k: keyFor(hash, sid, activeViewId), sid })),
    [hash, activeViewId, stratIds.join(",")]
  );
  const buildSnapshot = () => {
    const sims = {};
    for (const sid of stratIds) sims[sid] = cacheRef.current.get(keyFor(hash, sid, activeViewId));
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
    if (cacheRef.current.has(keyFor(hash, activeStrategyId, activeViewId))) {
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
  }, [hash, activeStrategyId, activeViewId, stratIds.join(",")]);
  return { ...snap, pending };
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
  const clone = Array.isArray(obj) ? obj.slice() : { ...obj };
  clone[head] = setPath(obj ? obj[head] : void 0, rest, value);
  return clone;
}

// ui/config-ops.js
var import_engine2 = __toESM(require_engine());
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
function migrateConfig(config) {
  const map = (0, import_engine2.effectiveSupports)(config);
  const queues = config.queues.map((q) => ({
    ...q,
    resourcing: q.resourcing || "resourced",
    supports: (map[q.id] || []).map((s) => ({ queueId: s.queueId, priority: s.priority, maxSharePct: s.maxSharePct == null ? 100 : s.maxSharePct })),
    crossSkill: []
  }));
  const out = { ...config, queues };
  if (!Array.isArray(out.strategies) || !out.strategies.length) {
    out.strategies = [
      { id: "S1", name: "Meet requirement", baseType: "meet", builtin: true },
      { id: "S2", name: "Buffer above", baseType: "buffer", builtin: true },
      { id: "S3", name: "Forward backfill", baseType: "backfill", builtin: true },
      { id: "S4", name: "Manual plan", baseType: "manual", builtin: true }
    ];
  }
  if (out.engine.globalStartingHC === void 0) out.engine = { ...out.engine, globalStartingHC: null };
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
    setConfig((c) => ({ ...c, queues: [...c.queues, blankQueue(c.queues.length + 1)] }));
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
    patchScenario,
    deleteScenario,
    addView,
    renameView,
    toggleViewScenario,
    deleteView,
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
    saveScheduleAsStrategy
  }), [patch, patchQueue, addQueue, duplicateQueue, deleteQueue, addHire, patchHire, deleteHire, addServiceTeam, patchServiceTeam, deleteServiceTeam, addScenario, patchScenario, deleteScenario, addView, renameView, toggleViewScenario, deleteView, setResourcing, addSupport, patchSupport, deleteSupport, addStrategy, duplicateStrategy, deleteStrategy, patchStrategy, addSegment, patchSegment, deleteSegment, saveScheduleAsStrategy]);
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
function ContextBar({ config, activeStrategyId, onSetActiveStrategy, activeViewId, onSetActiveView, ops, loadedSnapshotName, pending }) {
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
      /* @__PURE__ */ jsx2("span", { className: "ctx-label", children: "View" }),
      /* @__PURE__ */ jsx2("select", { className: "ctx-select", value: activeViewId, onChange: (e) => onSetActiveView(e.target.value), "aria-label": "Active scenario view", "data-testid": "ctx-view", children: config.views.map((v) => /* @__PURE__ */ jsx2("option", { value: v.id, children: v.name }, v.id)) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "ctx-item", children: [
      /* @__PURE__ */ jsx2("span", { className: "ctx-label", children: "Snapshot" }),
      /* @__PURE__ */ jsx2("span", { className: "ctx-snapshot", "data-testid": "ctx-snapshot", children: loadedSnapshotName || "\u2014 live model \u2014" })
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
      status: s.status
    };
  });
}
function buildQueueSummary(sim, config) {
  const rows = [];
  const mk = () => ({ volume: 0, required: 0, active: 0, coverNum: 0, coverDen: 0, weeksRed: 0, churn: 0 });
  const voice = mk(), digital = mk(), total = mk();
  for (const q of config.queues) {
    const series = sim.weeks.map((w) => w.queues[q.id]);
    const last = series[series.length - 1];
    const volume = series.reduce((a, s) => a + s.volume, 0);
    const required = last.reqFte;
    const active = last.active != null ? last.active : last.trained + last.ramp;
    const cover = series.reduce((a, s) => a + s.cover, 0) / Math.max(1, series.length);
    const weeksRed = series.filter((s) => s.status === "red").length;
    const churn = series.reduce((a, s) => a + s.churnCost, 0);
    rows.push({ id: q.id, name: q.name, type: q.type, resourcing: q.resourcing || "resourced", volume, required, active, cover, weeksRed, churn });
    for (const g of [q.type === "voice" ? voice : digital, total]) {
      g.volume += volume;
      g.required += required;
      g.active += active;
      g.coverNum += cover;
      g.coverDen += 1;
      g.weeksRed += weeksRed;
      g.churn += churn;
    }
  }
  const fin = (g, name) => ({ id: name, name, subtotal: true, volume: g.volume, required: g.required, active: g.active, cover: g.coverDen ? g.coverNum / g.coverDen : 0, weeksRed: g.weeksRed, churn: g.churn });
  return { rows, voice: fin(voice, "Voice subtotal"), digital: fin(digital, "Digital subtotal"), total: fin(total, "Total") };
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
    { key: "cost", label: "Run cost", group: "Money", fmt: M },
    { key: "churnCost", label: "Churn cost", group: "Money", fmt: M },
    { key: "customersLost", label: "Cust. lost", group: "Money", fmt: N0 },
    { key: "status", label: "Status", group: "Status", fmt: (v) => v }
  ];
}
var COLUMN_GROUPS = ["Week", "Demand", "Service", "People", "Money", "Status"];
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
    if (peakBurn > 60) {
      const wk = series.findIndex((s) => s.burnout === peakBurn);
      push({
        risk: `${q.name} burnout peak`,
        driver: `Occupancy over threshold lifts attrition (peak ${Math.round(peakBurn)}/100)`,
        week: wk + 1,
        severityValue: peakBurn * 1e3,
        severityMoney: null,
        sla: `${Math.round(peakBurn)}/100`,
        lever: "Add heads or ease occupancy"
      });
    }
    const last = series[series.length - 1];
    if (last.paid > last.reqFte * 1.1 && last.reqFte > 0) {
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
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
var Stat = ({ l, v, sub }) => /* @__PURE__ */ jsxs3("div", { className: "stat", children: [
  /* @__PURE__ */ jsx4("div", { className: "l", children: l }),
  /* @__PURE__ */ jsxs3("div", { className: "v", children: [
    v,
    sub ? /* @__PURE__ */ jsxs3("small", { children: [
      " ",
      sub
    ] }) : null
  ] })
] });
var endCoverage = (sim) => {
  if (!sim) return 0;
  const last = sim.weeks[sim.weeks.length - 1];
  const qs = sim.config.queues;
  return qs.length ? qs.reduce((a, q) => a + last.queues[q.id].cover, 0) / qs.length : 0;
};
function StrategyCards({ sims, stratIds, config, activeStrategyId, onSetActive }) {
  const cur = config.engine.currency;
  return /* @__PURE__ */ jsx4("div", { className: "qcards", "data-testid": "strategy-cards", children: stratIds.map((id) => {
    const sim = sims[id];
    const st = strategyStats(sim);
    const active = id === activeStrategyId;
    return /* @__PURE__ */ jsxs3("div", { className: "qcard " + (st ? st.redWeeks ? "red" : "green" : ""), children: [
      /* @__PURE__ */ jsxs3("div", { className: "qn", children: [
        /* @__PURE__ */ jsx4("span", { children: resolveStrategyName(config, id) }),
        /* @__PURE__ */ jsx4("span", { className: "spacer" }),
        active && /* @__PURE__ */ jsx4("span", { className: "tag", children: "active" })
      ] }),
      /* @__PURE__ */ jsxs3("div", { className: "kpis", children: [
        /* @__PURE__ */ jsxs3("div", { className: "kpi", children: [
          /* @__PURE__ */ jsx4("div", { className: "l", children: "All-in" }),
          /* @__PURE__ */ jsx4("div", { className: "v", children: st ? money(cur, st.allIn) : "\u2026" })
        ] }),
        /* @__PURE__ */ jsxs3("div", { className: "kpi", children: [
          /* @__PURE__ */ jsx4("div", { className: "l", children: "Weeks red" }),
          /* @__PURE__ */ jsx4("div", { className: "v", children: st ? st.redWeeks : "\u2026" })
        ] }),
        /* @__PURE__ */ jsxs3("div", { className: "kpi", children: [
          /* @__PURE__ */ jsx4("div", { className: "l", children: "End coverage" }),
          /* @__PURE__ */ jsx4("div", { className: "v", children: pct(endCoverage(sim)) })
        ] }),
        /* @__PURE__ */ jsxs3("div", { className: "kpi", children: [
          /* @__PURE__ */ jsx4("div", { className: "l", children: "Feasible" }),
          /* @__PURE__ */ jsx4("div", { className: "v", children: st ? st.feasible ? "yes" : "no" : "\u2026" })
        ] })
      ] }),
      /* @__PURE__ */ jsx4("button", { type: "button", className: "btn sm" + (active ? " primary" : ""), style: { marginTop: 10, width: "100%" }, disabled: active, onClick: () => onSetActive(id), "data-testid": "set-active-" + id, children: active ? "Active" : "Set active" })
    ] }, id);
  }) });
}
function QueueSummaryTable({ sim, config }) {
  const cur = config.engine.currency;
  const qs = buildQueueSummary(sim, config);
  const row = (r, cls) => /* @__PURE__ */ jsxs3("tr", { className: cls, children: [
    /* @__PURE__ */ jsxs3("td", { style: { textAlign: "left", fontWeight: cls ? 700 : 600 }, children: [
      r.name,
      r.resourcing === "supported" ? " (supported)" : ""
    ] }),
    /* @__PURE__ */ jsx4("td", { children: num(r.volume, 0) }),
    /* @__PURE__ */ jsx4("td", { children: num(r.required, 1) }),
    /* @__PURE__ */ jsx4("td", { children: num(r.active, 1) }),
    /* @__PURE__ */ jsx4("td", { children: pct(r.cover) }),
    /* @__PURE__ */ jsx4("td", { className: r.weeksRed ? "st-red" : "st-green", children: r.weeksRed }),
    /* @__PURE__ */ jsx4("td", { children: money(cur, r.churn) })
  ] }, r.id);
  return /* @__PURE__ */ jsx4("div", { className: "tbl-wrap", children: /* @__PURE__ */ jsxs3("table", { className: "data", "data-testid": "queue-summary", children: [
    /* @__PURE__ */ jsx4("thead", { children: /* @__PURE__ */ jsxs3("tr", { children: [
      /* @__PURE__ */ jsx4("th", { children: "Queue" }),
      /* @__PURE__ */ jsx4("th", { children: "Volume" }),
      /* @__PURE__ */ jsx4("th", { children: "Required" }),
      /* @__PURE__ */ jsx4("th", { children: "Active" }),
      /* @__PURE__ */ jsx4("th", { children: "Coverage" }),
      /* @__PURE__ */ jsx4("th", { children: "Weeks red" }),
      /* @__PURE__ */ jsx4("th", { children: "Churn \xA3" })
    ] }) }),
    /* @__PURE__ */ jsxs3("tbody", { children: [
      qs.rows.filter((r) => r.type === "voice").map((r) => row(r, "")),
      qs.rows.some((r) => r.type === "voice") && row(qs.voice, "grp"),
      qs.rows.filter((r) => r.type === "digital").map((r) => row(r, "")),
      qs.rows.some((r) => r.type === "digital") && row(qs.digital, "grp"),
      row(qs.total, "grp total")
    ] })
  ] }) });
}
function SummaryTab({ sim, sims, stratIds, config, activeStrategy, activeViewId, onSetActive }) {
  const cur = config.engine.currency;
  const verdict = buildVerdict(sims, activeStrategy, activeViewId, config);
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
  return /* @__PURE__ */ jsxs3("div", { className: "grid summary-print", style: { gap: 16 }, "data-testid": "summary-panel", children: [
    /* @__PURE__ */ jsxs3("div", { className: "btnbar", children: [
      /* @__PURE__ */ jsx4(PrintButton, { label: "Print / PDF Summary", testid: "summary-print", className: "btn primary" }),
      /* @__PURE__ */ jsxs3("span", { className: "note", style: { padding: "6px 10px" }, children: [
        "A leadership-ready one-pager under ",
        resolveStrategyName(config, activeStrategy),
        " \xB7 view ",
        viewName(config, activeViewId),
        "."
      ] })
    ] }),
    /* @__PURE__ */ jsx4(Card, { title: "Strategy overview", hint: "Every strategy at a glance under the active view. Set any one active to drive the whole app.", children: /* @__PURE__ */ jsx4(StrategyCards, { sims, stratIds, config, activeStrategyId: activeStrategy, onSetActive }) }),
    /* @__PURE__ */ jsxs3(Card, { title: "Verdict & key findings", children: [
      /* @__PURE__ */ jsx4("p", { style: { margin: "0 0 12px", fontSize: 14, lineHeight: 1.55 }, children: verdict.paragraph }),
      /* @__PURE__ */ jsxs3("div", { className: "findings", children: [
        sim.summary.findings.map((fd, i) => /* @__PURE__ */ jsxs3("div", { className: "finding " + fd.tone, children: [
          /* @__PURE__ */ jsx4("span", { className: "pip" }),
          /* @__PURE__ */ jsx4("span", { children: fd.text })
        ] }, i)),
        sim.summary.findings.length === 0 && /* @__PURE__ */ jsx4("div", { className: "empty", children: "The plan holds across the horizon." })
      ] })
    ] }),
    /* @__PURE__ */ jsx4(Card, { title: "Queue summary", sub: "under the active strategy", hint: "Per queue with Voice, Digital and Total subtotals.", children: /* @__PURE__ */ jsx4(QueueSummaryTable, { sim, config }) }),
    /* @__PURE__ */ jsxs3("div", { className: "grid cols-2", children: [
      /* @__PURE__ */ jsx4(Card, { title: "Finance", children: /* @__PURE__ */ jsxs3("div", { className: "stat-row", style: { flexDirection: "column", gap: 12 }, children: [
        /* @__PURE__ */ jsx4(Stat, { l: "Run cost", v: money(cur, f.runCost) }),
        /* @__PURE__ */ jsx4(Stat, { l: "Churn cost", v: money(cur, f.churn) }),
        /* @__PURE__ */ jsx4(Stat, { l: "Idle pay", v: money(cur, f.idle) }),
        /* @__PURE__ */ jsx4(Stat, { l: "All-in", v: money(cur, f.allIn) }),
        /* @__PURE__ */ jsx4(Stat, { l: "Cost / contact", v: moneyFull(cur, f.costPerContact) }),
        /* @__PURE__ */ jsx4(Stat, { l: "Break-even week", v: f.breakEven ?? "\u2013" })
      ] }) }),
      /* @__PURE__ */ jsx4(Card, { title: "HR", children: /* @__PURE__ */ jsxs3("div", { className: "stat-row", style: { flexDirection: "column", gap: 12 }, children: [
        /* @__PURE__ */ jsx4(Stat, { l: "Total reqs raised", v: num(hr.totalReqs, 0) }),
        /* @__PURE__ */ jsx4(Stat, { l: "Global cap", v: hr.cap, sub: "/wk" }),
        /* @__PURE__ */ jsx4(Stat, { l: "Avg leavers", v: num(hr.avgLeavers, 1), sub: "/wk" }),
        /* @__PURE__ */ jsx4(Stat, { l: "Tipping margin", v: num(hr.tippingMargin, 1), sub: hr.tippingPoint ? "\xB7 tipped" : "/wk" }),
        /* @__PURE__ */ jsx4(Stat, { l: "Peak burnout", v: num(hr.peakBurn, 0) + "/100" }),
        /* @__PURE__ */ jsx4(Stat, { l: "Avg in training", v: num(hr.avgTraining, 1) })
      ] }) }),
      /* @__PURE__ */ jsx4(Card, { title: "Business", hint: "SLA attainment and incident readiness.", children: /* @__PURE__ */ jsxs3("div", { className: "stat-row", style: { flexDirection: "column", gap: 12 }, children: [
        /* @__PURE__ */ jsx4(Stat, { l: "Incident (P1) in view", v: bz.p1Enabled ? "yes \u2014 stress applied" : "no" }),
        /* @__PURE__ */ jsx4(Stat, { l: "Cap infeasible", v: bz.capInfeasible ? "yes" : "no" }),
        /* @__PURE__ */ jsxs3("div", { children: [
          /* @__PURE__ */ jsx4("div", { className: "l", style: { fontSize: 11, color: "var(--muted)", marginBottom: 4 }, children: "SLA attainment by queue" }),
          bz.perQueueSla.map((s) => /* @__PURE__ */ jsxs3("div", { className: "rowflex", style: { justifyContent: "space-between", fontSize: 12 }, children: [
            /* @__PURE__ */ jsx4("span", { children: s.name }),
            /* @__PURE__ */ jsx4("strong", { children: pct(s.attainment) })
          ] }, s.name))
        ] })
      ] }) }),
      /* @__PURE__ */ jsx4(Card, { title: "CX", hint: "Customer experience economics.", children: /* @__PURE__ */ jsxs3("div", { className: "stat-row", style: { flexDirection: "column", gap: 12 }, children: [
        /* @__PURE__ */ jsx4(Stat, { l: "Customers lost", v: num(bz.customersLost, 0) }),
        /* @__PURE__ */ jsx4(Stat, { l: "Churn cost", v: money(cur, f.churn) }),
        /* @__PURE__ */ jsx4(Stat, { l: "Deflected \u2192 voice", v: num(bz.totalDeflected, 0) }),
        /* @__PURE__ */ jsx4(Stat, { l: "Repeat-contact uplift", v: "\xD7" + num(config.cx.repeatUplift, 2) })
      ] }) })
    ] }),
    /* @__PURE__ */ jsx4(Card, { title: "Risk register", sub: `${risks.length} risk(s)`, children: /* @__PURE__ */ jsx4("div", { className: "tbl-wrap", children: /* @__PURE__ */ jsxs3("table", { className: "data", "data-testid": "risk-table", children: [
      /* @__PURE__ */ jsx4("thead", { children: /* @__PURE__ */ jsxs3("tr", { children: [
        /* @__PURE__ */ jsxs3("th", { style: { cursor: "pointer" }, onClick: () => setSortKey("risk"), children: [
          "Risk",
          arrow("risk")
        ] }),
        /* @__PURE__ */ jsx4("th", { children: "Driver" }),
        /* @__PURE__ */ jsxs3("th", { style: { cursor: "pointer" }, onClick: () => setSortKey("week"), children: [
          "Week",
          arrow("week")
        ] }),
        /* @__PURE__ */ jsxs3("th", { style: { cursor: "pointer" }, onClick: () => setSortKey("severityValue"), children: [
          "Severity",
          arrow("severityValue")
        ] }),
        /* @__PURE__ */ jsx4("th", { children: "SLA impact" }),
        /* @__PURE__ */ jsx4("th", { children: "Suggested lever" })
      ] }) }),
      /* @__PURE__ */ jsxs3("tbody", { children: [
        sortedRisks.map((r, i) => /* @__PURE__ */ jsxs3("tr", { children: [
          /* @__PURE__ */ jsx4("td", { style: { textAlign: "left", fontWeight: 600 }, children: r.risk }),
          /* @__PURE__ */ jsx4("td", { style: { textAlign: "left", whiteSpace: "normal", maxWidth: 280 }, children: r.driver }),
          /* @__PURE__ */ jsx4("td", { children: r.week ?? "\u2013" }),
          /* @__PURE__ */ jsx4("td", { children: r.severityMoney != null ? money(cur, r.severityMoney) : "\u2014" }),
          /* @__PURE__ */ jsx4("td", { style: { textAlign: "left" }, children: r.sla || "\u2013" }),
          /* @__PURE__ */ jsx4("td", { style: { textAlign: "left", whiteSpace: "normal", maxWidth: 240 }, children: r.lever })
        ] }, i)),
        sortedRisks.length === 0 && /* @__PURE__ */ jsx4("tr", { children: /* @__PURE__ */ jsx4("td", { colSpan: 6, className: "empty", children: "No material risks \u2014 the plan holds across the horizon." }) })
      ] })
    ] }) }) })
  ] });
}

// ui/components/StrategiesTab.jsx
import { useState as useState5 } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
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
  return /* @__PURE__ */ jsxs4(
    Card,
    {
      title: "Detailed comparison",
      hint: "Compare strategies on a chosen metric and scope. Cost metrics are cumulative over the horizon; coverage is the active-vs-required ratio.",
      right: /* @__PURE__ */ jsxs4("div", { className: "rowflex", children: [
        /* @__PURE__ */ jsx5("select", { className: "inp", style: { width: 150 }, value: metric, onChange: (e) => setMetric(e.target.value), "data-testid": "cmp-metric", "aria-label": "Metric", children: METRICS.map((x) => /* @__PURE__ */ jsx5("option", { value: x.id, children: x.label }, x.id)) }),
        /* @__PURE__ */ jsx5("select", { className: "inp", style: { width: 150 }, value: scope, onChange: (e) => setScope(e.target.value), "data-testid": "cmp-scope", "aria-label": "Scope", children: scopeOpts.map((o) => /* @__PURE__ */ jsx5("option", { value: o.value, children: o.label }, o.value)) })
      ] }),
      children: [
        /* @__PURE__ */ jsx5("div", { "data-testid": "cmp-chart", "data-series": live.length, children: /* @__PURE__ */ jsx5(Chart, { title: "", height: 280, children: (w, h) => /* @__PURE__ */ jsxs4(LineChart, { width: w, height: h, data, margin: { top: 8, right: 16, left: 8, bottom: 4 }, children: [
          /* @__PURE__ */ jsx5(CartesianGrid, { strokeDasharray: "3 3", stroke: "#eef2f5" }),
          /* @__PURE__ */ jsx5(XAxis, { dataKey: "wk", tick: { fontSize: 11 }, interval: "preserveStartEnd", minTickGap: 18 }),
          /* @__PURE__ */ jsx5(YAxis, { tick: { fontSize: 11 }, width: 54, tickFormatter: fmtY }),
          /* @__PURE__ */ jsx5(Tooltip, { formatter: fmtY }),
          /* @__PURE__ */ jsx5(Legend, { wrapperStyle: { fontSize: 11 } }),
          live.map((id, i) => /* @__PURE__ */ jsx5(Line, { type: "monotone", dataKey: id, name: resolveStrategyName(config, id), stroke: SERIES[i % SERIES.length], dot: false, strokeWidth: 2, isAnimationActive: false }, id))
        ] }) }) }),
        /* @__PURE__ */ jsx5("div", { className: "tbl-wrap", style: { marginTop: 12 }, children: /* @__PURE__ */ jsxs4("table", { className: "data", "data-testid": "cmp-table", children: [
          /* @__PURE__ */ jsx5("thead", { children: /* @__PURE__ */ jsxs4("tr", { children: [
            /* @__PURE__ */ jsx5("th", { children: "Strategy" }),
            /* @__PURE__ */ jsxs4("th", { children: [
              m.label,
              " (",
              m.cost ? "total" : "avg",
              ")"
            ] })
          ] }) }),
          /* @__PURE__ */ jsx5("tbody", { children: summary.map((s) => /* @__PURE__ */ jsxs4("tr", { children: [
            /* @__PURE__ */ jsx5("td", { style: { textAlign: "left" }, children: resolveStrategyName(config, s.id) }),
            /* @__PURE__ */ jsx5("td", { children: m.cost ? money(cur, s.val) : pct(s.val) })
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
  return /* @__PURE__ */ jsxs4(
    Card,
    {
      title: "Strategies",
      hint: "Built-ins S1\u2013S4 plus your own. Custom strategies parameterise a base type; schedules pivot between strategies at set weeks.",
      right: /* @__PURE__ */ jsx5("div", { className: "rowflex", children: /* @__PURE__ */ jsxs4("select", { className: "inp", style: { width: 160 }, value: newType, onChange: (e) => {
        if (e.target.value) {
          ops.addStrategy(e.target.value);
          setNewType("");
        }
      }, "data-testid": "add-strategy", "aria-label": "Add strategy", children: [
        /* @__PURE__ */ jsx5("option", { value: "", children: "+ Add strategy\u2026" }),
        /* @__PURE__ */ jsx5("option", { value: "meet", children: "Meet requirement" }),
        /* @__PURE__ */ jsx5("option", { value: "buffer", children: "Buffer above" }),
        /* @__PURE__ */ jsx5("option", { value: "backfill", children: "Forward backfill" }),
        /* @__PURE__ */ jsx5("option", { value: "manual", children: "Manual plan" }),
        /* @__PURE__ */ jsx5("option", { value: "schedule", children: "Schedule" })
      ] }) }),
      children: [
        isSchedule(active) && /* @__PURE__ */ jsxs4("div", { className: "rowflex", style: { marginBottom: 12 }, children: [
          /* @__PURE__ */ jsx5("input", { type: "text", className: "inp", style: { maxWidth: 220 }, placeholder: "name this schedule", value: schedName, onChange: (e) => setSchedName(e.target.value), "data-testid": "save-schedule-name" }),
          /* @__PURE__ */ jsx5("button", { type: "button", className: "btn sm", disabled: !schedName.trim(), onClick: () => {
            ops.saveScheduleAsStrategy(schedName.trim(), active.segments || []);
            setSchedName("");
          }, "data-testid": "save-schedule", children: "Save current schedule as strategy" })
        ] }),
        /* @__PURE__ */ jsx5("div", { className: "rows", children: list.map((s) => /* @__PURE__ */ jsxs4("details", { className: "erow", children: [
          /* @__PURE__ */ jsxs4("summary", { children: [
            /* @__PURE__ */ jsx5("span", { className: "chev", children: "\u25B6" }),
            /* @__PURE__ */ jsx5("strong", { children: s.name }),
            /* @__PURE__ */ jsx5("span", { className: "pill", children: s.baseType }),
            s.builtin && /* @__PURE__ */ jsx5("span", { className: "pill", children: "built-in" }),
            s.id === activeStrategyId && /* @__PURE__ */ jsx5("span", { className: "tag soft", children: "active" }),
            /* @__PURE__ */ jsx5("span", { className: "spacer" }),
            /* @__PURE__ */ jsxs4("span", { className: "btnbar", onClick: (e) => e.preventDefault(), children: [
              /* @__PURE__ */ jsx5("button", { type: "button", className: "btn sm", onClick: () => ops.duplicateStrategy(s.id), children: "Duplicate" }),
              !s.builtin && /* @__PURE__ */ jsx5("button", { type: "button", className: "btn sm danger", onClick: () => ops.deleteStrategy(s.id), children: "Delete" })
            ] })
          ] }),
          /* @__PURE__ */ jsxs4("div", { className: "erow-b", children: [
            /* @__PURE__ */ jsx5("p", { className: "note", children: strategyBlurb(s) }),
            !s.builtin && /* @__PURE__ */ jsxs4("div", { className: "fieldrow", children: [
              /* @__PURE__ */ jsx5(TextField, { label: "Name", value: s.name, onChange: (v) => ops.patchStrategy(s.id, ["name"], v) }),
              s.baseType === "buffer" && /* @__PURE__ */ jsx5(NumField, { label: "Buffer", unit: "%", value: +((s.bufferPct != null ? s.bufferPct : config.hiring.buffer) * 100).toFixed(0), onChange: (v) => ops.patchStrategy(s.id, ["bufferPct"], v / 100) })
            ] }),
            ["meet", "buffer", "backfill", "manual"].includes(s.baseType) && /* @__PURE__ */ jsxs4("div", { children: [
              /* @__PURE__ */ jsxs4("div", { className: "lab", style: { marginBottom: 6, display: "flex", gap: 6 }, children: [
                "Excluded queues ",
                /* @__PURE__ */ jsx5(Hint, { text: "Queues this strategy raises no requisitions for." })
              ] }),
              /* @__PURE__ */ jsx5("div", { className: "rowflex", children: config.queues.map((q) => {
                const on = (s.excludedQueueIds || []).includes(q.id);
                return /* @__PURE__ */ jsxs4("label", { className: "switch", children: [
                  /* @__PURE__ */ jsx5("input", { type: "checkbox", checked: on, onChange: (e) => {
                    const cur = s.excludedQueueIds || [];
                    ops.patchStrategy(s.id, ["excludedQueueIds"], e.target.checked ? [...cur, q.id] : cur.filter((x) => x !== q.id));
                  } }),
                  /* @__PURE__ */ jsx5("span", { className: "track", "aria-hidden": "true" }),
                  /* @__PURE__ */ jsx5("span", { children: q.name })
                ] }, q.id);
              }) })
            ] }),
            s.baseType === "schedule" && /* @__PURE__ */ jsxs4("div", { children: [
              /* @__PURE__ */ jsxs4("div", { className: "lab", style: { marginBottom: 6 }, children: [
                "Segments \u2014 ",
                scheduleSummary(config, s) || "empty"
              ] }),
              (s.segments || []).map((seg, i) => /* @__PURE__ */ jsxs4("div", { className: "rowflex", style: { marginBottom: 6 }, children: [
                /* @__PURE__ */ jsx5("span", { style: { fontSize: 12, color: "var(--muted)" }, children: "from wk" }),
                /* @__PURE__ */ jsx5("input", { type: "number", className: "inp", style: { width: 70 }, min: 1, value: seg.fromWeek, onChange: (e) => ops.patchSegment(s.id, i, "fromWeek", Math.max(1, Number(e.target.value) || 1)) }),
                /* @__PURE__ */ jsx5("select", { className: "inp", style: { flex: 1, maxWidth: 220 }, value: seg.strategyId, onChange: (e) => ops.patchSegment(s.id, i, "strategyId", e.target.value), children: list.filter((x) => x.id !== s.id).map((x) => /* @__PURE__ */ jsx5("option", { value: x.id, children: x.name }, x.id)) }),
                /* @__PURE__ */ jsx5("button", { type: "button", className: "btn sm danger", onClick: () => ops.deleteSegment(s.id, i), children: "Remove" })
              ] }, i)),
              /* @__PURE__ */ jsx5("button", { type: "button", className: "btn sm", onClick: () => ops.addSegment(s.id), children: "+ Segment" })
            ] })
          ] })
        ] }, s.id)) })
      ]
    }
  );
}
function StrategiesTab({ simSet, config, activeStrategy, ops }) {
  return /* @__PURE__ */ jsxs4("div", { className: "grid", style: { gap: 16 }, "data-testid": "strategies-panel", children: [
    /* @__PURE__ */ jsx5(StrategyEditor, { config, ops, activeStrategyId: activeStrategy }),
    /* @__PURE__ */ jsx5(Comparison, { sims: simSet.sims, stratIds: simSet.stratIds, config })
  ] });
}

// ui/components/PlanTab.jsx
import { useState as useState7 } from "react";

// ui/components/Ribbon.jsx
import { jsx as jsx6, jsxs as jsxs5 } from "react/jsx-runtime";
function Ribbon({ sim, selectedWeek, onScrub }) {
  const cfg = sim.config;
  const activeSet = new Set(sim.viewIds || []);
  const eventWeeks = {};
  for (const s of cfg.scenarios) {
    if (!activeSet.has(s.id)) continue;
    (eventWeeks[s.startWeek] = eventWeeks[s.startWeek] || []).push(s);
  }
  const weeks = sim.weeks;
  return /* @__PURE__ */ jsxs5("div", { children: [
    /* @__PURE__ */ jsx6("div", { className: "ribbon-wrap", children: /* @__PURE__ */ jsxs5("table", { className: "ribbon", children: [
      /* @__PURE__ */ jsx6("thead", { children: /* @__PURE__ */ jsxs5("tr", { children: [
        /* @__PURE__ */ jsx6("th", {}),
        weeks.map((w) => /* @__PURE__ */ jsx6("th", { className: "wk", children: w.week % 4 === 0 || w.week === weeks.length - 1 ? w.week + 1 : "" }, w.week))
      ] }) }),
      /* @__PURE__ */ jsx6("tbody", { children: cfg.queues.map((q) => /* @__PURE__ */ jsxs5("tr", { children: [
        /* @__PURE__ */ jsx6("th", { scope: "row", children: q.name }),
        weeks.map((w) => {
          const st = w.queues[q.id].status;
          const marked = !!eventWeeks[w.week];
          return /* @__PURE__ */ jsx6("td", { style: { padding: 0 }, children: /* @__PURE__ */ jsx6(
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
    /* @__PURE__ */ jsxs5("div", { className: "ribbon-scrub", children: [
      /* @__PURE__ */ jsxs5("span", { className: "legend", children: [
        /* @__PURE__ */ jsxs5("span", { children: [
          /* @__PURE__ */ jsx6("span", { className: "sw", style: { background: RAG.green } }),
          "Meets SLA"
        ] }),
        /* @__PURE__ */ jsxs5("span", { children: [
          /* @__PURE__ */ jsx6("span", { className: "sw", style: { background: RAG.amber } }),
          "At risk"
        ] }),
        /* @__PURE__ */ jsxs5("span", { children: [
          /* @__PURE__ */ jsx6("span", { className: "sw", style: { background: RAG.red } }),
          "Breach"
        ] }),
        /* @__PURE__ */ jsxs5("span", { children: [
          /* @__PURE__ */ jsx6("span", { className: "sw", style: { background: "var(--ink)" } }),
          "Scenario event"
        ] })
      ] }),
      /* @__PURE__ */ jsx6("span", { className: "spacer" }),
      Object.keys(eventWeeks).length > 0 && /* @__PURE__ */ jsx6("span", { className: "legend", children: Object.entries(eventWeeks).sort((a, b) => a[0] - b[0]).map(([wk, list]) => /* @__PURE__ */ jsxs5("span", { className: "pill", children: [
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
import { Fragment as Fragment2, jsx as jsx7, jsxs as jsxs6 } from "react/jsx-runtime";
function HolisticPanel({ sim }) {
  const [showAll, setShowAll] = useState6(false);
  const cfg = sim.config;
  const cur = cfg.engine.currency;
  const trace = sim.allocTrace || [];
  const qName = (id) => (cfg.queues.find((q) => q.id === id) || { name: id }).name;
  const last = sim.weeks[sim.weeks.length - 1].totals;
  const pipeline = cfg.queues.reduce((a, q) => a + (sim.weeks[sim.weeks.length - 1].queues[q.id].pipeline || 0), 0);
  const binding = trace.filter((t) => t.binding);
  const bindingWeeks = binding.map((t) => t.week + 1);
  const maxWant = binding.reduce((m, t) => Math.max(m, t.want), 0);
  const cap = cfg.hiring.cap;
  const churnForShort = (t) => {
    const shortIds = Object.keys(t.denied);
    if (!shortIds.length) return 0;
    let total = 0;
    for (const id of shortIds) {
      const q = cfg.queues.find((x) => x.id === id);
      const lead = q ? q.wf.reqToStart + q.wf.trainingWeeks + q.wf.learningCurve.length : 8;
      for (let w = t.week; w < Math.min(t.week + lead, sim.weeks.length); w++) {
        total += sim.weeks[w].queues[id].churnCost;
      }
    }
    return total;
  };
  const rows = showAll ? trace : binding.length ? binding : trace.slice(0, 6);
  return /* @__PURE__ */ jsxs6(
    Card,
    {
      title: "Holistic requirement panel",
      hint: "Required vs paid vs pipeline across the whole operation, and how the global hiring cap is rationed each week when demand for requisitions exceeds it.",
      right: /* @__PURE__ */ jsx7("button", { type: "button", className: "btn sm", onClick: () => setShowAll((s) => !s), children: showAll ? "Binding weeks only" : "Show all weeks" }),
      children: [
        /* @__PURE__ */ jsxs6("div", { className: "stat-row", children: [
          /* @__PURE__ */ jsxs6("div", { className: "stat", children: [
            /* @__PURE__ */ jsx7("div", { className: "l", children: "Required FTE (final wk)" }),
            /* @__PURE__ */ jsx7("div", { className: "v", children: num(last.reqFte, 0) })
          ] }),
          /* @__PURE__ */ jsxs6("div", { className: "stat", children: [
            /* @__PURE__ */ jsx7("div", { className: "l", children: "Active FTE (final wk)" }),
            /* @__PURE__ */ jsx7("div", { className: "v", children: num(last.active != null ? last.active : last.paid, 0) })
          ] }),
          /* @__PURE__ */ jsxs6("div", { className: "stat", children: [
            /* @__PURE__ */ jsx7("div", { className: "l", children: "In pipeline (final wk)" }),
            /* @__PURE__ */ jsx7("div", { className: "v", children: num(pipeline, 0) })
          ] }),
          /* @__PURE__ */ jsxs6("div", { className: "stat", children: [
            /* @__PURE__ */ jsx7("div", { className: "l", children: "Global cap" }),
            /* @__PURE__ */ jsxs6("div", { className: "v", children: [
              cap,
              /* @__PURE__ */ jsx7("small", { children: "/wk" })
            ] })
          ] }),
          /* @__PURE__ */ jsxs6("div", { className: "stat", children: [
            /* @__PURE__ */ jsx7("div", { className: "l", children: "Cap-bound weeks" }),
            /* @__PURE__ */ jsx7("div", { className: "v", children: binding.length })
          ] })
        ] }),
        /* @__PURE__ */ jsx7("p", { className: "note", style: { marginTop: 12 }, children: binding.length ? `Feasibility: the cap allows +${cap}/wk, but this plan needs up to +${Math.round(maxWant)}/wk in week${bindingWeeks.length > 1 ? "s" : ""} ${formatWeekRange(bindingWeeks)} \u2014 infeasible. The shortfall lands as churn.` : `Feasibility: the plan fits within the +${cap}/wk cap across the whole horizon.` }),
        /* @__PURE__ */ jsx7(QueuePanels, { sim }),
        /* @__PURE__ */ jsx7("div", { className: "tbl-wrap", style: { marginTop: 12, maxHeight: 380 }, children: /* @__PURE__ */ jsxs6("table", { className: "data", children: [
          /* @__PURE__ */ jsx7("thead", { children: /* @__PURE__ */ jsxs6("tr", { children: [
            /* @__PURE__ */ jsx7("th", { children: "Week" }),
            /* @__PURE__ */ jsx7("th", { children: "Cap" }),
            /* @__PURE__ */ jsx7("th", { children: "Wanted" }),
            cfg.queues.map((q) => /* @__PURE__ */ jsx7("th", { children: q.name }, q.id)),
            /* @__PURE__ */ jsx7("th", { children: "Proj. churn" })
          ] }) }),
          /* @__PURE__ */ jsxs6("tbody", { children: [
            rows.map((t) => {
              const proj = t.binding ? churnForShort(t) : 0;
              return /* @__PURE__ */ jsxs6("tr", { style: t.binding ? { background: "var(--red-s)" } : void 0, children: [
                /* @__PURE__ */ jsx7("td", { children: t.week + 1 }),
                /* @__PURE__ */ jsx7("td", { children: t.cap == null ? "\u221E" : t.cap }),
                /* @__PURE__ */ jsxs6("td", { children: [
                  num(t.want, 0),
                  t.binding ? " \u26A0" : ""
                ] }),
                cfg.queues.map((q) => {
                  const g = t.grants[q.id] || 0;
                  const d = t.denied[q.id] || 0;
                  return /* @__PURE__ */ jsxs6("td", { className: d > 0.05 ? "st-red" : void 0, children: [
                    g > 0.05 ? num(g, 0) : "\u2013",
                    d > 0.05 ? ` (\u2212${num(d, 0)})` : ""
                  ] }, q.id);
                }),
                /* @__PURE__ */ jsx7("td", { children: proj > 0 ? money(cur, proj) : "\u2013" })
              ] }, t.week);
            }),
            rows.length === 0 && /* @__PURE__ */ jsx7("tr", { children: /* @__PURE__ */ jsx7("td", { colSpan: 4 + cfg.queues.length, className: "empty", children: "No allocation activity." }) })
          ] })
        ] }) }),
        /* @__PURE__ */ jsx7("p", { className: "note", style: { marginTop: 10 }, children: "When the cap binds, scarce requisitions go to the queue with the greatest marginal churn cost averted per FTE (tie-break: earliest projected breach). A number in brackets is the shortfall that queue was denied that week." })
      ]
    }
  );
}
function QueuePanels({ sim }) {
  const cfg = sim.config;
  const cur = cfg.engine.currency;
  const worst = (q) => {
    const sts = sim.weeks.map((w) => w.queues[q.id].status);
    return sts.includes("red") ? "red" : sts.includes("amber") ? "amber" : "green";
  };
  const panel = (q) => {
    const series = sim.weeks.map((w) => w.queues[q.id]);
    const ops = series.reduce((a, s) => a + s.cost, 0);
    const cust = series.reduce((a, s) => a + s.churnCost, 0);
    const last = series[series.length - 1];
    return /* @__PURE__ */ jsxs6("div", { className: "qcard " + worst(q), style: { minWidth: 190 }, children: [
      /* @__PURE__ */ jsxs6("div", { className: "qn", children: [
        /* @__PURE__ */ jsx7("span", { children: q.name }),
        /* @__PURE__ */ jsx7("span", { className: "spacer" }),
        q.resourcing === "supported" && /* @__PURE__ */ jsx7("span", { className: "badge amber", children: "supported" })
      ] }),
      /* @__PURE__ */ jsxs6("div", { className: "kpis", children: [
        /* @__PURE__ */ jsxs6("div", { className: "kpi", children: [
          /* @__PURE__ */ jsx7("div", { className: "l", children: "Ops cost" }),
          /* @__PURE__ */ jsx7("div", { className: "v", children: money(cur, ops) })
        ] }),
        /* @__PURE__ */ jsxs6("div", { className: "kpi", children: [
          /* @__PURE__ */ jsx7("div", { className: "l", children: "Customer cost" }),
          /* @__PURE__ */ jsx7("div", { className: "v", children: money(cur, cust) })
        ] }),
        /* @__PURE__ */ jsxs6("div", { className: "kpi", children: [
          /* @__PURE__ */ jsx7("div", { className: "l", children: "Active" }),
          /* @__PURE__ */ jsx7("div", { className: "v", children: num(last.active != null ? last.active : last.trained + last.ramp, 0) })
        ] }),
        /* @__PURE__ */ jsxs6("div", { className: "kpi", children: [
          /* @__PURE__ */ jsx7("div", { className: "l", children: "Required" }),
          /* @__PURE__ */ jsx7("div", { className: "v", children: num(last.reqFte, 0) })
        ] })
      ] })
    ] }, q.id);
  };
  const voice = cfg.queues.filter((q) => q.type === "voice");
  const digital = cfg.queues.filter((q) => q.type === "digital");
  return /* @__PURE__ */ jsxs6("div", { style: { marginTop: 12 }, "data-testid": "holistic-queue-panels", children: [
    voice.length > 0 && /* @__PURE__ */ jsxs6(Fragment2, { children: [
      /* @__PURE__ */ jsx7("div", { className: "section-title", style: { margin: "6px 2px" }, children: "Voice" }),
      /* @__PURE__ */ jsx7("div", { className: "qcards", children: voice.map(panel) })
    ] }),
    digital.length > 0 && /* @__PURE__ */ jsxs6(Fragment2, { children: [
      /* @__PURE__ */ jsx7("div", { className: "section-title", style: { margin: "12px 2px 6px" }, children: "Digital" }),
      /* @__PURE__ */ jsx7("div", { className: "qcards", children: digital.map(panel) })
    ] })
  ] });
}
function formatWeekRange(weeks) {
  if (!weeks.length) return "";
  const sorted = [...weeks].sort((a, b) => a - b);
  const parts = [];
  let start = sorted[0], prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prev + 1) {
      prev = sorted[i];
      continue;
    }
    parts.push(start === prev ? `${start}` : `${start}\u2013${prev}`);
    start = prev = sorted[i];
  }
  parts.push(start === prev ? `${start}` : `${start}\u2013${prev}`);
  return parts.join(", ");
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
import { jsx as jsx8, jsxs as jsxs7 } from "react/jsx-runtime";
var SERIES2 = ["#0e7c86", "#d98a0b", "#5a54c9", "#c0417a", "#2f8f4e", "#b0602a", "#3a7bd5", "#8a51b0"];
var AX = { fontSize: 11 };
var common = { margin: { top: 8, right: 14, left: 4, bottom: 4 } };
var wkX = { dataKey: "wk", tick: AX, interval: "preserveStartEnd", minTickGap: 18 };
function markLine(selectedWeek) {
  if (selectedWeek == null) return null;
  return /* @__PURE__ */ jsx8(ReferenceLine, { x: selectedWeek + 1, stroke: "#0f1720", strokeDasharray: "3 3", strokeOpacity: 0.5 });
}
function CoverageChart({ sim, selectedWeek }) {
  const cfg = sim.config;
  const data = sim.weeks.map((w) => {
    const row = { wk: w.week + 1 };
    for (const q of cfg.queues) row[q.id] = +(w.queues[q.id].cover * 100).toFixed(1);
    return row;
  });
  return /* @__PURE__ */ jsx8(Chart, { title: "Coverage", hint: "Available productive hours \xF7 required hours, laid along the requirement curve. 100% means SLA is met in every interval; below is a uniform shortfall.", children: (w, h) => /* @__PURE__ */ jsxs7(LineChart2, { width: w, height: h, data, ...common, children: [
    /* @__PURE__ */ jsx8(CartesianGrid2, { strokeDasharray: "3 3", stroke: "#eef2f5" }),
    /* @__PURE__ */ jsx8(XAxis2, { ...wkX }),
    /* @__PURE__ */ jsx8(YAxis2, { tick: AX, width: 40, domain: [0, "auto"], tickFormatter: (v) => v + "%" }),
    /* @__PURE__ */ jsx8(Tooltip2, { formatter: (v) => v + "%" }),
    /* @__PURE__ */ jsx8(Legend2, { wrapperStyle: { fontSize: 11 } }),
    /* @__PURE__ */ jsx8(ReferenceLine, { y: 100, stroke: "#1f9d55", strokeDasharray: "4 2" }),
    markLine(selectedWeek),
    cfg.queues.map((q, i) => /* @__PURE__ */ jsx8(Line2, { type: "monotone", dataKey: q.id, name: q.name, stroke: SERIES2[i % SERIES2.length], dot: false, strokeWidth: 2, isAnimationActive: false }, q.id))
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
  return /* @__PURE__ */ jsx8(Chart, { title: "Headcount \u2014 trained / ramping / training vs required", hint: "Paid heads split by readiness. Trainees cost full salary but deliver zero; ramping agents deliver their learning-curve share. The line is required FTE.", children: (w, h) => /* @__PURE__ */ jsxs7(ComposedChart, { width: w, height: h, data, ...common, children: [
    /* @__PURE__ */ jsx8(CartesianGrid2, { strokeDasharray: "3 3", stroke: "#eef2f5" }),
    /* @__PURE__ */ jsx8(XAxis2, { ...wkX }),
    /* @__PURE__ */ jsx8(YAxis2, { tick: AX, width: 40 }),
    /* @__PURE__ */ jsx8(Tooltip2, {}),
    /* @__PURE__ */ jsx8(Legend2, { wrapperStyle: { fontSize: 11 } }),
    /* @__PURE__ */ jsx8(Area, { type: "monotone", dataKey: "trained", stackId: "hc", stroke: "#0e7c86", fill: "#0e7c86", fillOpacity: 0.75, isAnimationActive: false }),
    /* @__PURE__ */ jsx8(Area, { type: "monotone", dataKey: "ramping", stackId: "hc", stroke: "#12a3b0", fill: "#57c3cc", fillOpacity: 0.7, isAnimationActive: false }),
    /* @__PURE__ */ jsx8(Area, { type: "monotone", dataKey: "training", stackId: "hc", stroke: "#d98a0b", fill: "#f0c774", fillOpacity: 0.7, isAnimationActive: false }),
    /* @__PURE__ */ jsx8(Line2, { type: "monotone", dataKey: "required", stroke: "#0f1720", strokeWidth: 2, dot: false, isAnimationActive: false }),
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
  return /* @__PURE__ */ jsx8(Chart, { title: "Volume composition", hint: "Exogenous base volume (after seasonality and scenarios) plus endogenous load: digital\u2192voice deflection and abandoned-caller redials.", children: (w, h) => /* @__PURE__ */ jsxs7(BarChart, { width: w, height: h, data, ...common, children: [
    /* @__PURE__ */ jsx8(CartesianGrid2, { strokeDasharray: "3 3", stroke: "#eef2f5" }),
    /* @__PURE__ */ jsx8(XAxis2, { ...wkX }),
    /* @__PURE__ */ jsx8(YAxis2, { tick: AX, width: 48, tickFormatter: (v) => v >= 1e3 ? (v / 1e3).toFixed(0) + "k" : v }),
    /* @__PURE__ */ jsx8(Tooltip2, {}),
    /* @__PURE__ */ jsx8(Legend2, { wrapperStyle: { fontSize: 11 } }),
    /* @__PURE__ */ jsx8(Bar, { dataKey: "base", name: "Base", stackId: "v", fill: "#0e7c86", isAnimationActive: false }),
    /* @__PURE__ */ jsx8(Bar, { dataKey: "deflected", name: "Deflected", stackId: "v", fill: "#5a54c9", isAnimationActive: false }),
    /* @__PURE__ */ jsx8(Bar, { dataKey: "redial", name: "Redial", stackId: "v", fill: "#d98a0b", isAnimationActive: false }),
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
  return /* @__PURE__ */ jsx8(Chart, { title: "Cost breakdown", hint: "Weekly run cost by component: productive salary, trainee salary, management overhead, and service-team premium hours.", children: (w, h) => /* @__PURE__ */ jsxs7(BarChart, { width: w, height: h, data, ...common, children: [
    /* @__PURE__ */ jsx8(CartesianGrid2, { strokeDasharray: "3 3", stroke: "#eef2f5" }),
    /* @__PURE__ */ jsx8(XAxis2, { ...wkX }),
    /* @__PURE__ */ jsx8(YAxis2, { tick: AX, width: 48, tickFormatter: (v) => money(cur, v) }),
    /* @__PURE__ */ jsx8(Tooltip2, { formatter: (v) => money(cur, v) }),
    /* @__PURE__ */ jsx8(Legend2, { wrapperStyle: { fontSize: 11 } }),
    /* @__PURE__ */ jsx8(Bar, { dataKey: "productive", name: "Productive", stackId: "c", fill: "#0e7c86", isAnimationActive: false }),
    /* @__PURE__ */ jsx8(Bar, { dataKey: "training", name: "Training", stackId: "c", fill: "#d98a0b", isAnimationActive: false }),
    /* @__PURE__ */ jsx8(Bar, { dataKey: "managers", name: "Managers", stackId: "c", fill: "#5a54c9", isAnimationActive: false }),
    /* @__PURE__ */ jsx8(Bar, { dataKey: "service", name: "Service team", stackId: "c", fill: "#2f8f4e", isAnimationActive: false }),
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
  return /* @__PURE__ */ jsx8(Chart, { title: "Idle pay vs churn cost", hint: "Over-staffing wastes salary; under-staffing loses customers. The break-even week is where the two curves cross \u2014 the cheapest place to sit.", children: (w, h) => /* @__PURE__ */ jsxs7(LineChart2, { width: w, height: h, data, ...common, children: [
    /* @__PURE__ */ jsx8(CartesianGrid2, { strokeDasharray: "3 3", stroke: "#eef2f5" }),
    /* @__PURE__ */ jsx8(XAxis2, { ...wkX }),
    /* @__PURE__ */ jsx8(YAxis2, { tick: AX, width: 48, tickFormatter: (v) => money(cur, v) }),
    /* @__PURE__ */ jsx8(Tooltip2, { formatter: (v) => money(cur, v) }),
    /* @__PURE__ */ jsx8(Legend2, { wrapperStyle: { fontSize: 11 } }),
    /* @__PURE__ */ jsx8(Line2, { type: "monotone", dataKey: "idle", name: "Idle pay", stroke: "#3a7bd5", strokeWidth: 2, dot: false, isAnimationActive: false }),
    /* @__PURE__ */ jsx8(Line2, { type: "monotone", dataKey: "churn", name: "Churn cost", stroke: "#c0417a", strokeWidth: 2, dot: false, isAnimationActive: false }),
    cross != null && /* @__PURE__ */ jsx8(ReferenceLine, { x: cross, stroke: "#1f9d55", label: { value: "break-even", fontSize: 10, fill: "#1f9d55", position: "top" } }),
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
  return /* @__PURE__ */ jsx8(Chart, { title: "Burnout index", hint: "Accumulates while occupancy exceeds the threshold, multiplying attrition and adding absence shrinkage; recovers when occupancy eases.", children: (w, h) => /* @__PURE__ */ jsxs7(LineChart2, { width: w, height: h, data, ...common, children: [
    /* @__PURE__ */ jsx8(CartesianGrid2, { strokeDasharray: "3 3", stroke: "#eef2f5" }),
    /* @__PURE__ */ jsx8(XAxis2, { ...wkX }),
    /* @__PURE__ */ jsx8(YAxis2, { tick: AX, width: 36, domain: [0, 100] }),
    /* @__PURE__ */ jsx8(Tooltip2, {}),
    /* @__PURE__ */ jsx8(Legend2, { wrapperStyle: { fontSize: 11 } }),
    cfg.queues.map((q, i) => /* @__PURE__ */ jsx8(Line2, { type: "monotone", dataKey: q.id, name: q.name, stroke: SERIES2[i % SERIES2.length], dot: false, strokeWidth: 2, isAnimationActive: false }, q.id)),
    markLine(selectedWeek)
  ] }) });
}

// ui/components/PlanTab.jsx
import { Fragment as Fragment3, jsx as jsx9, jsxs as jsxs8 } from "react/jsx-runtime";
function Findings({ findings }) {
  if (!findings || !findings.length) return /* @__PURE__ */ jsx9("div", { className: "empty", children: "No findings \u2014 the plan holds across the horizon." });
  return /* @__PURE__ */ jsx9("div", { className: "findings", children: findings.map((f, i) => /* @__PURE__ */ jsxs8("div", { className: "finding " + f.tone, children: [
    /* @__PURE__ */ jsx9("span", { className: "pip" }),
    /* @__PURE__ */ jsx9("span", { children: f.text })
  ] }, i)) });
}
function QueueCard({ q, s }) {
  const voice = q.type === "voice";
  return /* @__PURE__ */ jsxs8("div", { className: "qcard " + s.status, children: [
    /* @__PURE__ */ jsxs8("div", { className: "qn", children: [
      /* @__PURE__ */ jsx9("span", { children: q.name }),
      /* @__PURE__ */ jsx9("span", { className: "spacer" }),
      q.resourcing === "supported" && /* @__PURE__ */ jsx9("span", { className: "badge amber", title: void 0, children: "supported" }),
      /* @__PURE__ */ jsx9("span", { className: "qtype", children: q.type })
    ] }),
    /* @__PURE__ */ jsxs8("div", { className: "kpis", children: [
      /* @__PURE__ */ jsxs8("div", { className: "kpi", children: [
        /* @__PURE__ */ jsx9("div", { className: "l", children: "Volume" }),
        /* @__PURE__ */ jsx9("div", { className: "v", children: num(s.volume, 0) })
      ] }),
      /* @__PURE__ */ jsxs8("div", { className: "kpi", children: [
        /* @__PURE__ */ jsx9("div", { className: "l", children: "Coverage" }),
        /* @__PURE__ */ jsx9("div", { className: "v", children: pct(s.cover) })
      ] }),
      voice ? /* @__PURE__ */ jsxs8(Fragment3, { children: [
        /* @__PURE__ */ jsxs8("div", { className: "kpi", children: [
          /* @__PURE__ */ jsx9("div", { className: "l", children: "ASA" }),
          /* @__PURE__ */ jsx9("div", { className: "v", children: secs(s.asa) })
        ] }),
        /* @__PURE__ */ jsxs8("div", { className: "kpi", children: [
          /* @__PURE__ */ jsx9("div", { className: "l", children: "Abandon" }),
          /* @__PURE__ */ jsx9("div", { className: "v", children: pct(s.abandon, 1) })
        ] })
      ] }) : /* @__PURE__ */ jsxs8(Fragment3, { children: [
        /* @__PURE__ */ jsxs8("div", { className: "kpi", children: [
          /* @__PURE__ */ jsx9("div", { className: "l", children: "Response" }),
          /* @__PURE__ */ jsxs8("div", { className: "v", children: [
            num(s.respMin, 1),
            "m"
          ] })
        ] }),
        /* @__PURE__ */ jsxs8("div", { className: "kpi", children: [
          /* @__PURE__ */ jsx9("div", { className: "l", children: "In SLA" }),
          /* @__PURE__ */ jsx9("div", { className: "v", children: pct(s.sl) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs8("div", { className: "kpi", children: [
        /* @__PURE__ */ jsx9("div", { className: "l", children: "Occupancy" }),
        /* @__PURE__ */ jsx9("div", { className: "v", children: pct(s.occ) })
      ] }),
      /* @__PURE__ */ jsxs8("div", { className: "kpi", children: [
        /* @__PURE__ */ jsx9("div", { className: "l", children: "Active / req" }),
        /* @__PURE__ */ jsxs8("div", { className: "v", children: [
          num(s.active != null ? s.active : s.trained + s.ramp, 0),
          "/",
          num(s.reqFte, 0)
        ] })
      ] })
    ] })
  ] });
}
function HiringSummary({ sim, cur }) {
  const h = sim.summary.hiring;
  if (!h) return null;
  const q = sim.config.queues;
  const row = (label, r, cls) => /* @__PURE__ */ jsxs8("tr", { className: cls, children: [
    /* @__PURE__ */ jsx9("td", { style: { textAlign: "left", fontWeight: cls ? 700 : 600 }, children: label }),
    /* @__PURE__ */ jsx9("td", { children: num(r.volume, 0) }),
    /* @__PURE__ */ jsx9("td", { children: num(r.required, 1) }),
    /* @__PURE__ */ jsx9("td", { children: num(r.hiring, 1) }),
    /* @__PURE__ */ jsx9("td", { children: num(r.training, 1) }),
    /* @__PURE__ */ jsx9("td", { children: num(r.active, 1) }),
    /* @__PURE__ */ jsx9("td", { children: num(r.churnCount, 1) }),
    /* @__PURE__ */ jsx9("td", { children: pct(r.churnPct, 1) })
  ] }, label);
  return /* @__PURE__ */ jsx9(Card, { title: "Hiring summary", hint: "Volume, required HC, hiring (requisitions raised over the horizon), training and active heads, and agent churn \u2014 per queue and rolled up for Voice, Digital and Overall.", children: /* @__PURE__ */ jsx9("div", { className: "tbl-wrap", children: /* @__PURE__ */ jsxs8("table", { className: "data", "data-testid": "hiring-summary", children: [
    /* @__PURE__ */ jsx9("thead", { children: /* @__PURE__ */ jsxs8("tr", { children: [
      /* @__PURE__ */ jsx9("th", { children: "Scope" }),
      /* @__PURE__ */ jsx9("th", { children: "Volume" }),
      /* @__PURE__ */ jsx9("th", { children: "Required" }),
      /* @__PURE__ */ jsx9("th", { children: "Hiring" }),
      /* @__PURE__ */ jsx9("th", { children: "Training" }),
      /* @__PURE__ */ jsx9("th", { children: "Active" }),
      /* @__PURE__ */ jsx9("th", { children: "Churn #" }),
      /* @__PURE__ */ jsx9("th", { children: "Churn %" })
    ] }) }),
    /* @__PURE__ */ jsxs8("tbody", { children: [
      q.map((qq) => row(qq.name + (qq.resourcing === "supported" ? " (supported)" : ""), h.queues[qq.id], "")),
      row("Voice", h.groups.voice, "grp"),
      row("Digital", h.groups.digital, "grp"),
      row("Overall", h.groups.overall, "grp total")
    ] })
  ] }) }) });
}
function PlanTab({ sim, viewLabel }) {
  const cfg = sim.config;
  const [selectedWeek, setSelectedWeek] = useState7(0);
  const wk = Math.min(selectedWeek, sim.weeks.length - 1);
  const week = sim.weeks[wk];
  const sm = sim.summary;
  const cur = cfg.engine.currency;
  return /* @__PURE__ */ jsxs8(
    "div",
    {
      className: "grid",
      style: { gap: 16 },
      "data-testid": "plan-panel",
      "data-active-strategy": sm.strategy,
      "data-active-allin": Math.round(sm.allIn),
      children: [
        /* @__PURE__ */ jsx9(Card, { title: "Findings", hint: "Auto-written from the active strategy. Red demands a decision; amber is a watch item.", children: /* @__PURE__ */ jsx9(Findings, { findings: sm.findings }) }),
        /* @__PURE__ */ jsx9(
          Card,
          {
            title: "RAG ribbon",
            sub: "week \xD7 queue \u2014 click any cell to scrub the dashboard",
            hint: "Each square is a queue-week's SLA verdict. Dots mark weeks where an enabled scenario fires.",
            children: /* @__PURE__ */ jsx9(Ribbon, { sim, selectedWeek: wk, onScrub: setSelectedWeek })
          }
        ),
        /* @__PURE__ */ jsxs8(Card, { title: `Queue status \u2014 week ${wk + 1}`, sub: `${sm.strategy} active \xB7 view: ${viewLabel || "Plan of record"}`, children: [
          /* @__PURE__ */ jsx9("div", { className: "qcards", children: cfg.queues.map((q) => /* @__PURE__ */ jsx9(QueueCard, { q, s: week.queues[q.id] }, q.id)) }),
          /* @__PURE__ */ jsx9("hr", { className: "sep", style: { margin: "14px 0" } }),
          /* @__PURE__ */ jsxs8("div", { className: "stat-row", children: [
            /* @__PURE__ */ jsxs8("div", { className: "stat", children: [
              /* @__PURE__ */ jsx9("div", { className: "l", children: "Week run cost" }),
              /* @__PURE__ */ jsx9("div", { className: "v", children: money(cur, week.totals.totalCost) })
            ] }),
            /* @__PURE__ */ jsxs8("div", { className: "stat", children: [
              /* @__PURE__ */ jsx9("div", { className: "l", children: "Week churn cost" }),
              /* @__PURE__ */ jsx9("div", { className: "v", children: money(cur, week.totals.churnCost) })
            ] }),
            /* @__PURE__ */ jsxs8("div", { className: "stat", children: [
              /* @__PURE__ */ jsx9("div", { className: "l", children: "Active FTE" }),
              /* @__PURE__ */ jsxs8("div", { className: "v", children: [
                num(week.totals.active != null ? week.totals.active : week.totals.paid, 0),
                " ",
                /* @__PURE__ */ jsxs8("small", { children: [
                  "/ ",
                  num(week.totals.reqFte, 0),
                  " req"
                ] })
              ] })
            ] }),
            /* @__PURE__ */ jsxs8("div", { className: "stat", children: [
              /* @__PURE__ */ jsx9("div", { className: "l", children: "Horizon all-in" }),
              /* @__PURE__ */ jsx9("div", { className: "v", children: money(cur, sm.allIn) })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsx9(HiringSummary, { sim, cur }),
        /* @__PURE__ */ jsxs8("div", { className: "grid cols-2", children: [
          /* @__PURE__ */ jsx9(CoverageChart, { sim, selectedWeek: wk }),
          /* @__PURE__ */ jsx9(HeadcountChart, { sim, selectedWeek: wk }),
          /* @__PURE__ */ jsx9(VolumeChart, { sim, selectedWeek: wk }),
          /* @__PURE__ */ jsx9(CostChart, { sim, selectedWeek: wk }),
          /* @__PURE__ */ jsx9(IdleChurnChart, { sim, selectedWeek: wk }),
          /* @__PURE__ */ jsx9(BurnoutChart, { sim, selectedWeek: wk })
        ] }),
        /* @__PURE__ */ jsx9(HolisticPanel, { sim })
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
function buildWorkbook(sim, strategySims, config, activeStrategyId, activeViewId) {
  const wb = XLSX.utils.book_new();
  const S = (aoa, name) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
  S(summaryAOA(sim, strategySims, activeStrategyId, activeViewId, config), "Summary");
  S(strategyAOA(strategySims, config), "Strategy comparison");
  S(findingsAOA(sim, config), "Findings & risks");
  S([["Path", "Setting", "Value"], ...flattenParameters(config).map((r) => [r.path, r.setting, r.value])], "Parameters");
  S(volumesAOA(config), "Volumes");
  const used = /* @__PURE__ */ new Set(["Summary", "Strategy comparison", "Findings & risks", "Parameters", "Volumes"]);
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
import { jsx as jsx10, jsxs as jsxs9 } from "react/jsx-runtime";
function DataTab({ sim, config, activeViewId, views, onSelectView }) {
  const [qid, setQid] = useState8(config.queues[0] ? config.queues[0].id : "");
  const [hidden, setHidden] = useState8(() => /* @__PURE__ */ new Set());
  const queue = config.queues.find((q) => q.id === qid) || config.queues[0];
  if (!queue) return /* @__PURE__ */ jsx10("div", { className: "empty", children: "No queues configured." });
  const cols = columnsFor(queue, config.engine.currency).filter((c) => !hidden.has(c.group));
  const rows = buildWeeklyRows(sim, queue, config);
  const toggleGroup = (g) => setHidden((h) => {
    const n = new Set(h);
    n.has(g) ? n.delete(g) : n.add(g);
    return n;
  });
  return /* @__PURE__ */ jsxs9("div", { className: "grid", style: { gap: 16 }, children: [
    /* @__PURE__ */ jsxs9(Card, { title: "Per-queue data", hint: "Every weekly datapoint \u2014 outputs and the assumptions in effect that week. Read-only: edit values in the editor tabs.", children: [
      /* @__PURE__ */ jsxs9("div", { className: "fieldrow", style: { maxWidth: 640 }, children: [
        /* @__PURE__ */ jsx10(SelectField, { label: "Queue", value: queue.id, onChange: setQid, options: config.queues.map((q) => ({ value: q.id, label: q.name })) }),
        /* @__PURE__ */ jsx10(SelectField, { label: "View", value: activeViewId, onChange: onSelectView, options: views.map((v) => ({ value: v.id, label: v.name })) })
      ] }),
      /* @__PURE__ */ jsxs9("div", { className: "rowflex", style: { marginTop: 12 }, children: [
        /* @__PURE__ */ jsxs9("span", { className: "lab", style: { display: "flex", alignItems: "center", gap: 6 }, children: [
          "Column groups ",
          /* @__PURE__ */ jsx10(Hint, { text: "Toggle groups of columns. All are on by default." })
        ] }),
        COLUMN_GROUPS.filter((g) => g !== "Week").map((g) => /* @__PURE__ */ jsxs9("label", { className: "switch", children: [
          /* @__PURE__ */ jsx10("input", { type: "checkbox", checked: !hidden.has(g), onChange: () => toggleGroup(g) }),
          /* @__PURE__ */ jsx10("span", { className: "track", "aria-hidden": "true" }),
          /* @__PURE__ */ jsx10("span", { children: g })
        ] }, g)),
        /* @__PURE__ */ jsx10("span", { className: "spacer" }),
        /* @__PURE__ */ jsx10(
          "button",
          {
            type: "button",
            className: "btn sm",
            onClick: () => downloadText(`${queue.name.replace(/\s+/g, "_")}_weekly.csv`, queueCSV(sim, queue, config), "text/csv"),
            children: "Export CSV"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsx10(Card, { title: `${queue.name} \u2014 weekly`, sub: `${rows.length} weeks \xB7 ${cols.length} columns`, children: /* @__PURE__ */ jsx10("div", { className: "tbl-wrap", style: { maxHeight: 560 }, children: /* @__PURE__ */ jsxs9("table", { className: "data grouped", "data-testid": "data-table", children: [
      /* @__PURE__ */ jsx10("thead", { children: /* @__PURE__ */ jsx10("tr", { children: cols.map((c) => /* @__PURE__ */ jsx10("th", { className: "grp-" + c.group.toLowerCase(), children: c.label }, c.key)) }) }),
      /* @__PURE__ */ jsx10("tbody", { children: rows.map((row) => /* @__PURE__ */ jsx10("tr", { children: cols.map((c) => /* @__PURE__ */ jsx10("td", { className: "grp-" + c.group.toLowerCase() + (c.key === "status" ? " st-" + row.status : ""), children: c.fmt(row[c.key]) }, c.key)) }, row.week)) })
    ] }) }) })
  ] });
}

// ui/components/IntradayTab.jsx
import { useState as useState9 } from "react";
import { BarChart as BarChart2, Bar as Bar2, ComposedChart as ComposedChart2, Line as Line3, XAxis as XAxis3, YAxis as YAxis3, CartesianGrid as CartesianGrid3, Tooltip as Tooltip3, Legend as Legend3 } from "recharts";
import { Fragment as Fragment4, jsx as jsx11, jsxs as jsxs10 } from "react/jsx-runtime";
function IntradayTab({ sim }) {
  const cfg = sim.config;
  const eng = cfg.engine;
  const [qid, setQid] = useState9(cfg.queues[0] ? cfg.queues[0].id : "");
  const [wk, setWk] = useState9(0);
  const q = cfg.queues.find((x) => x.id === qid) || cfg.queues[0];
  if (!q) return /* @__PURE__ */ jsx11("div", { className: "empty", children: "No queues configured." });
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
  return /* @__PURE__ */ jsxs10("div", { className: "grid", style: { gap: 16 }, children: [
    /* @__PURE__ */ jsxs10(Card, { title: "Intraday view", sub: "first day of the selected week", hint: "Pick a queue, then click any week in the strip \u2014 coloured by that queue's SLA verdict \u2014 to load its first-day intraday profile.", children: [
      /* @__PURE__ */ jsx11("div", { className: "fieldrow", style: { maxWidth: 320, marginBottom: 12 }, children: /* @__PURE__ */ jsx11(
        SelectField,
        {
          label: "Queue",
          value: q.id,
          onChange: setQid,
          options: cfg.queues.map((x) => ({ value: x.id, label: x.name }))
        }
      ) }),
      /* @__PURE__ */ jsxs10("div", { className: "lab", style: { marginBottom: 6 }, children: [
        "Weeks \u2014 ",
        q.name,
        " (click to load)"
      ] }),
      /* @__PURE__ */ jsx11("div", { className: "week-strip", "data-testid": "week-strip", children: sim.weeks.map((w) => {
        const st = w.queues[q.id].status;
        const sel = w.week === Math.min(wk, sim.weeks.length - 1);
        return /* @__PURE__ */ jsx11(
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
    /* @__PURE__ */ jsx11(Chart, { title: `Required vs available agents \u2014 ${q.name}`, hint: "Available agent-hours are laid along the requirement curve (engineering note E2), so quiet intervals still receive proportionally more agents. Bars are required; the line is available.", children: (w, h) => /* @__PURE__ */ jsxs10(ComposedChart2, { width: w, height: h, data, margin: { top: 8, right: 14, left: 4, bottom: 4 }, children: [
      /* @__PURE__ */ jsx11(CartesianGrid3, { strokeDasharray: "3 3", stroke: "#eef2f5" }),
      /* @__PURE__ */ jsx11(XAxis3, { dataKey: "t", tick: { fontSize: 10 }, interval: "preserveStartEnd", minTickGap: 16 }),
      /* @__PURE__ */ jsx11(YAxis3, { tick: { fontSize: 11 }, width: 40 }),
      /* @__PURE__ */ jsx11(Tooltip3, {}),
      /* @__PURE__ */ jsx11(Legend3, { wrapperStyle: { fontSize: 11 } }),
      /* @__PURE__ */ jsx11(Bar2, { dataKey: "required", name: "Required agents", fill: "#0e7c86", isAnimationActive: false }),
      /* @__PURE__ */ jsx11(Line3, { type: "monotone", dataKey: "available", name: "Available agents", stroke: "#d98a0b", strokeWidth: 2, dot: false, isAnimationActive: false })
    ] }) }),
    /* @__PURE__ */ jsx11(Card, { title: "Interval detail", sub: `${q.name} \xB7 week ${Math.min(wk, sim.weeks.length - 1) + 1}`, children: /* @__PURE__ */ jsx11("div", { className: "tbl-wrap", style: { maxHeight: 460 }, children: /* @__PURE__ */ jsxs10("table", { className: "data", children: [
      /* @__PURE__ */ jsx11("thead", { children: /* @__PURE__ */ jsxs10("tr", { children: [
        /* @__PURE__ */ jsx11("th", { children: "Interval" }),
        /* @__PURE__ */ jsx11("th", { children: "Arrivals" }),
        /* @__PURE__ */ jsx11("th", { children: "Required" }),
        /* @__PURE__ */ jsx11("th", { children: "Available" }),
        voice ? /* @__PURE__ */ jsxs10(Fragment4, { children: [
          /* @__PURE__ */ jsx11("th", { children: "ASA" }),
          /* @__PURE__ */ jsx11("th", { children: "Abandon" }),
          /* @__PURE__ */ jsx11("th", { children: "SL" })
        ] }) : /* @__PURE__ */ jsxs10(Fragment4, { children: [
          /* @__PURE__ */ jsx11("th", { children: "Backlog" }),
          /* @__PURE__ */ jsx11("th", { children: "Response" }),
          /* @__PURE__ */ jsx11("th", { children: "Served" })
        ] }),
        /* @__PURE__ */ jsx11("th", { children: "Occupancy" })
      ] }) }),
      /* @__PURE__ */ jsxs10("tbody", { children: [
        byInterval.map((iv) => /* @__PURE__ */ jsxs10("tr", { children: [
          /* @__PURE__ */ jsx11("td", { children: intervalLabel(iv.i, eng) }),
          /* @__PURE__ */ jsx11("td", { children: Math.round(iv.arrivals) }),
          /* @__PURE__ */ jsx11("td", { children: num(iv.req, 1) }),
          /* @__PURE__ */ jsx11("td", { children: num(iv.agents, 1) }),
          voice ? /* @__PURE__ */ jsxs10(Fragment4, { children: [
            /* @__PURE__ */ jsx11("td", { children: secs(iv.asa) }),
            /* @__PURE__ */ jsx11("td", { children: pct(iv.abandon, 1) }),
            /* @__PURE__ */ jsx11("td", { children: pct(iv.sl) })
          ] }) : /* @__PURE__ */ jsxs10(Fragment4, { children: [
            /* @__PURE__ */ jsx11("td", { children: num(iv.backlog, 0) }),
            /* @__PURE__ */ jsxs10("td", { children: [
              num(iv.resp || 0, 1),
              "m"
            ] }),
            /* @__PURE__ */ jsx11("td", { children: num(iv.served || 0, 0) })
          ] }),
          /* @__PURE__ */ jsx11("td", { children: pct(iv.occ) })
        ] }, iv.i)),
        byInterval.length === 0 && /* @__PURE__ */ jsx11("tr", { children: /* @__PURE__ */ jsx11("td", { colSpan: 8, className: "empty", children: "No intraday detail for this selection." }) })
      ] })
    ] }) }) })
  ] });
}

// ui/components/SnapshotsTab.jsx
import { useState as useState11 } from "react";
import { LineChart as LineChart3, Line as Line4, XAxis as XAxis4, YAxis as YAxis4, CartesianGrid as CartesianGrid4, Tooltip as Tooltip4, Legend as Legend4 } from "recharts";

// ui/components/FilesCard.jsx
import { useState as useState10, useRef as useRef3 } from "react";
import { jsx as jsx12, jsxs as jsxs11 } from "react/jsx-runtime";
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
function FilesCard({ sim, strategySims, config, activeStrategy, activeViewId, onImportConfig, title = "Files \u2014 export & import" }) {
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
  return /* @__PURE__ */ jsxs11(Card, { title, hint: "One workbook round-trips Parameters and Volumes; config and saved-run JSON share whole plans; CSVs are plain-text fallbacks.", children: [
    /* @__PURE__ */ jsxs11("div", { className: "btnbar", children: [
      /* @__PURE__ */ jsx12("button", { type: "button", className: "btn primary", "data-testid": "export-workbook", onClick: onWorkbook, children: "Export Excel workbook" }),
      /* @__PURE__ */ jsx12("button", { type: "button", className: "btn", "data-testid": "export-config", onClick: () => downloadText("capacity-config.json", configJSON(config), "application/json"), children: "Export config JSON" }),
      /* @__PURE__ */ jsx12("button", { type: "button", className: "btn", "data-testid": "export-run", onClick: () => downloadText("capacity-run.json", runJSON(sim, config), "application/json"), children: "Export saved run" })
    ] }),
    /* @__PURE__ */ jsxs11("div", { className: "btnbar", style: { marginTop: 8 }, children: [
      /* @__PURE__ */ jsx12("button", { type: "button", className: "btn", "data-testid": "export-params-csv", onClick: () => downloadText("parameters.csv", parametersCSV(config), "text/csv"), children: "Parameters CSV" }),
      /* @__PURE__ */ jsx12("button", { type: "button", className: "btn", "data-testid": "export-volumes-csv", onClick: () => downloadText("volumes.csv", volumesCSV(config), "text/csv"), children: "Volumes CSV" })
    ] }),
    /* @__PURE__ */ jsx12("hr", { className: "sep", style: { margin: "14px 0" } }),
    /* @__PURE__ */ jsxs11("div", { className: "btnbar", children: [
      /* @__PURE__ */ jsx12("button", { type: "button", className: "btn", onClick: () => wbInput.current && wbInput.current.click(), children: "Import Excel (Parameters + Volumes)" }),
      /* @__PURE__ */ jsx12("button", { type: "button", className: "btn", onClick: () => cfgInput.current && cfgInput.current.click(), children: "Import config JSON" }),
      /* @__PURE__ */ jsx12("button", { type: "button", className: "btn", onClick: () => runInput.current && runInput.current.click(), children: "Import saved run" }),
      /* @__PURE__ */ jsx12("button", { type: "button", className: "btn", onClick: () => csvInput.current && csvInput.current.click(), children: "Import parameters CSV" }),
      /* @__PURE__ */ jsx12("input", { ref: wbInput, type: "file", accept: ".xlsx", "data-testid": "import-workbook", style: { display: "none" }, onChange: (e) => e.target.files[0] && importWorkbook(e.target.files[0]) }),
      /* @__PURE__ */ jsx12("input", { ref: cfgInput, type: "file", accept: ".json", "data-testid": "import-config", style: { display: "none" }, onChange: (e) => e.target.files[0] && importConfig(e.target.files[0]) }),
      /* @__PURE__ */ jsx12("input", { ref: runInput, type: "file", accept: ".json", "data-testid": "import-run", style: { display: "none" }, onChange: (e) => e.target.files[0] && importRun(e.target.files[0]) }),
      /* @__PURE__ */ jsx12("input", { ref: csvInput, type: "file", accept: ".csv", "data-testid": "import-params-csv", style: { display: "none" }, onChange: (e) => e.target.files[0] && importParamsCSV(e.target.files[0]) })
    ] }),
    msg && /* @__PURE__ */ jsx12("p", { className: "note", style: { marginTop: 12, color: msg.tone === "err" ? "var(--red)" : void 0 }, children: msg.text }),
    /* @__PURE__ */ jsx12("p", { className: "note", style: { marginTop: 10 }, children: "Importing a workbook reads only the Parameters and Volumes sheets (output sheets are ignored) and patches your config by path. Config and saved-run JSON replace the whole plan." })
  ] });
}

// ui/components/SnapshotsTab.jsx
import { Fragment as Fragment5, jsx as jsx13, jsxs as jsxs12 } from "react/jsx-runtime";
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
  return /* @__PURE__ */ jsxs12("div", { className: "grid", style: { gap: 16 }, children: [
    /* @__PURE__ */ jsxs12("p", { className: "note", "data-testid": "snapshots-copy", children: [
      /* @__PURE__ */ jsx13("strong", { children: "Snapshots" }),
      " are frozen results \u2014 capture the plan now to compare before/after or share it. ",
      /* @__PURE__ */ jsx13("strong", { children: "Views" }),
      " (top bar) are live scenario lenses on the current model, not saved."
    ] }),
    /* @__PURE__ */ jsxs12(
      Card,
      {
        title: "Snapshots",
        sub: `storage: ${storageMode}`,
        hint: "Save the current plan as a named snapshot, then tick snapshots to compare them.",
        right: /* @__PURE__ */ jsx13("button", { type: "button", className: "btn sm", onClick: onRefresh, children: "Refresh" }),
        children: [
          storageNotice && /* @__PURE__ */ jsx13("p", { className: "note", style: { marginBottom: 12, color: "var(--amber)" }, children: storageNotice }),
          /* @__PURE__ */ jsxs12("div", { className: "rowflex", children: [
            /* @__PURE__ */ jsx13("input", { type: "text", className: "inp", style: { maxWidth: 260 }, placeholder: "snapshot name", value: name, onChange: (e) => setName(e.target.value), "data-testid": "snapshot-name" }),
            /* @__PURE__ */ jsx13("button", { type: "button", className: "btn primary", "data-testid": "save-snapshot", disabled: !name.trim(), onClick: () => {
              onSave(name.trim());
              setName("");
            }, children: "Save current plan" })
          ] }),
          /* @__PURE__ */ jsx13("div", { className: "tbl-wrap", style: { marginTop: 14 }, children: /* @__PURE__ */ jsxs12("table", { className: "data", "data-testid": "snapshots-table", children: [
            /* @__PURE__ */ jsx13("thead", { children: /* @__PURE__ */ jsxs12("tr", { children: [
              /* @__PURE__ */ jsx13("th", { children: "Compare" }),
              /* @__PURE__ */ jsx13("th", { children: "Name" }),
              /* @__PURE__ */ jsx13("th", { children: "Saved" }),
              /* @__PURE__ */ jsx13("th", { children: "Strategy" }),
              /* @__PURE__ */ jsx13("th", { children: "All-in" }),
              /* @__PURE__ */ jsx13("th", { children: "Actions" })
            ] }) }),
            /* @__PURE__ */ jsxs12("tbody", { children: [
              snapshots.map((r) => /* @__PURE__ */ jsxs12("tr", { children: [
                /* @__PURE__ */ jsx13("td", { children: /* @__PURE__ */ jsxs12("label", { className: "switch", style: { justifyContent: "center" }, children: [
                  /* @__PURE__ */ jsx13("input", { type: "checkbox", checked: compareSel.includes(r.slug), onChange: () => toggle(r.slug), "data-testid": "tick-" + r.slug }),
                  /* @__PURE__ */ jsx13("span", { className: "track", "aria-hidden": "true" })
                ] }) }),
                /* @__PURE__ */ jsx13("td", { style: { textAlign: "left", fontWeight: 600 }, children: r.name }),
                /* @__PURE__ */ jsx13("td", { children: dt(r.savedAt) }),
                /* @__PURE__ */ jsx13("td", { children: r.strategy }),
                /* @__PURE__ */ jsx13("td", { children: money(cur, r.allIn) }),
                /* @__PURE__ */ jsx13("td", { children: /* @__PURE__ */ jsxs12("span", { className: "btnbar", children: [
                  /* @__PURE__ */ jsx13("button", { type: "button", className: "btn sm", onClick: () => onLoadSettings(r), children: "Load settings" }),
                  /* @__PURE__ */ jsx13("button", { type: "button", className: "btn sm", onClick: () => downloadText(`${r.slug}.json`, JSON.stringify({ kind: "capacity-run", savedAt: r.savedAt, config: r.config, run: r.run }, null, 2), "application/json"), children: "Download" }),
                  /* @__PURE__ */ jsx13("button", { type: "button", className: "btn sm danger", onClick: () => onDelete(r), children: "Delete" })
                ] }) })
              ] }, r.slug)),
              snapshots.length === 0 && /* @__PURE__ */ jsx13("tr", { children: /* @__PURE__ */ jsx13("td", { colSpan: 6, className: "empty", children: "No snapshots yet \u2014 save the current plan above." }) })
            ] })
          ] }) })
        ]
      }
    ),
    selected.length > 0 && /* @__PURE__ */ jsxs12(Card, { title: "Compare", sub: `${selected.length} snapshot(s) ticked`, hint: "Ticked snapshots compared side by side. Deltas are versus the first ticked snapshot.", children: [
      /* @__PURE__ */ jsx13(TotalsDelta, { runs: selected, cur }),
      /* @__PURE__ */ jsx13("h4", { style: { margin: "18px 0 6px", fontSize: 13 }, children: "Cumulative all-in cost" }),
      /* @__PURE__ */ jsx13(AllInOverlay, { runs: selected, cur }),
      /* @__PURE__ */ jsx13("h4", { style: { margin: "18px 0 6px", fontSize: 13 }, children: "Per-queue comparison (matched by name)" }),
      /* @__PURE__ */ jsx13(PerQueue, { runs: selected, cur })
    ] }),
    /* @__PURE__ */ jsx13(FilesCard, { sim, strategySims: sims, config, activeStrategy, activeViewId, onImportConfig, title: "Excel package & files" })
  ] });
}
function TotalsDelta({ runs, cur }) {
  const { rows, metrics } = totalsDelta(runs);
  const fmt = (k, v) => k === "endPaid" ? num(v, 0) : money(cur, v);
  return /* @__PURE__ */ jsx13("div", { className: "tbl-wrap", children: /* @__PURE__ */ jsxs12("table", { className: "data", "data-testid": "totals-delta", children: [
    /* @__PURE__ */ jsx13("thead", { children: /* @__PURE__ */ jsxs12("tr", { children: [
      /* @__PURE__ */ jsx13("th", { children: "Snapshot" }),
      metrics.map((m) => /* @__PURE__ */ jsx13("th", { children: m.label }, m.key))
    ] }) }),
    /* @__PURE__ */ jsx13("tbody", { children: rows.map((r) => /* @__PURE__ */ jsxs12("tr", { children: [
      /* @__PURE__ */ jsxs12("td", { style: { textAlign: "left", fontWeight: 600 }, children: [
        r.name,
        r.baseline ? " (baseline)" : ""
      ] }),
      metrics.map((m) => /* @__PURE__ */ jsxs12("td", { children: [
        fmt(m.key, r.values[m.key]),
        !r.baseline && /* @__PURE__ */ jsxs12("span", { style: { color: r.deltas[m.key] > 0 ? "var(--red)" : "var(--green)", fontSize: 11, marginLeft: 6 }, children: [
          r.deltas[m.key] > 0 ? "\u25B2" : "\u25BC",
          fmt(m.key, Math.abs(r.deltas[m.key]))
        ] })
      ] }, m.key))
    ] }, r.name)) })
  ] }) });
}
function AllInOverlay({ runs, cur }) {
  const data = allInOverlay(runs);
  return /* @__PURE__ */ jsx13(Chart, { title: "", height: 240, children: (w, h) => /* @__PURE__ */ jsxs12(LineChart3, { width: w, height: h, data, margin: { top: 8, right: 16, left: 8, bottom: 4 }, children: [
    /* @__PURE__ */ jsx13(CartesianGrid4, { strokeDasharray: "3 3", stroke: "#eef2f5" }),
    /* @__PURE__ */ jsx13(XAxis4, { dataKey: "wk", tick: { fontSize: 11 }, interval: "preserveStartEnd", minTickGap: 18 }),
    /* @__PURE__ */ jsx13(YAxis4, { tick: { fontSize: 11 }, width: 52, tickFormatter: (v) => money(cur, v) }),
    /* @__PURE__ */ jsx13(Tooltip4, { formatter: (v) => money(cur, v) }),
    /* @__PURE__ */ jsx13(Legend4, { wrapperStyle: { fontSize: 11 } }),
    runs.map((r, i) => /* @__PURE__ */ jsx13(Line4, { type: "monotone", dataKey: r.slug, name: r.name, stroke: SERIES3[i % SERIES3.length], dot: false, strokeWidth: 2, isAnimationActive: false }, r.slug))
  ] }) });
}
function PerQueue({ runs, cur }) {
  const blocks = perQueueBlocks(runs);
  return /* @__PURE__ */ jsx13("div", { className: "grid", style: { gap: 12 }, "data-testid": "per-queue-compare", children: blocks.map((b) => /* @__PURE__ */ jsxs12("div", { className: "erow", children: [
    /* @__PURE__ */ jsx13("div", { className: "erow-h", children: /* @__PURE__ */ jsx13("strong", { children: b.name }) }),
    /* @__PURE__ */ jsx13("div", { className: "erow-b", children: /* @__PURE__ */ jsx13("div", { className: "tbl-wrap", children: /* @__PURE__ */ jsxs12("table", { className: "data", children: [
      /* @__PURE__ */ jsx13("thead", { children: /* @__PURE__ */ jsxs12("tr", { children: [
        /* @__PURE__ */ jsx13("th", { children: "Snapshot" }),
        /* @__PURE__ */ jsx13("th", { children: "Red wks" }),
        /* @__PURE__ */ jsx13("th", { children: "Avg cover" }),
        /* @__PURE__ */ jsx13("th", { children: "Worst" }),
        /* @__PURE__ */ jsx13("th", { children: "Cost" }),
        /* @__PURE__ */ jsx13("th", { children: "Churn" })
      ] }) }),
      /* @__PURE__ */ jsx13("tbody", { children: b.cells.map((c, i) => /* @__PURE__ */ jsxs12("tr", { children: [
        /* @__PURE__ */ jsx13("td", { style: { textAlign: "left" }, children: c.run.name }),
        c.present ? /* @__PURE__ */ jsxs12(Fragment5, { children: [
          /* @__PURE__ */ jsx13("td", { className: c.redWeeks ? "st-red" : "st-green", children: c.redWeeks }),
          /* @__PURE__ */ jsx13("td", { children: pct(c.avgCover) }),
          /* @__PURE__ */ jsx13("td", { children: c.worst.fmt === "s" ? secs(c.worst.value) : pct(c.worst.value) }),
          /* @__PURE__ */ jsx13("td", { children: money(cur, c.cost) }),
          /* @__PURE__ */ jsx13("td", { children: money(cur, c.churn) })
        ] }) : /* @__PURE__ */ jsx13("td", { colSpan: 5, className: "empty", children: "not in this snapshot" })
      ] }, i)) })
    ] }) }) })
  ] }, b.name)) });
}

// ui/editors/PresetBar.jsx
import { useState as useState12 } from "react";
import { jsx as jsx14, jsxs as jsxs13 } from "react/jsx-runtime";
function PresetBar({ presets, onApply, onSaveAs, applyLabel = "Preset" }) {
  const [pick, setPick] = useState12("");
  const [name, setName] = useState12("");
  return /* @__PURE__ */ jsxs13("div", { className: "rowflex", children: [
    /* @__PURE__ */ jsx14("div", { style: { minWidth: 200 }, children: /* @__PURE__ */ jsx14(
      SelectField,
      {
        label: applyLabel,
        value: pick,
        onChange: (v) => {
          setPick(v);
          const p = presets.find((x) => x.id === v);
          if (p) onApply(p);
        },
        options: [{ value: "", label: "Apply a preset\u2026" }, ...presets.map((p) => ({ value: p.id, label: p.name + (p.builtin ? "" : " \u2605") }))]
      }
    ) }),
    /* @__PURE__ */ jsx14("span", { className: "spacer" }),
    /* @__PURE__ */ jsxs13("label", { className: "field", style: { minWidth: 160 }, children: [
      /* @__PURE__ */ jsx14("span", { className: "lab", children: "Save current as" }),
      /* @__PURE__ */ jsx14("input", { type: "text", value: name, placeholder: "my preset", onChange: (e) => setName(e.target.value) })
    ] }),
    /* @__PURE__ */ jsx14(
      "button",
      {
        type: "button",
        className: "btn sm",
        disabled: !name.trim(),
        onClick: () => {
          onSaveAs(name.trim());
          setName("");
        },
        children: "Save as new"
      }
    )
  ] });
}
function IntradaySliders({ curve, onChange, eng }) {
  const stepMin = eng.intervalMin;
  return /* @__PURE__ */ jsx14("div", { className: "sliders", children: curve.map((v, i) => {
    const mins = eng.dayStart * 60 + i * stepMin;
    const label = String(Math.floor(mins / 60)).padStart(2, "0") + ":" + String(mins % 60).padStart(2, "0");
    return /* @__PURE__ */ jsxs13("div", { className: "slider-cell", children: [
      /* @__PURE__ */ jsx14("span", { className: "val", children: v.toFixed(2) }),
      /* @__PURE__ */ jsx14(
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
      /* @__PURE__ */ jsx14("span", { className: "t", children: label })
    ] }, i);
  }) });
}

// ui/editors/QueuesEditor.jsx
var import_engine8 = __toESM(require_engine());
import { jsx as jsx15, jsxs as jsxs14 } from "react/jsx-runtime";
function HCField({ value, onChange, disabled }) {
  return /* @__PURE__ */ jsxs14("label", { className: "field", children: [
    /* @__PURE__ */ jsxs14("span", { className: "lab", children: [
      "Starting HC ",
      /* @__PURE__ */ jsx15(Hint, { text: "Leave blank to draw a workload-weighted share of the global starting HC (set in Settings)." })
    ] }),
    /* @__PURE__ */ jsx15(
      "input",
      {
        type: "number",
        value: value == null ? "" : value,
        placeholder: "(global share)",
        disabled,
        onChange: (e) => onChange(e.target.value === "" ? null : Number(e.target.value)),
        "data-testid": "hc-input"
      }
    )
  ] });
}
function SupportsEditor({ config, q, ops }) {
  const others = config.queues.filter((x) => x.id !== q.id);
  const inbound = (0, import_engine8.supportersOf)(config, q.id);
  const nameOf = (id) => (config.queues.find((x) => x.id === id) || { name: id }).name;
  return /* @__PURE__ */ jsxs14("div", { children: [
    /* @__PURE__ */ jsxs14("div", { className: "lab", style: { marginBottom: 6, display: "flex", gap: 6, alignItems: "center" }, children: [
      "Supports (outbound) ",
      /* @__PURE__ */ jsx15(Hint, { text: "Queues this one lends spare hours to. Lower priority number = served first; within a tier, spare splits by deficit. Max share caps one recipient's take of this queue's spare." })
    ] }),
    (q.supports || []).length === 0 ? /* @__PURE__ */ jsx15("p", { className: "note", style: { marginBottom: 8 }, children: "Not supporting any queue." }) : /* @__PURE__ */ jsx15("div", { className: "rows", style: { marginBottom: 8 }, children: q.supports.map((s, i) => /* @__PURE__ */ jsxs14("div", { className: "rowflex", children: [
      /* @__PURE__ */ jsx15("span", { style: { minWidth: 130, fontWeight: 600 }, children: nameOf(s.queueId) }),
      /* @__PURE__ */ jsx15("div", { style: { width: 96 }, children: /* @__PURE__ */ jsx15(NumField, { label: "Priority", value: s.priority, min: 1, onChange: (v) => ops.patchSupport(q.id, i, "priority", Math.max(1, v)) }) }),
      /* @__PURE__ */ jsx15("div", { style: { width: 110 }, children: /* @__PURE__ */ jsx15(NumField, { label: "Max share", unit: "%", value: s.maxSharePct == null ? 100 : s.maxSharePct, onChange: (v) => ops.patchSupport(q.id, i, "maxSharePct", v) }) }),
      /* @__PURE__ */ jsx15("button", { type: "button", className: "btn sm danger", style: { alignSelf: "flex-end" }, onClick: () => ops.deleteSupport(q.id, i), children: "Remove" })
    ] }, i)) }),
    /* @__PURE__ */ jsx15(
      SelectField,
      {
        label: "Add a queue to support",
        value: "",
        onChange: (v) => v && ops.addSupport(q.id, v),
        options: [{ value: "", label: "Choose a queue\u2026" }, ...others.filter((x) => !(q.supports || []).some((s) => s.queueId === x.id)).map((x) => ({ value: x.id, label: x.name }))]
      }
    ),
    /* @__PURE__ */ jsx15("div", { className: "lab", style: { margin: "12px 0 4px" }, children: "Supported by (inbound)" }),
    inbound.length ? /* @__PURE__ */ jsx15("div", { className: "rowflex", children: inbound.map((s) => /* @__PURE__ */ jsxs14("span", { className: "pill", children: [
      nameOf(s.queueId),
      " \xB7 pri ",
      s.priority,
      s.maxSharePct != null ? ` \xB7 \u2264${s.maxSharePct}%` : ""
    ] }, s.queueId)) }) : /* @__PURE__ */ jsx15("p", { className: "note", children: "No queue currently supports this one." })
  ] });
}
function QueueCard2({ config, q, ops, intradayPresets, setIntradayPresets, defaultOpen }) {
  const eng = config.engine;
  const supported = q.resourcing === "supported";
  const wf = q.wf, burn = q.burn;
  return /* @__PURE__ */ jsxs14("details", { className: "erow", open: defaultOpen, children: [
    /* @__PURE__ */ jsxs14("summary", { children: [
      /* @__PURE__ */ jsx15("span", { className: "chev", children: "\u25B6" }),
      /* @__PURE__ */ jsx15("strong", { children: q.name }),
      supported && /* @__PURE__ */ jsx15("span", { className: "badge amber", children: "supported" }),
      /* @__PURE__ */ jsx15("span", { className: "spacer" }),
      /* @__PURE__ */ jsxs14("span", { className: "btnbar", onClick: (e) => e.preventDefault(), children: [
        /* @__PURE__ */ jsx15("button", { type: "button", className: "btn sm", onClick: () => ops.duplicateQueue(q.id), children: "Duplicate" }),
        /* @__PURE__ */ jsx15("button", { type: "button", className: "btn sm danger", onClick: () => ops.deleteQueue(q.id), children: "Delete" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs14("div", { className: "erow-b", children: [
      /* @__PURE__ */ jsxs14(Card, { title: "Description", children: [
        /* @__PURE__ */ jsxs14("div", { className: "fieldrow", children: [
          /* @__PURE__ */ jsx15(TextField, { label: "Name", value: q.name, onChange: (v) => ops.patchQueue(q.id, ["name"], v) }),
          /* @__PURE__ */ jsx15(NumField, { label: "Base daily volume", value: q.dailyVolume, onChange: (v) => ops.patchQueue(q.id, ["dailyVolume"], v) }),
          /* @__PURE__ */ jsx15(NumField, { label: "AHT / handle time", unit: "s", value: q.aht, onChange: (v) => ops.patchQueue(q.id, ["aht"], v) })
        ] }),
        q.type === "voice" ? /* @__PURE__ */ jsxs14("div", { className: "fieldrow", children: [
          /* @__PURE__ */ jsx15(NumField, { label: "ASA target", unit: "s", value: q.asaTarget, onChange: (v) => ops.patchQueue(q.id, ["asaTarget"], v) }),
          /* @__PURE__ */ jsx15(NumField, { label: "Max abandon", unit: "%", value: +(q.maxAbandon * 100).toFixed(2), onChange: (v) => ops.patchQueue(q.id, ["maxAbandon"], v / 100) }),
          /* @__PURE__ */ jsx15(NumField, { label: "Patience", unit: "s", value: q.patience, onChange: (v) => ops.patchQueue(q.id, ["patience"], v) })
        ] }) : /* @__PURE__ */ jsxs14("div", { className: "fieldrow", children: [
          /* @__PURE__ */ jsx15(NumField, { label: "Concurrency", value: q.concurrency, onChange: (v) => ops.patchQueue(q.id, ["concurrency"], v) }),
          /* @__PURE__ */ jsx15(NumField, { label: "SLA within", unit: "min", value: q.digitalSlaMinutes, onChange: (v) => ops.patchQueue(q.id, ["digitalSlaMinutes"], v) }),
          /* @__PURE__ */ jsx15(NumField, { label: "SLA target", unit: "%", value: +(q.digitalSlaPct * 100).toFixed(1), onChange: (v) => ops.patchQueue(q.id, ["digitalSlaPct"], v / 100) }),
          /* @__PURE__ */ jsx15(NumField, { label: "Backlog limit", value: q.backlogLimit, onChange: (v) => ops.patchQueue(q.id, ["backlogLimit"], v) }),
          /* @__PURE__ */ jsx15(
            SelectField,
            {
              label: "Deflects to",
              value: q.deflectsTo || "",
              onChange: (v) => ops.patchQueue(q.id, ["deflectsTo"], v || null),
              options: [{ value: "", label: "\u2014 none \u2014" }, ...config.queues.filter((x) => x.type === "voice").map((x) => ({ value: x.id, label: x.name }))]
            }
          )
        ] }),
        /* @__PURE__ */ jsxs14("div", { className: "fieldrow", children: [
          /* @__PURE__ */ jsx15(NumField, { label: "Fully loaded cost", unit: "/yr", value: q.agentCost, onChange: (v) => ops.patchQueue(q.id, ["agentCost"], v) }),
          /* @__PURE__ */ jsx15(NumField, { label: "Shrinkage", unit: "%", value: +(q.shrinkage * 100).toFixed(1), onChange: (v) => ops.patchQueue(q.id, ["shrinkage"], v / 100) })
        ] }),
        /* @__PURE__ */ jsxs14("div", { style: { marginTop: 10 }, children: [
          /* @__PURE__ */ jsx15("div", { className: "lab", style: { marginBottom: 6 }, children: "Arrival pattern" }),
          /* @__PURE__ */ jsx15(
            PresetBar,
            {
              presets: intradayPresets,
              applyLabel: "Intraday preset",
              onApply: (p) => ops.patchQueue(q.id, ["profile"], [...p.curve]),
              onSaveAs: (name) => setIntradayPresets((lib) => [...lib, makeIntradayPreset(name, q.profile)])
            }
          ),
          /* @__PURE__ */ jsx15(IntradaySliders, { curve: q.profile, eng, onChange: (next) => ops.patchQueue(q.id, ["profile"], next) })
        ] })
      ] }),
      /* @__PURE__ */ jsx15(Card, { title: "Resourcing", hint: "Supported queues get no headcount or hiring of their own; they are served only from supporter spare hours and service teams.", children: /* @__PURE__ */ jsxs14("div", { className: "rowflex", children: [
        /* @__PURE__ */ jsx15(
          SelectField,
          {
            label: "Mode",
            value: q.resourcing || "resourced",
            onChange: (v) => ops.setResourcing(q.id, v),
            options: [{ value: "resourced", label: "Resourced" }, { value: "supported", label: "Supported" }]
          }
        ),
        supported && /* @__PURE__ */ jsx15("span", { className: "badge amber", style: { alignSelf: "flex-end", marginBottom: 8 }, children: "supported \u2014 no HC or hiring" })
      ] }) }),
      /* @__PURE__ */ jsxs14(Card, { title: "Workforce", children: [
        /* @__PURE__ */ jsxs14("div", { className: "fieldrow", children: [
          /* @__PURE__ */ jsx15(HCField, { value: supported ? 0 : q.fte, disabled: supported, onChange: (v) => ops.patchQueue(q.id, ["fte"], v) }),
          /* @__PURE__ */ jsx15(NumField, { label: "Attrition", unit: "%/mo", value: +(wf.attrition * 100).toFixed(2), onChange: (v) => ops.patchQueue(q.id, ["wf", "attrition"], v / 100) }),
          /* @__PURE__ */ jsx15(NumField, { label: "Req-to-start", unit: "wk", value: wf.reqToStart, onChange: (v) => ops.patchQueue(q.id, ["wf", "reqToStart"], v) }),
          /* @__PURE__ */ jsx15(NumField, { label: "Training", unit: "wk", value: wf.trainingWeeks, onChange: (v) => ops.patchQueue(q.id, ["wf", "trainingWeeks"], v) })
        ] }),
        /* @__PURE__ */ jsxs14("div", { className: "fieldrow", children: [
          /* @__PURE__ */ jsx15(NumField, { label: "Burnout occ. threshold", unit: "%", value: +(burn.occThreshold * 100).toFixed(0), onChange: (v) => ops.patchQueue(q.id, ["burn", "occThreshold"], v / 100) }),
          /* @__PURE__ */ jsx15(NumField, { label: "Burnout sensitivity", value: burn.sensitivity, step: "0.1", onChange: (v) => ops.patchQueue(q.id, ["burn", "sensitivity"], v) }),
          /* @__PURE__ */ jsx15(NumField, { label: "Max attrition \xD7", value: burn.maxAttritionMult, step: "0.1", onChange: (v) => ops.patchQueue(q.id, ["burn", "maxAttritionMult"], v) })
        ] }),
        /* @__PURE__ */ jsxs14("div", { style: { marginTop: 8 }, children: [
          /* @__PURE__ */ jsxs14("div", { className: "lab", style: { marginBottom: 6, display: "flex", gap: 6, alignItems: "center" }, children: [
            "Manual hires (strategy S4 / manual) ",
            /* @__PURE__ */ jsx15(Hint, { text: "Per-queue requisitions by week \u2014 used by manual-plan strategies, ignoring the cap." }),
            /* @__PURE__ */ jsx15("span", { className: "spacer" }),
            /* @__PURE__ */ jsx15("button", { type: "button", className: "btn sm", onClick: () => ops.addHire(q.id), disabled: supported, children: "+ Add hire" })
          ] }),
          (wf.hires || []).length === 0 ? /* @__PURE__ */ jsx15("p", { className: "note", children: "No manual hires." }) : /* @__PURE__ */ jsx15("div", { className: "rows", children: wf.hires.map((h, hi) => /* @__PURE__ */ jsxs14("div", { className: "rowflex", children: [
            /* @__PURE__ */ jsx15("div", { style: { width: 120 }, children: /* @__PURE__ */ jsx15(NumField, { label: "Week", value: h.week + 1, min: 1, onChange: (v) => ops.patchHire(q.id, hi, "week", Math.max(0, v - 1)) }) }),
            /* @__PURE__ */ jsx15("div", { style: { width: 120 }, children: /* @__PURE__ */ jsx15(NumField, { label: "Heads", value: h.heads, onChange: (v) => ops.patchHire(q.id, hi, "heads", v) }) }),
            /* @__PURE__ */ jsx15("button", { type: "button", className: "btn sm danger", style: { alignSelf: "flex-end" }, onClick: () => ops.deleteHire(q.id, hi), children: "Remove" })
          ] }, hi)) })
        ] })
      ] }),
      /* @__PURE__ */ jsx15(Card, { title: "Interdependencies", children: /* @__PURE__ */ jsx15(SupportsEditor, { config, q, ops }) })
    ] })
  ] });
}
function QueuesEditor({ config, ops, intradayPresets, setIntradayPresets }) {
  const voice = config.queues.filter((q) => q.type === "voice");
  const digital = config.queues.filter((q) => q.type === "digital");
  const section = (label, list) => /* @__PURE__ */ jsxs14("div", { children: [
    /* @__PURE__ */ jsxs14("div", { className: "section-title", children: [
      label,
      " ",
      /* @__PURE__ */ jsx15("span", { className: "pill", children: list.length })
    ] }),
    /* @__PURE__ */ jsx15("div", { className: "rows", children: list.length === 0 ? /* @__PURE__ */ jsxs14("p", { className: "note", children: [
      "No ",
      label.toLowerCase(),
      " queues."
    ] }) : list.map((q, i) => /* @__PURE__ */ jsx15(QueueCard2, { config, q, ops, intradayPresets, setIntradayPresets, defaultOpen: i === 0 }, q.id)) })
  ] });
  return /* @__PURE__ */ jsxs14("div", { className: "grid", style: { gap: 18 }, children: [
    /* @__PURE__ */ jsxs14("div", { className: "btnbar", children: [
      /* @__PURE__ */ jsx15("button", { type: "button", className: "btn primary", onClick: () => ops.addQueue(), children: "+ Add queue" }),
      /* @__PURE__ */ jsxs14("span", { className: "note", style: { padding: "6px 10px" }, children: [
        config.queues.length,
        " queue(s). New queues default to Voice \u2014 change the channel in the card."
      ] })
    ] }),
    section("Voice", voice),
    section("Digital", digital),
    /* @__PURE__ */ jsx15(ServiceTeams, { config, ops })
  ] });
}
function ServiceTeams({ config, ops }) {
  return /* @__PURE__ */ jsxs14("div", { children: [
    /* @__PURE__ */ jsxs14("div", { className: "section-title", children: [
      "Service teams ",
      /* @__PURE__ */ jsx15("span", { className: "pill", children: config.serviceTeams.length }),
      /* @__PURE__ */ jsx15("button", { type: "button", className: "btn sm primary", style: { marginLeft: 10 }, onClick: ops.addServiceTeam, children: "+ Add team" })
    ] }),
    config.serviceTeams.length === 0 ? /* @__PURE__ */ jsx15("p", { className: "note", children: "No service teams." }) : /* @__PURE__ */ jsx15("div", { className: "rows", children: config.serviceTeams.map((t, ti) => /* @__PURE__ */ jsxs14("div", { className: "erow", children: [
      /* @__PURE__ */ jsxs14("div", { className: "erow-h", children: [
        /* @__PURE__ */ jsx15("strong", { children: t.name }),
        /* @__PURE__ */ jsx15("span", { className: "spacer" }),
        /* @__PURE__ */ jsx15("button", { type: "button", className: "btn sm danger", onClick: () => ops.deleteServiceTeam(t.id), children: "Delete" })
      ] }),
      /* @__PURE__ */ jsxs14("div", { className: "erow-b", children: [
        /* @__PURE__ */ jsxs14("div", { className: "fieldrow", children: [
          /* @__PURE__ */ jsx15(TextField, { label: "Name", value: t.name, onChange: (v) => ops.patchServiceTeam(ti, ["name"], v) }),
          /* @__PURE__ */ jsx15(NumField, { label: "Size", value: t.size, onChange: (v) => ops.patchServiceTeam(ti, ["size"], v) }),
          /* @__PURE__ */ jsx15(NumField, { label: "Premium", unit: "%", value: +(t.premiumPct * 100).toFixed(0), onChange: (v) => ops.patchServiceTeam(ti, ["premiumPct"], v / 100) }),
          /* @__PURE__ */ jsx15(NumField, { label: "Proficiency", unit: "%", value: +(t.proficiency * 100).toFixed(0), onChange: (v) => ops.patchServiceTeam(ti, ["proficiency"], v / 100) })
        ] }),
        /* @__PURE__ */ jsxs14("div", { className: "fieldrow", children: [
          /* @__PURE__ */ jsx15(NumField, { label: "Trigger occ.", unit: "%", value: +(t.triggerOccupancy * 100).toFixed(0), onChange: (v) => ops.patchServiceTeam(ti, ["triggerOccupancy"], v / 100) }),
          /* @__PURE__ */ jsx15(NumField, { label: "Max hours", unit: "/wk", value: t.maxHoursPerWeek, onChange: (v) => ops.patchServiceTeam(ti, ["maxHoursPerWeek"], v) }),
          /* @__PURE__ */ jsx15(NumField, { label: "Agent cost", unit: "/yr", value: t.agentCost, onChange: (v) => ops.patchServiceTeam(ti, ["agentCost"], v) })
        ] }),
        /* @__PURE__ */ jsxs14("div", { children: [
          /* @__PURE__ */ jsx15("div", { className: "lab", style: { marginBottom: 6 }, children: "Covers queues" }),
          /* @__PURE__ */ jsx15("div", { className: "rowflex", children: config.queues.map((q) => /* @__PURE__ */ jsxs14("label", { className: "switch", children: [
            /* @__PURE__ */ jsx15("input", { type: "checkbox", checked: (t.coversQueues || []).includes(q.id), onChange: (e) => {
              const cur = t.coversQueues || [];
              ops.patchServiceTeam(ti, ["coversQueues"], e.target.checked ? [...cur, q.id] : cur.filter((id) => id !== q.id));
            } }),
            /* @__PURE__ */ jsx15("span", { className: "track", "aria-hidden": "true" }),
            /* @__PURE__ */ jsx15("span", { children: q.name })
          ] }, q.id)) })
        ] })
      ] })
    ] }, t.id)) })
  ] });
}

// ui/components/ViewsManager.jsx
import { useState as useState13 } from "react";
import { jsx as jsx16, jsxs as jsxs15 } from "react/jsx-runtime";
function ViewsManager({ config, ops }) {
  const [name, setName] = useState13("");
  const enabledIds = config.scenarios.filter((s) => s.enabled).map((s) => s.id);
  return /* @__PURE__ */ jsxs15(
    Card,
    {
      title: "Scenario views",
      hint: "A view is a named set of enabled scenarios. Select one as the active view (top bar) to drive the dashboard, or overlay several on the Strategies tab.",
      right: /* @__PURE__ */ jsxs15("div", { className: "rowflex", children: [
        /* @__PURE__ */ jsx16("input", { type: "text", className: "inp", style: { width: 160 }, placeholder: "new view name", value: name, onChange: (e) => setName(e.target.value) }),
        /* @__PURE__ */ jsx16(
          "button",
          {
            type: "button",
            className: "btn sm primary",
            disabled: !name.trim(),
            onClick: () => {
              ops.addView(name.trim(), enabledIds);
              setName("");
            },
            children: "Save enabled as view"
          }
        )
      ] }),
      children: [
        /* @__PURE__ */ jsxs15("p", { className: "note", style: { marginBottom: 12 }, children: [
          '"Save enabled as view" captures the ',
          enabledIds.length,
          " currently-enabled scenario(s) as a reusable named combination."
        ] }),
        /* @__PURE__ */ jsx16("div", { className: "rows", children: config.views.map((v) => {
          const ids = viewIdsFor(config, v.id);
          const editable = !v.builtin && Array.isArray(v.scenarioIds);
          return /* @__PURE__ */ jsxs15("div", { className: "erow", children: [
            /* @__PURE__ */ jsxs15("div", { className: "erow-h", children: [
              v.builtin ? /* @__PURE__ */ jsx16("span", { className: "pill", children: "built-in" }) : /* @__PURE__ */ jsx16("span", { className: "tag soft", children: "saved" }),
              editable ? /* @__PURE__ */ jsx16(
                "input",
                {
                  type: "text",
                  className: "inp",
                  style: { maxWidth: 240 },
                  value: v.name,
                  "aria-label": "View name",
                  onChange: (e) => ops.renameView(v.id, e.target.value)
                }
              ) : /* @__PURE__ */ jsx16("strong", { children: v.name }),
              /* @__PURE__ */ jsxs15("span", { className: "pill", children: [
                ids.length,
                " scenario(s)"
              ] }),
              /* @__PURE__ */ jsx16("span", { className: "spacer" }),
              !v.builtin && /* @__PURE__ */ jsx16("button", { type: "button", className: "btn sm danger", onClick: () => ops.deleteView(v.id), children: "Delete" })
            ] }),
            /* @__PURE__ */ jsxs15("div", { className: "erow-b", children: [
              v.id === "v_por" && /* @__PURE__ */ jsxs15("p", { className: "note", children: [
                "Tracks the live enabled set \u2014 currently: ",
                enabledIds.length ? config.scenarios.filter((s) => s.enabled).map((s) => s.name).join(", ") : "none",
                "."
              ] }),
              v.id === "v_none" && /* @__PURE__ */ jsx16("p", { className: "note", children: "Always empty \u2014 the baseline with no scenarios applied." }),
              editable && /* @__PURE__ */ jsxs15("div", { className: "rowflex", children: [
                config.scenarios.map((s) => /* @__PURE__ */ jsxs15("label", { className: "switch", children: [
                  /* @__PURE__ */ jsx16(
                    "input",
                    {
                      type: "checkbox",
                      checked: v.scenarioIds.includes(s.id),
                      onChange: (e) => ops.toggleViewScenario(v.id, s.id, e.target.checked)
                    }
                  ),
                  /* @__PURE__ */ jsx16("span", { className: "track", "aria-hidden": "true" }),
                  /* @__PURE__ */ jsx16("span", { children: s.name })
                ] }, s.id)),
                config.scenarios.length === 0 && /* @__PURE__ */ jsx16("span", { className: "note", style: { padding: "6px 10px" }, children: "No scenarios to add." })
              ] })
            ] })
          ] }, v.id);
        }) })
      ]
    }
  );
}

// ui/editors/ScenariosEditor.jsx
import { Fragment as Fragment6, jsx as jsx17, jsxs as jsxs16 } from "react/jsx-runtime";
var TYPE_LABELS = {
  growth: "Growth %/mo",
  launch: "Product launch",
  p1: "P1 incident",
  forecastError: "Forecast error",
  attritionShock: "Attrition shock",
  hiringFreeze: "Hiring freeze",
  reducedTraining: "Reduced training",
  growthManual: "Manual weekly growth",
  freezeManual: "Manual freeze"
};
function WeekGrid({ horizon, value, onToggle, render }) {
  return /* @__PURE__ */ jsx17("div", { className: "rowflex", style: { gap: 4 }, "data-testid": "week-grid", children: Array.from({ length: horizon }, (_, w) => {
    const on = value(w);
    return /* @__PURE__ */ jsxs16("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }, children: [
      /* @__PURE__ */ jsx17(
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
function ScenarioParams({ s, ti, ops, horizon }) {
  const set = (k, v) => ops.patchScenario(ti, ["p", k], v);
  const p = s.p || {};
  switch (s.type) {
    case "growth":
      return /* @__PURE__ */ jsxs16(Fragment6, { children: [
        /* @__PURE__ */ jsx17(NumField, { label: "Rate", unit: "%/mo", value: +(p.rate * 100).toFixed(1), onChange: (v) => set("rate", v / 100) }),
        /* @__PURE__ */ jsx17(NumField, { label: "Stop week", value: p.stopWeek == null ? "" : p.stopWeek + 1, onChange: (v) => set("stopWeek", v ? v - 1 : null), hint: "Optional \u2014 growth holds flat from this week onward. Blank means it compounds to the horizon." })
      ] });
    case "growthManual": {
      const wp = p.weeklyPct || {};
      return /* @__PURE__ */ jsxs16("div", { style: { gridColumn: "1 / -1", width: "100%" }, children: [
        /* @__PURE__ */ jsx17("div", { className: "lab", style: { marginBottom: 6 }, children: "Weekly % overrides \u2014 click a week to override that week's growth, then set its %" }),
        /* @__PURE__ */ jsx17(WeekGrid, { horizon, value: (w) => wp[w] != null, onToggle: (w) => {
          const next = { ...wp };
          if (next[w] != null) delete next[w];
          else next[w] = 0.1;
          set("weeklyPct", next);
        }, render: (w) => /* @__PURE__ */ jsx17(
          "input",
          {
            type: "number",
            className: "inp",
            style: { width: 48, fontSize: 11, padding: "2px 4px" },
            value: +(wp[w] * 100).toFixed(0),
            onChange: (e) => set("weeklyPct", { ...wp, [w]: Number(e.target.value) / 100 }),
            "aria-label": "Week " + (w + 1) + " %"
          }
        ) })
      ] });
    }
    case "freezeManual": {
      const weeks = p.weeks || [];
      return /* @__PURE__ */ jsxs16("div", { style: { gridColumn: "1 / -1", width: "100%" }, children: [
        /* @__PURE__ */ jsx17("div", { className: "lab", style: { marginBottom: 6 }, children: "Tick the weeks with no hiring" }),
        /* @__PURE__ */ jsx17(WeekGrid, { horizon, value: (w) => weeks.includes(w), onToggle: (w) => set("weeks", weeks.includes(w) ? weeks.filter((x) => x !== w) : [...weeks, w].sort((a, b) => a - b)) })
      ] });
    }
    case "launch":
      return /* @__PURE__ */ jsxs16(Fragment6, { children: [
        /* @__PURE__ */ jsx17(NumField, { label: "Ramp", unit: "wk", value: p.ramp, onChange: (v) => set("ramp", v) }),
        /* @__PURE__ */ jsx17(NumField, { label: "Peak uplift", unit: "%", value: +(p.peak * 100).toFixed(0), onChange: (v) => set("peak", v / 100) }),
        /* @__PURE__ */ jsx17(NumField, { label: "Decay", unit: "wk", value: p.decay, onChange: (v) => set("decay", v) })
      ] });
    case "p1":
      return /* @__PURE__ */ jsxs16(Fragment6, { children: [
        /* @__PURE__ */ jsx17(NumField, { label: "Spike", unit: "%", value: +(p.spike * 100).toFixed(0), onChange: (v) => set("spike", v / 100) }),
        /* @__PURE__ */ jsx17(NumField, { label: "Days", value: p.days, min: 1, max: 7, onChange: (v) => set("days", v) })
      ] });
    case "forecastError":
      return /* @__PURE__ */ jsx17(NumField, { label: "Error", unit: "%", value: +(p.error * 100).toFixed(0), onChange: (v) => set("error", v / 100) });
    case "attritionShock":
      return /* @__PURE__ */ jsx17(NumField, { label: "Added attrition", unit: "%/mo", value: +(p.add * 100).toFixed(1), onChange: (v) => set("add", v / 100) });
    case "hiringFreeze":
      return /* @__PURE__ */ jsx17(NumField, { label: "Duration", unit: "wk", value: p.weeks, onChange: (v) => set("weeks", v) });
    case "reducedTraining":
      return /* @__PURE__ */ jsxs16(Fragment6, { children: [
        /* @__PURE__ */ jsx17(NumField, { label: "Cut weeks", value: p.cutWeeks, onChange: (v) => set("cutWeeks", v) }),
        /* @__PURE__ */ jsx17(NumField, { label: "Start prof.", unit: "%", value: +(p.startProficiency * 100).toFixed(0), onChange: (v) => set("startProficiency", v / 100) }),
        /* @__PURE__ */ jsx17(NumField, { label: "Ramp stretch", unit: "\xD7", value: p.stretch, step: "0.05", onChange: (v) => set("stretch", v) }),
        /* @__PURE__ */ jsx17(NumField, { label: "AHT penalty", unit: "%", value: +(p.ahtPenalty * 100).toFixed(0), onChange: (v) => set("ahtPenalty", v / 100) }),
        /* @__PURE__ */ jsx17(NumField, { label: "Repeat uplift", unit: "%", value: +(p.repeatUplift * 100).toFixed(0), onChange: (v) => set("repeatUplift", v / 100) })
      ] });
    default:
      return null;
  }
}
function ScenariosEditor({ config, ops }) {
  return /* @__PURE__ */ jsxs16("div", { className: "grid", style: { gap: 14 }, children: [
    /* @__PURE__ */ jsxs16("div", { className: "btnbar", children: [
      /* @__PURE__ */ jsx17(
        SelectField,
        {
          label: "Add scenario",
          value: "",
          onChange: (v) => v && ops.addScenario(v),
          options: [{ value: "", label: "Choose a type\u2026" }, ...Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))]
        }
      ),
      /* @__PURE__ */ jsxs16("span", { className: "note", style: { padding: "6px 10px", alignSelf: "flex-end" }, children: [
        config.scenarios.filter((s) => s.enabled).length,
        " enabled of ",
        config.scenarios.length,
        "."
      ] })
    ] }),
    /* @__PURE__ */ jsxs16("div", { className: "rows", children: [
      config.scenarios.map((s, ti) => /* @__PURE__ */ jsxs16("div", { className: "erow", children: [
        /* @__PURE__ */ jsxs16("div", { className: "erow-h", children: [
          /* @__PURE__ */ jsx17(Toggle, { checked: s.enabled, onChange: (v) => ops.patchScenario(ti, ["enabled"], v) }),
          /* @__PURE__ */ jsx17("strong", { children: s.name }),
          /* @__PURE__ */ jsx17("span", { className: "pill", children: TYPE_LABELS[s.type] || s.type }),
          s.enabled && /* @__PURE__ */ jsx17("span", { className: "tag soft", children: "enabled" }),
          /* @__PURE__ */ jsx17("span", { className: "spacer" }),
          /* @__PURE__ */ jsx17("button", { type: "button", className: "btn sm danger", onClick: () => ops.deleteScenario(s.id), children: "Delete" })
        ] }),
        /* @__PURE__ */ jsxs16("div", { className: "erow-b", children: [
          /* @__PURE__ */ jsxs16("div", { className: "fieldrow", children: [
            /* @__PURE__ */ jsx17(TextField, { label: "Name", value: s.name, onChange: (v) => ops.patchScenario(ti, ["name"], v) }),
            /* @__PURE__ */ jsx17(NumField, { label: "Start week", value: s.startWeek + 1, min: 1, onChange: (v) => ops.patchScenario(ti, ["startWeek"], Math.max(0, v - 1)) }),
            /* @__PURE__ */ jsx17(
              SelectField,
              {
                label: "Applies to",
                value: s.queueIds === "all" ? "all" : "some",
                onChange: (v) => ops.patchScenario(ti, ["queueIds"], v === "all" ? "all" : []),
                options: [{ value: "all", label: "All queues (global)" }, { value: "some", label: "Specific queues" }],
                hint: "Freeze, attrition shock and reduced training are operation-wide regardless of this setting."
              }
            ),
            /* @__PURE__ */ jsx17(ScenarioParams, { s, ti, ops, horizon: config.engine.horizonWeeks })
          ] }),
          s.queueIds !== "all" && /* @__PURE__ */ jsx17("div", { className: "rowflex", children: config.queues.map((q) => /* @__PURE__ */ jsxs16("label", { className: "switch", children: [
            /* @__PURE__ */ jsx17(
              "input",
              {
                type: "checkbox",
                checked: (s.queueIds || []).includes(q.id),
                onChange: (e) => {
                  const cur = Array.isArray(s.queueIds) ? s.queueIds : [];
                  const next = e.target.checked ? [...cur, q.id] : cur.filter((id) => id !== q.id);
                  ops.patchScenario(ti, ["queueIds"], next);
                }
              }
            ),
            /* @__PURE__ */ jsx17("span", { className: "track", "aria-hidden": "true" }),
            /* @__PURE__ */ jsx17("span", { children: q.name })
          ] }, q.id)) })
        ] })
      ] }, s.id)),
      config.scenarios.length === 0 && /* @__PURE__ */ jsx17("div", { className: "empty", children: "No scenarios. Add one above." })
    ] }),
    /* @__PURE__ */ jsx17(ViewsManager, { config, ops })
  ] });
}

// ui/editors/SeasonalityEditor.jsx
import { Fragment as Fragment7, jsx as jsx18, jsxs as jsxs17 } from "react/jsx-runtime";
function MonthSliders({ months, onChange }) {
  return /* @__PURE__ */ jsx18("div", { className: "fieldrow", children: MONTHS.map((m, i) => /* @__PURE__ */ jsx18("div", { style: { width: 88 }, children: /* @__PURE__ */ jsx18(NumField, { label: m, value: +(months[i] * 100).toFixed(0), unit: "%", onChange: (v) => {
    const next = months.slice();
    next[i] = v / 100;
    onChange(next);
  } }) }, m)) });
}
function SeasonalityEditor({ config, ops, seasonalityPresets, setSeasonalityPresets }) {
  const seas = config.seasonality;
  return /* @__PURE__ */ jsxs17("div", { className: "grid", style: { gap: 14 }, children: [
    /* @__PURE__ */ jsxs17(Card, { title: "System-level seasonality", sub: "applies to every queue", hint: "Multiplier by calendar month, applied from the editable start month across the horizon.", children: [
      /* @__PURE__ */ jsx18("div", { className: "fieldrow", style: { maxWidth: 320, marginBottom: 12 }, children: /* @__PURE__ */ jsx18(
        SelectField,
        {
          label: "Start month",
          value: String(seas.startMonth),
          onChange: (v) => ops.patch(["seasonality", "startMonth"], Number(v)),
          options: MONTHS.map((m, i) => ({ value: String(i), label: m }))
        }
      ) }),
      /* @__PURE__ */ jsx18(
        PresetBar,
        {
          presets: seasonalityPresets,
          applyLabel: "Seasonality preset",
          onApply: (p) => ops.patch(["seasonality", "system"], [...p.months]),
          onSaveAs: (name) => setSeasonalityPresets((lib) => [...lib, makeSeasonalityPreset(name, seas.system)])
        }
      ),
      /* @__PURE__ */ jsx18("hr", { className: "sep", style: { margin: "12px 0" } }),
      /* @__PURE__ */ jsx18(MonthSliders, { months: seas.system, onChange: (next) => ops.patch(["seasonality", "system"], next) })
    ] }),
    /* @__PURE__ */ jsx18("div", { className: "rows", children: config.queues.map((q) => {
      const hasOwn = Array.isArray(q.seasonal);
      return /* @__PURE__ */ jsxs17("details", { className: "erow", children: [
        /* @__PURE__ */ jsxs17("summary", { children: [
          /* @__PURE__ */ jsx18("span", { className: "chev", children: "\u25B6" }),
          /* @__PURE__ */ jsx18("strong", { children: q.name }),
          /* @__PURE__ */ jsx18("span", { className: "pill", children: hasOwn ? "queue overlay active" : "flat (system only)" })
        ] }),
        /* @__PURE__ */ jsxs17("div", { className: "erow-b", children: [
          /* @__PURE__ */ jsxs17("div", { className: "rowflex", children: [
            /* @__PURE__ */ jsx18(
              "button",
              {
                type: "button",
                className: "btn sm",
                onClick: () => ops.patchQueue(q.id, ["seasonal"], hasOwn ? null : new Array(12).fill(1)),
                children: hasOwn ? "Remove queue overlay" : "Add queue overlay"
              }
            ),
            /* @__PURE__ */ jsx18("span", { className: "note", style: { padding: "6px 10px" }, children: "Queue overlay multiplies on top of the system pattern above." })
          ] }),
          hasOwn && /* @__PURE__ */ jsxs17(Fragment7, { children: [
            /* @__PURE__ */ jsx18(
              PresetBar,
              {
                presets: seasonalityPresets,
                applyLabel: "Apply preset to overlay",
                onApply: (p) => ops.patchQueue(q.id, ["seasonal"], [...p.months]),
                onSaveAs: (name) => setSeasonalityPresets((lib) => [...lib, makeSeasonalityPreset(name, q.seasonal)])
              }
            ),
            /* @__PURE__ */ jsx18(MonthSliders, { months: q.seasonal, onChange: (next) => ops.patchQueue(q.id, ["seasonal"], next) })
          ] })
        ] })
      ] }, q.id);
    }) })
  ] });
}

// ui/editors/SettingsEditor.jsx
import { jsx as jsx19, jsxs as jsxs18 } from "react/jsx-runtime";
function SettingsEditor({ config, ops, sim, sims, activeStrategy, activeViewId, onImportConfig }) {
  const eng = config.engine, hir = config.hiring, costs = config.costs, cx = config.cx, loops = config.loops;
  const P = (path, v) => ops.patch(path, v);
  return /* @__PURE__ */ jsxs18("div", { className: "grid", style: { gap: 16 }, children: [
    /* @__PURE__ */ jsxs18("div", { className: "grid cols-2", style: { alignItems: "start" }, children: [
      /* @__PURE__ */ jsxs18(Card, { title: "Engine", children: [
        /* @__PURE__ */ jsxs18("div", { className: "fieldrow", children: [
          /* @__PURE__ */ jsx19(NumField, { label: "Horizon", unit: "wk", value: eng.horizonWeeks, min: 1, onChange: (v) => P(["engine", "horizonWeeks"], Math.max(1, Math.round(v))) }),
          /* @__PURE__ */ jsx19(NumField, { label: "Occupancy ceiling", unit: "%", value: +(eng.occupancyCeiling * 100).toFixed(0), onChange: (v) => P(["engine", "occupancyCeiling"], v / 100), hint: "Maximum sustainable utilisation before requirement is inflated." }),
          /* @__PURE__ */ jsx19(TextField, { label: "Currency", value: eng.currency, onChange: (v) => P(["engine", "currency"], v || "\xA3") })
        ] }),
        /* @__PURE__ */ jsxs18("div", { className: "fieldrow", children: [
          /* @__PURE__ */ jsx19(NumField, { label: "Day start", unit: "h", value: eng.dayStart, onChange: (v) => P(["engine", "dayStart"], v) }),
          /* @__PURE__ */ jsx19(NumField, { label: "Day end", unit: "h", value: eng.dayEnd, onChange: (v) => P(["engine", "dayEnd"], v) }),
          /* @__PURE__ */ jsx19(NumField, { label: "Interval", unit: "min", value: eng.intervalMin, onChange: (v) => P(["engine", "intervalMin"], v) })
        ] }),
        /* @__PURE__ */ jsxs18("div", { className: "fieldrow", children: [
          /* @__PURE__ */ jsx19(NumField, { label: "Days / week", value: eng.daysPerWeek, onChange: (v) => P(["engine", "daysPerWeek"], v) }),
          /* @__PURE__ */ jsx19(NumField, { label: "FTE hrs / day", value: eng.hoursPerFteDay, onChange: (v) => P(["engine", "hoursPerFteDay"], v) }),
          /* @__PURE__ */ jsx19(NumField, { label: "FTE days", value: eng.daysWorkedPerFte, onChange: (v) => P(["engine", "daysWorkedPerFte"], v) }),
          /* @__PURE__ */ jsx19(NumField, { label: "Support prof.", unit: "%", value: +(eng.crossSkillProficiency * 100).toFixed(0), onChange: (v) => P(["engine", "crossSkillProficiency"], v / 100), hint: "Proficiency of a supporter working a supported queue's contacts." })
        ] })
      ] }),
      /* @__PURE__ */ jsxs18(Card, { title: "Global starting HC (\xA714.4)", hint: "Queues left blank in the Workforce section share this pool, weighted by workload (volume \xD7 AHT \xF7 concurrency). Explicit per-queue HC always wins; supported queues are excluded.", children: [
        /* @__PURE__ */ jsx19("div", { className: "fieldrow", children: /* @__PURE__ */ jsxs18("label", { className: "field", children: [
          /* @__PURE__ */ jsx19("span", { className: "lab", children: "Global starting HC" }),
          /* @__PURE__ */ jsx19(
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
        /* @__PURE__ */ jsx19("p", { className: "note", style: { marginTop: 10 }, children: "Set a headcount to distribute across queues with a blank starting HC. Each blank queue receives a share proportional to its workload (volume \xD7 AHT \xF7 concurrency). Leave blank to require every queue to declare its own HC." })
      ] }),
      /* @__PURE__ */ jsxs18(Card, { title: "Hiring & cap", children: [
        /* @__PURE__ */ jsxs18("div", { className: "fieldrow", children: [
          /* @__PURE__ */ jsx19(NumField, { label: "Global cap", unit: "/wk", value: hir.cap, onChange: (v) => P(["hiring", "cap"], v), hint: "Max total requisitions per week across all queues." }),
          /* @__PURE__ */ jsx19(NumField, { label: "Default buffer", unit: "%", value: +(hir.buffer * 100).toFixed(0), onChange: (v) => P(["hiring", "buffer"], v / 100), hint: "Buffer-type strategies without their own bufferPct use this." })
        ] }),
        /* @__PURE__ */ jsxs18("p", { className: "note", style: { marginTop: 10 }, children: [
          "Strategies (incl. schedules) are built on the ",
          /* @__PURE__ */ jsx19("strong", { children: "Strategies" }),
          " tab; pick the active plan in the context bar."
        ] })
      ] }),
      /* @__PURE__ */ jsxs18(Card, { title: "Costs", children: [
        /* @__PURE__ */ jsxs18("div", { className: "fieldrow", children: [
          /* @__PURE__ */ jsx19(NumField, { label: "Manager cost", unit: "/yr", value: costs.managerCost, onChange: (v) => P(["costs", "managerCost"], v) }),
          /* @__PURE__ */ jsx19(NumField, { label: "Manager ratio", unit: "1:n", value: costs.managerRatio, onChange: (v) => P(["costs", "managerRatio"], v) })
        ] }),
        /* @__PURE__ */ jsx19("p", { className: "note", style: { marginTop: 10 }, children: "Per-agent fully-loaded cost is set per queue in Queues." })
      ] }),
      /* @__PURE__ */ jsxs18(Card, { title: "CX economics", hint: "How poor experience converts to churn and lost revenue.", children: [
        /* @__PURE__ */ jsxs18("div", { className: "fieldrow", children: [
          /* @__PURE__ */ jsx19(NumField, { label: "Customer base", value: cx.customerBase, onChange: (v) => P(["cx", "customerBase"], v) }),
          /* @__PURE__ */ jsx19(NumField, { label: "\xA3 per lost customer", value: cx.costPerLostCustomer, onChange: (v) => P(["cx", "costPerLostCustomer"], v) }),
          /* @__PURE__ */ jsx19(NumField, { label: "Repeat uplift", unit: "\xD7", value: cx.repeatUplift, step: "0.1", onChange: (v) => P(["cx", "repeatUplift"], v) })
        ] }),
        /* @__PURE__ */ jsxs18("div", { className: "fieldrow", children: [
          /* @__PURE__ */ jsx19(NumField, { label: "Churn \u2014 abandon", unit: "%", value: +(cx.churnAbandon * 100).toFixed(1), onChange: (v) => P(["cx", "churnAbandon"], v / 100) }),
          /* @__PURE__ */ jsx19(NumField, { label: "Churn \u2014 long wait", unit: "%", value: +(cx.churnWait * 100).toFixed(1), onChange: (v) => P(["cx", "churnWait"], v / 100) }),
          /* @__PURE__ */ jsx19(NumField, { label: "Churn \u2014 digital breach", unit: "%", value: +(cx.churnDigital * 100).toFixed(1), onChange: (v) => P(["cx", "churnDigital"], v / 100) })
        ] })
      ] }),
      /* @__PURE__ */ jsx19(Card, { title: "Endogenous loops", children: /* @__PURE__ */ jsxs18("div", { className: "fieldrow", children: [
        /* @__PURE__ */ jsx19(NumField, { label: "Redial rate", unit: "%", value: +(loops.redial * 100).toFixed(0), onChange: (v) => P(["loops", "redial"], v / 100), hint: "Share of abandoned callers who call back \u2014 fixed point, capped at 4\xD7 base." }),
        /* @__PURE__ */ jsx19(NumField, { label: "Deflection rate", unit: "%", value: +(loops.deflection * 100).toFixed(0), onChange: (v) => P(["loops", "deflection"], v / 100), hint: "Share of over-limit digital backlog that becomes next-day voice volume." })
      ] }) })
    ] }),
    /* @__PURE__ */ jsx19(FilesCard, { sim, strategySims: sims, config, activeStrategy, activeViewId, onImportConfig, title: "Excel package & files (\xA714.8)" }),
    /* @__PURE__ */ jsx19(ModelNotes, {})
  ] });
}
function ModelNotes() {
  return /* @__PURE__ */ jsxs18(Card, { title: "Model notes", sub: "how the engine works, in plain language", children: [
    /* @__PURE__ */ jsx19("h4", { style: { margin: "0 0 6px" }, children: "E1 \u2014 Callers abandon (Erlang A, not Erlang C)" }),
    /* @__PURE__ */ jsx19("p", { style: { marginTop: 0 }, children: "Classic Erlang C assumes callers wait forever, so its predicted waits explode as a queue gets busy. We use Erlang A: some callers abandon, which lightens the load on the agents who remain. The engine solves this self-consistently so the speed-of-answer stays realistic and bounded by caller patience \u2014 matching textbook Erlang C when patience is effectively infinite, and simple flow conservation in deep overload." }),
    /* @__PURE__ */ jsx19("h4", { style: { margin: "16px 0 6px" }, children: "E2 \u2014 Staff follow the requirement curve, not the demand curve" }),
    /* @__PURE__ */ jsx19("p", { style: { marginTop: 0 }, children: "Busy intervals need proportionally fewer agents per call than quiet ones. So the engine computes the agents required in each interval and lays available hours along that shape; coverage becomes one honest number (100% = SLA met everywhere). It's a best-case rostering assumption, stated as such." }),
    /* @__PURE__ */ jsx19("h4", { style: { margin: "16px 0 6px" }, children: "E3 \u2014 Digital is a fluid backlog, not a phone queue" }),
    /* @__PURE__ */ jsx19("p", { style: { marginTop: 0 }, children: "Chat and messaging wait in a backlog that agents handle several at once. The engine models it as a fluid that fills and drains, with the in-SLA share derived from the linear wait ramp within each interval; backlog carries across intervals, days and weeks. Over-limit backlog deflects into next-day voice volume." })
  ] });
}

// ui/App.jsx
import { jsx as jsx20, jsxs as jsxs19 } from "react/jsx-runtime";
var TABS = [
  { id: "summary", label: "Summary" },
  { id: "strategies", label: "Strategies" },
  { id: "plan", label: "Plan" },
  { id: "data", label: "Data" },
  { id: "intraday", label: "Intraday" },
  { id: "queues", label: "Queues" },
  { id: "scenarios", label: "Scenarios" },
  { id: "seasonality", label: "Seasonality" },
  { id: "snapshots", label: "Snapshots" },
  { id: "settings", label: "Settings" }
];
function App() {
  const [config, setConfig] = useState14(() => migrateConfig((0, import_engine9.makeDefaultConfig)()));
  const [tab, setTab] = useState14("summary");
  const [intradayPresets, setIntradayPresets] = useState14(INTRADAY_PRESETS);
  const [seasonalityPresets, setSeasonalityPresets] = useState14(SEASONALITY_PRESETS);
  const ops = useConfigOps(setConfig);
  const [activeStrategyId, setActiveStrategyId] = useState14("S1");
  const [activeViewId, setActiveViewId] = useState14("v_por");
  const [loadedSnapshotName, setLoadedSnapshotName] = useState14(null);
  const stratIdsAll = strategyList(config).map((s) => s.id);
  const safeStrategy = stratIdsAll.includes(activeStrategyId) ? activeStrategyId : stratIdsAll[0] || "S1";
  const viewIds = config.views.map((v) => v.id);
  const safeView = viewIds.includes(activeViewId) ? activeViewId : "v_por";
  const storage = useMemo3(() => makeStorageAdapter(), []);
  const [snapshots, setSnapshots] = useState14([]);
  const [compareSel, setCompareSel] = useState14([]);
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
      const [ip, sp, uv] = await Promise.all([storage.get(KEYS.intraday), storage.get(KEYS.seasonality), storage.get(KEYS.views)]);
      if (!alive) return;
      if (Array.isArray(ip) && ip.length) setIntradayPresets([...INTRADAY_PRESETS, ...ip]);
      if (Array.isArray(sp) && sp.length) setSeasonalityPresets([...SEASONALITY_PRESETS, ...sp]);
      if (Array.isArray(uv) && uv.length) setConfig((c) => ({ ...c, views: [...c.views, ...uv.filter((v) => !c.views.some((x) => x.id === v.id))] }));
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
  useEffect4(() => {
    if (hydrated.current) storage.set(KEYS.views, config.views.filter((v) => !v.builtin));
  }, [config.views, storage]);
  const simSet = useStrategySims(config, safeStrategy, safeView);
  const { activeSim, pending } = simSet;
  const saveSnapshot = useCallback4(async (name) => {
    if (!activeSim) return;
    const rec = makeSavedRun(name, activeSim.config, activeSim);
    await storage.set(KEYS.run(rec.slug), rec);
    const index = await storage.get(KEYS.index) || [];
    await storage.set(KEYS.index, [...index.filter((e) => e.slug !== rec.slug), indexEntry(rec)]);
    setSnapshots((rs) => [...rs.filter((r) => r.slug !== rec.slug), rec]);
    setLoadedSnapshotName(null);
  }, [activeSim, storage]);
  const deleteSnapshot = useCallback4(async (r) => {
    await storage.del(KEYS.run(r.slug));
    const index = await storage.get(KEYS.index) || [];
    await storage.set(KEYS.index, index.filter((e) => e.slug !== r.slug));
    setSnapshots((rs) => rs.filter((x) => x.slug !== r.slug));
    setCompareSel((sel) => sel.filter((s) => s !== r.slug));
  }, [storage]);
  const loadSnapshotSettings = useCallback4((r) => {
    setConfig(migrateConfig(r.config));
    setLoadedSnapshotName(r.name);
    setTab("plan");
  }, []);
  const importConfig = useCallback4((c) => {
    setConfig(migrateConfig(c));
    setLoadedSnapshotName(null);
  }, []);
  const tabProps = {
    simSet,
    activeSim,
    sims: simSet.sims,
    stratIds: simSet.stratIds,
    config,
    ops,
    activeStrategy: safeStrategy,
    activeViewId: safeView,
    onSetActive: setActiveStrategyId,
    onSelectView: setActiveViewId,
    onImportConfig: importConfig,
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
  return /* @__PURE__ */ jsx20(PrintProvider, { children: /* @__PURE__ */ jsxs19("div", { className: "app", children: [
    /* @__PURE__ */ jsxs19("header", { className: "topbar", children: [
      /* @__PURE__ */ jsxs19("div", { className: "brand", children: [
        /* @__PURE__ */ jsx20("span", { className: "mark", children: "C" }),
        /* @__PURE__ */ jsx20("span", { children: "Capacity Simulator" }),
        /* @__PURE__ */ jsx20("small", { children: "call centre planning" })
      ] }),
      /* @__PURE__ */ jsx20("span", { className: "spacer" })
    ] }),
    /* @__PURE__ */ jsx20("nav", { className: "tabs", role: "tablist", "aria-label": "Sections", children: TABS.map((t) => /* @__PURE__ */ jsx20("button", { type: "button", role: "tab", id: "tab-" + t.id, "aria-selected": tab === t.id, "aria-controls": "panel-" + t.id, className: "tab", onClick: () => setTab(t.id), children: t.label }, t.id)) }),
    /* @__PURE__ */ jsx20(
      ContextBar,
      {
        config,
        activeStrategyId: safeStrategy,
        onSetActiveStrategy: setActiveStrategyId,
        activeViewId: safeView,
        onSetActiveView: setActiveViewId,
        ops,
        loadedSnapshotName,
        pending
      }
    ),
    /* @__PURE__ */ jsx20("main", { className: "main", children: TABS.map((t) => /* @__PURE__ */ jsx20("div", { role: "tabpanel", id: "panel-" + t.id, "aria-labelledby": "tab-" + t.id, hidden: tab !== t.id, children: tab === t.id && /* @__PURE__ */ jsx20(TabBody, { id: t.id, ...tabProps }) }, t.id)) })
  ] }) });
}
function TabBody(props) {
  const { id, simSet, activeSim, config, ops } = props;
  switch (id) {
    case "summary":
      return /* @__PURE__ */ jsx20(SummaryTab, { sim: activeSim, sims: simSet.sims, stratIds: simSet.stratIds, config, activeStrategy: props.activeStrategy, activeViewId: props.activeViewId, onSetActive: props.onSetActive });
    case "strategies":
      return /* @__PURE__ */ jsx20(StrategiesTab, { simSet, config, activeStrategy: props.activeStrategy, ops });
    case "plan":
      return /* @__PURE__ */ jsx20(PlanTab, { sim: activeSim, viewLabel: viewName(config, props.activeViewId) });
    case "data":
      return /* @__PURE__ */ jsx20(DataTab, { sim: activeSim, config, activeViewId: props.activeViewId, views: config.views, onSelectView: props.onSelectView });
    case "intraday":
      return /* @__PURE__ */ jsx20(IntradayTab, { sim: activeSim });
    case "queues":
      return /* @__PURE__ */ jsx20(QueuesEditor, { config, ops, intradayPresets: props.intradayPresets, setIntradayPresets: props.setIntradayPresets });
    case "scenarios":
      return /* @__PURE__ */ jsx20(ScenariosEditor, { config, ops });
    case "seasonality":
      return /* @__PURE__ */ jsx20(SeasonalityEditor, { config, ops, seasonalityPresets: props.seasonalityPresets, setSeasonalityPresets: props.setSeasonalityPresets });
    case "snapshots":
      return /* @__PURE__ */ jsx20(
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
          activeViewId: props.activeViewId,
          onImportConfig: props.onImportConfig,
          onSave: props.onSaveSnapshot,
          onDelete: props.onDeleteSnapshot,
          onLoadSettings: props.onLoadSnapshotSettings,
          onRefresh: props.onRefreshSnapshots
        }
      );
    case "settings":
      return /* @__PURE__ */ jsx20(SettingsEditor, { config, ops, sim: activeSim, sims: simSet.sims, activeStrategy: props.activeStrategy, activeViewId: props.activeViewId, onImportConfig: props.onImportConfig });
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
.main { flex: 1; padding: 18px; max-width: 1360px; width: 100%; margin: 0 auto; }
.grid { display: grid; gap: 16px; }
.cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
@media (max-width: 900px) { .cols-2, .cols-3 { grid-template-columns: 1fr; } }

/* ---- card ---- */
.card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); }
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
.ribbon-wrap { overflow-x: auto; scrollbar-width: thin; }
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
.chart { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; }
.chart-h { display: flex; align-items: center; gap: 8px; padding: 11px 14px 6px; }
.chart-h h4 { margin: 0; font-size: 13px; font-weight: 700; }
.chart-b { padding: 4px 8px 10px; overflow-x: auto; }
.recharts-text { font-size: 11px; fill: var(--muted); }
.recharts-cartesian-axis-tick-value { font-size: 11px; }

/* ---- tables ---- */
.tbl-wrap { overflow-x: auto; scrollbar-width: thin; border: 1px solid var(--line); border-radius: var(--radius-s); }
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
`;

// ui/main.jsx
import { jsx as jsx21 } from "react/jsx-runtime";
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
  root.render(/* @__PURE__ */ jsx21(App, {}));
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
