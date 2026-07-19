import { useRef, useState, useEffect, useMemo } from "react";
import { simulate, applyGroupScope } from "../engine/engine.js";
import { groupScenarioIds, strategyList } from "./views.js";

/* Multi-simulation engine (Revision 2). The dashboard runs the ACTIVE strategy
   (which may be a schedule) under the ACTIVE scenario group; the Strategies
   comparison runs every strategy in config for the active group. So the needed
   set is {all strategy ids} × the active group — the active/dashboard sim is
   always one of them, at no extra cost. Capped at 8 sims/change (SPEC §0).

   Memoised by (configHash | strategyId | groupId): a parameter edit misses
   (must re-simulate) while switching the active strategy or group reuses the
   cache and resolves instantly. During a parameter recompute the previous
   snapshot stays visible so charts never read a half-built config (E4). */
const now = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
const CACHE_MAX = 128;
const BUDGET = 8;
const keyFor = (hash, sid, gid) => hash + "|" + sid + "|" + gid;

/* Simulation-relevant config hash. Excludes settings.risk: the §20a risk
   thresholds only affect render-time scoring, never the engine, so editing one
   must NOT invalidate the sim cache or the matrix (the register re-scores from
   the new threshold while every simulated number is untouched). */
export function simHash(config) {
  // channelDefs (§24.5/§7 channel-template library) seed queues on attach but
  // never feed the engine directly, so they stay out of the hash.
  const { settings, channelDefs, ...rest } = config;
  let s = settings;
  // settings.risk (§20a thresholds) and settings.dataColours (§24.6 Data-tab
  // presentation) affect render-time only — never the engine — so exclude them
  // to keep threshold/colour edits from invalidating the sim cache or matrix.
  if (settings && (settings.risk || settings.dataColours)) { s = { ...settings }; delete s.risk; delete s.dataColours; }
  return JSON.stringify({ ...rest, settings: s });
}

export function useStrategySims(config, activeStrategyId, activeGroupId, delay = 160) {
  const hash = useMemo(() => simHash(config), [config]);
  const cacheRef = useRef(new Map());

  const stratIds = useMemo(() => {
    const all = strategyList(config).map((s) => s.id);
    const ordered = [activeStrategyId, ...all.filter((id) => id !== activeStrategyId)].filter((v, i, a) => a.indexOf(v) === i);
    return ordered.slice(0, BUDGET);
  }, [hash, activeStrategyId]);

  const runInto = (missing) => {
    // §24.8: group scope is inherited by the group's scenarios before simulating.
    const scoped = applyGroupScope(config, activeGroupId);
    for (const m of missing) cacheRef.current.set(m.k, simulate(scoped, { strategy: m.sid, viewIds: groupScenarioIds(config, activeGroupId) }));
    while (cacheRef.current.size > CACHE_MAX) cacheRef.current.delete(cacheRef.current.keys().next().value);
  };

  const needed = useMemo(
    () => stratIds.map((sid) => ({ k: keyFor(hash, sid, activeGroupId), sid })),
    [hash, activeGroupId, stratIds.join(",")]
  );

  const buildSnapshot = () => {
    const sims = {};
    for (const sid of stratIds) sims[sid] = cacheRef.current.get(keyFor(hash, sid, activeGroupId));
    return { sims, activeSim: sims[activeStrategyId], stratIds, hash };
  };

  const [snap, setSnap] = useState(() => {
    runInto(needed.filter((x) => !cacheRef.current.has(x.k)));
    return { ...buildSnapshot(), computeMs: 0, computeCount: 0 };
  });
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const missing = needed.filter((x) => !cacheRef.current.has(x.k));
    if (missing.length === 0) {
      setPending(false);
      setSnap({ ...buildSnapshot(), computeMs: 0, computeCount: 0 });
      return;
    }
    if (cacheRef.current.has(keyFor(hash, activeStrategyId, activeGroupId))) {
      setSnap({ ...buildSnapshot(), computeMs: 0, computeCount: 0 });
    }
    setPending(true);
    const id = setTimeout(() => {
      const t0 = now();
      runInto(missing);
      setSnap({ ...buildSnapshot(), computeMs: now() - t0, computeCount: missing.length });
      setPending(false);
    }, delay);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash, activeStrategyId, activeGroupId, stratIds.join(",")]);

  return { ...snap, pending };
}

/* §19 decision matrix — groups (rows) × strategies (columns), BOTH in config
   definition order. Computed on demand, never reordered by selection. Returns
   { hash, cells: { [gid]: { [sid]: {allIn, redWeeks, tipping, capInfeasible,
   status} } } }. Pure — the caller caches it and compares hashes for staleness. */
export function runMatrix(config) {
  const groups = config.groups || [];
  const strategies = strategyList(config);
  const cells = {};
  for (const g of groups) {
    const ids = groupScenarioIds(config, g.id);
    const scoped = applyGroupScope(config, g.id); // §24.8
    cells[g.id] = {};
    for (const s of strategies) {
      const sim = simulate(scoped, { strategy: s.id, viewIds: ids });
      let redWeeks = 0;
      for (const w of sim.weeks) if (config.queues.some((q) => w.queues[q.id].status === "red")) redWeeks++;
      const flags = sim.summary.flags;
      const status = flags.capInfeasible || flags.tippingPoint || redWeeks > 0 ? (redWeeks > sim.weeks.length * 0.1 || flags.tippingPoint ? "red" : "amber") : "green";
      cells[g.id][s.id] = { allIn: sim.summary.allIn, redWeeks, tipping: !!flags.tippingPoint, capInfeasible: !!flags.capInfeasible, status };
    }
  }
  return { hash: simHash(config), cells };
}
