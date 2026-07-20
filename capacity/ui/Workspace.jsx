import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { makeDefaultConfig } from "../engine/engine.js";
import { useStrategySims, runMatrix, simHash, bestCell } from "./sim-set.js";
import { useConfigOps, migrateConfig, resolvePresets } from "./config-ops.js";
import { groupName, groupList, strategyList } from "./views.js";
import { makeRun } from "./sim-store.js";
import { PrintProvider } from "./print.jsx";
import { ContextBar } from "./components/ContextBar.jsx";
import { SummaryTab } from "./components/SummaryTab.jsx";
import { StrategiesTab } from "./components/StrategiesTab.jsx";
import { PlanTab } from "./components/PlanTab.jsx";
import { DataTab } from "./components/DataTab.jsx";
import { IntradayTab } from "./components/IntradayTab.jsx";
import { QueuesEditor } from "./editors/QueuesEditor.jsx";
import { ScenariosEditor } from "./editors/ScenariosEditor.jsx";
import { SettingsEditor } from "./editors/SettingsEditor.jsx";

// §26.4 tab order — the Runs/Snapshots tab is gone (run management lives on
// the landing); Settings is renamed Simulation Settings (same panel id).
const TABS = [
  { id: "summary", label: "Summary" },
  { id: "strategies", label: "Strategies" },
  { id: "plan", label: "Plan" },
  { id: "data", label: "Data" },
  { id: "intraday", label: "Intraday" },
  { id: "queues", label: "Queues" },
  { id: "scenarios", label: "Scenarios" },
  { id: "settings", label: "Simulation Settings" },
];

/* Level 2 of the two-level app (§26.1): one simulation's workspace. The record
   arrives fully loaded; the live config AUTO-SAVES continuously through
   onPersist (§26.2) and the context bar's Save creates a named Run. Mounted
   with key={record.id} so opening a different simulation re-initialises. */
export default function Workspace({ record, onPersist, onBack, intradayPresets, setIntradayPresets, seasonalityPresets, setSeasonalityPresets }) {
  // One-time hydration from the record: migrated config, plus the persisted
  // matrix cache / selected pair (R3d-B semantics — if the cache still matches
  // the live config, auto-select the most favourable cell with a note; else
  // restore the last selected pair behind the stale banner).
  const boot = useMemo(() => {
    const cfg = migrateConfig(record.config);
    const resolved = resolvePresets(cfg, seasonalityPresets, intradayPresets);
    const hash = simHash(resolved);
    const mc = record.matrixCache && record.matrixCache.cells ? record.matrixCache : null;
    let gid = (record.selectedPair && record.selectedPair.gid) || "g_por";
    let sid = (record.selectedPair && record.selectedPair.sid) || "S1";
    let autoPicked = false;
    if (mc && mc.hash === hash) {
      const pick = bestCell(mc);
      if (pick) { gid = pick.gid; sid = pick.sid; autoPicked = true; }
    }
    return { cfg, matrix: mc, gid, sid, autoPicked };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [config, setConfig] = useState(boot.cfg);
  const [tab, setTab] = useState("summary");
  const ops = useConfigOps(setConfig);

  const [activeStrategyId, setActiveStrategyId] = useState(boot.sid);
  const [activeGroupId, setActiveGroupId] = useState(boot.gid);

  // Guard active selections against deletions.
  const stratIdsAll = strategyList(config).map((s) => s.id);
  const safeStrategy = stratIdsAll.includes(activeStrategyId) ? activeStrategyId : (stratIdsAll[0] || "S1");
  const groupIds = groupList(config).map((g) => g.id);
  const safeGroup = groupIds.includes(activeGroupId) ? activeGroupId : (groupIds[0] || "g_por");

  // §20 run read-only mode: when a saved Run is selected in the context bar,
  // every tab renders its frozen config and editors are disabled.
  const runs = record.runs || [];
  const [viewingRunId, setViewingRunId] = useState(null);
  const viewing = viewingRunId ? runs.find((r) => r.id === viewingRunId) : null;
  const effectiveConfig = viewing ? migrateConfig(viewing.config) : config;
  const readOnly = !!viewing;

  // §24.6: bake the CURRENT library values of any applied seasonality / arrival
  // pattern into the config the engine simulates.
  const simConfig = useMemo(() => resolvePresets(effectiveConfig, seasonalityPresets, intradayPresets), [effectiveConfig, seasonalityPresets, intradayPresets]);

  const simSet = useStrategySims(simConfig, safeStrategy, safeGroup);
  const { activeSim, pending } = simSet;

  // §19 decision matrix — computed on demand, cached in the simulation record,
  // stale on any config edit.
  const [matrix, setMatrix] = useState(boot.matrix);
  const [autoPicked, setAutoPicked] = useState(boot.autoPicked);
  const liveHash = useMemo(() => simHash(simConfig), [simConfig]);
  const matrixStale = !matrix || matrix.hash !== liveHash;
  const onRunMatrix = useCallback(() => { setMatrix(runMatrix(simConfig)); setAutoPicked(false); }, [simConfig]);
  const onSelectCell = useCallback((gid, sid) => { setActiveGroupId(gid); setActiveStrategyId(sid); setAutoPicked(false); }, []);

  // §26.2 continuous auto-save (debounced). The first effect run is the mount
  // hydration — skipped so merely opening a simulation doesn't stamp updatedAt.
  const allInNow = activeSim ? Math.round(activeSim.summary.allIn) : null;
  const saveArgs = useRef(null);
  saveArgs.current = { config, matrix, gid: safeGroup, sid: safeStrategy, allIn: allInNow };
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    const id = setTimeout(() => {
      const s = saveArgs.current;
      onPersist({
        config: s.config,
        matrixCache: s.matrix,
        selectedPair: { gid: s.gid, sid: s.sid },
        lastAllIn: s.allIn,
      });
    }, 400);
    return () => clearTimeout(id);
  }, [config, matrix, safeGroup, safeStrategy, allInNow, onPersist]);

  // §26.2 Save — the context-bar action that creates a named Run.
  const onSaveRun = useCallback((name) => {
    const s = saveArgs.current;
    if (!activeSim) return;
    const run = makeRun(name, activeSim, { gid: s.gid, sid: s.sid }, s.matrix && s.matrix.hash === liveHash ? s.matrix : null);
    onPersist({ runs: [...runs, run] });
  }, [activeSim, runs, liveHash, onPersist]);

  const importConfig = useCallback((c) => { setConfig(migrateConfig(c)); setViewingRunId(null); }, []);
  // Blank-world escape hatch: load the demo defaults into THIS simulation.
  const loadDefaults = useCallback(() => { setConfig(migrateConfig(makeDefaultConfig())); setViewingRunId(null); }, []);
  const isBlank = effectiveConfig.brands.length === 0 && effectiveConfig.queues.length === 0;

  const tabProps = {
    simSet, activeSim, sims: simSet.sims, stratIds: simSet.stratIds, config: effectiveConfig, ops,
    activeStrategy: safeStrategy, activeGroupId: safeGroup, onSetActive: setActiveStrategyId,
    onSelectGroup: setActiveGroupId, onImportConfig: importConfig,
    matrix, matrixStale, onRunMatrix, onSelectCell, autoPicked,
    intradayPresets, setIntradayPresets, seasonalityPresets, setSeasonalityPresets,
  };

  return (
    <PrintProvider>
      <div className="app">
        <header className="topbar">
          <button type="button" className="backlink" onClick={onBack} data-testid="back-to-landing">← Simulations</button>
          <div className="brand">
            <span className="mark">C</span>
            <span>{record.name}</span>
            <small>capacity simulator</small>
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
          runs={runs} viewingRunId={viewingRunId} onSelectRun={setViewingRunId} pending={pending}
          onSaveRun={onSaveRun}
        />

        {readOnly && (
          <div className="ro-banner" role="status" data-testid="readonly-banner">
            Viewing run <strong>{viewing.name}</strong> — read-only. Editors are disabled.
            <button type="button" className="btn sm" style={{ marginLeft: 12 }} onClick={() => setViewingRunId(null)} data-testid="exit-snapshot">Return to live model</button>
          </div>
        )}

        <main className="main">
          {isBlank && (
            <div className="empty-state" data-testid="blank-empty-state">
              <div className="es-mark">✦</div>
              <h2>Start from nothing</h2>
              <p>This simulation has no brands and no queues yet. Build it up from scratch: create a brand in Simulation Settings, then add your first queue.</p>
              <div className="btnbar" style={{ justifyContent: "center" }}>
                <button type="button" className="btn primary" onClick={() => setTab("settings")} data-testid="es-add-brand">Create a brand (Simulation Settings)</button>
                <button type="button" className="btn" onClick={() => setTab("queues")} data-testid="es-add-queue">Add a queue (Queues)</button>
                <button type="button" className="btn" onClick={loadDefaults}>Load the demo defaults</button>
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
    case "settings": return (
      <SettingsEditor
        config={config} ops={ops}
        intradayPresets={props.intradayPresets} setIntradayPresets={props.setIntradayPresets}
        seasonalityPresets={props.seasonalityPresets} setSeasonalityPresets={props.setSeasonalityPresets}
        sim={activeSim} sims={simSet.sims} activeStrategy={props.activeStrategy} activeGroupId={props.activeGroupId} onImportConfig={props.onImportConfig}
      />
    );
    default: return null;
  }
}
