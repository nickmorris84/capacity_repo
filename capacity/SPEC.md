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

## SPEC §15 — Concept model
Brand → groups queues; carries exactly ONE parameter block: its training profile (§16). Channel templates (voice / digital / support): full parameter sets inherited by queues at section level. Queue: identity (name, brand, channel), volumes, resourcing mode (dedicated | leveraged | unmanned), priority number, dependency list, section overrides. Pool: explicit cross-brand/cross-channel sharing group {name, members: [{queueId, sharePct}]}. Scenario group: named set of scenarios — the matrix rows; groups REPLACE views everywhere. Snapshot: frozen run. Volume profile: complexity mix {segments: [{label, sharePct, aht, skill(dormant)}]}; blended AHT = Σ share×aht feeds the existing Erlang engine unchanged.

## SPEC §16 — Parameter architecture ("where globals live")
Three layers + one exception. Resolution: queue override → channel template → Settings default. Brand training profile inserts ONLY for training params: queue override → brand training profile → Settings default.

* Settings (physics): OT rules (max 2 h/day/agent, weekly ceiling default 10h, premium ×1.5), training defaults (weeks, learning curve, training-shrinkage % default 5 of the 30 shrinkage points), training-debt constants (accumulation, recovery, max AHT penalty +8%, max attrition ×1.5), knock-on defaults per channel (repeat %, spill % and default spill target), burnout constants, churn economics, hiring cap, currency, simulation window: default 52 weeks, editable, minimum 24, maximum 78 (24 floors it because the 10-week hire-to-productive pipeline plus ramp needs room to matter), libraries: seasonality presets, intraday presets, volume profiles.
* Channel template: SLAs, AHT, arrival pattern, workforce (attrition, base shrinkage), knock-on overrides, seasonality — each a section a queue inherits or overrides whole.
* Brand: training profile {trainingWeeks, learningCurve, trainingShrinkagePct} only. New cohorts train per their queue's brand.
* Audit contract: the Data tab (and a dropdown per queue card) shows resolved assumptions over time: per week — volume after profile/seasonality/scenarios, blended AHT in effect, SLA in effect, attrition in effect, training shrinkage in effect, OT used, active scenarios by tag. If it isn't visible there, it may not exist as a parameter.

## SPEC §17 — Supply ladder & resourcing
Per queue, capacity is assembled strictly in this order; each rung exhausts before the next:

1. Own regular hours (HC × productive hours, base shrinkage applied).
2. Own overtime — hard cap 2 h/agent/day AND the weekly ceiling; OT hours cost premium and feed the burnout index.
3. Training reclaim — convert up to trainingShrinkagePct back to service hours; reclaimed share accrues training debt (index 0–100): AHT multiplier up to +8% and attrition multiplier up to ×1.5 at full debt; decays when training restored. Scenario-controllable (§19 "people" parameter).
4. Intra-brand recycling (automatic): any same-brand queue's genuine spare (above its own requirement) flows to same-brand service and unmanned queues in deficit, ordered by the receiving queues' priority numbers, proportional within a priority, honouring dependency lists.
5. Pool draw: pools aggregate members' spare; members under joint pool demand may additionally reclaim training (rung-3 mechanics, own debt) to feed the pool; never below own requirement. Allocation across pool recipients: no priorities — concurrent deficits share pro-rata (deterministic FCFS). Pools serve across brands and channels.
6. Leveraged pull (sacrifice): leveraged queues surrender capacity up to their cap to their declared targets (single queue, list, or anything-above-in-priority) even when it hurts them — their backlog grows, their SLA RAGs honestly. Unmanned queues: zero staff, real SLA + RAG + "unmanned" badge, served only via rungs 4–5. Dedicated queues never donate. Service teams are DELETED as a concept — migrate each to a leveraged support-channel queue.

## SPEC §18 — Volumes & profiles
Volume entry per brand: EITHER per-queue volumes (as today) OR a brand volume split by editable proportional shares across its queues. Precedence chain becomes: (brand-share | per-queue | CSV weekly) → volume profile (blended AHT) → seasonality (system × queue) → scenarios → endogenous knock-on. Knock-on generalised: every queue carries {repeatPct, spillPct, spillTargetQueue} (channel defaults in Settings; migration: voice redial 30%→repeat, digital deflection 40%→spill). Scenarios may shift a queue's profile shares over time; shares auto-normalise; ≤6 segments.

## SPEC §19 — Unified scenarios, groups, matrix
One scenario shape replaces all bespoke types: {name, tag: growth|launch|digitization|p1|custom, parameter: volume | aht | sla | profileShares | people(headcountStep | attritionDelta | hiringFreeze | trainingShrinkage), mechanism: step | growthRate | manualSeries, granularity: day|week|month, startWeek, stopWeek, scope: template|brand|queue list}. Old scenarios migrate to equivalents (P1 incident = day-granular volume manualSeries; reduced training = people.trainingShrinkage + aht step). Groups bundle scenarios; built-ins "Plan of record" and "No scenarios". Decision matrix: rows = groups, columns = hiring strategies, BOTH in definition order — never reordered by selection or results. Cell = RAG + all-in £ + flags (weeks red, tipping ⚠, cap ⚠). Computed on demand ("Run matrix"), cached, greys with a "stale — re-run" banner on any config change; the SELECTED cell (group × strategy) is the global context pair rendered live on every tab.

## SPEC §20 — Presentation
Weekly engine, monthly presentation rollups in Summary tables and the PDF. Summary rollup: Total → Brand → Voice/Digital/Support → Queue. Finance box gains OT cost; hiring summary gains OT required + OT cost + training debt peak. Context bar (every tab, in this order): Strategy selector · Scenario-group selector · Snapshot selector — these three drive every number rendered below. Snapshot semantics: selecting a snapshot renders its frozen data across all tabs with a visible "viewing snapshot — read-only" banner and editors disabled; selecting "Live" returns to the current model. Plus Print/PDF-this-page. Excel package gains sheets: Brands, Pools, Profiles, Groups; Parameters + Volumes remain importable.

## SPEC §20a — Risk framework (extensive, parameterised)
The Summary risk register is a first-class output covering every risk family the engine can detect, each row: risk, driver, queue/brand, week it lands, severity (£ and/or SLA), suggested lever. Families: SLA breach runs; hiring-cap infeasibility; tipping point (and proximity within a settable margin); burnout peaks; training-debt peaks; sustained-overtime dependence (OT used ≥ X consecutive weeks); leveraged-donor damage (a leveraged queue driven red by its own pulls); unmanned starvation (unmanned queue below a floor coverage for ≥ N weeks); knock-on spiral (repeat+spill share of volume above a threshold); over-capacity carrying cost with time-to-rectify; borrowed-capacity dependence (any queue meeting > X% of requirement from pools/leverage — a resilience risk even when green). Settings gains a "Risk parameters" section holding every threshold above (amber and red bands per family, editable). The register is computed from thresholds at render time — changing a threshold re-scores risks instantly without re-simulating. Engine support: the weekly per-queue record must expose otHours, otStreakWeeks, borrowedSharePct (pool + leveraged + recycled inflow ÷ required hours), and trainingDebt so the UI can threshold them.

## SPEC §21 — Migration (P7a ships these shims, tested)
Default brand "Brand 1" adopts all existing queues; service teams → leveraged support queues (size→HC, premium retained as cost note, trigger→cap heuristic); views→groups 1:1; old scenario types → unified equivalents preserving numeric behaviour; crossSkill/supports carry into dependency lists unchanged.

## SPEC §22 — P7a engine gates (ALL existing tests stay green — hard regression gate)
New tests, hand-computed where marked:

* OT: capacity uplift = min(2×daysWorked, weeklyCeiling)×agents exactly (hand); OT hours cost premium; OT feeds burnout.
* Training reclaim: rung order proven (a config where OT alone insufficient → reclaim engages only after OT cap); debt accumulates ∝ reclaimed share, decays on restore; AHT multiplier and attrition multiplier scale with debt (spot values); scenario people.trainingShrinkage forces the same path.
* Brand training: two brands, different trainingWeeks — cohorts graduate on their brand's schedule (hand-checked landing weeks).
* Recycling: same-brand spare reaches an unmanned queue before any pool; donor never below requirement (hand).
* Pool: two recipients deficits 6:3 share pool 2:1 (hand); member training-feed capped at trainingShrinkagePct; cross-brand draw works; no priority ordering applied.
* Profiles: blended AHT = Σ share×aht (hand); scenario shifting shares moves required FTE in the right direction and magnitude.
* Brand volume split: shares normalise; per-queue explicit volumes win.
* Unified scenarios: each migrated legacy scenario reproduces its old numeric effect within 1%; day-granular manualSeries hits only its days.
* Knock-on generalisation: legacy redial/deflection numbers reproduced exactly via repeat/spill.
* Risk-support fields: weekly record carries otHours, otStreakWeeks, borrowedSharePct, trainingDebt; spot-check a hand-built case (a queue meeting 30% of requirement from a pool shows borrowedSharePct ≈ 30).
* Horizon bounds: engine clamps horizonWeeks to [24, 78]; default config is 52.
* Matrix: 5×5 at 52 weeks completes < 8 s; single live sim < 400 ms at 52 weeks (budget updated from 26-week era).

## SPEC §24 — Revision 3

§24.1 Knock-on, simplified. Per queue exactly two figures: Repeat contacts % (failed contacts that retry this queue) and Converts to calls % with a target call queue (default: the brand's primary voice queue). Same engine mechanics as repeat/spill; migration maps old values 1:1 and must reproduce legacy numbers exactly.

§24.2 Sharing, decentralised. Pool entities are DELETED. Each queue declares: share % of its spare + shares-with list (any queues, any brand). Offered spare = sharePct × (capacity − own requirement); recipients in deficit draw pro-rata by deficit, no priorities; donors may reclaim training (rung-3 mechanics, own debt) to honour sharing when recipients are in deficit; donor never below own requirement. Migration decomposes existing pools into per-queue declarations preserving behaviour.

§24.3 Hiring cap hierarchy. Settings holds a caps matrix per brand × channel (required), plus OPTIONAL per-brand ceilings and an OPTIONAL total ceiling. Effective limit = the tightest applicable. Allocator: marginal-churn allocation within each segment cap as today; if a brand or total ceiling then binds, trim grants across segments starting from the lowest marginal. Trace names which level bound ("Brand A ceiling", "Total").

§24.4 Strategy parameters editable. Built-ins carry editable params: S2 bufferPct; S3 forwardMonths (1–6, default 3). Custom strategies edit the same params. Schedules unchanged.

§24.5 Digital subtypes. Digital queues carry subtype: Digital Customer (live interaction: concurrency, SLA in minutes) or Digital Workflow (backlog processing: no concurrency, handle time per item, SLA in hours, default 90% within 24h). A brand/channel may mix subtypes across its queues — the subtype is chosen per queue.

§24.6 Volume model. Volumes are a weekly series anchored to a week-1 calendar date set in Settings. Entry per queue OR inherited from brand/channel with editable shares (queue opt-out requires its own series): (a) paste a CSV weekly list (52+), or (b) enter one weekly figure and run the seasonality wizard, which generates the series (base × seasonal multipliers from the start date) — UI carries a one-line explanation of exactly that. Either way the series remains fully editable.

§24.7 Monthly costs. Agent cost is input per month everywhere; engine converts (×12 ÷ 52 for weekly); financial outputs report monthly and annual.

§24.8 Group-scoped scenarios. Scope lives on the scenario GROUP (targets: brands / channels / queues); factors inside inherit it.

§24.9 Simulation lifecycle. New simulation = Duplicate current config | Start from defaults | Start truly blank (no brands, no queues; UI shows a build-from-nothing empty state).

§24.10 Settings. Week-1 date; the caps matrix; Business-box data support (per-queue SLA target + simulated RAG).

### §24 gate tests (hand-computed where marked)
Legacy knock-on reproduced exactly post-migration; sharing — donor spare 10h at 60% share, recipients deficits 6:3 draw 6h split 4:2 (hand); cap trimming — segment grants then a binding total ceiling trims lowest-marginal first (hand); S3 forwardMonths=1 vs 6 changes req timing in the right direction; workflow subtype — 24h SLA maths on a hand-built backlog case; series anchoring — seasonality wizard week 1 uses the Settings date's month; monthly→weekly cost conversion exact; blank config simulates without crashing (empty world = empty results, no NaN). Plus the ENTIRE existing battery, unmodified.

## SPEC §25 — Revision 3d: Digital Customer under Erlang

§25.1 Model. Digital Customer queues are LIVE interactions and now use the validated Erlang A solver: servers = agents × concurrency (fractional blending already exists), AHT unchanged, with a patience parameter (default 180s) and abandonment output. SLA "X% within Y minutes" maps directly to the Erlang service-level at Y×60 seconds. The carrying backlog is REMOVED for this subtype — abandonment replaces it. Digital Workflow and Service Workflow keep the fluid backlog model unchanged; this split is the point: live work abandons, deferred work queues.

§25.2 Requirement. Minimal-server search (existing) on effective servers; required agents = N_servers ÷ concurrency.

§25.3 Knock-on. For Digital Customer, converts-to-calls now triggers on abandoned volume × convert % (was backlog excess); repeat % applies to abandons. State in Model notes that the servers=agents×concurrency treatment is the standard chat approximation and mildly optimistic about juggling costs.

§25.4 Migration. Existing Digital Customer queues gain patience=180s and maxAbandon=5% defaults; backlogLimit is retired for them (retained on Workflow). PROGRESS.md must record: "numeric results for Digital Customer queues intentionally changed at R3d-A."

### §25 gate tests (hand-computed where marked)
10 agents × concurrency 2.5 ⇒ results identical to voiceRaw at N=25 with the same A/AHT/patience/target (hand); requirement search returns agents such that ceil(agents×2.5) is minimal-N (hand); a Workflow queue's results are bit-identical before/after this change (regression isolation); abandoned-chat conversion feeds the target voice queue next day (adapt the existing deflection round-trip test); small-team scale penalty visible: 4 agents @2.5 vs 10 agents @1.0 same offered load — the 4-agent case shows worse SL (economies of scale now real). ENTIRE existing battery green except any test that asserted digital-customer backlog behaviour — those may be UPDATED to the new physics but each change must be listed in PROGRESS.md with one-line justification.

## SPEC §26 — Multi-simulation shell (R4)

No engine changes anywhere in R4 — `git diff engine/` must be empty in both gates.

§26.1 Two-level app. Level 1: the **Landing** — the app opens here. Level 2: the existing **Simulation workspace**, unchanged internally except as §26.4 states. The workspace header gains "← Simulations" back-navigation; the top-right "New simulation" menu is REMOVED (the landing owns creation).

§26.2 Storage schema. A `sim-list` index plus one record per simulation `simulation-<id>`: {id, name, createdAt, updatedAt, config, matrixCache, selectedPair, runs[]}. A **Run** = {name, savedAt, full config incl. strategy definitions/schedule/scenario groups/selected pair, results for the selected pair, matrix cache if fresh}. The live config AUTO-SAVES continuously; the context-bar **Save** button creates a Run (name prompt, timestamp default). Legacy snapshots migrate to Runs. Migration (gate-tested): existing single-config storage auto-converts to "Simulation 1" with its runs (converted from snapshots), matrix cache and selected pair intact — zero data loss. updatedAt stamps on every save.

§26.3 Landing page. A card per simulation (name, updatedAt, run count, headline: horizon, brands, queues, last all-in £ if cached) with Open / Rename / Duplicate / Delete (delete = typed-confirmation, destructive). Plus: **New simulation** (§26.5), **Compare** (Session B; a visible "coming in part B" state is acceptable in A), **Global presets** (§26.6; stub acceptable in A).

§26.4 Workspace changes. The Runs/Snapshots tab is REMOVED from the workspace; the context bar gains **Save** (creates a Run per §26.2); run management and comparison live on the landing. The Settings tab is renamed **Simulation Settings** and restructured into full-width **collapsible sections** (one open at a time optional, all collapsed by default except the first): **Start** (global starting HC + week-1 date together, first section), Simulation window & currency, Hiring caps matrix, Workforce physics (OT, training, debt, burnout), Knock-on defaults, CX economics, Risk parameters. The three preset libraries LEAVE this tab (→ §26.6).

§26.5 New-simulation flow. The landing "New simulation" asks: **(a) Inherit settings from another** → pick the source simulation → its Simulation Settings are copied → continue into the wizard at the Brands step; **(b) Inherit settings, brands, channels and queues from another** → full config copy (runs and matrix cache NOT copied), prompt for a name, open the workspace; **(c) From scratch** → wizard: Step 1 Simulation Settings pre-filled with defaults (editable inline), Step 2 Brands (add one or more), Step 3 Channels (create from the global channel presets: Voice, Digital Customer, Digital Workflow, Service Workflow), Step 4 Queues (per queue: name, brand, channel, quick volume — a single weekly figure with the seasonality-wizard option; full editing later in the workspace), Finish → workspace. Back/next navigation, a progress indicator, escape-to-landing.

§26.6 Global presets (landing) — Session B. The ONLY place presets are created or edited: **Channel presets** (four built-ins — Voice, Digital Customer, Digital Workflow, Service Workflow — plus user-created), **Arrival patterns**, **Seasonality** — full create/edit/delete, available to every simulation and persisted app-wide (not per-simulation). All in-simulation preset creation/editing affordances are REMOVED (the Simulation-Settings "Preset libraries" section that A kept is deleted); workspace pickers read the global library only and can only APPLY. Apply semantics are **copy-on-apply**: applying a pattern copies its values into the simulation and stores provenance `{presetId, presetName, appliedAt}`; the engine reads the copied values, never the live library, so a landing edit never silently mutates a simulation or its Runs. Each applied use carries a **"Re-sync from global"** action: it detects when the global preset has diverged from the applied copy, previews the diff (old→new), and copies the new values on demand (re-stamping appliedAt). Creating a channel inside a simulation copies the chosen channel preset's template (copy-on-apply too — later preset edits don't touch existing channels). Deleting a seasonality or arrival preset that a simulation still references (by provenance) is BLOCKED with a message naming the simulations using it; built-in presets cannot be deleted.

§26.7 Compare (landing) — Session B. Verdict-first. Comparator picker: a unified list grouped by simulation → its Runs plus a **"Live now"** entry per simulation; select 2–4; each comparator gets a persistent colour chip used everywhere. One comparator is the **reference** (default: first selected; switchable), and every delta re-bases when it changes. Layout, top to bottom: (1) **Headline strip** — one card per comparator (name + live/run-date label, all-in £, weeks red, customers lost), best all-in highlighted, with a one-line auto-verdict vs the reference; (2) **"What changed"** — an exact config diff (Runs carry full config) between the reference and each comparator: changed scalar assumptions (label, old→new), added/removed scenario factors, and strategy changes; (3) three collapsible sections — **Money** (all-in overlay + cost delta table), **Service** (coverage overlay + weeks-red-per-queue heat strip), **People** (headcount, attrition, burnout deltas) — every figure a value + delta chip vs the reference, coloured by good/bad DIRECTION (cost up = red, coverage up = green), never by arithmetic sign; (4) **per-queue accordion**, sorted by largest absolute delta first, matched by queue name across comparators. Live comparators compute on demand with a progress state and cache until their simulation's updatedAt changes; Runs render instantly. Containment holds — nothing scrolls the page horizontally.

### §26 gate tests
Session A (§26.1–§26.5): migration seed → "Simulation 1" with snapshots as Runs; landing renders; create via (b) duplicates everything except runs; wizard (c) end-to-end simulates; rename persists; typed-confirmation delete removes only its record; back-navigation round-trips; no workspace New-simulation menu / no Runs tab, Save creates a named Run; Simulation Settings collapsible sections with Start first.
Session B (§26.6–§26.7): JSDOM — no preset-creation affordance exists inside the workspace; editing a global seasonality preset leaves a simulation using it unchanged until Re-sync, then it changes, and its saved Runs never change; comparing a live simulation against a Run renders headline cards with labels and the auto-verdict; the What-changed panel lists a deliberately induced config difference (change attrition, save a Run, compare against live — the diff names attrition old→new); delta chips colour by direction (a cost increase renders red, a coverage increase green); switching the reference re-bases every delta; the per-queue accordion orders by absolute delta; deleting a preset in use is blocked with a message naming the simulations using it. Full battery green, engine diff empty, `/dist` rebuilt.
