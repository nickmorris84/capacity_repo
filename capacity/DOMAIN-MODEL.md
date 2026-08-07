# Domain model — v1.0 (FINAL)

**Status:** **complete — all decisions settled**, including P1 (process groups
are per-BU; no cross-BU span) and P2 (product's parent is the brand). This is
the baseline the Setup review and the `derive.js` rework build against.
Changes from here require a deliberate revision of this document.

---

## 1. Two kinds of things

The model separates **reference data** (the vocabulary of the estate —
defined once, selected everywhere, never free-typed) from **operational
objects** (the things that do work).

| Kind | Entities |
|---|---|
| **Reference data** | Brand · Business unit · Channel (enabled from the taxonomy) · Process group · Product |
| **Operational** | Queue · Request type · Process · Volume entry |

**Registry rules** (apply to all reference data):
1. Defined in one place (§7), stored in the model, round-tripped through the
   template.
2. Everything downstream **selects** from the registry — no free text.
3. **Rename propagates** everywhere automatically (references are by id).
4. **Delete is guarded** by references, with the dependents listed — the same
   guard pattern queues already have.

## 2. Vocabulary

| Term | Meaning | Replaces (v2.4) |
|---|---|---|
| **Brand / Business unit** | the org skeleton; BUs belong to a brand | kept |
| **Channel** | an entry channel the estate uses — enabled from the fixed taxonomy (voice · third party · digital · customer management); carries the **channel defaults** new request-type processes inherit | ChannelInstance (tree node) — retired |
| **Process group** | a **defined entity at BU level** grouping related processes for collective reporting; also scopes the double-cover check | — (new) |
| **Product** | a **defined entity** grouping request types by commercial product, for reporting rollups | Product (tree level) — re-homed |
| **Queue** | a global processing station with staffing physics; reusable by any process; optional **home** (brand/BU) for grouping and permissions | kept, attachment simplified |
| **Request type** | what a customer asks for — classified, attached to brand(s) × BU(s), referencing a process group and optionally a product | the catalog-global "service" |
| **Process** | **one specific journey** — the queue path for one channel of one request type: entry step, ordered steps, declared end points | the `journey` array |
| **Volume entry** | a number entered at any level; the cascade resolver fills in the rest | ChannelVolumeProfile |

Retired words: *service*, *service flow*, *journey*, *profile*, *tag*.

## 3. Entities and relationships

```
REFERENCE DATA
Brand ──1:N── Business unit
Channel        (enabled subset of the taxonomy; carries channel defaults)
Process group  (belongs to a BU)                     ⬜ span rule — §9
Product        (belongs to a brand)                  ⬜ parent — §9

OPERATIONAL
Request type
  • name (unique) · classification: activity · product-request
  • assignment: brands[] × BUs[]  — empty ⇒ All
  • processGroupId  (required — the reporting family)
  • productId?      (optional rollup)
  • ahtSec?         (override; falls back to queue AHT)
  └── per enabled Channel:
        Process — ONE journey:
          entry step · ordered steps { queueId, splitPct, samplingPct?,
                                       terminal?, outcome? }
          enumerated outcomes · embedded rework branches

Queue      global; optional home (brand/BU); "used in N processes"
Volume entry { node, total | 52-week series, shape? } — sparse, any level
```

Cascade spine (unambiguous):

```
Brand → Business unit → Request type → Channel → (process steps → queues)
```

## 4. What the structure expresses

| Requirement (owner's words) | How |
|---|---|
| "A request goes through a number of queues" | its channel's process |
| "The same queues can be used on multiple flows" | queues are global; any process references them |
| "Some brands share processes" | one request type attached to [A, B] (or All) |
| "Others don't share, and just share queues" | Brand C gets its own request-type variant whose process reuses the same queues |
| "Multiple channels support it; each channel a set of queues" | one process per enabled channel |
| "Each process has an expected start and end; can end at decision points" | entry step + enumerated outcomes; terminal-step flag |
| "Volumes at any granularity; higher takes precedence; equal when unset" | the cascade resolver (§6) |
| "Brand, BU, channel, process group etc need a place to be set up and stored" | the registry (§1, §7) |

## 5. Processes: rework and end points

- **Rework is embedded** as probabilistic outcome branches — `split 20%` into
  a rework queue *is* a 20% error rate; multi-round rework collapses to an
  effective split of p/(1−p), computed for the user.
- **Boundary rule (settled):** a separate process only when the error path is
  a **different commitment** — its own SLA, owner, or independently forecast
  volume. Same request, same accountability → one process, outcome branches.
- **End points are declared.** Each process enumerates its outcomes; any step
  may be terminal with its outcome. A branch reaching no declared end point is
  a modelling error, surfaced on the Map.

## 6. The volume cascade

Sparse entry, full resolution, with provenance.

1. **Totals cascade down** — the highest-level entered figure is
   authoritative beneath it.
2. **Children split the parent by:** explicit weights → entered finer figures
   normalised as weights → **equal split**.
3. **Shapes aggregate up** — a queue's seasonality/arrival profile is the
   volume-weighted blend of what passes through it; unset layers inherit from
   above.
4. **Reconciliation is visible** — conflicting finer entries are scaled and
   flagged, never silently resolved.
5. **Provenance on every number:** `entered` · `weighted` · `equal split` ·
   `inherited shape`.

```
Entered: Brand A = 10,000/day; later Collections = 5,000.

Brand A            10,000   [entered]
 ├─ Collections     5,000   [entered]
 ├─ Billing         2,500   [equal share of remainder]
 └─ New card        2,500   [equal share of remainder]
      ├─ Voice      1,250   [equal — 2 channels]
      └─ Digital    1,250   [equal]
```

Deliberate reversal of v2.4 deepest-wins; mix % and "unmodelled remainder"
retire as concepts.

## 7. Where reference data is defined (Setup implication)

The **Structure** tab becomes the registry — *"define the vocabulary of the
estate"*:

| Entity | Defined in | Referenced by |
|---|---|---|
| Brand | Structure | BUs · request-type assignment · queue home · volume entries |
| Business unit | Structure (under its brand) | request-type assignment · process groups · queue home · volume entries |
| Channel | Structure (enable from the taxonomy; set channel defaults here) | request types' processes · volume entries |
| Process group | Structure (under its BU) | request types · Results rollups · double-cover check |
| Product | Structure (under its brand ⬜) | request types · Results rollups |

Queues, request types (with their processes) and volume entries keep their own
tabs — they are operational, not vocabulary. Full Setup IA resumes in
REVIEW-SETUP once §9 closes.

## 8. Validation rules

| # | Rule | Message shape |
|---|---|---|
| V1 | **Coverage** — every (brand, BU) with volume for a group has a request type in scope | "Brand B receives Billing volume but no request type covers it" |
| V2 | **Double-cover (soft)** — two request types in one group covering the same (brand, BU, channel) | "Billing appears handled twice for Brand C" |
| V3 | **End-point completeness** — every branch terminates in a declared outcome | "Step 3 of Billing — Premium · Voice leads nowhere" |
| V4 | **Blast radius** — queues report "used in N processes across M brands"; deletion guarded | (existing guard, visible before the attempt) |
| V5 | **Reconciliation** — finer entries scaled to coarser totals, flagged | "scaled ×1.06 …" |
| V6 | **Registry integrity** — reference data renames propagate; deletes guarded with dependents listed | "Cannot delete 'Collections' — 3 request types reference it" |

## 9. Decision log

**Settled**

| # | Decision | Resolution |
|---|---|---|
| D1 | Shape | Request type (brand/BU-attached) → Channel → Process |
| D2 | Rework boundary | different commitment ⇒ separate process |
| D3 | Assignment | brand/BU lists; empty ⇒ All |
| D4 | Product | **defined reference entity** for grouping request types — not a tree level, not a tag |
| D5 | ChannelInstance | retired; channel = reference entity + attribute of request types. Queues global with optional home |
| D6 | AHT override | request-type level, queue fallback |
| — | Process group | **defined reference entity at BU level** — not a tag |
| — | Registry | all classifiers defined/stored in Structure; selected never typed; rename propagates; delete guarded |
| — | Variants | distinct names; group carries the collective reporting name; soft double-cover warning |
| — | Volume | cascade of §6 |

| P1 | Process group span | **per-BU; no cross-BU span** (cross-BU reporting may roll up same-named groups) |
| P2 | Product's parent | **brand** |

## 10. Deltas from the current build

| Area | Change | Size |
|---|---|---|
| Model shape | `services[]`+`profiles[]` → registry (brands, BUs, channels, groups, products) + `requestTypes[]` (per-channel processes) + `volumeEntries[]`; migration provided | medium |
| `model/derive.js` | propagation over request types × channels; **cascade resolver** (new pure module, provenance); cross-structure guard retired for V1/V2 | the main work |
| `model/adapter.js` | unchanged mechanics | none–small |
| **Engine** | **untouched** | none |
| Structure | tree reduces to Brand → BU; classifiers become registry lists; queues gain optional home | small–medium |
| Template | sheets: Registry (brands/BUs/channels/groups/products) · Queues · Request types · Processes/steps · Volume entries | medium |
| Setup IA | REVIEW-SETUP resumes against this model after P1/P2 | — |
