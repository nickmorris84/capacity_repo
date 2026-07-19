/* R3a gate — SPEC §24 Revision 3 engine battery. Same zero-dep harness and
   exact-arithmetic scaffold as r2.test.js (digital queues, AHT 3600 s,
   concurrency 1, occupancyCeiling 1, shrinkage-free 8 h heads, daysWorked =
   daysPerWeek = 7 ⇒ requirement hours/day = dailyVolume; every deficit, spare
   and grant below is hand-exact). The P1/R1/R2 batteries running unchanged are
   the hard regression gate; this file covers only §24 behaviour. */
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

function rigCfg(over = {}) {
  return {
    engine: { horizonWeeks: 24, dayStart: 8, dayEnd: 20, intervalMin: 30, occupancyCeiling: 1, currency: "£", daysPerWeek: 7, hoursPerFteDay: 8, daysWorkedPerFte: 7, crossSkillProficiency: 1, globalStartingHC: null },
    settings: {},
    brands: [
      { id: "b1", name: "Brand 1", training: null, dailyVolume: null, weeklyVolumes: null },
      { id: "b2", name: "Brand 2", training: null, dailyVolume: null, weeklyVolumes: null },
    ],
    pools: [], groups: [],
    hiring: { cap: 999, buffer: 0.1, activeStrategy: "S4" },
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

/* ---------------- 1. §24 migration — legacy numbers reproduced exactly ---------------- */
console.log("\n[1] Migration equivalence — R3 over R2 reproduces every number (all four strategies)");
t("volumes/cover/redial/deflected/status exact; costs within monthly-conversion ulps", () => {
  const r2 = E.migrateConfigR2(E.makeDefaultConfig());
  const r3 = E.migrateConfigR3(E.makeDefaultConfig());
  ok(r3.pools.length === 0, "pools deleted");
  for (const st of ["S1", "S2", "S3", "S4"]) {
    const a = E.simulate(r2, { strategy: st });
    const b = E.simulate(r3, { strategy: st });
    for (let w = 0; w < a.weeks.length; w++) {
      for (const q of r2.queues) {
        const x = a.weeks[w].queues[q.id], y = b.weeks[w].queues[q.id];
        eq(y.volume, x.volume, 1e-9, `${st} ${q.id} wk${w} volume`);
        eq(y.cover, x.cover, 1e-9, `${st} ${q.id} wk${w} cover`);
        eq(y.redial, x.redial, 1e-9, `${st} ${q.id} wk${w} redial`);
        eq(y.deflected, x.deflected, 1e-9, `${st} ${q.id} wk${w} deflected`);
        eq(y.cost, x.cost, 1e-6, `${st} ${q.id} wk${w} cost`);
        ok(y.status === x.status, `${st} ${q.id} wk${w} status ${y.status} ≠ ${x.status}`);
      }
    }
    eq(b.summary.allIn, a.summary.allIn, 1e-3, st + " allIn");
  }
});
t("migration is idempotent", () => {
  const once = E.migrateConfigR3(E.makeDefaultConfig());
  const twice = E.migrateConfigR3(once);
  ok(JSON.stringify(once) === JSON.stringify(twice), "second pass changes nothing");
});

/* ---------------- 2. §24.1 knock-on — two figures, exact mechanics, default target ---------------- */
console.log("\n[2] Knock-on — simplified per-queue block reproduces legacy repeat/spill exactly");
t("knock {repeatPct, convertPct, convertTarget} ≡ legacy loops path (weeks 0/10/25/51)", () => {
  const mk = () => { const c = E.makeDefaultConfig(); c.scenarios.forEach((s) => (s.enabled = false)); return c; };
  const legacy = E.simulate(mk(), { strategy: "S1" });
  const c2 = mk();
  c2.loops = { redial: 0, deflection: 0 }; // prove the knock block alone carries the numbers
  for (const q of c2.queues) {
    if (q.type === "voice") q.knock = { repeatPct: 0.3, convertPct: 0, convertTarget: null };
    else q.knock = { repeatPct: 0, convertPct: 0.4, convertTarget: q.deflectsTo };
  }
  const explicit = E.simulate(c2, { strategy: "S1" });
  for (const w of [0, 10, 25, 51]) {
    for (const q of legacy.config.queues) {
      const a = legacy.weeks[w].queues[q.id], b = explicit.weeks[w].queues[q.id];
      eq(b.volume, a.volume, 1e-6, `${q.id} wk${w} volume`);
      eq(b.redial, a.redial, 1e-6, `${q.id} wk${w} repeat`);
      eq(b.deflected, a.deflected, 1e-6, `${q.id} wk${w} converts`);
    }
  }
});
t("migration freezes resolved values 1:1; convertTarget defaults to the brand's primary voice queue where inert", () => {
  const m = E.migrateConfigR3(E.makeDefaultConfig());
  const byId = Object.fromEntries(m.queues.map((q) => [q.id, q]));
  eq(byId.q_bill.knock.repeatPct, 0.3, 1e-12, "voice repeat = legacy redial");
  eq(byId.q_wapp.knock.convertPct, 0.4, 1e-12, "digital converts = legacy deflection");
  ok(byId.q_wapp.knock.convertTarget === "q_bill", "active conversion keeps its exact target");
  ok(byId.q_tech.knock.convertTarget === "q_bill", "inert conversion defaults to the brand's primary voice queue");
  ok(byId.q_bill.knock.convertTarget === null, "a queue is never its own conversion target");
  ok(E.primaryVoiceQueue(m, "b1").id === "q_bill", "primary voice = first voice queue in definition order");
});

/* ---------------- 3. §24.2 sharing — hand gate: spare 10 h at 60% share, deficits 6:3 → 4:2 ---------------- */
console.log("\n[3] Sharing — donor offers 60% of 10 h spare; recipients 6:3 draw 4:2 (hand)");
t("offered spare splits pro-rata by deficit; donor never below own requirement", () => {
  const cfg = rigCfg({ settings: { ot: { weeklyCeiling: 0 } } });
  dq(cfg, "d", 30, { fte: 5, sharing: { sharePct: 60, sharesWith: ["r1", "r2"] } }); // own 40/day, spare 10
  dq(cfg, "r1", 14, { fte: 1 }); // own 8, deficit 6/day
  dq(cfg, "r2", 11, { fte: 1 }); // own 8, deficit 3/day
  const sim = E.simulate(cfg);
  eq(wq(sim, 0, "r1").poolIn, 4 * 7, 1e-6, "r1 draws 4 of the 6 offered (6/9)");
  eq(wq(sim, 0, "r2").poolIn, 2 * 7, 1e-6, "r2 draws 2 of the 6 offered (3/9)");
  const d0 = wq(sim, 0, "d");
  eq(d0.hours, (40 - 6) * 7, 1e-6, "donor charged exactly the 6 h it offered");
  ok(d0.hours >= d0.reqHours - 1e-9, "donor never below own requirement");
  ok(d0.status === "green", "donor still green on its own book");
});

/* ---------------- 4. §24.2 sharing — reclaim feed + pool decomposition equivalence ---------------- */
console.log("\n[4] Sharing — donors reclaim training to honour sharing; pool decomposition is exact");
t("sharing declaration reproduces the pool test-7 numbers (feed 6 h/day, debt 20, pro-rata 20:3)", () => {
  const cfg = rigCfg({ settings: { ot: { weeklyCeiling: 0 } } });
  dq(cfg, "a", 6, { brandId: "b2", fte: 3, shrinkage: 0.5, sharing: { sharePct: 100, sharesWith: ["b", "c"] }, wf: { attrition: 0, attritionGrowth: 0, reqToStart: 6, trainingWeeks: 4, learningCurve: [1], trainingShrinkagePct: 0.25, hires: [] } });
  dq(cfg, "b", 28, { fte: 1 }); // deficit 20/day
  dq(cfg, "c", 11, { fte: 1 }); // deficit 3/day
  const sim = E.simulate(cfg);
  eq(wq(sim, 0, "a").reclaimedHours, 6 * 7, 1e-6, "feed capped at trainingShrinkagePct (42 h/wk)");
  eq(wq(sim, 0, "a").trainingDebt, 20, 1e-6, "full reclaim share → debt +accumRate");
  eq(wq(sim, 0, "a").cover, 1, 1e-6, "donor lands exactly at its own requirement");
  eq(wq(sim, 0, "b").poolIn, (12 * 20 / 23) * 7, 1e-6, "b pro-rata share (spare 6 + feed 6)");
  eq(wq(sim, 0, "c").poolIn, (12 * 3 / 23) * 7, 1e-6, "c pro-rata share");
});
t("migrateConfigR3 decomposes a pool into per-queue declarations preserving every rung number", () => {
  const mkPool = () => {
    const cfg = rigCfg({
      settings: { ot: { weeklyCeiling: 0 } },
      pools: [{ id: "pool1", name: "Shared", members: [{ queueId: "a", sharePct: 100 }, { queueId: "b", sharePct: 100 }, { queueId: "c", sharePct: 100 }] }],
    });
    dq(cfg, "a", 6, { brandId: "b2", fte: 3, shrinkage: 0.5, wf: { attrition: 0, attritionGrowth: 0, reqToStart: 6, trainingWeeks: 4, learningCurve: [1], trainingShrinkagePct: 0.25, hires: [] } });
    dq(cfg, "b", 28, { fte: 1 });
    dq(cfg, "c", 11, { fte: 1 });
    return cfg;
  };
  const poolSim = E.simulate(mkPool());
  const dec = E.migrateConfigR3(mkPool());
  ok(dec.pools.length === 0, "pools removed by migration");
  const a = dec.queues.find((q) => q.id === "a");
  eq(a.sharing.sharePct, 100, 1e-12, "share % carried");
  ok(a.sharing.sharesWith.join(",") === "b,c", "shares-with = co-members in order");
  const decSim = E.simulate(dec);
  for (let w = 0; w < 8; w++) {
    for (const id of ["a", "b", "c"]) {
      const x = poolSim.weeks[w].queues[id], y = decSim.weeks[w].queues[id];
      eq(y.poolIn, x.poolIn, 1e-9, `${id} wk${w} shared inflow`);
      eq(y.reclaimedHours, x.reclaimedHours, 1e-9, `${id} wk${w} reclaim`);
      eq(y.trainingDebt, x.trainingDebt, 1e-9, `${id} wk${w} debt`);
      eq(y.hours, x.hours, 1e-9, `${id} wk${w} hours`);
      eq(y.cover, x.cover, 1e-9, `${id} wk${w} cover`);
      ok(y.status === x.status, `${id} wk${w} status`);
    }
  }
});

/* ---------------- 5. §24.3 cap hierarchy — segment grants, ceiling trims lowest marginal (hand) ---------------- */
console.log("\n[5] Cap hierarchy — segment caps grant by marginal; Total ceiling trims lowest-marginal first");
t("segments 5+5 wanted 12.5+10 → grants 5+5; Total 7 trims the low-marginal segment to 2 (hand)", () => {
  const cfg = rigCfg({ cx: { customerBase: 0, costPerLostCustomer: 500, churnAbandon: 0, churnWait: 0, churnDigital: 0.02, repeatUplift: 1 } });
  cfg.hiring.caps = { segments: { "b1|digital": 5, "b2|digital": 5 }, brands: {}, total: 7 };
  dq(cfg, "qa", 100, { fte: 0 });                              // want 12.5, marginal 100×7×10/12.5 = 560
  dq(cfg, "qb", 40, { brandId: "b2", fte: 0, aht: 7200 });     // want 10, marginal 40×7×10/10 = 280
  const sim = E.simulate(cfg, { strategy: "S1" });
  const tr = sim.allocTrace[0];
  ok(tr.order[0] === "qa" && tr.order[1] === "qb", "marginal order qa (560) before qb (280): " + tr.order.join(","));
  eq(tr.grants.qa, 5, 0.011, "qa granted its full segment cap");
  eq(tr.grants.qb, 2, 0.011, "qb trimmed from 5 to 2 by the Total ceiling (lowest marginal first)");
  eq(tr.want, 22.5, 1e-6, "total want 12.5 + 10");
  eq(tr.cap, 7, 1e-9, "trace cap = Total ceiling");
  ok(tr.binding, "binding");
  ok(tr.boundBy.includes("Total"), "trace names the Total level: " + tr.boundBy.join(" · "));
  ok(tr.boundBy.includes("Brand 1 × digital cap"), "trace names the binding segment: " + tr.boundBy.join(" · "));
  eq(tr.denied.qa, 7.5, 0.011, "qa denied remainder");
  eq(tr.denied.qb, 8, 0.011, "qb denied remainder");
});
t("a brand ceiling trims only that brand's grants and is named in the trace", () => {
  const cfg = rigCfg({ cx: { customerBase: 0, costPerLostCustomer: 500, churnAbandon: 0, churnWait: 0, churnDigital: 0.02, repeatUplift: 1 } });
  cfg.hiring.caps = { segments: { "b1|digital": 5, "b2|digital": 5 }, brands: { b1: 3 }, total: null };
  dq(cfg, "qa", 100, { fte: 0 });
  dq(cfg, "qb", 40, { brandId: "b2", fte: 0, aht: 7200 });
  const tr = E.simulate(cfg, { strategy: "S1" }).allocTrace[0];
  eq(tr.grants.qa, 3, 0.011, "qa trimmed 5 → 3 by its brand ceiling");
  eq(tr.grants.qb, 5, 0.011, "qb untouched by Brand 1's ceiling");
  ok(tr.boundBy.includes("Brand 1 ceiling"), "trace names the brand ceiling: " + tr.boundBy.join(" · "));
  ok(!tr.boundBy.includes("Total"), "no Total level bound");
});

/* ---------------- 6. §24.4 S2 bufferPct — per-strategy, custom edits the same param ---------------- */
console.log("\n[6] Strategy params — S2 bufferPct");
t("custom buffer 30% wants req × 1.3; built-in S2 keeps the Settings default 10%", () => {
  const cfg = rigCfg();
  dq(cfg, "qs", 100, { fte: 0 });
  const b30 = E.simulate(cfg, { strategy: { id: "SB", name: "B30", baseType: "buffer", bufferPct: 0.3 } });
  eq(b30.allocTrace[0].want, 12.5 * 1.3, 1e-9, "want = req 12.5 × 1.3");
  const s2 = E.simulate(cfg, { strategy: "S2" });
  eq(s2.allocTrace[0].want, 12.5 * 1.1, 1e-9, "built-in S2 wants req × (1 + hiring.buffer)");
});

/* ---------------- 7. §24.4 S3 forwardMonths — projection distance moves the backfill ---------------- */
console.log("\n[7] Strategy params — S3 forwardMonths 1 vs 6 changes req timing in the right direction");
t("want tracks the projected pool at +m months: m1 > default(lead 10wk) > m6; unset ≡ legacy exactly", () => {
  const mk = () => {
    const cfg = rigCfg();
    dq(cfg, "qf", 20, { fte: 20, wf: { attrition: 0.4345, attritionGrowth: 0, reqToStart: 6, trainingWeeks: 4, learningCurve: [1], hires: [] } });
    return cfg;
  };
  const wkAttr = 0.4345 / 4.345; // = 0.1: the engine's own weekly conversion
  // The week-0 decision runs AFTER the workforce ages one week, so the
  // projected pool at +ahead weeks is 20 × (1−a)^(1+ahead).
  const wantAt = (ahead) => 20 * Math.pow(1 - wkAttr, 1 + ahead) * wkAttr;
  const runFm = (fm) => E.simulate(mk(), { strategy: { id: "SF", name: "F", baseType: "backfill", forwardMonths: fm } }).allocTrace[0].want;
  const w1 = runFm(1), w6 = runFm(6);
  eq(w1, wantAt(Math.round(52 / 12)), 1e-9, "m=1 projects 4 weeks out");
  eq(w6, wantAt(26), 1e-9, "m=6 projects 26 weeks out");
  const wDefault = E.simulate(mk(), { strategy: { id: "SD", name: "D", baseType: "backfill" } }).allocTrace[0].want;
  const wLegacy = E.simulate(mk(), { strategy: "S3" }).allocTrace[0].want;
  eq(wDefault, wantAt(10), 1e-9, "unset = legacy landing week (reqToStart 6 + training 4)");
  eq(wLegacy, wDefault, 1e-12, "built-in S3 unchanged (hard regression)");
  ok(w1 > wDefault && wDefault > w6 && w6 > 0, `monotone in the projection distance: ${w1.toFixed(4)} > ${wDefault.toFixed(4)} > ${w6.toFixed(4)}`);
});

/* ---------------- 8. §24.5 workflow subtype — 24h SLA maths (hand) ---------------- */
console.log("\n[8] Digital Workflow — hand backlog case; SLA in hours; per-queue subtype mix");
t("runWorkflowDay: B0 25, arrivals 100, capacity 50/day → sl 50%, backlog 75, wait 1 day", () => {
  const q = { aht: 3600, workflowSlaHours: 24, subtype: "workflow", type: "digital" };
  const r = E.runWorkflowDay(q, 100, 50, 25, {}, null, true);
  eq(r.sl, 0.5, 1e-9, "half the day's arrivals inside 24h");
  eq(r.endBacklog, 75, 1e-9, "backlog 25 + 100 − 50");
  eq(r.respMin, 1440, 1e-9, "mean wait exactly one day");
  eq(r.respHours, 24, 1e-9, "hour-grain response");
  eq(r.occ, 1, 1e-9, "fully occupied");
});
t("simulated week: capacity 50/day vs 100/day arrivals → sl 1/7, backlog 350, req 12.5 FTE", () => {
  const cfg = rigCfg({ settings: { ot: { weeklyCeiling: 0 }, training: { shrinkagePct: 0 } } });
  dq(cfg, "qw", 100, { fte: 6.25, subtype: "workflow" }); // own 50 h/day ⇒ 50 items/day at 3600 s
  const sim = E.simulate(cfg);
  const w0 = wq(sim, 0, "qw");
  eq(w0.sl, 1 / 7, 1e-9, "only day 0's arrivals land inside 24h");
  eq(w0.backlog, 350, 1e-6, "backlog grows 50/day");
  eq(w0.respMin, 5040, 1e-6, "volume-weighted mean wait 3.5 days");
  eq(w0.respHours, 84, 1e-6, "hour-grain weekly response");
  eq(w0.reqFte, 12.5, 1e-6, "requirement has no concurrency and no Erlang scale");
  eq(w0.cover, 0.5, 1e-6, "cover = 50/100");
  eq(w0.occ, 1, 1e-9, "no idle capacity");
  ok(w0.status === "red", "misses 90%-within-24h by a mile: " + w0.status);
  ok(w0.subtype === "workflow", "subtype carried on the weekly record");
  ok(w0.slaInEffect === 24, "SLA in effect reported in hours");
});
t("SLA window in hours is live: 48h doubles the inside-SLA share; workflowSlaPct drives the RAG", () => {
  const mk = (slaHours, slaPct) => {
    const cfg = rigCfg({ settings: { ot: { weeklyCeiling: 0 }, training: { shrinkagePct: 0 } } });
    dq(cfg, "qw", 100, { fte: 6.25, subtype: "workflow", workflowSlaHours: slaHours, workflowSlaPct: slaPct });
    return E.simulate(cfg);
  };
  eq(wq(mk(48), 0, "qw").sl, 2 / 7, 1e-9, "48h window admits two days of arrivals");
  ok(wq(mk(24, 0.1), 0, "qw").status === "green", "attainment 1/7 ≥ 10% target → green");
  const customer = rigCfg({ settings: { ot: { weeklyCeiling: 0 }, training: { shrinkagePct: 0 } } });
  dq(customer, "qc", 100, { fte: 6.25 }); // same book, customer subtype
  ok(Math.abs(wq(E.simulate(customer), 0, "qc").sl - 1 / 7) > 0.01, "customer subtype runs the fluid model, not the day-grain workflow maths");
});

/* ---------------- 9. §24.6 series anchoring — wizard week 1 uses the Settings date's month ---------------- */
console.log("\n[9] Volume series — calendar anchoring and the seasonality wizard");
t("weekOneDate 2026-04-15: weeks 0–2 are April, week 3 is May; wizard multiplies accordingly", () => {
  const months = new Array(12).fill(1); months[3] = 1.2; months[4] = 0.8;
  const cfg = rigCfg({ settings: { calendar: { weekOneDate: "2026-04-15" } } });
  eq(E.monthForWeek(cfg, 0), 3, 0, "week 1 = the Settings date's month (April)");
  eq(E.monthForWeek(cfg, 2), 3, 0, "Apr 29 still April");
  eq(E.monthForWeek(cfg, 3), 4, 0, "May 6 crosses into May");
  const series = E.generateWeeklySeries(cfg, 100, months, 6);
  ok(series.join(",") === "120,120,120,80,80,80", "wizard series base × monthly multipliers: " + series.join(","));
  cfg.seasonality.system = months;
  dq(cfg, "qv", 20, { fte: 40 });
  const sim = E.simulate(cfg);
  eq(wq(sim, 0, "qv").baseVolume, 20 * 1.2 * 7, 1e-6, "simulated week 1 carries April's multiplier");
  eq(wq(sim, 3, "qv").baseVolume, 20 * 0.8 * 7, 1e-6, "week 4 carries May's");
  const legacy = rigCfg(); legacy.seasonality = { startMonth: 3, system: months };
  eq(E.monthForWeek(legacy, 0), 3, 0, "no date set → legacy startMonth mapping unchanged");
});

/* ---------------- 10. §24.7 monthly costs — ×12 ÷ 52 exact ---------------- */
console.log("\n[10] Monthly costs — conversion exact; financial outputs report monthly and annual");
t("agent £2,600/mo → £600/wk exactly; manager monthly honoured; finance block rolls up", () => {
  const cfg = rigCfg({ costs: { managerCost: 0, managerCostMonthly: 1300, managerRatio: 1 } });
  dq(cfg, "qc", 20, { fte: 10, agentCost: 999999, agentCostMonthly: 2600 });
  const sim = E.simulate(cfg);
  eq(wq(sim, 0, "qc").cost, 6000, 1e-9, "10 heads × 2600 × 12 ÷ 52 = 6000 exact");
  eq(sim.weeks[0].totals.managerCost, 3000, 1e-9, "10 managers × 1300 × 12 ÷ 52 = 3000 exact");
  eq(sim.weeks[0].totals.totalCost, 9000, 1e-9, "weekly total");
  const f = sim.summary.finance;
  eq(f.monthlyRun, 9000 * (52 / 12), 1e-6, "monthly run rate");
  eq(f.annualRun, 9000 * 52, 1e-6, "annual run rate");
  eq(f.monthlyAllIn, f.monthlyRun, 1e-6, "no churn in the rig → allIn = run");
  // migration equivalence of the conversion itself
  eq((32000 / 12) * 12 / 52, 32000 / 52, 1e-9, "annual ÷ 12 → monthly → weekly matches annual ÷ 52");
});

/* ---------------- 11. §24.8 group-scoped scenarios ---------------- */
console.log("\n[11] Group scope — targets on the GROUP; factors inherit it");
t("an op-wide volume step scoped by its group to Brand 2 leaves Brand 1 untouched", () => {
  const cfg = rigCfg({
    groups: [{ id: "gs", name: "Scoped", scenarioIds: ["sv"], scope: { brandIds: ["b2"] } }],
    scenarios: [{ id: "sv", type: "unified", name: "step", enabled: true, tag: "growth", parameter: "volume", mechanism: "step", granularity: "week", startWeek: 0, stopWeek: null, queueIds: "all", p: { value: 1 } }],
  });
  dq(cfg, "qa", 20, { fte: 40 });
  dq(cfg, "qb", 20, { brandId: "b2", fte: 40 });
  const ids = E.groupScenarioIds(cfg, "gs");
  const unscoped = E.simulate(cfg, { viewIds: ids });
  eq(wq(unscoped, 0, "qa").baseVolume, 280, 1e-6, "unscoped: qa doubled");
  eq(wq(unscoped, 0, "qb").baseVolume, 280, 1e-6, "unscoped: qb doubled");
  const scoped = E.simulate(E.applyGroupScope(cfg, "gs"), { viewIds: ids });
  eq(wq(scoped, 0, "qa").baseVolume, 140, 1e-6, "scoped: Brand 1 untouched");
  eq(wq(scoped, 0, "qb").baseVolume, 280, 1e-6, "scoped: Brand 2 doubled");
  ok(E.groupScopeQueueIds(cfg, { channels: ["digital"] }).join(",") === "qa,qb", "channel targets resolve");
  ok(E.groupScopeQueueIds(cfg, { queueIds: ["qa"] }).join(",") === "qa", "queue targets resolve");
  ok(E.groupScopeQueueIds(cfg, {}) === null, "empty scope = unscoped");
});

/* ---------------- 12. §24.9 blank config — empty world, no NaN ---------------- */
console.log("\n[12] Lifecycle — a truly blank config simulates to an empty, finite world");
t("no brands, no queues: 52 finite weeks, zero totals, finite summary, every strategy", () => {
  const blank = E.makeBlankConfig();
  ok(blank.brands.length === 0 && blank.queues.length === 0, "truly blank");
  for (const st of ["S1", "S2", "S3", "S4"]) {
    const sim = E.simulate(blank, { strategy: st });
    eq(sim.weeks.length, 52, 0, "52 weeks");
    for (const w of sim.weeks) {
      for (const [k, v] of Object.entries(w.totals)) {
        ok(typeof v !== "number" || Number.isFinite(v), `totals.${k} finite (${v})`);
      }
    }
    eq(sim.weeks[0].totals.volume, 0, 0, "empty world, empty results");
    eq(sim.summary.allIn, 0, 0, "allIn 0");
    ok(Number.isFinite(sim.summary.finance.monthlyRun), "finance block finite");
    ok(sim.summary.findings.length === 0, "no findings from nothing");
  }
});

/* ---------------- 13. §24.10 Settings shape — week-1 date, caps matrix, business-box support ---------------- */
console.log("\n[13] Settings — calendar default, caps hierarchy shape, per-queue SLA target + RAG");
t("settings default null date; migrated caps carry the legacy cap as Total; SLA attainment RAGs", () => {
  ok(E.settingsOf({}).calendar.weekOneDate === null, "calendar defaults to unanchored");
  const m = E.migrateConfigR3(E.makeDefaultConfig());
  eq(m.hiring.caps.total, 18, 0, "legacy global cap → Total ceiling");
  ok(Object.keys(m.hiring.caps.segments).length === 0, "segment matrix starts unlimited");
  for (const q of m.queues) eq(q.slaAttainmentTarget, 0.9, 1e-12, q.id + " default attainment target 90%");
  const cfg = rigCfg();
  dq(cfg, "qg", 20, { fte: 40, slaAttainmentTarget: 0.9 });
  const pq = E.simulate(cfg).summary.perQueue.qg;
  eq(pq.slaAttainment, 1, 1e-9, "all-green queue attains 100%");
  ok(pq.slaRag === "green", "RAG vs the target");
});

console.log("\n═══════════════════════════════════");
console.log(`${pass} passed, ${fail} failed`);
console.log(fail === 0 ? "R3a / §24 GATE: GREEN" : "R3a / §24 GATE: RED");
if (fail > 0) { failures.forEach((x) => console.log("  - " + x)); process.exitCode = 1; }
