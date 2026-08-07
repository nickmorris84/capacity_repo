/* The volume cascade (DOMAIN-MODEL §6). PURE.
 *
 * Sparse entry, full resolution, provenance on every number.
 *   • Totals cascade DOWN — the highest-level entered figure is authoritative
 *     for everything beneath it.
 *   • At each layer children split the parent by: entered finer figures used
 *     as weights → else EQUAL split. Entered children keep their values and
 *     the remainder splits equally across unentered siblings; if entered
 *     children exceed the parent they are scaled down and the scaling is
 *     flagged (never silent).
 *   • Shapes (52-week profiles) aggregate UP and inherit DOWN: an entry's
 *     weekly series sets its node's shape; unset nodes inherit from above;
 *     a queue's effective shape is the volume-weighted blend of what flows
 *     through it (computed in propagate.js).
 *   • Provenance: entered · scaled · equal · sum · none.
 *
 * This deliberately REVERSES v2.4's deepest-wins override.
 */
const { LEVELS, keyOf, leaves } = require("./domain.js");

// Normalise entries: same-address entries sum; a weekly series also yields the
// node's shape (normalised to mean 1). Daily units throughout.
function entryIndex(model) {
  const totals = new Map(), shapes = new Map();
  for (const e of model.volumeEntries || []) {
    const k = keyOf(e.scope || {});
    let daily = e.daily != null ? +e.daily : null;
    if (Array.isArray(e.weekly) && e.weekly.length) {
      const sum = e.weekly.reduce((a, v) => a + (+v || 0), 0);
      if (daily == null) daily = sum / e.weekly.length / 7;
      const mean = sum / e.weekly.length;
      if (mean > 0 && !shapes.has(k)) shapes.set(k, e.weekly.map((v) => (+v || 0) / mean));
    }
    if (daily != null) totals.set(k, (totals.get(k) || 0) + daily);
  }
  return { totals, shapes };
}

/* Distribute a parent total across children, honouring entered figures.
   Returns per-child { total, prov } plus (when the parent had no figure) the
   parent's own derived total. `total: null` means genuinely unknown — deeper
   entries may still resolve it. */
function distribute(parentTotal, kids, notes, at) {
  const out = new Map();
  const entered = kids.filter((k) => k.entered != null);
  const un = kids.filter((k) => k.entered == null);
  const s = entered.reduce((a, k) => a + k.entered, 0);

  if (parentTotal == null) {
    for (const k of kids) out.set(k.key, { total: k.entered, prov: k.entered != null ? "entered" : "none" });
    return { out, parentTotal: entered.length && un.length === 0 ? s : null, parentProv: "sum" };
  }
  if (!entered.length) {
    for (const k of kids) out.set(k.key, { total: parentTotal / kids.length, prov: "equal" });
    return { out };
  }
  if (!un.length || s > parentTotal + 1e-9) {
    const f = s > 0 ? parentTotal / s : 0;
    if (Math.abs(f - 1) > 1e-9) notes.push({ kind: "scaled", at, factor: f, message: `entries under ${at || "the estate"} scaled ×${f.toFixed(2)} to reconcile with the level above` });
    for (const k of entered) out.set(k.key, { total: k.entered * f, prov: Math.abs(f - 1) > 1e-9 ? "scaled" : "entered" });
    for (const k of un) out.set(k.key, { total: 0, prov: "equal" });
    return { out };
  }
  const r = (parentTotal - s) / un.length;
  for (const k of entered) out.set(k.key, { total: k.entered, prov: "entered" });
  for (const k of un) out.set(k.key, { total: r, prov: "equal" });
  return { out };
}

function resolveVolumes(model) {
  const L = leaves(model);
  const { totals: enteredMap, shapes } = entryIndex(model);
  const notes = [];
  const nodes = new Map(); // key → { total, prov, shape }

  function rec(prefix, li, subset, total, shape, parentProv) {
    if (li === LEVELS.length) {
      const n = nodes.get(keyOf(prefix)) || { prov: "none" };
      const l = subset[0];
      return [{ brandId: l.brandId, buId: l.buId, requestTypeId: l.requestTypeId, channelId: l.channelId,
        rt: l.rt, process: l.process, total: total != null ? total : 0, shape, provenance: n.prov }];
    }
    const lev = LEVELS[li];
    const idsHere = [...new Set(subset.map((x) => x[lev]))];
    const kids = idsHere.map((id) => {
      const p = { ...prefix, [lev]: id };
      const k = keyOf(p);
      return { id, key: k, prefix: p, entered: enteredMap.has(k) ? enteredMap.get(k) : null };
    });
    const d = distribute(total, kids, notes, keyOf(prefix).replace(/\|+$/, "") || null);
    if (total == null && d.parentTotal != null && !nodes.has(keyOf(prefix)))
      nodes.set(keyOf(prefix), { total: d.parentTotal, prov: d.parentProv });
    let acc = [];
    for (const kid of kids) {
      const r = d.out.get(kid.key);
      // A single-child level with no entry of its own is a pass-through, not a
      // split — the figure's provenance travels with it rather than reading as
      // an "equal" division of one.
      const prov = kids.length === 1 && kid.entered == null && parentProv ? parentProv : r.prov;
      nodes.set(kid.key, { total: r.total, prov });
      const kidShape = shapes.get(kid.key) || shape;
      acc = acc.concat(rec(kid.prefix, li + 1, subset.filter((x) => x[lev] === kid.id), r.total, kidShape, prov));
    }
    return acc;
  }

  const rootKey = keyOf({});
  const rootTotal = enteredMap.has(rootKey) ? enteredMap.get(rootKey) : null;
  const resolved = L.length ? rec({}, 0, L, rootTotal, shapes.get(rootKey) || null, rootTotal != null ? "entered" : null) : [];

  // Fill unresolved ancestor totals bottom-up so every level reports a figure.
  for (let li = LEVELS.length - 1; li >= 0; li--) {
    const sums = new Map();
    for (const l of resolved) {
      const p = {};
      for (let i = 0; i < li; i++) p[LEVELS[i]] = l[LEVELS[i]];
      const k = keyOf(p);
      sums.set(k, (sums.get(k) || 0) + l.total);
    }
    for (const [k, t] of sums) if (!nodes.has(k) || nodes.get(k).total == null) nodes.set(k, { total: t, prov: "sum" });
  }

  // V1 — coverage: an entry addressing nothing in the leaf set is inert.
  const uncovered = [];
  for (const k of enteredMap.keys()) {
    if (k === rootKey) continue;
    if (!nodes.has(k))
      uncovered.push({ kind: "uncovered_volume", at: k, message: `A volume entry at ${k.replace(/\|/g, " › ").trim()} matches no assigned request type/process — it is inert.` });
  }

  return { leaves: resolved, nodes, notes, uncovered };
}

module.exports = { resolveVolumes, entryIndex, distribute };
