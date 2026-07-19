import { useRef, useState, useEffect, useMemo } from "react";
import { simulate } from "../engine/engine.js";
import { viewIdsFor, strategyList } from "./views.js";

/* Multi-simulation engine (Revision 1). The dashboard runs the ACTIVE strategy
   (which may be a schedule); the Strategies comparison runs every strategy in
   config for the ACTIVE view. So the needed set is {all strategy ids} × the
   active view — the active/dashboard sim is always one of them, at no extra
   cost. Capped at 8 sims/change (SPEC §0); if the config declares more than 8
   strategies the first 8 (built-ins first) are computed.

   Memoised by (configHash | strategyId | viewId): a parameter edit misses (must
   re-simulate) while switching the active strategy or view reuses the cache and
   resolves instantly. During a parameter recompute the previous snapshot stays
   visible so charts never read a half-built config (E4). */
const now = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
const CACHE_MAX = 64;
const BUDGET = 8;
const keyFor = (hash, sid, vid) => hash + "|" + sid + "|" + vid;

export function useStrategySims(config, activeStrategyId, activeViewId, delay = 160) {
  const hash = useMemo(() => JSON.stringify(config), [config]);
  const cacheRef = useRef(new Map());

  // Which strategies to simulate: all in config, deduped, active first, ≤ budget.
  const stratIds = useMemo(() => {
    const all = strategyList(config).map((s) => s.id);
    const ordered = [activeStrategyId, ...all.filter((id) => id !== activeStrategyId)].filter((v, i, a) => a.indexOf(v) === i);
    return ordered.slice(0, BUDGET);
  }, [hash, activeStrategyId]);

  const runInto = (missing) => {
    for (const m of missing) cacheRef.current.set(m.k, simulate(config, { strategy: m.sid, viewIds: viewIdsFor(config, activeViewId) }));
    while (cacheRef.current.size > CACHE_MAX) cacheRef.current.delete(cacheRef.current.keys().next().value);
  };

  const needed = useMemo(
    () => stratIds.map((sid) => ({ k: keyFor(hash, sid, activeViewId), sid })),
    [hash, activeViewId, stratIds.join(",")]
  );

  const buildSnapshot = () => {
    const sims = {};
    for (const sid of stratIds) sims[sid] = cacheRef.current.get(keyFor(hash, sid, activeViewId));
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
    // Dashboard sim cached (a strategy/view switch, not an edit) → update now.
    if (cacheRef.current.has(keyFor(hash, activeStrategyId, activeViewId))) {
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
  }, [hash, activeStrategyId, activeViewId, stratIds.join(",")]);

  return { ...snap, pending };
}
