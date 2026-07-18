# Build Prompt v4: Call Centre Capacity & Workforce Simulation Tool

Copy everything below the line into the builder. v4 supersedes v3. It folds in the corrections discovered while building and testing Mode 1, so treat the **Engineering notes** as constraints, not suggestions.

---

Build me a **self-contained, interactive call centre planning simulator**. Deliverables: a single React artifact **and** a compiled standalone `.html` (React + charts + engine bundled, ~1MB, works offline). It models queues, staffing, hiring strategies, and scenarios; shows whether the operation hits SLA, what it costs including the cost of bad customer experience; and presents an executive summary with risks for Finance, HR, and the Business. Every parameter is editable in the UI; nothing hardcoded. Defaults from section 12 pre-loaded so it is meaningful on first open (2 voice queues, 2 digital queues, 1 service team).

## 0. Build contract — phases and gates
Build in phases; each phase ends with its tests passing before the next begins.
- **P1 Engine + tests** (no UI): Erlang A solver, day models, volume model, workforce loop, strategy allocator, scenario system. Node test file validating everything in section 11.
- **P2 Core UI**: Plan dashboard, ribbon, queue cards, charts, all editors (queues, workforce, money, scenarios, presets).
- **P3 Strategies + views**: side-by-side strategy comparison, scenario views, overlay toggles on every chart/table.
- **P4 Data + documents**: per-queue data tables, xlsx round-trip, Report tab, print-to-PDF with charts.
- **P5 Persistence + packaging**: storage adapter, saved runs, run-file sharing, standalone HTML build, JSDOM interaction test across every tab.
**Compute budget**: any parameter change must resolve in <1s on a laptop. Precompute at most 8 simulations per change (see section 6). Memoise Erlang results; quantise offered load to 0.05 Erlangs for cache reuse. Use a deferred-value/debounce pattern with a visible "recalculating…" state.

## 1. Queues and preset libraries
Each queue (add / duplicate / delete, unlimited): name; type `voice | digital`; base daily volume; **intraday arrival pattern**; AHT (s); digital concurrency; SLA (voice: ASA target s + max abandon %; digital: % responded within X min + backlog limit); patience (s, voice); starting FTE; shrinkage %; fully loaded agent cost; cross-skill flags with priority order; digital `deflectsTo` voice queue.

**Intraday pattern presets** (apply per queue, then hand-edit with per-interval sliders): Double hump (default), Morning-heavy B2B, Evening consumer, Lunchtime spike, Flat, Weekend-shifted. **Editable presets are saveable**: "Save as new preset" adds the edited curve to the library under a user name; presets can be applied to any queue. Same mechanic for seasonality (below). Preset libraries persist via the storage adapter.

## 2. Volume model (precedence is exact)
Weekly base volume per queue = **CSV/xlsx weekly volumes if loaded, else flat daily volume**. Then multiply, in order:
1. **Seasonality** — system-level pattern × queue-level pattern (multiplicative stacking). Seasonality is a named preset of 12 monthly multipliers: built-ins (Flat, Retail Christmas, Summer lull, FY-end Q4, School-term) plus user-saved edits. Applied by calendar month across the horizon from an editable start month.
2. **Growth and event scenarios** (section 5) — growth %/month, launches, P1s, forecast error. These stack on top of CSV volumes too; teams that loaded actuals can simply toggle growth scenarios off. 
3. **Endogenous volume** — digital→voice deflection and abandoned-caller redials (section 4). Always on; shown as distinct stacked segments.

## 3. Staffing, hiring strategies, and the global cap
**No rosters.** Staffing is total HC per queue. The engine computes required agents per 30-min interval, sums to required productive hours, and lays available hours along the **requirement curve** (Engineering note E2). Coverage = available ÷ required hours; 100% ⇒ green everywhere.

**Hiring strategies — computed side by side, always.** The four strategies below are auto-run on every change and compared in a dedicated view (SLA weeks red, headcount trajectory, total cost, churn cost, all-in cost, feasibility). One strategy is marked **active** and drives the main dashboard.
- **S1 Meet requirement**: each week, project supply at the landing week (current pipeline − projected attrition) against projected required FTE; raise requisitions to close the gap.
- **S2 Buffer above requirement**: S1 with target = requirement × (1 + buffer%), buffer editable (default 10%).
- **S3 Forward backfill only**: raise reqs now to replace the leavers projected for the landing week (now + req-to-start + training); never hire for growth.
- **S4 Manual plan**: the user's per-queue hires editor, exactly as entered.
**Global hiring cap**: max total requisitions per week across all queues (recruitment/training is a shared constraint). Per-queue plans draw from it. **When the cap binds, allocate scarce hires by greatest marginal churn cost averted per FTE** (tie-break: earliest projected breach). Surface the allocation: "Week 6: cap 18, plan wants 26; Billing took 12, WhatsApp 6; Tech goes short — projected £41k churn."
**Holistic requirement panel**: total required vs paid vs pipeline across the operation, plus a feasibility verdict ("the cap allows +18/wk; this plan needs +26/wk in weeks 6–9 — infeasible; shortfall lands as churn").

## 4. Workforce dynamics, service teams, CX economics
As v3, with these exact mechanics: hiring pipeline (req-to-start weeks → training weeks → learning-curve ramp; trainees cost full salary, deliver zero; ramping agents deliver curve share); attrition monthly % applied weekly to trained+ramping (not trainees) with attrition-growth slider; **burnout index** accumulating while occupancy exceeds threshold (sensitivity/recovery editable), multiplying attrition (up to max multiplier) and adding absence shrinkage; **tipping point** finding when weekly leavers exceed pipeline throughput. Service teams: shared pools with size, weekly hour cap, proficiency, cost premium, occupancy trigger, covered queues; allocated worst-deficit-first at day level. Cross-skill flexing at day level with a flex proficiency. CX economics: churn propensities (abandon, long wait, digital breach) with repeat-contact uplift; customer base; £ per lost customer; outputs weekly/cumulative churn £ and customers lost, per queue and total; idle-pay vs churn chart with break-even. Deflection: digital backlog above limit converts an editable % into next-day voice volume; abandoned callers redial at an editable %, solved as a fixed point capped at 4× base.

## 5. Scenarios and scenario views
Event types (add unlimited, schedulable, per-queue or global): growth %/month, product launch (ramp/peak/decay), P1 incident (spike %, 1–7 days), forecast error ±%, attrition shock, hiring freeze, reduced training (cut weeks → lower start proficiency, stretched ramp, AHT penalty, repeat-contact uplift).

**Scenario views** answer "many combinations": a **view** is a named set of enabled scenarios. Built-ins: *Plan of record* (all currently enabled) and *No scenarios*. Users create and save views freely (e.g. "Growth + P1", "Bear case"). **Every chart and every table carries a view selector**, and comparison charts can **overlay up to 4 views**. To keep the matrix sane: an overlay compares **either** strategies within the active view, **or** views within the active strategy — a single toggle switches the comparison dimension. (4 strategies + ≤4 views = ≤8 sims per change; enforce the compute budget.)

## 6. Data views — the numbers themselves
Per-queue **data table over time** (a first-class tab): one row per week with **every datapoint — outputs and the assumptions in effect that week**: volume (base / seasonal multiplier / deflected / redial), coverage %, ASA or response, SL %, abandon %, occupancy %, backlog, burnout, leavers, attrition % in effect, reqs raised, hires landing, in training, ramping, trained, paid vs required FTE, running cost, churn cost, customers lost, status. Column groups (Demand / Service / People / Money) with a column picker defaulting to all on; view selector; sticky header; horizontal scroll; per-table CSV export. Read-only (editing stays in the editors — one source of truth).

## 7. Executive summary and risks (Finance · HR · Business)
A **Summary tab** that a leadership pack can be built from, auto-written from the active strategy and view:
- **Verdict paragraph**: RAG counts across queues and weeks, the recommended strategy (**lowest all-in cost that holds SLA**, or least-bad if none holds), and its price vs the alternatives.
- **Three-audience blocks** — *Finance*: run cost, churn £, idle pay, all-in, cost per contact, break-even; *HR*: hiring plan by week vs the global cap, attrition & burnout trajectory, tipping-point margin, training load; *Business/CX*: SLA attainment by queue, customers lost, incident readiness (P1 stress result), deflection volumes.
- **Risk register** (auto-generated, sortable): risk, driver, week it lands, severity (£ and/or SLA), suggested lever (hire earlier / raise cap / service team / flex / reduce training trade-off). Include cap-infeasibility, tipping-point proximity, burnout peaks, deflection spirals, over-capacity carrying cost with **time-to-rectify** under a freeze.

## 8. Report / PDF
A **Report tab** rendering: executive summary, key findings, risk register, **charts**, and tables — then `window.print()`. Charts are SVG (recharts) so they print natively, but ResponsiveContainer collapses in print: render report charts at **fixed pixel widths (~640px)**, `break-inside: avoid`, print stylesheet hiding chrome. Report sections: Summary; Strategy comparison (table + all-in cost chart); per-queue page (KPI table + coverage and headcount charts); Assumptions. iPhone note in UI: Print → pinch out → Share → Save to Files.

## 9. Excel round-trip and files
Use SheetJS. **Export one workbook**: `Summary` (exec summary numbers), `Strategy comparison`, `Findings & risks`, `Parameters` (path, setting, value), `Volumes` (week × queue columns), then **one tab per queue** with the full section-6 table. **Import the same workbook**: read `Parameters` and `Volumes` sheets back (path-addressed patching; ignore output sheets). Also keep: Config JSON export/import, saved-run `.json` files (share a run; recipient imports and compares), and plain CSV fallbacks for results, parameters, volumes.

## 10. Persistence
Storage adapter in priority order: artifact `window.storage` (async get/set/delete/list; missing key throws; ≤5MB/key; slugged keys) → `localStorage` (standalone HTML) → in-memory with a visible notice ("downloads are your durable save"). Saved runs = one key each (`sim-<slug>`: name, savedAt, config, compact weekly results) plus `sim-index`. Preset libraries and scenario views persist the same way. Saved-run compare: totals delta table, all-in cost overlay, **per-queue blocks matched by queue name** (weeks red, avg coverage, worst ASA/SL, cost, churn, coverage chart).

## 11. Engineering notes — non-negotiable, learned from the v3 build
- **E1 Erlang A, not Erlang C.** Pure Erlang C explodes as agents → offered load; real callers abandon and lighten the load. Solve M/M/N+M self-consistently: abandoned calls consume no handle time, so served load Aeff = A(1−ab); find ab by bisection on ab = C(N,Aeff)·γ/(γ+drain), γ=1/patience, drain=(N−Aeff)/AHT; ASA = C/(drain+γ); SL = 1−C+C·(drain/(γ+drain))·(1−e^−(drain+γ)t). **Validate three limits**: patience→∞ reproduces textbook Erlang C (A=10, AHT=180s, N=13 ⇒ C=0.2853, ASA=17.0s); deep overload ⇒ abandonment → 1−N/A; ASA bounded and monotone through N=A. Blend fractional agents by interpolating ⌊N⌋ and ⌈N⌉ results.
- **E2 Supply follows the requirement curve, not the demand curve.** Erlang economies of scale mean quiet intervals need proportionally more agents; distributing hours by demand share fabricates abandonment at off-peak. Compute required agents per interval, lay available hours along that curve; coverage becomes a single honest number. State it in model notes as best-case vs real rostering.
- **E3 Digital = fluid backlog model.** Arrivals uniform within an interval; wait runs linearly from backlog/serviceRate at interval start to end; derive in-SLA share from that ramp; backlog carries across intervals, days, weeks. No Erlang scale effect: requirement = demand ÷ concurrency ÷ occupancy ceiling.
- **E4 Deferred-state safety.** With deferred/debounced recompute, charts and cards must read the config **the simulation ran with** (`sim.config`), never live state — otherwise adding/deleting a queue crashes mid-defer.
- **E5 Order of solve per day**: digital first (produces deflection) → voice with redial fixed point (≤3 iterations, 4× volume guard) → accumulate; service teams and flexing allocated before either, worst deficit first.
- **E6 Numbers hygiene**: guard zero agents, zero volume, occupancy ≥100% (breach, never NaN); attrition never applied to trainees; costs weekly = annual/52.

## 12. Defaults (pre-load exactly; all editable)
| Group | Parameter | Default |
|---|---|---|
| Engine | Horizon / hours / interval | 26 wk / 08:00–20:00 / 30 min |
| Engine | Occupancy ceiling / currency | 85% / £ |
| Engine | Days per week / FTE hrs/day / FTE days | 7 / 8 / 5 |
| Voice A "Billing" | Volume / AHT / ASA / abandon / patience / FTE | 2,000/d · 300s · 30s · 5% · 90s · 63 |
| Voice B "Technical" | Volume / AHT / ASA / abandon / patience / FTE | 900/d · 420s · 45s · 6% · 100s · 47 |
| Digital A "WhatsApp" | Volume / HT / conc / SLA / backlog / FTE | 1,400/d · 420s · 2.5 · 80% in 5m · 150 · 20 |
| Digital B "Chat" | Volume / HT / conc / SLA / backlog / FTE | 700/d · 360s · 2.0 · 80% in 3m · 80 · 11 |
| Workforce | Attrition / req-to-start / training / curve | 4%/mo · 6 wk · 4 wk · 60/75/90/100% |
| Hiring | **Global cap** / buffer / active strategy | **18/wk** / +10% / S1 |
| Burnout | Threshold / sens / recovery / attr mult / absence | 85% · 1.5 · 8 · 2× · +5% |
| Service team | Size / prem / prof / trigger / hours | 12 · +20% · 80% · occ>90% · 20h/wk |
| Costs | Agent v/d / manager / ratio | £32k / £30k / £48k / 1:12 |
| CX | Base / £ per lost / churn a-w-d / repeat | 200k · £500 · 3%/1.5%/2% · ×1.5 |
| Loops | Redial / deflection | 30% / 40% |
| Seasonality | System preset / queue presets | Flat / Flat |
| Views | Built-in | Plan of record · No scenarios |

## 13. Quality bar
- P1 node tests green (E1 validations, allocation under a binding cap, precedence of the volume model, deflection round trip).
- JSDOM interaction test: click every tab, add/duplicate/delete a queue, add scenarios and toggle them, save a run, tick it, verify per-queue comparison renders, fire every export, load a parameters CSV back, print view renders.
- Standalone HTML mounts clean in JSDOM with no console errors.
- Model notes tab explaining E1–E3 in plain language.

Ask up to 5 clarifying questions only if something materially affects architecture; otherwise begin with P1.

## 14. Revision 1

14.1 Strategy model. Strategies become a config array; built-ins S1–S4 remain, and users add custom strategies by parameterising the common types: {name, baseType: meet|buffer|backfill|manual|schedule, bufferPct, excludedQueueIds[], segments[]}. The active strategy is a schedule — an ordered list of segments [{fromWeek, strategyId}] with a single segment (week 1) as the default, so "S3 until week 10, S1 after" is first-class. `decideHiring` looks up the strategy in force at each decision week; cohorts already in the pipeline when a pivot happens simply continue (realistic). A schedule can be saved as a named strategy (baseType "schedule") so merged approaches are reusable and comparable. The four comparison strategies remain pure single-type runs; the active plan may be a schedule.

14.2 Supported queues. Each queue has resourcing mode `resourced | supported`. Supported ⇒ starting HC forced 0, hiring strategies and the allocator skip it entirely, and it is served only from supporter queues' spare hours and service teams. Supported queues keep their SLA RAG and appear in findings, badged "supported".

14.3 Support routing. Replace `crossSkill` with `supports: [{queueId, priority, maxSharePct?}]` (outbound). Allocation is by priority tier, proportional within a tier: recipients with priority 1 are considered first; if a tier's combined need exceeds the donor's spare, the spare splits proportionally to each recipient's deficit; any remainder flows to the next tier. `maxSharePct` is an optional cap on the share of the donor's spare any one recipient may take. A donor never drops below its own requirement. Derive and expose the inbound "supported by" list per queue.

14.4 Global starting HC. Settings gains `globalStartingHC`. Queues with blank HC receive shares of (global − Σ explicit) workload-weighted: volume × AHT ÷ concurrency; explicit per-queue HC always wins.

14.5 Scenarios. `growth` gains `stopWeek` (multiplier holds flat after it). New additional types (existing scenarios untouched): `growthManual` {weeklyPct: sparse map week→%} — in weeks where a value exists it overrides the compounding growth multiplier for that week only; `freezeManual` {weeks: number[]} — no requisitions raised in listed weeks.

14.6 Reporting fields. Weekly per-queue record additionally exposes: startingHC (week-0 resolved HC), active (= trained + ramping, excluding trainees), leavers # and attrition %/month in effect, volume on status cards. All "Paid/Req" labels become Active/Req; the coverage chart is titled simply Coverage. Hiring summary aggregates per queue and for Voice / Digital / Overall: volume, HC required, hiring (pipeline+reqs), training, active, agent churn (# and %).

14.7 Views vs snapshots. Runs are renamed Snapshots: frozen results for before/after comparison and sharing. Views remain live scenario lenses on the current model. One shared comparison surface; one line of UI copy stating the distinction.

14.8 Print and package. The global context bar carries a "Print / PDF this page" action on every tab (per-tab print stylesheet; charts render at fixed widths in print). The Summary tab's own button prints the Summary layout. The full Excel package (workbook per SPEC §9: Summary, Strategy comparison, Findings & risks, Parameters, Volumes, one tab per queue) remains exportable and importable after the restructure, reachable from both Settings and Snapshots.
