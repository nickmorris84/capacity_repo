/* BUILD GATE — the packaged deliverables. Builds dist/ from source and mounts
 * the REAL packaged v2 artifact (dist/capacity-sim.html) in JSDOM: it must boot
 * the four-tab shell with zero console noise, proving the minified, self-
 * contained bundle (React + xlsx + engine + app inlined, </script> escaped)
 * works — not just the source. Also asserts the v1 legacy file is still built.
 */
const fs = require("fs");
const { JSDOM } = require("jsdom");
const { buildAll } = require("../scripts/build.js");

let pass = 0, fail = 0;
const failures = [];
async function t(name, fn) {
  try { await fn(); pass++; console.log("  ✓ " + name); }
  catch (e) { fail++; failures.push(name + ": " + e.message); console.log("  ✗ " + name + " — " + e.message); }
}
function ok(c, w) { if (!c) throw new Error(w || "condition failed"); }
function eq(a, b, w) { if (a !== b) throw new Error(`${w || "value"}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }

console.log("Build gate — packaged deliverables");

async function main() {
const b = buildAll();
const html = fs.readFileSync(b.htmlPath, "utf8");

await t("v2 shell is the default product (capacity-sim.html) + v1 legacy is retained", () => {
  ok(b.htmlBytes > 200 * 1024, "v2 html is a real bundle: " + Math.round(b.htmlBytes / 1024) + " KB");
  ok(fs.existsSync(b.v1HtmlPath), "v1 legacy html built");
  eq((html.match(/<\/script>/gi) || []).length, 1, "exactly one literal </script> (bundle's is escaped)");
  ok(/id="root"/.test(html), "mount point present");
});

await t("the packaged v2 artifact boots the four-tab shell with zero console noise", async () => {
  const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "http://localhost/" });
  const { window } = dom;
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  const events = [];
  ["error", "warn"].forEach((k) => { const o = window.console[k]; window.console[k] = (...a) => { events.push(k + ": " + a.map(String).join(" ")); o && o.apply(window.console, a); }; });
  // Let the inlined IIFE auto-mount into #root and React flush.
  await new Promise((r) => setTimeout(r, 250));
  const root = window.document.getElementById("root");
  ok(root && root.children.length > 0, "app mounted into #root");
  // Lands on Home (the launcher): a simulation card, the primary action, and the
  // KPI-family chips computed from a real engine run.
  ok(window.document.querySelector(".grid .card"), "Home simulation card rendered");
  ok([...window.document.querySelectorAll(".btn.primary")].some((x) => /New simulation/.test(x.textContent)), "New-simulation action present");
  ok(/all-in/.test(window.document.querySelector(".chips").textContent), "real headline chips rendered");
  eq(events.length, 0, "packaged bundle noise: " + events.join(" | "));
  window.close();
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("\nFAILURES:\n" + failures.map((f) => "  - " + f).join("\n")); process.exit(1); }
console.log("BUILD GATE: GREEN");
}
main().catch((e) => { console.error(e); process.exit(1); });
