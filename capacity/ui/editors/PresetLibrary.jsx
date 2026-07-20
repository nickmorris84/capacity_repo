import { useState } from "react";
import { NumField } from "../components/primitives.jsx";
import { IntradaySliders } from "./PresetBar.jsx";
import { makeSeasonalityPreset, makeIntradayPreset } from "../presets.js";
import { MONTHS } from "../format.js";

/* §26.6 preset library manager — lives on the landing Global-presets screen
   (the ONLY place patterns are created or edited). Seasonality and Arrival
   patterns are LISTS: create, rename, edit and delete named patterns; built-ins
   are read-only. Applying a pattern (copy-on-apply) happens in a workspace.
   `usageOf(preset)` (optional) returns the names of simulations still
   referencing the preset by provenance — a non-empty result blocks deletion
   and the blocked message names them. */

function MonthEditor({ months, onChange, testid }) {
  return (
    <div className="fieldrow" data-testid={testid}>
      {MONTHS.map((m, i) => (
        <div key={m} style={{ width: 82 }}>
          <NumField label={m} unit="%" value={+(months[i] * 100).toFixed(0)} id={testid ? testid + "-" + i : undefined}
            onChange={(v) => { const n = months.slice(); n[i] = v / 100; onChange(n); }} />
        </div>
      ))}
    </div>
  );
}

export function PresetLibrary({ kind, presets, setPresets, eng, usageOf }) {
  const [newName, setNewName] = useState("");
  const [blocked, setBlocked] = useState(null); // { id, names }
  const isSeason = kind === "seasonality";
  const make = isSeason
    ? (name) => makeSeasonalityPreset(name, new Array(12).fill(1))
    : (name) => makeIntradayPreset(name, new Array(24).fill(1));
  const valuesOf = (p) => (isSeason ? p.months : p.curve);

  const update = (id, patch) => setPresets((lib) => lib.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const remove = (id) => {
    const names = usageOf ? usageOf(id) : [];
    if (names.length) { setBlocked({ id, names }); return; }
    setPresets((lib) => lib.filter((p) => p.id !== id));
  };
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
        <span className="note" style={{ padding: "6px 10px" }}>{presets.length} pattern(s). Edits stay local to this library until a simulation Re-syncs — applying is copy-on-apply, so a live simulation never changes underneath you.</span>
      </div>
      {presets.map((p) => (
        <div className="preset-item" key={p.id} data-testid={"preset-item-" + p.id}>
          <div className="preset-item-h">
            <input type="text" className="inp" style={{ maxWidth: 220 }} value={p.name} aria-label="Pattern name" disabled={p.builtin} onChange={(e) => update(p.id, { name: e.target.value })} />
            <span className="pill">{p.builtin ? "built-in" : "custom"}</span>
            <span className="spacer" />
            {!p.builtin && <button type="button" className="btn sm danger" onClick={() => remove(p.id)} data-testid={"preset-del-" + p.id}>Delete</button>}
          </div>
          {blocked && blocked.id === p.id && (
            <p className="note" data-testid={"preset-del-blocked-" + p.id} style={{ borderColor: "#e6c4bc", background: "var(--risk-tint)", color: "var(--risk-text)" }}>
              Can't delete <strong>{p.name}</strong> — it is in use by: {blocked.names.join(", ")}. Re-sync or re-apply those simulations to a different pattern first.
            </p>
          )}
          {isSeason
            ? <MonthEditor months={valuesOf(p)} onChange={(next) => update(p.id, { months: next })} testid={"preset-months-" + p.id} />
            : <IntradaySliders curve={valuesOf(p)} eng={eng} onChange={(next) => update(p.id, { curve: next })} />}
        </div>
      ))}
    </div>
  );
}
