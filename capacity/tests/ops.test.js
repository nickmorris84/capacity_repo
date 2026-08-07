/* M1 GATE — domain edit operations (BUILD-PLAN M1).
 *
 * Every reducer the six Setup tabs will call: pure (input never mutated),
 * guarded deletes enforced IN the op (blocked → original model returned),
 * registry rules (rename propagates by id; channels one-per-taxonomy-key),
 * request-type/process/step lifecycle driving validation transitions, volume
 * upsert semantics, service teams, fixtures and the import report.
 */
const Ops = require("../model/ops.js");
const D = require("../model/domain.js");
const { propagateDomain } = require("../model/propagate.js");

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

// Wrap an op call with a purity check: the input model must be byte-identical
// after the call. Every op in this gate goes through `run`.
function run(op, model, ...args) {
  const snap = JSON.stringify(model);
  const out = op(model, ...args);
  if (JSON.stringify(model) !== snap) throw new Error("op mutated its input: " + op.name);
  return out;
}

console.log("Ops gate — BUILD-PLAN M1");

t("registry add + rename; references are by id so renames propagate for free", () => {
  let m = Ops.blankDomainModel();
  m = run(Ops.addBrand, m, { id: "b1", name: "Acme" });
  m = run(Ops.addBusinessUnit, m, { id: "bu1", name: "Ops" });
  m = run(Ops.addProcessGroup, m, { id: "g1", name: "Billing" });
  m = run(Ops.addChannel, m, { key: "voice" });
  m = run(Ops.addQueue, m, { id: "q1", name: "Q1" });
  m = run(Ops.addRequestType, m, { id: "rt1", name: "Billing enquiry", groupId: "g1" });
  m = run(Ops.setAssignment, m, "rt1", { brandIds: ["b1"], buIds: ["bu1"] });
  m = run(Ops.addProcess, m, "rt1", "ch_voice");
  m = run(Ops.addStep, m, "rt1", "ch_voice", { queueId: "q1" });
  m = run(Ops.updateStep, m, "rt1", "ch_voice", 0, { terminal: true, outcome: "completed" });
  m = run(Ops.setVolumeEntry, m, { brandId: "b1", buId: "bu1", requestTypeId: "rt1" }, { daily: 500 });

  const before = propagateDomain(m).queues.get("q1").volume;
  const renamed = run(Ops.renameBrand, m, "b1", "Acme Group");
  ok(renamed.brands[0].name === "Acme Group", "renamed");
  eq(propagateDomain(renamed).queues.get("q1").volume, before, 1e-9, "derived output unchanged by rename");
});

t("guarded deletes return the ORIGINAL model unchanged; unreferenced deletes work", () => {
  let m = Ops.sampleDomainModel();
  ok(run(Ops.deleteBrand, m, "b_acme") === m, "brand delete blocked (referenced)");
  ok(run(Ops.deleteQueue, m, "q_qa") === m, "queue delete blocked (in steps)");
  ok(run(Ops.deleteProcessGroup, m, "pg_billing") === m, "group delete blocked");
  m = run(Ops.addBrand, m, { id: "b_spare", name: "Spare" });
  const after = run(Ops.deleteBrand, m, "b_spare");
  ok(after !== m && after.brands.every((b) => b.id !== "b_spare"), "unreferenced brand deleted");
});

t("channels: taxonomy-only, one per key, defaults editable", () => {
  let m = Ops.blankDomainModel();
  ok(run(Ops.addChannel, m, { key: "fax" }) === m, "non-taxonomy key rejected");
  m = run(Ops.addChannel, m, { key: "voice" });
  ok(run(Ops.addChannel, m, { key: "voice" }) === m, "duplicate key is a no-op");
  m = run(Ops.setChannelDefaults, m, "ch_voice", { asaTarget: 20, patience: 120 });
  eq(m.channels[0].defaults.asaTarget, 20, 1e-9, "default set");
  m = run(Ops.setChannelDefaults, m, "ch_voice", { patience: undefined });
  ok(!("patience" in m.channels[0].defaults), "undefined clears a default");
});

t("queue lifecycle: defaults, modified dot, reset", () => {
  let m = Ops.blankDomainModel();
  m = run(Ops.addQueue, m, { id: "q1", name: "Q1", type: "governance", fallbackAhtSec: 600 });
  eq(m.queues[0].staffing.occupancyCeiling, 0.85, 1e-9, "staffing defaults applied");
  m = run(Ops.updateQueueStaffing, m, "q1", { shrinkage: 0.4 });
  ok(m.queues[0]._modified, "modified dot set");
  m = run(Ops.resetQueueStaffing, m, "q1");
  eq(m.queues[0].staffing.shrinkage, 0.3, 1e-9, "reset to defaults");
  ok(!m.queues[0]._modified, "modified dot cleared");
});

t("process lifecycle: one per channel; steps add/update/remove; V3 transitions", () => {
  let m = Ops.sampleDomainModel();
  m = run(Ops.addRequestType, m, { id: "rt_x", name: "X", groupId: "pg_billing" });
  m = run(Ops.setAssignment, m, "rt_x", { brandIds: ["b_acme"], buIds: ["bu_cs"] });
  m = run(Ops.addProcess, m, "rt_x", "ch_voice");
  ok(run(Ops.addProcess, m, "rt_x", "ch_voice") === m, "second process on a channel is a no-op");
  m = run(Ops.addStep, m, "rt_x", "ch_voice", { queueId: "q_inbound" });
  // Steps but no terminal → V3 error…
  ok(D.validateDomain(m).errors.some((e) => e.kind === "endpoint_missing"), "endpoint error while open-ended");
  // …until a terminal step with an outcome closes it.
  m = run(Ops.updateStep, m, "rt_x", "ch_voice", 0, { terminal: true, outcome: "completed" });
  ok(!D.validateDomain(m).errors.some((e) => e.kind === "endpoint_missing" && e.requestTypeId === "rt_x"), "endpoint satisfied");
  m = run(Ops.updateStep, m, "rt_x", "ch_voice", 0, { splitPct: 80, samplingPct: 10 });
  eq(m.requestTypes.find((r) => r.id === "rt_x").processes[0].steps[0].splitPct, 80, 1e-9, "split updated");
  m = run(Ops.updateStep, m, "rt_x", "ch_voice", 0, { samplingPct: undefined });
  ok(!("samplingPct" in m.requestTypes.find((r) => r.id === "rt_x").processes[0].steps[0]), "sampling cleared");
  m = run(Ops.removeStep, m, "rt_x", "ch_voice", 0);
  eq(m.requestTypes.find((r) => r.id === "rt_x").processes[0].steps.length, 0, 1e-9, "step removed");
  m = run(Ops.deleteProcess, m, "rt_x", "ch_voice");
  eq(m.requestTypes.find((r) => r.id === "rt_x").processes.length, 0, 1e-9, "process removed");
});

t("clearing a terminal flag also drops its outcome", () => {
  let m = Ops.sampleDomainModel();
  m = run(Ops.updateStep, m, "rt_billing", "ch_voice", 1, { terminal: false });
  const step = m.requestTypes.find((r) => r.id === "rt_billing").processes[0].steps[1];
  ok(!("terminal" in step) && !("outcome" in step), "terminal + outcome removed");
});

t("volume entries upsert by address and clear", () => {
  let m = Ops.sampleDomainModel();
  const scope = { brandId: "b_acme", buId: "bu_cs", requestTypeId: "rt_billing" };
  m = run(Ops.setVolumeEntry, m, scope, { daily: 3000 });
  eq(m.volumeEntries.filter((e) => D.keyOf(e.scope) === D.keyOf(scope)).length, 1, 1e-9, "upsert replaced, not duplicated");
  eq(propagateDomain(m).queues.get("q_inbound").volume, 3000, 1e-6, "propagates the new figure");
  m = run(Ops.clearVolumeEntry, m, scope);
  eq(propagateDomain(m).queues.get("q_inbound").volume, 0, 1e-9, "cleared");
});

t("weekly series entry keeps its shape through upsert", () => {
  let m = Ops.sampleDomainModel();
  const weekly = new Array(52).fill(700); weekly[10] = 1400;
  m = run(Ops.setVolumeEntry, m, { brandId: "b_acme", buId: "bu_cs", requestTypeId: "rt_billing" }, { daily: 2398, weekly });
  const q = propagateDomain(m).queues.get("q_inbound");
  eq(q.weekly[10] / q.weekly[0], 2, 1e-9, "shape survives");
});

t("service teams edit the preserved engineConfig", () => {
  let m = Ops.blankDomainModel({ serviceTeams: [] });
  m = run(Ops.addServiceTeam, m, { id: "st1", name: "Flex", coversQueues: ["q1"] });
  eq(m.engineConfig.serviceTeams.length, 1, 1e-9, "added");
  m = run(Ops.updateServiceTeam, m, "st1", { size: 8 });
  eq(m.engineConfig.serviceTeams[0].size, 8, 1e-9, "updated");
  m = run(Ops.deleteServiceTeam, m, "st1");
  eq(m.engineConfig.serviceTeams.length, 0, 1e-9, "deleted");
});

t("blank model is valid and propagates cleanly to zero", () => {
  const p = propagateDomain(Ops.blankDomainModel());
  ok(p.validation.ok, "no errors on empty");
  eq(p.leaves.length, 0, 1e-9, "no leaves");
});

t("sample model: valid, and every expected derived figure lands", () => {
  const p = propagateDomain(Ops.sampleDomainModel());
  ok(p.validation.ok, "valid: " + JSON.stringify(p.validation.errors.slice(0, 2)));
  eq(p.queues.get("q_inbound").volume, 2398, 1e-6, "inbound");
  ok(p.queues.get("q_inbound").ahtMarker === "queue", "inbound marker");
  eq(p.queues.get("q_apps").volume, 702, 1e-6, "apps");
  eq(p.queues.get("q_apps").effectiveAht, 540, 1e-6, "apps rt AHT");
  ok(p.queues.get("q_apps").ahtMarker === "svc", "apps marker");
  eq(p.queues.get("q_verify").volume, 421.2, 1e-6, "verify 60%");
  const qa = p.queues.get("q_qa");
  eq(qa.volume, 2398 * 0.02 + 702 * 0.05, 1e-6, "governance sampled from both");
  eq(qa.effectiveAht, (47.96 * 600 + 35.1 * 540) / 83.06, 1e-6, "weighted QA AHT");
  ok(qa.ahtMarker === "weighted", "QA marker");
  eq(qa.usage.processes, 2, 1e-9, "QA used in 2 processes");
});

t("import report: counts + errors surfaced", () => {
  const clean = Ops.buildDomainImportReport(Ops.sampleDomainModel());
  ok(clean.ok, "sample clean");
  eq(clean.counts.requestTypes, 2, 1e-9, "counts");
  let broken = Ops.sampleDomainModel();
  broken = Ops.addStep(broken, "rt_billing", "ch_voice", { queueId: "q_ghost" });
  const rep = Ops.buildDomainImportReport(broken);
  ok(!rep.ok && rep.errors.some((e) => e.kind === "dangling_queue"), "dangling ref reported");
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("\nFAILURES:\n" + failures.map((f) => "  - " + f).join("\n")); process.exit(1); }
console.log("M1 / OPS GATE: GREEN");
