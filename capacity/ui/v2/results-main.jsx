/* v2.4 rebuild — standalone mount for the Results page (Step 3). Mirrors the v1
 * ui/main.jsx pattern. Results runs the engine, so its model must carry the
 * preserved global config (engineConfig): we default to the migrated shipping
 * default config, which does exactly that.
 */
import { createRoot } from "react-dom/client";
import ResultsPage from "./ResultsPage.jsx";
import { CSS } from "./tokens.js";
import { makeDefaultConfig } from "../../engine/engine.js";
import { migrateV1ToV2 } from "../../model/migrate.js";

export const OWNER = "nick_morris";

export function defaultResultsModel() { return migrateV1ToV2(makeDefaultConfig()); }

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
  root.render(<ResultsPage model={opts.model || defaultResultsModel()} />);
  return root;
}

export { ResultsPage };

const el = typeof document !== "undefined" ? document.getElementById("root") : null;
if (el) mount(el);

export default ResultsPage;
