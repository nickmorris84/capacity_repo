/* R3d-A gate — SPEC §25 Digital Customer under Erlang. Same zero-dep harness
   and exact-arithmetic scaffold as r3.test.js. Live-chat queues now use the
   validated Erlang A solver with servers = agents × concurrency; the carrying
   backlog is retired and abandonment replaces it. The ENTIRE pre-existing
   battery running green (P1/R1/R2/R3a/P7b/R3b/R3c/§13) is the hard regression
   gate; this file covers only §25 behaviour. */
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

// The exact-arithmetic rig from r3.test.js (digital, occupancyCeiling 1, 8h
// heads, daysWorked = daysPerWeek = 7). dq() builds WORKFLOW queues (linear
// req = dailyVolume); customer queues are pinned per test.
function rigCfg(over = {}) {
  return {
    engine: { horizonWeeks: 24, dayStart: 8, dayEnd: 20, intervalMin: 30, occupancyCeiling: 1, currency: "£", daysPerWeek: 7, hoursPerFteDay: 8, daysWorkedPerFte: 7, crossSkillProficiency: 1, globalStartingHC: null },
    settings: {},
    brands: [{ id: "b1", name: "Brand 1", training: null, dailyVolume: null, weeklyVolumes: null }],
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
    id, name: id, type: "digital", subtype: "workflow", brandId: "b1", channel: "digital", priority: 5,
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
// A minimal voice queue for the conversion round-trip.
function vq(cfg, id, dailyVolume, over = {}) {
  const q = {
    id, name: id, type: "voice", brandId: "b1", channel: "voice", priority: 1,
    dailyVolume, aht: 300, profile: [1], asaTarget: 30, maxAbandon: 0.05, patience: 90,
    shrinkage: 0, fte: 20, agentCost: 30000, concurrency: 1, digitalSlaMinutes: 5, digitalSlaPct: 0.8,
    backlogLimit: 1e9, deflectsTo: null, resourcing: "dedicated", supports: [], crossSkill: [],
    weeklyVolumes: null, seasonal: null,
    wf: { attrition: 0, attritionGrowth: 0, reqToStart: 6, trainingWeeks: 4, learningCurve: [1], hires: [] },
    burn: { occThreshold: 2, sensitivity: 0, recovery: 0, maxAttritionMult: 1, absenceUplift: 0 },
    ...over,
  };
  cfg.queues.push(q);
  return q;
}
const wq = (sim, w, id) => sim.weeks[w].queues[id];
const eng30 = { intervalMin: 30, occupancyCeiling: 1 };

/* ---------------- 1. §25.1 servers = agents × concurrency ≡ voiceRaw (hand) ---------------- */
console.log("\n[1] Erlang mapping — 10 agents × concurrency 2.5 ≡ voiceRaw at N=25");
t("runDigitalCustomerDay(10 agents @2.5) reproduces voiceRaw(25) exactly (A/AHT/patience/target)", () => {
  const aht = 180, pat = 180, target = 300; // digitalSlaMinutes 5 → 300 s
  const q = { type: "digital", aht, concurrency: 2.5, digitalSlaMinutes: 5, patience: pat, maxAbandon: 1, profile: [1] };
  const V = 240; // arrivals in the single 30-min interval → A = 24 Erlangs (util 0.96, visible abandon)
  // 10 staffed agents (rc.agents=[10], cover=1) × concurrency 2.5 = 25 servers.
  const rc = { agents: [10], hours: 10 * 0.5 };
  const r = E.runDigitalCustomerDay(q, V, 10 * 0.5, eng30, rc, false);
  const A = (V / 1800) * aht;
  eq(A, 24, 1e-9, "offered load A = 24 Erlangs (hand)");
  const ref = E.voiceRaw(25, A, aht, pat, target); // 25 servers
  eq(r.sl, ref.sl, 1e-12, "SL identical to voiceRaw at N=25");
  eq(r.asa, ref.asa, 1e-12, "ASA identical");
  eq(r.abandon, ref.abandon, 1e-12, "abandonment identical");
  eq(r.occ, ref.occ, 1e-12, "occupancy identical");
  eq(r.respMin, ref.asa / 60, 1e-12, "response minutes = ASA ÷ 60");
  ok(r.abandon > 0.01 && r.abandon < 0.5, "a real, non-trivial abandonment (" + r.abandon.toFixed(3) + ")");
  // the byInterval detail also records the effective servers
  eq(r.byInterval[0].servers, 25, 1e-12, "interval detail carries servers = 25");
});

/* ---------------- 2. §25.2 requirement search — agents = minimal-N ÷ concurrency (hand) ---------------- */
console.log("\n[2] Requirement — minimal-server search, agents = N_servers ÷ concurrency");
t("reqCurve returns agents where ceil(agents × 2.5) is the minimal N servers", () => {
  const aht = 300, pat = 180, maxAb = 0.05, target = 60; // digitalSlaMinutes 1 → 60 s
  const q = { type: "digital", subtype: "customer", aht, concurrency: 2.5, digitalSlaMinutes: 1, patience: pat, maxAbandon: maxAb, profile: [1] };
  const eng = { intervalMin: 30, occupancyCeiling: 0.85 };
  const V = 200; // arrivals in the interval → A = 33.33 Erlangs
  const rc = E.reqCurve(q, V, eng, new Map());
  const agents = rc.agents[0];
  const N = E.requiredAgentsInterval(V, 1800, aht, pat, target, maxAb, 0.85); // minimal servers
  eq(agents, N / 2.5, 1e-12, "required agents = minimal N servers ÷ concurrency");
  eq(Math.ceil(agents * 2.5), N, 0, "ceil(agents × 2.5) = minimal-N");
  // N is genuinely minimal: N passes its own constraints, N−1 breaks one.
  const A = (V / 1800) * aht;
  const rN = E.voiceRaw(N, A, aht, pat, target), rM = E.voiceRaw(N - 1, A, aht, pat, target);
  ok(rN.asa <= target && rN.abandon <= maxAb && rN.occ <= 0.85, "N servers meet ASA/abandon/occupancy");
  ok(rM.asa > target || rM.abandon > maxAb || rM.occ > 0.85, "N−1 servers fail at least one — N is minimal");
  eq(rc.hours, agents * 0.5, 1e-12, "hours = agents × interval-hours");
});

/* ---------------- 3. Workflow regression isolation — unchanged by R3d-A ---------------- */
console.log("\n[3] Regression isolation — a Workflow queue is bit-identical (customer change is isolated)");
t("workflow hand case + simulated week reproduce the R3a numbers exactly, beside an Erlang customer", () => {
  // Direct hand case (identical to the R3a §24.5 gate).
  const wqh = { aht: 3600, workflowSlaHours: 24, subtype: "workflow", type: "digital" };
  const rh = E.runWorkflowDay(wqh, 100, 50, 25, {}, null, true);
  eq(rh.sl, 0.5, 1e-12, "half the day's arrivals inside 24h");
  eq(rh.endBacklog, 75, 1e-12, "backlog 25 + 100 − 50");
  eq(rh.respHours, 24, 1e-12, "mean wait one day");
  // Simulated: a workflow queue and an Erlang customer queue on the same book.
  const cfg = rigCfg({ settings: { ot: { weeklyCeiling: 0 }, training: { shrinkagePct: 0 } } });
  dq(cfg, "qw", 100, { fte: 6.25, subtype: "workflow" });
  dq(cfg, "qc", 100, { fte: 6.25, subtype: "customer" });
  const sim = E.simulate(cfg);
  const w = wq(sim, 0, "qw");
  eq(w.sl, 1 / 7, 1e-9, "workflow SL unchanged (only day 0 inside 24h)");
  eq(w.backlog, 350, 1e-6, "workflow backlog grows 50/day");
  eq(w.reqFte, 12.5, 1e-6, "workflow requirement is linear (no Erlang, no concurrency)");
  eq(w.respHours, 84, 1e-6, "workflow weekly response");
  ok(w.status === "red", "workflow RAG unchanged");
  const c = wq(sim, 0, "qc");
  ok(Math.abs(c.sl - 1 / 7) > 0.01, "the customer neighbour runs Erlang, not the workflow maths");
  eq(c.backlog, 0, 1e-12, "the customer neighbour carries no backlog");
  ok(c.abandon > 0, "the customer neighbour abandons");
});

/* ---------------- 4. §25.3 converts-to-calls on abandonment, feeds voice next day ---------------- */
console.log("\n[4] Conversion round trip — abandoned chat raises next-day voice (no backlog)");
t("day-1 abandoned × convert % lands on the target voice queue next day; chat carries no backlog", () => {
  const cfg = rigCfg();
  cfg.engine.daysPerWeek = 2;
  vq(cfg, "v", 40); // voice target
  // Customer chat, zero servers → every contact abandons; converts 50% to "v".
  dq(cfg, "c", 20, { subtype: "customer", fte: 0, profile: [1], knock: { repeatPct: 0, convertPct: 0.5, convertTarget: "v" } });
  const sim = E.simulate(cfg, { captureDaily: true, strategy: "S4" });
  const d1 = sim.weeks[0].days[0], d2 = sim.weeks[0].days[1];
  const expDefl = 20 * 0.5; // abandoned (= all 20) × convert 0.5
  eq(d1["c"].deflected, expDefl, 1e-9, "day-1 conversion = abandoned × convert %");
  eq(d1["c"].backlog, 0, 1e-12, "Digital Customer carries no backlog");
  eq(d2["v"].vol, 40 + expDefl, 1e-9, "day-2 voice volume lifted by the conversion");
  eq(d2["c"].deflected, expDefl, 1e-9, "steady day-2 conversion (no backlog accumulation)");
  // repeat % applies to abandons too: half the abandons re-contact the chat queue.
  const cfg2 = rigCfg();
  cfg2.engine.daysPerWeek = 2;
  vq(cfg2, "v", 40);
  dq(cfg2, "c", 20, { subtype: "customer", fte: 0, profile: [1], knock: { repeatPct: 0.5, convertPct: 0, convertTarget: null } });
  const sim2 = E.simulate(cfg2, { captureDaily: true, strategy: "S4" });
  eq(sim2.weeks[0].days[1]["c"].vol, 20 + 20 * 0.5, 1e-9, "day-2 chat volume = base + abandoned × repeat %");
});

/* ---------------- 5. §25 economies of scale — small chat teams are penalised ---------------- */
console.log("\n[5] Economies of scale — the small chat team shows worse SL (now real)");
t("product model is concurrency-blind (4@2.5 ≡ 10@1.0); fewer servers → worse SL at same offered load", () => {
  const aht = 300, target = 300; // 5-min SLA
  const arrForA = (A) => (A * 1800) / aht;
  const mkQ = (conc) => ({ type: "digital", aht, concurrency: conc, digitalSlaMinutes: 5, patience: 180, maxAbandon: 1, profile: [1] });
  const run = (conc, agents, A) =>
    E.runDigitalCustomerDay(mkQ(conc), arrForA(A), agents * 0.5, eng30, { agents: [agents], hours: agents * 0.5 }, false);

  // (a) 4 agents @2.5 = 10 servers and 10 agents @1.0 = 10 servers are identical
  //     at the same offered load — the model multiplies agents × concurrency and
  //     is otherwise concurrency-blind (the "mildly optimistic about juggling"
  //     approximation, §25.3). So the literal 4@2.5-vs-10@1.0 pair does NOT
  //     differ; the scale penalty comes from team SIZE, below.
  const conc25 = run(2.5, 4, 8);  // 4 × 2.5 = 10 servers, A = 8
  const conc10 = run(1.0, 10, 8); // 10 × 1.0 = 10 servers, A = 8
  eq(conc25.sl, conc10.sl, 1e-12, "4@2.5 ≡ 10@1.0 (same servers, same offered load, same SL)");
  eq(conc25.abandon, conc10.abandon, 1e-12, "…and identical abandonment");

  // (b) Economies of scale (now real): at the SAME offered load, a small chat
  //     team (4 agents @2.5 = 10 servers) is worse than a larger team (8 agents
  //     @2.5 = 20 servers). Erlang rewards scale; the retired fluid model —
  //     capacity = agents × concurrency ÷ AHT, purely linear — did not.
  const A = 9;
  const small = run(2.5, 4, A); // 10 servers, util 0.90
  const large = run(2.5, 8, A); // 20 servers, util 0.45, SAME offered load
  ok(large.sl > small.sl + 0.05, `small team SL ${small.sl.toFixed(3)} < large team SL ${large.sl.toFixed(3)} at the same offered load`);
  ok(small.abandon > large.abandon + 0.01, "the small team also abandons more");

  // (c) …and it also holds at equal UTILIZATION (the textbook statement): a
  //     small team at 80% loses to a large team at 80%.
  const smallU = run(2.5, 4, 8);   // 10 servers, util 0.80
  const largeU = run(2.5, 20, 40); // 50 servers, util 0.80
  ok(largeU.sl > smallU.sl + 0.01, `equal utilization: large ${largeU.sl.toFixed(3)} > small ${smallU.sl.toFixed(3)}`);
});

console.log("\n═══════════════════════════════════");
console.log(`${pass} passed, ${fail} failed`);
console.log(fail === 0 ? "R3d-A / §25 GATE: GREEN" : "R3d-A / §25 GATE: RED");
if (fail > 0) { failures.forEach((x) => console.log("  - " + x)); process.exitCode = 1; }
