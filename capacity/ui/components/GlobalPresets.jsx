import { useState } from "react";
import { Card, NumField, SelectField } from "./primitives.jsx";
import { PresetLibrary } from "../editors/PresetLibrary.jsx";
import { makeChannelPreset } from "../presets.js";

const KIND_OPTIONS = [
  { value: "voice", label: "Voice (Erlang)" },
  { value: "digitalCustomer", label: "Digital Customer (live)" },
  { value: "digitalWorkflow", label: "Digital Workflow (backlog)" },
  { value: "serviceWorkflow", label: "Service Workflow (support)" },
];
const KIND_LABEL = { voice: "Voice · Erlang", digitalCustomer: "Digital Customer · live", digitalWorkflow: "Digital Workflow · backlog", serviceWorkflow: "Service Workflow · support" };

/* §26.6 channel-preset editor. A channel preset is a reusable template of one
   of the four kinds; creating a channel inside a simulation copies it. Editing
   a preset here never touches channels already created from it (copy-on-apply).*/
function ChannelTemplateEditor({ p, update }) {
  const t = p.template || {};
  const T = (k, v) => update(p.id, { template: { ...t, [k]: v } });
  return (
    <div className="fieldrow">
      {p.kind === "voice" && (
        <>
          <NumField label="ASA target" unit="s" value={t.asaTarget} onChange={(v) => T("asaTarget", v)} />
          <NumField label="Max abandon" unit="%" value={+((t.maxAbandon || 0) * 100).toFixed(1)} onChange={(v) => T("maxAbandon", v / 100)} />
          <NumField label="Patience" unit="s" value={t.patience} onChange={(v) => T("patience", v)} />
        </>
      )}
      {p.kind === "digitalCustomer" && (
        <>
          <NumField label="Concurrency" value={t.concurrency} onChange={(v) => T("concurrency", v)} />
          <NumField label="SLA within" unit="min" value={t.digitalSlaMinutes} onChange={(v) => T("digitalSlaMinutes", v)} />
          <NumField label="SLA target" unit="%" value={+((t.digitalSlaPct || 0) * 100).toFixed(0)} onChange={(v) => T("digitalSlaPct", v / 100)} />
        </>
      )}
      {p.kind === "digitalWorkflow" && (
        <>
          <NumField label="SLA within" unit="h" value={t.workflowSlaHours} onChange={(v) => T("workflowSlaHours", v)} />
          <NumField label="SLA target" unit="%" value={+((t.workflowSlaPct || 0) * 100).toFixed(0)} onChange={(v) => T("workflowSlaPct", v / 100)} />
        </>
      )}
      {p.kind === "serviceWorkflow" && (
        <>
          <NumField label="SLA within" unit="days" value={Math.round((t.workflowSlaHours || 0) / 24)} onChange={(v) => T("workflowSlaHours", (v || 0) * 24)} />
          <NumField label="SLA target" unit="%" value={+((t.workflowSlaPct || 0) * 100).toFixed(0)} onChange={(v) => T("workflowSlaPct", v / 100)} />
        </>
      )}
    </div>
  );
}

function ChannelPresetLibrary({ presets, setPresets }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState("voice");
  const update = (id, patch) => setPresets((lib) => lib.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const remove = (id) => setPresets((lib) => lib.filter((p) => p.id !== id));
  const add = () => { setPresets((lib) => [...lib, makeChannelPreset(name.trim(), kind)]); setName(""); };
  return (
    <div className="preset-lib">
      <div className="rowflex">
        <input type="text" className="inp" style={{ maxWidth: 200 }} placeholder="new channel preset name" value={name} onChange={(e) => setName(e.target.value)} data-testid="preset-new-channel" />
        <div style={{ minWidth: 210 }}><SelectField label="Kind" value={kind} onChange={setKind} options={KIND_OPTIONS} id="preset-channel-kind" /></div>
        <button type="button" className="btn sm primary" style={{ alignSelf: "flex-end" }} onClick={add} data-testid="preset-add-channel">+ Add channel preset</button>
      </div>
      {presets.map((p) => (
        <div className="preset-item" key={p.id} data-testid={"preset-item-" + p.id}>
          <div className="preset-item-h">
            <input type="text" className="inp" style={{ maxWidth: 220 }} value={p.name} aria-label="Preset name" disabled={p.builtin} onChange={(e) => update(p.id, { name: e.target.value })} />
            <span className="pill">{KIND_LABEL[p.kind] || p.kind}</span>
            <span className="pill">{p.builtin ? "built-in" : "custom"}</span>
            <span className="spacer" />
            {!p.builtin && <button type="button" className="btn sm danger" onClick={() => remove(p.id)} data-testid={"preset-del-" + p.id}>Delete</button>}
          </div>
          <ChannelTemplateEditor p={p} update={update} />
        </div>
      ))}
    </div>
  );
}

/* §26.6 Global presets — the ONLY place presets are created or edited, available
   to every simulation. Three libraries; all persisted app-wide. */
export function GlobalPresets({ onBack, channelPresets, setChannelPresets, intradayPresets, setIntradayPresets, seasonalityPresets, setSeasonalityPresets, usageOf, eng }) {
  return (
    <div className="app landing" data-testid="global-presets">
      <header className="topbar">
        <button type="button" className="backlink" onClick={onBack} data-testid="presets-back">← Simulations</button>
        <div className="brand"><span className="mark">C</span><span>Global presets</span></div>
        <span className="spacer" />
      </header>
      <main className="main" style={{ maxWidth: 1000 }}>
        <p className="note" style={{ marginBottom: 16 }}>
          The single home for presets, shared by every simulation. Editing a preset here never changes a running simulation or its saved runs — a simulation only picks up new values when you Re-sync it (apply is copy-on-apply).
        </p>
        <Card title="Channel presets" sub="four built-ins + your own" hint="Reusable channel templates. Creating a channel inside a simulation copies the chosen preset.">
          <ChannelPresetLibrary presets={channelPresets} setPresets={setChannelPresets} />
        </Card>
        <Card title="Seasonality patterns" sub="library">
          <PresetLibrary kind="seasonality" presets={seasonalityPresets} setPresets={setSeasonalityPresets} eng={eng} usageOf={usageOf} />
        </Card>
        <Card title="Arrival patterns" sub="library">
          <PresetLibrary kind="arrival" presets={intradayPresets} setPresets={setIntradayPresets} eng={eng} usageOf={usageOf} />
        </Card>
      </main>
    </div>
  );
}
