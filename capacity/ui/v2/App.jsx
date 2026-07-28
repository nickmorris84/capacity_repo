/* v2.4 rebuild — app shell (integration). One shell, one model, four surfaces.
 * Owns the single v2 model, threads it to Home · Setup · Levers · Results, and
 * autosaves it. Home is the launcher (Open → the tabbed workspace); the other
 * three share the model — a Setup edit re-derives the Ecosystem and re-scores the
 * Levers/Results matrix, live. Setup's Download/Upload wire the template.
 */
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import SetupPage from "./SetupPage.jsx";
import LeversPage from "./LeversPage.jsx";
import ResultsPage from "./ResultsPage.jsx";
import HomePage from "./HomePage.jsx";
import { quickHeadline } from "./compute.js";
import { saveModel, loadModel } from "./store.js";

export default function App({ initialModel }) {
  const [model, setModel] = useState(() => loadModel() || initialModel);
  const [tab, setTab] = useState("home");
  const nav = useCallback((t) => setTab(t), []);

  // Autosave (debounced) whenever the model changes.
  const timer = useRef(null);
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => saveModel(model), 300);
    return () => clearTimeout(timer.current);
  }, [model]);

  // The Home card headline is a full engine run — only compute it when Home is
  // showing (not on every Setup keystroke), reuse the last good one otherwise,
  // and never let an engine error white-screen the app.
  const lastHeadline = useRef(null);
  const simulations = useMemo(() => {
    let headline = lastHeadline.current;
    if (tab === "home" || !headline) {
      try { headline = quickHeadline(model); lastHeadline.current = headline; }
      catch { headline = headline || { horizon: 0, queues: (model.queues || []).length, allIn: 0, availFte: 0, worst: "amber", lost: 0 }; }
    }
    return [{
      id: "sim_full", name: (model.brands[0] && model.brands[0].name) + " — full estate",
      scope: "Whole ecosystem", updated: "just now", runs: 3,
      model, services: model.services.length, headline,
    }];
  }, [model, tab]);

  const onDownloadTemplate = useCallback(async (m) => {
    const { downloadTemplate } = await import("./template-xlsx.js");
    await downloadTemplate(m);
  }, []);
  const onUploadTemplate = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".xlsx,.xls";
    input.onchange = async () => {
      const file = input.files && input.files[0]; if (!file) return;
      const { importWorkbook } = await import("./template-xlsx.js");
      const buf = await file.arrayBuffer();
      const { model: imported } = await importWorkbook(new Uint8Array(buf));
      // Preserve the engine config carry; the template covers the Setup sections.
      setModel((m) => ({ ...imported, engineConfig: m.engineConfig }));
    };
    input.click();
  }, []);

  return (
    <>
      {tab === "home" && <HomePage simulations={simulations} onOpen={() => setTab("setup")} onNav={nav} />}
      {tab === "setup" && <SetupPage model={model} onModelChange={setModel} onNav={nav} onDownloadTemplate={onDownloadTemplate} onUploadTemplate={onUploadTemplate} />}
      {tab === "levers" && <LeversPage model={model} onModelChange={setModel} onNav={nav} />}
      {tab === "results" && <ResultsPage model={model} onNav={nav} />}
    </>
  );
}
