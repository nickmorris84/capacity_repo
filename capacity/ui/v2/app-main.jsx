/* v2.4 rebuild — integrated app entry. Mounts the shell on a single v2 model
 * seeded from the migrated default config (carries brands/queues/services/
 * profiles for Setup + the engineConfig the adapter needs for Levers/Results).
 */
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { CSS } from "./tokens.js";
import { makeDefaultConfig } from "../../engine/engine.js";
import { migrateV1ToV2 } from "../../model/migrate.js";

export const OWNER = "nick_morris";

export function seedModel() { return migrateV1ToV2(makeDefaultConfig()); }

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
  root.render(<App initialModel={opts.model || seedModel()} />);
  return root;
}

export { App };

const el = typeof document !== "undefined" ? document.getElementById("root") : null;
if (el) mount(el);

export default App;
