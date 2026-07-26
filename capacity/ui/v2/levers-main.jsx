/* v2.4 rebuild — standalone mount for the Levers page (Step 4). Runs the engine
 * matrix, so its model carries engineConfig — default to the migrated config.
 */
import { createRoot } from "react-dom/client";
import LeversPage from "./LeversPage.jsx";
import { CSS } from "./tokens.js";
import { makeDefaultConfig } from "../../engine/engine.js";
import { migrateV1ToV2 } from "../../model/migrate.js";

export const OWNER = "nick_morris";
export function defaultLeversModel() { return migrateV1ToV2(makeDefaultConfig()); }

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
  root.render(<LeversPage model={opts.model || defaultLeversModel()} />);
  return root;
}

export { LeversPage };

const el = typeof document !== "undefined" ? document.getElementById("root") : null;
if (el) mount(el);

export default LeversPage;
