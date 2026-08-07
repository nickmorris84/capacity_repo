/* M3 GATE — domain persistence + the v2.4 upgrade path (BUILD-PLAN M3). */
const { saveDomainModel, loadDomainModel, clearDomainModel, V3_KEY, V2_KEY } = require("../model/store-domain.js");
const { migrateV1ToV2 } = require("../model/migrate.js");
const { migrateV2ToDomain } = require("../model/migrate-domain.js");
const { propagateDomain } = require("../model/propagate.js");
const Ops = require("../model/ops.js");
const E = require("../engine/engine.js");

let pass = 0, fail = 0;
const failures = [];
function t(name, fn) {
  try { fn(); pass++; console.log("  ✓ " + name); }
  catch (e) { fail++; failures.push(name + ": " + e.message); console.log("  ✗ " + name + " — " + e.message); }
}
function ok(c, w) { if (!c) throw new Error(w || "condition failed"); }

const stub = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
};

console.log("Store gate — BUILD-PLAN M3");

t("fresh storage loads nothing", () => {
  ok(loadDomainModel(stub()) === null, "null on empty");
});

t("save → load round-trips byte-identical", () => {
  const s = stub();
  const model = Ops.sampleDomainModel();
  ok(saveDomainModel(model, s), "saved");
  const r = loadDomainModel(s);
  ok(r && r.migratedFrom === null, "no migration on native load");
  ok(JSON.stringify(r.model) === JSON.stringify(model), "byte-identical");
});

t("a saved v2.4 model migrates on load, persists to v3, and keeps the old key", () => {
  const s = stub();
  const v2model = migrateV1ToV2(E.makeDefaultConfig());
  s.setItem(V2_KEY, JSON.stringify(v2model));
  const r = loadDomainModel(s);
  ok(r && r.migratedFrom === "v2.4", "flagged as migrated");
  ok(JSON.stringify(r.model) === JSON.stringify(migrateV2ToDomain(v2model)), "deterministic migration");
  ok(s.getItem(V3_KEY), "upgrade persisted to the v3 key");
  ok(s.getItem(V2_KEY), "v2.4 key left intact for rollback");
  ok(propagateDomain(r.model).validation.ok, "migrated model valid");
  const again = loadDomainModel(s);
  ok(again.migratedFrom === null, "second load is native v3");
});

t("corrupt payloads read as absent, never throw", () => {
  const s = stub();
  s.setItem(V3_KEY, "{not json");
  s.setItem(V2_KEY, "also not json");
  ok(loadDomainModel(s) === null, "null on corruption");
});

t("v3 takes precedence over a lingering v2.4 save; clear removes only v3", () => {
  const s = stub();
  saveDomainModel(Ops.sampleDomainModel(), s);
  s.setItem(V2_KEY, JSON.stringify(migrateV1ToV2(E.makeDefaultConfig())));
  const r = loadDomainModel(s);
  ok(r.migratedFrom === null && r.model.brands[0].id === "b_acme", "v3 wins");
  clearDomainModel(s);
  ok(!s._m.has(V3_KEY) && s._m.has(V2_KEY), "clear removes v3 only");
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("\nFAILURES:\n" + failures.map((f) => "  - " + f).join("\n")); process.exit(1); }
console.log("M3 / STORE GATE: GREEN");
