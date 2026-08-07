# Page review 1 — Setup (draft 4, against DOMAIN-MODEL v1.0)

**Status:** structure proposal for sign-off. Drafts 1–3 established the
navigation grammar and tab purposes; the domain model then changed under them.
This draft is the reconciliation: Setup as it should be **under the final
model**. Two calls remain (§6).

---

## 1. Goal (unchanged)

> **Define the request types and their processes — and everything they depend
> on — then prove the world hangs together.**

The test for anything on this page: it is either *a thing a process needs*, or
*the check that the processes are sound*.

**Standing principle:** hiding is a default, never a deletion. Every parameter
the engine reads is reachable in ≤ 2 clicks; the default view shows what is
commonly changed.

## 2. The six tabs

The domain model dissolves the old Services-vs-Flows question (processes live
*inside* request types, per channel) and gives Structure a sharper job (the
registry). Result:

```
Structure │ Queues │ Request types │ Volume │ Map │ Defaults
```

The order **is** the dependency order — each tab consumes what the previous
ones defined. Completion state lives on the tabs (● / ▲ / count); while the
model is incomplete, a slim progress strip names the next thing to do.

| # | Tab | Purpose (one line) | Cadence | Owner |
|---|---|---|---|---|
| 1 | **Structure** | *Define the vocabulary of the estate* | set once | admin |
| 2 | **Queues** | *Define the stations and their physics* | tuned constantly | planner |
| 3 | **Request types** | *Define what customers ask for, and how each is processed* | on process change | planner / ops design |
| 4 | **Volume** | *State how much arrives, at whatever granularity you know* | every forecast cycle | contributor |
| 5 | **Map** | *Prove the world hangs together* | after each edit | planner |
| 6 | **Defaults** | *The physics everything inherits* | set once, tuned rarely | admin |

Navigation grammar (settled in draft 2, unchanged): horizontal tabs for peers ·
master–detail for instances · one scrolling form with sticky section-nav for an
instance's parameters · nesting only where it mirrors real hierarchy. **The
overlay drawer is retired.**

---

## 3. Tab by tab

### 3.1 Structure — the registry

Defines all five reference-data entities:

- **Brands**, and **Business units** under them (rename/delete guarded — V6).
- **Channels** — enable the subset of the taxonomy the estate uses; each
  enabled channel carries its **channel defaults** (ASA, abandon, patience,
  concurrency, SLA within/target — globals category B), which new processes
  inherit.
- **Process groups** — created under their owning BU.
- **Products** — created under their owning brand.

Nesting is justified everywhere here: it is all genuine hierarchy. This is the
only tab whose v2.4 layout (collapsible tree + chips) survives mostly intact —
extended with rename, delete-with-guard, and the two new entity lists.

### 3.2 Queues — stations and physics

- **Master–detail:** grouped queue list (by *home*, with a "no home / global"
  group) → full-width editor, six KPI-family sections in one scroll, sticky
  nav, modified dots, "Advanced (n)" disclosure per family for the long tail.
- Restores all ~30 engine parameters (the draft-2 family mapping stands),
  including pipeline (req-to-start, training, learning curve), burnout,
  OT, backlog limit, concurrency, subtype, starting FTE, and **manual hires**
  (week × heads — S4's input), cross-linked from the Levers Manual-plan card.
- **Blast radius on every row:** *"used in 4 processes across 3 brands"* (V4),
  visible before any delete attempt.
- **Queue interactions restored here** ⬜C-b: support / spill / pool links
  between queues as an editable list (typed edges: supports, shares-pool,
  converts-to), per-queue in the Workforce/Customer families plus a
  consolidated "Interactions" list in this tab. The Map renders them; editing
  stays here (view-first Map, per the original D14).
- **Service teams** live here as a "Shared capacity" group — siblings of
  queues, with their eight parameters.

### 3.3 Request types — the heart of Setup

**Master–detail.** The list shows: name · group chip · product chip ·
assignment chips (brands × BUs, "All" rendered explicitly) · channel icons ·
validation state (V1/V2/V3).

The detail form, in order:

1. **Identity** — name, activity, product-request classification; process
   group (select — registry); product (optional select — registry).
2. **Assignment** — brand multi-select and BU multi-select, empty ⇒ All, with
   the resolved scope spelled out: *"Applies to: Brand A, Brand B · all BUs"*.
   Double-cover warnings (V2) appear inline here.
3. **AHT override** — optional; falls back to queue AHT.
4. **Processes, one per enabled channel** — a channel picker ("Voice ·
   Digital · + add channel"), then per channel the journey editor:
   - entry step (fixed first), ordered steps: queue (select from registry),
     split %, sampling % (governance), **terminal flag + outcome** picker;
   - the process's enumerated outcomes editable as chips;
   - rework branches are just steps whose split expresses the error rate —
     with the effective multi-round split p/(1−p) computed and shown;
   - end-point completeness (V3) validated live.

### 3.4 Volume — the cascade surface

Replaces profile cards with the **cascade grid**: rows are the spine
(brand → BU → request type → channel), one value column, one provenance badge
per row (`entered` · `weighted` · `equal` · `inherited`), one shape column.

- Type a number at **any** row; everything beneath re-resolves live; scaling
  reconciliations flagged inline (V5).
- A row's value can be a flat daily figure or a **52-week series** (grid entry
  or template import).
- **Shapes:** seasonality curve and arrival pattern editable at any row
  (preset chips from the libraries in Defaults, save-as-new); unset rows
  inherit from above; queue-level effective shapes shown read-only as the
  volume-weighted blend (shapes aggregate up).
- This is the contributor's tab: cleanly separable scope, nothing else to
  break.

### 3.5 Map — the verification step

The owner's requirement verbatim: *"once all are defined, you should be able
to see a global view of queues and interactions."*

- **Two lenses on one surface:** *flow* (volume through processes → queues →
  outcomes — the existing Sankey, re-plumbed to the new model) and
  *interactions* (the capacity links between queues: supports, shares-pool,
  converts-to — dashed, distinct from volume ribbons).
- **The validation panel lives here:** V1 coverage, V2 double-cover, V3
  end-point completeness, V5 reconciliations — each with a jump-link to the
  offending object. The Map is where "does it hang together?" gets a yes/no.
- View-first: tap a node/edge → details + "Edit in <tab>". Also reachable
  from Home (same surface, second entry point). ⬜C-a

### 3.6 Defaults — what everything inherits

The remaining globals, after the re-homing the registry caused:

| Category | Where it lives now |
|---|---|
| A Simulation frame (11) | **here** |
| B Channel defaults | **Structure › Channels** (moved) |
| C Workforce policy (10) | **here** |
| D Overtime (4) | **here** |
| E Cost model (3) | **here** |
| F Customer behaviour (7) | **here** |
| G Risk thresholds (19) | **Results › risk register** (a reading lens) |
| H Service teams | **Queues › Shared capacity** (moved) |
| I Pattern libraries | **here** (applied in Volume) |

One scrolling form, sticky group nav — the same pattern as the queue editor.

---

## 4. What this restores vs v1 (the gap ledger)

| Gap (GAP-ANALYSIS) | Closed by |
|---|---|
| A1 globals (46→67) | Defaults tab + Structure channels + Results thresholds |
| A3/A4 pipeline + manual hires | Queues editor (S4 becomes real) |
| A5/A6 seasonality + arrival + A14 presets | Volume shapes + Defaults libraries |
| A7–A11 burnout/CX/loops/teams/routes | Queues editor families + Shared capacity + Interactions |
| A12 52-week volumes | Volume cascade grid |
| A13 digital subtype | Queues editor · Inputs |
| B3/B4 holistic + alloc trace | *(Results review — not Setup)* |
| Finding: flows had weakest home | Request types tab — processes are first-class |
| Finding: interactions had no home | Queues › Interactions + Map lens |
| Finding: services floated free of org | assignment on the request type |

## 5. Migration note (v2.4 data → this model)

Mechanical, provided with the build: each v2.4 service → a request type
(assignment inferred from its profiles' nodes; journey → a process on the
inferred channel); profiles → volume entries at the equivalent spine rows;
products/channel-instances → registry products / enabled channels; queue
attachment → home. Provenance marks everything `entered` where a number
existed.

## 6. Remaining calls

| # | Call | Recommendation |
|---|---|---|
| ⬜ C-a | Map placement: Setup tab 5 with Home as a second entry point — confirm? | as written (§3.5) |
| ⬜ C-b | Interactions editing surface: per-queue + consolidated list in Queues, Map view-first — confirm? | as written (§3.2) |

## 7. Build order for Setup (after sign-off)

0. **`derive.js` rework first** — cascade resolver + request-type propagation
   (the model under all six tabs; engine/adapter untouched).
1. Navigation shell — six tabs, drawer retired, master–detail in Queues.
2. Structure registry (channels + groups + products, rename/delete guards).
3. Request types tab (identity, assignment, per-channel process editor).
4. Queues editor depth (~30 params + interactions + shared capacity).
5. Volume cascade grid + shapes.
6. Map (flow + interactions lenses, validation panel).
7. Defaults tab; template rework to the new sheets.
