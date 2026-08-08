/* U7 GATE — the Processes tab (domain model v1.3). A process is a SHARED,
 * reusable definition: a channel-specific journey through queues ending in a
 * declared outcome, defined once here and attached to any number of request
 * types. Process groups live here too. The load-bearing assertion is reuse:
 * attaching one process to a second request type creates NO new definition,
 * and editing it moves the derived volume for BOTH. Zero console noise.
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
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
function subtab(label, r) {
  const b = $$(".subtabs button", r).find((x) => x.textContent.includes(label));
  if (b && b.getAttribute("aria-selected") !== "true") click(b);
  return b;
}
const procRow = (name, r) => $$(".mdlist button", r).find((x) => x.textContent.includes(name));
const byLabel = (re, r) => $$("input,select", r).find((i) => re.test(i.getAttribute("aria-label") || ""));
const qVol = (name) => {
  const row = $$(".mdlist button").find((r) => r.textContent.includes(name));
  ok(row, "queue row not found: " + name);
  return +row.textContent.replace(/\s+/g, " ").match(/([\d,]+)\/day/)[1].replace(/,/g, "");
};

console.log("Processes tab gate — domain model v1.3");

async function main() {
await t("mounts; processes are listed with their channel, steps and reuse count", () => {
  act(() => { new Function("module", "exports", "require", "__dirname", "__filename", built.outputFiles[0].text)(mod, mod.exports, require, path.join(__dirname, "../ui/v2"), path.join(__dirname, "../ui/v2/setup-v3-main.jsx")); });
  subtab("Processes");
  const rows = $$(".mdlist button");
  eq(rows.length, 2, "two sample processes");
  const billing = procRow("Billing enquiry — Voice");
  ok(/Voice/.test(billing.textContent), "channel shown");
  ok(/2 steps/.test(billing.textContent), "step count shown");
  ok(/used by 1 request type/.test(billing.textContent), "reuse count shown");
  eq(consoleEvents.length, 0, "mount noise: " + consoleEvents.join(" | "));
});

await t("process groups are managed here, not in Structure", () => {
  const panel = $('[role="tabpanel"]');
  const groups = $$(".drw", panel).find((d) => $(".drwhead b", d).textContent === "Process groups");
  ok(groups, "a Process groups drawer on this tab");
  click($(".drwhead", groups));
  ok($$(".regrow", groups).length >= 2, "the sample groups are listed");
  ok($(".info", groups), "with an information hover");
});

await t("a process opens in a drawer and its steps are editable there", () => {
  click(procRow("New card — Digital"));
  ok($(".drawer.on"), "drawer opens");
  const det = $('[data-testid="process-detail"]');
  ok(det, "process detail rendered");
  eq(byLabel(/^Process name$/, det).value, "New card — Digital", "name loaded");
  eq(byLabel(/^Process channel$/, det).value, "ch_digital", "channel loaded");
  const split = $$("input", det).find((i) => /step 2 split percent/.test(i.getAttribute("aria-label") || ""));
  eq(split.value, "60", "the verification split is editable here");
  click($(".drawer .close"));
  ok(!$(".drawer.on"), "closes");
});

await t("THE REUSE PROOF: one definition, two request types, one edit moves both", () => {
  const c = document.createElement("div"); document.body.appendChild(c);
  // A second request type in the same estate, sharing the billing voice process.
  let m = Ops.sampleDomainModel();
  m = Ops.addRequestType(m, { id: "rt_dispute", name: "Billing dispute", groupId: "pg_cards" });
  m = Ops.setAssignment(m, "rt_dispute", { brandIds: ["b_acme"], buIds: ["bu_cs"] });
  m = Ops.setVolumeEntry(m, { brandId: "b_acme", buId: "bu_cs", requestTypeId: "rt_dispute" }, { daily: 600 });
  act(() => { mod.exports.mount(c, { model: m }); });

  // Attach the EXISTING process from the request type — no new definition.
  subtab("Request types", c);
  click($$(".rtrow", c).find((r) => /Billing dispute/.test(r.textContent)));
  const pick = byLabel(/Attach an existing process/, $('[data-testid="rt-detail"]', c));
  ok(pick, "an attach-existing picker is offered");
  ok([...pick.options].some((o) => /Billing enquiry — Voice/.test(o.textContent)), "the existing process is offered for reuse");
  setV(pick, "proc_billing_voice");
  click($$("button", $('[data-testid="rt-detail"]', c)).find((b) => b.textContent === "Attach"));

  subtab("Processes", c);
  eq($$(".mdlist button", c).length, 2, "still two definitions — attaching reused one, it did not copy");
  ok(/used by 2 request types/.test(procRow("Billing enquiry — Voice", c).textContent), "reuse count reflects both");

  // Both request types now feed q_inbound: 2,398 + 600.
  subtab("Queues", c);
  const inboundRow = $$(".mdlist button", c).find((r) => /Inbound — Billing/.test(r.textContent));
  ok(/2,998\/day/.test(inboundRow.textContent.replace(/\s+/g, " ")),
    "the shared process routes BOTH request types' volume: " + inboundRow.textContent);

  // One edit to the shared definition changes what both contribute.
  subtab("Processes", c);
  click(procRow("Billing enquiry — Voice", c));
  const det = $('[data-testid="process-detail"]', c);
  ok(/Shared by 2 request types/.test(det.textContent), "the drawer warns that the edit is felt by both");
  const entry = $$("input", det).find((i) => /step 1 split percent/.test(i.getAttribute("aria-label") || ""));
  setV(entry, 50);
  subtab("Queues", c);
  const after = $$(".mdlist button", c).find((r) => /Inbound — Billing/.test(r.textContent));
  ok(/1,499\/day/.test(after.textContent.replace(/\s+/g, " ")),
    "halving the shared entry step halved BOTH: " + after.textContent);
  c.remove();
});

await t("detaching from one request type leaves the definition and the other user intact", () => {
  const c = document.createElement("div"); document.body.appendChild(c);
  let m = Ops.sampleDomainModel();
  m = Ops.addRequestType(m, { id: "rt_dispute", name: "Billing dispute", groupId: "pg_cards" });
  m = Ops.setAssignment(m, "rt_dispute", { brandIds: ["b_acme"], buIds: ["bu_cs"] });
  m = Ops.attachProcess(m, "rt_dispute", "proc_billing_voice");
  act(() => { mod.exports.mount(c, { model: m }); });
  subtab("Request types", c);
  click($$(".rtrow", c).find((r) => /Billing dispute/.test(r.textContent)));
  const proc = $('[data-testid="process-rt_dispute-ch_voice"]', c);
  ok(proc, "the shared process shows under the request type");
  ok(/shared with 1 other request type/.test(proc.textContent), "and says it is shared");
  click($(".prochead .regdel", proc));      // arms — it has steps
  click($(".prochead .btn.danger", proc));  // commits the detach
  ok(!$('[data-testid="process-rt_dispute-ch_voice"]', c), "detached from this request type");
  subtab("Processes", c);
  eq($$(".mdlist button", c).length, 2, "the definition survives");
  ok(/used by 1 request type/.test(procRow("Billing enquiry — Voice", c).textContent), "still used by the original");
  c.remove();
});

await t("creating a process here leaves it unattached until a request type takes it", () => {
  const c = document.createElement("div"); document.body.appendChild(c);
  act(() => { mod.exports.mount(c, { model: Ops.sampleDomainModel() }); });
  subtab("Processes", c);
  click($$(".btn", c).find((b) => b.textContent === "+ Process"));
  const row = procRow("New process", c);
  ok(row, "created and listed");
  ok(/not attached yet/.test(row.textContent), "explicitly unattached");
  ok(/✕/.test(row.textContent), "flagged incomplete — it routes nowhere yet");
  ok(subtab("Processes", c).textContent.includes("▲"), "and the tab flags it");
  c.remove();
});

await t("zero unexpected console output across the whole run", () => {
  eq(consoleEvents.length, 0, "console noise: " + consoleEvents.join(" | "));
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("\nFAILURES:\n" + failures.map((f) => "  - " + f).join("\n")); process.exit(1); }
console.log("U7 / PROCESSES GATE: GREEN");
}
main().catch((e) => { console.error(e); process.exit(1); });
