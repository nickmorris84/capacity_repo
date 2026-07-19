/* P5 gate — the complete SPEC §13 JSDOM interaction checklist, run against BOTH
   build targets:
     A) the source (dev bundle + React act), and
     B) the packaged dist/capacity-sim.html (production, self-contained, driven
        with native events in its own JSDOM realm).
   Checklist: click every tab; add/duplicate/delete a queue; add + toggle a
   scenario; save a run, tick it, see the per-queue comparison render; fire every
   export; load a parameters CSV back; render the print view — all with zero
   unexpected console output. */
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");
const esbuild = require("esbuild");
const { buildAll } = require("../scripts/build.js");

let pass = 0, fail = 0;
const failures = [];
async function t(name, fn) {
  try { await fn(); pass++; console.log("  ✓ " + name); }
  catch (e) { fail++; failures.push(name + ": " + e.message); console.log("  ✗ " + name + " — " + e.message); }
}
function ok(cond, what) { if (!cond) throw new Error(what || "condition failed"); }
function eq(a, b, what) { if (a !== b) throw new Error(`${what || "value"}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }

// A tiny parameters CSV that sets Billing's daily volume to 5000 (no Volumes
// sheet involved, so nothing overrides it) — used for the "load a CSV back" step.
const PARAMS_CSV = 'Path,Setting,Value\nqueues.q_bill.dailyVolume,Voice — Billing · dailyVolume,5000\n';
const digits = (el) => (el ? el.textContent.replace(/[^0-9]/g, "") : "");

// The shared checklist, parameterised by a driver context.
async function checklist(label, ctx) {
  const { doc, click, setValue, settle, fileInput, downloads, getPrinted } = ctx;
  const tabs = () => [...doc.querySelectorAll('[role="tab"]')];
  const goto = async (lbl) => { click(tabs().find((x) => x.textContent === lbl)); await settle(60); };

  await t(`[${label}] every tab renders its panel`, async () => {
    for (const tabEl of tabs()) {
      click(tabEl);
      await settle(40);
      const panel = doc.getElementById(tabEl.getAttribute("aria-controls"));
      ok(panel && !panel.hidden, "panel visible for " + tabEl.textContent);
    }
  });

  await t(`[${label}] add / duplicate / delete a queue`, async () => {
    await goto("Queues");
    const count = () => doc.querySelectorAll("#panel-queues details.erow").length;
    const before = count();
    click([...doc.querySelectorAll("#panel-queues .btnbar button")].find((b) => /Add queue/.test(b.textContent)));
    await settle(60);
    eq(count(), before + 1, "after add");
    click(doc.querySelector("#panel-queues details.erow button.btn.sm:not(.danger)"));
    await settle(60);
    eq(count(), before + 2, "after duplicate");
    const dels = doc.querySelectorAll("#panel-queues details.erow button.danger");
    click(dels[dels.length - 1]);
    await settle(60);
    eq(count(), before + 1, "after delete");
  });

  await t(`[${label}] add a scenario and toggle it`, async () => {
    await goto("Scenarios");
    const sel = doc.querySelector("#panel-scenarios select");
    const before = doc.querySelectorAll("#panel-scenarios .rows > .erow").length;
    setValue(sel, "p1");
    await settle(60);
    ok(doc.querySelectorAll("#panel-scenarios .rows > .erow").length >= before, "scenario added");
    const toggle = doc.querySelector('#panel-scenarios input[type=checkbox]');
    const checked = toggle.checked;
    click(toggle);
    await settle(60);
    eq(toggle.checked, !checked, "scenario toggled");
  });

  await t(`[${label}] save a snapshot, tick it, per-queue comparison renders`, async () => {
    await goto("Snapshots");
    setValue(doc.querySelector("[data-testid=snapshot-name]"), "Baseline " + label);
    click(doc.querySelector("[data-testid=save-snapshot]"));
    await settle(200);
    const rows = doc.querySelectorAll("#panel-snapshots [data-testid=snapshots-table] tbody tr");
    ok(rows.length >= 1 && !rows[0].querySelector(".empty"), "saved snapshot appears");
    const tick = doc.querySelector("#panel-snapshots [data-testid=snapshots-table] tbody input[type=checkbox]");
    ok(tick, "compare tick exists");
    click(tick);
    await settle(150);
    ok(doc.querySelector("[data-testid=per-queue-compare]"), "per-queue comparison renders");
    ok(doc.querySelector("[data-testid=totals-delta]"), "totals delta renders");
  });

  await t(`[${label}] compare selection survives a tab switch`, async () => {
    await goto("Plan");
    await goto("Snapshots");
    const tick = doc.querySelector("#panel-snapshots [data-testid=snapshots-table] tbody input[type=checkbox]");
    ok(tick && tick.checked, "tick still set after switching tabs and back");
  });

  await t(`[${label}] fire every export (Settings)`, async () => {
    await goto("Settings");
    const ids = ["export-workbook", "export-config", "export-run", "export-params-csv", "export-volumes-csv"];
    const before = downloads.length;
    for (const id of ids) {
      const btn = doc.querySelector(`#panel-settings [data-testid=${id}]`);
      ok(btn, id + " button exists");
      click(btn);
      await settle(20);
    }
    eq(downloads.length - before, ids.length, "one download per export");
  });

  await t(`[${label}] load a parameters CSV back`, async () => {
    // Base vol is linear in daily volume, so the ratio is robust to whatever
    // scenarios/seasonality are active from earlier steps: 5000/2000 = 2.5×.
    await goto("Data");
    const baseCell = () => doc.querySelector("#panel-data [data-testid=data-table] tbody tr td:nth-child(2)");
    const before = Number(digits(baseCell()));
    ok(before > 0, "baseline base vol read");
    await goto("Settings");
    const input = doc.querySelector("#panel-settings [data-testid=import-params-csv]");
    ok(input, "params-CSV input exists");
    await fileInput(input, PARAMS_CSV, "params.csv", "text/csv");
    await settle(350);
    await goto("Data");
    const after = Number(digits(baseCell()));
    ok(after !== before, `base vol changed after CSV import: ${before} -> ${after}`);
    ok(Math.abs(after / before - 2.5) < 0.02, `daily volume 2000→5000 scales base vol 2.5× (was ${before}, now ${after})`);
  });

  await t(`[${label}] the context-bar print action fires from every tab`, async () => {
    for (const lbl of ["Summary", "Plan", "Data", "Settings"]) {
      await goto(lbl);
      const pb = doc.querySelector('.ctxbar [data-testid="print-page"]');
      ok(pb, "print action present on " + lbl);
      const before = getPrinted();
      click(pb);
      ok(getPrinted() === before + 1, "window.print invoked from " + lbl);
    }
  });
}

// ---------------- Target A: source (dev bundle + act) ----------------
async function runSourceTarget() {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { pretendToBeVisual: true, url: "http://localhost/" });
  const { window } = dom;
  global.window = window;
  global.document = window.document;
  global.HTMLElement = window.HTMLElement;
  global.Node = window.Node;
  global.Event = window.Event;
  global.MouseEvent = window.MouseEvent;
  global.getComputedStyle = window.getComputedStyle;
  global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  global.cancelAnimationFrame = (id) => clearTimeout(id);
  global.Blob = window.Blob;
  global.File = window.File;
  global.FileReader = window.FileReader;
  global.localStorage = window.localStorage;
  window.requestAnimationFrame = global.requestAnimationFrame;
  window.cancelAnimationFrame = global.cancelAnimationFrame;
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  global.ResizeObserver = window.ResizeObserver;
  Object.defineProperty(window.HTMLElement.prototype, "clientWidth", { configurable: true, get() { return 640; } });
  global.IS_REACT_ACT_ENVIRONMENT = true;
  window.print = () => { window.__printed = (window.__printed || 0) + 1; };
  if (!window.URL.createObjectURL) window.URL.createObjectURL = () => "blob:mock";
  if (!window.URL.revokeObjectURL) window.URL.revokeObjectURL = () => {};
  global.URL = window.URL;

  const consoleEvents = [];
  ["error", "warn"].forEach((k) => { const o = console[k]; console[k] = (...a) => { consoleEvents.push(k + ": " + a.map(String).join(" ")); o.apply(console, a); }; });

  const downloads = [];
  const origCreate = window.document.createElement.bind(window.document);
  window.document.createElement = (tag, ...rest) => {
    const el = origCreate(tag, ...rest);
    if (tag === "a") el.click = () => downloads.push({ name: el.download });
    return el;
  };

  const React = require("react");
  const { act } = React;
  const built = esbuild.buildSync({
    entryPoints: [path.join(__dirname, "../ui/main.jsx")], bundle: true, format: "cjs", platform: "node", jsx: "automatic", write: false,
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "recharts", "xlsx"],
    define: { "process.env.NODE_ENV": '"development"' }, logLevel: "silent",
  });
  await t("[source] app mounts with zero console errors", () => {
    const mod = { exports: {} };
    act(() => { new Function("module", "exports", "require", "__dirname", "__filename", built.outputFiles[0].text)(mod, mod.exports, require, path.join(__dirname, "../ui"), path.join(__dirname, "../ui/main.jsx")); });
    ok(window.document.getElementById("root").children.length > 0, "rendered");
    eq(consoleEvents.length, 0, "mount noise: " + consoleEvents.join(" | "));
  });

  const ctx = {
    doc: window.document, win: window,
    click: (el) => act(() => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); }),
    setValue: (el, v) => {
      const proto = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
      act(() => { setter.call(el, String(v)); el.dispatchEvent(new window.Event("input", { bubbles: true })); el.dispatchEvent(new window.Event("change", { bubbles: true })); });
    },
    settle: async (ms) => { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); },
    fileInput: async (input, text, name, mime) => {
      const file = new window.File([text], name, { type: mime });
      Object.defineProperty(input, "files", { value: [file], configurable: true });
      await act(async () => { input.dispatchEvent(new window.Event("change", { bubbles: true })); await new Promise((r) => setTimeout(r, 120)); });
    },
    downloads, getPrinted: () => window.__printed || 0,
  };
  await checklist("source", ctx);
  await ctx.settle(100);
  await t("[source] zero unexpected console output across the checklist", () => eq(consoleEvents.length, 0, "console: " + consoleEvents.slice(0, 8).join(" | ")));

  // restore console
  return consoleEvents;
}

// ---------------- Target B: built HTML (production, self-contained) ----------------
async function runHtmlTarget(html) {
  const consoleEvents = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => { const m = String(e.message || e); if (!/Not implemented|Could not parse CSS/.test(m)) consoleEvents.push("jsdomError: " + m); });

  const dom = new JSDOM(html, {
    runScripts: "dangerously", pretendToBeVisual: true, url: "http://localhost/", virtualConsole: vc,
    beforeParse(window) {
      window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
      window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
      Object.defineProperty(window.HTMLElement.prototype, "clientWidth", { configurable: true, get() { return 640; } });
      window.print = () => { window.__printed = (window.__printed || 0) + 1; };
      if (!window.URL.createObjectURL) window.URL.createObjectURL = () => "blob:mock";
      if (!window.URL.revokeObjectURL) window.URL.revokeObjectURL = () => {};
      ["error", "warn"].forEach((k) => { const o = window.console[k]; window.console[k] = (...a) => { consoleEvents.push(k + ": " + a.map(String).join(" ")); o.apply(window.console, a); }; });
    },
  });
  const { window } = dom;
  const doc = window.document;
  await new Promise((r) => setTimeout(r, 500)); // let the bundle mount

  await t("[html] standalone HTML mounts clean in JSDOM", () => {
    ok(doc.getElementById("root").children.length > 0, "rendered");
    ok(doc.querySelectorAll('[role="tab"]').length === 10, "all tabs present");
    eq(consoleEvents.length, 0, "mount noise: " + consoleEvents.join(" | "));
  });

  // capture downloads by neutralising real anchor navigation
  const downloads = [];
  window.HTMLAnchorElement.prototype.click = function () { downloads.push({ name: this.download }); };

  const ctx = {
    doc, win: window,
    click: (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })),
    setValue: (el, v) => {
      const proto = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
      setter.call(el, String(v));
      el.dispatchEvent(new window.Event("input", { bubbles: true }));
      el.dispatchEvent(new window.Event("change", { bubbles: true }));
    },
    settle: (ms) => new Promise((r) => setTimeout(r, ms)),
    fileInput: async (input, text, name, mime) => {
      const file = new window.File([text], name, { type: mime });
      Object.defineProperty(input, "files", { value: [file], configurable: true });
      input.dispatchEvent(new window.Event("change", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 150));
    },
    downloads, getPrinted: () => window.__printed || 0,
  };
  await checklist("html", ctx);
  await ctx.settle(150);
  await t("[html] zero unexpected console output across the checklist", () => eq(consoleEvents.length, 0, "console: " + consoleEvents.slice(0, 8).join(" | ")));
}

async function main() {
  console.log("\n[build] packaging dist/ from source…");
  const b = buildAll();
  console.log(`  capacity-sim.html ${(b.htmlBytes / 1024).toFixed(0)} KB · capacity-sim.jsx ${(b.jsxBytes / 1024).toFixed(0)} KB`);
  const fs = require("fs");
  const html = fs.readFileSync(b.htmlPath, "utf8");
  eq((html.match(/<\/script>/gi) || []).length, 1, "exactly one literal </script> (bundle's is escaped)");

  console.log("\n[source target] §13 checklist against ui/main.jsx");
  await runSourceTarget();
  console.log("\n[html target] §13 checklist against dist/capacity-sim.html");
  await runHtmlTarget(html);

  console.log("\n═══════════════════════════════════");
  console.log(`${pass} passed, ${fail} failed`);
  console.log(fail === 0 ? "P5 / §13 GATE: GREEN" : "P5 / §13 GATE: RED");
  if (fail > 0) { failures.forEach((f) => console.log("  - " + f)); process.exitCode = 1; }
}

main();
