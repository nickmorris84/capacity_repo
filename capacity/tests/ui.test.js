/* P2 gate — SPEC.md §0/§13, phase prompt P2.
   Renders the compiled app in JSDOM, drives it like a user (click every tab,
   edit a numeric field, add+duplicate+delete a queue, toggle a scenario), and
   fails on any unexpected console error/warning captured along the way. */
const path = require("path");
const { JSDOM } = require("jsdom");
const esbuild = require("esbuild");

let pass = 0, fail = 0;
const failures = [];
function t(name, fn) {
  try { fn(); pass++; console.log("  ✓ " + name); }
  catch (e) { fail++; failures.push(name + ": " + e.message); console.log("  ✗ " + name + " — " + e.message); }
}
function ok(cond, what) { if (!cond) throw new Error(what || "condition failed"); }
function eq(a, b, what) { if (a !== b) throw new Error(`${what || "value"}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }

// ---------------- JSDOM environment ----------------
const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
  pretendToBeVisual: true,
  url: "http://localhost/",
});
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
// jsdom has no ResizeObserver and no layout engine; stub both so Chart's
// width-measuring hook gets a stable non-zero width.
window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
global.ResizeObserver = window.ResizeObserver;
Object.defineProperty(window.HTMLElement.prototype, "clientWidth", { configurable: true, get() { return 640; } });
global.IS_REACT_ACT_ENVIRONMENT = true;

// Capture console.error/warn for the whole run. React logs a small number of
// benign notices (e.g. defaultProps deprecation from a chart lib version skew)
// which would be "expected" noise; we assert on the literal count instead of
// guessing at an allowlist, so any regression shows up immediately.
const consoleEvents = [];
["error", "warn"].forEach((k) => {
  const orig = console[k];
  console[k] = (...args) => {
    consoleEvents.push(k + ": " + args.map(String).join(" "));
    orig.apply(console, args);
  };
});

// ---------------- bundle + mount the app ----------------
const React = require("react");
const { act } = React;

const built = esbuild.buildSync({
  entryPoints: [path.join(__dirname, "../ui/main.jsx")],
  bundle: true,
  format: "cjs",
  platform: "node",
  jsx: "automatic",
  write: false,
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "recharts", "xlsx"],
  define: { "process.env.NODE_ENV": '"development"' },
  logLevel: "silent",
});
const bundleCode = built.outputFiles[0].text;

let mountFn;
t("app bundle builds and mounts with zero console errors", () => {
  const mod = { exports: {} };
  act(() => {
    new Function("module", "exports", "require", "__dirname", "__filename", bundleCode)(
      mod, mod.exports, require, path.join(__dirname, "../ui"), path.join(__dirname, "../ui/main.jsx")
    );
  });
  mountFn = mod.exports.mount;
  ok(typeof mountFn === "function", "main.jsx exports mount()");
  ok(document.getElementById("root").children.length > 0, "app rendered into #root");
  eq(consoleEvents.length, 0, "console noise during mount: " + consoleEvents.join(" | "));
});

// ---------------- interaction helpers ----------------
function click(el) {
  act(() => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); });
}
function setInputValue(el, val) {
  const proto = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
  act(() => {
    setter.call(el, String(val));
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
    el.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
}
async function settle(ms = 400) {
  await act(async () => { await new Promise((r) => setTimeout(r, ms)); });
}

// ---------------- drive the app ----------------
async function run() {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  t("all tabs present", () => eq(tabs.length, 13, "tab count"));

  t("clicking every tab shows its panel and hides the rest", () => {
    for (const tabEl of tabs) {
      click(tabEl);
      const panelId = tabEl.getAttribute("aria-controls");
      const panel = document.getElementById(panelId);
      ok(panel && !panel.hidden, "panel for " + tabEl.textContent + " visible");
      ok(tabEl.getAttribute("aria-selected") === "true", tabEl.textContent + " marked selected");
      const others = tabs.filter((x) => x !== tabEl);
      for (const o of others) {
        const op = document.getElementById(o.getAttribute("aria-controls"));
        ok(op.hidden, o.textContent + " hidden while " + tabEl.textContent + " active");
      }
    }
  });

  // Land on Queues for the editing checks.
  click(tabs.find((x) => x.textContent === "Queues"));

  let editedValue;
  t("editing a numeric field updates it", () => {
    const input = document.querySelector('#panel-queues input[type=number]');
    ok(input, "numeric input exists");
    const before = input.value;
    setInputValue(input, "1234");
    editedValue = input.value;
    ok(editedValue === "1234" && editedValue !== before, "value changed to 1234");
  });

  let queueCountBefore, queueCountAfterAdd, queueCountAfterDup, queueCountAfterDelete;
  t("add queue increases the queue count", () => {
    queueCountBefore = document.querySelectorAll("#panel-queues details.erow").length;
    const addBtn = [...document.querySelectorAll("#panel-queues .btnbar button")].find((b) => b.textContent.includes("Add queue"));
    ok(addBtn, "add-queue button exists");
    click(addBtn);
    queueCountAfterAdd = document.querySelectorAll("#panel-queues details.erow").length;
    eq(queueCountAfterAdd, queueCountBefore + 1, "queue count after add");
  });

  t("duplicate queue increases the queue count again", () => {
    const dupBtn = document.querySelector("#panel-queues details.erow button.btn.sm:not(.danger)");
    ok(dupBtn && dupBtn.textContent.includes("Duplicate"), "duplicate button exists");
    click(dupBtn);
    queueCountAfterDup = document.querySelectorAll("#panel-queues details.erow").length;
    eq(queueCountAfterDup, queueCountAfterAdd + 1, "queue count after duplicate");
  });

  t("delete queue decreases the queue count", () => {
    const delBtns = document.querySelectorAll("#panel-queues details.erow button.danger");
    ok(delBtns.length > 0, "delete buttons exist");
    click(delBtns[delBtns.length - 1]);
    queueCountAfterDelete = document.querySelectorAll("#panel-queues details.erow").length;
    eq(queueCountAfterDelete, queueCountAfterDup - 1, "queue count after delete");
  });

  // Scenarios
  click(tabs.find((x) => x.textContent === "Scenarios & views"));
  t("toggling a scenario flips its checked state", () => {
    const toggle = document.querySelector('#panel-scenarios input[type=checkbox]');
    ok(toggle, "scenario toggle exists");
    const before = toggle.checked;
    click(toggle);
    eq(toggle.checked, !before, "scenario toggle flipped");
  });

  // Let the debounced recompute (E4) settle, then re-check the whole tab set
  // and the Plan/Intraday charts, which read `sim.config` (the config the
  // simulation ran with) rather than the live config that was just mutated.
  await settle(500);

  t("Plan tab renders charts against the settled sim", () => {
    click(tabs.find((x) => x.textContent === "Plan"));
    const svgs = document.querySelectorAll("#panel-plan svg");
    ok(svgs.length > 0, "plan tab renders chart SVGs, got " + svgs.length);
    const cells = document.querySelectorAll("#panel-plan .ribbon .cell");
    ok(cells.length > 0, "RAG ribbon renders cells");
  });

  t("clicking a ribbon cell scrubs the selected week", () => {
    const cells = [...document.querySelectorAll("#panel-plan .ribbon .cell")];
    ok(cells.length > 5, "enough ribbon cells to pick a non-first one");
    const target = cells[5];
    click(target);
    ok(target.classList.contains("scrubbed"), "clicked cell marked as scrubbed");
  });

  t("Intraday tab renders required-vs-available chart", () => {
    click(tabs.find((x) => x.textContent === "Intraday"));
    const svgs = document.querySelectorAll("#panel-intraday svg");
    ok(svgs.length > 0, "intraday tab renders chart SVGs, got " + svgs.length);
    const rows = document.querySelectorAll("#panel-intraday table.data tbody tr");
    ok(rows.length > 0, "interval detail table has rows");
  });

  await settle(300);

  t("zero unexpected console errors/warnings across the whole run", () => {
    eq(consoleEvents.length, 0, "console events: " + consoleEvents.slice(0, 10).join(" | "));
  });

  console.log("\n═══════════════════════════════════");
  console.log(`${pass} passed, ${fail} failed`);
  console.log(fail === 0 ? "P2 GATE: GREEN" : "P2 GATE: RED");
  if (fail > 0) { failures.forEach((f) => console.log("  - " + f)); process.exitCode = 1; }
}

run();
