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
// Navigation is the tab strip; selecting is idempotent so a test returning to
// a tab does not toggle anything. (Drawers live INSIDE each tab.)
function subtab(label, r) {
  const b = $$(".subtabs button", r).find((x) => x.textContent.includes(label));
  if (b && b.getAttribute("aria-selected") !== "true") click(b);
  return b;
}

console.log("Setup shell gate — BUILD-PLAN U1");

async function main() {
await t("mounts with zero console noise; seven tabs in dependency order", () => {
  act(() => { new Function("module", "exports", "require", "__dirname", "__filename", built.outputFiles[0].text)(mod, mod.exports, require, path.join(__dirname, "../ui/v2"), path.join(__dirname, "../ui/v2/setup-v3-main.jsx")); });
  ok(document.getElementById("root").children.length > 0, "rendered");
  const labels = $$(".subtabs button").map((b) => b.textContent.replace(/[●▲✕]/g, "").trim());
  eq(labels.join(" | "), "Structure | Queues | Processes | Request types | Volume | Map | Defaults", "tab order");
  eq(consoleEvents.length, 0, "mount noise: " + consoleEvents.join(" | "));
});

await t("each tab explains what it is for, across the top", () => {
  const note = $('[data-testid="tab-note"]');
  ok(note, "an explanation line is shown for the active tab");
  ok(/vocabulary of the estate/.test(note.textContent), "Structure explained: " + note.textContent.slice(0, 60));
  subtab("Volume");
  ok(/authoritative beneath/.test($('[data-testid="tab-note"]').textContent), "the explanation follows the tab");
  subtab("Structure");
});

await t("the sample model is complete: no attention markers, no progress strip", () => {
  eq($$(".subtabs .glyph").length, 0, "no glyphs when everything checks out");
  ok(!$(".pstrip"), "the strip only appears while incomplete");
});

await t("the options WITHIN a tab are drawers, each with an information hover", () => {
  subtab("Structure");
  const lists = $$(".reglist.drw");
  // Process groups moved to the Processes tab, so Structure holds four lists.
  eq(lists.length, 4, "the registry lists are drawers");
  eq(lists.filter((l) => l.classList.contains("open")).length, 1, "one open by default, the rest shut");
  const infos = $$(".reglist.drw .info");
  eq(infos.length, 4, "an info affordance on each");
  ok(infos.every((i) => (i.getAttribute("title") || "").length > 40), "each carries a real explanation");
  ok(infos.every((i) => i.getAttribute("aria-label") === i.getAttribute("title")), "and it is reachable non-visually");
  const products = lists.find((l) => $(".drwhead b", l).textContent === "Products");
  ok(!products.classList.contains("open"), "Products starts shut");
  click($(".drwhead", products));
  ok(products.classList.contains("open"), "clicking the header opens it");
  ok($(".drwhead", products).getAttribute("aria-expanded") === "true", "expanded state announced");
  click($(".drwhead", products));
  ok(!products.classList.contains("open"), "and shuts again");
});

await t("Defaults groups are drawers with hovers too", () => {
  subtab("Defaults");
  const groups = $$('[role="tabpanel"] .drw');
  ok(groups.length >= 6, "six global groups as drawers: " + groups.length);
  ok($$('[role="tabpanel"] .drw .info').length >= 6, "each explains itself");
});

await t("tab navigation switches panels (Structure → Queues → Map)", () => {
  subtab("Structure");
  eq($('[role="tabpanel"]').getAttribute("data-tab"), "structure", "starts on Structure");
  ok($$(".reglist").length === 4, "the registry lists");
  subtab("Queues");
  eq($('[role="tabpanel"]').getAttribute("data-tab"), "queues", "Queues panel shown");
  ok(subtab("Queues").getAttribute("aria-selected") === "true", "aria-selected moves");
  subtab("Map");
  ok(/No issues/.test($('[data-testid="validation-panel"]').textContent), "Map validation clean for the sample");
});

await t("Queues are tickets: name left, status right, opening in place", () => {
  subtab("Queues");
  const heads = $$(".tickethead");
  ok(heads.length >= 4, "one ticket per queue");
  ok(!$(".ticket.open"), "nothing expanded on arrival");
  const inbound = heads.find((r) => /Inbound — Billing/.test(r.textContent));
  // name on the left, status and headline figures on the right
  ok(/Inbound — Billing/.test($(".tname b", inbound).textContent), "name on the left");
  ok(/^active$/.test($(".tmeta .statusdot", inbound).textContent), "status on the right");
  ok(/2,398\/day/.test($(".tmeta .tsum", inbound).textContent.replace(/\s+/g, " ")), "headline figures on the right");
  ok($(".chev", inbound), "and its chevron");
  click(inbound);
  ok(inbound.closest(".ticket").classList.contains("open"), "opens in place — no side panel");
  ok(!$(".drawer.on"), "the slide-over is gone");
  const det = $('[data-testid="queue-detail"]');
  ok(det && inbound.closest(".ticket").contains(det), "the editor renders inside the ticket");
  const fams = $$(".famhead b", det).map((b) => b.textContent);
  eq(fams.join("|"), "Inputs|Performance|Efficiency|Workforce|Customer|Outputs", "settings live in six drawers");
  eq($$(".fam-sec.open", det).length, 1, "one drawer open by default");
  click(inbound);
  ok(!$(".ticket.open"), "clicking the head shuts it again");
});

await t("every drawer chevron sits on the right of its header", () => {
  // One rule pins them, so assert the rule rather than 30 call sites.
  const css = $("#capacity-v2-style").textContent;
  const shared = css.split("}").map((b) => b + "}").find((b) => /\.drwhead \.chev/.test(b) && /margin-left:auto/.test(b));
  ok(shared, "a shared rule pins the chevrons right");
  for (const sel of [".drwhead .chev", ".famhead .chev", ".sechead .chev", ".chdrw .chev"])
    ok(shared.includes(sel), sel + " covered by the shared rule — got: " + shared.trim());
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
  const p = $('[role="tabpanel"]');
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
  ok(subtab("Structure", c).textContent.includes("▲"), "Structure flagged on its tab");
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
