import { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import { simulate } from "../engine/engine.js";

/* E4 — deferred-state safety.
   The live `config` is edited freely; the simulation runs on a debounce and the
   result carries the exact config it ran with (`sim.config`). Every display
   component reads `sim`, never the live config, so adding/deleting a queue can
   never crash a chart mid-defer. While a recompute is queued we expose
   `pending` so the UI can show a "recalculating…" indicator. */
export function useDeferredSim(config, opts = {}, delay = 150) {
  const optKey = JSON.stringify(opts);
  const [sim, setSim] = useState(() => simulate(config, opts));
  const [pending, setPending] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setPending(true);
    const id = setTimeout(() => {
      setSim(simulate(config, JSON.parse(optKey)));
      setPending(false);
    }, delay);
    return () => clearTimeout(id);
  }, [config, optKey, delay]);

  return { sim, pending };
}

// Measure a container's width for explicit-size charts (recharts'
// ResponsiveContainer collapses to 0 in JSDOM and in print). Falls back to a
// sensible fixed width when measurement is unavailable.
export function useMeasuredWidth(fallback = 640) {
  const ref = useRef(null);
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const bw = el.clientWidth || (el.getBoundingClientRect && el.getBoundingClientRect().width) || 0;
      if (bw && bw > 0) setW(Math.round(bw));
    };
    measure();
    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    }
    window.addEventListener("resize", measure);
    return () => { if (ro) ro.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  return [ref, w];
}

// Tap-to-reveal disclosure state, with outside-click / Escape dismissal.
// Deliberately not a `title=` tooltip: those are hover-only and unreachable on
// touch and by keyboard.
export function useDisclosure() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const toggle = useCallback(() => setOpen((o) => !o), []);
  return { open, setOpen, toggle, ref };
}
