import { useState } from "react";
import { Card, Hint } from "./primitives.jsx";
import { viewIdsFor } from "../views.js";

/* Scenario-views manager (SPEC §5): create / save / delete named scenario
   combinations. Built-ins (Plan of record, No scenarios) can't be deleted or
   re-membered — Plan of record always mirrors whatever scenarios are currently
   enabled; No scenarios is always empty. User views carry an explicit,
   editable scenario set. */
export function ViewsManager({ config, ops }) {
  const [name, setName] = useState("");
  const enabledIds = config.scenarios.filter((s) => s.enabled).map((s) => s.id);

  return (
    <Card
      title="Scenario views"
      hint="A view is a named set of enabled scenarios. Select one as the active view (top bar) to drive the dashboard, or overlay several on the Strategies tab."
      right={
        <div className="rowflex">
          <input type="text" className="inp" style={{ width: 160 }} placeholder="new view name" value={name} onChange={(e) => setName(e.target.value)} />
          <button
            type="button"
            className="btn sm primary"
            disabled={!name.trim()}
            onClick={() => { ops.addView(name.trim(), enabledIds); setName(""); }}
          >Save enabled as view</button>
        </div>
      }
    >
      <p className="note" style={{ marginBottom: 12 }}>
        "Save enabled as view" captures the {enabledIds.length} currently-enabled scenario(s) as a reusable named combination.
      </p>
      <div className="rows">
        {config.views.map((v) => {
          const ids = viewIdsFor(config, v.id);
          const editable = !v.builtin && Array.isArray(v.scenarioIds);
          return (
            <div className="erow" key={v.id}>
              <div className="erow-h">
                {v.builtin ? <span className="pill">built-in</span> : <span className="tag soft">saved</span>}
                {editable ? (
                  <input
                    type="text"
                    className="inp"
                    style={{ maxWidth: 240 }}
                    value={v.name}
                    aria-label="View name"
                    onChange={(e) => ops.renameView(v.id, e.target.value)}
                  />
                ) : (
                  <strong>{v.name}</strong>
                )}
                <span className="pill">{ids.length} scenario(s)</span>
                <span className="spacer" />
                {!v.builtin && <button type="button" className="btn sm danger" onClick={() => ops.deleteView(v.id)}>Delete</button>}
              </div>
              <div className="erow-b">
                {v.id === "v_por" && <p className="note">Tracks the live enabled set — currently: {enabledIds.length ? config.scenarios.filter((s) => s.enabled).map((s) => s.name).join(", ") : "none"}.</p>}
                {v.id === "v_none" && <p className="note">Always empty — the baseline with no scenarios applied.</p>}
                {editable && (
                  <div className="rowflex">
                    {config.scenarios.map((s) => (
                      <label key={s.id} className="switch">
                        <input
                          type="checkbox"
                          checked={v.scenarioIds.includes(s.id)}
                          onChange={(e) => ops.toggleViewScenario(v.id, s.id, e.target.checked)}
                        />
                        <span className="track" aria-hidden="true" />
                        <span>{s.name}</span>
                      </label>
                    ))}
                    {config.scenarios.length === 0 && <span className="note" style={{ padding: "6px 10px" }}>No scenarios to add.</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
