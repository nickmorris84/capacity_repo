/* U2 GATE — the Structure tab (BUILD-PLAN U2). The registry per REVIEW-SETUP
 * §3.1: five flat lists with add · rename (propagates by id) · delete guarded
 * with dependents summarised (V6); channels enable from the taxonomy and carry
 * channel defaults (globals category B). Zero console noise throughout.
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

function click(el) { ok(el, "click target missing"); act(() => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); }); }
function setV(el, v) { ok(el, "setV target missing"); const p = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype; const s = Object.getOwnPropertyDescriptor(p, "value").set; act(() => { s.call(el, String(v)); el.dispatchEvent(new window.Event("input", { bubbles: true })); el.dispatchEvent(new window.Event("change", { bubbles: true })); }); }
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
const reglist = (title) => $$(".reglist").find((l) => $(".reghead b", l).textContent === title);

console.log("Structure tab gate — BUILD-PLAN U2");

async function main() {
await t("mounts on Structure with five editable lists and add buttons", () => {
  act(() => { new Function("module", "exports", "require", "__dirname", "__filename", built.outputFiles[0].text)(mod, mod.exports, require, path.join(__dirname, "../ui/v2"), path.join(__dirname, "../ui/v2/setup-v3-main.jsx")); });
  subtab("Structure"); // segments are drawers — open it first
  eq($$(".reglist").length, 5, "five lists");
  ok(reglist("Brands") && reglist("Business units") && reglist("Channels") && reglist("Process groups") && reglist("Products"), "all five titled");
  ok($(".btn", reglist("Brands")), "Brands has an add button");
  eq(consoleEvents.length, 0, "mount noise: " + consoleEvents.join(" | "));
});

await t("add: + Brand appends a row and the list count moves", () => {
  const countBefore = $(".reghead .count", reglist("Brands")).textContent;
  click($(".btn", reglist("Brands")));
  const rows = $$(".regrow", reglist("Brands"));
  eq(rows.length, 2, "two brand rows");
  ok($$("input", reglist("Brands")).some((i) => i.value === "New brand"), "seeded name");
  ok($(".reghead .count", reglist("Brands")).textContent !== countBefore, "list count moved");
});

await t("rename propagates by id: renaming Acme shows up in Request types' assignment", () => {
  const acme = $$(".regrow input", reglist("Brands")).find((i) => i.value === "Acme");
  setV(acme, "Acme Bank");
  subtab("Request types");
  ok(/Acme Bank/.test($(".sec.open .secbody").textContent), "assignment line shows the new name");
  subtab("Structure");
});

await t("delete guard (V6): a referenced brand shows the dependents, an unused one deletes", () => {
  const brands = reglist("Brands");
  const acmeRow = $$(".regrow", brands).find((r) => $("input", r).value === "Acme Bank");
  ok(!$(".regdel", acmeRow), "no live delete on a referenced brand");
  ok(/in use/.test(acmeRow.textContent), "blocked marker shown");
  ok(/2 request types/.test(acmeRow.textContent) && /3 queues/.test(acmeRow.textContent) && /2 volume entries/.test(acmeRow.textContent),
    "dependents summarised: " + acmeRow.textContent);
  const newRow = $$(".regrow", reglist("Brands")).find((r) => $("input", r).value === "New brand");
  click($(".regdel", newRow));
  eq($$(".regrow", reglist("Brands")).length, 1, "unused brand deleted");
});

await t("channels enable from the taxonomy: two off chips, enabling Third party adds a row", () => {
  const ch = reglist("Channels");
  eq($$(".regrow", ch).length, 2, "sample has Voice + Digital");
  const offs = $$(".chip.off", ch).map((b) => b.textContent.trim());
  eq(offs.join(" | "), "+ Third party | + Customer management", "taxonomy remainder offered");
  click($$(".chip.off", ch).find((b) => /Third party/.test(b.textContent)));
  eq($$(".regrow", reglist("Channels")).length, 3, "Third party enabled");
  ok($$(".chip.off", reglist("Channels")).length === 1, "one off chip left");
});

await t("a used channel blocks delete; the unused one deletes cleanly", () => {
  const ch = reglist("Channels");
  const voice = $$(".regrow", ch).find((r) => $("input", r).value === "Voice");
  ok(/in use — 1 request type/.test(voice.textContent), "Voice blocked by rt_billing: " + voice.textContent);
  const third = $$(".regrow", ch).find((r) => $("input", r).value === "Third party");
  click($(".regdel", third));
  eq($$(".regrow", reglist("Channels")).length, 2, "unused channel deleted");
});

await t("channel defaults edit and persist: set Voice ASA to 20, reopen, still 20", () => {
  const voice = () => $$(".regrow", reglist("Channels")).find((r) => $("input", r).value === "Voice");
  click($$("button", voice()).find((b) => /defaults/.test(b.textContent)));
  const panel = $('[data-testid="channel-defaults-voice"]');
  ok(panel, "defaults panel open");
  const asa = $$(".field", panel).find((f) => /ASA target/.test(f.textContent)).querySelector("input");
  setV(asa, 20);
  const slaPct = $$(".field", $('[data-testid="channel-defaults-voice"]')).find((f) => /SLA target/.test(f.textContent)).querySelector("input");
  setV(slaPct, 80);
  // close and reopen — the values live on the model, not the component
  click($$("button", voice()).find((b) => /defaults/.test(b.textContent)));
  ok(!$('[data-testid="channel-defaults-voice"]'), "panel closed");
  ok(/defaults ●/.test(voice().textContent), "defaults-set marker on the row");
  click($$("button", voice()).find((b) => /defaults/.test(b.textContent)));
  const again = $('[data-testid="channel-defaults-voice"]');
  eq($$(".field", again).find((f) => /ASA target/.test(f.textContent)).querySelector("input").value, "20", "ASA persisted");
  eq($$(".field", again).find((f) => /SLA target/.test(f.textContent)).querySelector("input").value, "80", "SLA % persisted (stored as a fraction)");
});

await t("business units / groups / products add and rename like brands", () => {
  click($(".btn", reglist("Process groups")));
  ok($$(".regrow input", reglist("Process groups")).some((i) => i.value === "New group"), "group added");
  const g = $$(".regrow input", reglist("Process groups")).find((i) => i.value === "New group");
  setV(g, "Disputes");
  ok($$(".regrow input", reglist("Process groups")).some((i) => i.value === "Disputes"), "group renamed");
  const bu = reglist("Business units");
  ok(/in use/.test($$(".regrow", bu)[0].textContent), "sample BU referenced → blocked");
});

await t("a new estate carries every default channel, ready to use", () => {
  const c = document.createElement("div"); document.body.appendChild(c);
  const Ops = require("../model/ops.js");
  act(() => { mod.exports.mount(c, { model: Ops.blankDomainModel() }); });
  subtab("Structure", c);
  const ch = $$(".reglist", c).find((l) => $(".reghead b", l).textContent === "Channels");
  eq($$(".regrow", ch).length, 4, "all four taxonomy channels seeded");
  const names = $$(".regrow input", ch).map((i) => i.value).sort();
  eq(names.join(", "), "Customer management, Digital, Third party, Voice", "named, not raw keys");
  c.remove();
});

await t("channels beyond the taxonomy can be added and behave like the rest", () => {
  const ch = () => reglist("Channels");
  const before = $$(".regrow", ch()).length;
  const input = $$("input", ch()).find((i) => i.getAttribute("aria-label") === "New channel name");
  ok(input, "an add-a-channel field exists");
  const addBtn = () => $$("button", ch()).find((b) => b.textContent === "Add");
  ok(addBtn().disabled, "Add is inert until the channel is named");
  setV(input, "WhatsApp");
  click(addBtn());
  eq($$(".regrow", ch()).length, before + 1, "custom channel added");
  const row = $$(".regrow", ch()).find((r) => $("input", r).value === "WhatsApp");
  ok(row, "listed by name");
  ok(/custom/.test(row.textContent), "marked custom, not a raw key");
  // it is a first-class channel: renameable, deletable while unused, and it
  // carries its own channel defaults like any taxonomy channel
  ok($(".regdel", row), "deletable while unused");
  ok($$("button", row).some((b) => /defaults/.test(b.textContent)), "carries channel defaults");
  setV($("input", row), "WhatsApp Business");
  ok($$(".regrow input", ch()).some((i) => i.value === "WhatsApp Business"), "renames like the rest");
});

await t("zero unexpected console output across the whole run", () => {
  eq(consoleEvents.length, 0, "console noise: " + consoleEvents.join(" | "));
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("\nFAILURES:\n" + failures.map((f) => "  - " + f).join("\n")); process.exit(1); }
console.log("U2 / STRUCTURE GATE: GREEN");
}
main().catch((e) => { console.error(e); process.exit(1); });
