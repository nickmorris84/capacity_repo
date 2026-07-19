import { useState } from "react";
import { Card, SelectField, Hint } from "./primitives.jsx";
import { columnsFor, buildWeeklyRows, COLUMN_GROUPS } from "../reporting.js";
import { queueCSV, downloadText } from "../exports.js";

/* Data tab (SPEC §6): per-queue weekly table with every output and the
   assumptions in effect. Column groups with a picker (all on by default), a view
   selector, sticky header, horizontal scroll, and per-table CSV. Read-only. */
export function DataTab({ sim, config, activeViewId, views, onSelectView }) {
  const [qid, setQid] = useState(config.queues[0] ? config.queues[0].id : "");
  const [hidden, setHidden] = useState(() => new Set());

  const queue = config.queues.find((q) => q.id === qid) || config.queues[0];
  if (!queue) return <div className="empty">No queues configured.</div>;

  const cols = columnsFor(queue, config.engine.currency).filter((c) => !hidden.has(c.group));
  const rows = buildWeeklyRows(sim, queue, config);

  const toggleGroup = (g) => setHidden((h) => {
    const n = new Set(h);
    n.has(g) ? n.delete(g) : n.add(g);
    return n;
  });

  return (
    <div className="grid" style={{ gap: 16 }}>
      <Card title="Per-queue data" hint="Every weekly datapoint — outputs and the assumptions in effect that week. Read-only: edit values in the editor tabs.">
        <div className="fieldrow" style={{ maxWidth: 640 }}>
          <SelectField label="Queue" value={queue.id} onChange={setQid} options={config.queues.map((q) => ({ value: q.id, label: q.name }))} />
          <SelectField label="View" value={activeViewId} onChange={onSelectView} options={views.map((v) => ({ value: v.id, label: v.name }))} />
        </div>

        <div className="rowflex" style={{ marginTop: 12 }}>
          <span className="lab" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            Column groups <Hint text="Toggle groups of columns. All are on by default." />
          </span>
          {COLUMN_GROUPS.filter((g) => g !== "Week").map((g) => (
            <label key={g} className="switch">
              <input type="checkbox" checked={!hidden.has(g)} onChange={() => toggleGroup(g)} />
              <span className="track" aria-hidden="true" />
              <span>{g}</span>
            </label>
          ))}
          <span className="spacer" />
          <button
            type="button"
            className="btn sm"
            onClick={() => downloadText(`${queue.name.replace(/\s+/g, "_")}_weekly.csv`, queueCSV(sim, queue, config), "text/csv")}
          >Export CSV</button>
        </div>
      </Card>

      <Card title={`${queue.name} — weekly`} sub={`${rows.length} weeks · ${cols.length} columns`}>
        <div className="tbl-wrap" style={{ maxHeight: 560 }}>
          <table className="data grouped" data-testid="data-table">
            <thead>
              <tr>
                {cols.map((c) => <th key={c.key} className={"grp-" + c.group.toLowerCase()}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.week}>
                  {cols.map((c) => (
                    <td key={c.key} className={"grp-" + c.group.toLowerCase() + (c.key === "status" ? " st-" + row.status : "")}>
                      {c.fmt(row[c.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
