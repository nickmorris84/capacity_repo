/* M2 GATE — the engine bridge (BUILD-PLAN M2).
 *
 * The theorem: for a migrated model with flat shapes, the domain path
 * (migrate-domain → bridge → engine) must simulate IDENTICALLY to the old
 * path (v2ToEngineConfig → engine) — cfg-level field equality and exact
 * compactRun equality for every strategy. Plus the new capability: a weekly
 * shape reaches the engine as weeklyVolumes and moves weekly demand.
 */
const E = require("../engine/engine.js");
const { migrateV1ToV2 } = require("../model/migrate.js");
const { v2ToEngineConfig } = require("../model/adapter.js");
const { migrateV2ToDomain } = require("../model/migrate-domain.js");
const { domainToEngineConfig } = require("../model/bridge.js");
const Ops = require("../model/ops.js");

let pass = 0, fail = 0;
const failures = [];
function t(name, fn) {
  try { fn(); pass++; console.log("  ✓ " + name); }
  catch (e) { fail++; failures.push(name + ": " + e.message); console.log("  ✗ " + name + " — " + e.message); }
}
function eq(a, b, tol, what) {
  if (!(Math.abs(a - b) <= (tol == null ? 1e-9 : tol))) throw new Error(`${what || "value"} ${a} ≠ ${b}`);
}
function ok(c, w) { if (!c) throw new Error(w || "condition failed"); }

function firstDiff(a, b, path = "") {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return `${path}: array shape`;
    if (a.length !== b.length) return `${path}: length ${a.length} ≠ ${b.length}`;
    for (let i = 0; i < a.length; i++) { const d = firstDiff(a[i], b[i], `${path}[${i}]`); if (d) return d; }
    return null;
  }
  if (a && b && typeof a === "object") {
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return `${path}: keys ${ka.filter((k) => !kb.includes(k))} / ${kb.filter((k) => !ka.includes(k))}`;
    for (const k of ka) { if (!(k in b)) return `${path}.${k} missing`; const d = firstDiff(a[k], b[k], `${path}.${k}`); if (d) return d; }
    return null;
  }
  if (typeof a === "number" && typeof b === "number")
    return Math.abs(a - b) <= 1e-6 + 1e-9 * Math.max(Math.abs(a), Math.abs(b)) ? null : `${path}: ${a} ≠ ${b}`;
  return a === b ? null : `${path}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`;
}
const sortQ = (cr) => ({ ...cr, queues: [...cr.queues].sort((x, y) => (x.id < y.id ? -1 : 1)) });

console.log("Bridge gate — BUILD-PLAN M2");

const v2 = migrateV1ToV2(E.makeDefaultConfig());
const cfgOld = v2ToEngineConfig(v2);
const cfgNew = domainToEngineConfig(migrateV2ToDomain(v2));

t("cfg equality: every engine queue field matches the old adapter (flat shapes)", () => {
  ok(cfgNew.queues.length === cfgOld.queues.length, "queue count");
  for (const oq of cfgOld.queues) {
    const nq = cfgNew.queues.find((x) => x.id === oq.id);
    ok(nq, "queue " + oq.id);
    const d = firstDiff(oq, nq, oq.id);
    ok(!d, d || "");
  }
  ok(firstDiff(cfgOld.engine, cfgNew.engine) === null, "engine block identical");
  ok(firstDiff(cfgOld.hiring, cfgNew.hiring) === null, "hiring block identical");
});

t("SIMULATION EQUALITY: domain path ≡ old path for every strategy", () => {
  for (const strategy of ["S1", "S2", "S3", "S4"]) {
    const a = E.compactRun(cfgOld, E.simulate(cfgOld, { strategy }));
    const b = E.compactRun(cfgNew, E.simulate(cfgNew, { strategy }));
    const d = firstDiff(sortQ(a), sortQ(b), strategy);
    ok(!d, d || "");
  }
});

t("a weekly shape reaches the engine and moves weekly demand", () => {
  let m = Ops.sampleDomainModel();
  const engineConfig = { ...E.makeDefaultConfig() };
  delete engineConfig.queues;
  // Isolate the shape: the engine's own seasonality multiplies ON TOP of
  // weeklyVolumes, so flatten it (and disable scenarios below). The remaining
  // wobble is the always-on redial feedback, hence the loose tolerance.
  engineConfig.seasonality = { startMonth: 0, system: [...E.SEASONAL_PRESETS["Flat"]] };
  m.engineConfig = engineConfig;
  const weekly = new Array(52).fill(2398); weekly[10] = 4796; // wk 11 doubles
  m = Ops.setVolumeEntry(m, { brandId: "b_acme", buId: "bu_cs", requestTypeId: "rt_billing" },
    { daily: 2398, weekly });
  const cfg = domainToEngineConfig(m);
  const qi = cfg.queues.find((q) => q.id === "q_inbound");
  ok(Array.isArray(qi.weeklyVolumes), "weeklyVolumes populated for shaped queue");
  eq(qi.weeklyVolumes[10] / qi.weeklyVolumes[0], 2, 1e-9, "bridge carries the exact shape");
  ok(cfg.queues.find((q) => q.id === "q_apps").weeklyVolumes === null, "flat queue stays null");
  const sim = E.simulate(cfg, { strategy: "S1", viewIds: [] });
  const r = sim.weeks[10].queues.q_inbound.volume / sim.weeks[0].queues.q_inbound.volume;
  eq(r, 2, 0.25, "weekly demand ≈ doubles in week 11 (redial feedback aside)");
  ok(r > 1.6, "the peak clearly lands");
});

t("Setup-authored domain queues simulate (defaults filled)", () => {
  let m = Ops.sampleDomainModel();
  const engineConfig = { ...E.makeDefaultConfig() };
  delete engineConfig.queues;
  m.engineConfig = engineConfig;
  m = Ops.addQueue(m, { id: "q_new", name: "New station", type: "inbound_call" });
  m = Ops.addProcess(m, "rt_billing", "ch_digital");
  m = Ops.addStep(m, "rt_billing", "ch_digital", { queueId: "q_new" });
  m = Ops.updateStep(m, "rt_billing", "ch_digital", 0, { terminal: true, outcome: "completed" });
  const cfg = domainToEngineConfig(m);
  const nq = cfg.queues.find((q) => q.id === "q_new");
  ok(nq.burn && nq.wf && Array.isArray(nq.profile), "engine-required fields filled");
  let threw = null;
  try { E.simulate(cfg, { strategy: "S1", viewIds: [] }); } catch (e) { threw = e.message; }
  ok(!threw, "simulates: " + threw);
});

t("bridge refuses a model with no engineConfig", () => {
  let threw = false;
  try { domainToEngineConfig(Ops.blankDomainModel()); } catch { threw = true; }
  ok(threw, "throws without the carry");
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("\nFAILURES:\n" + failures.map((f) => "  - " + f).join("\n")); process.exit(1); }
console.log("M2 / BRIDGE GATE: GREEN");
