import { useMemo, useCallback } from "react";
import { setPath } from "./format.js";
import { uid, effectiveSupports } from "../engine/engine.js";

const blankQueue = (n) => ({
  id: "q_" + uid(), name: "New queue " + n, type: "voice",
  dailyVolume: 500, aht: 300, profile: new Array(24).fill(1),
  asaTarget: 30, maxAbandon: 0.05, patience: 90,
  shrinkage: 0.3, fte: 10, agentCost: 32000,
  resourcing: "resourced", supports: [], crossSkill: [],
  weeklyVolumes: null, seasonal: null,
  concurrency: 1, digitalSlaMinutes: 5, digitalSlaPct: 0.8, backlogLimit: 100, deflectsTo: null,
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

/* One-time crossSkill → supports migration (§14.3) applied to the working UI
   config so the editor speaks only `supports`. Uses the engine's own merge
   (which honours already-declared routes), then clears the legacy field.
   Also backfills resourcing, the strategies array and globalStartingHC for any
   config loaded from an older saved run. Idempotent. */
export function migrateConfig(config) {
  const map = effectiveSupports(config);
  const queues = config.queues.map((q) => ({
    ...q,
    resourcing: q.resourcing || "resourced",
    supports: (map[q.id] || []).map((s) => ({ queueId: s.queueId, priority: s.priority, maxSharePct: s.maxSharePct == null ? 100 : s.maxSharePct })),
    crossSkill: [],
  }));
  const out = { ...config, queues };
  if (!Array.isArray(out.strategies) || !out.strategies.length) {
    out.strategies = [
      { id: "S1", name: "Meet requirement", baseType: "meet", builtin: true },
      { id: "S2", name: "Buffer above", baseType: "buffer", builtin: true },
      { id: "S3", name: "Forward backfill", baseType: "backfill", builtin: true },
      { id: "S4", name: "Manual plan", baseType: "manual", builtin: true },
    ];
  }
  if (out.engine.globalStartingHC === undefined) out.engine = { ...out.engine, globalStartingHC: null };
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
    setConfig((c) => ({ ...c, queues: [...c.queues, blankQueue(c.queues.length + 1)] }));
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

  return useMemo(() => ({
    patch, patchQueue, addQueue, duplicateQueue, deleteQueue,
    addHire, patchHire, deleteHire,
    addServiceTeam, patchServiceTeam, deleteServiceTeam,
    addScenario, patchScenario, deleteScenario,
    addView, renameView, toggleViewScenario, deleteView,
    setResourcing, addSupport, patchSupport, deleteSupport,
    addStrategy, duplicateStrategy, deleteStrategy, patchStrategy,
    addSegment, patchSegment, deleteSegment, saveScheduleAsStrategy,
  }), [patch, patchQueue, addQueue, duplicateQueue, deleteQueue, addHire, patchHire, deleteHire, addServiceTeam, patchServiceTeam, deleteServiceTeam, addScenario, patchScenario, deleteScenario, addView, renameView, toggleViewScenario, deleteView, setResourcing, addSupport, patchSupport, deleteSupport, addStrategy, duplicateStrategy, deleteStrategy, patchStrategy, addSegment, patchSegment, deleteSegment, saveScheduleAsStrategy]);
}
