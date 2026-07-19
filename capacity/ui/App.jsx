import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { makeDefaultConfig } from "../engine/engine.js";
import { useStrategySims } from "./sim-set.js";
import { useConfigOps, migrateConfig } from "./config-ops.js";
import { INTRADAY_PRESETS, SEASONALITY_PRESETS } from "./presets.js";
import { viewName, strategyList } from "./views.js";
import { makeStorageAdapter, KEYS } from "./storage.js";
import { makeSavedRun, indexEntry } from "./saved-runs.js";
import { PrintProvider } from "./print.jsx";
import { ContextBar } from "./components/ContextBar.jsx";
import { SummaryTab } from "./components/SummaryTab.jsx";
import { StrategiesTab } from "./components/StrategiesTab.jsx";
import { PlanTab } from "./components/PlanTab.jsx";
import { DataTab } from "./components/DataTab.jsx";
import { IntradayTab } from "./components/IntradayTab.jsx";
import { SnapshotsTab } from "./components/SnapshotsTab.jsx";
import { QueuesEditor } from "./editors/QueuesEditor.jsx";
import { ScenariosEditor } from "./editors/ScenariosEditor.jsx";
import { SeasonalityEditor } from "./editors/SeasonalityEditor.jsx";
import { SettingsEditor } from "./editors/SettingsEditor.jsx";

// §14: exact tab order.
const TABS = [
  { id: "summary", label: "Summary" },
  { id: "strategies", label: "Strategies" },
  { id: "plan", label: "Plan" },
  { id: "data", label: "Data" },
  { id: "intraday", label: "Intraday" },
  { id: "queues", label: "Queues" },
  { id: "scenarios", label: "Scenarios" },
  { id: "seasonality", label: "Seasonality" },
  { id: "snapshots", label: "Snapshots" },
  { id: "settings", label: "Settings" },
];

export default function App() {
  const [config, setConfig] = useState(() => migrateConfig(makeDefaultConfig()));
  const [tab, setTab] = useState("summary");
  const [intradayPresets, setIntradayPresets] = useState(INTRADAY_PRESETS);
  const [seasonalityPresets, setSeasonalityPresets] = useState(SEASONALITY_PRESETS);
  const ops = useConfigOps(setConfig);

  const [activeStrategyId, setActiveStrategyId] = useState("S1");
  const [activeViewId, setActiveViewId] = useState("v_por");
  const [loadedSnapshotName, setLoadedSnapshotName] = useState(null);

  // Guard active selections against deletions.
  const stratIdsAll = strategyList(config).map((s) => s.id);
  const safeStrategy = stratIdsAll.includes(activeStrategyId) ? activeStrategyId : (stratIdsAll[0] || "S1");
  const viewIds = config.views.map((v) => v.id);
  const safeView = viewIds.includes(activeViewId) ? activeViewId : "v_por";

  // ---- persistence ----
  const storage = useMemo(() => makeStorageAdapter(), []);
  const [snapshots, setSnapshots] = useState([]);
  const [compareSel, setCompareSel] = useState([]);
  const hydrated = useRef(false);

  const loadSnapshots = useCallback(async () => {
    const index = (await storage.get(KEYS.index)) || [];
    const runs = [];
    for (const e of index) { const r = await storage.get(KEYS.run(e.slug)); if (r) runs.push(r); }
    setSnapshots(runs);
  }, [storage]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [ip, sp, uv] = await Promise.all([storage.get(KEYS.intraday), storage.get(KEYS.seasonality), storage.get(KEYS.views)]);
      if (!alive) return;
      if (Array.isArray(ip) && ip.length) setIntradayPresets([...INTRADAY_PRESETS, ...ip]);
      if (Array.isArray(sp) && sp.length) setSeasonalityPresets([...SEASONALITY_PRESETS, ...sp]);
      if (Array.isArray(uv) && uv.length) setConfig((c) => ({ ...c, views: [...c.views, ...uv.filter((v) => !c.views.some((x) => x.id === v.id))] }));
      await loadSnapshots();
      hydrated.current = true;
    })();
    return () => { alive = false; };
  }, [storage, loadSnapshots]);

  useEffect(() => { if (hydrated.current) storage.set(KEYS.intraday, intradayPresets.filter((p) => !p.builtin)); }, [intradayPresets, storage]);
  useEffect(() => { if (hydrated.current) storage.set(KEYS.seasonality, seasonalityPresets.filter((p) => !p.builtin)); }, [seasonalityPresets, storage]);
  useEffect(() => { if (hydrated.current) storage.set(KEYS.views, config.views.filter((v) => !v.builtin)); }, [config.views, storage]);

  const simSet = useStrategySims(config, safeStrategy, safeView);
  const { activeSim, pending } = simSet;

  // ---- snapshot actions ----
  const saveSnapshot = useCallback(async (name) => {
    if (!activeSim) return;
    const rec = makeSavedRun(name, activeSim.config, activeSim);
    await storage.set(KEYS.run(rec.slug), rec);
    const index = (await storage.get(KEYS.index)) || [];
    await storage.set(KEYS.index, [...index.filter((e) => e.slug !== rec.slug), indexEntry(rec)]);
    setSnapshots((rs) => [...rs.filter((r) => r.slug !== rec.slug), rec]);
    setLoadedSnapshotName(null);
  }, [activeSim, storage]);

  const deleteSnapshot = useCallback(async (r) => {
    await storage.del(KEYS.run(r.slug));
    const index = (await storage.get(KEYS.index)) || [];
    await storage.set(KEYS.index, index.filter((e) => e.slug !== r.slug));
    setSnapshots((rs) => rs.filter((x) => x.slug !== r.slug));
    setCompareSel((sel) => sel.filter((s) => s !== r.slug));
  }, [storage]);

  const loadSnapshotSettings = useCallback((r) => { setConfig(migrateConfig(r.config)); setLoadedSnapshotName(r.name); setTab("plan"); }, []);
  const importConfig = useCallback((c) => { setConfig(migrateConfig(c)); setLoadedSnapshotName(null); }, []);

  const tabProps = {
    simSet, activeSim, sims: simSet.sims, stratIds: simSet.stratIds, config, ops,
    activeStrategy: safeStrategy, activeViewId: safeView, onSetActive: setActiveStrategyId,
    onSelectView: setActiveViewId, onImportConfig: importConfig,
    intradayPresets, setIntradayPresets, seasonalityPresets, setSeasonalityPresets,
    snapshots, compareSel, setCompareSel, storage,
    onSaveSnapshot: saveSnapshot, onDeleteSnapshot: deleteSnapshot, onLoadSnapshotSettings: loadSnapshotSettings, onRefreshSnapshots: loadSnapshots,
  };

  return (
    <PrintProvider>
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <span className="mark">C</span>
            <span>Capacity Simulator</span>
            <small>call centre planning</small>
          </div>
          <span className="spacer" />
        </header>

        <nav className="tabs" role="tablist" aria-label="Sections">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" id={"tab-" + t.id} aria-selected={tab === t.id} aria-controls={"panel-" + t.id} className="tab" onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </nav>

        <ContextBar
          config={config} activeStrategyId={safeStrategy} onSetActiveStrategy={setActiveStrategyId}
          activeViewId={safeView} onSetActiveView={setActiveViewId} ops={ops}
          loadedSnapshotName={loadedSnapshotName} pending={pending}
        />

        <main className="main">
          {TABS.map((t) => (
            <div key={t.id} role="tabpanel" id={"panel-" + t.id} aria-labelledby={"tab-" + t.id} hidden={tab !== t.id}>
              {tab === t.id && <TabBody id={t.id} {...tabProps} />}
            </div>
          ))}
        </main>
      </div>
    </PrintProvider>
  );
}

function TabBody(props) {
  const { id, simSet, activeSim, config, ops } = props;
  switch (id) {
    case "summary": return <SummaryTab sim={activeSim} sims={simSet.sims} stratIds={simSet.stratIds} config={config} activeStrategy={props.activeStrategy} activeViewId={props.activeViewId} onSetActive={props.onSetActive} />;
    case "strategies": return <StrategiesTab simSet={simSet} config={config} activeStrategy={props.activeStrategy} ops={ops} />;
    case "plan": return <PlanTab sim={activeSim} viewLabel={viewName(config, props.activeViewId)} />;
    case "data": return <DataTab sim={activeSim} config={config} activeViewId={props.activeViewId} views={config.views} onSelectView={props.onSelectView} />;
    case "intraday": return <IntradayTab sim={activeSim} />;
    case "queues": return <QueuesEditor config={config} ops={ops} intradayPresets={props.intradayPresets} setIntradayPresets={props.setIntradayPresets} />;
    case "scenarios": return <ScenariosEditor config={config} ops={ops} />;
    case "seasonality": return <SeasonalityEditor config={config} ops={ops} seasonalityPresets={props.seasonalityPresets} setSeasonalityPresets={props.setSeasonalityPresets} />;
    case "snapshots": return (
      <SnapshotsTab
        snapshots={props.snapshots} storageMode={props.storage.mode} storageNotice={props.storage.notice}
        compareSel={props.compareSel} setCompareSel={props.setCompareSel} config={config}
        sim={activeSim} sims={simSet.sims} activeStrategy={props.activeStrategy} activeViewId={props.activeViewId} onImportConfig={props.onImportConfig}
        onSave={props.onSaveSnapshot} onDelete={props.onDeleteSnapshot} onLoadSettings={props.onLoadSnapshotSettings} onRefresh={props.onRefreshSnapshots}
      />
    );
    case "settings": return <SettingsEditor config={config} ops={ops} sim={activeSim} sims={simSet.sims} activeStrategy={props.activeStrategy} activeViewId={props.activeViewId} onImportConfig={props.onImportConfig} />;
    default: return null;
  }
}
