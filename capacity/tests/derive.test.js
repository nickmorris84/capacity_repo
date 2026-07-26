/* Step 1 GATE — the derivation module (v2.4 rebuild §1, rules 1–7).
 *
 * Pure-module unit tests: volume propagation with deepest-wins precedence,
 * volume-weighted effective AHT, journey split/sampling, the cross-structure
 * guard (the Loans-style acceptance case), unmodelled-remainder + over-100
 * mix handling, shared-queue cost allocation by handling minutes, referential
 * integrity blocks, and dangling-reference validation. Zero-dep harness.
 */
const D = require("../model/derive.js");

let pass = 0, fail = 0;
const failures = [];
function t(name, fn) {
  try { fn(); pass++; console.log("  ✓ " + name); }
  catch (e) { fail++; failures.push(name + ": " + e.message); console.log("  ✗ " + name + " — " + e.message); }
}
function eq(a, b, tol, what) {
  if (!(Math.abs(a - b) <= (tol == null ? 1e-9 : tol))) throw new Error(`${what || "value"} ${a} ≠ ${b} ±${tol == null ? 1e-9 : tol}`);
}
function ok(cond, what) { if (!cond) throw new Error(what || "condition failed"); }

// A structure shared by several tests: Acme › Retail › {Loans, Cards} › channels.
function baseStructure() {
  return [{
    id: "b1", name: "Acme", businessUnits: [{
      id: "bu1", name: "Retail", products: [
        { id: "p_loans", name: "Loans", channels: [
          { id: "ci_loans_voice", channel: "voice" },
          { id: "ci_loans_digital", channel: "digital" },
        ] },
        { id: "p_cards", name: "Cards", channels: [
          { id: "ci_cards_voice", channel: "voice" },
        ] },
      ],
    }],
  }];
}

console.log("Derivation module gate — v2.4 Step 1");

// ---- rule 1: volume propagation = deepest profile total × mix % --------------
t("service volume = profile total × mix %", () => {
  const model = {
    brands: baseStructure(),
    queues: [{ id: "q1", name: "Q1", type: "voice", attachment: { kind: "structural", channelInstanceId: "ci_loans_voice" }, fallbackAhtSec: 300 }],
    services: [{ id: "svc", name: "SR", activity: "service_request", productRequest: "existing", journey: [{ queueId: "q1", splitPct: 100 }] }],
    profiles: [{ id: "pf", appliesAt: { level: "channel", nodeId: "ci_loans_voice" }, totalVolume: 1000, mix: [{ serviceId: "svc", pct: 80 }] }],
  };
  const sv = D.deriveServiceVolumes(model);
  eq(sv.get("svc").volume, 800, 1e-9, "svc volume");
});

t("deepest wins: a channel profile supersedes a BU profile for the same service", () => {
  const model = {
    brands: baseStructure(),
    queues: [{ id: "q1", name: "Q1", type: "voice", attachment: { kind: "structural", channelInstanceId: "ci_loans_voice" }, fallbackAhtSec: 300 }],
    services: [{ id: "svc", name: "SR", activity: "service_request", productRequest: "existing", journey: [{ queueId: "q1", splitPct: 100 }] }],
    profiles: [
      { id: "pf_bu", appliesAt: { level: "bu", nodeId: "bu1" }, totalVolume: 5000, mix: [{ serviceId: "svc", pct: 50 }] },        // would be 2500
      { id: "pf_ch", appliesAt: { level: "channel", nodeId: "ci_loans_voice" }, totalVolume: 1000, mix: [{ serviceId: "svc", pct: 80 }] }, // 800, deeper
    ],
  };
  const sv = D.deriveServiceVolumes(model).get("svc");
  eq(sv.volume, 800, 1e-9, "deepest-wins volume");
  const bu = sv.sources.find((s) => s.profileId === "pf_bu");
  ok(bu.superseded, "BU source superseded");
  eq(bu.volume, 0, 1e-9, "superseded contributes 0");
});

t("disjoint profiles on different paths both contribute (summed)", () => {
  const model = {
    brands: baseStructure(),
    queues: [{ id: "q1", name: "Q1", type: "voice", attachment: { kind: "structural", channelInstanceId: "ci_loans_voice" }, fallbackAhtSec: 300 }],
    services: [{ id: "svc", name: "SR", activity: "service_request", productRequest: "existing", journey: [{ queueId: "q1", splitPct: 100 }] }],
    profiles: [
      { id: "pf_a", appliesAt: { level: "channel", nodeId: "ci_loans_voice" }, totalVolume: 1000, mix: [{ serviceId: "svc", pct: 50 }] },  // 500
      { id: "pf_b", appliesAt: { level: "channel", nodeId: "ci_cards_voice" }, totalVolume: 400, mix: [{ serviceId: "svc", pct: 100 }] }, // 400
    ],
  };
  eq(D.deriveServiceVolumes(model).get("svc").volume, 900, 1e-9, "summed disjoint volume");
});

// ---- rules 1+2: queue workload (split × sampling) and effective AHT ----------
t("queue workload applies split and sampling; governance sampling reduces volume", () => {
  const model = {
    brands: baseStructure(),
    queues: [
      { id: "q_voice", name: "Voice", type: "inbound_call", attachment: { kind: "structural", channelInstanceId: "ci_loans_voice" }, fallbackAhtSec: 300 },
      { id: "q_gov", name: "Governance", type: "governance", attachment: { kind: "shared" }, fallbackAhtSec: 600 },
    ],
    services: [{ id: "svc", name: "SR", activity: "service_request", productRequest: "existing",
      journey: [{ queueId: "q_voice", splitPct: 100 }, { queueId: "q_gov", splitPct: 100, samplingPct: 10 }] }],
    profiles: [{ id: "pf", appliesAt: { level: "channel", nodeId: "ci_loans_voice" }, totalVolume: 1000, mix: [{ serviceId: "svc", pct: 100 }] }],
  };
  const qw = D.deriveQueueWorkload(model);
  eq(qw.get("q_voice").volume, 1000, 1e-9, "voice full volume");
  eq(qw.get("q_gov").volume, 100, 1e-9, "governance = 10% sampled");
});

t("effective AHT is the volume-weighted average of per-service AHTs", () => {
  const model = {
    brands: baseStructure(),
    queues: [{ id: "qm", name: "Multi", type: "inbound_call", attachment: { kind: "structural", channelInstanceId: "ci_loans_voice" }, fallbackAhtSec: 300 }],
    services: [
      { id: "svc_a", name: "A", activity: "service_request", productRequest: "existing", ahtSec: 240, journey: [{ queueId: "qm", splitPct: 100 }] },
      { id: "svc_b", name: "B", activity: "service_request", productRequest: "new", journey: [{ queueId: "qm", splitPct: 100 }] }, // uses fallback 300
    ],
    profiles: [
      { id: "pf_a", appliesAt: { level: "channel", nodeId: "ci_loans_voice" }, totalVolume: 1000, mix: [{ serviceId: "svc_a", pct: 100 }] },
      { id: "pf_b", appliesAt: { level: "channel", nodeId: "ci_loans_digital" }, totalVolume: 500, mix: [{ serviceId: "svc_b", pct: 100 }] },
    ],
  };
  const q = D.deriveQueueWorkload(model).get("qm");
  eq(q.volume, 1500, 1e-9, "combined volume");
  // (1000×240 + 500×300) / 1500 = 260
  eq(q.effectiveAht, 260, 1e-9, "weighted effective AHT");
  ok(q.ahtMarker === "weighted", "marker weighted for a multi-service blend");
  const b = q.byService.find((s) => s.serviceId === "svc_b");
  ok(b.ahtSource === "fallback", "svc_b falls back to queue AHT");
});

t("single-service queue with a service AHT is marked 'svc'", () => {
  const model = {
    brands: baseStructure(),
    queues: [{ id: "qd", name: "Digital", type: "case_processing", attachment: { kind: "structural", channelInstanceId: "ci_loans_digital" }, fallbackAhtSec: 420 }],
    services: [{ id: "svc", name: "Lead", activity: "lead", productRequest: "new", ahtSec: 200, journey: [{ queueId: "qd", splitPct: 100 }] }],
    profiles: [{ id: "pf", appliesAt: { level: "channel", nodeId: "ci_loans_digital" }, totalVolume: 300, mix: [{ serviceId: "svc", pct: 100 }] }],
  };
  const q = D.deriveQueueWorkload(model).get("qd");
  eq(q.effectiveAht, 200, 1e-9, "svc AHT overrides fallback");
  ok(q.ahtMarker === "svc", "marker svc");
});

t("journey-step lag is parsed but NOT applied in v1 (owner decision)", () => {
  const model = {
    brands: baseStructure(),
    queues: [{ id: "q1", name: "Q1", type: "voice", attachment: { kind: "structural", channelInstanceId: "ci_loans_voice" }, fallbackAhtSec: 300 }],
    services: [{ id: "svc", name: "SR", activity: "service_request", productRequest: "existing", journey: [{ queueId: "q1", splitPct: 100, lagDays: 5 }] }],
    profiles: [{ id: "pf", appliesAt: { level: "channel", nodeId: "ci_loans_voice" }, totalVolume: 1000, mix: [{ serviceId: "svc", pct: 100 }] }],
  };
  eq(D.deriveQueueWorkload(model).get("q1").volume, 1000, 1e-9, "lag does not shift volume in v1");
});

// ---- rule 4: cross-structure guard (the Loans-style acceptance case) ---------
t("Loans-style cross-structure case raises a warning (not a block)", () => {
  const model = {
    brands: baseStructure(),
    queues: [{ id: "q_cards", name: "Cards Voice", type: "inbound_call", attachment: { kind: "structural", channelInstanceId: "ci_cards_voice" }, fallbackAhtSec: 250 }],
    // A service whose volume ENTERS at Loans voice but ROUTES to a Cards queue.
    services: [{ id: "svc_x", name: "Cross", activity: "service_request", productRequest: "existing", journey: [{ queueId: "q_cards", splitPct: 100 }] }],
    profiles: [{ id: "pf", appliesAt: { level: "channel", nodeId: "ci_loans_voice" }, totalVolume: 1000, mix: [{ serviceId: "svc_x", pct: 100 }] }],
  };
  const w = D.crossStructureWarnings(model);
  eq(w.length, 1, 1e-9, "one cross-structure warning");
  ok(w[0].queueId === "q_cards" && w[0].serviceId === "svc_x", "warning identifies service + queue");
  // Not a block: volume still derives.
  eq(D.deriveQueueWorkload(model).get("q_cards").volume, 1000, 1e-9, "volume derives despite warning");
});

t("in-path structural routing raises NO warning; shared queues are silent", () => {
  const model = {
    brands: baseStructure(),
    queues: [
      { id: "q_voice", name: "Loans Voice", type: "inbound_call", attachment: { kind: "structural", channelInstanceId: "ci_loans_voice" }, fallbackAhtSec: 300 },
      { id: "q_gov", name: "Gov", type: "governance", attachment: { kind: "shared" }, fallbackAhtSec: 600 },
    ],
    services: [{ id: "svc", name: "SR", activity: "service_request", productRequest: "existing",
      journey: [{ queueId: "q_voice", splitPct: 100 }, { queueId: "q_gov", splitPct: 100, samplingPct: 20 }] }],
    profiles: [{ id: "pf", appliesAt: { level: "channel", nodeId: "ci_loans_voice" }, totalVolume: 1000, mix: [{ serviceId: "svc", pct: 100 }] }],
  };
  eq(D.crossStructureWarnings(model).length, 0, 1e-9, "no warnings for in-path + shared");
});

t("a BU-level profile is in-path for any queue beneath that BU", () => {
  const model = {
    brands: baseStructure(),
    queues: [{ id: "q_voice", name: "Loans Voice", type: "inbound_call", attachment: { kind: "structural", channelInstanceId: "ci_loans_voice" }, fallbackAhtSec: 300 }],
    services: [{ id: "svc", name: "SR", activity: "service_request", productRequest: "existing", journey: [{ queueId: "q_voice", splitPct: 100 }] }],
    profiles: [{ id: "pf", appliesAt: { level: "bu", nodeId: "bu1" }, totalVolume: 1000, mix: [{ serviceId: "svc", pct: 100 }] }],
  };
  eq(D.crossStructureWarnings(model).length, 0, 1e-9, "BU profile covers descendant queue");
});

// ---- rule 1 companion: mix sums -----------------------------------------------
t("mix under 100% warns (unmodelled remainder); exactly 100% does not", () => {
  const mk = (pct) => ({
    brands: baseStructure(), queues: [], services: [{ id: "svc", name: "S", activity: "lead", productRequest: "new", journey: [] }],
    profiles: [{ id: "pf", appliesAt: { level: "bu", nodeId: "bu1" }, totalVolume: 1000, mix: [{ serviceId: "svc", pct }] }],
  });
  const under = D.mixWarnings(mk(70));
  eq(under.length, 1, 1e-9, "one remainder warning");
  eq(under[0].remainderPct, 30, 1e-9, "30% unmodelled");
  eq(D.mixWarnings(mk(100)).length, 0, 1e-9, "no warning at 100%");
});

t("mix over 100% is an error in validateModel", () => {
  const model = {
    brands: baseStructure(), queues: [], services: [{ id: "svc", name: "S", activity: "lead", productRequest: "new", journey: [] }],
    profiles: [{ id: "pf", appliesAt: { level: "bu", nodeId: "bu1" }, totalVolume: 1000, mix: [{ serviceId: "svc", pct: 130 }] }],
  };
  const v = D.validateModel(model);
  ok(!v.ok, "model invalid");
  ok(v.errors.some((e) => e.kind === "mix_over_100"), "over-100 error present");
});

// ---- rule 5: shared-queue cost allocation by handling minutes ------------------
t("shared-queue cost allocates by handling minutes across feeding structures", () => {
  const model = {
    brands: baseStructure(),
    queues: [{ id: "q_gov", name: "Gov", type: "governance", attachment: { kind: "shared" }, fallbackAhtSec: 600 }],
    services: [
      // From Loans (voice): 900 vol, own AHT 400 → 360,000 min
      { id: "svc_loans", name: "Loans SR", activity: "service_request", productRequest: "existing", ahtSec: 400, journey: [{ queueId: "q_gov", splitPct: 100 }] },
      // From Cards (voice): 300 vol, fallback AHT 600 → 180,000 min
      { id: "svc_cards", name: "Cards SR", activity: "service_request", productRequest: "existing", journey: [{ queueId: "q_gov", splitPct: 100 }] },
    ],
    profiles: [
      { id: "pf_loans", appliesAt: { level: "channel", nodeId: "ci_loans_voice" }, totalVolume: 900, mix: [{ serviceId: "svc_loans", pct: 100 }] },
      { id: "pf_cards", appliesAt: { level: "channel", nodeId: "ci_cards_voice" }, totalVolume: 300, mix: [{ serviceId: "svc_cards", pct: 100 }] },
    ],
  };
  const alloc = D.sharedQueueAllocation(model).get("q_gov");
  eq(alloc.totalMinutes, 540000, 1e-6, "total handling minutes");
  const loans = alloc.byNode.find((n) => n.nodeId === "ci_loans_voice");
  const cards = alloc.byNode.find((n) => n.nodeId === "ci_cards_voice");
  eq(loans.minutes, 360000, 1e-6, "loans minutes");
  eq(cards.minutes, 180000, 1e-6, "cards minutes");
  eq(loans.sharePct, (360000 / 540000) * 100, 1e-9, "loans share %");
  eq(loans.sharePct + cards.sharePct, 100, 1e-9, "shares sum to 100");
});

// ---- rule 6: referential integrity --------------------------------------------
t("deleting a referenced queue is blocked with dependent services listed", () => {
  const model = {
    brands: baseStructure(),
    queues: [{ id: "q1", name: "Q1", type: "voice", attachment: { kind: "shared" }, fallbackAhtSec: 300 }],
    services: [{ id: "svc", name: "SR", activity: "service_request", productRequest: "existing", journey: [{ queueId: "q1", splitPct: 100 }] }],
    profiles: [],
  };
  const del = D.canDeleteQueue(model, "q1");
  ok(!del.ok, "delete blocked");
  eq(del.blockedBy.length, 1, 1e-9, "one dependent");
  ok(del.blockedBy[0].serviceId === "svc", "dependent service named");
  ok(D.canDeleteQueue(model, "q_absent").ok, "unreferenced queue deletable");
});

t("deleting a service referenced by a profile mix is blocked with profiles listed", () => {
  const model = {
    brands: baseStructure(), queues: [],
    services: [{ id: "svc", name: "S", activity: "lead", productRequest: "new", journey: [] }],
    profiles: [{ id: "pf", appliesAt: { level: "bu", nodeId: "bu1" }, totalVolume: 100, mix: [{ serviceId: "svc", pct: 100 }] }],
  };
  const del = D.canDeleteService(model, "svc");
  ok(!del.ok && del.blockedBy[0].profileId === "pf", "blocked, profile named");
});

// ---- validation: dangling references are errors -------------------------------
t("dangling journey/mix references are validation errors", () => {
  const model = {
    brands: baseStructure(), queues: [],
    services: [{ id: "svc", name: "S", activity: "lead", productRequest: "new", journey: [{ queueId: "ghost", splitPct: 100 }] }],
    profiles: [{ id: "pf", appliesAt: { level: "bu", nodeId: "bu1" }, totalVolume: 100, mix: [{ serviceId: "phantom", pct: 100 }] }],
  };
  const v = D.validateModel(model);
  ok(!v.ok, "invalid");
  ok(v.errors.some((e) => e.kind === "dangling_journey_queue"), "dangling queue error");
  ok(v.errors.some((e) => e.kind === "dangling_mix_service"), "dangling service error");
});

// ---- one-pass aggregate -------------------------------------------------------
t("derive() returns service volumes, queues, shared allocation and validation in one pass", () => {
  const model = {
    brands: baseStructure(),
    queues: [
      { id: "q_voice", name: "Voice", type: "inbound_call", attachment: { kind: "structural", channelInstanceId: "ci_loans_voice" }, fallbackAhtSec: 300 },
      { id: "q_gov", name: "Gov", type: "governance", attachment: { kind: "shared" }, fallbackAhtSec: 600 },
    ],
    services: [{ id: "svc", name: "SR", activity: "service_request", productRequest: "existing",
      journey: [{ queueId: "q_voice", splitPct: 100 }, { queueId: "q_gov", splitPct: 100, samplingPct: 10 }] }],
    profiles: [{ id: "pf", appliesAt: { level: "channel", nodeId: "ci_loans_voice" }, totalVolume: 1000, mix: [{ serviceId: "svc", pct: 100 }] }],
  };
  const r = D.derive(model);
  eq(r.serviceVolumes.svc.volume, 1000, 1e-9, "service volume");
  eq(r.queues.q_voice.volume, 1000, 1e-9, "voice volume");
  eq(r.queues.q_gov.volume, 100, 1e-9, "gov volume");
  ok(r.sharedAllocation.q_gov, "shared allocation present");
  ok(r.validation.ok, "valid model");
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("\nFAILURES:\n" + failures.map((f) => "  - " + f).join("\n")); process.exit(1); }
console.log("STEP 1 / DERIVATION GATE: GREEN");
