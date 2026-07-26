/* v2.4 rebuild — model persistence (integration). Autosave the single v2 model
 * and restore it on load, so a refresh never loses work. Uses localStorage (a
 * synchronous, testable interim); IndexedDB is a drop-in upgrade behind the same
 * load/save interface when the backend phase (P5) lands.
 */
const KEY = "capacity.v2.model";

export function saveModel(model) {
  try {
    if (typeof localStorage === "undefined") return false;
    localStorage.setItem(KEY, JSON.stringify(model));
    return true;
  } catch { return false; }
}

export function loadModel() {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearModel() {
  try { if (typeof localStorage !== "undefined") localStorage.removeItem(KEY); } catch { /* ignore */ }
}
