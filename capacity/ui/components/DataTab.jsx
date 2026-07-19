import { useState } from "react";
import { Card, SelectField, Hint } from "./primitives.jsx";
import { columnsFor, buildWeeklyRows, assumptionsColumns, COLUMN_GROUPS } from "../reporting.js";
import { groupList } from "../views.js";
import { queueCSV, downloadText } from "../exports.js";

/* Data tab (§6/§16). Two views of the per-queue weekly record: Outputs (every
   result with column-group tints and a per-group show/hide picker) and
   Assumptions-over-time (the §16 audit contract — the resolved volume, blended
   AHT, SLA, attrition, training shrinkage, OT used and active scenarios that
   were in force each week). Scenario group and queue chosen here; read-only. */
export function DataTab({ sim, config, activeGroupId, onSelectGroup }) {
  const [qid, setQid] = useState(config.queues[0] ? config.queues[0].id : "");
  const [hidden, setHidden] = useState(() => new Set());
  const [mode, setMode] = useState("outputs");

  const queue = config.queues.find((q) => q.id === qid) || config.queues[0];
  if (!queue) return <div className="empty">No queues configured.</div>;

  const cur = config.engine.currency;
  const rows = buildWeeklyRows(sim, queue, config);
  const outCols = columnsFor(queue, cur).filter((c) => !hidden.has(c.group));
  const asmCols = assumptionsColumns(queue, cur);

  const toggleGroup = (g) => setHidden((h) => { const n = new Set(h); n.has(g) ? n.delete(g) : n.add(g); return n; });

  return (
    <div className="grid" style={{ gap: 16 }}>
      <Card title="Per-queue data" hint="Every weekly datapoint — outputs and the resolved assumptions in effect. Read-only: edit values in the editor tabs.">
        <div className="fieldrow" style={{ maxWidth: 720 }}>
          <SelectField label="Queue" value={queue.id} onChange={setQid} options={config.queues.map((q) => ({ value: q.id, label: q.name }))} />
          <SelectField label="Scenario group" value={activeGroupId} onChange={onSelectGroup} options={groupList(config).map((g) => ({ value: g.id, label: g.name }))} />
          <SelectField label="View" value={mode} onChange={setMode} options={[{ value: "outputs", label: "Outputs" }, { value: "assumptions", label: "Assumptions over time" }]} />
        </div>

        {mode === "outputs" && (
          <div className="rowflex" style={{ marginTop: 12 }}>
            <span className="lab" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              Column groups <Hint text="Toggle groups of columns. All are on by default." />
            </span>
            {COLUMN_GROUPS.filter((g) => g !== "Week").map((g) => (
              <label key={g} className="switch">
                <input type="checkbox" checked={!hidden.has(g)} onChange={() => toggleGroup(g)} />
                <span className="track" aria-hidden="true" /><span>{g}</span>
              </label>
            ))}
            <span className="spacer" />
            <button type="button" className="btn sm" onClick={() => downloadText(`${queue.name.replace(/\s+/g, "_")}_weekly.csv`, queueCSV(sim, queue, config), "text/csv")}>Export CSV</button>
          </div>
        )}
      </Card>

      {mode === "outputs" ? (
        <Card title={`${queue.name} — weekly`} sub={`${rows.length} weeks · ${outCols.length} columns`}>
          <div className="tbl-wrap" style={{ maxHeight: 560 }}>
            <table className="data grouped" data-testid="data-table">
              <thead><tr>{outCols.map((c) => <th key={c.key} className={"grp-" + c.group.toLowerCase()}>{c.label}</th>)}</tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.week}>
                    {outCols.map((c) => (
                      <td key={c.key} className={"grp-" + c.group.toLowerCase() + (c.key === "status" ? " st-" + row.status : "")}>{c.fmt(row[c.key])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card title={`${queue.name} — assumptions in effect`} sub="§16 audit contract" hint="The resolved parameters the engine used each week: volume after profile/seasonality/scenarios, blended AHT, SLA, attrition, training shrinkage, OT used and the active scenario tags.">
          <div className="tbl-wrap" style={{ maxHeight: 560 }}>
            <table className="data" data-testid="assumptions-table">
              <thead><tr>{asmCols.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.week}>{asmCols.map((c) => <td key={c.key} style={c.key === "scenarioTags" ? { textAlign: "left" } : undefined}>{c.fmt(row[c.key])}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
