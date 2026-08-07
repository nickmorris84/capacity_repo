/* Domain persistence (BUILD-PLAN M3). Schema-versioned autosave/restore with
 * a one-way upgrade path: a saved v2.4 model found at the old key is migrated
 * to the domain shape on load (deterministically, via migrate-domain), saved
 * under the new key, and the old key is LEFT INTACT for rollback. Storage is
 * injectable so this gates in Node; the browser default is localStorage.
 */
const { migrateV2ToDomain } = require("./migrate-domain.js");

const V3_KEY = "capacity.v3.model";
const V2_KEY = "capacity.v2.model";

const defaultStorage = () => (typeof localStorage !== "undefined" ? localStorage : null);

function saveDomainModel(model, storage = defaultStorage()) {
  try {
    if (!storage) return false;
    storage.setItem(V3_KEY, JSON.stringify(model));
    return true;
  } catch { return false; }
}

// → { model, migratedFrom: null | "v2.4" } | null. Never throws; corrupt
// payloads read as absent.
function loadDomainModel(storage = defaultStorage()) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(V3_KEY);
    if (raw) return { model: JSON.parse(raw), migratedFrom: null };
  } catch { /* fall through to the v2.4 path */ }
  try {
    const old = storage.getItem(V2_KEY);
    if (!old) return null;
    const v2model = JSON.parse(old);
    const model = migrateV2ToDomain(v2model);
    saveDomainModel(model, storage); // upgrade persists; the v2.4 key stays
    return { model, migratedFrom: "v2.4" };
  } catch { return null; }
}

function clearDomainModel(storage = defaultStorage()) {
  try { if (storage) storage.removeItem(V3_KEY); } catch { /* ignore */ }
}

module.exports = { saveDomainModel, loadDomainModel, clearDomainModel, V3_KEY, V2_KEY };
