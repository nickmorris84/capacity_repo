import { useDisclosure } from "../hooks.js";
import { PrintButton } from "../print.jsx";
import { strategyList, strategyObj, isSchedule, scheduleSummary } from "../views.js";

/* Global context bar (§14.8) — under the header on every tab. Carries the
   active strategy/schedule (tap to switch or edit segments), the active view,
   the loaded-snapshot name, and the Print / PDF this page action. */
export function ContextBar({ config, activeStrategyId, onSetActiveStrategy, activeViewId, onSetActiveView, ops, loadedSnapshotName, pending }) {
  const strat = strategyObj(config, activeStrategyId);
  const sched = isSchedule(strat) ? scheduleSummary(config, strat) : "";
  const disc = useDisclosure();

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
                    <span style={{ fontSize: 11, color: "#c9d6de" }}>from wk</span>
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
            <p className="note" style={{ marginTop: 10, background: "rgba(255,255,255,.06)", borderColor: "rgba(255,255,255,.12)", color: "#c9d6de" }}>
              Build reusable schedules on the Strategies tab. The active plan drives every tab.
            </p>
          </div>
        )}
      </div>

      <div className="ctx-item">
        <span className="ctx-label">View</span>
        <select className="ctx-select" value={activeViewId} onChange={(e) => onSetActiveView(e.target.value)} aria-label="Active scenario view" data-testid="ctx-view">
          {config.views.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>

      <div className="ctx-item">
        <span className="ctx-label">Snapshot</span>
        <span className="ctx-snapshot" data-testid="ctx-snapshot">{loadedSnapshotName || "— live model —"}</span>
      </div>

      <span className="spacer" />
      <span className={"recalc" + (pending ? "" : " idle")} role="status" aria-live="polite" style={{ marginRight: 8 }}>
        <span className="dot" aria-hidden="true" />{pending ? "Recalculating…" : "Up to date"}
      </span>
      <PrintButton />
    </div>
  );
}
