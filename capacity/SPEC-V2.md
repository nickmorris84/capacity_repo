# Capacity Simulator — v2.4 specification & user guide

**Status:** shipping. Build order (Steps 0–6) + integration complete.
**Suite:** 21 gates · 262 tests · 0 failures.
**Engine:** preserved byte-for-byte from v1 (`git diff engine/` is empty).
**Default build:** `dist/capacity-sim.html`.

This is the **baseline document**. It describes what exists today, precisely
enough to change it safely. Part I is the user guide, Part II the technical
spec, Part III the guide to extending it. When you change behaviour, change
this document in the same commit.

---

## 0. What this is, in one paragraph

A workforce capacity-planning simulator for contact-centre operations. You
describe a **structure** (brands → business units → products → channels), the
**queues** that do the work, the **services** customers ask for and the
**journeys** those services take through queues, and the **volume** entering at
each channel. The app derives how much work lands at every queue, runs an
Erlang-based simulation over a 52-week horizon under four hiring strategies and
any number of scenario groups, and shows you the cost/service trade-off as a
decision matrix you can drive.

**The central idea:** queue volume and AHT are **derived, never entered**. You
state demand once (at a channel) and describe routing once (as journeys); the
workload at every station falls out of that. This is what makes the model
consistent when you change one number.

---

# Part I — How to use it

## 1. Getting the app

Open `dist/capacity-sim.html` in any browser. It is fully self-contained
(React, engine, spreadsheet library, styles all inlined) and works offline.
There is no install and no server. Your work autosaves to the browser and is
restored when you return.

## 2. The mental model

Four surfaces, in the order you use them:

| Surface | Question it answers |
|---|---|
| **Home** | What simulations exist, and how healthy are they? |
| **Setup** | What is the world? (structure · queues · services · volume) |
| **Levers** | What could we do, and what could happen? |
| **Results** | What happens if we do it? |

Setup, Levers and Results all read **one shared model**. Change a mix % in
Setup and the Levers matrix re-scores and the Results figures move. There is
no "apply" step.

## 3. Build a working simulation (target: under 3 minutes)

1. **Home → “+ New simulation”** → pick a scope. You land on Setup with an
   empty world and **Structure** open. (The empty state *is* the wizard — there
   is no separate wizard mode.)
2. **Section 1 · Structure.** Add a business unit, then a product inside it,
   then tap the dashed channel chips (Voice, Third party, Digital, Customer
   management) to switch channels on for that product.
3. **Section 2 · Queues.** “+ Add queue” asks three things: a **name**, a
   **type** (inbound call · outbound call · case processing · governance), and
   where it **attaches** — either a structure path, or **shared** (routable
   from any journey; think QA or a shared back office). Tap any queue row to
   open its staffing drawer.
4. **Section 3 · Service catalog.** Add a service (name, activity, product
   request type, optional service-level AHT), then build its **journey**: an
   ordered list of steps, each naming a queue and a **split %**. Governance
   steps also take a **sampling %**.
5. **Section 4 · Channel volume profiles.** Add a profile, choose the node it
   applies at (a channel, or higher — a product or BU), enter the total volume
   per day, and split it across services by **mix %**. The badge turns green at
   100%.

Queue volumes and effective AHT now appear in section 2 — derived, read-only.

## 4. Setup in detail

**Section badges** show completion at a glance (`2 BUs · 3 products · 4
channels`, `4 stations · 1 shared`, `2 profiles · 100% mix`).

**Queue rows** show the type pill, a “modified” dot if you have overridden
defaults, the **derived volume/day**, and the **effective AHT** with a marker:

- `svc` — a single service drives this queue using its own declared AHT
- `weighted` — several services blend; the figure is volume-weighted
- (no marker) — the queue's own fallback AHT applies

**The staffing drawer** (tap a queue row) has six accordions colour-coded by
KPI family: Inputs, Performance, Efficiency, Workforce, Customer, Outputs. The
derived volume appears here **read-only**; everything else (fallback AHT, ASA
target, occupancy ceiling, resourcing model, attrition, shrinkage, churn cost,
agent cost) is editable. “Reset to defaults” restores the queue's staffing.

**Deleting** is guarded. A queue used by any journey, or a service used by any
profile mix, cannot be deleted — you get an amber explanation naming how many
things reference it, instead of a silent break.

**Warnings appear where the cause is**, and never block you:

- *Mix under 100%* — the remainder is flagged as unmodelled volume.
- *Cross-structure flow* — a service whose volume enters at one path but routes
  into a **structural** queue on another path. Fine for shared queues; flagged
  for structural ones so it is a decision, not an accident.

## 5. Levers

**The decision matrix** is every scenario group × every strategy. Each cell
shows all-in **cost**, **SLA** attainment, and **red weeks** with a glyph
(● none · ▲ few · ✕ many). The **cost ↔ service slider** re-scores a “Best fit”
badge live. Tap a cell to select that mix — then “Review in Results →” carries
it to the Results context bar.

**Strategy cards** (the four built-ins) carry their key parameter inline:

- **Meet requirement** — close the requirement gap at the landing week.
- **Buffer above** — requirement × (1 + buffer). *Buffer % is editable here.*
- **Forward backfill** — replace projected leavers only, never hire for growth.
  *Look-ahead months editable here.*
- **Manual plan** — your per-queue hires exactly as entered; ignores the cap.

**Scenario group cards** show how many factors are in force and a mini timeline
of when.

**Hiring caps** close the page: a brand × channel grid plus a total ceiling.
The effective limit is the **tightest of segment, brand and total**. These are
real constraints — tighten the total ceiling and red weeks appear in the matrix.

## 6. Results

One **context bar** (strategy · scenario · save run · freshness) governs five
lenses that share **one week cursor**:

- **Summary (year)** — the decision matrix, a verdict sentence, six KPI-family
  cards, and the risk register with BU and channel filters.
- **Plan (week)** — the RAG ribbon, glyphed in every cell, grouped by path.
  **Tapping a week sets the cursor for every other lens.**
- **Intraday (day)** — required vs available agents per interval for the
  inherited week, with a ± stepper.
- **Data** — the weekly grid grouped by path, columns under KPI-family colours,
  with a template-compatible CSV export.
- **Flow** — the volume Sankey played through the horizon: play/pause and a
  scrubber, animated from cached weekly results (no re-simulation).

When a recompute is running, the freshness pill reads **“recalculating…”** —
the interface stays responsive while it works.

## 7. The Ecosystem view

From Home, tap a card's thumbnail or the **Ecosystem** button. It is a
proportional volume Sankey: **brand → channel → service mix → journey queues →
outcome**. Node heights and ribbon widths are real derived volumes; governance
stations are purple; the outcome column splits resolved vs failed. It is
view-only — “Edit in Setup” takes you to the editor.

## 8. The template round-trip

**Setup → Download template** gives you an `.xlsx` pre-filled with your current
values, in four sheets mirroring the four Setup sections. Edit it in Excel and
**Upload data**: the app validates the file and shows a report banner —
what loaded (BUs · queues · services · profiles), any **errors** in red
(references to things that don't exist, a mix over 100%), and any **warnings**
in amber. Nothing is applied silently, and a file it can't read produces a
readable message rather than a crash.

The round trip is exact: export → edit → import → export reproduces your model.

---

# Part II — Technical specification

## 9. Layer map

```
engine/engine.js          PRESERVED simulation engine (pure JS, no DOM)
      ▲
model/adapter.js          v2 model → engine config  (the seam)
model/derive.js           the derivation rules      (the heart)
model/migrate.js          v1 config → v2 model
model/taxonomy.js         fixed enumerations
      ▲
ui/v2/compute.js          matrix + detailed run     (worker-ready boundary)
ui/v2/model.js            v2 model state + pure reducer ops
ui/v2/{template,ecosystem,store,hooks,tokens}.js
      ▲
ui/v2/{Home,Setup,Levers,Results}Page.jsx  +  App.jsx (shell)
```

Dependencies point **upward only**. `model/*` never imports React or touches the
DOM; `engine/*` imports nothing of ours at all.

## 10. Domain model

```ts
type ID = string;

interface Brand         { id: ID; name: string; businessUnits: BusinessUnit[] }
interface BusinessUnit  { id: ID; name: string; products: Product[] }
interface Product       { id: ID; name: string; channels: ChannelInstance[] }
interface ChannelInstance { id: ID; channel: Channel }

type Channel     = 'voice' | 'third_party' | 'digital' | 'customer_management'
type Activity    = 'service_request' | 'lead' | 'decision'
                 | 'collections' | 'upsell_xsell' | 'maintenance'
type ProductReq  = 'new' | 'existing'
type QueueType   = 'inbound_call' | 'outbound_call' | 'case_processing' | 'governance'

// A queue is EITHER pinned to a structure path OR shared (routable from any journey).
type QueueAttachment =
  | { kind: 'structural'; channelInstanceId: ID }
  | { kind: 'shared' }

interface Queue {
  id: ID; name: string; type: QueueType;
  attachment: QueueAttachment;
  fallbackAhtSec: number;      // used when a service declares no AHT
  staffing: Staffing;          // occupancy, shrinkage, attrition, resourcing, costs
  _modified?: boolean;         // UI marker: staffing overridden
}

// Catalog-global: product-agnostic, bound to structure only via profiles.
interface Service {
  id: ID; name: string;
  activity: Activity; productRequest: ProductReq;
  ahtSec?: number;             // optional override, applied at EVERY journey step
  journey: JourneyStep[];
}
interface JourneyStep {
  queueId: ID;
  splitPct: number;            // % of the service's volume reaching this step
  samplingPct?: number;        // governance steps: % of cases sampled
  lagDays?: number;            // parsed, NOT applied in v1 (see §13)
}

// Demand entry point. Canonical at channel; may attach at product or BU.
interface ChannelVolumeProfile {
  id: ID;
  appliesAt: { level: 'bu' | 'product' | 'channel'; nodeId: ID };
  totalVolume: number;
  mix: { serviceId: ID; pct: number }[];   // sum ≤ 100
}

interface Model {
  brands: Brand[]; queues: Queue[]; services: Service[]; profiles: ChannelVolumeProfile[];
  engineConfig?: EngineConfig;   // preserved v1 global config (settings, hiring, scenarios)
}
```

`engineConfig` is the v1 configuration **minus its queue list**, carried
verbatim. It is not part of the template; it travels with the model so Levers
and Results can run the engine.

## 11. Derivation rules (`model/derive.js`)

These are the semantics of the whole product. Each is unit-tested.

**R1 · Volume propagation.** Service volume = deepest applicable profile total ×
mix %. When two profiles feeding the same service sit on the **same structural
path**, the deeper one supersedes the shallower (channel > product > BU —
“deepest wins”). Profiles on **disjoint paths both contribute** and are summed.

**R2 · Queue workload & effective AHT.**
```
queue volume        = Σ over services of (service volume × splitPct × samplingPct)
per-service AHT     = service.ahtSec ?? queue.fallbackAhtSec
queue effective AHT = Σ(step volume × per-service AHT) / Σ(step volume)
```
The marker returned alongside is `svc`, `weighted` or `queue` (see §4).

**R3 · Derived, never entered.** Queue volume and effective AHT have no input
anywhere in the UI. This is an invariant, enforced by a gate assertion.

**R4 · Cross-structure guard.** Evaluated **per feeding profile**: a journey
step into a *structural* queue whose channel path does not contain that
profile's node raises a **warning**. A service fed both in-path and out-of-path
flags only the out-of-path source. Shared queues accept volume silently. Never
blocks.

**R5 · Shared-queue cost allocation.** By **handling minutes**
(volume × per-service AHT), split across feeding structure nodes in proportion
to each node's share of that service's volume.

**R6 · Referential integrity.** `canDeleteQueue` / `canDeleteService` return
`{ ok, blockedBy[] }`. Deleting a queue referenced by any journey, or a service
referenced by any profile mix, is blocked with the dependents listed.

**R7 · Engine behaviour retained.** Pool sharing remains the capacity link;
deflection/redial remain failure-driven knock-ons; journey splits are mapped
onto the engine's inputs by the adapter, not by changing the engine.

**Validation** (`validateModel`) separates:

| Kind | Severity | Meaning |
|---|---|---|
| `dangling_journey_queue` | error | journey step names a missing queue |
| `dangling_mix_service` | error | profile mix names a missing service |
| `dangling_profile_node` | error | profile applies at a missing structure node |
| `mix_over_100` | error | a profile's mix exceeds 100% |
| `unmodelled_remainder` | warning | a profile's mix is under 100% |
| `cross_structure` | warning | out-of-path structural routing (R4) |

## 12. The preserved engine contract

The engine was audited and is **fit to preserve**. Do not "improve" it — golden
masters pin these behaviours, and changing them silently invalidates every
number the product has ever produced.

1. **Voice** = Erlang B/C via stable recurrences plus an **Erlang A
   approximation**: abandonment solved as a bisection fixed point with
   exponential patience; SL = P(answer ≤ target) under the combined hazard.
   Deterministic and memoised. Document it as an approximation.
2. **Digital live** = the same machinery with `servers = agents × concurrency`
   (the standard chat approximation, mildly optimistic about juggling).
3. **Workflow/backlog** conserves volume exactly:
   `start + arrivals = served + endBacklog`, per interval and per week.
4. **Requirements** satisfy ASA ∧ max-abandon ∧ occupancy-ceiling
   simultaneously; fractional agents by interpolation.
5. **FTE and hires are fractional throughout.** Round only at presentation.
6. **Shrinkage is supply-side only** — `hours × (1 − shrinkage − trainingShrinkage)`,
   additive, clamped ≥ 0.02. Demand carries no shrinkage. Never double-count.
7. **Cross-queue flow is failure/deficit-driven, not occupancy-triggered.**
   There is no occupancy-threshold spill anywhere in the engine. (The original
   mockups' “spill when occupancy > 85%” copy was a **rename**, not a feature —
   see §13.)
8. **Hiring** ranks candidate hires by marginal value (avoided churn cost per
   head, tie-break earliest breach week); caps apply segment → brand → total,
   **tightest wins**.

**Caches.** Erlang results are memoised with offered load quantised to 0.05
Erlangs. A bucket's stored value therefore depends on which exact load first
populated it, so cross-process comparisons of derived figures can differ by a
few tenths of a percent. This is approximation noise, not drift — compare
in-process (see §17).

## 13. Locked decisions

| Question | Decision |
|---|---|
| Journey-step **lag** (volume shifting across weeks) | **Out of v1.** `lagDays` is parsed and preserved, never applied. |
| Shared-queue **cost allocation** | **Handling minutes** (not volume share). Supersedes the brief's D23. |
| Mix under 100% | **Warn, never block** — flagged as unmodelled remainder. |
| Occupancy-triggered spill | **Not built.** UI copy renamed to the engine's real deficit/failure-driven semantics. |

## 14. The adapter (`model/adapter.js`)

`v2ToEngineConfig(model)` is the seam that lets the domain model and UI be
rebuilt while the engine stays untouched. It:

1. runs the derivation,
2. rebuilds each engine queue from its carried staffing physics, overriding
   **only** the demand-derived fields (`dailyVolume` ← derived volume,
   `aht` ← derived effective AHT),
3. fills every engine-required field for queues authored in Setup (which carry
   only the compact drawer staffing) — `burn`, `wf`, intraday `profile`,
   `channel`, `brandId`. **Migrated queues override these defaults exactly**, so
   the round trip is numerically unchanged,
4. reassembles the preserved global config.

`roundTripConfig(cfg)` = migrate → adapt in one call. The proof that the engine
is preserved is a gate assertion:
`simulate(roundTripConfig(cfg)) ≡ simulate(cfg)` exactly, for every strategy,
from both a clean and a hard-warmed cache.

## 15. Compute layer (`ui/v2/compute.js`)

| Function | Cost | Use |
|---|---|---|
| `computeBase(model)` | the full matrix (groups × strategies) | Levers, Results |
| `computeDetail(cfg, selected)` | one run with daily capture | Results lenses |
| `quickHeadline(model)` | one S1 run | Home card chips |
| `runResults(model, sel)` | base + detail | tests, one-shot |

The matrix is **richer than v1's**: same `allIn` / `redWeeks` / `status` /
bestCell-compatible shape **plus per-cell SLA attainment**, so Levers (cost +
SLA + red) and Results (cost + red) read one source of truth.

These are plain functions with no React or DOM dependency — a Web Worker is a
drop-in behind `runnerFor()`. Today the UI keeps them responsive with
`useDeferred` (`ui/v2/hooks.js`), which runs the compute after paint and exposes
a `pending` flag for the “recalculating…” state.

## 16. UI conventions

**Design system** (`ui/v2/tokens.js`) — one injected stylesheet, extracted from
the mockups.

- Blue-led on white: `--blue #185FA5`, tint `#E6F1FB`, canvas `#fbfaf7`.
- **Six KPI families, fixed colour and order:** Inputs (blue #185FA5) ·
  Performance (teal #0F6E56) · Efficiency (purple #534AB7) · Workforce (coral
  #993C1D) · Customer (pink #993556) · Outputs (amber #BA7517).
- **Status is always colour + glyph** — ● green, ▲ amber, ✕ red. Status colours
  are reserved for RAG and never used as family colours.
- Tabular numerals on every figure. Hairline `0.5px` borders. Focus-visible
  rings on every interactive element.

**Honesty rule.** Anything that looks clickable must do something. Controls not
yet implemented are rendered **disabled with a reason**, never silently inert.
Currently disabled: Compare, Presets, the card ⋯ menu, Save run,
“Start from a template”.

**Component contract.** Pages are controlled: they take `model` +
`onModelChange` (and `selected` + `onSelectedChange` where the matrix
selection is shared) and never own the model themselves. Each page's
`*-main.jsx` wraps it in a small stateful host so it still runs standalone —
which is how the per-page gates test them.

## 17. Persistence

`ui/v2/store.js` — `saveModel` / `loadModel` / `clearModel`, keyed
`capacity.v2.model`, debounced 300 ms by the shell. localStorage today;
IndexedDB is a drop-in behind the same three functions (see §21).

## 18. Template schema

Four sheets mirroring the four Setup sections. Ids are carried so structure and
references reconstruct exactly.

| Sheet | Grain | Columns |
|---|---|---|
| **Structure** | one row per channel (plus rows for empty products/BUs) | `BrandId, Brand, BUId, BusinessUnit, ProductId, Product, ChannelId, Channel` |
| **Queues** | one row per queue | `QueueId, Name, Type, Attachment, ChannelId, FallbackAhtSec, AsaTargetSec, MaxAbandon, PatienceSec, Shrinkage, OccupancyCeiling, Resourcing, AttritionPct, ChurnCost, FailedToChurnPct, AgentCost` |
| **Services** | one row per **journey step** (service fields repeat) | `ServiceId, ServiceName, Activity, ProductRequest, ServiceAhtSec, StepOrder, QueueId, SplitPct, SamplingPct` |
| **Channel volume profiles** | one row per **mix entry** (profile fields repeat) | `ProfileId, AppliesLevel, AppliesNodeId, TotalVolume, MixServiceId, MixPct` |

`ui/v2/template.js` is pure (`modelToSheets` / `sheetsToModel` /
`validateRoundTrip`); `ui/v2/template-xlsx.js` binds SheetJS and **lazy-loads
it** (`await import("xlsx")`) so the ~400 KB library never enters a session that
doesn't import Excel.

## 19. Build outputs

`npm run build` → `scripts/build.js`:

| File | What |
|---|---|
| `dist/capacity-sim.html` | **the product** — v2 shell, self-contained, offline, minified |
| `dist/capacity-sim.jsx` | v2 as an ESM artifact (react/xlsx external) |
| `dist/capacity-sim-v1.html` | superseded v1 app, retained for its regression gate |

## 20. Test gates

`npm test` runs 21 gates, 262 tests. Each is a zero-dependency Node script;
UI gates bundle with esbuild and drive JSDOM, asserting **zero console
errors/warnings** throughout.

| Gate | Tests | Guards |
|---|---|---|
| P1 engine | 20 | the original engine proof |
| **Step 0 golden masters** | 18 | engine drift at six audit risk sites |
| Step 1 derivation | 17 | R1–R6 |
| Step 1 migration | 7 | v1 → v2, exact round trip |
| Step 1/3 adapter | 6 | `simulate(adapted) ≡ simulate(original)` |
| Step 2 Setup | 13 | derived read-only, editing, guards, warnings |
| Step 3 Results | 11 | five lenses, shared cursor, Flow play |
| Step 4 Levers | 9 | matrix, real levers re-score it |
| Step 5 Home | 9 | cards, forks, Ecosystem Sankey, honest chrome |
| Step 6 template | 7 | round trip through **real .xlsx** |
| Integration app shell | 8 | one model across four surfaces, autosave |
| R1/R2/R3a/R3b/R3c/R3d + P5/P7 | ~135 | the preserved v1 behaviours |
| Build | 2 | the **packaged** artifact boots clean |

**Golden masters.** `npm run golden:gen` regenerates `tests/golden/golden.json`.
Only do this when an engine change is *intended* — the git diff then shows
exactly which numbers moved. The gate compares live output to the committed
fixtures with a float tolerance, plus standalone invariant checks (Erlang C ≡
direct summation, overload abandon > 1 − N/A, exact backlog conservation,
shrinkage = base × (1 − shrink), requirement monotonicity, fractional FTE).

---

# Part III — Making changes

## 21. Where to touch what

| To change… | Edit | Then update |
|---|---|---|
| A derivation rule | `model/derive.js` | `tests/derive.test.js`, §11 here |
| The taxonomy | `model/taxonomy.js` + labels in `ui/v2/model.js` | Setup pickers |
| What the engine receives | `model/adapter.js` | `tests/adapter.test.js` |
| Model shape / an edit operation | `ui/v2/model.js` (pure ops) | the page that calls it |
| A page's layout or copy | `ui/v2/*Page.jsx` | that page's gate |
| Colours, type, spacing | `ui/v2/tokens.js` | — (all pages inherit) |
| Matrix or run computation | `ui/v2/compute.js` | Levers + Results gates |
| Template columns | `ui/v2/template.js` | `tests/template.test.js`, §18 here |
| Persistence backend | `ui/v2/store.js` (3 functions) | app gate |
| Packaging | `scripts/build.js` | `tests/build.test.js` |

**Adding a new edit operation** is the common case: write a pure
`(model, …args) => newModel` function in `ui/v2/model.js`, call it from the
page, assert the derived consequence in that page's gate. Never mutate — every
op clones.

## 22. Invariants — do not break these

1. **The engine is not edited.** `git diff engine/` must stay empty. Everything
   the engine needs is arranged by the adapter.
2. **Queue volume and AHT are never user-entered.** No input, anywhere.
3. **`model/*` stays pure** — no React, no DOM, no browser globals. It must run
   in Node and in a Worker.
4. **Golden masters stay green** unless an engine change is deliberate and the
   regenerated diff is reviewed.
5. **Warnings inform; errors block.** Cross-structure flow and sub-100% mixes
   are decisions the planner makes, not failures.
6. **Zero console noise.** Every UI gate asserts it; a React key warning is a
   failing build.
7. **Status is colour *and* glyph.** Never colour alone.

## 23. Working commands

```bash
npm test              # all 21 gates
npm run test:derive   # one gate (also :setup :results :levers :home
                      #   :template :app :adapter :migrate :golden :build)
npm run build         # rebuild dist/
npm run golden:gen    # regenerate engine fixtures — deliberate changes only
```

A change is done when: the relevant gate covers it, `npm test` is green,
`dist/` is rebuilt if user-facing, and this document reflects it.

## 24. Known gaps / candidate next steps

> **See also [GAP-ANALYSIS.md](./GAP-ANALYSIS.md)** — a measured v1 → v2.4
> feature diff. v2 re-implemented a *subset* of v1's editable surface: ~32 of
> v1's 106 fields, 9 of 53 data columns, 1 of 6 charts. Almost all of it is
> missing **UI**, not missing engine capability — the v1 config still flows
> through `engineConfig` and is still simulated. That document carries the
> restoration order and the list of reusable v1 modules.

The items below are the v2-native follow-ons; the parity work is in the gap
analysis. All optional — none blocks the core product.

1. **IndexedDB persistence** — swap `store.js`'s localStorage for IndexedDB
   behind the same three functions. Small and testable.
2. **Real Web Worker thread** — move `compute.js` off the main thread. The
   *felt* jank is already gone via `useDeferred`; this is the remaining
   correctness-under-load improvement. Boundary is ready (`runnerFor()`).
3. **Multi-simulation storage** — Home currently shows one live simulation;
   persisting several (with the create-forks producing genuinely different
   scopes) is the “workspace” feature.
4. **Deferred UI from the brief:** Compare, Presets, saved runs (“Save run”),
   the card ⋯ menu, start-from-template, subset scope selection with
   severed-flow warnings.
5. **Per-step AHT overrides** (today AHT overrides are per-service), and
   **journey lag** (§13) if week-shifting demand becomes necessary.
6. **Backend phase (P5 in the original brief)** — auth, Postgres config store,
   role × segment permissions. Explicitly out of scope until asked for.
