/* =========================================================================
   CALL CENTRE CAPACITY ENGINE
   Pure functions. No React, no DOM. Tested in node, inlined into artifact.
   ========================================================================= */

// ---------- small helpers ----------
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const sum = (a) => a.reduce((s, v) => s + v, 0);
const norm = (a) => { const t = sum(a) || 1; return a.map((v) => v / t); };
const uid = () => Math.random().toString(36).slice(2, 9);

// Default intraday shape: 08:00-20:00 in 30-min steps. Morning peak, lunch dip,
// smaller afternoon peak, evening tail. Normalised at use.
const DEFAULT_PROFILE = [
  0.35, 0.55, 0.85, 1.1, 1.35, 1.45, 1.4, 1.25, 1.05, 0.9, 0.85, 0.95,
  1.15, 1.3, 1.25, 1.1, 0.95, 0.8, 0.7, 0.6, 0.45, 0.35, 0.25, 0.2,
];

// ---------- ERLANG CORE ----------
// Erlang B via the numerically stable inverse recursion:
//   1/B(n,A) = 1 + (n/A) * 1/B(n-1,A),  1/B(0,A) = 1
// A is quantised to 0.05 Erlangs for cache reuse (<0.3% error at typical loads).
const _bCache = new Map();
function erlangB(N, A) {
  if (A <= 0) return 0;
  if (N <= 0) return 1;
  const key = N * 33554432 + Math.round(A * 20); // numeric composite: no string alloc on the hot path
  const hit = _bCache.get(key);
  if (hit !== undefined) return hit;
  let invB = 1;
  for (let n = 1; n <= N; n++) invB = 1 + (invB * n) / A;
  const B = 1 / invB;
  if (_bCache.size < 400000) _bCache.set(key, B);
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

/* Single interval, integer agents. M/M/N+M (Erlang A) via a self-consistent solve.

   Pure Erlang C has no abandonment, so its wait explodes as agents -> offered
   load. Real callers leave instead, which lightens the load, so the wait stays
   bounded. Abandoned calls consume no handle time, so the load actually served
   is Aeff = A*(1-ab). Solve for ab as the fixed point of
       ab = C(N, Aeff) * gamma / (gamma + drain),   gamma = 1/patience,
                                                    drain = (N - Aeff)/AHT
   The residual is strictly decreasing in ab, so bisection is safe.
   A queued caller leaves the queue (served or abandoned) at rate drain + gamma:
       ASA = C / (drain + gamma)                      -- bounded by patience
       SL  = 1 - C + C*[drain/(drain+gamma)]*(1 - e^-(drain+gamma)t)
   As patience -> infinity both collapse to the textbook Erlang C results, and
   in deep overload ab -> 1 - N/A, which is simple flow conservation. */
/* Two-level cache: outer keyed by the (aht, patience, target) parameter set —
   these cluster tightly (per queue), so the resolved inner map is memoised
   across consecutive calls — inner keyed numerically by (N, quantised A). */
const _vCache = new Map();
let _vpSub = null, _vpAht = NaN, _vpPat = NaN, _vpTgt = NaN;
function voiceRaw(N, A, aht, pat, target) {
  if (A <= 0) return { asa: 0, sl: 1, abandon: 0, occ: 0 };
  if (N < 1) return { asa: pat, sl: 0, abandon: 1, occ: 1 };
  if (aht !== _vpAht || pat !== _vpPat || target !== _vpTgt) {
    const pk = aht + "|" + pat + "|" + target;
    let sub = _vCache.get(pk);
    if (!sub) { sub = new Map(); _vCache.set(pk, sub); }
    _vpSub = sub; _vpAht = aht; _vpPat = pat; _vpTgt = target;
  }
  const key = N * 33554432 + Math.round(A * 20);
  const hit = _vpSub.get(key); if (hit) return hit;
  const gamma = 1 / pat;
  const probe = (ab) => {
    const Aeff = A * (1 - ab);
    if (Aeff >= N - 1e-9) return { resid: 1, C: 1, drain: 0, Aeff };
    const C = erlangC(N, Aeff);
    const drain = (N - Aeff) / aht;
    return { resid: (C * gamma) / (gamma + drain) - ab, C, drain, Aeff };
  };
  let lo = 0, hi = 1;
  for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (probe(m).resid > 0) lo = m; else hi = m; }
  const ab = clamp((lo + hi) / 2, 0, 1);
  const e = probe(ab);
  const rate = e.drain + gamma;
  const asa = rate > 0 ? e.C / rate : pat;
  const sl = rate > 0
    ? clamp(1 - e.C + e.C * (e.drain / rate) * (1 - Math.exp(-rate * target)), 0, 1)
    : 0;
  const out = { asa, sl, abandon: ab, occ: clamp(e.Aeff / N, 0, 1) };
  if (_vpSub.size < 300000) _vpSub.set(key, out);
  return out;
}

// Fractional agents: blend the integer results either side (avoids step artefacts).
function voiceInterval(agents, arrivals, intervalSec, aht, pat, target) {
  const A = (arrivals / intervalSec) * aht;
  const lo = Math.floor(agents), hi = Math.ceil(agents);
  if (lo === hi) return voiceRaw(lo, A, aht, pat, target);
  const f = agents - lo;
  const a = voiceRaw(lo, A, aht, pat, target), b = voiceRaw(hi, A, aht, pat, target);
  return {
    asa: a.asa * (1 - f) + b.asa * f,
    sl: a.sl * (1 - f) + b.sl * f,
    abandon: a.abandon * (1 - f) + b.abandon * f,
    occ: a.occ * (1 - f) + b.occ * f,
  };
}

// Smallest integer agent count meeting ASA, abandonment and occupancy ceiling.
// The whole scan is memoised at the same quantisation voiceRaw already uses
// (A to 0.05 Erlangs, plus the scan's start point), so a memo hit returns
// exactly what re-running the scan against the voiceRaw cache would return.
const _raCache = new Map();
let _raSub = null, _raAht = NaN, _raPat = NaN, _raTgt = NaN, _raAb = NaN, _raOcc = NaN;
function requiredAgentsInterval(arrivals, intervalSec, aht, pat, target, maxAband, occCeil) {
  if (arrivals <= 0) return 0;
  const A = (arrivals / intervalSec) * aht;
  if (aht !== _raAht || pat !== _raPat || target !== _raTgt || maxAband !== _raAb || occCeil !== _raOcc) {
    const pk = aht + "|" + pat + "|" + target + "|" + maxAband + "|" + occCeil;
    let sub = _raCache.get(pk);
    if (!sub) { sub = new Map(); _raCache.set(pk, sub); }
    _raSub = sub; _raAht = aht; _raPat = pat; _raTgt = target; _raAb = maxAband; _raOcc = occCeil;
  }
  const start = Math.max(1, Math.ceil(A));
  const key = Math.round(A * 20) * 1048576 + start;
  const memo = _raSub.get(key);
  if (memo !== undefined) return memo;
  let out = Math.ceil(A) + 400;
  for (let N = start; N <= Math.ceil(A) + 400; N++) {
    const r = voiceRaw(N, A, aht, pat, target);
    if (r.asa <= target && r.abandon <= maxAband && r.occ <= occCeil) { out = N; break; }
  }
  if (_raSub.size < 200000) _raSub.set(key, out);
  return out;
}

// ---------- REQUIREMENT CURVES ----------
/* Supply assumption: there is no rostering, so available agent-hours are laid
   out across the day in proportion to the REQUIREMENT curve, not the demand
   curve. This matters: Erlang has strong economies of scale, so a quiet
   interval needs proportionally far more agents than a busy one. A queue
   holding 100% of its required hours therefore meets SLA in every interval;
   one holding 90% is uniformly ~10% short. Coverage = availableHrs / requiredHrs. */
/* The requirement cache is persistent across simulate() calls: the key names
   every input the curve depends on — the profile by identity (profile arrays
   are replaced on edit, never mutated — same invariant as _normCache below),
   plus the numeric parameters. The per-call `cache` argument is retained for
   API compatibility but the persistent cache answers first. */
const _rcCache = new Map();
const _profIds = new WeakMap();
let _profSeq = 0;
function profileId(profile) {
  let id = _profIds.get(profile);
  if (id === undefined) { id = ++_profSeq; _profIds.set(profile, id); }
  return id;
}
function reqCurveVoice(q, volume, eng, cache) {
  const key = "v" + profileId(q.profile) + "|" + Math.round(volume) + "|" + q.aht + "|" + q.asaTarget + "|" + q.maxAbandon + "|" + q.patience + "|" + eng.occupancyCeiling + "|" + eng.intervalMin;
  const hit = _rcCache.get(key); if (hit) return hit;
  const p = norm(q.profile), iSec = eng.intervalMin * 60, iHrs = eng.intervalMin / 60;
  const agents = p.map((share) =>
    requiredAgentsInterval(volume * share, iSec, q.aht, q.patience, q.asaTarget, q.maxAbandon, eng.occupancyCeiling)
  );
  const out = { agents, hours: sum(agents) * iHrs };
  if (_rcCache.size < 100000) _rcCache.set(key, out);
  return out;
}
function reqCurveDigital(q, volume, eng, cache) {
  const key = "d" + profileId(q.profile) + "|" + Math.round(volume) + "|" + q.aht + "|" + q.concurrency + "|" + eng.occupancyCeiling + "|" + eng.intervalMin;
  const hit = _rcCache.get(key); if (hit) return hit;
  const p = norm(q.profile), iSec = eng.intervalMin * 60, iHrs = eng.intervalMin / 60;
  // Async channels queue rather than block, so there is no Erlang scale effect:
  // capacity must simply exceed demand by the occupancy headroom.
  const agents = p.map((share) => (volume * share * q.aht) / (q.concurrency * iSec * eng.occupancyCeiling));
  const out = { agents, hours: sum(agents) * iHrs };
  if (_rcCache.size < 100000) _rcCache.set(key, out);
  return out;
}
const reqCurve = (q, v, eng, cache) => (q.type === "voice" ? reqCurveVoice(q, v, eng, cache) : reqCurveDigital(q, v, eng, cache));

// ---------- DAY MODELS ----------
// Normalised-profile cache, keyed by the profile array object. Profile arrays
// are stable within a config (editors replace the array on change), so entries
// cannot go stale.
const _normCache = new WeakMap();
function normProfile(profile) {
  let n = _normCache.get(profile);
  if (!n) { n = norm(profile); _normCache.set(profile, n); }
  return n;
}

// `lite` skips building the per-interval detail array. Aggregates are
// identical; the simulation only materialises intervals for the day it
// captures for the intraday view. Direct callers get full detail by default.
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
    tv += arrivals; wAsa += r.asa * arrivals; wSl += r.sl * arrivals; wAb += r.abandon * arrivals;
    occN += r.occ * agents; occD += agents;
  }
  return {
    volume: tv, cover,
    asa: tv > 0 ? wAsa / tv : 0,
    sl: tv > 0 ? wSl / tv : 1,
    abandon: tv > 0 ? wAb / tv : 0,
    occ: occD > 0 ? occN / occD : 0,
    byInterval,
  };
}

/* Digital: fluid capacity-vs-demand with concurrency and a carrying backlog.
   Contacts never abandon; they wait. Within an interval, arrivals are uniform,
   so the wait of a contact arriving at time t is (backlog at t)/(service rate).
   Waits therefore run linearly from wStart (t=0) to wEnd (t=end), which gives
   both the mean response and the share inside the response SLA. */
function runDigitalDay(q, volume, productiveHours, startBacklog, eng, rc, lite) {
  const iSec = eng.intervalMin * 60, iMin = eng.intervalMin, iHrs = eng.intervalMin / 60;
  const cover = rc.hours > 0 ? productiveHours / rc.hours : 1;
  const p = normProfile(q.profile);
  let B = startBacklog, tv = 0, inSla = 0, respW = 0, occN = 0, occD = 0;
  const byInterval = lite ? null : [];
  for (let i = 0; i < p.length; i++) {
    const arrivals = volume * p[i];
    const agents = rc.agents[i] * cover;
    const cap = (agents * q.concurrency * iSec) / q.aht;
    const rIn = arrivals / iMin, rOut = cap / iMin;
    let wStart, wEnd, Bend;
    if (rOut <= 1e-9) { Bend = B + arrivals; wStart = wEnd = iMin * 400; }
    else {
      Bend = Math.max(0, B + (rIn - rOut) * iMin);
      wStart = B / rOut; wEnd = Bend / rOut;
    }
    const served = Math.max(0, B + arrivals - Bend);
    const s = q.digitalSlaMinutes;
    const lo = Math.min(wStart, wEnd), hi = Math.max(wStart, wEnd);
    const frac = hi <= s ? 1 : lo >= s ? 0 : (s - lo) / Math.max(1e-9, hi - lo);
    inSla += arrivals * frac; respW += arrivals * ((wStart + wEnd) / 2); tv += arrivals;
    const occ = cap > 0 ? clamp(served / cap, 0, 1) : 1;
    occN += occ * agents; occD += agents;
    if (!lite) byInterval.push({ i, arrivals, agents, req: rc.agents[i], cap, served, backlog: Bend, resp: (wStart + wEnd) / 2, occ });
    B = Bend;
  }
  return {
    volume: tv, cover,
    sl: tv > 0 ? inSla / tv : 1,
    respMin: tv > 0 ? respW / tv : 0,
    endBacklog: B,
    occ: occD > 0 ? occN / occD : 0,
    byInterval,
  };
}

// Productive hours delivered per head per day (before proficiency).
const hoursPerHeadDay = (q, eng) =>
  eng.hoursPerFteDay * (eng.daysWorkedPerFte / eng.daysPerWeek) * (1 - clamp(q.shrinkage, 0, 0.95));

function stretchCurve(curve, startProf, stretch) {
  const n = Math.max(1, Math.round(curve.length * stretch));
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 1 : i / (n - 1);
    out.push(clamp(startProf + (1 - startProf) * t, 0.05, 1));
  }
  return out;
}

const blankAgg = () => ({
  volume: 0, baseVolume: 0, hours: 0, reqHours: 0, svcHours: 0, asaW: 0, slW: 0, abW: 0,
  occW: 0, occDen: 0, respW: 0, redial: 0, deflected: 0, backlog: 0, flexIn: 0, repeatAdd: 0,
  otHours: 0, reclaimedHours: 0, recycledIn: 0, poolIn: 0, leveragedIn: 0,
});
const blankTot = () => ({
  volume: 0, cost: 0, trainCost: 0, waste: 0, churnCost: 0, churnCustomers: 0, paid: 0,
  reqFte: 0, svcHours: 0, trained: 0, inTraining: 0, ramping: 0,
});


// ---------- SEASONALITY ----------
// Week -> calendar month via elapsed days / mean month length. Multiplier =
// system[m] * queue[m]; both default to flat. startMonth 0 = January.
const MONTH_DAYS = 30.44;
const monthOfWeek = (w, startMonth) => (startMonth + Math.floor((w * 7) / MONTH_DAYS)) % 12;
function seasonalMult(w, cfg, q) {
  const m = monthOfWeek(w, cfg.seasonality.startMonth);
  const sys = cfg.seasonality.system[m] ?? 1;
  const qm = (q.seasonal && q.seasonal[m]) ?? 1;
  return sys * qm;
}
const SEASONAL_PRESETS = {
  "Flat": [1,1,1,1,1,1,1,1,1,1,1,1],
  "Retail Christmas": [0.9,0.85,0.9,0.95,1,1,1,1.05,1.1,1.15,1.35,1.5],
  "Summer lull": [1.05,1.05,1.05,1,0.95,0.85,0.8,0.8,0.95,1.05,1.1,1.1],
  "FY-end Q4": [1.2,1.25,1.35,0.95,0.9,0.95,1,1,1,1.05,1.05,1.1],
  "School-term": [1.1,1.1,1.05,1.05,1,0.8,0.75,0.8,1.15,1.1,1.05,0.95],
};

// ---------- STRATEGIES (SPEC §14.1) ----------
// Strategies are config objects: { id, name, baseType, bufferPct?,
// excludedQueueIds?, segments? }. Built-ins S1–S4 stay available even for
// configs that predate the strategies array. A "schedule" strategy is an
// ordered list of segments [{fromWeek, strategyId}] (fromWeek is 1-based,
// matching user-facing week numbers); the segment in force at a week is the
// last one whose fromWeek has been reached. Nested schedules resolve
// recursively with a cycle guard.
const BUILTIN_STRATEGIES = [
  { id: "S1", name: "Meet requirement", baseType: "meet", builtin: true },
  { id: "S2", name: "Buffer above", baseType: "buffer", builtin: true },
  { id: "S3", name: "Forward backfill", baseType: "backfill", builtin: true },
  { id: "S4", name: "Manual plan", baseType: "manual", builtin: true },
];
function strategyById(cfg, id) {
  return ((cfg && cfg.strategies) || []).find((s) => s.id === id)
    || BUILTIN_STRATEGIES.find((s) => s.id === id)
    || null;
}
function strategyAt(cfg, idOrObj, w, seen) {
  const s = typeof idOrObj === "string" ? strategyById(cfg, idOrObj) : idOrObj;
  if (!s) return { id: String(idOrObj), name: String(idOrObj), baseType: "meet" };
  if (s.baseType !== "schedule") return s;
  seen = seen || new Set();
  if (seen.has(s.id)) return { id: s.id, name: s.name, baseType: "meet" };
  seen.add(s.id);
  const segs = [...(s.segments || [])].sort((a, b) => (a.fromWeek || 1) - (b.fromWeek || 1));
  let pick = null;
  for (const seg of segs) if ((seg.fromWeek || 1) <= w + 1) pick = seg;
  if (!pick) pick = segs[0];
  if (!pick) return { id: s.id, name: s.name, baseType: "meet" };
  return strategyAt(cfg, pick.strategyId, w, seen);
}
// True when the strategy is manual in every decision week (cap never applies).
function strategyAllManual(cfg, idOrObj) {
  const H = resolveHorizon(cfg);
  for (let w = 0; w < H; w++) {
    if (strategyAt(cfg, idOrObj, w).baseType !== "manual") return false;
  }
  return true;
}

// ---------- SUPPORT ROUTING (SPEC §14.2–14.3) ----------
// Outbound supports per donor: [{queueId, priority, maxSharePct}]. Configs
// that still carry the old recipient-centric `crossSkill` arrays are migrated
// here: each donor at position i of a recipient's list becomes a supports
// entry {queueId: recipient, priority: i+1, maxSharePct: 100} on that donor,
// unless the donor already declares an explicit route to that recipient.
function effectiveSupports(cfg) {
  const map = {};
  for (const q of cfg.queues) {
    map[q.id] = (q.supports || []).map((s) => ({
      queueId: s.queueId,
      priority: s.priority != null ? s.priority : 1,
      maxSharePct: s.maxSharePct != null ? s.maxSharePct : null,
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
// Inbound derivation: who supports queue qid, sorted by priority.
function supportersOf(cfg, qid) {
  const map = effectiveSupports(cfg);
  const out = [];
  for (const q of cfg.queues) {
    for (const s of map[q.id]) if (s.queueId === qid) out.push({ queueId: q.id, priority: s.priority, maxSharePct: s.maxSharePct });
  }
  return out.sort((a, b) => a.priority - b.priority);
}

// ---------- STARTING HC RESOLUTION (SPEC §14.4) ----------
// Supported queues are forced to 0. Queues with a blank fte share
// (globalStartingHC − Σ explicit) weighted by workload = volume × AHT ÷
// concurrency; explicit per-queue HC always wins.
function resolveStartingHC(cfg) {
  const out = {};
  const blanks = [];
  let explicitSum = 0;
  for (const q of cfg.queues) {
    if (q.resourcing === "supported" || q.resourcing === "unmanned") { out[q.id] = 0; continue; }
    if (q.fte == null || q.fte === "") blanks.push(q);
    else { out[q.id] = q.fte; explicitSum += q.fte; }
  }
  if (blanks.length) {
    const g = cfg.engine.globalStartingHC;
    const pool = g != null ? Math.max(0, g - explicitSum) : 0;
    const wts = blanks.map((q) => (q.dailyVolume * q.aht) / Math.max(1e-9, q.concurrency || 1));
    const tot = sum(wts) || 1;
    blanks.forEach((q, i) => { out[q.id] = pool * (wts[i] / tot); });
  }
  return out;
}

// ---------- R2 SETTINGS & RESOLUTION (SPEC §15–§16) ----------
// Settings are the physics layer. Configs may carry a partial (or no) settings
// block; settingsOf() merges over these defaults so legacy configs behave
// exactly as before R2 (every default that could change legacy numbers is
// either neutral or only engages on deficit paths legacy configs never took).
const R2_DEFAULTS = {
  ot: { maxDailyHours: 2, weeklyCeiling: 10, premium: 1.5, burnoutLoad: 10 },
  training: { weeks: 4, learningCurve: [0.6, 0.75, 0.9, 1.0], shrinkagePct: 0.05 },
  trainingDebt: { accumRate: 20, recoveryRate: 10, maxAhtPenalty: 0.08, maxAttritionMult: 1.5 },
  // Channel knock-on defaults. null = fall through to the legacy loops values
  // (voice repeat ← loops.redial, digital spill ← loops.deflection) so
  // un-migrated configs reproduce their numbers exactly.
  knockOn: {
    voice: { repeatPct: null, spillPct: 0, spillTargetQueue: null },
    digital: { repeatPct: 0, spillPct: null, spillTargetQueue: null },
    support: { repeatPct: 0, spillPct: 0, spillTargetQueue: null },
  },
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
    overCapacityPct: { amber: 0.1, red: 0.2 },
  },
  horizon: { min: 24, max: 78, default: 52 },
};
function mergeDeep(base, over) {
  if (over == null) return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const k of Object.keys(over)) {
    const b = base ? base[k] : undefined, o = over[k];
    out[k] = o != null && typeof o === "object" && !Array.isArray(o) && b != null && typeof b === "object" && !Array.isArray(b)
      ? mergeDeep(b, o) : (o === undefined ? b : o);
  }
  return out;
}
const _settingsCache = new WeakMap();
function settingsOf(cfg) {
  const hit = _settingsCache.get(cfg);
  if (hit && hit.src === cfg.settings) return hit.val;
  const val = mergeDeep(R2_DEFAULTS, cfg.settings || null);
  _settingsCache.set(cfg, { src: cfg.settings, val });
  return val;
}

// §16 horizon bounds: [24, 78], default 52. Forward simulation is prefix-
// invariant, so clamping a shorter request UP never changes the weeks a caller
// reads — it only simulates further.
function resolveHorizon(cfg) {
  const s = settingsOf(cfg).horizon;
  const w = Math.round(cfg.engine.horizonWeeks || s.default);
  return clamp(w, s.min, s.max);
}

const channelOf = (q) => q.channel || (q.type === "voice" ? "voice" : "digital");
const brandFor = (cfg, q) => ((cfg.brands || []).find((b) => b.id === q.brandId) || null);
const channelTemplate = (cfg, q) => ((cfg.channels || {})[channelOf(q)] || null);

// §16 resolution — training params: queue override → brand training profile →
// Settings default. Legacy queues always carry explicit wf values, so this
// resolves to exactly the legacy behaviour for them.
function resolveTraining(cfg, q) {
  const b = brandFor(cfg, q);
  const bt = b && b.training ? b.training : null;
  const s = settingsOf(cfg).training;
  const wf = q.wf || {};
  return {
    trainingWeeks: wf.trainingWeeks != null ? wf.trainingWeeks : (bt && bt.trainingWeeks != null ? bt.trainingWeeks : s.weeks),
    learningCurve: wf.learningCurve != null ? wf.learningCurve : (bt && bt.learningCurve != null ? bt.learningCurve : s.learningCurve),
    trainingShrinkagePct: wf.trainingShrinkagePct != null ? wf.trainingShrinkagePct
      : (bt && bt.trainingShrinkagePct != null ? bt.trainingShrinkagePct : s.shrinkagePct),
  };
}

// §18 knock-on resolution: queue → channel template → Settings channel default
// → legacy loops (exact legacy reproduction when nothing newer is set).
function resolveKnockOn(cfg, q) {
  const ch = channelOf(q);
  const tpl = channelTemplate(cfg, q);
  const sd = settingsOf(cfg).knockOn[ch] || {};
  const tk = (tpl && tpl.knockOn) || {};
  const pick = (qv, tv, sv, legacy) => (qv != null ? qv : tv != null ? tv : sv != null ? sv : legacy);
  return {
    repeatPct: pick(q.repeatPct, tk.repeatPct, sd.repeatPct, ch === "voice" ? cfg.loops.redial : 0),
    spillPct: pick(q.spillPct, tk.spillPct, sd.spillPct, ch === "digital" ? cfg.loops.deflection : 0),
    spillTargetQueue: pick(q.spillTargetQueue, tk.spillTargetQueue, sd.spillTargetQueue, q.deflectsTo || null),
  };
}

// §15 volume profiles: blended AHT = Σ share×aht over ≤6 segments. `shares`
// may override the config shares (scenario share-shifting); both normalise.
function blendedAht(q, shares) {
  const segs = q.volumeProfile && q.volumeProfile.segments;
  if (!segs || !segs.length) return q.aht;
  const sh = shares || segs.map((s) => s.sharePct);
  const tot = sum(sh) || 1;
  let aht = 0;
  for (let i = 0; i < segs.length; i++) aht += (sh[i] / tot) * segs[i].aht;
  return aht;
}

// ---------- SCENARIOS (view-aware) ----------
// §19 unified scenarios: scope kinds all | template (channel) | brand | queues.
function unifiedHits(s, q, cfg) {
  const sc = s.scope;
  if (!sc || sc === "all" || sc.kind === "all") return s.queueIds === "all" || s.queueIds == null || (Array.isArray(s.queueIds) && s.queueIds.includes(q.id));
  if (sc.kind === "template") return channelOf(q) === sc.channel;
  if (sc.kind === "brand") return q.brandId === sc.brandId;
  if (sc.kind === "queues") return (sc.queueIds || []).includes(q.id);
  return false;
}
// manualSeries period key for the scenario's granularity.
function seriesValueAt(s, week, day, cfg) {
  const ser = s.p && s.p.series;
  if (!ser) return undefined;
  let key;
  if (s.granularity === "day") key = week * cfg.engine.daysPerWeek + day;
  else if (s.granularity === "month") key = monthOfWeek(week, cfg.seasonality.startMonth);
  else key = week;
  const v = ser[key] != null ? ser[key] : ser[String(key)];
  return v;
}

function scenarioFor(week, day, q, cfg, activeIds) {
  const out = { volMult: 1, attritionAdd: 0, freeze: false, ahtMult: 1, slaMult: 1, repeatAdd: 0, training: null, profileShares: null, forcedReclaim: 0, headcountStep: 0, tags: null };
  // The growth component is tracked separately so a growthManual entry can
  // override the compounding multiplier for a single week (SPEC §14.5)
  // without disturbing other weeks or the non-growth multipliers.
  let growthMult = 1, manualG = null;
  for (const s of cfg.scenarios) {
    if (!activeIds.has(s.id)) continue;
    const hits = s.type === "unified" ? unifiedHits(s, q, cfg) : (s.queueIds === "all" || (s.queueIds || []).includes(q.id));
    const opWide = s.type === "hiringFreeze" || s.type === "attritionShock" || s.type === "reducedTraining" || s.type === "freezeManual";
    if (!hits && !opWide) continue;
    const w = week - (s.startWeek || 0);
    if (w < 0) continue;

    if (s.type === "unified") {
      // One shape (§19): {tag, parameter, mechanism, granularity, startWeek,
      // stopWeek, scope, p}. step reverts after stopWeek; growthRate compounds
      // and holds flat after stopWeek (legacy growth semantics); manualSeries
      // applies only in listed periods of its granularity.
      const stop = s.stopWeek;
      const inWindow = stop == null || week < stop;
      const mech = s.mechanism || "step";
      const p = s.p || {};
      let v; // the mechanism's value for this (week, day), undefined = inert
      if (mech === "step") v = inWindow ? p.value : undefined;
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
      } else if (param === "aht") { if (v != null) out.ahtMult *= 1 + v; }
      else if (param === "sla") { if (v != null) out.slaMult *= 1 + v; }
      else if (param === "profileShares") {
        if (mech === "manualSeries") { if (v != null) out.profileShares = v; }
        else if (inWindow && p.shares) out.profileShares = p.shares;
      } else if (param === "people") {
        const sub = p.kind;
        if (sub === "attritionDelta") { if (v != null) out.attritionAdd += v; }
        else if (sub === "hiringFreeze") {
          if (mech === "manualSeries") { if (seriesValueAt(s, week, day, cfg)) out.freeze = true; }
          else if (inWindow) out.freeze = true;
        } else if (sub === "trainingShrinkage") { if (v != null && inWindow) out.forcedReclaim = Math.max(out.forcedReclaim, v); }
        else if (sub === "headcountStep") { if (week === (s.startWeek || 0)) out.headcountStep += p.value || 0; }
        else if (sub === "trainingProgramme") {
          // Carries the legacy reduced-training programme exactly (§21 migration
          // preserves numeric behaviour): cohort curve changes + AHT penalty +
          // repeat uplift.
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
      // stopWeek (absolute, same base as startWeek): the multiplier holds flat after it.
      const wEff = s.p.stopWeek != null ? Math.max(0, Math.min(w, s.p.stopWeek - s.startWeek)) : w;
      growthMult *= Math.pow(1 + s.p.rate, wEff / 4.345);
    }
    else if (s.type === "growthManual") {
      // weeklyPct is a sparse map of absolute week → fractional rate; a value
      // replaces the compounding growth multiplier for that week only.
      const v = s.p && s.p.weeklyPct ? (s.p.weeklyPct[week] != null ? s.p.weeklyPct[week] : s.p.weeklyPct[String(week)]) : undefined;
      if (v != null) manualG = (manualG == null ? 1 : manualG) * (1 + v);
    }
    else if (s.type === "freezeManual") { if ((s.p.weeks || []).includes(week)) out.freeze = true; }
    else if (s.type === "launch") {
      const { ramp, peak, decay } = s.p;
      let m = 0;
      if (w < ramp) m = peak * ((w + 1) / ramp);
      else if (w < ramp + decay) m = peak * (1 - (w - ramp) / decay);
      out.volMult *= 1 + Math.max(0, m);
    } else if (s.type === "p1") { if (week === s.startWeek && day < s.p.days) out.volMult *= 1 + s.p.spike; }
    else if (s.type === "forecastError") out.volMult *= 1 + s.p.error;
    else if (s.type === "attritionShock") out.attritionAdd += s.p.add;
    else if (s.type === "hiringFreeze") { if (w < s.p.weeks) out.freeze = true; }
    else if (s.type === "reducedTraining") {
      out.training = s.p;
      out.ahtMult *= 1 + s.p.ahtPenalty;
      out.repeatAdd += s.p.repeatUplift;
    }
  }
  out.volMult *= manualG != null ? manualG : growthMult;
  return out;
}

// §18 brand volume split: a queue with no explicit volume draws its share of
// its brand's volume; shares normalise across the brand's share-based queues.
// Explicit per-queue volumes always win.
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

// Exogenous daily volume for queue q in (week, day): base -> seasonality ->
// growth/events. Endogenous knock-on (repeat/spill) is added by the day loop.
function exogenousVolume(q, week, day, cfg, activeIds, sc) {
  const base = q.weeklyVolumes && q.weeklyVolumes[week] != null ? q.weeklyVolumes[week]
    : q.dailyVolume != null ? q.dailyVolume
    : brandShareVolume(cfg, q, week);
  return base * seasonalMult(week, cfg, q) * (sc || scenarioFor(week, day, q, cfg, activeIds)).volMult;
}

// ---------- SUPPLY PROJECTION (for hiring decisions) ----------
// Effective FTE the queue will field `ahead` weeks from now, from current
// cohorts only: pipeline matures on schedule, attrition erodes trained+ramp.
function projectSupply(state, q, ahead, wkAttr) {
  let trained = state.trained;
  let ramp = state.ramp.map((c) => ({ ...c }));
  let training = state.training.map((c) => ({ ...c }));
  let pipe = state.pipeline.map((c) => ({ ...c }));
  const curve = state.lastCurve || q.wf.learningCurve;
  for (let k = 0; k < ahead; k++) {
    pipe.forEach((c) => (c.left -= 1));
    const started = pipe.filter((c) => c.left <= 0);
    pipe = pipe.filter((c) => c.left > 0);
    started.forEach((c) => training.push({ heads: c.heads, left: c.trainWeeks }));
    training.forEach((c) => (c.left -= 1));
    const grad = training.filter((c) => c.left <= 0);
    training = training.filter((c) => c.left > 0);
    grad.forEach((c) => ramp.push({ heads: c.heads, age: 0 }));
    ramp.forEach((c) => (c.age += 1));
    const done = ramp.filter((c) => c.age >= curve.length);
    ramp = ramp.filter((c) => c.age < curve.length);
    done.forEach((c) => (trained += c.heads));
    const pool = trained + sum(ramp.map((c) => c.heads));
    const leavers = pool * wkAttr;
    const tShare = pool > 0 ? trained / pool : 1;
    trained = Math.max(0, trained - leavers * tShare);
    ramp.forEach((c) => (c.heads *= 1 - wkAttr));
  }
  const effective = trained + sum(ramp.map((c) => c.heads * (curve[c.age] ?? 1)));
  const heads = trained + sum(ramp.map((c) => c.heads));
  return { effective, heads, leaversNext: (trained + sum(ramp.map((c) => c.heads))) * wkAttr };
}

// ---------- HIRING STRATEGIES + GLOBAL CAP ALLOCATOR ----------
// Returns { grants: {qid: heads}, trace } for this week. `strategy` may be a
// strategy id (string, incl. built-ins "S1".."S4") or a strategy object; the
// strategy IN FORCE at this week is resolved here, so a schedule pivots
// mid-horizon while cohorts already in the pipeline simply continue (§14.1).
function decideHiring(cfg, st, w, activeIds, strategy, reqFteAt) {
  const sObj = strategyAt(cfg, strategy, w);
  const excluded = new Set(sObj.excludedQueueIds || []);
  const wants = [];
  for (const q of cfg.queues) {
    if (q.resourcing === "supported" || q.resourcing === "unmanned") continue; // §14.2/§17: never hired for
    if (excluded.has(q.id)) continue;           // §14.1: excluded from this strategy
    const s = st[q.id];
    const sc = scenarioFor(w, 0, q, cfg, activeIds);
    if (sc.freeze) continue;
    const tr = resolveTraining(cfg, q); // §16: queue → brand → settings
    const lead = q.wf.reqToStart + (sc.training ? Math.max(1, tr.trainingWeeks - (sc.training.cutWeeks || 0)) : tr.trainingWeeks);
    const L = w + lead;
    const wkAttr = clamp(q.wf.attrition * (1 + q.wf.attritionGrowth * (w / 4.345)) + sc.attritionAdd, 0, 0.6) / 4.345;
    const proj = projectSupply(s, q, lead, wkAttr);
    let want = 0;
    if (sObj.baseType === "manual") {
      want = (q.wf.hires || []).filter((h) => h.week === w).reduce((a, b) => a + b.heads, 0);
    } else if (sObj.baseType === "backfill") {
      want = proj.leaversNext * 1; // replace the leavers projected for the landing week
    } else {
      const buf = sObj.baseType === "buffer" ? (sObj.bufferPct != null ? sObj.bufferPct : cfg.hiring.buffer) : 0;
      const target = reqFteAt(q, L) * (1 + buf);
      want = Math.max(0, target - proj.effective);
    }
    if (want <= 1e-6) continue;
    // marginal churn cost averted per FTE + earliest projected breach for tie-break
    const rq = Math.max(0.5, reqFteAt(q, L));
    const churnProb = q.type === "voice" ? cfg.cx.churnAbandon : cfg.cx.churnDigital;
    const marginal = (exogenousVolume(q, Math.min(L, resolveHorizon(cfg) - 1), 0, cfg, activeIds) * 7 * churnProb * cfg.cx.costPerLostCustomer) / rq;
    let breachWk = resolveHorizon(cfg);
    for (let f = w; f < Math.min(w + lead + 8, resolveHorizon(cfg)); f++) {
      const p = projectSupply(s, q, f - w, wkAttr);
      if (p.effective < reqFteAt(q, f) * 0.999) { breachWk = f; break; }
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
      week: w, cap: cap === Infinity ? null : cap, want: totalWant,
      grants: Object.fromEntries(Object.entries(grants).map(([k, v]) => [k, +v.toFixed(2)])),
      denied: Object.fromEntries(Object.entries(denied).map(([k, v]) => [k, +v.toFixed(2)])),
      binding: Number.isFinite(cap) && totalWant > cap + 1e-6,
      order: wants.map((x) => x.q.id),
    },
  };
}

// ---------- MAIN SIMULATION ----------
// simulate(cfg, { viewIds, strategy, captureDaily })
function simulate(cfg, opts = {}) {
  // Erlang caches persist across calls: keys fully encode (N, A, aht, patience,
  // target), so entries cannot go stale, and strategy/view variants of the same
  // config reuse ~all of the queueing maths. Size-capped at declaration.
  const eng = cfg.engine;
  const set = settingsOf(cfg);
  const H = resolveHorizon(cfg); // §16: [24, 78] — prefix-invariant, see resolveHorizon
  const strategy = opts.strategy || cfg.hiring.activeStrategy || "S1";
  const activeIds = new Set(opts.viewIds != null ? opts.viewIds : cfg.scenarios.filter((s) => s.enabled).map((s) => s.id));
  const rcCache = new Map();
  const reqFteCache = new Map();
  const reqFteAt = (q, wk) => {
    const w2 = Math.min(wk, H - 1);
    const key = q.id + "|" + w2;
    if (reqFteCache.has(key)) return reqFteCache.get(key);
    const vol = exogenousVolume(q, w2, 0, cfg, activeIds);
    // Hiring targets track the blended base AHT (§18 profiles) but, as before
    // R2, not transient scenario AHT multipliers.
    const bAht = blendedAht(q, null);
    const rq = bAht !== q.aht ? { ...q, aht: bAht } : q;
    const hrs = reqCurve(rq, vol, eng, rcCache).hours;
    const fte = hrs / Math.max(0.01, hoursPerHeadDay(q, eng));
    reqFteCache.set(key, fte);
    return fte;
  };

  // §14.2/§14.4: supported/unmanned queues start (and stay) at 0 HC; blank-HC
  // queues receive workload-weighted shares of the global pool. §14.3/§17: the
  // support topology (with the crossSkill shim applied) is static per config.
  const startHC = resolveStartingHC(cfg);
  const supportsMap = effectiveSupports(cfg);
  const knMap = {};
  for (const q of cfg.queues) knMap[q.id] = resolveKnockOn(cfg, q);
  const st = {};
  for (const q of cfg.queues) {
    st[q.id] = {
      trained: startHC[q.id], ramp: [], training: [], pipeline: [], burnout: 0, backlog: 0,
      deflectIn: 0, repeatNext: 0, cumChurn: 0, lastCurve: resolveTraining(cfg, q).learningCurve,
      trainingDebt: 0, otStreak: 0,
    };
  }
  const weeks = [], allocTrace = [];
  const svcUsed = {};
  const isReceiver = (q) => channelOf(q) === "support" || q.resourcing === "unmanned" || q.resourcing === "supported";
  const isAutoDonor = (q) => q.resourcing === "leveraged"; // §17: dedicated never donate; explicit routes/pools still apply

  for (let w = 0; w < H; w++) {
    // ---- 1. workforce ages one week ----
    for (const q of cfg.queues) {
      const s = st[q.id];
      const sc = scenarioFor(w, 0, q, cfg, activeIds);
      const tr = resolveTraining(cfg, q); // §16: queue → brand profile → settings
      const curve = sc.training ? stretchCurve(tr.learningCurve, sc.training.startProficiency, sc.training.stretch) : tr.learningCurve;
      // §19 people.headcountStep: one-off trained-head adjustment at its start week.
      if (sc.headcountStep) s.trained = Math.max(0, s.trained + sc.headcountStep);
      s.pipeline.forEach((c) => (c.left -= 1));
      const started = s.pipeline.filter((c) => c.left <= 0);
      s.pipeline = s.pipeline.filter((c) => c.left > 0);
      started.forEach((c) => s.training.push({ heads: c.heads, left: c.trainWeeks }));
      s.training.forEach((c) => (c.left -= 1));
      const graduated = s.training.filter((c) => c.left <= 0);
      s.training = s.training.filter((c) => c.left > 0);
      graduated.forEach((c) => s.ramp.push({ heads: c.heads, age: 0 }));
      s.ramp.forEach((c) => (c.age += 1));
      const done = s.ramp.filter((c) => c.age >= curve.length);
      s.ramp = s.ramp.filter((c) => c.age < curve.length);
      done.forEach((c) => (s.trained += c.heads));
      const bMult = 1 + (s.burnout / 100) * (q.burn.maxAttritionMult - 1);
      // §17 rung 3: training debt lifts attrition, up to ×maxAttritionMult at 100.
      const dMult = 1 + (s.trainingDebt / 100) * (set.trainingDebt.maxAttritionMult - 1);
      const monthly = q.wf.attrition * (1 + q.wf.attritionGrowth * (w / 4.345)) + sc.attritionAdd;
      const wk = clamp(monthly, 0, 0.6) / 4.345 * bMult * dMult;
      const pool = s.trained + sum(s.ramp.map((c) => c.heads));
      const leavers = pool * wk;
      const tShare = pool > 0 ? s.trained / pool : 1;
      s.trained = Math.max(0, s.trained - leavers * tShare);
      s.ramp.forEach((c) => (c.heads *= 1 - wk));
      s.lastLeavers = leavers;
      s.lastCurve = curve;
      s.wkAttr = wk;
      // §17 rung 2/3 weekly budgets, from this week's ACTIVE heads.
      const heads = s.trained + sum(s.ramp.map((c) => c.heads));
      s.otWeeklyCap = Math.min(set.ot.maxDailyHours * eng.daysWorkedPerFte, set.ot.weeklyCeiling) * heads;
      s.otLeft = s.otWeeklyCap;
      s.otHeads = heads;
      s.reclaimShrink = Math.min(tr.trainingShrinkagePct, q.shrinkage || 0);
    }
    // ---- 1b. hiring decision under the global cap ----
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

    // ---- 2. run each day ----
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
        let prof = s.trained;
        for (let i = 0; i < s.ramp.length; i++) prof += s.ramp[i].heads * (s.lastCurve[s.ramp[i].age] ?? 1);
        const absence = (s.burnout / 100) * q.burn.absenceUplift;
        s.dayProf = prof;
        hrs[q.id] = prof * eng.hoursPerFteDay * (eng.daysWorkedPerFte / eng.daysPerWeek) * clamp(1 - q.shrinkage - absence, 0.02, 1);
        exo[q.id] = exogenousVolume(q, w, d, cfg, activeIds, sc);
        // §18 knock-on inflows: spill from other queues + own repeats, landed next day.
        vol[q.id] = exo[q.id] + s.deflectIn + s.repeatNext;
        s.deflectIn = 0; s.repeatNext = 0;
      }
      for (const q of cfg.queues) {
        const s = st[q.id], sc = scq[q.id];
        // §16/§18/§19: AHT in effect = blended profile AHT × scenario AHT ×
        // training-debt penalty; SLA in effect = targets × scenario SLA shift.
        const debtAht = 1 + (s.trainingDebt / 100) * set.trainingDebt.maxAhtPenalty;
        const effAht = blendedAht(q, sc.profileShares) * sc.ahtMult * debtAht;
        const slaM = sc.slaMult;
        const eq = (effAht !== q.aht || slaM !== 1)
          ? { ...q, aht: effAht, asaTarget: q.asaTarget * slaM, digitalSlaMinutes: q.digitalSlaMinutes * slaM }
          : q;
        rc[q.id] = reqCurve(eq, vol[q.id], eng, rcCache);
        req[q.id] = rc[q.id].hours;
        s.eq = eq;
        if (d === 0) { s.wkAht = effAht; s.wkSla = q.type === "voice" ? eq.asaTarget : eq.digitalSlaMinutes; s.wkSlaMult = slaM; s.wkTags = sc.tags; }
      }
      /* §17 rungs 2–3 — own overtime, then training reclaim, strictly in that
         order and only against the queue's OWN deficit. OT: hard cap 2 h/agent/
         day AND the weekly ceiling; hours cost premium and feed burnout.
         Reclaim: convert up to trainingShrinkagePct of scheduled hours back to
         service; the reclaimed share accrues training debt. A §19
         people.trainingShrinkage scenario forces reclaim regardless of deficit. */
      for (const q of cfg.queues) {
        const s = st[q.id], sc = scq[q.id];
        const a = agg[q.id];
        let deficit = Math.max(0, req[q.id] - hrs[q.id]);
        if (deficit > 1e-9 && s.otLeft > 1e-9 && s.otHeads > 1e-9) {
          const ot = Math.min(deficit, set.ot.maxDailyHours * s.otHeads, s.otLeft);
          hrs[q.id] += ot; s.otLeft -= ot; a.otHours += ot;
          deficit -= ot;
        }
        const reclaimCapDay = s.reclaimShrink * s.dayProf * eng.hoursPerFteDay * (eng.daysWorkedPerFte / eng.daysPerWeek);
        s.reclaimLeftDay = reclaimCapDay;
        if (reclaimCapDay > 1e-9) {
          const forced = (sc.forcedReclaim || 0) * reclaimCapDay;
          const wanted = Math.max(forced, Math.min(deficit, reclaimCapDay));
          if (wanted > 1e-9) {
            hrs[q.id] += wanted; a.reclaimedHours += wanted;
            s.reclaimLeftDay = reclaimCapDay - wanted;
          }
        }
        s.reclaimCapDay = reclaimCapDay;
      }
      /* §14.3 support routing — donor-centric, tiered. Each donor walks its
         outbound routes by priority tier; within a tier its spare splits
         proportionally to the recipients' remaining deficits, each recipient
         bounded by its need and by maxSharePct × the donor's INITIAL spare
         today. A cap-saturated recipient's forgone share redistributes within
         the tier; whatever a tier leaves flows to the next. A donor never
         drops below its own requirement (it only ever gives from spare). */
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
          const rec = outs
            .filter((o) => o.priority === tier && st[o.queueId] && deficit[o.queueId] > 1e-9)
            .map((o) => ({
              qid: o.queueId,
              need: deficit[o.queueId] / prof, // in donor-hours
              cap: o.maxSharePct != null ? (o.maxSharePct / 100) * S0 : Infinity,
              taken: 0,
            }));
          let avail = spare[donor.id];
          for (let guard = 0; guard < rec.length + 2 && avail > 1e-9; guard++) {
            const act = rec.filter((r) => Math.min(r.need, r.cap) - r.taken > 1e-9);
            if (!act.length) break;
            const totNeed = act.reduce((a, r) => a + (r.need - r.taken), 0);
            let gave = 0;
            for (const r of act) {
              const give = Math.min(Math.min(r.need, r.cap) - r.taken, avail * ((r.need - r.taken) / totNeed));
              r.taken += give; gave += give;
            }
            avail -= gave;
            if (gave <= 1e-9) break;
          }
          for (const r of rec) {
            if (r.taken <= 1e-9) continue;
            spare[donor.id] -= r.taken; hrs[donor.id] -= r.taken;
            const recv = r.taken * prof;
            hrs[r.qid] += recv;
            deficit[r.qid] = Math.max(0, deficit[r.qid] - recv);
            agg[r.qid].flexIn += recv;
          }
        }
      }
      /* §17 rung 4b — automatic intra-brand recycling. Non-dedicated donors'
         genuine spare flows to same-brand support-channel and unmanned queues
         in deficit, ordered by the RECEIVING queues' priority numbers,
         proportional (to deficit) within a priority tier. Explicit dependency
         routes were already honoured above; dedicated queues never auto-donate. */
      const fillProRata = (avail, recs) => {
        // recs: [{qid, need (donor-hours), taken}] — proportional to remaining
        // need, capped at need; returns total given.
        let given = 0;
        for (let guard = 0; guard < recs.length + 2 && avail - given > 1e-9; guard++) {
          const act = recs.filter((r) => r.need - r.taken > 1e-9);
          if (!act.length) break;
          const tot = act.reduce((x, r) => x + (r.need - r.taken), 0);
          let pass = 0;
          for (const r of act) {
            const give = Math.min(r.need - r.taken, (avail - given) * ((r.need - r.taken) / tot));
            r.taken += give; pass += give;
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
          const recs = recvs.filter((r) => (r.priority != null ? r.priority : 999) === tier && deficit[r.id] > 1e-9)
            .map((r) => ({ qid: r.id, need: deficit[r.id] / prof, taken: 0 }));
          fillProRata(spare[donor.id], recs);
          for (const r of recs) {
            if (r.taken <= 1e-9) continue;
            spare[donor.id] -= r.taken; hrs[donor.id] -= r.taken;
            const recv = r.taken * prof;
            hrs[r.qid] += recv; deficit[r.qid] = Math.max(0, deficit[r.qid] - recv);
            agg[r.qid].recycledIn += recv;
          }
        }
      }
      /* §17 rung 5 — pools. Members' spare (× their committed sharePct)
         aggregates; when joint demand exceeds it, donor members may top the
         pool up from their remaining training-reclaim capacity (rung-3
         mechanics, their own debt). Recipients share pro-rata by deficit — no
         priorities. Donors never drop below their own requirement. */
      for (const pool of cfg.pools || []) {
        const members = (pool.members || []).map((m) => ({ m, q: cfg.queues.find((x) => x.id === m.queueId) })).filter((x) => x.q);
        const recs = members.filter((x) => deficit[x.q.id] > 1e-9)
          .map((x) => ({ qid: x.q.id, need: deficit[x.q.id] / prof, taken: 0 }));
        if (!recs.length) continue;
        const donors = members.filter((x) => spare[x.q.id] > 1e-9 && deficit[x.q.id] <= 1e-9)
          .map((x) => ({ qid: x.q.id, avail: spare[x.q.id] * clamp((x.m.sharePct != null ? x.m.sharePct : 100) / 100, 0, 1), fed: 0 }));
        let avail = donors.reduce((a, x) => a + x.avail, 0);
        const demand = recs.reduce((a, r) => a + r.need, 0);
        if (demand > avail + 1e-9) {
          // training feed, member (FCFS) order, capped at remaining reclaim capacity
          let shortfall = demand - avail;
          for (const x of donors) {
            if (shortfall <= 1e-9) break;
            const s2 = st[x.qid];
            const feed = Math.min(shortfall, Math.max(0, s2.reclaimLeftDay || 0));
            if (feed > 1e-9) { x.fed = feed; s2.reclaimLeftDay -= feed; agg[x.qid].reclaimedHours += feed; avail += feed; shortfall -= feed; }
          }
        }
        const given = fillProRata(avail, recs);
        if (given <= 1e-9) continue;
        // recipients first…
        for (const r of recs) {
          if (r.taken <= 1e-9) continue;
          const recv = r.taken * prof;
          hrs[r.qid] += recv; deficit[r.qid] = Math.max(0, deficit[r.qid] - recv);
          agg[r.qid].poolIn += recv;
        }
        // …then charge donors: spare first (reduces their hours), feed already booked.
        let toCharge = given - donors.reduce((a, x) => a + x.fed, 0);
        for (const x of donors) {
          if (toCharge <= 1e-9) break;
          const take = Math.min(toCharge, x.avail, spare[x.qid]);
          if (take > 1e-9) { spare[x.qid] -= take; hrs[x.qid] -= take; toCharge -= take; }
        }
      }
      /* §17 rung 6 — leveraged pull (sacrifice). Leveraged queues surrender
         capacity up to their weekly cap to their declared targets even when it
         hurts them — they can drop below their own requirement (never below
         zero) and their SLA RAGs honestly. */
      for (const L of cfg.queues) {
        if (L.resourcing !== "leveraged" || !L.leverage) continue;
        const lev = L.leverage;
        const sL = st[L.id];
        if (sL.levLeft == null || d === 0) sL.levLeft = lev.capHoursPerWeek != null ? lev.capHoursPerWeek : Infinity;
        if (sL.levLeft <= 1e-9 || hrs[L.id] <= 1e-9) continue;
        let targets;
        if (lev.targets === "priority-above") {
          // §17: "anything-above-in-priority" — priorities are global, and the
          // explicit-list form pulls cross-brand, so this is not brand-scoped.
          const myPri = L.priority != null ? L.priority : 999;
          targets = cfg.queues.filter((x) => x.id !== L.id && (x.priority != null ? x.priority : 999) < myPri);
        } else targets = (Array.isArray(lev.targets) ? lev.targets : [lev.targets]).map((id) => cfg.queues.find((x) => x.id === id)).filter(Boolean);
        const recs = targets.filter((x) => deficit[x.id] > 1e-9).map((x) => ({ qid: x.id, need: deficit[x.id] / prof, taken: 0 }));
        if (!recs.length) continue;
        const avail = Math.min(sL.levLeft, hrs[L.id]);
        const given = fillProRata(avail, recs);
        if (given <= 1e-9) continue;
        sL.levLeft -= given; hrs[L.id] -= given;
        spare[L.id] = Math.max(0, hrs[L.id] - req[L.id]);
        deficit[L.id] = Math.max(0, req[L.id] - hrs[L.id]);
        for (const r of recs) {
          if (r.taken <= 1e-9) continue;
          const recv = r.taken * prof;
          hrs[r.qid] += recv; deficit[r.qid] = Math.max(0, deficit[r.qid] - recv);
          agg[r.qid].leveragedIn += recv;
        }
      }
      // Legacy service teams (un-migrated configs only; §21 converts them to
      // leveraged support queues). Frozen behaviour, previews in lite mode.
      for (const t of cfg.serviceTeams) {
        const poolWeekHrs = t.size * t.maxHoursPerWeek * t.proficiency;
        let left = Math.max(0, poolWeekHrs - (svcUsed[t.id] || 0));
        const cand = (t.coversQueues || []).map((id) => cfg.queues.find((q) => q.id === id)).filter(Boolean)
          .map((q) => {
            const preview = q.type === "voice"
              ? runVoiceDay(st[q.id].eq, vol[q.id], hrs[q.id], eng, rc[q.id], true)
              : runDigitalDay(st[q.id].eq, vol[q.id], hrs[q.id], st[q.id].backlog, eng, rc[q.id], true);
            return { q, deficit: Math.max(0, req[q.id] - hrs[q.id]), occ: preview.occ };
          })
          .filter((c) => c.deficit > 0 && c.occ >= t.triggerOccupancy)
          .sort((a, b) => b.deficit - a.deficit);
        for (const c of cand) {
          if (left <= 0) break;
          const give = Math.min(left, c.deficit, poolWeekHrs / eng.daysPerWeek);
          hrs[c.q.id] += give; left -= give;
          svcUsed[t.id] = (svcUsed[t.id] || 0) + give;
          agg[c.q.id].svcHours += give;
        }
      }
      const dayRes = {};
      for (const q of cfg.queues) {
        if (q.type !== "digital") continue;
        const s = st[q.id];
        const kn = knMap[q.id];
        // Day-memo: a day's result is a pure function of (volume, hours, AHT/
        // SLA in effect, start backlog). Days 1–6 of a steady week reuse day
        // 0's computation exactly; any input change misses. Day 0 always
        // computes fresh (it carries the intraday detail).
        let r;
        const m = s.dm;
        if (d !== 0 && m && m.vol === vol[q.id] && m.hrs === hrs[q.id] && m.aht === s.eq.aht && m.slaMin === s.eq.digitalSlaMinutes && m.backlog0 === s.backlog) {
          r = m.r;
        } else {
          r = runDigitalDay(s.eq, vol[q.id], hrs[q.id], s.backlog, eng, rc[q.id], d !== 0);
          s.dm = { vol: vol[q.id], hrs: hrs[q.id], aht: s.eq.aht, slaMin: s.eq.digitalSlaMinutes, backlog0: s.backlog, r };
        }
        // §18 spill: over-limit backlog overflows to the spill target next day
        // (legacy digital deflection, generalised — rate/target resolved).
        let deflected = 0;
        const excess = Math.max(0, r.endBacklog - q.backlogLimit);
        if (excess > 0) { deflected = excess * kn.spillPct; s.backlog = r.endBacklog - deflected; }
        else s.backlog = r.endBacklog;
        if (deflected > 0 && kn.spillTargetQueue && st[kn.spillTargetQueue]) st[kn.spillTargetQueue].deflectIn += deflected;
        // §18 repeat: SLA-breached contacts re-contact next day (rate resolved;
        // legacy digital default 0).
        let repeats = 0;
        if (kn.repeatPct > 0) { repeats = r.volume * (1 - r.sl) * kn.repeatPct; s.repeatNext += repeats; }
        dayRes[q.id] = { ...r, deflected, repeats };
      }
      for (const q of cfg.queues) {
        if (q.type !== "voice") continue;
        const kn = knMap[q.id];
        const s = st[q.id];
        // Same day-memo as digital (voice has no backlog carry, so the key is
        // just volume / hours / AHT / ASA-target in effect).
        let r = null, redial = 0, curve = rc[q.id], iters = 0;
        const m = s.vm;
        if (d !== 0 && m && m.vol === vol[q.id] && m.hrs === hrs[q.id] && m.aht === s.eq.aht && m.asaT === s.eq.asaTarget) {
          r = m.r; redial = m.redial; iters = m.iters; curve = m.curve;
        } else {
          let v = vol[q.id];
          for (let k = 0; k < 3; k++) {
            iters = k + 1;
            const vc = Math.min(v, vol[q.id] * 4);
            curve = reqCurve(s.eq, vc, eng, rcCache);
            r = runVoiceDay(s.eq, vc, hrs[q.id], eng, curve, d !== 0);
            const nr = r.volume * r.abandon * kn.repeatPct;
            if (Math.abs(nr - redial) < 0.5) { redial = nr; break; }
            redial = nr;
            v = vol[q.id] + redial;
          }
          s.vm = { vol: vol[q.id], hrs: hrs[q.id], aht: s.eq.aht, asaT: s.eq.asaTarget, r, redial, iters, curve };
        }
        req[q.id] = curve.hours; rc[q.id] = curve;
        // §18 voice spill: a share of abandoned callers lands on the spill
        // target next day (legacy default 0).
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
        a.volume += v; a.baseVolume += exo[q.id];
        a.hours += hrs[q.id]; a.reqHours += req[q.id];
        a.slW += r.sl * v; a.occW += r.occ * v; a.occDen += v;
        a.repeatAdd = sc.repeatAdd;
        if (q.type === "voice") { a.asaW += r.asa * v; a.abW += r.abandon * v; a.redial += r.redial || 0; a.deflected += r.deflected || 0; }
        else { a.respW += r.respMin * v; a.redial += r.repeats || 0; a.deflected += r.deflected || 0; a.backlog = st[q.id].backlog; }
      }
      if (d === 0) firstDayIntraday = { hrs: { ...hrs }, vol: { ...vol }, res: dayRes };
      if (opts.captureDaily) dayTrace.push(Object.fromEntries(cfg.queues.map((q) => [q.id, { vol: vol[q.id], deflected: dayRes[q.id].deflected || 0, redial: dayRes[q.id].redial || 0, backlog: q.type === "digital" ? st[q.id].backlog : 0 }])));
    }

    // ---- 3. weekly rollup ----
    const wk = { week: w, queues: {}, totals: blankTot() };
    for (const q of cfg.queues) {
      const s = st[q.id], a = agg[q.id];
      const V = a.volume || 1;
      const asa = a.asaW / V, sl = a.slW / V, ab = a.abW / V, occ = a.occDen > 0 ? a.occW / a.occDen : 0;
      const resp = a.respW / V;
      if (occ > q.burn.occThreshold) s.burnout = clamp(s.burnout + (occ - q.burn.occThreshold) * 100 * q.burn.sensitivity, 0, 100);
      else s.burnout = clamp(s.burnout - q.burn.recovery, 0, 100);
      // §17 rung 2: OT hours feed the burnout index in proportion to how much
      // of the weekly OT capacity was consumed.
      if (a.otHours > 1e-9 && s.otWeeklyCap > 1e-9) {
        s.burnout = clamp(s.burnout + set.ot.burnoutLoad * (a.otHours / s.otWeeklyCap), 0, 100);
      }
      // §17 rung 3: training debt accrues with the reclaimed share of the
      // weekly reclaim capacity, and decays when training is restored.
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
      const wkCost = (paid * q.agentCost) / 52;
      const trainCost = (headsTrain * q.agentCost) / 52;
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
      // Status judged against the SLA IN EFFECT (§19 sla scenarios; ×1 legacy).
      const asaT = q.asaTarget * (s.wkSlaMult || 1);
      const ok = q.type === "voice" ? asa <= asaT && ab <= q.maxAbandon : sl >= q.digitalSlaPct && a.backlog <= q.backlogLimit;
      const near = q.type === "voice" ? asa <= asaT * 1.5 && ab <= q.maxAbandon * 1.5 : sl >= q.digitalSlaPct * 0.9;
      const status = ok ? "green" : near ? "amber" : "red";
      const otCost = a.otHours * hourly * set.ot.premium;
      wk.queues[q.id] = {
        volume: a.volume, baseVolume: a.baseVolume, redial: a.redial, deflected: a.deflected,
        asa, sl, abandon: ab, occ, respMin: resp, backlog: a.backlog,
        trained: s.trained, ramp: headsRamp, training: headsTrain, pipeline: headsPipe, paid,
        // §14.6: active excludes trainees; startingHC is the week-0 resolved HC.
        active: s.trained + headsRamp, startingHC: startHC[q.id], resourcing: q.resourcing || "resourced",
        channel: channelOf(q), brandId: q.brandId || null,
        reqFte, hours: a.hours, reqHours: a.reqHours, svcHours: a.svcHours, flexIn: a.flexIn,
        cover: a.reqHours > 0 ? a.hours / a.reqHours : 1,
        burnout: s.burnout, leavers: s.lastLeavers || 0, reqsRaised: s.lastReqs || 0,
        attrInEffect: (s.wkAttr || 0) * 4.345,
        // §17/§20a risk-support + §16 audit fields.
        otHours: a.otHours, otCost, otStreakWeeks: s.otStreak || 0,
        reclaimedHours: a.reclaimedHours, trainingDebt: s.trainingDebt || 0,
        recycledIn: a.recycledIn, poolIn: a.poolIn, leveragedIn: a.leveragedIn,
        borrowedSharePct: a.reqHours > 1e-9 ? (a.flexIn + a.recycledIn + a.poolIn + a.leveragedIn + a.svcHours) / a.reqHours : 0,
        ahtInEffect: s.wkAht != null ? s.wkAht : q.aht,
        slaInEffect: s.wkSla != null ? s.wkSla : (q.type === "voice" ? q.asaTarget : q.digitalSlaMinutes),
        trainShrinkInEffect: s.reclaimShrink || 0,
        scenarioTags: s.wkTags || null,
        cost: wkCost, trainCost, waste, churnCustomers: lost, churnCost, cumChurn: s.cumChurn, status,
      };
      wk.totals.volume += a.volume; wk.totals.cost += wkCost; wk.totals.trainCost += trainCost;
      wk.totals.waste += waste; wk.totals.churnCost += churnCost; wk.totals.churnCustomers += lost;
      wk.totals.paid += paid; wk.totals.reqFte += reqFte; wk.totals.svcHours += a.svcHours;
      wk.totals.trained += s.trained; wk.totals.inTraining += headsTrain; wk.totals.ramping += headsRamp;
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
    wk.totals.managerCost = (managers * cfg.costs.managerCost) / 52;
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

// Compact per-run shape for saving/comparison.
function compactRun(cfg, sim) {
  return {
    headline: sim.summary, horizon: sim.weeks.length, strategy: sim.strategy, viewIds: sim.viewIds,
    totals: sim.weeks.map((w, i) => ({ wk: i + 1, cost: w.totals.totalCost, churn: w.totals.churnCost, waste: w.totals.waste, paid: w.totals.paid, req: w.totals.reqFte, volume: w.totals.volume })),
    queues: cfg.queues.map((q) => ({
      id: q.id, name: q.name, type: q.type,
      weeks: sim.weeks.map((w) => {
        const s = w.queues[q.id];
        return { st: s.status, cv: +s.cover.toFixed(3), asa: +s.asa.toFixed(1), sl: +s.sl.toFixed(3), ab: +s.abandon.toFixed(4), oc: +s.occ.toFixed(3), bu: +s.burnout.toFixed(0), pd: +s.paid.toFixed(1), rq: +s.reqFte.toFixed(1), co: Math.round(s.cost), ch: Math.round(s.churnCost), vo: Math.round(s.volume), lv: +(s.leavers || 0).toFixed(2), rr: +(s.reqsRaised || 0).toFixed(2) };
      }),
    })),
  };
}

// ---------- SUMMARY & FINDINGS ----------
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

  // cap infeasibility
  const binding = (allocTrace || []).filter((t) => t.binding);
  if (binding.length) {
    flags.capInfeasible = true;
    const worst = binding.reduce((a, b) => (b.want - b.cap > a.want - a.cap ? b : a));
    findings.push({ tone: "red", text: `Hiring cap binds in ${binding.length} week(s). Worst: week ${worst.week + 1} — cap ${worst.cap}, plan wants ${worst.want.toFixed(0)}; short queues: ${Object.keys(worst.denied).map((id) => cfg.queues.find((q) => q.id === id)?.name || id).join(", ")}.` });
  }
  // operation-level tipping point vs the global cap
  const leaversWk = weeks.map((w) => sum(cfg.queues.map((q) => w.queues[q.id].leavers)));
  const avgLeavers = sum(leaversWk.slice(-8)) / Math.min(8, leaversWk.length);
  if (avgLeavers > cfg.hiring.cap * 1.0001 && !strategyAllManual(cfg, strategy)) {
    flags.tippingPoint = true;
    findings.push({ tone: "red", text: `Tipping point: the operation is losing ${avgLeavers.toFixed(1)} people/week against a hiring cap of ${cfg.hiring.cap}/week. Headcount cannot recover at any allocation.` });
  }
  for (const q of cfg.queues) {
    const series = weeks.map((w) => w.queues[q.id]);
    const qLabel = q.resourcing === "supported" ? `${q.name} (supported)`
      : q.resourcing === "unmanned" ? `${q.name} (unmanned)`
      : q.resourcing === "leveraged" ? `${q.name} (leveraged)` : q.name; // §14.2/§17 badge
    const breachWeeks = series.filter((s) => s.status !== "green").length;
    const firstBreach = series.findIndex((s) => s.status === "red");
    const peakBurn = Math.max(...series.map((s) => s.burnout));
    perQueue[q.id] = { breachWeeks, firstBreach, peakBurn };
    if (firstBreach >= 0) {
      const lead = q.wf.reqToStart + q.wf.trainingWeeks + q.wf.learningCurve.length;
      const raiseBy = firstBreach - lead;
      findings.push({
        tone: "red",
        text: (q.resourcing === "supported" || q.resourcing === "unmanned")
          ? `${qLabel} goes red in week ${firstBreach + 1}. It is staffed only from supporter spare hours — add support routes or resource it directly.`
          : raiseBy >= 0
          ? `${qLabel} goes red in week ${firstBreach + 1}. Requisitions must land by week ${raiseBy + 1} given the ${lead}-week hire-to-productive lead.`
          : `${qLabel} goes red in week ${firstBreach + 1}, inside the ${lead}-week lead time. Hiring cannot fix it — cover with flexing, service teams or deferral.`,
      });
    }
    if (peakBurn > 60) findings.push({ tone: "amber", text: `${qLabel} peaks at ${Math.round(peakBurn)}/100 burnout, lifting attrition and absence.` });
    const last = series[series.length - 1];
    if (last.paid > last.reqFte * 1.1 && last.reqFte > 0) {
      const excess = last.paid - last.reqFte;
      const perWeek = last.paid * (q.wf.attrition / 4.345);
      const wks = perWeek > 0 ? Math.ceil(excess / perWeek) : 999;
      findings.push({ tone: "amber", text: `${qLabel} ends ${excess.toFixed(0)} FTE over requirement. Under a freeze, attrition clears it in ~${wks} weeks (~${f(((excess * q.agentCost) / 52) * (wks / 2))} carrying cost).` });
    }
  }
  if (churnCost > 0) findings.push({ tone: churnCost > waste ? "red" : "green", text: `Over ${weeks.length} weeks: ${f(totalCost)} to run, ${f(churnCost)} lost to poor experience (${Math.round(lost).toLocaleString()} customers), ${f(waste)} idle pay.` });

  // §14.6 hiring summary — per queue and Voice / Digital / Overall rollups.
  // volume: total contacts over the horizon; required: final-week required FTE;
  // hiring: total requisitions raised (pipelineEnd shown separately); training/
  // active: final-week heads; churn: total leavers, as a share of the average
  // active headcount over the horizon.
  const hiring = { queues: {}, groups: {} };
  const blankAggRow = () => ({ volume: 0, required: 0, hiring: 0, pipelineEnd: 0, training: 0, active: 0, churnCount: 0, _avgActive: 0 });
  const groups = { voice: blankAggRow(), digital: blankAggRow(), overall: blankAggRow() };
  for (const q of cfg.queues) {
    const series = weeks.map((w) => w.queues[q.id]);
    const last = series[series.length - 1];
    const row = {
      name: q.name, type: q.type, resourcing: q.resourcing || "resourced",
      volume: sum(series.map((s) => s.volume)),
      required: last.reqFte,
      hiring: sum(series.map((s) => s.reqsRaised || 0)),
      pipelineEnd: last.pipeline,
      training: last.training,
      active: last.active != null ? last.active : last.trained + last.ramp,
      churnCount: sum(series.map((s) => s.leavers || 0)),
    };
    const avgActive = sum(series.map((s) => (s.active != null ? s.active : s.trained + s.ramp))) / Math.max(1, series.length);
    row.churnPct = avgActive > 1e-9 ? row.churnCount / avgActive : 0;
    hiring.queues[q.id] = row;
    for (const g of [groups[q.type] || (groups[q.type] = blankAggRow()), groups.overall]) {
      g.volume += row.volume; g.required += row.required; g.hiring += row.hiring;
      g.pipelineEnd += row.pipelineEnd; g.training += row.training; g.active += row.active;
      g.churnCount += row.churnCount; g._avgActive += avgActive;
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

// ---------- DEFAULT CONFIG (SPEC §12) ----------
function makeDefaultConfig() {
  const wf = () => ({ attrition: 0.04, attritionGrowth: 0, reqToStart: 6, trainingWeeks: 4, learningCurve: [0.6, 0.75, 0.9, 1.0], hires: [] });
  const burn = () => ({ occThreshold: 0.85, sensitivity: 1.5, recovery: 8, maxAttritionMult: 2, absenceUplift: 0.05 });
  const v1 = "q_bill", v2 = "q_tech", d1 = "q_wapp", d2 = "q_chat";
  return {
    // §16/§22: default simulation window is 52 weeks (clamped [24, 78]).
    engine: { horizonWeeks: 52, dayStart: 8, dayEnd: 20, intervalMin: 30, occupancyCeiling: 0.85, currency: "£", daysPerWeek: 7, hoursPerFteDay: 8, daysWorkedPerFte: 5, crossSkillProficiency: 0.9, globalStartingHC: null },
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
    seasonality: { startMonth: 0, system: [...SEASONAL_PRESETS["Flat"]] },
    queues: [
      { id: v1, name: "Voice — Billing", type: "voice", brandId: "b1", channel: "voice", priority: 1, dailyVolume: 2000, aht: 300, profile: [...DEFAULT_PROFILE], asaTarget: 30, maxAbandon: 0.05, patience: 90, shrinkage: 0.3, fte: 63, agentCost: 32000, crossSkill: [v2], weeklyVolumes: null, seasonal: null, concurrency: 1, digitalSlaMinutes: 5, digitalSlaPct: 0.8, backlogLimit: 150, deflectsTo: null, resourcing: "resourced", supports: [], wf: wf(), burn: burn() },
      { id: v2, name: "Voice — Technical", type: "voice", brandId: "b1", channel: "voice", priority: 2, dailyVolume: 900, aht: 420, profile: [...DEFAULT_PROFILE], asaTarget: 45, maxAbandon: 0.06, patience: 100, shrinkage: 0.3, fte: 47, agentCost: 32000, crossSkill: [], weeklyVolumes: null, seasonal: null, concurrency: 1, digitalSlaMinutes: 5, digitalSlaPct: 0.8, backlogLimit: 150, deflectsTo: null, resourcing: "resourced", supports: [], wf: wf(), burn: burn() },
      { id: d1, name: "WhatsApp — Service", type: "digital", brandId: "b1", channel: "digital", priority: 3, dailyVolume: 1400, aht: 420, profile: [...DEFAULT_PROFILE], concurrency: 2.5, digitalSlaMinutes: 5, digitalSlaPct: 0.8, backlogLimit: 150, deflectsTo: v1, shrinkage: 0.3, fte: 20, agentCost: 30000, crossSkill: [], weeklyVolumes: null, seasonal: null, asaTarget: 30, maxAbandon: 0.05, patience: 90, resourcing: "resourced", supports: [], wf: wf(), burn: burn() },
      { id: d2, name: "Chat — Sales", type: "digital", brandId: "b1", channel: "digital", priority: 4, dailyVolume: 700, aht: 360, profile: [...DEFAULT_PROFILE], concurrency: 2.0, digitalSlaMinutes: 3, digitalSlaPct: 0.8, backlogLimit: 80, deflectsTo: v1, shrinkage: 0.3, fte: 11, agentCost: 30000, crossSkill: [], weeklyVolumes: null, seasonal: null, asaTarget: 30, maxAbandon: 0.05, patience: 90, resourcing: "resourced", supports: [], wf: wf(), burn: burn() },
    ],
    serviceTeams: [{ id: "st_1", name: "Flex pool", size: 12, premiumPct: 0.2, proficiency: 0.8, triggerOccupancy: 0.9, maxHoursPerWeek: 20, agentCost: 32000, coversQueues: [v1, v2] }],
    costs: { managerCost: 48000, managerRatio: 12 },
    cx: { customerBase: 200000, costPerLostCustomer: 500, churnAbandon: 0.03, churnWait: 0.015, churnDigital: 0.02, repeatUplift: 1.5 },
    loops: { redial: 0.3, deflection: 0.4 },
    views: [{ id: "v_por", name: "Plan of record", builtin: true }, { id: "v_none", name: "No scenarios", builtin: true, scenarioIds: [] }],
    scenarios: [
      { id: "sc_growth", type: "growth", name: "Customer growth", enabled: true, startWeek: 0, queueIds: "all", p: { rate: 0.02 } },
      { id: "sc_launch", type: "launch", name: "Product launch", enabled: false, startWeek: 8, queueIds: "all", p: { ramp: 3, peak: 0.4, decay: 6 } },
      { id: "sc_p1", type: "p1", name: "P1 incident", enabled: false, startWeek: 12, queueIds: "all", p: { spike: 1.5, days: 2 } },
      { id: "sc_fe", type: "forecastError", name: "Forecast error", enabled: false, startWeek: 0, queueIds: "all", p: { error: 0.15 } },
      { id: "sc_as", type: "attritionShock", name: "Attrition shock", enabled: false, startWeek: 10, queueIds: "all", p: { add: 0.03 } },
      { id: "sc_hf", type: "hiringFreeze", name: "Hiring freeze", enabled: false, startWeek: 6, queueIds: "all", p: { weeks: 12 } },
      { id: "sc_rt", type: "reducedTraining", name: "Reduced training", enabled: false, startWeek: 0, queueIds: "all", p: { cutWeeks: 2, startProficiency: 0.4, stretch: 1.75, ahtPenalty: 0.12, repeatUplift: 0.08 } },
    ],
  };
}

// ---------- R2 MIGRATION SHIMS (SPEC §21) ----------
// Each legacy scenario type maps to a unified equivalent that reproduces its
// numeric behaviour (the §22 gate holds them within 1%; most are exact).
// Legacy operation-wide types keep queueIds "all" so their op-wide reach
// survives the stricter unified scoping.
function migrateScenarioToUnified(s, cfg) {
  const base = { id: s.id, type: "unified", name: s.name, enabled: s.enabled, startWeek: s.startWeek || 0, stopWeek: null, granularity: "week", queueIds: s.queueIds };
  const opWide = { ...base, queueIds: "all" };
  switch (s.type) {
    case "growth":
      return { ...base, tag: "growth", parameter: "volume", mechanism: "growthRate", stopWeek: s.p.stopWeek != null ? s.p.stopWeek : null, p: { rate: s.p.rate } };
    case "launch": {
      // Reproduce the legacy ramp/peak/decay shape as an explicit weekly series.
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
      // §19's conceptual mapping is trainingShrinkage + aht step; to preserve
      // the legacy cohort-timing effects EXACTLY the programme parameters ride
      // along under the unified people envelope (flagged in PROGRESS).
      return { ...opWide, tag: "custom", parameter: "people", mechanism: "step", p: { kind: "trainingProgramme", programme: { ...s.p } } };
    case "growthManual":
      return { ...base, tag: "growth", parameter: "volume", mechanism: "manualSeries", p: { series: { ...(s.p.weeklyPct || {}) }, overrideGrowth: true } };
    case "freezeManual": {
      const series = {};
      for (const w of s.p.weeks || []) series[w] = 1;
      return { ...opWide, tag: "custom", parameter: "people", mechanism: "manualSeries", p: { kind: "hiringFreeze", series } };
    }
    default:
      return s.type === "unified" ? s : { ...base, tag: "custom", parameter: "volume", mechanism: "step", p: { value: 0 } };
  }
}

// §21: service teams are deleted as a concept — each becomes a leveraged
// support-channel queue (size→HC, premium retained as a cost note, trigger
// retained as a heuristic note; cap = size × maxHoursPerWeek).
function migrateServiceTeamsToLeveraged(cfg) {
  if (!cfg.serviceTeams || !cfg.serviceTeams.length) return cfg;
  const brandId = (cfg.brands && cfg.brands[0] && cfg.brands[0].id) || "b1";
  const wfDef = { attrition: 0.04, attritionGrowth: 0, reqToStart: 6, trainingWeeks: 4, learningCurve: [0.6, 0.75, 0.9, 1.0], hires: [] };
  const burnDef = { occThreshold: 0.85, sensitivity: 1.5, recovery: 8, maxAttritionMult: 2, absenceUplift: 0.05 };
  const extra = cfg.serviceTeams.map((t, i) => ({
    id: "q_" + t.id, name: t.name, type: "digital", channel: "support", brandId,
    priority: 900 + i, resourcing: "leveraged",
    dailyVolume: 0, aht: 300, concurrency: 1, profile: new Array(24).fill(1),
    digitalSlaMinutes: 60, digitalSlaPct: 0.8, backlogLimit: 1e9, deflectsTo: null,
    asaTarget: 30, maxAbandon: 0.05, patience: 90,
    shrinkage: 0.3, fte: t.size, agentCost: t.agentCost,
    crossSkill: [], supports: [], weeklyVolumes: null, seasonal: null,
    leverage: {
      capHoursPerWeek: t.size * t.maxHoursPerWeek, targets: [...(t.coversQueues || [])],
      premiumPct: t.premiumPct, // cost note (§21)
      note: "migrated service team — trigger occ " + t.triggerOccupancy + ", proficiency " + t.proficiency,
    },
    wf: { ...wfDef }, burn: { ...burnDef },
  }));
  return { ...cfg, queues: [...cfg.queues, ...extra], serviceTeams: [] };
}

// §21 one-shot config migration: default brand adopts every queue; resourced →
// dedicated (supported → unmanned); knock-on materialised from the legacy
// loops; views become groups 1:1; legacy scenarios become unified equivalents;
// service teams become leveraged support queues. Idempotent.
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
      resourcing: q.resourcing === "supported" ? "unmanned" : (!q.resourcing || q.resourcing === "resourced") ? "dedicated" : q.resourcing,
      supports: supports[q.id] || [],
      crossSkill: [],
      repeatPct: q.repeatPct != null ? q.repeatPct : kn.repeatPct,
      spillPct: q.spillPct != null ? q.spillPct : kn.spillPct,
      spillTargetQueue: q.spillTargetQueue != null ? q.spillTargetQueue : kn.spillTargetQueue,
    };
  });
  out = migrateServiceTeamsToLeveraged(out);
  if (!out.groups || !out.groups.length) {
    out.groups = (out.views || []).map((v) => ({ id: v.id, name: v.name, builtin: !!v.builtin, scenarioIds: Array.isArray(v.scenarioIds) ? [...v.scenarioIds] : undefined }));
    if (!out.groups.length) out.groups = [{ id: "g_por", name: "Plan of record", builtin: true }, { id: "g_none", name: "No scenarios", builtin: true, scenarioIds: [] }];
  }
  out.pools = out.pools || [];
  out.scenarios = out.scenarios.map((s) => migrateScenarioToUnified(s, out));
  return out;
}

// §19 groups resolve to scenario-id lists exactly as views did: an explicit
// list filters to existing scenarios; no list = the live enabled set.
function groupScenarioIds(cfg, groupId) {
  const g = (cfg.groups || []).find((x) => x.id === groupId) || (cfg.groups || [])[0];
  if (g && Array.isArray(g.scenarioIds)) return g.scenarioIds.filter((id) => cfg.scenarios.some((s) => s.id === id));
  return cfg.scenarios.filter((s) => s.enabled).map((s) => s.id);
}

module.exports = {
  erlangB, erlangC, voiceRaw, voiceInterval, requiredAgentsInterval, reqCurve,
  runVoiceDay, runDigitalDay, hoursPerHeadDay, monthOfWeek, seasonalMult, SEASONAL_PRESETS,
  exogenousVolume, projectSupply, decideHiring, simulate, compactRun, summarise,
  makeDefaultConfig, DEFAULT_PROFILE, clamp, norm, sum, uid, stretchCurve,
  // Revision 1 (SPEC §14)
  BUILTIN_STRATEGIES, strategyById, strategyAt, strategyAllManual,
  effectiveSupports, supportersOf, resolveStartingHC,
  // Revision 2 (SPEC §15–§21)
  settingsOf, resolveHorizon, resolveTraining, resolveKnockOn, blendedAht,
  channelOf, brandFor, brandShareVolume, R2_DEFAULTS,
  migrateScenarioToUnified, migrateServiceTeamsToLeveraged, migrateConfigR2, groupScenarioIds,
};
