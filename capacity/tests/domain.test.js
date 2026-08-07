/* DOMAIN v1.2 GATE — the new domain layer (DOMAIN-MODEL.md).
 *
 * Pure-module tests for the flat registry, assignment/All semantics, the
 * volume cascade (totals down · weights · equal split · scaling flagged ·
 * provenance), propagation (splits, sampling, effective AHT, markers, weekly
 * shapes), validations V1–V6, registry guards — and the ROUND-TRIP: migrating
 * the v2.4 model must reproduce the old deriveQueueWorkload() volumes and
 * effective AHT exactly. Old modules are untouched; every existing gate keeps
 * guarding them.
 */
const path = require("path");
const esbuild = require("esbuild");
const D = require("../model/domain.js");
const { resolveVolumes } = require("../model/cascade.js");
const { propagateDomain } = require("../model/propagate.js");
const { migrateV2ToDomain } = require("../model/migrate-domain.js");
const OldD = require("../model/derive.js");
const { migrateV1ToV2 } = require("../model/migrate.js");
const E = require("../engine/engine.js");

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

function loadCJS(entry) {
  const out = esbuild.buildSync({ entryPoints: [path.join(__dirname, entry)], bundle: true, format: "cjs", platform: "node", write: false, external: ["react", "react-dom", "xlsx"], logLevel: "silent" });
  const m = { exports: {} };
  new Function("module", "exports", "require", out.outputFiles[0].text)(m, m.exports, require);
  return m.exports;
}

// ---- fixtures ----------------------------------------------------------------
const rt = (id, groupId, over = {}) => ({
  id, name: id, activity: "service_request", productRequest: "existing",
  groupId, brandIds: ["A"], buIds: ["bu1"],
  processes: [{ channelId: "ch_voice", outcomes: ["completed"], steps: [{ queueId: "q_" + id, splitPct: 100, terminal: true, outcome: "completed" }] }],
  ...over,
});
function base(over = {}) {
  return {
    brands: [{ id: "A", name: "Brand A" }],
    businessUnits: [{ id: "bu1", name: "Ops" }],
    channels: [{ id: "ch_voice", key: "voice" }, { id: "ch_digital", key: "digital" }],
    processGroups: [{ id: "g1", name: "Billing" }, { id: "g2", name: "Cards" }, { id: "g3", name: "Collections" }],
    products: [],
    queues: [
      { id: "q_billing", name: "Q Billing", type: "inbound_call", fallbackAhtSec: 300, staffing: {} },
      { id: "q_newcard", name: "Q Newcard", type: "inbound_call", fallbackAhtSec: 300, staffing: {} },
      { id: "q_collections", name: "Q Collections", type: "inbound_call", fallbackAhtSec: 300, staffing: {} },
    ],
    requestTypes: [rt("billing", "g1"), rt("newcard", "g2"), rt("collections", "g3")],
    volumeEntries: [],
    ...over,
  };
}
const leafOf = (r, rtId) => r.leaves.find((l) => l.requestTypeId === rtId);

console.log("Domain gate — DOMAIN-MODEL v1.2");

// ---- leaves & assignment -----------------------------------------------------
t("empty assignment lists mean All (brands × BUs × processes)", () => {
  const m = base({
    brands: [{ id: "A" }, { id: "B" }],
    businessUnits: [{ id: "bu1" }, { id: "bu2" }],
    requestTypes: [rt("billing", "g1", { brandIds: [], buIds: [] })],
  });
  eq(D.leaves(m).length, 4, 1e-9, "2 brands × 2 BUs × 1 process");
});

// ---- the cascade -------------------------------------------------------------
t("owner example: brand total splits — entered keeps, remainder equal", () => {
  const m = base({
    volumeEntries: [
      { scope: { brandId: "A" }, daily: 10000 },
      { scope: { brandId: "A", buId: "bu1", requestTypeId: "collections" }, daily: 5000 },
    ],
  });
  const r = resolveVolumes(m);
  eq(leafOf(r, "collections").total, 5000, 1e-6, "entered kept");
  eq(leafOf(r, "billing").total, 2500, 1e-6, "remainder equal 1");
  eq(leafOf(r, "newcard").total, 2500, 1e-6, "remainder equal 2");
  ok(leafOf(r, "collections").provenance === "entered", "prov entered");
  ok(leafOf(r, "billing").provenance === "equal", "prov equal");
});

t("entered children exceeding the parent are scaled — and flagged, never silent", () => {
  const m = base({
    volumeEntries: [
      { scope: { brandId: "A" }, daily: 10000 },
      { scope: { brandId: "A", buId: "bu1", requestTypeId: "billing" }, daily: 8000 },
      { scope: { brandId: "A", buId: "bu1", requestTypeId: "newcard" }, daily: 4000 },
    ],
  });
  const r = resolveVolumes(m);
  const f = 10000 / 12000;
  eq(leafOf(r, "billing").total, 8000 * f, 1e-6, "scaled billing");
  ok(leafOf(r, "billing").provenance === "scaled", "prov scaled");
  eq(leafOf(r, "collections").total, 0, 1e-9, "unentered gets none when overrun");
  ok(r.notes.some((n) => n.kind === "scaled"), "reconciliation note emitted");
});

t("no coarser figure: entered leaves stand; ancestors report the sum", () => {
  const m = base({
    volumeEntries: [
      { scope: { brandId: "A", buId: "bu1", requestTypeId: "billing" }, daily: 6000 },
      { scope: { brandId: "A", buId: "bu1", requestTypeId: "newcard" }, daily: 3000 },
    ],
  });
  const r = resolveVolumes(m);
  eq(leafOf(r, "billing").total, 6000, 1e-9, "entered");
  eq(leafOf(r, "collections").total, 0, 1e-9, "unknown → 0");
  eq(r.nodes.get(D.keyOf({ brandId: "A" })).total, 9000, 1e-6, "brand total = sum");
  ok(r.nodes.get(D.keyOf({ brandId: "A" })).prov === "sum", "prov sum");
});

t("same-address entries sum (two profile sources → one request type)", () => {
  const m = base({
    volumeEntries: [
      { scope: { brandId: "A", buId: "bu1", requestTypeId: "billing" }, daily: 1998 },
      { scope: { brandId: "A", buId: "bu1", requestTypeId: "billing" }, daily: 400 },
    ],
  });
  eq(leafOf(resolveVolumes(m), "billing").total, 2398, 1e-9, "summed");
});

t("a request type's volume splits equally across its channels when unspecified", () => {
  const m = base({
    requestTypes: [rt("billing", "g1", {
      processes: [
        { channelId: "ch_voice", outcomes: ["completed"], steps: [{ queueId: "q_billing", splitPct: 100, terminal: true, outcome: "completed" }] },
        { channelId: "ch_digital", outcomes: ["completed"], steps: [{ queueId: "q_newcard", splitPct: 100, terminal: true, outcome: "completed" }] },
      ],
    })],
    volumeEntries: [{ scope: { brandId: "A", buId: "bu1", requestTypeId: "billing" }, daily: 1000 }],
  });
  const p = propagateDomain(m);
  eq(p.queues.get("q_billing").volume, 500, 1e-9, "voice half");
  eq(p.queues.get("q_newcard").volume, 500, 1e-9, "digital half");
});

t("shapes inherit downward and reach queue weekly series", () => {
  const weekly = new Array(52).fill(1); weekly[0] = 2; // wk1 is twice the rest
  const m = base({
    volumeEntries: [{ scope: { brandId: "A" }, daily: 900, weekly }],
  });
  const p = propagateDomain(m);
  const q = p.queues.get("q_billing");
  ok(q.volume > 0, "volume flowed");
  eq(q.weekly[0] / q.weekly[1], 2, 1e-9, "inherited shape ratio");
  eq(q.weekly.reduce((a, b) => a + b, 0) / 52, q.volume, 1e-6, "weekly mean = daily volume");
});

// ---- propagation -------------------------------------------------------------
t("step split % and sampling % compound", () => {
  const m = base({
    requestTypes: [rt("billing", "g1", {
      processes: [{ channelId: "ch_voice", outcomes: ["completed"], steps: [
        { queueId: "q_billing", splitPct: 100 },
        { queueId: "q_collections", splitPct: 60, samplingPct: 10, terminal: true, outcome: "completed" },
      ] }],
    })],
    volumeEntries: [{ scope: { brandId: "A", buId: "bu1", requestTypeId: "billing" }, daily: 1000 }],
  });
  const p = propagateDomain(m);
  eq(p.queues.get("q_collections").volume, 60, 1e-9, "1000 × 60% × 10%");
});

t("effective AHT blends volume-weighted with svc/weighted/queue markers", () => {
  const m = base({
    requestTypes: [
      rt("billing", "g1", { ahtSec: 240, processes: [{ channelId: "ch_voice", outcomes: ["completed"], steps: [{ queueId: "q_billing", splitPct: 100, terminal: true, outcome: "completed" }] }] }),
      rt("newcard", "g2", { processes: [{ channelId: "ch_voice", outcomes: ["completed"], steps: [{ queueId: "q_billing", splitPct: 100, terminal: true, outcome: "completed" }] }] }),
      rt("collections", "g3"),
    ],
    volumeEntries: [
      { scope: { brandId: "A", buId: "bu1", requestTypeId: "billing" }, daily: 1000 },
      { scope: { brandId: "A", buId: "bu1", requestTypeId: "newcard" }, daily: 500 },
      { scope: { brandId: "A", buId: "bu1", requestTypeId: "collections" }, daily: 100 },
    ],
  });
  const p = propagateDomain(m);
  const shared = p.queues.get("q_billing");
  eq(shared.effectiveAht, (1000 * 240 + 500 * 300) / 1500, 1e-9, "weighted blend");
  ok(shared.ahtMarker === "weighted", "marker weighted");
  ok(p.queues.get("q_collections").ahtMarker === "queue", "single rt, fallback AHT → queue");
});

t("request-type AHT override alone marks 'svc'", () => {
  const m = base({
    requestTypes: [rt("billing", "g1", { ahtSec: 240 })],
    volumeEntries: [{ scope: { brandId: "A", buId: "bu1", requestTypeId: "billing" }, daily: 100 }],
  });
  const q = propagateDomain(m).queues.get("q_billing");
  eq(q.effectiveAht, 240, 1e-9, "override applied");
  ok(q.ahtMarker === "svc", "marker svc");
});

// ---- validation --------------------------------------------------------------
t("V1: a volume entry addressing nothing is flagged inert, never blocks", () => {
  const m = base({
    brands: [{ id: "A" }, { id: "B" }],
    volumeEntries: [{ scope: { brandId: "B" }, daily: 500 }], // no rt covers B
  });
  const p = propagateDomain(m);
  ok(p.validation.warnings.some((w) => w.kind === "uncovered_volume"), "uncovered warning");
  ok(p.validation.ok, "still no errors");
});

t("V2: two request types in one group covering the same brand/BU/channel warn", () => {
  const m = base({
    requestTypes: [rt("billing", "g1"), rt("newcard", "g1", {
      processes: [{ channelId: "ch_voice", outcomes: ["completed"], steps: [{ queueId: "q_newcard", splitPct: 100, terminal: true, outcome: "completed" }] }],
    })],
  });
  ok(D.validateDomain(m).warnings.some((w) => w.kind === "double_cover"), "double-cover warned");
});

t("V3: a process with steps but no declared end point is an error", () => {
  const m = base({
    requestTypes: [rt("billing", "g1", {
      processes: [{ channelId: "ch_voice", outcomes: ["completed"], steps: [{ queueId: "q_billing", splitPct: 100 }] }],
    })],
  });
  const v = D.validateDomain(m);
  ok(!v.ok && v.errors.some((e) => e.kind === "endpoint_missing"), "endpoint error");
});

t("dangling references are errors", () => {
  const m = base({
    requestTypes: [rt("billing", "g1", {
      processes: [{ channelId: "ch_ghost", outcomes: ["completed"], steps: [{ queueId: "q_ghost", splitPct: 100, terminal: true, outcome: "x" }] }],
    })],
  });
  const v = D.validateDomain(m);
  ok(v.errors.some((e) => e.kind === "dangling_channel"), "channel");
  ok(v.errors.some((e) => e.kind === "dangling_queue"), "queue");
});

t("registry guards: delete blocked with dependents; unreferenced deletes allowed", () => {
  const m = base();
  ok(!D.canDeleteBrand(m, "A").ok, "brand referenced by assignment");
  ok(!D.canDeleteQueue(m, "q_billing").ok, "queue referenced by a step");
  ok(!D.canDeleteGroup(m, "g1").ok, "group referenced");
  ok(!D.canDeleteChannel(m, "ch_voice").ok, "channel referenced");
  ok(D.canDeleteChannel(m, "ch_digital").ok, "unused channel deletable");
  ok(D.canDeleteProduct(m, "p_none").ok, "unknown product trivially deletable");
});

t("queue blast radius: used in N processes across M brands", () => {
  const m = base({
    brands: [{ id: "A" }, { id: "B" }],
    requestTypes: [
      rt("billing", "g1", { brandIds: ["A", "B"] }),
      rt("newcard", "g2", { processes: [{ channelId: "ch_voice", outcomes: ["completed"], steps: [{ queueId: "q_billing", splitPct: 50, terminal: true, outcome: "completed" }] }] }),
    ],
  });
  const u = D.queueUsage(m, "q_billing");
  eq(u.processes, 2, 1e-9, "two processes");
  eq(u.brands, 2, 1e-9, "two brands");
});

// ---- the round-trip ----------------------------------------------------------
function assertRoundTrip(v2model, label) {
  const old = OldD.deriveQueueWorkload(v2model);
  const dom = migrateV2ToDomain(v2model);
  const p = propagateDomain(dom);
  for (const [qid, o] of old) {
    const n = p.queues.get(qid);
    ok(n, label + ": queue " + qid + " present");
    eq(n.volume, o.volume, 1e-6, label + " volume " + qid);
    eq(n.effectiveAht, o.effectiveAht, 1e-6, label + " AHT " + qid);
    ok(n.ahtMarker === o.ahtMarker, label + " marker " + qid + ": " + n.ahtMarker + " vs " + o.ahtMarker);
  }
  ok(p.validation.ok, label + ": migrated model valid: " + JSON.stringify(p.validation.errors.slice(0, 2)));
}

t("ROUND-TRIP: the v2 sample model reproduces old derivation exactly", () => {
  const Model = loadCJS("../ui/v2/model.js");
  assertRoundTrip(Model.sampleModel(), "sample");
});

t("ROUND-TRIP: the migrated shipping default config reproduces old derivation exactly", () => {
  const v2 = migrateV1ToV2(E.makeDefaultConfig());
  assertRoundTrip(v2, "default");
  ok(migrateV2ToDomain(v2).engineConfig, "engineConfig carried");
});

t("migration is deterministic", () => {
  const v2 = migrateV1ToV2(E.makeDefaultConfig());
  ok(JSON.stringify(migrateV2ToDomain(v2)) === JSON.stringify(migrateV2ToDomain(v2)), "byte-identical");
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("\nFAILURES:\n" + failures.map((f) => "  - " + f).join("\n")); process.exit(1); }
console.log("DOMAIN v1.2 GATE: GREEN");
