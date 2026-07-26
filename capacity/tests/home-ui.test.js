/* Step 5 GATE — Home + Ecosystem (v2.4 rebuild). Renders ui/v2/home-main.jsx in
 * JSDOM: simulation cards with KPI-family chips + mini thumbnail, the New-sim
 * fork modal, and the full-screen Ecosystem volume Sankey rendered from the
 * DERIVATION module (real derived queue volumes, never entered). Zero console
 * noise. Built to home-page-v2.html.
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
  entryPoints: [path.join(__dirname, "../ui/v2/home-main.jsx")], bundle: true, format: "cjs", platform: "node", jsx: "automatic", write: false,
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
  define: { "process.env.NODE_ENV": '"development"' }, logLevel: "silent",
});
const mod = { exports: {} };

function click(el) { ok(el, "click target missing"); act(() => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); }); }
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

console.log("Home + Ecosystem gate — v2.4 Step 5");

async function main() {
await t("mounts with zero console errors; header, New simulation, toolbar", () => {
  act(() => { new Function("module", "exports", "require", "__dirname", "__filename", built.outputFiles[0].text)(mod, mod.exports, require, path.join(__dirname, "../ui/v2"), path.join(__dirname, "../ui/v2/home-main.jsx")); });
  ok($("#root").children.length > 0, "rendered");
  ok($$(".btn.primary").some((b) => /New simulation/.test(b.textContent)), "New simulation button");
  ok($(".toolbar"), "toolbar present");
  eq(consoleEvents.length, 0, "mount noise: " + consoleEvents.join(" | "));
});

await t("simulation card shows KPI-family stat chips (horizon, queues, FTE, all-in, RAG) + thumbnail", () => {
  const card = $(".card"); ok(card, "a card present");
  ok(card.querySelector(".thumb svg"), "mini dependency-graph thumbnail");
  const chips = [...card.querySelectorAll(".chip")].map((c) => c.textContent);
  ok(chips.some((c) => /wk$/.test(c)), "horizon chip");
  ok(chips.some((c) => /queues/.test(c)), "queues chip");
  ok(chips.some((c) => /FTE avail/.test(c)), "coral FTE chip");
  ok(chips.some((c) => /all-in/.test(c) && /£.*m/.test(c)), "amber all-in chip");
  ok(card.querySelector(".chip.ok, .chip.warn, .chip.bad"), "worst-RAG glyph chip");
});

await t("New-simulation modal opens with the three fork choices and closes", () => {
  click($$(".btn.primary").find((b) => /New simulation/.test(b.textContent)));
  ok($(".overlay.on"), "modal open");
  const forks = $$(".fork .t").map((x) => x.textContent);
  ok(["Whole ecosystem", "Subset", "Single service"].every((f) => forks.includes(f)), "fork choices: " + forks.join(","));
  click($$(".modal .btn").find((b) => /Cancel/.test(b.textContent)));
  ok(!$(".overlay.on"), "modal closes");
});

await t("Ecosystem overlay renders the derived volume Sankey from the model", () => {
  click($$(".toolbar .btn").find((b) => b.textContent === "Ecosystem"));
  ok($(".eco-scrim.on"), "ecosystem overlay open");
  const svg = $(".eco svg"); ok(svg, "sankey svg present");
  const cols = [...svg.querySelectorAll("text")].map((x) => x.textContent);
  ok(["Brand", "Channel", "Service mix", "Journey queues", "Outcome"].every((c) => cols.some((t) => t === c)), "six columns: " + cols.filter(Boolean).slice(0, 8).join(","));
  ok(svg.querySelectorAll("polygon").length > 0, "ribbons drawn");
  ok(svg.querySelectorAll("rect").length >= 6, "nodes drawn");
  ok(/derived, never entered/.test($(".eco").textContent), "the derived-not-entered message is shown");
});

await t("the Sankey shows real derived queue names and a resolved/failed outcome", () => {
  const eco = $(".eco");
  // The default estate's queues appear as journey-queue nodes.
  ok(/Voice — Billing|Inbound|Billing/.test(eco.textContent), "a real queue name appears");
  ok(/Resolved/.test(eco.textContent) && /Failed/.test(eco.textContent), "outcome split shown");
  click($$(".eco .btn").find((b) => /Close/.test(b.textContent)));
  ok(!$(".eco-scrim.on"), "overlay closes");
});

await t("zero unexpected console output across the whole run", () => {
  eq(consoleEvents.length, 0, "console noise: " + consoleEvents.join(" | "));
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("\nFAILURES:\n" + failures.map((f) => "  - " + f).join("\n")); process.exit(1); }
console.log("STEP 5 / HOME GATE: GREEN");
}
main().catch((e) => { console.error(e); process.exit(1); });
