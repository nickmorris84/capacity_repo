/* App shell (F1 — the swap). One shell, ONE model: the DOMAIN model
 * (DOMAIN-MODEL v1.2) is the single source of truth, restored from the v3 key
 * or migrated from a v2.4 save / the packaged default on first load. Setup is
 * the six-tab surface; Levers and Results consume the same model through the
 * bridge (compute.toEngineCfg); Home launches it. Template v3 (five sheets)
 * wires Download/Upload. The classic Setup remains only as a component for
 * its own gate — the app no longer routes to it.
 */
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import SetupV3Page from "./SetupV3Page.jsx";
import LeversPage from "./LeversPage.jsx";
import ResultsPage from "./ResultsPage.jsx";
import HomePage from "./HomePage.jsx";
import { quickHeadline } from "./compute.js";
import { loadModel } from "./store.js";
import { saveDomainModel, loadDomainModel } from "../../model/store-domain.js";
import { migrateV2ToDomain } from "../../model/migrate-domain.js";
import { blankDomainModel, buildDomainImportReport } from "../../model/ops.js";

export default function App({ initialModel }) {
  // initialModel is the packaged v2 default; a stored v3 model wins, then a
  // stored v2.4 save migrates (store-domain does this), then the default.
  const [model, setModel] = useState(() => {
    try {
      const r = loadDomainModel();
      if (r) return r.model;
    } catch { /* fall through */ }
    try { return migrateV2ToDomain(loadModel() || initialModel); }
    catch { return migrateV2ToDomain(initialModel); }
  });
  const [tab, setTab] = useState("home");
  const [importReport, setImportReport] = useState(null);
  // The matrix cell selection (strategy × scenario) is shared: tap a cell in
  // Levers and Results reviews that mix. Null = each page falls back to bestCell.
  const [selected, setSelected] = useState(null);
  const nav = useCallback((t) => setTab(t), []);

  // "New simulation" starts a fresh, empty world (the Setup shell's empty
  // state with the progress strip), keeping the engine defaults so it still runs.
  const newSimulation = useCallback(() => {
    setModel((m) => blankDomainModel(m.engineConfig || initialModel.engineConfig));
    setSelected(null);
    setTab("setup");
  }, [initialModel]);

  // Autosave (debounced) whenever the model changes.
  const timer = useRef(null);
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => saveDomainModel(model), 300);
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
      id: "sim_full", name: ((model.brands[0] && model.brands[0].name) || "New simulation") + " — full estate",
      scope: "Whole ecosystem", updated: "just now", runs: 3,
      model, services: (model.requestTypes || []).length, headline,
    }];
  }, [model, tab]);

  const onDownloadTemplate = useCallback(async (m) => {
    const { downloadDomainTemplate } = await import("./template-domain-xlsx.js");
    await downloadDomainTemplate(m);
  }, []);
  const onUploadTemplate = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".xlsx,.xls";
    input.onchange = async () => {
      const file = input.files && input.files[0]; if (!file) return;
      try {
        const { importDomainWorkbook } = await import("./template-domain-xlsx.js");
        const buf = await file.arrayBuffer();
        const { model: imported } = await importDomainWorkbook(new Uint8Array(buf));
        // Preserve the engine config carry; the template covers the Setup sections.
        const merged = { ...imported, engineConfig: model.engineConfig };
        setModel(merged);
        setSelected(null);
        setImportReport({ ...buildDomainImportReport(merged), filename: file.name });
        setTab("setup");
      } catch (e) {
        setImportReport({ error: `Couldn’t read “${file.name}”. ${e.message}` });
        setTab("setup");
      }
    };
    input.click();
  }, [model]);

  return (
    <>
      {tab === "home" && <HomePage simulations={simulations} onOpen={() => setTab("setup")} onNew={newSimulation} onNav={nav} />}
      {tab === "setup" && <SetupV3Page model={model} onModelChange={setModel} onNav={nav} onDownloadTemplate={onDownloadTemplate} onUploadTemplate={onUploadTemplate} importReport={importReport} onDismissImport={() => setImportReport(null)} />}
      {tab === "levers" && <LeversPage model={model} onModelChange={setModel} onNav={nav} selected={selected} onSelectedChange={setSelected} />}
      {tab === "results" && <ResultsPage model={model} onNav={nav} selected={selected} onSelectedChange={setSelected} />}
    </>
  );
}
