import { useMemo, useCallback } from "react";
import { setPath } from "./format.js";
import { uid, effectiveSupports, R2_DEFAULTS, resolveKnockOn, channelOf, primaryVoiceQueue } from "../engine/engine.js";

// Deep clone the physics defaults so the working config carries an editable
// settings block (every value equals a default, so the engine is unchanged).
const clone = (o) => JSON.parse(JSON.stringify(o));

const blankQueue = (n) => ({
  id: "q_" + uid(), name: "New queue " + n, type: "voice",
  dailyVolume: 500, aht: 300, profile: new Array(24).fill(1),
  asaTarget: 30, maxAbandon: 0.05, patience: 90,
  shrinkage: 0.3, fte: 10, agentCost: 32000, agentCostMonthly: 32000 / 12,
  resourcing: "resourced", supports: [], crossSkill: [],
  weeklyVolumes: null, seasonal: null,
  concurrency: 1, digitalSlaMinutes: 5, digitalSlaPct: 0.8, backlogLimit: 100, deflectsTo: null,
  // §24.1 knock-on (two figures), §24.2 sharing, §24.5 subtype, §24.10 SLA target.
  knock: { repeatPct: 0, convertPct: 0, convertTarget: null },
  sharing: null, subtype: "customer",
  workflowSlaHours: 24, workflowSlaPct: 0.9, slaAttainmentTarget: 0.9,
  wf: { attrition: 0.04, attritionGrowth: 0, reqToStart: 6, trainingWeeks: 4, learningCurve: [0.6, 0.75, 0.9, 1.0], hires: [] },
  burn: { occThreshold: 0.85, sensitivity: 1.5, recovery: 8, maxAttritionMult: 2, absenceUplift: 0.05 },
});

const SCENARIO_DEFAULTS = {
  growth: { name: "Growth", p: { rate: 0.02, stopWeek: null } },
  launch: { name: "Product launch", p: { ramp: 3, peak: 0.4, decay: 6 } },
  p1: { name: "P1 incident", p: { spike: 1.5, days: 2 } },
  forecastError: { name: "Forecast error", p: { error: 0.15 } },
  attritionShock: { name: "Attrition shock", p: { add: 0.03 } },
  hiringFreeze: { name: "Hiring freeze", p: { weeks: 12 } },
  reducedTraining: { name: "Reduced training", p: { cutWeeks: 2, startProficiency: 0.4, stretch: 1.75, ahtPenalty: 0.12, repeatUplift: 0.08 } },
  growthManual: { name: "Manual weekly growth", p: { weeklyPct: {} } },
  freezeManual: { name: "Manual freeze", p: { weeks: [] } },
};

const STRATEGY_DEFAULTS = {
  meet: { name: "Custom meet", baseType: "meet" },
  buffer: { name: "Custom buffer", baseType: "buffer", bufferPct: 0.1 },
  backfill: { name: "Custom backfill", baseType: "backfill" },
  manual: { name: "Custom manual", baseType: "manual" },
  schedule: { name: "Custom schedule", baseType: "schedule", segments: [{ fromWeek: 1, strategyId: "S1" }] },
};

// §15/§16 default channel templates. knockOn defaults are null so the engine
// falls through to Settings/legacy (no behaviour change); the editor lets a
// planner set channel-wide knock-on that queues inherit unless they override.
const blankChannel = () => ({ knockOn: { repeatPct: null, spillPct: null, spillTargetQueue: null } });
const defaultChannels = () => ({ voice: blankChannel(), digital: blankChannel(), support: blankChannel() });

/* §24.5 / §7 channel presets — each seeds a channel template with the mechanics
   of its kind. Voice: Erlang (ASA / abandon / patience). Digital Customer: live
   interaction (concurrency + minutes SLA). Digital Workflow: backlog processing,
   NO concurrency, handle time per item, SLA in HOURS (default 90% within 24h).
   Service Workflow: support channel, deferrable, SLA in DAYS (default 95% within
   5 days). Group (voice/digital/support) drives the Brand → channel hierarchy;
   kind drives which template sections a queue inherits when it attaches. */
export const CHANNEL_PRESETS = {
  voice: { label: "Voice (Erlang)", kind: "voice", group: "voice", template: { type: "voice", subtype: null, asaTarget: 30, maxAbandon: 0.05, patience: 90 } },
  digitalCustomer: { label: "Digital Customer (live)", kind: "digitalCustomer", group: "digital", template: { type: "digital", subtype: "customer", concurrency: 2.5, digitalSlaMinutes: 5, digitalSlaPct: 0.8 } },
  digitalWorkflow: { label: "Digital Workflow (backlog)", kind: "digitalWorkflow", group: "digital", template: { type: "digital", subtype: "workflow", workflowSlaHours: 24, workflowSlaPct: 0.9 } },
  serviceWorkflow: { label: "Service Workflow (support)", kind: "serviceWorkflow", group: "support", template: { type: "digital", subtype: "workflow", workflowSlaHours: 120, workflowSlaPct: 0.95, slaUnit: "days" } },
};
export const CHANNEL_PRESET_LIST = Object.entries(CHANNEL_PRESETS).map(([k, v]) => ({ value: k, label: v.label }));
const defaultChannelDefs = () => [
  { id: "ch_voice", name: "Voice", kind: "voice", group: "voice", builtin: true, template: JSON.parse(JSON.stringify(CHANNEL_PRESETS.voice.template)) },
  { id: "ch_digcust", name: "Digital Customer", kind: "digitalCustomer", group: "digital", builtin: true, template: JSON.parse(JSON.stringify(CHANNEL_PRESETS.digitalCustomer.template)) },
  { id: "ch_digwf", name: "Digital Workflow", kind: "digitalWorkflow", group: "digital", builtin: true, template: JSON.parse(JSON.stringify(CHANNEL_PRESETS.digitalWorkflow.template)) },
  { id: "ch_svcwf", name: "Service Workflow", kind: "serviceWorkflow", group: "support", builtin: true, template: JSON.parse(JSON.stringify(CHANNEL_PRESETS.serviceWorkflow.template)) },
];

/* R2 (§15–§21) working-config migration, applied on load. Adds the R2 concept
   model — brands, pools, scenario groups, channel templates, an editable
   settings (physics + risk) block — and the crossSkill→supports shim (§14.3),
   backfilling anything a legacy saved config lacks. Resourcing modes normalise
   to the R2 vocabulary (resourced→dedicated, supported→unmanned); the mapping
   is behaviour-preserving (the engine treats them identically for HC, hiring,
   donation and receiving). Idempotent. */
export function migrateConfig(config) {
  const map = effectiveSupports(config);
  // §24.9: a truly-blank config (no brands AND no queues) stays blank — no brand
  // is injected. A legacy config with queues but no brands still gets "Brand 1".
  const brands = (config.brands && config.brands.length)
    ? config.brands
    : ((config.queues && config.queues.length) ? [{ id: "b1", name: "Brand 1", training: null, dailyVolume: null, weeklyVolumes: null }] : []);
  const brandId = (brands[0] || {}).id;
  const queues = config.queues.map((q, i) => ({
    ...q,
    brandId: q.brandId || brandId,
    channel: q.channel || (q.type === "voice" ? "voice" : "digital"),
    priority: q.priority != null ? q.priority : i + 1,
    resourcing: q.resourcing === "supported" ? "unmanned"
      : (!q.resourcing || q.resourcing === "resourced") ? "dedicated" : q.resourcing,
    overrides: { seasonality: Array.isArray(q.seasonal), knockOn: q.repeatPct != null || q.spillPct != null, ...(q.overrides || {}) },
    supports: (map[q.id] || []).map((s) => ({ queueId: s.queueId, priority: s.priority, maxSharePct: s.maxSharePct == null ? 100 : s.maxSharePct })),
    crossSkill: [],
  }));
  const out = { ...config, queues, brands };
  out.pools = Array.isArray(config.pools) ? config.pools : [];
  out.channels = config.channels || defaultChannels();
  // §24.5/§7 channel definitions library (name + preset-seeded template).
  out.channelDefs = Array.isArray(config.channelDefs) && config.channelDefs.length ? config.channelDefs : defaultChannelDefs();
  // Groups replace views (§19). Adopt existing groups, else derive from views 1:1.
  if (!Array.isArray(out.groups) || !out.groups.length) {
    const fromViews = (config.views || []).map((v) => ({ id: v.id.replace(/^v_/, "g_"), name: v.name, builtin: !!v.builtin, scenarioIds: Array.isArray(v.scenarioIds) ? [...v.scenarioIds] : undefined }));
    out.groups = fromViews.length ? fromViews : [{ id: "g_por", name: "Plan of record", builtin: true }, { id: "g_none", name: "No scenarios", builtin: true, scenarioIds: [] }];
  }
  // Editable settings block: physics + risk thresholds, seeded from the engine
  // defaults so every value is present to edit and the engine is unchanged.
  out.settings = mergeSettings(clone(R2_DEFAULTS), config.settings || {});
  if (!Array.isArray(out.strategies) || !out.strategies.length) {
    out.strategies = [
      { id: "S1", name: "Meet requirement", baseType: "meet", builtin: true },
      { id: "S2", name: "Buffer above", baseType: "buffer", builtin: true },
      { id: "S3", name: "Forward backfill", baseType: "backfill", builtin: true },
      { id: "S4", name: "Manual plan", baseType: "manual", builtin: true },
    ];
  }
  if (out.engine.globalStartingHC === undefined) out.engine = { ...out.engine, globalStartingHC: null };
  if (out.engine.horizonWeeks == null) out.engine = { ...out.engine, horizonWeeks: 52 };
  return migrateR3(out);
}

/* R3 (SPEC §24) working-config migration, layered on the R2 shape above.
   Every addition is behaviour-preserving on the default config: knock is the
   resolved legacy repeat/spill; sharing decomposes pools (default: none);
   monthly cost = annual ÷ 12 (weekly identical); caps carry the legacy global
   cap as Total (empty segment matrix = the legacy single-cap allocator);
   subtype "customer" is the legacy digital model. Idempotent. */
function migrateR3(cfg) {
  // Decompose pools into per-queue sharing declarations, then empty pools so the
  // engine's sharing rung — not the legacy pool shim — does the work.
  const shareOf = {};
  for (const pool of cfg.pools || []) {
    for (const m of pool.members || []) {
      const others = (pool.members || []).filter((x) => x.queueId !== m.queueId).map((x) => x.queueId);
      const pctv = m.sharePct != null ? m.sharePct : 100;
      const cur = shareOf[m.queueId];
      if (!cur) shareOf[m.queueId] = { sharePct: pctv, sharesWith: [...others] };
      else { cur.sharePct = Math.max(cur.sharePct, pctv); for (const id of others) if (!cur.sharesWith.includes(id)) cur.sharesWith.push(id); }
    }
  }
  const queues = cfg.queues.map((q) => {
    const kn = q.knock ? null : resolveKnockOn(cfg, q); // resolveKnockOn short-circuits on q.knock
    const primary = primaryVoiceQueue(cfg, q.brandId);
    const knock = q.knock || {
      repeatPct: kn.repeatPct,
      convertPct: kn.spillPct,
      convertTarget: kn.spillTargetQueue != null ? kn.spillTargetQueue
        : kn.spillPct > 0 ? null
        : primary && primary.id !== q.id ? primary.id : null,
    };
    const subtype = q.type === "digital" ? (q.subtype || "customer") : q.subtype;
    const channelId = q.channelId || (
      q.channel === "support" ? "ch_svcwf"
        : (q.type === "voice" || q.channel === "voice") ? "ch_voice"
          : subtype === "workflow" ? "ch_digwf" : "ch_digcust");
    return {
      ...q,
      knock,
      repeatPct: knock.repeatPct, spillPct: knock.convertPct, spillTargetQueue: knock.convertTarget,
      sharing: q.sharing !== undefined ? q.sharing : (shareOf[q.id] || null),
      subtype, channelId,
      workflowSlaHours: q.workflowSlaHours != null ? q.workflowSlaHours : 24,
      workflowSlaPct: q.workflowSlaPct != null ? q.workflowSlaPct : 0.9,
      agentCostMonthly: q.agentCostMonthly != null ? q.agentCostMonthly : (q.agentCost != null ? q.agentCost / 12 : null),
      slaAttainmentTarget: q.slaAttainmentTarget != null ? q.slaAttainmentTarget : 0.9,
    };
  });
  const out = { ...cfg, queues, pools: [] };
  out.strategies = (cfg.strategies || []).map((s) =>
    s.baseType === "backfill" && s.forwardMonths == null ? { ...s, forwardMonths: 3 } : s);
  out.hiring = {
    ...cfg.hiring,
    caps: cfg.hiring.caps || { segments: {}, brands: {}, total: cfg.hiring.cap != null ? cfg.hiring.cap : null },
  };
  out.costs = {
    ...cfg.costs,
    managerCostMonthly: cfg.costs.managerCostMonthly != null ? cfg.costs.managerCostMonthly
      : (cfg.costs.managerCost != null ? cfg.costs.managerCost / 12 : null),
  };
  if (!out.settings.calendar) out.settings = { ...out.settings, calendar: { weekOneDate: null } };
  return out;
}

/* §24 (R3c) live preset references. Seasonality and arrival patterns are edited
   as a library in Settings; a queue (or the system) that APPLIES a pattern
   stores the pattern id, and this resolver bakes the library's CURRENT values
   into the config the engine simulates — so editing a pattern in Settings flows
   into every queue that uses it on the next re-simulation. Pure; returns
   content-identical config when no references are present. */
export function resolvePresets(cfg, seasPresets, arrPresets) {
  const seas = cfg.seasonality || {};
  let system = seas.system;
  if (seas.systemPresetId) {
    const p = (seasPresets || []).find((x) => x.id === seas.systemPresetId);
    if (p && Array.isArray(p.months)) system = p.months;
  }
  const queues = cfg.queues.map((q) => {
    let nq = q;
    if (q.seasonalPresetId && q.overrides && q.overrides.seasonality) {
      const p = (seasPresets || []).find((x) => x.id === q.seasonalPresetId);
      if (p && Array.isArray(p.months)) nq = { ...nq, seasonal: p.months };
    }
    if (q.arrivalPresetId) {
      const p = (arrPresets || []).find((x) => x.id === q.arrivalPresetId);
      if (p && Array.isArray(p.curve)) nq = { ...nq, profile: p.curve };
    }
    return nq;
  });
  return { ...cfg, seasonality: { ...seas, system }, queues };
}

function mergeSettings(base, over) {
  if (over == null) return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const k of Object.keys(over)) {
    const b = base ? base[k] : undefined, o = over[k];
    out[k] = o != null && typeof o === "object" && !Array.isArray(o) && b != null && typeof b === "object" && !Array.isArray(b) ? mergeSettings(b, o) : (o === undefined ? b : o);
  }
  return out;
}

/* All config-editing operations in one place, built once per `setConfig`
   identity via useMemo/useCallback so editor components get stable handlers.
   Every op is an immutable update — editors mutate the *live* config; only
   display components must read `sim.config` (E4). */
export function useConfigOps(setConfig) {
  const patch = useCallback((path, value) => setConfig((c) => setPath(c, path, value)), [setConfig]);

  const patchQueue = useCallback((qid, path, value) => {
    setConfig((c) => {
      const idx = c.queues.findIndex((q) => q.id === qid);
      if (idx < 0) return c;
      const nextQueues = c.queues.slice();
      nextQueues[idx] = setPath(nextQueues[idx], path, value);
      return { ...c, queues: nextQueues };
    });
  }, [setConfig]);

  const addQueue = useCallback(() => {
    setConfig((c) => {
      const q = blankQueue(c.queues.length + 1);
      q.brandId = (c.brands && c.brands[0] && c.brands[0].id) || "b1";
      q.channel = "voice";
      q.priority = c.queues.reduce((m, x) => Math.max(m, x.priority || 0), 0) + 1;
      q.resourcing = "dedicated";
      q.overrides = { seasonality: false, knockOn: false };
      return { ...c, queues: [...c.queues, q] };
    });
  }, [setConfig]);

  const duplicateQueue = useCallback((qid) => {
    setConfig((c) => {
      const src = c.queues.find((q) => q.id === qid);
      if (!src) return c;
      const copy = JSON.parse(JSON.stringify(src));
      copy.id = "q_" + uid();
      copy.name = src.name + " (copy)";
      const idx = c.queues.findIndex((q) => q.id === qid);
      const nextQueues = c.queues.slice();
      nextQueues.splice(idx + 1, 0, copy);
      return { ...c, queues: nextQueues };
    });
  }, [setConfig]);

  const deleteQueue = useCallback((qid) => {
    setConfig((c) => ({
      ...c,
      queues: c.queues.filter((q) => q.id !== qid).map((q) => ({
        ...q,
        crossSkill: (q.crossSkill || []).filter((id) => id !== qid),
        deflectsTo: q.deflectsTo === qid ? null : q.deflectsTo,
      })),
      serviceTeams: c.serviceTeams.map((t) => ({ ...t, coversQueues: (t.coversQueues || []).filter((id) => id !== qid) })),
      scenarios: c.scenarios.map((s) => (Array.isArray(s.queueIds) ? { ...s, queueIds: s.queueIds.filter((id) => id !== qid) } : s)),
    }));
  }, [setConfig]);

  const addHire = useCallback((qid) => {
    setConfig((c) => {
      const idx = c.queues.findIndex((q) => q.id === qid);
      if (idx < 0) return c;
      const nextQueues = c.queues.slice();
      const wf = nextQueues[idx].wf;
      nextQueues[idx] = { ...nextQueues[idx], wf: { ...wf, hires: [...(wf.hires || []), { week: 0, heads: 1 }] } };
      return { ...c, queues: nextQueues };
    });
  }, [setConfig]);

  const patchHire = useCallback((qid, hireIdx, key, value) => {
    setConfig((c) => {
      const idx = c.queues.findIndex((q) => q.id === qid);
      if (idx < 0) return c;
      const nextQueues = c.queues.slice();
      const wf = nextQueues[idx].wf;
      const hires = wf.hires.slice();
      hires[hireIdx] = { ...hires[hireIdx], [key]: value };
      nextQueues[idx] = { ...nextQueues[idx], wf: { ...wf, hires } };
      return { ...c, queues: nextQueues };
    });
  }, [setConfig]);

  const deleteHire = useCallback((qid, hireIdx) => {
    setConfig((c) => {
      const idx = c.queues.findIndex((q) => q.id === qid);
      if (idx < 0) return c;
      const nextQueues = c.queues.slice();
      const wf = nextQueues[idx].wf;
      nextQueues[idx] = { ...nextQueues[idx], wf: { ...wf, hires: wf.hires.filter((_, i) => i !== hireIdx) } };
      return { ...c, queues: nextQueues };
    });
  }, [setConfig]);

  const addServiceTeam = useCallback(() => {
    setConfig((c) => ({
      ...c,
      serviceTeams: [...c.serviceTeams, {
        id: "st_" + uid(), name: "Flex pool " + (c.serviceTeams.length + 1), size: 8, premiumPct: 0.2,
        proficiency: 0.8, triggerOccupancy: 0.9, maxHoursPerWeek: 20, agentCost: 32000, coversQueues: [],
      }],
    }));
  }, [setConfig]);

  const patchServiceTeam = useCallback((idx, path, value) => {
    setConfig((c) => {
      const next = c.serviceTeams.slice();
      next[idx] = setPath(next[idx], path, value);
      return { ...c, serviceTeams: next };
    });
  }, [setConfig]);

  const deleteServiceTeam = useCallback((tid) => {
    setConfig((c) => ({ ...c, serviceTeams: c.serviceTeams.filter((t) => t.id !== tid) }));
  }, [setConfig]);

  const addScenario = useCallback((type) => {
    setConfig((c) => {
      const d = SCENARIO_DEFAULTS[type];
      if (!d) return c;
      const s = { id: "sc_" + uid(), type, name: d.name, enabled: true, startWeek: 0, queueIds: "all", p: { ...d.p } };
      return { ...c, scenarios: [...c.scenarios, s] };
    });
  }, [setConfig]);

  const patchScenario = useCallback((idx, path, value) => {
    setConfig((c) => {
      const next = c.scenarios.slice();
      next[idx] = setPath(next[idx], path, value);
      return { ...c, scenarios: next };
    });
  }, [setConfig]);

  const deleteScenario = useCallback((sid) => {
    setConfig((c) => ({
      ...c,
      scenarios: c.scenarios.filter((s) => s.id !== sid),
      // keep saved views coherent when a scenario disappears
      views: c.views.map((v) => (Array.isArray(v.scenarioIds) ? { ...v, scenarioIds: v.scenarioIds.filter((id) => id !== sid) } : v)),
    }));
  }, [setConfig]);

  // ---- scenario views (SPEC §5): named sets of enabled scenarios ----
  const addView = useCallback((name, scenarioIds) => {
    const id = "v_" + uid();
    setConfig((c) => ({ ...c, views: [...c.views, { id, name: name || "New view", builtin: false, scenarioIds: [...(scenarioIds || [])] }] }));
    return id;
  }, [setConfig]);

  const renameView = useCallback((vid, name) => {
    setConfig((c) => ({ ...c, views: c.views.map((v) => (v.id === vid ? { ...v, name } : v)) }));
  }, [setConfig]);

  const toggleViewScenario = useCallback((vid, sid, on) => {
    setConfig((c) => ({
      ...c,
      views: c.views.map((v) => {
        if (v.id !== vid || !Array.isArray(v.scenarioIds)) return v;
        const has = v.scenarioIds.includes(sid);
        if (on && !has) return { ...v, scenarioIds: [...v.scenarioIds, sid] };
        if (!on && has) return { ...v, scenarioIds: v.scenarioIds.filter((x) => x !== sid) };
        return v;
      }),
    }));
  }, [setConfig]);

  const deleteView = useCallback((vid) => {
    setConfig((c) => ({ ...c, views: c.views.filter((v) => v.id !== vid || v.builtin) }));
  }, [setConfig]);

  // ---- §14.3 support routing (per-queue outbound) + resourcing (§14.2) ----
  const setResourcing = useCallback((qid, mode) => {
    setConfig((c) => ({ ...c, queues: c.queues.map((q) => (q.id === qid ? { ...q, resourcing: mode } : q)) }));
  }, [setConfig]);

  const addSupport = useCallback((qid, targetId) => {
    setConfig((c) => ({
      ...c,
      queues: c.queues.map((q) => {
        if (q.id !== qid) return q;
        const supports = q.supports || [];
        if (!targetId || supports.some((s) => s.queueId === targetId)) return q;
        const nextPri = supports.reduce((m, s) => Math.max(m, s.priority || 1), 0) + 1;
        return { ...q, supports: [...supports, { queueId: targetId, priority: nextPri, maxSharePct: 100 }] };
      }),
    }));
  }, [setConfig]);

  const patchSupport = useCallback((qid, idx, key, value) => {
    setConfig((c) => ({
      ...c,
      queues: c.queues.map((q) => {
        if (q.id !== qid) return q;
        const supports = q.supports.slice();
        supports[idx] = { ...supports[idx], [key]: value };
        return { ...q, supports };
      }),
    }));
  }, [setConfig]);

  const deleteSupport = useCallback((qid, idx) => {
    setConfig((c) => ({ ...c, queues: c.queues.map((q) => (q.id === qid ? { ...q, supports: q.supports.filter((_, i) => i !== idx) } : q)) }));
  }, [setConfig]);

  // ---- §14.1 strategies (config array + schedules) ----
  const addStrategy = useCallback((baseType) => {
    const d = STRATEGY_DEFAULTS[baseType];
    if (!d) return;
    const id = "str_" + uid();
    setConfig((c) => ({ ...c, strategies: [...(c.strategies || []), { id, ...d, name: d.name, segments: d.segments ? d.segments.map((s) => ({ ...s })) : undefined }] }));
    return id;
  }, [setConfig]);

  const duplicateStrategy = useCallback((sid) => {
    setConfig((c) => {
      const src = (c.strategies || []).find((s) => s.id === sid);
      if (!src) return c;
      const copy = JSON.parse(JSON.stringify(src));
      copy.id = "str_" + uid();
      copy.name = src.name + " (copy)";
      copy.builtin = false;
      const idx = c.strategies.findIndex((s) => s.id === sid);
      const next = c.strategies.slice();
      next.splice(idx + 1, 0, copy);
      return { ...c, strategies: next };
    });
  }, [setConfig]);

  const deleteStrategy = useCallback((sid) => {
    setConfig((c) => ({ ...c, strategies: (c.strategies || []).filter((s) => s.id !== sid || s.builtin) }));
  }, [setConfig]);

  const patchStrategy = useCallback((sid, path, value) => {
    setConfig((c) => ({ ...c, strategies: (c.strategies || []).map((s) => (s.id === sid ? setPath(s, path, value) : s)) }));
  }, [setConfig]);

  const addSegment = useCallback((sid) => {
    setConfig((c) => ({
      ...c,
      strategies: (c.strategies || []).map((s) => {
        if (s.id !== sid) return s;
        const segs = s.segments || [];
        const nextWeek = segs.reduce((m, x) => Math.max(m, x.fromWeek || 1), 0) + 5;
        return { ...s, segments: [...segs, { fromWeek: nextWeek, strategyId: "S1" }] };
      }),
    }));
  }, [setConfig]);

  const patchSegment = useCallback((sid, idx, key, value) => {
    setConfig((c) => ({
      ...c,
      strategies: (c.strategies || []).map((s) => {
        if (s.id !== sid) return s;
        const segs = s.segments.slice();
        segs[idx] = { ...segs[idx], [key]: value };
        return { ...s, segments: segs };
      }),
    }));
  }, [setConfig]);

  const deleteSegment = useCallback((sid, idx) => {
    setConfig((c) => ({ ...c, strategies: (c.strategies || []).map((s) => (s.id === sid ? { ...s, segments: s.segments.filter((_, i) => i !== idx) } : s)) }));
  }, [setConfig]);

  // Save an arbitrary schedule (ordered segments) as a new named strategy.
  const saveScheduleAsStrategy = useCallback((name, segments) => {
    const id = "str_" + uid();
    setConfig((c) => ({ ...c, strategies: [...(c.strategies || []), { id, name: name || "Saved schedule", baseType: "schedule", segments: segments.map((s) => ({ ...s })) }] }));
    return id;
  }, [setConfig]);

  // ---- §19 scenario groups (replace views) ----
  const addGroup = useCallback((name, scenarioIds) => {
    const id = "g_" + uid();
    setConfig((c) => ({ ...c, groups: [...(c.groups || []), { id, name: name || "New group", builtin: false, scenarioIds: [...(scenarioIds || [])] }] }));
    return id;
  }, [setConfig]);
  const renameGroup = useCallback((gid, name) => setConfig((c) => ({ ...c, groups: (c.groups || []).map((g) => (g.id === gid ? { ...g, name } : g)) })), [setConfig]);
  const deleteGroup = useCallback((gid) => setConfig((c) => ({ ...c, groups: (c.groups || []).filter((g) => g.id !== gid || g.builtin) })), [setConfig]);
  const toggleGroupScenario = useCallback((gid, sid, on) => {
    setConfig((c) => ({
      ...c,
      groups: (c.groups || []).map((g) => {
        if (g.id !== gid || !Array.isArray(g.scenarioIds)) return g;
        const has = g.scenarioIds.includes(sid);
        if (on && !has) return { ...g, scenarioIds: [...g.scenarioIds, sid] };
        if (!on && has) return { ...g, scenarioIds: g.scenarioIds.filter((x) => x !== sid) };
        return g;
      }),
    }));
  }, [setConfig]);

  // ---- §15 brands ----
  const addBrand = useCallback((name) => {
    const id = "b_" + uid();
    setConfig((c) => ({ ...c, brands: [...(c.brands || []), { id, name: name || "New brand", training: null, dailyVolume: null, weeklyVolumes: null }] }));
    return id;
  }, [setConfig]);
  const patchBrand = useCallback((bid, path, value) => setConfig((c) => ({ ...c, brands: (c.brands || []).map((b) => (b.id === bid ? setPath(b, path, value) : b)) })), [setConfig]);
  const deleteBrand = useCallback((bid) => setConfig((c) => {
    if ((c.brands || []).length <= 1) return c; // always keep at least one brand
    const fallback = (c.brands.find((b) => b.id !== bid) || {}).id;
    return { ...c, brands: c.brands.filter((b) => b.id !== bid), queues: c.queues.map((q) => (q.brandId === bid ? { ...q, brandId: fallback } : q)) };
  }), [setConfig]);
  const setQueueBrand = useCallback((qid, bid) => setConfig((c) => ({ ...c, queues: c.queues.map((q) => (q.id === qid ? { ...q, brandId: bid } : q)) })), [setConfig]);

  const toggleBrandTraining = useCallback((bid, on) => setConfig((c) => ({
    ...c, brands: (c.brands || []).map((b) => (b.id === bid ? { ...b, training: on ? (b.training || { trainingWeeks: 4, learningCurve: [0.6, 0.75, 0.9, 1.0], trainingShrinkagePct: 0.05 }) : null } : b)),
  })), [setConfig]);

  // ---- §17 pools ----
  const addPool = useCallback((name) => {
    const id = "pool_" + uid();
    setConfig((c) => ({ ...c, pools: [...(c.pools || []), { id, name: name || "New pool", members: [] }] }));
    return id;
  }, [setConfig]);
  const renamePool = useCallback((pid, name) => setConfig((c) => ({ ...c, pools: (c.pools || []).map((p) => (p.id === pid ? { ...p, name } : p)) })), [setConfig]);
  const deletePool = useCallback((pid) => setConfig((c) => ({ ...c, pools: (c.pools || []).filter((p) => p.id !== pid) })), [setConfig]);
  const setPoolMember = useCallback((pid, qid, on) => setConfig((c) => ({
    ...c,
    pools: (c.pools || []).map((p) => {
      if (p.id !== pid) return p;
      const has = (p.members || []).some((m) => m.queueId === qid);
      if (on && !has) return { ...p, members: [...(p.members || []), { queueId: qid, sharePct: 100 }] };
      if (!on && has) return { ...p, members: p.members.filter((m) => m.queueId !== qid) };
      return p;
    }),
  })), [setConfig]);
  const patchPoolMember = useCallback((pid, qid, sharePct) => setConfig((c) => ({
    ...c, pools: (c.pools || []).map((p) => (p.id === pid ? { ...p, members: (p.members || []).map((m) => (m.queueId === qid ? { ...m, sharePct } : m)) } : p)),
  })), [setConfig]);

  // ---- §16 channel templates ----
  const patchChannel = useCallback((ch, path, value) => setConfig((c) => ({ ...c, channels: setPath(c.channels || { voice: {}, digital: {}, support: {} }, [ch, ...path], value) })), [setConfig]);

  // ---- §24.5/§7 channel definitions (name + preset-seeded template) ----
  const addChannel = useCallback((name, presetKind) => {
    const preset = CHANNEL_PRESETS[presetKind] || CHANNEL_PRESETS.voice;
    const id = "ch_" + uid();
    setConfig((c) => ({ ...c, channelDefs: [...(c.channelDefs || []), { id, name: name || preset.label, kind: preset.kind, group: preset.group, builtin: false, template: JSON.parse(JSON.stringify(preset.template)) }] }));
    return id;
  }, [setConfig]);
  const patchChannelDef = useCallback((id, path, value) => setConfig((c) => ({ ...c, channelDefs: (c.channelDefs || []).map((d) => (d.id === id ? setPath(d, path, value) : d)) })), [setConfig]);
  const deleteChannelDef = useCallback((id) => setConfig((c) => ({
    ...c,
    channelDefs: (c.channelDefs || []).filter((d) => d.id !== id),
    queues: c.queues.map((q) => (q.channelId === id ? { ...q, channelId: null } : q)),
  })), [setConfig]);
  // Attach a queue to a channel: it inherits the template's sections (type,
  // subtype and the SLA fields for its kind), exactly as elsewhere.
  const attachQueueChannel = useCallback((qid, defId) => setConfig((c) => {
    const def = (c.channelDefs || []).find((d) => d.id === defId);
    if (!def) return c;
    const t = def.template || {};
    return {
      ...c,
      queues: c.queues.map((q) => {
        if (q.id !== qid) return q;
        const nq = { ...q, channelId: def.id, channel: def.group, type: t.type || q.type };
        if (t.subtype !== undefined) nq.subtype = t.subtype;
        ["asaTarget", "maxAbandon", "patience", "concurrency", "digitalSlaMinutes", "digitalSlaPct", "workflowSlaHours", "workflowSlaPct"].forEach((k) => { if (t[k] != null) nq[k] = t[k]; });
        return nq;
      }),
    };
  }), [setConfig]);

  // ---- §16 section-level inheritance flags (queue overrides a channel/brand default) ----
  const setOverride = useCallback((qid, section, on) => setConfig((c) => ({
    ...c, queues: c.queues.map((q) => (q.id === qid ? { ...q, overrides: { ...(q.overrides || {}), [section]: on } } : q)),
  })), [setConfig]);

  // ---- §19 unified scenarios ----
  const addUnifiedScenario = useCallback(() => {
    const s = { id: "sc_" + uid(), type: "unified", name: "New scenario", enabled: true, tag: "custom", parameter: "volume", mechanism: "step", granularity: "week", startWeek: 0, stopWeek: null, scope: "all", queueIds: "all", p: { value: 0.1 } };
    setConfig((c) => ({ ...c, scenarios: [...c.scenarios, s] }));
    return s.id;
  }, [setConfig]);

  // ---- §24.2 sharing (decentralised; pools deleted) ----
  const setSharing = useCallback((qid, on) => setConfig((c) => ({
    ...c, queues: c.queues.map((q) => (q.id === qid ? { ...q, sharing: on ? (q.sharing || { sharePct: 100, sharesWith: [] }) : null } : q)),
  })), [setConfig]);
  const patchSharing = useCallback((qid, key, value) => setConfig((c) => ({
    ...c, queues: c.queues.map((q) => (q.id === qid ? { ...q, sharing: { ...(q.sharing || { sharePct: 100, sharesWith: [] }), [key]: value } } : q)),
  })), [setConfig]);
  const toggleSharesWith = useCallback((qid, targetId, on) => setConfig((c) => ({
    ...c, queues: c.queues.map((q) => {
      if (q.id !== qid) return q;
      const sh = q.sharing || { sharePct: 100, sharesWith: [] };
      const list = sh.sharesWith || [];
      const has = list.includes(targetId);
      const next = on && !has ? [...list, targetId] : !on && has ? list.filter((x) => x !== targetId) : list;
      return { ...q, sharing: { ...sh, sharesWith: next } };
    }),
  })), [setConfig]);

  // ---- §24.1 knock-on (two figures) ----
  const patchKnock = useCallback((qid, key, value) => setConfig((c) => ({
    ...c, queues: c.queues.map((q) => {
      if (q.id !== qid) return q;
      const knock = { ...(q.knock || { repeatPct: 0, convertPct: 0, convertTarget: null }), [key]: value };
      return { ...q, knock, repeatPct: knock.repeatPct, spillPct: knock.convertPct, spillTargetQueue: knock.convertTarget };
    }),
  })), [setConfig]);

  // ---- §24.3 hiring cap hierarchy ----
  const patchCapSegment = useCallback((brandId, channel, value) => setConfig((c) => {
    const caps = c.hiring.caps || { segments: {}, brands: {}, total: c.hiring.cap };
    const segments = { ...(caps.segments || {}) };
    const k = brandId + "|" + channel;
    if (value == null || value === "") delete segments[k]; else segments[k] = value;
    return { ...c, hiring: { ...c.hiring, caps: { ...caps, segments } } };
  }), [setConfig]);
  const patchCapBrand = useCallback((brandId, value) => setConfig((c) => {
    const caps = c.hiring.caps || { segments: {}, brands: {}, total: c.hiring.cap };
    const brands = { ...(caps.brands || {}) };
    if (value == null || value === "") delete brands[brandId]; else brands[brandId] = value;
    return { ...c, hiring: { ...c.hiring, caps: { ...caps, brands } } };
  }), [setConfig]);
  const patchCapTotal = useCallback((value) => setConfig((c) => {
    const caps = c.hiring.caps || { segments: {}, brands: {}, total: c.hiring.cap };
    return { ...c, hiring: { ...c.hiring, cap: value != null && value !== "" ? value : c.hiring.cap, caps: { ...caps, total: value === "" ? null : value } } };
  }), [setConfig]);

  // ---- §24.6 date-anchored weekly volume series + seasonality wizard ----
  const setWeekOneDate = useCallback((iso) => setConfig((c) => setPath(c, ["settings", "calendar", "weekOneDate"], iso || null)), [setConfig]);
  const setQueueVolume = useCallback((qid, mode, payload) => setConfig((c) => ({
    ...c, queues: c.queues.map((q) => {
      if (q.id !== qid) return q;
      if (mode === "single") return { ...q, dailyVolume: payload, weeklyVolumes: null };
      if (mode === "series") return { ...q, weeklyVolumes: payload, dailyVolume: null };
      if (mode === "inherit") return { ...q, dailyVolume: null, weeklyVolumes: null, volumeShare: q.volumeShare != null ? q.volumeShare : 1 };
      return q;
    }),
  })), [setConfig]);
  const patchWeeklyVolume = useCallback((qid, week, value) => setConfig((c) => ({
    ...c, queues: c.queues.map((q) => {
      if (q.id !== qid) return q;
      // Materialise the full series from the single figure first, so editing one
      // week's volume never zeroes the rest (the engine reads each week directly).
      let arr;
      if (Array.isArray(q.weeklyVolumes)) arr = q.weeklyVolumes.slice();
      else arr = new Array(c.engine.horizonWeeks).fill(q.dailyVolume != null ? q.dailyVolume : 0);
      arr[week] = value;
      return { ...q, weeklyVolumes: arr, dailyVolume: null };
    }),
  })), [setConfig]);

  // ---- §24.8 group scope ----
  const patchGroupScope = useCallback((gid, scope) => setConfig((c) => ({
    ...c, groups: (c.groups || []).map((g) => (g.id === gid ? { ...g, scope } : g)),
  })), [setConfig]);
  const toggleGroupScopeTarget = useCallback((gid, kind, id, on) => setConfig((c) => ({
    ...c, groups: (c.groups || []).map((g) => {
      if (g.id !== gid) return g;
      const scope = { brandIds: [], channels: [], queueIds: [], ...(g.scope || {}) };
      const key = kind === "brand" ? "brandIds" : kind === "channel" ? "channels" : "queueIds";
      const list = scope[key] || [];
      scope[key] = on ? (list.includes(id) ? list : [...list, id]) : list.filter((x) => x !== id);
      return { ...g, scope };
    }),
  })), [setConfig]);

  // §24.8 group-first: a factor is a scenario created directly inside a group
  // (added to its scenarioIds membership in one update).
  const addFactor = useCallback((gid) => {
    const id = "sc_" + uid();
    const s = { id, type: "unified", name: "New factor", enabled: true, tag: "custom", parameter: "volume", mechanism: "step", granularity: "week", startWeek: 0, stopWeek: null, scope: "all", queueIds: "all", p: { value: 0.1 } };
    setConfig((c) => ({
      ...c,
      scenarios: [...c.scenarios, s],
      groups: (c.groups || []).map((g) => (g.id === gid ? { ...g, scenarioIds: [...(Array.isArray(g.scenarioIds) ? g.scenarioIds : []), id] } : g)),
    }));
    return id;
  }, [setConfig]);

  // ---- §24 brand training + subtype live on the queue via patchQueue/patchBrand ----
  const setQueueSubtype = useCallback((qid, subtype) => setConfig((c) => ({
    ...c, queues: c.queues.map((q) => (q.id === qid ? { ...q, subtype } : q)),
  })), [setConfig]);

  return useMemo(() => ({
    patch, patchQueue, addQueue, duplicateQueue, deleteQueue,
    addHire, patchHire, deleteHire,
    addServiceTeam, patchServiceTeam, deleteServiceTeam,
    addScenario, addUnifiedScenario, patchScenario, deleteScenario,
    addView, renameView, toggleViewScenario, deleteView,
    addGroup, renameGroup, deleteGroup, toggleGroupScenario,
    addBrand, patchBrand, deleteBrand, setQueueBrand, toggleBrandTraining,
    addPool, renamePool, deletePool, setPoolMember, patchPoolMember,
    patchChannel, setOverride,
    addChannel, patchChannelDef, deleteChannelDef, attachQueueChannel,
    setResourcing, addSupport, patchSupport, deleteSupport,
    addStrategy, duplicateStrategy, deleteStrategy, patchStrategy,
    addSegment, patchSegment, deleteSegment, saveScheduleAsStrategy,
    // R3 (§24)
    setSharing, patchSharing, toggleSharesWith, patchKnock,
    patchCapSegment, patchCapBrand, patchCapTotal,
    setWeekOneDate, setQueueVolume, patchWeeklyVolume, patchGroupScope, toggleGroupScopeTarget, addFactor, setQueueSubtype,
  }), [patch, patchQueue, addQueue, duplicateQueue, deleteQueue, addHire, patchHire, deleteHire, addServiceTeam, patchServiceTeam, deleteServiceTeam, addScenario, addUnifiedScenario, patchScenario, deleteScenario, addView, renameView, toggleViewScenario, deleteView, addGroup, renameGroup, deleteGroup, toggleGroupScenario, addBrand, patchBrand, deleteBrand, setQueueBrand, toggleBrandTraining, addPool, renamePool, deletePool, setPoolMember, patchPoolMember, patchChannel, setOverride, addChannel, patchChannelDef, deleteChannelDef, attachQueueChannel, setResourcing, addSupport, patchSupport, deleteSupport, addStrategy, duplicateStrategy, deleteStrategy, patchStrategy, addSegment, patchSegment, deleteSegment, saveScheduleAsStrategy, setSharing, patchSharing, toggleSharesWith, patchKnock, patchCapSegment, patchCapBrand, patchCapTotal, setWeekOneDate, setQueueVolume, patchWeeklyVolume, patchGroupScope, toggleGroupScopeTarget, addFactor, setQueueSubtype]);
}
