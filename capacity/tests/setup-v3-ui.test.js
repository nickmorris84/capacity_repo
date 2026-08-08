/* U1 GATE — the six-tab Setup shell (BUILD-PLAN U1). Renders
 * ui/v2/setup-v3-main.jsx in JSDOM and checks the navigation shell per
 * REVIEW-SETUP §2: six tabs in dependency order with live completion state,
 * the progress strip naming (and jumping to) the next thing to do, the
 * master–detail scaffold in Queues with DERIVED volume/AHT, and read-only
 * panels driven by the domain model. Zero console noise throughout.
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
  entryPoints: [path.join(__dirname, "../ui/v2/setup-v3-main.jsx")], bundle: true, format: "cjs", platform: "node", jsx: "automatic", write: false,
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
  define: { "process.env.NODE_ENV": '"development"' }, logLevel: "silent",
});
const mod = { exports: {} };
const Ops = require("../model/ops.js");

function click(el) { ok(el, "click target missing"); act(() => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); }); }
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const subtab = (label, r) => $$(".subtabs button", r).find((b) => b.textContent.includes(label));

console.log("Setup shell gate — BUILD-PLAN U1");

async function main() {
await t("mounts with zero console noise; six tabs in dependency order", () => {
  act(() => { new Function("module", "exports", "require", "__dirname", "__filename", built.outputFiles[0].text)(mod, mod.exports, require, path.join(__dirname, "../ui/v2"), path.join(__dirname, "../ui/v2/setup-v3-main.jsx")); });
  ok(document.getElementById("root").children.length > 0, "rendered");
  const labels = $$(".subtabs button").map((b) => b.textContent.replace(/[●▲✕]/g, "").trim());
  eq(labels.join(" | "), "Structure | Queues | Request types | Volume | Map | Defaults", "tab order");
  eq(consoleEvents.length, 0, "mount noise: " + consoleEvents.join(" | "));
});

await t("the sample model is complete: no attention markers, no progress strip", () => {
  eq($$(".subtabs .glyph").length, 0, "no glyphs when everything checks out");
  ok(!$(".pstrip"), "the strip only appears while incomplete");
});

await t("tab navigation switches panels (Structure → Queues → Map)", () => {
  eq($('[role="tabpanel"]').getAttribute("data-tab"), "structure", "starts on Structure");
  ok($$(".reglist").length === 5, "five flat registry lists");
  click(subtab("Queues"));
  eq($('[role="tabpanel"]').getAttribute("data-tab"), "queues", "Queues panel shown");
  ok(subtab("Queues").getAttribute("aria-selected") === "true", "aria-selected moves");
  click(subtab("Map"));
  ok(/No issues/.test($('[data-testid="validation-panel"]').textContent), "Map validation clean for the sample");
});

await t("Queues is a master–detail scaffold with DERIVED volume/AHT and blast radius", () => {
  click(subtab("Queues"));
  const rows = $$(".mdlist button");
  eq(rows.length, 4, "four sample queues listed");
  const inbound = rows.find((r) => /Inbound — Billing/.test(r.textContent));
  ok(/2,398\/day/.test(inbound.textContent.replace(/\s+/g, " ")), "derived 2,398/day on the row: " + inbound.textContent);
  click(inbound);
  const det = $('[data-testid="queue-detail"]');
  ok(/Inbound — Billing/.test($("h4", det).textContent), "detail shows the selected queue");
  ok(/2,398/.test(det.textContent), "derived volume in detail");
  ok(/Used in 1 process across 1 brand/.test(det.textContent), "blast radius line: " + det.textContent.slice(-160));
  const apps = rows.find((r) => /Case — Applications/.test(r.textContent));
  click(apps);
  ok(/Case — Applications/.test($("h4", $('[data-testid="queue-detail"]')).textContent), "selection moves the detail pane");
  eq($$(".mddetail input").length, 0, "read-only scaffold — no inputs");
});

await t("Request types is a master–detail editor: rows, assignment, step wiring", () => {
  click(subtab("Request types"));
  const rows = $$(".rtrow");
  eq(rows.length, 2, "two sample request types");
  const bill = rows.find((c) => /Billing enquiry/.test(c.textContent));
  ok(/Acme/.test(bill.textContent), "brand assignment on the row");
  click(bill);
  const det = $('[data-testid="rt-detail"]');
  ok(/Applies to:/.test(det.textContent), "resolved assignment spelled out");
  ok($$("input", det).some((i) => i.getAttribute("aria-label") && /sampling percent/.test(i.getAttribute("aria-label")) && i.value === "2"), "QA sampling editable at 2%");
  ok(/outcomes:/.test(det.textContent), "outcomes listed");
});

await t("Volume lists entries with scope labels and daily figures", () => {
  click(subtab("Volume"));
  const rows = $$(".vtable tbody tr");
  eq(rows.length, 2, "two sample entries");
  ok(rows.some((r) => /Acme › Customer Service › Billing enquiry/.test(r.textContent) && /2,398/.test(r.textContent)), "billing entry with address and daily");
});

await t("Defaults reads the attached engine config", () => {
  click(subtab("Defaults"));
  const p = $('[role="tabpanel"]');
  ok(/52 weeks/.test(p.textContent), "horizon shown");
  ok(/Occupancy ceiling/.test(p.textContent) && /85%/.test(p.textContent), "occupancy shown");
});

await t("a blank model drives the progress strip: names the next step, Go jumps there", () => {
  const c = document.createElement("div"); document.body.appendChild(c);
  act(() => { mod.exports.mount(c, { model: Ops.blankDomainModel() }); });
  ok(!$(".pstrip.done", c), "not done");
  ok(/Next:/.test($(".pstrip", c).textContent) && /brand/.test($(".pstrip", c).textContent), "names the Structure step first: " + $(".pstrip", c).textContent);
  // amber on the incomplete tabs, in dependency order
  ok(subtab("Structure", c).textContent.includes("▲"), "Structure flagged");
  click($(".pstrip .btn", c));
  eq($('[role="tabpanel"]', c).getAttribute("data-tab"), "structure", "Go jumps to Structure");
  ok(/none yet/.test($('[role="tabpanel"]', c).textContent), "empty registry state shown");
  c.remove();
});

await t("a broken process flags Request types and Map lists the error", () => {
  const c = document.createElement("div"); document.body.appendChild(c);
  let m = Ops.sampleDomainModel();
  m = Ops.updateStep(m, "rt_billing", "ch_voice", 1, { terminal: false });
  act(() => { mod.exports.mount(c, { model: m }); });
  ok(subtab("Request types", c).textContent.includes("▲"), "Request types flagged");
  click(subtab("Map", c));
  ok(/leads nowhere/.test($('[data-testid="validation-panel"]', c).textContent), "V3 error listed in Map");
  c.remove();
});

await t("zero unexpected console output across the whole run", () => {
  eq(consoleEvents.length, 0, "console noise: " + consoleEvents.join(" | "));
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("\nFAILURES:\n" + failures.map((f) => "  - " + f).join("\n")); process.exit(1); }
console.log("U1 / SETUP SHELL GATE: GREEN");
}
main().catch((e) => { console.error(e); process.exit(1); });
