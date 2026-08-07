/* Domain redesign — standalone mount for the six-tab Setup shell (U1). Mirrors
 * setup-main.jsx: inject the shared stylesheet once, export mount() for the
 * JSDOM gate and any standalone build, auto-mount #root in a browser. The
 * default model is the deterministic sample with engine defaults attached, so
 * the shell is reviewable on its own.
 */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import SetupV3Page from "./SetupV3Page.jsx";
import { CSS } from "./tokens.js";
import { sampleDomainModel, blankDomainModel } from "../../model/ops.js";
import { makeDefaultConfig } from "../../engine/engine.js";

export function sampleWithEngine() {
  const m = sampleDomainModel();
  const ec = { ...makeDefaultConfig() };
  delete ec.queues;
  m.engineConfig = ec;
  return m;
}

function StatefulShell({ model: seed }) {
  const [model, setModel] = useState(seed || sampleWithEngine());
  return <SetupV3Page model={model} onModelChange={setModel} />;
}

function injectStyle() {
  if (typeof document === "undefined" || document.getElementById("capacity-v2-style")) return;
  const el = document.createElement("style");
  el.id = "capacity-v2-style";
  el.textContent = CSS;
  document.head.appendChild(el);
}

export function mount(container, opts = {}) {
  injectStyle();
  const root = createRoot(container);
  root.render(<StatefulShell model={opts.model} />);
  return root;
}

export { SetupV3Page, sampleDomainModel, blankDomainModel };

const el = typeof document !== "undefined" ? document.getElementById("root") : null;
if (el) mount(el);

export default SetupV3Page;
