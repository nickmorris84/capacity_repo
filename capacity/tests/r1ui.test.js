/* P6b gate — SPEC §14 UI restructure. Renders the source app in JSDOM and
   asserts the Revision-1 exit checklist: exact tab order; a context bar with a
   print action on every tab (print fires from ≥3 tabs); Summary "Set active"
   changes Plan numbers; editing a schedule to pivot at week 10 changes
   late-horizon numbers; a Supported queue shows the badge and disables its HC
   input; the Intraday strip loads a week; the Data table shows the new columns
   and group tints; the manual growth/freeze grids are editable; the Excel
   package export fires and a param import applies; Snapshots naming is present —
   all with zero unexpected console output. */
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

// helpers
function click(el) { act(() => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); }); }
function setV(el, v) { const p = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype; const s = Object.getOwnPropertyDescriptor(p, "value").set; act(() => { s.call(el, String(v)); el.dispatchEvent(new window.Event("input", { bubbles: true })); el.dispatchEvent(new window.Event("change", { bubbles: true })); }); }
async function settle(ms = 250) { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); }
const tabByLabel = (l) => [...document.querySelectorAll('[role="tab"]')].find((x) => x.textContent === l);
const goto = async (l) => { click(tabByLabel(l)); await settle(70); };
const planAllIn = () => document.querySelector('[data-testid="plan-panel"]').getAttribute("data-active-allin");

const EXPECTED_TABS = ["Summary", "Strategies", "Plan", "Data", "Intraday", "Queues", "Scenarios", "Seasonality", "Snapshots", "Settings"];

async function run() {
  await settle(300);

  await t("exact tab order (§14)", () => {
    const labels = [...document.querySelectorAll('[role="tab"]')].map((x) => x.textContent);
    eq(labels.join(" · "), EXPECTED_TABS.join(" · "), "tab order");
    ok(!labels.includes("Workforce") && !labels.includes("Report") && !labels.includes("Model notes"), "removed tabs absent");
  });

  await t("context bar with print action visible on every tab; print fires from 3 tabs", async () => {
    let printed = 0;
    for (const label of EXPECTED_TABS) {
      await goto(label);
      ok(document.querySelector(".ctxbar"), "context bar on " + label);
      const pb = document.querySelector('.ctxbar [data-testid="print-page"]');
      ok(pb, "print action on " + label);
      if (["Data", "Queues", "Settings"].includes(label)) { const before = window.__printed || 0; click(pb); if ((window.__printed || 0) === before + 1) printed++; }
    }
    eq(printed, 3, "print fired from three tabs");
  });

  await t('Summary "Set active" changes the Plan numbers', async () => {
    await goto("Plan");
    const before = planAllIn();
    await goto("Summary");
    const btn = document.querySelector('[data-testid="set-active-S3"]');
    ok(btn, "Set-active S3 button");
    click(btn);
    await settle(250);
    await goto("Plan");
    const after = planAllIn();
    eq(document.querySelector('[data-testid="plan-panel"]').getAttribute("data-active-strategy"), "S3", "active strategy switched");
    ok(after !== before, `Plan all-in changed ${before} -> ${after}`);
    // restore S1 for later steps
    await goto("Summary"); click(document.querySelector('[data-testid="set-active-S1"]')); await settle(200);
  });

  await t("editing a schedule to pivot at week 10 changes late-horizon numbers", async () => {
    await goto("Strategies");
    setV(document.querySelector('[data-testid="add-strategy"]'), "schedule");
    await settle(200);
    // make it active via the context bar (open the popover robustly)
    const openCtx = async () => {
      if (!document.querySelector('[data-testid="ctx-strategy-select"]')) { click(document.querySelector('[data-testid="ctx-strategy"]')); await settle(50); }
      return document.querySelector('[data-testid="ctx-strategy-select"]');
    };
    const sel = await openCtx();
    ok(sel, "context strategy selector opened");
    const schedId = [...sel.options].map((o) => o.value).find((v) => v.startsWith("str_"));
    ok(schedId, "schedule strategy created");
    setV(sel, schedId);
    await settle(250);
    const schedRow = () => { const e = [...document.querySelectorAll("#panel-strategies .rows details.erow")]; const r = e[e.length - 1]; r.setAttribute("open", ""); return r; };
    const allIn = async () => { await goto("Plan"); return planAllIn(); };

    await goto("Strategies"); let r = schedRow(); await settle(30);
    setV([...r.querySelectorAll(".erow-b select")][0], "S3"); // segment 1 → S3
    await settle(250);
    const pureS3 = await allIn();

    await goto("Strategies"); r = schedRow(); await settle(30);
    click([...r.querySelectorAll("button")].find((b) => b.textContent === "+ Segment"));
    await settle(80);
    r = schedRow();
    const nums = [...r.querySelectorAll(".erow-b input[type=number]")];
    setV(nums[nums.length - 1], "10"); // pivot week 10
    await settle(60);
    r = schedRow();
    const sels = [...r.querySelectorAll(".erow-b select")];
    setV(sels[sels.length - 1], "S1"); // pivot to S1
    await settle(300);
    const pivoted = await allIn();
    ok(pivoted !== pureS3, `pivot changed late-horizon numbers vs pure S3 (${pureS3} -> ${pivoted})`);
    // restore active S1
    const sel2 = await openCtx();
    setV(sel2, "S1"); await settle(200);
  });

  await t("a queue switched to Supported shows the badge and disables its HC input", async () => {
    await goto("Queues");
    const card = document.querySelector("#panel-queues details.erow"); card.setAttribute("open", ""); await settle(40);
    const modeSel = [...document.querySelectorAll("#panel-queues select")].find((s) => [...s.options].some((o) => o.value === "supported"));
    ok(modeSel, "resourcing selector present");
    setV(modeSel, "supported");
    await settle(250);
    ok([...document.querySelectorAll("#panel-queues .badge")].some((b) => /supported/.test(b.textContent)), "supported badge shown");
    const hc = document.querySelector("#panel-queues [data-testid=hc-input]");
    ok(hc && hc.disabled, "HC input disabled");
    setV(modeSel, "resourced"); await settle(200); // restore
  });

  await t("Intraday week strip loads a week", async () => {
    await goto("Intraday");
    const cells = document.querySelectorAll('[data-testid="week-strip"] .wk-cell');
    ok(cells.length > 5, "week strip rendered, got " + cells.length);
    click(cells[6]);
    await settle(60);
    ok(cells[6].getAttribute("aria-pressed") === "true", "clicked week selected");
  });

  await t("Data table shows the new columns and group tints", async () => {
    await goto("Data");
    const heads = [...document.querySelectorAll('#panel-data [data-testid="data-table"] thead th')].map((h) => h.textContent);
    for (const col of ["Starting HC", "Attrition #", "Attrition %", "Active FTE"]) ok(heads.includes(col), "column present: " + col);
    ok(document.querySelectorAll("#panel-data td.grp-money").length > 0, "money group tint applied");
    ok(document.querySelectorAll("#panel-data td.grp-people").length > 0, "people group tint applied");
  });

  await t("manual growth and freeze grids are editable", async () => {
    await goto("Scenarios");
    setV(document.querySelector("#panel-scenarios select"), "growthManual"); await settle(150);
    setV(document.querySelector("#panel-scenarios select"), "freezeManual"); await settle(150);
    const grids = document.querySelectorAll('#panel-scenarios [data-testid="week-grid"]');
    ok(grids.length >= 2, "two week grids present, got " + grids.length);
    const cell = grids[grids.length - 1].querySelector(".wk-cell");
    const before = cell.getAttribute("aria-pressed");
    click(cell);
    await settle(80);
    ok(grids[grids.length - 1].querySelector(".wk-cell").getAttribute("aria-pressed") !== before, "grid cell toggles");
  });

  await t("Excel package export fires and a param import applies (from Settings)", async () => {
    await goto("Settings");
    ok(document.querySelector("#panel-settings [data-testid=global-hc]"), "global starting HC field present");
    const before = downloads.length;
    click(document.querySelector("#panel-settings [data-testid=export-workbook]"));
    await settle(40);
    ok(downloads.length > before && downloads.some((d) => d.name === "capacity-plan.xlsx"), "workbook download fired");
    // import a params CSV that changes Billing daily volume → shows on Data
    const input = document.querySelector("#panel-settings [data-testid=import-params-csv]");
    const file = new window.File(["Path,Setting,Value\nqueues.q_bill.dailyVolume,v,7000\n"], "p.csv", { type: "text/csv" });
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    await act(async () => { input.dispatchEvent(new window.Event("change", { bubbles: true })); await new Promise((r) => setTimeout(r, 150)); });
    await settle(300);
    await goto("Data");
    const base = document.querySelector('#panel-data [data-testid="data-table"] tbody tr td:nth-child(2)').textContent.replace(/[^0-9]/g, "");
    eq(base, "49000", "imported daily volume (7000 × 7) flows into the Data table");
  });

  await t("Snapshots naming is present (§14.7) and a snapshot saves + compares", async () => {
    await goto("Snapshots");
    ok(/Snapshots/.test(document.querySelector('[data-testid="snapshots-copy"]').textContent), "snapshots copy line");
    ok(document.querySelector('[data-testid="snapshots-table"]'), "snapshots table (not runs)");
    setV(document.querySelector('[data-testid="snapshot-name"]'), "Base");
    click(document.querySelector('[data-testid="save-snapshot"]'));
    await settle(250);
    const tick = document.querySelector('[data-testid="snapshots-table"] tbody input[type=checkbox]');
    ok(tick, "a saved snapshot appears");
    click(tick);
    await settle(150);
    ok(document.querySelector('[data-testid="per-queue-compare"]'), "per-queue comparison renders");
  });

  await t("report-style charts render at a fixed width during print (§14.8)", async () => {
    await goto("Plan");
    act(() => { window.dispatchEvent(new window.Event("beforeprint")); });
    await settle(40);
    const wide = [...document.querySelectorAll("#panel-plan .recharts-wrapper > svg")].map((s) => s.getAttribute("width"));
    ok(wide.length > 0 && wide.every((w) => w === "660"), "all Plan charts render at the fixed 660px print width");
    act(() => { window.dispatchEvent(new window.Event("afterprint")); });
    await settle(40);
  });

  await settle(200);
  await t("zero unexpected console errors/warnings across the P6b run", () => eq(consoleEvents.length, 0, "console: " + consoleEvents.slice(0, 8).join(" | ")));

  console.log("\n═══════════════════════════════════");
  console.log(`${pass} passed, ${fail} failed`);
  console.log(fail === 0 ? "P6b GATE: GREEN" : "P6b GATE: RED");
  if (fail > 0) { failures.forEach((x) => console.log("  - " + x)); process.exitCode = 1; }
}
run();
