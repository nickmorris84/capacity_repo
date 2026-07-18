import { NumField, TextField, SelectField, Toggle } from "../components/primitives.jsx";
import { ViewsManager } from "../components/ViewsManager.jsx";

const TYPE_LABELS = {
  growth: "Growth %/mo",
  launch: "Product launch",
  p1: "P1 incident",
  forecastError: "Forecast error",
  attritionShock: "Attrition shock",
  hiringFreeze: "Hiring freeze",
  reducedTraining: "Reduced training",
};

// Type-specific parameter fields.
function ScenarioParams({ s, ti, ops }) {
  const set = (k, v) => ops.patchScenario(ti, ["p", k], v);
  const p = s.p || {};
  switch (s.type) {
    case "growth":
      return <NumField label="Rate" unit="%/mo" value={+(p.rate * 100).toFixed(1)} onChange={(v) => set("rate", v / 100)} />;
    case "launch":
      return (
        <>
          <NumField label="Ramp" unit="wk" value={p.ramp} onChange={(v) => set("ramp", v)} />
          <NumField label="Peak uplift" unit="%" value={+(p.peak * 100).toFixed(0)} onChange={(v) => set("peak", v / 100)} />
          <NumField label="Decay" unit="wk" value={p.decay} onChange={(v) => set("decay", v)} />
        </>
      );
    case "p1":
      return (
        <>
          <NumField label="Spike" unit="%" value={+(p.spike * 100).toFixed(0)} onChange={(v) => set("spike", v / 100)} />
          <NumField label="Days" value={p.days} min={1} max={7} onChange={(v) => set("days", v)} />
        </>
      );
    case "forecastError":
      return <NumField label="Error" unit="%" value={+(p.error * 100).toFixed(0)} onChange={(v) => set("error", v / 100)} />;
    case "attritionShock":
      return <NumField label="Added attrition" unit="%/mo" value={+(p.add * 100).toFixed(1)} onChange={(v) => set("add", v / 100)} />;
    case "hiringFreeze":
      return <NumField label="Duration" unit="wk" value={p.weeks} onChange={(v) => set("weeks", v)} />;
    case "reducedTraining":
      return (
        <>
          <NumField label="Cut weeks" value={p.cutWeeks} onChange={(v) => set("cutWeeks", v)} />
          <NumField label="Start prof." unit="%" value={+(p.startProficiency * 100).toFixed(0)} onChange={(v) => set("startProficiency", v / 100)} />
          <NumField label="Ramp stretch" unit="×" value={p.stretch} step="0.05" onChange={(v) => set("stretch", v)} />
          <NumField label="AHT penalty" unit="%" value={+(p.ahtPenalty * 100).toFixed(0)} onChange={(v) => set("ahtPenalty", v / 100)} />
          <NumField label="Repeat uplift" unit="%" value={+(p.repeatUplift * 100).toFixed(0)} onChange={(v) => set("repeatUplift", v / 100)} />
        </>
      );
    default:
      return null;
  }
}

/* Scenarios editor (SPEC §5). Add unlimited schedulable events; toggle each on
   or off. The simulation runs with the enabled set. (Named scenario views land
   in P3.) */
export function ScenariosEditor({ config, ops }) {
  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="btnbar">
        <SelectField
          label="Add scenario"
          value=""
          onChange={(v) => v && ops.addScenario(v)}
          options={[{ value: "", label: "Choose a type…" }, ...Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))]}
        />
        <span className="note" style={{ padding: "6px 10px", alignSelf: "flex-end" }}>{config.scenarios.filter((s) => s.enabled).length} enabled of {config.scenarios.length}.</span>
      </div>

      <div className="rows">
        {config.scenarios.map((s, ti) => (
          <div className={"erow"} key={s.id}>
            <div className="erow-h">
              <Toggle checked={s.enabled} onChange={(v) => ops.patchScenario(ti, ["enabled"], v)} />
              <strong>{s.name}</strong>
              <span className="pill">{TYPE_LABELS[s.type] || s.type}</span>
              {s.enabled && <span className="tag soft">enabled</span>}
              <span className="spacer" />
              <button type="button" className="btn sm danger" onClick={() => ops.deleteScenario(s.id)}>Delete</button>
            </div>
            <div className="erow-b">
              <div className="fieldrow">
                <TextField label="Name" value={s.name} onChange={(v) => ops.patchScenario(ti, ["name"], v)} />
                <NumField label="Start week" value={s.startWeek + 1} min={1} onChange={(v) => ops.patchScenario(ti, ["startWeek"], Math.max(0, v - 1))} />
                <SelectField
                  label="Applies to"
                  value={s.queueIds === "all" ? "all" : "some"}
                  onChange={(v) => ops.patchScenario(ti, ["queueIds"], v === "all" ? "all" : [])}
                  options={[{ value: "all", label: "All queues (global)" }, { value: "some", label: "Specific queues" }]}
                  hint="Freeze, attrition shock and reduced training are operation-wide regardless of this setting."
                />
                <ScenarioParams s={s} ti={ti} ops={ops} />
              </div>
              {s.queueIds !== "all" && (
                <div className="rowflex">
                  {config.queues.map((q) => (
                    <label key={q.id} className="switch">
                      <input
                        type="checkbox"
                        checked={(s.queueIds || []).includes(q.id)}
                        onChange={(e) => {
                          const cur = Array.isArray(s.queueIds) ? s.queueIds : [];
                          const next = e.target.checked ? [...cur, q.id] : cur.filter((id) => id !== q.id);
                          ops.patchScenario(ti, ["queueIds"], next);
                        }}
                      />
                      <span className="track" aria-hidden="true" />
                      <span>{q.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {config.scenarios.length === 0 && <div className="empty">No scenarios. Add one above.</div>}
      </div>

      <ViewsManager config={config} ops={ops} />
    </div>
  );
}
