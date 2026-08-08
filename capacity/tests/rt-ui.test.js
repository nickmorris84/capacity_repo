/* U3 GATE — the Request types tab (BUILD-PLAN U3), the heart of Setup.
 * Master–detail editing per REVIEW-SETUP §3.3: identity · assignment with All
 * semantics spelled out (V2 double-cover inline) · AHT override · one process
 * per channel (entry step, splits, sampling on governance queues, terminal +
 * outcome, editable outcome chips, the p/(1−p) rework figure) with V3 live —
 * and the cascade proof: an edited split moves the DERIVED queue volume shown
 * on the Queues tab. Zero console noise throughout.
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
function setV(el, v) { ok(el, "setV target missing"); const p = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype; const s = Object.getOwnPropertyDescriptor(p, "value").set; act(() => { s.call(el, String(v)); el.dispatchEvent(new window.Event("input", { bubbles: true })); el.dispatchEvent(new window.Event("change", { bubbles: true })); }); }
function toggle(el) { ok(el, "toggle target missing"); const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "checked").set; act(() => { s.call(el, !el.checked); el.dispatchEvent(new window.Event("click", { bubbles: true })); el.dispatchEvent(new window.Event("change", { bubbles: true })); }); }
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
const rtRow = (name) => $$(".rtrow").find((r) => r.textContent.includes(name));
const detail = () => $('[data-testid="rt-detail"]');
const byLabel = (re, r) => $$("input,select", r || detail()).find((i) => re.test(i.getAttribute("aria-label") || ""));

console.log("Request types gate — BUILD-PLAN U3");

async function main() {
await t("mounts; master list shows rows with group, assignment and channels", () => {
  act(() => { new Function("module", "exports", "require", "__dirname", "__filename", built.outputFiles[0].text)(mod, mod.exports, require, path.join(__dirname, "../ui/v2"), path.join(__dirname, "../ui/v2/setup-v3-main.jsx")); });
  subtab("Request types");
  eq($$(".rtrow").length, 2, "two rows");
  const card = rtRow("New card application");
  ok(/Cards/.test(card.textContent) && /Credit cards/.test(card.textContent), "group + product chips");
  ok(/Acme · Customer Service/.test(card.textContent), "assignment summary");
  ok(/Digital/.test(card.textContent), "channel listed");
  ok(/●/.test(card.textContent), "valid glyph");
  eq(consoleEvents.length, 0, "mount noise: " + consoleEvents.join(" | "));
});

await t("identity edits: name, group select, AHT override are live model edits", () => {
  click(rtRow("New card application"));
  eq(byLabel(/^Request type name$/).value, "New card application", "name loaded");
  eq(byLabel(/^AHT override$/).value, "540", "AHT override loaded");
  setV(byLabel(/^Request type name$/), "Card application");
  ok(rtRow("Card application"), "rename reflects in the master list");
  setV(byLabel(/^Request type name$/), "New card application");
});

await t("assignment: unassigning the only brand spells out All; reassign restores", () => {
  click(rtRow("Billing enquiry"));
  const applies = () => $('[data-testid="applies-line"]').textContent;
  ok(/Acme · Customer Service/.test(applies()), "starts assigned");
  click($$(".chip.on-toggle", detail()).find((c) => c.textContent === "Acme"));
  ok(/all brands/.test(applies()), "empty ⇒ All, spelled out: " + applies());
  click($$(".chip.off", detail()).find((c) => /Acme/.test(c.textContent)));
  ok(/Acme/.test(applies()), "reassigned");
});

await t("V2 double-cover renders inline in Assignment (soft, scoped to the group)", () => {
  const c = document.createElement("div"); document.body.appendChild(c);
  let m = Ops.sampleDomainModel();
  m = Ops.addRequestType(m, { name: "Billing dispute", groupId: "pg_billing" });
  const rtId = m.requestTypes[2].id;
  m = Ops.setAssignment(m, rtId, { brandIds: ["b_acme"], buIds: ["bu_cs"] });
  m = Ops.addProcess(m, rtId, "ch_voice");
  m = Ops.addStep(m, rtId, "ch_voice", { queueId: "q_inbound" });
  m = Ops.updateStep(m, rtId, "ch_voice", 0, { terminal: true, outcome: "completed" });
  act(() => { mod.exports.mount(c, { model: m }); });
  subtab("Request types", c);
  const row = $$(".rtrow", c).find((r) => /Billing dispute/.test(r.textContent));
  ok(/▲/.test(row.textContent), "warn glyph on the row");
  click(row);
  ok(/handled twice/.test($('[data-testid="rt-detail"]', c).textContent), "double-cover message inline");
  c.remove();
});

await t("THE CASCADE PROOF: editing the 60% split to 100 moves the derived queue volume", () => {
  click(rtRow("New card application"));
  const split = $$("input", detail()).find((i) => /step 2 split percent/.test(i.getAttribute("aria-label") || "") && i.value === "60");
  ok(split, "the 60% verification split input");
  setV(split, 100);
  subtab("Queues");
  const verify = $$(".mdlist button").find((r) => /Outbound — Verification/.test(r.textContent));
  ok(/702\/day/.test(verify.textContent.replace(/\s+/g, " ")), "q_verify derives 702/day at 100%: " + verify.textContent);
  subtab("Request types");
  click(rtRow("New card application"));
  setV($$("input", detail()).find((i) => /step 2 split percent/.test(i.getAttribute("aria-label") || "")), 60);
});

await t("the p/(1−p) multi-round rework figure rides the split field's tooltip", () => {
  click(rtRow("New card application"));
  const split = $$("input", detail()).find((i) => /step 2 split percent/.test(i.getAttribute("aria-label") || ""));
  ok(/effective 150%/.test(split.getAttribute("title") || ""), "60% branch tooltip shows eff. 150% (0.6/0.4): " + split.getAttribute("title"));
});

await t("terminal + outcome: unticking 'ends' flags V3 live; reticking clears it", () => {
  click(rtRow("Billing enquiry"));
  const ends = byLabel(/rt_billing ch_voice step 2 terminal/);
  toggle(ends); // off
  ok(/leads nowhere/.test(detail().textContent), "inline V3 error");
  ok(/✕/.test(rtRow("Billing enquiry").textContent), "error glyph in the master list");
  ok(subtab("Request types").textContent.includes("▲"), "tab marker shows the error");
  toggle(byLabel(/rt_billing ch_voice step 2 terminal/)); // on again
  setV(byLabel(/rt_billing ch_voice step 2 outcome/), "completed");
  ok(!/leads nowhere/.test(detail().textContent), "V3 clears");
  ok(/●/.test(rtRow("Billing enquiry").textContent), "row back to valid");
});

await t("outcome chips: add one, use it on a terminal step, removal then blocks", () => {
  click(rtRow("New card application"));
  setV(byLabel(/rt_newcard ch_digital new outcome/), "escalated");
  click($$(".btn", detail()).find((b) => b.textContent === "Add"));
  const outSel = byLabel(/rt_newcard ch_digital step 3 outcome/);
  ok([...outSel.options].some((o) => o.value === "escalated"), "new outcome offered on terminal steps");
  ok($$(".chip", detail()).some((c) => /escalated/.test(c.textContent) && c.querySelector(".chipx")), "unused outcome removable");
  setV(outSel, "escalated");
  const chip = $$(".chip", detail()).find((c) => /escalated/.test(c.textContent));
  ok(!chip.querySelector(".chipx") && /in use/.test(chip.textContent), "outcome in use is not removable");
  setV(byLabel(/rt_newcard ch_digital step 3 outcome/), "completed");
});

await t("channel picker: adding a Voice process to the card journey, then removing it", () => {
  click(rtRow("New card application"));
  click($$(".chip.off", detail()).find((c) => /Voice/.test(c.textContent)));
  const proc = $('[data-testid="process-rt_newcard-ch_voice"]');
  ok(proc, "voice process created");
  ok(/inert until it routes/.test(proc.textContent), "empty-process hint");
  click($$(".btn", proc).find((b) => b.textContent === "+ Step"));
  ok($$(".steprow:not(.head)", $('[data-testid="process-rt_newcard-ch_voice"]')).length === 1, "entry step added");
  // The process now holds a step, so removal arms once before it commits —
  // it destroys every step/split/outcome and there is no undo.
  click($(".prochead .regdel", $('[data-testid="process-rt_newcard-ch_voice"]')));
  const arm = $(".prochead .btn.danger", $('[data-testid="process-rt_newcard-ch_voice"]'));
  ok(arm && /Remove 1 step\?/.test(arm.textContent), "arms with what will be lost: " + (arm && arm.textContent));
  ok($('[data-testid="process-rt_newcard-ch_voice"]'), "first click does not delete");
  click(arm);
  ok(!$('[data-testid="process-rt_newcard-ch_voice"]'), "second click removes the process");
  ok($$(".chip.off", detail()).some((c) => /Voice/.test(c.textContent)), "channel offered again");
});

await t("add + guarded delete: a new request type deletes; one with volume entries is blocked", () => {
  // The add button now sits outside .mdlist (it is not a valid listbox child,
  // and .mdlist button was overriding its skin). Exact text is unambiguous.
  click($$(".btn").find((b) => b.textContent === "+ Request type"));
  ok(rtRow("New request type"), "created and listed");
  ok($$(".btn", detail()).some((b) => b.textContent === "Delete request type"), "fresh one deletable");
  click($$(".btn", detail()).find((b) => b.textContent === "Delete request type"));
  ok(!rtRow("New request type"), "deleted");
  click(rtRow("Billing enquiry"));
  ok(/Delete blocked/.test(detail().textContent) && /1 volume entry/.test(detail().textContent), "delete guarded by its volume entry: " + detail().textContent.slice(-120));
});

await t("zero unexpected console output across the whole run", () => {
  eq(consoleEvents.length, 0, "console noise: " + consoleEvents.join(" | "));
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("\nFAILURES:\n" + failures.map((f) => "  - " + f).join("\n")); process.exit(1); }
console.log("U3 / REQUEST TYPES GATE: GREEN");
}
main().catch((e) => { console.error(e); process.exit(1); });
