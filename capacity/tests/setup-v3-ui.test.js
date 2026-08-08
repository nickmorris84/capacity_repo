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
// Segments are drawers: "navigating" means opening one. Idempotent so a test
// that returns to a segment does not toggle it shut.
function segment(label, r) { return $$(".sec", r).find((x) => $(".sechead b", x).textContent === label); }
function subtab(label, r) {
  const sec = segment(label, r);
  if (sec && !sec.classList.contains("open")) click($(".sechead", sec));
  return $(".sechead", segment(label, r));
}

console.log("Setup shell gate — BUILD-PLAN U1");

async function main() {
await t("mounts with zero console noise; six segments in dependency order", () => {
  act(() => { new Function("module", "exports", "require", "__dirname", "__filename", built.outputFiles[0].text)(mod, mod.exports, require, path.join(__dirname, "../ui/v2"), path.join(__dirname, "../ui/v2/setup-v3-main.jsx")); });
  ok(document.getElementById("root").children.length > 0, "rendered");
  const labels = $$(".sec .sechead b").map((b) => b.textContent.trim());
  eq(labels.join(" | "), "Structure | Queues | Request types | Volume | Map | Defaults", "segment order");
  // Every segment is numbered in dependency order and carries a caption while shut.
  eq($$(".sec .secnum").map((n) => n.textContent).join(""), "123456", "numbered 1-6");
  ok($$(".sec .sechead small").every((x) => x.textContent.length > 10), "each says what it is while collapsed");
  eq(consoleEvents.length, 0, "mount noise: " + consoleEvents.join(" | "));
});

await t("every segment is a drawer, shut by default", () => {
  eq($$(".sec.open").length, 0, "nothing is open on arrival");
  eq($$(".secbody").length, 0, "no segment body is mounted until opened");
  ok(!$(".pstrip"), "the strip only appears while incomplete");
  ok($$(".sec .badge.todo").length === 0, "a complete model shows no amber badges");
});

await t("opening a segment reveals it; opening another leaves one open at a time", () => {
  subtab("Structure");
  eq($$(".sec.open").length, 1, "one open");
  eq($(".sec.open").getAttribute("data-seg"), "structure", "the one clicked");
  ok($$(".reglist").length === 5, "five flat registry lists inside it");
  ok($(".sec.open .sechead").getAttribute("aria-expanded") === "true", "expanded state announced");
  subtab("Map");
  eq($(".sec.open").getAttribute("data-seg"), "map", "focus moves to the newly opened segment");
  eq($$(".sec.open").length, 1, "the previous one closed");
  ok(/No issues/.test($('[data-testid="validation-panel"]').textContent), "Map validation clean for the sample");
});

await t("clicking an open segment's header shuts it again", () => {
  subtab("Defaults");
  eq($(".sec.open").getAttribute("data-seg"), "defaults", "opened");
  click($(".sec.open .sechead"));
  eq($$(".sec.open").length, 0, "closed by clicking its own header");
});

await t("Queues: a row list you drill into — the editor opens as a drawer", () => {
  subtab("Queues");
  const rows = $$(".mdlist button");
  ok(rows.length >= 4, "queue rows listed (plus any shared teams)");
  ok(!$(".drawer.on"), "no drawer until a queue is picked — the list is the landing view");
  const inbound = rows.find((r) => /Inbound — Billing/.test(r.textContent));
  ok(/2,398\/day/.test(inbound.textContent.replace(/\s+/g, " ")), "derived 2,398/day on the row: " + inbound.textContent);
  click(inbound);
  ok($(".drawer.on"), "drawer opens on click");
  ok(/Inbound — Billing/.test($(".dhead h3").textContent), "drawer is titled with the queue");
  const det = $('[data-testid="queue-detail"]');
  ok(/2,398\/day/.test(det.textContent), "derived strip in the drawer");
  ok(/used in 1 process across 1 brand/.test(det.textContent), "blast radius line");
  ok(!$$("input", det).some((i) => /2,?398/.test(i.value)), "derived volume is never an input");
  const fams = $$(".famhead b", det).map((b) => b.textContent);
  eq(fams.join("|"), "Inputs|Performance|Efficiency|Workforce|Customer|Outputs", "six KPI families");
  // Each family is a section that opens on demand — only Inputs starts open.
  eq($$(".fam-sec.open", det).length, 1, "one family open by default");
  click($$(".famhead", det)[1]);
  eq($$(".fam-sec.open", det).length, 2, "clicking a family header opens it");
  const apps = rows.find((r) => /Case — Applications/.test(r.textContent));
  click(apps);
  ok(/Case — Applications/.test($(".dhead h3").textContent), "picking another queue retitles the drawer");
  click($(".drawer .close"));
  ok(!$(".drawer.on"), "drawer closes");
});

await t("Request types is a master–detail editor: rows, assignment, step wiring", () => {
  subtab("Request types");
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

await t("Volume renders the cascade grid with the spine and provenance", () => {
  subtab("Volume");
  const grid = $('[data-testid="cascade-grid"]');
  ok(grid, "cascade grid present");
  const rows = $$(".volrow:not(.head)", grid);
  ok(rows.length >= 7, "estate + brand + BU + rt + channel rows: " + rows.length);
  const billing = rows.find((r) => /Billing enquiry/.test(r.textContent));
  ok(billing && /entered/.test(billing.textContent), "entered provenance on the billing row");
  const estate = rows.find((r) => /Whole estate/.test(r.textContent));
  ok(/sum/.test(estate.textContent), "estate row sums");
});

await t("Defaults reads the attached engine config", () => {
  subtab("Defaults");
  const p = $(".sec.open .secbody");
  const horizon = $$("input", p).find((i) => /Horizon/.test(i.getAttribute("aria-label") || ""));
  eq(horizon.value, "52", "horizon loaded");
  const occ = $$("input", p).find((i) => /Occupancy ceiling/.test(i.getAttribute("aria-label") || ""));
  eq(occ.value, "85", "occupancy loaded");
});

await t("a blank model drives the progress strip: names the next step, Go jumps there", () => {
  const c = document.createElement("div"); document.body.appendChild(c);
  act(() => { mod.exports.mount(c, { model: Ops.blankDomainModel() }); });
  ok(!$(".pstrip.done", c), "not done");
  ok(/Next:/.test($(".pstrip", c).textContent) && /brand/.test($(".pstrip", c).textContent), "names the Structure step first: " + $(".pstrip", c).textContent);
  // amber badges on the incomplete segments, readable while they are shut
  ok(/▲/.test($(".sechead .badge", segment("Structure", c)).textContent), "Structure flagged on its collapsed header");
  click($(".pstrip .btn", c));
  eq($(".sec.open", c).getAttribute("data-seg"), "structure", "Go opens Structure");
  ok(/none yet/.test($(".sec.open .secbody", c).textContent), "empty registry state shown");
  c.remove();
});

await t("a broken process flags Request types and Map lists the error", () => {
  const c = document.createElement("div"); document.body.appendChild(c);
  let m = Ops.sampleDomainModel();
  m = Ops.updateStep(m, "rt_billing", "ch_voice", 1, { terminal: false });
  act(() => { mod.exports.mount(c, { model: m }); });
  ok(/▲/.test($(".sechead .badge", segment("Request types", c)).textContent), "Request types flagged on its collapsed header");
  subtab("Map", c);
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
