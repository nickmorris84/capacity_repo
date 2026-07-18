import { useMemo, useCallback } from "react";
import { setPath } from "./format.js";
import { uid } from "../engine/engine.js";

const blankQueue = (n) => ({
  id: "q_" + uid(), name: "New queue " + n, type: "voice",
  dailyVolume: 500, aht: 300, profile: new Array(24).fill(1),
  asaTarget: 30, maxAbandon: 0.05, patience: 90,
  shrinkage: 0.3, fte: 10, agentCost: 32000, crossSkill: [],
  weeklyVolumes: null, seasonal: null,
  concurrency: 1, digitalSlaMinutes: 5, digitalSlaPct: 0.8, backlogLimit: 100, deflectsTo: null,
  wf: { attrition: 0.04, attritionGrowth: 0, reqToStart: 6, trainingWeeks: 4, learningCurve: [0.6, 0.75, 0.9, 1.0], hires: [] },
  burn: { occThreshold: 0.85, sensitivity: 1.5, recovery: 8, maxAttritionMult: 2, absenceUplift: 0.05 },
});

const SCENARIO_DEFAULTS = {
  growth: { name: "Growth", p: { rate: 0.02 } },
  launch: { name: "Product launch", p: { ramp: 3, peak: 0.4, decay: 6 } },
  p1: { name: "P1 incident", p: { spike: 1.5, days: 2 } },
  forecastError: { name: "Forecast error", p: { error: 0.15 } },
  attritionShock: { name: "Attrition shock", p: { add: 0.03 } },
  hiringFreeze: { name: "Hiring freeze", p: { weeks: 12 } },
  reducedTraining: { name: "Reduced training", p: { cutWeeks: 2, startProficiency: 0.4, stretch: 1.75, ahtPenalty: 0.12, repeatUplift: 0.08 } },
};

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
    setConfig((c) => ({ ...c, scenarios: c.scenarios.filter((s) => s.id !== sid) }));
  }, [setConfig]);

  return useMemo(() => ({
    patch, patchQueue, addQueue, duplicateQueue, deleteQueue,
    addHire, patchHire, deleteHire,
    addServiceTeam, patchServiceTeam, deleteServiceTeam,
    addScenario, patchScenario, deleteScenario,
  }), [patch, patchQueue, addQueue, duplicateQueue, deleteQueue, addHire, patchHire, deleteHire, addServiceTeam, patchServiceTeam, deleteServiceTeam, addScenario, patchScenario, deleteScenario]);
}
