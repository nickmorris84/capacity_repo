# Domain model — draft 2

**Status:** decisions D1–D3, D6 and the two variant rules are **settled** (§9).
The proposed hierarchy in §7 applies those decisions and awaits final
confirmation. Supersedes the v2.4 service/journey/profile model.

---

## 1. Vocabulary

| Term | Meaning | Replaces (v2.4) |
|---|---|---|
| **Brand / Business unit** | the org skeleton, defined first and separately | kept |
| **Queue** | a global processing station with staffing physics; reusable by any process | kept |
| **Request type** | what a customer asks for — classified, **attached to brand(s) × BU(s)**, carrying the channels that support it | the catalog-global "service" |
| **Channel** | an entry channel supporting a request type (voice, third party, digital, customer management) — an *attribute of the request type*, not a place in the org tree | ChannelInstance (structure node) |
| **Process** | **one specific journey** — the queue path for one channel of one request type: an entry step, ordered steps, declared end points | the `journey` array inside a service |
| **Process group** | a **reporting tag** over similar processes — collective reporting only, no routing semantics (plus one soft validation use, §4.2) | — (new) |
| **Volume entry** | a number entered at *any* level; the cascade resolver fills in the rest | ChannelVolumeProfile |

Retired words: *service*, *service flow*, *journey*, *profile*.

---

## 2. Entities and relationships

```
Brand ──1:N── Business unit                      org skeleton, defined first

Request type
  • name (unique), classification: activity · product-request
  • assignment: brands[] × BUs[]  — empty list ⇒ All
  • ahtSec?                       — override; falls back to queue AHT (D6)
  • group?  ───────────────►  Process group      reporting tag
  └── Channel  (each channel that supports this request)
        └── Process — ONE journey:
              entry step, ordered steps
                { queueId, splitPct, samplingPct?, terminal?, outcome? }
              enumerated outcomes · embedded rework branches

Queue — global; referenced by any process step; reports "used in N processes"
Volume entry { node, total | 52-week series, shape? } — sparse, any level
```

The cascade spine is a single unambiguous path:

```
Brand → Business unit → Request type → Channel → (process steps → queues)
```

## 3. What the structure expresses

| Requirement (owner's words) | How |
|---|---|
| "A request goes through a number of queues" | its channel's process |
| "The same queues can be used on multiple flows" | queues are global; any process references them |
| "Some brands share processes" | one request type attached to [A, B] (or All) |
| "Others don't share, and just share queues" | Brand C gets its own request-type variant whose process reuses the same queues |
| "Multiple channels support it; each channel a set of queues" | one process per channel |
| "Each process has an expected start and end; things can end at decision points" | entry step + enumerated outcomes; terminal-step flag (§5) |
| "Volumes at any granularity, higher takes precedence, equal when unset" | the cascade resolver (§6) |

## 4. Assignment and variants

### 4.1 Assignment
- `brands: []` ⇒ **All brands**; `BUs: []` ⇒ **All BUs**. Lists allowed
  ("A and B but not C") — settled D3.
- A request type is *in scope* for every (brand, BU) its assignment covers.

### 4.2 Variants
When brands handle the same request differently, each handling is its own
request-type entry (a **variant**):

- **Naming:** variants carry **distinct names** ("Billing enquiry", "Billing
  enquiry — Premium"); the **process group** carries the collective name for
  reporting. Every list stays unambiguous without needing context.
- **Double-cover warning (soft):** if two request types **in the same group**
  cover the same (brand, BU, channel), warn — *"Billing appears to be handled
  twice for Brand C."* This is the one semantic job the reporting tag does:
  it is what tells us two request types are the same thing, which is what
  makes double-cover detectable. Warning, never a block.

## 5. Processes: rework and end points

- **Rework is embedded** as probabilistic outcome branches — a step with
  `split 20%` into a rework queue *is* "20% error rate". Multi-round rework
  collapses to an effective split of p/(1−p), computed for the user.
- **Boundary rule (settled D2):** a separate process is warranted only when
  the error path is a **different commitment** — its own SLA, owner, or
  independently forecast volume. *Same request, same accountability → one
  process with outcome branches.*
- **End points are declared.** Each process enumerates its outcomes
  (completed, rejected, ended-at-decision, handed-off, …); any step may be
  flagged terminal with its outcome. **Validation:** a branch that reaches no
  declared end point is a modelling error, surfaced on the Map.

## 6. The volume cascade

Sparse entry, full resolution, with provenance.

1. **Totals cascade down.** The highest-level entered figure is authoritative
   for everything beneath it.
2. **At each layer, children split the parent by:** explicit weights, if set →
   else finer *entered* figures, normalised into weights → else **equal split**
   across the children in scope.
3. **Shapes aggregate up.** A queue's seasonality/arrival profile is the
   volume-weighted blend of what passes through it; a layer without its own
   shape inherits from above. Totals flow down; shapes flow up.
4. **Reconciliation is visible.** Finer entries disagreeing with a coarser
   total act as weights and are scaled — flagged, never silent
   ("scaled ×1.06 to reconcile with Brand A total").
5. **Provenance on every number:** `entered` · `weighted` · `equal split` ·
   `inherited shape` — shown in the UI, carried through the template.

```
Entered: Brand A = 10,000/day; later Collections = 5,000.

Brand A            10,000   [entered]
 ├─ Collections     5,000   [entered]
 ├─ Billing         2,500   [equal share of remainder]
 └─ New card        2,500   [equal share of remainder]
      ├─ Voice      1,250   [equal — 2 channels]
      └─ Digital    1,250   [equal]
            └─ queue volumes via process steps (structure, not weights)
```

**Deliberate reversal of v2.4:** deepest-wins override is replaced by
coarse-authoritative + fine-as-weights + equal-by-default. Mix % and the
"unmodelled remainder" warning disappear as concepts — weights subsume the
former; equal-split defaults eliminate the latter.

## 7. Proposed hierarchy (applying the settled decisions)

| Level | v2.4 | Proposed | Rationale |
|---|---|---|---|
| Brand, BU | structure + permissions | **keep** — the assignment key | unchanged role |
| Product | rollup between BU and channel | **retire** | nothing references it: request types assign to brand×BU, channels live on the request type |
| ChannelInstance | structure node where profiles attach and queues pin | **retire** | channel is an attribute of the request type, not a place in the org |
| Queue attachment (structural/shared) | grouping + cross-structure guard | **all queues global**, with an optional **home** (brand/BU) for grouping and permissions | the split loses meaning once routing is process-based |
| Cross-structure warning | guards out-of-path routing | **retire** — superseded by coverage + double-cover checks (§4.2, V1/V2) | the new checks answer the real question |

## 8. Validation rules

| # | Rule | Message shape |
|---|---|---|
| V1 | **Coverage** — every (brand, BU) with volume for a group has a request type in scope | "Brand B receives Billing volume but no request type covers it" |
| V2 | **Double-cover (soft)** — two request types in one group covering the same (brand, BU, channel) | "Billing appears handled twice for Brand C" |
| V3 | **End-point completeness** — every branch terminates in a declared outcome | "Step 3 of Billing — Premium · Voice leads nowhere" |
| V4 | **Blast radius** — queues report "used in N processes across M brands"; deletion guarded with the list | (existing guard, with visibility before the attempt) |
| V5 | **Reconciliation** — finer entries scaled to coarser totals, flagged | "scaled ×1.06 …" |

## 9. Decision log

**Settled**

| # | Decision | Resolution |
|---|---|---|
| D1 | Shape of the model | **Request type (brand/BU-attached) → Channel → Process**; process group = reporting tag |
| D2 | Rework boundary | different commitment ⇒ separate process; otherwise embedded outcome branches |
| D3 | Assignment | brand/BU lists; empty ⇒ All |
| D6 | AHT override | request-type level, falling back to queue AHT |
| — | Variant naming | distinct names; group carries the collective reporting name |
| — | Double-cover | soft warning, scoped to a group |
| — | Volume semantics | cascade of §6 (reverses v2.4 deepest-wins) |

**Awaiting final confirmation**

| # | Item | Proposal |
|---|---|---|
| D4 | Product level | retire (§7) |
| D5 | Queue attachment | all-global + optional home (§7) |

## 10. Deltas from the current build

| Area | Change | Size |
|---|---|---|
| Model shape | `services[]`+`profiles[]` → `requestTypes[]` (with per-channel processes) + `processGroups[]` + `volumeEntries[]`; migration provided | medium |
| `model/derive.js` | propagation iterates request types × channels; volume resolution becomes the **cascade resolver** (new pure module, with provenance); cross-structure guard retired in favour of V1/V2 | the main work |
| `model/adapter.js` | unchanged mechanics — still consumes derived per-queue volume/AHT | none–small |
| **Engine** | **untouched** | none |
| Structure tree | Product and ChannelInstance levels removed (pending D4/D5); queues gain optional home | small–medium |
| Template | sheets: Structure · Queues · Request types · Processes/steps · Volume entries | medium |
| Setup IA | REVIEW-SETUP resumes against this model once D4/D5 confirm | — |
