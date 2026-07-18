import { RAG } from "../format.js";

/* Week × queue RAG grid. Reads `sim` only (E4). Cells are buttons: clicking one
   scrubs the whole dashboard to that week. Active-scenario onsets are marked on
   the relevant week cells and enumerated beneath. */
export function Ribbon({ sim, selectedWeek, onScrub }) {
  const cfg = sim.config;
  const activeSet = new Set(sim.viewIds || []);
  const eventWeeks = {};
  for (const s of cfg.scenarios) {
    if (!activeSet.has(s.id)) continue;
    (eventWeeks[s.startWeek] = eventWeeks[s.startWeek] || []).push(s);
  }
  const weeks = sim.weeks;

  return (
    <div>
      <div className="ribbon-wrap">
        <table className="ribbon">
          <thead>
            <tr>
              <th></th>
              {weeks.map((w) => (
                <th key={w.week} className="wk">{w.week % 4 === 0 || w.week === weeks.length - 1 ? w.week + 1 : ""}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cfg.queues.map((q) => (
              <tr key={q.id}>
                <th scope="row">{q.name}</th>
                {weeks.map((w) => {
                  const st = w.queues[q.id].status;
                  const marked = !!eventWeeks[w.week];
                  return (
                    <td key={w.week} style={{ padding: 0 }}>
                      <button
                        type="button"
                        className={"cell" + (w.week === selectedWeek ? " scrubbed" : "") + (marked ? " evmark" : "")}
                        data-st={st}
                        aria-label={`${q.name}, week ${w.week + 1}: ${st}`}
                        aria-pressed={w.week === selectedWeek}
                        onClick={() => onScrub(w.week)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ribbon-scrub">
        <span className="legend">
          <span><span className="sw" style={{ background: RAG.green }} />Meets SLA</span>
          <span><span className="sw" style={{ background: RAG.amber }} />At risk</span>
          <span><span className="sw" style={{ background: RAG.red }} />Breach</span>
          <span><span className="sw" style={{ background: "var(--ink)" }} />Scenario event</span>
        </span>
        <span className="spacer" />
        {Object.keys(eventWeeks).length > 0 && (
          <span className="legend">
            {Object.entries(eventWeeks).sort((a, b) => a[0] - b[0]).map(([wk, list]) => (
              <span key={wk} className="pill">wk {Number(wk) + 1}: {list.map((s) => s.name).join(", ")}</span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
