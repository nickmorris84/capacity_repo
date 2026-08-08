/* U5 GATE — the Volume tab (BUILD-PLAN U5): the cascade grid. Rows are the
 * spine, type-anywhere, provenance badges, scaling flags (V5), 52-week
 * series/shape presets — and THE OWNER'S WORKED EXAMPLE from DOMAIN-MODEL §6
 * driven through the UI: brand 10,000 entered + Collections 5,000 entered ⇒
 * the two sibling request types take 2,500 each [equal share of remainder]
 * and a two-channel type splits 1,250/1,250. Zero console noise throughout.
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
function setV(el, v) { ok(el, "setV target missing"); const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype; const s = Object.getOwnPropertyDescriptor(proto, "value").set; act(() => { s.call(el, String(v)); el.dispatchEvent(new window.Event("input", { bubbles: true })); el.dispatchEvent(new window.Event("change", { bubbles: true })); }); }
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
// The visible label now carries its level ("BRAND Acme"), so match the row by
// its data hook rather than by rendered text.
const row = (name, r) => $$(".volrow:not(.head)", r).find((x) => x.getAttribute("data-row") === name);
const kindOf = (name, r) => row(name, r).getAttribute("data-kind");
const val = (name, r) => $("input", row(name, r)).value;
const prov = (name, r) => $(".prov", row(name, r)).textContent;

// The worked-example estate: one brand, one BU, three request types
// (Collections and Billing on Voice; New card on Voice AND Digital).
function workedModel() {
  let m = Ops.blankDomainModel();
  m = Ops.addBrand(m, { id: "b_a", name: "Brand A" });
  m = Ops.addBusinessUnit(m, { id: "bu_1", name: "Operations" });
  m = Ops.addChannel(m, { key: "voice", name: "Voice" });
  m = Ops.addChannel(m, { key: "digital", name: "Digital" });
  m = Ops.addQueue(m, { id: "q_1", name: "Front desk", type: "inbound_call", fallbackAhtSec: 300 });
  for (const [id, name, chans] of [["rt_coll", "Collections", ["ch_voice"]], ["rt_bill", "Billing", ["ch_voice"]], ["rt_new", "New card", ["ch_voice", "ch_digital"]]]) {
    m = Ops.addRequestType(m, { id, name });
    m = Ops.setAssignment(m, id, { brandIds: ["b_a"], buIds: ["bu_1"] });
    for (const ch of chans) {
      m = Ops.addProcess(m, id, ch);
      m = Ops.addStep(m, id, ch, { queueId: "q_1" });
      m = Ops.updateStep(m, id, ch, 0, { terminal: true, outcome: "completed" });
    }
  }
  return m;
}

console.log("Volume cascade grid gate — BUILD-PLAN U5");

async function main() {
await t("mounts; the grid shows the full spine with sum/entered/equal provenance", () => {
  act(() => { new Function("module", "exports", "require", "__dirname", "__filename", built.outputFiles[0].text)(mod, mod.exports, require, path.join(__dirname, "../ui/v2"), path.join(__dirname, "../ui/v2/setup-v3-main.jsx")); });
  subtab("Volume");
  ok($('[data-testid="cascade-grid"]'), "grid present");
  eq(prov("Whole estate"), "sum", "estate sums");
  eq(prov("Billing enquiry"), "entered", "sample entry entered at rt level");
  eq(val("Billing enquiry"), "2398", "entered value shown");
  eq(val("Billing enquiry — Voice"), "2398", "the process beneath it inherits the full figure");
  eq(consoleEvents.length, 0, "mount noise: " + consoleEvents.join(" | "));
});

await t("THE OWNER'S WORKED EXAMPLE: 10,000 at brand + 5,000 at Collections", () => {
  const c = document.createElement("div"); document.body.appendChild(c);
  act(() => { mod.exports.mount(c, { model: workedModel() }); });
  subtab("Volume", c);
  setV($("input", row("Brand A", c)), 10000);
  setV($("input", row("Collections", c)), 5000);
  eq(prov("Brand A", c), "entered", "brand entered");
  eq(prov("Collections", c), "entered", "collections entered");
  eq(val("Billing", c), "2500", "Billing takes an equal share of the remainder");
  eq(prov("Billing", c), "equal split", "flagged as equal");
  eq(val("New card", c), "2500", "New card equal share");
  const chans = $$(".volrow:not(.head)", c).filter((r) => r.getAttribute("data-kind") === "Process");
  const newCardChans = chans.slice(-2); // the last rt's two processes
  eq($("input", newCardChans[0]).value, "1250", "New card Voice 1,250");
  eq($("input", newCardChans[1]).value, "1250", "New card Digital 1,250");
  ok(newCardChans.every((r) => /equal/.test($(".prov", r).textContent)), "channels equal split");
  c.remove();
});

await t("type-anywhere: a finer entry becomes a weight; clearing restores equal", () => {
  const c = document.createElement("div"); document.body.appendChild(c);
  act(() => { mod.exports.mount(c, { model: workedModel() }); });
  subtab("Volume", c);
  setV($("input", row("Brand A", c)), 9000);
  eq(val("Collections", c), "3000", "equal thirds initially");
  setV($("input", row("Billing", c)), 1000);
  // Billing entered 1000; remainder 8000 split equally between the other two.
  eq(val("Billing", c), "1000", "billing holds its entry");
  eq(val("Collections", c), "4000", "remainder splits equally");
  eq(val("New card", c), "4000", "remainder splits equally (2)");
  setV($("input", row("Billing", c)), "");
  eq(val("Billing", c), "3000", "cleared → back to equal thirds");
  eq(prov("Billing", c), "equal split", "provenance follows");
  c.remove();
});

await t("V5: conflicting finer entries are scaled AND flagged, never silent", () => {
  const c = document.createElement("div"); document.body.appendChild(c);
  act(() => { mod.exports.mount(c, { model: workedModel() }); });
  subtab("Volume", c);
  setV($("input", row("Brand A", c)), 6000);
  setV($("input", row("Collections", c)), 5000);
  setV($("input", row("Billing", c)), 5000);
  // 5000+5000 > 6000 → scaled ×0.6 (New card gets nothing to weight, 0? equal of remainder 0)
  ok(/scaled/.test(prov("Collections", c)), "collections scaled: " + prov("Collections", c));
  ok($('[data-testid="volume-notes"]', c), "notes panel present");
  ok(/scaled ×0\.6/.test($('[data-testid="volume-notes"]', c).textContent), "the ×0.6 reconciliation is spelled out: " + $('[data-testid="volume-notes"]', c).textContent);
  c.remove();
});

await t("shapes: a preset expands to a 52-week series and marks the row", () => {
  const c = document.createElement("div"); document.body.appendChild(c);
  act(() => { mod.exports.mount(c, { model: workedModel() }); });
  subtab("Volume", c);
  setV($("input", row("Brand A", c)), 10000);
  const shapeBtn = $$("button", row("Brand A", c)).find((b) => /flat|52-wk|inherited/.test(b.textContent));
  eq(shapeBtn.textContent.trim(), "flat", "starts flat");
  click(shapeBtn);
  const ed = $('[data-testid="shape-editor"]', c);
  ok(ed, "shape editor opens");
  const preset = $$(".chip", ed).find((b) => /Christmas|Retail/.test(b.textContent)) || $$(".chip", ed)[1];
  click(preset);
  ok(/52-wk/.test($$("button", row("Brand A", c)).find((b) => /52-wk|flat|inherited/.test(b.textContent)).textContent), "row marked 52-wk");
  ok(/inherited/.test($$("button", row("Collections", c)).find((b) => /52-wk|flat|inherited/.test(b.textContent)).textContent), "children inherit the shape");
  c.remove();
});

await t("a typed 52-value series applies; a wrong count is rejected with a reason", () => {
  const c = document.createElement("div"); document.body.appendChild(c);
  act(() => { mod.exports.mount(c, { model: workedModel() }); });
  subtab("Volume", c);
  setV($("input", row("Collections", c)), 1000);
  click($$("button", row("Collections", c)).find((b) => /flat/.test(b.textContent)));
  const ed = $('[data-testid="shape-editor"]', c);
  setV($("textarea", ed), "1, 2, 3");
  click($$("button", ed).find((b) => b.textContent === "Apply series"));
  ok(/need 52 numbers/.test(ed.textContent), "wrong count rejected: " + ed.textContent.slice(-60));
  setV($("textarea", ed), Array.from({ length: 52 }, (_, i) => 1000 + i * 10).join(","));
  click($$("button", ed).find((b) => b.textContent === "Apply series"));
  ok(/52-wk/.test($$("button", row("Collections", c)).find((b) => /52-wk|flat|inherited/.test(b.textContent)).textContent), "series applied");
  c.remove();
});

await t("every level is labelled, and the finest one is a PROCESS not a queue", () => {
  subtab("Volume");
  const kinds = $$(".volrow:not(.head)").map((r) => r.getAttribute("data-kind"));
  eq([...new Set(kinds)].join(" | "), "Estate | Brand | Business unit | Request type | Process", "the spine names its levels");
  // the label is visible on the row, not just in the DOM
  const brand = row("Acme");
  ok(/BRAND/i.test($(".volkind", brand).textContent), "level shown on the row: " + $(".volkind", brand).textContent);
  // the leaf is the process — the journey the demand runs through — and no
  // queue appears as a volume level, because queue load is derived.
  const leaves = $$(".volrow:not(.head)").filter((r) => r.getAttribute("data-kind") === "Process");
  ok(leaves.length >= 2, "process rows present");
  ok(leaves.some((r) => r.getAttribute("data-row") === "Billing enquiry — Voice"), "named after the process");
  const names = $$(".volrow:not(.head)").map((r) => r.getAttribute("data-row"));
  ok(!names.some((n) => /^Inbound — Billing$|^QA — Governance$/.test(n)), "no queue is a volume level: " + names.join(", "));
});

await t("zero unexpected console output across the whole run", () => {
  eq(consoleEvents.length, 0, "console noise: " + consoleEvents.join(" | "));
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("\nFAILURES:\n" + failures.map((f) => "  - " + f).join("\n")); process.exit(1); }
console.log("U5 / VOLUME CASCADE GATE: GREEN");
}
main().catch((e) => { console.error(e); process.exit(1); });
