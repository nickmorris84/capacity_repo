import { useState } from "react";
import { useDisclosure } from "../hooks.js";
import { PrintButton } from "../print.jsx";
import { strategyList, strategyObj, isSchedule, scheduleSummary, groupList } from "../views.js";

const stamp = () => { const d = new Date(); const p = (n) => String(n).padStart(2, "0"); return `Run ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };

/* Global context bar (§20/§26.4) — under the header on every tab. Three
   selectors drive every number rendered below: Strategy · Scenario-group ·
   Run. Selecting a saved Run switches the whole app into read-only mode;
   "Live" returns to the current model. Plus Save (creates a named Run —
   §26.2; the name prompt defaults to a timestamp) and Print / PDF. */
export function ContextBar({ config, activeStrategyId, onSetActiveStrategy, activeGroupId, onSetActiveGroup, ops, runs, viewingRunId, onSelectRun, pending, onSaveRun }) {
  const strat = strategyObj(config, activeStrategyId);
  const sched = isSchedule(strat) ? scheduleSummary(config, strat) : "";
  const disc = useDisclosure();
  const saveDisc = useDisclosure();
  const [runName, setRunName] = useState("");

  const doSave = () => {
    onSaveRun((runName || "").trim() || stamp());
    setRunName("");
    saveDisc.toggle();
  };

  return (
    <div className="ctxbar" role="region" aria-label="Plan context">
      <div className="ctx-item ctx-strat" ref={disc.ref}>
        <span className="ctx-label">Strategy</span>
        <button type="button" className="ctx-chip" aria-expanded={disc.open} onClick={disc.toggle} data-testid="ctx-strategy">
          <strong>{strat ? strat.name : activeStrategyId}</strong>
          {sched ? <span className="ctx-sub">{sched}</span> : null}
          <span className="chev" style={{ marginLeft: 4 }}>▾</span>
        </button>
        {disc.open && (
          <div className="pop ctx-pop" role="dialog" aria-label="Active strategy">
            <label className="field">
              <span className="lab">Active strategy / schedule</span>
              <select value={activeStrategyId} onChange={(e) => onSetActiveStrategy(e.target.value)} data-testid="ctx-strategy-select">
                {strategyList(config).map((s) => <option key={s.id} value={s.id}>{s.name}{s.baseType === "schedule" ? " (schedule)" : ""}</option>)}
              </select>
            </label>
            {isSchedule(strat) && (
              <div style={{ marginTop: 10 }}>
                <div className="lab" style={{ marginBottom: 6 }}>Segments</div>
                {(strat.segments || []).map((seg, i) => (
                  <div className="rowflex" key={i} style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: "var(--ink-muted)" }}>from wk</span>
                    <input type="number" className="inp" style={{ width: 64 }} min={1} value={seg.fromWeek}
                      onChange={(e) => ops.patchSegment(strat.id, i, "fromWeek", Math.max(1, Number(e.target.value) || 1))} data-testid={"seg-week-" + i} />
                    <select className="inp" style={{ flex: 1 }} value={seg.strategyId} onChange={(e) => ops.patchSegment(strat.id, i, "strategyId", e.target.value)} data-testid={"seg-strat-" + i}>
                      {strategyList(config).filter((s) => s.id !== strat.id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <button type="button" className="btn sm danger" onClick={() => ops.deleteSegment(strat.id, i)} aria-label="Remove segment">×</button>
                  </div>
                ))}
                <button type="button" className="btn sm" onClick={() => ops.addSegment(strat.id)} data-testid="seg-add">+ Segment</button>
              </div>
            )}
            <p className="note" style={{ marginTop: 10 }}>
              Build reusable schedules on the Strategies tab. The active plan drives every tab.
            </p>
          </div>
        )}
      </div>

      <div className="ctx-item">
        <span className="ctx-label">Scenario group</span>
        <select className="ctx-select" value={activeGroupId} onChange={(e) => onSetActiveGroup(e.target.value)} aria-label="Active scenario group" data-testid="ctx-group">
          {groupList(config).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      <div className="ctx-item">
        <span className="ctx-label">Run</span>
        <select className="ctx-select" value={viewingRunId || ""} onChange={(e) => onSelectRun(e.target.value || null)} aria-label="View saved run" data-testid="ctx-snapshot">
          <option value="">— Live —</option>
          {(runs || []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      <div className="ctx-item ctx-save" ref={saveDisc.ref}>
        <button type="button" className="btn sm primary" aria-expanded={saveDisc.open} onClick={() => { setRunName(stamp()); saveDisc.toggle(); }} data-testid="save-run-open">Save</button>
        {saveDisc.open && (
          <div className="pop ctx-pop" role="dialog" aria-label="Save a run">
            <label className="field">
              <span className="lab">Run name</span>
              <input type="text" value={runName} onChange={(e) => setRunName(e.target.value)} data-testid="run-name" />
            </label>
            <div className="btnbar" style={{ marginTop: 8 }}>
              <button type="button" className="btn sm primary" onClick={doSave} data-testid="save-run">Save run</button>
            </div>
            <p className="note" style={{ marginTop: 8 }}>A Run freezes the full configuration and the current results. Manage and compare runs on the landing.</p>
          </div>
        )}
      </div>

      <span className="spacer" />
      <span className={"recalc" + (pending ? "" : " idle")} role="status" aria-live="polite" style={{ marginRight: 8 }}>
        <span className="dot" aria-hidden="true" />{pending ? "Recalculating…" : "Up to date"}
      </span>
      <PrintButton />
    </div>
  );
}
