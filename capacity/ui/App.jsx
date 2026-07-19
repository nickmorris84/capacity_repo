import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { makeDefaultConfig, makeBlankConfig } from "../engine/engine.js";
import { useStrategySims, runMatrix, simHash, bestCell } from "./sim-set.js";
import { useConfigOps, migrateConfig, resolvePresets } from "./config-ops.js";
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

  // §24.6: bake the CURRENT library values of any applied seasonality / arrival
  // pattern into the config the engine simulates, so editing a pattern in
  // Settings reflects in every queue that uses it. Editors keep effectiveConfig
  // (the references); simulation and display read the resolved config.
  const simConfig = useMemo(() => resolvePresets(effectiveConfig, seasonalityPresets, intradayPresets), [effectiveConfig, seasonalityPresets, intradayPresets]);

  const simSet = useStrategySims(simConfig, safeStrategy, safeGroup);
  const { activeSim, pending } = simSet;

  // §19 decision matrix — computed on demand, cached, stale on any config edit.
  // R3d-B: persisted with the selected pair; a reopen auto-selects the best cell
  // (when the cache matches) or restores the last pair.
  const [matrix, setMatrix] = useState(null);
  const [autoPicked, setAutoPicked] = useState(false);
  const liveHash = useMemo(() => simHash(simConfig), [simConfig]);
  const liveHashRef = useRef(liveHash); liveHashRef.current = liveHash;
  const matrixHydrated = useRef(false);
  const matrixStale = !matrix || matrix.hash !== liveHash;
  const onRunMatrix = useCallback(() => { setMatrix(runMatrix(simConfig)); setAutoPicked(false); }, [simConfig]);
  const onSelectCell = useCallback((gid, sid) => { setActiveGroupId(gid); setActiveStrategyId(sid); setAutoPicked(false); }, []);

  // R3d-B startup: on mount, read the persisted matrix + selected pair. If the
  // cached matrix hash matches the current config, auto-select the most
  // favourable cell (with a subtle note); otherwise restore the last selected
  // pair and leave the (stale/absent) matrix behind its existing banner. We
  // NEVER auto-run the matrix on open — only ever read a cache.
  useEffect(() => {
    let alive = true;
    (async () => {
      const ms = await storage.get(KEYS.matrix);
      if (!alive) return;
      if (ms) {
        if (ms.cells) setMatrix({ hash: ms.hash, cells: ms.cells });
        if (ms.cells && ms.hash === liveHashRef.current) {
          const pick = bestCell({ hash: ms.hash, cells: ms.cells });
          if (pick) { setActiveGroupId(pick.gid); setActiveStrategyId(pick.sid); setAutoPicked(true); }
        } else if (ms.selected && ms.selected.gid) {
          setActiveGroupId(ms.selected.gid); setActiveStrategyId(ms.selected.sid);
        }
      }
      matrixHydrated.current = true;
    })();
    return () => { alive = false; };
  }, [storage]);

  // Persist the matrix (hash + cells) and the selected pair whenever either
  // changes — after the initial hydration, so we never clobber a cache on open.
  useEffect(() => {
    if (!matrixHydrated.current) return;
    const payload = { selected: { gid: safeGroup, sid: safeStrategy } };
    if (matrix) { payload.hash = matrix.hash; payload.cells = matrix.cells; }
    storage.set(KEYS.matrix, payload);
  }, [matrix, safeGroup, safeStrategy, storage]);

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

  // §24.9 simulation lifecycle: duplicate the current config, reset to the
  // defaults, or start from a truly-blank world (no brands, no queues).
  const newSimulation = useCallback((kind) => {
    setViewingSlug(null);
    if (kind === "duplicate") setConfig((c) => migrateConfig(JSON.parse(JSON.stringify(c))));
    else if (kind === "blank") setConfig(migrateConfig(makeBlankConfig()));
    else setConfig(migrateConfig(makeDefaultConfig()));
    setTab("plan");
  }, []);
  const isBlank = effectiveConfig.brands.length === 0 && effectiveConfig.queues.length === 0;

  const tabProps = {
    simSet, activeSim, sims: simSet.sims, stratIds: simSet.stratIds, config: effectiveConfig, ops,
    activeStrategy: safeStrategy, activeGroupId: safeGroup, onSetActive: setActiveStrategyId,
    onSelectGroup: setActiveGroupId, onImportConfig: importConfig,
    matrix, matrixStale, onRunMatrix, onSelectCell, autoPicked,
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
          <div className="topctrl">
            <span>New simulation</span>
            <select value="" onChange={(e) => { if (e.target.value) newSimulation(e.target.value); }} data-testid="new-sim" aria-label="New simulation">
              <option value="">Choose…</option>
              <option value="duplicate">Duplicate current</option>
              <option value="defaults">Start from defaults</option>
              <option value="blank">Start blank</option>
            </select>
          </div>
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
          {isBlank && (
            <div className="empty-state" data-testid="blank-empty-state">
              <div className="es-mark">✦</div>
              <h2>Start from nothing</h2>
              <p>This simulation has no brands and no queues yet. Build it up from scratch: create a brand in Settings, then add your first queue.</p>
              <div className="btnbar" style={{ justifyContent: "center" }}>
                <button type="button" className="btn primary" onClick={() => setTab("settings")} data-testid="es-add-brand">Create a brand (Settings)</button>
                <button type="button" className="btn" onClick={() => setTab("queues")} data-testid="es-add-queue">Add a queue (Queues)</button>
                <button type="button" className="btn" onClick={() => newSimulation("defaults")}>Load the demo defaults</button>
              </div>
            </div>
          )}
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
    case "summary": return <SummaryTab sim={activeSim} sims={simSet.sims} stratIds={simSet.stratIds} config={config} activeStrategy={props.activeStrategy} activeGroupId={props.activeGroupId} onSetActive={props.onSetActive} matrix={props.matrix} matrixStale={props.matrixStale} onRunMatrix={props.onRunMatrix} onSelectCell={props.onSelectCell} autoPicked={props.autoPicked} />;
    case "strategies": return <StrategiesTab simSet={simSet} config={config} activeStrategy={props.activeStrategy} ops={ops} />;
    case "plan": return <PlanTab sim={activeSim} config={config} viewLabel={groupName(config, props.activeGroupId)} />;
    case "data": return <DataTab sim={activeSim} config={config} ops={ops} activeGroupId={props.activeGroupId} onSelectGroup={props.onSelectGroup} />;
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
    case "settings": return <SettingsEditor config={config} ops={ops} intradayPresets={props.intradayPresets} setIntradayPresets={props.setIntradayPresets} seasonalityPresets={props.seasonalityPresets} setSeasonalityPresets={props.setSeasonalityPresets} />;
    default: return null;
  }
}
