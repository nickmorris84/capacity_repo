/* R4-A gate — SPEC §26.1–§26.5 multi-simulation shell. Renders the source app
   in JSDOM and asserts the Session-A checklist:
     - migration: seeded old-schema storage (snapshots + matrix-state) opens as
       "Simulation 1" with its snapshots intact as Runs, matrix cache and
       selected pair carried over — zero data loss;
     - the landing renders a card with headline + actions;
     - create via (b) duplicates settings/brands/channels/queues but NOT runs;
     - wizard (c) end-to-end produces a simulating workspace;
     - rename persists to storage;
     - delete requires typed confirmation and removes only its record;
     - back-navigation round-trips without state loss (auto-save);
     - the workspace has no New-simulation menu and no Runs tab, and the
       context-bar Save creates a named Run;
     - Simulation Settings renders collapsible sections, Start first with the
       global starting HC + week-1 date, everything else collapsed.
   Zero console noise throughout. */
const path = require("path");
const { JSDOM } = require("jsdom");
const esbuild = require("esbuild");
const E = require("../engine/engine.js");

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
if (!window.URL.revokeObjectURL) window.URL.revokeObjectURL = () => {};
global.URL = window.URL; global.Blob = window.Blob; global.File = window.File; global.FileReader = window.FileReader;

const consoleEvents = [];
["error", "warn"].forEach((k) => { const o = console[k]; console[k] = (...a) => { consoleEvents.push(k + ": " + a.map(String).join(" ")); o.apply(console, a); }; });

const React = require("react"); const { act } = React;
const built = esbuild.buildSync({
  entryPoints: [path.join(__dirname, "../ui/main.jsx")], bundle: true, format: "cjs", platform: "node", jsx: "automatic", write: false,
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "recharts", "xlsx"],
  define: { "process.env.NODE_ENV": '"development"' }, logLevel: "silent",
});

/* ---- seed OLD-schema storage BEFORE the first mount (the §26.2 migration
   path). A real legacy snapshot: full config + compact results. ---- */
const legacyCfg = E.makeDefaultConfig();
const legacySim = E.simulate(legacyCfg, { strategy: "S1" });
const legacySnap = {
  name: "Old baseline", slug: "old-baseline", savedAt: "2026-06-01T10:00:00.000Z",
  strategy: "S1", allIn: Math.round(legacySim.summary.allIn),
  config: legacyCfg, run: E.compactRun(legacyCfg, legacySim),
};
localStorage.setItem("sim-index", JSON.stringify([{ slug: legacySnap.slug, name: legacySnap.name, savedAt: legacySnap.savedAt, strategy: "S1", allIn: legacySnap.allIn }]));
localStorage.setItem("sim-old-baseline", JSON.stringify(legacySnap));
localStorage.setItem("matrix-state", JSON.stringify({ hash: "LEGACY-HASH", cells: { g_por: { S1: { allIn: 1, redWeeks: 0, status: "green" } } }, selected: { gid: "g_none", sid: "S2" } }));

t("app mounts with zero console errors", () => {
  const mod = { exports: {} };
  act(() => { new Function("module", "exports", "require", "__dirname", "__filename", built.outputFiles[0].text)(mod, mod.exports, require, path.join(__dirname, "../ui"), path.join(__dirname, "../ui/main.jsx")); });
  ok(document.getElementById("root").children.length > 0, "rendered");
  eq(consoleEvents.length, 0, "mount noise: " + consoleEvents.join(" | "));
});

function click(el) { ok(el, "click target missing"); act(() => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); }); }
function setV(el, v) { ok(el, "setV target missing"); const p = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype; const s = Object.getOwnPropertyDescriptor(p, "value").set; act(() => { s.call(el, String(v)); el.dispatchEvent(new window.Event("input", { bubbles: true })); el.dispatchEvent(new window.Event("change", { bubbles: true })); }); }
async function settle(ms = 250) { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); }
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const tabByLabel = (l) => $$('[role="tab"]').find((x) => x.textContent === l);
const goto = async (l) => { click(tabByLabel(l)); await settle(90); };

const simList = () => JSON.parse(localStorage.getItem("sim-list") || "[]");
const simIdByName = (name) => (simList().find((s) => s.name === name) || {}).id;
const recordOf = (id) => JSON.parse(localStorage.getItem("simulation-" + id) || "null");
const backToLanding = async () => { click($('[data-testid="back-to-landing"]')); await settle(300); };

async function run() {
  await settle(400);

  await t("migration: old-schema storage opens as 'Simulation 1' with snapshots intact as Runs", async () => {
    ok($('[data-testid="landing"]'), "the app opens on the landing");
    const id = simIdByName("Simulation 1");
    ok(id, "'Simulation 1' is in the sim-list index");
    ok($(`[data-testid="sim-card-${id}"]`), "its card renders");
    const rec = recordOf(id);
    ok(rec, "its record exists");
    eq(rec.runs.length, 1, "one legacy snapshot converted to a Run");
    eq(rec.runs[0].name, "Old baseline", "the Run keeps the snapshot's name");
    eq(rec.runs[0].savedAt, "2026-06-01T10:00:00.000Z", "…and its savedAt");
    ok(rec.runs[0].config && Array.isArray(rec.runs[0].config.queues), "…and its full config");
    ok(rec.runs[0].run && Array.isArray(rec.runs[0].run.queues), "…and its compact results");
    eq(rec.matrixCache.hash, "LEGACY-HASH", "the matrix cache carried over");
    eq(rec.selectedPair.gid + "|" + rec.selectedPair.sid, "g_none|S2", "the selected pair carried over");
    ok(localStorage.getItem("sim-old-baseline"), "legacy keys untouched (zero data loss)");
    // the card surfaces the run in its runs table
    ok($(`[data-testid="runs-table-${id}"]`), "the card lists its runs");
  });

  await t("landing renders cards with headline + actions (§26.3)", async () => {
    const id = simIdByName("Simulation 1");
    const card = $(`[data-testid="sim-card-${id}"]`);
    ok(/Horizon/.test(card.textContent) && /Brands/.test(card.textContent) && /Queues/.test(card.textContent), "headline stats present");
    ok(/1 run/.test(card.textContent), "run count shown");
    for (const a of ["open", "rename", "duplicate", "delete"]) ok(card.querySelector(`[data-testid="sim-${a}-${id}"]`), a + " action present");
    ok($('[data-testid="landing-new-sim"]'), "New simulation entry");
    ok($('[data-testid="landing-compare"]'), "Compare entry (part-B stub)");
    ok($('[data-testid="landing-presets"]'), "Global presets entry (part-B stub)");
  });

  await t("create via (b) duplicates settings, brands, channels and queues — but not runs (§26.5b)", async () => {
    const srcId = simIdByName("Simulation 1");
    const src = recordOf(srcId);
    click($('[data-testid="landing-new-sim"]')); await settle(100);
    setV($('[data-testid="new-name"]'), "Full copy");
    setV($('[data-testid="new-source"]'), srcId);
    click($('[data-testid="new-inherit-full"]')); await settle(500);
    ok($('[data-testid="back-to-landing"]'), "the workspace opened");
    const copyId = simIdByName("Full copy");
    ok(copyId && copyId !== srcId, "a new record was created");
    const copy = recordOf(copyId);
    eq(copy.config.queues.length, src.config.queues.length, "queues copied");
    eq(copy.config.brands.length, src.config.brands.length, "brands copied");
    eq((copy.config.channelDefs || []).length, (src.config.channelDefs || []).length, "channels copied");
    eq(JSON.stringify(copy.config.settings), JSON.stringify(src.config.settings), "settings copied");
    eq(copy.runs.length, 0, "runs NOT copied");
    ok(!copy.matrixCache, "matrix cache NOT copied");
    await backToLanding();
  });

  await t("wizard (c) end-to-end produces a simulating workspace (§26.5c)", async () => {
    click($('[data-testid="landing-new-sim"]')); await settle(100);
    click($('[data-testid="new-scratch"]')); await settle(200);
    ok($('[data-testid="wizard-progress"]'), "progress indicator renders");
    setV($('[data-testid="wizard-name"]'), "Wizard sim");
    // Step 1: Simulation Settings pre-filled with defaults, editable inline.
    ok(document.getElementById("wiz-horizon"), "settings step shows the horizon");
    setV(document.getElementById("wiz-horizon"), 30);
    click($('[data-testid="wizard-next"]')); await settle(120);
    // Step 2: brands.
    setV($('[data-testid="wiz-brand-name"]'), "Acme");
    click($('[data-testid="wiz-add-brand"]')); await settle(120);
    click($('[data-testid="wizard-next"]')); await settle(120);
    // Step 3: channels from the global presets (the four built-ins are seeded).
    ok($$('[data-testid="wizard-progress"] li').length === 4, "four steps");
    click($('[data-testid="wizard-next"]')); await settle(120);
    // Step 4: queues — quick volume.
    click($('[data-testid="wiz-add-queue"]')); await settle(120);
    setV($('[data-testid="wiz-q-name-0"]'), "Front line");
    setV($('[data-testid="wiz-q-weekly-0"]'), 7000);
    // Back/next round-trips without losing state.
    click($('[data-testid="wizard-back"]')); await settle(100);
    click($('[data-testid="wizard-next"]')); await settle(100);
    eq($('[data-testid="wiz-q-name-0"]').value, "Front line", "queue draft survives back/next");
    click($('[data-testid="wizard-finish"]')); await settle(700);
    ok($('[data-testid="back-to-landing"]'), "the workspace opened");
    await goto("Plan");
    const allIn = $('[data-testid="plan-panel"]').getAttribute("data-active-allin");
    ok(allIn != null && Number(allIn) > 0, "the new world simulates (all-in " + allIn + ")");
    const rec = recordOf(simIdByName("Wizard sim"));
    eq(rec.config.engine.horizonWeeks, 30, "the step-1 horizon edit stuck");
    eq(rec.config.queues.length, 1, "one queue created");
    eq(rec.config.queues[0].name, "Front line", "…with its name");
    ok(Array.isArray(rec.config.queues[0].weeklyVolumes) && Math.round(rec.config.queues[0].weeklyVolumes[0]) === 7000, "…and the weekly figure spread across the series");
    eq(rec.config.brands[0].name, "Acme", "…filed under the wizard brand");
    await backToLanding();
  });

  await t("rename persists (§26.3)", async () => {
    const id = simIdByName("Full copy");
    click($(`[data-testid="sim-rename-${id}"]`)); await settle(80);
    setV($(`[data-testid="sim-rename-input-${id}"]`), "Renamed copy");
    click($(`[data-testid="sim-rename-save-${id}"]`)); await settle(300);
    eq($(`[data-testid="sim-name-${id}"]`).textContent, "Renamed copy", "the card shows the new name");
    eq((simList().find((s) => s.id === id) || {}).name, "Renamed copy", "the index persisted it");
    eq(recordOf(id).name, "Renamed copy", "the record persisted it");
  });

  await t("delete requires typed confirmation and removes only its record (§26.3)", async () => {
    const id = simIdByName("Wizard sim");
    const otherId = simIdByName("Simulation 1");
    click($(`[data-testid="sim-delete-${id}"]`)); await settle(80);
    const doBtn = $(`[data-testid="sim-delete-do-${id}"]`);
    ok(doBtn.disabled, "confirm button disabled before typing");
    setV($(`[data-testid="sim-delete-confirm-${id}"]`), "wrong name");
    ok($(`[data-testid="sim-delete-do-${id}"]`).disabled, "…and with the wrong text");
    setV($(`[data-testid="sim-delete-confirm-${id}"]`), "Wizard sim");
    ok(!$(`[data-testid="sim-delete-do-${id}"]`).disabled, "typing the exact name enables it");
    click($(`[data-testid="sim-delete-do-${id}"]`)); await settle(300);
    ok(!$(`[data-testid="sim-card-${id}"]`), "the card is gone");
    ok(!recordOf(id), "its record is gone");
    ok(recordOf(otherId), "other records intact");
    ok(!simIdByName("Wizard sim") && simIdByName("Simulation 1"), "the index removed only that entry");
  });

  await t("back-navigation round-trips without state loss (auto-save §26.2)", async () => {
    const id = simIdByName("Simulation 1");
    click($(`[data-testid="sim-open-${id}"]`)); await settle(400);
    await goto("Simulation Settings");
    setV($('#panel-settings [data-testid="global-hc"]'), 123);
    await settle(700); // debounced auto-save
    await backToLanding();
    ok($('[data-testid="landing"]'), "back on the landing");
    click($(`[data-testid="sim-open-${id}"]`)); await settle(400);
    await goto("Simulation Settings");
    eq($('#panel-settings [data-testid="global-hc"]').value, "123", "the edit survived the round-trip");
    eq(recordOf(id).config.engine.globalStartingHC, 123, "…and is in storage");
  });

  await t("workspace has no New-simulation menu and no Runs tab; Save creates a named Run (§26.4)", async () => {
    ok(!$('[data-testid="new-sim"]'), "no New-simulation menu in the workspace");
    const labels = $$('[role="tab"]').map((x) => x.textContent);
    ok(!labels.includes("Snapshots") && !labels.includes("Runs"), "no Runs/Snapshots tab: " + labels.join(" · "));
    ok(labels.includes("Simulation Settings"), "Settings renamed Simulation Settings");
    const id = simIdByName("Simulation 1");
    const before = recordOf(id).runs.length;
    click($('[data-testid="save-run-open"]')); await settle(80);
    ok($('[data-testid="run-name"]').value.length > 0, "the name prompt defaults to a timestamp");
    setV($('[data-testid="run-name"]'), "Gate run");
    click($('[data-testid="save-run"]')); await settle(600);
    const rec = recordOf(id);
    eq(rec.runs.length, before + 1, "a Run was created");
    const run = rec.runs[rec.runs.length - 1];
    eq(run.name, "Gate run", "…with the typed name");
    ok(run.config && Array.isArray(run.config.strategies) && Array.isArray(run.config.groups), "…carrying the full config incl. strategies + scenario groups");
    ok(run.selectedPair && run.selectedPair.gid && run.selectedPair.sid, "…and the selected pair");
    ok(run.run && Array.isArray(run.run.totals), "…and the results for that pair");
    // it appears in the context-bar Run selector too
    ok($$('[data-testid="ctx-snapshot"] option').some((o) => o.textContent === "Gate run"), "the Run selector lists it");
  });

  await t("Simulation Settings: collapsible sections, Start first with HC + week-1 date (§26.4)", async () => {
    await goto("Simulation Settings");
    const secs = $$("#panel-settings details.set-sec");
    ok(secs.length >= 7, "collapsible sections render, got " + secs.length);
    const first = secs[0];
    eq(first.querySelector(".set-sec-t").textContent, "Start", "Start is the first section");
    ok(first.querySelector('[data-testid="global-hc"]'), "Start carries the global starting HC");
    ok(first.querySelector('[data-testid="week-one-date"]'), "…and the week-1 date");
    const titles = secs.map((s) => s.querySelector(".set-sec-t").textContent);
    for (const want of ["Simulation window & currency", "Hiring caps", "Workforce physics", "Knock-on defaults", "CX economics", "Risk parameters"]) {
      ok(titles.includes(want), "section present: " + want);
    }
    // spec order preserved as a subsequence
    const order = ["Start", "Simulation window & currency", "Hiring caps", "Workforce physics", "Knock-on defaults", "CX economics", "Risk parameters"];
    let last = -1;
    for (const name of order) { const i = titles.indexOf(name); ok(i > last, name + " in order (" + titles.join(" | ") + ")"); last = i; }
  });

  await t("landing compare: ticking the migrated Run renders the comparison (§26.4 interim)", async () => {
    await backToLanding();
    const tick = $('[data-testid^="tick-"]');
    ok(tick, "a run tick renders on the landing");
    click(tick); await settle(300);
    ok($('[data-testid="totals-delta"]'), "totals delta renders");
    ok($('[data-testid="per-queue-compare"]'), "per-queue comparison renders");
    click($('[data-testid^="tick-"]')); await settle(150); // untick
  });

  await settle(700); // flush the debounced auto-save inside act
  await t("zero unexpected console errors/warnings across the R4-A run", () => eq(consoleEvents.length, 0, "console: " + consoleEvents.slice(0, 8).join(" | ")));

  console.log("\n═══════════════════════════════════");
  console.log(`${pass} passed, ${fail} failed`);
  console.log(fail === 0 ? "R4-A / §26 GATE: GREEN" : "R4-A / §26 GATE: RED");
  if (fail > 0) { failures.forEach((x) => console.log("  - " + x)); process.exitCode = 1; }
}
run();
