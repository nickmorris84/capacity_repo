/* U6 GATE — Estate map + Defaults (BUILD-PLAN U6). The map is a PURE generated
 * artefact: queue nodes by journey depth, flow edges entirely from process
 * steps (split % · sampling), capacity links dashed and distinct, always
 * current, validation panel with jump-links, node tap → "Edit in Queues".
 * It lives in the "Whole estate map" drawer at the foot of Volume & flow.
 * Renders the sample AND an empty model clean. Defaults is the global form
 * (frame · workforce · overtime · costs · customer · pattern libraries) and
 * edits reach the engineConfig. Zero console noise throughout.
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
const E = require("../engine/engine.js");

function click(el) { ok(el, "click target missing"); act(() => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); }); }
function setV(el, v) { ok(el, "setV target missing"); const p = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype; const s = Object.getOwnPropertyDescriptor(p, "value").set; act(() => { s.call(el, String(v)); el.dispatchEvent(new window.Event("input", { bubbles: true })); el.dispatchEvent(new window.Event("change", { bubbles: true })); }); }
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
// Segments are drawers: "navigating" means opening one. Idempotent so a test
// that returns to a segment does not toggle it shut.
// Navigation is the tab strip; selecting is idempotent so a test returning to
// a tab does not toggle anything. (Drawers live INSIDE each tab.)
function subtab(label, r) {
  const b = $$(".subtabs button", r).find((x) => x.textContent.includes(label));
  if (b && b.getAttribute("aria-selected") !== "true") click(b);
  return b;
}
// The estate map lives in a drawer at the foot of Volume & flow. Idempotent.
function openEstate(r) {
  subtab("Volume", r);
  const b = $$(".drwhead", r).find((x) => /Whole estate map/.test(x.textContent));
  ok(b, "estate map drawer present");
  if (b.getAttribute("aria-expanded") !== "true") click(b);
}
const byLabel = (re, r) => $$("input,select", r).find((i) => re.test(i.getAttribute("aria-label") || ""));

console.log("Estate map + Defaults gate — BUILD-PLAN U6");

async function main() {
await t("the estate map generates itself from the sample: nodes by depth, flow edges labelled", () => {
  act(() => { new Function("module", "exports", "require", "__dirname", "__filename", built.outputFiles[0].text)(mod, mod.exports, require, path.join(__dirname, "../ui/v2"), path.join(__dirname, "../ui/v2/setup-v3-main.jsx")); });
  openEstate();
  const svg = $('[data-testid="map-svg"]');
  ok(svg, "svg rendered");
  eq($$(".mnode:not(.team)", svg).length, 4, "four queue nodes");
  const flows = $$(".medge.flow", svg);
  ok(flows.length >= 3, "flow edges from process steps: " + flows.length);
  ok(flows.some((f) => /100% · sample 2%/.test(f.textContent)), "sampling edge labelled");
  ok(flows.some((f) => /60%/.test(f.textContent)), "the 60% split edge labelled");
  ok($$(".mnode", svg).some((n) => /2,398\/day/.test(n.textContent)), "derived volume on the node");
  eq(consoleEvents.length, 0, "mount noise: " + consoleEvents.join(" | "));
});

await t("capacity links draw dashed and distinct from flow", () => {
  const c = document.createElement("div"); document.body.appendChild(c);
  let m = Ops.sampleDomainModel();
  m = Ops.updateQueueStaffing(m, "q_verify", { supports: ["q_inbound"] });
  const ec = { ...E.makeDefaultConfig() }; delete ec.queues; ec.serviceTeams = [];
  m.engineConfig = ec;
  m = Ops.addServiceTeam(m, { name: "Flex pool", coversQueues: ["q_inbound", "q_apps"] });
  act(() => { mod.exports.mount(c, { model: m }); });
  openEstate(c);
  const caps = $$(".medge.cap", c);
  ok(caps.some((e) => /supports/.test(e.textContent)), "supports link present");
  ok(caps.filter((e) => /covers/.test(e.textContent)).length === 2, "team covers links");
  ok(caps.every((e) => e.querySelector("line").getAttribute("stroke-dasharray")), "capacity links dashed");
  ok($$(".medge.flow", c).every((e) => !e.querySelector("line").getAttribute("stroke-dasharray")), "flow edges solid");
  ok($$(".mnode.team", c).length === 1, "team node drawn");
  c.remove();
});

await t("tap a node → details + Edit in Queues jumps to the editor", () => {
  const node = $$(".mnode").find((n) => /Inbound — Billing/.test(n.textContent));
  click(node);
  const det = $('[data-testid="map-node-detail"]');
  ok(det && /Inbound — Billing/.test(det.textContent), "node detail shown");
  click($$("button", det).find((b) => /Edit in Queues/.test(b.textContent)));
  eq($('[role="tabpanel"]').getAttribute("data-tab"), "queues", "jumped to Queues");
  openEstate();
});

await t("validation issues carry jump-links to the tab that fixes them", () => {
  const c = document.createElement("div"); document.body.appendChild(c);
  let m = Ops.sampleDomainModel();
  m = Ops.updateStep(m, "rt_billing", "ch_voice", 1, { terminal: false });
  m = Ops.addBrand(m, { id: "b_z", name: "Zeta" });
  m = Ops.setVolumeEntry(m, { brandId: "b_z" }, { daily: 500 });
  act(() => { mod.exports.mount(c, { model: m }); });
  openEstate(c);
  const panel = $('[data-testid="validation-panel"]', c);
  ok(/leads nowhere/.test(panel.textContent), "V3 listed");
  ok(/inert/.test(panel.textContent), "V1 uncovered listed");
  const fixRt = $$("button", panel).find((b) => /Fix in Request types/.test(b.textContent));
  const fixVol = $$("button", panel).find((b) => /Fix in Volume/.test(b.textContent));
  ok(fixRt && fixVol, "jump-links per issue kind");
  click(fixVol);
  eq($('[role="tabpanel"]', c).getAttribute("data-tab"), "volume", "jumped to Volume");
  c.remove();
});

await t("an empty model renders the estate map clean (no crash, a hint instead)", () => {
  const c = document.createElement("div"); document.body.appendChild(c);
  act(() => { mod.exports.mount(c, { model: Ops.blankDomainModel() }); });
  openEstate(c);
  ok(/draws itself once/.test($('[role="tabpanel"]', c).textContent), "empty hint");
  ok(!$('[data-testid="map-svg"]', c), "no svg for an empty world");
  c.remove();
});

await t("Defaults edits reach the engineConfig: frame, overtime, seasonality preset", () => {
  subtab("Defaults");
  const p = $('[role="tabpanel"]');
  setV(byLabel(/^Horizon/, p), 40);
  eq(byLabel(/^Horizon/, $('[role="tabpanel"]')).value, "40", "horizon edit sticks");
  setV(byLabel(/OT premium/, $('[role="tabpanel"]')), 2);
  eq(byLabel(/OT premium/, $('[role="tabpanel"]')).value, "2", "overtime premium sticks (settings.ot)");
  const sel = byLabel(/System seasonality/, $('[role="tabpanel"]'));
  const target = [...sel.options].map((o) => o.value).find((v) => v && v !== "Flat");
  setV(sel, target);
  eq(byLabel(/System seasonality/, $('[role="tabpanel"]')).value, target, "preset applied and recognised round-trip");
  setV(byLabel(/^Horizon/, $('[role="tabpanel"]')), 52);
});

await t("zero unexpected console output across the whole run", () => {
  eq(consoleEvents.length, 0, "console noise: " + consoleEvents.join(" | "));
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("\nFAILURES:\n" + failures.map((f) => "  - " + f).join("\n")); process.exit(1); }
console.log("U6 / MAP + DEFAULTS GATE: GREEN");
}
main().catch((e) => { console.error(e); process.exit(1); });
