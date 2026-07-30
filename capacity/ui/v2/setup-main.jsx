/* v2.4 rebuild — standalone mount for the Setup page (Step 2). Mirrors the v1
 * ui/main.jsx pattern: inject the shared stylesheet once, export mount() for the
 * JSDOM gate and any standalone build, auto-mount #root in a browser.
 */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import SetupPage from "./SetupPage.jsx";
import { CSS } from "./tokens.js";
import { sampleModel, blankModel } from "./model.js";

export const OWNER = "nick_morris";

// Standalone stateful host — the shell (App.jsx) owns the model in the app.
function StatefulSetup({ model: seed, importReport: seedReport }) {
  const [model, setModel] = useState(seed || sampleModel());
  const [report, setReport] = useState(seedReport || null);
  return <SetupPage model={model} onModelChange={setModel} importReport={report} onDismissImport={() => setReport(null)} />;
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
  root.render(<StatefulSetup model={opts.model} importReport={opts.importReport} />);
  return root;
}

export { SetupPage, sampleModel, blankModel };

const el = typeof document !== "undefined" ? document.getElementById("root") : null;
if (el) mount(el);

export default SetupPage;
