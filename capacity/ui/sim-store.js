import { makeDefaultConfig, compactRun, uid } from "../engine/engine.js";
import { migrateConfig } from "./config-ops.js";
import { KEYS } from "./storage.js";

/* §26.2 storage schema. A `sim-list` index (light entries for the landing
   cards) plus one record per simulation under `simulation-<id>`:
     { id, name, createdAt, updatedAt, config, matrixCache, selectedPair,
       runs[], lastAllIn }
   A Run carries the FULL config it was saved from (strategy definitions,
   schedules, scenario groups and the selected pair included), the compact
   results for the selected pair, and the matrix cache when it was fresh at
   save time — so a Run can be compared or re-simulated exactly, forever. */

export const makeSimId = () => "sim_" + uid();

// A Run (§26.2). `slug` doubles as the stable key the compare builders chart
// by (legacy snapshots used slugs; new runs reuse their id).
export function makeRun(name, sim, selectedPair, matrixCache) {
  const id = "run_" + uid();
  return {
    id,
    slug: id,
    name: name || "Untitled run",
    savedAt: new Date().toISOString(),
    strategy: sim.strategy,
    allIn: Math.round(sim.summary.allIn),
    selectedPair: selectedPair || null,
    config: sim.config,
    run: compactRun(sim.config, sim),
    matrixCache: matrixCache || null,
  };
}

// Lightweight landing-card entry, denormalised from the record so the landing
// never has to load every full record just to draw its cards.
export function indexEntryOf(rec) {
  const cfg = rec.config || {};
  return {
    id: rec.id,
    name: rec.name,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
    runCount: (rec.runs || []).length,
    horizonWeeks: cfg.engine ? cfg.engine.horizonWeeks : null,
    currency: cfg.engine ? cfg.engine.currency : "£",
    brands: (cfg.brands || []).length,
    queues: (cfg.queues || []).length,
    lastAllIn: rec.lastAllIn != null ? rec.lastAllIn : null,
  };
}

export function makeSimRecord(name, config, extras = {}) {
  const now = new Date().toISOString();
  return {
    id: makeSimId(),
    name: name || "New simulation",
    createdAt: now,
    updatedAt: now,
    config,
    matrixCache: null,
    selectedPair: null,
    runs: [],
    lastAllIn: null,
    ...extras,
  };
}

/* §26.2 migration + first-run bootstrap. If the `sim-list` index already
   exists this is a no-op read. Otherwise build "Simulation 1":
     - legacy snapshots (`sim-index` + `sim-<slug>`) convert to Runs verbatim
       (name, savedAt, config and compact results carried over — zero data loss);
     - the legacy `matrix-state` cache becomes matrixCache + selectedPair;
     - the live config is the default world (the pre-R4 app never persisted a
       live config, so the default is exactly what an open used to show).
   Legacy keys are left in place untouched. Idempotent via the sim-list guard. */
export async function loadOrMigrate(storage) {
  const existing = await storage.get(KEYS.simList);
  if (Array.isArray(existing) && existing.length) return existing;

  const legacyIndex = (await storage.get(KEYS.index)) || [];
  const runs = [];
  for (const e of legacyIndex) {
    const snap = await storage.get(KEYS.run(e.slug));
    if (!snap) continue;
    runs.push({
      id: "run_" + uid(),
      slug: snap.slug || e.slug,
      name: snap.name,
      savedAt: snap.savedAt,
      strategy: snap.strategy,
      allIn: snap.allIn,
      selectedPair: snap.strategy ? { gid: "g_por", sid: snap.strategy } : null,
      config: snap.config,
      run: snap.run,
      matrixCache: null,
    });
  }
  const legacyMatrix = await storage.get(KEYS.matrix);
  const rec = makeSimRecord("Simulation 1", migrateConfig(makeDefaultConfig()), {
    runs,
    matrixCache: legacyMatrix && legacyMatrix.cells ? { hash: legacyMatrix.hash, cells: legacyMatrix.cells } : null,
    selectedPair: legacyMatrix && legacyMatrix.selected ? legacyMatrix.selected : null,
  });
  await storage.set(KEYS.simulation(rec.id), rec);
  const list = [indexEntryOf(rec)];
  await storage.set(KEYS.simList, list);
  return list;
}

export async function loadRecord(storage, id) {
  return await storage.get(KEYS.simulation(id));
}

/* §26.6 delete-in-use guard. Which loaded simulations still reference a global
   preset by provenance (arrival / seasonal overlay / system seasonality)?
   Returns the simulation names, so a blocked delete can name them. Runs are NOT
   scanned — they are frozen copies that a preset delete must never touch, so a
   preset used only by a saved Run is freely deletable. */
export function simsUsingPreset(records, presetId) {
  const names = [];
  for (const rec of Object.values(records || {})) {
    if (!rec || !rec.config) continue;
    const cfg = rec.config;
    const used = (cfg.queues || []).some((q) =>
      (q.arrivalProv && q.arrivalProv.presetId === presetId) ||
      (q.seasonalProv && q.seasonalProv.presetId === presetId))
      || (cfg.seasonality && cfg.seasonality.systemProv && cfg.seasonality.systemProv.presetId === presetId);
    if (used) names.push(rec.name);
  }
  return names;
}

// Read-modify-write a record (stamping updatedAt), then refresh its index
// entry. Returns { record, list }.
export async function saveRecord(storage, record) {
  const rec = { ...record, updatedAt: new Date().toISOString() };
  await storage.set(KEYS.simulation(rec.id), rec);
  const list = (await storage.get(KEYS.simList)) || [];
  const entry = indexEntryOf(rec);
  const next = list.some((e) => e.id === rec.id)
    ? list.map((e) => (e.id === rec.id ? entry : e))
    : [...list, entry];
  await storage.set(KEYS.simList, next);
  return { record: rec, list: next };
}

export async function deleteRecord(storage, id) {
  await storage.del(KEYS.simulation(id));
  const list = (await storage.get(KEYS.simList)) || [];
  const next = list.filter((e) => e.id !== id);
  await storage.set(KEYS.simList, next);
  return next;
}

export async function renameRecord(storage, id, name) {
  const rec = await storage.get(KEYS.simulation(id));
  if (!rec) return (await storage.get(KEYS.simList)) || [];
  return (await saveRecord(storage, { ...rec, name })).list;
}

// §26.5(b) full copy: settings, brands, channels and queues — runs and the
// matrix cache deliberately NOT copied.
export async function duplicateRecord(storage, id, name) {
  const rec = await storage.get(KEYS.simulation(id));
  if (!rec) return (await storage.get(KEYS.simList)) || [];
  const copy = makeSimRecord(name || rec.name + " (copy)", JSON.parse(JSON.stringify(rec.config)), {
    selectedPair: rec.selectedPair ? { ...rec.selectedPair } : null,
  });
  return { list: (await saveRecord(storage, copy)).list, id: copy.id };
}
