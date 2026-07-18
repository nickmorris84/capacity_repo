/* P4 gate — SPEC.md §6–§9. Renders the compiled app in JSDOM and exercises the
   data/document layer:
     - every export button fires a download (anchor mocked),
     - the exported workbook parses with xlsx and has the expected sheet list,
     - a modified Parameters sheet re-imports and the values are applied,
     - the Report tab renders its charts at the fixed 640px width,
   with zero unexpected console output. */
const path = require("path");
const { JSDOM } = require("jsdom");
const esbuild = require("esbuild");
const XLSX = require("xlsx");

let pass = 0, fail = 0;
const failures = [];
async function t(name, fn) {
  try { await fn(); pass++; console.log("  ✓ " + name); }
  catch (e) { fail++; failures.push(name + ": " + e.message); console.log("  ✗ " + name + " — " + e.message); }
}
function ok(cond, what) { if (!cond) throw new Error(what || "condition failed"); }
function eq(a, b, what) { if (a !== b) throw new Error(`${what || "value"}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }

// ---------------- JSDOM environment ----------------
const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { pretendToBeVisual: true, url: "http://localhost/" });
const { window } = dom;
global.window = window;
global.document = window.document;
global.navigator = window.navigator;
global.HTMLElement = window.HTMLElement;
global.Node = window.Node;
global.Event = window.Event;
global.MouseEvent = window.MouseEvent;
global.getComputedStyle = window.getComputedStyle;
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);
window.requestAnimationFrame = global.requestAnimationFrame;
window.cancelAnimationFrame = global.cancelAnimationFrame;
window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
global.ResizeObserver = window.ResizeObserver;
Object.defineProperty(window.HTMLElement.prototype, "clientWidth", { configurable: true, get() { return 640; } });
global.IS_REACT_ACT_ENVIRONMENT = true;
window.print = () => { window.__printed = (window.__printed || 0) + 1; };
if (!window.URL.createObjectURL) window.URL.createObjectURL = () => "blob:mock";
if (!window.URL.revokeObjectURL) window.URL.revokeObjectURL = () => {};
// The app bundle references browser globals (URL, Blob, File, FileReader) that
// are window properties under a real browser but not on Node's global scope.
// Alias them so the standalone-style bundle behaves as it would in a browser.
global.URL = window.URL;
global.Blob = window.Blob;
global.File = window.File;
global.FileReader = window.FileReader;

const consoleEvents = [];
["error", "warn"].forEach((k) => {
  const orig = console[k];
  console[k] = (...args) => { consoleEvents.push(k + ": " + args.map(String).join(" ")); orig.apply(console, args); };
});

// Mock the download anchor: capture filename + the Blob handed to it, so the
// test can both assert a download fired and read back the exported bytes.
const downloads = [];
const origCreate = document.createElement.bind(document);
document.createElement = (tag, ...rest) => {
  const el = origCreate(tag, ...rest);
  if (tag === "a") {
    let capturedBlob = null;
    const hrefDesc = Object.getOwnPropertyDescriptor(window.HTMLAnchorElement.prototype, "href");
    // capture whatever blob URL.createObjectURL is called with by wrapping click
    el.click = () => { downloads.push({ name: el.download, blob: capturedBlob }); };
    // intercept createObjectURL to stash the blob against this anchor
    const realCreate = window.URL.createObjectURL;
    window.URL.createObjectURL = (blob) => { capturedBlob = blob; return realCreate ? realCreate(blob) : "blob:mock"; };
  }
  return el;
};

const React = require("react");
const { act } = React;

const built = esbuild.buildSync({
  entryPoints: [path.join(__dirname, "../ui/main.jsx")],
  bundle: true, format: "cjs", platform: "node", jsx: "automatic", write: false,
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "recharts", "xlsx"],
  define: { "process.env.NODE_ENV": '"development"' }, logLevel: "silent",
});

t("app mounts for the P4 gate with zero console errors", () => {
  const mod = { exports: {} };
  act(() => {
    new Function("module", "exports", "require", "__dirname", "__filename", built.outputFiles[0].text)(
      mod, mod.exports, require, path.join(__dirname, "../ui"), path.join(__dirname, "../ui/main.jsx")
    );
  });
  ok(document.getElementById("root").children.length > 0, "app rendered");
  eq(consoleEvents.length, 0, "console noise during mount: " + consoleEvents.join(" | "));
});

// Also exercise the pure export/import round-trip directly, since importing via a
// real <input type=file> is awkward to drive in JSDOM. This is the same code the
// Files card calls.
const exportsMod = (() => {
  const b = esbuild.buildSync({
    entryPoints: [path.join(__dirname, "../ui/exports.js")],
    bundle: true, format: "cjs", platform: "node", write: false, external: ["xlsx"], logLevel: "silent",
  });
  const m = { exports: {} };
  new Function("module", "exports", "require", "__dirname", b.outputFiles[0].text)(m, m.exports, require, path.join(__dirname, "../ui"));
  return m.exports;
})();
const engine = require("../engine/engine.js");

// ---------------- helpers ----------------
function click(el) { act(() => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); }); }
async function settle(ms = 300) { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); }
const tabByLabel = (label) => [...document.querySelectorAll('[role="tab"]')].find((x) => x.textContent === label);
const goto = (label) => click(tabByLabel(label));
const blobBytes = async (blob) => new Uint8Array(await blob.arrayBuffer());

async function run() {
  await settle(300);

  await t("Data / Summary / Report tabs exist", () => {
    ok(tabByLabel("Data"), "Data tab");
    ok(tabByLabel("Summary"), "Summary tab");
    ok(tabByLabel("Report"), "Report tab");
  });

  await t("Data tab renders the weekly table with all column groups on", async () => {
    goto("Data"); await settle(50);
    const rows = document.querySelectorAll("#panel-data [data-testid=data-table] tbody tr");
    ok(rows.length > 0, "weekly rows present, got " + rows.length);
    const colsAll = document.querySelectorAll("#panel-data [data-testid=data-table] thead th").length;
    const grp = document.querySelector("#panel-data .rowflex input[type=checkbox]");
    click(grp); await settle(20);
    const colsLess = document.querySelectorAll("#panel-data [data-testid=data-table] thead th").length;
    ok(colsLess < colsAll, `hiding a column group reduces columns: ${colsAll} -> ${colsLess}`);
    click(grp); await settle(20); // restore
  });

  await t("Summary tab renders the verdict and a sortable risk register", async () => {
    goto("Summary"); await settle(50);
    ok(/recommended strategy/i.test(document.querySelector("#panel-summary").textContent), "verdict paragraph present");
    const rows = document.querySelectorAll("#panel-summary [data-testid=risk-table] tbody tr");
    ok(rows.length >= 1, "risk register has rows");
    const weekHdr = [...document.querySelectorAll("#panel-summary [data-testid=risk-table] thead th")].find((th) => /Week/.test(th.textContent));
    click(weekHdr); // sort by week — must not throw
    ok(true, "sort click handled");
  });

  await t("Report tab renders charts at the fixed 640px width", async () => {
    goto("Report"); await settle(120);
    const charts = document.querySelectorAll("#panel-report [data-testid=report-chart]");
    ok(charts.length >= 3, "report has multiple charts, got " + charts.length);
    ok([...charts].every((c) => c.getAttribute("data-fixed-width") === "640"), "every report chart declares fixed 640px width");
    const wide = document.querySelectorAll('#panel-report .report-chart .recharts-wrapper > svg[width="640"]');
    ok(wide.length === charts.length, `every report chart surface renders at 640px, got ${wide.length}/${charts.length}`);
  });

  await t("print button calls window.print()", () => {
    const before = window.__printed || 0;
    const btn = [...document.querySelectorAll("#panel-report button")].find((b) => /Print/.test(b.textContent));
    ok(btn, "print button exists");
    click(btn);
    ok((window.__printed || 0) === before + 1, "window.print invoked");
  });

  let workbookBytes = null;
  await t("every export button fires a download (anchor mocked)", async () => {
    const ids = ["export-workbook", "export-config", "export-run", "export-params-csv", "export-volumes-csv"];
    const before = downloads.length;
    for (const id of ids) {
      const btn = document.querySelector(`[data-testid=${id}]`);
      ok(btn, id + " button exists");
      click(btn);
    }
    await settle(30);
    eq(downloads.length - before, ids.length, "one download per export button");
    ok(downloads.every((d) => d.name), "each download has a filename");
    const wb = downloads.find((d) => d.name === "capacity-plan.xlsx");
    ok(wb && wb.blob, "workbook download captured");
    workbookBytes = await blobBytes(wb.blob);
  });

  await t("exported workbook parses with xlsx and has the expected sheets", () => {
    const wb = XLSX.read(workbookBytes, { type: "array" });
    for (const name of ["Summary", "Strategy comparison", "Findings & risks", "Parameters", "Volumes"]) {
      ok(wb.SheetNames.includes(name), "sheet present: " + name + " (got " + wb.SheetNames.join(", ") + ")");
    }
    // one sheet per queue → total sheets = 5 fixed + queue count
    const defCfg = engine.makeDefaultConfig();
    eq(wb.SheetNames.length, 5 + defCfg.queues.length, "sheet count = 5 + queues");
  });

  await t("re-importing a modified Parameters sheet applies the values", () => {
    // build a fresh workbook from the default config, edit a parameter, re-import
    const cfg = engine.makeDefaultConfig();
    const sim = engine.simulate(cfg, { strategy: "S1" });
    const strat = { S1: sim, S2: engine.simulate(cfg, { strategy: "S2" }), S3: engine.simulate(cfg, { strategy: "S3" }), S4: engine.simulate(cfg, { strategy: "S4" }) };
    const bytes = exportsMod.buildWorkbook(sim, strat, cfg, "S1", "v_por");
    const parsed = exportsMod.parseWorkbook(bytes);
    const billAht = parsed.params.find((p) => p.path === "queues.q_bill.aht");
    ok(billAht && Number(billAht.value) === 300, "original AHT is 300, got " + (billAht && billAht.value));
    const modified = parsed.params.map((p) => (p.path === "queues.q_bill.aht" ? { ...p, value: 987 } : p));
    const newCfg = exportsMod.applyWorkbookImport(cfg, { params: modified, volumes: parsed.volumes });
    eq(newCfg.queues.find((q) => q.id === "q_bill").aht, 987, "modified AHT applied");
    eq(newCfg.queues.find((q) => q.id === "q_tech").aht, 420, "other queue AHT unchanged");
    ok(Array.isArray(newCfg.queues[0].weeklyVolumes) && newCfg.queues[0].weeklyVolumes.length === sim.weeks.length, "Volumes sheet round-tripped into weeklyVolumes");
  });

  await t("importing a modified workbook through the Files card updates the live app", async () => {
    // week-1 Base vol = daily base × daysPerWeek (seasonality/growth = 1 at wk 1).
    const digits = (el) => el.textContent.replace(/[^0-9]/g, "");
    goto("Data"); await settle(80);
    const beforeCell = document.querySelector("#panel-data [data-testid=data-table] tbody tr td:nth-child(2)");
    const before = digits(beforeCell);

    // rebuild the default workbook with Billing's daily volume changed to 4321.
    const cfg = engine.makeDefaultConfig();
    const sim = engine.simulate(cfg, { strategy: "S1" });
    const strat = { S1: sim, S2: sim, S3: sim, S4: sim };
    const bytes = exportsMod.buildWorkbook(sim, strat, cfg, "S1", "v_por");
    const modParams = exportsMod.parseWorkbook(bytes).params.map((p) => (p.path === "queues.q_bill.dailyVolume" ? { ...p, value: 4321 } : p));
    const rebuilt = exportsMod.buildWorkbook(sim, strat, exportsMod.applyParameters(cfg, modParams), "S1", "v_por");

    goto("Report"); await settle(50); // Files card (with the import input) lives on the Report tab
    const input = document.querySelector("[data-testid=import-workbook]");
    ok(input, "workbook import input exists");
    const file = new window.File([rebuilt], "capacity-plan.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    await act(async () => {
      input.dispatchEvent(new window.Event("change", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 120));
    });
    await settle(350);

    goto("Data"); await settle(80);
    const afterCell = document.querySelector("#panel-data [data-testid=data-table] tbody tr td:nth-child(2)");
    const after = digits(afterCell);
    ok(after !== before, `Data table base vol changed after import: ${before} -> ${after}`);
    eq(after, "30247", "imported daily volume (4321 × 7 days) flows into the Data table base vol");
  });

  await settle(200);
  await t("zero unexpected console errors/warnings across the P4 run", () => {
    eq(consoleEvents.length, 0, "console events: " + consoleEvents.slice(0, 10).join(" | "));
  });

  console.log("\n═══════════════════════════════════");
  console.log(`${pass} passed, ${fail} failed`);
  console.log(fail === 0 ? "P4 GATE: GREEN" : "P4 GATE: RED");
  if (fail > 0) { failures.forEach((f) => console.log("  - " + f)); process.exitCode = 1; }
}

run();
