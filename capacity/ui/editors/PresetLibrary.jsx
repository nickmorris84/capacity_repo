import { useState } from "react";
import { NumField } from "../components/primitives.jsx";
import { IntradaySliders } from "./PresetBar.jsx";
import { makeSeasonalityPreset, makeIntradayPreset } from "../presets.js";
import { MONTHS } from "../format.js";

/* Preset library manager (Settings). Seasonality and Arrival patterns are LISTS
   here: create, rename, edit and delete named patterns. Built-ins are read-only.
   Application (which pattern a queue or the system uses) happens on the Queues
   tab — this card never touches the live config. */

function MonthEditor({ months, onChange }) {
  return (
    <div className="fieldrow">
      {MONTHS.map((m, i) => (
        <div key={m} style={{ width: 82 }}>
          <NumField label={m} unit="%" value={+(months[i] * 100).toFixed(0)}
            onChange={(v) => { const n = months.slice(); n[i] = v / 100; onChange(n); }} />
        </div>
      ))}
    </div>
  );
}

export function PresetLibrary({ kind, presets, setPresets, eng }) {
  const [newName, setNewName] = useState("");
  const isSeason = kind === "seasonality";
  const make = isSeason
    ? (name) => makeSeasonalityPreset(name, new Array(12).fill(1))
    : (name) => makeIntradayPreset(name, new Array(24).fill(1));
  const valuesOf = (p) => (isSeason ? p.months : p.curve);

  const update = (id, patch) => setPresets((lib) => lib.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const remove = (id) => setPresets((lib) => lib.filter((p) => p.id !== id));
  const add = () => {
    const name = newName.trim() || (isSeason ? "New seasonality" : "New arrival");
    setPresets((lib) => [...lib, make(name)]);
    setNewName("");
  };

  return (
    <div className="preset-lib">
      <div className="rowflex">
        <input type="text" className="inp" style={{ maxWidth: 220 }} placeholder="new pattern name"
          value={newName} onChange={(e) => setNewName(e.target.value)} data-testid={"preset-new-" + kind} />
        <button type="button" className="btn sm primary" onClick={add} data-testid={"preset-add-" + kind}>+ Add pattern</button>
        <span className="note" style={{ padding: "6px 10px" }}>{presets.length} pattern(s). Built-ins are read-only. Apply patterns to the system or a queue on the Queues tab.</span>
      </div>
      {presets.map((p) => (
        <div className="preset-item" key={p.id}>
          <div className="preset-item-h">
            {p.builtin
              ? <strong>{p.name}</strong>
              : <input type="text" className="inp" style={{ maxWidth: 220 }} value={p.name} aria-label="Pattern name" onChange={(e) => update(p.id, { name: e.target.value })} />}
            <span className="pill">{p.builtin ? "built-in" : "custom"}</span>
            <span className="spacer" />
            {!p.builtin && <button type="button" className="btn sm danger" onClick={() => remove(p.id)} data-testid={"preset-del-" + p.id}>Delete</button>}
          </div>
          {!p.builtin && (isSeason
            ? <MonthEditor months={valuesOf(p)} onChange={(next) => update(p.id, { months: next })} />
            : <IntradaySliders curve={valuesOf(p)} eng={eng} onChange={(next) => update(p.id, { curve: next })} />)}
        </div>
      ))}
    </div>
  );
}
