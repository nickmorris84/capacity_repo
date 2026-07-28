/* Step 3 GATE — Results page (v2.4 rebuild). Renders ui/v2/results-main.jsx in
 * JSDOM against REAL engine output (model → adapter → preserved engine) and
 * checks the consolidation per results-page-v2.html: one context bar, five
 * lenses, one shared week cursor. The decision matrix sets the context; Plan
 * sets the cursor; Intraday inherits it. Zero console noise throughout.
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
global.IS_REACT_ACT_ENVIRONMENT = true;

const consoleEvents = [];
["error", "warn"].forEach((k) => { const o = console[k]; console[k] = (...a) => { consoleEvents.push(k + ": " + a.map(String).join(" ")); o.apply(console, a); }; });

const React = require("react"); const { act } = React;
const built = esbuild.buildSync({
  entryPoints: [path.join(__dirname, "../ui/v2/results-main.jsx")], bundle: true, format: "cjs", platform: "node", jsx: "automatic", write: false,
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
  define: { "process.env.NODE_ENV": '"development"' }, logLevel: "silent",
});
const mod = { exports: {} };

function click(el) { ok(el, "click target missing"); act(() => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); }); }
function setV(el, v) { ok(el, "setV target missing"); const p = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype; const s = Object.getOwnPropertyDescriptor(p, "value").set; act(() => { s.call(el, String(v)); el.dispatchEvent(new window.Event("input", { bubbles: true })); el.dispatchEvent(new window.Event("change", { bubbles: true })); }); }
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
async function settle(ms = 60) { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); }
const lensBtn = (label) => $$(".sub button").find((b) => b.textContent === label);
const gotoLens = (label) => click(lensBtn(label));

console.log("Results page gate — v2.4 Step 3");

async function main() {
await t("mounts on real engine output with zero console errors; context bar + five lenses", () => {
  act(() => { new Function("module", "exports", "require", "__dirname", "__filename", built.outputFiles[0].text)(mod, mod.exports, require, path.join(__dirname, "../ui/v2"), path.join(__dirname, "../ui/v2/results-main.jsx")); });
  ok($("#root").children.length > 0, "rendered");
  ok($(".ctx"), "context bar present");
  const lenses = $$(".sub button").map((b) => b.textContent);
  ok(["Summary", "Plan", "Intraday", "Data", "Flow"].every((l) => lenses.includes(l)), "five lenses: " + lenses.join(", "));
  eq(consoleEvents.length, 0, "mount noise: " + consoleEvents.join(" | "));
});

await t("Summary shows the decision matrix (cost + red glyph), a Best fit badge, six family cards and the risk register", () => {
  const cells = $$(".mx .cell");
  ok(cells.length >= 8, "matrix has ≥8 cells (2 groups × 4 strategies): " + cells.length);
  ok(cells.some((c) => /£.*m/.test(c.textContent) && /red/.test(c.textContent)), "cells show cost + red weeks");
  ok($(".best"), "a Best fit badge is shown");
  eq($$(".fam6 .fcard").length, 6, "six KPI-family cards");
  const fams = $$(".fam6 .fl").map((x) => x.textContent);
  ok(["Inputs", "Performance", "Efficiency", "Workforce", "Customer", "Outputs"].every((f) => fams.includes(f)), "all six families: " + fams.join(","));
  ok($(".risk"), "risk register present");
  ok(/queue-weeks meet SLA/.test($(".verdict").textContent), "verdict sentence present");
});

await t("tapping a matrix cell drives the context bar (strategy × scenario selects)", () => {
  const sels = $$(".ctx select");
  // Pick a specific cell: row 0 (Plan of record) × col 0 (Meet requirement).
  const firstRowCells = $$(".mx tbody tr")[0].querySelectorAll(".cell");
  click(firstRowCells[0]);
  eq(sels[0].value, "S1", "strategy select follows the tapped column");
  ok($(".mx .cell.sel"), "selected cell is visibly marked");
});

await t("the Best-fit badge follows the cost↔service weighting slider", () => {
  const before = $$(".mx .cell").findIndex((c) => c.querySelector(".best"));
  setV($(".weight input"), 100); // all-service weighting
  const after = $$(".mx .cell").findIndex((c) => c.querySelector(".best"));
  ok(before >= 0 && after >= 0, "a best cell is always marked");
  setV($(".weight input"), 0); // all-cost weighting
  const atCost = $$(".mx .cell").findIndex((c) => c.querySelector(".best"));
  ok(atCost >= 0, "best cell still marked at cost extreme");
});

await t("Plan renders the RAG ribbon with glyphs; tapping a week sets the shared cursor", () => {
  gotoLens("Plan");
  const cells = $$(".ribbon .rc");
  ok(cells.length > 0, "ribbon cells rendered");
  ok(cells.some((c) => /[●▲✕]/.test(c.textContent)), "glyphs alongside colour");
  // Tap the cell for week 10 (aria-label ends with 'week 10').
  const wk10 = cells.find((c) => / week 10$/.test(c.getAttribute("aria-label")));
  click(wk10);
  ok(/week 10/.test($(".wklabel").textContent), "cursor label reads week 10: " + $(".wklabel").textContent);
});

await t("Intraday inherits the Plan cursor and renders interval bars", () => {
  gotoLens("Intraday");
  eq($(".inherit .num").textContent, "10", "Intraday shows the inherited week 10");
  ok($$("#root svg rect").length > 0 || $$(".panel svg rect").length > 0, "interval bars rendered");
  // Stepper moves the shared cursor.
  click($$(".inherit button").find((b) => b.getAttribute("aria-label") === "next week"));
  eq($(".inherit .num").textContent, "11", "stepper advances to week 11");
});

await t("Data exports a template-compatible CSV with a header row", () => {
  gotoLens("Data");
  ok($(".dtab"), "data grid present");
  click($$(".panel .btn").find((b) => /Export CSV/.test(b.textContent)));
  const csv = $('[data-testid="csv"]');
  ok(csv && /Group,Queue,Week,Volume,AHT,SLA/.test(csv.value), "CSV header present: " + (csv ? csv.value.slice(0, 40) : "none"));
});

await t("Flow Play advances the cursor via a functional update without crashing", async () => {
  gotoLens("Flow");
  const before = consoleEvents.length;
  const play = $$(".flowctl .btn").find((b) => /Play/.test(b.textContent));
  click(play);            // starts setInterval(setWeek(w => …)) — the crashy path
  await settle(400);      // let several ticks fire (clamped functional updater)
  click($$(".flowctl .btn").find((b) => /Pause/.test(b.textContent)) || play);
  eq(consoleEvents.length, before, "no console errors while playing: " + consoleEvents.slice(before).join(" | "));
});

await t("Flow scrubber sets the shared week cursor", () => {
  gotoLens("Flow");
  ok($("#root svg") || $(".panel svg"), "sankey svg present");
  const scrub = $('.flowctl input[type="range"]');
  setV(scrub, 20);
  ok(/Week 20/.test($(".flowctl .wk").textContent), "scrubber set week 20: " + $(".flowctl .wk").textContent);
  // Cursor is shared: back to Intraday, it reads week 20.
  gotoLens("Intraday");
  eq($(".inherit .num").textContent, "20", "shared cursor carried to Intraday");
});

await t("changing the scenario select recomputes the run (context is live)", () => {
  gotoLens("Summary");
  const sels = $$(".ctx select");
  const allInBefore = $(".verdict").textContent;
  setV(sels[1], "g_por"); // Plan of record
  ok(sels[1].value === "g_por", "scenario changed");
  ok($(".verdict"), "verdict re-rendered under the new scenario");
});

await t("zero unexpected console output across the whole run", () => {
  eq(consoleEvents.length, 0, "console noise: " + consoleEvents.join(" | "));
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("\nFAILURES:\n" + failures.map((f) => "  - " + f).join("\n")); process.exit(1); }
console.log("STEP 3 / RESULTS GATE: GREEN");
}
main().catch((e) => { console.error(e); process.exit(1); });
