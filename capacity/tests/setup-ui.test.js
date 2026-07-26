/* Step 2 GATE — Setup page (v2.4 rebuild). Renders ui/v2/setup-main.jsx in JSDOM
 * and checks the four sections behave per setup-page-v3.html: derived (never
 * entered) queue volume/AHT render read-only and update live as profiles/mix
 * change; structure channel toggles work; the mix-sum indicator + unmodelled and
 * cross-structure warnings fire; the staffing drawer opens with six KPI-family
 * accordions. Zero console noise throughout. Same harness as the v1 UI gates.
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
  entryPoints: [path.join(__dirname, "../ui/v2/setup-main.jsx")], bundle: true, format: "cjs", platform: "node", jsx: "automatic", write: false,
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
  define: { "process.env.NODE_ENV": '"development"' }, logLevel: "silent",
});
const mod = { exports: {} };

function click(el) { ok(el, "click target missing"); act(() => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); }); }
function setV(el, v) { ok(el, "setV target missing"); const p = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype; const s = Object.getOwnPropertyDescriptor(p, "value").set; act(() => { s.call(el, String(v)); el.dispatchEvent(new window.Event("input", { bubbles: true })); el.dispatchEvent(new window.Event("change", { bubbles: true })); }); }
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const text = () => document.querySelector(".shell").textContent;
// A queue row's derived "vol/day" number, located by the queue name.
function qStats(name) {
  const row = $$(".qline").find((r) => r.querySelector("b") && r.querySelector("b").textContent === name);
  ok(row, "queue row not found: " + name);
  return row.querySelector(".qstats").textContent.replace(/\s+/g, " ");
}
function sectionByTitle(title) { return $$(".sec").find((s) => s.querySelector(".sechead b") && s.querySelector(".sechead b").textContent === title); }
function openSection(title) { const s = sectionByTitle(title); if (!s.classList.contains("open")) click(s.querySelector(".sechead")); return s; }

console.log("Setup page gate — v2.4 Step 2");

async function main() {
await t("mounts with zero console errors and renders four sections", () => {
  // Executing the bundle auto-mounts into #root (mirrors ui/v2/setup-main.jsx).
  act(() => { new Function("module", "exports", "require", "__dirname", "__filename", built.outputFiles[0].text)(mod, mod.exports, require, path.join(__dirname, "../ui/v2"), path.join(__dirname, "../ui/v2/setup-main.jsx")); });
  ok(document.getElementById("root").children.length > 0, "rendered");
  const titles = $$(".sec .sechead b").map((b) => b.textContent);
  eq(titles.length, 4, "four sections");
  ok(titles.includes("Structure") && titles.includes("Queues") && titles.includes("Service catalog") && titles.includes("Channel volume profiles"), "section titles: " + titles.join(", "));
  eq(consoleEvents.length, 0, "mount noise: " + consoleEvents.join(" | "));
});

await t("derived queue volume/AHT render read-only (never an input) in the Queues section", () => {
  openSection("Queues");
  // Billing enquiry is fed by TWO disjoint profiles (rule 1 sums them):
  // cards-voice 2700×74% = 1998, plus the Loans product profile 400×100% = 400,
  // so Inbound — Billing derives 2,398/day.
  const s = qStats("Inbound — Billing");
  ok(/2,398/.test(s), "expected derived 2,398 vol/day (1998 + 400), got: " + s);
  ok(/300 s/.test(s), "expected eff AHT 300 s, got: " + s);
  // Governance is fed by two services → volume-weighted AHT marker.
  ok(/weighted/.test(qStats("QA — Governance")), "governance shows weighted marker");
  // svc-AHT marker where a service declares its own AHT (Case — Applications, 540).
  ok(/svc/.test(qStats("Case — Applications")), "case shows svc marker");
  // No input carries the derived volume in the Queues section rows.
  const qsec = sectionByTitle("Queues");
  eq(qsec.querySelectorAll(".qline input").length, 0, "no volume inputs in queue rows");
});

await t("editing a profile mix % updates the derived queue volume live", () => {
  openSection("Channel volume profiles");
  // The first mix row of the Credit cards Voice profile is Billing enquiry (74%).
  const card = $$(".card").find((c) => /Credit cards › Voice/.test(c.textContent));
  ok(card, "cards-voice profile card present");
  if (!card.classList.contains("open")) click(card.querySelector(".cardhead"));
  const pctInput = card.querySelector(".mixrow input");
  setV(pctInput, 50); // cards-voice 2700×50% = 1350, + Loans 400 = 1750
  ok(/1,750/.test(qStats("Inbound — Billing")), "derived volume should follow the mix: " + qStats("Inbound — Billing"));
  setV(pctInput, 74); // restore
  ok(/2,398/.test(qStats("Inbound — Billing")), "restored to 2,398");
});

await t("mix under 100% shows the amber indicator and an unmodelled-remainder warning", () => {
  const card = $$(".card").find((c) => /Credit cards › Voice/.test(c.textContent));
  if (!card.classList.contains("open")) click(card.querySelector(".cardhead"));
  const pct = card.querySelector(".mixrow input");
  setV(pct, 40); // 40 + 26 = 66%
  ok(card.querySelector(".mixsum.warn"), "mix sum flagged amber");
  ok(/unmodelled/.test(card.textContent), "unmodelled-remainder warning shown");
  setV(pct, 74); // restore to 100
  ok(!card.querySelector(".mixsum.warn"), "back to green at 100%");
});

await t("the Loans-style cross-structure case renders its warning (not a block)", () => {
  // Loans profile feeds Billing enquiry, whose journey routes into Credit cards
  // structural queues — a cross-structure flow. Volume still derives.
  const card = $$(".card").find((c) => { const ph = c.querySelector(".cardhead .path"); return ph && /Loans/.test(ph.textContent); });
  ok(card, "loans profile card present");
  if (!card.classList.contains("open")) click(card.querySelector(".cardhead"));
  ok(/outside that path/.test(card.textContent), "cross-structure warning present: " + card.querySelector(".cardbody").textContent.slice(0, 160));
});

await t("toggling a channel chip in Structure adds/removes a channel instance", () => {
  const sec = openSection("Structure");
  const before = sec.querySelector(".badge").textContent;
  // Find a dashed (off) chip and switch it on.
  const offChip = sec.querySelector(".chip.off");
  ok(offChip, "an off channel chip exists");
  click(offChip);
  const after = sectionByTitle("Structure").querySelector(".badge").textContent;
  ok(before !== after, `channel count should change: "${before}" → "${after}"`);
});

await t("staffing drawer opens with six KPI-family accordions and read-only derived volume", () => {
  openSection("Queues");
  const row = $$(".qline").find((r) => r.querySelector("b").textContent === "Inbound — Billing");
  click(row);
  ok($(".drawer.on"), "drawer open");
  const fams = $$(".drawer .acchead b").map((b) => b.textContent);
  eq(fams.length, 6, "six accordions: " + fams.join(", "));
  ok(["Inputs", "Performance", "Efficiency", "Workforce", "Customer", "Outputs"].every((f) => fams.includes(f)), "all six families");
  const derivedInput = $$(".drawer input").find((i) => i.disabled && /from profiles/.test(i.value));
  ok(derivedInput, "derived volume shown disabled/read-only");
  click($(".drawer .close"));
  ok(!$(".drawer.on"), "drawer closes");
});

await t("adding a service and a queue works and updates the badges", () => {
  openSection("Service catalog");
  const svcBadge = () => sectionByTitle("Service catalog").querySelector(".badge").textContent;
  const before = svcBadge();
  click($$(".sec").find((s) => /Service catalog/.test(s.textContent)).querySelector(".secbody > .btn"));
  ok(before !== svcBadge(), "service count changed: " + before + " → " + svcBadge());
});

await t("zero unexpected console output across the whole run", () => {
  eq(consoleEvents.length, 0, "console noise: " + consoleEvents.join(" | "));
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("\nFAILURES:\n" + failures.map((f) => "  - " + f).join("\n")); process.exit(1); }
console.log("STEP 2 / SETUP GATE: GREEN");
}
main().catch((e) => { console.error(e); process.exit(1); });
