import { useState } from "react";
import { SelectField } from "../components/primitives.jsx";

/* Shared apply / save-as mechanic for the intraday and seasonality preset
   libraries. Choosing a preset applies its curve; "Save as new" captures the
   current (hand-edited) curve into the library under a user name. */
export function PresetBar({ presets, onApply, onSaveAs, applyLabel = "Preset" }) {
  const [pick, setPick] = useState("");
  const [name, setName] = useState("");
  return (
    <div className="rowflex">
      <div style={{ minWidth: 200 }}>
        <SelectField
          label={applyLabel}
          value={pick}
          onChange={(v) => { setPick(v); const p = presets.find((x) => x.id === v); if (p) onApply(p); }}
          options={[{ value: "", label: "Apply a preset…" }, ...presets.map((p) => ({ value: p.id, label: p.name + (p.builtin ? "" : " ★") }))]}
        />
      </div>
      <span className="spacer" />
      <label className="field" style={{ minWidth: 160 }}>
        <span className="lab">Save current as</span>
        <input type="text" value={name} placeholder="my preset" onChange={(e) => setName(e.target.value)} />
      </label>
      <button
        type="button"
        className="btn sm"
        disabled={!name.trim()}
        onClick={() => { onSaveAs(name.trim()); setName(""); }}
      >Save as new</button>
    </div>
  );
}

// Per-interval vertical sliders for an intraday curve (relative shares).
export function IntradaySliders({ curve, onChange, eng }) {
  const stepMin = eng.intervalMin;
  return (
    <div className="sliders">
      {curve.map((v, i) => {
        const mins = eng.dayStart * 60 + i * stepMin;
        const label = String(Math.floor(mins / 60)).padStart(2, "0") + ":" + String(mins % 60).padStart(2, "0");
        return (
          <div className="slider-cell" key={i}>
            <span className="val">{v.toFixed(2)}</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={v}
              aria-label={"Interval " + label}
              onChange={(e) => {
                const next = curve.slice();
                next[i] = Number(e.target.value);
                onChange(next);
              }}
            />
            <span className="t">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
