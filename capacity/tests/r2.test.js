/* P7a gate — SPEC §15–§21 Revision 2 engine battery (§22 test list). Same
   zero-dep harness as the P1/R1 tests. The P1 battery and R1 battery running
   unchanged are the hard regression gate; this file covers only R2 behaviour.

   Exact-arithmetic scaffold (same trick as r1.test.js): digital queues have a
   LINEAR requirement (hours = volume × AHT ÷ concurrency ÷ 3600 ÷ ceiling), so
   with AHT 3600 s, concurrency 1, occupancyCeiling 1, shrinkage-free 8 h heads
   and daysWorkedPerFte = daysPerWeek = 7, requirement hours/day equals
   dailyVolume and every deficit / spare / rung grant below is hand-exact. */
const E = require("../engine/engine.js");

let pass = 0, fail = 0;
const failures = [];
function t(name, fn) {
  try { fn(); pass++; console.log("  ✓ " + name); }
  catch (e) { fail++; failures.push(name + ": " + e.message); console.log("  ✗ " + name + " — " + e.message); }
}
function eq(a, b, tol, what) {
  if (!(Math.abs(a - b) <= tol)) throw new Error(`${what || "value"} ${a} ≠ ${b} ±${tol}`);
}
function ok(cond, what) { if (!cond) throw new Error(what || "condition failed"); }

// One head = exactly 8 h/day; req hours/day = dailyVolume (see header).
function rigCfg(over = {}) {
  return {
    engine: { horizonWeeks: 24, dayStart: 8, dayEnd: 20, intervalMin: 30, occupancyCeiling: 1, currency: "£", daysPerWeek: 7, hoursPerFteDay: 8, daysWorkedPerFte: 7, crossSkillProficiency: 1, globalStartingHC: null },
    settings: {},
    brands: [
      { id: "b1", name: "Brand 1", training: null, dailyVolume: null, weeklyVolumes: null },
      { id: "b2", name: "Brand 2", training: null, dailyVolume: null, weeklyVolumes: null },
    ],
    pools: [], groups: [],
    hiring: { cap: 999, buffer: 0.1, activeStrategy: "S4" }, // S4 manual + no hires = frozen HC
    strategies: E.BUILTIN_STRATEGIES.map((s) => ({ ...s })),
    seasonality: { startMonth: 0, system: [...E.SEASONAL_PRESETS["Flat"]] },
    queues: [], serviceTeams: [],
    costs: { managerCost: 0, managerRatio: 1e9 },
    cx: { customerBase: 0, costPerLostCustomer: 0, churnAbandon: 0, churnWait: 0, churnDigital: 0, repeatUplift: 1 },
    loops: { redial: 0, deflection: 0 },
    views: [{ id: "v_por", name: "Plan of record", builtin: true }],
    scenarios: [],
    ...over,
  };
}
function dq(cfg, id, reqHoursPerDay, over = {}) {
  const q = {
    id, name: id, type: "digital", brandId: "b1", channel: "digital", priority: 5,
    dailyVolume: reqHoursPerDay, aht: 3600, concurrency: 1,
    profile: new Array(24).fill(1), digitalSlaMinutes: 60, digitalSlaPct: 0.8, backlogLimit: 1e9,
    deflectsTo: null, shrinkage: 0, fte: 0, agentCost: 30000, crossSkill: [], supports: [],
    weeklyVolumes: null, seasonal: null, asaTarget: 30, maxAbandon: 0.05, patience: 90,
    resourcing: "dedicated",
    wf: { attrition: 0, attritionGrowth: 0, reqToStart: 6, trainingWeeks: 4, learningCurve: [1], hires: [] },
    burn: { occThreshold: 2, sensitivity: 0, recovery: 0, maxAttritionMult: 1, absenceUplift: 0 },
    ...over,
  };
  cfg.queues.push(q);
  return q;
}
const wq = (sim, w, id) => sim.weeks[w].queues[id];

/* ---------------- 1. §17 rung 2 — overtime (hand) ---------------- */
console.log("\n[1] Overtime — uplift formula, premium cost, burnout feed, streak");
t("OT = min(2×daysWorked, ceiling)×agents exactly; costed at premium; burnout +load; streak counts", () => {
  const cfg = rigCfg();
  dq(cfg, "qo", 60, { fte: 5 }); // own 5×8=40 h/day, req 60 → deficit 20/day
  const sim = E.simulate(cfg);
  const q0 = wq(sim, 0, "qo");
  // weekly OT budget = min(2 h/day × 7 daysWorked, 10 h ceiling) × 5 heads = 50 h;
  // daily bound 2×5 = 10 h; deficit 20/day → 10 granted on days 0–4, 0 after.
  eq(q0.otHours, 50, 1e-9, "weekly otHours");
  eq(q0.hours, 40 * 7 + 50, 1e-9, "hours incl. OT");
  // hourly = 30000/52/(8×7); premium ×1.5 (Settings default)
  const otCost = 50 * (30000 / 52 / 56) * 1.5;
  eq(q0.otCost, otCost, 1e-6, "otCost");
  eq(sim.weeks[0].totals.otHours, 50, 1e-9, "totals.otHours");
  eq(sim.weeks[0].totals.totalCost - sim.weeks[0].totals.cost, otCost, 1e-6, "totalCost includes otCost");
  // burnout: occupancy path disabled (threshold 2, recovery 0) → wk0 = burnoutLoad × (50/50) = 10
  eq(q0.burnout, 10, 1e-9, "burnout feed from OT");
  eq(q0.otStreakWeeks, 1, 1e-9, "streak wk0");
  eq(wq(sim, 1, "qo").otStreakWeeks, 2, 1e-9, "streak wk1");
  eq(wq(sim, 2, "qo").otStreakWeeks, 3, 1e-9, "streak wk2");
});

/* ---------------- 2. §17 rung 3 — reclaim strictly after OT (hand) ---------------- */
console.log("\n[2] Training reclaim — engages only past the OT cap; debt accrues ∝ share; AHT penalty");
t("OT exhausts first, reclaim covers the rest; debt = accumRate×share; AHT ×(1+debt%×8%)", () => {
  const cfg = rigCfg();
  dq(cfg, "qr", 42, { fte: 5, shrinkage: 0.3, wf: { attrition: 0, attritionGrowth: 0, reqToStart: 6, trainingWeeks: 4, learningCurve: [1], trainingShrinkagePct: 0.2, hires: [] } });
  // own = 5×8×0.7 = 28 h/day; deficit 14/day. OT: 10/day (weekly 50).
  // reclaim cap = min(20%, 30% shrinkage) × 5 heads × 8 h = 8 h/day.
  // Days 0–4: OT 10 + reclaim 4. Days 5–6 (OT spent): reclaim 8.
  const sim = E.simulate(cfg);
  const q0 = wq(sim, 0, "qr");
  eq(q0.otHours, 50, 1e-9, "otHours");
  eq(q0.reclaimedHours, 5 * 4 + 2 * 8, 1e-9, "reclaimedHours (36 proves OT-first order)");
  // debt wk0 = accumRate 20 × share (36 / weekly cap 56) = 90/7
  eq(q0.trainingDebt, 20 * (36 / 56), 1e-6, "trainingDebt wk0");
  // wk1 AHT in effect = 3600 × (1 + (90/7)/100 × 0.08)
  eq(wq(sim, 1, "qr").ahtInEffect, 3600 * (1 + (90 / 7 / 100) * 0.08), 1e-6, "AHT penalty wk1");
  eq(q0.ahtInEffect, 3600, 1e-9, "wk0 AHT untouched (debt lands next week)");
});

/* ---------------- 3. §19 forced reclaim + §17 debt decay (hand) ---------------- */
console.log("\n[3] people.trainingShrinkage scenario — forces reclaim without deficit; debt decays on restore");
t("debt walks [10, 20, 10, 0]; attrition multiplier tracks debt", () => {
  const cfg = rigCfg({
    scenarios: [{
      id: "s_force", type: "unified", name: "force reclaim", enabled: true, tag: "custom",
      parameter: "people", mechanism: "step", granularity: "week",
      startWeek: 0, stopWeek: 2, queueIds: ["qf"], p: { kind: "trainingShrinkage", value: 0.5 },
    }],
  });
  dq(cfg, "qf", 20, { fte: 10, shrinkage: 0.3, wf: { attrition: 0.04, attritionGrowth: 0, reqToStart: 6, trainingWeeks: 4, learningCurve: [1], trainingShrinkagePct: 0.2, hires: [] } });
  // own 56 h/day vs req 20 → NO deficit; scenario forces 0.5 × reclaim cap anyway.
  // share = 0.5 exactly (independent of HC), so debt: +20×0.5, +10, then −recoveryRate 10:
  const sim = E.simulate(cfg);
  eq(wq(sim, 0, "qf").trainingDebt, 10, 1e-9, "wk0 debt");
  eq(wq(sim, 1, "qf").trainingDebt, 20, 1e-9, "wk1 debt");
  eq(wq(sim, 2, "qf").trainingDebt, 10, 1e-9, "wk2 debt (decays: window closed)");
  eq(wq(sim, 3, "qf").trainingDebt, 0, 1e-9, "wk3 debt");
  ok(wq(sim, 0, "qf").reclaimedHours > 1e-9, "reclaim engaged without deficit");
  // attrition in effect = base × (1 + debt/100 × (maxAttritionMult−1)), debt from the PRIOR week's rollup
  eq(wq(sim, 1, "qf").attrInEffect, 0.04 * (1 + (10 / 100) * 0.5), 1e-9, "wk1 attrition ×1.05 at debt 10");
  eq(wq(sim, 2, "qf").attrInEffect, 0.04 * (1 + (20 / 100) * 0.5), 1e-9, "wk2 attrition ×1.10 at debt 20");
});

/* ---------------- 4. §16 brand training profiles (hand landing weeks) ---------------- */
console.log("\n[4] Brand training — cohorts graduate on their brand's schedule");
t("brand A (2 wk) lands week 2; brand B (5 wk) lands week 5 — same hire, same reqToStart", () => {
  const cfg = rigCfg();
  cfg.brands[0].training = { trainingWeeks: 2, learningCurve: [1], trainingShrinkagePct: 0.05 };
  cfg.brands[1].training = { trainingWeeks: 5, learningCurve: [1], trainingShrinkagePct: 0.05 };
  // wf deliberately omits trainingWeeks/learningCurve → resolution falls to the brand profile
  const wfa = { attrition: 0, attritionGrowth: 0, reqToStart: 1, hires: [{ week: 0, heads: 10 }] };
  dq(cfg, "qa", 20, { brandId: "b1", fte: 5, wf: { ...wfa, hires: [{ week: 0, heads: 10 }] } });
  dq(cfg, "qb", 20, { brandId: "b2", fte: 5, wf: { ...wfa, hires: [{ week: 0, heads: 10 }] } });
  const sim = E.simulate(cfg, { strategy: "S4" });
  // land = reqToStart + brandTrainingWeeks − 1 (grant week 0; the training-entry
  // week already counts down): qa → wk 2, qb → wk 5.
  eq(wq(sim, 1, "qa").active, 5, 1e-6, "qa active pre-landing");
  eq(wq(sim, 1, "qa").training, 10, 1e-6, "qa cohort in training wk1");
  eq(wq(sim, 2, "qa").active, 15, 1e-6, "qa lands wk2 (2-week brand schedule)");
  eq(wq(sim, 4, "qb").active, 5, 1e-6, "qb active pre-landing");
  eq(wq(sim, 4, "qb").training, 10, 1e-6, "qb cohort still training wk4");
  eq(wq(sim, 5, "qb").active, 15, 1e-6, "qb lands wk5 (5-week brand schedule)");
});

/* ---------------- 5. §17 rung 4 — recycling beats pools; donor floor (hand) ---------------- */
console.log("\n[5] Intra-brand recycling — spare reaches unmanned before any pool; donor never below requirement");
t("unmanned queue filled by same-brand leveraged spare; pool untouched; honest green SLA", () => {
  const cfg = rigCfg({
    pools: [{ id: "pool1", name: "Shared", members: [{ queueId: "p", sharePct: 100 }, { queueId: "u", sharePct: 100 }] }],
  });
  dq(cfg, "dl", 20, { fte: 10, resourcing: "leveraged" });            // b1: own 80, spare 60
  dq(cfg, "u", 20, { fte: 0, resourcing: "unmanned", priority: 1 });  // b1: req 20/day, 0 staff
  dq(cfg, "p", 20, { brandId: "b2", fte: 10 });                        // b2 pool donor: spare 60
  const sim = E.simulate(cfg);
  const u0 = wq(sim, 0, "u"), dl0 = wq(sim, 0, "dl");
  eq(u0.recycledIn, 20 * 7, 1e-6, "unmanned filled by recycling (140 h)");
  eq(u0.poolIn, 0, 1e-9, "pool untouched — recycling ran first");
  eq(u0.cover, 1, 1e-6, "full cover");
  ok(u0.status === "green", "unmanned RAG is real and green at full cover, got " + u0.status);
  ok(u0.resourcing === "unmanned", "resourcing field carried");
  ok(dl0.hours >= dl0.reqHours - 1e-9, "donor never below own requirement");
  eq(dl0.hours, 80 * 7 - 140, 1e-6, "donor charged exactly what it gave");
});

/* ---------------- 6. §17 rung 5 — pool pro-rata 2:1, cross-brand, no priorities (hand) ---------------- */
console.log("\n[6] Pools — deficits 6:3 share spare 2:1; cross-brand; priority numbers ignored");
t("recipients get 4 and 2 h/day of the donor's 6 spare; better priority does NOT jump the queue", () => {
  const cfg = rigCfg({
    settings: { ot: { weeklyCeiling: 0 } }, // §16 partial Settings override: OT off isolates the pool rung
    pools: [{ id: "pool1", name: "Shared", members: [{ queueId: "d", sharePct: 100 }, { queueId: "r1", sharePct: 100 }, { queueId: "r2", sharePct: 100 }] }],
  });
  dq(cfg, "d", 18, { brandId: "b2", fte: 3 });                 // own 24, spare 6/day
  dq(cfg, "r1", 14, { fte: 1, priority: 9 });                  // deficit 6/day, WORSE priority
  dq(cfg, "r2", 11, { fte: 1, priority: 1 });                  // deficit 3/day, BETTER priority
  const sim = E.simulate(cfg);
  eq(wq(sim, 0, "r1").poolIn, 4 * 7, 1e-6, "r1 pool share (6/9 of 6 = 4/day)");
  eq(wq(sim, 0, "r2").poolIn, 2 * 7, 1e-6, "r2 pool share (3/9 of 6 = 2/day)");
  ok(wq(sim, 0, "r2").poolIn < wq(sim, 0, "r1").poolIn, "priority ignored: pro-rata by deficit only");
  eq(wq(sim, 0, "d").cover, 1, 1e-6, "cross-brand donor lands exactly at its own requirement");
});

/* ---------------- 7. §17 rung 5 — pool training feed, capped (hand) ---------------- */
console.log("\n[7] Pools — members reclaim training to feed the pool, capped at trainingShrinkagePct");
t("feed = full reclaim cap 6 h/day; donor holds requirement; donor debt accrues (20)", () => {
  const cfg = rigCfg({
    settings: { ot: { weeklyCeiling: 0 } },
    pools: [{ id: "pool1", name: "Shared", members: [{ queueId: "a", sharePct: 100 }, { queueId: "b", sharePct: 100 }, { queueId: "c", sharePct: 100 }] }],
  });
  dq(cfg, "a", 6, { brandId: "b2", fte: 3, shrinkage: 0.5, wf: { attrition: 0, attritionGrowth: 0, reqToStart: 6, trainingWeeks: 4, learningCurve: [1], trainingShrinkagePct: 0.25, hires: [] } });
  // a: own 3×8×0.5 = 12 h/day, spare 6; reclaim cap 0.25×3×8 = 6 h/day
  dq(cfg, "b", 28, { fte: 1 }); // deficit 20/day
  dq(cfg, "c", 11, { fte: 1 }); // deficit 3/day
  // joint demand 23 > spare 6 → feed 6 (full cap) → 12 shared pro-rata 20:3
  const sim = E.simulate(cfg);
  eq(wq(sim, 0, "a").reclaimedHours, 6 * 7, 1e-6, "feed capped at trainingShrinkagePct (42 h/wk)");
  eq(wq(sim, 0, "a").trainingDebt, 20, 1e-6, "full reclaim share → debt +accumRate");
  eq(wq(sim, 0, "a").cover, 1, 1e-6, "donor never below requirement");
  eq(wq(sim, 0, "b").poolIn, (12 * 20 / 23) * 7, 1e-6, "b pro-rata share");
  eq(wq(sim, 0, "c").poolIn, (12 * 3 / 23) * 7, 1e-6, "c pro-rata share");
  eq(wq(sim, 0, "b").poolIn + wq(sim, 0, "c").poolIn, 12 * 7, 1e-6, "spare + feed fully distributed");
});

/* ---------------- 8. §17 rung 6 — leveraged sacrifice (hand) ---------------- */
console.log("\n[8] Leveraged pull — surrenders below own requirement up to the weekly cap; RAGs honestly");
t("target draws exactly the 105 h cap; donor cover 175/245; donor SLA goes honest-red", () => {
  const cfg = rigCfg({ settings: { ot: { weeklyCeiling: 0 } } });
  dq(cfg, "l", 35, { fte: 5, resourcing: "leveraged", leverage: { capHoursPerWeek: 105, targets: ["t"] } }); // own 40/day, req 35
  dq(cfg, "t", 60, { fte: 5 }); // own 40/day, deficit 20/day
  const sim = E.simulate(cfg);
  const l0 = wq(sim, 0, "l"), t0 = wq(sim, 0, "t");
  // days 0–4: gives 20/day (100 h); day 5: cap remainder 5; day 6: 0 → 105 total
  eq(t0.leveragedIn, 105, 1e-6, "target received the full weekly cap");
  eq(l0.hours, 280 - 105, 1e-6, "donor surrendered below its requirement");
  eq(l0.cover, 175 / 245, 1e-6, "donor cover 0.714 — sacrifice is real");
  ok(l0.sl < 0.8 && l0.status !== "green", "donor RAG honest: sl " + l0.sl.toFixed(3) + " status " + l0.status);
  eq(t0.borrowedSharePct, 105 / 420, 1e-6, "target borrowedSharePct = 0.25");
});
t("targets 'priority-above' pulls to higher-priority queues across brands (§17 — no brand qualifier)", () => {
  const cfg = rigCfg({ settings: { ot: { weeklyCeiling: 0 } } });
  // Donor in b1 at priority 5; a higher-priority (1) deficit target sits in b2.
  dq(cfg, "l", 35, { fte: 5, priority: 5, resourcing: "leveraged", leverage: { capHoursPerWeek: 105, targets: "priority-above" } });
  dq(cfg, "t", 60, { brandId: "b2", fte: 5, priority: 1 });
  const sim = E.simulate(cfg);
  // priority-above is global (like the explicit-list form), so the cross-brand
  // higher-priority target draws the full weekly cap — identical to test 8.
  eq(wq(sim, 0, "t").leveragedIn, 105, 1e-6, "cross-brand priority-above target draws the cap");
  eq(wq(sim, 0, "l").cover, 175 / 245, 1e-6, "donor sacrifices below requirement");
});

/* ---------------- 9. §21 service teams → leveraged support queues ---------------- */
console.log("\n[9] Migration — service teams deleted, reborn as leveraged support queues");
t("size→HC, cap = size×maxHoursPerWeek, targets = coversQueues, premium kept as note", () => {
  const m = E.migrateServiceTeamsToLeveraged(E.makeDefaultConfig());
  ok(m.serviceTeams.length === 0, "serviceTeams emptied");
  const q = m.queues.find((x) => x.id === "q_st_1");
  ok(q, "migrated queue exists");
  ok(q.resourcing === "leveraged" && q.channel === "support", "leveraged support queue");
  eq(q.fte, 12, 1e-9, "size → HC");
  eq(q.leverage.capHoursPerWeek, 12 * 20, 1e-9, "trigger cap heuristic = size × maxHoursPerWeek");
  ok(q.leverage.targets.includes("q_bill") && q.leverage.targets.includes("q_tech"), "targets = coversQueues");
  eq(q.leverage.premiumPct, 0.2, 1e-9, "premium retained as cost note");
  const again = E.migrateServiceTeamsToLeveraged(m);
  ok(again.queues.length === m.queues.length, "idempotent");
  const sim = E.simulate(m);
  eq(sim.weeks[0].totals.serviceCost, 0, 1e-9, "no legacy service-team cost path");
});

/* ---------------- 10. §15/§18 volume profiles (hand) ---------------- */
console.log("\n[10] Profiles — blended AHT = Σ share×aht; share-shift scenario moves requirement");
t("60/40 of 3600/7200 blends to 5040; shifting to 20/80 lifts req by exactly 9/7", () => {
  const prof = { segments: [{ label: "easy", sharePct: 60, aht: 3600 }, { label: "hard", sharePct: 40, aht: 7200 }] };
  eq(E.blendedAht({ aht: 3600, volumeProfile: prof }), 0.6 * 3600 + 0.4 * 7200, 1e-9, "blended AHT (hand: 5040)");
  eq(E.blendedAht({ aht: 3600, volumeProfile: prof }, [20, 80]), 0.2 * 3600 + 0.8 * 7200, 1e-9, "override shares");
  eq(E.blendedAht({ aht: 3600, volumeProfile: { segments: [{ sharePct: 3, aht: 3600 }, { sharePct: 1, aht: 7200 }] } }), 4500, 1e-9, "shares auto-normalise");
  const base = rigCfg();
  dq(base, "qp", 20, { fte: 40, volumeProfile: prof });
  const s0 = E.simulate(base);
  eq(wq(s0, 0, "qp").ahtInEffect, 5040, 1e-6, "blended AHT is the AHT in effect");
  eq(wq(s0, 0, "qp").reqHours, 20 * (5040 / 3600) * 7, 1e-6, "req reflects the blend (196 h)");
  const shifted = rigCfg({
    scenarios: [{ id: "s_shift", type: "unified", name: "harder mix", enabled: true, tag: "digitization", parameter: "profileShares", mechanism: "step", granularity: "week", startWeek: 0, stopWeek: null, queueIds: ["qp"], p: { shares: [20, 80] } }],
  });
  dq(shifted, "qp", 20, { fte: 40, volumeProfile: prof });
  const s1 = E.simulate(shifted);
  eq(wq(s1, 0, "qp").ahtInEffect, 6480, 1e-6, "shifted blend");
  eq(wq(s1, 0, "qp").reqHours / wq(s0, 0, "qp").reqHours, 6480 / 5040, 1e-6, "req moved by exactly 9/7");
});

/* ---------------- 11. §18 brand volume split (hand) ---------------- */
console.log("\n[11] Brand volume split — shares normalise; explicit per-queue volumes win");
t("1200/day splits 2:1 → 800/400; the explicit-volume queue keeps 100 and stays out of the split", () => {
  const cfg = rigCfg();
  cfg.brands[0].dailyVolume = 1200;
  dq(cfg, "qx", 0, { dailyVolume: null, volumeShare: 2, fte: 200 });
  dq(cfg, "qy", 0, { dailyVolume: null, volumeShare: 1, fte: 100 });
  dq(cfg, "qz", 100, { volumeShare: 5, fte: 30 }); // explicit 100/day wins; share ignored
  eq(E.brandShareVolume(cfg, cfg.queues[0], 0), 800, 1e-9, "share 2 of 2+1 (qz excluded)");
  eq(E.brandShareVolume(cfg, cfg.queues[1], 0), 400, 1e-9, "share 1 of 2+1");
  const sim = E.simulate(cfg);
  eq(wq(sim, 0, "qx").baseVolume, 800 * 7, 1e-6, "qx weekly base");
  eq(wq(sim, 0, "qy").baseVolume, 400 * 7, 1e-6, "qy weekly base");
  eq(wq(sim, 0, "qz").baseVolume, 100 * 7, 1e-6, "explicit volume wins");
});

/* ---------------- 12. §19/§21 unified scenario migration ≤1% ---------------- */
console.log("\n[12] Unified scenarios — every migrated legacy type reproduces its numbers within 1%");
function pairFor(type, extraScenario) {
  const mk = () => {
    const c = E.makeDefaultConfig();
    if (extraScenario) c.scenarios.push(extraScenario());
    c.scenarios.forEach((s) => (s.enabled = s.type === type));
    return c;
  };
  const c1 = mk();
  const legacy = E.simulate(c1, { strategy: "S1" });
  const c2 = mk();
  c2.scenarios = c2.scenarios.map((s) => E.migrateScenarioToUnified(s, c2));
  ok(c2.scenarios.every((s) => s.type === "unified"), "migration produced non-unified scenario");
  const uni = E.simulate(c2, { strategy: "S1" });
  return { legacy, uni };
}
function within1pc(legacy, uni, label) {
  for (let w = 0; w < legacy.weeks.length; w++) {
    const a = legacy.weeks[w].totals.volume, b = uni.weeks[w].totals.volume;
    if (a > 1) ok(Math.abs(b / a - 1) < 0.01, `${label} wk${w} volume ${b.toFixed(1)} vs ${a.toFixed(1)}`);
  }
  const a = legacy.summary.allIn, b = uni.summary.allIn;
  if (Math.abs(a) > 1) ok(Math.abs(b / a - 1) < 0.01, `${label} allIn ${b.toFixed(0)} vs ${a.toFixed(0)}`);
}
for (const type of ["growth", "launch", "p1", "forecastError", "attritionShock", "reducedTraining"]) {
  t(`legacy ${type} ≈ unified migration (all weeks, ≤1%)`, () => {
    const { legacy, uni } = pairFor(type);
    within1pc(legacy, uni, type);
  });
}
t("legacy growthManual ≈ unified manualSeries with growth override (≤1%)", () => {
  const { legacy, uni } = pairFor("growthManual", () => ({ id: "sc_gm", type: "growthManual", name: "manual growth", enabled: false, startWeek: 0, queueIds: "all", p: { weeklyPct: { 5: 0.1, 6: -0.05, 20: 0.2 } } }));
  within1pc(legacy, uni, "growthManual");
});

/* The hiring-freeze family barely moves volume/all-in on the default config, so
   a volume-only parity check passes vacuously (a no-op migration would too).
   These effects live in the HIRING stream, so we compare the weekly reqsRaised
   pattern instead, with an anti-vacuity guard: the freeze must actually zero
   hiring in its window versus a no-scenario baseline before we assert the
   migration reproduces it. */
function freezeMigration(type, mkScenario, frozenWeeks, label) {
  const build = (migrate, enable) => {
    const c = E.makeDefaultConfig();
    if (mkScenario) c.scenarios.push(mkScenario());
    c.scenarios.forEach((s) => (s.enabled = enable && s.type === type));
    if (migrate) c.scenarios = c.scenarios.map((s) => E.migrateScenarioToUnified(s, c));
    return E.simulate(c, { strategy: "S1" });
  };
  const reqs = (sim, w) => sim.config.queues.reduce((a, q) => a + (sim.weeks[w].queues[q.id].reqsRaised || 0), 0);
  const baseline = build(false, false), legacy = build(false, true), uni = build(true, true);
  const baseHires = frozenWeeks.reduce((a, w) => a + reqs(baseline, w), 0);
  const legacyHires = frozenWeeks.reduce((a, w) => a + reqs(legacy, w), 0);
  ok(baseHires > 1, `${label}: baseline hires in the freeze window (${baseHires.toFixed(1)}) so the test is non-vacuous`);
  ok(legacyHires < baseHires * 0.05, `${label}: freeze zeroes hiring in its window (${legacyHires.toFixed(2)} << baseline ${baseHires.toFixed(1)})`);
  for (let w = 0; w < legacy.weeks.length; w++) eq(reqs(uni, w), reqs(legacy, w), 1e-6, `${label} wk${w} reqsRaised (migration reproduces the freeze)`);
}
t("legacy hiringFreeze ≈ unified people.hiringFreeze (weekly hiring pattern, non-vacuous)", () => {
  freezeMigration("hiringFreeze", null, [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17], "hiringFreeze");
});
t("legacy freezeManual ≈ unified manualSeries freeze (weekly hiring pattern, non-vacuous)", () => {
  freezeMigration("freezeManual", () => ({ id: "sc_fm", type: "freezeManual", name: "manual freeze", enabled: false, startWeek: 0, queueIds: "all", p: { weeks: [3, 4, 5, 6] } }), [3, 4, 5, 6], "freezeManual");
});
t("day-granular p1 manualSeries hits only its days", () => {
  const { legacy, uni } = pairFor("p1");
  // identical off-spike weeks, visible spike on week 12 ((7 + 2×1.5)/7 ≈ 1.43× volume)
  eq(uni.weeks[11].totals.volume, legacy.weeks[11].totals.volume, 1e-6, "wk11 identical");
  eq(uni.weeks[12].totals.volume, legacy.weeks[12].totals.volume, 1e-6, "wk12 identical");
  ok(uni.weeks[12].totals.volume > uni.weeks[11].totals.volume * 1.2, "spike week clearly elevated");
});

/* ---------------- 13. §18 knock-on generalisation — exact ---------------- */
console.log("\n[13] Knock-on — explicit repeat/spill reproduces legacy redial/deflection exactly");
t("per-queue repeatPct 0.3 / spillPct 0.4 with loops zeroed ≡ legacy loops path", () => {
  const mk = () => { const c = E.makeDefaultConfig(); c.scenarios.forEach((s) => (s.enabled = false)); return c; };
  const legacy = E.simulate(mk(), { strategy: "S1" });
  const c2 = mk();
  c2.loops = { redial: 0, deflection: 0 }; // prove the explicit path carries the numbers
  for (const q of c2.queues) {
    if (q.type === "voice") { q.repeatPct = 0.3; q.spillPct = 0; }
    else { q.repeatPct = 0; q.spillPct = 0.4; q.spillTargetQueue = q.deflectsTo; }
  }
  const explicit = E.simulate(c2, { strategy: "S1" });
  for (const w of [0, 10, 25, 51]) {
    for (const q of legacy.config.queues) {
      const a = legacy.weeks[w].queues[q.id], b = explicit.weeks[w].queues[q.id];
      eq(b.volume, a.volume, 1e-6, `${q.id} wk${w} volume`);
      eq(b.redial, a.redial, 1e-6, `${q.id} wk${w} redial/repeat`);
      eq(b.deflected, a.deflected, 1e-6, `${q.id} wk${w} deflected/spill`);
    }
  }
});

/* ---------------- 14. §20a risk-support fields (hand 30%) ---------------- */
console.log("\n[14] Risk fields — weekly record carries the §20a inputs; borrowedSharePct ≈ 0.30 rig");
t("queue meeting 30% of requirement from a pool reads borrowedSharePct 0.30", () => {
  const cfg = rigCfg({
    settings: { ot: { weeklyCeiling: 0 } },
    pools: [{ id: "pool1", name: "Shared", members: [{ queueId: "r", sharePct: 100 }, { queueId: "d2", sharePct: 100 }] }],
  });
  dq(cfg, "r", 40, { fte: 5, shrinkage: 0.3, wf: { attrition: 0, attritionGrowth: 0, reqToStart: 6, trainingWeeks: 4, learningCurve: [1], trainingShrinkagePct: 0, hires: [] } });
  // r: own 28 h/day vs req 40 → deficit 12 = 30% of requirement, fully pool-covered
  dq(cfg, "d2", 18, { brandId: "b2", fte: 4 }); // spare 14/day ≥ 12
  const sim = E.simulate(cfg);
  const r0 = wq(sim, 0, "r");
  eq(r0.borrowedSharePct, 0.30, 1e-6, "borrowedSharePct");
  eq(r0.cover, 1, 1e-6, "fully covered via the pool");
  // field presence on a stock config
  const d0 = E.simulate(E.makeDefaultConfig()).weeks[0].queues["q_bill"];
  for (const f of ["otHours", "otStreakWeeks", "borrowedSharePct", "trainingDebt"]) {
    ok(typeof d0[f] === "number", `weekly record carries ${f}`);
  }
});

/* ---------------- 15. §16 audit contract fields ---------------- */
console.log("\n[15] Audit fields — resolved assumptions in the weekly record");
t("ahtInEffect / slaInEffect / trainShrinkInEffect / scenarioTags / channel / brandId", () => {
  const cfg = rigCfg({
    scenarios: [
      { id: "s_aht", type: "unified", name: "digitize", enabled: true, tag: "digitization", parameter: "aht", mechanism: "step", granularity: "week", startWeek: 0, stopWeek: null, queueIds: ["qd"], p: { value: 0.2 } },
      { id: "s_sla", type: "unified", name: "relax sla", enabled: true, tag: "custom", parameter: "sla", mechanism: "step", granularity: "week", startWeek: 0, stopWeek: null, queueIds: ["qd"], p: { value: 0.1 } },
    ],
  });
  dq(cfg, "qd", 20, { fte: 40, shrinkage: 0.3 });
  const sim = E.simulate(cfg);
  const q0 = wq(sim, 0, "qd");
  eq(q0.ahtInEffect, 3600 * 1.2, 1e-6, "AHT in effect = base × scenario");
  eq(q0.slaInEffect, 60 * 1.1, 1e-6, "SLA in effect shifted");
  eq(q0.trainShrinkInEffect, 0.05, 1e-9, "training shrinkage in effect (Settings default vs 30% shrinkage)");
  ok(Array.isArray(q0.scenarioTags) && q0.scenarioTags.includes("digitization"), "tags carried");
  ok(q0.channel === "digital" && q0.brandId === "b1", "channel/brand identity carried");
});

/* ---------------- 16. §16 horizon bounds + Settings merge ---------------- */
console.log("\n[16] Horizon — clamped to [24, 78], default 52; partial Settings merge deeply");
t("resolveHorizon clamps; simulate honours it; default config runs 52 weeks", () => {
  const lo = rigCfg(); lo.engine.horizonWeeks = 5;
  const hi = rigCfg(); hi.engine.horizonWeeks = 100;
  const mid = rigCfg(); mid.engine.horizonWeeks = 60;
  const dflt = rigCfg(); dflt.engine.horizonWeeks = null;
  eq(E.resolveHorizon(lo), 24, 0, "5 → 24");
  eq(E.resolveHorizon(hi), 78, 0, "100 → 78");
  eq(E.resolveHorizon(mid), 60, 0, "60 stays");
  eq(E.resolveHorizon(dflt), 52, 0, "blank → 52");
  eq(E.resolveHorizon(E.makeDefaultConfig()), 52, 0, "stock config = 52");
  dq(lo, "q1", 20, { fte: 40 });
  dq(hi, "q1", 20, { fte: 40 });
  eq(E.simulate(lo).weeks.length, 24, 0, "sim floors at 24");
  eq(E.simulate(hi).weeks.length, 78, 0, "sim caps at 78");
  const set = E.settingsOf({ settings: { ot: { weeklyCeiling: 0 } } });
  eq(set.ot.weeklyCeiling, 0, 0, "override survives (0 is honoured)");
  eq(set.ot.maxDailyHours, 2, 0, "siblings keep defaults");
  eq(set.trainingDebt.maxAhtPenalty, 0.08, 0, "other sections keep defaults");
});

/* ---------------- 17. §22 performance — matrix + single sim ---------------- */
console.log("\n[17] Performance — 5×5 matrix < 8 s; single 52-week sim < 400 ms");
t("25 group×strategy cells and one live sim inside budget", () => {
  const cfg = E.makeDefaultConfig();
  cfg.strategies.push({ id: "S5", name: "Buffer 20", baseType: "buffer", bufferPct: 0.2 });
  cfg.groups = [
    { id: "g1", name: "No scenarios", scenarioIds: [] },
    { id: "g2", name: "Growth", scenarioIds: ["sc_growth"] },
    { id: "g3", name: "Growth + launch", scenarioIds: ["sc_growth", "sc_launch"] },
    { id: "g4", name: "Stress", scenarioIds: ["sc_growth", "sc_fe", "sc_as"] },
    { id: "g5", name: "Live" }, // no list → the enabled set (groups behave as views did)
  ];
  const t0 = Date.now();
  for (const g of cfg.groups) {
    const ids = E.groupScenarioIds(cfg, g.id);
    for (const st of ["S1", "S2", "S3", "S4", "S5"]) E.simulate(cfg, { strategy: st, viewIds: ids });
  }
  const matrix = Date.now() - t0;
  const t1 = Date.now();
  E.simulate(E.makeDefaultConfig());
  const one = Date.now() - t1;
  console.log(`      matrix 5×5 ${matrix}ms · single ${one}ms`);
  ok(matrix < 8000, `matrix ${matrix}ms ≥ 8000ms`);
  ok(one < 400, `single sim ${one}ms ≥ 400ms`);
});

console.log("\n═══════════════════════════════════");
console.log(`${pass} passed, ${fail} failed`);
if (fail) { console.log("FAILURES:\n - " + failures.join("\n - ")); process.exit(1); }
console.log("P7a GATE: GREEN");
