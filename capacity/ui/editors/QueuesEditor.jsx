import { NumField, TextField, SelectField, Toggle, Card, Hint } from "../components/primitives.jsx";
import { PresetBar, IntradaySliders } from "./PresetBar.jsx";
import { makeIntradayPreset } from "../presets.js";

/* Queues editor (SPEC §1). Add / duplicate / delete unlimited queues; every
   queue parameter editable; intraday preset library with apply / hand-edit /
   save-as-new. Edits the live config directly (E4 governs display, not editors). */
export function QueuesEditor({ config, ops, intradayPresets, setIntradayPresets }) {
  const eng = config.engine;
  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="btnbar">
        <button type="button" className="btn primary" onClick={ops.addQueue}>+ Add queue</button>
        <span className="note" style={{ padding: "6px 10px" }}>{config.queues.length} queue(s). Changes recalculate automatically.</span>
      </div>

      <div className="rows">
        {config.queues.map((q, qi) => (
          <details className="erow" key={q.id} open={qi === 0}>
            <summary>
              <span className="chev">▶</span>
              <strong>{q.name}</strong>
              <span className="pill">{q.type}</span>
              <span className="spacer" />
              <span className="btnbar" onClick={(e) => e.preventDefault()}>
                <button type="button" className="btn sm" onClick={() => ops.duplicateQueue(q.id)}>Duplicate</button>
                <button type="button" className="btn sm danger" onClick={() => ops.deleteQueue(q.id)}>Delete</button>
              </span>
            </summary>
            <div className="erow-b">
              <div className="fieldrow">
                <TextField label="Name" value={q.name} onChange={(v) => ops.patchQueue(q.id, ["name"], v)} />
                <SelectField
                  label="Type"
                  value={q.type}
                  onChange={(v) => ops.patchQueue(q.id, ["type"], v)}
                  options={[{ value: "voice", label: "Voice" }, { value: "digital", label: "Digital" }]}
                />
                <NumField label="Base daily volume" value={q.dailyVolume} onChange={(v) => ops.patchQueue(q.id, ["dailyVolume"], v)} hint="Contacts per day before seasonality, scenarios and endogenous load." />
                <NumField label="AHT / handle time" unit="s" value={q.aht} onChange={(v) => ops.patchQueue(q.id, ["aht"], v)} />
              </div>

              {q.type === "voice" ? (
                <div className="fieldrow">
                  <NumField label="ASA target" unit="s" value={q.asaTarget} onChange={(v) => ops.patchQueue(q.id, ["asaTarget"], v)} />
                  <NumField label="Max abandon" unit="%" value={+(q.maxAbandon * 100).toFixed(2)} onChange={(v) => ops.patchQueue(q.id, ["maxAbandon"], v / 100)} />
                  <NumField label="Patience" unit="s" value={q.patience} onChange={(v) => ops.patchQueue(q.id, ["patience"], v)} hint="Mean caller patience — drives the Erlang A abandonment solve." />
                </div>
              ) : (
                <div className="fieldrow">
                  <NumField label="Concurrency" value={q.concurrency} onChange={(v) => ops.patchQueue(q.id, ["concurrency"], v)} hint="Simultaneous conversations an agent handles." />
                  <NumField label="SLA within" unit="min" value={q.digitalSlaMinutes} onChange={(v) => ops.patchQueue(q.id, ["digitalSlaMinutes"], v)} />
                  <NumField label="SLA target" unit="%" value={+(q.digitalSlaPct * 100).toFixed(1)} onChange={(v) => ops.patchQueue(q.id, ["digitalSlaPct"], v / 100)} />
                  <NumField label="Backlog limit" value={q.backlogLimit} onChange={(v) => ops.patchQueue(q.id, ["backlogLimit"], v)} hint="Backlog above this deflects a share to voice next day." />
                  <SelectField
                    label="Deflects to"
                    value={q.deflectsTo || ""}
                    onChange={(v) => ops.patchQueue(q.id, ["deflectsTo"], v || null)}
                    options={[{ value: "", label: "— none —" }, ...config.queues.filter((x) => x.type === "voice").map((x) => ({ value: x.id, label: x.name }))]}
                  />
                </div>
              )}

              <div className="fieldrow">
                <NumField label="Starting FTE" value={q.fte} onChange={(v) => ops.patchQueue(q.id, ["fte"], v)} />
                <NumField label="Shrinkage" unit="%" value={+(q.shrinkage * 100).toFixed(1)} onChange={(v) => ops.patchQueue(q.id, ["shrinkage"], v / 100)} hint="Non-productive time: breaks, training, admin, absence." />
                <NumField label="Fully loaded cost" unit="/yr" value={q.agentCost} onChange={(v) => ops.patchQueue(q.id, ["agentCost"], v)} />
              </div>

              <div>
                <div className="lab" style={{ marginBottom: 6, display: "flex", gap: 6, alignItems: "center" }}>
                  Cross-skill donors <Hint text="Queues this one can borrow spare hours from, in priority order (list order). Flexing happens at day level with a flex proficiency." />
                </div>
                <div className="rowflex">
                  {config.queues.filter((x) => x.id !== q.id).map((x) => (
                    <label key={x.id} className="switch">
                      <input
                        type="checkbox"
                        checked={(q.crossSkill || []).includes(x.id)}
                        onChange={(e) => {
                          const cur = q.crossSkill || [];
                          const next = e.target.checked ? [...cur, x.id] : cur.filter((id) => id !== x.id);
                          ops.patchQueue(q.id, ["crossSkill"], next);
                        }}
                      />
                      <span className="track" aria-hidden="true" />
                      <span>{x.name}</span>
                    </label>
                  ))}
                  {config.queues.length < 2 && <span className="note" style={{ padding: "6px 10px" }}>Add another queue to enable cross-skilling.</span>}
                </div>
              </div>

              <Card title="Intraday arrival pattern" hint="Relative arrival share per 30-min interval. Apply a preset, hand-edit the sliders, then save your curve back to the library.">
                <PresetBar
                  presets={intradayPresets}
                  applyLabel="Intraday preset"
                  onApply={(p) => ops.patchQueue(q.id, ["profile"], [...p.curve])}
                  onSaveAs={(name) => setIntradayPresets((lib) => [...lib, makeIntradayPreset(name, q.profile)])}
                />
                <hr className="sep" style={{ margin: "12px 0" }} />
                <IntradaySliders curve={q.profile} eng={eng} onChange={(next) => ops.patchQueue(q.id, ["profile"], next)} />
              </Card>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
