import * as XLSX from "xlsx";
import { compactRun } from "../engine/engine.js";
import { STRATEGIES, strategyStats, strategyName } from "./views.js";
import { buildWeeklyRows, columnsFor, buildVerdict, buildRiskRegister } from "./reporting.js";

/* File I/O layer. Every builder is a pure function returning bytes or a string
   (so tests can parse them directly); the download wrappers are the only part
   that touches the DOM, kept separate so the anchor can be mocked. */

// ---- parameter flatten / patch (path-addressed) ----
// Whitelisted scalar parameters — arrays (profiles, curves, weekly volumes) are
// out of scope here; weekly volumes round-trip through the Volumes sheet.
const ENGINE_KEYS = ["horizonWeeks", "occupancyCeiling", "currency", "dayStart", "dayEnd", "intervalMin", "daysPerWeek", "hoursPerFteDay", "daysWorkedPerFte", "crossSkillProficiency"];
const QUEUE_KEYS = ["name", "type", "dailyVolume", "aht", "asaTarget", "maxAbandon", "patience", "concurrency", "digitalSlaMinutes", "digitalSlaPct", "backlogLimit", "shrinkage", "fte", "agentCost", "deflectsTo"];
const WF_KEYS = ["attrition", "attritionGrowth", "reqToStart", "trainingWeeks"];
const BURN_KEYS = ["occThreshold", "sensitivity", "recovery", "maxAttritionMult", "absenceUplift"];

export function flattenParameters(config) {
  const rows = [];
  const add = (path, setting, value) => rows.push({ path, setting, value });
  for (const k of ENGINE_KEYS) add("engine." + k, "Engine · " + k, config.engine[k]);
  add("hiring.cap", "Hiring · global cap", config.hiring.cap);
  add("hiring.buffer", "Hiring · buffer", config.hiring.buffer);
  add("costs.managerCost", "Costs · manager cost", config.costs.managerCost);
  add("costs.managerRatio", "Costs · manager ratio", config.costs.managerRatio);
  for (const k of ["customerBase", "costPerLostCustomer", "churnAbandon", "churnWait", "churnDigital", "repeatUplift"]) add("cx." + k, "CX · " + k, config.cx[k]);
  add("loops.redial", "Loops · redial", config.loops.redial);
  add("loops.deflection", "Loops · deflection", config.loops.deflection);
  add("seasonality.startMonth", "Seasonality · start month", config.seasonality.startMonth);
  for (const q of config.queues) {
    for (const k of QUEUE_KEYS) add(`queues.${q.id}.${k}`, `${q.name} · ${k}`, q[k]);
    for (const k of WF_KEYS) add(`queues.${q.id}.wf.${k}`, `${q.name} · wf.${k}`, q.wf[k]);
    for (const k of BURN_KEYS) add(`queues.${q.id}.burn.${k}`, `${q.name} · burn.${k}`, q.burn[k]);
  }
  return rows;
}

const coerce = (prev, raw) => {
  if (raw === "" || raw == null) return prev === null || typeof prev === "object" ? null : raw;
  if (typeof prev === "number") { const n = Number(raw); return Number.isNaN(n) ? prev : n; }
  if (typeof prev === "boolean") return String(raw).toLowerCase() === "true";
  return raw;
};

// Apply one path=value to config immutably; unknown paths are ignored.
export function applyParameter(config, path, rawValue) {
  const parts = path.split(".");
  const next = { ...config };
  if (parts[0] === "queues") {
    const [, id, ...rest] = parts;
    const idx = config.queues.findIndex((q) => q.id === id);
    if (idx < 0) return config;
    const queues = config.queues.slice();
    let q = { ...queues[idx] };
    if (rest.length === 1) {
      q[rest[0]] = coerce(q[rest[0]], rawValue);
    } else if (rest.length === 2 && (rest[0] === "wf" || rest[0] === "burn")) {
      q[rest[0]] = { ...q[rest[0]], [rest[1]]: coerce(q[rest[0]][rest[1]], rawValue) };
    } else return config;
    queues[idx] = q;
    next.queues = queues;
    return next;
  }
  const [group, key] = parts;
  if (!next[group] || !(key in next[group])) return config;
  next[group] = { ...next[group], [key]: coerce(next[group][key], rawValue) };
  return next;
}

export function applyParameters(config, rows) {
  return rows.reduce((c, r) => applyParameter(c, r.path, r.value), config);
}

// ---- Volumes sheet (week × queue) ----
// Exports the RAW per-week daily base (the editable input the engine multiplies
// by seasonality and scenarios), NOT the seasonality-baked sim output — so the
// sheet round-trips through weeklyVolumes with no double-counting.
export function volumesAOA(config) {
  const N = config.engine.horizonWeeks;
  const rawBase = (q, w) => (q.weeklyVolumes && q.weeklyVolumes[w] != null ? q.weeklyVolumes[w] : q.dailyVolume);
  const header = ["Week", ...config.queues.map((q) => q.name)];
  const rows = [];
  for (let w = 0; w < N; w++) rows.push([w + 1, ...config.queues.map((q) => Math.round(rawBase(q, w)))]);
  return [header, ...rows];
}

// Parse a Volumes AOA back into per-queue weekly arrays, matched by column name.
export function applyVolumes(config, aoa) {
  if (!aoa || aoa.length < 2) return config;
  const header = aoa[0];
  const queues = config.queues.map((q) => ({ ...q }));
  for (let c = 1; c < header.length; c++) {
    const name = String(header[c]).trim();
    const q = queues.find((x) => x.name === name);
    if (!q) continue;
    const vals = [];
    for (let r = 1; r < aoa.length; r++) vals.push(Number(aoa[r][c]) || 0);
    q.weeklyVolumes = vals;
  }
  return { ...config, queues };
}

// ---- workbook sheets ----
function summaryAOA(sim, strategySims, activeStrategyId, activeViewId, config) {
  const cur = config.engine.currency;
  const v = buildVerdict(strategySims, activeStrategyId, activeViewId, config);
  const sm = sim.summary;
  return [
    ["Capacity simulation — summary"],
    ["Active strategy", activeStrategyId],
    ["Recommended strategy", v.recommended || ""],
    ["Horizon weeks", sim.weeks.length],
    ["Queue-weeks green", v.rag.green],
    ["Queue-weeks amber", v.rag.amber],
    ["Queue-weeks red", v.rag.red],
    ["Total run cost", Math.round(sm.totalCost)],
    ["Churn cost", Math.round(sm.churnCost)],
    ["Idle pay", Math.round(sm.waste)],
    ["All-in cost", Math.round(sm.allIn)],
    ["Customers lost", Math.round(sm.lost)],
    ["Currency", cur],
    ["Verdict", v.paragraph],
  ];
}

function strategyAOA(strategySims, config) {
  const cur = config.engine.currency;
  const head = ["Strategy", "Name", "Red weeks", "End HC", "Run cost", "Churn", "All-in", "Feasible"];
  const rows = STRATEGIES.filter((s) => strategySims[s.id]).map((s) => {
    const st = strategyStats(strategySims[s.id]);
    return [s.id, s.name, st.redWeeks, Math.round(st.endHC), Math.round(st.runCost), Math.round(st.churn), Math.round(st.allIn), st.feasible ? "yes" : "no"];
  });
  return [head, ...rows];
}

function findingsAOA(sim, config) {
  const out = [["Findings"], ["Tone", "Finding"]];
  for (const f of sim.summary.findings) out.push([f.tone, f.text]);
  out.push([], ["Risk register"], ["Risk", "Driver", "Week", "Severity", "SLA impact", "Suggested lever"]);
  for (const r of buildRiskRegister(sim, config)) {
    out.push([r.risk, r.driver, r.week ?? "", r.severityMoney != null ? Math.round(r.severityMoney) : "", r.sla || "", r.lever]);
  }
  return out;
}

function queueAOA(sim, queue, config) {
  const cols = columnsFor(queue, config.engine.currency);
  const rows = buildWeeklyRows(sim, queue, config);
  const header = cols.map((c) => c.label);
  const body = rows.map((row) => cols.map((c) => {
    const v = row[c.key];
    // keep numbers numeric in the sheet; format only text-ish columns
    if (c.key === "status" || c.key === "week") return v;
    return typeof v === "number" ? +Number(v).toFixed(4) : v;
  }));
  return [header, ...body];
}

// Build the whole workbook → Uint8Array (pure).
export function buildWorkbook(sim, strategySims, config, activeStrategyId, activeViewId) {
  const wb = XLSX.utils.book_new();
  const S = (aoa, name) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
  S(summaryAOA(sim, strategySims, activeStrategyId, activeViewId, config), "Summary");
  S(strategyAOA(strategySims, config), "Strategy comparison");
  S(findingsAOA(sim, config), "Findings & risks");
  S([["Path", "Setting", "Value"], ...flattenParameters(config).map((r) => [r.path, r.setting, r.value])], "Parameters");
  S(volumesAOA(config), "Volumes");
  const used = new Set(["Summary", "Strategy comparison", "Findings & risks", "Parameters", "Volumes"]);
  for (const q of config.queues) {
    let name = q.name.replace(/[\\/?*[\]:]/g, " ").slice(0, 28) || q.id;
    let n = name, i = 2;
    while (used.has(n)) n = (name.slice(0, 25) + " " + i++).slice(0, 31);
    used.add(n);
    S(queueAOA(sim, q, config), n);
  }
  return new Uint8Array(XLSX.write(wb, { bookType: "xlsx", type: "array" }));
}

// Parse a workbook's Parameters + Volumes sheets (ignore output sheets).
export function parseWorkbook(bytes) {
  const wb = XLSX.read(bytes, { type: "array" });
  const out = { params: [], volumes: null, sheetNames: wb.SheetNames };
  if (wb.Sheets["Parameters"]) {
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets["Parameters"], { header: 1 });
    for (let r = 1; r < aoa.length; r++) {
      const [path, , value] = aoa[r];
      if (path) out.params.push({ path: String(path), value });
    }
  }
  if (wb.Sheets["Volumes"]) out.volumes = XLSX.utils.sheet_to_json(wb.Sheets["Volumes"], { header: 1 });
  return out;
}

export function applyWorkbookImport(config, parsed) {
  let c = config;
  if (parsed.params && parsed.params.length) c = applyParameters(c, parsed.params);
  if (parsed.volumes) c = applyVolumes(c, parsed.volumes);
  return c;
}

// ---- CSV builders ----
const csvCell = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const toCSV = (aoa) => aoa.map((row) => row.map(csvCell).join(",")).join("\n");

export function queueCSV(sim, queue, config) {
  const cols = columnsFor(queue, config.engine.currency);
  const rows = buildWeeklyRows(sim, queue, config);
  return toCSV([cols.map((c) => c.label), ...rows.map((row) => cols.map((c) => c.fmt(row[c.key])))]);
}
export function parametersCSV(config) {
  return toCSV([["Path", "Setting", "Value"], ...flattenParameters(config).map((r) => [r.path, r.setting, r.value])]);
}
export function volumesCSV(config) { return toCSV(volumesAOA(config)); }

// ---- JSON builders ----
export const configJSON = (config) => JSON.stringify(config, null, 2);
export function runJSON(sim, config) {
  return JSON.stringify({ kind: "capacity-run", savedAt: null, config, run: compactRun(config, sim) }, null, 2);
}
export function parseConfigJSON(text) {
  const c = JSON.parse(text);
  if (!c || !Array.isArray(c.queues) || !c.engine) throw new Error("Not a valid config file");
  return c;
}
export function parseRunJSON(text) {
  const o = JSON.parse(text);
  if (!o || o.kind !== "capacity-run" || !o.config) throw new Error("Not a valid saved-run file");
  return o;
}

// ---- DOM download wrappers (the only DOM-touching part) ----
function anchorDownload(filename, blob) {
  const a = document.createElement("a");
  const url = typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(blob) : "";
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (url && URL.revokeObjectURL) setTimeout(() => URL.revokeObjectURL(url), 0);
}
export function downloadBytes(filename, u8, mime = "application/octet-stream") {
  anchorDownload(filename, new Blob([u8], { type: mime }));
}
export function downloadText(filename, text, mime = "text/plain") {
  anchorDownload(filename, new Blob([text], { type: mime }));
}
