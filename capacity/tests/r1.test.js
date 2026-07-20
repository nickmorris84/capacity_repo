/* P6a gate — SPEC §14 Revision 1 engine battery. Same zero-dep harness as the
   P1 tests. The P1 battery (tests/engine.test.js) running unchanged is the
   regression gate; this file covers only the new §14 behaviour.

   Hand-computable arithmetic: digital queues have a LINEAR requirement
   (hours = volume × AHT ÷ concurrency ÷ 3600 ÷ occupancyCeiling), so with
   occupancyCeiling 1, shrinkage 0, hoursPerFteDay 8, daysWorkedPerFte 7 and
   daysPerWeek 7, one head delivers exactly 8 h/day and every deficit/spare
   below is exact — no Erlang fuzz. */
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

// Exact-arithmetic scaffold: all-digital, ceiling 1, prof 1, 8h heads.
function digitalRig() {
  const cfg = E.makeDefaultConfig();
  cfg.engine = { ...cfg.engine, horizonWeeks: 1, daysPerWeek: 7, hoursPerFteDay: 8, daysWorkedPerFte: 7, occupancyCeiling: 1, crossSkillProficiency: 1 };
  cfg.scenarios.forEach((s) => (s.enabled = false));
  cfg.serviceTeams = [];
  cfg.queues = [];
  return cfg;
}
// A digital WORKFLOW queue whose requirement is exactly `reqHoursPerDay`
// hours/day: dailyVolume × 3600s AHT ÷ 3600 ÷ ceil 1 = dailyVolume hours. The
// workflow subtype keeps this linear, Erlang-free scaffold (R3d-A moved the
// Digital *Customer* subtype to Erlang A, which is not linear); every hand
// number in this file is a supply-ladder quantity, subtype-agnostic.
function dq(cfg, id, reqHoursPerDay, over = {}) {
  const q = {
    id, name: id, type: "digital", subtype: "workflow", dailyVolume: reqHoursPerDay, aht: 3600, concurrency: 1,
    profile: new Array(24).fill(1), digitalSlaMinutes: 60, digitalSlaPct: 0.8, backlogLimit: 1e9,
    deflectsTo: null, shrinkage: 0, fte: 0, agentCost: 30000, crossSkill: [], supports: [],
    weeklyVolumes: null, seasonal: null, asaTarget: 30, maxAbandon: 0.05, patience: 90,
    resourcing: "resourced",
    wf: { attrition: 0, attritionGrowth: 0, reqToStart: 6, trainingWeeks: 4, learningCurve: [1], hires: [] },
    burn: { occThreshold: 2, sensitivity: 0, recovery: 8, maxAttritionMult: 1, absenceUplift: 0 },
    ...over,
  };
  cfg.queues.push(q);
  return q;
}

/* ---------------- 1. crossSkill → supports migration shim ---------------- */
console.log("\n[1] Migration shim — crossSkill arrays auto-convert to supports");
t("default config: Billing's crossSkill [tech] becomes tech→billing supports, priority 1, cap 100", () => {
  const cfg = E.makeDefaultConfig();
  const map = E.effectiveSupports(cfg);
  const tech = map["q_tech"];
  const entry = tech.find((s) => s.queueId === "q_bill");
  ok(entry, "technical should support billing after migration");
  eq(entry.priority, 1, 0, "priority = array position + 1");
  eq(entry.maxSharePct, 100, 0, "maxSharePct 100");
  const inbound = E.supportersOf(cfg, "q_bill");
  ok(inbound.some((s) => s.queueId === "q_tech"), "inbound supported-by list derived");
});
t("explicit supports win: no duplicate entry is added for the same route", () => {
  const cfg = E.makeDefaultConfig();
  const tech = cfg.queues.find((q) => q.id === "q_tech");
  tech.supports = [{ queueId: "q_bill", priority: 3, maxSharePct: 50 }];
  const entries = E.effectiveSupports(cfg)["q_tech"].filter((s) => s.queueId === "q_bill");
  eq(entries.length, 1, 0, "one route only");
  eq(entries[0].priority, 3, 0, "explicit priority kept");
  eq(entries[0].maxSharePct, 50, 0, "explicit cap kept");
});
t("empty crossSkill arrays produce no routes (legacy tests' off-switch still works)", () => {
  const cfg = E.makeDefaultConfig();
  cfg.queues.forEach((q) => { q.crossSkill = []; q.supports = []; });
  const map = E.effectiveSupports(cfg);
  ok(Object.values(map).every((l) => l.length === 0), "no derived routes");
});

/* ---------------- 2. Tier allocation — hand-computed ---------------- */
console.log("\n[2] Tier allocation — proportional within tier, remainder to next tier");
t("spare 10: tier-1 deficits 6h & 3h get 6 & 3; tier-2 deficit 5h gets the remainder 1", () => {
  const cfg = digitalRig();
  const D = dq(cfg, "D", 30, { fte: 5 }); // req 30 h/d, 5 heads × 8h = 40 → spare 10
  dq(cfg, "A", 6, { resourcing: "supported" });
  dq(cfg, "B", 3, { resourcing: "supported" });
  dq(cfg, "C", 5, { resourcing: "supported" });
  D.supports = [
    { queueId: "A", priority: 1 },
    { queueId: "B", priority: 1 },
    { queueId: "C", priority: 2 },
  ];
  const sim = E.simulate(cfg, { strategy: "S4" });
  const w = sim.weeks[0].queues;
  eq(w["A"].hours, 6 * 7, 1e-6, "A gets its full 6h/day need (share 6.67 clamped at need)");
  eq(w["B"].hours, 3 * 7, 1e-6, "B gets its full 3h/day need (share 3.33 clamped at need)");
  eq(w["C"].hours, 1 * 7, 1e-6, "tier-2 C gets only the 1h/day remainder");
  eq(w["D"].hours, 30 * 7, 1e-6, "donor keeps exactly its requirement — never below 100%");
  eq(w["D"].cover, 1, 1e-9, "donor coverage exactly 100% after donating all spare");
});
t("a 40% maxSharePct cap binds: A capped at 4h, B takes 3h, tier-2 C gets 3h", () => {
  const cfg = digitalRig();
  const D = dq(cfg, "D", 30, { fte: 5 }); // spare 10
  dq(cfg, "A", 6, { resourcing: "supported" });
  dq(cfg, "B", 3, { resourcing: "supported" });
  dq(cfg, "C", 5, { resourcing: "supported" });
  D.supports = [
    { queueId: "A", priority: 1, maxSharePct: 40 }, // cap = 40% × 10 = 4h
    { queueId: "B", priority: 1 },
    { queueId: "C", priority: 2 },
  ];
  const sim = E.simulate(cfg, { strategy: "S4" });
  const w = sim.weeks[0].queues;
  eq(w["A"].hours, 4 * 7, 1e-6, "A capped at 40% of the donor's spare");
  eq(w["B"].hours, 3 * 7, 1e-6, "B takes its full need");
  eq(w["C"].hours, 3 * 7, 1e-6, "C receives the 3h left after the capped tier");
});
t("priorities 1 & 2 with 60%/100% caps: R1 takes 6 (60% cap), R2 takes the 4 remaining", () => {
  const cfg = digitalRig();
  const D = dq(cfg, "D", 30, { fte: 5 }); // spare 10
  dq(cfg, "R1", 8, { resourcing: "supported" });
  dq(cfg, "R2", 5, { resourcing: "supported" });
  D.supports = [
    { queueId: "R1", priority: 1, maxSharePct: 60 },  // cap 6 < need 8
    { queueId: "R2", priority: 2, maxSharePct: 100 }, // cap 10, need 5
  ];
  const sim = E.simulate(cfg, { strategy: "S4" });
  const w = sim.weeks[0].queues;
  eq(w["R1"].hours, 6 * 7, 1e-6, "R1 = min(need 8, cap 6, spare 10) = 6");
  eq(w["R2"].hours, 4 * 7, 1e-6, "R2 = min(need 5, cap 10, remainder 4) = 4");
});

/* ---------------- 3. Supported queues ---------------- */
console.log("\n[3] Supported queues — zero HC, zero hiring, served from spare only");
t("supported queue: HC forced 0, zero reqs under every strategy, donor floor holds", () => {
  const cfg = E.makeDefaultConfig();
  cfg.engine.horizonWeeks = 8;
  cfg.engine.crossSkillProficiency = 1;
  cfg.scenarios.forEach((s) => (s.enabled = false));
  cfg.serviceTeams = [];
  cfg.queues = cfg.queues.filter((q) => q.type === "voice");
  const [donor, sup] = cfg.queues;
  donor.crossSkill = []; sup.crossSkill = [];
  donor.wf.attrition = 0; sup.wf.attrition = 0;
  donor.fte = 80; // comfortably above its own requirement → real spare
  sup.resourcing = "supported";
  sup.fte = 47;               // must be ignored: supported ⇒ starting HC forced 0
  sup.dailyVolume = 200;      // modest need
  sup.wf.hires = [{ week: 1, heads: 5 }]; // must be ignored even under manual
  donor.supports = [{ queueId: sup.id, priority: 1 }];
  for (const strat of ["S1", "S2", "S3", "S4"]) {
    const sim = E.simulate(cfg, { strategy: strat });
    for (const w of sim.weeks) {
      const s = w.queues[sup.id];
      eq(s.reqsRaised, 0, 1e-9, strat + ": supported queue raised reqs");
      eq(s.pipeline, 0, 1e-9, strat + ": supported queue has a pipeline");
      eq(s.paid, 0, 1e-9, strat + ": supported queue has paid heads");
      eq(s.startingHC, 0, 1e-9, strat + ": startingHC not forced to 0");
      if (s.flexIn > 0.01) {
        ok(w.queues[donor.id].cover >= 1 - 1e-9, strat + ": donor dipped below 100% while donating");
      }
    }
  }
});
t("recipient hours = min(need, donor spare); starved donor gives nothing", () => {
  const cfg = E.makeDefaultConfig();
  cfg.engine.horizonWeeks = 1;
  cfg.engine.crossSkillProficiency = 1;
  cfg.scenarios.forEach((s) => (s.enabled = false));
  cfg.serviceTeams = [];
  cfg.queues = cfg.queues.filter((q) => q.type === "voice");
  const [donor, sup] = cfg.queues;
  donor.crossSkill = []; sup.crossSkill = [];
  donor.wf.attrition = 0; sup.wf.attrition = 0;
  sup.resourcing = "supported";
  donor.supports = [{ queueId: sup.id, priority: 1 }];

  // Case A: donor spare < recipient need → recipient gets exactly the spare.
  // Donation happens BEFORE the voice redial fixed point re-inflates the
  // requirement, so the identity uses the allocation-time requirement
  // (reqCurve at base volume), not the redial-inflated weekly reqHours.
  donor.fte = 70;
  let sim = E.simulate(cfg, { strategy: "S4" });
  let wd = sim.weeks[0].queues[donor.id], ws = sim.weeks[0].queues[sup.id];
  // 70 heads × 4 h/day (8 × 5/7 × 0.7 shrinkage) × 7 days = 1960 weekly hours.
  const donorHours0 = 70 * E.hoursPerHeadDay(donor, cfg.engine) * 7;
  const preRedialReq = E.reqCurve(donor, donor.dailyVolume, cfg.engine, new Map()).hours * 7;
  const spare = Math.max(0, donorHours0 - preRedialReq);
  ok(ws.reqHours > spare + 5, "test setup: need should exceed spare");
  eq(ws.hours, spare, 1, "recipient hours = donor spare when need exceeds it");
  eq(wd.hours, preRedialReq, 1, "donor floor: keeps exactly its allocation-time requirement");

  // Case B: donor spare ≫ need → recipient served exactly to its
  // allocation-time requirement (redial then nudges the reported reqHours up).
  donor.fte = 200;
  sim = E.simulate(cfg, { strategy: "S4" });
  ws = sim.weeks[0].queues[sup.id];
  const supPreRedialReq = E.reqCurve(sup, sup.dailyVolume, cfg.engine, new Map()).hours * 7;
  eq(ws.hours, supPreRedialReq, 1, "recipient fully served when spare exceeds need");
  ok(ws.cover > 0.97, "recipient coverage ≈ 100% when fully served, got " + ws.cover.toFixed(3));
  ok(sim.weeks[0].queues[donor.id].cover >= 1, "big donor stays above 100%");

  // Case C: donor below its own requirement → no donation at all.
  donor.fte = 40;
  sim = E.simulate(cfg, { strategy: "S4" });
  eq(sim.weeks[0].queues[sup.id].hours, 0, 1e-6, "starved donor must not donate");
});

/* ---------------- 4. Custom strategies ---------------- */
console.log("\n[4] Custom strategies — parameterised buffer, excluded queues");
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
t("custom {buffer 0.2} settles ≈ requirement × 1.2", () => {
  const cfg = calmConfig();
  cfg.queues[0].fte = 45;
  cfg.hiring.buffer = 0.1; // must be ignored in favour of the strategy's own 0.2
  cfg.strategies.push({ id: "CB", name: "Custom buffer", baseType: "buffer", bufferPct: 0.2 });
  const sim = E.simulate(cfg, { strategy: "CB" });
  const last = sim.weeks[sim.weeks.length - 1].queues[cfg.queues[0].id];
  eq(last.paid / last.reqFte, 1.2, 0.06, "end paid/required ratio");
});
t("excludedQueueIds queue gets no reqs while the other queue hires", () => {
  const cfg = E.makeDefaultConfig();
  cfg.scenarios.forEach((s) => (s.enabled = s.type === "growth"));
  cfg.serviceTeams = [];
  cfg.queues = cfg.queues.filter((q) => q.type === "voice");
  cfg.queues.forEach((q) => (q.crossSkill = []));
  cfg.hiring.cap = 1000;
  const [qa, qb] = cfg.queues;
  cfg.strategies.push({ id: "CX", name: "Meet minus B", baseType: "meet", excludedQueueIds: [qb.id] });
  const sim = E.simulate(cfg, { strategy: "CX" });
  const reqsA = sim.weeks.reduce((a, w) => a + w.queues[qa.id].reqsRaised, 0);
  const reqsB = sim.weeks.reduce((a, w) => a + w.queues[qb.id].reqsRaised, 0);
  ok(reqsA > 1, "non-excluded queue should hire under growth, got " + reqsA.toFixed(1));
  eq(reqsB, 0, 1e-9, "excluded queue must raise zero reqs");
});

/* ---------------- 5. Strategy schedule ---------------- */
console.log("\n[5] Strategy schedule — S3 until week 10, S1 after");
t("pre-pivot ≡ pure S3; pivot week closes the gap; totals ordered S3 < schedule < S1", () => {
  const cfg = E.makeDefaultConfig();
  cfg.scenarios.forEach((s) => (s.enabled = s.type === "growth"));
  cfg.serviceTeams = [];
  cfg.queues = [cfg.queues[0]];
  cfg.queues[0].crossSkill = [];
  cfg.hiring.cap = 1000; // never binding — keeps the comparison clean
  cfg.strategies.push({
    id: "SCH", name: "S3 then S1", baseType: "schedule",
    segments: [{ fromWeek: 1, strategyId: "S3" }, { fromWeek: 11, strategyId: "S1" }],
  });
  const qid = cfg.queues[0].id;
  const sched = E.simulate(cfg, { strategy: "SCH" });
  const s3 = E.simulate(cfg, { strategy: "S3" });
  const s1 = E.simulate(cfg, { strategy: "S1" });

  // Weeks 0..9 the schedule IS S3: identical decisions, identical evolution.
  for (let w = 0; w < 10; w++) {
    eq(sched.allocTrace[w].want, s3.allocTrace[w].want, 1e-6, `week ${w + 1} want ≠ pure S3`);
  }
  // Pre-pivot reqs ≈ projected leavers only (the S3 signature).
  const reqsPre = sched.weeks.slice(0, 10).reduce((a, w) => a + w.queues[qid].reqsRaised, 0);
  const leaversPre = sched.weeks.slice(0, 10).reduce((a, w) => a + w.queues[qid].leavers, 0);
  ok(reqsPre <= leaversPre * 1.35 + 2, `pre-pivot reqs ${reqsPre.toFixed(1)} exceed leavers ${leaversPre.toFixed(1)}`);
  // At the pivot, S1 takes over and raises a gap-closing want well above S3's.
  ok(sched.allocTrace[10].want > s3.allocTrace[10].want + 2,
    `no pivot spike: sched ${sched.allocTrace[10].want.toFixed(1)} vs S3 ${s3.allocTrace[10].want.toFixed(1)}`);
  // Totals sit strictly between the pure runs. The upper gap is small by
  // design: later hires decay less before landing, so the schedule converges
  // toward S1's total — the assertion is strict ordering, not a fat margin.
  const tot = (sim) => sim.weeks.reduce((a, w) => a + w.queues[qid].reqsRaised, 0);
  ok(tot(s3) < tot(sched) - 1, `schedule ${tot(sched).toFixed(1)} should exceed S3 ${tot(s3).toFixed(1)}`);
  ok(tot(sched) < tot(s1) - 0.05, `schedule ${tot(sched).toFixed(1)} should trail S1 ${tot(s1).toFixed(1)}`);
  // And the schedule ends better-staffed than pure S3.
  ok(sched.weeks[25].queues[qid].paid > s3.weeks[25].queues[qid].paid + 1, "schedule should end above S3");
});
t("a self-referencing schedule cannot loop (cycle guard falls back to meet)", () => {
  const cfg = E.makeDefaultConfig();
  cfg.strategies.push({ id: "LOOP", name: "loop", baseType: "schedule", segments: [{ fromWeek: 1, strategyId: "LOOP" }] });
  const s = E.strategyAt(cfg, "LOOP", 5);
  eq(s.baseType === "meet" ? 1 : 0, 1, 0, "cycle guard");
});

/* ---------------- 6. Global starting HC ---------------- */
console.log("\n[6] Global starting HC — workload-weighted spread over blanks");
t("blanks share (global − Σ explicit) by volume × AHT ÷ concurrency; explicit untouched", () => {
  const cfg = E.makeDefaultConfig();
  cfg.scenarios.forEach((s) => (s.enabled = false));
  cfg.serviceTeams = [];
  cfg.queues = cfg.queues.filter((q) => q.type === "voice");
  const [q1, q2] = cfg.queues;
  cfg.queues.forEach((q) => { q.crossSkill = []; q.wf.attrition = 0; });
  // q3: digital blank whose workload weight equals q2's exactly:
  // q2 voice 1000 × 300 ÷ 1 = 300000; q3 digital 1000 × 600 ÷ 2 = 300000.
  const q3 = JSON.parse(JSON.stringify(cfg.queues.find((q) => q.id === "q_tech")));
  q3.id = "q_dig"; q3.name = "Digital blank"; q3.type = "digital"; q3.concurrency = 2;
  q3.aht = 600; q3.crossSkill = []; q3.supports = [];
  cfg.queues.push(q3);
  q1.fte = 50;
  q2.fte = null; q2.dailyVolume = 1000; q2.aht = 300;
  q3.fte = null; q3.dailyVolume = 1000;
  cfg.engine.globalStartingHC = 130; // pool = 130 − 50 = 80 → 40 / 40
  const hc = E.resolveStartingHC(cfg);
  eq(hc[q1.id], 50, 1e-9, "explicit HC untouched");
  eq(hc[q2.id], 40, 1e-6, "blank voice share");
  eq(hc[q3.id], 40, 1e-6, "blank digital share (concurrency divides workload)");
  eq(hc[q1.id] + hc[q2.id] + hc[q3.id], 130, 1e-6, "shares sum to global");
  // and it flows into the sim: week-0 startingHC + paid
  cfg.engine.horizonWeeks = 1;
  const sim = E.simulate(cfg, { strategy: "S4" });
  eq(sim.weeks[0].queues[q2.id].startingHC, 40, 1e-6, "weekly record startingHC");
  eq(sim.weeks[0].queues[q2.id].paid, 40, 1e-6, "week-0 paid = resolved HC");
});
t("no global set: blanks resolve to 0; supported queues excluded from the spread", () => {
  const cfg = E.makeDefaultConfig();
  const bill = cfg.queues.find((q) => q.id === "q_bill");
  const tech = cfg.queues.find((q) => q.id === "q_tech");
  bill.fte = null;
  const hcNoGlobal = E.resolveStartingHC(cfg);
  eq(hcNoGlobal[bill.id], 0, 1e-9, "blank without global gets 0");
  tech.resourcing = "supported"; tech.fte = 47;
  cfg.engine.globalStartingHC = 100;
  const hc = E.resolveStartingHC(cfg);
  eq(hc[tech.id], 0, 1e-9, "supported queue forced to 0 despite explicit fte");
  // supported queue's explicit fte must not count toward the explicit sum
  const explicit = cfg.queues.filter((q) => q.resourcing !== "supported" && q.fte != null).reduce((a, q) => a + q.fte, 0);
  const blankSum = Object.entries(hc).filter(([id]) => id === bill.id).reduce((a, [, v]) => a + v, 0);
  eq(blankSum, Math.max(0, 100 - explicit), 1e-6, "pool excludes supported queue's fte");
});

/* ---------------- 7. growth stopWeek ---------------- */
console.log("\n[7] growth stopWeek — multiplier holds flat after the stop");
t("volume at stopWeek+k equals volume at stopWeek for all k", () => {
  const cfg = E.makeDefaultConfig();
  const q = cfg.queues[0];
  const g = cfg.scenarios.find((s) => s.type === "growth");
  g.p.rate = 0.02; g.startWeek = 0; g.p.stopWeek = 8;
  const ids = new Set([g.id]);
  const v0 = E.exogenousVolume(q, 0, 0, cfg, ids);
  const v8 = E.exogenousVolume(q, 8, 0, cfg, ids);
  eq(v8 / v0, Math.pow(1.02, 8 / 4.345), 1e-9, "compounding up to the stop");
  for (let k = 1; k <= 12; k++) {
    eq(E.exogenousVolume(q, 8 + k, 0, cfg, ids), v8, 1e-9, `week ${9 + k} should hold flat`);
  }
});

/* ---------------- 8. growthManual ---------------- */
console.log("\n[8] growthManual — single-week override of the compounding multiplier");
t("override applies only in listed weeks; other weeks compound as before", () => {
  const cfg = E.makeDefaultConfig();
  const q = cfg.queues[0];
  const g = cfg.scenarios.find((s) => s.type === "growth");
  g.p.rate = 0.02; g.startWeek = 0;
  cfg.scenarios.push({ id: "sc_gm", type: "growthManual", name: "Manual growth", enabled: true, startWeek: 0, queueIds: "all", p: { weeklyPct: { 5: 0.5 } } });
  const growthOnly = new Set([g.id]);
  const both = new Set([g.id, "sc_gm"]);
  for (const w of [0, 1, 3, 4, 6, 7, 12]) {
    eq(E.exogenousVolume(q, w, 0, cfg, both), E.exogenousVolume(q, w, 0, cfg, growthOnly), 1e-9, `week ${w + 1} should be untouched`);
  }
  eq(E.exogenousVolume(q, 5, 0, cfg, both), q.dailyVolume * 1.5, 1e-9, "week 6 = base × (1 + 0.5), replacing the compound");
  // manual alone: listed week × 1.5, others × 1
  const alone = new Set(["sc_gm"]);
  eq(E.exogenousVolume(q, 5, 0, cfg, alone), q.dailyVolume * 1.5, 1e-9, "manual-only listed week");
  eq(E.exogenousVolume(q, 4, 0, cfg, alone), q.dailyVolume, 1e-9, "manual-only unlisted week");
});

/* ---------------- 9. freezeManual ---------------- */
console.log("\n[9] freezeManual — zero reqs in listed weeks only");
t("weeks [2,3] raise nothing; surrounding weeks hire as usual", () => {
  const cfg = E.makeDefaultConfig();
  cfg.scenarios.forEach((s) => (s.enabled = s.type === "growth"));
  cfg.serviceTeams = [];
  cfg.queues = [cfg.queues[0]];
  cfg.queues[0].crossSkill = [];
  cfg.queues[0].fte = 50; // below requirement → wants every week
  cfg.hiring.cap = 1000;
  cfg.engine.horizonWeeks = 8;
  const growthId = cfg.scenarios.find((s) => s.type === "growth").id;
  cfg.scenarios.push({ id: "sc_fm", type: "freezeManual", name: "Manual freeze", enabled: true, startWeek: 0, queueIds: "all", p: { weeks: [2, 3] } });
  const sim = E.simulate(cfg, { viewIds: [growthId, "sc_fm"], strategy: "S1" });
  const qid = cfg.queues[0].id;
  eq(sim.weeks[2].queues[qid].reqsRaised, 0, 1e-9, "frozen week 3");
  eq(sim.weeks[3].queues[qid].reqsRaised, 0, 1e-9, "frozen week 4");
  eq(sim.allocTrace[2].want, 0, 1e-9, "no wants surface in a frozen week");
  ok(sim.weeks[0].queues[qid].reqsRaised > 1, "week 1 hires normally");
  ok(sim.weeks[4].queues[qid].reqsRaised > 0.5, "week 5 resumes after the freeze");
});

/* ---------------- 10. Reporting fields + hiring summary ---------------- */
console.log("\n[10] Weekly record fields and hiring summary");
t("weekly record carries startingHC, active, attrition-in-effect; spot-check values", () => {
  const cfg = E.makeDefaultConfig();
  const sim = E.simulate(cfg, { strategy: "S1" });
  const w0 = sim.weeks[0].queues["q_bill"];
  eq(w0.startingHC, 63, 1e-9, "billing startingHC = configured 63");
  eq(w0.active, w0.trained + w0.ramp, 1e-9, "active = trained + ramping");
  eq(w0.active, w0.paid - w0.training, 1e-6, "active excludes trainees");
  eq(w0.attrInEffect, 0.04, 1e-3, "attrition in effect ≈ configured 4%/mo at week 0");
  ok(w0.resourcing === "resourced", "resourcing mode exposed");
  ok(sim.weeks[0].totals.active > 0, "totals.active aggregated");
});
t("hiring summary aggregates reconcile with the weekly records", () => {
  const cfg = E.makeDefaultConfig();
  const sim = E.simulate(cfg, { strategy: "S1" });
  const h = sim.summary.hiring;
  ok(h && h.queues && h.groups, "summary.hiring present");
  const qids = cfg.queues.map((q) => q.id);
  for (const qid of qids) {
    const row = h.queues[qid];
    const series = sim.weeks.map((w) => w.queues[qid]);
    eq(row.volume, series.reduce((a, s) => a + s.volume, 0), 1e-6, qid + " volume");
    eq(row.churnCount, series.reduce((a, s) => a + s.leavers, 0), 1e-6, qid + " churn count");
    eq(row.hiring, series.reduce((a, s) => a + s.reqsRaised, 0), 1e-6, qid + " total reqs");
    eq(row.active, series[series.length - 1].active, 1e-9, qid + " end active");
  }
  const g = h.groups;
  eq(g.overall.volume, qids.reduce((a, qid) => a + h.queues[qid].volume, 0), 1e-6, "overall volume = Σ queues");
  eq(g.voice.active + g.digital.active, g.overall.active, 1e-6, "voice + digital = overall active");
  ok(g.overall.churnPct > 0 && g.overall.churnPct < 1, "overall churn % sane: " + g.overall.churnPct.toFixed(3));
});

/* ---------------- summary ---------------- */
console.log("\n═══════════════════════════════════");
console.log(`${pass} passed, ${fail} failed`);
console.log(fail === 0 ? "P6a GATE: GREEN" : "P6a GATE: RED");
if (fail > 0) { failures.forEach((f) => console.log("  - " + f)); process.exitCode = 1; }
