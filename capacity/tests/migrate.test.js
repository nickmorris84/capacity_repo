/* Step 1 companion GATE — v1 → v2 migration + exact derivation round-trip.
 *
 * Migrating the shipped v1 default config into the v2 model and running it
 * through the derivation module must reproduce the SAME per-queue demand the
 * engine saw before: derived volume === old dailyVolume, derived effective AHT
 * === old AHT. The migrated model must also be structurally valid with no
 * cross-structure warnings (everything is in-path by construction).
 */
const E = require("../engine/engine.js");
const D = require("../model/derive.js");
const M = require("../model/migrate.js");

let pass = 0, fail = 0;
const failures = [];
function t(name, fn) {
  try { fn(); pass++; console.log("  ✓ " + name); }
  catch (e) { fail++; failures.push(name + ": " + e.message); console.log("  ✗ " + name + " — " + e.message); }
}
function eq(a, b, tol, what) {
  if (!(Math.abs(a - b) <= (tol == null ? 1e-9 : tol))) throw new Error(`${what || "value"} ${a} ≠ ${b}`);
}
function ok(cond, what) { if (!cond) throw new Error(what || "condition failed"); }

console.log("Migration gate — v1 → v2 (v2.4 Step 1)");

const cfg = E.makeDefaultConfig();
const model = M.migrateV1ToV2(cfg);

t("each v1 queue becomes one queue + one service + one profile", () => {
  eq(model.queues.length, cfg.queues.length, 1e-9, "queue count preserved");
  eq(model.services.length, cfg.queues.length, 1e-9, "one service per queue");
  eq(model.profiles.length, cfg.queues.length, 1e-9, "one profile per queue");
});

t("structure gains a default Business Unit and Product per brand (D19a)", () => {
  for (const b of model.brands) {
    eq(b.businessUnits.length, 1, 1e-9, "one BU");
    eq(b.businessUnits[0].products.length, 1, 1e-9, "one product");
    ok(b.businessUnits[0].products[0].channels.length >= 1, "at least one channel instance");
  }
});

t("derivation round-trip: derived queue volume === old dailyVolume", () => {
  const derived = D.deriveQueueWorkload(model);
  for (const q of cfg.queues) {
    eq(derived.get(q.id).volume, q.dailyVolume, 1e-6, `volume for ${q.id}`);
  }
});

t("derivation round-trip: derived effective AHT === old AHT", () => {
  const derived = D.deriveQueueWorkload(model);
  for (const q of cfg.queues) {
    eq(derived.get(q.id).effectiveAht, q.aht, 1e-6, `effective AHT for ${q.id}`);
    ok(derived.get(q.id).ahtMarker === "svc", `marker svc for ${q.id}`);
  }
});

t("migrated model is valid with no cross-structure warnings", () => {
  const v = D.validateModel(model);
  ok(v.ok, "model valid: " + JSON.stringify(v.errors));
  const cross = v.warnings.filter((w) => w.kind === "cross_structure");
  eq(cross.length, 0, 1e-9, "no cross-structure warnings (all in-path)");
});

t("migration is deterministic (stable ids, no random)", () => {
  const a = JSON.stringify(M.migrateV1ToV2(cfg));
  const b = JSON.stringify(M.migrateV1ToV2(cfg));
  ok(a === b, "two migrations byte-identical");
  ok(model.queues.every((q) => cfg.queues.some((c) => c.id === q.id)), "queue ids preserved");
});

t("voice → inbound_call, digital → case_processing", () => {
  for (const q of cfg.queues) {
    const mq = model.queues.find((x) => x.id === q.id);
    ok(mq.type === (q.type === "voice" ? "inbound_call" : "case_processing"), `type map for ${q.id}`);
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("\nFAILURES:\n" + failures.map((f) => "  - " + f).join("\n")); process.exit(1); }
console.log("STEP 1 MIGRATION GATE: GREEN");
