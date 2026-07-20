/* R3b gate — SPEC §24 UI restructure. Renders the source app in JSDOM and
   asserts the R3b gate checklist: a strategy buffer edit changes that strategy's
   numbers; the holistic chip toggle recomputes totals; the dependency graph |
   table toggle switches views and a node tap reveals flows; the queue creation
   flow renders in the specified order; the seasonality wizard generates an
   editable weekly series; a truly-blank start renders the empty state; the caps
   matrix in Settings feeds the allocator trace. Containment classes and the
   §-free render are gated in r1ui.test.js across every tab (new tables/charts
   included). Zero console noise throughout. */
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
global.HTMLElement = window.HTMLElement; global.Node = window.Node; global.Event = window.Event; global.MouseEvent = window.MouseEvent; global.SVGElement = window.SVGElement;
global.getComputedStyle = window.getComputedStyle;
global.requestAnimationFrame = (cb) => setTimeout(cb, 0); global.cancelAnimationFrame = (id) => clearTimeout(id);
window.requestAnimationFrame = global.requestAnimationFrame; window.cancelAnimationFrame = global.cancelAnimationFrame;
window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }; global.ResizeObserver = window.ResizeObserver;
global.localStorage = window.localStorage;
Object.defineProperty(window.HTMLElement.prototype, "clientWidth", { configurable: true, get() { return 640; } });
global.IS_REACT_ACT_ENVIRONMENT = true;
window.print = () => {};
if (!window.URL.createObjectURL) window.URL.createObjectURL = () => "blob:m";
global.URL = window.URL; global.Blob = window.Blob; global.File = window.File; global.FileReader = window.FileReader;

const consoleEvents = [];
["error", "warn"].forEach((k) => { const o = console[k]; console[k] = (...a) => { consoleEvents.push(k + ": " + a.map(String).join(" ")); o.apply(console, a); }; });

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
const goto = async (l) => { click(tabByLabel(l)); await settle(90); };
const selWithOption = (root, val) => [...root.querySelectorAll("select")].find((s) => [...s.options].some((o) => o.value === val));
const firstCard = () => { const c = document.querySelector("#panel-queues details.erow"); if (c) { c.setAttribute("open", ""); c.querySelectorAll("details.acc-sec").forEach((d) => d.setAttribute("open", "")); } return c; };

async function run() {
  await settle(400);
  // R4 §26.1: the app opens on the landing — open the bootstrap simulation.
  click(document.querySelector('[data-testid^="sim-open-"]'));
  await settle(400);

  await t("a strategy buffer edit changes that strategy's numbers (§24.4)", async () => {
    // Make S2 (built-in buffer) the active strategy via the context bar.
    click(document.querySelector('[data-testid="ctx-strategy"]')); await settle(60);
    setV(document.querySelector('[data-testid="ctx-strategy-select"]'), "S2"); await settle(300);
    await goto("Plan");
    const allIn = () => document.querySelector('[data-testid="plan-panel"]').getAttribute("data-active-allin");
    const before = allIn();
    await goto("Strategies");
    const buf = document.getElementById("strat-buffer-S2");
    ok(buf, "S2 exposes an editable buffer field");
    setV(buf, 80); await settle(350);
    await goto("Plan");
    ok(allIn() !== before, `S2's all-in moved after the buffer edit (${before} → ${allIn()})`);
  });

  await t("holistic chip toggle recomputes the capacity required and totals (§24)", async () => {
    await goto("Plan");
    const cap = () => document.querySelector('[data-testid="holo-capacity-required"]').textContent;
    const totReq = () => document.querySelector('[data-testid="holo-total-req"]').textContent;
    const before = cap(), beforeTot = totReq();
    const chip = document.querySelector('[data-testid^="holo-chip-"]');
    ok(chip, "queue chips render");
    click(chip); await settle(80);
    ok(cap() !== before, `capacity required recomputed (${before} → ${cap()})`);
    ok(totReq() !== beforeTot, "totals row recomputed");
    click(document.querySelector('[data-testid^="holo-chip-"]')); await settle(60); // restore
  });

  await t("dependency graph | table toggle switches views and a node tap reveals flows (§24)", async () => {
    await goto("Queues");
    ok(document.querySelector('[data-testid="dep-view-graph"]'), "graph toggle present");
    click(document.querySelector('[data-testid="dep-view-table"]')); await settle(80);
    ok(document.querySelector('[data-testid="dep-table"]'), "table view renders the link matrix");
    click(document.querySelector('[data-testid="dep-view-graph"]')); await settle(80);
    ok(document.querySelector('[data-testid="dep-graph"]'), "graph view renders the svg");
    ok(document.querySelector('[data-testid="dep-flows-empty"]'), "no flows shown before a node is tapped");
    const node = document.querySelector('[data-testid^="dep-node-"]');
    ok(node, "graph has tappable nodes");
    click(node); await settle(100);
    ok(document.querySelector('[data-testid="dep-flows"]'), "tapping a node reveals its simulated flows");
  });

  await t("queue creation flow renders in the specified order (§24)", async () => {
    await goto("Queues");
    const card = firstCard(); await settle(40);
    const titles = [...card.querySelectorAll("details.acc-sec > summary")].map((s) => s.textContent.trim());
    const order = ["Description", "Volumes", "Workforce", "SLA", "Knock-on", "Sharing", "Dependencies"];
    let last = -1;
    for (const name of order) {
      const i = titles.findIndex((tt, idx) => idx > last && tt.startsWith(name));
      ok(i > last, `${name} appears after ${order[order.indexOf(name) - 1] || "start"} (titles: ${titles.join(" | ")})`);
      last = i;
    }
  });

  await t("the seasonality wizard generates an editable weekly series (§24.6)", async () => {
    await goto("Queues");
    firstCard(); await settle(40);
    const volSec = () => [...document.querySelectorAll("#panel-queues details.erow details.acc-sec")].find((d) => d.querySelector("summary").textContent.trim().startsWith("Volumes"));
    volSec().setAttribute("open", ""); await settle(40);
    setV(selWithOption(volSec(), "series"), "series"); await settle(150);
    click(volSec().querySelector('[data-testid="vol-wizard-run"]')); await settle(200);
    const series = volSec().querySelector('[data-testid="vol-series"]');
    ok(series, "a weekly series grid rendered");
    const inputs = series.querySelectorAll("input");
    ok(inputs.length >= 52, "the wizard filled the whole horizon, got " + inputs.length);
    const before = inputs[0].value;
    setV(inputs[0], 4321); await settle(120);
    ok(volSec().querySelector('[data-testid="vol-series"] input').value !== before, "the generated series is editable");
  });

  await t("caps matrix in Settings feeds the allocator trace (§24.3)", async () => {
    await goto("Simulation Settings");
    const cell = document.querySelector('[data-testid="cap-b1-voice"]');
    ok(cell, "caps matrix exposes the Brand 1 × Voice cell");
    setV(cell, 0); await settle(350); // 0 forces any voice want to bind
    await goto("Plan");
    const caps = document.querySelector('[data-testid="holo-caps"]').textContent;
    ok(/binds/.test(caps), "the caps context reports binding: " + caps);
    click(document.querySelector('[data-testid="holo-toggle-trace"]')); await settle(120);
    const trace = document.querySelector('[data-testid="holo-trace"]');
    ok(trace && /voice cap|Brand 1/.test(trace.textContent), "the trace names the binding segment level");
  });

  await t("a truly-blank start renders the build-from-nothing empty state (§24.9/§26.5)", async () => {
    // R4 §26.5: the workspace New-simulation menu is gone — a blank world now
    // comes from the landing wizard, finished with nothing added.
    click(document.querySelector('[data-testid="back-to-landing"]')); await settle(300);
    click(document.querySelector('[data-testid="landing-new-sim"]')); await settle(100);
    click(document.querySelector('[data-testid="new-scratch"]')); await settle(200);
    for (let i = 0; i < 3; i++) { click(document.querySelector('[data-testid="wizard-next"]')); await settle(80); }
    click(document.querySelector('[data-testid="wizard-finish"]')); await settle(500);
    ok(document.querySelector('[data-testid="blank-empty-state"]'), "a wizard finished empty shows the blank empty state");
    // it simulates without crashing — Plan still renders, no console noise
    await goto("Plan");
    ok(document.querySelector('[data-testid="plan-panel"]'), "Plan renders on an empty world");
    // the empty state's escape hatch fills THIS simulation with the demo defaults
    const loadDefaults = [...document.querySelectorAll('[data-testid="blank-empty-state"] button')].find((b) => /demo defaults/.test(b.textContent));
    click(loadDefaults); await settle(400);
    ok(!document.querySelector('[data-testid="blank-empty-state"]'), "loading the defaults clears the empty state");
  });

  await settle(700); // flush the debounced auto-save inside act
  await t("zero unexpected console errors/warnings across the R3b run", () => eq(consoleEvents.length, 0, "console: " + consoleEvents.slice(0, 8).join(" | ")));

  console.log("\n═══════════════════════════════════");
  console.log(`${pass} passed, ${fail} failed`);
  console.log(fail === 0 ? "R3b / §24 UI GATE: GREEN" : "R3b / §24 UI GATE: RED");
  if (fail > 0) { failures.forEach((x) => console.log("  - " + x)); process.exitCode = 1; }
}
run();
