import { useState, useEffect } from "react";
import { makeDefaultConfig } from "../engine/engine.js";
import { useDeferredSim } from "./hooks.js";
import { useConfigOps } from "./config-ops.js";
import { INTRADAY_PRESETS, SEASONALITY_PRESETS } from "./presets.js";
import { PlanTab } from "./components/PlanTab.jsx";
import { IntradayTab } from "./components/IntradayTab.jsx";
import { QueuesEditor } from "./editors/QueuesEditor.jsx";
import { WorkforceEditor } from "./editors/WorkforceEditor.jsx";
import { MoneyEditor } from "./editors/MoneyEditor.jsx";
import { ScenariosEditor } from "./editors/ScenariosEditor.jsx";
import { SeasonalityEditor } from "./editors/SeasonalityEditor.jsx";

const TABS = [
  { id: "plan", label: "Plan" },
  { id: "intraday", label: "Intraday" },
  { id: "queues", label: "Queues" },
  { id: "workforce", label: "Workforce" },
  { id: "money", label: "Money & engine" },
  { id: "scenarios", label: "Scenarios" },
  { id: "seasonality", label: "Seasonality" },
];

export default function App() {
  const [config, setConfig] = useState(() => makeDefaultConfig());
  const [tab, setTab] = useState("plan");
  const [intradayPresets, setIntradayPresets] = useState(INTRADAY_PRESETS);
  const [seasonalityPresets, setSeasonalityPresets] = useState(SEASONALITY_PRESETS);
  const ops = useConfigOps(setConfig);
  const { sim, pending } = useDeferredSim(config);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="mark">C</span>
          <span>Capacity Simulator</span>
          <small>call centre planning</small>
        </div>
        <span className="spacer" />
        <span className={"recalc" + (pending ? "" : " idle")} role="status" aria-live="polite">
          <span className="dot" aria-hidden="true" />
          {pending ? "Recalculating…" : "Up to date"}
        </span>
      </header>

      <nav className="tabs" role="tablist" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={"tab-" + t.id}
            aria-selected={tab === t.id}
            aria-controls={"panel-" + t.id}
            className="tab"
            onClick={() => setTab(t.id)}
          >{t.label}</button>
        ))}
      </nav>

      <main className="main">
        {TABS.map((t) => (
          <div
            key={t.id}
            role="tabpanel"
            id={"panel-" + t.id}
            aria-labelledby={"tab-" + t.id}
            hidden={tab !== t.id}
          >
            {tab === t.id && <TabBody id={t.id} sim={sim} config={config} ops={ops}
              intradayPresets={intradayPresets} setIntradayPresets={setIntradayPresets}
              seasonalityPresets={seasonalityPresets} setSeasonalityPresets={setSeasonalityPresets}
            />}
          </div>
        ))}
      </main>
    </div>
  );
}

function TabBody({ id, sim, config, ops, intradayPresets, setIntradayPresets, seasonalityPresets, setSeasonalityPresets }) {
  switch (id) {
    case "plan": return <PlanTab sim={sim} />;
    case "intraday": return <IntradayTab sim={sim} />;
    case "queues": return <QueuesEditor config={config} ops={ops} intradayPresets={intradayPresets} setIntradayPresets={setIntradayPresets} />;
    case "workforce": return <WorkforceEditor config={config} ops={ops} />;
    case "money": return <MoneyEditor config={config} ops={ops} />;
    case "scenarios": return <ScenariosEditor config={config} ops={ops} />;
    case "seasonality": return <SeasonalityEditor config={config} ops={ops} seasonalityPresets={seasonalityPresets} setSeasonalityPresets={setSeasonalityPresets} />;
    default: return null;
  }
}
