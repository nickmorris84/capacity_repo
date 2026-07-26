/* Step 6 GATE — template round-trip (v2.4 rebuild). Four sheets mirror the Setup
 * sections (Structure, Queues, Services, Channel volume profiles). The guarantee:
 * export → edit → import → export is identical, and a real SheetJS .xlsx write →
 * read reproduces the model. Bundles the pure ui/v2/template.js to CJS (xlsx
 * external) and exercises the real library via require("xlsx").
 */
const path = require("path");
const esbuild = require("esbuild");
const XLSX = require("xlsx");

let pass = 0, fail = 0;
const failures = [];
function t(name, fn) {
  try { fn(); pass++; console.log("  ✓ " + name); }
  catch (e) { fail++; failures.push(name + ": " + e.message); console.log("  ✗ " + name + " — " + e.message); }
}
function ok(c, w) { if (!c) throw new Error(w || "condition failed"); }

// Load the pure template module (ESM) + the v2 sample model as CJS bundles.
function loadCJS(entry) {
  const out = esbuild.buildSync({ entryPoints: [path.join(__dirname, entry)], bundle: true, format: "cjs", platform: "node", write: false, external: ["react", "react-dom", "xlsx"], logLevel: "silent" });
  const m = { exports: {} };
  new Function("module", "exports", "require", out.outputFiles[0].text)(m, m.exports, require);
  return m.exports;
}
const T = loadCJS("../ui/v2/template.js");
const Model = loadCJS("../ui/v2/model.js");

// Deep structural + value compare (order-independent on object keys).
function diff(a, b, p = "") {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return `${p}: array shape (${a && a.length} vs ${b && b.length})`;
    for (let i = 0; i < a.length; i++) { const d = diff(a[i], b[i], `${p}[${i}]`); if (d) return d; }
    return null;
  }
  if (a && b && typeof a === "object") {
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return `${p}: keys ${JSON.stringify(ka)} vs ${JSON.stringify(kb)}`;
    for (const k of ka) { if (!(k in b)) return `${p}.${k} missing`; const d = diff(a[k], b[k], `${p}.${k}`); if (d) return d; }
    return null;
  }
  return a === b ? null : `${p}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`;
}

console.log("Template round-trip gate — v2.4 Step 6");

const model = Model.sampleModel();

t("four sheets mirror the Setup sections", () => {
  const sheets = T.modelToSheets(model);
  ok(T.SHEET_NAMES.length === 4, "four sheet names");
  ok(["Structure", "Queues", "Services", "Channel volume profiles"].every((n) => Array.isArray(sheets[n])), "all four present");
  ok(sheets.Queues.length === model.queues.length, "one queue row each");
  // Services sheet has one row per journey step (Billing 2 steps + New card 3 = 5).
  const steps = model.services.reduce((a, s) => a + Math.max(1, s.journey.length), 0);
  ok(sheets.Services.length === steps, `service rows = journey steps (${sheets.Services.length} vs ${steps})`);
});

t("pure round-trip: sheetsToModel(modelToSheets(m)) deep-equals m", () => {
  const { model: m2 } = T.sheetsToModel(T.modelToSheets(model));
  const d = diff(model, m2);
  ok(!d, d || "");
});

t("idempotent: re-export after import is byte-identical", () => {
  const s1 = JSON.stringify(T.modelToSheets(model));
  const { model: m2 } = T.sheetsToModel(JSON.parse(s1));
  const s2 = JSON.stringify(T.modelToSheets(m2));
  ok(s1 === s2, "sheets identical across a round-trip");
  ok(T.validateRoundTrip(model).ok, "validateRoundTrip ok");
});

t("REAL SheetJS write → read reproduces the model exactly", () => {
  const sheets = T.modelToSheets(model);
  const wb = XLSX.utils.book_new();
  for (const name of T.SHEET_NAMES) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheets[name]), name.slice(0, 31));
  const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  // read back
  const wb2 = XLSX.read(bytes, { type: "array" });
  const back = {};
  for (const name of T.SHEET_NAMES) back[name] = XLSX.utils.sheet_to_json(wb2.Sheets[name.slice(0, 31)], { defval: "" });
  const { model: m2 } = T.sheetsToModel(back);
  const d = diff(model, m2);
  ok(!d, d || "");
});

t("edit → import reflects the change (a mix % edit survives the round-trip)", () => {
  const sheets = T.modelToSheets(model);
  // Find the Credit cards Voice profile's Billing enquiry mix row, change 74 → 60.
  const rowIdx = sheets["Channel volume profiles"].findIndex((r) => r.ProfileId === "pf_cards_voice" && r.MixServiceId === "svc_billing");
  ok(rowIdx >= 0, "mix row found");
  sheets["Channel volume profiles"][rowIdx].MixPct = 60;
  const { model: m2 } = T.sheetsToModel(sheets);
  const pf = m2.profiles.find((p) => p.id === "pf_cards_voice");
  const mix = pf.mix.find((m) => m.serviceId === "svc_billing");
  ok(mix.pct === 60, "edited mix pct imported: " + mix.pct);
});

t("service with an optional AHT and a governance sampling step round-trip precisely", () => {
  const { model: m2 } = T.sheetsToModel(T.modelToSheets(model));
  const billing = m2.services.find((s) => s.id === "svc_billing");
  const newcard = m2.services.find((s) => s.id === "svc_newcard");
  ok(!("ahtSec" in billing), "billing has no ahtSec (uses queue fallback)");
  ok(newcard.ahtSec === 540, "new card carries its own AHT");
  const gov = billing.journey.find((st) => st.samplingPct != null);
  ok(gov && gov.samplingPct === 2, "governance sampling % preserved");
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("\nFAILURES:\n" + failures.map((f) => "  - " + f).join("\n")); process.exit(1); }
console.log("STEP 6 / TEMPLATE GATE: GREEN");
