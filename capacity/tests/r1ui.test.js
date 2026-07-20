/* P7b gate — SPEC §15–§20 UI restructure (Revision 2). Renders the source app
   in JSDOM and asserts the extended exit checklist: exact 9-tab order; a context
   bar carrying Strategy · Scenario-group · Snapshot selectors + a print action
   on every tab; the decision matrix (definition order, never reordered by
   selection, cell selection drives Plan, stale on config edit); risk thresholds
   re-scoring the register without re-simulating; the horizon input clamping to
   [24,78]; brand adoption; cross-brand pool membership; unmanned badge + disabled
   HC; accordion inheritance indicators flipping on override; manual-series grid
   edits; the assumptions view reflecting a scenario-driven AHT change; snapshot
   read-only mode; and the Excel package's four new sheets — with zero console
   noise. */
const path = require("path");
const { JSDOM } = require("jsdom");
const esbuild = require("esbuild");

let pass = 0, fail = 0;
const failures = [];
async function t(name, fn) {
  try { await fn(); pass++; console.log("  ✓ " + name); }
  catch (e) { fail++; failures.push(name + ": " + e.message); console.log("  ✗ " + name + " — " + e.message); }
}
function ok(c, w) { if (!c) throw new Error(w || "condition failed"); }
function eq(a, b, w) { if (a !== b) throw new Error(`${w || "value"}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }

const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { pretendToBeVisual: true, url: "http://localhost/" });
const { window } = dom;
global.window = window; global.document = window.document; global.navigator = window.navigator;
global.HTMLElement = window.HTMLElement; global.Node = window.Node; global.Event = window.Event; global.MouseEvent = window.MouseEvent;
global.getComputedStyle = window.getComputedStyle;
global.requestAnimationFrame = (cb) => setTimeout(cb, 0); global.cancelAnimationFrame = (id) => clearTimeout(id);
window.requestAnimationFrame = global.requestAnimationFrame; window.cancelAnimationFrame = global.cancelAnimationFrame;
window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }; global.ResizeObserver = window.ResizeObserver;
global.localStorage = window.localStorage;
Object.defineProperty(window.HTMLElement.prototype, "clientWidth", { configurable: true, get() { return 640; } });
global.IS_REACT_ACT_ENVIRONMENT = true;
window.print = () => { window.__printed = (window.__printed || 0) + 1; };
if (!window.URL.createObjectURL) window.URL.createObjectURL = () => "blob:m";
if (!window.URL.revokeObjectURL) window.URL.revokeObjectURL = () => {};
global.URL = window.URL; global.Blob = window.Blob; global.File = window.File; global.FileReader = window.FileReader;

const consoleEvents = [];
["error", "warn"].forEach((k) => { const o = console[k]; console[k] = (...a) => { consoleEvents.push(k + ": " + a.map(String).join(" ")); o.apply(console, a); }; });
const downloads = [];
const origCreate = document.createElement.bind(document);
document.createElement = (tag, ...rest) => { const el = origCreate(tag, ...rest); if (tag === "a") el.click = () => downloads.push({ name: el.download }); return el; };

const React = require("react"); const { act } = React;
const built = esbuild.buildSync({
  entryPoints: [path.join(__dirname, "../ui/main.jsx")], bundle: true, format: "cjs", platform: "node", jsx: "automatic", write: false,
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "recharts", "xlsx"],
  define: { "process.env.NODE_ENV": '"development"' }, logLevel: "silent",
});

t("app mounts with zero console errors", () => {
  const mod = { exports: {} };
  act(() => { new Function("module", "exports", "require", "__dirname", "__filename", built.outputFiles[0].text)(mod, mod.exports, require, path.join(__dirname, "../ui"), path.join(__dirname, "../ui/main.jsx")); });
  ok(document.getElementById("root").children.length > 0, "rendered");
  eq(consoleEvents.length, 0, "mount noise: " + consoleEvents.join(" | "));
});

function click(el) { ok(el, "click target missing"); act(() => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); }); }
function setV(el, v) { ok(el, "setV target missing"); const p = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype; const s = Object.getOwnPropertyDescriptor(p, "value").set; act(() => { s.call(el, String(v)); el.dispatchEvent(new window.Event("input", { bubbles: true })); el.dispatchEvent(new window.Event("change", { bubbles: true })); }); }
async function settle(ms = 250) { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); }
const tabByLabel = (l) => [...document.querySelectorAll('[role="tab"]')].find((x) => x.textContent === l);
const goto = async (l) => { click(tabByLabel(l)); await settle(80); };
const planAllIn = () => document.querySelector('[data-testid="plan-panel"]').getAttribute("data-active-allin");
const selWithOption = (root, val) => [...root.querySelectorAll("select")].find((s) => [...s.options].some((o) => o.value === val));

// R4 §26.4: the Snapshots tab moved to the landing; Settings is renamed.
const EXPECTED_TABS = ["Summary", "Strategies", "Plan", "Data", "Intraday", "Queues", "Scenarios", "Simulation Settings"];

async function run() {
  await settle(400);
  // R4 §26.1: the app opens on the landing — open the bootstrap simulation.
  click(document.querySelector('[data-testid^="sim-open-"]'));
  await settle(400);

  await t("exact 8-tab order; Seasonality dissolved (§20), Snapshots moved to the landing (§26.4)", () => {
    const labels = [...document.querySelectorAll('[role="tab"]')].map((x) => x.textContent);
    eq(labels.join(" · "), EXPECTED_TABS.join(" · "), "tab order");
    ok(!labels.includes("Seasonality") && !labels.includes("Workforce") && !labels.includes("Report") && !labels.includes("Snapshots"), "removed tabs absent");
  });

  // Rule 9 — every table sits in a width-capped wrapper and every chart in a
  // .chart container, so intrinsically-wide content scrolls internally and the
  // document never scrolls horizontally.
  await t("every table has a width-capped wrapper; every chart a .chart (Rule 9)", async () => {
    for (const label of EXPECTED_TABS) {
      await goto(label);
      const panel = document.getElementById(tabByLabel(label).getAttribute("aria-controls"));
      ok(panel, "panel for " + label);
      for (const tbl of panel.querySelectorAll("table")) {
        ok(tbl.closest(".tbl-wrap, .ribbon-wrap"), `a table on ${label} lacks a width-capped wrapper`);
      }
      for (const cb of panel.querySelectorAll(".chart-b")) {
        ok(cb.closest(".chart"), `a chart on ${label} lacks a .chart container`);
      }
    }
  });

  // Label sweep — no spec references (§…) survive in any rendered string.
  await t("no “§” appears in any rendered text (label sweep)", async () => {
    for (const label of EXPECTED_TABS) {
      await goto(label);
      ok(!document.body.textContent.includes("§"), `“§” found in rendered text on ${label}`);
    }
  });

  await t("context bar shows Strategy · Scenario-group · Snapshot + print on every tab; print fires from 3", async () => {
    let printed = 0;
    for (const label of EXPECTED_TABS) {
      await goto(label);
      const bar = document.querySelector(".ctxbar");
      ok(bar, "context bar on " + label);
      ok(bar.querySelector('[data-testid="ctx-strategy"]'), "strategy selector on " + label);
      ok(bar.querySelector('[data-testid="ctx-group"]'), "scenario-group selector on " + label);
      ok(bar.querySelector('[data-testid="ctx-snapshot"]'), "run selector on " + label);
      const pb = bar.querySelector('[data-testid="print-page"]');
      ok(pb, "print action on " + label);
      if (["Data", "Queues", "Simulation Settings"].includes(label)) { const before = window.__printed || 0; click(pb); if ((window.__printed || 0) === before + 1) printed++; }
    }
    eq(printed, 3, "print fired from three tabs");
  });

  await t("decision matrix renders in definition order and does not reorder after selecting a cell (§19)", async () => {
    await goto("Summary");
    click(document.querySelector('[data-testid="run-matrix"]'));
    await settle(400);
    const rowOrder = () => [...document.querySelectorAll('[data-testid^="mx-row-"]')].map((x) => x.getAttribute("data-testid"));
    const colOrder = () => [...document.querySelectorAll('[data-testid^="mx-col-"]')].map((x) => x.getAttribute("data-testid"));
    eq(rowOrder().join(","), "mx-row-g_por,mx-row-g_none", "rows in group definition order");
    eq(colOrder().join(","), "mx-col-S1,mx-col-S2,mx-col-S3,mx-col-S4", "cols in strategy definition order");
    const before = { r: rowOrder().join(","), c: colOrder().join(",") };
    click(document.querySelector('[data-testid="mx-g_none-S3"]'));
    await settle(120);
    eq(rowOrder().join(","), before.r, "rows unchanged after selecting a cell");
    eq(colOrder().join(","), before.c, "cols unchanged after selecting a cell");
  });

  await t("selecting a matrix cell changes the Plan numbers (§19)", async () => {
    await goto("Plan");
    const before = planAllIn();
    await goto("Summary");
    click(document.querySelector('[data-testid="mx-g_por-S3"]'));
    await settle(300);
    await goto("Plan");
    eq(document.querySelector('[data-testid="plan-panel"]').getAttribute("data-active-strategy"), "S3", "active strategy from the cell");
    ok(planAllIn() !== before, `Plan all-in changed ${before} -> ${planAllIn()}`);
    // restore the (Plan of record × S1) context for later steps
    await goto("Summary"); click(document.querySelector('[data-testid="mx-g_por-S1"]')); await settle(250);
  });

  await t("matrix goes stale on a config edit (§19)", async () => {
    await goto("Summary");
    click(document.querySelector('[data-testid="run-matrix"]'));
    await settle(300);
    ok(!document.querySelector('[data-testid="matrix-stale"]'), "matrix fresh after running");
    await goto("Simulation Settings");
    const cap = [...document.querySelectorAll("#panel-settings input[type=number]")].find((i) => i.previousSibling); // any numeric edit
    setV(document.getElementById("horizon-input") || cap, 60); // horizon edit is a real sim change
    await settle(250);
    await goto("Summary");
    ok(document.querySelector('[data-testid="matrix-stale"]'), "stale banner appears after the edit");
  });

  await t("changing a risk threshold re-scores the register without re-simulating (§20a)", async () => {
    await goto("Plan"); const planBefore = planAllIn();
    await goto("Summary");
    const rows = () => document.querySelectorAll('[data-testid="risk-table"] tbody tr').length;
    const before = rows();
    ok(before > 0, "some risks present at default thresholds, got " + before);
    await goto("Simulation Settings");
    setV(document.getElementById("risk-otstreak-amber"), 40); // above the default peak streak (8) → drops OT risks
    await settle(200);
    await goto("Summary");
    ok(rows() < before, `register re-scored (fewer rows: ${before} -> ${rows()})`);
    await goto("Plan");
    eq(planAllIn(), planBefore, "Plan all-in unchanged — no re-simulation from a threshold edit");
  });

  await t("horizon input clamps to [24, 78] (§16)", async () => {
    await goto("Simulation Settings");
    const h = document.getElementById("horizon-input");
    ok(h, "horizon input present");
    setV(h, 5); await settle(120);
    eq(document.getElementById("horizon-input").value, "24", "5 clamps up to 24");
    setV(document.getElementById("horizon-input"), 100); await settle(120);
    eq(document.getElementById("horizon-input").value, "78", "100 clamps down to 78");
    setV(document.getElementById("horizon-input"), 52); await settle(200);
  });

  await t("brand creation lives in Settings and a queue adopts the new brand (§15/§24)", async () => {
    await goto("Simulation Settings");
    const before = [...document.querySelectorAll('#panel-settings input[aria-label="Brand name"]')].length;
    click(document.querySelector('#panel-settings [data-testid="add-brand"]'));
    await settle(200);
    const after = [...document.querySelectorAll('#panel-settings input[aria-label="Brand name"]')].length;
    eq(after, before + 1, "a brand was created in Settings");
    // adopt: point the first queue's brand selector (in Dependencies & mode) at it
    await goto("Queues");
    const brandSel = document.querySelector('[id^="queue-brand-"]');
    ok(brandSel, "a queue brand selector is present");
    const newBrandId = [...brandSel.options].map((o) => o.value).find((v) => v !== "b1");
    ok(newBrandId, "new brand appears in the queue's brand selector");
    setV(brandSel, newBrandId);
    await settle(200);
    ok([...document.querySelectorAll('[id^="queue-brand-"]')].some((s) => s.value === newBrandId), "a queue adopted the new brand");
  });

  await t("sharing: a queue shares its spare with another (§24.2, pools deleted)", async () => {
    await goto("Queues");
    const card = document.querySelector("#panel-queues details.erow"); card.setAttribute("open", "");
    card.querySelectorAll("details.acc-sec").forEach((d) => d.setAttribute("open", ""));
    await settle(60);
    const on = card.querySelector("[data-testid=sharing-on]");
    ok(on, "sharing toggle present");
    if (!on.checked) { click(on); await settle(150); }
    const targets = [...card.querySelectorAll('[data-testid^="shares-"]')];
    ok(targets.length >= 1, "shares-with options appear, got " + targets.length);
    const before = targets[0].checked;
    click(targets[0]);
    await settle(120);
    ok(card.querySelector('[data-testid^="shares-"]').checked !== before, "a share target toggled");
  });

  await t("a queue set to Unmanned shows the badge and disables its HC input (§17)", async () => {
    await goto("Queues");
    const card = document.querySelector("#panel-queues details.erow"); card.setAttribute("open", ""); await settle(40);
    const modeSel = selWithOption(card, "unmanned");
    ok(modeSel, "resourcing selector with an unmanned option");
    setV(modeSel, "unmanned");
    await settle(250);
    ok([...card.querySelectorAll(".badge")].some((b) => /unmanned/.test(b.textContent)), "unmanned badge shown");
    const hc = card.querySelector("[data-testid=hc-input]");
    ok(hc && hc.disabled, "HC input disabled");
    setV(selWithOption(card, "unmanned"), "dedicated"); await settle(200); // restore
  });

  await t("accordion inheritance indicators flip when overriding (§16)", async () => {
    await goto("Queues");
    const card = document.querySelector("#panel-queues details.erow"); card.setAttribute("open", "");
    card.querySelectorAll("details.acc-sec").forEach((d) => d.setAttribute("open", ""));
    await settle(60);
    const ind = () => card.querySelector('[data-testid="inherit-seasonality"]');
    ok(/inherited/.test(ind().textContent), "seasonality starts inherited");
    click(card.querySelector('[data-testid="override-seasonality"]'));
    await settle(150);
    ok(/overridden/.test(card.querySelector('[data-testid="inherit-seasonality"]').textContent), "indicator flips to overridden");
    click(card.querySelector('[data-testid="override-seasonality"]')); await settle(120); // restore
  });

  // §24.8 group-first: a factor is added inside a scenario group; the last
  // factor row across all groups is the one just created.
  const lastScenarioRow = () => [...document.querySelectorAll('#panel-scenarios [data-testid="scenario-rows"] > .erow')].pop();
  const addFactorInNewGroup = async () => {
    await goto("Scenarios");
    click(document.querySelector('#panel-scenarios [data-testid="add-group"]')); await settle(150);
    const addFactor = [...document.querySelectorAll('#panel-scenarios [data-testid^="add-factor-"]')].pop();
    click(addFactor); await settle(150);
  };

  await t("manual-series grid edits apply (§19/§24.8)", async () => {
    await addFactorInNewGroup();
    const erow = lastScenarioRow(); // the factor just created
    const mechSel = selWithOption(erow, "manualSeries");
    ok(mechSel, "factor has a mechanism selector");
    setV(mechSel, "manualSeries"); await settle(200);
    const grid = lastScenarioRow().querySelector('[data-testid="week-grid"]');
    ok(grid, "manual-series grid renders");
    const cell = grid.querySelector(".wk-cell");
    const before = cell.getAttribute("aria-pressed");
    click(cell); await settle(120);
    ok(lastScenarioRow().querySelector('[data-testid="week-grid"] .wk-cell').getAttribute("aria-pressed") !== before, "grid cell toggles");
    // Clean up: toggle the week back off so this volume factor leaves no residue
    // for later base-volume assertions (the factor persists but with no entries).
    click(lastScenarioRow().querySelector('[data-testid="week-grid"] .wk-cell')); await settle(80);
  });

  await t("assumptions view reflects a scenario-driven AHT change (§16)", async () => {
    // A factor set to an operation-wide AHT step, enabled → fires under Plan of record.
    await addFactorInNewGroup();
    const erow = lastScenarioRow();
    setV(selWithOption(erow, "aht"), "aht"); await settle(120);
    setV(selWithOption(lastScenarioRow(), "step"), "step"); await settle(200);
    await goto("Data");
    // switch the Data view to Assumptions over time
    const viewSel = selWithOption(document.querySelector("#panel-data"), "assumptions");
    setV(viewSel, "assumptions"); await settle(200);
    const rows = document.querySelectorAll('#panel-data [data-testid="assumptions-table"] tbody tr');
    ok(rows.length > 1, "assumptions table has rows");
    const ahtWk1 = rows[0].children[2].textContent; // Blended AHT column
    const base = document.querySelector("#panel-data") && ahtWk1;
    ok(Number(ahtWk1) > 0, "AHT-in-effect present");
    // With a +10% AHT step active from week 1, the blended AHT exceeds the base 300s billing AHT.
    ok(Number(ahtWk1) > 300, `AHT in effect reflects the scenario (${ahtWk1} > base 300)`);
  });

  await t("run selection switches to read-only and Live restores it (§20/§26.4)", async () => {
    // R4 §26.4: the Snapshots tab is gone — the context-bar Save creates a Run.
    click(document.querySelector('[data-testid="save-run-open"]')); await settle(80);
    setV(document.querySelector('[data-testid="run-name"]'), "Frozen");
    click(document.querySelector('[data-testid="save-run"]'));
    await settle(600);
    const snapSel = document.querySelector('[data-testid="ctx-snapshot"]');
    const slug = [...snapSel.options].map((o) => o.value).find((v) => v);
    ok(slug, "the run appears in the context-bar selector");
    setV(snapSel, slug);
    await settle(250);
    ok(document.querySelector('[data-testid="readonly-banner"]'), "read-only banner shown");
    await goto("Simulation Settings");
    // Editors are wrapped in a disabled <fieldset> in read-only mode.
    ok(document.querySelector(".ro-fieldset").disabled, "the editor fieldset is disabled in read-only mode");
    ok(document.querySelector("#panel-settings [data-testid=global-hc]"), "the editor field is present but inert");
    setV(document.querySelector('[data-testid="ctx-snapshot"]'), ""); // back to Live
    await settle(200);
    ok(!document.querySelector('[data-testid="readonly-banner"]'), "banner cleared");
    ok(!document.querySelector(".ro-fieldset").disabled, "editor fieldset re-enabled");
  });

  await t("Excel package includes the four §20 sheets and re-imports a parameter", async () => {
    // R4 §26.4: the Files card lives in Simulation Settings now (§14.8).
    await goto("Simulation Settings");
    const before = downloads.length;
    click(document.querySelector("#panel-settings [data-testid=export-workbook]"));
    await settle(60);
    ok(downloads.length > before && downloads.some((d) => d.name === "capacity-plan.xlsx"), "workbook download fired");
    // …and the workbook itself carries Brands / Pools / Profiles / Groups + round-trips Parameters.
    const b = esbuild.buildSync({ entryPoints: [path.join(__dirname, "../ui/exports.js")], bundle: true, format: "cjs", platform: "node", write: false, logLevel: "silent" });
    const em = { exports: {} };
    new Function("module", "exports", "require", b.outputFiles[0].text)(em, em.exports, require);
    const E = require("../engine/engine.js");
    const cfg = E.migrateConfigR2(E.makeDefaultConfig());
    const sim = E.simulate(cfg, { strategy: "S1" });
    const bytes = em.exports.buildWorkbook(sim, { S1: sim }, cfg, "S1", "g_por");
    const parsed = em.exports.parseWorkbook(bytes);
    for (const s of ["Brands", "Pools", "Profiles", "Groups"]) ok(parsed.sheetNames.includes(s), "sheet present: " + s);
    const applied = em.exports.applyParameter(cfg, "queues.q_bill.dailyVolume", 7000);
    eq(applied.queues.find((q) => q.id === "q_bill").dailyVolume, 7000, "a parameter re-imports");
  });

  await t("import a params CSV flows into the Data table", async () => {
    await goto("Simulation Settings");
    const input = document.querySelector("#panel-settings [data-testid=import-params-csv]");
    const file = new window.File(["Path,Setting,Value\nqueues.q_bill.dailyVolume,v,7000\n"], "p.csv", { type: "text/csv" });
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    await act(async () => { input.dispatchEvent(new window.Event("change", { bubbles: true })); await new Promise((r) => setTimeout(r, 150)); });
    await settle(300);
    await goto("Data");
    const view = selWithOption(document.querySelector("#panel-data"), "outputs");
    if (view) { setV(view, "outputs"); await settle(150); }
    const base = document.querySelector('#panel-data [data-testid="data-table"] tbody tr td:nth-child(2)').textContent.replace(/[^0-9]/g, "");
    eq(base, "49000", "imported daily volume (7000 × 7) flows into the Data table");
  });

  await settle(700); // flush the debounced auto-save inside act
  await t("zero unexpected console errors/warnings across the P7b run", () => eq(consoleEvents.length, 0, "console: " + consoleEvents.slice(0, 8).join(" | ")));

  console.log("\n═══════════════════════════════════");
  console.log(`${pass} passed, ${fail} failed`);
  console.log(fail === 0 ? "P7b GATE: GREEN" : "P7b GATE: RED");
  if (fail > 0) { failures.forEach((x) => console.log("  - " + x)); process.exitCode = 1; }
}
run();
