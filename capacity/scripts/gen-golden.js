/* Step 0 — Golden masters (Capacity Simulator v2.4 structural rebuild).
 *
 * The v2.4 rebuild changes the DOMAIN MODEL (Brand → BU → Product → Channel →
 * Queue, plus Services / journeys / Channel volume profiles) and the whole
 * Setup / Results / Levers / Home UI, but the simulation ENGINE is "fit to
 * preserve" and must not drift numerically. These fixtures pin the engine's
 * observable behaviour at the six named audit risk sites so the refactor can be
 * verified byte-for-byte against them:
 *
 *   1. Erlang fidelity          — erlangB / erlangC recurrences
 *   2. Abandonment × patience   — voiceRaw (Erlang A fixed point), incl. overload
 *   3. Backlog conservation     — runWorkflowDay / runDigitalDay across days
 *   4. Requirements (ASA∧ab∧occ)— requiredAgentsInterval, voiceInterval blending
 *   5. Shrinkage placement      — hoursPerHeadDay (supply-side only)
 *   6. FTE fractional throughout— full-pipeline compactRun (no premature rounding)
 *
 * buildFixtures(E) is the single source of truth: `node scripts/gen-golden.js`
 * WRITES the JSON, and tests/golden.test.js calls the same function and compares
 * against the committed JSON with a float tolerance. Regenerate deliberately
 * (npm run golden:gen) when an engine change is intended — the git diff then
 * shows exactly which numbers moved.
 */
const fs = require("fs");
const path = require("path");

// Round to 10 significant figures for stable, platform-independent JSON. The
// gate compares with an absolute+relative epsilon on top of this, so trailing
// float noise never flaps the test.
function r(x) {
  if (typeof x !== "number" || !isFinite(x)) return x;
  if (x === 0) return 0;
  return +x.toPrecision(10);
}
function rObj(o) {
  const out = {};
  for (const k of Object.keys(o)) out[k] = r(o[k]);
  return out;
}

function buildFixtures(E) {
  const cfg = E.makeDefaultConfig();
  const eng = cfg.engine;

  // ---- 1. Erlang B/C fidelity ----------------------------------------------
  const erlang = [];
  for (const N of [1, 2, 3, 5, 8, 11, 13, 16, 20, 30]) {
    for (const A of [0.5, 5, 10, 10.5, 12.7, 15, 25]) {
      erlang.push({ N, A, b: r(E.erlangB(N, A)), c: r(E.erlangC(N, A)) });
    }
  }

  // ---- 2. voiceRaw: Erlang A abandonment × patience (incl. deep overload) ---
  // [N, A, aht, pat, target]. First row is patience≈∞ (collapses to Erlang C).
  const voiceRaw = [];
  for (const [N, A, aht, pat, tgt] of [
    [13, 10, 180, 1e9, 20],   // SPEC §11 E1: pat→∞ ⇒ C=0.2853, ASA≈17.0, SL(20)≈0.797
    [13, 10, 300, 1e9, 20],   // patience → ∞  ⇒ textbook Erlang C
    [13, 10, 300, 180, 20],
    [13, 10, 300, 90, 20],
    [3, 10, 300, 90, 20],     // deep overload: abandon → 1 − N/A
    [5, 8, 420, 100, 45],
    [20, 18, 300, 90, 30],
    [11, 12, 240, 60, 20],
    [8, 8, 300, 120, 30],     // N == A boundary
  ]) {
    voiceRaw.push({ N, A, aht, pat, tgt, ...rObj(E.voiceRaw(N, A, aht, pat, tgt)) });
  }

  // ---- 4a. voiceInterval fractional-agent blending -------------------------
  const voiceInterval = [];
  for (const agents of [4, 4.25, 4.5, 4.75, 5, 12.3, 20.9]) {
    voiceInterval.push({ agents, ...rObj(E.voiceInterval(agents, 300, 1800, 300, 90, 30)) });
  }

  // ---- 4b. requiredAgentsInterval: ASA ∧ max-abandon ∧ occupancy ceiling ----
  const reqAgents = [];
  for (const arrivals of [50, 150, 300, 600, 900]) {
    for (const occ of [0.85, 1.0]) {
      reqAgents.push({
        arrivals, occCeil: occ,
        n: E.requiredAgentsInterval(arrivals, 1800, 300, 90, 30, 0.05, occ),
      });
    }
  }

  // ---- 5. hoursPerHeadDay: shrinkage is supply-side only -------------------
  const shrinkage = [];
  for (const sh of [0, 0.1, 0.3, 0.5, 0.9, 0.99]) {
    shrinkage.push({ shrinkage: sh, hours: r(E.hoursPerHeadDay({ shrinkage: sh }, eng)) });
  }

  // ---- 3 + day models on real queues ---------------------------------------
  const qVoice = cfg.queues.find((q) => q.id === "q_bill");
  const qCust = cfg.queues.find((q) => q.id === "q_wapp"); // digital (Erlang customer)
  const rcVoice = E.reqCurve(qVoice, qVoice.dailyVolume, eng, new Map());
  const rcCust = E.reqCurve(qCust, qCust.dailyVolume, eng, new Map());

  // Only the fields a given day model actually returns — undefined keys are
  // dropped so the in-memory object matches the JSON round-trip exactly.
  const pick = (d) => {
    const out = {};
    for (const k of ["volume", "cover", "asa", "sl", "abandon", "occ", "respMin", "endBacklog"]) {
      if (d[k] !== undefined) out[k] = r(d[k]);
    }
    return out;
  };

  const voiceDay = [];
  for (const f of [0.8, 1.0, 1.2]) { // under / at / over coverage
    const d = E.runVoiceDay(qVoice, qVoice.dailyVolume, rcVoice.hours * f, eng, rcVoice, true);
    voiceDay.push({ coverFactor: f, ...pick(d) });
  }

  const customerDay = [];
  for (const f of [0.8, 1.0, 1.2]) {
    const d = E.runDigitalCustomerDay(qCust, qCust.dailyVolume, rcCust.hours * f, eng, rcCust, true);
    customerDay.push({ coverFactor: f, ...pick(d) });
  }

  // ---- 3. Backlog conservation across days (workflow + digital fluid) -------
  // Workflow subtype: start + arrivals = served + endBacklog, per day, with
  // carryover. We capture endBacklog each day and re-assert the identity in
  // the gate. Under-serve early so a real backlog accumulates and drains.
  const qWf = { ...qCust, subtype: "workflow", workflowSlaHours: 24, aht: 600 };
  const rcWf = E.reqCurve(qWf, 300, eng, new Map());
  const wfHours = rcWf.hours * 0.6; // deliberately short of requirement
  const workflowChain = [];
  let bw = 0;
  for (const vol of [300, 500, 120, 400, 0, 200]) {
    const d = E.runWorkflowDay(qWf, vol, wfHours, bw, eng, rcWf, true);
    const served = Math.max(0, bw + vol - d.endBacklog);
    workflowChain.push({ startBacklog: r(bw), arrivals: vol, served: r(served), endBacklog: r(d.endBacklog), sl: r(d.sl) });
    bw = d.endBacklog;
  }

  const qFluid = { ...qCust };
  const rcFluid = E.reqCurve(qFluid, 1400, eng, new Map());
  const digitalChain = [];
  let bd = 0;
  for (const vol of [1400, 2000, 800, 1400, 0]) {
    const d = E.runDigitalDay(qFluid, vol, rcFluid.hours * 0.7, bd, eng, rcFluid, true);
    const served = Math.max(0, bd + vol - d.endBacklog);
    digitalChain.push({ startBacklog: r(bd), arrivals: vol, served: r(served), endBacklog: r(d.endBacklog), sl: r(d.sl) });
    bd = d.endBacklog;
  }

  // ---- 6. Full pipeline: the whole demand→requirement→hiring→cost machine ---
  // NB: these primitive grids above have already warmed the engine's quantised
  // Erlang caches (offered load rounded to 0.05 Erlangs). The pipeline below
  // therefore reflects a warm-cache state — self-consistent and reproducible
  // (regenerate → identical), which is all a drift-detector needs. A fresh
  // process (the real app on load) can land on a neighbouring quantised value;
  // the adapter gate proves that difference is cache-order, not behaviour.
  //
  // compactRun already emits a rounded, stable digest keyed by the default
  // config's fixed queue ids. One run per hiring strategy pins the volume
  // model, shrinkage, requirement curves, knock-ons, the global-cap allocator
  // and cost/churn outputs end to end — and fractional FTE throughout.
  const pipeline = {};
  for (const strategy of ["S1", "S2", "S3", "S4"]) {
    pipeline[strategy] = E.compactRun(cfg, E.simulate(cfg, { strategy }));
  }

  return {
    _meta: {
      note: "Golden masters for the preserved simulation engine — Step 0 of the v2.4 rebuild.",
      regenerate: "npm run golden:gen (only when an engine change is intended)",
      riskSites: [
        "Erlang fidelity", "abandonment × patience", "backlog conservation",
        "requirements (ASA∧abandon∧occupancy)", "shrinkage placement", "fractional FTE",
      ],
    },
    erlang,
    voiceRaw,
    voiceInterval,
    reqAgents,
    shrinkage,
    voiceDay,
    customerDay,
    workflowChain,
    digitalChain,
    pipeline,
  };
}

const OUT_DIR = path.join(__dirname, "..", "tests", "golden");
const OUT_FILE = path.join(OUT_DIR, "golden.json");

function write() {
  const E = require("../engine/engine.js");
  const fx = buildFixtures(E);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(fx, null, 2) + "\n");
  const bytes = fs.statSync(OUT_FILE).size;
  console.log(`golden masters written → ${path.relative(path.join(__dirname, ".."), OUT_FILE)} (${bytes} bytes)`);
}

module.exports = { buildFixtures, OUT_FILE };

if (require.main === module) write();
