import { useState } from "react";
import { SelectField } from "../components/primitives.jsx";

/* Apply-only preset selector. Patterns are created and edited in Settings; on the
   Queues tab you only apply them. Choosing a pattern applies its values and then
   resets, so the same pattern can be re-applied. */
export function ApplyPreset({ presets, onApply, label = "Apply pattern" }) {
  const [pick, setPick] = useState("");
  return (
    <div style={{ minWidth: 200, maxWidth: 260 }}>
      <SelectField
        label={label}
        value={pick}
        onChange={(v) => { const p = presets.find((x) => x.id === v); if (p) onApply(p); setPick(""); }}
        options={[{ value: "", label: "Apply a pattern…" }, ...presets.map((p) => ({ value: p.id, label: p.name + (p.builtin ? "" : " ★") }))]}
      />
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
