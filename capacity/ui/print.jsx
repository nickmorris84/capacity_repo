import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { flushSync } from "react-dom";

/* Per-tab print (SPEC §14.8). The Report tab is gone; instead every tab is
   printable via the context-bar action. Charts on screen size themselves to
   their container, which collapses in print — so on `beforeprint` we flip a
   `printing` flag synchronously (flushSync guarantees the DOM commits before the
   browser snapshots the page) and charts re-render at a fixed pixel width; on
   `afterprint` we flip it back. The per-tab print stylesheet (in style.js) hides
   the chrome and keeps sections from breaking across pages. */
const PrintCtx = createContext({ printing: false, printWidth: 660 });
export const usePrinting = () => useContext(PrintCtx);

export function PrintProvider({ children, printWidth = 660 }) {
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.addEventListener) return;
    const on = () => { try { flushSync(() => setPrinting(true)); } catch (e) { setPrinting(true); } };
    const off = () => { try { flushSync(() => setPrinting(false)); } catch (e) { setPrinting(false); } };
    window.addEventListener("beforeprint", on);
    window.addEventListener("afterprint", off);
    // Safari/older paths fire matchMedia change instead of before/afterprint.
    let mq;
    if (window.matchMedia) {
      mq = window.matchMedia("print");
      const onMq = (e) => (e.matches ? on() : off());
      if (mq.addEventListener) mq.addEventListener("change", onMq);
      else if (mq.addListener) mq.addListener(onMq);
      mq._onMq = onMq;
    }
    return () => {
      window.removeEventListener("beforeprint", on);
      window.removeEventListener("afterprint", off);
      if (mq) { if (mq.removeEventListener) mq.removeEventListener("change", mq._onMq); else if (mq.removeListener) mq.removeListener(mq._onMq); }
    };
  }, []);
  return <PrintCtx.Provider value={{ printing, printWidth }}>{children}</PrintCtx.Provider>;
}

// Fires the browser print dialog for the current tab.
export function usePrintPage() {
  return useCallback(() => { if (typeof window !== "undefined" && window.print) window.print(); }, []);
}

export function PrintButton({ label = "Print / PDF this page", className = "btn sm", testid = "print-page" }) {
  const print = usePrintPage();
  return <button type="button" className={className} data-testid={testid} onClick={print}>{label}</button>;
}
