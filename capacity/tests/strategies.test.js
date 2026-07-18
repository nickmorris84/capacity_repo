/* P3 gate — SPEC.md §3 (strategies + global cap), §5 (scenario views), §0
   (compute budget). Renders the compiled app in JSDOM and asserts the
   strategy/view comparison behaviour:
     - the overlay dimension toggle changes the series count correctly,
     - up to four views can be overlaid,
     - switching the active strategy changes the dashboard numbers,
     - a full recompute stays within the ≤8-sim / <1s budget,
   all with zero unexpected console output. */
const path = require("path");
const { JSDOM } = require("jsdom");
const esbuild = require("esbuild");

let pass = 0, fail = 0;
const failures = [];
async function t(name, fn) {
  try { await fn(); pass++; console.log("  ✓ " + name); }
  catch (e) { fail++; failures.push(name + ": " + e.message); console.log("  ✗ " + name + " — " + e.message); }
}
function ok(cond, what) { if (!cond) throw new Error(what || "condition failed"); }
function eq(a, b, what) { if (a !== b) throw new Error(`${what || "value"}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }

// ---------------- JSDOM environment ----------------
const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { pretendToBeVisual: true, url: "http://localhost/" });
const { window } = dom;
global.window = window;
global.document = window.document;
global.navigator = window.navigator;
global.HTMLElement = window.HTMLElement;
global.Node = window.Node;
global.Event = window.Event;
global.MouseEvent = window.MouseEvent;
global.getComputedStyle = window.getComputedStyle;
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);
window.requestAnimationFrame = global.requestAnimationFrame;
window.cancelAnimationFrame = global.cancelAnimationFrame;
window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
global.ResizeObserver = window.ResizeObserver;
Object.defineProperty(window.HTMLElement.prototype, "clientWidth", { configurable: true, get() { return 640; } });
global.IS_REACT_ACT_ENVIRONMENT = true;

const consoleEvents = [];
["error", "warn"].forEach((k) => {
  const orig = console[k];
  console[k] = (...args) => { consoleEvents.push(k + ": " + args.map(String).join(" ")); orig.apply(console, args); };
});

const React = require("react");
const { act } = React;

const built = esbuild.buildSync({
  entryPoints: [path.join(__dirname, "../ui/main.jsx")],
  bundle: true, format: "cjs", platform: "node", jsx: "automatic", write: false,
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "recharts", "xlsx"],
  define: { "process.env.NODE_ENV": '"development"' }, logLevel: "silent",
});

t("app mounts for the P3 gate with zero console errors", () => {
  const mod = { exports: {} };
  act(() => {
    new Function("module", "exports", "require", "__dirname", "__filename", built.outputFiles[0].text)(
      mod, mod.exports, require, path.join(__dirname, "../ui"), path.join(__dirname, "../ui/main.jsx")
    );
  });
  ok(document.getElementById("root").children.length > 0, "app rendered");
  eq(consoleEvents.length, 0, "console noise during mount: " + consoleEvents.join(" | "));
});

// ---------------- helpers ----------------
function click(el) { act(() => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); }); }
function setValue(el, val) {
  const proto = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
  act(() => {
    setter.call(el, String(val));
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
    el.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
}
async function settle(ms = 400) { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); }
const tabByLabel = (label) => [...document.querySelectorAll('[role="tab"]')].find((x) => x.textContent === label);
const goto = (label) => click(tabByLabel(label));
const seriesCount = () => Number(document.querySelector('[data-testid="comparison-chart"]').getAttribute("data-series"));
const panel = () => document.querySelector('[data-testid="strategies-panel"]');
const btnByText = (root, text) => [...root.querySelectorAll("button")].find((b) => b.textContent.trim() === text);

// ---------------- the run ----------------
const setDimension = (mode) => {
  const cmp = btnByText(document.querySelector("#panel-strategies"), mode === "views" ? "Compare views" : "Compare strategies");
  if (cmp.getAttribute("aria-pressed") !== "true") click(cmp);
};

async function run() {
  await settle(300);

  await t("Strategies tab has a Strategies nav tab", () => ok(tabByLabel("Strategies"), "Strategies tab exists"));

  goto("Strategies");
  await settle(50);

  await t("strategy comparison table lists all four strategies", () => {
    const rows = document.querySelectorAll("#panel-strategies table.data tbody tr");
    const labels = [...rows].map((r) => r.querySelector("td strong")).filter(Boolean).map((s) => s.textContent);
    ok(["S1", "S2", "S3", "S4"].every((id) => labels.includes(id)), "S1–S4 all present, got " + labels.join(","));
  });

  let stratSeries, viewSeriesDefault;
  await t("dimension toggle flips the overlaid series between strategies and views", async () => {
    stratSeries = seriesCount();                 // default dimension = strategies
    eq(stratSeries, 4, "strategies-mode series count");
    setDimension("views");
    await settle(300);                            // let the missing overlay-view sim resolve
    viewSeriesDefault = seriesCount();
    ok(viewSeriesDefault !== stratSeries, `series changed on flip: ${stratSeries} -> ${viewSeriesDefault}`);
    eq(viewSeriesDefault, 2, "default overlay is the two built-in views");
    setDimension("strategies");
    await settle(50);
    eq(seriesCount(), 4, "flipping back returns to 4 strategy series");
  });

  await t("overlay three views: create a user view and select three", async () => {
    goto("Scenarios & views");
    setValue(document.querySelector("#panel-scenarios input.inp"), "Bull case");
    click(btnByText(document.querySelector("#panel-scenarios"), "Save enabled as view"));
    await settle(300);
    goto("Strategies");
    setDimension("views");
    await settle(50);
    const checks = [...document.querySelectorAll("#panel-strategies .rowflex input[type=checkbox]")];
    ok(checks.length >= 3, "at least three views available, got " + checks.length);
    for (const c of checks) { if (!c.checked) { click(c); break; } } // tick the user view → 3 selected
    await settle(300);
    eq(seriesCount(), 3, "three views overlaid");
  });

  await t("switching the active strategy changes the dashboard numbers", async () => {
    // Force the comparison dimension back to strategies first: in that mode the
    // set of needed sims is unchanged by a strategy switch, so this is the case
    // that must still rebuild the dashboard snapshot.
    goto("Strategies");
    setDimension("strategies");
    await settle(50);
    goto("Plan");
    await settle(50);
    const planPanel = () => document.querySelector('[data-testid="plan-panel"]');
    const beforeStrat = planPanel().getAttribute("data-active-strategy");
    const beforeAllIn = planPanel().getAttribute("data-active-allin");
    ok(beforeAllIn && Number(beforeAllIn) > 0, "Plan dashboard shows an all-in figure");
    const sel = document.querySelector('.topctrl select[aria-label="Active strategy"]');
    const other = ["S1", "S2", "S3", "S4"].find((s) => s !== sel.value);
    setValue(sel, other);
    await settle(50);                             // dashboard sim is cached → resolves at once
    const afterStrat = planPanel().getAttribute("data-active-strategy");
    const afterAllIn = planPanel().getAttribute("data-active-allin");
    ok(afterStrat === other && afterStrat !== beforeStrat, `dashboard strategy switched: ${beforeStrat} -> ${afterStrat}`);
    ok(afterAllIn !== beforeAllIn, `dashboard all-in changed on strategy switch: ${beforeAllIn} -> ${afterAllIn}`);
  });

  await t("overlay caps at four views", async () => {
    goto("Scenarios & views");
    for (const nm of ["Bear case", "Stress case"]) {
      setValue(document.querySelector("#panel-scenarios input.inp"), nm);
      click(btnByText(document.querySelector("#panel-scenarios"), "Save enabled as view"));
    }
    await settle(200);
    goto("Strategies");
    setDimension("views");
    await settle(50);
    // uncheck all, then tick the four non-active-view views (active view is Plan of record)
    const checks = () => [...document.querySelectorAll("#panel-strategies .rowflex input[type=checkbox]")];
    for (const c of checks()) { if (c.checked) click(c); }
    let picked = 0;
    for (const c of checks()) {
      if (c.parentElement.textContent.trim() !== "Plan of record" && picked < 4) { click(c); picked++; }
    }
    await settle(500);
    eq(seriesCount(), 4, "exactly four non-active views overlaid (cap honoured)");
  });

  // With four non-active overlay views + four strategies for the active view,
  // a config edit invalidates the hash and forces the full 8-sim recompute.
  let computeSims = 0, computeMs = 0;
  await t("compute budget: a full recompute runs exactly 8 sims in < 1s", async () => {
    goto("Queues");
    await settle(50);
    setValue(document.querySelector("#panel-queues input[type=number]"), "2101");
    await settle(600);
    goto("Strategies");
    await settle(50);
    computeSims = Number(panel().getAttribute("data-compute-sims"));
    computeMs = Number(panel().getAttribute("data-compute-ms"));
    ok(computeSims > 0, "a recompute actually ran");
    ok(computeSims <= 8, "sims within the ≤8 budget: " + computeSims);
    eq(computeSims, 8, "max overlay drives the full 8-sim recompute");
    ok(computeMs > 0, "compute time recorded");
    ok(computeMs < 1000, "8-sim recompute under the 1s budget, was " + Math.round(computeMs) + "ms");
    console.log(`      8-sim recompute: ${Math.round(computeMs)}ms`);
  });

  await settle(200);
  await t("zero unexpected console errors/warnings across the P3 run", () => {
    eq(consoleEvents.length, 0, "console events: " + consoleEvents.slice(0, 10).join(" | "));
  });

  console.log("\n═══════════════════════════════════");
  console.log(`${pass} passed, ${fail} failed`);
  console.log(fail === 0 ? "P3 GATE: GREEN" : "P3 GATE: RED");
  if (fail > 0) { failures.forEach((f) => console.log("  - " + f)); process.exitCode = 1; }
}

run();
