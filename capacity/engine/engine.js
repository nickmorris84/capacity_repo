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
  const key = N + "|" + Math.round(A * 20);
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
const _vCache = new Map();
function voiceRaw(N, A, aht, pat, target) {
  if (A <= 0) return { asa: 0, sl: 1, abandon: 0, occ: 0 };
  if (N < 1) return { asa: pat, sl: 0, abandon: 1, occ: 1 };
  const key = N + "|" + Math.round(A * 20) + "|" + aht + "|" + pat + "|" + target;
  const hit = _vCache.get(key); if (hit) return hit;
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
  if (_vCache.size < 300000) _vCache.set(key, out);
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
function requiredAgentsInterval(arrivals, intervalSec, aht, pat, target, maxAband, occCeil) {
  if (arrivals <= 0) return 0;
  const A = (arrivals / intervalSec) * aht;
  for (let N = Math.max(1, Math.ceil(A)); N <= Math.ceil(A) + 400; N++) {
    const r = voiceRaw(N, A, aht, pat, target);
    if (r.asa <= target && r.abandon <= maxAband && r.occ <= occCeil) return N;
  }
  return Math.ceil(A) + 400;
}

// ---------- REQUIREMENT CURVES ----------
/* Supply assumption: there is no rostering, so available agent-hours are laid
   out across the day in proportion to the REQUIREMENT curve, not the demand
   curve. This matters: Erlang has strong economies of scale, so a quiet
   interval needs proportionally far more agents than a busy one. A queue
   holding 100% of its required hours therefore meets SLA in every interval;
   one holding 90% is uniformly ~10% short. Coverage = availableHrs / requiredHrs. */
function reqCurveVoice(q, volume, eng, cache) {
  const key = "v" + q.id + "|" + Math.round(volume) + "|" + q.aht + "|" + q.asaTarget + "|" + q.maxAbandon + "|" + q.patience + "|" + eng.occupancyCeiling;
  const hit = cache.get(key); if (hit) return hit;
  const p = norm(q.profile), iSec = eng.intervalMin * 60, iHrs = eng.intervalMin / 60;
  const agents = p.map((share) =>
    requiredAgentsInterval(volume * share, iSec, q.aht, q.patience, q.asaTarget, q.maxAbandon, eng.occupancyCeiling)
  );
  const out = { agents, hours: sum(agents) * iHrs };
  cache.set(key, out); return out;
}
function reqCurveDigital(q, volume, eng, cache) {
  const key = "d" + q.id + "|" + Math.round(volume) + "|" + q.aht + "|" + q.concurrency + "|" + eng.occupancyCeiling;
  const hit = cache.get(key); if (hit) return hit;
  const p = norm(q.profile), iSec = eng.intervalMin * 60, iHrs = eng.intervalMin / 60;
  // Async channels queue rather than block, so there is no Erlang scale effect:
  // capacity must simply exceed demand by the occupancy headroom.
  const agents = p.map((share) => (volume * share * q.aht) / (q.concurrency * iSec * eng.occupancyCeiling));
  const out = { agents, hours: sum(agents) * iHrs };
  cache.set(key, out); return out;
}
const reqCurve = (q, v, eng, cache) => (q.type === "voice" ? reqCurveVoice(q, v, eng, cache) : reqCurveDigital(q, v, eng, cache));

// ---------- DAY MODELS ----------
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
function runDigitalDay(q, volume, productiveHours, startBacklog, eng, rc) {
  const iSec = eng.intervalMin * 60, iMin = eng.intervalMin, iHrs = eng.intervalMin / 60;
  const cover = rc.hours > 0 ? productiveHours / rc.hours : 1;
  const p = norm(q.profile);
  let B = startBacklog, tv = 0, inSla = 0, respW = 0, occN = 0, occD = 0;
  const byInterval = [];
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
    byInterval.push({ i, arrivals, agents, req: rc.agents[i], cap, served, backlog: Bend, resp: (wStart + wEnd) / 2, occ });
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

// ---------- SCENARIOS (view-aware) ----------
function scenarioFor(week, day, q, cfg, activeIds) {
  const out = { volMult: 1, attritionAdd: 0, freeze: false, ahtMult: 1, repeatAdd: 0, training: null };
  for (const s of cfg.scenarios) {
    if (!activeIds.has(s.id)) continue;
    const hits = s.queueIds === "all" || (s.queueIds || []).includes(q.id);
    if (!hits && s.type !== "hiringFreeze" && s.type !== "attritionShock" && s.type !== "reducedTraining") continue;
    const w = week - s.startWeek;
    if (w < 0) continue;
    if (s.type === "growth") out.volMult *= Math.pow(1 + s.p.rate, w / 4.345);
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
  return out;
}

// Exogenous daily volume for queue q in (week, day): base -> seasonality ->
// growth/events. Endogenous deflection/redial are added by the day loop.
function exogenousVolume(q, week, day, cfg, activeIds) {
  const base = q.weeklyVolumes && q.weeklyVolumes[week] != null ? q.weeklyVolumes[week] : q.dailyVolume;
  return base * seasonalMult(week, cfg, q) * scenarioFor(week, day, q, cfg, activeIds).volMult;
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
// Returns { grants: {qid: heads}, trace } for this week.
function decideHiring(cfg, st, w, activeIds, strategy, reqFteAt) {
  const wants = [];
  for (const q of cfg.queues) {
    const s = st[q.id];
    const sc = scenarioFor(w, 0, q, cfg, activeIds);
    if (sc.freeze) continue;
    const lead = q.wf.reqToStart + (sc.training ? Math.max(1, q.wf.trainingWeeks - sc.training.cutWeeks) : q.wf.trainingWeeks);
    const L = w + lead;
    if (L >= cfg.engine.horizonWeeks + lead) { /* still allow: lands past horizon has no effect */ }
    const wkAttr = clamp(q.wf.attrition * (1 + q.wf.attritionGrowth * (w / 4.345)) + sc.attritionAdd, 0, 0.6) / 4.345;
    const proj = projectSupply(s, q, lead, wkAttr);
    let want = 0;
    if (strategy === "S4") {
      want = (q.wf.hires || []).filter((h) => h.week === w).reduce((a, b) => a + b.heads, 0);
    } else if (strategy === "S3") {
      want = proj.leaversNext * 1; // replace the leavers projected for the landing week
    } else {
      const target = reqFteAt(q, L) * (strategy === "S2" ? 1 + cfg.hiring.buffer : 1);
      want = Math.max(0, target - proj.effective);
    }
    if (want <= 1e-6) continue;
    // marginal churn cost averted per FTE + earliest projected breach for tie-break
    const rq = Math.max(0.5, reqFteAt(q, L));
    const churnProb = q.type === "voice" ? cfg.cx.churnAbandon : cfg.cx.churnDigital;
    const marginal = (exogenousVolume(q, Math.min(L, cfg.engine.horizonWeeks - 1), 0, cfg, activeIds) * 7 * churnProb * cfg.cx.costPerLostCustomer) / rq;
    let breachWk = cfg.engine.horizonWeeks;
    for (let f = w; f < Math.min(w + lead + 8, cfg.engine.horizonWeeks); f++) {
      const p = projectSupply(s, q, f - w, wkAttr);
      if (p.effective < reqFteAt(q, f) * 0.999) { breachWk = f; break; }
    }
    wants.push({ q, want, marginal, breachWk });
  }
  wants.sort((a, b) => b.marginal - a.marginal || a.breachWk - b.breachWk);
  const cap = strategy === "S4" ? Infinity : cfg.hiring.cap;
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
  const strategy = opts.strategy || cfg.hiring.activeStrategy || "S1";
  const activeIds = new Set(opts.viewIds != null ? opts.viewIds : cfg.scenarios.filter((s) => s.enabled).map((s) => s.id));
  const rcCache = new Map();
  const reqFteCache = new Map();
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

  const st = {};
  for (const q of cfg.queues) {
    st[q.id] = { trained: q.fte, ramp: [], training: [], pipeline: [], burnout: 0, backlog: 0, deflectIn: 0, cumChurn: 0, lastCurve: q.wf.learningCurve };
  }
  const weeks = [], allocTrace = [];
  const svcUsed = {};

  for (let w = 0; w < eng.horizonWeeks; w++) {
    // ---- 1. workforce ages one week ----
    for (const q of cfg.queues) {
      const s = st[q.id];
      const sc = scenarioFor(w, 0, q, cfg, activeIds);
      const curve = sc.training ? stretchCurve(q.wf.learningCurve, sc.training.startProficiency, sc.training.stretch) : q.wf.learningCurve;
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
      const monthly = q.wf.attrition * (1 + q.wf.attritionGrowth * (w / 4.345)) + sc.attritionAdd;
      const wk = clamp(monthly, 0, 0.6) / 4.345 * bMult;
      const pool = s.trained + sum(s.ramp.map((c) => c.heads));
      const leavers = pool * wk;
      const tShare = pool > 0 ? s.trained / pool : 1;
      s.trained = Math.max(0, s.trained - leavers * tShare);
      s.ramp.forEach((c) => (c.heads *= 1 - wk));
      s.lastLeavers = leavers;
      s.lastCurve = curve;
      s.wkAttr = wk;
    }
    // ---- 1b. hiring decision under the global cap ----
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

    // ---- 2. run each day ----
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
        const prof = s.trained + sum(s.ramp.map((c) => c.heads * (s.lastCurve[c.age] ?? 1)));
        const absence = (s.burnout / 100) * q.burn.absenceUplift;
        hrs[q.id] = prof * eng.hoursPerFteDay * (eng.daysWorkedPerFte / eng.daysPerWeek) * clamp(1 - q.shrinkage - absence, 0.02, 1);
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
      const spare = {}; for (const q of cfg.queues) spare[q.id] = hrs[q.id] - req[q.id];
      for (const q of cfg.queues) {
        if (spare[q.id] >= 0) continue;
        for (const donorId of q.crossSkill || []) {
          if (!st[donorId] || spare[donorId] <= 0) continue;
          const give = Math.min(spare[donorId], -spare[q.id] / eng.crossSkillProficiency);
          spare[donorId] -= give; hrs[donorId] -= give;
          hrs[q.id] += give * eng.crossSkillProficiency; spare[q.id] += give * eng.crossSkillProficiency;
          agg[q.id].flexIn += give * eng.crossSkillProficiency;
          if (spare[q.id] >= 0) break;
        }
      }
      for (const t of cfg.serviceTeams) {
        const poolWeekHrs = t.size * t.maxHoursPerWeek * t.proficiency;
        let left = Math.max(0, poolWeekHrs - (svcUsed[t.id] || 0));
        const cand = (t.coversQueues || []).map((id) => cfg.queues.find((q) => q.id === id)).filter(Boolean)
          .map((q) => {
            const preview = q.type === "voice"
              ? runVoiceDay(st[q.id].eq, vol[q.id], hrs[q.id], eng, rc[q.id])
              : runDigitalDay(st[q.id].eq, vol[q.id], hrs[q.id], st[q.id].backlog, eng, rc[q.id]);
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
        const r = runDigitalDay(s.eq, vol[q.id], hrs[q.id], s.backlog, eng, rc[q.id]);
        let deflected = 0;
        const excess = Math.max(0, r.endBacklog - q.backlogLimit);
        if (excess > 0) { deflected = excess * cfg.loops.deflection; s.backlog = r.endBacklog - deflected; }
        else s.backlog = r.endBacklog;
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
          if (Math.abs(nr - redial) < 0.5) { redial = nr; break; }
          redial = nr;
          v = vol[q.id] + redial;
        }
        req[q.id] = curve.hours; rc[q.id] = curve;
        dayRes[q.id] = { ...r, redial, redialIters: iters };
      }
      for (const q of cfg.queues) {
        const a = agg[q.id], r = dayRes[q.id], v = r.volume;
        const sc = scenarioFor(w, d, q, cfg, activeIds);
        a.volume += v; a.baseVolume += exogenousVolume(q, w, d, cfg, activeIds);
        a.hours += hrs[q.id]; a.reqHours += req[q.id];
        a.slW += r.sl * v; a.occW += r.occ * v; a.occDen += v;
        a.repeatAdd = sc.repeatAdd;
        if (q.type === "voice") { a.asaW += r.asa * v; a.abW += r.abandon * v; a.redial += r.redial || 0; }
        else { a.respW += r.respMin * v; a.deflected += r.deflected || 0; a.backlog = st[q.id].backlog; }
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
      const ok = q.type === "voice" ? asa <= q.asaTarget && ab <= q.maxAbandon : sl >= q.digitalSlaPct && a.backlog <= q.backlogLimit;
      const near = q.type === "voice" ? asa <= q.asaTarget * 1.5 && ab <= q.maxAbandon * 1.5 : sl >= q.digitalSlaPct * 0.9;
      const status = ok ? "green" : near ? "amber" : "red";
      wk.queues[q.id] = {
        volume: a.volume, baseVolume: a.baseVolume, redial: a.redial, deflected: a.deflected,
        asa, sl, abandon: ab, occ, respMin: resp, backlog: a.backlog,
        trained: s.trained, ramp: headsRamp, training: headsTrain, pipeline: headsPipe, paid,
        reqFte, hours: a.hours, reqHours: a.reqHours, svcHours: a.svcHours, flexIn: a.flexIn,
        cover: a.reqHours > 0 ? a.hours / a.reqHours : 1,
        burnout: s.burnout, leavers: s.lastLeavers || 0, reqsRaised: s.lastReqs || 0,
        attrInEffect: (s.wkAttr || 0) * 4.345,
        cost: wkCost, trainCost, waste, churnCustomers: lost, churnCost, cumChurn: s.cumChurn, status,
      };
      wk.totals.volume += a.volume; wk.totals.cost += wkCost; wk.totals.trainCost += trainCost;
      wk.totals.waste += waste; wk.totals.churnCost += churnCost; wk.totals.churnCustomers += lost;
      wk.totals.paid += paid; wk.totals.reqFte += reqFte; wk.totals.svcHours += a.svcHours;
      wk.totals.trained += s.trained; wk.totals.inTraining += headsTrain; wk.totals.ramping += headsRamp;
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
  if (avgLeavers > cfg.hiring.cap * 1.0001 && strategy !== "S4") {
    flags.tippingPoint = true;
    findings.push({ tone: "red", text: `Tipping point: the operation is losing ${avgLeavers.toFixed(1)} people/week against a hiring cap of ${cfg.hiring.cap}/week. Headcount cannot recover at any allocation.` });
  }
  for (const q of cfg.queues) {
    const series = weeks.map((w) => w.queues[q.id]);
    const breachWeeks = series.filter((s) => s.status !== "green").length;
    const firstBreach = series.findIndex((s) => s.status === "red");
    const peakBurn = Math.max(...series.map((s) => s.burnout));
    perQueue[q.id] = { breachWeeks, firstBreach, peakBurn };
    if (firstBreach >= 0) {
      const lead = q.wf.reqToStart + q.wf.trainingWeeks + q.wf.learningCurve.length;
      const raiseBy = firstBreach - lead;
      findings.push({
        tone: "red",
        text: raiseBy >= 0
          ? `${q.name} goes red in week ${firstBreach + 1}. Requisitions must land by week ${raiseBy + 1} given the ${lead}-week hire-to-productive lead.`
          : `${q.name} goes red in week ${firstBreach + 1}, inside the ${lead}-week lead time. Hiring cannot fix it — cover with flexing, service teams or deferral.`,
      });
    }
    if (peakBurn > 60) findings.push({ tone: "amber", text: `${q.name} peaks at ${Math.round(peakBurn)}/100 burnout, lifting attrition and absence.` });
    const last = series[series.length - 1];
    if (last.paid > last.reqFte * 1.1 && last.reqFte > 0) {
      const excess = last.paid - last.reqFte;
      const perWeek = last.paid * (q.wf.attrition / 4.345);
      const wks = perWeek > 0 ? Math.ceil(excess / perWeek) : 999;
      findings.push({ tone: "amber", text: `${q.name} ends ${excess.toFixed(0)} FTE over requirement. Under a freeze, attrition clears it in ~${wks} weeks (~${f(((excess * q.agentCost) / 52) * (wks / 2))} carrying cost).` });
    }
  }
  if (churnCost > 0) findings.push({ tone: churnCost > waste ? "red" : "green", text: `Over ${weeks.length} weeks: ${f(totalCost)} to run, ${f(churnCost)} lost to poor experience (${Math.round(lost).toLocaleString()} customers), ${f(waste)} idle pay.` });
  return { totalCost, churnCost, waste, lost, allIn: totalCost + churnCost, findings: findings.slice(0, 10), flags, perQueue, strategy };
}

// ---------- DEFAULT CONFIG (SPEC §12) ----------
function makeDefaultConfig() {
  const wf = () => ({ attrition: 0.04, attritionGrowth: 0, reqToStart: 6, trainingWeeks: 4, learningCurve: [0.6, 0.75, 0.9, 1.0], hires: [] });
  const burn = () => ({ occThreshold: 0.85, sensitivity: 1.5, recovery: 8, maxAttritionMult: 2, absenceUplift: 0.05 });
  const v1 = "q_bill", v2 = "q_tech", d1 = "q_wapp", d2 = "q_chat";
  return {
    engine: { horizonWeeks: 26, dayStart: 8, dayEnd: 20, intervalMin: 30, occupancyCeiling: 0.85, currency: "£", daysPerWeek: 7, hoursPerFteDay: 8, daysWorkedPerFte: 5, crossSkillProficiency: 0.9 },
    hiring: { cap: 18, buffer: 0.1, activeStrategy: "S1" },
    seasonality: { startMonth: 0, system: [...SEASONAL_PRESETS["Flat"]] },
    queues: [
      { id: v1, name: "Voice — Billing", type: "voice", dailyVolume: 2000, aht: 300, profile: [...DEFAULT_PROFILE], asaTarget: 30, maxAbandon: 0.05, patience: 90, shrinkage: 0.3, fte: 63, agentCost: 32000, crossSkill: [v2], weeklyVolumes: null, seasonal: null, concurrency: 1, digitalSlaMinutes: 5, digitalSlaPct: 0.8, backlogLimit: 150, deflectsTo: null, wf: wf(), burn: burn() },
      { id: v2, name: "Voice — Technical", type: "voice", dailyVolume: 900, aht: 420, profile: [...DEFAULT_PROFILE], asaTarget: 45, maxAbandon: 0.06, patience: 100, shrinkage: 0.3, fte: 47, agentCost: 32000, crossSkill: [], weeklyVolumes: null, seasonal: null, concurrency: 1, digitalSlaMinutes: 5, digitalSlaPct: 0.8, backlogLimit: 150, deflectsTo: null, wf: wf(), burn: burn() },
      { id: d1, name: "WhatsApp — Service", type: "digital", dailyVolume: 1400, aht: 420, profile: [...DEFAULT_PROFILE], concurrency: 2.5, digitalSlaMinutes: 5, digitalSlaPct: 0.8, backlogLimit: 150, deflectsTo: v1, shrinkage: 0.3, fte: 20, agentCost: 30000, crossSkill: [], weeklyVolumes: null, seasonal: null, asaTarget: 30, maxAbandon: 0.05, patience: 90, wf: wf(), burn: burn() },
      { id: d2, name: "Chat — Sales", type: "digital", dailyVolume: 700, aht: 360, profile: [...DEFAULT_PROFILE], concurrency: 2.0, digitalSlaMinutes: 3, digitalSlaPct: 0.8, backlogLimit: 80, deflectsTo: v1, shrinkage: 0.3, fte: 11, agentCost: 30000, crossSkill: [], weeklyVolumes: null, seasonal: null, asaTarget: 30, maxAbandon: 0.05, patience: 90, wf: wf(), burn: burn() },
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

module.exports = {
  erlangB, erlangC, voiceRaw, voiceInterval, requiredAgentsInterval, reqCurve,
  runVoiceDay, runDigitalDay, hoursPerHeadDay, monthOfWeek, seasonalMult, SEASONAL_PRESETS,
  exogenousVolume, projectSupply, decideHiring, simulate, compactRun, summarise,
  makeDefaultConfig, DEFAULT_PROFILE, clamp, norm, sum, uid, stretchCurve,
};
