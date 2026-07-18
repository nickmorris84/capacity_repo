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

## P4 — Data + documents: not started
## P5 — Persistence + packaging: not started
