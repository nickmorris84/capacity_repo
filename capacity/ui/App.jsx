import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { makeBlankConfig } from "../engine/engine.js";
import { migrateConfig } from "./config-ops.js";
import { INTRADAY_PRESETS, SEASONALITY_PRESETS, CHANNEL_PRESET_LIBRARY } from "./presets.js";
import { makeStorageAdapter, KEYS } from "./storage.js";
import { loadOrMigrate, loadRecord, saveRecord, deleteRecord, renameRecord, duplicateRecord, makeSimRecord, simsUsingPreset } from "./sim-store.js";
import { Landing } from "./components/Landing.jsx";
import { NewSimWizard } from "./components/NewSimWizard.jsx";
import { GlobalPresets } from "./components/GlobalPresets.jsx";
import { Compare } from "./components/Compare.jsx";
import Workspace from "./Workspace.jsx";

/* §26.1 two-level app root. Level 1 is the Landing (the app opens here);
   level 2 is one simulation's Workspace. This shell owns the storage adapter,
   the simulation index, the currently-open record and its persistence
   (auto-save partials arrive from the workspace), and the app-global preset
   libraries (the §26.6 landing libraries land in Session B — the state already
   lives here, shared by every simulation). */
export default function App() {
  const storage = useMemo(() => makeStorageAdapter(), []);
  const [sims, setSims] = useState([]);           // sim-list index entries
  const [records, setRecords] = useState({});     // id -> full record (landing cards' runs)
  const [screen, setScreen] = useState({ view: "landing" });
  const [record, setRecord] = useState(null);     // the OPEN simulation's record
  const [compareSel, setCompareSel] = useState([]); // ticked run ids on the landing
  const [intradayPresets, setIntradayPresets] = useState(INTRADAY_PRESETS);
  const [seasonalityPresets, setSeasonalityPresets] = useState(SEASONALITY_PRESETS);
  const [channelPresets, setChannelPresets] = useState(CHANNEL_PRESET_LIBRARY);
  const hydrated = useRef(false);
  const recordRef = useRef(null);

  // Boot: global preset libraries + the §26.2 storage migration / bootstrap.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [ip, sp, cp, list] = await Promise.all([
        storage.get(KEYS.intraday), storage.get(KEYS.seasonality), storage.get(KEYS.channelPresets), loadOrMigrate(storage),
      ]);
      if (!alive) return;
      if (Array.isArray(ip) && ip.length) setIntradayPresets([...INTRADAY_PRESETS, ...ip]);
      if (Array.isArray(sp) && sp.length) setSeasonalityPresets([...SEASONALITY_PRESETS, ...sp]);
      if (Array.isArray(cp) && cp.length) setChannelPresets([...CHANNEL_PRESET_LIBRARY, ...cp]);
      setSims(list);
      hydrated.current = true;
    })();
    return () => { alive = false; };
  }, [storage]);

  useEffect(() => { if (hydrated.current) storage.set(KEYS.intraday, intradayPresets.filter((p) => !p.builtin)); }, [intradayPresets, storage]);
  useEffect(() => { if (hydrated.current) storage.set(KEYS.seasonality, seasonalityPresets.filter((p) => !p.builtin)); }, [seasonalityPresets, storage]);
  useEffect(() => { if (hydrated.current) storage.set(KEYS.channelPresets, channelPresets.filter((p) => !p.builtin)); }, [channelPresets, storage]);

  // §26.6 delete-in-use guard: which loaded simulations reference a preset.
  const presetUsage = useCallback((presetId) => simsUsingPreset(records, presetId), [records]);

  // The landing cards list each simulation's runs — load full records for it.
  useEffect(() => {
    if (screen.view !== "landing") return;
    let alive = true;
    (async () => {
      const map = {};
      for (const s of sims) { const r = await loadRecord(storage, s.id); if (r) map[s.id] = r; }
      if (alive) setRecords(map);
    })();
    return () => { alive = false; };
  }, [screen.view, sims, storage]);

  const openSim = useCallback(async (id) => {
    const rec = await loadRecord(storage, id);
    if (!rec) return;
    recordRef.current = rec;
    setRecord(rec);
    setScreen({ view: "workspace", simId: id });
  }, [storage]);

  const backToLanding = useCallback(() => {
    setScreen({ view: "landing" });
    setRecord(null);
    recordRef.current = null;
  }, []);

  // §26.2 auto-save sink: merge a partial into the open record, stamp
  // updatedAt, persist, refresh the index. Serialised through recordRef so
  // rapid saves never clobber each other.
  const persistPartial = useCallback(async (partial) => {
    const cur = recordRef.current;
    if (!cur) return;
    const merged = { ...cur, ...partial };
    recordRef.current = merged;
    const { record: saved, list } = await saveRecord(storage, merged);
    if (recordRef.current === merged) recordRef.current = saved;
    setRecord(recordRef.current);
    setSims(list);
  }, [storage]);

  const doRename = useCallback(async (id, name) => setSims(await renameRecord(storage, id, name)), [storage]);
  const doDuplicate = useCallback(async (id) => { const r = await duplicateRecord(storage, id); setSims(r.list); }, [storage]);
  const doDelete = useCallback(async (id) => {
    const rec = records[id];
    setSims(await deleteRecord(storage, id));
    if (rec) setCompareSel((sel) => sel.filter((rid) => !(rec.runs || []).some((r) => r.id === rid)));
  }, [storage, records]);
  const doDeleteRun = useCallback(async (simId, runId) => {
    const rec = await loadRecord(storage, simId);
    if (!rec) return;
    const { list } = await saveRecord(storage, { ...rec, runs: (rec.runs || []).filter((r) => r.id !== runId) });
    setSims(list);
    setCompareSel((sel) => sel.filter((x) => x !== runId));
  }, [storage]);

  // §26.5 creation flows.
  const defaultName = () => "Simulation " + (sims.length + 1);
  const startWizard = useCallback((kind, sourceId, name) => {
    const base = migrateConfig(makeBlankConfig());
    if (kind === "inherit-settings" && sourceId) {
      const src = records[sourceId];
      if (src && src.config) {
        const s = JSON.parse(JSON.stringify(src.config));
        base.engine = s.engine;
        base.settings = s.settings;
        base.hiring = { ...s.hiring, caps: { ...(s.hiring.caps || {}), segments: {}, brands: {} } };
        base.costs = s.costs; base.cx = s.cx; base.loops = s.loops;
      }
    }
    setScreen({ view: "wizard", baseConfig: base, startStep: kind === "inherit-settings" ? 1 : 0, name: name || defaultName() });
  }, [records, sims.length]);

  const onNewInherit = useCallback(async (mode, sourceId, name) => {
    if (mode === "settings") return startWizard("inherit-settings", sourceId, name);
    // (b) full copy — everything except runs and the matrix cache.
    const r = await duplicateRecord(storage, sourceId, name || defaultName());
    if (r && r.id) { setSims(r.list); await openSim(r.id); }
  }, [storage, startWizard, openSim, sims.length]);

  const finishWizard = useCallback(async (name, config) => {
    const rec = makeSimRecord(name, config);
    const { list } = await saveRecord(storage, rec);
    setSims(list);
    await openSim(rec.id);
  }, [storage, openSim]);

  if (screen.view === "wizard") {
    return (
      <NewSimWizard
        baseConfig={screen.baseConfig} startStep={screen.startStep} defaultName={screen.name}
        seasonalityPresets={seasonalityPresets} channelPresets={channelPresets}
        onFinish={finishWizard} onCancel={backToLanding}
      />
    );
  }

  if (screen.view === "presets") {
    return (
      <GlobalPresets
        onBack={backToLanding} eng={{ dayStart: 8, intervalMin: 30 }}
        channelPresets={channelPresets} setChannelPresets={setChannelPresets}
        intradayPresets={intradayPresets} setIntradayPresets={setIntradayPresets}
        seasonalityPresets={seasonalityPresets} setSeasonalityPresets={setSeasonalityPresets}
        usageOf={presetUsage}
      />
    );
  }

  if (screen.view === "compare") {
    return <Compare sims={sims} records={records} onBack={backToLanding} />;
  }

  if (screen.view === "workspace" && record) {
    return (
      <Workspace
        key={record.id} record={record} onPersist={persistPartial} onBack={backToLanding}
        intradayPresets={intradayPresets} setIntradayPresets={setIntradayPresets}
        seasonalityPresets={seasonalityPresets} setSeasonalityPresets={setSeasonalityPresets}
        channelPresets={channelPresets}
      />
    );
  }

  return (
    <Landing
      sims={sims} records={records} storageMode={storage.mode} storageNotice={storage.notice}
      compareSel={compareSel} setCompareSel={setCompareSel}
      onOpen={openSim} onRename={doRename} onDuplicate={doDuplicate} onDelete={doDelete} onDeleteRun={doDeleteRun}
      onNewSim={(name) => startWizard("scratch", null, name)} onNewInherit={onNewInherit}
      onOpenPresets={() => setScreen({ view: "presets" })} onOpenCompare={() => setScreen({ view: "compare" })}
    />
  );
}
