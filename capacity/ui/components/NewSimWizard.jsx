import { useState } from "react";
import { uid, clamp, generateWeeklySeries } from "../../engine/engine.js";
import { blankQueue, applyChannelTemplate, CHANNEL_PRESETS, CHANNEL_PRESET_LIST } from "../config-ops.js";
import { NumField, TextField, SelectField, Card } from "./primitives.jsx";

/* §26.5 new-simulation wizard. Flow (c) runs all four steps over a blank world
   pre-filled with defaults; flow (a) arrives with another simulation's
   Simulation Settings already copied and starts at the Brands step. Back/next,
   a progress indicator, and escape-to-landing throughout. Everything created
   here stays fully editable in the workspace afterwards. */

const STEPS = [
  { key: "settings", label: "Simulation Settings" },
  { key: "brands", label: "Brands" },
  { key: "channels", label: "Channels" },
  { key: "queues", label: "Queues" },
];

export function NewSimWizard({ baseConfig, startStep = 0, defaultName, seasonalityPresets, onFinish, onCancel }) {
  const [step, setStep] = useState(startStep);
  const [name, setName] = useState(defaultName || "New simulation");
  const [config, setConfig] = useState(baseConfig);
  // Queue drafts: quick capture only — name, brand, channel, one weekly figure
  // and an optional seasonality pattern for the wizard to spread it with.
  const [drafts, setDrafts] = useState([]);

  const set = (fn) => setConfig((c) => fn(JSON.parse(JSON.stringify(c))));
  const eng = config.engine, cal = (config.settings && config.settings.calendar) || {};

  const finish = () => {
    const cfg = JSON.parse(JSON.stringify(config));
    cfg.queues = drafts.filter((d) => d.name.trim()).map((d, i) => {
      let q = blankQueue(i + 1);
      q.name = d.name.trim();
      q.brandId = d.brandId || (cfg.brands[0] && cfg.brands[0].id) || "b1";
      const def = (cfg.channelDefs || []).find((x) => x.id === d.channelId) || (cfg.channelDefs || [])[0];
      if (def) q = applyChannelTemplate(q, def);
      q.priority = i + 1;
      q.overrides = { seasonality: false, knockOn: false };
      const weekly = Number(d.weekly) || 0;
      const preset = (seasonalityPresets || []).find((p) => p.id === d.patternId);
      q.weeklyVolumes = generateWeeklySeries(cfg, weekly, preset ? preset.months : new Array(12).fill(1), cfg.engine.horizonWeeks);
      q.dailyVolume = null;
      return q;
    });
    onFinish(name.trim() || "New simulation", cfg);
  };

  const next = () => (step >= STEPS.length - 1 ? finish() : setStep(step + 1));
  const back = () => setStep(Math.max(startStep, step - 1));

  return (
    <div className="app wizard" onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}>
      <header className="topbar">
        <button type="button" className="backlink" onClick={onCancel} data-testid="wizard-cancel">← Simulations</button>
        <div className="brand"><span className="mark">C</span><span>New simulation</span></div>
        <span className="spacer" />
      </header>
      <main className="main" style={{ maxWidth: 860 }}>
        <div className="rowflex" style={{ marginBottom: 14 }}>
          <label className="field" style={{ maxWidth: 320 }}>
            <span className="lab">Simulation name</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} data-testid="wizard-name" />
          </label>
        </div>

        <ol className="wiz-steps" data-testid="wizard-progress">
          {STEPS.map((s, i) => (
            <li key={s.key} className={i === step ? "active" : i < step ? "done" : ""} data-skipped={i < startStep ? "1" : undefined}>
              <span className="wiz-n">{i + 1}</span> {s.label}{i < startStep ? " (inherited)" : ""}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <Card title="Simulation Settings" sub="pre-filled with defaults — edit inline; everything stays editable later">
            <div className="fieldrow">
              <NumField id="wiz-horizon" label="Simulation window" unit="wk" value={eng.horizonWeeks} min={24} max={78}
                onChange={(v) => set((c) => { c.engine.horizonWeeks = clamp(Math.round(v || 52), 24, 78); return c; })} />
              <TextField label="Currency" value={eng.currency} onChange={(v) => set((c) => { c.engine.currency = v || "£"; return c; })} />
              <NumField label="Global starting HC" value={eng.globalStartingHC == null ? 0 : eng.globalStartingHC}
                onChange={(v) => set((c) => { c.engine.globalStartingHC = v || null; return c; })} id="wiz-global-hc" />
              <label className="field" style={{ maxWidth: 200 }}>
                <span className="lab">Week-1 date</span>
                <input type="date" value={cal.weekOneDate || ""} data-testid="wiz-week-one"
                  onChange={(e) => set((c) => { c.settings = c.settings || {}; c.settings.calendar = { ...(c.settings.calendar || {}), weekOneDate: e.target.value || null }; return c; })} />
              </label>
            </div>
            <p className="note">The full Simulation Settings — hiring caps, workforce physics, knock-on defaults, CX economics, risk bands — are all editable in the workspace after Finish.</p>
          </Card>
        )}

        {step === 1 && (
          <Card title="Brands" sub="add one or more">
            <BrandsStep config={config} set={set} />
          </Card>
        )}

        {step === 2 && (
          <Card title="Channels" sub="created from the global channel presets">
            <ChannelsStep config={config} set={set} />
          </Card>
        )}

        {step === 3 && (
          <Card title="Queues" sub="name · brand · channel · quick volume">
            <QueuesStep config={config} drafts={drafts} setDrafts={setDrafts} seasonalityPresets={seasonalityPresets} />
          </Card>
        )}

        <div className="btnbar" style={{ marginTop: 16 }}>
          {step > startStep && <button type="button" className="btn" onClick={back} data-testid="wizard-back">← Back</button>}
          <span className="spacer" />
          {step < STEPS.length - 1
            ? <button type="button" className="btn primary" onClick={next} data-testid="wizard-next">Next →</button>
            : <button type="button" className="btn primary" onClick={finish} data-testid="wizard-finish">Finish → open workspace</button>}
        </div>
      </main>
    </div>
  );
}

function BrandsStep({ config, set }) {
  const [bname, setBname] = useState("");
  const add = () => {
    const nm = bname.trim() || "Brand " + ((config.brands || []).length + 1);
    set((c) => { c.brands = [...(c.brands || []), { id: "b_" + uid(), name: nm, training: null, dailyVolume: null, weeklyVolumes: null }]; return c; });
    setBname("");
  };
  return (
    <>
      <div className="rowflex" style={{ marginBottom: 10 }}>
        <input type="text" className="inp" style={{ maxWidth: 240 }} placeholder="brand name" value={bname} onChange={(e) => setBname(e.target.value)} data-testid="wiz-brand-name" />
        <button type="button" className="btn sm primary" onClick={add} data-testid="wiz-add-brand">+ Add brand</button>
      </div>
      <div className="rows">
        {(config.brands || []).map((b) => (
          <div className="erow" key={b.id}><div className="erow-h">
            <strong>{b.name}</strong><span className="spacer" />
            <button type="button" className="btn sm danger" onClick={() => set((c) => { c.brands = c.brands.filter((x) => x.id !== b.id); return c; })}>Remove</button>
          </div></div>
        ))}
        {(config.brands || []).length === 0 && <p className="note">No brands yet — add at least one so queues have a home. (You can also finish with none for a blank world.)</p>}
      </div>
    </>
  );
}

function ChannelsStep({ config, set }) {
  const [cname, setCname] = useState("");
  const [preset, setPreset] = useState("voice");
  const add = () => {
    const p = CHANNEL_PRESETS[preset] || CHANNEL_PRESETS.voice;
    const nm = cname.trim() || p.label;
    set((c) => { c.channelDefs = [...(c.channelDefs || []), { id: "ch_" + uid(), name: nm, kind: p.kind, group: p.group, builtin: false, template: JSON.parse(JSON.stringify(p.template)) }]; return c; });
    setCname("");
  };
  return (
    <>
      <div className="rowflex" style={{ marginBottom: 10 }}>
        <input type="text" className="inp" style={{ maxWidth: 220 }} placeholder="channel name (optional)" value={cname} onChange={(e) => setCname(e.target.value)} data-testid="wiz-channel-name" />
        <div style={{ minWidth: 220 }}>
          <SelectField label="From global preset" value={preset} onChange={setPreset} options={CHANNEL_PRESET_LIST} id="wiz-channel-preset" />
        </div>
        <button type="button" className="btn sm primary" style={{ alignSelf: "flex-end" }} onClick={add} data-testid="wiz-add-channel">+ Add channel</button>
      </div>
      <div className="rows">
        {(config.channelDefs || []).map((d) => (
          <div className="erow" key={d.id}><div className="erow-h">
            <strong>{d.name}</strong><span className="pill">{d.group}</span><span className="spacer" />
            <button type="button" className="btn sm danger" onClick={() => set((c) => { c.channelDefs = c.channelDefs.filter((x) => x.id !== d.id); return c; })}>Remove</button>
          </div></div>
        ))}
      </div>
    </>
  );
}

function QueuesStep({ config, drafts, setDrafts, seasonalityPresets }) {
  const brands = config.brands || [], defs = config.channelDefs || [];
  const patch = (i, k, v) => setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, [k]: v } : d)));
  const add = () => setDrafts((ds) => [...ds, {
    name: "Queue " + (ds.length + 1),
    brandId: brands[0] ? brands[0].id : null,
    channelId: defs[0] ? defs[0].id : null,
    weekly: 3500, patternId: "",
  }]);
  return (
    <>
      <p className="note" style={{ marginBottom: 10 }}>Quick capture: one weekly volume figure per queue. Pick a seasonality pattern to have the wizard spread it across the horizon from the week-1 date; leave it Flat for a level series. Full editing — AHT, workforce, SLA, knock-on, sharing — lives in the workspace.</p>
      <div className="rows" style={{ marginBottom: 10 }}>
        {drafts.map((d, i) => (
          <div className="erow" key={i}>
            <div className="erow-h" style={{ flexWrap: "wrap", gap: 10 }}>
              <input type="text" className="inp" style={{ maxWidth: 180 }} value={d.name} aria-label="Queue name" data-testid={"wiz-q-name-" + i} onChange={(e) => patch(i, "name", e.target.value)} />
              <select className="inp" style={{ maxWidth: 150 }} value={d.brandId || ""} aria-label="Brand" data-testid={"wiz-q-brand-" + i} onChange={(e) => patch(i, "brandId", e.target.value)}>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <select className="inp" style={{ maxWidth: 190 }} value={d.channelId || ""} aria-label="Channel" data-testid={"wiz-q-channel-" + i} onChange={(e) => patch(i, "channelId", e.target.value)}>
                {defs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="number" className="inp" style={{ maxWidth: 110 }} value={d.weekly} aria-label="Weekly volume" data-testid={"wiz-q-weekly-" + i} onChange={(e) => patch(i, "weekly", Number(e.target.value) || 0)} />
              <select className="inp" style={{ maxWidth: 170 }} value={d.patternId} aria-label="Seasonality pattern" data-testid={"wiz-q-pattern-" + i} onChange={(e) => patch(i, "patternId", e.target.value)}>
                <option value="">Flat (no seasonality)</option>
                {(seasonalityPresets || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button type="button" className="btn sm danger" onClick={() => setDrafts((ds) => ds.filter((_, j) => j !== i))} aria-label="Remove queue">×</button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="btn sm primary" onClick={add} data-testid="wiz-add-queue" disabled={brands.length === 0}>+ Add queue</button>
      {brands.length === 0 && <p className="note" style={{ marginTop: 8 }}>Add a brand first (step 2) to create queues — or Finish for a blank world.</p>}
    </>
  );
}
