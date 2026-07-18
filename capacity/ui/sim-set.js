import { useRef, useState, useEffect, useMemo } from "react";
import { simulate } from "../engine/engine.js";
import { viewIdsFor, STRATEGY_IDS } from "./views.js";

/* P3 multi-simulation engine — the budgeted heart of the strategy/view matrix.

   SPEC §0 caps precompute at 8 simulations per change and demands <1s end-to-end
   with a deferred/debounced recompute and a visible recalculating state. We keep
   exactly what the screen needs, no more:
     - the four strategies for the ACTIVE view  (comparison table + dashboard),
     - the active strategy across the OVERLAY views, only while comparing views.
   The active dashboard sim is always one of the four strategy sims, so it costs
   nothing extra. Worst case = 4 + 4 − 1 (shared active cell) = 7 ≤ 8.

   Every sim is memoised by a (configHash | strategy | viewId) key. Because the
   key carries the whole config hash, a parameter edit misses the cache (correct
   — it must re-simulate) while flipping the comparison dimension, adding an
   overlay view, or switching the active strategy reuses cached results and
   resolves instantly with no recalculating flicker. */

const now = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
const CACHE_MAX = 48;
const keyFor = (hash, strat, vid) => hash + "|" + strat + "|" + vid;

export function useStrategyViews(config, ctrl, delay = 160) {
  const { activeStrategy, activeViewId, dimension, overlayViewIds } = ctrl;
  const hash = useMemo(() => JSON.stringify(config), [config]);
  const cacheRef = useRef(new Map());

  const runInto = (missing) => {
    for (const m of missing) {
      cacheRef.current.set(m.k, simulate(config, { strategy: m.strat, viewIds: viewIdsFor(config, m.vid) }));
    }
    while (cacheRef.current.size > CACHE_MAX) {
      cacheRef.current.delete(cacheRef.current.keys().next().value);
    }
  };

  // The set of (strategy, view) sims this screen state requires — deduplicated,
  // and provably ≤ 8 entries.
  const needed = useMemo(() => {
    const set = new Map();
    for (const s of STRATEGY_IDS) set.set(keyFor(hash, s, activeViewId), { k: keyFor(hash, s, activeViewId), strat: s, vid: activeViewId });
    if (dimension === "views") {
      for (const vid of overlayViewIds) {
        const k = keyFor(hash, activeStrategy, vid);
        set.set(k, { k, strat: activeStrategy, vid });
      }
    }
    return [...set.values()];
  }, [hash, activeStrategy, activeViewId, dimension, overlayViewIds.join(",")]);

  const buildSnapshot = () => {
    const strategySims = {};
    for (const s of STRATEGY_IDS) strategySims[s] = cacheRef.current.get(keyFor(hash, s, activeViewId));
    const viewSims = {};
    if (dimension === "views") for (const vid of overlayViewIds) viewSims[vid] = cacheRef.current.get(keyFor(hash, activeStrategy, vid));
    return { strategySims, viewSims, activeSim: strategySims[activeStrategy], hash };
  };

  // First paint runs synchronously so the dashboard is never empty (matches the
  // P2 initial-sim contract). Only the initial needed set is computed here.
  const [snap, setSnap] = useState(() => {
    runInto(needed.filter((x) => !cacheRef.current.has(x.k)));
    return { ...buildSnapshot(), computeMs: 0, computeCount: 0 };
  });
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const missing = needed.filter((x) => !cacheRef.current.has(x.k));
    if (missing.length === 0) {
      // Everything cached — resolve immediately (instant strategy/view/dimension
      // switch), no debounce, no recalculating state.
      setPending(false);
      setSnap({ ...buildSnapshot(), computeMs: 0, computeCount: 0 });
      return;
    }
    // The dashboard sim is the active (strategy, view) cell. If it is already
    // cached — e.g. switching the active strategy while only overlay-view sims
    // are stale — update the snapshot now so the dashboard reacts instantly,
    // and let the missing overlay sims fill in on the debounce. If it is NOT
    // cached (a parameter edit invalidated the hash), keep the previous
    // snapshot visible so charts never read a half-built config (E4).
    const activeCached = cacheRef.current.has(keyFor(hash, activeStrategy, activeViewId));
    if (activeCached) setSnap({ ...buildSnapshot(), computeMs: 0, computeCount: 0 });

    setPending(true);
    const id = setTimeout(() => {
      const t0 = now();
      runInto(missing);
      const ms = now() - t0;
      setSnap({ ...buildSnapshot(), computeMs: ms, computeCount: missing.length });
      setPending(false);
    }, delay);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needed.map((x) => x.k).join("#")]);

  return { ...snap, pending };
}
