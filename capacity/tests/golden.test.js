/* Step 0 GOLDEN-MASTER GATE — the preserved simulation engine.
 *
 * The v2.4 rebuild restructures the domain model and the whole UI around an
 * engine that is "fit to preserve". This gate regenerates the fixtures from the
 * LIVE engine (scripts/gen-golden.js → buildFixtures) and compares them to the
 * COMMITTED tests/golden/golden.json with a float tolerance. Any numeric drift
 * at the six audit risk sites (Erlang fidelity, abandonment×patience, backlog
 * conservation, requirements, shrinkage placement, fractional FTE) turns this
 * red. If a change is intended, regenerate with `npm run golden:gen` and commit
 * the new golden.json — the diff is the record of what moved.
 */
const fs = require("fs");
const E = require("../engine/engine.js");
const { buildFixtures, OUT_FILE } = require("../scripts/gen-golden.js");

let pass = 0, fail = 0;
const failures = [];
function t(name, fn) {
  try { fn(); pass++; console.log("  ✓ " + name); }
  catch (e) { fail++; failures.push(name + ": " + e.message); console.log("  ✗ " + name + " — " + e.message); }
}
function ok(cond, what) { if (!cond) throw new Error(what || "condition failed"); }

// Numeric closeness with a combined absolute + relative tolerance — the fixture
// is stored to 10 sig figs, so 1e-6 abs / 1e-9 rel never flaps on float noise
// while still catching any real behavioural drift.
function close(a, b) {
  if (typeof a !== "number" || typeof b !== "number") return a === b;
  if (!isFinite(a) || !isFinite(b)) return Object.is(a, b) || a === b;
  const diff = Math.abs(a - b);
  return diff <= 1e-6 || diff <= 1e-9 * Math.max(Math.abs(a), Math.abs(b));
}

// Deep structural + numeric compare, returning the first mismatching path.
function firstDiff(a, b, path = "") {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return `${path}: array shape mismatch`;
    if (a.length !== b.length) return `${path}: length ${a.length} ≠ ${b.length}`;
    for (let i = 0; i < a.length; i++) {
      const d = firstDiff(a[i], b[i], `${path}[${i}]`); if (d) return d;
    }
    return null;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return `${path}: key count ${ka.length} ≠ ${kb.length}`;
    for (const k of ka) {
      if (!(k in b)) return `${path}.${k}: missing in live`;
      const d = firstDiff(a[k], b[k], `${path}.${k}`); if (d) return d;
    }
    return null;
  }
  if (typeof a === "number" && typeof b === "number") {
    return close(a, b) ? null : `${path}: ${b} ≠ ${a} (drift ${Math.abs(a - b)})`;
  }
  return a === b ? null : `${path}: ${JSON.stringify(b)} ≠ ${JSON.stringify(a)}`;
}

console.log("Golden-master gate — preserved engine (v2.4 Step 0)");

const committed = JSON.parse(fs.readFileSync(OUT_FILE, "utf8"));
const live = buildFixtures(E);

// ---- The gate proper: every fixture section matches the committed masters ---
for (const section of ["erlang", "voiceRaw", "voiceInterval", "reqAgents", "shrinkage", "voiceDay", "customerDay", "workflowChain", "digitalChain"]) {
  t(`${section} matches golden master`, () => {
    ok(committed[section], `committed.${section} present`);
    const d = firstDiff(committed[section], live[section], section);
    ok(!d, d || "");
  });
}

t("full-pipeline compactRun matches golden master (S1–S4)", () => {
  const d = firstDiff(committed.pipeline, live.pipeline, "pipeline");
  ok(!d, d || "");
});

// ---- Invariants the masters must always satisfy (independent of the values) -
// These pin the AUDIT SEMANTICS, not just the numbers — so a regenerate that
// silently breaks an invariant still fails here.

t("Erlang C recursion ≡ direct summation (audit finding 1)", () => {
  // Direct Erlang C from first principles vs the engine's stable recurrence.
  const directC = (N, A) => {
    let sumTerms = 0, term = 1; // term_0 = A^0/0! = 1
    for (let n = 1; n <= N; n++) { term *= A / n; sumTerms += (n === N ? 0 : 0); }
    // Build P0 then C properly:
    let s = 0, tk = 1;
    for (let k = 0; k < N; k++) { s += tk; tk *= A / (k + 1); }
    const last = tk; // A^N/N!
    const rho = A / N;
    const P0 = 1 / (s + last / (1 - rho));
    return (last / (1 - rho)) * P0;
  };
  for (const { N, A, c } of committed.erlang) {
    if (A >= N) continue; // C defined for A<N; overload returns 1 by clamp
    ok(close(directC(N, A), c), `C(${N},${A}) recurrence ${c} ≠ direct ${directC(N, A)}`);
  }
});

t("deep overload: abandon strictly exceeds the 1−N/A conservation floor (finding 1)", () => {
  const row = committed.voiceRaw.find((v) => v.N === 3 && v.A === 10 && v.pat === 90);
  ok(row, "overload row present");
  ok(row.abandon > 1 - row.N / row.A, `abandon ${row.abandon} must exceed floor ${1 - row.N / row.A}`);
  ok(row.abandon < 1, "abandon < 1");
});

t("patience→∞ reproduces SPEC §11 E1 (C=0.2853, ASA≈17.0, SL≈0.797)", () => {
  const row = committed.voiceRaw.find((v) => v.N === 13 && v.A === 10 && v.aht === 180 && v.pat === 1e9);
  ok(row, "E1 row present");
  ok(Math.abs(row.asa - 17.0) < 0.3, `ASA ${row.asa} ≈ 17.0`);
  ok(Math.abs(row.sl - 0.797) < 0.005, `SL ${row.sl} ≈ 0.797`);
});

t("backlog conserves exactly: start + arrivals = served + endBacklog (finding 3)", () => {
  for (const chain of [committed.workflowChain, committed.digitalChain]) {
    for (const s of chain) {
      ok(close(s.startBacklog + s.arrivals, s.served + s.endBacklog),
        `conservation broken: ${s.startBacklog}+${s.arrivals} ≠ ${s.served}+${s.endBacklog}`);
    }
    // carryover chains: each row's start equals the previous row's end.
    for (let i = 1; i < chain.length; i++) {
      ok(close(chain[i].startBacklog, chain[i - 1].endBacklog), "carryover broken between days");
    }
  }
});

t("shrinkage is supply-side only: hours scale by (1−shrinkage) (finding 5)", () => {
  const base = committed.shrinkage.find((s) => s.shrinkage === 0).hours;
  for (const s of committed.shrinkage) {
    const expected = base * (1 - Math.min(s.shrinkage, 0.95));
    ok(close(s.hours, expected), `hours at shrink ${s.shrinkage}: ${s.hours} ≠ ${expected}`);
  }
});

t("requirements rise with load and tighten under a lower occupancy ceiling (finding 4)", () => {
  const at = (arr, occ) => committed.reqAgents.find((x) => x.arrivals === arr && x.occCeil === occ).n;
  // Monotone in arrivals at a fixed ceiling.
  for (const occ of [0.85, 1.0]) {
    for (let i = 1; i < [50, 150, 300, 600, 900].length; i++) {
      const a = [50, 150, 300, 600, 900];
      ok(at(a[i], occ) >= at(a[i - 1], occ), `req not monotone in arrivals at occ ${occ}`);
    }
  }
  // A tighter (lower) occupancy ceiling never needs fewer agents.
  for (const arr of [50, 150, 300, 600, 900]) {
    ok(at(arr, 0.85) >= at(arr, 1.0), `occ-0.85 req < occ-1.0 req at ${arr} arrivals`);
  }
});

t("fractional FTE preserved end-to-end: pipeline paid/req are non-integer, unrounded (finding 4/6)", () => {
  // At least one weekly total carries a genuine fraction — the engine never
  // rounds FTE internally (rounding is presentation-only).
  const anyFraction = committed.pipeline.S1.totals.some((w) => Math.abs(w.paid - Math.round(w.paid)) > 1e-6);
  ok(anyFraction, "expected fractional paid-FTE somewhere in the S1 horizon");
});

t("voiceInterval blends fractional agents between the integer endpoints (finding 4)", () => {
  // 4.5 agents must lie strictly between the 4- and 5-agent SL results.
  const four = E.voiceRaw(4, (300 / 1800) * 300, 300, 90, 30);
  const five = E.voiceRaw(5, (300 / 1800) * 300, 300, 90, 30);
  const half = committed.voiceInterval.find((v) => v.agents === 4.5);
  const lo = Math.min(four.sl, five.sl), hi = Math.max(four.sl, five.sl);
  ok(half.sl >= lo - 1e-9 && half.sl <= hi + 1e-9, `blended SL ${half.sl} not between ${lo}..${hi}`);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("\nFAILURES:\n" + failures.map((f) => "  - " + f).join("\n")); process.exit(1); }
console.log("STEP 0 / GOLDEN-MASTER GATE: GREEN");
