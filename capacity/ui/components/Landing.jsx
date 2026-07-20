import { useState } from "react";
import { TotalsDelta, AllInOverlay, PerQueue } from "./RunCompare.jsx";
import { downloadText } from "../exports.js";
import { money } from "../format.js";

const dt = (iso) => { try { return iso.replace("T", " ").slice(0, 16); } catch (e) { return iso || ""; } };

/* §26.3 Landing — level 1 of the app. A card per simulation with Open / Rename /
   Duplicate / Delete (typed confirmation), each card carrying its headline
   (horizon, brands, queues, last all-in when cached) and its Runs (§26.4 run
   management lives here). Ticking runs compares them below — the full §26.7
   verdict-first compare, and the §26.6 global preset libraries, land in
   Session B; both have visible entry points here. */
export function Landing({ sims, records, storageMode, storageNotice, compareSel, setCompareSel, onOpen, onRename, onDuplicate, onDelete, onDeleteRun, onNewSim, onNewInherit, onOpenPresets, onOpenCompare }) {
  const [renaming, setRenaming] = useState(null);   // sim id being renamed
  const [renameVal, setRenameVal] = useState("");
  const [deleting, setDeleting] = useState(null);   // sim id pending typed confirm
  const [deleteVal, setDeleteVal] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [newName, setNewName] = useState("");

  const toggleRun = (runId) => setCompareSel((sel) => (sel.includes(runId) ? sel.filter((x) => x !== runId) : [...sel, runId]));
  const allRuns = sims.flatMap((s) => ((records[s.id] || {}).runs || []).map((r) => ({ ...r, simName: s.name })));
  const selected = compareSel.map((id) => allRuns.find((r) => r.id === id)).filter(Boolean);
  const cur = "£";

  return (
    <div className="app landing" data-testid="landing">
      <header className="topbar">
        <div className="brand">
          <span className="mark">C</span>
          <span>Capacity Simulator</span>
          <small>simulation library</small>
        </div>
        <span className="spacer" />
      </header>

      <main className="main" style={{ maxWidth: 1000 }}>
        <div className="rowflex" style={{ margin: "6px 0 16px" }}>
          <h1 className="landing-title">Simulations</h1>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onOpenPresets} data-testid="landing-presets">Global presets</button>
          <button type="button" className="btn" onClick={onOpenCompare} data-testid="landing-compare">Compare</button>
          <button type="button" className="btn primary" onClick={() => setNewOpen(!newOpen)} data-testid="landing-new-sim">+ New simulation</button>
        </div>

        {storageNotice && <p className="note" style={{ marginBottom: 12 }}>{storageNotice}</p>}

        {newOpen && (
          <div className="card" style={{ marginBottom: 16 }} data-testid="new-sim-panel">
            <div className="card-h"><h3>New simulation</h3></div>
            <div className="card-b">
              <div className="rowflex" style={{ marginBottom: 10 }}>
                <label className="field" style={{ maxWidth: 240 }}>
                  <span className="lab">Name</span>
                  <input type="text" placeholder="e.g. FY27 baseline" value={newName} onChange={(e) => setNewName(e.target.value)} data-testid="new-name" />
                </label>
                <label className="field" style={{ maxWidth: 260 }}>
                  <span className="lab">Source simulation (for inherit)</span>
                  <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} data-testid="new-source">
                    <option value="">— pick a source —</option>
                    {sims.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
              </div>
              <div className="btnbar">
                <button type="button" className="btn" disabled={!sourceId} data-testid="new-inherit-settings"
                  onClick={() => { setNewOpen(false); onNewInherit("settings", sourceId, newName); }}>
                  Inherit settings from another
                </button>
                <button type="button" className="btn" disabled={!sourceId} data-testid="new-inherit-full"
                  onClick={() => { setNewOpen(false); onNewInherit("full", sourceId, newName); }}>
                  Inherit settings, brands, channels &amp; queues
                </button>
                <button type="button" className="btn primary" data-testid="new-scratch"
                  onClick={() => { setNewOpen(false); onNewSim(newName); }}>
                  From scratch (wizard)
                </button>
              </div>
              <p className="note" style={{ marginTop: 10 }}>Inheriting settings copies the source's Simulation Settings and continues into the wizard at the Brands step. The full inherit copies everything except its runs and matrix cache.</p>
            </div>
          </div>
        )}

        <div className="sim-cards">
          {sims.map((s) => {
            const rec = records[s.id];
            const runs = (rec && rec.runs) || [];
            return (
              <div className="card sim-card" key={s.id} data-testid={"sim-card-" + s.id}>
                <div className="card-h">
                  {renaming === s.id ? (
                    <span className="rowflex">
                      <input type="text" className="inp" value={renameVal} onChange={(e) => setRenameVal(e.target.value)} data-testid={"sim-rename-input-" + s.id} aria-label="Simulation name" />
                      <button type="button" className="btn sm primary" data-testid={"sim-rename-save-" + s.id}
                        onClick={() => { onRename(s.id, renameVal.trim() || s.name); setRenaming(null); }}>Save</button>
                      <button type="button" className="btn sm" onClick={() => setRenaming(null)}>Cancel</button>
                    </span>
                  ) : (
                    <h3 data-testid={"sim-name-" + s.id}>{s.name}</h3>
                  )}
                  <span className="sub">updated {dt(s.updatedAt)}</span>
                  <span className="spacer" />
                  <span className="pill">{s.runCount === 1 ? "1 run" : (s.runCount || 0) + " runs"}</span>
                </div>
                <div className="card-b">
                  <div className="sim-headline">
                    <span className="stat"><span className="l">Horizon</span><span className="v">{s.horizonWeeks != null ? s.horizonWeeks + " wk" : "–"}</span></span>
                    <span className="stat"><span className="l">Brands</span><span className="v">{s.brands != null ? s.brands : "–"}</span></span>
                    <span className="stat"><span className="l">Queues</span><span className="v">{s.queues != null ? s.queues : "–"}</span></span>
                    <span className="stat"><span className="l">Last all-in</span><span className="v">{s.lastAllIn != null ? money(s.currency || "£", s.lastAllIn) : "–"}</span></span>
                  </div>
                  <div className="btnbar" style={{ marginTop: 12 }}>
                    <button type="button" className="btn primary" onClick={() => onOpen(s.id)} data-testid={"sim-open-" + s.id}>Open</button>
                    <button type="button" className="btn" onClick={() => { setRenaming(s.id); setRenameVal(s.name); }} data-testid={"sim-rename-" + s.id}>Rename</button>
                    <button type="button" className="btn" onClick={() => onDuplicate(s.id)} data-testid={"sim-duplicate-" + s.id}>Duplicate</button>
                    <button type="button" className="btn danger" onClick={() => { setDeleting(deleting === s.id ? null : s.id); setDeleteVal(""); }} data-testid={"sim-delete-" + s.id}>Delete</button>
                  </div>
                  {deleting === s.id && (
                    <div className="delete-confirm" data-testid={"sim-delete-panel-" + s.id}>
                      <p className="note" style={{ marginBottom: 8 }}>Deleting removes this simulation and its {runs.length} run(s) permanently. Type <strong>{s.name}</strong> to confirm.</p>
                      <div className="rowflex">
                        <input type="text" className="inp" style={{ maxWidth: 240 }} value={deleteVal} placeholder="type the simulation name"
                          onChange={(e) => setDeleteVal(e.target.value)} data-testid={"sim-delete-confirm-" + s.id} aria-label="Type the simulation name to confirm" />
                        <button type="button" className="btn danger" disabled={deleteVal !== s.name} data-testid={"sim-delete-do-" + s.id}
                          onClick={() => { setDeleting(null); onDelete(s.id); }}>Delete permanently</button>
                      </div>
                    </div>
                  )}
                  {runs.length > 0 && (
                    <div className="tbl-wrap" style={{ marginTop: 12 }}>
                      <table className="data" data-testid={"runs-table-" + s.id}>
                        <thead><tr><th>Compare</th><th>Run</th><th>Saved</th><th>Strategy</th><th>All-in</th><th>Actions</th></tr></thead>
                        <tbody>
                          {runs.map((r) => (
                            <tr key={r.id}>
                              <td>
                                <label className="switch" style={{ justifyContent: "center" }}>
                                  <input type="checkbox" checked={compareSel.includes(r.id)} onChange={() => toggleRun(r.id)} data-testid={"tick-" + r.id} />
                                  <span className="track" aria-hidden="true" />
                                </label>
                              </td>
                              <td style={{ textAlign: "left", fontWeight: 600 }}>{r.name}</td>
                              <td>{dt(r.savedAt)}</td>
                              <td>{r.strategy}</td>
                              <td>{money((rec.config && rec.config.engine && rec.config.engine.currency) || "£", r.allIn)}</td>
                              <td>
                                <span className="btnbar">
                                  <button type="button" className="btn sm" onClick={() => downloadText(`${r.slug}.json`, JSON.stringify({ kind: "capacity-run", savedAt: r.savedAt, config: r.config, run: r.run }, null, 2), "application/json")}>Download</button>
                                  <button type="button" className="btn sm danger" onClick={() => onDeleteRun(s.id, r.id)} data-testid={"run-del-" + r.id}>Delete</button>
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {sims.length === 0 && <p className="empty">No simulations yet — create one to get started.</p>}
        </div>

        {selected.length > 0 && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-h"><h3>Compare</h3><span className="sub">{selected.length} run(s) ticked · deltas vs the first</span></div>
            <div className="card-b">
              <TotalsDelta runs={selected} cur={cur} />
              <h4 style={{ margin: "18px 0 6px", fontSize: 13 }}>Cumulative all-in cost</h4>
              <AllInOverlay runs={selected} cur={cur} />
              <h4 style={{ margin: "18px 0 6px", fontSize: 13 }}>Per-queue comparison (matched by name)</h4>
              <PerQueue runs={selected} cur={cur} />
            </div>
          </div>
        )}

        <p className="note" style={{ marginTop: 18 }}>storage: {storageMode}</p>
      </main>
    </div>
  );
}
