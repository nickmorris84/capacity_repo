/* M4 GATE — template v3 (BUILD-PLAN M4). The domain model must survive
 * export → import structurally intact, export → edit → import must reflect
 * exactly the edit, and export → import → export must be byte-identical —
 * all through REAL SheetJS .xlsx bytes, not just the row arrays.
 * engineConfig is a carry, excluded from template content by design.
 */
const XLSX = require("xlsx");
const T = require("../model/template-domain.js");
const Ops = require("../model/ops.js");
const E = require("../engine/engine.js");
const { migrateV1ToV2 } = require("../model/migrate.js");
const { migrateV2ToDomain } = require("../model/migrate-domain.js");

let pass = 0, fail = 0;
const failures = [];
function t(name, fn) {
  try { fn(); pass++; console.log("  ✓ " + name); }
  catch (e) { fail++; failures.push(name + ": " + e.message); console.log("  ✗ " + name + " — " + e.message); }
}
function ok(c, w) { if (!c) throw new Error(w || "condition failed"); }

// Key-order-insensitive canonical form — the import rebuilds objects, so
// property order may differ while the structure is identical.
function canon(v) {
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (v && typeof v === "object")
    return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
  return JSON.stringify(v);
}
function sansEngine(m) { const { engineConfig, ...rest } = m; return rest; }

function throughXlsx(sheets) {
  const wb = XLSX.utils.book_new();
  for (const name of T.SHEET_NAMES)
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheets[name]), name.slice(0, 31));
  const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const wb2 = XLSX.read(bytes, { type: "array" });
  const back = {};
  for (const name of T.SHEET_NAMES) back[name] = XLSX.utils.sheet_to_json(wb2.Sheets[name.slice(0, 31)], { defval: "" });
  return back;
}

console.log("Template v3 gate — BUILD-PLAN M4");

t("pure round-trip: sample model survives sheets → model structurally intact", () => {
  const m = Ops.sampleDomainModel();
  const { model } = T.domainSheetsToModel(T.modelToDomainSheets(m));
  ok(canon(model) === canon(m), "structural mismatch");
});

t("migrated default round-trips — full v1 staffing physics (wf/burn) via StaffingJson", () => {
  const m = migrateV2ToDomain(migrateV1ToV2(E.makeDefaultConfig()));
  const { model } = T.domainSheetsToModel(T.modelToDomainSheets(m));
  ok(canon(model) === canon(sansEngine(m)), "structural mismatch (minus engineConfig)");
  const q0 = m.queues[0];
  const back = model.queues.find((q) => q.id === q0.id);
  ok(back && back.staffing && back.staffing.wf && back.staffing.burn, "staffing physics carried");
  ok(canon(back.staffing) === canon(q0.staffing), "staffing not byte-faithful");
});

t("real .xlsx bytes: write → read → import reproduces the migrated model", () => {
  const m = migrateV2ToDomain(migrateV1ToV2(E.makeDefaultConfig()));
  const { model } = T.domainSheetsToModel(throughXlsx(T.modelToDomainSheets(m)));
  ok(canon(model) === canon(sansEngine(m)), "xlsx trip altered the model");
});

t("export → edit a cell → import reflects exactly that edit", () => {
  const m = Ops.sampleDomainModel();
  const sheets = throughXlsx(T.modelToDomainSheets(m));
  // v1.3: steps hang off the shared process, not off the request type.
  const row = sheets.Steps.find((r) => r.ProcessId === "proc_newcard_digital" && r.QueueId === "q_verify");
  ok(row && +row.SplitPct === 60, "expected the 60% verify step");
  row.SplitPct = 45;
  const { model } = T.domainSheetsToModel(sheets);
  const proc = model.processes.find((x) => x.id === "proc_newcard_digital");
  const idx = proc.steps.findIndex((s) => s.queueId === "q_verify");
  ok(proc.steps[idx].splitPct === 45, "edit not applied");
  const expect = Ops.updateProcessStep(m, "proc_newcard_digital", idx, { splitPct: 45 });
  ok(canon(model) === canon(expect), "something besides the edited cell changed");
});

t("weekly series round-trips through W1..W52 columns", () => {
  const weekly = Array.from({ length: 52 }, (_, w) => 2000 + w * 10);
  const m = Ops.setVolumeEntry(Ops.sampleDomainModel(),
    { brandId: "b_acme", buId: "bu_cs", requestTypeId: "rt_billing" }, { daily: 2398, weekly });
  const sheets = T.modelToDomainSheets(m);
  const row = sheets["Volume entries"].find((r) => r.RequestTypeId === "rt_billing");
  ok(row.W1 === 2000 && row.W52 === 2510, "W columns not populated");
  const { model } = T.domainSheetsToModel(throughXlsx(sheets));
  const back = model.volumeEntries.find((e) => e.scope.requestTypeId === "rt_billing");
  ok(back.weekly && back.weekly.length === 52, "weekly lost");
  ok(canon(back.weekly) === canon(weekly), "weekly values drifted");
});

t("export → import → export identical (the M4 done-when, through real bytes)", () => {
  for (const m of [Ops.sampleDomainModel(), migrateV2ToDomain(migrateV1ToV2(E.makeDefaultConfig()))]) {
    const s1 = T.modelToDomainSheets(m);
    const s2 = T.modelToDomainSheets(T.domainSheetsToModel(throughXlsx(s1)).model);
    ok(canon(s1) === canon(s2), "second export differs from the first");
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
async function main() { /* sync suite; keep the awaited-summary shape */ }
main().then(() => {
  if (fail) { console.log("\nFAILURES:\n" + failures.map((f) => "  - " + f).join("\n")); process.exit(1); }
  console.log("M4 / TEMPLATE V3 GATE: GREEN");
});
