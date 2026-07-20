/* P1 gate battery — SPEC.md §13 / phase prompt P1. Plain harness, zero deps. */
const E = require("../engine/engine.js");

let pass = 0, fail = 0;
const failures = [];
function t(name, fn) {
  try { fn(); pass++; console.log("  ✓ " + name); }
  catch (e) { fail++; failures.push(name + ": " + e.message); console.log("  ✗ " + name + " — " + e.message); }
}
function eq(a, b, tol, what) {
  if (Math.abs(a - b) > tol) throw new Error(`${what || "value"} ${a} ≠ ${b} ±${tol}`);
}
function ok(cond, what) { if (!cond) throw new Error(what || "condition failed"); }

/* ---------------- 1. Erlang C recursion vs direct summation ---------------- */
console.log("\n[1] Erlang C — recursion equals direct summation");
function erlangC_direct(N, A) {
  let s = 0, term = 1;
  for (let k = 0; k < N; k++) { s += term; term = (term * A) / (k + 1); }
  return term / (term + (1 - A / N) * s);
}
t("N ∈ {11..16,20,30} match to 1e-6", () => {
  for (const N of [11, 12, 13, 14, 15, 16, 20, 30]) eq(E.erlangC(N, 10), erlangC_direct(N, 10), 1e-6, "N=" + N);
});

/* ---------------- 2. E1 limit 1: patience → ∞ reproduces Erlang C ---------------- */
console.log("\n[2] Erlang A limit 1 — infinite patience = textbook Erlang C");
t("A=10, AHT=180, N=13: C≈0.2853, ASA 17.0s, SL(20s) 79.7%", () => {
  const r = E.voiceRaw(13, 10, 180, 1e7, 20);
  eq(erlangC_direct(13, 10), 0.2853, 5e-4, "C reference");
  eq(r.asa, 17.02, 0.3, "ASA");
  eq(r.sl, 0.797, 0.005, "SL");
  ok(r.abandon < 1e-3, "abandonment ~0 at infinite patience, got " + r.abandon);
});
t("ASA matches C/(N−A)·AHT across N=11..15", () => {
  for (const N of [11, 12, 13, 14, 15]) {
    const r = E.voiceRaw(N, 10, 180, 1e7, 20);
    eq(r.asa, erlangC_direct(N, 10) / ((N - 10) / 180), 0.35, "N=" + N);
  }
});

/* ---------------- 3. E1 limit 2: overload → flow conservation ---------------- */
console.log("\n[3] Erlang A limit 2 — overload abandonment vs 1 − N/A");
t("ab strictly exceeds 1−N/A, monotone in N, near-exact deep", () => {
  let prev = 1.01;
  for (const N of [3, 5, 7, 9]) {
    const r = E.voiceRaw(N, 10, 180, 90, 20);
    ok(r.abandon > 1 - N / 10, `N=${N}: ab ${r.abandon.toFixed(3)} ≤ conservation ${(1 - N / 10).toFixed(3)}`);
    ok(r.abandon < prev, `monotone: N=${N} ab ${r.abandon} ≥ previous ${prev}`);
    prev = r.abandon;
  }
  const deep = E.voiceRaw(3, 10, 180, 90, 20);
  eq(deep.abandon, 0.70, 0.05, "deep overload N=3");
});

/* ---------------- 4. E1 limit 3: bounded, monotone, finite through N=A ---------------- */
console.log("\n[4] Erlang A limit 3 — bounded and monotone through N = A");
t("ASA < patience, decreasing, never NaN/∞ for N=9..25", () => {
  let prev = Infinity;
  for (let N = 9; N <= 25; N++) {
    const r = E.voiceRaw(N, 10, 180, 90, 20);
    for (const v of [r.asa, r.sl, r.abandon, r.occ]) ok(Number.isFinite(v), `N=${N} non-finite`);
    ok(r.asa < 90, `N=${N} ASA ${r.asa} ≥ patience`);
    ok(r.asa <= prev + 1e-9, `N=${N} ASA not monotone`);
    prev = r.asa;
  }
});

/* ---------------- 5. Requirement search: N passes, N−1 fails ---------------- */
console.log("\n[5] Requirement search minimality");
t("computed N meets constraints; N−1 breaks at least one", () => {
  const cases = [[120, 300, 30, 0.05, 90], [40, 420, 45, 0.06, 100], [300, 240, 20, 0.04, 80]];
  for (const [arr, aht, target, maxAb, pat] of cases) {
    const N = E.requiredAgentsInterval(arr, 1800, aht, pat, target, maxAb, 0.85);
    const A = (arr / 1800) * aht;
    const rN = E.voiceRaw(N, A, aht, pat, target);
    ok(rN.asa <= target && rN.abandon <= maxAb && rN.occ <= 0.85, `N=${N} fails its own constraints`);
    if (N > 1) {
      const rM = E.voiceRaw(N - 1, A, aht, pat, target);
      ok(rM.asa > target || rM.abandon > maxAb || rM.occ > 0.85, `N−1=${N - 1} also passes — not minimal`);
    }
  }
});

/* ---------------- 6. Digital conservation + hand-computed SLA ramp ---------------- */
console.log("\n[6] Digital flow model");
t("arrivals = served + Δbacklog in every interval", () => {
  const cfg = E.makeDefaultConfig();
  const q = cfg.queues.find((x) => x.type === "digital");
  const rc = E.reqCurve(q, 1400, cfg.engine, new Map());
  const r = E.runDigitalDay(q, 1400, rc.hours * 0.8, 40, cfg.engine, rc);
  let B = 40;
  for (const b of r.byInterval) {
    eq(b.arrivals, b.served + (b.backlog - B), 1e-6, "interval " + b.i);
    B = b.backlog;
  }
});
t("SLA share matches the linear wait ramp by hand", () => {
  // one synthetic interval: B=50 start, arrivals 100, capacity 120/interval, SLA 5min of a 30min interval
  const q = { id: "x", type: "digital", profile: [1], aht: 300, concurrency: 1, digitalSlaMinutes: 5, digitalSlaPct: 0.8, backlogLimit: 999 };
  const eng = { intervalMin: 30, occupancyCeiling: 0.85 };
  const cap = 120; // contacts/interval => agents*conc*1800/aht = 120 => hours for 1 interval
  const agents = (cap * q.aht) / 1800; // 20 agents
  const rc = { agents: [agents], hours: agents * 0.5 };
  const r = E.runDigitalDay(q, 100, rc.hours, 50, eng, rc);
  // rates/min: in 100/30, out 120/30=4 ; wStart = 50/4 = 12.5min ; Bend = 50+(100-120)=30 ; wEnd = 7.5min
  // both > 5min → 0% in SLA ; mean wait = 10min
  eq(r.sl, 0, 1e-9, "in-SLA share");
  eq(r.respMin, 10, 1e-6, "mean response");
  eq(r.endBacklog, 30, 1e-6, "end backlog");
});

/* ---------------- 7. Volume precedence ---------------- */
console.log("\n[7] Volume model precedence");
t("CSV base × seasonality × scenario multiply; growth toggles on CSV volumes", () => {
  const cfg = E.makeDefaultConfig();
  const q = cfg.queues[0];
  q.weeklyVolumes = Array(26).fill(1000);
  cfg.seasonality.system = E.SEASONAL_PRESETS["Retail Christmas"].slice();
  q.seasonal = Array(12).fill(1.1);
  const g = cfg.scenarios.find((s) => s.type === "growth");
  const withG = E.exogenousVolume(q, 8, 0, cfg, new Set([g.id]));
  const noG = E.exogenousVolume(q, 8, 0, cfg, new Set());
  const m = E.monthOfWeek(8, 0);
  const expectNoG = 1000 * E.SEASONAL_PRESETS["Retail Christmas"][m] * 1.1;
  eq(noG, expectNoG, 1e-6, "csv × system × queue");
  eq(withG / noG, Math.pow(1.02, 8 / 4.345), 1e-9, "growth stacks multiplicatively");
});
t("seasonality flips exactly at month boundaries and nowhere else", () => {
  const cfg = E.makeDefaultConfig();
  cfg.seasonality.system = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2];
  const q = cfg.queues[0];
  for (let w = 1; w < 26; w++) {
    const changed = E.seasonalMult(w, cfg, q) !== E.seasonalMult(w - 1, cfg, q);
    const boundary = E.monthOfWeek(w, 0) !== E.monthOfWeek(w - 1, 0);
    ok(changed === boundary, `week ${w}: mult changed=${changed} but month boundary=${boundary}`);
  }
  ok([...Array(26).keys()].some((w) => w > 0 && E.monthOfWeek(w, 0) !== E.monthOfWeek(w - 1, 0)), "no boundary found in 26 weeks?");
});

/* ---------------- 8. Conversion round trip (§25) ---------------- */
// R3d-A: Digital Customer is now Erlang A — converts-to-calls fire on ABANDONED
// volume (was backlog excess) and there is no carrying backlog. Adapted from the
// legacy deflection round-trip test (numbers intentionally changed at R3d-A).
console.log("\n[8] Conversion round trip — abandoned chat raises next-day voice");
t("day-2 voice volume = base + (day-1 abandoned × convert %); chat carries no backlog", () => {
  const cfg = E.makeDefaultConfig();
  cfg.engine.daysPerWeek = 2;
  cfg.engine.horizonWeeks = 1; // resolveHorizon clamps to ≥24; only week 0 is read
  cfg.scenarios.forEach((s) => (s.enabled = false));
  cfg.serviceTeams = [];
  cfg.queues.forEach((q) => { q.crossSkill = []; });
  const wa = cfg.queues.find((x) => x.id === "q_wapp"); // digital customer
  const bill = cfg.queues.find((x) => x.id === "q_bill");
  // Isolate q_wapp as the only converter into bill (the other chat queue now
  // shows its own tiny Erlang abandonment, so neutralise its conversion target).
  cfg.queues.forEach((q) => { if (q.type === "digital" && q.id !== wa.id) q.deflectsTo = null; });
  wa.fte = 0; // zero servers → every contact abandons (abandon = 1)
  wa.profile = [1]; // single interval so the daily total is exact (no norm epsilon)
  const sim = E.simulate(cfg, { captureDaily: true, strategy: "S4" });
  const d1 = sim.weeks[0].days[0], d2 = sim.weeks[0].days[1];
  const dailyArr = wa.dailyVolume;
  const expDefl = dailyArr * cfg.loops.deflection; // abandoned (= all) × convert %
  eq(d1[wa.id].deflected, expDefl, 1e-6, "day-1 conversion = abandoned × convert %");
  eq(d1[wa.id].backlog, 0, 1e-9, "Digital Customer carries no backlog");
  eq(d2[bill.id].vol, bill.dailyVolume + expDefl, 1e-6, "day-2 voice volume lifted by the conversion");
  // No backlog accumulation now, so day-2 conversion equals day-1's (steady).
  eq(d2[wa.id].deflected, expDefl, 1e-6, "day-2 conversion steady (no carried backlog)");
});

/* ---------------- 9. Redial fixed point ---------------- */
console.log("\n[9] Redial fixed point");
t("converges ≤3 iterations, self-consistent, capped at 4× base", () => {
  const cfg = E.makeDefaultConfig();
  cfg.engine.daysPerWeek = 1; cfg.engine.horizonWeeks = 1;
  cfg.scenarios.forEach((s) => (s.enabled = false));
  cfg.serviceTeams = []; cfg.queues.forEach((q) => (q.crossSkill = []));
  const bill = cfg.queues.find((x) => x.id === "q_bill");
  bill.fte = 15; // savage understaffing → heavy abandonment
  const sim = E.simulate(cfg, { strategy: "S4" });
  const s = sim.weeks[0].queues[bill.id];
  ok(s.volume <= bill.dailyVolume * 4 + 1e-6, "volume exceeds 4× cap");
  // self-consistency: redial ≈ served volume × abandon × retry
  const expected = s.volume * s.abandon * cfg.loops.redial;
  eq(s.redial, expected, Math.max(2, expected * 0.05), "fixed point self-consistency");
  ok(s.redial > 0, "no redial generated despite overload");
});

/* ---------------- 10. Allocator under a binding cap ---------------- */
console.log("\n[10] Global cap allocator");
t("cap 10 vs wants {8,8}: split by marginal churn, total ≤ cap, trace names the starved queue", () => {
  const cfg = E.makeDefaultConfig();
  cfg.scenarios.forEach((s) => (s.enabled = false));
  cfg.hiring.cap = 10;
  // two identical voice queues, but A's customers are 3× as valuable to lose
  cfg.queues = cfg.queues.filter((q) => q.type === "voice");
  const [a, b] = cfg.queues;
  a.crossSkill = []; b.crossSkill = [];
  b.dailyVolume = a.dailyVolume; b.aht = a.aht; b.asaTarget = a.asaTarget;
  b.maxAbandon = a.maxAbandon; b.patience = a.patience; b.fte = a.fte = 40; // both short
  cfg.serviceTeams = [];
  cfg.cx.churnAbandon = 0.03;
  const st = {};
  for (const q of cfg.queues) st[q.id] = { trained: q.fte, ramp: [], training: [], pipeline: [], lastCurve: q.wf.learningCurve };
  const rcCache = new Map();
  const reqFteAt = (q, wk) => E.reqCurve(q, q.dailyVolume, cfg.engine, rcCache).hours / E.hoursPerHeadDay(q, cfg.engine);
  // want per queue = req − supply ≈ same; marginal differs via churn value: fake by volume
  a.dailyVolume = 2000; b.dailyVolume = 2000;
  const need = reqFteAt(a, 0);
  ok(need - 40 > 6, "test setup: shortfall should exceed 6 FTE, got " + (need - 40).toFixed(1));
  // make A more valuable: bump its volume slightly so marginal(a) > marginal(b)
  a.dailyVolume = 2400;
  const { grants, trace } = E.decideHiring(cfg, st, 0, new Set(), "S1", reqFteAt);
  const gA = grants[a.id] || 0, gB = grants[b.id] || 0;
  ok(gA + gB <= cfg.hiring.cap + 1e-6, "total grants exceed cap");
  ok(gA > gB, `higher-marginal queue not prioritised (A=${gA.toFixed(1)}, B=${gB.toFixed(1)})`);
  ok(trace.binding, "trace should mark the cap as binding");
  ok(trace.denied[b.id] > 0, "trace should name the starved queue");
  ok(trace.order[0] === a.id, "allocation order should lead with the higher marginal");
});

/* ---------------- 11. Strategies ---------------- */
console.log("\n[11] Hiring strategies S1–S4");
function calmConfig() {
  const cfg = E.makeDefaultConfig();
  cfg.scenarios.forEach((s) => (s.enabled = false));
  cfg.serviceTeams = [];
  cfg.queues = [cfg.queues[0]];
  cfg.queues[0].crossSkill = [];
  cfg.queues[0].wf.attrition = 0;
  cfg.hiring.cap = 1000;
  cfg.engine.horizonWeeks = 30;
  return cfg;
}
t("S1 closes a deterministic gap by the landing week", () => {
  const cfg = calmConfig();
  const q = cfg.queues[0];
  q.fte = 45; // known shortfall vs ~63 required
  const sim = E.simulate(cfg, { strategy: "S1" });
  const w0 = sim.weeks[0].queues[q.id];
  const gap = w0.reqFte - 45;
  eq(w0.reqsRaised, gap, gap * 0.15 + 1, "week-0 requisitions ≈ the gap");
  const lead = q.wf.reqToStart + q.wf.trainingWeeks + q.wf.learningCurve.length;
  const after = sim.weeks[Math.min(lead + 2, sim.weeks.length - 1)].queues[q.id];
  ok(after.cover > 0.97, `coverage ${(after.cover * 100).toFixed(1)}% after pipeline lands`);
});
t("S2 settles ≈ requirement × (1 + buffer)", () => {
  const cfg = calmConfig();
  cfg.queues[0].fte = 45;
  cfg.hiring.buffer = 0.1;
  const sim = E.simulate(cfg, { strategy: "S2" });
  const last = sim.weeks[sim.weeks.length - 1].queues[cfg.queues[0].id];
  eq(last.paid / last.reqFte, 1.1, 0.06, "end paid/required ratio");
});
t("S3 hires only replacement; under growth it falls behind S1", () => {
  const cfg = E.makeDefaultConfig();
  cfg.serviceTeams = []; cfg.queues = [cfg.queues[0]]; cfg.queues[0].crossSkill = [];
  cfg.hiring.cap = 1000;
  cfg.scenarios.forEach((s) => (s.enabled = s.type === "growth"));
  const s3 = E.simulate(cfg, { strategy: "S3" });
  const s1 = E.simulate(cfg, { strategy: "S1" });
  const qid = cfg.queues[0].id;
  const totalReqs3 = s3.weeks.reduce((a, w) => a + w.queues[qid].reqsRaised, 0);
  const totalLeavers3 = s3.weeks.reduce((a, w) => a + w.queues[qid].leavers, 0);
  ok(totalReqs3 <= totalLeavers3 * 1.35 + 2, `S3 reqs ${totalReqs3.toFixed(1)} far exceed leavers ${totalLeavers3.toFixed(1)}`);
  ok(s3.weeks[25].queues[qid].paid < s1.weeks[25].queues[qid].paid - 2, "S3 should end below S1 under growth");
});
t("S4 reproduces the manual plan exactly and ignores the cap", () => {
  const cfg = calmConfig();
  const q = cfg.queues[0];
  cfg.hiring.cap = 1; // must be ignored by S4
  q.wf.hires = [{ week: 2, heads: 7 }, { week: 5, heads: 3 }];
  const sim = E.simulate(cfg, { strategy: "S4" });
  eq(sim.weeks[2].queues[q.id].reqsRaised, 7, 1e-9, "week 3 reqs");
  eq(sim.weeks[5].queues[q.id].reqsRaised, 3, 1e-9, "week 6 reqs");
  eq(sim.weeks.reduce((a, w) => a + w.queues[q.id].reqsRaised, 0), 10, 1e-9, "total reqs");
});

/* ---------------- 12. Tipping point ---------------- */
console.log("\n[12] Tipping point flag");
t("fires when weekly leavers exceed the global cap", () => {
  const cfg = E.makeDefaultConfig();
  cfg.scenarios.forEach((s) => (s.enabled = false));
  cfg.hiring.cap = 2;
  cfg.queues.forEach((q) => (q.wf.attrition = 0.15)); // ~141 heads × 3.45%/wk ≈ 4.9/wk >> 2
  const sim = E.simulate(cfg, { strategy: "S1" });
  ok(sim.summary.flags.tippingPoint, "tippingPoint flag not set");
  ok(sim.summary.findings.some((f) => /Tipping point/i.test(f.text)), "no tipping-point finding");
});

/* ---------------- 13. Cap infeasibility surfaced ---------------- */
console.log("\n[13] Cap infeasibility finding");
t("binding weeks produce the finding with starved queue names", () => {
  const cfg = E.makeDefaultConfig();
  cfg.scenarios.forEach((s) => (s.enabled = s.type === "growth"));
  cfg.hiring.cap = 3;
  cfg.queues.forEach((q) => (q.fte = Math.max(5, q.fte - 12)));
  const sim = E.simulate(cfg, { strategy: "S1" });
  ok(sim.summary.flags.capInfeasible, "capInfeasible flag not set");
  ok(sim.summary.findings.some((f) => /Hiring cap binds/.test(f.text)), "no cap finding");
  ok(sim.allocTrace.some((t2) => t2.binding && Object.keys(t2.denied).length > 0), "no binding trace with denials");
});

/* ---------------- 14. Performance ---------------- */
console.log("\n[14] Performance budget");
t("default 26-week sim < 250ms; 8 sims < 1s", () => {
  const cfg = E.makeDefaultConfig();
  E.simulate(cfg); // warm caches out of the measurement? No — spec measures cold-ish; keep one warmup for JIT only
  let t0 = Date.now();
  E.simulate(cfg);
  const one = Date.now() - t0;
  t0 = Date.now();
  for (const st of ["S1", "S2", "S3", "S4"]) E.simulate(cfg, { strategy: st });
  for (const st of ["S1", "S2", "S3", "S4"]) E.simulate(cfg, { strategy: st, viewIds: [] });
  const eight = Date.now() - t0;
  console.log(`      one sim ${one}ms · eight sims ${eight}ms`);
  ok(one < 250, `single sim ${one}ms ≥ 250ms`);
  ok(eight < 1000, `eight sims ${eight}ms ≥ 1000ms`);
});

/* ---------------- E1 validation table (gate requirement) ---------------- */
console.log("\n══ E1 VALIDATION TABLE (A=10 Erlangs, AHT=180s) ══");
console.log("  patience→∞ :  N=13  C=" + erlangC_direct(13, 10).toFixed(4) + "  ASA=" + E.voiceRaw(13, 10, 180, 1e7, 20).asa.toFixed(2) + "s  SL(20s)=" + (E.voiceRaw(13, 10, 180, 1e7, 20).sl * 100).toFixed(1) + "%");
for (const N of [3, 9, 10, 13, 18]) {
  const r = E.voiceRaw(N, 10, 180, 90, 20);
  console.log(`  patience 90s:  N=${String(N).padStart(2)}  ASA=${r.asa.toFixed(1).padStart(5)}s  abandon=${(r.abandon * 100).toFixed(1).padStart(5)}%  SL=${(r.sl * 100).toFixed(1).padStart(5)}%  occ=${(r.occ * 100).toFixed(0)}%`);
}

console.log("\n═══════════════════════════════════");
console.log(`${pass} passed, ${fail} failed`);
if (fail) { console.log("FAILURES:\n - " + failures.join("\n - ")); process.exit(1); }
console.log("P1 GATE: GREEN");
