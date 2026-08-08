# Progress

> **Baselines:** [SPEC-V2.md](./SPEC-V2.md) — the shipping v2.4 product ·
> [DOMAIN-MODEL.md](./DOMAIN-MODEL.md) — the v1.2 domain redesign (FINAL) ·
> [REVIEW-SETUP.md](./REVIEW-SETUP.md) — the signed-off Setup spec ·
> [GAP-ANALYSIS.md](./GAP-ANALYSIS.md) — the measured v1→v2.4 feature diff.
> This file is the running build log: how it got here, phase by phase.

## DOMAIN REDESIGN — F1: THE SWAP ✅ — the six-tab app ships

The domain model is now THE model:

- **One cfg boundary** — `ui/v2/compute.js` gains `toEngineCfg()`: domain
  models go through the bridge, v2.4 models keep the old adapter, so the
  Results/Levers component gates (which mount with v2 fixtures) stay green
  while the app runs on the domain path.
- **App shell** — `App.jsx` holds ONE model (domain): restored from the v3
  key, else a stored v2.4 save migrates, else the packaged default
  migrates. Setup routes to the six-tab shell; classic SetupPage remains
  only as a gate-covered component. "New simulation" = blank domain model
  with the engine-defaults carry (empty world still simulates). Autosave →
  `capacity.v3.model`.
- **Levers/Results on the bridge** — Levers ops already edit only
  `engineConfig` (shape-agnostic); Results' risk-register BU filter made
  shape-aware (flat BUs + homeBuId vs the old nested structure).
- **Template v3 in the app** — `ui/v2/template-domain-xlsx.js` (SheetJS
  binding over model/template-domain.js); the shell gets Download/Upload +
  the domain import report banner (counts, errors, warnings, dismissible).
- **Docs** — SPEC-V3.md written as the new baseline (SPEC-V2 bannered as
  superseded in its Setup/model sections); GAP-ANALYSIS gains §5 RE-SCORE:
  editable fields ~32 → ~95, queue params ~10 → ~30, globals 0 → ~26, and
  both ⛔ functional holes (manual hires, seasonality) closed — remaining
  gaps are Results-side analysis depth.
- Integration gate updated to the six-tab world (estate-row cascade edit →
  Results data; empty-model progress strip; v3 autosave key).

**Full suite: 32 gates green; dist ships the six-tab app; artifact
republished.** Next: the style pass (owner-queued), then Results/Levers/
Home depth per GAP-ANALYSIS §5.

## DOMAIN REDESIGN — U5 + U6: Volume cascade grid · Map · Defaults ✅ (two new gates)

**U5 — the cascade grid** (REVIEW-SETUP §3.4). Rows are the spine (estate →
brand → BU → request type → channel), one value input per row, a provenance
badge (`entered` · `equal split` · `scaled ▲` · `sum`) and a shape cell.
Type at ANY row: entered figures are authoritative beneath them, entered
finer figures act as weights, the rest split equally, over-runs are scaled
AND spelled out in the notes panel (V5, "scaled ×0.6"). Shape cell opens an
editor: seasonality presets expand to 52-week series against the row's
daily figure, or paste 52 values (wrong counts rejected with a reason);
children show `inherited`. `tests/volume-ui.test.js` (7) — including THE
OWNER'S WORKED EXAMPLE driven through the UI: brand 10,000 + Collections
5,000 ⇒ siblings 2,500 each [equal], two-channel type splits 1,250/1,250.

**U6 — Map + Defaults** (REVIEW-SETUP §3.5–3.6). The Map is a PURE generated
artefact: queue nodes placed by journey depth with derived vol/day, flow
edges entirely from process steps (labelled `split % · sample %`),
capacity links (supports · cross-skill · service-team covers) DASHED and
purple, distinct from flow; tap a node → details + "Edit in Queues"; the
validation panel lives here with a jump-link per issue (V3 → Request
types, V1/V5 → Volume); empty models render a hint, never a crash.
Defaults is one scrolling form over the engineConfig carry: Simulation
frame (10 fields) · Workforce policy (hiring cap/buffer) · Overtime
(settings.ot ×4) · Cost model · Customer behaviour (6) · Pattern
libraries (system seasonality preset + start month — the same library
powering Volume's shape chips). `tests/map-defaults-ui.test.js` (7).

**Full suite: 32 gates green; dist rebuilt; artifact republished.** All six
tabs are now live editors. Next: F1 — re-plumb Levers/Results to the
bridge, swap the packaged app to the new Setup, rewrite SPEC-V2, re-score
GAP-ANALYSIS. Style pass to follow F1 (owner: "get it working, then style").

## DOMAIN REDESIGN — U4: the Queues tab ✅ (new gate green)

The deep editor per REVIEW-SETUP §3.2 (after the U3-checkpoint lighten pass
and a phone-layout pass — owner: "get it working, style pass later"):

- **Master list grouped by home** (brand › BU · Global — no home · Shared
  capacity), rows carrying derived vol/AHT, modified dots and the blast
  radius ("2 processes · 1 brand" / "unused").
- **Six KPI families** in one scroll (Inputs · Performance · Efficiency ·
  Workforce · Customer · Outputs), each with an **Advanced disclosure** for
  the long tail — ~30 engine params restored: home/type/fallback AHT,
  priority, concurrency, backlog limit, subtype (Workflow/Customer),
  deflects-to; voice ASA/abandon/patience vs digital SLA-within/target;
  occupancy + the burnout block (threshold, sensitivity, recovery, max
  attrition ×, absence uplift); resourcing, starting FTE, shrinkage,
  attrition, req→start, training, learning curve, cross-skill and supports
  chips; churn; agent cost. Voice/digital fields swap by queue type.
- **Manual hires** (week × heads rows) in Workforce — S4's input.
- **Service teams** as the Shared capacity group: eight params + covers
  chips, add/delete.
- Guarded delete (in-use marker), reset-to-defaults clears the dot.
- `tests/queues-ui.test.js` (10) — grouping, families, advanced content,
  hires UI, digital/voice swap, rename + home regrouping live, guards,
  teams, and the **S4 proof**: hires authored through the domain model
  reach the engine (`wf.hires`) and trained staffing rises after the
  planned week. Zero console noise.

**Full suite: 30 gates green; dist rebuilt; artifact republished.**
Next: U5 (the Volume cascade grid) — user checkpoint after.

## DOMAIN REDESIGN — U3: the Request types tab ✅ (new gate green) — CHECKPOINT

The heart of Setup — the ONLY linking surface — as a master–detail editor
per REVIEW-SETUP §3.3:

- **Master list**: name · validity glyph (● / ▲ / ✕ from live validation) ·
  group + product chips · assignment summary · channels with processes.
- **Identity** — name, activity, product-request, process group and product
  selects (registry-driven), AHT override (blank ⇒ queue AHT).
- **Assignment** — brand and BU toggle chips; **empty ⇒ All, spelled out**
  ("Applies to: all brands · Customer Service"); V2 double-cover warnings
  render inline right where the overlap is created.
- **Processes, one per enabled channel** — channel picker chips add a
  process; each is a journey editor: entry step labelled, ordered steps with
  queue select · split % · sampling % (governance queues only) · an "ends"
  terminal toggle + outcome select from the process's enumerated outcomes;
  outcome chips add/remove with in-use outcomes protected; the **p/(1−p)
  multi-round rework figure computed per sub-100% branch** (60% branch ⇒
  eff. 150%); V3 end-point completeness inline AND on the row/tab glyphs.
- Guarded delete (volume entries block, summarised).
- `tests/rt-ui.test.js` (11) — incl. **THE CASCADE PROOF**: editing the 60%
  verification split to 100% moves the derived queue volume on the Queues
  tab to 702/day, live; double-cover inline; V3 flag → clear round trip;
  outcome chip lifecycle; channel add/remove; guards; zero console noise.

**Full suite: 29 gates green; dist rebuilt.** CHECKPOINT: the core editing
loop is reviewable in the packaged app. Next: U4 (Queues editor depth).

## DOMAIN REDESIGN — U2: the Structure tab ✅ (new gate green)

The registry per REVIEW-SETUP §3.1, live in the shell's first tab:

- **Five flat lists, editable** — Brands · Business units · Channels ·
  Process groups · Products. Add seeds a named row; **rename is an inline
  input that propagates by id** (the gate renames Acme and finds the new
  name in Request types' assignment line); **delete is guarded** (V6): a
  clean entry gets a live ✕, a referenced one shows an amber "▲ in use —
  2 request types · 3 queues · 2 volume entries" summary instead — the
  pure-reducer guard (M1) means a blocked delete cannot change the model.
- **Channels enable from the taxonomy** — enabled channels are rows; the
  taxonomy remainder renders as "+ Third party"-style chips. Each enabled
  channel carries **channel defaults** (globals category B: ASA, abandon,
  patience, concurrency, SLA within/target) behind a "defaults" disclosure;
  values live on the model (percent fields stored as fractions), and a ●
  marker shows on rows with defaults set.
- `tests/structure-ui.test.js` (9) — five lists, add + badge movement,
  rename propagation into another tab, guard messages incl. dependents
  summary, taxonomy enable/disable with the used-channel block, defaults
  persistence through close/reopen, zero console noise.

**Full suite: 28 gates green; dist rebuilt.** Next: U3 (Request types —
the heart), user checkpoint after.

## DOMAIN REDESIGN — U1: the six-tab Setup shell ✅ (new gate green) — CHECKPOINT

The navigation shell per REVIEW-SETUP §2, over the domain model:
**Structure │ Queues │ Request types │ Volume │ Map │ Defaults** — the order
is the dependency order.

- `ui/v2/SetupV3Page.jsx` — the shell. Completion state on every tab
  (● / ▲ + a live badge: entity counts, error counts, uncovered-volume
  count, validation state, engine-defaults presence); a slim progress strip
  that names the next thing to do and jumps there (green "Model complete"
  when every tab checks out). Queues carries the master–detail scaffold
  (list with DERIVED vol/day + eff. AHT and markers; detail pane with
  blast radius "used in N processes across M brands"). Every panel renders
  a live read-only view of the model — five flat registry lists, request-type
  wiring with step chains/sampling/outcomes, volume entries with scope
  addresses, the Map validation panel, engine defaults — so the shell is
  reviewable before the editors land (U2–U6).
- **App threading** — `App.jsx` now carries the domain model alongside the
  v2 model: restored from the v3 key (store-domain), else migrated live from
  the v2 model; debounce-autosaved. Classic Setup gains a "Preview the new
  six-tab Setup →" link (re-migrates from the live v2 model on entry, so the
  preview always reflects current data); the new shell links back.
- `tests/setup-v3-ui.test.js` (10) — six tabs in order, sample-complete
  glyphs, tab navigation, the master–detail scaffold with derived numbers,
  request-type wiring rendered, volume scope labels, Defaults reading the
  engine config, the blank-model progress strip (names Structure first, Go
  jumps there), a broken process flagging Request types + listed in Map,
  zero console noise.

**Full suite: 27 gates green; dist rebuilt** (the packaged app carries the
preview). **USER CHECKPOINT: does the shell feel right?** Next: U2
(Structure editors).

## DOMAIN REDESIGN — M1–M4: the full model layer ✅ (four new gates green)

BUILD-PLAN.md approved ("Okay let's go"); the model phases land together, all
as NEW pure modules — the shipping v2.4 app and its 22 gates stay untouched.

- **M1 · `model/ops.js`** — every Setup edit as a pure reducer over the domain
  model: registry CRUD with guarded deletes (a blocked delete returns the
  ORIGINAL model object, asserted by identity), channel enable/defaults, queue
  add/staffing/reset, request-type assignment with All semantics, process/step
  editing (terminal:false drops the outcome), volume entry upsert by address,
  `blankDomainModel()` / `sampleDomainModel()` (deterministic ids for tests
  and the first-run experience). `tests/ops.test.js` (12).
- **M2 · `model/bridge.js`** — domain model → the PRESERVED engine's config,
  twin of the old adapter but fed by `propagateDomain()`. The theorem the gate
  proves: for migrated flat-shape models the domain path simulates
  **identically** to the old path — cfg field equality plus exact `compactRun`
  equality for S1–S4. New capability: cascade shapes reach the engine as
  `weeklyVolumes` (flat shapes emit null, keeping byte-parity).
  `tests/bridge.test.js` (5).
- **M3 · `model/store-domain.js`** — schema-versioned persistence
  (`capacity.v3.model`), storage-injectable; a saved v2.4 model migrates on
  load, persists to v3, and the v2 key is LEFT INTACT for rollback; corrupt
  payloads read as absent, never throw. `tests/store-domain.test.js` (5).
- **M4 · `model/template-domain.js`** — template v3 per DOMAIN-MODEL §10:
  five sheets (Registry with Kind/DefaultsJson · Queues with StaffingJson so
  migrated v1 physics round-trip exactly · Request types · Steps with
  order/terminal/outcome · Volume entries with W1..W52 columns). Pure rows;
  the gate drives REAL SheetJS bytes: export → import structural identity for
  sample and migrated models, export → edit-a-cell → import equals the same
  edit made via Ops, and export → import → export byte-identical.
  `tests/template-domain.test.js` (6).

**Full suite: 26 gates green.** Next: U1 (Setup shell, six tabs) — user
checkpoint after.

## DOMAIN REDESIGN — Step 0: the domain layer ✅ (new gate green)

DOMAIN-MODEL v1.2 signed off (request types → channels → processes; flat
registry; interactions live in processes; Map is a generated artefact; volume
cascade). Step 0 builds the model layer as NEW pure modules alongside the old
ones — old `derive.js` untouched, so every existing gate keeps guarding the
shipping app while the UI migrates tab by tab.

- `model/domain.js` — shapes, All-semantics leaf expansion, validation
  (V2 double-cover · V3 end-point completeness · dangling refs), registry
  delete guards (V6) and queue blast radius (V4).
- `model/cascade.js` — the volume resolver: totals cascade down, entered
  finer figures act as weights, equal split by default, over-runs scaled and
  flagged, shapes inherit down, provenance on every node (entered · scaled ·
  equal · sum · none; single-child levels pass provenance through).
- `model/propagate.js` — cascade leaves → queue workload: split × sampling
  per step, request-type AHT override ?? queue fallback, volume-weighted
  effective AHT with svc/weighted/queue markers, weekly series from shapes,
  V1 uncovered-volume warnings folded into validation.
- `model/migrate-domain.js` — v2.4 model → domain model, deterministic;
  deepest-wins applied once at migration via the old model's own source
  resolution, then the cascade owns the data.
- `tests/domain.test.js` (19) — the cascade rules incl. the owner's worked
  example, propagation, validations, guards, and the **round-trip**:
  the migrated sample model AND the migrated shipping default config
  reproduce old `deriveQueueWorkload()` volumes, effective AHT and markers
  exactly.

**Full suite: 22 gates green.** Engine and adapter untouched. Next per
REVIEW-SETUP §7: the six-tab navigation shell.

## v2.4 STRUCTURAL REBUILD — Step 0: Golden masters ✅ COMPLETE (new gate green)

Kicks off the v2.4 rebuild (new domain model Brand → BU → Product → Channel →
Queue, plus Services / journeys / Channel volume profiles; rebuilt Setup /
Results / Levers / Home per the mockups). The simulation **engine is preserved**
— the rebuild changes the model and UI *around* it. Step 0 pins the engine's
observable behaviour so the refactor can be verified numerically against it.

Owner decisions locked in (prompt's recommended defaults): journey-step **lag OUT
of v1**; shared-queue cost allocation by **handling minutes**; mix <100% **warns,
not blocks**; the mockups' "spill when occupancy > 85%" copy is a **rename** to the
engine's real deficit/failure-driven semantics — **no** new occupancy trigger.

- `scripts/gen-golden.js` — `buildFixtures(E)` is the single source of truth;
  `npm run golden:gen` writes `tests/golden/golden.json` (~422 KB). Regenerate
  deliberately only when an engine change is intended — the git diff then shows
  exactly which numbers moved.
- `tests/golden/golden.json` — committed fixtures pinning the six audit risk
  sites: Erlang B/C fidelity; voiceRaw abandonment × patience (incl. deep
  overload and the SPEC §11 E1 pat→∞ case, C=0.2853 / ASA≈17.0 / SL≈0.797);
  requiredAgentsInterval (ASA∧abandon∧occupancy) + fractional voiceInterval
  blending; runVoiceDay / runDigitalCustomerDay across coverage; backlog
  conservation across multi-day workflow + digital-fluid chains; hoursPerHeadDay
  (shrinkage supply-side only); and full-pipeline `compactRun` for S1–S4 (whole
  demand→requirement→hiring→cost machine, fractional FTE throughout).
- `tests/golden.test.js` — the gate (18 tests, wired into `npm test` right after
  the engine suite). Regenerates from the live engine and deep-compares to the
  committed masters with a combined abs/rel float tolerance (1e-6 / 1e-9), plus
  standalone **invariant** checks (Erlang C ≡ direct summation; overload abandon
  > 1−N/A floor; exact backlog conservation with day-to-day carryover; shrinkage
  = base × (1−shrink); requirements monotone in load and tighter under a lower
  occupancy ceiling; fractional FTE preserved unrounded; blended SL between
  integer endpoints). Determinism verified (two generations byte-identical); the
  guard verified to bite (a 0.01% erlangB nudge reddens 6 sections incl. an £82
  pipeline cost drift). `git diff engine/` is empty — engine untouched this step.

**Full suite after Step 0:** 11 gates green (P1 20 · **Step 0 golden 18** · R1 19 ·
R2 27 · R3a 20 · R3d-A 5 · P7b 20 · R3b 9 · R3c 9 · R3d-B 6 · §13 harness 20).

### Step 1 — Derivation module + migration ✅ COMPLETE (2 new gates green)

The heart of the v2.4 change: a **pure** module (no DOM, no React, no engine
import — destined for a Web Worker) turning the domain model into derived queue
workload, so queue volume and AHT are NEVER user-entered. Implements all seven
derivation rules from the prompt §1 with the owner decisions baked in.

- `model/derive.js` — `derive(model)` (one-pass aggregate for the worker) plus
  targeted pure functions:
  - **Rule 1 — volume propagation** (`deriveServiceVolumes`): service volume =
    deepest applicable profile total × mix %. Profiles on the same structural
    path supersede shallower ones (channel > product > BU, "deepest wins");
    disjoint paths sum. Supersession is tracked per source.
  - **Rules 1+2 — queue workload & effective AHT** (`deriveQueueWorkload`):
    workload = Σ services (service volume × splitPct × samplingPct); per-service
    AHT = `service.ahtSec ?? queue.fallbackAhtSec`; queue **effective AHT** =
    volume-weighted average, with a `weighted`/`svc`/`queue` marker and a
    per-service breakdown for the tooltip.
  - **Rule 4 — cross-structure guard** (`crossStructureWarnings`): a journey step
    into a *structural* queue whose channel-path doesn't contain the feeding
    profile's node WARNS (never blocks); shared queues are silent. (The
    Loans-style acceptance case is covered by a test.)
  - **Rule 5 — shared-queue cost allocation** (`sharedQueueAllocation`): by
    **handling minutes** (volume × per-service AHT), split across feeding
    structures in proportion to each node's share of the service volume.
  - **Rule 6 — referential integrity** (`canDeleteQueue`/`canDeleteService`):
    deletion blocked with dependents listed.
  - **Validation** (`validateModel`): errors (dangling refs, mix >100%) vs
    warnings (mix <100% unmodelled remainder, cross-structure).
  - Owner decisions locked: **lag OUT** (parsed, not applied), **minutes**
    allocation, **warn-not-block** on <100% mix and cross-structure.
- `model/migrate.js` — `migrateV1ToV2(cfg)`: each v1 queue → one queue + one
  service ("<queue> demand", 100% mix) + one channel profile, synthesising a
  default BU + Product per brand (D19a). Deterministic ids, no random.
- `tests/derive.test.js` (17) + `tests/migrate.test.js` (7), both wired into
  `npm test`. The migration gate proves the **exact round-trip**: derived queue
  volume === old dailyVolume and derived effective AHT === old AHT on the real
  default config, model valid, zero cross-structure warnings.

**Full suite after Step 1:** 13 gates green (adds **derivation 17** + **migration
7**). Engine still untouched (`git diff engine/` empty); golden masters green.

### Step 1/3 bridge — Engine adapter ✅ COMPLETE (new gate green)

The seam that keeps the engine untouched while the model/UI are rebuilt around it
(prompt rule 7: "the adapter feeds the preserved engine, it does not alter it").
Built ahead of the Setup UI because it is pure logic on the critical path and
needs no mockups.

- `model/adapter.js` — `v2ToEngineConfig(model)` runs the derivation, rebuilds
  each engine queue from its carried staffing physics overriding ONLY the
  demand-derived fields (dailyVolume ← derived volume, aht ← derived effective
  AHT), and reassembles the engine's preserved global config. `roundTripConfig(cfg)`
  = migrate → adapt in one call. Journey cross-queue routing → engine deflection
  inputs is derived here (inert for single-step migrated journeys; activates when
  the v2 UI authors multi-step journeys).
- `model/migrate.js` extended: each v2 queue now carries `staffing` (the original
  engine params verbatim) and the model carries `engineConfig` (the global config
  minus queues) — both preserved, not transformed.
- `tests/adapter.test.js` (5) wired into `npm test`. Proves the **full round-trip**:
  `simulate(roundTripConfig(cfg)) ≡ simulate(cfg)` exactly, for every strategy,
  **and under a hard-warmed cache** — the adapter never introduces its own
  divergence whatever the quantised Erlang cache holds. Also proves derived
  (never-entered) volume/AHT drive a hand-built multi-service queue.

**Cache-quantisation note (documented in gen-golden.js):** the engine quantises
offered load to 0.05 Erlangs for cache reuse, so a bucket's value depends on which
exact load first populated it. The golden pipeline fixture reflects a
grid-warmed cache — self-consistent and reproducible (all a drift-detector needs).
A cross-process exact comparison of a clean-cache pipeline to that fixture is
therefore unsound (churn can differ ~0.3% purely from cache-order); the adapter
gate proves equivalence the sound way — in-process, clean AND warmed.

**Full suite now:** 14 gates green (adds **adapter 5**). Engine untouched.

### Step 2 — Setup page ✅ COMPLETE (new gate green; mockups received)

The four-section Setup page built to setup-page-v3.html, wired live to the
derivation module — queue volume and Effective AHT are DERIVED and rendered
read-only (there is no queue-volume input anywhere). Kept as a self-contained v2
module (`ui/v2/`), cleanly separate from the shipping v1 app.

- `model/taxonomy.js` — the fixed enumerations (channels/activities/product
  requests/queue types), shared by model and UI.
- `ui/v2/tokens.js` — the design system extracted verbatim from the mockups'
  `:root` + components (blue-led light theme, six KPI-family colours, glyphs,
  tabular numerals); one injected stylesheet + `FAMILY_COLORS`.
- `ui/v2/model.js` — the v2 model state: `sampleModel()` (mirrors the mockup's
  worked example), `blankModel()`, and pure reducer ops (structure channel
  toggles; queue/service/profile/journey/mix add·update·delete); `deriveModel()`
  wraps model/derive.js.
- `ui/v2/SetupPage.jsx` — four collapsible sections with completion badges
  (Structure · Queues · Service catalog · Channel volume profiles), the empty
  state as the wizard; derived volume/AHT with weighted/svc markers; live mix-sum
  indicator (green 100% / amber under); unmodelled-remainder + cross-structure
  warnings; and the staffing drawer (six KPI-family accordions, derived volume
  read-only). `ui/v2/setup-main.jsx` mounts it (mirrors ui/main.jsx).
- `tests/setup-ui.test.js` (9) — JSDOM gate: renders the page, asserts derived
  volumes are read-only and update live as the mix changes (2,398 = 1998+400
  from two disjoint profiles → 1,750 at 50% → back), the amber+unmodelled path,
  the Loans-style cross-structure warning, channel toggles, and the drawer's six
  accordions. Zero console noise. (Harness bug caught + fixed: async tests are
  now awaited so a failure actually exits non-zero — verified it bites.)

**Derivation refinement (found while building):** the cross-structure guard is
now evaluated PER FEEDING PROFILE (rule 4: "outside the path of *the profile*
feeding it"), so a service fed both in-path and out-of-path flags only the
out-of-path source — the mockup's exact Loans behaviour. Derivation/adapter/golden
gates all still green.

**Verified in real Chromium** (headless, deviceScaleFactor 2, zero page/console
errors): strong parity with setup-page-v3.html across all four sections and the
drawer; the live derivation is correct end-to-end (e.g. shared QA — Governance =
83/day at 575 s *weighted* = Billing at its 600 s fallback + New-card at 540 s).

**Full suite now:** 15 gates green (adds **Setup 9**). `/dist` unchanged — the v2
Setup is a standalone module, not yet wired into the shipping v1 app shell.

### Step 3 — Results consolidation ✅ COMPLETE (new gate green)

The Results page built to results-page-v2.html: one context bar, five lenses
(Summary · Plan · Intraday · Data · Flow), one shared week cursor — driven by
REAL engine output (v2 model → model/adapter.js → preserved engine).

- `ui/v2/compute.js` — the worker-ready compute boundary. `computeBase(model)`
  runs the decision matrix once (reusing the tested `runMatrix`/`bestCell` from
  sim-set — the adapter yields exactly the v1 cfg they expect); `computeDetail`
  runs the selected (group × strategy) with daily capture. `runResults` combines
  them. Isolated behind a plain function so a Web Worker wrapper is a thin
  drop-in (`runnerFor()`) — the actual Worker thread is deferred (JSDOM can't
  exercise Workers; the compute is worker-ready and the inline path ships).
- `ui/v2/ResultsPage.jsx` — context bar (strategy · scenario · save run ·
  freshness) governing all lenses; the decision matrix (cost + red-weeks glyph
  per cell, cost↔service weighting slider, Best-fit badge) sets the context;
  verdict sentence; six KPI-family cards; risk register with BU/channel filters.
  Plan's glyphed RAG ribbon sets the shared week cursor; Intraday and Flow
  inherit it; Data is grouped by path with a template-compatible CSV export;
  Flow is a proportional Sankey with play/scrubber animating cached weekly
  results (no re-simulation). `ui/v2/results-main.jsx` mounts it on the migrated
  default config (which carries the engineConfig the adapter needs).
- `tests/results-ui.test.js` (10) — JSDOM gate on real engine output: matrix
  renders with cost + red glyph and a Best-fit badge that follows the slider;
  tapping a cell drives the context bar; the Plan ribbon sets the cursor and
  Intraday/Flow inherit it (verified the cursor is shared across lens switches);
  CSV export header; scenario change recomputes. Zero console noise (fixed two
  keyless-fragment warnings found here). Awaited-test harness (exits non-zero on
  failure).

**Verified in real Chromium** (zero page errors): strong parity with
results-page-v2.html; all figures are real — the matrix shows genuine per-cell
costs/red-weeks (Forward-backfill legitimately reds out under-hiring), Best-fit
lands on the bestCell (No scenarios × Buffer, £6.0m/0 red), six family cards
(1.83m contacts · 100% SLA · 63% occ · 145 FTE · 1,484 lost · £6.0m), and the
Plan ribbon + FTE chart read the same run.

**Full suite now:** 16 gates green (adds **Results 10**). Engine untouched;
golden/adapter/derivation all still green.

### Step 4 — Levers ✅ COMPLETE (new gate green)

The Levers page built to levers-page-v2.html: the decision matrix flanked by
strategy + scenario-group cards, hiring caps at the foot. The matrix is the SAME
`computeBase()` Results consumes — one source of truth, two surfaces (Levers
edits, Results reviews). Every lever is a REAL engine input that re-scores the
matrix live.

- `ui/v2/compute.js` — `richMatrix(cfg)` replaces the sim-set.runMatrix call in
  `computeBase`: same allIn/redWeeks/status/bestCell-compatible shape PLUS
  per-cell **SLA attainment** (share of green queue-weeks) that the Levers cells
  show. Results (cost + red) and Levers (cost + SLA + red) read one matrix.
- `ui/v2/model.js` — lever ops on the carried engineConfig: `setHiringBuffer`
  (→ hiring.buffer, S2), `setForwardMonths` (→ strategy.forwardMonths, S3),
  `setTotalCap` (→ hiring.caps.total), `setSegmentCap` (→ hiring.caps.segments
  keyed brandId|channel, the engine's real segKey). All matrix-affecting.
- `ui/v2/LeversPage.jsx` — matrix (cost + SLA + red glyph, cost↔service slider,
  Best-fit badge, cell tap → selected context); strategy cards with the built-in
  pill, description, inline editable key param (Buffer %, Look-ahead months) and
  an expandable path-grouped queue list; scenario-group cards with factor count,
  scope chips and a mini in-force timeline; hiring caps grid (brand × channel) +
  total ceiling. `ui/v2/levers-main.jsx` mounts it on the migrated config.
- `tests/levers-ui.test.js` (9) — JSDOM gate proving the levers are real:
  **tightening the total hiring cap adds red weeks to the matrix**, editing the
  buffer % moves the Buffer column's all-in, cells carry cost+SLA+red, cell tap
  selects, strategy cards expand. Zero console noise.

**Verified in real Chromium** (zero page errors): strong parity with
levers-page-v2.html; SLA% tracks the red-week counts (e.g. Forward backfill ×
Plan of record = 85% SLA / ✕19 red), Best-fit lands on £6.0m/0-red, the buffer
and look-ahead inputs and the caps grid are live.

**Full suite now:** 17 gates green (adds **Levers 9**). Engine untouched.

### Step 5 — Home + Ecosystem ✅ COMPLETE (new gate green)

The Home page built to home-page-v2.html: simulation cards with mini
dependency-graph thumbnails and KPI-family stat chips, the New-simulation fork
modal, and the full-screen **Ecosystem volume Sankey** — the derivation module
made visible.

- `ui/v2/ecosystem.js` — `sankeyLayout(model)`: PURE, turns the model into a
  proportional volume flow (brand → channel → service mix → journey queues →
  outcome) straight from `derive()` — node heights ∝ volume, ribbon widths ∝
  flow, governance stations tinted purple, an outcome column split
  resolved/failed. Queue volumes are DERIVED and the picture proves it.
- `ui/v2/compute.js` — `quickHeadline(model)`: one cheap sim (S1) for a card's
  chips (horizon, queues, FTE avail, all-in, worst RAG) — not the full matrix.
- `ui/v2/HomePage.jsx` — cards (thumbnail + name + scope/updated/runs + five
  KPI-family chips + Open), the New-simulation fork modal (Whole ecosystem /
  Subset / Single service / From template), and the Ecosystem overlay rendering
  the Sankey as SVG with legend + "Edit in Setup". `ui/v2/home-main.jsx` seeds
  the simulations list from the migrated default config with a real headline.
- `tests/home-ui.test.js` (6) — JSDOM gate: card chips + thumbnail, the fork
  modal opens/closes, the Ecosystem overlay renders the six-column Sankey with
  real derived queue names and a resolved/failed outcome, and shows the
  derived-not-entered message. Zero console noise.

**Verified in real Chromium** (zero page errors): strong parity with
home-page-v2.html; the real card reads 52 wk · 4 svc · 4 queues · 159 FTE avail.
· £7.2m all-in · ▲ at risk; the Ecosystem Sankey shows Voice larger than Digital
by real volume, the service→queue cross-over ribbons, and Resolved 100% (the
default estate holds SLA).

**Full suite now:** 18 gates green (adds **Home 6**). Engine untouched.

### Step 6 — Template round-trip ✅ COMPLETE (new gate green)

Four sheets mirroring the Setup sections (Structure · Queues · Services · Channel
volume profiles), with the export → edit → import → export round-trip guarantee.

- `ui/v2/template.js` — PURE serialization: `modelToSheets(model)` /
  `sheetsToModel(sheets)`. Ids carried so structure and refs reconstruct exactly;
  Structure = one row per channel (plus rows for empty products/BUs), Queues =
  one row per queue with the six-family staffing columns, Services = one row per
  journey step (service fields repeat), Profiles = one row per mix entry.
  `validateRoundTrip(model)` backs the import validation report.
- `ui/v2/template-xlsx.js` — the SheetJS binding, **lazy-loading xlsx**
  (`await import("xlsx")` — most sessions never touch Excel): `exportWorkbook`
  (pre-filled), `importWorkbook` → { model, report }, `downloadTemplate` (DOM).
- `tests/template.test.js` (6) — bundles the pure module and exercises the real
  library via `require("xlsx")`: four sheets mirror the sections; the pure
  round-trip deep-equals the model; re-export is byte-identical (idempotent);
  a **REAL SheetJS .xlsx write → read reproduces the model exactly**; an edited
  mix % survives; optional service AHT + governance sampling % round-trip
  precisely.

**Full suite now:** 19 gates green (adds **Template 6**). Engine untouched.

---

## v2.4 rebuild — build order COMPLETE (Steps 0–6). Remaining: integration

All seven build-order steps are done and green (19 gates, 0 failures; engine
byte-identical throughout — `git diff engine/` empty). Golden masters pin the
preserved engine; the derivation module + adapter carry the new domain model
through it; Setup, Results, Levers, Home+Ecosystem are built to the mockups and
verified in real Chromium; the template round-trips through real .xlsx.

### Integration — app shell ✅ COMPLETE (new gate green)

One shell, one model, four surfaces. The four v2 pages are now controlled
components threaded from a single shared model.

- `ui/v2/App.jsx` — the shell: owns the single v2 model, routes Home · Setup ·
  Levers · Results, autosaves (debounced) and restores. Home is the launcher
  (Open → the tabbed workspace); Setup/Levers/Results share the model, so a Setup
  edit re-derives the Ecosystem and re-scores the Levers/Results matrix live.
  Setup's Download/Upload are wired to `template-xlsx.js` (dynamic import — xlsx
  loads only on click). `ui/v2/app-main.jsx` seeds from the migrated default.
- `ui/v2/store.js` — model autosave/restore (localStorage interim; IndexedDB is a
  drop-in behind the same load/save interface for P5).
- `SetupPage`/`LeversPage` refactored to controlled (`model` + `onModelChange`);
  each page's header tabs call an `onNav` prop; their `*-main.jsx` keep a small
  stateful host so they still run standalone. `HomePage` gains `onOpen`.
- `tests/app-ui.test.js` (6) — Home Open enters the workspace; the four tabs
  navigate; **a Setup edit is reflected on Results (single shared model)**;
  autosave persists and a fresh mount restores. Zero console noise. All four
  page gates stay green after the controlled-component refactor.

**Full suite now:** 20 gates green. Engine byte-untouched (`git diff engine/`
empty). A self-contained browser build of the shell runs clean in real Chromium.

**Remaining (smaller, optional):**
- Move the compute into a real Web Worker thread (boundary ready in `compute.js`).
- IndexedDB (swap `store.js`'s localStorage for the async KV) + import validation
  report surfaced in the UI.
- Replace the shipping v1 `/dist` with the v2 shell as the default export.

---

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

## P7a — Revision 2 engine: ✅ COMPLETE (P1 + R1 batteries unchanged; 26 new R2 tests green)

Scope: SPEC §15–§19 + §21 in `engine/` only, gated by the §22 battery
(tests/r2.test.js). NO UI work — the P6b UI runs untouched on the new engine
(both UI gates re-verified green at the new 52-week default horizon).

### What was built
- **Settings layer (§16)** — `R2_DEFAULTS` + `settingsOf(cfg)` deep-merge:
  OT rules (2 h/day/agent, 10 h weekly ceiling, ×1.5 premium, burnout load),
  training defaults + training-debt constants (accum 20, recovery 10, max AHT
  +8%, max attrition ×1.5), per-channel knock-on defaults (null = legacy loops
  fallthrough), §20a risk-threshold bands, horizon bounds. Resolution chains:
  `resolveTraining` (queue → brand training profile → Settings) and
  `resolveKnockOn` (queue → channel template → Settings → legacy loops).
- **Horizon (§16)** — `resolveHorizon` clamps to [24, 78]; blank = 52; default
  config now simulates 52 weeks. Forward simulation is prefix-invariant, so
  legacy tests reading early weeks are unaffected by the longer default.
- **Supply ladder (§17)** — strictly ordered rungs in the day loop:
  own hours → own OT (daily 2 h/agent AND weekly ceiling; premium cost; feeds
  burnout) → training reclaim (≤ trainingShrinkagePct; accrues debt 0–100 with
  AHT ×(1+debt%·8%) and attrition ×(1+debt%·50%); decays on restore; §19
  `people.trainingShrinkage` forces it) → explicit supports waterfall (R1,
  unchanged) → automatic intra-brand recycling (leveraged donors only; spare
  → same-brand support/unmanned queues by receiver priority, pro-rata within
  a tier) → pools (members' spare × sharePct, training-feed top-up capped at
  remaining reclaim, pro-rata by deficit, no priorities, cross-brand) →
  leveraged pull (sacrifice below own requirement up to the weekly cap,
  honest RAG). Unmanned queues: 0 HC, never hired for, served by rungs 4–5.
- **Volumes & profiles (§18)** — brand volume split (`brandShareVolume`,
  shares normalise, explicit per-queue volumes win); volume profiles with
  `blendedAht` (Σ share×aht, ≤6 segments, auto-normalise) feeding the Erlang
  engine unchanged; generalised knock-on {repeatPct, spillPct,
  spillTargetQueue} per queue with exact legacy redial/deflection reproduction
  through the fallthrough chain.
- **Unified scenarios (§19)** — one shape {tag, parameter: volume|aht|sla|
  profileShares|people(kind), mechanism: step|growthRate|manualSeries,
  granularity: day|week|month, startWeek, stopWeek, scope}; legacy types
  still evaluated natively (regression), groups (`groupScenarioIds`) resolve
  exactly as views did.
- **Migration shims (§21)** — `migrateScenarioToUnified` (9 legacy types),
  `migrateServiceTeamsToLeveraged` (size→HC, cap = size×maxHoursPerWeek,
  targets = coversQueues, premium kept as a cost note), `migrateConfigR2`
  (brand adoption, resourced→dedicated / supported→unmanned, crossSkill→
  supports, views→groups, knock-on materialisation; idempotent).
- **Risk/audit fields (§16/§20a)** — weekly per-queue record gains otHours,
  otCost, otStreakWeeks, reclaimedHours, trainingDebt, recycledIn, poolIn,
  leveragedIn, borrowedSharePct, ahtInEffect, slaInEffect, attrInEffect,
  trainShrinkInEffect, scenarioTags, channel, brandId; totals gain
  otHours/otCost and totalCost includes OT.

### Hand-computed §22 anchors (all asserted exactly in tests/r2.test.js)
Rigs use the r1 exact-arithmetic scaffold (digital, AHT 3600 s, ceiling 1,
8 h heads, daysWorked = daysPerWeek = 7 ⇒ req h/day = dailyVolume):
- **OT**: HC 5, deficit 20 h/day → weekly OT = min(2×7, 10)×5 = **50 h**
  (10/day, days 0–4); otCost = 50 × (30000/52/56) × 1.5 = **£772.66**;
  burnout = load 10 × (50/50) = **10**; streak 1, 2, 3…
- **Rung order**: own 28 h/day (shrinkage .3), deficit 14, reclaim cap
  0.2×5×8 = 8 h/day → days 0–4: OT 10 + reclaim 4; days 5–6: reclaim 8 ⇒
  OT **50**, reclaimed **36** (proves OT-first); debt = 20×(36/56) = **90/7 ≈
  12.857**; wk1 AHT = 3600×(1+(90/7)/100×0.08) = **3637.03**.
- **Forced reclaim + decay**: scenario value 0.5, weeks 0–1 ⇒ debt walks
  **[10, 20, 10, 0]**; attrition in effect wk1 = 0.04×1.05 = **0.042**, wk2 =
  0.04×1.10 = **0.044**.
- **Brand training**: reqToStart 1, 10 heads hired wk0 — brand A (2 wk)
  lands **wk 2**, brand B (5 wk) lands **wk 5**.
- **Recycling before pools**: unmanned queue takes **140 h/wk** recycledIn
  from same-brand leveraged spare, poolIn **0**, donor stays ≥ requirement.
- **Pool 2:1**: deficits 6:3 vs spare 6/day → **4 and 2 h/day** (priority
  numbers ignored); training feed rig: feed capped at **42 h/wk** (full
  0.25 cap), donor debt **20**, recipients split 12/day pro-rata 20:3 →
  **73.04 / 10.96 h/wk**.
- **Leveraged sacrifice**: cap 105 h/wk, target deficit 20/day → target
  receives exactly **105 h**; donor drops to cover **175/245 ≈ 0.714** and
  RAGs red honestly; target borrowedSharePct = **0.25**.
- **Profiles**: 60/40 of 3600/7200 → blended **5040 s**; shares shifted to
  20/80 → **6480 s**, requirement moves by exactly **9/7**.
- **Brand split**: 1200/day at shares 2:1 → **800/400**; explicit queue keeps
  its **100** and stays out of the split.
- **borrowedSharePct**: own 28 vs req 40 h/day with the 12 h gap pool-fed →
  **0.30** exactly.
- **Horizon**: 5→**24**, 100→**78**, blank→**52**, 60 stays.
- **Perf** (§22 budgets): 5×5 group×strategy matrix at 52 weeks ≈ **1.7–1.9 s**
  (< 8 s); single 52-week sim ≈ **44 ms** (< 400 ms). P1's own budget test
  (8 sims < 1 s) passes at ≈ 0.5 s despite the 26→52-week default.

### Performance work (needed to keep the UNMODIFIED P1 perf test green at 52 weeks)
Doubling the default horizon initially pushed P1 test 14 to ~1.7 s. Fixes, all
behaviour-preserving (key-representation / memoisation only):
- Erlang caches switched to numeric composite keys (no string alloc on the hot
  path) with a memoised parameter-cluster sub-map; `requiredAgentsInterval`'s
  whole scan is memoised at the same quantisation voiceRaw already used.
- `reqCurveVoice/Digital` cache made persistent across simulate() calls, keyed
  by profile identity (WeakMap — profile arrays are replaced on edit, the same
  invariant `_normCache` already relied on) + every numeric parameter.
- Day-memos reuse a day's voice/digital results within a week when the exact
  inputs repeat; `lite` day runs skip per-interval detail except on the
  captured intraday day; `exogenousVolume` accepts the day loop's already-
  computed scenario resolution instead of re-deriving it.

### Decisions / deviations flagged
- **reducedTraining migration**: §19 sketches "people.trainingShrinkage + aht
  step"; that pair cannot reproduce the legacy cohort-timing effects (curve
  stretch, cut weeks) within the §22 1% gate, so the unified scenario carries
  the full legacy programme under `people.trainingProgramme` (same envelope,
  numerically exact). Flagged here per the working agreement.
- **resourced→dedicated**: `migrateConfigR2` maps legacy "resourced" to
  "dedicated" (§17's never-donates default); the legacy string keeps working
  unmigrated, and dedicated queues still honour EXPLICIT supports routes —
  only automatic recycling is donor-restricted to leveraged queues.
- **Donation ordering**: explicit supports (R1 waterfall) run before automatic
  recycling; both run before pools, pools before leveraged pull — the §17
  order, with R1's explicit routes slotted at rung 4 ("explicit routes are
  always honoured").
- The default config keeps its legacy `crossSkill` field (the shim converts at
  simulate time) so pre-R2 saves and the R1 battery read identically.

Gate: tests/r2.test.js — 26 tests, all green; P1 (20), R1 (19), r1ui (13) and
harness (20) all green unmodified. The persistent-cache rework was additionally
spot-checked for staleness at commit time: repeated sims are bit-identical, and
edits to aht / profile (replaced array) / occupancyCeiling / asaTarget /
patience / maxAbandon / concurrency each change results and restore the
original numbers exactly on revert, including with two configs interleaved.

## P7b — Revision 2 UI restructure: ✅ COMPLETE — **STRUCTURE FROZEN**

Scope: SPEC §15–§20 UI, on the P7a engine. NO engine change — the P1/R1/R2
batteries pass byte-for-byte unmodified; only `tests/r1ui.test.js` (now the P7b
UI gate) and the harness tab-count (10→9) were updated.

### Tab structure (frozen)
Summary · Strategies · Plan · Data · Intraday · Queues · Scenarios · Snapshots ·
Settings. Seasonality dissolved into Settings; the R1 Workforce/Report tabs stay
gone. Nine tabs, exact order asserted by the gate.

### Context bar (§20)
Three selectors, in order, drive every number below: **Strategy · Scenario-group
· Snapshot** (groups replace views everywhere), plus Print/PDF-this-page.
Selecting a snapshot renders its frozen config across all tabs (deterministically
re-simulated) behind a "read-only" banner with the whole editor tree wrapped in a
disabled `<fieldset>`; "Live" restores the working model.

### What was built
- **Decision matrix (§19)** — Summary top: groups (rows) × strategies (columns),
  BOTH in config definition order, never reordered by selection. Cell = RAG +
  all-in £ + flags (weeks red, ⚠ tip, ⚠ cap). Computed on demand ("Run matrix"),
  cached in App, greyed with a "stale — re-run" banner on any sim-affecting edit.
  The selected cell is the global (group × strategy) context rendered live on
  every tab — clicking a cell sets both selectors. `runMatrix`/`simHash` in
  sim-set.js.
- **Risk register (§20a)** — first-class, parameterised: families now include
  sustained-overtime dependence, training-debt peaks, borrowed-capacity
  dependence and unmanned starvation, each scored against editable amber/red
  bands in `config.settings.risk`. Crucially the register re-scores at RENDER
  time — `simHash` excludes `settings.risk`, so changing a threshold updates the
  register **without re-simulating** (Plan numbers stay identical).
- **Queues (§15–§18)** — brand manager (create/rename/delete brands, brand
  training profile, brand volume split), pool manager (cross-brand/cross-channel
  membership with per-member share %), channel templates (voice/digital/support
  knock-on defaults). Queues grouped Brand → Voice/Digital/Support; each an
  accordion (Description, SLAs, Arrival, Workforce, Knock-on, Seasonality,
  Scenarios-affecting, Dependencies, Assumptions-over-time) with per-section
  inheritance indicators that flip inherited↔overridden. Resourcing modes
  dedicated | leveraged | unmanned with badges; unmanned disables HC.
- **Scenarios (§19)** — group builder (create groups, add scenarios, built-in
  Plan-of-record/No-scenarios) + the unified scenario shape (parameter ·
  mechanism · granularity · dates · scope · tag) with a manual-series grid
  editor, alongside the legacy quick-add types; a parameter-timeline table shows
  what is in force each week.
- **Settings (§16/§20a)** — physics table (engine window, OT rules, training +
  debt constants, knock-on channel defaults, hiring/costs/CX), the simulation-
  window control clamped to [24, 78] (default 52), the Risk-parameters section
  (every amber/red band), Seasonality dissolved in, and the Excel package.
- **Data (§6/§16)** — new supply columns (OT hours, training shrinkage, training
  debt, recycled/pool/leveraged in, borrowed %), an Outputs↔Assumptions-over-time
  toggle exposing the §16 audit contract (resolved volume, blended AHT, SLA,
  attrition, training shrinkage, OT used, active scenario tags per week), scenario
  group selector, per-group column show/hide.
- **Plan (§20)** — the full per-queue weekly data table now lives inline at the
  bottom (no mini-tabs), plus the OT-aware hiring summary and holistic panel.
- **Excel package (§20)** — the workbook gains Brands, Pools, Profiles and Groups
  sheets; Parameters + Volumes still round-trip on import.

### Gate: tests/r1ui.test.js (18 tests, P7b UI)
Asserts the exact 9-tab order; the three context-bar selectors + print on every
tab (print firing from ≥3); the matrix in definition order and NOT reordering on
selection; a cell selection driving the Plan numbers; the stale banner on a
config edit; a risk-threshold edit re-scoring the register while Plan all-in is
unchanged (no re-sim); the horizon input clamping to [24, 78]; brand creation +
queue adoption; cross-brand pool membership; the unmanned badge + disabled HC;
accordion inheritance indicators flipping on override; manual-series grid edits;
the assumptions view reflecting a scenario-driven AHT change; snapshot read-only
mode and its restoration; and the Excel package carrying the four new sheets +
re-importing a parameter — all with zero console noise. The harness (§13, both
source and rebuilt dist) stays green at 9 tabs.

Design note: the R2 concept model is backfilled by `migrateConfig` (UI) —
brands, pools, groups, channel templates and an editable `settings` (physics +
risk) block, with resourced→dedicated / supported→unmanned normalisation. The
seeded settings equal the engine defaults, so every simulated number is
unchanged; `settings.risk` is excluded from the simulation hash so risk-threshold
edits never trigger a recompute.

## Build & run
- `npm test` — all gates (engine, r1, r2, r1ui [P7b UI], harness).
- `npm run build:html` — regenerate dist/ deliverables from source.
- Open dist/capacity-sim.html in any browser (offline) or paste dist/capacity-sim.jsx
  into a React artifact host.

## SWEEP (Revision 3 — defect sweep, no engine changes)
Fixes only; zero engine diffs (`git diff engine/` empty) and every gate green.

1. **Responsive containment (Rule 9).** Every table lives in a width-capped
   `.tbl-wrap` / `.ribbon-wrap` and every chart in a `.chart`; `.main` clips
   horizontal overflow (sticky chrome are its siblings, so stickiness is intact)
   and `.card`/`.grid` children carry `min-width:0`, so intrinsically-wide
   content scrolls internally and the document never scrolls horizontally.
   `tests/r1ui.test.js` asserts the containment classes on every table/chart per
   tab; a real-Chromium pass confirmed docScroll == clientWidth at 390px and
   1280px across all nine tabs.
2. **Label sweep.** Removed every rendered spec reference (§…) from titles, subs,
   hints and option labels; `tests/r1ui.test.js` asserts no "§" survives in any
   rendered string.
3. **Plan.** Deleted the bottom weekly data table (a duplicate of the Data tab).
4. **Summary.** Print / PDF now lives only in the context bar; the on-page button
   is gone (the caption points to the context bar).
5. **Data — assumptions view.** Shows inputs in force only; "OT used" (an outcome)
   was removed from `assumptionsColumns` and remains in the Outputs columns.
6. **Files.** The Snapshots export/import area is one clean **Files** card (Excel
   package, Config JSON, Run files) and export/import was removed from Settings.
7. **Settings libraries.** Seasonality and the new Arrival patterns are LISTS only
   — create / rename / edit / delete named patterns (`PresetLibrary`). Application
   moved to Queues: a **System seasonality** card applies a pattern to the system,
   and per-queue Arrival / Seasonality sections apply patterns via an apply-only
   selector. `SeasonalityEditor` (the old in-Settings application editor) was
   deleted.

Test moves: the Excel/params-CSV export/import checks in `harness.test.js` and
`r1ui.test.js` now target the Files card on the Snapshots tab.

## R3a (SPEC §24 — Revision 3 engine)
Engine battery `tests/r3.test.js` (19 tests) — R3a / §24 GATE: GREEN, with the
ENTIRE pre-existing battery (P1, R1, R2, P7b UI, §13 harness) green and the
five validated test files byte-identical (hard regression gate honoured).

What shipped (engine only; UI lands in R3b):
* **§24.1 knock-on, simplified.** Canonical per-queue block `knock:
  {repeatPct, convertPct, convertTarget}` sits as the TOP tier of
  `resolveKnockOn`; mechanics are the existing repeat/spill paths unchanged.
  `primaryVoiceQueue()` supplies the default target. Migration freezes the
  resolved legacy values 1:1 (gate: legacy loops path reproduced exactly at
  weeks 0/10/25/51; an active legacy spill keeps its exact target — including
  null "nowhere"; the primary-voice default fills in only where conversion is
  inert, and never targets the queue itself).
* **§24.2 sharing, decentralised.** Pools are deleted from the concept model:
  `migrateConfigR3` decomposes each pool into per-queue `sharing: {sharePct,
  sharesWith}` declarations and empties `pools`. New rung-5 stage (config
  order, two passes): pass 1 offers sharePct × spare pro-rata by recipient
  deficit (no priorities); pass 2 reclaims training (rung-3 mechanics, own
  debt) against what the offers left short — FCFS, exactly the pool shortfall
  feed. Donor eligibility matches the pool rung (spare at stage start; never
  below own requirement). Because pro-rata allocation preserves deficit
  ratios, offers-then-feed equals the pool's aggregate-then-allocate: the
  decomposition gate holds every rung number (poolIn, reclaim, debt, hours,
  cover, status) to 1e-9, including the sharePct-0-donor-still-feeds edge.
  The legacy pool rung remains as a shim for un-migrated configs (r2 battery
  untouched). Exactness caveat: single-pool membership with member order
  following queue order (how the UI always built them); multi-pool members
  merge lists and keep their largest share. Shared inflow reports on the
  existing `poolIn` channel (borrowedSharePct unchanged).
* **§24.3 hiring cap hierarchy.** `hiring.caps = {segments: {"brand|channel":
  n}, brands: {brandId: n}, total: n}`. Marginal-churn greedy within each
  segment cap (missing entry = unlimited), then binding brand ceilings and
  the Total ceiling trim grants from the LOWEST marginal upward; the trace
  gains `boundBy` naming each level ("Brand 1 × digital cap", "Brand 1
  ceiling", "Total"). Configs with no segment/brand levels — including
  migrated ones (legacy cap → Total) — run the legacy greedy verbatim, so
  pre-§24 allocations are reproduced exactly. Tipping-point summary reads
  caps.total when present.
* **§24.4 strategy params.** S2 `bufferPct` was already per-strategy; S3 gains
  `forwardMonths` (clamped 1–6, weeks = round(m × 52/12)) — the projection
  distance for the leaver estimate. USER DECISION (post-R3a review): the
  default lives ON the strategy object — built-in S3 ships `forwardMonths: 3`
  and `migrateConfigR3` stamps 3 onto any backfill strategy lacking it, so it
  is ordinary user-editable config. Consequence, accepted explicitly: S3
  numbers shift from the legacy landing-week projection (10 wk on default
  queues) to 13 wk everywhere — the validated battery's S3 assertions are
  one-sided orderings and stay green unmodified. A hand-built strategy object
  WITHOUT the field keeps the legacy landing-week projection (gate asserts
  both semantics plus want monotone in m: m=1 > S3(3mo) > m=6).
* **§24.5 digital subtypes.** `q.subtype: "customer" | "workflow"` (absent =
  customer = legacy digital, bit-identical). Workflow: `reqCurveWorkflow`
  (hours = items × handle time ÷ occupancy ceiling; no concurrency, no
  Erlang, flat curve) + `runWorkflowDay` (FIFO fluid backlog at day grain;
  wait ramps B0/C → Bend/C days; SLA share from the same ramp logic as the
  digital model with the window in HOURS — `workflowSlaHours` default 24,
  `workflowSlaPct` default 0.9). RAG judges %-within-window against
  workflowSlaPct; sla scenarios scale the window; weekly record gains
  `subtype` + `respHours`; spill/repeat knock-on identical to digital. Hand
  gate: B0 25, V 100, C 50 → sl 50%, backlog 75, wait 1 day; simulated week
  1/7 in-SLA, backlog 350, req 12.5 FTE.
* **§24.6 volume anchoring.** `settings.calendar.weekOneDate` (ISO, default
  null = legacy startMonth mapping). `monthForWeek()` anchors seasonality and
  month-granular scenario series to real calendar months;
  `generateWeeklySeries(cfg, base, months)` is the seasonality wizard (gate:
  week 1 uses the Settings date's month). Weekly series remain first
  precedence and fully editable (`weeklyVolumes` unchanged).
* **§24.7 monthly costs.** `q.agentCostMonthly` / `costs.managerCostMonthly`
  cost at monthly × 12 ÷ 52 per week (gate: £2,600/mo → £600/wk exact);
  legacy annual expressions kept verbatim when absent. Migration stamps
  monthly = annual ÷ 12 (weekly identical to ulps; equivalence gate 1e-6).
  `summary.finance` reports monthly + annual run and all-in rates.
* **§24.8 group-scoped scenarios.** `group.scope = {brandIds, channels,
  queueIds}` (match ANY); `applyGroupScope(cfg, groupId)` derives a config
  whose in-group scenarios carry the resolved queue-list scope (both unified
  `scope` and legacy `queueIds` shapes). Gate: an op-wide volume step scoped
  to Brand 2 leaves Brand 1 untouched. R3b wires this into sim-set.
* **§24.9 lifecycle.** `makeBlankConfig()` — no brands, no queues; simulate
  yields 52 finite weeks of zeros under every built-in strategy (blankTot
  seeds active/otHours/otCost so the empty world stays NaN-free).
* **§24.10 Settings.** Week-1 date (above); the caps matrix (above);
  per-queue `slaAttainmentTarget` (migration default 0.9) with
  `summary.perQueue.{slaAttainment, slaTarget, slaRag}` for the Business box.
* **Migration.** `migrateConfigR3` = R2 migration + the §24 layers, idempotent
  (legacy knock mirror fields kept aligned with the canonical block). Gate:
  R3-over-R2 reproduces volumes/cover/redial/deflected/status EXACTLY and
  costs to 1e-6 across S1–S4 on the stock config.

Deferred to R3b (UI): caps-matrix editor, knock/sharing editors, subtype
picker, week-1 date + wizard UI, monthly cost fields, group-scope editor,
lifecycle actions (duplicate/defaults/blank + empty state), Business-box RAG
presentation, and wiring applyGroupScope into sim-set. Note for R3b: the
UI's strategy editor binds bufferPct/forwardMonths directly — forwardMonths
is already ON every backfill strategy (default 3, stamped by migration), so
the editor is a plain field, no write-on-edit dance.


## R3b (SPEC §24 — Revision 3 UI)
The §24 engine (R3a) wired through the UI, plus the §24 restructure. All seven
gates green — P1, R1, R2, R3a, P7b (updated for the new structure), R3b, §13
harness — with the engine untouched this phase (git diff engine/ empty) and a
real-Chromium responsive pass (no horizontal document scroll at 390 or 1280).

New gate file `tests/r3ui.test.js` (9 tests, R3b GATE): strategy buffer edit
moves that strategy's numbers; holistic chip toggle recomputes the capacity
required + totals; dependency graph|table toggle switches views and a node tap
reveals flows; the creation flow renders Description→Volumes→Workforce→SLA→
Knock-on→Sharing→Dependencies in order; the seasonality wizard fills an
editable weekly series; the caps matrix feeds the allocator trace; a blank
start renders the empty state and still simulates. Containment classes + the
§-free render stay gated in r1ui across every tab (new tables/charts included).

What shipped (UI):
* **Shared hierarchy** (`views.hierarchy` / `orderedQueues`): Brand → Voice/
  Digital/Support → queue — the one grouping used by the Holistic panel and the
  Business box; Summary/Data keep their voice/digital rollups.
* **Holistic panel redesign** (Plan): responsive hierarchy summary blocks
  (Brand, Brand·Voice, Brand·Digital) that spread across the width; an
  interactive table with a queue-chip filter (all on by default) whose capacity-
  required headline and totals row recompute live; columns capacity required,
  hires, active, attrition, agent £/mo, OT £/mo, customer £/mo (monthly per
  §24.7); the §24.3 caps context inline; the week-by-week cap trace (now naming
  the binding level) behind a toggle.
* **Dependencies view** (`DependencyView`, top of Queues): Graph | Table toggle.
  Graph — SVG nodes coloured by channel, badged D/L/U, edges for shares-with,
  leverage and converts-to-calls; a week slider; tapping a node reveals its
  simulated inflows (shared/leveraged/support hours) and converted volume.
  Table — the same links as a from→to matrix.
* **Queues rebuilt top-down** into the §24 creation flow: Description (channel +
  digital subtype picker) → Volumes (single | weekly series via CSV paste or the
  seasonality wizard with its one-line explainer | inherit) → Workforce (monthly
  agent cost; shrinkage lives here with the "paid time not on contacts" helper)
  → SLA (patience helper "average seconds…before hanging up — behaviour, not a
  target"; workflow queues show an hours SLA) → Knock-on (§24.1 two fields +
  call-queue target) → Sharing (§24.2 share % + shares-with picker) →
  Dependencies & mode (brand, resourcing, priority, HC, supports). Duplicate/
  Delete and the unmanned/leveraged badges are preserved.
* **Strategies**: editable parameters on EVERY strategy — buffer % (built-in S2
  included), forward months (backfill), schedule segments; S4 carries the "Manual
  — simulates exactly your hiring plan, ignores caps" explainer.
* **Scenarios, group-first**: everything is a scenario GROUP — create a group,
  target it at brands/channels/queues (§24.8 scope on the group), add factors
  inside it; no orphan line-item scenarios. `sim-set`/`runMatrix` apply
  `applyGroupScope` before simulating.
* **Settings**: Organisation & calendar (brand creation, name only, + week-1
  date), the brand × channel hiring caps matrix with brand/total ceilings
  (§24.3), monthly manager cost (§24.7); risk bands and the pattern libraries
  stay. Digital subtype is chosen per queue (noted).
* **New simulation menu** (header): Duplicate current | Start from defaults |
  Start blank, with the build-from-nothing empty state (§24.9).
* **config-ops.migrateConfig** now layers the §24 fields (knock/sharing/subtype/
  monthly cost/caps/calendar/forwardMonths/SLA target) behaviour-preservingly
  and decomposes pools into per-queue sharing; a truly-blank config keeps zero
  brands. `money`/`perMonth` helpers added for monthly presentation.

Tests: `tests/r3ui.test.js` added; `tests/r1ui.test.js` and `tests/harness.test.js`
updated where the structure moved (brand creation → Settings; sharing replaces
the pool editor; scenarios group-first). The engine batteries (engine/r1/r2/r3)
are byte-identical.


## R3c (batched polish + defects — no engine changes)
Seven numbered items, each with a JSDOM acceptance check in the new gate
`tests/r3c.test.js` (9 tests, R3c GATE: GREEN). The ENTIRE pre-existing battery
stays green — engine/r1/r2/r3, P7b UI (r1ui), R3b UI (r3ui) and the §13 harness
(source + rebuilt dist) — with the engine untouched this phase (`git diff engine/`
empty).

What shipped (UI only):

1. **Brand assignment defect.** A brand created in Settings is immediately
   selectable on any queue and the queue now files under it EVERYWHERE. The
   Summary queue rollup and the Plan hiring summary were re-based onto a shared
   Brand → Voice/Digital/Support → queue table (`ui/components/HierTable.jsx`);
   previously they grouped only by Voice/Digital, so a brand-2 queue never showed
   under its brand in any rollup. Gate: create a brand → assign a queue → it
   renders under that brand in the Queues grouping AND as a subtotal row in the
   Summary rollup.
2. **Hierarchy on the two tables that missed it.** `HierTable` renders per-queue
   rows with a channel subtotal per channel and a brand subtotal per brand, plus
   a grand total — the same grouping the Holistic panel and Business box already
   use. Both the Summary queue table and the Plan hiring summary carry
   `hier-chan-*` and `hier-brand-*` subtotal rows. `reporting.js` gained
   `queueSummaryMetric`/`sumQueueSummary`; PlanTab computes hiring metrics per
   queue and aggregates by hierarchy.
3. **Holistic panel — hierarchy + weekly table.** Kept the hierarchy summary
   blocks and the interactive queue-chip table; ADDED a second table beneath it —
   one row per week (52), columns capacity required / hires / active / attrition /
   agent £ / OT £ / customer £ — summed across the SAME chip filter, so toggling a
   queue out recomputes every week's row live (`holo-weekly-table`).
4. **Data tab — colours, dividers, editable inputs.** (a) A colour picker per
   column group persists in `config.settings.dataColours` (excluded from the sim
   hash so a colour edit never re-simulates) and drives the header underline + cell
   tint. (b) A clear vertical divider rule marks the first column of each segment
   (`.seg-first`). (c) The weekly volume series is editable in place — an input
   cell writes back via `patchWeeklyVolume` (now materialising the whole series
   from the single daily figure first, so editing one week never zeroes the rest)
   and re-simulates; computed outcome columns stay read-only with a muted
   treatment (`cell-ro`). Gate: editing a volume cell moves that week's simulated
   coverage; an outcome cell has no input; a colour choice survives a re-render.
5. **Scenario targeting defect.** Queue cards carry no scenario-add affordance;
   the card's "Scenarios affecting this queue" accordion is a strictly read-only
   view that now honours §24.8 GROUP scope — a group scoped (brands / channels /
   queues) to a queue surfaces its factors there. Creation and targeting live only
   on the Scenarios tab.
6. **Settings libraries fully editable.** Seasonality and Arrival patterns get
   full create / edit / delete in `PresetLibrary` (built-ins now editable too;
   12-month editor / interval sliders). Application still happens on the Queues
   tab, but it now stores a LIVE REFERENCE: applying a pattern to the system (or a
   queue overlay / arrival) records its id, and `resolvePresets` (App-level, wired
   into `sim-set`) bakes the library's CURRENT values into the simulated config —
   so editing a pattern in Settings re-simulates every queue that uses it.
   Hand-editing a value unlinks it. Gate: edit a linked pattern's month → a queue
   using it moves after re-simulation.
7. **Settings — channel creation with presets.** A `channelDefs` library (seeded
   with Voice / Digital Customer / Digital Workflow / Service Workflow built-ins)
   plus a Channels card: create a channel from a preset that seeds its template —
   Voice (Erlang ASA/abandon/patience), Digital Customer (concurrency + minutes
   SLA), Digital Workflow (no concurrency, hours SLA, default 90%/24h), Service
   Workflow (support group, days SLA, default 95%/5d). A queue attaches to a
   channel on the Queues tab (`attachQueueChannel`) and inherits its template
   sections — group, type, subtype and SLA fields. Gate: a Digital Workflow
   channel's template carries an hours SLA and no concurrency; a digital-customer
   queue attached to it loses its concurrency field and gains the hours SLA.

Files: new `ui/components/HierTable.jsx` and `tests/r3c.test.js`; edits to
`config-ops.js` (resolvePresets, channelDefs + ops, materialising
patchWeeklyVolume, migration channelId), `sim-set.js` (hash excludes dataColours +
channelDefs), `reporting.js`, `App.jsx` (simConfig = resolvePresets), the Summary /
Plan / Holistic / Data components, the Queues / Settings / PresetLibrary / PresetBar
editors and `style.js`. `/dist` rebuilt.

## R3d-A (SPEC §25 — Digital Customer under Erlang; engine only)
New engine battery `tests/r3d.test.js` (5 tests, R3d-A / §25 GATE: GREEN) with the
ENTIRE pre-existing battery green — P1 20 · R1 19 · R2 27 · R3a 20 · **R3d-A 5** ·
P7b 20 · R3b 9 · R3c 9 · §13 harness 20 = **149 tests, 0 failures**. Engine only;
the UI runs untouched on the new engine (both UI gates + harness re-verified green).
`/dist` rebuilt from source.

> **numeric results for Digital Customer queues intentionally changed at R3d-A.**

What shipped (engine only; the model-notes UI copy of §25.3 lands in R3d-B):
* **§25.1 model.** Digital Customer (live chat) leaves the fluid backlog model
  and becomes an Erlang A queue: `reqCurveDigitalCustomer` + `runDigitalCustomerDay`
  put **servers = agents × concurrency** through the existing `voiceInterval`
  solver (fractional blending included). AHT is unchanged; the SLA "% within Y
  minutes" is the Erlang service level at `Y×60` s; `patience` defaults to 180 s
  and abandonment is a real output. The carrying **backlog is retired** for the
  subtype (`s.backlog = 0`); economies of scale are now real (quiet intervals need
  proportionally more agents). Digital/Service **Workflow keep the fluid backlog
  model unchanged** (`runWorkflowDay`, `git`-verifiable regression isolation).
  The `servers = agents × concurrency` treatment is the standard chat
  approximation — mildly optimistic about juggling costs (stated in the engine and
  destined for the Model-notes tab in R3d-B).
* **§25.2 requirement.** The existing minimal-server search runs on effective
  servers; required agents = `N_servers ÷ concurrency` (so `ceil(agents×conc)` is
  the minimal N). `reqCurve` routes the customer subtype here; workflow and voice
  unchanged.
* **§25.3 knock-on.** For Digital Customer, converts-to-calls now fire on
  **abandoned volume × convert %** (was over-limit backlog excess) and **repeat %
  applies to abandons** — both land next day, no same-day fixed point.
* **§25.4 migration/defaults.** `runDigitalCustomerDay`/`reqCurveDigitalCustomer`
  fall back to patience 180 s + maxAbandon 5% when a queue omits them;
  `migrateConfigR3` stamps those defaults onto Digital Customer queues (idempotent,
  fill-when-absent) and `makeDefaultConfig`'s chat queues move patience 90→180.
  `backlogLimit` is retired for the customer status/knock-on (Workflow keeps it).
* **Weekly record.** Digital Customer now reports Erlang `asa`/`abandon` (workflow
  reports neither); status is `sl ≥ digitalSlaPct` (backlog term dropped). New
  exports: `runDigitalCustomerDay`, `reqCurveDigitalCustomer`, `customerPatience`,
  `customerMaxAbandon`.

### Existing tests updated to the new physics (each justified, per the §25 gate)
* `tests/engine.test.js` [8] — the deflection round-trip becomes a **conversion**
  round-trip: with a zero-server chat queue every contact abandons, so day-1
  converts = `abandoned × convert %` (was backlog-excess × deflection %), the chat
  carries **no backlog**, and next-day voice volume is lifted by that conversion.
  (This IS the "adapt the existing deflection round-trip test" §25 gate item; the
  isolated q_chat conversion target is neutralised so the arithmetic is exact.)
* `tests/r1.test.js`, `tests/r2.test.js`, `tests/r3.test.js` — the exact-arithmetic
  `dq()` rig moves from the customer subtype to **`subtype: "workflow"`**. The rig's
  whole purpose is a *linear* `req h/day = dailyVolume` scaffold (r1 even calls it
  "no Erlang fuzz"); that linear model now lives on the workflow subtype, so every
  supply-ladder hand number (spare, poolIn, reclaim, debt, grants, cover, reqFte)
  is preserved bit-for-bit while the customer subtype moved to Erlang. The three
  day-model assertions in these files (r2 unmanned-green / leveraged-donor-red,
  r3 donor-green) hold under workflow.
* `tests/r2.test.js` [15] — `qd` pinned to `subtype: "customer"` so `slaInEffect`
  still reports the **minutes** SLA (a workflow queue reports its hours SLA); the
  audit-field assertions don't touch the requirement model, so the Erlang subtype
  is fine here.
* `tests/r3.test.js` [8] — the customer-vs-workflow contrast pins `qc` to
  `subtype: "customer"` and its message now reads "runs the Erlang model (R3d-A),
  not the day-grain workflow maths" (still asserts `sl ≠ 1/7`).

Files: `engine/engine.js` (customer Erlang model + dispatch + day loop + migration +
defaults + exports), new `tests/r3d.test.js`, `package.json` (wire `r3d`), the four
existing test files above, `/dist` rebuilt. Deferred to R3d-B (UI): the Model-notes
copy (§25.3), and any Data/Intraday presentation that still assumes a chat backlog.

## R3d-B (SPEC §24/§25 — brands, startup defaults, chat UI; UI only)
New gate `tests/r3dui.test.js` (6 tests, R3d-B / §24–§25 UI GATE: GREEN) with the
ENTIRE battery green — P1 20 · R1 19 · R2 27 · R3a 20 · R3d-A 5 · P7b 20 · R3b 9 ·
R3c 9 · **R3d-B 6** · §13 harness 20 = **155 tests, 0 failures**. Engine untouched
this phase (`git diff engine/` empty). `/dist` rebuilt; a real-Chromium smoke pass
confirmed all three flows with zero console errors (the startup auto-pick survives a
genuine page reload, not just a fresh JSDOM mount).

1. **Brand fix (surgical, TDD).** The failing JSDOM test was written first — Queues →
   Brand 2 section → its own "Add queue" button → the new queue renders under Brand 2 —
   and shown red before the fix. `addQueue(brandId)` now pre-files a queue under a given
   brand; every brand section carries a `brand-add-queue-<id>` button that passes its own
   id (`QueuesEditor`). The per-card brand dropdown (already present, `setQueueBrand`)
   re-files a queue everywhere instantly. The test was then extended to close the
   hierarchy check: with two brands populated, BOTH appear with brand + channel subtotal
   rows in the Summary queue rollup AND the Plan hiring summary, and each grand total
   equals the sum of the brand subtotals (`HierTable`, unchanged — it already groups by
   brand, so a correctly-filed queue rolls up correctly).
2. **Startup matrix persistence + auto-selection (§19).** The decision matrix (hash +
   cells) and the selected (group × strategy) pair now persist through the storage
   adapter (`KEYS.matrix`). On open (`App` mount effect): if a cached matrix's hash
   matches the live config, the app auto-selects the most favourable cell —
   `bestCell()` (sim-set): lowest all-in £ among cells that hold every SLA (no red
   weeks); if none hold, fewest weeks-red then lowest all-in — with a subtle "based on
   your last matrix run" note (`matrix-autopick-note`); if the cache is stale or absent,
   it restores the last selected pair (else Plan-of-record × active strategy) behind the
   existing stale banner. It NEVER auto-runs the matrix on open — it only ever reads a
   cache. Selecting a cell or re-running the matrix clears the auto-pick note.
3. **Chat UI for §25.** Digital Customer cards gain a **Patience** input in the SLA
   section (helper text: "…seconds a customer waits before abandoning…"), and the
   backlog-limit field is gone for the subtype (retired); Workflow keeps its backlog
   limit. Abandonment now shows where backlog used to: the Plan status card shows an
   **Abandon** KPI, the Data-tab Service columns show **Abandon** for Customer (Backlog
   for Workflow), and the Intraday interval detail uses the Erlang columns (ASA/Abandon/
   SL) for Customer. Backlog columns/fields remain only on the Workflow subtype.

Files: `ui/config-ops.js` (`addQueue(brandId)`), `ui/editors/QueuesEditor.jsx` (per-brand
Add-queue button; customer SLA patience, no backlog), `ui/sim-set.js` (`bestCell`),
`ui/storage.js` (`KEYS.matrix`), `ui/App.jsx` (persist + startup auto-select/restore),
`ui/components/SummaryTab.jsx` (auto-pick note), `ui/components/PlanTab.jsx` (Abandon KPI),
`ui/reporting.js` (Data columns by subtype), `ui/components/IntradayTab.jsx` (Erlang
columns for Customer), `ui/style.js`; new `tests/r3dui.test.js`; `/dist` rebuilt.
The §25.3 model note ("servers = agents × concurrency … the standard chat
approximation, mildly optimistic about juggling costs") is now surfaced on the Digital
Customer card's description (the E1–E3 prose card was dissolved into inline hints in the
P7b restructure, so the caveat lives where the planner configures the chat queue).
