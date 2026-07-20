/* R3c gate — batched polish + defects (seven numbered items). Renders the source
   app in JSDOM and asserts each item's acceptance check:
     1. Brand assignment — a brand created in Settings is selectable on a queue and
        the queue files under it in the Queues grouping AND the Summary rollup.
     2. Hierarchy — the Summary queue table and the Plan hiring table both carry
        brand + channel subtotal rows (shared grouping).
     3. Holistic weekly table — 52 week rows; a chip toggle recomputes a week total.
     4. Data tab — a volume input cell edits + moves simulated coverage; an outcome
        cell rejects input; a segment colour persists through a re-render.
     5. Scenario targeting — no scenario-add control inside a queue card; a group
        targeting one queue shows in that queue's read-only accordion.
     6. Libraries — editing a preset's month in Settings moves a queue that uses it.
     7. Channels — a channel created from the Digital Workflow preset has no
        concurrency field + an hours SLA; a queue attached to it inherits those.
   Zero console noise throughout. */
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
window.requestAnimationFrame = global.requestAnimationFrame; window.cancelAnimationFrame = global.cancelAnimationFrame;
window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }; global.ResizeObserver = window.ResizeObserver;
global.localStorage = window.localStorage;
Object.defineProperty(window.HTMLElement.prototype, "clientWidth", { configurable: true, get() { return 640; } });
global.IS_REACT_ACT_ENVIRONMENT = true;
window.print = () => {};
if (!window.URL.createObjectURL) window.URL.createObjectURL = () => "blob:m";
global.URL = window.URL; global.Blob = window.Blob; global.File = window.File; global.FileReader = window.FileReader;

const consoleEvents = [];
["error", "warn"].forEach((k) => { const o = console[k]; console[k] = (...a) => { consoleEvents.push(k + ": " + a.map(String).join(" ")); o.apply(console, a); }; });

const React = require("react"); const { act } = React;
const built = esbuild.buildSync({
  entryPoints: [path.join(__dirname, "../ui/main.jsx")], bundle: true, format: "cjs", platform: "node", jsx: "automatic", write: false,
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "recharts", "xlsx"],
  define: { "process.env.NODE_ENV": '"development"' }, logLevel: "silent",
});

t("app mounts with zero console errors", () => {
  const mod = { exports: {} };
  act(() => { new Function("module", "exports", "require", "__dirname", "__filename", built.outputFiles[0].text)(mod, mod.exports, require, path.join(__dirname, "../ui"), path.join(__dirname, "../ui/main.jsx")); });
  ok(document.getElementById("root").children.length > 0, "rendered");
  eq(consoleEvents.length, 0, "mount noise: " + consoleEvents.join(" | "));
});

function click(el) { ok(el, "click target missing"); act(() => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); }); }
function setV(el, v) { ok(el, "setV target missing"); const p = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype; const s = Object.getOwnPropertyDescriptor(p, "value").set; act(() => { s.call(el, String(v)); el.dispatchEvent(new window.Event("input", { bubbles: true })); el.dispatchEvent(new window.Event("change", { bubbles: true })); }); }
async function settle(ms = 250) { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); }
const tabByLabel = (l) => [...document.querySelectorAll('[role="tab"]')].find((x) => x.textContent === l);
const goto = async (l) => { click(tabByLabel(l)); await settle(90); };
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const gid = (id) => document.getElementById(id);
const openCard = (card) => { if (!card) return; card.setAttribute("open", ""); card.querySelectorAll("details.acc-sec").forEach((d) => d.setAttribute("open", "")); };

async function run() {
  await settle(400);
  // R4 §26.1: the app opens on the landing — open the bootstrap simulation.
  click($('[data-testid^="sim-open-"]'));
  await settle(400);

  await t("1 — a brand created in Settings takes a queue in the grouping and the Summary rollup", async () => {
    await goto("Simulation Settings");
    click($('#panel-settings [data-testid="add-brand"]')); await settle(150);
    await goto("Queues");
    // add a queue, then assign it to the new brand via its own selector
    const before = new Set($$('[id^="queue-brand-"]').map((s) => s.id));
    click([...$$("#panel-queues .btnbar button")].find((b) => /Add queue/.test(b.textContent))); await settle(120);
    const newSel = $$('[id^="queue-brand-"]').find((s) => !before.has(s.id));
    ok(newSel, "the new queue exposes a brand selector");
    const newBrandId = [...newSel.options].map((o) => o.value).find((v) => v !== "b1");
    ok(newBrandId, "the new brand is selectable on the queue");
    setV(newSel, newBrandId); await settle(200);
    ok($(`#panel-queues [data-testid="brand-section-${newBrandId}"] details.erow`), "the queue renders under the new brand in the Queues grouping");
    await goto("Summary");
    ok($(`[data-testid="queue-summary"] [data-testid="hier-brand-${newBrandId}"]`), "the new brand appears as a subtotal row in the Summary rollup");
  });

  await t("2 — Summary and Plan tables carry brand and channel subtotal rows", async () => {
    await goto("Summary");
    const qs = $('[data-testid="queue-summary"]');
    ok(qs.querySelector('[data-testid^="hier-brand-"]'), "Summary has a brand subtotal row");
    ok(qs.querySelector('[data-testid^="hier-chan-"]'), "Summary has a channel subtotal row");
    await goto("Plan");
    const hs = $('[data-testid="hiring-summary"]');
    ok(hs.querySelector('[data-testid^="hier-brand-"]'), "Plan hiring summary has a brand subtotal row");
    ok(hs.querySelector('[data-testid^="hier-chan-"]'), "Plan hiring summary has a channel subtotal row");
  });

  await t("3 — the holistic weekly table renders 52 rows and a chip toggle recomputes a week total", async () => {
    await goto("Plan");
    const rows = () => $$('[data-testid="holo-weekly-table"] [data-testid="holo-weekly-row"]').length;
    eq(rows(), 52, "one row per week across the horizon");
    const wk1 = () => $('[data-testid="holo-wk1-cap"]').textContent;
    const before = wk1();
    const chip = $('[data-testid^="holo-chip-"]');
    ok(chip, "queue chips present");
    click(chip); await settle(90);
    ok(wk1() !== before, `toggling a queue recomputes the weekly total (${before} → ${wk1()})`);
    click($('[data-testid^="holo-chip-"]')); await settle(60); // restore
  });

  await t("4 — a volume cell edits + moves coverage; an outcome cell rejects input; a colour persists", async () => {
    await goto("Data");
    const covCell = () => $('[data-testid="cell-cover-10"]');
    ok(covCell(), "coverage cell for week 10 present");
    const covBefore = covCell().textContent;
    // outcome cell rejects input — it is read-only text, no editable input inside it
    ok(covCell().getAttribute("data-ro") === "1" && !covCell().querySelector("input"), "an outcome cell is read-only (no input)");
    const volCell = $('[data-testid="cell-vol-10"]');
    ok(volCell && volCell.tagName === "INPUT", "the volume cell is an editable input");
    setV(volCell, 22000); await settle(400);
    ok($('[data-testid="cell-cover-10"]').textContent !== covBefore, `editing the volume moved week-10 coverage (${covBefore} → ${$('[data-testid="cell-cover-10"]').textContent})`);
    // colour persists through a re-render
    const money = $('[data-testid="data-colour-Money"]');
    ok(money, "a per-segment colour picker is present");
    setV(money, "#123456"); await settle(80);
    await goto("Plan"); await goto("Data"); // force a re-render
    eq($('[data-testid="data-colour-Money"]').value, "#123456", "the colour choice persisted");
  });

  await t("5 — no scenario-add control in a queue card; a targeted group shows in its read-only accordion", async () => {
    await goto("Queues");
    const card = $("#panel-queues details.erow"); openCard(card); await settle(40);
    ok(!card.querySelector('[data-testid="add-group"], [data-testid^="add-factor-"]'), "no scenario-add control inside the queue card");
    ok(card.querySelector('[data-testid="q-scenarios-readonly"], .note'), "the queue card carries the read-only scenarios accordion");
    // create a group targeting the first queue, add a factor, and confirm it surfaces read-only on that queue
    await goto("Scenarios");
    click($('#panel-scenarios [data-testid="add-group"]')); await settle(120);
    click($('#panel-scenarios [data-testid="scope-queue-q_bill"]')); await settle(80);
    const addFactor = [...$$('#panel-scenarios [data-testid^="add-factor-"]')].pop();
    click(addFactor); await settle(120);
    await goto("Queues");
    const first = $("#panel-queues details.erow"); openCard(first); await settle(60);
    const ro = first.querySelector('[data-testid="q-scenarios-readonly"]');
    ok(ro, "the targeted group surfaces in the queue's read-only accordion");
    ok(/factor|New factor|group/i.test(ro.textContent), "the read-only accordion lists the targeting group/factor");
  });

  await t("6 — editing a preset's month in Settings moves a queue that uses it", async () => {
    await goto("Simulation Settings");
    setV($('[data-testid="preset-new-seasonality"]'), "R3c pattern");
    click($('[data-testid="preset-add-seasonality"]')); await settle(120);
    // both libraries render preset-item-* — pick the seasonality one by its name
    const item = $$('[data-testid^="preset-item-"]').find((r) => { const inp = r.querySelector('input[aria-label="Pattern name"]'); return inp && inp.value === "R3c pattern"; });
    ok(item, "the new seasonality pattern appears in the library");
    const pid = item.getAttribute("data-testid").slice("preset-item-".length);
    // link the pattern to the system seasonality (every queue then uses it)
    await goto("Queues");
    setV(gid("system-seasonality-apply"), pid); await settle(350);
    await goto("Data");
    const cov = () => $('[data-testid="cell-cover-1"]').textContent;
    const before = cov();
    // now edit January of that pattern in Settings — a live-linked queue must move
    await goto("Simulation Settings");
    setV(gid("preset-months-" + pid + "-0"), 400); await settle(400);
    await goto("Data");
    ok(cov() !== before, `the linked pattern edit re-simulated the queue (${before} → ${cov()})`);
  });

  await t("7 — a Digital Workflow channel has no concurrency + hours SLA; a queue attached inherits it", async () => {
    await goto("Simulation Settings");
    setV($('[data-testid="channel-name"]'), "Complaints");
    setV(gid("channel-preset"), "digitalWorkflow"); await settle(60);
    click($('[data-testid="add-channel"]')); await settle(200);
    const rows = $$('#panel-settings [data-testid^="chdef-ch_"]');
    const row = rows.find((r) => { const inp = r.querySelector('input[aria-label="Channel name"]'); return inp && inp.value === "Complaints"; });
    ok(row, "the Complaints channel was created");
    const cid = row.getAttribute("data-testid").slice("chdef-".length);
    ok(gid("chdef-" + cid + "-slahours"), "the channel template carries an hours-based SLA");
    ok(!gid("chdef-" + cid + "-concurrency"), "the channel template carries no concurrency field");
    // attach a digital-customer queue (which starts WITH concurrency) to the channel
    await goto("Queues");
    ok(gid("q-concurrency-q_wapp"), "the digital-customer queue starts with a concurrency field");
    setV(gid("queue-channel-q_wapp"), cid); await settle(300);
    ok(gid("q-sla-hours-q_wapp"), "the attached queue inherits the hours SLA section");
    ok(!gid("q-concurrency-q_wapp"), "the attached queue no longer has a concurrency field");
  });

  await settle(700); // flush the debounced auto-save inside act
  await t("zero unexpected console errors/warnings across the R3c run", () => eq(consoleEvents.length, 0, "console: " + consoleEvents.slice(0, 8).join(" | ")));

  console.log("\n═══════════════════════════════════");
  console.log(`${pass} passed, ${fail} failed`);
  console.log(fail === 0 ? "R3c GATE: GREEN" : "R3c GATE: RED");
  if (fail > 0) { failures.forEach((x) => console.log("  - " + x)); process.exitCode = 1; }
}
run();
