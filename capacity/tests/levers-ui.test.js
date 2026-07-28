/* Step 4 GATE — Levers page (v2.4 rebuild). Renders ui/v2/levers-main.jsx in
 * JSDOM against the real engine matrix (model → adapter → engine). Checks the
 * layout per levers-page-v2.html: the decision matrix (cost + SLA + red glyph)
 * flanked by strategy + scenario-group cards, hiring caps. Crucially, editing a
 * lever RE-SCORES the matrix — buffer % and the total hiring cap are real engine
 * inputs, so tightening the cap must add red weeks. Zero console noise.
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
  entryPoints: [path.join(__dirname, "../ui/v2/levers-main.jsx")], bundle: true, format: "cjs", platform: "node", jsx: "automatic", write: false,
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
  define: { "process.env.NODE_ENV": '"development"' }, logLevel: "silent",
});
const mod = { exports: {} };

function click(el) { ok(el, "click target missing"); act(() => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); }); }
function setV(el, v) { ok(el, "setV target missing"); const p = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype; const s = Object.getOwnPropertyDescriptor(p, "value").set; act(() => { s.call(el, String(v)); el.dispatchEvent(new window.Event("input", { bubbles: true })); el.dispatchEvent(new window.Event("change", { bubbles: true })); }); }
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const totalRed = () => $$(".mx .cell").reduce((a, c) => { const m = /(\d+) red/.exec(c.textContent); return a + (m ? +m[1] : 0); }, 0);
async function settle(ms = 60) { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); }

console.log("Levers page gate — v2.4 Step 4");

async function main() {
await t("mounts on the real engine matrix with zero console errors", () => {
  act(() => { new Function("module", "exports", "require", "__dirname", "__filename", built.outputFiles[0].text)(mod, mod.exports, require, path.join(__dirname, "../ui/v2"), path.join(__dirname, "../ui/v2/levers-main.jsx")); });
  ok($("#root").children.length > 0, "rendered");
  eq(consoleEvents.length, 0, "mount noise: " + consoleEvents.join(" | "));
});

await t("decision matrix cells carry cost + SLA + red-weeks glyph", () => {
  const cells = $$(".mx .cell");
  ok(cells.length >= 8, "matrix cells: " + cells.length);
  const txt = cells[0].textContent;
  ok(/£.*m/.test(txt), "cost shown");
  ok(/% SLA/.test(txt), "SLA shown");
  ok(/red wk/.test(txt), "red weeks shown");
  ok($(".best"), "best-fit badge present");
});

await t("strategies and scenario groups flank the matrix", () => {
  const stratNames = $$(".cols .panel")[0] ? $$(".cols .panel")[0].querySelectorAll(".scard b") : [];
  const names = [...stratNames].map((b) => b.textContent);
  ok(["Meet requirement", "Buffer above", "Forward backfill", "Manual plan"].every((n) => names.includes(n)), "four strategies: " + names.join(","));
  ok(/Plan of record/.test(document.body.textContent) && /No scenarios/.test(document.body.textContent), "scenario groups present");
});

await t("hiring caps grid (brand × channel) + total ceiling render", () => {
  ok($(".caps"), "caps grid present");
  const cols = $$(".caps thead th").map((th) => th.textContent.toLowerCase());
  ok(cols.includes("voice") && cols.includes("digital"), "channel columns: " + cols.join(","));
  ok($$(".hint input").length > 0 || /Total ceiling/.test($(".panel:last-of-type").textContent), "total ceiling input present");
});

await t("tightening the TOTAL hiring cap re-scores the matrix (adds red weeks) — a real engine lever", async () => {
  const before = totalRed();
  // Find the total-ceiling input and slash it far below the operation's need.
  const totalInput = $$("input").find((i) => i.getAttribute("aria-label") === "total ceiling");
  ok(totalInput, "total ceiling input found");
  setV(totalInput, 1);
  await settle(); // the matrix recompute is deferred (recalculating… state)
  const after = totalRed();
  ok(after > before, `red weeks should rise when the cap binds: ${before} → ${after}`);
});

await t("editing the buffer % re-scores the matrix (Buffer column changes)", async () => {
  // Reset cap first so we isolate the buffer effect. Buffer strategy = column S2.
  const totalInput = $$("input").find((i) => i.getAttribute("aria-label") === "total ceiling");
  setV(totalInput, 999); await settle();
  const bufferInput = $$("input").find((i) => i.getAttribute("aria-label") === "buffer percent");
  ok(bufferInput, "buffer input found");
  const costBefore = bufferColumnCost();
  setV(bufferInput, 40); // a big buffer lifts cost
  await settle();
  const costAfter = bufferColumnCost();
  ok(costAfter !== costBefore, `buffer column all-in should move: ${costBefore} → ${costAfter}`);
});

function bufferColumnCost() {
  // Column index 1 (0-based across strategies) = "Buffer above". Sum its cells.
  let sum = 0;
  for (const tr of $$(".mx tbody tr")) {
    const cells = tr.querySelectorAll(".cell");
    const m = cells[1] && /£([\d.]+)m/.exec(cells[1].textContent);
    if (m) sum += +m[1];
  }
  return sum.toFixed(1);
}

await t("tapping a matrix cell marks it selected and notes the mix", () => {
  const cell = $$(".mx .cell")[0];
  click(cell);
  ok($(".mx .cell.sel"), "a cell is visibly selected");
  ok(/Selected:/.test($(".mxnote").textContent), "note names the selected mix");
});

await t("expanding a strategy card lists its queues grouped by path", () => {
  const card = $$(".scard")[0];
  click(card.querySelector(".schead"));
  ok(card.classList.contains("open"), "card expands");
  ok(card.querySelector(".path"), "grouped path shown");
  ok(/included/.test(card.textContent), "queues listed as included");
});

await t("zero unexpected console output across the whole run", () => {
  eq(consoleEvents.length, 0, "console noise: " + consoleEvents.join(" | "));
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("\nFAILURES:\n" + failures.map((f) => "  - " + f).join("\n")); process.exit(1); }
console.log("STEP 4 / LEVERS GATE: GREEN");
}
main().catch((e) => { console.error(e); process.exit(1); });
