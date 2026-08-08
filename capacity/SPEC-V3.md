# SPEC v3 — the domain-model app (current baseline)

**Status: this is the shipping baseline.** It supersedes SPEC-V2.md's Setup,
model-layer, persistence and template sections; SPEC-V2 §12 (the preserved
engine contract), §5–§6 (Levers/Results behaviour), §16 (UI conventions),
§19 (build outputs) and §22 (invariants) still apply unchanged.
Authority chain: **DOMAIN-MODEL.md v1.2 (FINAL)** defines the model;
**REVIEW-SETUP.md** (signed off) defines the Setup surface; **BUILD-PLAN.md**
records the phases (M1–M4 · U1–U6 · F1, all landed); this file describes what
ships.

---

## 1. The mental model

```
Registry (flat, five lists)          Request types (the ONLY linking surface)
  Brands ─┐                            name · activity · group · product
  Business units │                     assignment: brandIds[] × buIds[] (empty ⇒ All)
  Channels (from taxonomy, ├──used by──▶  AHT override (else queue AHT)
           + channel defaults) │        processes, ONE per channel:
  Process groups │                        entry step · ordered steps
  Products ─┘                             { queueId, splitPct, samplingPct?,
                                            terminal?, outcome? }
Queues (global; optional home;            enumerated outcomes · embedded rework
        ~30 staffing params)              (split p ⇒ effective p/(1−p))
Volume entries (sparse, any level,
        daily and/or 52-week series)
engineConfig (carry: the preserved engine's globals)
```

- **Nothing in the registry is interlinked.** Entities exist, then request
  types wire them together. Renames propagate by id; deletes are guarded
  with dependents listed (V6).
- **Interactions live in processes** (v1.2 ruling): rework, converts,
  redial, spill are routing — process steps. What stays on the queue is
  staffing physics (supports/cross-skill/service teams), drawn dashed on
  the Map.
- **The Map is a pure generated artefact.** Nothing is authored on it.

## 2. The volume cascade (deliberate reversal of v2.4 deepest-wins)

1. Totals cascade **down** — the highest entered figure is authoritative.
2. Children split a parent by: entered finer figures as weights → equal
   split otherwise.
3. Shapes (52-week series) cascade down and aggregate **up** to queues as
   volume-weighted blends; they reach the engine as `weeklyVolumes`.
4. Conflicts are **scaled AND flagged** (V5) — never silently resolved.
5. Provenance on every number: `entered · equal split · scaled · sum`.

## 3. The six-tab Setup

| Tab | Role | Editor |
|---|---|---|
| Structure | the registry | five flat lists; channels enable from the taxonomy and carry channel defaults |
| Queues | stations + physics | master–detail grouped by home; six KPI families × Advanced disclosures (~30 params); manual hires (S4); service teams as Shared capacity; blast radius per row |
| Request types | wire it together | master–detail; identity · assignment (All spelled out, V2 inline) · per-channel process editor with terminal+outcome and live V3 |
| Volume | the contributor tab | the cascade grid: spine rows, type-anywhere, provenance badges, V5 notes, 52-week shapes from the preset library |
| Map | does it hang together? | generated: queue nodes by journey depth, flow edges from steps (split·sample), dashed capacity links; validation panel with per-issue jump-links |
| Defaults | inherited physics | simulation frame · hiring policy · overtime (`settings.ot`) · cost model · customer behaviour · pattern libraries |

Completion markers (▲) appear on tabs only when something needs attention;
a progress strip names the next step while the model is incomplete and
disappears when it isn't.

## 4. Layer map (new/changed files only)

```
model/domain.js         shapes · All-semantics leaves() · validation (V2/V3/dangling) · delete guards · queueUsage
model/cascade.js        the volume resolver (provenance, scaling notes, shapes)
model/propagate.js      cascade → per-queue volume, effective AHT (+marker), weekly, usage
model/ops.js            every Setup edit as a pure reducer; blank/sample models; import report
model/bridge.js         domain model → preserved-engine cfg (weeklyVolumes when shaped; defaults filled)
model/migrate-domain.js v2.4 model → domain model (deepest-wins applied once, here)
model/store-domain.js   capacity.v3.model; v2.4 saves migrate on load, old key kept for rollback
model/template-domain.js template v3: Registry · Queues (StaffingJson) · Request types · Steps · Volume entries (W1..W52)
ui/v2/SetupV3Page.jsx   the six-tab shell + all editors + Map + Defaults
ui/v2/setup-v3-main.jsx standalone mount (gates, preview)
ui/v2/template-domain-xlsx.js  SheetJS binding for template v3
ui/v2/compute.js        toEngineCfg(): domain → bridge, v2.4 → old adapter (one cfg boundary)
ui/v2/App.jsx           ONE model (domain), Setup=SetupV3, Levers/Results via the bridge
```

The old v2.4 modules (`model/derive.js`, `model/adapter.js`,
`ui/v2/SetupPage.jsx`, `ui/v2/template.js`) remain in-tree, gate-covered,
as the migration source — the app no longer routes to them.

## 5. Persistence & template

- Autosave (300 ms debounce) to `capacity.v3.model`. On first load: v3 key →
  else a stored v2.4 model migrates (old key left intact for rollback) →
  else the packaged default migrates.
- Template v3 = five sheets, hand-editable, real-xlsx round-trip proven
  byte-identical (export → edit → import → export). `engineConfig` is a
  carry, not template content; upload re-attaches it and shows the
  validation report (nothing applies silently).

## 6. Equivalence guarantees (the M-gates' theorems)

- **Bridge:** for migrated flat-shape models, the domain path simulates
  **identically** to the old adapter path — cfg field equality and exact
  compactRun equality for S1–S4.
- **Migration:** v1 cfg → v2.4 → domain reproduces derived volumes,
  effective AHT and markers exactly at every hop.
- **S4:** manual hires authored on the domain model reach `wf.hires` and
  raise trained staffing end-to-end.
- Engine untouched: `git diff engine/` stays empty; golden masters pin it.

## 7. Test gates (36 files, `npm test`)

Everything from SPEC-V2 §20 plus: `domain` (19) · `ops` (12) · `bridge` (5)
· `store-domain` (5) · `template-domain` (6) · `setup-v3-ui` (10) ·
`structure-ui` (9) · `rt-ui` (11) · `queues-ui` (10) · `volume-ui` (7,
incl. the owner's worked example through the UI) · `map-defaults-ui` (7).
The integration gate now asserts the six-tab app.

## 8. Known gaps / next

- Style pass over the six-tab Setup (owner-approved sequencing: function
  first). Sticky section nav in long forms; progressive disclosure in the
  request-type detail.
- Results/Levers/Home analysis depth (GAP-ANALYSIS Phases 2–4) — charts,
  Data-tab columns, saved runs — unchanged by this rebuild, next cycle.
- Weekly-series editing beyond paste/presets (drag curves); shape preview
  sparklines.
- Uncovered-volume warnings could deep-link to the exact spine row.
