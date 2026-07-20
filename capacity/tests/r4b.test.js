/* R4-B gate — SPEC §26.6 (global presets, copy-on-apply + re-sync) and §26.7
   (verdict-first Compare). Renders the source app in JSDOM and asserts:
     - no preset-creation affordance exists inside the workspace;
     - editing a global seasonality preset leaves a simulation using it unchanged
       until Re-sync, then it changes, and its saved Runs never change;
     - Compare renders headline cards (live + run) with labels + auto-verdict;
     - the What-changed panel lists an induced attrition difference old→new;
     - delta chips colour by DIRECTION (a cost increase red, a coverage increase
       green), and switching the reference re-bases every delta;
     - the per-queue accordion orders by absolute delta;
     - deleting a preset in use is blocked with a message naming the sims.
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
const gid = (id) => document.getElementById(id);
const tabByLabel = (l) => $$('[role="tab"]').find((x) => x.textContent === l);
const goto = async (l) => { click(tabByLabel(l)); await settle(90); };
const simId = () => JSON.parse(localStorage.getItem("sim-list"))[0].id;
const recordOf = (id) => JSON.parse(localStorage.getItem("simulation-" + id));
const openSim = async () => { click($(`[data-testid="sim-open-${simId()}"]`)); await settle(400); };
const backToLanding = async () => { click($('[data-testid="back-to-landing"], [data-testid="presets-back"], [data-testid="compare-back"]')); await settle(300); };
const planAllIn = () => Number($('[data-testid="plan-panel"]').getAttribute("data-active-allin"));
const openDetails = () => $$("#panel-queues details").forEach((d) => d.setAttribute("open", ""));

async function run() {
  await settle(400);

  await t("no preset-creation affordance exists inside the workspace (§26.6)", async () => {
    await openSim();
    await goto("Simulation Settings");
    ok(!$('#panel-settings [data-testid^="preset-add-"]'), "no 'add preset' control in Simulation Settings");
    ok(!$('#panel-settings [data-testid^="preset-new-"]'), "no 'new preset name' input in Simulation Settings");
    ok(gid("channel-preset"), "channel creation reads the global channel-preset picker");
    await goto("Queues");
    ok(!$('#panel-queues [data-testid^="preset-add-"]') && !$('#panel-queues [data-testid^="preset-new-"]'), "no preset creation on Queues");
    ok(gid("system-seasonality-apply"), "the workspace can still APPLY a global pattern");
    await backToLanding();
  });

  // Shared: create an editable custom seasonality preset with a spiked January.
  let gateId = null;
  await t("create a custom seasonality preset on the landing (§26.6)", async () => {
    click($('[data-testid="landing-presets"]')); await settle(150);
    setV($('[data-testid="preset-new-seasonality"]'), "GateSeason");
    click($('[data-testid="preset-add-seasonality"]')); await settle(120);
    const item = $$('[data-testid^="preset-item-sp_"]').find((r) => { const inp = r.querySelector('input[aria-label="Pattern name"]'); return inp && inp.value === "GateSeason"; });
    ok(item, "GateSeason appears in the seasonality library");
    gateId = item.getAttribute("data-testid").slice("preset-item-".length);
    setV(gid("preset-months-" + gateId + "-0"), 300); await settle(80); // January ×3
    await backToLanding();
  });

  await t("copy-on-apply: editing a global preset leaves a live sim unchanged until Re-sync; Runs never change", async () => {
    // Apply GateSeason (January ×3) to the system seasonality, then Save a Run.
    await openSim();
    await goto("Queues");
    setV(gid("system-seasonality-apply"), gateId); await settle(500);
    await goto("Plan");
    const appliedAllIn = planAllIn();
    ok(appliedAllIn > 0, "the applied sim simulates");
    click($('[data-testid="save-run-open"]')); await settle(80);
    setV($('[data-testid="run-name"]'), "Frozen"); click($('[data-testid="save-run"]')); await settle(700);
    const rec = recordOf(simId());
    const frozen = rec.runs.find((r) => r.name === "Frozen");
    ok(frozen, "the Run was saved");
    const frozenJan = frozen.config.seasonality.system[0];
    ok(Math.abs(rec.config.seasonality.system[0] - 3) < 1e-6, "the applied copy is January ×3");
    ok(Math.abs(frozenJan - 3) < 1e-6, "the Run froze January ×3 too");
    ok(rec.config.seasonality.systemProv && rec.config.seasonality.systemProv.presetId === gateId, "system seasonality carries provenance to GateSeason");

    // Edit GateSeason on the landing (January ×3 → ×0.2). The live sim's stored
    // copy must NOT move (copy-on-apply), and neither must the Run's.
    await backToLanding();
    click($('[data-testid="landing-presets"]')); await settle(150);
    setV(gid("preset-months-" + gateId + "-0"), 20); await settle(150);
    await backToLanding();
    ok(Math.abs(recordOf(simId()).config.seasonality.system[0] - 3) < 1e-6, "the live sim's copy is UNCHANGED by the landing edit (still ×3)");
    await openSim();
    await goto("Plan");
    ok(Math.abs(planAllIn() - appliedAllIn) / appliedAllIn < 0.005, "the live sim is materially unchanged by the landing edit");

    // Re-sync from global — the copy pulls ×0.2 and the sim moves materially.
    await goto("Queues");
    click($('[data-testid="system-seasonality-resync-open"]')); await settle(60);
    ok($('[data-testid="system-seasonality-resync-diff"]'), "the re-sync diff preview appears");
    click($('[data-testid="system-seasonality-resync-apply"]')); await settle(500);
    ok(Math.abs(recordOf(simId()).config.seasonality.system[0] - 0.2) < 1e-6, "after Re-sync the copy is January ×0.2");
    await goto("Plan");
    ok(Math.abs(planAllIn() - appliedAllIn) / appliedAllIn > 0.02, `the sim changed materially after Re-sync (${appliedAllIn} → ${planAllIn()})`);

    // The saved Run never changed — value or frozen config.
    const frozenNow = recordOf(simId()).runs.find((r) => r.name === "Frozen");
    eq(frozenNow.allIn, frozen.allIn, "the saved Run's result never changed");
    ok(Math.abs(frozenNow.config.seasonality.system[0] - 3) < 1e-6, "the saved Run's frozen config never changed");
    await backToLanding();
  });

  // Induce a config difference (attrition) and save a Run, then diverge live.
  let attrRunAllIn = null;
  await t("induce an attrition difference: a Run at low attrition, live at high (§26.7)", async () => {
    await openSim();
    await goto("Queues");
    openDetails();
    setV(gid("q-attrition-q_bill"), 2); await settle(350); // 2%/mo
    click($('[data-testid="save-run-open"]')); await settle(80);
    setV($('[data-testid="run-name"]'), "AttrLow"); click($('[data-testid="save-run"]')); await settle(700);
    attrRunAllIn = recordOf(simId()).runs.find((r) => r.name === "AttrLow").allIn;
    openDetails();
    setV(gid("q-attrition-q_bill"), 12); await settle(400); // live now diverges (12%/mo)
    await backToLanding();
  });

  let liveKey, attrKey;
  await t("Compare: live vs Run renders headline cards with labels + an auto-verdict (§26.7)", async () => {
    click($('[data-testid="landing-compare"]')); await settle(150);
    const id = simId();
    // Pick the AttrLow run FIRST (→ becomes reference), then Live now.
    const attrOpt = $$('[data-testid^="cmp-pick-run:"]').find((el) => /AttrLow/.test(el.closest(".cmp-opt").textContent));
    ok(attrOpt, "the AttrLow run is pickable");
    click(attrOpt); await settle(150);
    click($(`[data-testid="cmp-pick-live:${id}"]`)); await settle(400);
    const cards = $$('[data-testid^="headline-card-"]');
    eq(cards.length, 2, "two headline cards");
    ok($('[data-testid="headline-strip"]').textContent.includes("Live now"), "the live comparator is labelled 'Live now'");
    // resolve the two comparator keys
    liveKey = "live:" + id;
    attrKey = $$('[data-testid^="headline-card-"]').map((c) => c.getAttribute("data-testid").slice("headline-card-".length)).find((k) => k !== liveKey);
    const v = document.querySelector(`[data-testid="verdict-${liveKey}"]`);
    ok(v && /costs|saves|matches/.test(v.textContent) && /red week/.test(v.textContent), "auto-verdict names the cost + red-week delta vs the reference");
  });

  await t("What-changed lists the induced attrition difference old→new (§26.7)", async () => {
    const panel = document.querySelector(`[data-testid="whatchanged-${liveKey}"]`);
    ok(panel, "a what-changed panel exists for the live comparator");
    ok(/attrition/i.test(panel.textContent), "the diff names attrition: " + panel.textContent.slice(0, 160));
    ok(/0\.02\D+0\.12|0\.12/.test(panel.textContent), "…with the old→new values (0.02 → 0.12)");
  });

  await t("delta chips colour by direction; switching the reference re-bases (§26.7)", async () => {
    // Reference = AttrLow (first picked). Live costs MORE → its all-in chip is red.
    const liveCost = document.querySelector(`[data-testid="cell-allIn-${liveKey}"]`);
    ok(liveCost, "the Money all-in cell for the live comparator exists");
    ok(liveCost.querySelector(".delta-chip.delta-bad"), "a cost INCREASE renders red (delta-bad): " + liveCost.textContent);
    // Switch the reference to Live now → deltas re-base onto live.
    click(document.querySelector(`[data-testid="set-ref-${liveKey}"]`)); await settle(200);
    const attrCostAfter = document.querySelector(`[data-testid="cell-allIn-${attrKey}"]`);
    ok(attrCostAfter.querySelector(".delta-chip.delta-good"), "after re-basing, AttrLow (cheaper) shows a green cost chip");
    // AttrLow has higher coverage than live (lower attrition) → coverage chip green.
    const attrCover = document.querySelector(`[data-testid="cell-avgCover-${attrKey}"]`);
    ok(attrCover.querySelector(".delta-chip.delta-good"), "a coverage INCREASE renders green (delta-good): " + attrCover.textContent);
    // Re-base proof: the (new) reference row shows no chip in its own all-in cell.
    ok(!document.querySelector(`[data-testid="cell-allIn-${liveKey}"] .delta-chip`), "the reference comparator shows no delta against itself");
  });

  await t("per-queue accordion orders by absolute delta (§26.7)", async () => {
    const rows = $$('[data-testid="per-queue-accordion"] > details');
    ok(rows.length >= 2, "several per-queue rows");
    const deltas = rows.map((r) => Number((r.querySelector("summary .pill").textContent || "").replace(/[^0-9.]/g, "")) || 0);
    for (let i = 1; i < deltas.length; i++) ok(deltas[i - 1] >= deltas[i], `rows are sorted by |Δ| desc (${deltas.join(", ")})`);
    await backToLanding();
  });

  await t("deleting a global preset in use is blocked, naming the simulations (§26.6)", async () => {
    click($('[data-testid="landing-presets"]')); await settle(200);
    // GateSeason is referenced by Simulation 1's system seasonality (provenance).
    click(document.querySelector(`[data-testid="preset-del-${gateId}"]`)); await settle(120);
    const blocked = document.querySelector(`[data-testid="preset-del-blocked-${gateId}"]`);
    ok(blocked, "deletion is blocked");
    ok(/Simulation 1/.test(blocked.textContent), "the message names the simulation using it: " + blocked.textContent.slice(0, 120));
    ok(document.querySelector(`[data-testid="preset-item-${gateId}"]`), "the preset still exists (not deleted)");
  });

  await settle(700); // flush the debounced auto-save inside act
  await t("zero unexpected console errors/warnings across the R4-B run", () => eq(consoleEvents.length, 0, "console: " + consoleEvents.slice(0, 8).join(" | ")));

  console.log("\n═══════════════════════════════════");
  console.log(`${pass} passed, ${fail} failed`);
  console.log(fail === 0 ? "R4-B / §26.6–§26.7 GATE: GREEN" : "R4-B / §26.6–§26.7 GATE: RED");
  if (fail > 0) { failures.forEach((x) => console.log("  - " + x)); process.exitCode = 1; }
}
run();
