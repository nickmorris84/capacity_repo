import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { makeDefaultConfig } from "../engine/engine.js";
import { useStrategyViews } from "./sim-set.js";
import { useConfigOps } from "./config-ops.js";
import { INTRADAY_PRESETS, SEASONALITY_PRESETS } from "./presets.js";
import { STRATEGIES, viewName } from "./views.js";
import { makeStorageAdapter, KEYS } from "./storage.js";
import { makeSavedRun, indexEntry } from "./saved-runs.js";
import { PlanTab } from "./components/PlanTab.jsx";
import { IntradayTab } from "./components/IntradayTab.jsx";
import { StrategiesTab } from "./components/StrategiesTab.jsx";
import { DataTab } from "./components/DataTab.jsx";
import { SummaryTab } from "./components/SummaryTab.jsx";
import { ReportTab } from "./components/ReportTab.jsx";
import { RunsTab } from "./components/RunsTab.jsx";
import { NotesTab } from "./components/NotesTab.jsx";
import { FilesCard } from "./components/FilesCard.jsx";
import { QueuesEditor } from "./editors/QueuesEditor.jsx";
import { WorkforceEditor } from "./editors/WorkforceEditor.jsx";
import { MoneyEditor } from "./editors/MoneyEditor.jsx";
import { ScenariosEditor } from "./editors/ScenariosEditor.jsx";
import { SeasonalityEditor } from "./editors/SeasonalityEditor.jsx";

const TABS = [
  { id: "plan", label: "Plan" },
  { id: "intraday", label: "Intraday" },
  { id: "strategies", label: "Strategies" },
  { id: "data", label: "Data" },
  { id: "summary", label: "Summary" },
  { id: "report", label: "Report" },
  { id: "runs", label: "Runs" },
  { id: "notes", label: "Model notes" },
  { id: "queues", label: "Queues" },
  { id: "workforce", label: "Workforce" },
  { id: "money", label: "Money & engine" },
  { id: "scenarios", label: "Scenarios & views" },
  { id: "seasonality", label: "Seasonality" },
];

export default function App() {
  const [config, setConfig] = useState(() => makeDefaultConfig());
  const [tab, setTab] = useState("plan");
  const [intradayPresets, setIntradayPresets] = useState(INTRADAY_PRESETS);
  const [seasonalityPresets, setSeasonalityPresets] = useState(SEASONALITY_PRESETS);
  const ops = useConfigOps(setConfig);

  const [activeStrategy, setActiveStrategy] = useState(() => config.hiring.activeStrategy || "S1");
  const [activeViewId, setActiveViewId] = useState("v_por");
  const [comparison, setComparison] = useState({ dimension: "strategies", overlayViewIds: ["v_por", "v_none"] });

  // ---- persistence (SPEC §10) ----
  const storage = useMemo(() => makeStorageAdapter(), []);
  const [savedRuns, setSavedRuns] = useState([]);
  const [compareSel, setCompareSel] = useState([]); // lifted above tabs — never cleared by tab switches
  const hydrated = useRef(false);

  const loadRuns = useCallback(async () => {
    const index = (await storage.get(KEYS.index)) || [];
    const runs = [];
    for (const e of index) {
      const r = await storage.get(KEYS.run(e.slug));
      if (r) runs.push(r);
    }
    setSavedRuns(runs);
  }, [storage]);

  // Hydrate presets, views and saved runs once on mount.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [ip, sp, uv] = await Promise.all([storage.get(KEYS.intraday), storage.get(KEYS.seasonality), storage.get(KEYS.views)]);
      if (!alive) return;
      if (Array.isArray(ip) && ip.length) setIntradayPresets([...INTRADAY_PRESETS, ...ip]);
      if (Array.isArray(sp) && sp.length) setSeasonalityPresets([...SEASONALITY_PRESETS, ...sp]);
      if (Array.isArray(uv) && uv.length) setConfig((c) => ({ ...c, views: [...c.views, ...uv.filter((v) => !c.views.some((x) => x.id === v.id))] }));
      await loadRuns();
      hydrated.current = true;
    })();
    return () => { alive = false; };
  }, [storage, loadRuns]);

  // Persist preset libraries + user views (only the user-authored subset).
  useEffect(() => { if (hydrated.current) storage.set(KEYS.intraday, intradayPresets.filter((p) => !p.builtin)); }, [intradayPresets, storage]);
  useEffect(() => { if (hydrated.current) storage.set(KEYS.seasonality, seasonalityPresets.filter((p) => !p.builtin)); }, [seasonalityPresets, storage]);
  useEffect(() => { if (hydrated.current) storage.set(KEYS.views, config.views.filter((v) => !v.builtin)); }, [config.views, storage]);

  const viewIds = config.views.map((v) => v.id);
  const safeActiveView = viewIds.includes(activeViewId) ? activeViewId : "v_por";
  const safeOverlay = useMemo(() => comparison.overlayViewIds.filter((id) => viewIds.includes(id)), [comparison.overlayViewIds, viewIds.join(",")]);

  const simSet = useStrategyViews(config, {
    activeStrategy, activeViewId: safeActiveView, dimension: comparison.dimension, overlayViewIds: safeOverlay,
  });
  const { activeSim, pending } = simSet;

  // ---- saved-run actions ----
  const saveRun = useCallback(async (name) => {
    if (!activeSim) return;
    // E4: snapshot the config the simulation actually ran with (sim.config),
    // never the live config, which may be mid-edit during a pending recompute.
    const rec = makeSavedRun(name, activeSim.config, activeSim);
    await storage.set(KEYS.run(rec.slug), rec);
    const index = (await storage.get(KEYS.index)) || [];
    const nextIndex = [...index.filter((e) => e.slug !== rec.slug), indexEntry(rec)];
    await storage.set(KEYS.index, nextIndex);
    setSavedRuns((rs) => [...rs.filter((r) => r.slug !== rec.slug), rec]);
  }, [activeSim, storage]);

  const deleteRun = useCallback(async (r) => {
    await storage.del(KEYS.run(r.slug));
    const index = (await storage.get(KEYS.index)) || [];
    await storage.set(KEYS.index, index.filter((e) => e.slug !== r.slug));
    setSavedRuns((rs) => rs.filter((x) => x.slug !== r.slug));
    setCompareSel((sel) => sel.filter((s) => s !== r.slug));
  }, [storage]);

  const loadRunSettings = useCallback((r) => { setConfig(r.config); setTab("plan"); }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="mark">C</span>
          <span>Capacity Simulator</span>
          <small>call centre planning</small>
        </div>
        <span className="spacer" />
        <div className="topctrls">
          <label className="topctrl">
            <span>Strategy</span>
            <select value={activeStrategy} onChange={(e) => setActiveStrategy(e.target.value)} aria-label="Active strategy">
              {STRATEGIES.map((s) => <option key={s.id} value={s.id}>{s.id} · {s.name}</option>)}
            </select>
          </label>
          <label className="topctrl">
            <span>View</span>
            <select value={safeActiveView} onChange={(e) => setActiveViewId(e.target.value)} aria-label="Active scenario view">
              {config.views.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </label>
        </div>
        <span className={"recalc" + (pending ? "" : " idle")} role="status" aria-live="polite">
          <span className="dot" aria-hidden="true" />
          {pending ? "Recalculating…" : "Up to date"}
        </span>
      </header>

      <nav className="tabs" role="tablist" aria-label="Sections">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" id={"tab-" + t.id} aria-selected={tab === t.id} aria-controls={"panel-" + t.id} className="tab" onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </nav>

      <main className="main">
        {TABS.map((t) => (
          <div key={t.id} role="tabpanel" id={"panel-" + t.id} aria-labelledby={"tab-" + t.id} hidden={tab !== t.id}>
            {tab === t.id && (
              <TabBody
                id={t.id}
                simSet={simSet}
                activeSim={activeSim}
                config={config}
                ops={ops}
                activeStrategy={activeStrategy}
                activeViewId={safeActiveView}
                onActivateStrategy={setActiveStrategy}
                comparison={{ dimension: comparison.dimension, overlayViewIds: safeOverlay }}
                setComparison={setComparison}
                onSelectView={setActiveViewId}
                onImportConfig={setConfig}
                intradayPresets={intradayPresets}
                setIntradayPresets={setIntradayPresets}
                seasonalityPresets={seasonalityPresets}
                setSeasonalityPresets={setSeasonalityPresets}
                savedRuns={savedRuns}
                compareSel={compareSel}
                setCompareSel={setCompareSel}
                storage={storage}
                onSaveRun={saveRun}
                onDeleteRun={deleteRun}
                onLoadRunSettings={loadRunSettings}
                onRefreshRuns={loadRuns}
              />
            )}
          </div>
        ))}
      </main>
    </div>
  );
}

function TabBody(props) {
  const { id, simSet, activeSim, config, ops } = props;
  switch (id) {
    case "plan": return <PlanTab sim={activeSim} viewLabel={viewName(config, props.activeViewId)} />;
    case "intraday": return <IntradayTab sim={activeSim} />;
    case "strategies": return (
      <StrategiesTab simSet={simSet} config={config} activeStrategy={props.activeStrategy} activeViewId={props.activeViewId} onActivateStrategy={props.onActivateStrategy} comparison={props.comparison} setComparison={props.setComparison} />
    );
    case "data": return <DataTab sim={activeSim} config={config} activeViewId={props.activeViewId} views={config.views} onSelectView={props.onSelectView} />;
    case "summary": return <SummaryTab sim={activeSim} strategySims={simSet.strategySims} config={config} activeStrategy={props.activeStrategy} activeViewId={props.activeViewId} />;
    case "report": return (
      <>
        <ReportTab sim={activeSim} strategySims={simSet.strategySims} config={config} activeStrategy={props.activeStrategy} activeViewId={props.activeViewId} />
        <div style={{ marginTop: 16 }}>
          <FilesCard sim={activeSim} strategySims={simSet.strategySims} config={config} activeStrategy={props.activeStrategy} activeViewId={props.activeViewId} onImportConfig={props.onImportConfig} />
        </div>
      </>
    );
    case "runs": return (
      <RunsTab
        runs={props.savedRuns} storageMode={props.storage.mode} storageNotice={props.storage.notice}
        compareSel={props.compareSel} setCompareSel={props.setCompareSel} config={config}
        onSave={props.onSaveRun} onDelete={props.onDeleteRun} onLoadSettings={props.onLoadRunSettings} onRefresh={props.onRefreshRuns}
      />
    );
    case "notes": return <NotesTab />;
    case "queues": return <QueuesEditor config={config} ops={ops} intradayPresets={props.intradayPresets} setIntradayPresets={props.setIntradayPresets} />;
    case "workforce": return <WorkforceEditor config={config} ops={ops} />;
    case "money": return <MoneyEditor config={config} ops={ops} />;
    case "scenarios": return <ScenariosEditor config={config} ops={ops} />;
    case "seasonality": return <SeasonalityEditor config={config} ops={ops} seasonalityPresets={props.seasonalityPresets} setSeasonalityPresets={props.setSeasonalityPresets} />;
    default: return null;
  }
}
