/* Presentation helpers — pure, no DOM. Kept tiny and dependency-free so the
   same functions run in the browser and under JSDOM. */

export const RAG = {
  green: "#1f9d55",
  amber: "#d98a0b",
  red: "#d63b3b",
  greenSoft: "#e6f4ec",
  amberSoft: "#fbf0dc",
  redSoft: "#f9e3e3",
};

export const statusColor = (s) => RAG[s] || RAG.amber;

export function money(cur, n) {
  const v = Math.round(n || 0);
  const abs = Math.abs(v);
  if (abs >= 1e6) return cur + (v / 1e6).toFixed(v % 1e6 === 0 ? 0 : 1) + "m";
  if (abs >= 1e3) return cur + (v / 1e3).toFixed(abs >= 1e4 ? 0 : 1) + "k";
  return cur + v.toLocaleString();
}

export const moneyFull = (cur, n) => cur + Math.round(n || 0).toLocaleString();

// §24.7 a weekly-engine figure presented per month (×52/12) and per year (×52).
export const perMonth = (weekly) => (weekly || 0) * (52 / 12);
export const perYear = (weekly) => (weekly || 0) * 52;
export const moneyMonthly = (cur, weekly) => money(cur, perMonth(weekly));

export const pct = (v, dp = 0) => (v == null || Number.isNaN(v) ? "–" : (v * 100).toFixed(dp) + "%");
export const num = (v, dp = 0) => (v == null || Number.isNaN(v) ? "–" : (+v).toFixed(dp));
export const secs = (v) => (v == null || Number.isNaN(v) ? "–" : Math.round(v) + "s");

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Format an interval index into an HH:MM label given the engine day window.
export function intervalLabel(i, eng) {
  const mins = eng.dayStart * 60 + i * eng.intervalMin;
  const h = Math.floor(mins / 60), m = mins % 60;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

// Immutable deep-ish update by path. path is an array of keys/indices.
export function setPath(obj, path, value) {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  const clone = Array.isArray(obj) ? obj.slice() : { ...obj };
  clone[head] = setPath(obj ? obj[head] : undefined, rest, value);
  return clone;
}
