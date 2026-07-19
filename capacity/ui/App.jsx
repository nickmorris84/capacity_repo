import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { makeDefaultConfig } from "../engine/engine.js";
import { useStrategySims, runMatrix, simHash } from "./sim-set.js";
import { useConfigOps, migrateConfig } from "./config-ops.js";
import { INTRADAY_PRESETS, SEASONALITY_PRESETS } from "./presets.js";
import { groupName, groupList, strategyList } from "./views.js";
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
import { SettingsEditor } from "./editors/SettingsEditor.jsx";

// §20 exact tab order (Seasonality dissolved into Settings).
const TABS = [
  { id: "summary", label: "Summary" },
  { id: "strategies", label: "Strategies" },
  { id: "plan", label: "Plan" },
  { id: "data", label: "Data" },
  { id: "intraday", label: "Intraday" },
  { id: "queues", label: "Queues" },
  { id: "scenarios", label: "Scenarios" },
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
  const [activeGroupId, setActiveGroupId] = useState("g_por");

  // Guard active selections against deletions.
  const stratIdsAll = strategyList(config).map((s) => s.id);
  const safeStrategy = stratIdsAll.includes(activeStrategyId) ? activeStrategyId : (stratIdsAll[0] || "S1");
  const groupIds = groupList(config).map((g) => g.id);
  const safeGroup = groupIds.includes(activeGroupId) ? activeGroupId : (groupIds[0] || "g_por");

  // ---- persistence ----
  const storage = useMemo(() => makeStorageAdapter(), []);
  const [snapshots, setSnapshots] = useState([]);
  const [compareSel, setCompareSel] = useState([]);
  const [viewingSlug, setViewingSlug] = useState(null); // §20 snapshot read-only mode
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
      const [ip, sp] = await Promise.all([storage.get(KEYS.intraday), storage.get(KEYS.seasonality)]);
      if (!alive) return;
      if (Array.isArray(ip) && ip.length) setIntradayPresets([...INTRADAY_PRESETS, ...ip]);
      if (Array.isArray(sp) && sp.length) setSeasonalityPresets([...SEASONALITY_PRESETS, ...sp]);
      await loadSnapshots();
      hydrated.current = true;
    })();
    return () => { alive = false; };
  }, [storage, loadSnapshots]);

  useEffect(() => { if (hydrated.current) storage.set(KEYS.intraday, intradayPresets.filter((p) => !p.builtin)); }, [intradayPresets, storage]);
  useEffect(() => { if (hydrated.current) storage.set(KEYS.seasonality, seasonalityPresets.filter((p) => !p.builtin)); }, [seasonalityPresets, storage]);

  // §20 snapshot read-only: when a snapshot is selected, every tab renders its
  // frozen config (deterministically re-simulated) and editors are disabled.
  const viewing = viewingSlug ? snapshots.find((r) => r.slug === viewingSlug) : null;
  const effectiveConfig = viewing ? migrateConfig(viewing.config) : config;
  const readOnly = !!viewing;

  const simSet = useStrategySims(effectiveConfig, safeStrategy, safeGroup);
  const { activeSim, pending } = simSet;

  // §19 decision matrix — computed on demand, cached, stale on any config edit.
  const [matrix, setMatrix] = useState(null);
  const liveHash = useMemo(() => simHash(effectiveConfig), [effectiveConfig]);
  const matrixStale = !matrix || matrix.hash !== liveHash;
  const onRunMatrix = useCallback(() => setMatrix(runMatrix(effectiveConfig)), [effectiveConfig]);
  const onSelectCell = useCallback((gid, sid) => { setActiveGroupId(gid); setActiveStrategyId(sid); }, []);

  // ---- snapshot actions ----
  const saveSnapshot = useCallback(async (name) => {
    if (!activeSim) return;
    const rec = makeSavedRun(name, activeSim.config, activeSim);
    await storage.set(KEYS.run(rec.slug), rec);
    const index = (await storage.get(KEYS.index)) || [];
    await storage.set(KEYS.index, [...index.filter((e) => e.slug !== rec.slug), indexEntry(rec)]);
    setSnapshots((rs) => [...rs.filter((r) => r.slug !== rec.slug), rec]);
  }, [activeSim, storage]);

  const deleteSnapshot = useCallback(async (r) => {
    await storage.del(KEYS.run(r.slug));
    const index = (await storage.get(KEYS.index)) || [];
    await storage.set(KEYS.index, index.filter((e) => e.slug !== r.slug));
    setSnapshots((rs) => rs.filter((x) => x.slug !== r.slug));
    setCompareSel((sel) => sel.filter((s) => s !== r.slug));
    setViewingSlug((v) => (v === r.slug ? null : v));
  }, [storage]);

  const loadSnapshotSettings = useCallback((r) => { setConfig(migrateConfig(r.config)); setViewingSlug(null); setTab("plan"); }, []);
  const importConfig = useCallback((c) => { setConfig(migrateConfig(c)); setViewingSlug(null); }, []);

  const tabProps = {
    simSet, activeSim, sims: simSet.sims, stratIds: simSet.stratIds, config: effectiveConfig, ops,
    activeStrategy: safeStrategy, activeGroupId: safeGroup, onSetActive: setActiveStrategyId,
    onSelectGroup: setActiveGroupId, onImportConfig: importConfig,
    matrix, matrixStale, onRunMatrix, onSelectCell,
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
          config={effectiveConfig} activeStrategyId={safeStrategy} onSetActiveStrategy={setActiveStrategyId}
          activeGroupId={safeGroup} onSetActiveGroup={setActiveGroupId} ops={ops}
          snapshots={snapshots} viewingSlug={viewingSlug} onSelectSnapshot={setViewingSlug} pending={pending}
        />

        {readOnly && (
          <div className="ro-banner" role="status" data-testid="readonly-banner">
            Viewing snapshot <strong>{viewing.name}</strong> — read-only. Editors are disabled.
            <button type="button" className="btn sm" style={{ marginLeft: 12 }} onClick={() => setViewingSlug(null)} data-testid="exit-snapshot">Return to live model</button>
          </div>
        )}

        <main className="main">
          <fieldset className="ro-fieldset" disabled={readOnly} style={{ border: 0, margin: 0, padding: 0, minInlineSize: "auto" }}>
            {TABS.map((t) => (
              <div key={t.id} role="tabpanel" id={"panel-" + t.id} aria-labelledby={"tab-" + t.id} hidden={tab !== t.id}>
                {tab === t.id && <TabBody id={t.id} {...tabProps} />}
              </div>
            ))}
          </fieldset>
        </main>
      </div>
    </PrintProvider>
  );
}

function TabBody(props) {
  const { id, simSet, activeSim, config, ops } = props;
  switch (id) {
    case "summary": return <SummaryTab sim={activeSim} sims={simSet.sims} stratIds={simSet.stratIds} config={config} activeStrategy={props.activeStrategy} activeGroupId={props.activeGroupId} onSetActive={props.onSetActive} matrix={props.matrix} matrixStale={props.matrixStale} onRunMatrix={props.onRunMatrix} onSelectCell={props.onSelectCell} />;
    case "strategies": return <StrategiesTab simSet={simSet} config={config} activeStrategy={props.activeStrategy} ops={ops} />;
    case "plan": return <PlanTab sim={activeSim} config={config} viewLabel={groupName(config, props.activeGroupId)} />;
    case "data": return <DataTab sim={activeSim} config={config} activeGroupId={props.activeGroupId} onSelectGroup={props.onSelectGroup} />;
    case "intraday": return <IntradayTab sim={activeSim} />;
    case "queues": return <QueuesEditor config={config} ops={ops} sim={activeSim} intradayPresets={props.intradayPresets} setIntradayPresets={props.setIntradayPresets} seasonalityPresets={props.seasonalityPresets} setSeasonalityPresets={props.setSeasonalityPresets} />;
    case "scenarios": return <ScenariosEditor config={config} ops={ops} />;
    case "snapshots": return (
      <SnapshotsTab
        snapshots={props.snapshots} storageMode={props.storage.mode} storageNotice={props.storage.notice}
        compareSel={props.compareSel} setCompareSel={props.setCompareSel} config={config}
        sim={activeSim} sims={simSet.sims} activeStrategy={props.activeStrategy} activeViewId={props.activeGroupId} onImportConfig={props.onImportConfig}
        onSave={props.onSaveSnapshot} onDelete={props.onDeleteSnapshot} onLoadSettings={props.onLoadSnapshotSettings} onRefresh={props.onRefreshSnapshots}
      />
    );
    case "settings": return <SettingsEditor config={config} ops={ops} sim={activeSim} sims={simSet.sims} activeStrategy={props.activeStrategy} activeViewId={props.activeGroupId} onImportConfig={props.onImportConfig} seasonalityPresets={props.seasonalityPresets} setSeasonalityPresets={props.setSeasonalityPresets} />;
    default: return null;
  }
}
