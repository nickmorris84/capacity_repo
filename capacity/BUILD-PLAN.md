# Build plan — domain redesign (against DOMAIN-MODEL v1.2 + REVIEW-SETUP)

**Status:** recommended phasing, for the owner's go. Model-layer phases come
first — every UI tab then snaps onto ops and bridges that are already pure,
tested and gated. The shipping v2.4 app stays green throughout (all 22 gates);
the swap to the new Setup happens only at the end.

**Standing rules for every phase:** engine untouched (golden masters guard it) ·
each phase lands with its own gate wired into `npm test` · docs updated in the
same commit · pushed only when the full suite is green.

---

## The phases

### Model layer first (pure JS, no UI — fast to test, cheap to revise)

| # | Phase | Delivers | Done when | Size |
|---|---|---|---|---|
| **M1** | **Domain ops + fixtures** | pure reducers for every edit the six tabs will make: registry CRUD (brands · BUs · channels+defaults · groups · products), queue CRUD + staffing, request-type CRUD (assignment, per-channel processes, steps, outcomes), volume-entry ops; blank/empty/sample domain fixtures; import-report builder | ops gate green; every reducer clone-pure; guards enforced through ops | M |
| **M2** | **Engine bridge** | `domainToEngineConfig()`: propagate → engine queues (derived volume + AHT; **weekly shapes → the engine's `weeklyVolumes` input**, so seasonality finally reaches the simulation); engineConfig carry; levers still reachable | round-trip gate: migrated default config simulates **identically** to the old adapter path (flat shapes); golden masters green | M |
| **M3** | **Persistence + migration** | store schema v2; a v2.4 saved model auto-migrates to domain on load, deterministically | fresh load, v2.4-load and reload all gated | S |
| **M4** | **Template v3** | sheets per DOMAIN-MODEL §10: Registry · Queues · Request types/steps · Volume entries; real-xlsx round-trip; import validation report | export → edit → import → export identical, through real bytes | M |

### UI phases (each tab against its signed-off spec section)

| # | Phase | Delivers | Done when | Size |
|---|---|---|---|---|
| **U1** | **Setup shell** | six tabs (Structure · Queues · Request types · Volume · Map · Defaults), completion state on tabs, progress strip, master–detail scaffold; domain model threaded through the app shell | navigation gate; old pages still green | M |
| **U2** | **Structure tab** | five flat lists, add/rename/delete-with-guard, channel defaults on channels | registry gate (incl. guard messages) | S–M |
| **U3** | **Request types tab** | the heart: identity · assignment (All semantics spelled out) · per-channel process editor (entry, steps, splits, sampling, terminal+outcome, rework) · inline V2/V3 | editing gate incl. live derived-volume assertions | **L** |
| **U4** | **Queues tab** | master–detail editor, six families × three tiers (~30 params), manual hires (S4 becomes real), shared capacity (service teams), blast-radius badges | editor gate; S4 plans real hires end-to-end | **L** |
| **U5** | **Volume tab** | the cascade grid: spine rows, type-anywhere, provenance badges, scaling flags, 52-week series, shapes + preset libraries | cascade-grid gate incl. owner's worked example in the UI | **L** |
| **U6** | **Map + Defaults** | Map generated from the model (flow edges from process steps; capacity links dashed; validation panel with jump-links); Defaults form (categories A·C·D·E·F·I) | map renders sample + empty models clean; defaults edit → matrix moves | M |
| **F1** | **Swap + finish** | Levers/Results re-plumbed to the bridge; dist swap to the new Setup; SPEC-V2 rewritten to match; GAP-ANALYSIS re-scored | full suite green; packaged build boots the six-tab app | M |

Sequence: M1 → M2 → M3 → M4 → U1 → U2 → U3 → U4 → U5 → U6 → F1.
M-phases have no UI risk; U-phases have no model risk left. Reviews for the
Results/Levers/Home pages (analysis depth, charts, saved runs) follow F1 as
their own cycle — F1 only re-plumbs them.

## Which Claude model per phase

Recommendation if you want to manage cost with `/model`:

| Phases | Model | Why |
|---|---|---|
| **M2 · U3 · U5 · U6** | **Fable 5 / Opus 5** | numeric-equivalence risk (M2), the most novel editors (U3, U5), generative Map layout (U6) — errors here are expensive |
| M1 · M3 · M4 · U1 · U2 | Sonnet 5 acceptable | mechanical, pattern-following work against a precise spec and existing gates |
| U4 · F1 | either | large but patterned (U4 mirrors U3's shapes); F1 is careful plumbing — Fable/Opus if in doubt |

Simplest safe option: stay on Fable 5 throughout; switch down only for M1/M3/M4
if cost matters.

## Checkpoints

Natural review points where a look at the running app is worth your time:
after **U1** (the shell feels right or it doesn't), after **U3** (the core
editing loop), and after **U5** (the cascade grid — the biggest UX bet).
