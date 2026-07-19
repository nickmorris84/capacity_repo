# Progress

## P1 — Engine + proof: ✅ COMPLETE (all 20 gate tests green)

Validated numbers (must match SPEC §11 E1 before P2 is authorised):
- Erlang C recursion ≡ direct summation to 1e-6 (N=11..16, 20, 30 at A=10)
- Patience→∞: N=13 → C=0.2853, ASA=17.11s, SL(20s)=79.6% ✓ (spec: 0.2853 / 17.0±0.3 / 79.7±0.5)
- Overload (patience 90s): abandonment strictly > 1−N/A, monotone in N; N=3 → 72.8% vs 70% conservation ✓
- ASA bounded (< patience) and monotone through N=9..25, no NaN/∞ ✓

Engine surface (engine/engine.js, pure JS, no DOM):
- Erlang B/C/A (self-consistent abandonment solve), fractional-agent blending, 0.05-Erlang quantised persistent caches
- Requirement curves (voice minimal-N search; digital demand/concurrency/ceiling), day models (requirement-shaped supply; digital fluid backlog with linear wait ramp)
- Volume precedence: CSV-or-flat → seasonality (system × queue monthly, startMonth; 5 built-in presets) → growth/events → endogenous deflection + redial (fixed point, ≤3 iters, 4× cap)
- View-aware scenarios: simulate(cfg, { viewIds, strategy, captureDaily })
- Supply projection to landing week; strategies S1 (meet), S2 (buffer, default +10%), S3 (forward backfill only), S4 (manual, ignores cap)
- Global hiring cap allocator: marginal churn cost averted per FTE, tie-break earliest projected breach; full weekly allocation trace (grants / denied / binding / order)
- Summary: findings + flags { tippingPoint, capInfeasible }, over-capacity time-to-rectify, compactRun() shape for saving/compare

Performance: 1 sim 106ms, 8 sims 871ms (budget 250ms / 1000ms) ✓

Notes for P2+: reqCurve/reqFte caches are per-simulate (profile edits would stale a global cache); Erlang caches are module-persistent by design. decideHiring exposes `trace` per week — render it in the holistic panel (P3).

## P2 — Core UI: ✅ COMPLETE (P1 engine gate still green; new JSDOM UI gate green)

Stack installed per the working agreement's approved list: react, react-dom, recharts, xlsx
(present for P4), esbuild, jsdom (all devDependencies/dependencies in package.json;
node_modules gitignored, package-lock.json committed).

UI surface (ui/, JSX, no engine logic duplicated — imports engine/engine.js directly):
- `main.jsx` — injects the stylesheet, exports `mount(container)` and auto-mounts `#root`.
- `App.jsx` — top bar (brand + recalculating indicator), 7-tab nav (`role="tab"`/`tabpanel`),
  owns the live `config` state and hands it to `useDeferredSim`.
- `hooks.js` — `useDeferredSim` (E4: debounces 150ms, result carries `sim.config`, exposes
  `pending` for the "recalculating…" indicator), `useMeasuredWidth` (explicit chart pixel
  widths — recharts' `ResponsiveContainer` collapses to 0 under JSDOM and in print),
  `useDisclosure` (tap-to-reveal popovers with outside-click/Escape dismissal).
- `config-ops.js` — every config mutation (add/duplicate/delete queue, patch by path, hires,
  service teams, scenarios) as stable, memoised callbacks; editors read/write live `config`.
- `components/PlanTab.jsx` — findings strip, RAG ribbon (click-to-scrub + scenario-onset
  markers), queue status cards for the scrubbed week, holistic panel (feasibility verdict now;
  full allocation trace table is P3 scope).
- `components/charts.jsx` — coverage vs 100%, headcount trained/ramping/training vs required,
  volume composition (base/deflected/redial), cost breakdown, idle-pay vs churn with
  break-even marker, burnout — all explicit-width, `isAnimationActive={false}`, scrub-week
  reference line.
- `components/IntradayTab.jsx` — required vs available agents per interval (first day of the
  selected week) + full interval detail table.
- `editors/` — Queues (intraday preset library: apply/hand-edit sliders/save-as-new;
  cross-skill donor toggles), Workforce (pipeline/attrition/burnout/learning curve + per-queue
  manual hires table feeding S4), Money & engine (engine params, hiring strategy + global cap,
  costs, CX economics, endogenous loops, service teams), Scenarios (all 7 types, enable
  toggle), Seasonality (system pattern + optional per-queue overlay, same preset mechanic).
- `presets.js` — 6 built-in intraday curves + the engine's 5 seasonality presets as the seed
  libraries; `makeIntradayPreset`/`makeSeasonalityPreset` for save-as-new. Held in App state
  for P2; persistence lands in P5.
- `style.js` — single injected stylesheet: ink/cyan instrument-panel look (not a UI-kit
  template), responsive breakpoints to phone width, `:focus-visible` rings on every
  interactive element, print rules. Hints are a real `<button>` + popover
  (`components/primitives.jsx`'s `Hint`) — no hover-only `title=` tooltips anywhere in `ui/`.

E4 discipline verified: deleting every queue down to zero and back, and rapid edits during an
in-flight debounce, cause zero console errors — Plan/Intraday/charts only ever read
`sim.config`, never the live config being edited.

Verified visually in a real headless Chromium (temporary local QA, not shipped) at 1440px and
390px (iPhone-width) — ink/cyan look reads as distinctive, ribbon/cards/charts hold up, editor
forms collapse to one column and button rows wrap cleanly on phone width.

Gate: `tests/ui.test.js` bundles `ui/main.jsx` with esbuild (react/react-dom/recharts external
so the test's React instance and the app's are the same copy — avoids "invalid hook call" from
duplicate React), mounts into JSDOM inside `React.act`, then: clicks all 7 tabs and checks
panel visibility/aria-selected, edits a numeric field, adds+duplicates+deletes a queue, toggles
a scenario, scrubs a RAG ribbon cell, waits out the debounce, and asserts the captured
console.error/warn count is exactly zero throughout. `npm test` runs the P1 engine suite then
this one; both green.

Notes for P3+: `HolisticPlaceholder` in PlanTab.jsx already surfaces the real
`capInfeasible`/cap-bound-week count from `sim.allocTrace`; P3 replaces it with the full
per-week grants/denied/binding table plus the 4-strategy/4-view overlay comparison. Scenario
*views* (named enabled-sets) aren't built yet — Scenarios editor only has the enable toggle;
`simulate()` already accepts `viewIds` for this. Data-table tab (§6), Report/PDF (§8), xlsx
round-trip (§9) and the Model notes tab are out of P2 scope by design.

## P3 — Strategies + scenario views: ✅ COMPLETE (P1/P2 gates still green; new P3 gate green)

Multi-simulation layer + comparison UI over the P2 shell.

Budgeted multi-sim engine (ui/sim-set.js, `useStrategyViews`):
- Computes exactly the sims the screen needs: the four strategies for the ACTIVE
  view (comparison table + dashboard) plus, only while comparing views, the
  active strategy across the OVERLAY views. Active dashboard sim is always one of
  the four strategy sims, so it's free. Worst case 4 + 4 − 1 = 7 ≤ 8 (SPEC §0).
- Memoised by a (configHash | strategy | viewId) key in a size-capped ref cache.
  A parameter edit misses (correct — must re-simulate); flipping the dimension,
  editing the overlay set, or switching the active strategy reuses cached sims
  and resolves instantly. Debounced (160ms) with `pending` → the top-bar
  "Recalculating…" indicator; `computeMs`/`computeCount` exposed for the gate.
- E4 preserved: on a parameter edit (active sim not yet cached) the previous
  snapshot stays visible so charts never read a half-built config; when only
  overlay sims are stale (active sim cached) the dashboard updates immediately.

Strategies tab (ui/components/StrategiesTab.jsx + ComparisonChart + HolisticPanel):
- Strategy comparison table — all four run side by side for the active view: red
  weeks, end HC, run cost, churn, all-in, feasibility; the active row is marked,
  the recommended one (lowest all-in that holds SLA, else least-bad) badged, and
  "Make active" drives every other tab.
- Overlay comparison — cumulative all-in cost, one line per series, with the
  single dimension toggle: strategies-within-active-view XOR views-within-active-
  strategy, never both. `data-series` exposes the live line count. Overlay view
  multi-select capped at 4.
- Holistic requirement panel — required vs paid vs pipeline, feasibility verdict,
  and the week-by-week cap-allocation trace (cap / wanted / per-queue grants /
  denied shortfall / projected churn), binding weeks highlighted, rendering the
  SPEC's "Week N: cap X, plan wants Y; … goes short — projected £Zk churn"
  narrative. Also reused (compact) at the bottom of the Plan tab.

Scenario views (ui/views.js, ui/components/ViewsManager.jsx, config.views):
- A view = named set of enabled scenarios. Built-ins Plan of record (tracks the
  live enabled set) and No scenarios (always empty); users create (from the
  currently-enabled set), rename, re-member, and delete views. `viewIdsFor`
  resolves a view to the scenario-id list simulate() takes; deleted scenarios are
  filtered out and pruned from saved views.
- Global active-strategy + active-view selectors live in the top bar (UI state,
  deliberately kept out of the config hash so switching either reuses cache) and
  drive Plan, Intraday and the dashboard. The active-strategy field was removed
  from Money & engine (now the top-bar selector); the ViewsManager sits under the
  Scenarios list on the renamed "Scenarios & views" tab.

Gate: tests/strategies.test.js (JSDOM) — comparison table lists S1–S4; the
dimension toggle flips the overlaid series (4 strategies ↔ N views); a user view
is created and three views overlaid; switching the active strategy changes the
dashboard's exact figures (data-active-allin / data-active-strategy on the Plan
root); the overlay caps at 4; and a forced full recompute runs exactly 8 sims in
<1s (observed ~350–400ms). `npm test` runs engine → ui → strategies; all green
(20 / 12 / 9). tests/ui.test.js updated for the new 8-tab set and the renamed
Scenarios tab.

Design decision (SPEC §5 "view selector on every chart/table"): implemented as a
single global active-view selector that every dashboard chart/table honours, plus
the per-comparison overlay selector — rather than a redundant dropdown bolted to
each chart, which would be UI noise and risk the sim budget. Per-table view
selectors on the P4 data tables can still be layered on top of this state.

Notes for P4+: `sim.allocTrace` is fully surfaced now. The per-queue data table
(§6), Report/PDF (§8), xlsx round-trip (§9) and Model-notes tab remain unbuilt.

## P4 — Data + documents: ✅ COMPLETE (P1–P3 gates still green; new P4 gate green)

Data views, executive documents and Excel/file round-trip over the P3 app.

Shared reporting layer (ui/reporting.js, DOM-free, one source of truth):
- `buildWeeklyRows` — one row per week per queue with every §6 datapoint (base /
  seasonal × / deflected / redial / total volume, coverage, ASA-or-response, SL,
  abandon, occupancy, backlog, burnout, leavers, attrition-in-effect, reqs
  raised, hires start, in training, ramping, trained, paid vs required FTE, run
  cost, churn cost, customers lost, status). "Hires start" is derived from reqs
  raised shifted by req-to-start (the engine doesn't store it, so no engine edit).
- `columnsFor` — the column model grouped Week/Demand/Service/People/Money/Status,
  Service group tailored per queue type; used by the Data table AND the per-queue
  Excel/CSV sheets.
- `buildVerdict` (recommended = lowest all-in that holds SLA, else least-bad, via
  views.recommendStrategy), `buildAudienceBlocks` (Finance/HR/Business), and
  `buildRiskRegister` (cap-infeasibility, tipping point, per-queue SLA breach,
  burnout peaks, over-capacity carrying cost + time-to-rectify, deflection
  spirals) with £/SLA severity and a suggested lever.

Data tab (ui/components/DataTab.jsx): per-queue weekly table, queue + view
selectors, column-group picker (all on by default), sticky header, horizontal
scroll, per-table CSV export. Read-only — editing stays in the editor tabs.

Summary tab (ui/components/SummaryTab.jsx): auto verdict paragraph with RAG
counts, Finance/HR/Business stat blocks, and a sortable (risk/week/severity)
risk register.

Report tab (ui/components/ReportTab.jsx): executive summary, key findings, risk
register, strategy comparison (table + cumulative all-in chart), a per-queue
section (KPI row + coverage and headcount charts), and an assumptions table.
Report charts render at a FIXED 640px width (never ResponsiveContainer, which
collapses in print), each in a `break-inside: avoid` section; print stylesheet
hides the chrome; a "Print / Save as PDF" button calls window.print() with the
iPhone save-to-Files hint.

Files/exports (ui/exports.js pure builders + ui/components/FilesCard.jsx):
- One workbook (SheetJS): Summary, Strategy comparison, Findings & risks,
  Parameters (path/setting/value), Volumes (week × queue), then one sheet per
  queue with the full §6 table. Import reads back ONLY Parameters + Volumes and
  path-patches the config (output sheets ignored).
- Path-addressed patching by queue id (`queues.<id>.<field>`, `.wf.*`, `.burn.*`)
  plus engine/hiring/costs/cx/loops/seasonality scalars; values coerced to the
  existing type. Volumes export/import is the RAW per-week daily base (not the
  seasonality-baked sim output) so it round-trips through weeklyVolumes with no
  double-counting.
- Config JSON export/import, saved-run .json export/import (compactRun + config;
  importing loads its config — the P5 compare UI consumes the same shape), and
  CSV fallbacks (per-queue results, parameters, volumes). Pure builders return
  bytes/strings; a single anchor-based download wrapper is the only DOM touch.

Gate: tests/documents.test.js (JSDOM) — mounts the app; asserts the Data table
renders with a working column-group toggle; the Summary verdict + sortable risk
register render; the Report charts render at the fixed 640px surface width; the
print button calls window.print(); every export button fires a download (anchor
mocked, blob captured); the captured workbook parses with xlsx and has the
expected sheet list (5 fixed + one per queue); a modified Parameters sheet
re-imports and the value is applied (and a neighbouring queue is untouched); and
a modified workbook fed through the Files card's file input propagates into the
live Data table. Zero console errors throughout. `npm test` runs engine → ui →
strategies → documents; all green (20 / 12 / 11 / 11). tests/ui.test.js updated
for the 11-tab set.

Notes for P5: the storage adapter, saved-runs-in-storage with the index, preset/
view persistence, the saved-run compare UI, the standalone HTML build, and the
full cross-tab JSDOM interaction test remain. runJSON/parseRunJSON already
produce/consume the shareable run-file shape the compare view will use.

## P5 — Persistence + packaging: ✅ COMPLETE — SHIPPED (all five gates green)

Final gate tally: **P1 20 · P2 12 · P3 9 · P4 11 · P5/§13 20 = 72 tests, 0 failures.**
`npm test` runs engine → ui → strategies → documents → harness.

Storage adapter (ui/storage.js): artifact `window.storage` → `localStorage` →
in-memory (with a visible "downloads are your durable save" notice). Uniform
async get/set/del/list; JSON round-tripped; a missing key resolves to undefined
(the artifact store throws on missing — caught). Slugged keys; `sim-index` +
one `sim-<slug>` per run; `presets-intraday`, `presets-seasonality`, `views`.

Persistence (App): preset libraries, scenario views and saved runs all hydrate
on mount and persist through the adapter (only the user-authored subsets of
presets/views are written; built-ins come from code). Verified in a real browser:
two saved runs survive a page reload via localStorage.

Saved runs + compare (ui/saved-runs.js, components/RunsTab.jsx): save the current
plan (E4 — snapshots `activeSim.config`, never the live config), load-settings,
download (a shareable run file the importer already reads), delete, refresh.
Compare of ticked runs: totals delta table (vs baseline), cumulative all-in
overlay, and per-queue blocks matched by NAME (red weeks, avg coverage, worst
ASA/SL, cost, churn, coverage chart). The compare tick set lives in App, above
the tabs, so switching tabs never clears it — the v3 defect this phase named.

Model notes tab (components/NotesTab.jsx): E1–E3 explained in plain language plus
the other key mechanics (§13 requirement).

Parameters-CSV import (exports.parseParametersCSV + a robust CSV parser) added to
the Files card, completing the §13 "load a parameters CSV back" step.

Packaging (scripts/build.js, `npm run build:html`): from the single source
ui/main.jsx it emits **dist/capacity-sim.html** (self-contained, offline,
minified, production, React + recharts + xlsx + engine + UI all inlined into one
`<script>` with `</script>` escaped and a responsive viewport meta — ~1.17 MB)
and **dist/capacity-sim.jsx** (the React-artifact form: one bundled ESM file
importing react/react-dom/recharts/xlsx from the host — ~242 KB). Both come from
the same build so they cannot drift.

§13 harness (tests/harness.test.js): the complete checklist run against BOTH the
source (dev bundle + React `act`) and the built dist/capacity-sim.html (production,
self-contained, driven with native events in its own JSDOM realm with a
ResizeObserver shim) — click every tab; add/duplicate/delete a queue; add + toggle
a scenario; save a run, tick it, see the per-queue comparison render; confirm the
tick survives a tab switch; fire every export; load a parameters CSV back; render
the print view — asserting zero console errors on both targets, and that the
inlined bundle has exactly one literal `</script>`.

Bug found & fixed during P5 integration (in the P3 sim-set hook): switching the
active strategy while the comparison dimension was "strategies" left the set of
needed sims unchanged, so the memoised recompute effect never re-ran and the
dashboard's activeSim stayed on the old strategy — "active strategy drives every
tab" was silently broken in that mode (the P3 gate only exercised the switch in
"views" mode). Fixed by keying the effect on the active selection, not just the
needed-sims set; the P3 gate now asserts the switch in strategies mode too, and
the real-browser saved-run compare confirms S1 vs S2 now differ correctly.

Deliverables: dist/capacity-sim.jsx and dist/capacity-sim.html (committed).

## P6a — Revision 1 engine: ✅ COMPLETE (P1 battery unchanged + 19 new R1 tests green)

Gate tally after P6a: **P1 20 · R1 19 · P2 12 · P3 9 · P4 11 · P5/§13 20 = 91 tests, 0
failures.** `npm test` runs engine → r1 → ui → strategies → documents → harness.
tests/engine.test.js is byte-identical to P1 — that was the regression gate.

SPEC §14 appended verbatim and committed first (`R1: spec amendment`); it is the
source of truth for P6a (engine, this session) and P6b (UI restructure, next).

14.1 Strategy model (engine/engine.js):
- `cfg.strategies` array; BUILTIN_STRATEGIES S1–S4 always resolvable even for
  configs that predate the array (P5 run files load fine). Custom entries:
  {name, baseType meet|buffer|backfill|manual|schedule, bufferPct (buffer
  strategies fall back to cfg.hiring.buffer when absent — S2 unchanged),
  excludedQueueIds, segments}.
- `strategyAt(cfg, idOrObj, week)` resolves the strategy IN FORCE at a week:
  schedules pick the last segment whose 1-based fromWeek has started, nested
  schedules resolve recursively with a cycle guard (falls back to meet).
  `decideHiring` resolves per decision week, so a pivot changes only future
  requisitions — cohorts already in the pipeline continue. The weekly cap is
  Infinity only in weeks whose in-force baseType is manual; the tipping-point
  finding is skipped only when the strategy is manual in EVERY week
  (strategyAllManual), preserving the old S4 behaviour exactly.

14.2 Supported queues: `resourcing: "resourced" | "supported"`. Supported ⇒
startingHC forced 0 (even with an explicit fte), zero wants under every
baseType including manual, excluded from the global-HC spread, served only via
support routes + service teams. Weekly record carries `resourcing`; per-queue
findings badge "(supported)" with a route-focused breach message.

14.3 Support routing: outbound `supports: [{queueId, priority, maxSharePct?}]`
replaces recipient-centric crossSkill. Day-loop allocator is donor-centric and
tiered: within a tier the donor's spare splits proportionally to recipients'
remaining deficits, bounded per recipient by need and by maxSharePct × the
donor's INITIAL spare that day; cap-forfeited share redistributes within the
tier; tier leftovers flow down. Donors only ever give from spare (never below
their own allocation-time requirement). Migration shim in `effectiveSupports`:
crossSkill arrays auto-convert (priority = array position + 1, maxSharePct
100) unless the donor already declares that route; empty arrays convert to
nothing, so the legacy tests' off-switch still works. `supportersOf` derives
the inbound supported-by list. makeDefaultConfig deliberately KEEPS crossSkill
(shim proves itself on the default config); P6b flips defaults when the editor
writes supports.

14.4 `engine.globalStartingHC`: blanks (fte == null) share (global − Σ
explicit) weighted by volume × AHT ÷ concurrency via resolveStartingHC;
explicit HC always wins; no global ⇒ blanks resolve 0.

14.5 Scenarios: growth gains stopWeek (elapsed-growth clamp — multiplier flat
after it); new types growthManual {weeklyPct sparse map, absolute weeks,
overrides the compounding growth component for that week only — other weeks
compound as if untouched} and freezeManual {weeks[] absolute, no reqs raised
those weeks}, both additional; existing types untouched. Both new types keep
scenarioFor's growth component separate from launch/p1/forecastError
multipliers, so precedence (§2) is preserved — P1 test 7 still green.

14.6 Reporting: weekly per-queue record adds startingHC, active (trained +
ramping, excluding trainees), resourcing; totals add active. summary gains
`hiring`: per queue and Voice/Digital/Overall {volume, required (end reqFte),
hiring (Σ reqs raised), pipelineEnd, training, active (end), churnCount (Σ
leavers), churnPct (churn ÷ average active over the horizon)} — the test
reconciles every aggregate against the weekly records.

New battery (tests/r1.test.js, 19 tests): migration shim (default config,
explicit-wins, empty-off-switch); hand-computed tier allocation (10h spare →
6/3 then remainder 1; 40% cap → 4/3/3; priorities 1&2 with 60%/100% caps →
6/4) on an exact-arithmetic all-digital rig (ceiling 1, prof 1, 8h heads — no
Erlang fuzz); supported queues (zero reqs/pipeline/paid/startingHC under all
four strategies, donor floor at allocation-time requirement, recipient hours =
min(need, spare) incl. starved-donor 0); custom buffer 0.2 settles ≈ req × 1.2
with cfg buffer 0.1 ignored; excludedQueueIds zero reqs while the sibling
hires; schedule S3→S1 (weeks 0–9 allocTrace identical to pure S3, pivot-week
want spike, totals strictly S3 < schedule < S1 — the upper gap is small by
design since later hires decay less, so the assertion is strict ordering);
schedule cycle guard; global-HC spread (explicit 50 untouched, blanks 40/40
incl. a concurrency-2 digital weight, sums to global, flows into weekly
startingHC/paid; supported fte excluded from the pool); growth stopWeek flat
∀k; growthManual override-week-only semantics (with and without a compounding
growth active); freezeManual weeks raise zero (trace want 0) with neighbours
unaffected; weekly-field spot checks (63 startingHC, active = paid − training,
attrInEffect ≈ 4%/mo) and hiring-summary reconciliation.

Engine-behaviour note for P6b: donation happens before the voice redial fixed
point, so a donor that gives ALL its spare can show cover slightly < 1 against
the redial-inflated weekly reqHours — the floor guarantee is against the
allocation-time requirement (two R1 tests document this). dist/ was
regenerated by the harness gate and committed (deliverables track source).

P6b (UI restructure, next session): 14.6 label changes (Active/Req, Coverage),
14.7 Runs→Snapshots rename + one shared comparison surface, 14.8 per-tab
print action + package reachability, editors for strategies/schedules,
supported-queue + supports editor replacing the crossSkill toggles, global
starting HC field, new scenario types in the editor, hiring-summary table.

## P6b — Revision 1 UI restructure: ✅ COMPLETE

Gate tally: **P1 20 · R1 engine 19 · R1 UI 13 · §13 harness 20 (source + built HTML)
= 72 tests, 0 failures.** `npm test` runs engine → r1 → r1ui → harness. Engine files
untouched this session (UI only). dist/ rebuilt from source (committed).

Exact 10-tab order (§14): Summary · Strategies · Plan · Data · Intraday · Queues ·
Scenarios · Seasonality · Snapshots · Settings. Workforce and Report tabs removed;
the Model-notes content folded into Settings so the tab list stays exact.

- Global context bar (ui/print.jsx + components/ContextBar.jsx) under the header on
  every tab: active strategy/schedule chip (tap to switch or edit segments, shows
  "S3 → S1 from wk 10"), view selector, loaded-snapshot name, recalculating dot, and
  the Print / PDF this page action.
- Per-tab print (§14.8): a PrintProvider flips a `printing` flag on `beforeprint`
  via flushSync so charts re-render at a fixed 660px width (verified by dispatching
  beforeprint in the gate); the print stylesheet hides chrome and keeps sections
  from breaking. Summary has its own Print / PDF Summary button.
- Sim engine rewritten (ui/sim-set.js `useStrategySims`): the dashboard runs the
  ACTIVE strategy (which may be a schedule); the comparison runs every strategy in
  config for the active view; ≤8 sims/change, memoised, E4-safe. The P3
  strategies-vs-views dimension toggle is gone (§14.7 folds multi-comparison into
  Snapshots; the Strategies tab now uses metric×scope).
- Summary: strategy overview cards (name, all-in, weeks red, end coverage, Set
  active) driving the whole app; verdict + findings; queue summary table with Voice/
  Digital/Total subtotals; four boxes Finance/HR/Business/CX; sortable risk register;
  own print button.
- Strategies: add/duplicate/delete custom strategies (meet/buffer/backfill/manual/
  schedule), edit name/bufferPct/excludedQueueIds/segments, save the active schedule
  as a named strategy; detailed comparison with metric {All-in · HC cost · Coverage}
  × scope {Overall · Voice · Digital · each queue}, chart + table. Holistic panel not
  here.
- Plan: hiring-summary table (§14.6, incl. agent churn # and %), Coverage chart title,
  Active/Req labels, weekly volume on status cards, and the holistic requirement panel
  (Active vs required, per-queue coloured panels grouped Voice/Digital with Ops cost +
  Customer cost, cap-allocation trace retained).
- Data: per-group colour tints (Demand/Service/People/Money) + new columns Starting HC,
  Active FTE, Attrition #, Attrition %.
- Intraday: an all-weeks RAG strip (coloured for the selected queue, click to load)
  replaces the week dropdown.
- Queues: separated Voice and Digital sections plus a Service-teams section (relocated
  from the removed Workforce tab). Each queue card: Description (channel/volumes/AHT/
  SLA/patience-or-concurrency/backlog/arrival pattern), Resourcing toggle
  (Resourced/Supported + badge, HC input disabled when supported), Workforce (starting
  HC with blank→global-spread, attrition, training/hiring incl. manual hires, burnout),
  and Interdependencies (outbound Supports editor with priority 1..x and max-share %,
  plus the derived inbound Supported-by list). crossSkill is migrated to supports on
  load (migrateConfig) so the UI speaks only the new field.
- Scenarios: growth card gains a stop-week; new manual-weekly-growth (sparse week→%
  grid) and manual-freeze (tick-the-weeks grid) cards.
- Seasonality: unchanged, its own tab.
- Snapshots (renamed from Runs everywhere): the frozen-results library + before/after
  compare (totals delta, all-in overlay, per-queue blocks by name), the tick set lifted
  above tabs, a one-line snapshots-vs-views distinction, and the full Excel package.
- Settings (renamed from Money & engine): engine/hiring-cap/costs/CX/loops, the Global
  starting HC field with helper text (§14.4), the Excel package (§14.8, also on
  Snapshots), and the E1–E3 model notes folded in.

Gate: tests/r1ui.test.js (13 tests) asserts the exact tab order; the context-bar print
action on every tab firing from ≥3 tabs; Summary Set-active changing Plan numbers; a
schedule pivot at week 10 changing late-horizon numbers; a Supported queue's badge +
disabled HC input; the Intraday strip loading a week; the Data new columns + group
tints; editable manual growth/freeze grids; the Excel export firing + a params-CSV
import applying; Snapshots naming; and fixed-width print charts. tests/harness.test.js
runs the §13 checklist (now save-a-snapshot, exports from Settings, per-tab context-bar
print) against both the source and the rebuilt dist/capacity-sim.html. The old
ui/strategies/documents gates were superseded by r1ui + the updated harness and removed.

## Build & run
- `npm test` — all gates (engine, r1, r1ui, harness).
- `npm run build:html` — regenerate dist/ deliverables from source.
- Open dist/capacity-sim.html in any browser (offline) or paste dist/capacity-sim.jsx
  into a React artifact host.
