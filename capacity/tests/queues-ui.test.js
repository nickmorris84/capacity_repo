/* U4 GATE — the Queues tab (BUILD-PLAN U4). The deep editor per REVIEW-SETUP
 * §3.2: master list grouped by home (+ Global + Shared capacity), six KPI
 * families with Advanced disclosures (~30 params), manual hires (week × heads
 * — S4's input), service teams, blast radius on rows, guarded deletes, reset.
 * Ends with the S4 proof: hires authored through the domain model reach the
 * engine and raise staffing. Zero console noise throughout.
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
const { domainToEngineConfig } = require("../model/bridge.js");

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
const qRow = (name) => $$(".tickethead").find((r) => r.textContent.includes(name));
// Tickets toggle, so opening is idempotent — clicking an open one shuts it.
function openQueue(name) {
  const head = qRow(name);
  ok(head, "queue ticket not found: " + name);
  if (head.getAttribute("aria-expanded") !== "true") click(head);
  return qRow(name);
}
const detail = () => $('[data-testid="queue-detail"]');
const byLabel = (re, r) => $$("input,select", r || detail()).find((i) => re.test(i.getAttribute("aria-label") || ""));
function famSec(name, r) { return $$(".fam-sec", r || detail()).find((s) => $(".famhead b", s).textContent === name); }
function openAdv(name) { const s = famSec(name); const b = $$("button", s).find((x) => /Advanced/.test(x.textContent)); if (b) click(b); return famSec(name); }

console.log("Queues tab gate — BUILD-PLAN U4");

async function main() {
await t("mounts; master list grouped by home + Global", () => {
  act(() => { new Function("module", "exports", "require", "__dirname", "__filename", built.outputFiles[0].text)(mod, mod.exports, require, path.join(__dirname, "../ui/v2"), path.join(__dirname, "../ui/v2/setup-v3-main.jsx")); });
  subtab("Queues");
  const labs = $$(".mdgrouplab").map((l) => l.textContent);
  ok(labs.includes("Acme › Customer Service"), "home group present: " + labs.join(" | "));
  ok(labs.includes("Global — no home"), "global group present");
  // The ticket shows name + status + headline figures; the blast radius is the
  // status badge's detail rather than more text on the row.
  const qa = qRow("QA — Governance");
  ok(/governance/.test(qa.textContent), "type on the ticket");
  const badge = $(".statusdot", qa);
  ok(/^active$/.test(badge.textContent), "status reads active/not active, not a sentence");
  ok(/2 processes across 1 brand/.test(badge.getAttribute("title")), "blast radius on hover: " + badge.getAttribute("title"));
  ok(/\/day/.test($(".tsum", qa).textContent), "headline figures on the right");
  eq(consoleEvents.length, 0, "mount noise: " + consoleEvents.join(" | "));
});

await t("the editor shows six families; core params edit and mark the row modified", () => {
  openQueue("Inbound — Billing");
  eq($$(".fam-sec", detail()).length, 6, "six family sections");
  ok(!qRow("Inbound — Billing").querySelector(".moddot"), "not modified yet");
  setV(byLabel(/^ASA target/), 20);
  ok(qRow("Inbound — Billing").querySelector(".moddot"), "modified dot appears");
  eq(byLabel(/^ASA target/).value, "20", "edit sticks");
});

await t("Advanced disclosures open the long tail (burnout, learning curve, priority)", () => {
  const eff = openAdv("Efficiency");
  ok(byLabel(/Burnout threshold/, eff), "burnout params under Efficiency advanced");
  ok(byLabel(/Max attrition/, eff), "max attrition mult present");
  const wf = openAdv("Workforce");
  ok(byLabel(/Learning curve/, wf), "learning curve editable");
  ok($$(".chip", wf).length > 0, "cross-skill chips offered");
  const inp = openAdv("Inputs");
  ok(byLabel(/^Priority$/, inp), "priority under Inputs advanced");
});

await t("manual hires: add week × heads rows through the UI", () => {
  const wf = openAdv("Workforce"); // toggles closed…
  const wf2 = famSec("Workforce");
  const addBtn = $$("button", wf2).find((b) => b.textContent === "+ Hire") || ($$("button", openAdv("Workforce")).find((b) => b.textContent === "+ Hire"));
  ok(addBtn, "+ Hire button");
  click(addBtn);
  setV(byLabel(/hire 1 week/), 10);
  setV(byLabel(/hire 1 heads/), 5);
  eq(byLabel(/hire 1 week/).value, "10", "hire week persisted");
  eq(byLabel(/hire 1 heads/).value, "5", "hire heads persisted");
  click(byLabel(/hire 1 week/) && $$("button", famSec("Workforce")).find((b) => (b.getAttribute("aria-label") || "") === "remove hire 1"));
  ok(!byLabel(/hire 1 week/), "hire row removable");
});

await t("digital queues swap to SLA fields and expose subtype + backlog in advanced", () => {
  openQueue("Case — Applications");
  ok(byLabel(/SLA within/), "digital SLA fields");
  ok(!byLabel(/^ASA target/), "no voice fields on a digital queue");
  const inp = openAdv("Inputs");
  ok(byLabel(/^Subtype$/, inp), "subtype select");
  ok(byLabel(/Backlog limit/, inp), "backlog limit");
  ok(byLabel(/Concurrency/, inp), "concurrency");
});

await t("rename + home reassignment reflect in the master list live", () => {
  openQueue("Inbound — Billing");
  setV(byLabel(/^Queue name$/), "Inbound — Billing & Payments");
  ok(qRow("Inbound — Billing & Payments"), "rename reflects");
  setV(byLabel(/^Home brand$/), "");
  ok($$(".mdgroup").some((g) => /Global — no home/.test($(".mdgrouplab", g).textContent) && /Billing & Payments/.test(g.textContent)), "moved to the Global group");
  setV(byLabel(/^Home brand$/), "b_acme");
  setV(byLabel(/^Queue name$/), "Inbound — Billing");
});

await t("guarded delete: a routed queue shows in-use; a fresh queue deletes; reset clears the dot", () => {
  openQueue("Inbound — Billing");
  ok(/▲ in use/.test(detail().textContent), "in-use marker instead of delete");
  click($$(".btn").find((b) => b.textContent === "+ Queue"));
  ok(qRow("New queue"), "queue added");
  ok(/not active/.test(qRow("New queue").textContent), "flagged not active");
  click($$(".btn", detail()).find((b) => b.textContent === "Delete"));
  ok(!qRow("New queue"), "fresh queue deleted");
  openQueue("Inbound — Billing");
  click($$(".btn", detail()).find((b) => b.textContent === "Reset to defaults"));
  ok(!qRow("Inbound — Billing").querySelector(".moddot"), "reset clears the modified dot");
});

await t("shared capacity is a QUEUE TYPE, not a separate concept", () => {
  // Several processes routing through one shared-capacity queue is how a single
  // pool serves many journeys — the job the old service teams did.
  const Ops2 = require("../model/ops.js");
  const { domainToEngineConfig } = require("../model/bridge.js");
  const E2 = require("../engine/engine.js");
  let m = Ops2.sampleDomainModel();
  const ec = { ...E2.makeDefaultConfig() }; delete ec.queues; ec.serviceTeams = [];
  m.engineConfig = ec;
  m = Ops2.addQueue(m, { id: "q_flex", name: "Flex pool", type: "shared_capacity", fallbackAhtSec: 300 });
  // BOTH processes route through it — one pool, many journeys.
  m = Ops2.addProcessStep(m, "proc_billing_voice", { queueId: "q_flex", splitPct: 20 });
  m = Ops2.addProcessStep(m, "proc_newcard_digital", { queueId: "q_flex", splitPct: 15 });
  const { processUsage } = Ops2;
  const cfg = domainToEngineConfig(m);
  const fq = cfg.queues.find((x) => x.id === "q_flex");
  ok(fq, "reaches the engine as a queue");
  eq(fq.resourcing, "leveraged", "and as leveraged resourcing — it lends hours rather than being sized on its own SLA");
  ok(fq.dailyVolume > 0, "fed by both processes: " + Math.round(fq.dailyVolume));
  let threw = null;
  try { E2.simulate(cfg, { strategy: "S1", viewIds: [] }); } catch (e) { threw = e.message; }
  ok(!threw, "simulates: " + threw);
});

await t("a shared-capacity queue is marked in the list and offered as a type", () => {
  const c = document.createElement("div"); document.body.appendChild(c);
  const Ops2 = require("../model/ops.js");
  let m = Ops2.addQueue(Ops2.sampleDomainModel(), { id: "q_flex", name: "Flex pool", type: "shared_capacity" });
  act(() => { mod.exports.mount(c, { model: m }); });
  subtab("Queues", c);
  const row = $$(".tickethead", c).find((r) => /Flex pool/.test(r.textContent));
  ok(row, "listed among the queues, not in a separate group");
  ok(row.closest(".ticket").classList.contains("shared-cap"), "visually distinguished");
  ok(/lends capacity/.test(row.textContent), "reads as lending, not receiving: " + row.textContent);
  click(row);
  const typeSel = $$("select", $('[data-testid="queue-detail"]', c)).find((x) => x.getAttribute("aria-label") === "Queue type");
  ok([...typeSel.options].some((o) => o.value === "shared_capacity"), "shared capacity is a selectable queue type");
  eq(typeSel.value, "shared_capacity", "and is the type on this queue");
  c.remove();
});

await t("S4 END-TO-END: hires authored in the domain model reach the engine and raise staffing", () => {
  let m = Ops.sampleDomainModel();
  const ec = { ...E.makeDefaultConfig() };
  delete ec.queues;
  m.engineConfig = ec;
  m = Ops.updateQueueStaffing(m, "q_inbound", {
    fte: 40,
    wf: { attrition: 0, attritionGrowth: 0, reqToStart: 2, trainingWeeks: 2, learningCurve: [1], hires: [{ week: 10, heads: 12 }] },
  });
  const cfg = domainToEngineConfig(m);
  const qc = cfg.queues.find((x) => x.id === "q_inbound");
  eq(qc.wf.hires.length, 1, "hires carried to the engine config");
  const sim = E.simulate(cfg, { strategy: "S4", viewIds: [] });
  const before = sim.weeks[8].queues.q_inbound.trained;
  const after = sim.weeks[20].queues.q_inbound.trained;
  ok(after > before + 6, `S4 trained staffing rises after the planned hire: wk9 ${before} → wk21 ${after}`);
});

await t("zero unexpected console output across the whole run", () => {
  eq(consoleEvents.length, 0, "console noise: " + consoleEvents.join(" | "));
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("\nFAILURES:\n" + failures.map((f) => "  - " + f).join("\n")); process.exit(1); }
console.log("U4 / QUEUES GATE: GREEN");
}
main().catch((e) => { console.error(e); process.exit(1); });
