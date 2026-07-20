/* R3d-B gate — SPEC §24/§25 UI: brand assignment (surgical per-brand Add-queue
   button + card brand dropdown that re-files everywhere), startup matrix
   persistence + auto-selection, and the §25 chat UI (patience input, abandonment
   in place of backlog on Digital Customer). Renders the source app in JSDOM.
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
const appMod = { exports: {} };

t("app mounts with zero console errors", () => {
  act(() => { new Function("module", "exports", "require", "__dirname", "__filename", built.outputFiles[0].text)(appMod, appMod.exports, require, path.join(__dirname, "../ui"), path.join(__dirname, "../ui/main.jsx")); });
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

// Mount a FRESH app instance into a new container (drives startup hydration from
// the current localStorage). Returns the container.
async function mountFresh(ms = 400) {
  const c = document.createElement("div");
  document.body.appendChild(c);
  act(() => { appMod.exports.mount(c); });
  await settle(ms);
  return c;
}
// bestCell replicated in plain JS (matches sim-set.bestCell) so the test knows
// which cell the app should auto-select.
function bestCell(cells) {
  let best = null;
  const better = (a, b) => {
    if (a.holds !== b.holds) return a.holds;
    if (a.holds) return a.allIn < b.allIn;
    if (a.redWeeks !== b.redWeeks) return a.redWeeks < b.redWeeks;
    return a.allIn < b.allIn;
  };
  for (const gid of Object.keys(cells)) for (const sid of Object.keys(cells[gid])) {
    const c = cells[gid][sid];
    const cand = { gid, sid, allIn: c.allIn, redWeeks: c.redWeeks, holds: c.redWeeks === 0 };
    if (!best || better(cand, best)) best = cand;
  }
  return best && { gid: best.gid, sid: best.sid };
}

async function run() {
  await settle(300);

  /* ---- Task 1: brand fix (surgical) ---- */
  await t("Queues → Brand 2 section → its Add-queue button files the new queue under Brand 2", async () => {
    // Create Brand 2 in Settings (the exact user path).
    await goto("Settings");
    click($('#panel-settings [data-testid="add-brand"]')); await settle(150);
    await goto("Queues");
    // Find the Brand 2 section (the one that isn't Brand 1's default "b1").
    const sections = $$('#panel-queues [data-testid^="brand-section-"]');
    ok(sections.length >= 2, "both brand sections render, got " + sections.length);
    const b2 = sections.map((s) => s.getAttribute("data-testid").slice("brand-section-".length)).find((id) => id !== "b1");
    ok(b2, "a second brand id exists");
    const section = $(`#panel-queues [data-testid="brand-section-${b2}"]`);
    const before = section.querySelectorAll("details.erow").length;
    // The per-brand Add-queue button (this is what the surgical fix adds).
    const addBtn = section.querySelector(`[data-testid="brand-add-queue-${b2}"]`);
    ok(addBtn, "Brand 2's section carries its own Add-queue button");
    click(addBtn); await settle(200);
    const after = $(`#panel-queues [data-testid="brand-section-${b2}"]`).querySelectorAll("details.erow").length;
    eq(after, before + 1, "the new queue renders under Brand 2's section");

    // Hierarchy verification: both brands appear with subtotals in BOTH the queue
    // summary and the hiring summary, and each grand total equals the sum of the
    // brand subtotals. Volume is the first data column in both tables (td[1]).
    const cell = (row, i) => parseFloat((row.querySelectorAll("td")[i].textContent || "0").replace(/[^0-9.-]/g, "")) || 0;
    const checkTable = (tbl, label) => {
      ok(tbl, label + " table present");
      const b1row = tbl.querySelector('[data-testid="hier-brand-b1"]');
      const b2row = tbl.querySelector(`[data-testid="hier-brand-${b2}"]`);
      ok(b1row, label + ": Brand 1 subtotal row present");
      ok(b2row, label + ": Brand 2 subtotal row present");
      ok(tbl.querySelector('[data-testid^="hier-chan-"]'), label + ": a channel subtotal row present");
      const total = tbl.querySelector("tr.grp.total");
      ok(total, label + ": grand total row present");
      ok(cell(b2row, 1) > 0, label + ": Brand 2 has real volume (a queue filed under it)");
      ok(Math.abs(cell(total, 1) - (cell(b1row, 1) + cell(b2row, 1))) <= 1, `${label}: grand total volume = Brand 1 + Brand 2 (${cell(total, 1)} vs ${cell(b1row, 1)} + ${cell(b2row, 1)})`);
    };
    await goto("Summary");
    checkTable($('[data-testid="queue-summary"]'), "Queue summary");
    await goto("Plan");
    checkTable($('[data-testid="hiring-summary"]'), "Hiring summary");
  });

  /* ---- Task 2: startup matrix persistence + auto-selection ---- */
  let realCells = null;
  await t("a cached matrix matching the config auto-selects the best cell with a note (never auto-runs)", async () => {
    // Reset #root to the default config so its matrix hash matches a fresh mount.
    setV($('[data-testid="new-sim"]'), "defaults"); await settle(300);
    // Run the matrix once — this persists {hash, cells, selected} to storage.
    await goto("Summary");
    click($('[data-testid="run-matrix"]')); await settle(400);
    const ms = JSON.parse(localStorage.getItem("matrix-state"));
    ok(ms && ms.cells && ms.hash, "the matrix run persisted a hash + cells");
    realCells = ms.cells;
    // Compute the expected best cell, and seed a DIFFERENT last-selected pair so
    // "auto-pick" is distinguishable from "restore the last pair".
    const best = bestCell(ms.cells);
    ok(best, "a best cell exists");
    let other = null;
    for (const g of Object.keys(ms.cells)) for (const s of Object.keys(ms.cells[g])) if (g !== best.gid || s !== best.sid) other = { gid: g, sid: s };
    ok(other, "a non-best pair exists to seed as the last selection");
    ms.selected = other;
    localStorage.setItem("matrix-state", JSON.stringify(ms));
    // Open a fresh instance — it must auto-select the BEST cell (not `other`).
    const B = await mountFresh();
    const sel = B.querySelector(".mx-cell.sel");
    ok(sel, "the fresh instance has a selected matrix cell");
    eq(sel.getAttribute("data-testid"), `mx-${best.gid}-${best.sid}`, "auto-selected the most favourable cell, not the last-selected pair");
    ok(B.querySelector('[data-testid="matrix-autopick-note"]'), "the 'based on your last matrix run' note is present");
    ok(!B.querySelector('[data-testid="matrix-stale"]'), "no stale banner when the cache matches");
  });

  await t("a stale/mismatched cache restores the last selected pair behind the stale banner (no note)", async () => {
    ok(realCells, "have real cells from the previous test");
    // Seed a matrix whose hash cannot match the live config, plus a specific pair.
    localStorage.setItem("matrix-state", JSON.stringify({ hash: "STALE-HASH-does-not-match", cells: realCells, selected: { gid: "g_none", sid: "S3" } }));
    const C = await mountFresh();
    ok(C.querySelector('[data-testid="matrix-stale"]'), "the stale banner shows for a mismatched cache");
    ok(!C.querySelector('[data-testid="matrix-autopick-note"]'), "no auto-pick note when the cache is stale");
    const sel = C.querySelector(".mx-cell.sel");
    ok(sel, "the fresh instance restored a selected cell");
    eq(sel.getAttribute("data-testid"), "mx-g_none-S3", "restored the last selected pair");
    eq(C.querySelector('[data-testid="ctx-group"]').value, "g_none", "context group = the restored group");
  });

  /* ---- Task 3: §25 chat UI ---- */
  await t("Digital Customer card shows a patience input and no backlog field; Workflow keeps backlog", async () => {
    await goto("Queues");
    // q_wapp is a Digital Customer queue on the default config.
    ok(gid("q-patience-q_wapp"), "the Digital Customer card carries a patience input (SLA section)");
    ok(gid("q-concurrency-q_wapp"), "it keeps concurrency");
    const custCard = gid("q-patience-q_wapp").closest("details.erow");
    const custLabs = [...custCard.querySelectorAll(".lab")].map((l) => l.textContent);
    ok(!custLabs.some((tt) => /Backlog limit/.test(tt)), "no backlog-limit field on the Digital Customer card");
    // Flip q_chat to Workflow — it must gain the backlog-limit field (and lose concurrency).
    setV(gid("subtype-q_chat"), "workflow"); await settle(250);
    const wfCard = gid("subtype-q_chat").closest("details.erow");
    const wfLabs = [...wfCard.querySelectorAll(".lab")].map((l) => l.textContent);
    ok(wfLabs.some((tt) => /Backlog limit/.test(tt)), "Workflow keeps the backlog-limit field");
    ok(!gid("q-concurrency-q_chat"), "the Workflow queue has no concurrency field");
    // The Plan status card for a Digital Customer queue shows Abandon (not backlog).
    await goto("Plan");
    const cards = [...$$('#panel-plan .qcard')];
    const wappCard = cards.find((c) => /WhatsApp/.test(c.textContent));
    ok(wappCard && /Abandon/.test(wappCard.textContent), "the Digital Customer status card shows abandonment");
  });

  await settle(150);
  await t("zero unexpected console errors/warnings across the R3d-B run", () => eq(consoleEvents.length, 0, "console: " + consoleEvents.slice(0, 8).join(" | ")));

  console.log("\n═══════════════════════════════════");
  console.log(`${pass} passed, ${fail} failed`);
  console.log(fail === 0 ? "R3d-B / §24–§25 UI GATE: GREEN" : "R3d-B / §24–§25 UI GATE: RED");
  if (fail > 0) { failures.forEach((x) => console.log("  - " + x)); process.exitCode = 1; }
}
run();
