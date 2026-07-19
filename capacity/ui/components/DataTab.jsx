import { useState } from "react";
import { Card, SelectField, Hint } from "./primitives.jsx";
import { columnsFor, buildWeeklyRows, assumptionsColumns, COLUMN_GROUPS } from "../reporting.js";
import { groupList } from "../views.js";
import { queueCSV, downloadText } from "../exports.js";

// Default per-group colours (match the R2 tints); user edits persist in
// config.settings.dataColours and drive the header underline + cell tint.
const DEFAULT_GROUP_COLOURS = {
  Week: "#7a828a", Demand: "#0e7c86", Service: "#3a7bd5", People: "#5a54c9",
  Supply: "#10966e", Money: "#d98a0b", Status: "#7a828a",
};
function hexToRgba(hex, a) {
  const h = (hex || "#888888").replace("#", "");
  const n = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r || 0},${g || 0},${b || 0},${a})`;
}

/* Data tab. Two views of the per-queue weekly record: Outputs (every result with
   user-editable column-group colours, a clear vertical divider between segments,
   and a per-group show/hide picker) and Assumptions-over-time. Input cells — the
   weekly volume series — are editable in place and write back to the config,
   re-simulating; computed outcome columns are read-only with a muted treatment
   so the input/outcome boundary is visible (SPEC §24.6, one source of truth). */
export function DataTab({ sim, config, ops, activeGroupId, onSelectGroup }) {
  const [qid, setQid] = useState(config.queues[0] ? config.queues[0].id : "");
  const [hidden, setHidden] = useState(() => new Set());
  const [mode, setMode] = useState("outputs");

  const queue = config.queues.find((q) => q.id === qid) || config.queues[0];
  if (!queue) return <div className="empty">No queues configured.</div>;

  const cur = config.engine.currency;
  const rows = buildWeeklyRows(sim, queue, config);
  const outCols = columnsFor(queue, cur).filter((c) => !hidden.has(c.group));
  const asmCols = assumptionsColumns(queue, cur);
  const colours = (config.settings && config.settings.dataColours) || {};
  const colourOf = (g) => colours[g] || DEFAULT_GROUP_COLOURS[g] || "#7a828a";

  // Mark the first visible column of each group so it carries the divider rule.
  const firstOfGroup = {};
  let prevGroup = null;
  for (const c of outCols) { if (c.group !== prevGroup) { firstOfGroup[c.key] = true; prevGroup = c.group; } }

  const toggleGroup = (g) => setHidden((h) => { const n = new Set(h); n.has(g) ? n.delete(g) : n.add(g); return n; });

  return (
    <div className="grid" style={{ gap: 16 }}>
      <Card title="Per-queue data" hint="Every weekly datapoint. Input columns (the weekly volume series) are editable here and re-simulate; computed outcome columns are read-only.">
        <div className="fieldrow" style={{ maxWidth: 720 }}>
          <SelectField label="Queue" value={queue.id} onChange={setQid} options={config.queues.map((q) => ({ value: q.id, label: q.name }))} />
          <SelectField label="Scenario group" value={activeGroupId} onChange={onSelectGroup} options={groupList(config).map((g) => ({ value: g.id, label: g.name }))} />
          <SelectField label="View" value={mode} onChange={setMode} options={[{ value: "outputs", label: "Outputs" }, { value: "assumptions", label: "Assumptions over time" }]} />
        </div>

        {mode === "outputs" && (
          <>
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
            <div className="rowflex" style={{ marginTop: 10, gap: 14 }} data-testid="data-colours">
              <span className="lab" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                Segment colours <Hint text="Pick a colour per column group. Saved with the config; the header underline and cell tint follow it." />
              </span>
              {COLUMN_GROUPS.filter((g) => g !== "Week").map((g) => (
                <label key={g} className="rowflex" style={{ gap: 5 }} title={g}>
                  <input type="color" value={colourOf(g)} data-testid={"data-colour-" + g}
                    onChange={(e) => ops.patch(["settings", "dataColours", g], e.target.value)} aria-label={g + " colour"} style={{ width: 26, height: 22, padding: 0, border: "1px solid var(--line-2)", borderRadius: 5 }} />
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{g}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </Card>

      {mode === "outputs" ? (
        <Card title={`${queue.name} — weekly`} sub={`${rows.length} weeks · ${outCols.length} columns`}>
          <div className="tbl-wrap" style={{ maxHeight: 560 }}>
            <table className="data grouped seg" data-testid="data-table">
              <thead><tr>{outCols.map((c) => (
                <th key={c.key} className={"grp-" + c.group.toLowerCase() + (firstOfGroup[c.key] ? " seg-first" : "") + (c.input ? " col-input" : "")}
                  style={{ borderBottom: "2px solid " + colourOf(c.group) }}>{c.label}{c.input ? " ✎" : ""}</th>
              ))}</tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.week}>
                    {outCols.map((c) => {
                      const tint = { background: hexToRgba(colourOf(c.group), 0.06) };
                      const base = "grp-" + c.group.toLowerCase() + (firstOfGroup[c.key] ? " seg-first" : "");
                      if (c.input === "volume") {
                        return (
                          <td key={c.key} className={base + " col-input"} style={tint}>
                            <input type="number" className="cell-inp" value={row.volInput == null ? "" : Math.round(row.volInput)}
                              data-testid={"cell-vol-" + row.week}
                              onChange={(e) => ops.patchWeeklyVolume(queue.id, row.week - 1, e.target.value === "" ? 0 : Number(e.target.value))} aria-label={"Week " + row.week + " volume"} />
                          </td>
                        );
                      }
                      return (
                        <td key={c.key} className={base + " cell-ro" + (c.key === "status" ? " st-" + row.status : "")} style={tint} data-ro="1" data-testid={c.key === "cover" ? "cell-cover-" + row.week : undefined}>{c.fmt(row[c.key])}</td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card title={`${queue.name} — assumptions in effect`} sub="inputs in force" hint="The resolved inputs the engine used each week: volume after profile/seasonality/scenarios, blended AHT, SLA, attrition, training shrinkage and the active scenario tags.">
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
