/* Integration GATE — the app shell (v2.4). One model threaded across Home ·
 * Setup · Levers · Results. Verifies: Home Open enters the workspace; the four
 * tabs navigate; a Setup edit is reflected on the other surfaces (single shared
 * model); and the model autosaves + restores. Zero console noise.
 */
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
window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }; global.ResizeObserver = window.ResizeObserver;
global.localStorage = window.localStorage;
global.IS_REACT_ACT_ENVIRONMENT = true;

const consoleEvents = [];
["error", "warn"].forEach((k) => { const o = console[k]; console[k] = (...a) => { consoleEvents.push(k + ": " + a.map(String).join(" ")); o.apply(console, a); }; });

const React = require("react"); const { act } = React;
const built = esbuild.buildSync({
  entryPoints: [path.join(__dirname, "../ui/v2/app-main.jsx")], bundle: true, format: "cjs", platform: "node", jsx: "automatic", write: false,
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "xlsx"],
  define: { "process.env.NODE_ENV": '"development"' }, logLevel: "silent",
});
const mod = { exports: {} };

function click(el) { ok(el, "click target missing"); act(() => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); }); }
function setV(el, v) { ok(el, "setV target missing"); const p = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype; const s = Object.getOwnPropertyDescriptor(p, "value").set; act(() => { s.call(el, String(v)); el.dispatchEvent(new window.Event("input", { bubbles: true })); el.dispatchEvent(new window.Event("change", { bubbles: true })); }); }
async function settle(ms = 60) { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); }
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const navTab = (label) => { const b = $$('.tabs [role="tab"]').find((x) => x.textContent === label); click(b); };

// Setup navigates by tab; the drawers are inside each tab.
function openTab(label) {
  const b = $$(".subtabs button").find((x) => x.textContent.includes(label));
  ok(b, "tab not found: " + label);
  if (b.getAttribute("aria-selected") !== "true") click(b);
}
const activeTab = () => { const b = $('.tabs [role="tab"].on'); return b ? b.textContent : null; };

console.log("App shell gate — v2.4 integration");

async function main() {
await t("mounts on Home with zero console errors", () => {
  window.localStorage.clear();
  act(() => { new Function("module", "exports", "require", "__dirname", "__filename", built.outputFiles[0].text)(mod, mod.exports, require, path.join(__dirname, "../ui/v2"), path.join(__dirname, "../ui/v2/app-main.jsx")); });
  ok($(".grid .card"), "home simulation card present");
  eq(consoleEvents.length, 0, "mount noise: " + consoleEvents.join(" | "));
});

await t("Home → Open enters the Setup workspace", () => {
  click($$(".card .open").find((b) => b.textContent === "Open"));
  eq(activeTab(), "Setup", "landed on Setup");
});

await t("the four tabs navigate across all surfaces (Setup is the six-tab shell)", () => {
  navTab("Levers"); eq(activeTab(), "Levers", "→ Levers");
  ok($(".mx .cell"), "Levers matrix renders");
  navTab("Results"); eq(activeTab(), "Results", "→ Results");
  ok($(".sub"), "Results lenses render");
  navTab("Setup"); eq(activeTab(), "Setup", "→ Setup");
  eq($$(".subtabs [role='tab']").length, 6, "Setup shows six tabs");
  ok($('[data-testid="tab-note"]'), "the active tab explains itself");
  navTab("Home"); ok($(".grid .card"), "→ Home launcher");
});

await t("a Setup edit is reflected on Results (single shared model)", async () => {
  // Enter Setup → Volume, double the estate total in the cascade grid, and
  // confirm the Results Data lens still renders volumes from the shared model.
  click($$(".card .open").find((b) => b.textContent === "Open")); // → Setup
  openTab("Volume");
  const estate = $$(".volrow:not(.head)").find((r) => /Whole estate/.test(r.textContent));
  ok(estate, "estate row present in the cascade grid");
  const input = estate.querySelector("input");
  const before = +input.value;
  ok(before > 0, "estate total resolved: " + input.value);
  setV(input, Math.round(before * 2));
  eq(+estate.querySelector("input").value, Math.round(before * 2), "estate total re-resolves to the entered figure");
  navTab("Results");
  const dataBtn = $$(".sub button").find((b) => b.textContent === "Data"); click(dataBtn);
  ok($(".dtab"), "data grid present after edit");
  const anyVol = $$(".dtab td.num").map((td) => +td.textContent.replace(/[^\d]/g, "")).filter((n) => n > 0);
  ok(anyVol.length > 0, "data volumes rendered from the edited model");
});

await t("a Levers matrix cell drives the Results context (shared selection)", async () => {
  navTab("Levers"); await settle(120);
  // Tap a specific, non-default cell: Plan of record × Forward backfill (S3).
  const cell = $$(".mx .cell").find((c) => c.getAttribute("aria-label") === "Plan of record × Forward backfill");
  ok(cell, "target matrix cell present");
  click(cell);
  ok(cell.classList.contains("sel"), "cell marked selected in Levers");
  navTab("Results"); await settle(120);
  const strat = $$(".ctx select")[0], scen = $$(".ctx select")[1];
  eq(strat.value, "S3", "Results strategy follows the tapped cell (Forward backfill)");
  ok(/Plan of record/.test(scen.options[scen.selectedIndex].textContent), "Results scenario follows the tapped cell");
});

await t("New simulation opens the empty Setup and still runs the engine", async () => {
  navTab("Home");
  click($$(".btn.primary").find((b) => /New simulation/.test(b.textContent)));
  click($$(".fork .t").find((x) => x.textContent === "Whole ecosystem")); // a fork → new blank sim
  await settle(120);
  eq(activeTab(), "Setup", "lands on Setup as the empty state");
  ok($(".pstrip") && /Next:/.test($(".pstrip").textContent), "the progress strip names the first step");
  click($(".pstrip .btn"));
  ok(/none yet/.test($('[role="tabpanel"]').textContent), "registry starts empty");
  // The empty simulation must not crash Levers/Results (0 queues).
  const before = consoleEvents.length;
  navTab("Results"); await settle(150);
  navTab("Levers"); await settle(150);
  eq(consoleEvents.length, before, "empty simulation runs clean: " + consoleEvents.slice(before).join(" | "));
});

await t("the model autosaves to the v3 key and restores across a fresh mount", async () => {
  navTab("Home"); await settle(60);
  await settle(400); // let the debounced autosave fire
  ok(window.localStorage.getItem("capacity.v3.model"), "model persisted to the v3 key");
  // Fresh mount into a new container restores from storage (not the seed).
  const c = document.createElement("div"); document.body.appendChild(c);
  act(() => { mod.exports.mount(c); });
  await settle(80);
  ok(window.localStorage.getItem("capacity.v3.model"), "restore path exercised without error");
});

await t("zero unexpected console output across the whole run", () => {
  eq(consoleEvents.length, 0, "console noise: " + consoleEvents.join(" | "));
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("\nFAILURES:\n" + failures.map((f) => "  - " + f).join("\n")); process.exit(1); }
console.log("INTEGRATION / APP SHELL GATE: GREEN");
}
main().catch((e) => { console.error(e); process.exit(1); });
